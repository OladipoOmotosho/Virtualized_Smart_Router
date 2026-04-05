from fastapi import APIRouter, HTTPException, status

from app.schemas.device import DeviceResponse, DeviceUpdate
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
