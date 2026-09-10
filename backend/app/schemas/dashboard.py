from typing import Optional, Dict, Any
from pydantic import BaseModel


class WorksDashboardMetrics(BaseModel):
    total_works: int
    total_cost: float
    average_cost: float
    total_beneficiaries: int
    unique_constituencies: int
    unique_states: int


class MPsDashboardMetrics(BaseModel):
    total_mps: int
    total_allocated_amount: float
    total_expenditure: float
    average_utilization_percentage: float
    total_completed_works: int
    total_recommended_works: int
    total_unspent_amount: float


class MacroIndicator(BaseModel):
    metric_name: str
    value_raw: Optional[str] = None
    value_crores: Optional[str] = None
    count: Optional[int] = None


class DashboardSummaryResponse(BaseModel):
    works_summary: WorksDashboardMetrics
    mps_summary: MPsDashboardMetrics
    macro_indicators: Dict[str, MacroIndicator]
    data_sources: Dict[str, Any]
