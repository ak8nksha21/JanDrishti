from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class AnomalyEvidence(BaseModel):
    observations: List[str]
    cost_details: Optional[Dict[str, Any]] = None
    financial_details: Optional[Dict[str, Any]] = None
    utilization_details: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class WorkAnomalyItem(BaseModel):
    id: Optional[int] = None
    work_id: Optional[int] = None
    cost: Optional[float] = None
    category: Optional[str] = None
    district: Optional[str] = None
    constituency: Optional[str] = None
    state: Optional[str] = None
    mp_name: Optional[str] = None

    cost_anomaly_score: Optional[float] = None
    cost_score: Optional[float] = None
    financial_anomaly_score: Optional[float] = None
    ml_anomaly_score: Optional[float] = None
    utilization_anomaly_score: Optional[float] = None
    utilization_score: Optional[float] = None

    anomaly_score: float
    is_anomaly: bool
    anomaly_type: str
    explanation: str
    evidence: Dict[str, Any]

    model_config = ConfigDict(from_attributes=True)


class PaginatedWorkAnomaliesResponse(BaseModel):
    items: List[WorkAnomalyItem]
    total: int
    anomalies_count: int
    page: int
    limit: int
    total_pages: int


class MPAnomalyItem(BaseModel):
    id: Optional[int] = None
    mp_name: Optional[str] = None
    state: Optional[str] = None
    constituency: Optional[str] = None
    allocated_amount: Optional[float] = None
    total_expenditure: Optional[float] = None
    utilization_percentage: Optional[float] = None

    cost_anomaly_score: Optional[float] = None
    cost_score: Optional[float] = None
    financial_anomaly_score: Optional[float] = None
    ml_anomaly_score: Optional[float] = None
    utilization_anomaly_score: Optional[float] = None
    utilization_score: Optional[float] = None

    anomaly_score: float
    is_anomaly: bool
    anomaly_type: str
    explanation: str
    evidence: Dict[str, Any]

    model_config = ConfigDict(from_attributes=True)


class PaginatedMPAnomaliesResponse(BaseModel):
    items: List[MPAnomalyItem]
    total: int
    anomalies_count: int
    page: int
    limit: int
    total_pages: int


class AnomalyEvaluationRequest(BaseModel):
    records: List[Dict[str, Any]]


class AnomalyEvaluationResponse(BaseModel):
    results: List[Dict[str, Any]]
    total: int
    anomalies_count: int
