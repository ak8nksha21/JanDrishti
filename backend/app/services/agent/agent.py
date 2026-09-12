import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.work import Work
from app.services.agent.tools import InvestigationTools
from app.schemas.investigation import (
    InvestigationResponse,
    SignalBreakdown,
    EvidenceItem,
)

logger = logging.getLogger("jandrishti.agent.service")


class InvestigationAgent:
    """
    JanDrishti AI Investigation Agent.

    Orchestrates evidence gathering across 8 structured investigation tools,
    synthesizes multi-signal findings into objective risk explanations,
    and generates actionable verification checklists for inspection officers.

    Language Policy:
    Strictly decision-support oriented. Never claims 'fraud detected'.
    Uses objective, evidence-driven phrasing ('Potential irregularity requiring verification',
    'Manual verification recommended').
    """

    def __init__(self, db: Session):
        self.db = db
        self.tools = InvestigationTools()

    def investigate(self, work: Work) -> InvestigationResponse:
        """
        Execute full investigation on a work record and return synthesized response.
        """
        logger.info(f"Starting deterministic investigation for work_id={work.work_id or work.id}")

        # =====================================================================
        # Step 1: Execute Investigation Tools
        # =====================================================================
        work_details = self.tools.get_work_details(work, self.db)
        cost_res = self.tools.get_cost_analysis(work, self.db)
        similar_res = self.tools.get_similar_works(work, self.db)
        dup_res = self.tools.check_duplicate(work, self.db)
        mp_res = self.tools.get_mp_financials(work, self.db)
        quality_res = self.tools.check_data_quality(work, self.db)
        geo_res = self.tools.get_geographic_context(work, self.db)

        # =====================================================================
        # Step 2: Extract Calibrated Signal Scores
        # =====================================================================
        cost_score = cost_res.get("cost_score", 20.0)
        # ML anomaly score: consume from active ML detector if provided, otherwise compute calibrated fallback
        ml_anomaly_score = cost_res.get("ml_anomaly_score")
        if ml_anomaly_score is None:
            ml_anomaly_score = round(min(100.0, max(5.0, cost_score * 0.95 + (10.0 if not quality_res.get("checks_detail", {}).get("cost") else 0.0))), 1)
        duplicate_score = dup_res.get("duplicate_score", 10.0)
        utilization_score = mp_res.get("utilization_score", 20.0)
        geographic_score = geo_res.get("geographic_score")
        data_quality_score = quality_res.get("data_quality_score", 0.0)

        signals = {
            "ml_anomaly_score": ml_anomaly_score,
            "cost_score": cost_score,
            "duplicate_score": duplicate_score,
            "utilization_score": utilization_score,
            "geographic_score": geographic_score,
            "data_quality_score": data_quality_score
        }

        # =====================================================================
        # Step 3: Compute Composite Risk Breakdown (PRD Weights & Bands)
        # =====================================================================
        risk_breakdown = self.tools.get_risk_breakdown(work, self.db, signals)
        overall_score = risk_breakdown["overall_score"]
        risk_level = risk_breakdown["risk_level"]

        # =====================================================================
        # Step 4: Synthesize Structured Evidence Items
        # =====================================================================
        evidence: List[EvidenceItem] = []

        # 1. Cost Evidence
        if cost_res.get("cost") is not None:
            peer_avg = cost_res.get("peer_avg_cost")
            peer_avg_str = f"₹{peer_avg:,.2f}" if peer_avg is not None else "peer baseline"
            ratio = cost_res.get("ratio_to_average", 1.0)
            z_score = cost_res.get("z_score", 0.0)
            if ratio > 1.5:
                cost_sev = "critical" if ratio > 3.0 else ("high" if ratio > 2.0 else "medium")
                evidence.append(EvidenceItem(
                    category="cost",
                    title="Elevated Work Expenditure",
                    detail=f"Work expenditure of ₹{work.cost:,.2f} is {ratio}x higher than category benchmark average of {peer_avg_str} (z-score: {z_score}).",
                    severity=cost_sev,
                    data=cost_res
                ))
            else:
                evidence.append(EvidenceItem(
                    category="cost",
                    title="Normal Cost Distribution",
                    detail=f"Work cost of ₹{work.cost:,.2f} falls within expected range for category '{work.category or 'General'}' (benchmark: {peer_avg_str}).",
                    severity="info",
                    data=cost_res
                ))

        # 2. Duplicate / Overlap Evidence
        if dup_res.get("duplicate_detected"):
            potential_dups = dup_res.get("potential_duplicates") or []
            top_dup = potential_dups[0] if potential_dups else {}
            dup_id_str = f"Work ID {top_dup.get('work_id')}" if top_dup.get("work_id") else "a neighboring project"
            sim_score = top_dup.get("similarity_score", 0.75)
            evidence.append(EvidenceItem(
                category="duplicate",
                title="Potential Work Overlap Detected",
                detail=f"Identified significant text/cost overlap with {dup_id_str} in {work.constituency or 'the region'} (similarity: {int(sim_score*100)}%).",
                severity="high" if sim_score >= 0.85 else "medium",
                data=dup_res
            ))

        # 3. MP Utilization Evidence
        if mp_res.get("found"):
            util_pct = mp_res.get("utilization_percentage")
            payment_gap = mp_res.get("payment_gap_percentage", 0.0)
            if util_pct is not None and util_pct < 40.0:
                evidence.append(EvidenceItem(
                    category="utilization",
                    title="Subdued Constituency Utilization",
                    detail=f"MP fund utilization in {work.constituency or work.mp_name} is recorded at {util_pct:.1f}% with ₹{mp_res.get('unspent_amount', 0):,.2f} unspent.",
                    severity="medium",
                    data=mp_res
                ))
            elif payment_gap > 15.0:
                evidence.append(EvidenceItem(
                    category="utilization",
                    title="Noted Payment-to-Completion Gap",
                    detail=f"Constituency exhibits a {payment_gap:.1f}% gap between sanctioned expenditure and completed works valuation.",
                    severity="medium",
                    data=mp_res
                ))

        # 4. Data Quality Evidence
        missing = quality_res.get("missing_fields", [])
        if missing:
            evidence.append(EvidenceItem(
                category="data_quality",
                title="Administrative Record Gaps",
                detail=f"Missing metadata fields identified: {', '.join(missing[:4])}. Record completeness is at {quality_res.get('completeness_percentage')}%.",
                severity="medium" if len(missing) >= 3 else "low",
                data=quality_res
            ))

        # 5. Geographic Evidence
        if not geo_res.get("coordinates_available"):
            evidence.append(EvidenceItem(
                category="geographic",
                title="Unverified Geotagging",
                detail="No GPS coordinates are recorded for this project in the administrative source records.",
                severity="low",
                data=geo_res
            ))
        elif not geo_res.get("is_valid_geographic_bound"):
            evidence.append(EvidenceItem(
                category="geographic",
                title="Coordinate Out-of-Bounds",
                detail=f"Recorded GPS coordinates ({geo_res.get('latitude')}, {geo_res.get('longitude')}) fall outside expected territorial boundaries.",
                severity="high",
                data=geo_res
            ))

        # =====================================================================
        # Step 5: Formulate Primary Reasons
        # =====================================================================
        primary_reasons: List[str] = []
        if cost_score >= 60.0:
            primary_reasons.append("Cost is unusually elevated compared to comparable works in the same category.")
        if duplicate_score >= 60.0:
            primary_reasons.append("Identified potential scope or description overlap with another work in the area.")
        if utilization_score >= 50.0:
            primary_reasons.append("Constituency demonstrates notable fund utilization or payment gap variances.")
        if data_quality_score >= 40.0:
            primary_reasons.append("Administrative documentation exhibits data completeness gaps (e.g. missing GPS or agency records).")
        if not primary_reasons:
            primary_reasons.append("Project indicators align with standard historical execution baselines.")

        # =====================================================================
        # Step 6: Formulate Actionable Recommended Actions for Officers
        # =====================================================================
        recommended_actions: List[str] = []
        if cost_score >= 50.0:
            recommended_actions.append("Verify project cost against approved Schedule of Rates (SoR) and contractor billing records.")
        if duplicate_score >= 50.0:
            recommended_actions.append("Conduct cross-site verification to ensure this project represents distinct physical assets from overlapping sanctions.")
        if not quality_res.get("checks_detail", {}).get("gps_coordinates"):
            recommended_actions.append("Instruct implementing agency to record on-site geotagged photographs and GPS coordinates on eSAKSHI.")
        if not quality_res.get("checks_detail", {}).get("implementing_agency"):
            recommended_actions.append("Confirm executing agency details and procurement tender allocation.")
        if not quality_res.get("checks_detail", {}).get("photos_or_evidence"):
            recommended_actions.append("Request physical completion certificate and photographic evidence of asset handover.")
        if not recommended_actions:
            recommended_actions.append("Perform routine periodic monitoring as per standard administrative guidelines.")

        # =====================================================================
        # Step 7: Formulate Safe Summary
        # =====================================================================
        normalized_risk = str(risk_level).upper() if risk_level else "LOW"
        if normalized_risk in ["CRITICAL", "HIGH"]:
            summary = "Potential irregularity requiring verification. Elevated risk indicators identified across cost and administrative patterns."
        elif normalized_risk == "MEDIUM":
            summary = "Manual verification recommended. Moderate statistical variations observed requiring routine field review."
        else:
            summary = "Standard parameters observed. Work metrics align with expected statistical baselines."

        # Assemble Tool Results
        tool_results = {
            "work_details": work_details,
            "cost_analysis": cost_res,
            "similar_works": similar_res,
            "duplicate_check": dup_res,
            "mp_financials": mp_res,
            "data_quality": quality_res,
            "geographic_context": geo_res,
            "risk_breakdown": risk_breakdown
        }

        return InvestigationResponse(
            work_id=work.work_id or work.id,
            work_description=work.work_description,
            mp_name=work.mp_name,
            constituency=work.constituency,
            state=work.state,
            category=work.category,
            cost=work.cost,
            risk_level=risk_level,
            overall_score=overall_score,
            summary=summary,
            primary_reasons=primary_reasons,
            signal_breakdown=SignalBreakdown(
                ml_anomaly_score=signals["ml_anomaly_score"],
                cost_score=signals["cost_score"],
                duplicate_score=signals["duplicate_score"],
                utilization_score=signals["utilization_score"],
                geographic_score=signals["geographic_score"],
                data_quality_score=signals["data_quality_score"]
            ),
            evidence=evidence,
            recommended_actions=recommended_actions,
            tool_results=tool_results,
            investigated_at=datetime.now(timezone.utc)
        )
