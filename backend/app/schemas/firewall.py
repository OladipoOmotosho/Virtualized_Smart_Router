from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, IPvAnyAddress


class Protocol(str, Enum):
    tcp = "tcp"
    udp = "udp"
    icmp = "icmp"


class FirewallRuleCreate(BaseModel):
    device_id: int = Field(..., description="Device this rule applies to")
    dest_ip: IPvAnyAddress = Field(..., description="Allowed destination IP address")
    dest_port: Optional[int] = Field(None, ge=1, le=65535, description="Allowed destination port")
    protocol: Protocol = Field(Protocol.tcp, description="Network protocol")


class FirewallRuleUpdate(BaseModel):
    """Partial update — every field is optional."""
    device_id: Optional[int] = Field(None, description="Reassign to a different device")
    dest_ip: Optional[IPvAnyAddress] = Field(None, description="New destination IP")
    dest_port: Optional[int] = Field(None, ge=1, le=65535, description="New destination port (or omit to keep)")
    protocol: Optional[Protocol] = Field(None, description="New protocol")
    clear_port: bool = Field(False, description="Set true to explicitly clear the port (any-port)")


class FirewallRuleResponse(FirewallRuleCreate):
    id: int
    created_at: str

    model_config = {"from_attributes": True}


class FirewallDeviceCounter(BaseModel):
    device_id: int
    ip: str
    rx_bytes: int
    tx_bytes: int
    rx_packets: int
    tx_packets: int
