"""IPS monitoring service: traffic rate polling, anomaly detection, auto-block."""

import asyncio
import logging
import time
from typing import Any, Literal

from app.config import settings
from app.database import get_db
from app.schemas.capture import CaptureStartRequest
from app.schemas.ips import IpsSettingsUpdate, IpsStatusResponse
from app.schemas.logs import IpsAlertResponse
from app.services import capture as capture_service
from app.services import firewall as firewall_service
from app.utils import email, shell

logger = logging.getLogger(__name__)

AnomalyType = Literal["high", "low"]

# Ignore rate samples when the interval is too small to be meaningful.
MIN_SAMPLE_INTERVAL_SECONDS: float = 0.25

# How long (seconds) to temporarily block a device after a high anomaly.
BLOCK_DURATION_SECONDS: int = 30

# Forensic capture duration when a high anomaly fires.
ANOMALY_CAPTURE_SECONDS: int = 10

# Keep references to scheduled block-removal tasks so they are not garbage-collected.
ACTIVE_BLOCK_TASKS: set[asyncio.Task[None]] = set()

# device_id → previous (bytes, timestamp) for delta calculation.
_prev_counters: dict[int, tuple[int, float]] = {}


def _log_block_task_result(task: asyncio.Task[None]) -> None:
    ACTIVE_BLOCK_TASKS.discard(task)
    try:
        exception = task.exception()
    except asyncio.CancelledError:
        return

    if exception is not None:
        logger.error(
            "Scheduled block removal failed",
            exc_info=(type(exception), exception, exception.__traceback__),
        )


async def _load_settings(db) -> tuple[float, float]:
    rows = await db.execute_fetchall(
        "SELECT min_threshold_kbps, max_threshold_kbps FROM ips_settings WHERE id = 1"
    )
    if rows:
        return float(rows[0]["min_threshold_kbps"]), float(rows[0]["max_threshold_kbps"])

    await db.execute(
        "INSERT OR IGNORE INTO ips_settings (id, min_threshold_kbps, max_threshold_kbps) VALUES (1, ?, ?)",
        (settings.ips_min_threshold_kbps, settings.ips_max_threshold_kbps),
    )
    await db.commit()
    return settings.ips_min_threshold_kbps, settings.ips_max_threshold_kbps


async def get_status() -> IpsStatusResponse:
    """Return IPS monitoring status and the current min/max thresholds."""
    async with get_db() as db:
        row = await db.execute_fetchall("SELECT COUNT(*) AS cnt FROM devices")
        device_count = row[0]["cnt"] if row else 0
        min_threshold_kbps, max_threshold_kbps = await _load_settings(db)

    return IpsStatusResponse(
        poll_interval_seconds=settings.ips_poll_interval,
        block_duration_seconds=BLOCK_DURATION_SECONDS,
        monitored_devices=device_count,
        alert_recipient=settings.alert_recipient,
        min_threshold_kbps=min_threshold_kbps,
        max_threshold_kbps=max_threshold_kbps,
    )


async def update_settings(patch: IpsSettingsUpdate) -> IpsStatusResponse:
    """Update global IPS thresholds and return the refreshed status."""
    async with get_db() as db:
        current_min, current_max = await _load_settings(db)
        min_threshold = current_min if patch.min_threshold_kbps is None else patch.min_threshold_kbps
        max_threshold = current_max if patch.max_threshold_kbps is None else patch.max_threshold_kbps

        if min_threshold > max_threshold:
            raise ValueError("Minimum threshold cannot exceed maximum threshold")

        await db.execute(
            """
            UPDATE ips_settings
               SET min_threshold_kbps = ?,
                   max_threshold_kbps = ?,
                   updated_at = datetime('now')
             WHERE id = 1
            """,
            (min_threshold, max_threshold),
        )
        await db.commit()

    return await get_status()


async def get_alerts() -> list[IpsAlertResponse]:
    """Return all recorded IPS alerts from the database."""
    async with get_db() as db:
        rows = await db.execute_fetchall(
            "SELECT * FROM ips_alerts ORDER BY triggered_at DESC"
        )
        return [IpsAlertResponse(**dict(row)) for row in rows]


async def monitor_loop() -> None:
    """Background polling loop — run as an asyncio task on startup.

    Reads per-device traffic counters, computes rates, and triggers
    anomaly response when a device exceeds the configured range.
    """
    logger.info("IPS monitor started (interval=%ds)", settings.ips_poll_interval)
    while True:
        await asyncio.sleep(settings.ips_poll_interval)
        try:
            await _poll_devices()
        except Exception:
            logger.exception("IPS poll error")


async def _poll_devices() -> None:
    """Read counters and check each device against the configured thresholds."""
    history_rows: list[tuple[int, float]] = []
    anomaly_events: list[tuple[int, float, float, AnomalyType]] = []

    iptables_counters = await firewall_service.get_device_counters()
    counter_map = {c.device_id: c.rx_bytes + c.tx_bytes for c in iptables_counters}

    async with get_db() as db:
        rows = await db.execute_fetchall("SELECT id, ip FROM devices")
        devices_by_ip = {row["ip"]: row["id"] for row in rows}
        min_threshold_kbps, max_threshold_kbps = await _load_settings(db)

        now = time.monotonic()

        if counter_map:
            for device_id, total_bytes in counter_map.items():
                if device_id in _prev_counters:
                    prev_bytes, prev_time = _prev_counters[device_id]
                    delta_time = now - prev_time

                    if total_bytes < prev_bytes:
                        # Counter reset/restart. Treat this as a fresh baseline
                        # instead of a wraparound so we do not emit a bogus spike.
                        _prev_counters[device_id] = (total_bytes, now)
                        continue

                    if delta_time < MIN_SAMPLE_INTERVAL_SECONDS:
                        _prev_counters[device_id] = (total_bytes, now)
                        continue

                    delta_bytes = total_bytes - prev_bytes

                    rate_kbps = (delta_bytes / 1024) / delta_time
                    history_rows.append((device_id, rate_kbps))

                    if rate_kbps > max_threshold_kbps:
                        anomaly_events.append((device_id, rate_kbps, max_threshold_kbps, "high"))
                    elif min_threshold_kbps > 0 and rate_kbps < min_threshold_kbps:
                        anomaly_events.append((device_id, rate_kbps, min_threshold_kbps, "low"))

                _prev_counters[device_id] = (total_bytes, now)
        else:
            counters = await asyncio.to_thread(_read_proc_net_dev)
            veth_ifaces = {k: v for k, v in counters.items() if k.startswith("veth")}
            if veth_ifaces:
                logger.info("IPS poll: veth counters=%s devices_by_ip=%s", veth_ifaces, devices_by_ip)

            for iface, rx_bytes in counters.items():
                device_id = _interface_to_device_id(iface, devices_by_ip)
                if device_id is None:
                    continue

                if device_id in _prev_counters:
                    prev_bytes, prev_time = _prev_counters[device_id]
                    delta_time = now - prev_time

                    if rx_bytes < prev_bytes:
                        _prev_counters[device_id] = (rx_bytes, now)
                        continue

                    if delta_time < MIN_SAMPLE_INTERVAL_SECONDS:
                        _prev_counters[device_id] = (rx_bytes, now)
                        continue

                    delta_bytes = rx_bytes - prev_bytes

                    rate_kbps = (delta_bytes / 1024) / delta_time
                    history_rows.append((device_id, rate_kbps))

                    if rate_kbps > max_threshold_kbps:
                        anomaly_events.append((device_id, rate_kbps, max_threshold_kbps, "high"))
                    elif min_threshold_kbps > 0 and rate_kbps < min_threshold_kbps:
                        anomaly_events.append((device_id, rate_kbps, min_threshold_kbps, "low"))

                _prev_counters[device_id] = (rx_bytes, now)

        if history_rows:
            await db.executemany(
                "INSERT INTO traffic_history (device_id, rate_kbps) VALUES (?, ?)",
                history_rows,
            )
            await db.commit()

    for device_id, rate_kbps, threshold, anomaly_type in anomaly_events:
        await _handle_anomaly(device_id, rate_kbps, threshold, anomaly_type)


async def _handle_anomaly(
    device_id: int,
    rate_kbps: float,
    threshold: float,
    anomaly_type: AnomalyType,
) -> None:
    """Log the anomaly, send email alert, and block only high anomalies."""
    logger.warning(
        "IPS anomaly: device=%d type=%s rate=%.2f kbps threshold=%.2f kbps",
        device_id,
        anomaly_type,
        rate_kbps,
        threshold,
    )

    async with get_db() as db:
        row = await db.execute_fetchall("SELECT ip FROM devices WHERE id = ?", (device_id,))
        if not row:
            return
        device_ip = row[0]["ip"]

        await db.execute(
            "INSERT INTO ips_alerts (device_id, measured_rate, threshold, anomaly_type) VALUES (?, ?, ?, ?)",
            (device_id, rate_kbps, threshold, anomaly_type),
        )
        await db.commit()

    await asyncio.to_thread(email.send_alert, device_ip, rate_kbps, threshold, anomaly_type)

    if anomaly_type == "low":
        logger.info("Low traffic anomaly recorded for device %d (%s)", device_id, device_ip)
        return

    try:
        await capture_service.start_capture(
            CaptureStartRequest(device_ids=[device_id], duration=ANOMALY_CAPTURE_SECONDS)
        )
        logger.info("Forensic capture started for device %d (%ds)", device_id, ANOMALY_CAPTURE_SECONDS)
    except Exception:
        logger.exception("Failed to start forensic capture for device %d", device_id)

    await shell.run_async(["iptables", "-I", "FORWARD", "1", "-s", device_ip, "-j", "DROP"], check=False)
    logger.info("Temporary block applied for %s (%ds)", device_ip, BLOCK_DURATION_SECONDS)

    task = asyncio.create_task(_remove_block(device_ip, BLOCK_DURATION_SECONDS))
    ACTIVE_BLOCK_TASKS.add(task)
    task.add_done_callback(_log_block_task_result)


async def _remove_block(device_ip: str, delay: int) -> None:
    await asyncio.sleep(delay)
    await shell.run_async(["iptables", "-D", "FORWARD", "-s", device_ip, "-j", "DROP"], check=False)
    logger.info("Temporary block removed for %s", device_ip)


def _read_proc_net_dev() -> dict[str, int]:
    """Parse /proc/net/dev and return {interface: rx_bytes}."""
    result: dict[str, int] = {}
    try:
        with open("/proc/net/dev") as f:
            for line in f.readlines()[2:]:
                parts = line.split()
                if len(parts) >= 2:
                    iface = parts[0].rstrip(":")
                    rx_bytes = int(parts[1])
                    result[iface] = rx_bytes
    except FileNotFoundError:
        logger.debug("/proc/net/dev not found — not running on Linux")
    return result


def _interface_to_device_id(iface: str, devices_by_ip: dict[str, int]) -> int | None:
    """Map a network interface name to a device ID.

    Convention: namespace veth interfaces are named veth<N> where N corresponds
    to the namespace device IP 10.0.0.<N+1>. Returns None unless the resolved
    device ID is actually present in the devices table.
    """
    if not iface.startswith("veth"):
        return None
    try:
        suffix = int(iface[4:])
    except ValueError:
        return None
    expected_ip = f"10.0.0.{suffix + 1}"
    return devices_by_ip.get(expected_ip)
