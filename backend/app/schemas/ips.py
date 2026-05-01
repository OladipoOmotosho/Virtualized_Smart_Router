from pydantic import BaseModel, Field


class IpsStatusResponse(BaseModel):
    poll_interval_seconds: int
    block_duration_seconds: int
    monitored_devices: int
    alert_recipient: str
    min_threshold_kbps: float
    max_threshold_kbps: float


class IpsSettingsUpdate(BaseModel):
    min_threshold_kbps: float | None = Field(None, ge=0)
    max_threshold_kbps: float | None = Field(None, ge=0)