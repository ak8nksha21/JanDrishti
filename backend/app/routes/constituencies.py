"""
JanDrishti - Constituency Digital Twin & Intelligence API Routes

Endpoints for discovering constituencies, fetching 360° Digital Twin profiles,
retrieving sector & agency footprints, querying comparative benchmarks,
and paginating works inside a specific constituency.
"""

import math
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.work import Work
from app.schemas.work import PaginatedWorksResponse
from app.schemas.constituency import (
    PaginatedConstituenciesResponse,
    ConstituencyDigitalTwinResponse,
    InvestigationSignalItem,
)
from app.services.constituency.service import constituency_service, slugify
from app.services.geo.india_cities import _clean_key

logger = logging.getLogger("jandrishti.routes.constituencies")

router = APIRouter(prefix="/constituencies", tags=["Constituency Digital Twin"])


@router.get("", response_model=PaginatedConstituenciesResponse, summary="Discover and filter parliamentary constituencies")
def get_constituencies(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(24, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search across constituency, state, or MP name"),
    state: Optional[str] = Query(None, description="Filter by state name"),
    house: Optional[str] = Query(None, description="Filter by house (Lok Sabha / Rajya Sabha)"),
    status: Optional[str] = Query(None, description="Filter by status (Healthy / Moderate / Requires Attention)"),
    sort_by: str = Query("utilization_desc", pattern="^(utilization_desc|utilization_asc|expenditure_desc|works_desc|name_asc)$"),
    db: Session = Depends(get_db)
):
    """
    Retrieve paginated constituency intelligence summaries across India with real-time utilization,
    works volume, and verified geographic centers.
    """
    return constituency_service.get_constituencies_list(
        db=db,
        page=page,
        limit=limit,
        search=search,
        state=state,
        house=house,
        status=status,
        sort_by=sort_by,
    )


@router.get("/{constituency_id}", response_model=ConstituencyDigitalTwinResponse, summary="Get 360° Digital Twin profile for a constituency")
def get_constituency_profile(
    constituency_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve the 360° Constituency Digital Twin intelligence dossier, including
    hero metrics, 4-dimensional health scores, sector spending breakdowns,
    top implementing agencies, state/national benchmarks, and analytical review signals.
    """
    twin = constituency_service.get_constituency_digital_twin(db=db, constituency_id=constituency_id)
    if not twin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Constituency digital twin profile for '{constituency_id}' was not found in the database."
        )
    return twin


@router.get("/{constituency_id}/works", response_model=PaginatedWorksResponse, summary="Get paginated works within a specific constituency")
def get_constituency_works(
    constituency_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    agency: Optional[str] = Query(None, description="Filter by implementing agency"),
    search: Optional[str] = Query(None, description="Search work description, district, location"),
    sort_by: str = Query("date_desc", pattern="^(date_desc|cost_desc|cost_asc)$"),
    db: Session = Depends(get_db)
):
    """
    Retrieve server-side filtered and paginated developmental projects specifically belonging
    to the selected constituency.
    """
    clean_target = _clean_key(constituency_id.replace("-", " "))
    
    # Query works matching constituency
    all_works = db.query(Work).all()
    matching_works = [
        w for w in all_works
        if (w.constituency and _clean_key(w.constituency) == clean_target) or
        (w.district and _clean_key(w.district) == clean_target) or
        (clean_target in _clean_key(w.constituency or ""))
    ]

    # Filter
    filtered = matching_works
    if category and category.strip() and category.strip().lower() != "all":
        filtered = [w for w in filtered if w.category and category.strip().lower() in w.category.lower()]

    if agency and agency.strip() and agency.strip().lower() != "all":
        filtered = [w for w in filtered if w.implementing_agency and agency.strip().lower() in w.implementing_agency.lower()]

    if search and search.strip():
        terms = search.strip().lower().split()
        filtered = [
            w for w in filtered
            if all(
                t in (w.work_description or "").lower() or
                t in (w.category or "").lower() or
                t in (w.district or "").lower() or
                t in (w.location or "").lower() or
                t in (w.implementing_agency or "").lower()
                for t in terms
            )
        ]

    # Sorting
    if sort_by == "cost_desc":
        filtered.sort(key=lambda w: float(w.cost or 0), reverse=True)
    elif sort_by == "cost_asc":
        filtered.sort(key=lambda w: float(w.cost or 0))
    else:  # date_desc
        filtered.sort(key=lambda w: (w.completion_date is not None, w.completion_date or w.created_at), reverse=True)

    total = len(filtered)
    total_pages = math.ceil(total / limit) if total > 0 else 0
    start = (page - 1) * limit
    end = start + limit
    paged_items = filtered[start:end]

    return {
        "items": paged_items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }


@router.get("/{constituency_id}/signals", summary="Get investigation review signals with detailed explanation metadata")
def get_constituency_signals(
    constituency_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve analytical review signals for a constituency with deterministic 'Why' metadata.
    """
    twin = constituency_service.get_constituency_digital_twin(db=db, constituency_id=constituency_id)
    if not twin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Constituency '{constituency_id}' not found."
        )
    return {
        "constituency": twin.constituency,
        "state": twin.state,
        "signals": twin.signals,
    }


@router.get("/{constituency_id}/export", summary="Export constituency snapshot payload")
def export_constituency_snapshot(
    constituency_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve a clean, structured snapshot representation of the constituency digital twin.
    """
    twin = constituency_service.get_constituency_digital_twin(db=db, constituency_id=constituency_id)
    if not twin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Constituency '{constituency_id}' not found."
        )
    return twin.snapshot
