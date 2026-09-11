import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.work import Work
from ml.geo_detection import GeoDetector, validate_coordinates

logger = logging.getLogger("jandrishti.geo.service")


class GeoService:
    """
    Service layer coordinating geographic proximity detection,
    GPS coordinate validation, and spatial anomaly audits.
    """

    def __init__(self, detector: Optional[GeoDetector] = None):
        self.detector = detector or GeoDetector()

    def scan_proximity(
        self,
        db: Session,
        max_distance_meters: float = 500.0,
        constituency: Optional[str] = None,
        state: Optional[str] = None,
        category: Optional[str] = None,
        same_category_only: bool = False,
        limit: int = 100,
        max_works: int = 2000
    ) -> Dict[str, Any]:
        """
        Scan stored works with valid GPS coordinates to identify geographically
        close or overlapping works.
        """
        query = db.query(Work)

        if constituency:
            query = query.filter(Work.constituency.ilike(f"%{constituency.strip()}%"))
        if state:
            query = query.filter(Work.state.ilike(f"%{state.strip()}%"))
        if category:
            query = query.filter(Work.category.ilike(f"%{category.strip()}%"))

        works = (
            query.filter(Work.latitude.isnot(None), Work.longitude.isnot(None))
            .order_by(Work.id.desc())
            .limit(max_works)
            .all()
        )

        total_scanned = len(works)
        # Count usable coordinates
        usable_count = sum(
            1 for w in works if validate_coordinates(w.latitude, w.longitude)["is_usable"]
        )

        logger.info(
            f"Scanning geo proximity for {total_scanned} works ({usable_count} usable coordinates, "
            f"max_dist={max_distance_meters}m)"
        )

        pairs = self.detector.find_geo_proximity_pairs(
            works=works,
            max_distance_meters=max_distance_meters,
            same_category_only=same_category_only
        )

        return {
            "total_works_analyzed": total_scanned,
            "works_with_valid_coordinates": usable_count,
            "pairs_found": len(pairs),
            "max_distance_meters": max_distance_meters,
            "filters_applied": {
                "constituency": constituency,
                "state": state,
                "category": category,
                "same_category_only": same_category_only,
                "limit": limit
            },
            "pairs": pairs[:limit]
        }

    def find_nearby_for_work(
        self,
        db: Session,
        work_id: str,
        max_distance_meters: float = 500.0,
        limit: int = 20
    ) -> Optional[Dict[str, Any]]:
        """
        Find geographically nearby works for a single target work item.
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

        val = validate_coordinates(target.latitude, target.longitude)
        if not val["is_usable"]:
            return {
                "target_work_id": str(work_id),
                "target_latitude": target.latitude,
                "target_longitude": target.longitude,
                "max_distance_meters": max_distance_meters,
                "nearby_works_count": 0,
                "coordinate_status": val["status"],
                "reason": val["reason"],
                "nearby_works": []
            }

        # Query candidates with coordinates
        candidates = (
            db.query(Work)
            .filter(Work.latitude.isnot(None), Work.longitude.isnot(None))
            .limit(2000)
            .all()
        )

        matches = self.detector.find_nearby_for_target(
            target_work=target,
            candidate_works=candidates,
            max_distance_meters=max_distance_meters
        )

        return {
            "target_work_id": str(work_id),
            "target_latitude": target.latitude,
            "target_longitude": target.longitude,
            "max_distance_meters": max_distance_meters,
            "nearby_works_count": len(matches),
            "nearby_works": matches[:limit]
        }

    def detect_coordinate_anomalies(
        self,
        db: Session,
        constituency: Optional[str] = None,
        state: Optional[str] = None,
        include_missing: bool = False,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Audit recorded GPS coordinates to find invalid, (0,0) placeholders,
        swapped, or out-of-bounds coordinates.
        """
        query = db.query(Work)
        if constituency:
            query = query.filter(Work.constituency.ilike(f"%{constituency.strip()}%"))
        if state:
            query = query.filter(Work.state.ilike(f"%{state.strip()}%"))

        works = query.limit(2000).all()
        anomalies = self.detector.detect_coordinate_anomalies(
            works=works,
            include_missing=include_missing
        )

        return {
            "total_works_scanned": len(works),
            "anomalies_detected": len(anomalies),
            "anomalies": anomalies[:limit]
        }
