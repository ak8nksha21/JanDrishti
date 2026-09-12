"""
JanDrishti - State Intelligence Schemas

Defines structured data models for State & Union Territory intelligence:
- State discovery list items with real MPLADS financial & execution aggregates
- State Intelligence 360° Profile
- Sector allocations and Implementing Agency landscapes
- National comparative benchmarks
- Analytical signals requiring review with deterministic 'Why?' explainability
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class StateListItem(BaseModel):
    id: str = Field(..., description="Unique slug for the state (e.g. uttar-pradesh)")
    state: str = Field(..., description="Canonical State / UT name")
    entity_type: str = Field(default="State", description="'State' or 'Union Territory'")
    country: str = Field(default="India")
    
    # Financial metrics (INR)
    allocated_amount: float = Field(default=0.0, description="Total MPLADS fund allocated in INR")
    total_expenditure: float = Field(default=0.0, description="Total expenditure in INR")
    unspent_amount: float = Field(default=0.0, description="Unspent balance in INR")
    utilization_percentage: float = Field(default=0.0, description="Expenditure utilization percentage")
    
    # Parliamentary & Execution metrics
    mp_count: int = Field(default=0, description="Total MPs representing this state")
    total_works: int = Field(default=0, description="Total developmental works recorded")
    completed_works: int = Field(default=0, description="Count of completed works")
    pending_works: int = Field(default=0, description="Count of ongoing / pending works")
    completion_rate: float = Field(default=0.0, description="Percentage of works completed")
    
    # Development mix (top categories)
    development_mix: List[Dict[str, Any]] = Field(default_factory=list, description="Top work categories with percentage")
    
    # Analytical Status
    status: str = Field(default="Moderate Utilization", description="Strong Utilization / Moderate Utilization / Requires Attention / Insufficient Data")
    requires_attention: bool = Field(default=False, description="Whether state has low utilization or key review signals")
    attention_reason: Optional[str] = Field(None, description="Primary reason if flagged for attention")


class NationalStateSummary(BaseModel):
    total_states_monitored: int = Field(default=36)
    total_national_allocation: float = Field(default=0.0)
    total_national_expenditure: float = Field(default=0.0)
    total_national_unspent: float = Field(default=0.0)
    national_utilization_percentage: float = Field(default=0.0)
    total_national_works: int = Field(default=0)
    total_national_completed_works: int = Field(default=0)
    total_national_pending_works: int = Field(default=0)
    total_national_mps: int = Field(default=0)
    last_synchronized: str = Field(default="")


class PaginatedStatesResponse(BaseModel):
    items: List[StateListItem]
    total: int
    national_summary: NationalStateSummary
    available_regions: List[str] = Field(default_factory=list)
    available_statuses: List[str] = Field(default_factory=list)


class StateCategoryItem(BaseModel):
    category: str
    works_count: int
    total_cost: float
    percentage_cost: float
    percentage_works: float
    avg_cost: Optional[float] = None


class StateAgencyItem(BaseModel):
    agency: str
    works_count: int
    total_cost: float
    percentage_cost: float
    percentage_works: float


class StateBenchmarkMetric(BaseModel):
    metric_name: str
    unit: str  # "%", "₹ Cr", "Works", "₹ Lakh"
    state_value: Optional[float] = None
    national_average: Optional[float] = None
    difference: Optional[float] = None
    formatted_diff: Optional[str] = None
    status: str  # "Above National Average", "On Par", "Below National Average", "N/A"


class StateBenchmarkComparison(BaseModel):
    benchmarks: List[StateBenchmarkMetric]
    summary: str


class StateInvestigationSignal(BaseModel):
    signal_id: str
    signal_type: str  # "High Expenditure Concentration", "Agency Concentration", "Low Utilization", "Category Concentration", "Data Quality"
    title: str
    severity: str  # "Low", "Medium", "High"
    short_explanation: str
    observed_value: str
    national_baseline: str
    affected_records_count: int
    data_source: str
    calculation_methodology: str


class StateBeneficiaryProfile(BaseModel):
    total_recorded_beneficiaries: int = 0
    average_beneficiaries_per_work: float = 0.0
    works_with_beneficiary_data: int = 0
    is_available: bool = False
    notes: str = ""


class StateMapPoint(BaseModel):
    id: int
    work_id: Optional[int] = None
    work_description: Optional[str] = None
    cost: Optional[float] = None
    category: Optional[str] = None
    district: Optional[str] = None
    implementing_agency: Optional[str] = None
    completion_year: Optional[int] = None
    latitude: float
    longitude: float


class StateIntelligenceProfile(BaseModel):
    id: str
    state: str
    entity_type: str
    country: str = "India"
    last_synchronized: str
    data_sources: List[str]
    
    # Financial KPI Overview
    allocated_amount: float
    total_expenditure: float
    unspent_amount: float
    utilization_percentage: float
    status: str
    
    # Execution KPIs
    mp_count: int
    total_works: int
    completed_works: int
    pending_works: int
    completion_rate: float
    
    # Development Footprint
    categories: List[StateCategoryItem]
    
    # Implementation Landscape
    agencies: List[StateAgencyItem]
    
    # Beneficiary Reach
    beneficiaries: StateBeneficiaryProfile
    
    # Geographic Map Points & Status
    has_coordinates: bool
    map_points: List[StateMapPoint] = Field(default_factory=list)
    
    # Analytical Signals with 'Why?' Explainability
    signals: List[StateInvestigationSignal]
    
    # Comparative Benchmark vs National
    benchmarks: StateBenchmarkComparison
