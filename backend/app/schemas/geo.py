from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class GeoCoordinateValidation(BaseModel):
    """Schema for individual GPS coordinate validation."""
    status: str
    is_usable: bool
    reason: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class GeoCoordinateAnomalyItem(BaseModel):
    """Schema for a work flagged with anomalous or invalid GPS coordinates."""
    work_id: Optional[int] = None
    external_work_id: Optional[int] = None
    description: Optional[str] = None
    constituency: Optional[str] = None
    state: Optional[str] = None
    status: str
    reason: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class GeoProximityPairResponse(BaseModel):
    """Schema for geographically close or overlapping pairs of works."""
    work_a_id: Optional[int] = None
    work_a_work_id: Optional[int] = None
    work_a_description: Optional[str] = None
    work_a_constituency: Optional[str] = None
    work_a_latitude: Optional[float] = None
    work_a_longitude: Optional[float] = None
    work_a_cost: Optional[float] = None

    work_b_id: Optional[int] = None
    work_b_work_id: Optional[int] = None
    work_b_description: Optional[str] = None
    work_b_constituency: Optional[str] = None
    work_b_latitude: Optional[float] = None
    work_b_longitude: Optional[float] = None
    work_b_cost: Optional[float] = None

    distance_meters: float = Field(..., description="Great-circle physical distance in meters (Haversine formula)")
    proximity_level: str = Field(..., description="Categorical proximity tier (e.g. immediate_overlap, same_compound_or_street)")
    text_similarity: float = Field(default=0.0, description="Cosine text similarity between descriptions")
    is_potential_duplicate: bool = Field(default=False, description="True only if proximity is accompanied by high text similarity")

    same_constituency: bool = False
    same_district: bool = False
    same_state: bool = False
    same_category: bool = False
    cost_difference: Optional[float] = None
    reasons: List[str] = Field(default_factory=list, description="Explainable reasons for geographic proximity")

    model_config = ConfigDict(from_attributes=True)


class GeoProximityScanResponse(BaseModel):
    """Schema for bulk geographic proximity scan results."""
    total_works_analyzed: int
    works_with_valid_coordinates: int
    pairs_found: int
    max_distance_meters: float
    filters_applied: Dict[str, Any]
    pairs: List[GeoProximityPairResponse]

    model_config = ConfigDict(from_attributes=True)


class GeoAnomalyScanResponse(BaseModel):
    """Schema for GPS coordinate anomaly report."""
    total_works_scanned: int
    anomalies_detected: int
    anomalies: List[GeoCoordinateAnomalyItem]

    model_config = ConfigDict(from_attributes=True)


class SingleWorkNearbyResponse(BaseModel):
    """Schema for finding neighbors of a specific work item."""
    target_work_id: str
    target_latitude: Optional[float] = None
    target_longitude: Optional[float] = None
    max_distance_meters: float
    nearby_works_count: int
    coordinate_status: Optional[str] = None
    reason: Optional[str] = None
    nearby_works: List[GeoProximityPairResponse]

    model_config = ConfigDict(from_attributes=True)
