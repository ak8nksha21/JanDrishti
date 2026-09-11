from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class DuplicatePairResponse(BaseModel):
    """Schema representing a flagged duplicate or similar pair of works."""
    work_a_id: Optional[int] = None
    work_a_work_id: Optional[int] = None
    work_a_description: Optional[str] = None
    work_a_constituency: Optional[str] = None
    work_a_location: Optional[str] = None
    work_a_cost: Optional[float] = None

    work_b_id: Optional[int] = None
    work_b_work_id: Optional[int] = None
    work_b_description: Optional[str] = None
    work_b_constituency: Optional[str] = None
    work_b_location: Optional[str] = None
    work_b_cost: Optional[float] = None

    text_similarity: float = Field(..., description="Cosine similarity score (0.0 to 1.0) on normalized descriptions")
    duplicate_score: int = Field(..., description="Normalized similarity score 0‑100 for downstream agents")
    match_type: str = Field(..., description="Classification of the match pattern")
    is_exact_text: bool = Field(..., description="True if normalized descriptions are identical")
    
    same_constituency: bool = False
    same_district: bool = False
    same_state: bool = False
    same_location: bool = False
    same_category: bool = False
    same_mp: bool = False

    cost_difference: Optional[float] = None
    cost_similarity_ratio: Optional[float] = None
    geo_distance_meters: Optional[float] = None
    reasons: List[str] = Field(default_factory=list, description="Objective, evidence-based reasons for flagging")

    model_config = ConfigDict(from_attributes=True)


class DuplicateScanResponse(BaseModel):
    """Schema for bulk duplicate scan results."""
    total_works_analyzed: int
    duplicate_pairs_found: int
    similarity_threshold: float
    filters_applied: Dict[str, Any]
    pairs: List[DuplicatePairResponse]

    model_config = ConfigDict(from_attributes=True)


class SingleWorkDuplicatesResponse(BaseModel):
    """Schema for duplicates of a single work item."""
    target_work_id: str
    total_candidates_analyzed: int
    matches_found: int
    similarity_threshold: float
    matches: List[DuplicatePairResponse]

    model_config = ConfigDict(from_attributes=True)
