from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class SignalBreakdown(BaseModel):
    """PRD-aligned risk signal breakdown."""
    ml_anomaly_score: float = Field(..., ge=0.0, le=100.0, description="ML / statistical anomaly score (25% weight)")
    cost_score: float = Field(..., ge=0.0, le=100.0, description="Cost deviation anomaly score (25% weight)")
    duplicate_score: float = Field(..., ge=0.0, le=100.0, description="Duplicate & overlap score (20% weight)")
    utilization_score: float = Field(..., ge=0.0, le=100.0, description="MP & constituency financial utilization score (15% weight)")
    geographic_score: float = Field(..., ge=0.0, le=100.0, description="Geographic proximity / location risk score (10% weight)")
    data_quality_score: float = Field(..., ge=0.0, le=100.0, description="Data completeness and verification risk score (5% weight)")

    model_config = ConfigDict(from_attributes=True)


class EvidenceItem(BaseModel):
    """Individual piece of structured evidence supporting the investigation."""
    category: str = Field(..., description="Evidence category: cost, duplicate, utilization, geographic, data_quality, ml_anomaly")
    title: str = Field(..., description="Short title of the evidence finding")
    detail: str = Field(..., description="Detailed objective explanation of the finding")
    severity: str = Field(..., description="Severity level: info, low, medium, high, critical")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Structured quantitative data supporting the finding")


class ToolResult(BaseModel):
    """Structured result returned by an investigation tool."""
    tool_name: str
    status: str = Field(..., description="success, partial, or unavailable")
    data: Dict[str, Any]
    message: Optional[str] = None


class InvestigationResponse(BaseModel):
    """
    Standard investigation response synthesized by the Investigation Agent.
    Provides decision support and recommended manual verification actions.
    """
    work_id: Any = Field(..., description="Work identifier (work_id, id, or source_id)")
    work_description: Optional[str] = None
    mp_name: Optional[str] = None
    constituency: Optional[str] = None
    state: Optional[str] = None
    category: Optional[str] = None
    cost: Optional[float] = None

    risk_level: str = Field(..., description="Risk tier: Low (0-30), Medium (31-60), High (61-80), Critical (81-100)")
    overall_score: float = Field(..., ge=0.0, le=100.0, description="Composite weighted risk score (0-100)")

    summary: str = Field(..., description="High-level synthesis summary using safe, objective language")
    primary_reasons: List[str] = Field(default_factory=list, description="Top contributing factors to the risk level")
    signal_breakdown: SignalBreakdown
    evidence: List[EvidenceItem] = Field(default_factory=list, description="Structured evidence supporting findings")
    recommended_actions: List[str] = Field(default_factory=list, description="Checklist of actionable manual verification steps for officers")

    tool_results: Optional[Dict[str, Any]] = Field(default=None, description="Detailed outputs from individual investigation tools")
    investigated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of investigation")

    model_config = ConfigDict(from_attributes=True)
