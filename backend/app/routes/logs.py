from fastapi import APIRouter, Query

from app.schemas.logs import LogPurgeResponse, TrafficHistoryResponse
from app.services import logs as logs_service

router = APIRouter()


@router.get("/traffic", response_model=list[TrafficHistoryResponse])
async def get_traffic_history(
    days: int = Query(7, ge=1, le=90, description="Number of days of history to return"),
    device_id: int | None = Query(None, description="Filter by device ID"),
):
    """Return per-device traffic rate history for the given number of days."""
    return await logs_service.get_traffic_history(days=days, device_id=device_id)


@router.get("/system")
async def get_system_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Return paginated system activity log entries."""
    return await logs_service.get_system_logs(page=page, limit=limit)


@router.delete("/purge", response_model=LogPurgeResponse)
async def purge_old_logs():
    """Delete log and traffic history records older than the configured retention period."""
    return await logs_service.purge_old_logs()
