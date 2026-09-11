"""
JanDrishti - Duplicate & Similar Work Detection Module

Identifies potential duplicate or overlapping works across schemes, locations,
and descriptions using text similarity (TF-IDF + character n-grams) and geo-spatial proximity.
"""
import math
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two coordinates in meters."""
    R = 6371000  # Earth's radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class NearDuplicateDetector:
    """Pairwise near-duplicate and overlapping works detection."""

    def __init__(self, similarity_threshold: float = 0.55):
        self.similarity_threshold = similarity_threshold

    def analyze(self, works: List[Dict[str, Any]]) -> Tuple[Dict[str, Dict[str, Any]], List[Dict[str, Any]]]:
        if len(works) < 2:
            scores = {
                str(w.get("work_id") or w.get("id")): {
                    "score": 0.0, "matches": [], "reason": "Insufficient works for comparison"
                } for w in works
            }
            return scores, []

        descriptions = []
        for w in works:
            desc = str(w.get("work_description") or w.get("description") or "")
            cat = str(w.get("category") or "")
            loc = str(w.get("location") or "")
            descriptions.append(f"{desc} {cat} {loc}".strip())

        vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1, stop_words="english")
        try:
            tfidf_matrix = vectorizer.fit_transform(descriptions)
            text_sim_matrix = cosine_similarity(tfidf_matrix, tfidf_matrix)
        except Exception:
            text_sim_matrix = [[0.0] * len(works) for _ in range(len(works))]

        n = len(works)
        work_scores = {
            str(w.get("work_id") or w.get("id")): {
                "score": 0.0, "matches": [], "reason": "No suspicious duplicates found"
            } for w in works
        }
        similar_pairs = []

        for i in range(n):
            w1 = works[i]
            w1_id = str(w1.get("work_id") or w1.get("id"))
            c1 = float(w1.get("cost", 0.0) or 0.0)
            lat1, lon1 = w1.get("latitude"), w1.get("longitude")

            highest_sim = 0.0
            best_match = None

            for j in range(n):
                if i == j:
                    continue
                w2 = works[j]
                w2_id = str(w2.get("work_id") or w2.get("id"))
                c2 = float(w2.get("cost", 0.0) or 0.0)
                lat2, lon2 = w2.get("latitude"), w2.get("longitude")

                text_sim = float(text_sim_matrix[i][j])

                # Cost similarity (1.0 = identical cost)
                max_c = max(c1, c2, 1.0)
                cost_sim = max(0.0, 1.0 - (abs(c1 - c2) / max_c))

                # Geographic proximity
                geo_sim = 0.0
                dist_m = None
                if lat1 is not None and lon1 is not None and lat2 is not None and lon2 is not None:
                    try:
                        dist_m = haversine_distance(float(lat1), float(lon1), float(lat2), float(lon2))
                        if dist_m < 50:
                            geo_sim = 1.0
                        elif dist_m < 200:
                            geo_sim = 0.85
                        elif dist_m < 1000:
                            geo_sim = 0.60
                        elif dist_m < 5000:
                            geo_sim = 0.30
                    except (ValueError, TypeError):
                        dist_m = None

                if geo_sim == 0.0 and w1.get("constituency") and w1.get("constituency") == w2.get("constituency"):
                    geo_sim = 0.35  # Same constituency proxy

                # Blended similarity score
                combined_sim = (0.50 * text_sim) + (0.30 * geo_sim) + (0.20 * cost_sim)

                if combined_sim >= self.similarity_threshold:
                    pair_data = {
                        "work_id": w1_id,
                        "matched_work_id": w2_id,
                        "matched_title": str(w2.get("work_description") or w2.get("description") or "")[:80],
                        "text_similarity": round(text_sim, 3),
                        "cost_similarity": round(cost_sim, 3),
                        "geographic_similarity": round(geo_sim, 3),
                        "combined_similarity": round(combined_sim, 3),
                        "distance_meters": round(dist_m, 1) if dist_m is not None else None
                    }
                    work_scores[w1_id]["matches"].append(pair_data)
                    similar_pairs.append(pair_data)

                    if combined_sim > highest_sim:
                        highest_sim = combined_sim
                        best_match = pair_data

            if highest_sim >= 0.80:
                score_val = min(100.0, 75.0 + (highest_sim - 0.80) * 125.0)
                reason_val = f"Critical similarity ({highest_sim*100:.0f}%) with Work #{best_match['matched_work_id']}"
            elif highest_sim >= 0.65:
                score_val = min(75.0, 45.0 + (highest_sim - 0.65) * 200.0)
                reason_val = f"High similarity ({highest_sim*100:.0f}%) with Work #{best_match['matched_work_id']}"
            elif highest_sim >= 0.50:
                score_val = min(45.0, 20.0 + (highest_sim - 0.50) * 166.0)
                reason_val = f"Moderate similarity ({highest_sim*100:.0f}%) with Work #{best_match['matched_work_id']}"
            else:
                score_val = 5.0
                reason_val = "Unique scope, no duplicate patterns detected"

            work_scores[w1_id]["score"] = round(score_val, 1)
            work_scores[w1_id]["reason"] = reason_val

        return work_scores, similar_pairs


class DuplicateDetector:
    """Duplicate and similar works identification engine for JanDrishti."""

    def __init__(self, similarity_threshold: float = 0.55):
        self.similarity_threshold = similarity_threshold
        self.detector = NearDuplicateDetector(similarity_threshold=similarity_threshold)

    def find_duplicates(self, records: pd.DataFrame) -> pd.DataFrame:
        if records.empty:
            return records
        works_list = records.to_dict(orient="records")
        work_scores, _ = self.detector.analyze(works_list)

        records = records.copy()
        records["duplicate_risk_score"] = [
            work_scores.get(str(r.get("work_id") or r.get("id")), {}).get("score", 0.0)
            for r in works_list
        ]
        return records
