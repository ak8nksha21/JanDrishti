import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.work import Work
from ml.duplicate_detection import DuplicateDetector

logger = logging.getLogger("jandrishti.duplicate.service")


class DuplicateService:
    """
    Service layer coordinating duplicate and similar work detection
    between PostgreSQL data foundation and ML similarity engine.
    """

    def __init__(self, detector: Optional[DuplicateDetector] = None):
        self.detector = detector or DuplicateDetector()

    def scan_duplicates(
        self,
        db: Session,
        constituency: Optional[str] = None,
        state: Optional[str] = None,
        category: Optional[str] = None,
        min_similarity: float = 0.85,
        limit: int = 100,
        max_works: int = 2000
    ) -> Dict[str, Any]:
        """
        Scan database works for duplicate or overlapping projects.
        Applies optional filters (constituency, state, category).
        """
        query = db.query(Work)

        if constituency:
            query = query.filter(Work.constituency.ilike(f"%{constituency.strip()}%"))
        if state:
            query = query.filter(Work.state.ilike(f"%{state.strip()}%"))
        if category:
            query = query.filter(Work.category.ilike(f"%{category.strip()}%"))

        # Fetch works with non-null descriptions for analysis
        works = (
            query.filter(Work.work_description.isnot(None))
            .order_by(Work.id.desc())
            .limit(max_works)
            .all()
        )

        total_works = len(works)
        logger.info(
            f"Scanning {total_works} works for duplicates "
            f"(constituency={constituency}, state={state}, threshold={min_similarity})"
        )

        pairs = self.detector.find_duplicate_pairs(works, threshold=min_similarity)
        total_found = len(pairs)
        limited_pairs = pairs[:limit]

        return {
            "total_works_analyzed": total_works,
            "duplicate_pairs_found": total_found,
            "similarity_threshold": min_similarity,
            "filters_applied": {
                "constituency": constituency,
                "state": state,
                "category": category,
                "limit": limit
            },
            "pairs": limited_pairs
        }

    def find_duplicates_for_work(
        self,
        db: Session,
        work_id: str,
        min_similarity: float = 0.75,
        limit: int = 20,
        scope_to_state: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Identify potential duplicates or similar projects for a specific work item.
        Lookup target work by internal id, eSAKSHI work_id, or source_id.
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

        # Fetch candidates
        query = db.query(Work).filter(Work.work_description.isnot(None))
        if scope_to_state and target.state:
            query = query.filter(Work.state.ilike(f"%{target.state.strip()}%"))

        candidates = query.limit(2000).all()

        matches = self.detector.find_duplicates_for_target(
            target_work=target,
            candidate_works=candidates,
            threshold=min_similarity
        )

        return {
            "target_work_id": str(work_id),
            "total_candidates_analyzed": len(candidates),
            "matches_found": len(matches),
            "similarity_threshold": min_similarity,
            "matches": matches[:limit]
        }
