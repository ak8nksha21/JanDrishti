"""
JanDrishti - Deterministic Risk Scoring Engine

Calculates transparent, explainable composite risk scores (0–100) by aggregating
multi-source detection signals (ML anomaly, cost anomaly, duplicate, utilization,
geographic, and data quality).
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union

from ml.risk_engine import (
    RiskEngine,
    DEFAULT_SIGNAL_WEIGHTS,
    BAND_LOW_MAX,
    BAND_MEDIUM_MAX,
    BAND_HIGH_MAX,
    ALERT_SCORE_THRESHOLD,
    LEGACY_SIGNAL_MAP,
)


@dataclass
class ContributingSignal:
    """Detailed breakdown of a single evaluated signal's contribution."""
    name: str
    raw_value: Any
    normalized_value: float
    configured_weight: float
    effective_weight: float
    weighted_contribution: float
    description: str = ""


@dataclass
class ScoringResult:
    """Result of deterministic scoring across evaluated signals."""
    risk_score: Optional[float]
    risk_level: str
    confidence_score: float
    contributing_signals: Dict[str, ContributingSignal] = field(default_factory=dict)
    missing_signals: List[str] = field(default_factory=list)
    top_risk_factors: List[str] = field(default_factory=list)
    human_review_required: bool = False
    alert_required: bool = False


class RiskScorer:
    """
    Deterministic risk scoring calculator.
    Wraps the canonical RiskEngine to provide compatibility with ScoringResult dataclass.
    """

    def __init__(
        self,
        weights: Optional[Dict[str, float]] = None,
        alert_threshold: float = ALERT_SCORE_THRESHOLD,
    ):
        self.weights = dict(weights or DEFAULT_SIGNAL_WEIGHTS)
        self.alert_threshold = alert_threshold
        self._engine = RiskEngine(weights=self.weights)

    def validate_and_normalize_signal(
        self, signal_name: str, value: Any
    ) -> Tuple[Optional[float], bool]:
        """Validate and normalize a signal value to [0, 100]."""
        return self._engine.validate_signal(signal_name, value)

    def compute_score(
        self,
        signals: Optional[Dict[str, Any]] = None,
    ) -> ScoringResult:
        """
        Compute deterministic score from detection signals using canonical RiskEngine.
        """
        eval_dict = self._engine.compute_risk(signals)

        overall_score = eval_dict["overall_score"]
        risk_level = eval_dict["risk_level"]
        confidence = eval_dict["confidence"]
        breakdown_dict = eval_dict["signal_breakdown"]
        missing = eval_dict["missing_signals"]
        top_factors = eval_dict["top_risk_factors"]
        human_review = eval_dict["human_review_required"]
        alert_req = eval_dict["alert_required"]

        contributing: Dict[str, ContributingSignal] = {}
        for name, det in breakdown_dict.items():
            contributing[name] = ContributingSignal(
                name=name,
                raw_value=signals.get(name) if signals else None,
                normalized_value=det["score"],
                configured_weight=det["configured_weight"],
                effective_weight=det["effective_weight"],
                weighted_contribution=det["weighted_contribution"],
            )

        return ScoringResult(
            risk_score=overall_score,
            risk_level=risk_level,
            confidence_score=confidence,
            contributing_signals=contributing,
            missing_signals=missing,
            top_risk_factors=top_factors,
            human_review_required=human_review,
            alert_required=alert_req,
        )
