"""
JanDrishti - Constituency Digital Twin & Intelligence Schemas

Defines structured data models for constituency explorer discovery, 360° Digital Twin
intelligence profiles, multidimensional health scoring, sector allocations,
implementing agency footprints, comparative benchmarks, and investigation review signals.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ConstituencyListItem(BaseModel):
    id: str = Field(..., description="Unique slug or identifier for the constituency")
    constituency: str = Field(..., description="Canonical constituency name")
    state: str = Field(..., description="State or territory")
    house: str = Field(default="Lok Sabha", description="Parliamentary house (Lok Sabha / Rajya Sabha)")
    mp_name: Optional[str] = Field(None, description="Current representative Member of Parliament")
    mp_id: Optional[str] = Field(None, description="Identifier for MP dossier")
    
    # Financial metrics (INR)
    allocated_amount: Optional[float] = Field(None, description="Total MPLADS fund allocated in INR")
    total_expenditure: Optional[float] = Field(None, description="Total expenditure in INR")
    utilization_percentage: Optional[float] = Field(None, description="Fund utilization percentage")
    
    # Execution metrics
    completed_works_count: Optional[int] = Field(None, description="Count of completed developmental works")
    pending_works_count: Optional[int] = Field(None, description="Count of ongoing / pending works")
    works_count: int = Field(default=0, description="Itemized works in repository")
    total_works_cost: Optional[float] = Field(None, description="Sum of itemized project costs in INR")
    
    # Geospatial and Risk
    latitude: Optional[float] = Field(None, description="Latitude coordinate of constituency center")
    longitude: Optional[float] = Field(None, description="Longitude coordinate of constituency center")
    has_coordinates: bool = Field(default=False, description="Whether coordinates are verified")
    risk_score: Optional[float] = Field(None, description="Composite risk score (0-100)")
    status: str = Field(default="Healthy", description="Health classification: Healthy / Moderate / Requires Attention")


class PaginatedConstituenciesResponse(BaseModel):
    items: List[ConstituencyListItem]
    total: int
    page: int
    limit: int
    total_pages: int
    available_states: List[str]
    available_houses: List[str]


class DimensionHealth(BaseModel):
    name: str
    status: str  # "Strong", "Moderate", "Needs Attention", "Insufficient Data"
    score: Optional[float] = None  # 0-100 if computable
    summary: str
    metrics: Dict[str, Any]


class ConstituencyHealthScore(BaseModel):
    overall_status: str  # "Healthy", "Moderate", "Requires Attention"
    overall_score: Optional[float] = None
    financial: DimensionHealth
    execution: DimensionHealth
    development_mix: DimensionHealth
    data_quality: DimensionHealth


class CategoryBreakdownItem(BaseModel):
    category: str
    works_count: int
    total_cost: float
    percentage_cost: float
    percentage_works: float
    avg_cost: Optional[float] = None


class AgencyBreakdownItem(BaseModel):
    agency: str
    works_count: int
    total_cost: float
    percentage_cost: float
    percentage_works: float


class GeographicConcentrationItem(BaseModel):
    location_name: str
    location_type: str  # "District", "Block", "Ward", "Village"
    works_count: int
    total_cost: float
    percentage_works: float
    percentage_cost: float
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class BenchmarkMetric(BaseModel):
    name: str
    unit: str  # "%", "₹ Cr", "Works", "₹ Lakh"
    constituency_value: Optional[float] = None
    state_average: Optional[float] = None
    national_average: Optional[float] = None
    delta_vs_state: Optional[float] = None
    delta_vs_national: Optional[float] = None
    status: str  # "Above Average", "Average", "Below Average", "N/A"


class ConstituencyComparison(BaseModel):
    state_name: str
    benchmarks: List[BenchmarkMetric]


class InvestigationSignalItem(BaseModel):
    signal_id: str
    signal_type: str  # "High-Value Concentration", "Category Concentration", "Agency Concentration", "Geographic Concentration", "Data Quality"
    title: str
    severity: str  # "Low", "Medium", "High"
    short_explanation: str
    observed_value: str
    baseline_value: str
    affected_records_count: int
    affected_work_ids: List[str]
    data_source: str
    calculation_methodology: str


class ParliamentaryRepresentation(BaseModel):
    mp_id: Optional[str] = None
    mp_name: Optional[str] = None
    house: Optional[str] = None
    state: Optional[str] = None
    constituency: Optional[str] = None
    allocated_amount: Optional[float] = None
    total_expenditure: Optional[float] = None
    total_recommended_amount: Optional[float] = None
    utilization_percentage: Optional[float] = None
    expenditure_percentage: Optional[float] = None
    recommendation_utilization_percentage: Optional[float] = None
    completed_works_count: Optional[int] = None
    recommended_works_count: Optional[int] = None
    pending_works_count: Optional[int] = None
    unspent_amount: Optional[float] = None
    raw_data_path: Optional[str] = None


class ConstituencyDigitalTwinResponse(BaseModel):
    id: str
    constituency: str
    state: str
    house: str
    last_updated: str
    data_sources: List[str]
    
    # Geospatial
    city_center: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    has_coordinates: bool = False
    
    # Hero Financial & Execution Summary
    allocated_amount: Optional[float] = None
    total_expenditure: Optional[float] = None
    utilization_percentage: Optional[float] = None
    unspent_amount: Optional[float] = None
    total_works_count: int = 0
    completed_works_count: Optional[int] = None
    pending_works_count: Optional[int] = None
    total_beneficiaries: Optional[int] = None
    
    # 4-Dimensional Health Assessment
    health: ConstituencyHealthScore
    
    # Representation
    mp: Optional[ParliamentaryRepresentation] = None
    
    # Where is the money going? (Sector mix)
    categories: List[CategoryBreakdownItem]
    
    # Development Footprint Details
    agencies: List[AgencyBreakdownItem]
    geography: List[GeographicConcentrationItem]
    
    # Comparative Benchmarks
    comparison: ConstituencyComparison
    
    # Analytical Signals Requiring Review & "Why?" Metadata
    signals: List[InvestigationSignalItem]
    
    # Snapshot Summary
    snapshot: Dict[str, Any]
