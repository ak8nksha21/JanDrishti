"""
JanDrishti - Risk Engine & Alerts API Routes

REST endpoints for evaluating project risk, batch scoring, retrieving
risk evaluations for database records, querying active alerts, and inspecting
engine configuration under the final JanDrishti contract.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.risk.service import risk_service
from app.services.risk.alerts import alert_manager
from ml.risk_engine import (
    DEFAULT_SIGNAL_WEIGHTS,
    BAND_LOW_MAX,
    BAND_MEDIUM_MAX,
    BAND_HIGH_MAX,
    ALERT_SCORE_THRESHOLD,
)
from app.schemas.risk import (
    RiskEvaluationRequest,
    BatchRiskEvaluationRequest,
    RiskEvaluationResponse,
    BatchRiskEvaluationResponse,
    RiskAlertsListResponse,
    RiskEngineConfigResponse,
)

logger = logging.getLogger("jandrishti.routes.risk")

router = APIRouter(prefix="/risk", tags=["Risk Engine"])


@router.post(
    "/evaluate",
    response_model=RiskEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate risk for a single work item"
)
def evaluate_single_work(
    payload: RiskEvaluationRequest,
    db: Session = Depends(get_db),
):
    """
    Evaluate composite risk score (0–100), risk level, explainable observations,
    and alert eligibility for an individual work item based on submitted detection signals.
    """
    try:
        result = risk_service.calculate_for_work(
            work_id=payload.work_id,
            signals=payload.signals,
            evidence=[e.model_dump() for e in (payload.evidence or [])],
            metadata=payload.metadata,
            db=db,
        )
        return result
    except ValueError as e:
        logger.warning(f"Invalid signal parameter in /evaluate: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/evaluate/batch",
    response_model=BatchRiskEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate risk across multiple work items"
)
def evaluate_batch_works(
    payload: BatchRiskEvaluationRequest,
    db: Session = Depends(get_db),
):
    """
    Batch evaluation across a list of work items.
    """
    try:
        items_payload = [
            {
                "work_id": item.work_id,
                "signals": item.signals,
                "evidence": [e.model_dump() for e in (item.evidence or [])],
                "metadata": item.metadata,
            }
            for item in payload.items
        ]
        result = risk_service.calculate_batch(items=items_payload, db=db)
        return result
    except ValueError as e:
        logger.warning(f"Invalid signal parameter in /evaluate/batch: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/alerts",
    response_model=RiskAlertsListResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve active structured risk alerts"
)
def get_alerts(
    min_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Minimum risk score filter [0, 100]"),
    level: Optional[str] = Query(None, description="Risk level filter (e.g. High, Critical)"),
    work_id: Optional[str] = Query(None, description="Filter alerts for a specific work ID"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of alerts to return"),
):
    """
    Query generated structured risk alerts. Alerts are created when evaluated works
    exceed risk thresholds (score >= 70 or High/Critical level).
    """
    alerts_list = alert_manager.get_alerts(
        min_score=min_score,
        risk_level=level,
        work_id=work_id,
        limit=limit,
    )
    return {
        "alerts": [a.to_dict() for a in alerts_list],
        "total": len(alerts_list),
    }


@router.get(
    "/config",
    response_model=RiskEngineConfigResponse,
    status_code=status.HTTP_200_OK,
    summary="Get active Risk Engine configuration and thresholds"
)
def get_risk_config():
    """
    Inspect active signal weights, level thresholds, and alert parameters
    used by the deterministic Risk Engine.
    """
    return {
        "weights": DEFAULT_SIGNAL_WEIGHTS,
        "thresholds": {
            "low": BAND_LOW_MAX,
            "medium": BAND_MEDIUM_MAX,
            "high": BAND_HIGH_MAX,
            "alert": ALERT_SCORE_THRESHOLD,
        },
        "risk_levels": ["Low", "Medium", "High", "Critical", "Insufficient Data"],
        "description": "Deterministic, explainable composite risk scoring engine for JanDrishti MPLADS monitoring.",
    }


@router.get(
    "/{work_id}",
    response_model=RiskEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve risk evaluation for a stored database work"
)
def get_work_risk(
    work_id: str,
    db: Session = Depends(get_db),
):
    """
    Retrieve risk indicators for a work item already recorded in the database.
    Evaluates available metadata without inventing missing signals.
    """
    work_record = None
    try:
        work_record = risk_service._lookup_work(db, work_id)
    except Exception as e:
        logger.warning(f"Database lookup error for {work_id}: {e}")

    if not work_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work with identifier '{work_id}' was not found in the database.",
        )

    result = risk_service.calculate_for_work(
        work_id=work_id,
        signals={},
        db=db,
    )
    return result
