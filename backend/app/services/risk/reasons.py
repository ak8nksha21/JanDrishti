"""
JanDrishti - Explainable Risk Reasons Generator

Generates transparent, human-readable explanations explaining why a given
risk level and score were assigned, tied directly to contributing signals.

Guiding Principles:
- Strictly objective, evidence-based, and non-accusatory.
- NEVER asserts "fraud", "corruption", "embezzlement", or "guilt".
- Frames findings as statistical anomalies, data inconsistencies,
  or indicators flagged for human review.
"""

from typing import Any, Dict, List, Optional
from app.services.risk.scoring import ScoringResult

# Signal-specific descriptive templates based on severity (0–100 scale)
SIGNAL_DESCRIPTIONS = {
    "cost_anomaly_score": {
        "high": "High cost anomaly indicator ({value:.1f}) indicates expenditure deviates significantly from regional category baseline.",
        "medium": "Moderate cost anomaly indicator ({value:.1f}) detected against baseline category benchmarks.",
        "low": "Cost metrics ({value:.1f}) are consistent with regional category benchmarks.",
    },
    "duplicate_score": {
        "high": "High duplicate similarity score ({value:.1f}) indicates substantial text, location, or parameter overlap with other works.",
        "medium": "Moderate duplicate similarity score ({value:.1f}) warrants verification against similarly titled constituency works.",
        "low": "Work description and location appear distinct from existing catalog entries ({value:.1f}).",
    },
    "geographic_score": {
        "high": "Significant geographic anomaly ({value:.1f}) detected between recorded location coordinates and expected constituency boundary.",
        "medium": "Minor spatial discrepancy ({value:.1f}) identified in geographical location data.",
        "low": "Geographic indicators ({value:.1f}) are consistent with recorded constituency and district boundaries.",
    },
    "utilization_score": {
        "high": "Pronounced financial anomaly ({value:.1f}) identified in allocation, installment, or expenditure pattern.",
        "medium": "Notable financial variation ({value:.1f}) observed in funding allocation pace.",
        "low": "Financial flow and expenditure timing ({value:.1f}) are within normal operating variance.",
    },
    "data_quality_score": {
        "high": "Data quality concern flagged ({value:.1f}): key project metadata fields are incomplete, inconsistent, or unverified.",
        "medium": "Minor data quality notice ({value:.1f}): partial metadata omissions detected in project records.",
        "low": "Recorded project metadata meets baseline data quality standards.",
    },
    "ml_anomaly_score": {
        "high": "Multiple project characteristics show an elevated ML anomaly signal ({value:.1f}).",
        "medium": "Moderate ML anomaly indicator ({value:.1f}) observed across project attributes.",
        "low": "Machine learning anomaly baseline is nominal ({value:.1f}).",
    },
}

# Add legacy signal aliases
SIGNAL_DESCRIPTIONS["cost_anomaly"] = SIGNAL_DESCRIPTIONS["cost_anomaly_score"]
SIGNAL_DESCRIPTIONS["duplicate_similarity"] = SIGNAL_DESCRIPTIONS["duplicate_score"]
SIGNAL_DESCRIPTIONS["geographic_anomaly"] = SIGNAL_DESCRIPTIONS["geographic_score"]
SIGNAL_DESCRIPTIONS["financial_anomaly"] = SIGNAL_DESCRIPTIONS["utilization_score"]
SIGNAL_DESCRIPTIONS["data_quality_issue"] = SIGNAL_DESCRIPTIONS["data_quality_score"]


class RiskReasonGenerator:
    """Generates explainable, evidence-tied reasons for risk assessments."""

    @classmethod
    def generate_reasons(
        cls,
        scoring_result: ScoringResult,
        custom_context: Optional[Dict[str, Any]] = None,
    ) -> List[str]:
        """
        Generate a list of human-readable, non-accusatory reasons for the score.
        """
        reasons: List[str] = []

        # Handle unassessed / empty signals
        if (
            scoring_result.risk_level in ("Insufficient Data", "UNKNOWN")
            or scoring_result.risk_score is None
        ):
            reasons.append("Insufficient risk signals available for assessment.")
            if scoring_result.missing_signals:
                reasons.append(
                    f"Unassessed signal categories: {', '.join(scoring_result.missing_signals)}."
                )
            return reasons

        # 1. Overall assessment headline
        score_val = scoring_result.risk_score
        level_upper = scoring_result.risk_level.upper()

        if level_upper == "CRITICAL":
            reasons.append(
                f"Composite risk indicators reached critical threshold ({score_val:.1f}). Priority administrative review recommended."
            )
        elif level_upper == "HIGH":
            reasons.append(
                f"Elevated risk indicators observed ({score_val:.1f}). Detailed verification recommended."
            )
        elif level_upper == "MEDIUM":
            reasons.append(
                f"Moderate risk indicators detected ({score_val:.1f}). Standard monitoring verification advised."
            )
        else:
            reasons.append(
                f"Risk indicators remain low ({score_val:.1f}). Project metrics conform to expected baseline parameters."
            )

        # 2. Individual contributing signals breakdown
        for name, sig in scoring_result.contributing_signals.items():
            val = sig.normalized_value

            if name in SIGNAL_DESCRIPTIONS:
                if val >= 60.0:
                    reasons.append(SIGNAL_DESCRIPTIONS[name]["high"].format(value=val))
                elif val >= 30.0:
                    reasons.append(SIGNAL_DESCRIPTIONS[name]["medium"].format(value=val))
                else:
                    if level_upper == "LOW" or val == 0.0:
                        reasons.append(SIGNAL_DESCRIPTIONS[name]["low"].format(value=val))
            else:
                display_name = name.replace("_", " ").title()
                if val >= 60.0:
                    reasons.append(
                        f"Elevated {display_name} signal detected ({val:.1f}) contributing to heightened risk posture."
                    )
                elif val >= 30.0:
                    reasons.append(
                        f"Moderate {display_name} signal observed ({val:.1f})."
                    )

        # 3. Mention human review trigger if prompted by a single severe signal
        if scoring_result.human_review_required and level_upper not in ("HIGH", "CRITICAL"):
            reasons.append(
                "Human review triggered due to an isolated high-severity indicator exceeding threshold."
            )

        # 4. Note missing signals if confidence is partial
        if scoring_result.confidence_score < 0.70 and scoring_result.missing_signals:
            reasons.append(
                f"Confidence score is {scoring_result.confidence_score * 100:.0f}%; the following indicators were unassessed without penalty: {', '.join(scoring_result.missing_signals)}."
            )

        return reasons
