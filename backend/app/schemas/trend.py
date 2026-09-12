from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class TrendSeriesPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    period: str
    value: float


class TrendResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    metric: str
    trend_direction: str
    trend_strength: str
    overall_trajectory: Optional[str] = None
    current_value: Optional[float] = None
    previous_value: Optional[float] = None
    change_percentage: Optional[float] = None
    linear_slope: Optional[float] = None
    observation_period: str
    baseline: str
    interpretation: str
    confidence: Optional[str] = None
    status: str
    total_periods: Optional[int] = None
    active_periods: Optional[int] = None
    total_observations: Optional[float] = None
    unit: Optional[str] = None
    required_data: Optional[str] = None
    data_scope_note: Optional[str] = None
    historical_series: Optional[List[TrendSeriesPoint]] = None


class TrendSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    completion_activity: TrendResult
    expenditure_trend: TrendResult
    recommendations_trend: TrendResult
    unspent_balance_trend: TrendResult
    data_audit_notice: str
