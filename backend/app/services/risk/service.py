"""
JanDrishti - Risk Service Layer

Thin coordinator bridging the application layer, SQLAlchemy database models,
AlertManager, and the canonical RiskEngine.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.work import Work
from ml.risk_engine import RiskEngine, risk_engine as canonical_engine
from app.services.risk.alerts import AlertManager, RiskAlert, alert_manager
from app.services.risk.reasons import RiskReasonGenerator
from app.services.risk.scoring import RiskScorer, ScoringResult

logger = logging.getLogger("jandrishti.services.risk.service")


class RiskService:
    """
    Thin service layer delegating composite risk calculations to canonical RiskEngine
    and managing DB lookups and alert notifications.
    """

    def __init__(
        self,
        engine: Optional[RiskEngine] = None,
        alerts: Optional[AlertManager] = None,
    ):
        self.engine = engine or canonical_engine
        self.alert_manager = alerts or alert_manager

    def calculate_for_work(
        self,
        work_id: str,
        signals: Optional[Dict[str, Any]] = None,
        evidence: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Calculate composite risk for an individual work item.
        Queries database for metadata if db session is provided.
        """
        work_id_str = str(work_id)
        signals = dict(signals or {})
        evidence = list(evidence or [])
        metadata = dict(metadata or {})

        # Enrich metadata from database if work exists
        if db:
            try:
                work_record = self._lookup_work(db, work_id_str)
                if work_record:
                    metadata.setdefault("constituency", work_record.constituency)
                    metadata.setdefault("state", work_record.state)
                    metadata.setdefault("mp_name", work_record.mp_name)
                    metadata.setdefault("cost", work_record.cost)
                    metadata.setdefault("category", work_record.category)
            except Exception as e:
                logger.debug(f"Database lookup skipped or failed for {work_id_str}: {e}")

        # 1. Compute deterministic score via canonical RiskEngine
        result = self.engine.compute_risk(signals)

        # 2. Extract results
        overall_score = result["overall_score"]
        risk_level = result["risk_level"]
        confidence = result["confidence"]
        signal_breakdown = result["signal_breakdown"]
        observations = result["observations"]
        top_risk_factors = result["top_risk_factors"]
        human_review = result["human_review_required"]
        alert_required = result["alert_required"]

        # 3. Generate alert if eligible
        alert_obj: Optional[RiskAlert] = self.alert_manager.generate_alert_if_eligible(
            work_id=work_id_str,
            scoring_result=result,
            reasons=observations,
            evidence_count=len(evidence),
            metadata=metadata,
        )

        evaluated_at = datetime.now(timezone.utc).isoformat()

        return {
            "work_id": work_id_str,
            "overall_score": overall_score,
            "risk_score": overall_score,  # Backward compatibility alias
            "risk_level": risk_level,
            "confidence": confidence,
            "confidence_score": confidence,  # Backward compatibility alias
            "signal_breakdown": signal_breakdown,
            "contributing_signals": signal_breakdown,  # Backward compatibility alias
            "missing_signals": result.get("missing_signals", []),
            "observations": observations,
            "reasons": observations,  # Backward compatibility alias
            "top_risk_factors": top_risk_factors,
            "evidence": evidence,
            "human_review_required": human_review,
            "alert_required": alert_required,
            "alert": alert_obj.to_dict() if alert_obj else None,
            "metadata": metadata,
            "evaluated_at": evaluated_at,
        }

    def calculate_batch(
        self,
        items: List[Dict[str, Any]],
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate a batch of work items.
        """
        results: List[Dict[str, Any]] = []
        high_risk_count = 0
        alert_count = 0

        for item in items:
            work_id = item.get("work_id", "unknown")
            signals = item.get("signals", {})
            evidence = item.get("evidence", [])
            metadata = item.get("metadata", {})

            evaluation = self.calculate_for_work(
                work_id=work_id,
                signals=signals,
                evidence=evidence,
                metadata=metadata,
                db=db,
            )

            if evaluation["risk_level"] in ("High", "Critical", "HIGH", "CRITICAL"):
                high_risk_count += 1
            if evaluation["alert_required"]:
                alert_count += 1

            results.append(evaluation)

        return {
            "items": results,
            "total": len(results),
            "high_risk_count": high_risk_count,
            "alerts_generated": alert_count,
        }

    def _lookup_work(self, db: Session, work_id: str) -> Optional[Work]:
        """Look up work record by eSAKSHI work_id, DB id, or source_id."""
        work = None
        if work_id.isdigit():
            numeric_id = int(work_id)
            work = (
                db.query(Work)
                .filter(or_(Work.work_id == numeric_id, Work.id == numeric_id))
                .first()
            )
        if not work:
            work = db.query(Work).filter(Work.source_id == work_id).first()
        return work


# Singleton service instance
risk_service = RiskService()
