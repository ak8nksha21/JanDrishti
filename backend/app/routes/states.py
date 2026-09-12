"""
JanDrishti - State Intelligence REST Endpoints

Provides structured endpoints for State & Union Territory level MPLADS intelligence:
- GET /api/states : Discovery grid with national summary and multi-filters
- GET /api/states/national-summary : Quick national summary metrics
- GET /api/states/{state_id} : 360° State Intelligence Profile
- GET /api/states/{state_id}/signals : Analytical review signals
- GET /api/states/{state_id}/export : Formatted state snapshot
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.state.service import StateService
from app.schemas.state import (
    PaginatedStatesResponse,
    NationalStateSummary,
    StateIntelligenceProfile,
)

router = APIRouter(prefix="/states", tags=["State Intelligence"])


@router.get("", response_model=PaginatedStatesResponse)
@router.get("/", response_model=PaginatedStatesResponse)
def list_states(
    search: Optional[str] = Query(None, description="Search state or UT name"),
    region: Optional[str] = Query(None, description="Filter by region/type (State / Union Territory)"),
    status: Optional[str] = Query(None, description="Filter by utilization status"),
    sort_by: str = Query("utilization", description="Sort field (utilization, expenditure, works, completed_works, name)"),
    order: str = Query("desc", description="Sort direction (asc / desc)"),
    db: Session = Depends(get_db),
):
    """
    Returns all 36 Indian States & Union Territories with real aggregated MPLADS metrics,
    development mix, and overall national summary benchmarks.
    """
    return StateService.get_all_states(
        db=db,
        search=search,
        region=region,
        status=status,
        sort_by=sort_by,
        order=order,
    )


@router.get("/national-summary", response_model=NationalStateSummary)
def get_national_summary(db: Session = Depends(get_db)):
    """Returns high-level national summary across all 36 States & UTs."""
    res = StateService.get_all_states(db=db)
    return res.national_summary


@router.get("/{state_id}", response_model=StateIntelligenceProfile)
def get_state_profile(state_id: str, db: Session = Depends(get_db)):
    """
    Returns the full 360° State Intelligence Profile for a specific State or UT:
    - Financial KPI Overview & Utilization
    - Category Development Mix
    - Implementing Agency Landscape
    - Beneficiary Reach
    - Geographic Footprint
    - Analytical Review Signals with deterministic Why? explainability
    - State Benchmark vs National Average
    """
    profile = StateService.get_state_profile(db=db, state_slug_or_name=state_id)
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"State or Union Territory '{state_id}' was not found in the MPLADS administrative registry.",
        )
    return profile


@router.get("/{state_id}/signals")
def get_state_signals(state_id: str, db: Session = Depends(get_db)):
    """Returns analytical review signals and calculation methodologies for a state."""
    profile = StateService.get_state_profile(db=db, state_slug_or_name=state_id)
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"State or Union Territory '{state_id}' was not found.",
        )
    return {
        "state": profile.state,
        "entity_type": profile.entity_type,
        "signals": profile.signals,
    }


@router.get("/{state_id}/export")
def export_state_snapshot(state_id: str, db: Session = Depends(get_db)):
    """Returns exportable summary snapshot data for a state."""
    profile = StateService.get_state_profile(db=db, state_slug_or_name=state_id)
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"State or Union Territory '{state_id}' was not found.",
        )
    return {
        "state": profile.state,
        "entity_type": profile.entity_type,
        "country": "India",
        "last_synchronized": profile.last_synchronized,
        "metrics": {
            "allocated_amount": profile.allocated_amount,
            "total_expenditure": profile.total_expenditure,
            "unspent_amount": profile.unspent_amount,
            "utilization_percentage": profile.utilization_percentage,
            "mp_count": profile.mp_count,
            "total_works": profile.total_works,
            "completed_works": profile.completed_works,
            "pending_works": profile.pending_works,
            "completion_rate": profile.completion_rate,
        },
        "top_categories": [
            {"category": c.category, "percentage": c.percentage_cost}
            for c in profile.categories[:4]
        ],
        "top_agencies": [
            {"agency": a.agency, "works_count": a.works_count, "cost": a.total_cost}
            for a in profile.agencies[:4]
        ],
        "signals_count": len(profile.signals),
    }
