from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.anomaly.service import AnomalyService
from app.schemas.anomaly import (
    PaginatedWorkAnomaliesResponse,
    WorkAnomalyItem,
    PaginatedMPAnomaliesResponse,
    MPAnomalyItem,
    AnomalyEvaluationRequest,
    AnomalyEvaluationResponse,
)

router = APIRouter(prefix="/anomalies", tags=["Anomalies"])
service = AnomalyService()


@router.get("/works", response_model=PaginatedWorkAnomaliesResponse)
def get_work_anomalies(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    constituency: Optional[str] = Query(None, description="Filter by constituency name"),
    district: Optional[str] = Query(None, description="Filter by district name"),
    category: Optional[str] = Query(None, description="Filter by project category"),
    anomalies_only: bool = Query(False, description="Return only records flagged as anomalies (score >= 60)"),
    min_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Filter by minimum cost anomaly score"),
    db: Session = Depends(get_db),
):
    """
    Evaluate project works against peer distributions and return explainable cost anomaly scores.
    """
    return service.evaluate_works(
        db=db,
        page=page,
        limit=limit,
        constituency=constituency,
        district=district,
        category=category,
        anomalies_only=anomalies_only,
        min_score=min_score,
    )


@router.get("/works/{work_id}", response_model=WorkAnomalyItem)
def get_work_anomaly_by_id(
    work_id: str,
    db: Session = Depends(get_db),
):
    """
    Evaluate a single work project against peer distributions by work_id or database id.
    """
    result = service.evaluate_single_work(db=db, work_id=work_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Work with identifier '{work_id}' was not found in the database.",
        )
    return result


@router.get("/mps", response_model=PaginatedMPAnomaliesResponse)
def get_mp_anomalies(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    state: Optional[str] = Query(None, description="Filter by state name"),
    constituency: Optional[str] = Query(None, description="Filter by constituency name"),
    anomalies_only: bool = Query(False, description="Return only records flagged as anomalies (score >= 60)"),
    min_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Filter by minimum financial/utilization score"),
    db: Session = Depends(get_db),
):
    """
    Evaluate MP financial summaries across multivariate indicators and cohort utilization distributions.
    """
    return service.evaluate_mps(
        db=db,
        page=page,
        limit=limit,
        state=state,
        constituency=constituency,
        anomalies_only=anomalies_only,
        min_score=min_score,
    )


@router.get("/mps/{mp_id}", response_model=MPAnomalyItem)
def get_mp_anomaly_by_id(
    mp_id: str,
    db: Session = Depends(get_db),
):
    """
    Evaluate a single MP record against cohort distributions by database id.
    """
    result = service.evaluate_single_mp(db=db, mp_id=mp_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"MP summary record with identifier '{mp_id}' was not found in the database.",
        )
    return result


@router.post("/evaluate", response_model=AnomalyEvaluationResponse)
def evaluate_custom_payload(
    payload: AnomalyEvaluationRequest,
):
    """
    Directly evaluate arbitrary work or MP records for testing edge cases,
    missing-data safety, or ad-hoc scoring through the API.
    """
    return service.evaluate_payload(payload.records)
