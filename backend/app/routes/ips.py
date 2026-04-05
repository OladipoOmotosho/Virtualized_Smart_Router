from fastapi import APIRouter

from app.schemas.logs import IpsAlertResponse
from app.services import ips as ips_service

router = APIRouter()


@router.get("/status")
async def get_ips_status():
    """Return the current IPS monitoring status and active device thresholds."""
    return await ips_service.get_status()


@router.get("/alerts", response_model=list[IpsAlertResponse])
async def get_alerts():
    """Return all recorded IPS anomaly alerts."""
    return await ips_service.get_alerts()
