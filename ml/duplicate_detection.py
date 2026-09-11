"""
JanDrishti - Duplicate & Similar Work Detection ML Module

Identifies potential duplicate or overlapping works using normalized text similarity
(TF-IDF + Cosine Similarity) enriched with multi-signal context (location, constituency,
cost, and geographic proximity when available).

Important Principle:
Produces an objective similarity signal with explainable evidence for human review.
Does not declare fraud or assign arbitrary risk scores.
"""
import math
import re
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def normalize_text(text: Optional[str]) -> str:
    """
    Normalize text for robust similarity comparison:
    - Lowercase
    - Replace special punctuation/symbols with spaces while preserving Hindi & alphanumeric characters
    - Collapse repeated whitespace
    """
    if not text or not isinstance(text, str):
        return ""
    # Strip leading/trailing whitespaces and lower
    cleaned = text.lower().strip()
    # Replace non-alphanumeric/non-unicode word characters (except spaces) with space
    cleaned = re.sub(r"[^\w\s\u0900-\u097F]", " ", cleaned)
    # Collapse multiple whitespaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on the earth in meters.
    Returns distance in meters.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class DuplicateDetector:
    """
    Duplicate and similar works identification engine.
    Uses TF-IDF + Cosine Similarity with multi-signal context validation.
    """

    def __init__(self, similarity_threshold: float = 0.85):
        """
        Initialize the detector with a default similarity threshold.
        :param similarity_threshold: Minimum text cosine similarity (0.0 to 1.0) to flag as duplicate.
        """
        if not (0.0 <= similarity_threshold <= 1.0):
            raise ValueError("similarity_threshold must be between 0.0 and 1.0")
        self.similarity_threshold = similarity_threshold

    def _build_tfidf_vectorizer(self) -> TfidfVectorizer:
        """Create a TF-IDF vectorizer configured for Indian administrative project descriptions."""
        return TfidfVectorizer(
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=1,
            analyzer="word",
            token_pattern=r"(?u)\b\w+\b"
        )

    def _extract_work_dict(self, record: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """Convert a dict or SQLAlchemy model / series row into a clean dictionary."""
        if isinstance(record, dict):
            return dict(record)
        # Handle SQLAlchemy model or Pandas Series
        if hasattr(record, "__dict__"):
            d = {k: v for k, v in record.__dict__.items() if not k.startswith("_")}
            return d
        if hasattr(record, "to_dict"):
            return record.to_dict()
        return dict(record)

    def compare_pair(
        self,
        work_a: Dict[str, Any],
        work_b: Dict[str, Any],
        text_similarity: float,
        threshold: float
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluate a single pair of works and build an explainable evidence summary
        combining text similarity and all available contextual metadata.
        """
        if text_similarity < threshold:
            return None

        reasons: List[str] = []
        match_type = "high_text_similarity"

        # 1. Text Similarity Analysis
        desc_a_norm = normalize_text(work_a.get("work_description"))
        desc_b_norm = normalize_text(work_b.get("work_description"))

        is_exact_text = (desc_a_norm == desc_b_norm and len(desc_a_norm) > 0)
        if is_exact_text:
            match_type = "exact_description_match"
            reasons.append("Exact description match after normalization.")
        else:
            reasons.append(
                f"High text similarity ({text_similarity:.2%}) on work description (threshold: {threshold:.2%})."
            )

        # 2. Location & Constituency Context (if fields exist)
        constituency_a = (work_a.get("constituency") or "").strip()
        constituency_b = (work_b.get("constituency") or "").strip()
        same_constituency = bool(
            constituency_a and constituency_b and constituency_a.lower() == constituency_b.lower()
        )

        district_a = (work_a.get("district") or "").strip()
        district_b = (work_b.get("district") or "").strip()
        same_district = bool(
            district_a and district_b and district_a.lower() == district_b.lower()
        )

        state_a = (work_a.get("state") or "").strip()
        state_b = (work_b.get("state") or "").strip()
        same_state = bool(
            state_a and state_b and state_a.lower() == state_b.lower()
        )

        location_a = normalize_text(work_a.get("location"))
        location_b = normalize_text(work_b.get("location"))
        same_location = bool(location_a and location_b and location_a == location_b)

        if same_location:
            reasons.append(f"Identical location specified: '{work_a.get('location')}'.")
            if is_exact_text:
                match_type = "exact_text_and_location_match"
            else:
                match_type = "high_similarity_same_location"
        elif same_constituency:
            reasons.append(f"Both works located in the same constituency: '{work_a.get('constituency')}'.")
            if same_district:
                reasons.append(f"Same district: '{work_a.get('district')}'.")
        elif same_state:
            reasons.append(f"Both works located in state: '{work_a.get('state')}'.")

        # 3. Category Context (if field exists)
        cat_a = (work_a.get("category") or "").strip()
        cat_b = (work_b.get("category") or "").strip()
        same_category = bool(cat_a and cat_b and cat_a.lower() == cat_b.lower())
        if same_category:
            reasons.append(f"Shared project category: '{work_a.get('category')}'.")

        # 4. MP Details (if field exists)
        mp_a = (work_a.get("mp_name") or "").strip()
        mp_b = (work_b.get("mp_name") or "").strip()
        same_mp = bool(mp_a and mp_b and mp_a.lower() == mp_b.lower())
        if same_mp:
            reasons.append(f"Both works recommended/sanctioned under MP: '{work_a.get('mp_name')}'.")

        # 5. Financial / Cost Proximity (if fields exist and non-null)
        cost_a = work_a.get("cost")
        cost_b = work_b.get("cost")
        cost_difference: Optional[float] = None
        cost_similarity_ratio: Optional[float] = None

        if cost_a is not None and cost_b is not None:
            try:
                c_a, c_b = float(cost_a), float(cost_b)
                cost_difference = abs(c_a - c_b)
                max_cost = max(c_a, c_b)
                if max_cost > 0:
                    cost_similarity_ratio = 1.0 - (cost_difference / max_cost)
                    if cost_difference == 0:
                        reasons.append(f"Identical recorded cost: ₹{c_a:,.2f}.")
                    elif cost_similarity_ratio >= 0.95:
                        reasons.append(
                            f"Very close recorded cost: ₹{c_a:,.2f} vs ₹{c_b:,.2f} (diff: ₹{cost_difference:,.2f})."
                        )
            except (ValueError, TypeError):
                pass

        # 6. Geospatial Proximity (if GPS coordinates exist on both)
        lat_a, lon_a = work_a.get("latitude"), work_a.get("longitude")
        lat_b, lon_b = work_b.get("latitude"), work_b.get("longitude")
        geo_distance_meters: Optional[float] = None

        if (
            lat_a is not None
            and lon_a is not None
            and lat_b is not None
            and lon_b is not None
        ):
            try:
                distance = haversine_distance(
                    float(lat_a), float(lon_a), float(lat_b), float(lon_b)
                )
                geo_distance_meters = round(distance, 2)
                if geo_distance_meters < 50:
                    reasons.append(
                        f"Geographic overlap: coordinates are within {geo_distance_meters:.1f} meters."
                    )
                    match_type = "geospatial_and_text_overlap"
                elif geo_distance_meters < 500:
                    reasons.append(
                        f"Close geographic proximity: {geo_distance_meters:.1f} meters apart."
                    )
                else:
                    reasons.append(
                        f"GPS distance between recorded points: {geo_distance_meters / 1000.0:.2f} km."
                    )
            except (ValueError, TypeError):
                pass

        # 7. Completion Date / Year Proximity (if available)
        year_a = work_a.get("completion_year")
        year_b = work_b.get("completion_year")
        if year_a is not None and year_b is not None and year_a == year_b:
            reasons.append(f"Both works recorded with completion year {year_a}.")

        return {
            "work_a_id": work_a.get("id"),
            "work_a_work_id": work_a.get("work_id"),
            "work_a_description": work_a.get("work_description"),
            "work_a_constituency": work_a.get("constituency"),
            "work_a_location": work_a.get("location"),
            "work_a_cost": work_a.get("cost"),
            "work_b_id": work_b.get("id"),
            "work_b_work_id": work_b.get("work_id"),
            "work_b_description": work_b.get("work_description"),
            "work_b_constituency": work_b.get("constituency"),
            "work_b_location": work_b.get("location"),
            "work_b_cost": work_b.get("cost"),
            "text_similarity": round(float(text_similarity), 4),
            "duplicate_score": int(round(float(text_similarity) * 100)),
            "match_type": match_type,
            "is_exact_text": is_exact_text,
            "same_constituency": same_constituency,
            "same_district": same_district,
            "same_state": same_state,
            "same_location": same_location,
            "same_category": same_category,
            "same_mp": same_mp,
            "cost_difference": cost_difference,
            "cost_similarity_ratio": round(cost_similarity_ratio, 4) if cost_similarity_ratio is not None else None,
            "geo_distance_meters": geo_distance_meters,
            "reasons": reasons,
        }

    def find_duplicate_pairs(
        self,
        works: List[Union[Dict[str, Any], Any]],
        threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Scan a list of works and find all pairs with description similarity >= threshold.
        Guarantees:
        - No work compared with itself (i != j).
        - No symmetric duplicates ((A, B) only, not (B, A)).
        - Configurable threshold.
        - Robust normalization.
        """
        effective_threshold = threshold if threshold is not None else self.similarity_threshold
        if not (0.0 <= effective_threshold <= 1.0):
            raise ValueError("threshold must be between 0.0 and 1.0")

        n = len(works)
        if n < 2:
            return []

        dict_works = [self._extract_work_dict(w) for w in works]
        normalized_texts = [
            normalize_text(w.get("work_description") or "") for w in dict_works
        ]

        # Filter out completely empty texts for TF-IDF vectorization
        non_empty_indices = [i for i, text in enumerate(normalized_texts) if len(text) > 0]
        if len(non_empty_indices) < 2:
            return []

        corpus = [normalized_texts[i] for i in non_empty_indices]
        vectorizer = self._build_tfidf_vectorizer()

        try:
            tfidf_matrix = vectorizer.fit_transform(corpus)
            similarity_matrix = cosine_similarity(tfidf_matrix)
        except Exception:
            # Fallback if corpus is empty or vocabulary cannot be built
            return []

        duplicate_pairs: List[Dict[str, Any]] = []
        num_valid = len(non_empty_indices)

        # Upper triangular iteration only (i < j) -> strictly avoids self-match and symmetric pairs
        for i in range(num_valid):
            orig_i = non_empty_indices[i]
            work_a = dict_works[orig_i]

            for j in range(i + 1, num_valid):
                orig_j = non_empty_indices[j]
                work_b = dict_works[orig_j]

                sim_score = float(similarity_matrix[i, j])
                pair_result = self.compare_pair(
                    work_a=work_a,
                    work_b=work_b,
                    text_similarity=sim_score,
                    threshold=effective_threshold
                )
                if pair_result is not None:
                    duplicate_pairs.append(pair_result)

        # Sort by text similarity descending
        duplicate_pairs.sort(key=lambda p: p["text_similarity"], reverse=True)
        return duplicate_pairs

    def find_duplicates_for_target(
        self,
        target_work: Union[Dict[str, Any], Any],
        candidate_works: List[Union[Dict[str, Any], Any]],
        threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Compare a single target work against candidate works.
        Excludes self-comparison if target is present in candidates.
        """
        effective_threshold = threshold if threshold is not None else self.similarity_threshold
        target_dict = self._extract_work_dict(target_work)
        target_text = normalize_text(target_dict.get("work_description") or "")
        target_id = target_dict.get("id")
        target_work_id = target_dict.get("work_id")

        if not target_text:
            return []

        filtered_candidates: List[Dict[str, Any]] = []
        for c in candidate_works:
            c_dict = self._extract_work_dict(c)
            # Exclude self-match by internal id or work_id
            if target_id is not None and c_dict.get("id") == target_id:
                continue
            if (
                target_work_id is not None
                and c_dict.get("work_id") is not None
                and c_dict.get("work_id") == target_work_id
            ):
                continue
            c_text = normalize_text(c_dict.get("work_description") or "")
            if c_text:
                filtered_candidates.append(c_dict)

        if not filtered_candidates:
            return []

        corpus = [target_text] + [
            normalize_text(c.get("work_description") or "") for c in filtered_candidates
        ]
        vectorizer = self._build_tfidf_vectorizer()

        try:
            tfidf_matrix = vectorizer.fit_transform(corpus)
            target_vec = tfidf_matrix[0:1]
            candidate_vecs = tfidf_matrix[1:]
            sim_scores = cosine_similarity(target_vec, candidate_vecs)[0]
        except Exception:
            return []

        matches: List[Dict[str, Any]] = []
        for idx, sim_score in enumerate(sim_scores):
            candidate = filtered_candidates[idx]
            pair_result = self.compare_pair(
                work_a=target_dict,
                work_b=candidate,
                text_similarity=float(sim_score),
                threshold=effective_threshold
            )
            if pair_result is not None:
                matches.append(pair_result)

        matches.sort(key=lambda m: m["text_similarity"], reverse=True)
        return matches

    def find_duplicates(self, records: pd.DataFrame, threshold: Optional[float] = None) -> pd.DataFrame:
        """
        DataFrame interface for backward compatibility with existing ML contract.
        Returns a DataFrame containing identified duplicate pairs.
        """
        if records.empty:
            return pd.DataFrame()
        records_list = records.to_dict(orient="records")
        pairs = self.find_duplicate_pairs(records_list, threshold=threshold)
        return pd.DataFrame(pairs)
