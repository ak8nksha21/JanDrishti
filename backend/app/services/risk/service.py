"""
JanDrishti - Composite Risk Scoring Service
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.work import Work
from app.models.mp_summary import MPFinancialSummary
from app.models.risk import RiskScore, Alert, SimilarWork, AuditLog
from ml.anomaly_detection import CostAnomalyDetector, MultivariableIsolationForestDetector, DataQualityDetector
from ml.duplicate_detection import NearDuplicateDetector, haversine_distance
from ml.risk_engine import RiskEngine

logger = logging.getLogger("jandrishti.risk_service")


def get_work_id_str(w: Work) -> str:
    """Safely extract canonical string identifier for a work item."""
    if w.work_id is not None:
        return str(w.work_id)
    if w.source_id:
        return str(w.source_id)
    return str(w.id)


def calculate_geographic_scores(works: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Detect extreme geographic clustering and coordinate collisions (<60m)."""
    geo_scores = {w["work_id"]: {"score": 5.0, "collisions": [], "reason": "No geographic anomaly"} for w in works}
    n = len(works)
    for i in range(n):
        w1 = works[i]
        lat1, lon1 = w1.get("latitude"), w1.get("longitude")
        if lat1 is None or lon1 is None:
            continue

        for j in range(i + 1, n):
            w2 = works[j]
            lat2, lon2 = w2.get("latitude"), w2.get("longitude")
            if lat2 is None or lon2 is None:
                continue

            try:
                dist_m = haversine_distance(float(lat1), float(lon1), float(lat2), float(lon2))
                if dist_m < 60.0:
                    collision_data = {
                        "work_id": w2["work_id"],
                        "distance_meters": round(dist_m, 1),
                        "description": str(w2.get("work_description") or "")[:60]
                    }
                    geo_scores[w1["work_id"]]["collisions"].append(collision_data)
                    geo_scores[w1["work_id"]]["score"] = 85.0
                    geo_scores[w1["work_id"]]["reason"] = f"Geographic collision ({dist_m:.1f}m) with Work #{w2['work_id']}"

                    geo_scores[w2["work_id"]]["collisions"].append({
                        "work_id": w1["work_id"],
                        "distance_meters": round(dist_m, 1),
                        "description": str(w1.get("work_description") or "")[:60]
                    })
                    geo_scores[w2["work_id"]]["score"] = 85.0
                    geo_scores[w2["work_id"]]["reason"] = f"Geographic collision ({dist_m:.1f}m) with Work #{w1['work_id']}"
            except Exception:
                continue

    return geo_scores


def calculate_utilization_scores(
    works: List[Dict[str, Any]],
    mp_map: Dict[str, Dict[str, Any]]
) -> Dict[str, Dict[str, Any]]:
    """Score fund utilization and execution risk against parliamentary allocations."""
    results = {}
    for w in works:
        wid = w["work_id"]
        const = str(w.get("constituency", "")).strip().upper()
        mp_name = str(w.get("mp_name", "")).strip().upper()
        mp_data = mp_map.get(const) or mp_map.get(mp_name) or {}

        util = float(mp_data.get("utilization_percentage", 50.0) or 50.0)
        unspent = float(mp_data.get("unspent_amount", 200.0) or 200.0)
        pay_gap = float(mp_data.get("payment_gap_percentage", 0.0) or 0.0)

        score = 15.0
        reasons = []
        if util < 30.0:
            score += 40.0
            reasons.append(f"Severely lagging utilization ({util:.1f}%)")
        elif util < 50.0:
            score += 20.0
            reasons.append(f"Below average utilization ({util:.1f}%)")

        if pay_gap > 25.0:
            score += 25.0
            reasons.append(f"Elevated pending payment gap ({pay_gap:.1f}%)")

        if unspent > 300.0:
            score += 15.0
            reasons.append(f"Substantial unspent balance (₹{unspent:.1f}L)")

        score = min(100.0, max(5.0, score))
        results[wid] = {
            "score": round(score, 1),
            "reason": "; ".join(reasons) if reasons else "Financial drawdown consistent with schedule"
        }
    return results


def run_full_risk_pipeline(db: Session) -> Dict[str, Any]:
    """
    Executes the full anomaly, duplicate, and composite risk scoring pipeline
    across all works in the database and updates RiskScore, SimilarWork, and Alert records.
    """
    works = db.query(Work).all()
    if not works:
        return {"status": "no_records", "processed": 0}

    logger.info(f"Running risk scoring pipeline across {len(works)} works...")

    # Format works into uniform dictionary
    work_dicts = []
    for w in works:
        wid = get_work_id_str(w)
        work_dicts.append({
            "work_id": wid,
            "id": w.id,
            "source_id": w.source_id,
            "work_description": w.work_description or "",
            "category": w.category or "General",
            "cost": float(w.cost or 0.0),
            "constituency": w.constituency or "",
            "state": w.state or "",
            "district": w.district or "",
            "location": w.location or "",
            "latitude": w.latitude,
            "longitude": w.longitude,
            "implementing_agency": w.implementing_agency or "",
            "mp_name": w.mp_name or ""
        })

    # Load MP financials map
    mps = db.query(MPFinancialSummary).all()
    mp_map = {}
    for m in mps:
        data = {
            "allocated_amount": float(m.allocated_amount or 500.0),
            "total_expenditure": float(m.total_expenditure or 250.0),
            "utilization_percentage": float(m.utilization_percentage or 50.0),
            "completion_rate": float(m.completion_rate or 50.0),
            "unspent_amount": float(m.unspent_amount or 250.0),
            "payment_gap_percentage": float(m.payment_gap_percentage or 0.0),
            "in_progress_payments": float(m.in_progress_payments or 0.0)
        }
        if m.constituency:
            mp_map[m.constituency.strip().upper()] = data
        if m.mp_name:
            mp_map[m.mp_name.strip().upper()] = data

    # 1. Detectors
    cost_detector = CostAnomalyDetector()
    cost_results = cost_detector.analyze(work_dicts)

    multi_detector = MultivariableIsolationForestDetector()
    multi_results = multi_detector.analyze(work_dicts, mp_map)

    dup_detector = NearDuplicateDetector()
    dup_results, similar_pairs = dup_detector.analyze(work_dicts)

    geo_results = calculate_geographic_scores(work_dicts)
    util_results = calculate_utilization_scores(work_dicts, mp_map)

    dq_detector = DataQualityDetector()
    dq_results = dq_detector.analyze(work_dicts)

    # 2. Composite Risk Engine
    risk_engine = RiskEngine()

    # Clear existing risk scores to re-compute cleanly
    db.query(RiskScore).delete()
    db.query(SimilarWork).delete()

    created_scores = []
    new_alerts_count = 0

    for w in work_dicts:
        wid = w["work_id"]
        c_score = cost_results.get(wid, {}).get("score", 0.0)
        m_score = multi_results.get(wid, {}).get("score", 0.0)
        d_score = dup_results.get(wid, {}).get("score", 0.0)
        g_score = geo_results.get(wid, {}).get("score", 0.0)
        u_score = util_results.get(wid, {}).get("score", 0.0)
        dq_score = dq_results.get(wid, {}).get("score", 0.0)

        composite = risk_engine.compute_composite_score(
            cost_score=c_score,
            ml_score=m_score,
            dup_score=d_score,
            util_score=u_score,
            geo_score=g_score,
            dq_score=dq_score
        )

        r_score = RiskScore(
            work_id=wid,
            cost_score=c_score,
            duplicate_score=d_score,
            ml_anomaly_score=m_score,
            utilization_score=u_score,
            geographic_score=g_score,
            data_quality_score=dq_score,
            overall_score=composite["overall_score"],
            risk_level=composite["risk_level"],
            flags_json=composite["flags"],
            model_version="v1.0-ensemble"
        )
        db.add(r_score)
        created_scores.append(r_score)

        # Auto-create alert for Critical / High risk works if not already present
        if composite["risk_level"] in ["High", "Critical"]:
            existing_alert = db.query(Alert).filter(Alert.work_id == wid).first()
            if not existing_alert:
                reasons = []
                if c_score >= 60.0:
                    reasons.append(cost_results.get(wid, {}).get("reason", "Cost anomaly"))
                if d_score >= 60.0:
                    reasons.append(dup_results.get(wid, {}).get("reason", "Duplicate suspicion"))
                if m_score >= 65.0:
                    reasons.append(multi_results.get(wid, {}).get("reason", "Multivariate outlier"))
                if g_score >= 60.0:
                    reasons.append(geo_results.get(wid, {}).get("reason", "Geographic proximity"))

                reason_str = "; ".join(reasons) if reasons else f"Elevated composite risk ({composite['overall_score']})"

                alert = Alert(
                    work_id=wid,
                    risk_score=composite["overall_score"],
                    severity=composite["risk_level"],
                    reason=reason_str,
                    evidence_json={
                        "flags": composite["flags"],
                        "scores": {
                            "cost": c_score,
                            "duplicate": d_score,
                            "ml_anomaly": m_score,
                            "utilization": u_score,
                            "geographic": g_score,
                            "data_quality": dq_score
                        }
                    },
                    status="New"
                )
                db.add(alert)
                new_alerts_count += 1

    # Persist similar works pairs
    for p in similar_pairs:
        sw = SimilarWork(
            work_id=str(p["work_id"]),
            matched_work_id=str(p["matched_work_id"]),
            text_similarity=p["text_similarity"],
            cost_similarity=p["cost_similarity"],
            geographic_similarity=p["geographic_similarity"],
            combined_similarity=p["combined_similarity"]
        )
        db.add(sw)

    # Log audit event
    audit = AuditLog(
        user_id="system",
        action="RISK_SCORING_RUN",
        resource_type="WORKS_BATCH",
        resource_id=f"batch_{len(work_dicts)}",
        metadata_json={
            "processed_count": len(work_dicts),
            "new_alerts": new_alerts_count,
            "similar_pairs_found": len(similar_pairs)
        }
    )
    db.add(audit)

    db.commit()
    logger.info(f"Risk pipeline finished: {len(created_scores)} scores, {new_alerts_count} alerts.")

    return {
        "status": "success",
        "processed": len(created_scores),
        "alerts_generated": new_alerts_count,
        "similar_pairs_found": len(similar_pairs)
    }
