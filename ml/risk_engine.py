"""
JanDrishti - Composite Risk Scoring Engine

Calculates normalized risk scores by aggregating anomaly flags, duplicate indices,
and data quality indicators across constituencies and implementation agencies.
"""
from typing import Any, Dict, List, Optional
import pandas as pd


class RiskEngine:
    """Composite risk calculation engine for MPLADS monitoring."""

    def __init__(self, weights: Optional[Dict[str, float]] = None):
        self.weights = weights or {
            "ml_anomaly": 0.25,
            "cost_anomaly": 0.25,
            "duplicate_risk": 0.20,
            "utilization_risk": 0.15,
            "geographic_collision": 0.10,
            "data_quality_penalty": 0.05
        }

    def compute_composite_score(
        self,
        cost_score: float,
        ml_score: float,
        dup_score: float,
        util_score: float = 0.0,
        geo_score: float = 0.0,
        dq_score: float = 0.0
    ) -> Dict[str, Any]:
        """Compute composite risk score and assigned tier for a single item."""
        w = self.weights
        weighted_base = (
            w.get("cost_anomaly", 0.25) * cost_score +
            w.get("ml_anomaly", 0.25) * ml_score +
            w.get("duplicate_risk", 0.20) * dup_score +
            w.get("utilization_risk", 0.15) * util_score +
            w.get("geographic_collision", 0.10) * geo_score +
            w.get("data_quality_penalty", 0.05) * dq_score
        )

        max_comp = max(cost_score, ml_score, dup_score, util_score, geo_score, dq_score)
        # Peak blend ensures extreme anomalies are not masked by averages
        overall = round((0.65 * weighted_base) + (0.35 * max_comp), 1)
        overall = min(100.0, max(0.0, overall))

        if overall >= 81.0 or max_comp >= 88.0:
            level = "Critical"
        elif overall >= 61.0 or max_comp >= 63.0:
            level = "High"
        elif overall >= 31.0 or max_comp >= 40.0:
            level = "Medium"
        else:
            level = "Low"

        flags = []
        if cost_score >= 60.0:
            flags.append("Cost Anomaly")
        if dup_score >= 60.0:
            flags.append("Duplicate Suspect")
        if ml_score >= 65.0:
            flags.append("Multivariate Outlier")
        if util_score >= 60.0:
            flags.append("Utilization Risk")
        if geo_score >= 60.0:
            flags.append("Geographic Proximity")
        if dq_score >= 65.0:
            flags.append("Data Incomplete")

        return {
            "overall_score": overall,
            "risk_level": level,
            "flags": flags,
            "weighted_base": round(weighted_base, 1),
            "peak_component": round(max_comp, 1)
        }

    def compute_risk(self, enriched_data: pd.DataFrame) -> pd.DataFrame:
        """Compute aggregated risk metrics for records DataFrame."""
        if enriched_data.empty:
            return enriched_data

        results = []
        for _, row in enriched_data.iterrows():
            c = float(row.get("cost_anomaly_score", 0.0) or 0.0)
            m = float(row.get("ml_anomaly_score", 0.0) or 0.0)
            d = float(row.get("duplicate_risk_score", 0.0) or 0.0)
            u = float(row.get("utilization_score", 0.0) or 0.0)
            g = float(row.get("geographic_score", 0.0) or 0.0)
            dq = float(row.get("data_quality_score", 0.0) or 0.0)

            score_info = self.compute_composite_score(c, m, d, u, g, dq)
            results.append(score_info)

        out = enriched_data.copy()
        out["overall_risk_score"] = [r["overall_score"] for r in results]
        out["risk_level"] = [r["risk_level"] for r in results]
        out["risk_flags"] = [r["flags"] for r in results]
        return out
