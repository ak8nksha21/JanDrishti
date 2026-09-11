"""
JanDrishti - Risk Engine Orchestrator Adapter

Maintains full backward compatibility while delegating core calculations
to the canonical ml.risk_engine.RiskEngine and backend RiskService.
"""

from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from ml.risk_engine import RiskEngine as CanonicalRiskEngine, DEFAULT_SIGNAL_WEIGHTS
from app.services.risk.service import RiskService, risk_service
from app.services.risk.alerts import AlertManager, alert_manager


class RiskEngine:
    """
    Backward-compatible facade around CanonicalRiskEngine and RiskService.
    """

    def __init__(
        self,
        scorer: Optional[Any] = None,
        alerts: Optional[AlertManager] = None,
        weights: Optional[Dict[str, float]] = None,
    ):
        self._canonical = CanonicalRiskEngine(weights=weights)
        self.alert_manager = alerts or alert_manager
        self._service = RiskService(engine=self._canonical, alerts=self.alert_manager)

    def compute_risk(self, signals: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Delegate directly to canonical RiskEngine."""
        return self._canonical.compute_risk(signals)

    def evaluate_work(
        self,
        work_id: str,
        signals: Optional[Dict[str, Any]] = None,
        evidence: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Delegate to RiskService."""
        return self._service.calculate_for_work(
            work_id=work_id,
            signals=signals,
            evidence=evidence,
            metadata=metadata,
            db=db,
        )

    def evaluate_batch(
        self,
        items: List[Dict[str, Any]],
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Delegate to RiskService."""
        return self._service.calculate_batch(items=items, db=db)

    def _lookup_work(self, db: Session, work_id: str):
        return self._service._lookup_work(db, work_id)


# Singleton risk_engine instance
risk_engine = RiskEngine()
