"""
JanDrishti - Risk Engine & Alerts API Routes

REST endpoints for evaluating project risk, batch scoring, retrieving
risk evaluations for database records, querying active alerts, dashboard KPI summaries,
and inspecting engine configuration under the final JanDrishti contract.
"""

import math
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.database import get_db
from app.models.work import Work
from app.models.mp_summary import MPFinancialSummary
from app.models.risk import RiskScore, Alert, SimilarWork
from app.schemas.risk import (
    RiskWorkItem,
    RiskSummaryKPIs,
    RiskEvaluationRequest,
    BatchRiskEvaluationRequest,
    RiskEvaluationResponse,
    BatchRiskEvaluationResponse,
    RiskAlertsListResponse,
    RiskEngineConfigResponse,
)
from app.services.risk.service import (
    risk_service,
    run_full_risk_pipeline,
    get_work_id_str,
)
from app.services.risk.alerts import alert_manager
from ml.risk_engine import (
    DEFAULT_SIGNAL_WEIGHTS,
    BAND_LOW_MAX,
    BAND_MEDIUM_MAX,
    BAND_HIGH_MAX,
    ALERT_SCORE_THRESHOLD,
)

logger = logging.getLogger("jandrishti.routes.risk")

router = APIRouter(prefix="/risk", tags=["Risk Engine & Analysis"])


@router.get("/summary", response_model=RiskSummaryKPIs, summary="Get macro risk summary KPIs")
def get_risk_summary(db: Session = Depends(get_db)):
    total_works = db.query(Work).count()

    mp_aggregates = db.query(
        func.sum(MPFinancialSummary.allocated_amount),
        func.sum(MPFinancialSummary.total_expenditure),
        func.avg(MPFinancialSummary.utilization_percentage)
    ).first()

    total_alloc = float(mp_aggregates[0] or 0.0)
    total_exp = float(mp_aggregates[1] or 0.0)
    avg_util = round(float(mp_aggregates[2] or 0.0), 1)

    # Risk level distribution
    risk_level_rows = db.query(RiskScore.risk_level, func.count(RiskScore.id)).group_by(RiskScore.risk_level).all()
    dist = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    for level, count in risk_level_rows:
        if level in dist:
            dist[level] = count

    high_risk_count = dist.get("High", 0) + dist.get("Critical", 0)
    critical_alerts = db.query(Alert).filter(
        Alert.severity.in_(["Critical", "High"]),
        Alert.status.in_(["New", "Under Review"])
    ).count()

    # Category and Constituency Aggregations
    works = db.query(Work).all()
    risk_scores = {r.work_id: r for r in db.query(RiskScore).all()}

    cat_map: Dict[str, Dict[str, Any]] = {}
    const_map: Dict[str, Dict[str, Any]] = {}

    for w in works:
        wid = get_work_id_str(w)
        r = risk_scores.get(wid) or risk_scores.get(str(w.id))
        score = r.overall_score if r else 20.0
        cost = float(w.cost or 0.0)

        # Category
        cat = w.category or "General"
        if cat not in cat_map:
            cat_map[cat] = {"count": 0, "total_cost": 0.0, "scores": []}
        cat_map[cat]["count"] += 1
        cat_map[cat]["total_cost"] += cost
        cat_map[cat]["scores"].append(score)

        # Constituency
        if w.constituency:
            c_key = f"{w.constituency}::{w.state or 'Unknown'}"
            if c_key not in const_map:
                const_map[c_key] = {
                    "constituency": w.constituency,
                    "state": w.state or "Unknown",
                    "works_count": 0,
                    "total_spend": 0.0,
                    "scores": []
                }
            const_map[c_key]["works_count"] += 1
            const_map[c_key]["total_spend"] += cost
            const_map[c_key]["scores"].append(score)

    cat_risk = [
        {
            "category": cat,
            "works_count": data["count"],
            "total_cost": round(data["total_cost"], 1),
            "avg_risk": round(sum(data["scores"]) / len(data["scores"]), 1) if data["scores"] else 20.0
        }
        for cat, data in cat_map.items()
    ]
    cat_risk.sort(key=lambda x: x["total_cost"], reverse=True)

    const_list = [
        {
            "constituency": data["constituency"],
            "state": data["state"],
            "works_count": data["works_count"],
            "avg_risk": round(sum(data["scores"]) / len(data["scores"]), 1) if data["scores"] else 25.0,
            "total_spend": round(data["total_spend"], 1)
        }
        for data in const_map.values()
    ]
    const_list.sort(key=lambda x: x["avg_risk"], reverse=True)
    top_constituencies = const_list[:5]

    return RiskSummaryKPIs(
        total_works=total_works,
        total_allocation=round(total_alloc, 1),
        total_expenditure=round(total_exp, 1),
        average_utilization=avg_util,
        high_risk_works=high_risk_count,
        critical_alerts=critical_alerts,
        risk_distribution=dist,
        category_risk=cat_risk,
        top_risk_constituencies=top_constituencies
    )


@router.get("/works", summary="Get paginated works with risk indicators")
def get_risk_works(
    risk_level: Optional[str] = None,
    category: Optional[str] = None,
    constituency: Optional[str] = None,
    state: Optional[str] = None,
    mp_name: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("risk_desc", pattern="^(risk_desc|cost_desc|date_desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db)
):
    works = db.query(Work).all()
    risk_scores = {r.work_id: r for r in db.query(RiskScore).all()}

    items = []
    for w in works:
        wid = get_work_id_str(w)
        r = risk_scores.get(wid) or risk_scores.get(str(w.id))

        r_level = r.risk_level if r else "Low"
        overall = r.overall_score if r else 15.0

        if risk_level and r_level.lower() != risk_level.lower():
            continue
        if category and w.category and category.lower() not in w.category.lower():
            continue
        if state and w.state and state.lower() not in w.state.lower():
            continue
        if mp_name and w.mp_name and mp_name.lower() not in w.mp_name.lower():
            continue
        if constituency and w.constituency:
            c_query = constituency.strip().lower()
            if "raebar" in c_query:
                c_query = "rae bareli"
            if c_query not in w.constituency.lower():
                continue
        if search:
            s = search.strip().lower()
            if "raebar" in s:
                s = "rae bareli"
            in_desc = w.work_description and s in w.work_description.lower()
            in_const = w.constituency and s in w.constituency.lower()
            in_mp = w.mp_name and s in w.mp_name.lower()
            in_id = wid and s in wid.lower()
            if not (in_desc or in_const or in_mp or in_id):
                continue

        items.append({
            "work_id": wid,
            "id": w.id,
            "description": w.work_description or "Work Item",
            "category": w.category or "General",
            "cost": float(w.cost or 0.0),
            "state": w.state or "Unknown",
            "district": w.district or "Unknown",
            "constituency": w.constituency or "Unknown",
            "mp_name": w.mp_name or "Unknown",
            "location": w.location or "Not Specified",
            "overall_score": overall,
            "risk_level": r_level,
            "cost_score": r.cost_score if r else 0.0,
            "duplicate_score": r.duplicate_score if r else 0.0,
            "ml_anomaly_score": r.ml_anomaly_score if r else 0.0,
            "utilization_score": r.utilization_score if r else 0.0,
            "geographic_score": r.geographic_score if r else 0.0,
            "data_quality_score": r.data_quality_score if r else 0.0,
            "flags": (r.flags_json if r and r.flags_json else []),
            "latitude": w.latitude,
            "longitude": w.longitude,
            "completion_date": str(w.completion_date) if w.completion_date else None
        })

    # Sort
    if sort_by == "risk_desc":
        items.sort(key=lambda x: x["overall_score"], reverse=True)
    elif sort_by == "cost_desc":
        items.sort(key=lambda x: x["cost"], reverse=True)
    else:
        items.sort(key=lambda x: x["id"], reverse=True)

    total = len(items)
    total_pages = math.ceil(total / limit) if total > 0 else 0
    paginated = items[(page - 1) * limit: page * limit]

    return {
        "items": paginated,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }


@router.get("/works/{work_id}", summary="Get detailed risk breakdown for a work")
def get_work_risk_detail(work_id: str, db: Session = Depends(get_db)):
    work = None
    if work_id.isdigit():
        num = int(work_id)
        work = db.query(Work).filter(or_(Work.work_id == num, Work.id == num)).first()
    if not work:
        work = db.query(Work).filter(or_(Work.source_id == work_id, Work.work_id == work_id)).first()

    if not work:
        raise HTTPException(status_code=404, detail="Work item not found")

    wid = get_work_id_str(work)
    r = db.query(RiskScore).filter(or_(RiskScore.work_id == wid, RiskScore.work_id == work_id)).first()
    similar = db.query(SimilarWork).filter(
        or_(SimilarWork.work_id == wid, SimilarWork.matched_work_id == wid)
    ).all()

    return {
        "work": {
            "work_id": wid,
            "id": work.id,
            "description": work.work_description,
            "category": work.category,
            "cost": float(work.cost or 0.0),
            "state": work.state,
            "district": work.district,
            "constituency": work.constituency,
            "mp_name": work.mp_name,
            "location": work.location,
            "latitude": work.latitude,
            "longitude": work.longitude,
            "implementing_agency": work.implementing_agency,
            "quality_rating": work.quality_rating,
            "source": work.source
        },
        "risk_score": {
            "overall_score": r.overall_score if r else 15.0,
            "risk_level": r.risk_level if r else "Low",
            "cost_score": r.cost_score if r else 0.0,
            "duplicate_score": r.duplicate_score if r else 0.0,
            "ml_anomaly_score": r.ml_anomaly_score if r else 0.0,
            "utilization_score": r.utilization_score if r else 0.0,
            "geographic_score": r.geographic_score if r else 0.0,
            "data_quality_score": r.data_quality_score if r else 0.0,
            "flags": r.flags_json if r and r.flags_json else []
        },
        "similar_works_count": len(similar)
    }


@router.post("/calculate", summary="Trigger full risk calculation pipeline across database")
def trigger_risk_calculation(db: Session = Depends(get_db)):
    """Run full risk calculation pipeline across all database records."""
    res = run_full_risk_pipeline(db)
    return res


@router.get("/benchmarks", summary="Get implementing agency benchmarks")
def get_agency_benchmarks(db: Session = Depends(get_db)):
    """Implementing agency statistical benchmarks."""
    results = db.query(
        Work.implementing_agency,
        func.count(Work.id).label("total_works"),
        func.sum(Work.cost).label("total_spend"),
        func.avg(Work.cost).label("avg_cost")
    ).filter(Work.implementing_agency.isnot(None)).group_by(Work.implementing_agency).all()

    benchmarks = []
    for r in results:
        agency = r.implementing_agency.strip() if r.implementing_agency else "Unknown"
        benchmarks.append({
            "agency": agency,
            "total_works": r.total_works,
            "total_spend": round(float(r.total_spend or 0.0), 1),
            "avg_cost": round(float(r.avg_cost or 0.0), 2)
        })

    benchmarks.sort(key=lambda x: x["total_spend"], reverse=True)
    return {"agencies": benchmarks[:20]}


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
