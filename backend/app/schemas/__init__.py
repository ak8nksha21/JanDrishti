"""Pydantic Schemas for Request/Response Validation"""
from app.schemas.work import WorkResponse, PaginatedWorksResponse
from app.schemas.mp_summary import MPFinancialSummaryResponse, PaginatedMPsResponse
from app.schemas.dashboard import DashboardSummaryResponse

__all__ = [
    "WorkResponse",
    "PaginatedWorksResponse",
    "MPFinancialSummaryResponse",
    "PaginatedMPsResponse",
    "DashboardSummaryResponse",
]
