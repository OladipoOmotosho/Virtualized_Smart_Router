"""Device discovery: ARP scan, DHCP lease parsing, MAC OUI vendor lookup."""

import asyncio
import logging
import re
from typing import Optional

from app.database import get_db
from app.schemas.device import DeviceCreate, DeviceResponse, DeviceUpdate
from app.utils import shell

logger = logging.getLogger(__name__)

_MAC_RE = re.compile(r"([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}")
_IP_RE = re.compile(r"\d{1,3}(\.\d{1,3}){3}")


async def get_all_devices() -> list[DeviceResponse]:
    """Return all devices stored in the database."""
    async with await get_db() as db:
        rows = await db.execute_fetchall("SELECT * FROM devices ORDER BY id")
        return [DeviceResponse(**dict(row)) for row in rows]


async def scan_network() -> list[DeviceResponse]:
    """Trigger an ARP scan, parse results, upsert devices, and return updated list.

    Requires root — arp-scan or parsing /proc/net/arp on the CentOS VM.
    """
    raw_entries = await asyncio.to_thread(_read_arp_table)
    async with await get_db() as db:
        for mac, ip in raw_entries:
            vendor = _lookup_vendor(mac)
            await db.execute(
                """
                INSERT INTO devices (mac, ip, vendor)
                VALUES (?, ?, ?)
                ON CONFLICT(mac) DO UPDATE SET ip=excluded.ip, updated_at=datetime('now')
                """,
                (mac, ip, vendor),
            )
        await db.commit()
    return await get_all_devices()


async def update_device(device_id: int, patch: DeviceUpdate) -> Optional[DeviceResponse]:
    """Update editable metadata fields for a device. Returns None if not found."""
    async with await get_db() as db:
        row = await db.execute_fetchall("SELECT id FROM devices WHERE id = ?", (device_id,))
        if not row:
            return None

        fields = patch.model_dump(exclude_none=True)
        if not fields:
            row = await db.execute_fetchall("SELECT * FROM devices WHERE id = ?", (device_id,))
            return DeviceResponse(**dict(row[0]))

        set_clause = ", ".join(f"{k} = ?" for k in fields)
        set_clause += ", updated_at = datetime('now')"
        values = list(fields.values()) + [device_id]
        await db.execute(f"UPDATE devices SET {set_clause} WHERE id = ?", values)  # noqa: S608
        await db.commit()

        row = await db.execute_fetchall("SELECT * FROM devices WHERE id = ?", (device_id,))
        return DeviceResponse(**dict(row[0]))


def _read_arp_table() -> list[tuple[str, str]]:
    """Parse /proc/net/arp and return (mac, ip) pairs for reachable hosts."""
    entries: list[tuple[str, str]] = []
    try:
        with open("/proc/net/arp") as f:
            for line in f.readlines()[1:]:  # skip header
                parts = line.split()
                if len(parts) >= 4:
                    ip, mac = parts[0], parts[3]
                    if _IP_RE.match(ip) and _MAC_RE.match(mac) and mac != "00:00:00:00:00:00":
                        entries.append((mac, ip))
    except FileNotFoundError:
        logger.warning("/proc/net/arp not found — not running on Linux")
    return entries


def _lookup_vendor(mac: str) -> Optional[str]:
    """Return vendor string from MAC OUI prefix, or None if unknown."""
    oui = mac.upper().replace(":", "")[:6]
    # TODO: load a local OUI database (e.g. IEEE oui.txt) and do a dict lookup
    return None
