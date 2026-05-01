from fastapi import APIRouter, HTTPException, status

from app.schemas.ips import IpsSettingsUpdate, IpsStatusResponse
from app.schemas.logs import IpsAlertResponse
from app.services import ips as ips_service

router = APIRouter()


@router.get("/status", response_model=IpsStatusResponse)
async def get_ips_status():
    """Return the current IPS monitoring status and active device thresholds."""
    return await ips_service.get_status()


@router.patch("/settings", response_model=IpsStatusResponse)
async def update_settings(patch: IpsSettingsUpdate):
    """Update global IPS thresholds used for anomaly detection."""
    try:
        return await ips_service.update_settings(patch)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/alerts", response_model=list[IpsAlertResponse])
async def get_alerts():
    """Return all recorded IPS anomaly alerts."""
    return await ips_service.get_alerts()
