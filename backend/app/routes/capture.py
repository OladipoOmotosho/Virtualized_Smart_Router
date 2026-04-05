from fastapi import APIRouter, HTTPException, status

from app.schemas.capture import (
    CaptureSessionResponse,
    CaptureStartRequest,
    CaptureStopRequest,
    PcapFileResponse,
)
from app.services import capture as capture_service

router = APIRouter()


@router.post("/start", response_model=list[CaptureSessionResponse], status_code=status.HTTP_201_CREATED)
async def start_capture(req: CaptureStartRequest):
    """Start a tcpdump capture session for one or more devices."""
    return await capture_service.start_capture(req)


@router.post("/stop")
async def stop_capture(req: CaptureStopRequest):
    """Stop an active capture session for a device."""
    stopped = await capture_service.stop_capture(req.device_id)
    if not stopped:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active capture session for device {req.device_id}",
        )
    return {"message": f"Capture stopped for device {req.device_id}"}


@router.get("/files", response_model=list[PcapFileResponse])
async def list_pcap_files():
    """List all saved .pcap files."""
    return await capture_service.list_pcap_files()


@router.delete("/files/{filename}")
async def delete_pcap_file(filename: str):
    """Delete a saved .pcap file by name."""
    deleted = await capture_service.delete_pcap_file(filename)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{filename}' not found",
        )
    return {"message": f"Deleted {filename}"}
