"""Whitelist firewall service: iptables rule management."""

import ipaddress
import logging
import re
from typing import Optional

from app.database import get_db
from app.schemas.firewall import (
    FirewallDeviceCounter,
    FirewallRuleCreate,
    FirewallRuleResponse,
    FirewallRuleUpdate,
)
from app.utils import shell

logger = logging.getLogger(__name__)

COUNTER_CHAIN = "SR_COUNTERS"
COUNTER_COMMENT_PREFIX = "sr-counter"

_COUNTER_LINE_RE = re.compile(
    r"^\s*\d+\s+(?P<pkts>\d+)\s+(?P<bytes>\d+)\s+RETURN\s+\S+\s+--\s+\S+\s+\S+\s+(?P<src>\S+)\s+(?P<dst>\S+)\s*/\*\s*(?P<comment>.*?)\s*\*/"
)
_COMMENT_ID_RE = re.compile(r"device_id=(\d+)")
_COMMENT_DIR_RE = re.compile(r"dir=(src|dst)")


def _validate_ip(ip: str) -> str:
    """Validate and return a canonical IP address string, or raise ValueError."""
    try:
        return str(ipaddress.ip_address(ip))
    except ValueError as exc:
        raise ValueError(f"Invalid IP address: {ip}") from exc


async def get_all_rules() -> list[FirewallRuleResponse]:
    """Return all whitelist rules from the database."""
    async with get_db() as db:
        rows = await db.execute_fetchall("SELECT * FROM firewall_rules ORDER BY id")
        return [FirewallRuleResponse(**dict(row)) for row in rows]


async def add_rule(rule: FirewallRuleCreate) -> FirewallRuleResponse:
    """Validate and persist a new whitelist rule."""
    dest_ip = _validate_ip(str(rule.dest_ip))

    async with get_db() as db:
        cursor = await db.execute(
            "INSERT INTO firewall_rules (device_id, dest_ip, dest_port, protocol) VALUES (?, ?, ?, ?)",
            (rule.device_id, dest_ip, rule.dest_port, rule.protocol),
        )
        await db.commit()
        row = await db.execute_fetchall("SELECT * FROM firewall_rules WHERE id = ?", (cursor.lastrowid,))
        return FirewallRuleResponse(**dict(row[0]))


async def update_rule(rule_id: int, patch: FirewallRuleUpdate) -> Optional[FirewallRuleResponse]:
    """Update an existing rule. Returns None if not found."""
    async with get_db() as db:
        row = await db.execute_fetchall("SELECT * FROM firewall_rules WHERE id = ?", (rule_id,))
        if not row:
            return None

        updates: dict[str, object] = {}
        if patch.device_id is not None:
            updates["device_id"] = patch.device_id
        if patch.dest_ip is not None:
            updates["dest_ip"] = _validate_ip(str(patch.dest_ip))
        if patch.protocol is not None:
            updates["protocol"] = patch.protocol.value if hasattr(patch.protocol, "value") else patch.protocol
        if patch.clear_port:
            updates["dest_port"] = None
        elif patch.dest_port is not None:
            updates["dest_port"] = patch.dest_port

        if updates:
            set_clause = ", ".join(f"{col} = ?" for col in updates)
            values = list(updates.values()) + [rule_id]
            await db.execute(f"UPDATE firewall_rules SET {set_clause} WHERE id = ?", values)  # noqa: S608
            await db.commit()

        row = await db.execute_fetchall("SELECT * FROM firewall_rules WHERE id = ?", (rule_id,))
        return FirewallRuleResponse(**dict(row[0]))


async def delete_rule(rule_id: int) -> bool:
    """Delete a rule by ID. Returns False if not found."""
    async with get_db() as db:
        row = await db.execute_fetchall("SELECT id FROM firewall_rules WHERE id = ?", (rule_id,))
        if not row:
            return False
        await db.execute("DELETE FROM firewall_rules WHERE id = ?", (rule_id,))
        await db.commit()
    return True


async def _reset_counter_chain(device_ips: dict[int, str]) -> None:
    await shell.run_async(["iptables", "-N", COUNTER_CHAIN], check=False)
    await shell.run_async(["iptables", "-F", COUNTER_CHAIN], check=False)
    await shell.run_async(["iptables", "-D", "FORWARD", "-j", COUNTER_CHAIN], check=False)
    await shell.run_async(["iptables", "-I", "FORWARD", "1", "-j", COUNTER_CHAIN])

    for device_id, ip in device_ips.items():
        try:
            ip = _validate_ip(ip)
        except ValueError:
            logger.warning("Invalid device IP %s — skipping counter rule for device %d", ip, device_id)
            continue

        await shell.run_async([
            "iptables",
            "-A",
            COUNTER_CHAIN,
            "-s",
            ip,
            "-m",
            "comment",
            "--comment",
            f"{COUNTER_COMMENT_PREFIX} device_id={device_id} dir=src",
            "-j",
            "RETURN",
        ])
        await shell.run_async([
            "iptables",
            "-A",
            COUNTER_CHAIN,
            "-d",
            ip,
            "-m",
            "comment",
            "--comment",
            f"{COUNTER_COMMENT_PREFIX} device_id={device_id} dir=dst",
            "-j",
            "RETURN",
        ])


async def get_device_counters() -> list[FirewallDeviceCounter]:
    async with get_db() as db:
        rows = await db.execute_fetchall("SELECT id, ip FROM devices")
        device_ips: dict[int, str] = {}
        for row in rows:
            ip = row["ip"]
            if not ip:
                continue
            try:
                device_ips[row["id"]] = _validate_ip(ip)
            except ValueError:
                continue

    counters: dict[int, dict[str, int]] = {
        device_id: {
            "rx_bytes": 0,
            "tx_bytes": 0,
            "rx_packets": 0,
            "tx_packets": 0,
        }
        for device_id in device_ips
    }

    proc = await shell.run_async(
        ["iptables", "-L", COUNTER_CHAIN, "-v", "-n", "-x", "--line-numbers"],
        check=False,
    )
    if proc.returncode != 0:
        return []

    output = proc.stdout.decode("utf-8", errors="ignore") if proc.stdout else ""
    for line in output.splitlines():
        if COUNTER_COMMENT_PREFIX not in line:
            continue
        match = _COUNTER_LINE_RE.match(line)
        if not match:
            continue

        comment = match.group("comment")
        id_match = _COMMENT_ID_RE.search(comment)
        dir_match = _COMMENT_DIR_RE.search(comment)
        if not id_match or not dir_match:
            continue

        device_id = int(id_match.group(1))
        direction = dir_match.group(1)
        if device_id not in counters:
            continue

        packets = int(match.group("pkts"))
        bytes_count = int(match.group("bytes"))
        if direction == "src":
            counters[device_id]["tx_packets"] = packets
            counters[device_id]["tx_bytes"] = bytes_count
        else:
            counters[device_id]["rx_packets"] = packets
            counters[device_id]["rx_bytes"] = bytes_count

    return [
        FirewallDeviceCounter(
            device_id=device_id,
            ip=ip,
            **counters[device_id],
        )
        for device_id, ip in device_ips.items()
    ]


async def apply_all_rules() -> None:
    """Flush existing forwarding rules and reapply all whitelist rules from the DB.

    Requires root on the CentOS VM.
    """
    rules = await get_all_rules()

    # Flush the FORWARD chain before re-applying
    await shell.run_async(["iptables", "-F", "FORWARD"])

    # Fetch device IPs for each rule and counter chain
    async with get_db() as db:
        device_ips: dict[int, str] = {}
        rows = await db.execute_fetchall("SELECT id, ip FROM devices")
        for row in rows:
            device_ips[row["id"]] = row["ip"]

    await _reset_counter_chain(device_ips)

    if not rules:
        # No whitelist rules means we leave forwarding open.
        await shell.run_async(["iptables", "-P", "FORWARD", "ACCEPT"])
        logger.info("Firewall rules cleared — forwarding policy set to ACCEPT")
        return

    for rule in rules:
        device_ip = device_ips.get(rule.device_id)
        if not device_ip:
            logger.warning("Device %d not found — skipping rule %d", rule.device_id, rule.id)
            continue

        try:
            device_ip = _validate_ip(device_ip)
        except ValueError:
            logger.warning("Invalid device IP %s — skipping rule %d", device_ip, rule.id)
            continue

        cmd = [
            "iptables", "-A", "FORWARD",
            "-s", device_ip,
            "-d", str(rule.dest_ip),
            "-p", rule.protocol,
        ]
        if rule.dest_port:
            cmd += ["--dport", str(rule.dest_port)]

        cmd += ["-j", "ACCEPT"]

        await shell.run_async(cmd)
        logger.debug("Applied rule %d: %s → %s:%s/%s", rule.id, device_ip, str(rule.dest_ip), rule.dest_port, rule.protocol)

    # Allow return traffic for established connections
    await shell.run_async([
        "iptables", "-A", "FORWARD",
        "-m", "state", "--state", "ESTABLISHED,RELATED",
        "-j", "ACCEPT",
    ])

    # Default DROP for unmatched forwarded traffic
    await shell.run_async(["iptables", "-A", "FORWARD", "-j", "DROP"])
    logger.info("Firewall rules applied (%d rules)", len(rules))
