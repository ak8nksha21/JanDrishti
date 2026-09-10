from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class WorkResponse(BaseModel):
    id: int
    work_id: Optional[int] = None
    source_id: Optional[str] = None
    work_description: Optional[str] = None
    work_description_hi: Optional[str] = None
    cost: Optional[float] = None
    completion_date: Optional[datetime] = None
    completion_year: Optional[int] = None
    mp_name: Optional[str] = None
    mp_name_hi: Optional[str] = None
    constituency: Optional[str] = None
    constituency_hi: Optional[str] = None
    state: Optional[str] = None
    state_hi: Optional[str] = None
    house: Optional[str] = None
    category: Optional[str] = None
    category_hi: Optional[str] = None
    district: Optional[str] = None
    district_hi: Optional[str] = None
    location: Optional[str] = None
    location_hi: Optional[str] = None
    beneficiaries: Optional[int] = None
    implementing_agency: Optional[str] = None
    implementing_agency_hi: Optional[str] = None
    quality_rating: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photos_metadata: Optional[Dict[str, Any]] = None
    impact_metrics: Optional[Dict[str, Any]] = None
    source: str
    created_at: datetime
    last_updated: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedWorksResponse(BaseModel):
    items: List[WorkResponse]
    total: int
    page: int
    limit: int
    total_pages: int
