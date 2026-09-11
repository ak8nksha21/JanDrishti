"""
JanDrishti - Canonical Composite Risk Scoring Engine

Calculates transparent, deterministic, and explainable risk scores (0–100)
by aggregating multi-source detection signals across MPLADS works.

Final JanDrishti Contract:
- ml_anomaly_score:      25% (0.25)
- cost_anomaly_score:    25% (0.25)
- duplicate_score:       20% (0.20)
- utilization_score:     15% (0.15)
- geographic_score:      10% (0.10)
- data_quality_score:     5% (0.05)

Risk Bands:
- 0 – 30:   Low
- 31 – 60:  Medium
- 61 – 80:  High
- 81 – 100: Critical
- All signals missing: Insufficient Data

Strict Non-Accusatory Rule:
The system identifies potential irregularities requiring verification;
it NEVER claims "fraud", "corruption", "scam", or guilt.
"""

from typing import Any, Dict, List, Optional, Tuple, Union
import logging

logger = logging.getLogger("jandrishti.ml.risk_engine")

# Official Product Weights (JanDrishti Product Design, not government thresholds)
DEFAULT_SIGNAL_WEIGHTS: Dict[str, float] = {
    "ml_anomaly_score": 0.25,
    "cost_anomaly_score": 0.25,
    "duplicate_score": 0.20,
    "utilization_score": 0.15,
    "geographic_score": 0.10,
    "data_quality_score": 0.05,
}

# Legacy signal name mappings for backward compatibility
LEGACY_SIGNAL_MAP: Dict[str, str] = {
    "cost_anomaly": "cost_anomaly_score",
    "cost_score": "cost_anomaly_score",
    "duplicate_similarity": "duplicate_score",
    "duplicate_risk": "duplicate_score",
    "geographic_anomaly": "geographic_score",
    "geographic_collision": "geographic_score",
    "financial_anomaly": "utilization_score",
    "utilization_risk": "utilization_score",
    "data_quality_issue": "data_quality_score",
    "data_quality_penalty": "data_quality_score",
    "ml_anomaly": "ml_anomaly_score",
}

# Risk Band Boundaries (0–100 scale)
BAND_LOW_MAX = 30.0
BAND_MEDIUM_MAX = 60.0
BAND_HIGH_MAX = 80.0
ALERT_SCORE_THRESHOLD = 70.0


class RiskEngine:
    """
    Deterministic Composite Risk Engine for JanDrishti MPLADS monitoring.
    Consumes normalized risk signals (0–100) and produces an explainable composite risk score.
    """

    def __init__(self, weights: Optional[Dict[str, float]] = None):
        self.weights = dict(weights or DEFAULT_SIGNAL_WEIGHTS)
        self.total_configured_weight = sum(self.weights.values())

    @staticmethod
    def get_risk_level(score: Optional[float]) -> str:
        """
        Deterministic categorization of risk score into JanDrishti product bands:
        - 0 – 30:   Low
        - 31 – 60:  Medium
        - 61 – 80:  High
        - 81 – 100: Critical
        - None:     Insufficient Data
        """
        if score is None:
            return "Insufficient Data"
        if score <= BAND_LOW_MAX:
            return "Low"
        elif score <= BAND_MEDIUM_MAX:
            return "Medium"
        elif score <= BAND_HIGH_MAX:
            return "High"
        else:
            return "Critical"

    @classmethod
    def validate_signal(cls, signal_name: str, value: Any) -> Tuple[Optional[float], bool]:
        """
        Validate and normalize a signal value to the 0–100 scale.

        Returns:
            Tuple[Optional[float], bool]:
                - normalized float in [0.0, 100.0] if present, None if missing.
                - boolean indicating whether the signal is present (True) or missing (False).

        Raises:
            ValueError: If numeric value is outside [0.0, 100.0] or of invalid type.
        """
        if value is None:
            return None, False

        # Boolean handling (e.g. data quality binary flag)
        if isinstance(value, bool):
            return (100.0 if value else 0.0), True

        # Numeric handling
        if isinstance(value, (int, float)):
            val_float = float(value)
            if val_float < 0.0 or val_float > 100.0:
                raise ValueError(
                    f"Signal '{signal_name}' value {value} is out of valid range [0, 100]."
                )
            return round(val_float, 2), True

        # String handling
        if isinstance(value, str):
            clean = value.strip().lower()
            if clean in ("true", "yes"):
                return 100.0, True
            if clean in ("false", "no"):
                return 0.0, True
            try:
                val_float = float(clean)
                if val_float < 0.0 or val_float > 100.0:
                    raise ValueError(
                        f"Signal '{signal_name}' string value '{value}' is out of valid range [0, 100]."
                    )
                return round(val_float, 2), True
            except ValueError:
                raise ValueError(
                    f"Signal '{signal_name}' has unrecognized value: '{value}'."
                )

        raise ValueError(
            f"Signal '{signal_name}' has unsupported type '{type(value).__name__}'."
        )

    def _normalize_input_signals(self, raw_signals: Any) -> Dict[str, Any]:
        """Convert input dict or DataFrame record into a normalized dictionary."""
        if raw_signals is None:
            return {}

        # Handle pandas DataFrame or Series if provided by ML pipelines
        if hasattr(raw_signals, "to_dict"):
            records = raw_signals.to_dict(orient="records") if hasattr(raw_signals, "columns") else raw_signals.to_dict()
            if isinstance(records, list) and len(records) > 0:
                return dict(records[0])
            elif isinstance(records, dict):
                return dict(records)

        if isinstance(raw_signals, dict):
            mapped = {}
            for k, v in raw_signals.items():
                target_key = LEGACY_SIGNAL_MAP.get(k, k)
                # If legacy signal was given as a 0.0-1.0 float, scale up to 0-100
                if k in LEGACY_SIGNAL_MAP and isinstance(v, (int, float)) and not isinstance(v, bool):
                    if 0.0 < float(v) <= 1.0:
                        v = float(v) * 100.0
                mapped[target_key] = v
            return mapped

        return {}

    def compute_risk(self, signals: Optional[Union[Dict[str, Any], Any]] = None) -> Dict[str, Any]:
        """
        Compute composite risk evaluation from supplied signals.

        Rules:
        - If all signals are missing or None: returns overall_score=None, risk_level="Insufficient Data".
        - Missing signals are NEVER treated as 0.0; weights are renormalized across available signals.
        - True 0.0 is treated as verified zero risk and actively pulls down the average.
        - Output strictly adheres to non-accusatory language.

        Returns:
            Dict containing:
                - overall_score: float (0–100) or None
                - risk_level: "Low" | "Medium" | "High" | "Critical" | "Insufficient Data"
                - confidence: float (0.0 to 1.0)
                - signal_breakdown: Dict of details per available signal
                - observations: List of explainable, non-accusatory findings
                - top_risk_factors: List of signal names sorted by weighted contribution descending
                - human_review_required: bool
                - alert_required: bool
        """
        normalized_input = self._normalize_input_signals(signals)

        validated_present: Dict[str, float] = {}
        missing_list: List[str] = []

        # Validate known signals
        for sig_name in self.weights:
            val = normalized_input.get(sig_name)
            norm_val, is_present = self.validate_signal(sig_name, val)
            if is_present and norm_val is not None:
                validated_present[sig_name] = norm_val
            else:
                missing_list.append(sig_name)

        # Validate any extra dynamic signals
        for sig_name, val in normalized_input.items():
            if sig_name not in self.weights:
                norm_val, is_present = self.validate_signal(sig_name, val)
                if is_present and norm_val is not None:
                    validated_present[sig_name] = norm_val
                elif not is_present and sig_name not in missing_list:
                    missing_list.append(sig_name)

        # Case: All signals missing
        if not validated_present:
            return {
                "overall_score": None,
                "risk_level": "Insufficient Data",
                "confidence": 0.0,
                "signal_breakdown": {},
                "observations": [
                    "Insufficient risk signals available for assessment."
                ],
                "top_risk_factors": [],
                "missing_signals": sorted(missing_list),
                "human_review_required": False,
                "alert_required": False,
            }

        # Calculate available configured weights
        signal_weights: Dict[str, float] = {}
        total_available_weight = 0.0

        for sig_name in validated_present:
            w = self.weights.get(sig_name, 0.10)
            signal_weights[sig_name] = w
            total_available_weight += w

        confidence = (
            round(min(1.0, total_available_weight / self.total_configured_weight), 2)
            if self.total_configured_weight > 0
            else 1.0
        )

        # Renormalize weights & calculate contributions
        composite_score = 0.0
        signal_breakdown: Dict[str, Dict[str, Any]] = {}

        for sig_name, score_val in validated_present.items():
            cfg_weight = signal_weights[sig_name]
            effective_weight = (
                cfg_weight / total_available_weight if total_available_weight > 0 else 0.0
            )
            contribution = score_val * effective_weight
            composite_score += contribution

            signal_breakdown[sig_name] = {
                "score": round(score_val, 1),
                "configured_weight": round(cfg_weight, 4),
                "effective_weight": round(effective_weight, 4),
                "weighted_contribution": round(contribution, 2),
            }

        # Clamp and round final score
        final_score = round(max(0.0, min(100.0, composite_score)), 1)
        risk_level = self.get_risk_level(final_score)

        # Determine top risk factors (sorted by weighted contribution descending)
        sorted_factors = sorted(
            validated_present.keys(),
            key=lambda k: (signal_breakdown[k]["weighted_contribution"], signal_breakdown[k]["score"]),
            reverse=True,
        )
        # Exclude signals with 0 score from top factors unless all are zero
        top_risk_factors = [
            k for k in sorted_factors if signal_breakdown[k]["score"] > 0
        ]
        if not top_risk_factors and validated_present:
            top_risk_factors = sorted_factors[:2]

        # Generate observations
        observations = self.generate_observations(
            final_score=final_score,
            risk_level=risk_level,
            signal_breakdown=signal_breakdown,
            missing_signals=missing_list,
        )

        # Human review & Alert requirements
        has_severe_signal = any(v >= 80.0 for v in validated_present.values())
        human_review_required = (
            final_score >= BAND_MEDIUM_MAX
            or has_severe_signal
            or (validated_present.get("data_quality_score", 0.0) >= 60.0 and final_score >= BAND_LOW_MAX)
        )
        alert_required = (
            final_score >= ALERT_SCORE_THRESHOLD
            or risk_level in ("High", "Critical")
        )

        return {
            "overall_score": final_score,
            "risk_level": risk_level,
            "confidence": confidence,
            "signal_breakdown": signal_breakdown,
            "observations": observations,
            "top_risk_factors": top_risk_factors,
            "missing_signals": sorted(missing_list),
            "human_review_required": human_review_required,
            "alert_required": alert_required,
        }

    def compute_composite_score(
        self,
        cost_score: Optional[float] = None,
        ml_score: Optional[float] = None,
        dup_score: Optional[float] = None,
        util_score: Optional[float] = None,
        geo_score: Optional[float] = None,
        dq_score: Optional[float] = None
    ) -> Dict[str, Any]:
        """Compute composite risk score, flags, and assigned tier for a work item."""
        signals = {}
        if cost_score is not None:
            signals["cost_anomaly_score"] = cost_score
        if ml_score is not None:
            signals["ml_anomaly_score"] = ml_score
        if dup_score is not None:
            signals["duplicate_score"] = dup_score
        if util_score is not None:
            signals["utilization_score"] = util_score
        if geo_score is not None:
            signals["geographic_score"] = geo_score
        if dq_score is not None:
            signals["data_quality_score"] = dq_score

        res = self.compute_risk(signals)
        overall = res.get("overall_score") or 0.0
        level = res.get("risk_level") or "Low"

        flags = []
        if cost_score is not None and cost_score >= 60.0:
            flags.append("Cost Anomaly")
        if dup_score is not None and dup_score >= 60.0:
            flags.append("Duplicate Suspect")
        if ml_score is not None and ml_score >= 65.0:
            flags.append("Multivariate Outlier")
        if util_score is not None and util_score >= 60.0:
            flags.append("Utilization Risk")
        if geo_score is not None and geo_score >= 60.0:
            flags.append("Geographic Proximity")
        if dq_score is not None and dq_score >= 65.0:
            flags.append("Data Incomplete")

        peak = max([s for s in [cost_score, ml_score, dup_score, util_score, geo_score, dq_score] if s is not None] or [0.0])

        return {
            "overall_score": overall,
            "risk_level": level,
            "flags": flags,
            "observations": res.get("observations", []),
            "weighted_base": overall,
            "peak_component": peak
        }

    @staticmethod
    def generate_observations(
        final_score: float,
        risk_level: str,
        signal_breakdown: Dict[str, Dict[str, Any]],
        missing_signals: Optional[List[str]] = None,
    ) -> List[str]:
        """
        Generate deterministic, explainable, and strictly non-accusatory observations.
        """
        observations: List[str] = []

        # Specific signal-level observations
        for name, details in signal_breakdown.items():
            val = details["score"]
            if name == "cost_anomaly_score" and val >= 60.0:
                observations.append("Elevated cost anomaly signal; requires verification.")
            elif name == "duplicate_score" and val >= 60.0:
                observations.append("Potentially similar work detected; requires verification.")
            elif name == "utilization_score" and val >= 60.0:
                observations.append("Unusual utilization pattern detected.")
            elif name == "geographic_score" and val >= 60.0:
                observations.append("Potential geographic overlap detected.")
            elif name == "data_quality_score" and val >= 60.0:
                observations.append("Important project data is incomplete or inconsistent.")
            elif name == "ml_anomaly_score" and val >= 60.0:
                observations.append("Multiple project characteristics show an elevated anomaly signal.")

        # Overall posture
        if risk_level == "Critical":
            observations.append(
                f"Composite risk indicators reached critical threshold ({final_score:.1f}). Priority administrative review recommended."
            )
        elif risk_level == "High":
            observations.append(
                f"Elevated risk indicators observed ({final_score:.1f}). Detailed verification recommended."
            )
        elif risk_level == "Medium":
            observations.append(
                f"Moderate risk indicators detected ({final_score:.1f}). Standard monitoring verification advised."
            )
        elif not observations:
            observations.append(
                f"Project metrics conform to expected baseline parameters ({final_score:.1f})."
            )

        if missing_signals and len(missing_signals) >= 3:
            observations.append(
                f"Assessment conducted with partial signals; unassessed indicators: {', '.join(missing_signals)}."
            )

        return observations


# Singleton instance for quick module access
risk_engine = RiskEngine()
