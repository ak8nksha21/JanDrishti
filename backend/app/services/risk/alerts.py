"""
JanDrishti - Lightweight Risk Alert System

Generates and tracks structured risk alerts for projects that exceed
risk thresholds (overall_score >= 70.0 or High/Critical risk) and warrant human review.
"""

from collections import deque
from datetime import datetime, timezone
import threading
from typing import Any, Dict, List, Optional
import uuid


class RiskAlert:
    """Represents a structured high-risk alert."""

    def __init__(
        self,
        work_id: str,
        risk_level: str,
        risk_score: float,
        reasons: List[str],
        human_review_required: bool = True,
        evidence_count: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
        alert_id: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ):
        self.alert_id = alert_id or f"alt_{uuid.uuid4().hex[:12]}"
        self.work_id = str(work_id)
        self.risk_level = risk_level
        self.risk_score = round(float(risk_score), 2)
        self.reasons = list(reasons)
        self.human_review_required = human_review_required
        self.evidence_count = evidence_count
        self.metadata = dict(metadata or {})
        self.created_at = created_at or datetime.now(timezone.utc)
        self.summary = (
            f"Work {self.work_id} flagged with {self.risk_level} risk "
            f"(Score: {self.risk_score:.1f}) requiring administrative verification."
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "work_id": self.work_id,
            "risk_level": self.risk_level,
            "risk_score": self.risk_score,
            "reasons": self.reasons,
            "human_review_required": self.human_review_required,
            "evidence_count": self.evidence_count,
            "summary": self.summary,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
        }


class AlertManager:
    """
    Thread-safe in-memory alert store and generator.
    Maintains a rolling window of recent alerts.
    """

    def __init__(self, max_capacity: int = 500):
        self.max_capacity = max_capacity
        self._alerts: deque[RiskAlert] = deque(maxlen=max_capacity)
        self._lock = threading.Lock()

    def generate_alert_if_eligible(
        self,
        work_id: str,
        scoring_result: Any,
        reasons: List[str],
        evidence_count: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[RiskAlert]:
        """
        Generate and persist an alert if the scoring result satisfies the alert criteria.
        Supports both dict results from RiskEngine and ScoringResult dataclass.
        """
        if isinstance(scoring_result, dict):
            alert_required = scoring_result.get("alert_required", False)
            score = scoring_result.get("overall_score")
            if score is None:
                score = scoring_result.get("risk_score")
            risk_level = scoring_result.get("risk_level", "Unknown")
            human_review = scoring_result.get("human_review_required", True)
        else:
            alert_required = getattr(scoring_result, "alert_required", False)
            score = getattr(scoring_result, "overall_score", None)
            if score is None:
                score = getattr(scoring_result, "risk_score", None)
            risk_level = getattr(scoring_result, "risk_level", "Unknown")
            human_review = getattr(scoring_result, "human_review_required", True)

        if not alert_required or score is None:
            return None

        alert = RiskAlert(
            work_id=work_id,
            risk_level=risk_level,
            risk_score=score,
            reasons=reasons,
            human_review_required=human_review,
            evidence_count=evidence_count,
            metadata=metadata,
        )

        with self._lock:
            self._alerts.appendleft(alert)

        return alert

    def get_alerts(
        self,
        min_score: Optional[float] = None,
        risk_level: Optional[str] = None,
        work_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[RiskAlert]:
        """Query active alerts with optional filtering."""
        with self._lock:
            results: List[RiskAlert] = []
            for alert in self._alerts:
                if min_score is not None and alert.risk_score < min_score:
                    continue
                if risk_level and alert.risk_level.upper() != risk_level.upper():
                    continue
                if work_id and alert.work_id != str(work_id):
                    continue
                results.append(alert)
                if len(results) >= limit:
                    break
            return results

    def clear(self) -> None:
        """Clear all stored alerts (primarily for testing)."""
        with self._lock:
            self._alerts.clear()

    @property
    def count(self) -> int:
        with self._lock:
            return len(self._alerts)


# Singleton alert manager instance
alert_manager = AlertManager()
