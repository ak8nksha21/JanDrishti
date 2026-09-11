from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class QualityIssueItem(BaseModel):
    """Schema for a single data quality finding."""
    code: str = Field(..., description="Unique machine-readable issue code")
    severity: str = Field(..., description="CRITICAL, WARNING, or INFO")
    field: str = Field(..., description="Field name where issue was observed")
    message: str = Field(..., description="Human-readable explanation of the data discrepancy")

    model_config = ConfigDict(from_attributes=True)


class WorkQualityReportResponse(BaseModel):
    """Schema for quality evaluation of an individual work item."""
    work_id: Optional[int] = None
    external_work_id: Optional[int] = None
    source_id: Optional[str] = None
    has_issues: bool
    total_issues: int
    critical_issues_count: int
    warning_issues_count: int
    info_issues_count: int
    completeness_score: float = Field(..., description="Completeness percentage (0.0 to 1.0) of core fields")
    field_status: Dict[str, str] = Field(default_factory=dict)
    issues: List[QualityIssueItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class DataQualitySummaryResponse(BaseModel):
    """High-level summary of dataset quality and compliance metrics."""
    total_works_audited: int
    clean_works_count: int
    works_with_critical_issues: int
    works_with_warnings: int
    average_completeness_score: float
    total_critical_issues: int
    total_warnings: int
    total_info_notices: int
    issue_breakdown_by_code: Dict[str, int] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class DataQualityBatchResponse(DataQualitySummaryResponse):
    """Full batch audit report including itemized work reports."""
    work_reports: List[WorkQualityReportResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
