from pydantic import BaseModel


class TrafficDataPoint(BaseModel):
    recorded_at: str
    rate_kbps: float


class TrafficHistoryResponse(BaseModel):
    device_id: int
    data: list[TrafficDataPoint]


class IpsAlertResponse(BaseModel):
    id: int
    device_id: int
    measured_rate: float
    threshold: float
    triggered_at: str

    model_config = {"from_attributes": True}


class LogPurgeResponse(BaseModel):
    deleted_count: int
    message: str
