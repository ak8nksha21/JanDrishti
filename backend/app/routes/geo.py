from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.geo import (
    GeoProximityScanResponse,
    GeoAnomalyScanResponse,
    SingleWorkNearbyResponse,
)
from app.services.duplicate import GeoService
from ml.config import DEFAULT_MAX_GEO_DISTANCE_METERS

router = APIRouter(prefix="/geo", tags=["Geographic Detection"])
service = GeoService()


@router.get("/proximity", response_model=GeoProximityScanResponse)
def scan_geo_proximity(
    max_distance_meters: float = Query(DEFAULT_MAX_GEO_DISTANCE_METERS, ge=1.0, le=50000.0, description="Maximum physical distance in meters"),
    constituency: Optional[str] = Query(None, description="Filter works by constituency name"),
    state: Optional[str] = Query(None, description="Filter works by state name"),
    category: Optional[str] = Query(None, description="Filter works by category"),
    same_category_only: bool = Query(False, description="Only match works in the exact same category"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of nearby pairs to return"),
    db: Session = Depends(get_db)
):
    """
    Scan works with valid GPS coordinates to identify pairs within a given geographic radius.
    Uses Haversine spherical distance calculation.
    Geographic proximity alone is reported as a physical proximity signal (not duplicate/fraud).
    """
    result = service.scan_proximity(
        db=db,
        max_distance_meters=max_distance_meters,
        constituency=constituency,
        state=state,
        category=category,
        same_category_only=same_category_only,
        limit=limit
    )
    return result


@router.get("/anomalies", response_model=GeoAnomalyScanResponse)
def detect_coordinate_anomalies(
    constituency: Optional[str] = Query(None, description="Filter works by constituency name"),
    state: Optional[str] = Query(None, description="Filter works by state name"),
    include_missing: bool = Query(False, description="Include works with missing coordinates in report"),
    limit: int = Query(100, ge=1, le=500, description="Maximum anomalies to return"),
    db: Session = Depends(get_db)
):
    """
    Audit recorded GPS coordinates for data-quality issues:
    - (0.0, 0.0) placeholder / Null Island
    - Coordinates outside valid ranges or outside India bounding box
    - Suspected swapped latitude and longitude
    """
    result = service.detect_coordinate_anomalies(
        db=db,
        constituency=constituency,
        state=state,
        include_missing=include_missing,
        limit=limit
    )
    return result


@router.get("/{work_id}/nearby", response_model=SingleWorkNearbyResponse)
def get_nearby_works(
    work_id: str,
    max_distance_meters: float = Query(500.0, ge=1.0, le=50000.0, description="Maximum physical distance in meters"),
    limit: int = Query(20, ge=1, le=100, description="Maximum nearby works to return"),
    db: Session = Depends(get_db)
):
    """
    Retrieve geographically close neighbor works for a specific work item based on its GPS coordinates.
    """
    result = service.find_nearby_for_work(
        db=db,
        work_id=work_id,
        max_distance_meters=max_distance_meters,
        limit=limit
    )
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Work with identifier '{work_id}' was not found in the database."
        )
    return result
