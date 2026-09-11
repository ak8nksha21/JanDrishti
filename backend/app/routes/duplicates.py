from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.duplicate import DuplicateScanResponse, SingleWorkDuplicatesResponse
from app.services.duplicate import DuplicateService
from ml.config import (
    DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD,
    DEFAULT_TARGET_SIMILARITY_THRESHOLD,
)

router = APIRouter(prefix="/duplicates", tags=["Duplicate Detection"])
service = DuplicateService()


@router.get("", response_model=DuplicateScanResponse)
def scan_duplicates(
    min_similarity: float = Query(DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD, ge=0.0, le=1.0, description="Minimum text similarity threshold (0.0 to 1.0)"),
    constituency: Optional[str] = Query(None, description="Filter works by constituency name"),
    state: Optional[str] = Query(None, description="Filter works by state name"),
    category: Optional[str] = Query(None, description="Filter works by category"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of duplicate pairs to return"),
    db: Session = Depends(get_db)
):
    """
    Scan stored MPLADS completed/sanctioned works to identify potential duplicate or overlapping works.
    Combines normalized TF-IDF cosine text similarity with location, constituency, cost, and GPS signals.
    Returns objective similarity signals and explainable reasons for human review.
    """
    result = service.scan_duplicates(
        db=db,
        constituency=constituency,
        state=state,
        category=category,
        min_similarity=min_similarity,
        limit=limit
    )
    return result


@router.get("/{work_id}", response_model=SingleWorkDuplicatesResponse)
def get_duplicates_for_work(
    work_id: str,
    min_similarity: float = Query(DEFAULT_TARGET_SIMILARITY_THRESHOLD, ge=0.0, le=1.0, description="Minimum text similarity threshold"),
    limit: int = Query(20, ge=1, le=100, description="Maximum candidate matches to return"),
    scope_to_state: bool = Query(False, description="Limit comparison candidates to the same state"),
    db: Session = Depends(get_db)
):
    """
    Retrieve potential duplicate or similar projects for a specific work item by its internal ID,
    eSAKSHI work_id, or source ObjectId.
    """
    result = service.find_duplicates_for_work(
        db=db,
        work_id=work_id,
        min_similarity=min_similarity,
        limit=limit,
        scope_to_state=scope_to_state
    )
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Work with identifier '{work_id}' was not found in the database."
        )
    return result
