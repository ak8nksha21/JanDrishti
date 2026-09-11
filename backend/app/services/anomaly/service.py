import math
import os
import sys
from typing import Any, Dict, List, Optional
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import or_

# Ensure repository root is on sys.path for both container and host environments
current_dir = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.abspath(os.path.join(current_dir, "../../../.."))
if repo_root not in sys.path and os.path.exists(os.path.join(repo_root, "ml")):
    sys.path.insert(0, repo_root)

if "/app" not in sys.path and os.path.exists("/app/ml"):
    sys.path.insert(0, "/app")

from ml.anomaly_detection import AnomalyDetector
from app.models.work import Work
from app.models.mp_summary import MPFinancialSummary


class AnomalyService:
    """
    Backend service integrating ML Anomaly Detection pipelines with PostgreSQL records.
    Uses ml.anomaly_detection.AnomalyDetector as the single source of truth.
    """

    def __init__(self, detector: Optional[AnomalyDetector] = None):
        self.detector = detector or AnomalyDetector()

    def evaluate_works(
        self,
        db: Session,
        page: int = 1,
        limit: int = 20,
        constituency: Optional[str] = None,
        district: Optional[str] = None,
        category: Optional[str] = None,
        anomalies_only: bool = False,
        min_score: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate work records from database for cost anomalies against peer works.
        """
        # Load all candidate works to form statistical baselines
        query = db.query(Work)
        all_works = query.all()

        if not all_works:
            return {
                "items": [],
                "total": 0,
                "anomalies_count": 0,
                "page": page,
                "limit": limit,
                "total_pages": 0,
            }

        records = []
        for w in all_works:
            rec = {
                "id": w.id,
                "work_id": w.work_id,
                "cost": w.cost,
                "category": w.category,
                "district": w.district,
                "constituency": w.constituency,
                "state": w.state,
                "mp_name": w.mp_name,
                "completion_year": w.completion_year,
                "completion_date": w.completion_date.isoformat() if w.completion_date else None,
            }
            records.append(rec)

        df = pd.DataFrame(records)
        scored_df = self.detector.fit(df).predict(df)
        scored_records = self.detector.to_records(scored_df)

        # Merge metadata fields back into scored records
        combined = []
        for orig, scored in zip(records, scored_records):
            item = {
                "id": orig["id"],
                "work_id": orig["work_id"],
                "cost": orig["cost"],
                "category": orig["category"],
                "district": orig["district"],
                "constituency": orig["constituency"],
                "state": orig["state"],
                "mp_name": orig["mp_name"],
                **scored,
            }
            combined.append(item)

        # Apply filtering
        filtered = combined
        if constituency:
            filtered = [c for c in filtered if c["constituency"] and constituency.lower() in c["constituency"].lower()]
        if district:
            filtered = [c for c in filtered if c["district"] and district.lower() in c["district"].lower()]
        if category:
            filtered = [c for c in filtered if c["category"] and category.lower() in c["category"].lower()]
        if anomalies_only:
            filtered = [c for c in filtered if c["is_anomaly"]]
        if min_score is not None:
            filtered = [c for c in filtered if (c["cost_anomaly_score"] or 0.0) >= min_score]

        total = len(filtered)
        anomalies_count = sum(1 for c in filtered if c["is_anomaly"])
        total_pages = math.ceil(total / limit) if total > 0 else 0

        start = (page - 1) * limit
        end = start + limit
        paginated_items = filtered[start:end]

        return {
            "items": paginated_items,
            "total": total,
            "anomalies_count": anomalies_count,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
        }

    def evaluate_single_work(self, db: Session, work_id: str) -> Optional[Dict[str, Any]]:
        """
        Evaluate a single work against peer baseline works in the database.
        """
        res = self.evaluate_works(db, limit=10000)
        target = None
        for item in res["items"]:
            if str(item.get("work_id")) == work_id or str(item.get("id")) == work_id:
                target = item
                break
        return target

    def evaluate_mps(
        self,
        db: Session,
        page: int = 1,
        limit: int = 20,
        state: Optional[str] = None,
        constituency: Optional[str] = None,
        anomalies_only: bool = False,
        min_score: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate MP financial and utilization records against cohort distributions.
        """
        all_mps = db.query(MPFinancialSummary).all()

        if not all_mps:
            return {
                "items": [],
                "total": 0,
                "anomalies_count": 0,
                "page": page,
                "limit": limit,
                "total_pages": 0,
            }

        records = []
        for m in all_mps:
            rec = {
                "id": m.id,
                "mp_name": m.mp_name,
                "state": m.state,
                "constituency": m.constituency,
                "allocated_amount": m.allocated_amount,
                "total_expenditure": m.total_expenditure,
                "utilization_percentage": m.utilization_percentage,
                "completed_works_count": m.completed_works_count,
                "recommended_works_count": m.recommended_works_count,
                "completion_rate": m.completion_rate,
                "pending_works": m.pending_works,
                "unspent_amount": m.unspent_amount,
                "completed_works_value": m.completed_works_value,
                "in_progress_payments": m.in_progress_payments,
                "payment_gap_percentage": m.payment_gap_percentage,
            }
            records.append(rec)

        df = pd.DataFrame(records)
        scored_df = self.detector.fit(df).predict(df)
        scored_records = self.detector.to_records(scored_df)

        combined = []
        for orig, scored in zip(records, scored_records):
            item = {
                "id": orig["id"],
                "mp_name": orig["mp_name"],
                "state": orig["state"],
                "constituency": orig["constituency"],
                "allocated_amount": orig["allocated_amount"],
                "total_expenditure": orig["total_expenditure"],
                "utilization_percentage": orig["utilization_percentage"],
                **scored,
            }
            combined.append(item)

        filtered = combined
        if state:
            filtered = [c for c in filtered if c["state"] and state.lower() in c["state"].lower()]
        if constituency:
            filtered = [c for c in filtered if c["constituency"] and constituency.lower() in c["constituency"].lower()]
        if anomalies_only:
            filtered = [c for c in filtered if c["is_anomaly"]]
        if min_score is not None:
            filtered = [
                c for c in filtered
                if max((c["financial_anomaly_score"] or 0.0), (c["utilization_anomaly_score"] or 0.0)) >= min_score
            ]

        total = len(filtered)
        anomalies_count = sum(1 for c in filtered if c["is_anomaly"])
        total_pages = math.ceil(total / limit) if total > 0 else 0

        start = (page - 1) * limit
        end = start + limit
        paginated_items = filtered[start:end]

        return {
            "items": paginated_items,
            "total": total,
            "anomalies_count": anomalies_count,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
        }

    def evaluate_single_mp(self, db: Session, mp_id: str) -> Optional[Dict[str, Any]]:
        """
        Evaluate a single MP against cohort distribution in the database.
        """
        res = self.evaluate_mps(db, limit=10000)
        target = None
        for item in res["items"]:
            if str(item.get("id")) == mp_id:
                target = item
                break
        return target

    def evaluate_payload(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Direct evaluation of arbitrary work or MP records (supports testing edge cases).
        """
        if not records:
            return {"results": [], "total": 0, "anomalies_count": 0}

        df = pd.DataFrame(records)
        scored_df = self.detector.predict(df)
        scored_records = self.detector.to_records(scored_df)

        anomalies_count = sum(1 for r in scored_records if r.get("is_anomaly"))
        return {
            "results": scored_records,
            "total": len(scored_records),
            "anomalies_count": anomalies_count,
        }
