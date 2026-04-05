from typing import Optional

from pydantic import BaseModel, Field


class DeviceBase(BaseModel):
    name: Optional[str] = Field(None, description="Human-readable device name")
    model: Optional[str] = Field(None, description="Device model")
    version: Optional[str] = Field(None, description="Firmware or software version")
    description: Optional[str] = Field(None, description="Free-text notes")


class DeviceCreate(DeviceBase):
    mac: str = Field(..., description="MAC address (aa:bb:cc:dd:ee:ff)")
    ip: str = Field(..., description="IPv4 address")
    vendor: Optional[str] = Field(None, description="Vendor from MAC OUI lookup")


class DeviceUpdate(DeviceBase):
    pass


class DeviceResponse(DeviceCreate):
    id: int
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}
