"""
JanDrishti - Deterministic Investigation Tools
Queries real database models to produce evidence-backed metrics without hallucination.
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.work import Work
from app.models.mp_summary import MPFinancialSummary
from app.models.risk import RiskScore, SimilarWork, Alert
from ml.duplicate_detection import haversine_distance


class InvestigationTools:
    def __init__(self, db: Session):
        self.db = db

    def _find_work(self, work_id: str) -> Optional[Work]:
        work = None
        if work_id.isdigit():
            num = int(work_id)
            work = self.db.query(Work).filter(
                or_(Work.work_id == num, Work.id == num)
            ).first()
        if not work:
            work = self.db.query(Work).filter(
                or_(Work.source_id == work_id, Work.work_id == work_id)
            ).first()
        return work

    def get_work_details(self, work_id: str) -> Dict[str, Any]:
        """Fetch complete source metadata and current status for a work."""
        work = self._find_work(work_id)
        if not work:
            return {"error": f"Work ID {work_id} not found in database"}

        canonical_id = str(work.work_id or work.id or work.source_id)
        return {
            "work_id": canonical_id,
            "description": work.work_description or "Not Provided",
            "category": work.category or "General",
            "cost_lakhs": round(float(work.cost or 0.0), 2),
            "state": work.state or "Unknown",
            "district": work.district or "Unknown",
            "constituency": work.constituency or "Unknown",
            "mp_name": work.mp_name or "Unknown",
            "location": work.location or "Not Specified",
            "latitude": work.latitude,
            "longitude": work.longitude,
            "completion_date": str(work.completion_date) if work.completion_date else "Completed",
            "agency": work.implementing_agency or "Not Specified",
            "quality_rating": work.quality_rating,
            "source": work.source
        }

    def get_risk_breakdown(self, work_id: str) -> Dict[str, Any]:
        """Retrieve the individual component risk scores and composite rating."""
        work = self._find_work(work_id)
        canonical_id = str(work.work_id or work.id or work.source_id) if work else work_id

        risk = self.db.query(RiskScore).filter(
            or_(RiskScore.work_id == canonical_id, RiskScore.work_id == work_id)
        ).first()

        if not risk:
            return {"error": f"No risk score computed for {work_id}"}

        return {
            "work_id": risk.work_id,
            "overall_score": risk.overall_score,
            "risk_level": risk.risk_level,
            "components": {
                "ml_anomaly_score": risk.ml_anomaly_score,
                "cost_score": risk.cost_score,
                "duplicate_score": risk.duplicate_score,
                "utilization_score": risk.utilization_score,
                "geographic_score": risk.geographic_score,
                "data_quality_score": risk.data_quality_score
            },
            "flags": risk.flags_json or [],
            "model_version": risk.model_version
        }

    def get_cost_analysis(self, work_id: str) -> Dict[str, Any]:
        """Compare work cost against peer category in the database."""
        work = self._find_work(work_id)
        if not work:
            return {"error": "Work not found"}

        peer_works = self.db.query(Work).filter(Work.category == work.category).all()
        costs = [float(w.cost or 0.0) for w in peer_works if w.cost is not None and float(w.cost) > 0]
        work_cost = float(work.cost or 0.0)

        if not costs:
            return {"cost_lakhs": work_cost, "peer_count": 0, "message": "No peers found"}

        costs.sort()
        n = len(costs)
        median_cost = costs[n // 2] if n % 2 != 0 else (costs[n // 2 - 1] + costs[n // 2]) / 2.0
        min_cost = min(costs)
        max_cost = max(costs)
        avg_cost = sum(costs) / n

        ratio = work_cost / median_cost if median_cost > 0 else 1.0

        return {
            "work_cost_lakhs": round(work_cost, 2),
            "category": work.category,
            "peer_count": n,
            "category_median_lakhs": round(median_cost, 2),
            "category_mean_lakhs": round(avg_cost, 2),
            "category_min_lakhs": round(min_cost, 2),
            "category_max_lakhs": round(max_cost, 2),
            "cost_to_median_ratio": round(ratio, 2),
            "is_outlier": ratio > 2.0 or ratio < 0.25
        }

    def get_mp_financials(self, constituency: str) -> Dict[str, Any]:
        """Fetch MP summary and financial utilization ratios."""
        if not constituency:
            return {"error": "Constituency is required"}

        mp = self.db.query(MPFinancialSummary).filter(
            MPFinancialSummary.constituency.ilike(f"%{constituency.strip()}%")
        ).first()

        if not mp:
            mp = self.db.query(MPFinancialSummary).filter(
                MPFinancialSummary.mp_name.ilike(f"%{constituency.strip()}%")
            ).first()

        if not mp:
            return {"error": f"Financials for {constituency} not found"}

        return {
            "mp_name": mp.mp_name,
            "constituency": mp.constituency,
            "state": mp.state,
            "allocated_amount_lakhs": mp.allocated_amount,
            "total_expenditure_lakhs": mp.total_expenditure,
            "utilization_percentage": mp.utilization_percentage,
            "completed_works_count": mp.completed_works_count,
            "recommended_works_count": mp.recommended_works_count,
            "completion_rate": mp.completion_rate,
            "unspent_amount_lakhs": mp.unspent_amount,
            "payment_gap_percentage": mp.payment_gap_percentage,
            "in_progress_payments_lakhs": mp.in_progress_payments
        }

    def check_duplicate(self, work_id: str) -> Dict[str, Any]:
        """Check duplicate and text/cost similarity matches."""
        work = self._find_work(work_id)
        canonical_id = str(work.work_id or work.id or work.source_id) if work else work_id

        matches = self.db.query(SimilarWork).filter(
            or_(SimilarWork.work_id == canonical_id, SimilarWork.matched_work_id == canonical_id)
        ).all()

        matched_list = []
        for m in matches:
            other_id = m.matched_work_id if m.work_id == canonical_id else m.work_id
            other_work = self._find_work(other_id)
            matched_list.append({
                "matched_work_id": other_id,
                "matched_title": (other_work.work_description if other_work else "Unknown")[:80],
                "matched_cost_lakhs": round(float(other_work.cost or 0.0), 2) if other_work else 0.0,
                "matched_category": other_work.category if other_work else "",
                "matched_location": other_work.location if other_work else "",
                "text_similarity": round(m.text_similarity * 100, 1),
                "cost_similarity": round(m.cost_similarity * 100, 1),
                "geographic_similarity": round(m.geographic_similarity * 100, 1),
                "combined_similarity": round(m.combined_similarity * 100, 1)
            })

        return {
            "work_id": canonical_id,
            "has_high_similarity_match": any(m["combined_similarity"] >= 65.0 for m in matched_list),
            "match_count": len(matched_list),
            "matches": matched_list
        }

    def get_geographic_context(self, work_id: str) -> Dict[str, Any]:
        """Analyze spatial proximity to neighboring works."""
        work = self._find_work(work_id)
        if not work:
            return {"error": "Work not found"}

        if work.latitude is None or work.longitude is None:
            return {
                "has_coordinates": False,
                "message": "GPS coordinates not recorded for this work item",
                "overlap_conflict_found": False
            }

        neighbors = []
        all_works = self.db.query(Work).filter(Work.id != work.id).all()
        for other in all_works:
            if other.latitude is not None and other.longitude is not None:
                try:
                    dist = haversine_distance(
                        float(work.latitude), float(work.longitude),
                        float(other.latitude), float(other.longitude)
                    )
                    other_id = str(other.work_id or other.id or other.source_id)
                    neighbors.append({
                        "work_id": other_id,
                        "distance_meters": round(dist, 1),
                        "description": (other.work_description or "")[:60],
                        "same_category": other.category == work.category
                    })
                except Exception:
                    continue

        neighbors.sort(key=lambda x: x["distance_meters"])
        top_neighbors = neighbors[:5]
        has_conflict = any(n["distance_meters"] < 60.0 for n in top_neighbors)

        return {
            "has_coordinates": True,
            "latitude": work.latitude,
            "longitude": work.longitude,
            "nearest_works": top_neighbors,
            "overlap_conflict_found": has_conflict
        }

    def check_data_quality(self, work_id: str) -> Dict[str, Any]:
        """Audit record completeness."""
        work = self._find_work(work_id)
        if not work:
            return {"error": "Work not found"}

        missing = []
        desc = work.work_description or ""
        if len(desc.strip()) < 10:
            missing.append("meaningful description")
        if work.cost is None or float(work.cost) <= 0.0:
            missing.append("cost/expenditure amount")
        if not work.location and not (work.latitude and work.longitude):
            missing.append("location/coordinates")
        if not work.implementing_agency:
            missing.append("implementing agency")

        return {
            "work_id": str(work.work_id or work.id or work.source_id),
            "missing_fields": missing,
            "has_verification_risk": len(missing) > 0,
            "fields_present_count": 6 - len(missing)
        }
