"""Packet capture service: tcpdump session lifecycle and pcap file management."""

import asyncio
import ipaddress
import logging
import os
import re
import subprocess
from datetime import datetime
from typing import Optional

from app.config import settings
from app.database import get_db
from app.schemas.capture import CaptureSessionResponse, CaptureStartRequest, PcapFileResponse
from app.utils import shell

logger = logging.getLogger(__name__)

# device_id → subprocess.Popen handle for active captures
_active_captures: dict[int, subprocess.Popen[bytes]] = {}

# device_id → scheduled stop task for duration-limited captures
_capture_stop_tasks: dict[int, asyncio.Task[None]] = {}


def _log_capture_stop_task_result(device_id: int, task: asyncio.Task[None]) -> None:
    current_task = _capture_stop_tasks.get(device_id)
    if current_task is task:
        _capture_stop_tasks.pop(device_id, None)
    try:
        exception = task.exception()
    except asyncio.CancelledError:
        return

    if exception is not None:
        logger.error("Scheduled capture stop failed", exc_info=(type(exception), exception, exception.__traceback__))


async def _stop_capture_after_delay(device_id: int, delay: int) -> None:
    await asyncio.sleep(delay)
    proc = _active_captures.pop(device_id, None)
    if proc is None:
        return

    await asyncio.to_thread(proc.terminate)

    async with get_db() as db:
        await db.execute(
            "UPDATE capture_sessions SET stopped_at=datetime('now') WHERE device_id=? AND stopped_at IS NULL",
            (device_id,),
        )
        await db.commit()


_FILENAME_SAFE_RE = re.compile(r"[^A-Za-z0-9._-]+")


def _sanitize_filename_base(raw: str) -> str:
    """Strip path separators and unsafe characters. Drops .pcap suffix if present."""
    base = os.path.basename(raw).strip()
    if base.lower().endswith(".pcap"):
        base = base[:-5]
    base = _FILENAME_SAFE_RE.sub("_", base).strip("._-")
    return base


async def start_capture(req: CaptureStartRequest) -> list[CaptureSessionResponse]:
    """Start tcpdump for each requested device. Skips devices already being captured."""
    os.makedirs(settings.pcap_dir, exist_ok=True)
    sessions: list[CaptureSessionResponse] = []

    custom_base = _sanitize_filename_base(req.filename) if req.filename else ""
    multiple_devices = len(req.device_ids) > 1

    async with get_db() as db:
        for device_id in req.device_ids:
            if device_id in _active_captures:
                logger.warning("Capture already running for device %d — skipping", device_id)
                continue

            row = await db.execute_fetchall("SELECT ip FROM devices WHERE id = ?", (device_id,))
            if not row:
                logger.warning("Device %d not found — skipping capture", device_id)
                continue

            device_ip = str(ipaddress.ip_address(row[0]["ip"]))
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            if custom_base:
                # With multiple devices, keep filenames unique by suffixing id.
                name = f"{custom_base}_device{device_id}" if multiple_devices else custom_base
                pcap_file = os.path.join(settings.pcap_dir, f"{name}.pcap")
            else:
                pcap_file = os.path.join(settings.pcap_dir, f"device_{device_id}_{timestamp}.pcap")

            cmd = ["tcpdump", "-i", "any", "-w", pcap_file, f"host {device_ip}"]
            if req.packet_count:
                cmd += ["-c", str(req.packet_count)]

            proc = await asyncio.to_thread(shell.popen, cmd)
            _active_captures[device_id] = proc

            await db.execute(
                "INSERT INTO capture_sessions (device_id, pcap_file, pid) VALUES (?, ?, ?)",
                (device_id, pcap_file, proc.pid),
            )
            await db.commit()

            row = await db.execute_fetchall(
                "SELECT * FROM capture_sessions WHERE device_id=? ORDER BY id DESC LIMIT 1",
                (device_id,),
            )
            sessions.append(CaptureSessionResponse(**dict(row[0])))

            if req.duration is not None:
                task = asyncio.create_task(_stop_capture_after_delay(device_id, req.duration))
                _capture_stop_tasks[device_id] = task
                task.add_done_callback(lambda t, device_id=device_id: _log_capture_stop_task_result(device_id, t))

    return sessions


async def stop_capture(device_id: int) -> bool:
    """Terminate the tcpdump process for a device. Returns False if no session is active."""
    stop_task = _capture_stop_tasks.pop(device_id, None)
    if stop_task is not None:
        stop_task.cancel()

    proc = _active_captures.pop(device_id, None)
    if proc is None:
        return False

    await asyncio.to_thread(proc.terminate)

    async with get_db() as db:
        await db.execute(
            "UPDATE capture_sessions SET stopped_at=datetime('now') WHERE device_id=? AND stopped_at IS NULL",
            (device_id,),
        )
        await db.commit()

    return True


async def list_pcap_files() -> list[PcapFileResponse]:
    """Return metadata for all saved .pcap files in the pcap directory."""
    files: list[PcapFileResponse] = []
    pcap_dir = settings.pcap_dir

    if not os.path.isdir(pcap_dir):
        return files

    for filename in sorted(os.listdir(pcap_dir)):
        if not filename.endswith(".pcap"):
            continue
        path = os.path.join(pcap_dir, filename)
        stat = os.stat(path)
        files.append(
            PcapFileResponse(
                filename=filename,
                size_bytes=stat.st_size,
                created_at=datetime.fromtimestamp(stat.st_ctime).isoformat(),
            )
        )
    return files


async def delete_pcap_file(filename: str) -> bool:
    """Delete a .pcap file by name. Returns False if the file does not exist."""
    # Sanitize: reject any path traversal attempts
    if "/" in filename or "\\" in filename or ".." in filename:
        return False

    path = os.path.join(settings.pcap_dir, filename)
    if not os.path.isfile(path):
        return False

    os.remove(path)
    return True
