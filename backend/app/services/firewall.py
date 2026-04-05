"""Whitelist firewall service: iptables rule management."""

import ipaddress
import logging

from app.database import get_db
from app.schemas.firewall import FirewallRuleCreate, FirewallRuleResponse
from app.utils import shell

logger = logging.getLogger(__name__)


def _validate_ip(ip: str) -> str:
    """Validate and return a canonical IP address string, or raise ValueError."""
    try:
        return str(ipaddress.ip_address(ip))
    except ValueError as exc:
        raise ValueError(f"Invalid IP address: {ip}") from exc


async def get_all_rules() -> list[FirewallRuleResponse]:
    """Return all whitelist rules from the database."""
    async with await get_db() as db:
        rows = await db.execute_fetchall("SELECT * FROM firewall_rules ORDER BY id")
        return [FirewallRuleResponse(**dict(row)) for row in rows]


async def add_rule(rule: FirewallRuleCreate) -> FirewallRuleResponse:
    """Validate and persist a new whitelist rule."""
    dest_ip = _validate_ip(str(rule.dest_ip))

    async with await get_db() as db:
        cursor = await db.execute(
            "INSERT INTO firewall_rules (device_id, dest_ip, dest_port, protocol) VALUES (?, ?, ?, ?)",
            (rule.device_id, dest_ip, rule.dest_port, rule.protocol),
        )
        await db.commit()
        row = await db.execute_fetchall("SELECT * FROM firewall_rules WHERE id = ?", (cursor.lastrowid,))
        return FirewallRuleResponse(**dict(row[0]))


async def delete_rule(rule_id: int) -> bool:
    """Delete a rule by ID. Returns False if not found."""
    async with await get_db() as db:
        row = await db.execute_fetchall("SELECT id FROM firewall_rules WHERE id = ?", (rule_id,))
        if not row:
            return False
        await db.execute("DELETE FROM firewall_rules WHERE id = ?", (rule_id,))
        await db.commit()
    return True


async def apply_all_rules() -> None:
    """Flush existing forwarding rules and reapply all whitelist rules from the DB.

    Requires root on the CentOS VM.
    """
    rules = await get_all_rules()

    # Fetch device IPs for each rule
    async with await get_db() as db:
        device_ips: dict[int, str] = {}
        rows = await db.execute_fetchall("SELECT id, ip FROM devices")
        for row in rows:
            device_ips[row["id"]] = row["ip"]

    # Flush the FORWARD chain before re-applying
    await shell.run_async(["iptables", "-F", "FORWARD"])

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

    # Default DROP for unmatched forwarded traffic
    await shell.run_async(["iptables", "-A", "FORWARD", "-j", "DROP"])
    logger.info("Firewall rules applied (%d rules)", len(rules))
