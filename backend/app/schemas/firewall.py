from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Protocol(str, Enum):
    tcp = "tcp"
    udp = "udp"
    icmp = "icmp"


class FirewallRuleCreate(BaseModel):
    device_id: int = Field(..., description="Device this rule applies to")
    dest_ip: str = Field(..., description="Allowed destination IP address")
    dest_port: Optional[int] = Field(None, ge=1, le=65535, description="Allowed destination port")
    protocol: Protocol = Field(Protocol.tcp, description="Network protocol")


class FirewallRuleResponse(FirewallRuleCreate):
    id: int
    created_at: str

    model_config = {"from_attributes": True}
