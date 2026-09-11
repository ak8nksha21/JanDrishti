from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class RiskScoreBase(BaseModel):
    work_id: str
    cost_score: float
    duplicate_score: float
    ml_anomaly_score: float
    utilization_score: float
    geographic_score: float
    data_quality_score: float
    overall_score: float
    risk_level: str
    model_version: str = "v1.0-ensemble"
    flags_json: Optional[List[str]] = None


class RiskScoreOut(RiskScoreBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RiskWorkItem(BaseModel):
    work_id: str
    description: str
    category: str
    cost: float
    state: str
    district: str
    constituency: str
    mp_name: str
    location: str
    overall_score: float
    risk_level: str
    cost_score: float
    duplicate_score: float
    ml_anomaly_score: float
    utilization_score: float
    geographic_score: float
    data_quality_score: float
    flags: List[str] = []
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class RiskSummaryKPIs(BaseModel):
    total_works: int
    total_allocation: float
    total_expenditure: float
    average_utilization: float
    high_risk_works: int
    critical_alerts: int
    risk_distribution: Dict[str, int]
    category_risk: List[Dict[str, Any]]
    top_risk_constituencies: List[Dict[str, Any]]
