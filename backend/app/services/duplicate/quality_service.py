import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.work import Work
from ml.data_quality import WorkDataQualityAuditor

logger = logging.getLogger("jandrishti.quality.service")


class DataQualityService:
    """
    Service layer coordinating data quality, completeness, and consistency checks
    on MPLADS works.
    """

    def __init__(self, auditor: Optional[WorkDataQualityAuditor] = None):
        self.auditor = auditor or WorkDataQualityAuditor()

    def audit_batch(
        self,
        db: Session,
        constituency: Optional[str] = None,
        state: Optional[str] = None,
        category: Optional[str] = None,
        only_issues: bool = False,
        limit: int = 1000
    ) -> Dict[str, Any]:
        """
        Audit database works for data discrepancies, missing fields, invalid coordinates,
        negative costs, and date anomalies.
        """
        query = db.query(Work)

        if constituency:
            query = query.filter(Work.constituency.ilike(f"%{constituency.strip()}%"))
        if state:
            query = query.filter(Work.state.ilike(f"%{state.strip()}%"))
        if category:
            query = query.filter(Work.category.ilike(f"%{category.strip()}%"))

        works = query.order_by(Work.id.desc()).limit(limit).all()
        logger.info(f"Auditing data quality for {len(works)} works")

        batch_result = self.auditor.audit_batch(works)

        if only_issues:
            batch_result["work_reports"] = [
                r for r in batch_result["work_reports"] if r["has_issues"]
            ]

        return batch_result

    def get_quality_summary(
        self,
        db: Session,
        constituency: Optional[str] = None,
        state: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Compute aggregate data quality metrics for dashboard integration.
        """
        query = db.query(Work)
        if constituency:
            query = query.filter(Work.constituency.ilike(f"%{constituency.strip()}%"))
        if state:
            query = query.filter(Work.state.ilike(f"%{state.strip()}%"))

        works = query.all()
        batch_result = self.auditor.audit_batch(works)

        # Omit large work_reports list for lightweight summary
        batch_result.pop("work_reports", None)
        return batch_result

    def audit_single_work(
        self,
        db: Session,
        work_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Perform a thorough data quality audit on a single work item.
        """
        target = None
        if work_id.isdigit():
            num_id = int(work_id)
            target = db.query(Work).filter(
                or_(Work.work_id == num_id, Work.id == num_id)
            ).first()

        if not target:
            target = db.query(Work).filter(Work.source_id == work_id).first()

        if not target:
            return None

        return self.auditor.audit_work(target)
