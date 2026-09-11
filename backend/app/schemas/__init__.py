"""Pydantic Schemas for Request/Response Validation"""
from app.schemas.work import WorkResponse, PaginatedWorksResponse
from app.schemas.mp_summary import MPFinancialSummaryResponse, PaginatedMPsResponse
from app.schemas.dashboard import DashboardSummaryResponse
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

__all__ = [
    "WorkResponse",
    "PaginatedWorksResponse",
    "MPFinancialSummaryResponse",
    "PaginatedMPsResponse",
    "DashboardSummaryResponse",
    "SyncResponse",
    "DuplicatePairResponse",
    "DuplicateScanResponse",
    "SingleWorkDuplicatesResponse",
    "GeoCoordinateValidation",
    "GeoCoordinateAnomalyItem",
    "GeoProximityPairResponse",
    "GeoProximityScanResponse",
    "GeoAnomalyScanResponse",
    "SingleWorkNearbyResponse",
    "QualityIssueItem",
    "WorkQualityReportResponse",
    "DataQualitySummaryResponse",
    "DataQualityBatchResponse",
]

