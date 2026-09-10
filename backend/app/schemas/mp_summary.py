from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class MPFinancialSummaryResponse(BaseModel):
    id: int
    source_id: Optional[str] = None
    mp_name: Optional[str] = None
    house: Optional[str] = None
    state: Optional[str] = None
    constituency: Optional[str] = None
    allocated_amount: Optional[float] = None
    total_expenditure: Optional[float] = None
    total_recommended_amount: Optional[float] = None
    utilization_percentage: Optional[float] = None
    recommendation_utilization_percentage: Optional[float] = None
    expenditure_percentage: Optional[float] = None
    utilization_definition: Optional[str] = None
    completed_works_count: Optional[int] = None
    recommended_works_count: Optional[int] = None
    completion_rate: Optional[float] = None
    pending_works: Optional[int] = None
    unspent_amount: Optional[float] = None
    unpaid_balance: Optional[float] = None
    completed_works_value: Optional[float] = None
    total_completed_amount: Optional[float] = None
    in_progress_payments: Optional[float] = None
    payment_gap_percentage: Optional[float] = None
    source: str
    created_at: datetime
    last_updated: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedMPsResponse(BaseModel):
    items: List[MPFinancialSummaryResponse]
    total: int
    page: int
    limit: int
    total_pages: int
