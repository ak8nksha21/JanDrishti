"""
JanDrishti - Risk Engine & Alerts API Routes

REST endpoints for evaluating project risk, batch scoring, retrieving
risk evaluations for database records, querying active alerts, dashboard KPI summaries,
and inspecting engine configuration under the final JanDrishti contract.
"""

import math
import logging
from typing import Optional, List, Dict, Any, Tuple
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
    CityRiskItem,
    CityRiskResponse,
    RiskEvaluationRequest,
    BatchRiskEvaluationRequest,
    RiskEvaluationResponse,
    BatchRiskEvaluationResponse,
    RiskAlertsListResponse,
    RiskEngineConfigResponse,
)
from app.services.geo.india_cities import get_city_coordinates
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


def categorize_risk_tier(score: float) -> Tuple[str, str]:
    """
    Categorize 0-100 risk score into JanDrishti product tiers:
    0–29   -> Standard / Low Risk
    30–59  -> Needs Review / Medium Risk
    60–79  -> Flagged Risk / High Risk
    80–100 -> Priority Review / Critical
    """
    if score >= 80.0:
        return "Priority Review", "Critical"
    elif score >= 60.0:
        return "Flagged Risk", "High"
    elif score >= 30.0:
        return "Needs Review", "Medium"
    else:
        return "Standard", "Low"


@router.get("/cities", response_model=CityRiskResponse, summary="Get city-level composite risk evaluations with verified coordinates")
def get_city_risks(db: Session = Depends(get_db)):
    """
    Retrieve city-level risk scores aggregated across the JanDrishti multi-source pipeline.
    Zero synthetic or fabricated coordinates: only cities with verified geographic coordinates
    are marked with has_coordinates=True.
    """
    from app.services.geo.india_cities import _clean_key, EXPLICIT_NON_GEOGRAPHIC

    # 1. Fetch works and risk scores
    works = db.query(Work).all()
    risk_scores = {r.work_id: r for r in db.query(RiskScore).all()}

    # Group works by normalized constituency key
    const_works: Dict[str, Dict[str, Any]] = {}
    for w in works:
        wid = get_work_id_str(w)
        r = risk_scores.get(wid) or risk_scores.get(str(w.id))
        score = float(r.overall_score if r else 20.0)
        cost = float(w.cost or 0.0)
        c_raw = (w.constituency or w.district or "").strip()
        if not c_raw:
            continue
        c_key = _clean_key(c_raw)
        if not c_key:
            continue
        if c_key not in const_works:
            const_works[c_key] = {
                "constituency": c_raw.replace("(SC)", "").replace("(ST)", "").replace("(GEN)", "").strip(),
                "state": w.state or "Unknown",
                "works_count": 0,
                "total_spend": 0.0,
                "scores": [],
                "flags": set(),
                "mp_name": w.mp_name or None,
            }
        const_works[c_key]["works_count"] += 1
        const_works[c_key]["total_spend"] += cost
        const_works[c_key]["scores"].append(score)
        if w.mp_name and not const_works[c_key]["mp_name"]:
            const_works[c_key]["mp_name"] = w.mp_name
        if r and r.flags_json:
            for f in r.flags_json:
                const_works[c_key]["flags"].add(f)

    # 2. Fetch MP financial summaries
    mps = db.query(MPFinancialSummary).all()
    mp_map: Dict[str, MPFinancialSummary] = {}
    for m in mps:
        if m.constituency:
            c_key = _clean_key(m.constituency)
            if c_key:
                # Prefer Lok Sabha entries over Rajya Sabha for key collision
                if c_key not in mp_map or (m.house and "LOK" in m.house.upper()):
                    mp_map[c_key] = m

    # 3. If there are constituencies with MP data but no works, evaluate anomaly scores
    mp_evaluations: Dict[str, Any] = {}
    if mps:
        try:
            from app.services.anomaly.service import AnomalyService
            anomaly_service = AnomalyService()
            mp_eval_result = anomaly_service.evaluate_mps(db, limit=1000)
            for item in mp_eval_result.get("items", []):
                c_name = _clean_key(str(item.get("constituency") or ""))
                if c_name:
                    mp_evaluations[c_name] = item
        except Exception as exc:
            logger.warning(f"Unable to run MP cohort anomaly evaluations for cities: {exc}")

    # 4. Merge all unique constituencies (filter out non-geographic Rajya Sabha if no works exist)
    all_const_keys = set(const_works.keys()) | set(mp_map.keys())

    city_items: List[CityRiskItem] = []
    dist = {"Standard": 0, "Needs Review": 0, "Flagged Risk": 0, "Priority Review": 0}

    for c_key in sorted(all_const_keys):
        w_data = const_works.get(c_key)
        m_data = mp_map.get(c_key)
        mp_eval = mp_evaluations.get(c_key, {})

        # Skip explicit non-geographic summaries (e.g. Sitting Rajya Sabha) if no works are attached
        if not w_data and (c_key in EXPLICIT_NON_GEOGRAPHIC or any(x in c_key for x in ["RAJYA SABHA", "NOMINATED"])):
            continue

        # Determine display names
        constituency_display = (w_data["constituency"] if w_data else m_data.constituency) if (w_data or m_data) else c_key
        state_display = (w_data["state"] if w_data and w_data["state"] != "Unknown" else (m_data.state if m_data else "Unknown"))

        # Determine risk score and signals
        signals_list: List[str] = []
        if w_data and w_data["scores"]:
            # Uses mean composite risk score of works evaluated by Risk Engine
            risk_score = round(sum(w_data["scores"]) / len(w_data["scores"]), 1)
            signals_list = sorted(list(w_data["flags"]))
        elif mp_eval and mp_eval.get("anomaly_score") is not None:
            # Uses evaluated MP anomaly score from Isolation Forest / Cohort distribution
            risk_score = round(float(mp_eval.get("anomaly_score", 20.0)), 1)
            if mp_eval.get("anomaly_type"):
                for t in str(mp_eval["anomaly_type"]).split(","):
                    clean_t = t.strip().replace("_", " ").title()
                    if clean_t:
                        signals_list.append(clean_t)
        elif m_data:
            # Basic utilization heuristic if no model scores exist
            util = float(m_data.utilization_percentage or 50.0)
            if util < 30.0:
                risk_score = 65.0
                signals_list.append("Lagging Fund Utilization")
            elif util < 50.0:
                risk_score = 45.0
                signals_list.append("Below Average Utilization")
            else:
                risk_score = 20.0
        else:
            risk_score = 20.0

        risk_score = max(0.0, min(100.0, risk_score))

        # Categorize into product bands (0-29, 30-59, 60-79, 80-100)
        risk_category, risk_level = categorize_risk_tier(risk_score)
        dist[risk_category] = dist.get(risk_category, 0) + 1

        # Geocode against verified database (zero fabrication)
        resolved_city, lat, lon = get_city_coordinates(constituency_display, state_display)
        has_coords = (lat is not None and lon is not None)

        city_name = resolved_city or constituency_display.title()

        # Aggregate financial & project figures if available
        projects_count = w_data["works_count"] if w_data else (m_data.completed_works_count if m_data else None)
        total_spend = round(w_data["total_spend"], 2) if w_data else None
        allocated_amount = round(float(m_data.allocated_amount), 2) if (m_data and m_data.allocated_amount is not None) else None
        total_expenditure = round(float(m_data.total_expenditure), 2) if (m_data and m_data.total_expenditure is not None) else total_spend
        utilization_pct = round(float(m_data.utilization_percentage), 1) if (m_data and m_data.utilization_percentage is not None) else None
        mp_name = w_data["mp_name"] if (w_data and w_data["mp_name"]) else (m_data.mp_name if m_data else None)

        city_items.append(CityRiskItem(
            city=city_name,
            constituency=constituency_display,
            state=state_display,
            risk_score=risk_score,
            risk_level=risk_level,
            risk_category=risk_category,
            latitude=lat,
            longitude=lon,
            has_coordinates=has_coords,
            projects_count=projects_count,
            total_spend=total_spend,
            allocated_amount=allocated_amount,
            total_expenditure=total_expenditure,
            utilization_percentage=utilization_pct,
            signals=signals_list,
            mp_name=mp_name,
        ))

    # Sort so higher risk and cities with works appear first
    city_items.sort(key=lambda x: (x.has_coordinates, (x.projects_count or 0) > 0, x.risk_score), reverse=True)

    mapped_count = sum(1 for c in city_items if c.has_coordinates)
    unmapped_count = len(city_items) - mapped_count

    return CityRiskResponse(
        cities=city_items,
        total_cities=len(city_items),
        mapped_cities_count=mapped_count,
        unmapped_cities_count=unmapped_count,
        risk_distribution=dist,
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
