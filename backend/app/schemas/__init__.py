"""Pydantic Schemas for Request/Response Validation"""

from app.schemas.work import WorkResponse, PaginatedWorksResponse
from app.schemas.mp_summary import MPFinancialSummaryResponse, PaginatedMPsResponse
from app.schemas.dashboard import DashboardSummaryResponse
from app.schemas.sync import SyncResponse
from app.schemas.risk import (
    RiskEvaluationRequest,
    BatchRiskEvaluationRequest,
    RiskEvaluationResponse,
    BatchRiskEvaluationResponse,
    RiskAlertDetail,
    RiskAlertsListResponse,
    RiskEngineConfigResponse,
    EvidenceItem as RiskEvidenceItem,
)
from app.schemas.duplicate import (
    DuplicatePairResponse,
    DuplicateScanResponse,
    SingleWorkDuplicatesResponse,
)
from app.schemas.geo import (
    GeoCoordinateValidation,
    GeoCoordinateAnomalyItem,
    GeoProximityPairResponse,
    GeoProximityScanResponse,
    GeoAnomalyScanResponse,
    SingleWorkNearbyResponse,
)
from app.schemas.data_quality import (
    QualityIssueItem,
    WorkQualityReportResponse,
    DataQualitySummaryResponse,
    DataQualityBatchResponse,
)
from app.schemas.investigation import (
    InvestigationResponse,
    SignalBreakdown,
    EvidenceItem,
    ToolResult,
)

__all__ = [
    "WorkResponse",
    "PaginatedWorksResponse",
    "MPFinancialSummaryResponse",
    "PaginatedMPsResponse",
    "DashboardSummaryResponse",
    "SyncResponse",

    # Risk schemas
    "RiskEvaluationRequest",
    "BatchRiskEvaluationRequest",
    "RiskEvaluationResponse",
    "BatchRiskEvaluationResponse",
    "RiskAlertDetail",
    "RiskAlertsListResponse",
    "RiskEngineConfigResponse",
    "RiskEvidenceItem",

    # Duplicate detection schemas
    "DuplicatePairResponse",
    "DuplicateScanResponse",
    "SingleWorkDuplicatesResponse",

    # Geographic analysis schemas
    "GeoCoordinateValidation",
    "GeoCoordinateAnomalyItem",
    "GeoProximityPairResponse",
    "GeoProximityScanResponse",
    "GeoAnomalyScanResponse",
    "SingleWorkNearbyResponse",

    # Data quality schemas
    "QualityIssueItem",
    "WorkQualityReportResponse",
    "DataQualitySummaryResponse",
    "DataQualityBatchResponse",

    # Investigation schemas
    "InvestigationResponse",
    "SignalBreakdown",
    "EvidenceItem",
    "ToolResult",
]
