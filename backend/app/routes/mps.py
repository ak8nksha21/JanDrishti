import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.mp_summary import MPFinancialSummary
from app.schemas.mp_summary import MPFinancialSummaryResponse, PaginatedMPsResponse

router = APIRouter(prefix="/mps", tags=["MPs"])


@router.get("", response_model=PaginatedMPsResponse)
def get_mps(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    constituency: Optional[str] = Query(None, description="Filter by constituency name"),
    state: Optional[str] = Query(None, description="Filter by state name"),
    house: Optional[str] = Query(None, description="Filter by house (Lok Sabha / Rajya Sabha)"),
    db: Session = Depends(get_db)
):
    """
    Retrieve paginated MP financial and execution summary records.
    """
    query = db.query(MPFinancialSummary)

    if constituency:
        query = query.filter(MPFinancialSummary.constituency.ilike(f"%{constituency.strip()}%"))
    if state:
        query = query.filter(MPFinancialSummary.state.ilike(f"%{state.strip()}%"))
    if house:
        query = query.filter(MPFinancialSummary.house.ilike(f"%{house.strip()}%"))

    total = query.count()
    total_pages = math.ceil(total / limit) if total > 0 else 0

    items = (
        query.order_by(MPFinancialSummary.allocated_amount.desc().nullslast(), MPFinancialSummary.id.asc())
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


@router.get("/{mp_id}", response_model=MPFinancialSummaryResponse)
def get_mp_by_id(
    mp_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve financial and performance summary metrics for a single MP by their
    internal database ID or external source_id.
    """
    mp = None

    if mp_id.isdigit():
        numeric_id = int(mp_id)
        mp = db.query(MPFinancialSummary).filter(MPFinancialSummary.id == numeric_id).first()

    if not mp:
        mp = db.query(MPFinancialSummary).filter(MPFinancialSummary.source_id == mp_id).first()

    if not mp:
        raise HTTPException(
            status_code=404,
            detail=f"MP summary record with identifier '{mp_id}' was not found in the database."
        )

    return mp

