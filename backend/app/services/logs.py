"""Log and file management service: traffic history, system logs, retention purge."""

import logging
from typing import Optional

from app.config import settings
from app.database import get_db
from app.schemas.logs import LogPurgeResponse, TrafficDataPoint, TrafficHistoryResponse

logger = logging.getLogger(__name__)


async def get_traffic_history(
    days: int = 7,
    device_id: Optional[int] = None,
) -> list[TrafficHistoryResponse]:
    """Return per-device traffic rate history for the past N days."""
    async with await get_db() as db:
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
    async with await get_db() as db:
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


async def purge_old_logs() -> LogPurgeResponse:
    """Delete traffic history and IPS alert records older than the retention period."""
    retention = settings.log_retention_days
    async with await get_db() as db:
        c1 = await db.execute(
            "DELETE FROM traffic_history WHERE recorded_at < datetime('now', ? || ' days')",
            (f"-{retention}",),
        )
        c2 = await db.execute(
            "DELETE FROM ips_alerts WHERE triggered_at < datetime('now', ? || ' days')",
            (f"-{retention}",),
        )
        await db.commit()

    deleted = c1.rowcount + c2.rowcount
    logger.info("Purged %d old log records (retention=%d days)", deleted, retention)
    return LogPurgeResponse(
        deleted_count=deleted,
        message=f"Deleted {deleted} records older than {retention} days",
    )
