"""
JanDrishti - Anomaly Detection Module

Provides interfaces and pipelines for detecting statistical and pattern-based anomalies
in MPLADS project expenditures, timelines, and allocation metrics.

Note: Anomaly detection flags statistical outliers and data inconsistencies for human review;
it does NOT claim that an anomaly constitutes fraud.
"""
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest


class CostAnomalyDetector:
    """
    Peer benchmarking + Isolation Forest for cost anomaly detection.
    Groups works by category and location to identify statistical outliers.
    """

    def __init__(self, contamination: float = 0.15):
        self.contamination = contamination

    def analyze(self, works: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Analyze a list of work dictionaries and return peer median metrics and cost anomaly scores.
        """
        if not works:
            return {}

        df = pd.DataFrame(works)
        results = {}

        # Safe defaults if columns are missing
        if "category" not in df.columns:
            df["category"] = "General"
        if "cost" not in df.columns:
            df["cost"] = 0.0

        df["cost"] = pd.to_numeric(df["cost"], errors="coerce").fillna(0.0)

        # Calculate category peer metrics
        category_stats = df.groupby("category")["cost"].agg(
            ["median", "mean", "std", "count"]
        ).to_dict(orient="index")

        # Isolation Forest on log-transformed costs if enough samples
        if len(df) >= 5:
            X = np.log1p(df[["cost"]].values)
            iso = IsolationForest(contamination=self.contamination, random_state=42)
            df["iso_score"] = iso.fit(X).decision_function(X)
            min_s, max_s = df["iso_score"].min(), df["iso_score"].max()
            if max_s > min_s:
                df["iso_risk"] = ((max_s - df["iso_score"]) / (max_s - min_s)) * 100.0
            else:
                df["iso_risk"] = 20.0
        else:
            df["iso_risk"] = 20.0

        for _, row in df.iterrows():
            w_id = str(row.get("work_id") or row.get("id") or row.get("source_id"))
            cat = str(row.get("category", "General"))
            cost = float(row.get("cost", 0.0))
            stats = category_stats.get(cat, {"median": cost, "mean": cost, "std": 1.0, "count": 1})

            median_cost = stats["median"] if stats["median"] > 0 else (cost if cost > 0 else 1.0)
            ratio = cost / median_cost if median_cost > 0 else 1.0

            if ratio > 3.0:
                bench_score = min(100.0, 70.0 + (ratio - 3.0) * 10.0)
                reason = f"Cost of ₹{cost:.2f}L is {ratio:.1f}x higher than category median of ₹{median_cost:.2f}L"
            elif ratio > 1.8:
                bench_score = min(70.0, 40.0 + (ratio - 1.8) * 25.0)
                reason = f"Cost of ₹{cost:.2f}L is {ratio:.1f}x above category peer median (₹{median_cost:.2f}L)"
            elif ratio < 0.2 and cost > 0:
                bench_score = 45.0
                reason = f"Cost of ₹{cost:.2f}L is unusually low compared to category median of ₹{median_cost:.2f}L"
            else:
                bench_score = max(5.0, min(35.0, (ratio / 1.5) * 25.0))
                reason = f"Cost is consistent with category peer benchmarks (median: ₹{median_cost:.2f}L)"

            iso_val = float(row.get("iso_risk", bench_score))
            combined_cost_score = round(0.6 * bench_score + 0.4 * iso_val, 1)
            combined_cost_score = min(100.0, max(0.0, combined_cost_score))

            results[w_id] = {
                "score": combined_cost_score,
                "peer_median": round(float(median_cost), 2),
                "ratio_to_median": round(float(ratio), 2),
                "reason": reason
            }

        return results


class MultivariableIsolationForestDetector:
    """
    Multi-variable anomaly detector combining work cost with MP-level financial metrics
    (allocation, expenditure, utilization percentage, completion rate, payment gap).
    """

    def __init__(self, contamination: float = 0.15):
        self.contamination = contamination

    def analyze(
        self,
        works: List[Dict[str, Any]],
        mp_financials_map: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Dict[str, Any]]:
        if not works:
            return {}

        records = []
        for w in works:
            w_id = str(w.get("work_id") or w.get("id") or w.get("source_id"))
            constituency = str(w.get("constituency", "")).strip().upper()
            mp_name = str(w.get("mp_name", "")).strip().upper()

            mp_data = (
                mp_financials_map.get(constituency, {})
                or mp_financials_map.get(mp_name, {})
                or {}
            )

            cost = float(w.get("cost", 0.0) or 0.0)
            alloc = float(mp_data.get("allocated_amount", 500.0) or 500.0)
            expend = float(mp_data.get("total_expenditure", 250.0) or 250.0)
            util = float(mp_data.get("utilization_percentage", 50.0) or 50.0)
            comp_rate = float(mp_data.get("completion_rate", 50.0) or 50.0)
            unspent = float(mp_data.get("unspent_amount", 250.0) or 250.0)
            pay_gap = float(mp_data.get("payment_gap_percentage", 0.0) or 0.0)

            cost_to_alloc = cost / max(alloc, 1.0)
            expend_to_alloc = expend / max(alloc, 1.0)

            records.append({
                "work_id": w_id,
                "cost": cost,
                "allocated": alloc,
                "expenditure": expend,
                "utilization": util,
                "completion_rate": comp_rate,
                "unspent": unspent,
                "payment_gap": pay_gap,
                "cost_to_alloc": cost_to_alloc,
                "expend_to_alloc": expend_to_alloc
            })

        df = pd.DataFrame(records)
        feature_cols = [
            "cost", "utilization", "completion_rate",
            "payment_gap", "cost_to_alloc", "expend_to_alloc"
        ]
        X = df[feature_cols].fillna(0.0).values

        if len(df) >= 4:
            iso = IsolationForest(n_estimators=100, contamination=self.contamination, random_state=42)
            scores = iso.fit(X).decision_function(X)
            min_s, max_s = scores.min(), scores.max()
            if max_s > min_s:
                norm_scores = ((max_s - scores) / (max_s - min_s)) * 100.0
            else:
                norm_scores = np.full(len(df), 25.0)
        else:
            norm_scores = np.full(len(df), 20.0)

        results = {}
        for i, row in df.iterrows():
            w_id = row["work_id"]
            ml_score = round(float(norm_scores[i]), 1)
            ml_score = min(100.0, max(0.0, ml_score))

            factors = []
            if row["payment_gap"] > 20.0:
                factors.append(f"high payment gap ({row['payment_gap']:.1f}%)")
            if row["utilization"] < 35.0 and row["expenditure"] > 100.0:
                factors.append("unusual expenditure-utilization divergence")
            if row["cost_to_alloc"] > 0.2:
                factors.append(f"single work occupies {(row['cost_to_alloc']*100):.1f}% of constituency fund")
            if row["completion_rate"] < 30.0 and row["expenditure"] > 250.0:
                factors.append("low completion rate despite substantial funds drawn")

            if not factors:
                factors.append("multivariate metrics within standard envelope")

            results[w_id] = {
                "score": ml_score,
                "factors": factors,
                "reason": f"Multivariate Isolation Forest detected: {', '.join(factors)}"
            }

        return results


class DataQualityDetector:
    """
    Evaluates completeness, audit trails, and data hygiene of MPLADS records.
    """

    def analyze(self, works: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        results = {}
        for w in works:
            w_id = str(w.get("work_id") or w.get("id") or w.get("source_id"))
            issues = []
            score = 10.0  # baseline nominal penalty

            desc = str(w.get("work_description") or w.get("description") or "").strip()
            if len(desc) < 10:
                issues.append("insufficient work description")
                score += 25.0

            cost = w.get("cost")
            if cost is None or float(cost) <= 0.0:
                issues.append("missing or zero expenditure recorded")
                score += 30.0

            if not w.get("location") and not (w.get("latitude") and w.get("longitude")):
                issues.append("missing specific location and GPS coordinates")
                score += 20.0

            if not w.get("implementing_agency") and not w.get("agency"):
                issues.append("implementing agency not designated")
                score += 15.0

            score = min(100.0, score)
            results[w_id] = {
                "score": round(score, 1),
                "issues": issues,
                "reason": f"Data Quality: {', '.join(issues)}" if issues else "Full record completeness verified"
            }
        return results


class AnomalyDetector:
    """Unified AnomalyDetector coordinating cost, multivariable, and quality checks."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.cost_detector = CostAnomalyDetector()
        self.multi_detector = MultivariableIsolationForestDetector()
        self.dq_detector = DataQualityDetector()

    def fit(self, data: pd.DataFrame) -> "AnomalyDetector":
        return self

    def predict(self, data: pd.DataFrame) -> pd.DataFrame:
        if data.empty:
            return data
        records = data.to_dict(orient="records")
        cost_results = self.cost_detector.analyze(records)
        dq_results = self.dq_detector.analyze(records)

        data = data.copy()
        data["cost_anomaly_score"] = [
            cost_results.get(str(r.get("work_id") or r.get("id")), {}).get("score", 0.0)
            for r in records
        ]
        data["data_quality_score"] = [
            dq_results.get(str(r.get("work_id") or r.get("id")), {}).get("score", 0.0)
            for r in records
        ]
        return data
