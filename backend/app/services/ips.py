"""IPS monitoring service: traffic rate polling, anomaly detection, auto-block."""

import asyncio
import logging
import time
from typing import Any

from app.config import settings
from app.database import get_db
from app.schemas.logs import IpsAlertResponse
from app.utils import email, shell

logger = logging.getLogger(__name__)

# device_id → rate threshold in KB/s (loaded from DB or config)
_thresholds: dict[int, float] = {}

# device_id → previous (bytes, timestamp) for delta calculation
_prev_counters: dict[int, tuple[int, float]] = {}

# Default threshold if none is configured per device
DEFAULT_THRESHOLD_KBPS: float = 500.0

# How long (seconds) to temporarily block a device after an anomaly
BLOCK_DURATION_SECONDS: int = 300

# Keep references to scheduled block-removal tasks so they are not garbage-collected.
ACTIVE_BLOCK_TASKS: set[asyncio.Task[None]] = set()


def _log_block_task_result(task: asyncio.Task[None]) -> None:
    ACTIVE_BLOCK_TASKS.discard(task)
    try:
        exception = task.exception()
    except asyncio.CancelledError:
        return

    if exception is not None:
        logger.error("Scheduled block removal failed", exc_info=(type(exception), exception, exception.__traceback__))


async def get_status() -> dict[str, Any]:
    """Return IPS monitoring status and per-device thresholds."""
    return {
        "poll_interval_seconds": settings.ips_poll_interval,
        "block_duration_seconds": BLOCK_DURATION_SECONDS,
        "monitored_devices": len(_thresholds),
        "thresholds": _thresholds,
    }


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
    anomaly response when a device exceeds its threshold.
    """
    logger.info("IPS monitor started (interval=%ds)", settings.ips_poll_interval)
    while True:
        await asyncio.sleep(settings.ips_poll_interval)
        try:
            await _poll_devices()
        except Exception:
            logger.exception("IPS poll error")


async def _poll_devices() -> None:
    """Read /proc/net/dev counters and check each device against its threshold."""
    counters = await asyncio.to_thread(_read_proc_net_dev)

    history_rows: list[tuple[int, float]] = []
    anomaly_events: list[tuple[int, float, float]] = []

    async with get_db() as db:
        rows = await db.execute_fetchall("SELECT id, ip FROM devices")
        devices = {row["ip"]: row["id"] for row in rows}

        veth_ifaces = {k: v for k, v in counters.items() if k.startswith("veth")}
        if veth_ifaces:
            logger.info("IPS poll: veth counters=%s devices_by_ip=%s", veth_ifaces, devices)

        now = time.monotonic()

        for iface, rx_bytes in counters.items():
            # Map interface name to device — in namespace setup each veth has a known name
            device_id = _interface_to_device_id(iface, devices)
            if device_id is None:
                continue

            if device_id in _prev_counters:
                prev_bytes, prev_time = _prev_counters[device_id]
                delta_bytes = rx_bytes - prev_bytes
                delta_time = now - prev_time

                # Handle /proc/net/dev counter wraparound
                if delta_bytes < 0:
                    delta_bytes += 2**64

                rate_kbps = (delta_bytes / 1024) / delta_time if delta_time > 0 else 0.0

                threshold = _thresholds.get(device_id, DEFAULT_THRESHOLD_KBPS)
                history_rows.append((device_id, rate_kbps))

                if rate_kbps > threshold:
                    anomaly_events.append((device_id, rate_kbps, threshold))

            _prev_counters[device_id] = (rx_bytes, now)

        if history_rows:
            await db.executemany(
                "INSERT INTO traffic_history (device_id, rate_kbps) VALUES (?, ?)",
                history_rows,
            )
            await db.commit()

    for device_id, rate_kbps, threshold in anomaly_events:
        await _handle_anomaly(device_id, rate_kbps, threshold)


async def _handle_anomaly(device_id: int, rate_kbps: float, threshold: float) -> None:
    """Log the anomaly, send email alert, apply a temporary block rule."""
    logger.warning("IPS anomaly: device=%d rate=%.2f kbps threshold=%.2f kbps", device_id, rate_kbps, threshold)

    async with get_db() as db:
        row = await db.execute_fetchall("SELECT ip FROM devices WHERE id = ?", (device_id,))
        if not row:
            return
        device_ip = row[0]["ip"]

        await db.execute(
            "INSERT INTO ips_alerts (device_id, measured_rate, threshold) VALUES (?, ?, ?)",
            (device_id, rate_kbps, threshold),
        )
        await db.commit()

    # Send email alert (non-blocking, errors are swallowed inside send_alert)
    await asyncio.to_thread(email.send_alert, device_ip, rate_kbps, threshold)

    # Apply temporary DROP rule
    await shell.run_async(["iptables", "-I", "FORWARD", "1", "-s", device_ip, "-j", "DROP"], check=False)
    logger.info("Temporary block applied for %s (%ds)", device_ip, BLOCK_DURATION_SECONDS)

    # Schedule rule removal after block duration
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
            for line in f.readlines()[2:]:  # skip two header lines
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
    device ID is actually present in the devices table — otherwise an FK
    insert into traffic_history would fail before any scan has populated devices.
    """
    if not iface.startswith("veth"):
        return None
    try:
        suffix = int(iface[4:])
    except ValueError:
        return None
    expected_ip = f"10.0.0.{suffix + 1}"
    return devices_by_ip.get(expected_ip)
