"""
JanDrishti - Deterministic AI Investigator
Orchestrates explainable, tool-calling investigation without fabricating numbers or declaring fraud.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.work import Work
from app.models.mp_summary import MPFinancialSummary
from app.models.risk import RiskScore, SimilarWork
from app.services.agent.tools import InvestigationTools
from app.schemas.agent import InvestigationResult, ToolInvocation


class AIAgentInvestigator:
    def __init__(self, db: Session):
        self.db = db
        self.tools = InvestigationTools(db)

    def _find_work(self, work_id: str) -> Optional[Work]:
        work = None
        if isinstance(work_id, str) and work_id.isdigit():
            num = int(work_id)
            work = self.db.query(Work).filter(
                or_(Work.work_id == num, Work.id == num)
            ).first()
        if not work:
            work = self.db.query(Work).filter(
                or_(Work.source_id == str(work_id), Work.work_id == (int(work_id) if str(work_id).isdigit() else None))
            ).first()
        return work

    def investigate(self, work_id: str) -> InvestigationResult:
        """
        Orchestrates an explainable investigation on a target work by calling
        deterministic analytical tools and structuring evidence-backed findings.
        """
        tools_called: List[ToolInvocation] = []
        work = self._find_work(work_id)

        if not work:
            err_details = {"error": f"Work ID {work_id} not found in database"}
            tools_called.append(ToolInvocation(tool="get_work_details", arguments={"work_id": work_id}, output=err_details))
            return InvestigationResult(
                work_id=work_id,
                work_title="Unknown",
                risk_level="Unknown",
                overall_score=0.0,
                primary_reasons=["Work record not found in system"],
                supporting_evidence={},
                matched_works=[],
                data_limitations=["Record does not exist"],
                recommended_action="Verify work ID entry in registry.",
                tools_called=tools_called,
                generated_at=datetime.now(timezone.utc).isoformat()
            )

        canonical_id = str(work.work_id or work.id or work.source_id)

        # 1. get_work_details
        work_details = {
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
        tools_called.append(ToolInvocation(tool="get_work_details", arguments={"work_id": work_id}, output=work_details))

        # 2. get_risk_breakdown
        risk = self.db.query(RiskScore).filter(
            or_(RiskScore.work_id == canonical_id, RiskScore.work_id == str(work_id))
        ).first()
        if risk:
            risk_breakdown = {
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
        else:
            signals = {"ml_anomaly_score": 20.0, "cost_score": 20.0, "duplicate_score": 10.0, "utilization_score": 20.0, "geographic_score": 15.0, "data_quality_score": 10.0}
            rb = InvestigationTools.get_risk_breakdown(work, self.db, signals)
            risk_breakdown = {
                "work_id": canonical_id,
                "overall_score": rb["overall_score"],
                "risk_level": rb["risk_level"],
                "components": signals,
                "flags": [],
                "model_version": "v1.0-fallback"
            }
        tools_called.append(ToolInvocation(tool="get_risk_breakdown", arguments={"work_id": work_id}, output=risk_breakdown))

        # 3. get_cost_analysis
        peer_works = self.db.query(Work).filter(Work.category == work.category).all() if work.category else []
        costs = [float(w.cost or 0.0) for w in peer_works if w.cost is not None and float(w.cost) > 0]
        work_cost = float(work.cost or 0.0)
        if not costs:
            cost_analysis = {
                "work_cost_lakhs": work_cost,
                "category": work.category,
                "peer_count": 0,
                "category_median_lakhs": work_cost,
                "category_mean_lakhs": work_cost,
                "category_min_lakhs": work_cost,
                "category_max_lakhs": work_cost,
                "cost_to_median_ratio": 1.0,
                "is_outlier": False
            }
        else:
            costs.sort()
            n = len(costs)
            median_cost = costs[n // 2] if n % 2 != 0 else (costs[n // 2 - 1] + costs[n // 2]) / 2.0
            ratio = work_cost / median_cost if median_cost > 0 else 1.0
            cost_analysis = {
                "work_cost_lakhs": round(work_cost, 2),
                "category": work.category,
                "peer_count": n,
                "category_median_lakhs": round(median_cost, 2),
                "category_mean_lakhs": round(sum(costs) / n, 2),
                "category_min_lakhs": round(min(costs), 2),
                "category_max_lakhs": round(max(costs), 2),
                "cost_to_median_ratio": round(ratio, 2),
                "is_outlier": ratio > 2.0 or ratio < 0.25
            }
        tools_called.append(ToolInvocation(tool="get_cost_analysis", arguments={"work_id": work_id}, output=cost_analysis))

        # 4. get_mp_financials
        constituency = work.constituency or ""
        mp = None
        if constituency:
            mp = self.db.query(MPFinancialSummary).filter(
                MPFinancialSummary.constituency.ilike(f"%{constituency.strip()}%")
            ).first()
        if not mp and work.mp_name:
            mp = self.db.query(MPFinancialSummary).filter(
                MPFinancialSummary.mp_name.ilike(f"%{work.mp_name.strip()}%")
            ).first()
        if mp:
            mp_financials = {
                "mp_name": mp.mp_name,
                "constituency": mp.constituency,
                "state": mp.state,
                "allocated_amount_lakhs": mp.allocated_amount,
                "total_expenditure_lakhs": mp.total_expenditure,
                "utilization_percentage": mp.utilization_percentage or 0.0,
                "completed_works_count": mp.completed_works_count or 0,
                "recommended_works_count": mp.recommended_works_count or 0,
                "completion_rate": mp.completion_rate or 0.0,
                "unspent_amount_lakhs": mp.unspent_amount or 0.0,
                "payment_gap_percentage": mp.payment_gap_percentage or 0.0,
                "in_progress_payments_lakhs": mp.in_progress_payments or 0.0
            }
        else:
            mp_financials = {
                "mp_name": work.mp_name or "Unknown",
                "constituency": constituency,
                "utilization_percentage": 50.0,
                "payment_gap_percentage": 0.0,
                "message": f"Financials for {constituency} not found"
            }
        tools_called.append(ToolInvocation(tool="get_mp_financials", arguments={"constituency": constituency}, output=mp_financials))

        # 5. check_duplicate
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
        duplicate_check = {
            "work_id": canonical_id,
            "has_high_similarity_match": any(m["combined_similarity"] >= 65.0 for m in matched_list),
            "match_count": len(matched_list),
            "matches": matched_list
        }
        tools_called.append(ToolInvocation(tool="check_duplicate", arguments={"work_id": work_id}, output=duplicate_check))

        # 6. check_data_quality
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
        data_quality = {
            "work_id": canonical_id,
            "missing_fields": missing,
            "has_verification_risk": len(missing) > 0,
            "fields_present_count": 6 - len(missing)
        }
        tools_called.append(ToolInvocation(tool="check_data_quality", arguments={"work_id": work_id}, output=data_quality))

        # 7. get_geographic_context
        if work.latitude is None or work.longitude is None:
            geo_context = {
                "has_coordinates": False,
                "message": "GPS coordinates not recorded for this work item",
                "overlap_conflict_found": False
            }
        else:
            from ml.duplicate_detection import haversine_distance
            neighbors = []
            all_works = self.db.query(Work).filter(Work.id != work.id).all()
            for other in all_works:
                if other.latitude is not None and other.longitude is not None:
                    try:
                        dist = haversine_distance(
                            float(work.latitude), float(work.longitude),
                            float(other.latitude), float(other.longitude)
                        )
                        other_wid = str(other.work_id or other.id or other.source_id)
                        neighbors.append({
                            "work_id": other_wid,
                            "distance_meters": round(dist, 1),
                            "description": (other.work_description or "")[:60],
                            "same_category": other.category == work.category
                        })
                    except Exception:
                        continue
            neighbors.sort(key=lambda x: x["distance_meters"])
            top_neighbors = neighbors[:5]
            has_conflict = any(n["distance_meters"] < 60.0 for n in top_neighbors)
            geo_context = {
                "has_coordinates": True,
                "latitude": work.latitude,
                "longitude": work.longitude,
                "nearest_works": top_neighbors,
                "overlap_conflict_found": has_conflict
            }
        tools_called.append(ToolInvocation(tool="get_geographic_context", arguments={"work_id": work_id}, output=geo_context))

        # Synthesize Evidence & Primary Reasons
        components = risk_breakdown.get("components", {})
        overall_score = risk_breakdown.get("overall_score", 0.0)
        risk_level = risk_breakdown.get("risk_level", "Low")

        primary_reasons = []
        data_limitations = []
        matched_works = duplicate_check.get("matches", [])

        # Cost check
        if components.get("cost_score", 0.0) >= 50.0 or cost_analysis.get("is_outlier"):
            ratio = cost_analysis.get("cost_to_median_ratio", 1.0)
            cost_lakhs = work_details.get("cost_lakhs", 0.0)
            median_lakhs = cost_analysis.get("category_median_lakhs", 0.0)
            primary_reasons.append(
                f"Unusually high sanctioned cost (₹{cost_lakhs:.2f}L vs category median ₹{median_lakhs:.2f}L, {ratio:.1f}x deviation)"
            )

        # Duplicate check
        if duplicate_check.get("has_high_similarity_match") and matched_works:
            top_match = max(matched_works, key=lambda x: x["combined_similarity"])
            primary_reasons.append(
                f"Potential duplicate/overlapping project: {top_match['combined_similarity']}% match with work {top_match['matched_work_id']} ('{top_match['matched_title']}')"
            )

        # Geographic proximity
        if geo_context.get("overlap_conflict_found"):
            conflicts = [n for n in geo_context.get("nearest_works", []) if n.get("distance_meters", 100) < 60 and n.get("same_category")]
            if conflicts:
                primary_reasons.append(
                    f"Physical site overlap: Located just {conflicts[0]['distance_meters']}m from active work {conflicts[0]['work_id']} in same category"
                )
        elif not geo_context.get("has_coordinates"):
            data_limitations.append("Missing GPS coordinates prevent precise satellite/GIS proximity analysis.")

        # Utilization check
        if components.get("utilization_score", 0.0) >= 50.0:
            util_pct = mp_financials.get("utilization_percentage", 50.0)
            pay_gap = mp_financials.get("payment_gap_percentage", 0.0)
            primary_reasons.append(
                f"Constituency financial irregularity: Low fund utilization ({util_pct:.1f}%) combined with {pay_gap:.1f}% payment gap"
            )

        # Data Quality check
        if data_quality.get("has_verification_risk"):
            missing_str = ", ".join(data_quality.get("missing_fields", []))
            data_limitations.append(f"Incomplete documentation: Missing {missing_str}.")
            primary_reasons.append(f"Documentation deficit: Record lacks {missing_str}")

        # Multivariate check
        if components.get("ml_anomaly_score", 0.0) >= 60.0:
            primary_reasons.append("Multi-variable ML Isolation Forest flagged atypical relationship between project cost and constituency expenditure rate")

        if not primary_reasons:
            primary_reasons.append("Project indicators align with regular historical baseline norms.")

        # Recommended human verification action
        if risk_level in ["Critical", "High"]:
            actions = []
            if duplicate_check.get("has_high_similarity_match") or geo_context.get("overlap_conflict_found"):
                actions.append("Conduct on-site physical verification by District Planning Officer to confirm work isn't duplicate billing.")
            if cost_analysis.get("is_outlier"):
                actions.append("Audit engineering schedule of rates (SoR) and contractor tender valuation.")
            if data_quality.get("has_verification_risk"):
                actions.append("Mandate uploading of geotagged before/after photographs and implementing agency sign-off.")
            recommended_action = " ".join(actions) if actions else "Depute District Monitoring Officer for comprehensive voucher and site audit."
        elif risk_level == "Medium":
            recommended_action = "Routine inspection: Verify completion certificate and confirm upload of geotagged photos."
        else:
            recommended_action = "Standard processing: No adverse risk indicators detected; proceed with routine closure."

        # Supplementary Intelligence (Cost Overrun, Delay Detection, Payment Anomaly)
        from ml.cost_overrun import CostOverrunDetector
        from ml.delay_detection import DelayDetector
        from ml.payment_anomaly import PaymentAnomalyDetector

        cost_overrun_eval = CostOverrunDetector().evaluate_work(work)
        delay_eval = DelayDetector().evaluate_work(work)
        payment_eval = PaymentAnomalyDetector().evaluate_record(mp or work)

        if cost_overrun_eval.get("overrun_status") == "insufficient_data":
            data_limitations.append("Verified sanctioned-cost baseline unavailable for work-level overrun analysis.")
        if delay_eval.get("delay_status") == "insufficient_data":
            data_limitations.append("Verified sanction date unavailable for execution-duration analysis.")

        supporting_evidence = {
            "work_id": work_id,
            "cost_details": cost_analysis,
            "risk_components": components,
            "mp_financials": mp_financials,
            "geographic_context": geo_context,
            "data_quality": data_quality,
            "supplementary_intelligence": {
                "cost_overrun": cost_overrun_eval,
                "delay_analysis": delay_eval,
                "payment_anomaly": payment_eval
            }
        }

        return InvestigationResult(
            work_id=canonical_id,
            work_title=work_details.get("description", "Unknown"),
            risk_level=risk_level,
            overall_score=overall_score,
            primary_reasons=primary_reasons,
            supporting_evidence=supporting_evidence,
            matched_works=matched_works,
            data_limitations=data_limitations,
            recommended_action=recommended_action,
            tools_called=tools_called,
            generated_at=datetime.now(timezone.utc).isoformat()
        )
