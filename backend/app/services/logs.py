"""Log and file management service: traffic history, system logs, retention purge."""

import asyncio
import logging
from typing import Literal, Optional

from app.config import settings
from app.database import get_db
from app.schemas.logs import LogPurgeResponse, TrafficDataPoint, TrafficHistoryResponse

logger = logging.getLogger(__name__)

# Run the automatic retention sweep roughly once a day. Low enough to survive a
# forgotten long-running instance, high enough to not spam the DB.
_AUTO_PURGE_INTERVAL_SECONDS = 24 * 60 * 60

PurgeScope = Literal["traffic", "alerts", "both"]

_SCOPE_LABEL = {
    "traffic": "traffic history",
    "alerts": "IPS alerts",
    "both": "records",
}


async def get_traffic_history(
    days: int = 7,
    device_id: Optional[int] = None,
) -> list[TrafficHistoryResponse]:
    """Return per-device traffic rate history for the past N days."""
    async with get_db() as db:
        if device_id is not None:
            device_ids_rows = await db.execute_fetchall(
                "SELECT id FROM devices WHERE id = ?", (device_id,)
            )
        else:
            device_ids_rows = await db.execute_fetchall("SELECT id FROM devices")

        results: list[TrafficHistoryResponse] = []
        for row in device_ids_rows:
            did = row["id"]
            data_rows = await db.execute_fetchall(
                """
                SELECT recorded_at, rate_kbps
                FROM traffic_history
                WHERE device_id = ?
                  AND recorded_at >= datetime('now', ? || ' days')
                ORDER BY recorded_at
                """,
                (did, f"-{days}"),
            )
            results.append(
                TrafficHistoryResponse(
                    device_id=did,
                    data=[TrafficDataPoint(**dict(r)) for r in data_rows],
                )
            )
        return results


async def get_system_logs(page: int = 1, limit: int = 20) -> dict:
    """Return paginated IPS alerts as a proxy for system activity."""
    offset = (page - 1) * limit
    async with get_db() as db:
        total_row = await db.execute_fetchall("SELECT COUNT(*) AS cnt FROM ips_alerts")
        total = total_row[0]["cnt"]
        rows = await db.execute_fetchall(
            "SELECT * FROM ips_alerts ORDER BY triggered_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
        return {
            "items": [dict(r) for r in rows],
            "total": total,
            "page": page,
            "limit": limit,
        }


async def purge_old_logs(
    scope: PurgeScope = "both",
    older_than_days: Optional[int] = None,
) -> LogPurgeResponse:
    """Delete traffic history and/or IPS alert records.

    scope: "traffic", "alerts", or "both".
    older_than_days: cutoff in days. None deletes every row in the chosen scope.
    """
    traffic_deleted = 0
    alerts_deleted = 0

    async with get_db() as db:
        if scope in ("traffic", "both"):
            if older_than_days is None:
                c = await db.execute("DELETE FROM traffic_history")
            else:
                c = await db.execute(
                    "DELETE FROM traffic_history WHERE recorded_at < datetime('now', ? || ' days')",
                    (f"-{older_than_days}",),
                )
            traffic_deleted = c.rowcount

        if scope in ("alerts", "both"):
            if older_than_days is None:
                c = await db.execute("DELETE FROM ips_alerts")
            else:
                c = await db.execute(
                    "DELETE FROM ips_alerts WHERE triggered_at < datetime('now', ? || ' days')",
                    (f"-{older_than_days}",),
                )
            alerts_deleted = c.rowcount

        await db.commit()

    total = traffic_deleted + alerts_deleted
    cutoff_desc = "(all)" if older_than_days is None else f"older than {older_than_days} days"
    message = f"Deleted {total} {_SCOPE_LABEL[scope]} {cutoff_desc}"
    logger.info(message)
    return LogPurgeResponse(deleted_count=total, message=message)


async def auto_purge_loop() -> None:
    """Background task: periodically delete records older than LOG_RETENTION_DAYS.

    Runs an initial sweep shortly after startup, then once per day. Cancelled
    cleanly by the FastAPI lifespan on shutdown.
    """
    retention = settings.log_retention_days
    if retention <= 0:
        logger.info("Auto-purge disabled (LOG_RETENTION_DAYS=%d)", retention)
        return

    logger.info(
        "Auto-purge loop started — retention=%d days, interval=%ds",
        retention,
        _AUTO_PURGE_INTERVAL_SECONDS,
    )
    # Wait briefly on first run so boot-time work (firewall reload, IPS monitor
    # priming) finishes before we hit the DB.
    await asyncio.sleep(30)
    while True:
        try:
            await purge_old_logs(scope="both", older_than_days=retention)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Auto-purge sweep failed")
        await asyncio.sleep(_AUTO_PURGE_INTERVAL_SECONDS)
