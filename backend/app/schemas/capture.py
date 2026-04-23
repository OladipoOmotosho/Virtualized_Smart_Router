from typing import Optional

from pydantic import BaseModel, Field


class CaptureStartRequest(BaseModel):
    device_ids: list[int] = Field(..., min_length=1, description="Device IDs to capture traffic for")
    duration: Optional[int] = Field(None, gt=0, description="Capture duration in seconds")
    packet_count: Optional[int] = Field(None, gt=0, description="Max number of packets to capture")
    filename: Optional[str] = Field(
        None,
        max_length=80,
        description="Custom pcap filename base (sanitized). Device id + timestamp are appended when multiple devices are captured.",
    )


class CaptureStopRequest(BaseModel):
    device_id: int = Field(..., description="Device ID whose capture session to stop")


class CaptureSessionResponse(BaseModel):
    id: int
    device_id: int
    pcap_file: str
    started_at: str
    stopped_at: Optional[str]

    model_config = {"from_attributes": True}


class PcapFileResponse(BaseModel):
    filename: str
    size_bytes: int
    created_at: str
