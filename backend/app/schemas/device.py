import ipaddress
import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator


_MAC_RE = re.compile(r"^(?:[0-9A-Fa-f]{2}(?P<sep>[:-])[0-9A-Fa-f]{2}(?:\1[0-9A-Fa-f]{2}){4}|[0-9A-Fa-f]{12})$")


class DeviceBase(BaseModel):
    name: Optional[str] = Field(None, description="Human-readable device name")
    model: Optional[str] = Field(None, description="Device model")
    version: Optional[str] = Field(None, description="Firmware or software version")
    description: Optional[str] = Field(None, description="Free-text notes")


class DeviceCreate(DeviceBase):
    mac: str = Field(..., description="MAC address (aa:bb:cc:dd:ee:ff, case-insensitive)")
    ip: str = Field(..., description="IPv4 address")
    ipv6: Optional[str] = Field(None, description="IPv6 address (if available)")
    vendor: Optional[str] = Field(None, description="Vendor from MAC OUI lookup")

    @field_validator("mac")
    @classmethod
    def validate_mac(cls, value: str) -> str:
        if not _MAC_RE.fullmatch(value):
            raise ValueError("Invalid MAC address")

        normalized = value.replace(":", "").replace("-", "").lower()
        return ":".join(normalized[index : index + 2] for index in range(0, 12, 2))

    @field_validator("ip")
    @classmethod
    def validate_ip(cls, value: str) -> str:
        # Rows discovered only via the IPv6 neighbour table are persisted
        # with ip='' until an IPv4 answer comes in. Allow the placeholder
        # through so DeviceResponse can roundtrip it.
        if not value:
            return ""
        try:
            return str(ipaddress.IPv4Address(value))
        except ValueError as exc:
            raise ValueError("Invalid IPv4 address") from exc

    @field_validator("ipv6")
    @classmethod
    def validate_ipv6(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        try:
            return str(ipaddress.IPv6Address(value))
        except ValueError as exc:
            raise ValueError("Invalid IPv6 address") from exc


class DeviceUpdate(DeviceBase):
    pass


class DeviceResponse(DeviceCreate):
    id: int
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ExternalDeviceEntry(BaseModel):
    """Single device reported by an external scanner (e.g. the Windows host helper)."""
    mac: str
    ip: str
    hostname: Optional[str] = None


class ExternalScanRequest(BaseModel):
    """Payload sent by the host-side discovery script to seed hotspot devices."""
    devices: list[ExternalDeviceEntry]


class BulkDeleteResponse(BaseModel):
    deleted_count: int
    message: str
