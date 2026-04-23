from fastapi import APIRouter, HTTPException, status

from app.schemas.device import (
    BulkDeleteResponse,
    DeviceResponse,
    DeviceUpdate,
    ExternalScanRequest,
)
from app.services import discovery

router = APIRouter()


@router.get("/", response_model=list[DeviceResponse])
async def list_devices():
    """Return all discovered IoT devices from the database."""
    return await discovery.get_all_devices()


@router.post("/scan", response_model=list[DeviceResponse])
async def scan_devices():
    """Trigger an ARP/DHCP scan to discover devices on the local network."""
    return await discovery.scan_network()


@router.post("/external-scan", response_model=list[DeviceResponse])
async def external_scan(req: ExternalScanRequest):
    """Ingest devices discovered by an external scanner (e.g. the Windows
    host helper reading the hotspot's ARP table)."""
    return await discovery.external_scan(req.devices)


@router.patch("/{device_id}", response_model=DeviceResponse)
async def update_device(device_id: int, patch: DeviceUpdate):
    """Update metadata (name, model, version, description) for a specific device."""
    device = await discovery.update_device(device_id, patch)
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found",
        )
    return device


@router.delete("/{device_id}")
async def delete_device(device_id: int):
    """Remove a single device and all its related records (cascaded)."""
    deleted = await discovery.delete_device(device_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found",
        )
    return {"message": f"Deleted device {device_id}"}


@router.delete("/", response_model=BulkDeleteResponse)
async def delete_all_devices():
    """Remove every device row (and all cascaded firewall rules, captures,
    traffic history, and IPS alerts)."""
    count = await discovery.delete_all_devices()
    return BulkDeleteResponse(
        deleted_count=count,
        message=f"Cleared {count} device(s) and all related records",
    )
