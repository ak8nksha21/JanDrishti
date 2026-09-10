import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.work import Work
from app.schemas.work import WorkResponse, PaginatedWorksResponse

router = APIRouter(prefix="/works", tags=["Works"])


@router.get("", response_model=PaginatedWorksResponse)
def get_works(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    constituency: Optional[str] = Query(None, description="Filter by constituency name (case-insensitive)"),
    state: Optional[str] = Query(None, description="Filter by state name (case-insensitive)"),
    category: Optional[str] = Query(None, description="Filter by category (case-insensitive)"),
    db: Session = Depends(get_db)
):
    """
    Retrieve paginated MPLADS works with optional filters for constituency, state, and category.
    """
    query = db.query(Work)

    if constituency:
        query = query.filter(Work.constituency.ilike(f"%{constituency.strip()}%"))
    if state:
        query = query.filter(Work.state.ilike(f"%{state.strip()}%"))
    if category:
        query = query.filter(Work.category.ilike(f"%{category.strip()}%"))

    total = query.count()
    total_pages = math.ceil(total / limit) if total > 0 else 0

    items = (
        query.order_by(Work.completion_date.desc().nullslast(), Work.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }


@router.get("/{work_id}", response_model=WorkResponse)
def get_work_by_id(
    work_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve details for a single work item by either its eSAKSHI work_id,
    source MongoDB _id, or internal database ID.
    """
    work = None

    # Check if work_id is integer
    if work_id.isdigit():
        numeric_id = int(work_id)
        work = db.query(Work).filter(
            or_(Work.work_id == numeric_id, Work.id == numeric_id)
        ).first()

    if not work:
        work = db.query(Work).filter(Work.source_id == work_id).first()

    if not work:
        raise HTTPException(
            status_code=404,
            detail=f"Work with identifier '{work_id}' was not found in the database."
        )

    return work
