"""
JanDrishti - Pydantic Schemas for Risk Engine API

Defines validated request and response schemas for risk evaluation,
signal submission, alerts, dashboard KPI summaries, and engine configuration.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


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


class CityRiskItem(BaseModel):
    city: str
    constituency: str
    state: str
    risk_score: float
    risk_level: str
    risk_category: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    has_coordinates: bool = False
    projects_count: Optional[int] = None
    total_spend: Optional[float] = None
    allocated_amount: Optional[float] = None
    total_expenditure: Optional[float] = None
    utilization_percentage: Optional[float] = None
    signals: List[str] = []
    mp_name: Optional[str] = None


class CityRiskResponse(BaseModel):
    cities: List[CityRiskItem]
    total_cities: int
    mapped_cities_count: int
    unmapped_cities_count: int
    risk_distribution: Dict[str, int]


class EvidenceItem(BaseModel):
    """Structured evidence item supporting a detection or risk finding."""
    source: str = Field(..., description="Origin of evidence, e.g. 'duplicate_detector', 'anomaly_model'")
    evidence_type: str = Field(..., description="Category of evidence, e.g. 'text_similarity', 'cost_outlier'")
    description: str = Field(..., description="Objective description of the observation")
    reference_id: Optional[str] = Field(None, description="External reference ID (e.g. overlapping work_id)")
    url_or_path: Optional[str] = Field(None, description="Direct URL or archive path to supporting artifact")
    confidence: Optional[float] = Field(None, ge=0.0, le=100.0, description="Optional confidence level in [0, 100]")

    model_config = ConfigDict(extra="ignore")


class RiskEvaluationRequest(BaseModel):
    """Request payload to evaluate risk for a single work item."""
    work_id: str = Field(..., description="Unique identifier of the work item to evaluate")
    signals: Dict[str, Any] = Field(
        default_factory=dict,
        description="Key-value mapping of detection signals (e.g. {'cost_anomaly_score': 82.0, 'duplicate_score': 91.0})"
    )
    evidence: Optional[List[EvidenceItem]] = Field(
        default_factory=list,
        description="Optional list of evidence references provided by upstream detection modules"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Optional contextual metadata (constituency, state, category, etc.)"
    )

    model_config = ConfigDict(extra="ignore")


class BatchRiskEvaluationRequest(BaseModel):
    """Request payload to evaluate risk across multiple work items."""
    items: List[RiskEvaluationRequest] = Field(..., min_length=1, max_length=100, description="List of work items to evaluate")


class SignalBreakdownItem(BaseModel):
    """Detailed breakdown of a single evaluated signal's contribution to composite score."""
    score: float
    configured_weight: float
    effective_weight: float
    weighted_contribution: float

    model_config = ConfigDict(extra="ignore")


class RiskAlertDetail(BaseModel):
    """Structured high-risk alert details."""
    alert_id: str
    work_id: str
    risk_level: str
    risk_score: float
    reasons: List[str]
    human_review_required: bool
    evidence_count: int
    summary: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: str


class RiskEvaluationResponse(BaseModel):
    """Complete evaluation response for a work item under the final JanDrishti contract."""
    work_id: str
    overall_score: Optional[float] = None
    risk_score: Optional[float] = None  # Backward compatibility alias
    risk_level: str
    confidence: float = 1.0
    confidence_score: Optional[float] = None  # Backward compatibility alias
    signal_breakdown: Dict[str, Any] = Field(default_factory=dict)
    contributing_signals: Optional[Dict[str, Any]] = Field(default_factory=dict)  # Backward compatibility alias
    missing_signals: List[str] = Field(default_factory=list)
    observations: List[str] = Field(default_factory=list)
    reasons: Optional[List[str]] = Field(default_factory=list)  # Backward compatibility alias
    top_risk_factors: List[str] = Field(default_factory=list)
    evidence: List[EvidenceItem] = Field(default_factory=list)
    human_review_required: bool = False
    alert_required: bool = False
    alert: Optional[RiskAlertDetail] = None
    metadata: Optional[Dict[str, Any]] = None
    evaluated_at: str

    model_config = ConfigDict(extra="ignore")


class BatchRiskEvaluationResponse(BaseModel):
    """Batch evaluation response summary."""
    items: List[RiskEvaluationResponse]
    total: int
    high_risk_count: int
    alerts_generated: int


class RiskAlertsListResponse(BaseModel):
    """List of active generated alerts."""
    alerts: List[RiskAlertDetail]
    total: int


class RiskEngineConfigResponse(BaseModel):
    """Active configuration and thresholds of the Risk Engine."""
    weights: Dict[str, float]
    thresholds: Dict[str, float]
    risk_levels: List[str]
    description: str
