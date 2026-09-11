import math
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from app.models.work import Work
from app.models.mp_summary import MPFinancialSummary

logger = logging.getLogger("jandrishti.agent.tools")


def _calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in kilometers."""
    radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(radius_km * c, 2)


def _token_similarity(text1: Optional[str], text2: Optional[str]) -> float:
    """Calculate token-based Jaccard similarity between two text descriptions."""
    if not text1 or not text2:
        return 0.0
    tokens1 = set(text1.lower().replace(",", " ").replace(".", " ").split())
    tokens2 = set(text2.lower().replace(",", " ").replace(".", " ").split())
    if not tokens1 or not tokens2:
        return 0.0
    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)
    return round(len(intersection) / len(union), 3)


# =============================================================================
# PRIVATE ADAPTER DELEGATION HELPERS
# =============================================================================

def _get_anomaly_detector_class():
    """Locate AnomalyDetector from ml root or backend service package."""
    try:
        from ml.anomaly_detection import AnomalyDetector
        return AnomalyDetector
    except ImportError:
        try:
            from app.services.anomaly import AnomalyDetector
            return AnomalyDetector
        except ImportError:
            return None


def _get_duplicate_detector_class():
    """Locate DuplicateDetector from ml root or backend service package."""
    try:
        from ml.duplicate_detection import DuplicateDetector
        return DuplicateDetector
    except ImportError:
        try:
            from app.services.duplicate import DuplicateDetector
            return DuplicateDetector
        except ImportError:
            return None


def _get_risk_engine_class():
    """Locate RiskEngine from ml root or backend service package."""
    try:
        from ml.risk_engine import RiskEngine
        return RiskEngine
    except ImportError:
        try:
            from app.services.risk import RiskEngine
            return RiskEngine
        except ImportError:
            return None


def _try_anomaly_detector(work: Work, db: Session) -> Optional[Dict[str, Any]]:
    """
    Akshansh Adapter: Safe delegation hook for Akshansh's AnomalyDetector.
    Returns structured scoring dict with engine_mode='ml_detector' if implemented,
    or None if unavailable / stub / uninitialized to trigger statistical fallback.
    """
    try:
        detector_cls = _get_anomaly_detector_class()
        if detector_cls is None:
            return None
        detector = detector_cls()

        if hasattr(detector, "predict"):
            work_dict = {
                "work_id": work.work_id or work.id,
                "work_description": work.work_description,
                "cost": work.cost,
                "category": work.category,
                "state": work.state,
                "constituency": work.constituency
            }
            res = None
            try:
                res = detector.predict(work_dict)
            except Exception:
                try:
                    import pandas as pd
                    df = pd.DataFrame([work_dict])
                    res = detector.predict(df)
                except Exception:
                    res = None

            # Dict return format
            if isinstance(res, dict) and ("ml_anomaly_score" in res or "cost_anomaly_score" in res or "cost_score" in res):
                cost_score = float(res.get("cost_anomaly_score", res.get("cost_score", 20.0)))
                ml_score = float(res.get("ml_anomaly_score", cost_score))
                return {
                    "cost": work.cost,
                    "cost_score": cost_score,
                    "ml_anomaly_score": ml_score,
                    "engine_mode": "ml_detector",
                    "observations": res.get("observations", ["Cost and ML anomaly scored via active AnomalyDetector."]),
                    "raw_ml_output": res
                }
            # DataFrame return format
            elif hasattr(res, "to_dict"):
                records = res.to_dict(orient="records")
                if records and ("ml_anomaly_score" in records[0] or "cost_anomaly_score" in records[0] or "anomaly_score" in records[0]):
                    rec = records[0]
                    cost_score = float(rec.get("cost_anomaly_score", rec.get("anomaly_score", 20.0)))
                    ml_score = float(rec.get("ml_anomaly_score", cost_score))
                    return {
                        "cost": work.cost,
                        "cost_score": cost_score,
                        "ml_anomaly_score": ml_score,
                        "engine_mode": "ml_detector",
                        "observations": ["Cost and ML anomaly scored via active AnomalyDetector."],
                        "raw_ml_output": rec
                    }
    except Exception as e:
        logger.debug(f"AnomalyDetector adapter fallback triggered: {e}")
    return None


def _try_duplicate_detector(work: Work, db: Session) -> Optional[Dict[str, Any]]:
    """
    Nitin Adapter: Safe delegation hook for Nitin's DuplicateDetector.
    Returns structured duplicate dict with engine_mode='duplicate_detector' if implemented,
    or None if unavailable / stub to trigger similarity fallback.
    """
    try:
        detector_cls = _get_duplicate_detector_class()
        if detector_cls is None:
            return None
        detector = detector_cls()

        if hasattr(detector, "find_duplicates"):
            work_dict = {
                "work_id": work.work_id or work.id,
                "work_description": work.work_description,
                "cost": work.cost,
                "constituency": work.constituency,
                "state": work.state
            }
            res = None
            try:
                res = detector.find_duplicates(work_dict)
            except Exception:
                try:
                    import pandas as pd
                    df = pd.DataFrame([work_dict])
                    res = detector.find_duplicates(df)
                except Exception:
                    res = None

            # Dict return format
            if isinstance(res, dict) and ("duplicate_score" in res or "potential_duplicates" in res):
                dup_score = float(res.get("duplicate_score", 10.0))
                return {
                    "duplicate_score": dup_score,
                    "duplicate_detected": bool(res.get("duplicate_detected", dup_score >= 60.0)),
                    "reason": res.get("reason", "Evaluated via active DuplicateDetector."),
                    "potential_duplicates": res.get("potential_duplicates", []),
                    "engine_mode": "duplicate_detector"
                }
            # DataFrame return format
            elif hasattr(res, "to_dict"):
                records = res.to_dict(orient="records")
                if records and ("duplicate_score" in records[0] or "is_duplicate" in records[0]):
                    rec = records[0]
                    dup_score = float(rec.get("duplicate_score", 80.0 if rec.get("is_duplicate") else 10.0))
                    return {
                        "duplicate_score": dup_score,
                        "duplicate_detected": bool(rec.get("is_duplicate", dup_score >= 60.0)),
                        "reason": rec.get("reason", "Evaluated via active DuplicateDetector."),
                        "potential_duplicates": rec.get("potential_duplicates", []),
                        "engine_mode": "duplicate_detector"
                    }
    except Exception as e:
        logger.debug(f"DuplicateDetector adapter fallback triggered: {e}")
    return None


def _try_risk_engine(work: Work, db: Session, signals: Dict[str, float]) -> Optional[Dict[str, Any]]:
    """
    Jayant Adapter: Safe delegation hook for Jayant's RiskEngine.
    Returns composite risk breakdown with engine_mode='risk_engine' if implemented,
    or None to trigger PRD-weighted fallback calculation.
    """
    try:
        engine_cls = _get_risk_engine_class()
        if engine_cls is None:
            return None
        engine = engine_cls()

        if hasattr(engine, "compute_risk"):
            res = None
            try:
                res = engine.compute_risk(signals)
            except Exception:
                try:
                    import pandas as pd
                    df = pd.DataFrame([signals])
                    res = engine.compute_risk(df)
                except Exception:
                    res = None

            # Dict return format
            if isinstance(res, dict) and "overall_score" in res:
                overall_score = float(res["overall_score"])
                overall_score = round(max(0.0, min(100.0, overall_score)), 1)

                risk_level = res.get("risk_level")
                if not risk_level:
                    if overall_score <= 30.0:
                        risk_level = "LOW"
                    elif overall_score <= 60.0:
                        risk_level = "MEDIUM"
                    elif overall_score <= 80.0:
                        risk_level = "HIGH"
                    else:
                        risk_level = "CRITICAL"

                return {
                    "overall_score": overall_score,
                    "risk_level": risk_level,
                    "weights": res.get("weights", {
                        "ml_anomaly_score": 0.25,
                        "cost_score": 0.25,
                        "duplicate_score": 0.20,
                        "utilization_score": 0.15,
                        "geographic_score": 0.10,
                        "data_quality_score": 0.05
                    }),
                    "contributing_signals": res.get("contributing_signals", {
                        k: {"score": signals.get(k, 0.0)} for k in signals
                    }),
                    "engine_mode": "risk_engine"
                }
            # DataFrame return format
            elif hasattr(res, "to_dict"):
                records = res.to_dict(orient="records")
                if records and "overall_score" in records[0]:
                    rec = records[0]
                    overall_score = round(max(0.0, min(100.0, float(rec["overall_score"]))), 1)
                    risk_level = rec.get("risk_level")
                    if not risk_level:
                        if overall_score <= 30.0:
                            risk_level = "LOW"
                        elif overall_score <= 60.0:
                            risk_level = "MEDIUM"
                        elif overall_score <= 80.0:
                            risk_level = "HIGH"
                        else:
                            risk_level = "CRITICAL"
                    return {
                        "overall_score": overall_score,
                        "risk_level": risk_level,
                        "weights": rec.get("weights", {
                            "ml_anomaly_score": 0.25,
                            "cost_score": 0.25,
                            "duplicate_score": 0.20,
                            "utilization_score": 0.15,
                            "geographic_score": 0.10,
                            "data_quality_score": 0.05
                        }),
                        "contributing_signals": rec.get("contributing_signals", {
                            k: {"score": signals.get(k, 0.0)} for k in signals
                        }),
                        "engine_mode": "risk_engine"
                    }
    except Exception as e:
        logger.debug(f"RiskEngine adapter fallback triggered: {e}")
    return None


class InvestigationTools:
    """
    Structured investigation toolset for JanDrishti.
    Provides isolated, deterministic evidence extraction methods that query
    live PostgreSQL data and expose clean interfaces for teammate detection modules.
    """

    # =========================================================================
    # TOOL 1: get_work_details
    # =========================================================================
    @staticmethod
    def get_work_details(work: Work, db: Session) -> Dict[str, Any]:
        """
        Tool 1: Return the authentic work record and attributes from the database.
        Never fabricates or assumes missing values.
        """
        return {
            "work_id": work.work_id or work.id,
            "internal_id": work.id,
            "source_id": work.source_id,
            "work_description": work.work_description,
            "cost": work.cost,
            "completion_date": work.completion_date.isoformat() if work.completion_date else None,
            "completion_year": work.completion_year,
            "mp_name": work.mp_name,
            "constituency": work.constituency,
            "state": work.state,
            "house": work.house,
            "category": work.category,
            "district": work.district,
            "location": work.location,
            "beneficiaries": work.beneficiaries,
            "implementing_agency": work.implementing_agency,
            "quality_rating": work.quality_rating,
            "latitude": work.latitude,
            "longitude": work.longitude,
            "photos_metadata": work.photos_metadata,
            "impact_metrics": work.impact_metrics,
            "source": work.source,
            "last_updated": work.last_updated.isoformat() if work.last_updated else None
        }

    # =========================================================================
    # TOOL 2: get_similar_works
    # Integration Point: Nitin (Duplicate & Similarity Module)
    # =========================================================================
    @staticmethod
    def get_similar_works(work: Work, db: Session, limit: int = 5) -> Dict[str, Any]:
        """
        Tool 2: Identify peer and similar works across the same category, constituency,
        or state using available database records.
        """
        query = db.query(Work).filter(Work.id != work.id)

        # Prefer matching by category and state/constituency
        if work.category and work.state:
            candidates = query.filter(
                Work.category == work.category,
                Work.state == work.state
            ).limit(50).all()
        elif work.category:
            candidates = query.filter(Work.category == work.category).limit(50).all()
        elif work.state:
            candidates = query.filter(Work.state == work.state).limit(50).all()
        else:
            candidates = query.limit(50).all()

        scored_candidates = []
        for c in candidates:
            sim = _token_similarity(work.work_description, c.work_description)
            dist_km = None
            if (
                work.latitude is not None and work.longitude is not None
                and c.latitude is not None and c.longitude is not None
            ):
                dist_km = _calculate_haversine_distance(work.latitude, work.longitude, c.latitude, c.longitude)

            cost_diff_pct = None
            if work.cost and c.cost and work.cost > 0:
                cost_diff_pct = round(abs(c.cost - work.cost) / work.cost * 100.0, 1)

            scored_candidates.append({
                "work_id": c.work_id or c.id,
                "work_description": c.work_description,
                "cost": c.cost,
                "constituency": c.constituency,
                "state": c.state,
                "category": c.category,
                "similarity_score": sim,
                "distance_km": dist_km,
                "cost_difference_pct": cost_diff_pct
            })

        # Sort by similarity score desc, then cost proximity
        scored_candidates.sort(key=lambda x: (x["similarity_score"], -(x["cost_difference_pct"] or 999)), reverse=True)
        top_similar = scored_candidates[:limit]

        return {
            "similar_works": top_similar,
            "total_candidates_analyzed": len(candidates),
            "highest_similarity_score": top_similar[0]["similarity_score"] if top_similar else 0.0,
            "engine_mode": "preliminary_similarity_baseline"
        }

    # =========================================================================
    # TOOL 3: get_cost_analysis
    # Integration Point: Akshansh (Cost Anomaly & ML Detection Module)
    # =========================================================================
    @staticmethod
    def get_cost_analysis(work: Work, db: Session) -> Dict[str, Any]:
        """
        Tool 3: Analyze work expenditure against peer statistical distributions
        or invoke Akshansh's AnomalyDetector via adapter when available.
        """
        # Attempt invocation of teammate ML detector first
        ml_result = _try_anomaly_detector(work, db)
        if ml_result is not None:
            return ml_result

        cost = work.cost
        if cost is None or cost <= 0:
            return {
                "cost": cost,
                "cost_score": 50.0,
                "status": "missing_or_zero_cost",
                "engine_mode": "preliminary_statistical_baseline",
                "observations": ["Work cost is recorded as zero or null in administrative records."],
                "peer_sample_size": 0
            }

        # Query peer works in the same category
        query = db.query(Work.cost).filter(Work.cost.isnot(None), Work.cost > 0)
        if work.category:
            cat_costs = [r[0] for r in query.filter(Work.category == work.category).all()]
        else:
            cat_costs = [r[0] for r in query.all()]

        if len(cat_costs) < 3:
            # Fallback to state-level baseline if category sample is too small
            cat_costs = [r[0] for r in query.filter(Work.state == work.state).all()] if work.state else [r[0] for r in query.all()]

        sample_size = len(cat_costs)
        if sample_size == 0:
            return {
                "cost": cost,
                "cost_score": 20.0,
                "status": "insufficient_peer_data",
                "engine_mode": "preliminary_statistical_baseline",
                "peer_sample_size": 0,
                "observations": ["Insufficient peer records to establish statistical distribution."]
            }

        mean_cost = sum(cat_costs) / sample_size
        sorted_costs = sorted(cat_costs)
        median_cost = sorted_costs[sample_size // 2]

        # Standard deviation
        variance = sum((x - mean_cost) ** 2 for x in cat_costs) / sample_size
        std_dev = math.sqrt(variance) if variance > 0 else 1.0

        z_score = round((cost - mean_cost) / std_dev, 2)
        ratio_to_avg = round(cost / mean_cost, 2) if mean_cost > 0 else 1.0
        ratio_to_median = round(cost / median_cost, 2) if median_cost > 0 else 1.0

        # Map z-score and cost ratio to a calibrated cost anomaly score (0 - 100)
        if z_score <= 0:
            cost_score = max(5.0, round(20.0 * (cost / mean_cost), 1))
        elif z_score < 1.0:
            cost_score = round(20.0 + (z_score * 20.0), 1)  # 20 - 40
        elif z_score < 2.0:
            cost_score = round(40.0 + ((z_score - 1.0) * 25.0), 1)  # 40 - 65
        elif z_score < 3.0:
            cost_score = round(65.0 + ((z_score - 2.0) * 20.0), 1)  # 65 - 85
        else:
            cost_score = min(100.0, round(85.0 + ((z_score - 3.0) * 5.0), 1))  # 85 - 100

        observations = []
        if ratio_to_avg > 2.0:
            observations.append(f"Work cost (₹{cost:,.2f}) is {ratio_to_avg}x higher than category average (₹{mean_cost:,.2f}).")
        elif ratio_to_avg < 0.3:
            observations.append(f"Work cost (₹{cost:,.2f}) is substantially lower than category average (₹{mean_cost:,.2f}).")
        else:
            observations.append(f"Work cost aligns within normal category distribution (mean: ₹{mean_cost:,.2f}, z-score: {z_score}).")

        return {
            "cost": cost,
            "cost_score": cost_score,
            "peer_sample_size": sample_size,
            "peer_avg_cost": round(mean_cost, 2),
            "peer_median_cost": round(median_cost, 2),
            "peer_std_cost": round(std_dev, 2),
            "z_score": z_score,
            "ratio_to_average": ratio_to_avg,
            "ratio_to_median": ratio_to_median,
            "observations": observations,
            "engine_mode": "preliminary_statistical_baseline"
        }

    # =========================================================================
    # TOOL 4: get_mp_financials
    # =========================================================================
    @staticmethod
    def get_mp_financials(work: Work, db: Session) -> Dict[str, Any]:
        """
        Tool 4: Retrieve financial performance and fund utilization indicators
        for the MP associated with this work item.
        """
        mp_record = None

        # Lookup by MP name first, then constituency
        if work.mp_name:
            mp_record = db.query(MPFinancialSummary).filter(
                MPFinancialSummary.mp_name.ilike(f"%{work.mp_name.strip()}%")
            ).first()

        if not mp_record and work.constituency:
            mp_record = db.query(MPFinancialSummary).filter(
                MPFinancialSummary.constituency.ilike(f"%{work.constituency.strip()}%")
            ).first()

        if not mp_record:
            return {
                "found": False,
                "utilization_score": 25.0,  # Neutral baseline
                "message": "No specific MP financial summary record found in database for this work.",
                "mp_name": work.mp_name,
                "constituency": work.constituency,
                "engine_mode": "database_lookup"
            }

        allocated = mp_record.allocated_amount or 0.0
        expenditure = mp_record.total_expenditure or 0.0
        util_pct = mp_record.utilization_percentage
        payment_gap = mp_record.payment_gap_percentage or 0.0
        completion_rate = mp_record.completion_rate or 0.0
        unspent = mp_record.unspent_amount or 0.0

        # Calculate utilization risk score (0 - 100)
        util_score = 15.0  # Base
        if util_pct is not None:
            if util_pct < 30.0:
                util_score += 35.0
            elif util_pct < 60.0:
                util_score += 20.0
            elif util_pct > 110.0:
                util_score += 15.0

        if payment_gap > 20.0:
            util_score += 20.0
        elif payment_gap > 10.0:
            util_score += 10.0

        if completion_rate < 50.0 and mp_record.recommended_works_count and mp_record.recommended_works_count > 5:
            util_score += 15.0

        util_score = min(100.0, util_score)

        return {
            "found": True,
            "mp_name": mp_record.mp_name,
            "constituency": mp_record.constituency,
            "house": mp_record.house,
            "state": mp_record.state,
            "allocated_amount": allocated,
            "total_expenditure": expenditure,
            "utilization_percentage": util_pct,
            "payment_gap_percentage": payment_gap,
            "completion_rate": completion_rate,
            "completed_works_count": mp_record.completed_works_count,
            "recommended_works_count": mp_record.recommended_works_count,
            "unspent_amount": unspent,
            "utilization_score": round(util_score, 1),
            "engine_mode": "database_lookup"
        }

    # =========================================================================
    # TOOL 5: check_duplicate
    # Integration Point: Nitin (Duplicate Detection Module)
    # =========================================================================
    @staticmethod
    def check_duplicate(work: Work, db: Session) -> Dict[str, Any]:
        """
        Tool 5: Evaluate potential project duplication or invoke Nitin's DuplicateDetector.
        """
        # Attempt invocation of teammate duplicate detector first
        dup_result = _try_duplicate_detector(work, db)
        if dup_result is not None:
            return dup_result

        query = db.query(Work).filter(Work.id != work.id)
        if work.constituency:
            candidates = query.filter(Work.constituency == work.constituency).all()
        elif work.district:
            candidates = query.filter(Work.district == work.district).all()
        elif work.state:
            candidates = query.filter(Work.state == work.state).limit(100).all()
        else:
            candidates = query.limit(100).all()

        potential_duplicates = []
        for c in candidates:
            sim = _token_similarity(work.work_description, c.work_description)
            is_cost_identical = (work.cost is not None and c.cost is not None and abs(work.cost - c.cost) < 1.0)

            # High text overlap or (moderate text overlap + identical cost)
            if sim >= 0.70 or (sim >= 0.45 and is_cost_identical):
                dist_km = None
                if (
                    work.latitude is not None and work.longitude is not None
                    and c.latitude is not None and c.longitude is not None
                ):
                    dist_km = _calculate_haversine_distance(work.latitude, work.longitude, c.latitude, c.longitude)

                potential_duplicates.append({
                    "work_id": c.work_id or c.id,
                    "work_description": c.work_description,
                    "cost": c.cost,
                    "similarity_score": sim,
                    "is_cost_identical": is_cost_identical,
                    "distance_km": dist_km,
                    "constituency": c.constituency,
                    "state": c.state
                })

        potential_duplicates.sort(key=lambda x: x["similarity_score"], reverse=True)

        # Calculate duplicate risk score (0 - 100)
        if not potential_duplicates:
            duplicate_score = 10.0  # Base clean
            duplicate_detected = False
            reason = "No potential duplicate or overlapping works identified in constituency/state."
        else:
            top_match = potential_duplicates[0]
            if top_match["similarity_score"] >= 0.85:
                duplicate_score = 85.0
                duplicate_detected = True
                reason = f"High text similarity ({int(top_match['similarity_score']*100)}%) with work ID {top_match['work_id']}."
            elif top_match["similarity_score"] >= 0.70 or top_match["is_cost_identical"]:
                duplicate_score = 65.0
                duplicate_detected = True
                reason = f"Moderate similarity ({int(top_match['similarity_score']*100)}%) and potential overlap with work ID {top_match['work_id']}."
            else:
                duplicate_score = 40.0
                duplicate_detected = False
                reason = f"Minor overlapping tokens with work ID {top_match['work_id']}."

        return {
            "duplicate_score": duplicate_score,
            "duplicate_detected": duplicate_detected,
            "reason": reason,
            "potential_duplicates": potential_duplicates[:3],
            "engine_mode": "preliminary_similarity_baseline"
        }

    # =========================================================================
    # TOOL 6: check_data_quality
    # Integration Point: Nitin (Data Quality & Verification Module)
    # =========================================================================
    @staticmethod
    def check_data_quality(work: Work, db: Session) -> Dict[str, Any]:
        """
        Tool 6: Assess completeness and verification readiness of record metadata.
        Missing data constitutes a data quality & audit verification risk, NOT evidence of fraud.
        """
        missing_fields = []
        checks = {
            "description": bool(work.work_description and len(work.work_description.strip()) > 3),
            "cost": bool(work.cost is not None and work.cost > 0),
            "completion_date": bool(work.completion_date is not None or work.completion_year is not None),
            "implementing_agency": bool(work.implementing_agency and len(work.implementing_agency.strip()) > 1),
            "gps_coordinates": bool(work.latitude is not None and work.longitude is not None),
            "category": bool(work.category and len(work.category.strip()) > 1),
            "location_details": bool(work.location and len(work.location.strip()) > 2),
            "photos_or_evidence": bool(work.photos_metadata is not None),
            "impact_metrics": bool(work.impact_metrics is not None)
        }

        total_checks = len(checks)
        passed_checks = sum(1 for v in checks.values() if v)
        completeness_pct = round((passed_checks / total_checks) * 100.0, 1)

        for k, v in checks.items():
            if not v:
                missing_fields.append(k)

        penalty_score = 0.0
        if not checks["cost"]:
            penalty_score += 30.0
        if not checks["gps_coordinates"]:
            penalty_score += 25.0
        if not checks["implementing_agency"]:
            penalty_score += 20.0
        if not checks["completion_date"]:
            penalty_score += 15.0
        if not checks["photos_or_evidence"]:
            penalty_score += 10.0

        penalty_score = min(100.0, penalty_score)

        return {
            "data_quality_score": round(penalty_score, 1),
            "completeness_percentage": completeness_pct,
            "passed_checks": passed_checks,
            "total_checks": total_checks,
            "missing_fields": missing_fields,
            "checks_detail": checks,
            "audit_guidance": "Missing administrative information indicates a verification and record-keeping gap requiring documentation review, not evidence of fraud.",
            "engine_mode": "data_quality_auditor"
        }

    # =========================================================================
    # TOOL 7: get_geographic_context
    # Integration Point: Nitin (Geographic & Location Context Module)
    # =========================================================================
    @staticmethod
    def get_geographic_context(work: Work, db: Session) -> Dict[str, Any]:
        """
        Tool 7: Analyze geographic location and spatial context.
        Uses GPS only when real coordinates exist; never fabricates locations.
        """
        has_coords = work.latitude is not None and work.longitude is not None

        if not has_coords:
            return {
                "coordinates_available": False,
                "geographic_score": 30.0,  # Unverified location baseline
                "message": "GPS coordinates unavailable in administrative source records.",
                "state": work.state,
                "district": work.district,
                "constituency": work.constituency,
                "location": work.location,
                "engine_mode": "geographic_validator"
            }

        lat, lon = work.latitude, work.longitude

        # Validate geographic bounding box for India (Lat ~6.0N - 37.5N, Lon ~68.0E - 97.5E)
        is_valid_india_bound = (6.0 <= lat <= 38.0 and 68.0 <= lon <= 98.0)

        # Count nearby works with coordinates in the same constituency
        nearby_count = 0
        if work.constituency:
            nearby_count = db.query(Work).filter(
                Work.id != work.id,
                Work.constituency == work.constituency,
                Work.latitude.isnot(None),
                Work.longitude.isnot(None)
            ).count()

        geo_score = 15.0 if is_valid_india_bound else 70.0

        return {
            "coordinates_available": True,
            "latitude": lat,
            "longitude": lon,
            "is_valid_geographic_bound": is_valid_india_bound,
            "geographic_score": geo_score,
            "state": work.state,
            "district": work.district,
            "constituency": work.constituency,
            "location": work.location,
            "nearby_geotagged_works_count": nearby_count,
            "engine_mode": "geographic_validator"
        }

    # =========================================================================
    # TOOL 8: get_risk_breakdown
    # Integration Point: Jayant (Risk Engine Module)
    # =========================================================================
    @staticmethod
    def get_risk_breakdown(work: Work, db: Session, signals: Dict[str, float]) -> Dict[str, Any]:
        """
        Tool 8: Calculate composite weighted risk score via Jayant's RiskEngine
        or execute PRD-weighted fallback schema.
        PRD Weights:
          - ML Anomaly:       25% (0.25)
          - Cost:             25% (0.25)
          - Duplicate:        20% (0.20)
          - Utilization:      15% (0.15)
          - Geographic:       10% (0.10)
          - Data Quality:      5% (0.05)

        PRD Risk Bands:
          - 0 - 30:   LOW
          - 31 - 60:  MEDIUM
          - 61 - 80:  HIGH
          - 81 - 100: CRITICAL
        """
        # Attempt invocation of teammate risk engine first
        engine_result = _try_risk_engine(work, db, signals)
        if engine_result is not None:
            return engine_result

        weights = {
            "ml_anomaly_score": 0.25,
            "cost_score": 0.25,
            "duplicate_score": 0.20,
            "utilization_score": 0.15,
            "geographic_score": 0.10,
            "data_quality_score": 0.05
        }

        # Calculate weighted composite score
        overall_score = sum(signals.get(k, 20.0) * w for k, w in weights.items())
        overall_score = round(max(0.0, min(100.0, overall_score)), 1)

        # Map to PRD Risk Bands
        if overall_score <= 30.0:
            risk_level = "LOW"
        elif overall_score <= 60.0:
            risk_level = "MEDIUM"
        elif overall_score <= 80.0:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        # Identify contributing signals
        contributing_signals = {}
        for signal_name, weight in weights.items():
            score = signals.get(signal_name, 0.0)
            contributing_signals[signal_name] = {
                "score": score,
                "weight": weight,
                "weighted_points": round(score * weight, 2)
            }

        return {
            "overall_score": overall_score,
            "risk_level": risk_level,
            "weights": weights,
            "contributing_signals": contributing_signals,
            "engine_mode": "preliminary_prd_weighted_fallback"
        }
