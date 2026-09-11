"""
JanDrishti - Geographic Proximity & Coordinate Validation Module

Validates GPS coordinates and identifies geographically close/overlapping works
using the Haversine formula.

Important Principles:
- Geographic proximity is an objective physical distance signal.
- Geographic proximity alone does NOT indicate a duplicate.
- Invalid coordinates produce data-quality signals rather than being silently accepted.
- Missing coordinates are preserved as None/null.
"""
import math
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from ml.duplicate_detection import (
    haversine_distance,
    normalize_text,
    DuplicateDetector
)

# Geographic Bounding Box for India (inclusive of island territories)
INDIA_LAT_MIN = 6.0
INDIA_LAT_MAX = 38.0
INDIA_LON_MIN = 68.0
INDIA_LON_MAX = 98.0


def validate_coordinates(
    lat: Optional[Union[float, int, str]],
    lon: Optional[Union[float, int, str]]
) -> Dict[str, Any]:
    """
    Validate GPS latitude and longitude coordinates:
    - Identifies missing coordinates (keeps None)
    - Detects (0.0, 0.0) placeholder / Null Island
    - Detects mathematically invalid coordinates (|lat| > 90 or |lon| > 180)
    - Detects swapped coordinates (e.g. lat ~79, lon ~27 in India)
    - Detects coordinates out of India's geographic bounding box
    """
    if lat is None or lon is None or lat == "" or lon == "":
        return {
            "status": "missing",
            "is_usable": False,
            "reason": "GPS coordinates not available.",
            "latitude": None,
            "longitude": None
        }

    try:
        f_lat = float(lat)
        f_lon = float(lon)
    except (ValueError, TypeError):
        return {
            "status": "invalid_format",
            "is_usable": False,
            "reason": f"Non-numeric coordinates provided: lat='{lat}', lon='{lon}'.",
            "latitude": None,
            "longitude": None
        }

    # Check for NaN / Inf
    if math.isnan(f_lat) or math.isnan(f_lon) or math.isinf(f_lat) or math.isinf(f_lon):
        return {
            "status": "invalid_format",
            "is_usable": False,
            "reason": "Coordinates contain NaN or Infinite values.",
            "latitude": None,
            "longitude": None
        }

    # 1. Null Island check
    if abs(f_lat) < 1e-5 and abs(f_lon) < 1e-5:
        return {
            "status": "null_island_placeholder",
            "is_usable": False,
            "reason": "Coordinates recorded as (0.0, 0.0) placeholder (Null Island).",
            "latitude": f_lat,
            "longitude": f_lon
        }

    # 2. Mathematical range validation
    if not (-90.0 <= f_lat <= 90.0) or not (-180.0 <= f_lon <= 180.0):
        return {
            "status": "out_of_mathematical_range",
            "is_usable": False,
            "reason": f"Coordinates exceed mathematical limits (-90..90, -180..180): lat={f_lat}, lon={f_lon}.",
            "latitude": f_lat,
            "longitude": f_lon
        }

    # 3. Check for suspected Lat/Lon swap (India latitude is 6-38, longitude is 68-98)
    if (INDIA_LON_MIN <= f_lat <= INDIA_LON_MAX) and (INDIA_LAT_MIN <= f_lon <= INDIA_LAT_MAX):
        return {
            "status": "suspected_swapped_coordinates",
            "is_usable": False,
            "reason": f"Suspected swapped coordinates: lat={f_lat} is in Indian longitude range, lon={f_lon} is in Indian latitude range.",
            "latitude": f_lat,
            "longitude": f_lon
        }

    # 4. Regional bounding box check
    if not (INDIA_LAT_MIN <= f_lat <= INDIA_LAT_MAX and INDIA_LON_MIN <= f_lon <= INDIA_LON_MAX):
        return {
            "status": "outside_india_bounding_box",
            "is_usable": False,
            "reason": f"Coordinates ({f_lat:.4f}, {f_lon:.4f}) fall outside Indian territorial bounding box.",
            "latitude": f_lat,
            "longitude": f_lon
        }

    return {
        "status": "valid",
        "is_usable": True,
        "reason": "Valid GPS coordinates within Indian territory.",
        "latitude": f_lat,
        "longitude": f_lon
    }


def classify_proximity_level(distance_meters: float) -> str:
    """Classify physical proximity into descriptive tiers."""
    if distance_meters <= 50.0:
        return "immediate_overlap"  # 0 - 50m
    elif distance_meters <= 200.0:
        return "same_compound_or_street"  # 50 - 200m
    elif distance_meters <= 500.0:
        return "nearby_cluster"  # 200 - 500m
    elif distance_meters <= 1000.0:
        return "neighborhood"  # 500 - 1000m
    elif distance_meters <= 5000.0:
        return "same_locality"  # 1km - 5km
    else:
        return "distant"  # > 5km


class GeoDetector:
    """
    Engine for validating coordinates, calculating geospatial distances,
    and discovering geographic proximity clusters with multi-signal context.
    """

    def __init__(self, default_max_distance_meters: float = 500.0):
        self.default_max_distance_meters = default_max_distance_meters
        self._duplicate_detector = DuplicateDetector()

    def _extract_work_dict(self, record: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """Convert a dict or SQLAlchemy model into a clean dictionary."""
        if isinstance(record, dict):
            return dict(record)
        if hasattr(record, "__dict__"):
            return {k: v for k, v in record.__dict__.items() if not k.startswith("_")}
        if hasattr(record, "to_dict"):
            return record.to_dict()
        return dict(record)

    def validate_work_geo(self, work: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """Validate GPS coordinates of a single work item."""
        w_dict = self._extract_work_dict(work)
        lat = w_dict.get("latitude")
        lon = w_dict.get("longitude")
        val_result = validate_coordinates(lat, lon)
        return {
            "work_id": w_dict.get("id"),
            "external_work_id": w_dict.get("work_id"),
            "description": w_dict.get("work_description"),
            "constituency": w_dict.get("constituency"),
            "state": w_dict.get("state"),
            **val_result
        }

    def detect_coordinate_anomalies(
        self,
        works: List[Union[Dict[str, Any], Any]],
        include_missing: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Scan a list of works and identify works with invalid, swapped, or out-of-bounds GPS coordinates.
        """
        anomalies: List[Dict[str, Any]] = []
        for w in works:
            geo_info = self.validate_work_geo(w)
            if geo_info["status"] == "valid":
                continue
            if geo_info["status"] == "missing" and not include_missing:
                continue
            anomalies.append(geo_info)
        return anomalies

    def compare_geo_pair(
        self,
        work_a: Dict[str, Any],
        work_b: Dict[str, Any],
        max_distance_meters: float,
        calculate_text_sim: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Compare physical distance between two works with valid coordinates.
        Returns proximity summary if distance <= max_distance_meters.
        """
        val_a = validate_coordinates(work_a.get("latitude"), work_a.get("longitude"))
        val_b = validate_coordinates(work_b.get("latitude"), work_b.get("longitude"))

        if not val_a["is_usable"] or not val_b["is_usable"]:
            return None

        distance_meters = haversine_distance(
            val_a["latitude"], val_a["longitude"],
            val_b["latitude"], val_b["longitude"]
        )

        if distance_meters > max_distance_meters:
            return None

        distance_meters = round(distance_meters, 2)
        proximity_tier = classify_proximity_level(distance_meters)
        reasons: List[str] = [
            f"Physical distance between recorded GPS coordinates is {distance_meters:.1f} meters ({proximity_tier})."
        ]

        # Check location / administrative overlap
        constituency_a = (work_a.get("constituency") or "").strip()
        constituency_b = (work_b.get("constituency") or "").strip()
        same_constituency = bool(
            constituency_a and constituency_b and constituency_a.lower() == constituency_b.lower()
        )

        district_a = (work_a.get("district") or "").strip()
        district_b = (work_b.get("district") or "").strip()
        same_district = bool(district_a and district_b and district_a.lower() == district_b.lower())

        state_a = (work_a.get("state") or "").strip()
        state_b = (work_b.get("state") or "").strip()
        same_state = bool(state_a and state_b and state_a.lower() == state_b.lower())

        cat_a = (work_a.get("category") or "").strip()
        cat_b = (work_b.get("category") or "").strip()
        same_category = bool(cat_a and cat_b and cat_a.lower() == cat_b.lower())

        if same_constituency:
            reasons.append(f"Both works located in constituency: '{work_a.get('constituency')}'.")
        if same_category:
            reasons.append(f"Shared project category: '{work_a.get('category')}'.")

        # Cost comparison if present
        cost_a, cost_b = work_a.get("cost"), work_b.get("cost")
        cost_difference: Optional[float] = None
        if cost_a is not None and cost_b is not None:
            try:
                cost_difference = round(abs(float(cost_a) - float(cost_b)), 2)
                if cost_difference == 0:
                    reasons.append(f"Identical recorded cost: ₹{float(cost_a):,.2f}.")
            except (ValueError, TypeError):
                pass

        # Text similarity signal (contextual enrichment)
        text_similarity = 0.0
        desc_a = work_a.get("work_description") or ""
        desc_b = work_b.get("work_description") or ""
        if calculate_text_sim and (desc_a or desc_b):
            pair_comp = self._duplicate_detector.compare_pair(
                work_a, work_b,
                text_similarity=0.0,
                threshold=0.0
            )
            # Compute TF-IDF similarity specifically
            norm_a = normalize_text(desc_a)
            norm_b = normalize_text(desc_b)
            if norm_a and norm_b:
                if norm_a == norm_b:
                    text_similarity = 1.0
                    reasons.append("Exact description match accompanied by spatial proximity.")
                else:
                    try:
                        vec = self._duplicate_detector._build_tfidf_vectorizer()
                        m = vec.fit_transform([norm_a, norm_b])
                        sim = float((m[0] * m[1].T).toarray()[0][0])
                        text_similarity = round(sim, 4)
                        if text_similarity >= 0.75:
                            reasons.append(
                                f"High text similarity ({text_similarity:.2%}) combined with spatial proximity."
                            )
                        else:
                            reasons.append(
                                f"Distinct project descriptions (text similarity: {text_similarity:.2%})."
                            )
                    except Exception:
                        pass

        # Important principle check: Is this considered a potential duplicate?
        # Geographic proximity alone is NOT duplicate; requires text similarity or identical metadata
        is_potential_duplicate = bool(text_similarity >= 0.85 or (text_similarity >= 0.70 and same_category and distance_meters < 50))

        return {
            "work_a_id": work_a.get("id"),
            "work_a_work_id": work_a.get("work_id"),
            "work_a_description": work_a.get("work_description"),
            "work_a_constituency": work_a.get("constituency"),
            "work_a_latitude": val_a["latitude"],
            "work_a_longitude": val_a["longitude"],
            "work_a_cost": work_a.get("cost"),
            "work_b_id": work_b.get("id"),
            "work_b_work_id": work_b.get("work_id"),
            "work_b_description": work_b.get("work_description"),
            "work_b_constituency": work_b.get("constituency"),
            "work_b_latitude": val_b["latitude"],
            "work_b_longitude": val_b["longitude"],
            "work_b_cost": work_b.get("cost"),
            "distance_meters": distance_meters,
            "proximity_level": proximity_tier,
            "text_similarity": text_similarity,
            "is_potential_duplicate": is_potential_duplicate,
            "same_constituency": same_constituency,
            "same_district": same_district,
            "same_state": same_state,
            "same_category": same_category,
            "cost_difference": cost_difference,
            "reasons": reasons
        }

    def find_geo_proximity_pairs(
        self,
        works: List[Union[Dict[str, Any], Any]],
        max_distance_meters: Optional[float] = None,
        same_category_only: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Scan works and find all pairs within max_distance_meters.
        Guarantees:
        - Only compares works with valid GPS coordinates.
        - No work compared with itself (i != j).
        - No symmetric pairs ((A, B) only).
        """
        effective_max_dist = (
            max_distance_meters if max_distance_meters is not None else self.default_max_distance_meters
        )

        dict_works = [self._extract_work_dict(w) for w in works]
        # Filter works with usable coordinates
        valid_works: List[Dict[str, Any]] = []
        for w in dict_works:
            val = validate_coordinates(w.get("latitude"), w.get("longitude"))
            if val["is_usable"]:
                valid_works.append(w)

        n = len(valid_works)
        if n < 2:
            return []

        proximity_pairs: List[Dict[str, Any]] = []

        # Upper triangular iteration only
        for i in range(n):
            work_a = valid_works[i]
            for j in range(i + 1, n):
                work_b = valid_works[j]

                if same_category_only:
                    cat_a = (work_a.get("category") or "").strip().lower()
                    cat_b = (work_b.get("category") or "").strip().lower()
                    if not (cat_a and cat_b and cat_a == cat_b):
                        continue

                pair_res = self.compare_geo_pair(
                    work_a=work_a,
                    work_b=work_b,
                    max_distance_meters=effective_max_dist
                )
                if pair_res is not None:
                    proximity_pairs.append(pair_res)

        # Sort by physical distance ascending (closest first)
        proximity_pairs.sort(key=lambda p: p["distance_meters"])
        return proximity_pairs

    def find_nearby_for_target(
        self,
        target_work: Union[Dict[str, Any], Any],
        candidate_works: List[Union[Dict[str, Any], Any]],
        max_distance_meters: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Find geographically nearby works for a single target work.
        Excludes self-comparison.
        """
        effective_max_dist = (
            max_distance_meters if max_distance_meters is not None else self.default_max_distance_meters
        )
        target_dict = self._extract_work_dict(target_work)
        target_val = validate_coordinates(target_dict.get("latitude"), target_dict.get("longitude"))

        if not target_val["is_usable"]:
            return []

        target_id = target_dict.get("id")
        target_work_id = target_dict.get("work_id")

        nearby_matches: List[Dict[str, Any]] = []
        for c in candidate_works:
            c_dict = self._extract_work_dict(c)
            # Exclude self-match
            if target_id is not None and c_dict.get("id") == target_id:
                continue
            if (
                target_work_id is not None
                and c_dict.get("work_id") is not None
                and c_dict.get("work_id") == target_work_id
            ):
                continue

            pair_res = self.compare_geo_pair(
                work_a=target_dict,
                work_b=c_dict,
                max_distance_meters=effective_max_dist
            )
            if pair_res is not None:
                nearby_matches.append(pair_res)

        nearby_matches.sort(key=lambda m: m["distance_meters"])
        return nearby_matches
