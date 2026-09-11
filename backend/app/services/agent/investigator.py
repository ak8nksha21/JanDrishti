"""
JanDrishti - Deterministic AI Investigator
Orchestrates explainable, tool-calling investigation without fabricating numbers or declaring fraud.
"""
from typing import Dict, Any, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.services.agent.tools import InvestigationTools
from app.schemas.agent import InvestigationResult, ToolInvocation


class AIAgentInvestigator:
    def __init__(self, db: Session):
        self.db = db
        self.tools = InvestigationTools(db)

    def investigate(self, work_id: str) -> InvestigationResult:
        """
        Orchestrates an explainable investigation on a target work by calling
        deterministic analytical tools and structuring evidence-backed findings.
        """
        tools_called: List[ToolInvocation] = []

        # 1. get_work_details
        work_details = self.tools.get_work_details(work_id)
        tools_called.append(ToolInvocation(tool="get_work_details", arguments={"work_id": work_id}, output=work_details))

        if "error" in work_details:
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

        # 2. get_risk_breakdown
        risk_breakdown = self.tools.get_risk_breakdown(work_id)
        tools_called.append(ToolInvocation(tool="get_risk_breakdown", arguments={"work_id": work_id}, output=risk_breakdown))

        # 3. get_cost_analysis
        cost_analysis = self.tools.get_cost_analysis(work_id)
        tools_called.append(ToolInvocation(tool="get_cost_analysis", arguments={"work_id": work_id}, output=cost_analysis))

        # 4. get_mp_financials
        mp_financials = self.tools.get_mp_financials(work_details.get("constituency", ""))
        tools_called.append(ToolInvocation(tool="get_mp_financials", arguments={"constituency": work_details.get("constituency")}, output=mp_financials))

        # 5. check_duplicate
        duplicate_check = self.tools.check_duplicate(work_id)
        tools_called.append(ToolInvocation(tool="check_duplicate", arguments={"work_id": work_id}, output=duplicate_check))

        # 6. check_data_quality
        data_quality = self.tools.check_data_quality(work_id)
        tools_called.append(ToolInvocation(tool="check_data_quality", arguments={"work_id": work_id}, output=data_quality))

        # 7. get_geographic_context
        geo_context = self.tools.get_geographic_context(work_id)
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

        supporting_evidence = {
            "work_id": work_id,
            "cost_details": cost_analysis,
            "risk_components": components,
            "mp_financials": mp_financials,
            "geographic_context": geo_context,
            "data_quality": data_quality
        }

        canonical_id = work_details.get("work_id", work_id)
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
