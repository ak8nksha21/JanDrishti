"""
JanDrishti - Comprehensive ML Anomaly Detection Subsystem

Provides unified and specialized anomaly detection pipelines for MPLADS:
1. Cost Anomaly Detection (Work-level hierarchical peer IQR + Isolation Forest)
2. Multi-variable Financial Anomaly Detection (MP-level 11 real fields + financial ratios + Isolation Forest)
3. Utilization Anomaly Detection (MP-level expenditure/allocation distribution + discrepancy analysis)

Core Principles:
- All anomaly scores are normalized strictly to the range [0.0, 100.0].
- Independent sub-scores (cost_anomaly_score, financial_anomaly_score, utilization_anomaly_score)
  and downstream aliases (cost_score, ml_anomaly_score, utilization_score) are exposed.
- Missing values are NEVER silently converted to zero.
- No fabricated fields (e.g. sanctioned cost, planned delay) are invented.
- Explanations are strictly evidence-based and objective; NO accusations of fraud or corruption.
- Full compatibility with Jayant's Risk Engine and Akanksha's Investigation Agent.
"""

from datetime import datetime
import logging
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

logger = logging.getLogger("jandrishti.ml.anomaly")


# =============================================================================
# REUSABLE DATA & SCORING HELPERS
# =============================================================================

def safe_float(val: Any) -> Optional[float]:
    """
    Safely convert an input to float.
    Handles None, NaN, empty strings, commas (e.g. '1,250,000'), percentages ('78.5%'),
    and numpy numeric types (np.int64, np.float64, np.number).
    Returns None if missing or non-convertible. Never converts missing to 0.0.
    """
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (int, float, np.number)):
        if np.isnan(val) or np.isinf(val):
            return None
        return float(val)
    if isinstance(val, str):
        cleaned = val.strip().replace(",", "").replace("%", "")
        if not cleaned:
            return None
        try:
            num = float(cleaned)
            if np.isnan(num) or np.isinf(num):
                return None
            return num
        except (ValueError, TypeError):
            return None
    try:
        num = float(val)
        if np.isnan(num) or np.isinf(num):
            return None
        return num
    except (ValueError, TypeError):
        return None


def safe_int(val: Any) -> Optional[int]:
    """Safely convert input to integer. Returns None on failure."""
    f = safe_float(val)
    if f is None:
        return None
    try:
        return int(round(f))
    except (ValueError, TypeError, OverflowError):
        return None


def safe_ratio(numerator: Any, denominator: Any) -> Optional[float]:
    """
    Compute safe ratio numerator / denominator.
    Returns None if either operand is missing, or if denominator <= 0.
    """
    num = safe_float(numerator)
    den = safe_float(denominator)
    if num is None or den is None:
        return None
    if den == 0.0:
        return None
    return float(num / den)


def clip_score(val: Any, min_val: float = 0.0, max_val: float = 100.0) -> Optional[float]:
    """Clamps a numeric score strictly to [min_val, max_val]. Returns None if input is None."""
    f = safe_float(val)
    if f is None:
        return None
    return float(np.clip(f, min_val, max_val))


# Explicit field alias mapping for MP Financial Summary records.
# Maps raw camelCase field names to internal snake_case schema representations.
MP_FINANCIAL_FIELD_MAP: Dict[str, str] = {
    # 11 required MPFinancialSummary fields:
    "allocatedAmount": "allocated_amount",
    "totalExpenditure": "total_expenditure",
    "utilizationPercentage": "utilization_percentage",
    "completedWorksCount": "completed_works_count",
    "recommendedWorksCount": "recommended_works_count",
    "completionRate": "completion_rate",
    "pendingWorks": "pending_works",
    "unspentAmount": "unspent_amount",
    "completedWorksValue": "completed_works_value",
    "inProgressPayments": "in_progress_payments",
    "paymentGapPercentage": "payment_gap_percentage",
    # Additional raw MP summary attributes:
    "mpName": "mp_name",
    "totalRecommendedAmount": "total_recommended_amount",
    "recommendationUtilizationPercentage": "recommendation_utilization_percentage",
    "expenditurePercentage": "expenditure_percentage",
    "utilizationDefinition": "utilization_definition",
    "unpaidBalance": "unpaid_balance",
    "totalCompletedAmount": "total_completed_amount",
}


def normalize_mp_financial_dataframe(data: pd.DataFrame) -> pd.DataFrame:
    """
    Normalizes MP financial DataFrame column names so internal snake_case names are available.
    Accepts both camelCase and snake_case column names.
    Preserves all original columns and preserves None/NaN/empty/invalid values without fabricating data.
    """
    if data is None or not isinstance(data, pd.DataFrame) or data.empty:
        return data

    df = data.copy()
    for camel, snake in MP_FINANCIAL_FIELD_MAP.items():
        if camel in df.columns:
            if snake not in df.columns:
                df[snake] = df[camel]
            else:
                # If snake exists but has all nulls while camel has values, fillna from camel
                if df[snake].isna().all() and not df[camel].isna().all():
                    df[snake] = df[snake].combine_first(df[camel])
    return df


# =============================================================================
# 1. COST ANOMALY DETECTOR (WORK-LEVEL)
# =============================================================================

class CostAnomalyDetector:
    """
    Work-level Cost Anomaly Detector with hierarchical peer grouping and
    unsupervised Isolation Forest verification.

    Peer Group Hierarchy:
    1. category + district (min 5 samples)
    2. category + constituency (min 5 samples)
    3. category (min 4 samples)
    4. global dataset (min 4 samples)
    5. insufficient baseline fallback
    """

    DEFAULT_CONFIG = {
        "cost_column": "cost",
        "category_column": "category",
        "district_column": "district",
        "constituency_column": "constituency",
        "completion_year_column": "completion_year",
        "min_peer_samples_cat_geo": 5,
        "min_peer_samples_category": 4,
        "min_peer_samples_global": 4,
        "min_samples_for_iforest": 15,
        "iqr_multiplier": 1.5,
        "extreme_iqr_multiplier": 3.0,
        "iforest_n_estimators": 100,
        "iforest_contamination": 0.05,
        "iforest_random_state": 42,
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        self.is_fitted_: bool = False
        self.peer_baselines_: Dict[str, Dict[str, Any]] = {
            "cat_district": {},
            "cat_constituency": {},
            "category": {},
            "global": None,
        }
        self.iforest_model_: Optional[IsolationForest] = None
        self.iforest_features_: List[str] = []
        self.iforest_skip_reason_: Optional[str] = None

    def fit(self, data: pd.DataFrame) -> "CostAnomalyDetector":
        """Fit hierarchical peer distributions and Isolation Forest on works data."""
        if data is None or not isinstance(data, pd.DataFrame) or data.empty:
            self.is_fitted_ = True
            return self

        cost_col = self.config["cost_column"]
        cat_col = self.config["category_column"]
        dist_col = self.config["district_column"]
        const_col = self.config["constituency_column"]

        # 1. Global Baseline
        if cost_col in data.columns:
            valid_costs = self._extract_valid_costs(data[cost_col])
            if len(valid_costs) >= self.config["min_peer_samples_global"]:
                self.peer_baselines_["global"] = self._compute_iqr_stats(valid_costs)

        # 2. Category Baseline
        if cat_col in data.columns and cost_col in data.columns:
            for cat_val, grp in data.groupby(cat_col):
                if pd.notna(cat_val):
                    v_costs = self._extract_valid_costs(grp[cost_col])
                    if len(v_costs) >= self.config["min_peer_samples_category"]:
                        self.peer_baselines_["category"][str(cat_val).strip()] = self._compute_iqr_stats(v_costs)

        # 3. Category + District Baseline
        if cat_col in data.columns and dist_col in data.columns and cost_col in data.columns:
            for (c_val, d_val), grp in data.groupby([cat_col, dist_col]):
                if pd.notna(c_val) and pd.notna(d_val):
                    v_costs = self._extract_valid_costs(grp[cost_col])
                    if len(v_costs) >= self.config["min_peer_samples_cat_geo"]:
                        key = f"{str(c_val).strip()}___{str(d_val).strip()}"
                        self.peer_baselines_["cat_district"][key] = self._compute_iqr_stats(v_costs)

        # 4. Category + Constituency Baseline
        if cat_col in data.columns and const_col in data.columns and cost_col in data.columns:
            for (c_val, con_val), grp in data.groupby([cat_col, const_col]):
                if pd.notna(c_val) and pd.notna(con_val):
                    v_costs = self._extract_valid_costs(grp[cost_col])
                    if len(v_costs) >= self.config["min_peer_samples_cat_geo"]:
                        key = f"{str(c_val).strip()}___{str(con_val).strip()}"
                        self.peer_baselines_["cat_constituency"][key] = self._compute_iqr_stats(v_costs)

        # 5. Fit Isolation Forest if sufficient valid numeric records exist
        self._fit_isolation_forest(data)

        self.is_fitted_ = True
        return self

    def predict(self, data: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Evaluate work records against fitted peer distributions.
        Returns list of structured anomaly results per record.
        """
        if not self.is_fitted_:
            self.fit(data)

        if data is None or not isinstance(data, pd.DataFrame) or data.empty:
            return []

        cost_col = self.config["cost_column"]
        cat_col = self.config["category_column"]
        dist_col = self.config["district_column"]
        const_col = self.config["constituency_column"]

        # Run Isolation Forest prediction on valid feature rows
        iforest_scores = self._predict_iforest(data)

        results = []
        n_rows = len(data)

        for i in range(n_rows):
            row = data.iloc[i]
            raw_cost = safe_float(row.get(cost_col)) if cost_col in data.columns else None
            cat_val = str(row.get(cat_col)).strip() if cat_col in data.columns and pd.notna(row.get(cat_col)) else None
            dist_val = str(row.get(dist_col)).strip() if dist_col in data.columns and pd.notna(row.get(dist_col)) else None
            const_val = str(row.get(const_col)).strip() if const_col in data.columns and pd.notna(row.get(const_col)) else None

            # Handle missing cost
            if raw_cost is None:
                results.append({
                    "cost_anomaly_score": None,
                    "is_anomalous": False,
                    "status": "insufficient_data",
                    "method": "insufficient_data",
                    "observations": ["Cost data is missing; cost anomaly detection skipped."],
                    "details": {
                        "cost": None,
                        "method": "insufficient_data",
                        "peer_count": 0,
                        "peer_group_used": "none",
                        "peer_median_cost": None,
                        "peer_mean_cost": None,
                        "peer_q1": None,
                        "peer_q3": None,
                        "peer_iqr": None,
                        "deviation_percentage": None,
                    }
                })
                continue

            # Handle negative cost (data quality event)
            if raw_cost < 0:
                results.append({
                    "cost_anomaly_score": 90.0,
                    "is_anomalous": True,
                    "status": "data_quality_issue",
                    "method": "data_quality_check",
                    "observations": [f"Negative cost value of ₹{raw_cost:,.2f} recorded; project expenditures cannot be negative."],
                    "details": {
                        "cost": raw_cost,
                        "method": "data_quality_check",
                        "peer_count": 0,
                        "peer_group_used": "none",
                        "peer_median_cost": None,
                        "peer_mean_cost": None,
                        "peer_q1": None,
                        "peer_q3": None,
                        "peer_iqr": None,
                        "deviation_percentage": None,
                    }
                })
                continue

            # Hierarchical peer selection
            peer_stats, peer_level, peer_label = self._select_peer_group(cat_val, dist_val, const_val)

            if peer_stats is None:
                results.append({
                    "cost_anomaly_score": None,
                    "is_anomalous": False,
                    "status": "insufficient_data",
                    "method": "insufficient_peers",
                    "observations": [f"Cost of ₹{raw_cost:,.2f} recorded; insufficient comparable peer works to compute baseline distribution."],
                    "details": {
                        "cost": raw_cost,
                        "method": "insufficient_peers",
                        "peer_count": 0,
                        "peer_group_used": peer_level,
                        "peer_median_cost": None,
                        "peer_mean_cost": None,
                        "peer_q1": None,
                        "peer_q3": None,
                        "peer_iqr": None,
                        "deviation_percentage": None,
                    }
                })
                continue

            # Evaluate against peer distribution
            iqr_score, is_iqr_anom, obs, details = self._evaluate_against_peers(raw_cost, peer_stats, peer_label)

            # Combine with Isolation Forest signal if available
            final_cost_score = iqr_score
            if_score = iforest_scores[i] if iforest_scores is not None else None
            if if_score is not None and if_score >= 60.0:
                final_cost_score = max(final_cost_score, if_score * 0.85 + iqr_score * 0.15)
                obs.append(f"Unsupervised Isolation Forest confirms structural cost outlier characteristics (signal: {if_score:.1f}/100).")

            final_cost_score = clip_score(final_cost_score, 0.0, 100.0)
            is_anom = bool(final_cost_score >= 60.0 or is_iqr_anom)

            details["cost"] = raw_cost
            details["peer_group_used"] = peer_level
            details["method"] = f"{peer_level}_iqr"

            results.append({
                "cost_anomaly_score": round(final_cost_score, 2) if final_cost_score is not None else None,
                "is_anomalous": is_anom,
                "status": "anomalous" if is_anom else "normal",
                "method": f"{peer_level}_iqr",
                "observations": obs,
                "details": details,
            })

        return results

    def _select_peer_group(
        self,
        category: Optional[str],
        district: Optional[str],
        constituency: Optional[str]
    ) -> Tuple[Optional[Dict[str, Any]], str, str]:
        """Select highest-specificity peer group matching availability thresholds."""
        # 1. Category + District
        if category and district:
            key = f"{category}___{district}"
            if key in self.peer_baselines_["cat_district"]:
                return self.peer_baselines_["cat_district"][key], "category_district", f"category '{category}' in district '{district}'"

        # 2. Category + Constituency
        if category and constituency:
            key = f"{category}___{constituency}"
            if key in self.peer_baselines_["cat_constituency"]:
                return self.peer_baselines_["cat_constituency"][key], "category_constituency", f"category '{category}' in constituency '{constituency}'"

        # 3. Category
        if category and category in self.peer_baselines_["category"]:
            return self.peer_baselines_["category"][category], "category", f"category '{category}'"

        # 4. Global fallback
        if self.peer_baselines_["global"] is not None:
            return self.peer_baselines_["global"], "global", "all comparable projects"

        return None, "insufficient", "no baseline available"

    def _evaluate_against_peers(
        self,
        cost: float,
        stats: Dict[str, Any],
        peer_label: str,
    ) -> Tuple[float, bool, List[str], Dict[str, Any]]:
        """Compute 0-100 anomaly score and evidence against peer IQR distribution."""
        q1 = stats["q1"]
        q3 = stats["q3"]
        iqr = stats["iqr"]
        median = stats["median"]
        mean = stats["mean"]
        ub = stats["upper_bound"]
        eub = stats["extreme_upper_bound"]
        lb = stats["lower_bound"]
        count = stats["count"]

        dev_pct = round(((cost - median) / median) * 100, 2) if median > 0 else 0.0

        details = {
            "peer_count": count,
            "peer_median_cost": median,
            "peer_mean_cost": mean,
            "peer_q1": q1,
            "peer_q3": q3,
            "peer_iqr": iqr,
            "peer_upper_bound": ub,
            "peer_extreme_bound": eub,
            "deviation_percentage": dev_pct,
        }

        observations = []

        # Uniform baseline (IQR == 0)
        if iqr == 0.0:
            if cost == q1:
                return 0.0, False, [f"Cost of ₹{cost:,.2f} exactly matches uniform peer baseline cost ({peer_label})."], details
            ratio = (cost - q1) / max(q1, 1.0)
            if ratio > 0:
                score = float(np.clip(60.0 + 35.0 * min(ratio, 3.0) / 3.0, 60.0, 95.0))
                obs = f"Cost of ₹{cost:,.2f} deviates significantly (+{dev_pct:.1f}%) from uniform peer baseline of ₹{q1:,.2f} ({peer_label})."
                return score, True, [obs], details
            return 0.0, False, [f"Cost of ₹{cost:,.2f} is within normal peer distribution ({peer_label})."], details

        # Extreme Outlier (> Q3 + 3.0 * IQR) -> score 81-100
        if cost >= eub:
            excess = cost - eub
            scaled_excess = 1.0 - np.exp(-excess / max(iqr, 1.0))
            score = float(81.0 + 19.0 * scaled_excess)
            obs = (
                f"Cost of ₹{cost:,.2f} is an extreme upper outlier (+{dev_pct:.1f}% vs peer median), "
                f"exceeding 3.0x IQR threshold of ₹{eub:,.2f} ({peer_label} peers: {count}, Q3: ₹{q3:,.2f}, IQR: ₹{iqr:,.2f})."
            )
            return score, True, [obs], details

        # High / Moderate Outlier (> Q3 + 1.5 * IQR) -> score 61-80
        if cost > ub:
            ratio = (cost - ub) / max(eub - ub, 1.0)
            score = float(61.0 + 19.0 * ratio)
            obs = (
                f"Cost of ₹{cost:,.2f} exceeds peer IQR upper bound of ₹{ub:,.2f} (+{dev_pct:.1f}% vs peer median) "
                f"({peer_label} peers: {count}, Q3: ₹{q3:,.2f}, IQR: ₹{iqr:,.2f})."
            )
            return score, True, [obs], details

        # Lower bound outlier (< Q1 - 1.5 * IQR) -> score 40-70
        if cost < lb and lb > 0:
            ratio = (lb - cost) / lb
            score = float(45.0 + 25.0 * ratio)
            obs = (
                f"Cost of ₹{cost:,.2f} falls unusually below peer IQR lower bound of ₹{lb:,.2f} "
                f"({peer_label} peers: {count})."
            )
            return score, True, [obs], details

        # Normal / Inlier (between Q1 and Q3 or up to upper bound) -> score 0-30
        if q3 > q1 and cost > q1:
            normal_ratio = (cost - q1) / max(ub - q1, 1.0)
            score = float(30.0 * normal_ratio)
        else:
            score = 0.0

        obs = f"Cost of ₹{cost:,.2f} is within normal statistical distribution bounds for {peer_label} (median: ₹{median:,.2f}, N={count})."
        return score, False, [obs], details

    def _extract_valid_costs(self, series: pd.Series) -> np.ndarray:
        """Extract valid, positive numeric costs."""
        numeric_series = pd.to_numeric(series, errors="coerce")
        valid = numeric_series[numeric_series.notna() & (numeric_series >= 0)].values
        return valid.astype(float)

    def _compute_iqr_stats(self, values: np.ndarray) -> Dict[str, Any]:
        """Compute standard IQR statistical metrics."""
        q1 = float(np.percentile(values, 25))
        q3 = float(np.percentile(values, 75))
        iqr = float(q3 - q1)
        median = float(np.median(values))
        mean = float(np.mean(values))
        multiplier = self.config["iqr_multiplier"]
        extreme_multiplier = self.config["extreme_iqr_multiplier"]

        return {
            "q1": q1,
            "q3": q3,
            "iqr": iqr,
            "median": median,
            "mean": mean,
            "upper_bound": q3 + (multiplier * iqr),
            "extreme_upper_bound": q3 + (extreme_multiplier * iqr),
            "lower_bound": max(0.0, q1 - (multiplier * iqr)),
            "count": len(values),
        }

    def _fit_isolation_forest(self, data: pd.DataFrame) -> None:
        """Fit unsupervised Isolation Forest on works data."""
        cost_col = self.config["cost_column"]
        year_col = self.config["completion_year_column"]
        features: List[str] = []

        if cost_col in data.columns:
            features.append(cost_col)
        if year_col in data.columns and data[year_col].nunique(dropna=True) > 1:
            features.append(year_col)

        if not features:
            self.iforest_model_ = None
            self.iforest_skip_reason_ = "No numeric features available for work Isolation Forest."
            return

        X = data[features].copy()
        for col in features:
            X[col] = pd.to_numeric(X[col], errors="coerce")
        clean_X = X.dropna()

        min_samples = self.config["min_samples_for_iforest"]
        if len(clean_X) < min_samples:
            self.iforest_model_ = None
            self.iforest_skip_reason_ = f"Sample size (N={len(clean_X)}) is below minimum required ({min_samples}) for Isolation Forest."
            return

        try:
            model = IsolationForest(
                n_estimators=self.config["iforest_n_estimators"],
                contamination=self.config["iforest_contamination"],
                random_state=self.config["iforest_random_state"],
            )
            model.fit(clean_X.values)
            self.iforest_model_ = model
            self.iforest_features_ = features
            self.iforest_skip_reason_ = None
        except Exception as err:
            logger.warning("Failed to fit Isolation Forest on works: %s", err)
            self.iforest_model_ = None
            self.iforest_skip_reason_ = str(err)

    def _predict_iforest(self, data: pd.DataFrame) -> Optional[List[Optional[float]]]:
        """Generate 0-100 Isolation Forest scores for works."""
        if self.iforest_model_ is None or not self.iforest_features_:
            return None

        n_rows = len(data)
        scores: List[Optional[float]] = [None] * n_rows

        working_data = data.copy()
        for col in self.iforest_features_:
            if col not in working_data.columns:
                working_data[col] = np.nan

        X = working_data[self.iforest_features_].copy()
        for col in self.iforest_features_:
            X[col] = pd.to_numeric(X[col], errors="coerce")

        valid_idx = X.dropna().index
        if len(valid_idx) == 0:
            return scores

        try:
            dec_fn = self.iforest_model_.decision_function(X.loc[valid_idx].values)
            norm_scores = 100.0 / (1.0 + np.exp(8.0 * dec_fn))
            for row_idx, s in zip(valid_idx, norm_scores):
                pos = data.index.get_loc(row_idx)
                scores[pos] = float(np.clip(s, 0.0, 100.0))
        except Exception as err:
            logger.warning("Error predicting Isolation Forest: %s", err)

        return scores


# =============================================================================
# 2. MULTI-VARIABLE MP FINANCIAL ANOMALY DETECTOR (MP-LEVEL)
# =============================================================================

class MPFinancialAnomalyDetector:
    """
    Evaluates MP Financial Summary records across multiple financial metrics
    using unsupervised Isolation Forest and robust statistical ratio bounds.

    Uses real fields present in the MPFinancialSummary model:
    - allocated_amount
    - total_expenditure
    - utilization_percentage
    - completed_works_count
    - recommended_works_count
    - completion_rate
    - pending_works
    - unspent_amount
    - completed_works_value
    - in_progress_payments
    - payment_gap_percentage
    """

    CORE_FINANCIAL_FIELDS = [
        "allocated_amount",
        "total_expenditure",
        "utilization_percentage",
        "completed_works_count",
        "recommended_works_count",
        "completion_rate",
        "pending_works",
        "unspent_amount",
        "completed_works_value",
        "in_progress_payments",
        "payment_gap_percentage",
    ]

    DEFAULT_CONFIG = {
        "min_samples_for_iforest": 15,
        "iforest_n_estimators": 100,
        "iforest_contamination": 0.05,
        "iforest_random_state": 42,
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        self.is_fitted_: bool = False
        self.iforest_model_: Optional[IsolationForest] = None
        self.iforest_features_: List[str] = []
        self.iforest_skip_reason_: Optional[str] = None
        self.ratio_baselines_: Dict[str, Dict[str, float]] = {}

    def fit(self, data: pd.DataFrame) -> "MPFinancialAnomalyDetector":
        """Fit financial multivariate model and ratio baselines on MP summary records."""
        if data is None or not isinstance(data, pd.DataFrame) or data.empty:
            self.is_fitted_ = True
            return self

        data = normalize_mp_financial_dataframe(data)
        featured_df = self._extract_financial_features(data)

        for ratio_col in ["expenditure_to_allocation", "unspent_ratio", "completion_ratio", "payment_gap_ratio"]:
            if ratio_col in featured_df.columns:
                valid_vals = featured_df[ratio_col].dropna().values
                if len(valid_vals) >= 4:
                    q1 = float(np.percentile(valid_vals, 25))
                    q3 = float(np.percentile(valid_vals, 75))
                    iqr = float(q3 - q1)
                    self.ratio_baselines_[ratio_col] = {
                        "q1": q1,
                        "q3": q3,
                        "iqr": iqr,
                        "median": float(np.median(valid_vals)),
                        "upper_bound": q3 + 1.5 * iqr,
                        "extreme_upper": q3 + 3.0 * iqr,
                        }

        usable_cols = [c for c in featured_df.columns if featured_df[c].nunique(dropna=True) > 1]
        clean_matrix = featured_df[usable_cols].dropna() if usable_cols else pd.DataFrame()

        min_samples = self.config["min_samples_for_iforest"]
        if len(clean_matrix) >= min_samples:
            try:
                model = IsolationForest(
                    n_estimators=self.config["iforest_n_estimators"],
                    contamination=self.config["iforest_contamination"],
                    random_state=self.config["iforest_random_state"],
                )
                model.fit(clean_matrix.values)
                self.iforest_model_ = model
                self.iforest_features_ = usable_cols
                self.iforest_skip_reason_ = None
            except Exception as err:
                logger.warning("Error fitting MP Financial Isolation Forest: %s", err)
                self.iforest_model_ = None
                self.iforest_skip_reason_ = str(err)
        else:
            self.iforest_model_ = None
            self.iforest_skip_reason_ = (
                f"Sample size (N={len(clean_matrix)}) is below minimum required ({min_samples}) "
                f"for unsupervised Isolation Forest modeling."
            )

        self.is_fitted_ = True
        return self

    def predict(self, data: pd.DataFrame) -> List[Dict[str, Any]]:
        """Evaluate MP financial records and generate 0-100 financial anomaly scores."""
        if not self.is_fitted_:
            self.fit(data)

        if data is None or not isinstance(data, pd.DataFrame) or data.empty:
            return []

        data = normalize_mp_financial_dataframe(data)
        featured_df = self._extract_financial_features(data)
        n_rows = len(data)
        results = []

        iforest_scores = self._predict_iforest(featured_df)

        for i in range(n_rows):
            raw_row = data.iloc[i]

            obs: List[str] = []
            ratio_scores: List[float] = []

            avail_cols = [c for c in self.CORE_FINANCIAL_FIELDS if c in data.columns and safe_float(raw_row.get(c)) is not None]
            missing_cols = [c for c in self.CORE_FINANCIAL_FIELDS if c not in avail_cols]

            if not avail_cols:
                results.append({
                    "financial_anomaly_score": None,
                    "is_anomalous": False,
                    "status": "insufficient_data",
                    "method": "insufficient_data",
                    "observations": ["No MP financial summary metrics available; financial anomaly scoring skipped."],
                    "details": {
                        "available_features": [],
                        "missing_fields": self.CORE_FINANCIAL_FIELDS,
                        "derived_ratios": {},
                    }
                })
                continue

            # Evaluate expenditure vs allocation
            exp = safe_float(raw_row.get("total_expenditure"))
            alloc = safe_float(raw_row.get("allocated_amount"))
            unspent = safe_float(raw_row.get("unspent_amount"))
            pay_gap = safe_float(raw_row.get("payment_gap_percentage"))
            comp_count = safe_float(raw_row.get("completed_works_count"))
            rec_count = safe_float(raw_row.get("recommended_works_count"))
            in_prog = safe_float(raw_row.get("in_progress_payments"))

            derived_ratios = {}
            if exp is not None and alloc is not None and alloc > 0:
                exp_ratio = exp / alloc
                derived_ratios["expenditure_to_allocation"] = round(exp_ratio, 4)
                if exp_ratio > 1.05:
                    excess_pct = (exp_ratio - 1.0) * 100
                    s = min(60.0 + excess_pct * 1.5, 95.0)
                    ratio_scores.append(s)
                    obs.append(f"Total expenditure (₹{exp:,.2f}) exceeds allocated funds (₹{alloc:,.2f}) by {excess_pct:.1f}%.")

            if unspent is not None and alloc is not None and alloc > 0:
                unspent_ratio = unspent / alloc
                derived_ratios["unspent_ratio"] = round(unspent_ratio, 4)
                if unspent_ratio > 0.80:
                    s = min(50.0 + (unspent_ratio - 0.80) * 100.0, 90.0)
                    ratio_scores.append(s)
                    obs.append(f"Unspent balance of ₹{unspent:,.2f} represents {unspent_ratio * 100:.1f}% of total allocation.")

            if comp_count is not None and rec_count is not None and rec_count > 0:
                derived_ratios["completion_ratio"] = round(comp_count / rec_count, 4)

            if in_prog is not None and exp is not None and exp > 0:
                derived_ratios["payment_gap_ratio"] = round(in_prog / exp, 4)

            if pay_gap is not None:
                derived_ratios["payment_gap_percentage"] = pay_gap
                if pay_gap > 45.0:
                    s = min(55.0 + (pay_gap - 45.0) * 1.0, 90.0)
                    ratio_scores.append(s)
                    obs.append(f"Payment gap is elevated at {pay_gap:.1f}%, indicating significant liabilities relative to completed works.")

            if_score = iforest_scores[i] if iforest_scores is not None else None
            method = "isolation_forest" if if_score is not None else "statistical_ratio_analysis"

            if if_score is not None and ratio_scores:
                final_score = max(if_score * 0.6 + max(ratio_scores) * 0.4, max(ratio_scores))
            elif if_score is not None:
                final_score = if_score
            elif ratio_scores:
                final_score = max(ratio_scores)
            else:
                final_score = 15.0

            if not obs:
                if if_score is not None and if_score >= 60.0:
                    obs.append(f"Multi-variable Isolation Forest flags structural financial pattern anomaly (signal: {if_score:.1f}/100).")
                else:
                    obs.append("MP financial metrics, allocations, and expenditure patterns are within normal operational parameters.")

            if self.iforest_skip_reason_ and if_score is None:
                obs.append(f"[{self.iforest_skip_reason_}]")

            final_score = clip_score(final_score, 0.0, 100.0)
            is_anom = bool(final_score >= 60.0)

            results.append({
                "financial_anomaly_score": round(final_score, 2) if final_score is not None else None,
                "is_anomalous": is_anom,
                "status": "anomalous" if is_anom else "normal",
                "method": method,
                "observations": obs,
                "details": {
                    "available_features": avail_cols,
                    "missing_fields": missing_cols,
                    "derived_ratios": derived_ratios,
                    "isolation_forest_score": round(if_score, 2) if if_score is not None else None,
                }
            })

        return results

    def _extract_financial_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Extract numeric columns and compute derived financial ratios."""
        feat_df = pd.DataFrame(index=data.index)

        for col in self.CORE_FINANCIAL_FIELDS:
            if col in data.columns:
                feat_df[col] = data[col].apply(safe_float)
            else:
                feat_df[col] = np.nan

        # Derived Ratios (only calculated when both operands are valid)
        feat_df["expenditure_to_allocation"] = [
            safe_ratio(e, a) for e, a in zip(feat_df["total_expenditure"], feat_df["allocated_amount"])
        ]

        feat_df["unspent_ratio"] = [
            safe_ratio(u, a) for u, a in zip(feat_df["unspent_amount"], feat_df["allocated_amount"])
        ]

        feat_df["completion_ratio"] = [
            safe_ratio(c, r) for c, r in zip(feat_df["completed_works_count"], feat_df["recommended_works_count"])
        ]

        feat_df["payment_gap_ratio"] = [
            safe_ratio(p, e) for p, e in zip(feat_df["in_progress_payments"], feat_df["total_expenditure"])
        ]

        return feat_df

    def _predict_iforest(self, featured_df: pd.DataFrame) -> Optional[List[Optional[float]]]:
        """Predict Isolation Forest scores on feature matrix."""
        if self.iforest_model_ is None or not self.iforest_features_:
            return None

        n_rows = len(featured_df)
        scores: List[Optional[float]] = [None] * n_rows

        # Ensure all trained features exist in featured_df (if missing, initialize as NaN)
        for col in self.iforest_features_:
            if col not in featured_df.columns:
                featured_df[col] = np.nan

        X = featured_df[self.iforest_features_].copy()

        valid_idx = X.dropna().index
        if len(valid_idx) == 0:
            return scores

        try:
            dec_fn = self.iforest_model_.decision_function(X.loc[valid_idx].values)
            norm_scores = 100.0 / (1.0 + np.exp(8.0 * dec_fn))
            for row_idx, s in zip(valid_idx, norm_scores):
                pos = featured_df.index.get_loc(row_idx)
                scores[pos] = float(np.clip(s, 0.0, 100.0))
        except Exception as err:
            logger.warning("Error in MP financial Isolation Forest prediction: %s", err)

        return scores


# =============================================================================
# 3. UTILIZATION ANOMALY DETECTOR (MP-LEVEL)
# =============================================================================

class UtilizationAnomalyDetector:
    """
    Evaluates MP-level utilization rates against cohort statistical distributions,
    cross-references expenditure-to-allocation with reported utilization percentage,
    and identifies utilization bottlenecks and data inconsistencies.

    Fields used:
    - allocated_amount
    - total_expenditure
    - utilization_percentage
    - unspent_amount
    - completion_rate
    """

    DEFAULT_CONFIG = {
        "discrepancy_threshold_pct": 5.0,
        "min_cohort_samples": 4,
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        self.is_fitted_: bool = False
        self.cohort_stats_: Optional[Dict[str, float]] = None

    def fit(self, data: pd.DataFrame) -> "UtilizationAnomalyDetector":
        """Compute cohort distribution of utilization percentages."""
        if data is None or not isinstance(data, pd.DataFrame) or data.empty:
            self.is_fitted_ = True
            return self

        data = normalize_mp_financial_dataframe(data)

        valid_utilizations = []
        for _, row in data.iterrows():
            alloc = safe_float(row.get("allocated_amount"))
            exp = safe_float(row.get("total_expenditure"))
            rep = safe_float(row.get("utilization_percentage"))

            u = None
            if alloc is not None and alloc > 0 and exp is not None:
                u = (exp / alloc) * 100.0
            elif rep is not None:
                u = rep

            if u is not None and u >= 0:
                valid_utilizations.append(u)

        if len(valid_utilizations) >= self.config["min_cohort_samples"]:
            arr = np.array(valid_utilizations)
            q1 = float(np.percentile(arr, 25))
            q3 = float(np.percentile(arr, 75))
            iqr = float(q3 - q1)
            self.cohort_stats_ = {
                "q1": q1,
                "q3": q3,
                "iqr": iqr,
                "median": float(np.median(arr)),
                "mean": float(np.mean(arr)),
                "count": len(arr),
            }

        self.is_fitted_ = True
        return self

    def predict(self, data: pd.DataFrame) -> List[Dict[str, Any]]:
        """Score utilization records and report discrepancies and outlier signals."""
        if not self.is_fitted_:
            self.fit(data)

        if data is None or not isinstance(data, pd.DataFrame) or data.empty:
            return []

        data = normalize_mp_financial_dataframe(data)
        results = []
        n_rows = len(data)

        for i in range(n_rows):
            row = data.iloc[i]
            alloc = safe_float(row.get("allocated_amount"))
            exp = safe_float(row.get("total_expenditure"))
            rep_util = safe_float(row.get("utilization_percentage"))
            unspent = safe_float(row.get("unspent_amount"))

            calc_util: Optional[float] = None
            if alloc is not None and exp is not None:
                if alloc > 0:
                    calc_util = round((exp / alloc) * 100.0, 2)

            effective_util = calc_util if calc_util is not None else rep_util

            if effective_util is None:
                results.append({
                    "utilization_anomaly_score": None,
                    "is_anomalous": False,
                    "status": "insufficient_data",
                    "method": "insufficient_data",
                    "actual_utilization": None,
                    "calculated_utilization": None,
                    "reported_utilization": None,
                    "discrepancy": None,
                    "peer_median": self.cohort_stats_["median"] if self.cohort_stats_ else None,
                    "peer_count": self.cohort_stats_["count"] if self.cohort_stats_ else 0,
                    "peer_statistics": self.cohort_stats_,
                    "unspent_ratio": None,
                    "observations": ["Allocation and expenditure metrics are unavailable; utilization evaluation skipped."],
                    "details": {
                        "allocated_amount": alloc,
                        "total_expenditure": exp,
                    }
                })
                continue

            obs: List[str] = []
            score_components: List[float] = []

            # 1. Discrepancy Check between reported and calculated utilization
            discrepancy: Optional[float] = None
            if calc_util is not None and rep_util is not None:
                discrepancy = round(abs(calc_util - rep_util), 2)
                if discrepancy > self.config["discrepancy_threshold_pct"]:
                    disc_score = min(40.0 + discrepancy * 1.2, 85.0)
                    score_components.append(disc_score)
                    obs.append(
                        f"Data inconsistency: Reported utilization ({rep_util:.1f}%) diverges materially from "
                        f"computed expenditure-to-allocation ratio ({calc_util:.1f}%) by {discrepancy:.1f}%."
                    )

            unspent_ratio = round(unspent / alloc, 4) if unspent is not None and alloc is not None and alloc > 0 else None

            # 2. Cohort Distribution Comparison
            peer_med = self.cohort_stats_["median"] if self.cohort_stats_ else None
            peer_cnt = self.cohort_stats_["count"] if self.cohort_stats_ else 0

            if self.cohort_stats_ is not None and peer_med is not None:
                q1 = self.cohort_stats_["q1"]
                iqr = self.cohort_stats_["iqr"]
                lower_bound = max(0.0, q1 - 1.5 * iqr)

                if effective_util < lower_bound or (effective_util < 25.0 and peer_med > 50.0):
                    deficit = peer_med - effective_util
                    s = min(60.0 + deficit * 0.4, 90.0)
                    score_components.append(s)
                    unspent_clause = f" with unspent funds of ₹{unspent:,.2f}" if unspent is not None else ""
                    obs.append(
                        f"Utilization of {effective_util:.1f}% is significantly lower than cohort median of {peer_med:.1f}% "
                        f"(N={peer_cnt}{unspent_clause})."
                    )

                elif effective_util > 100.0:
                    over_pct = effective_util - 100.0
                    s = min(50.0 + over_pct * 1.5, 85.0)
                    score_components.append(s)
                    obs.append(f"Recorded expenditure exceeds 100% of allocation (utilization: {effective_util:.1f}%).")

            if score_components:
                final_score = max(score_components)
            else:
                final_score = 10.0

            if not obs:
                cohort_clause = f" (cohort median: {peer_med:.1f}%, N={peer_cnt})" if peer_med is not None else ""
                obs.append(f"Fund utilization rate of {effective_util:.1f}% is within expected operational distribution{cohort_clause}.")

            final_score = clip_score(final_score, 0.0, 100.0)
            is_anom = bool(final_score >= 60.0)

            results.append({
                "utilization_anomaly_score": round(final_score, 2) if final_score is not None else None,
                "is_anomalous": is_anom,
                "status": "anomalous" if is_anom else "normal",
                "method": "cohort_utilization_distribution",
                "actual_utilization": effective_util,
                "calculated_utilization": calc_util,
                "reported_utilization": rep_util,
                "discrepancy": discrepancy,
                "peer_count": peer_cnt,
                "peer_median": peer_med,
                "peer_statistics": self.cohort_stats_,
                "unspent_ratio": unspent_ratio,
                "observations": obs,
                "details": {
                    "allocated_amount": alloc,
                    "total_expenditure": exp,
                    "unspent_amount": unspent,
                    "effective_utilization": effective_util,
                    "calculated_utilization": calc_util,
                    "reported_utilization": rep_util,
                    "discrepancy": discrepancy,
                    "cohort_q1": self.cohort_stats_["q1"] if self.cohort_stats_ else None,
                    "cohort_q3": self.cohort_stats_["q3"] if self.cohort_stats_ else None,
                }
            })

        return results


# =============================================================================
# 4. UNIFIED PUBLIC ANOMALY DETECTOR
# =============================================================================

class AnomalyDetector:
    """
    Unified public entry point for JanDrishti ML Anomaly Detection.

    Automatically routes:
    - Work records -> Cost Anomaly Detector
    - MP financial records -> Financial Anomaly & Utilization Anomaly Detectors
    - Combined datasets -> Evaluates all available anomaly signals

    Produces three independent 0-100 scores:
    - cost_anomaly_score (alias: cost_score)
    - financial_anomaly_score (alias: ml_anomaly_score)
    - utilization_anomaly_score (alias: utilization_score)

    Exposes structured evidence and explanations for Risk Engine and Investigation Agent.
    """

    DEFAULT_CONFIG = {
        "anomaly_flag_threshold": 60.0,
        "cost_column": "cost",
        "category_column": "category",
        "district_column": "district",
        "constituency_column": "constituency",
        "completion_date_column": "completion_date",
        "completion_year_column": "completion_year",
        "min_valid_year": 1993,
        "max_valid_year": 2030,
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        self.is_fitted_: bool = False

        self.cost_detector = CostAnomalyDetector(self.config)
        self.financial_detector = MPFinancialAnomalyDetector(self.config)
        self.utilization_detector = UtilizationAnomalyDetector(self.config)

    def fit(self, data: pd.DataFrame) -> "AnomalyDetector":
        """Fit all relevant sub-detectors based on schema detection."""
        if data is None or not isinstance(data, pd.DataFrame) or data.empty:
            self.is_fitted_ = True
            return self

        norm_data = normalize_mp_financial_dataframe(data)

        # 1. Fit Cost Detector if work-level cost is present
        if self.config["cost_column"] in norm_data.columns:
            self.cost_detector.fit(norm_data)

        # 2. Fit Financial & Utilization Detectors if MP-level columns are present
        if any(col in norm_data.columns for col in MPFinancialAnomalyDetector.CORE_FINANCIAL_FIELDS):
            self.financial_detector.fit(norm_data)
            self.utilization_detector.fit(norm_data)

        self.is_fitted_ = True
        return self

    def predict(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Score records across all applicable anomaly dimensions.
        Returns a DataFrame preserving all original columns while adding:
        - cost_anomaly_score (0-100 or None)
        - financial_anomaly_score (0-100 or None)
        - utilization_anomaly_score (0-100 or None)
        - cost_score (alias)
        - ml_anomaly_score (alias)
        - utilization_score (alias)
        - anomaly_score (composite 0-100)
        - is_anomaly (bool)
        - anomaly_type (str)
        - explanation (str)
        - evidence (dict)
        """
        if not self.is_fitted_:
            self.fit(data)

        if data is None or not isinstance(data, pd.DataFrame):
            raise ValueError("Input data must be a valid pandas DataFrame.")

        if data.empty:
            res = data.copy()
            for col in [
                "cost_anomaly_score", "financial_anomaly_score", "utilization_anomaly_score",
                "cost_score", "ml_anomaly_score", "utilization_score", "anomaly_score",
            ]:
                res[col] = pd.Series(dtype=float)
            res["is_anomaly"] = pd.Series(dtype=bool)
            res["anomaly_type"] = pd.Series(dtype=str)
            res["explanation"] = pd.Series(dtype=str)
            res["evidence"] = pd.Series(dtype=object)
            return res

        res = normalize_mp_financial_dataframe(data)
        n_rows = len(res)

        has_cost = self.config["cost_column"] in res.columns
        has_financial = any(col in res.columns for col in MPFinancialAnomalyDetector.CORE_FINANCIAL_FIELDS)

        cost_res = self.cost_detector.predict(res) if has_cost else None
        fin_res = self.financial_detector.predict(res) if has_financial else None
        util_res = self.utilization_detector.predict(res) if has_financial else None

        cost_scores: List[Optional[float]] = [None] * n_rows
        fin_scores: List[Optional[float]] = [None] * n_rows
        util_scores: List[Optional[float]] = [None] * n_rows
        composite_scores: List[float] = [0.0] * n_rows
        is_anom_list: List[bool] = [False] * n_rows
        anom_types_list: List[str] = ["none"] * n_rows
        explanations: List[str] = [""] * n_rows
        evidence_list: List[Dict[str, Any]] = [{}] * n_rows

        threshold = self.config["anomaly_flag_threshold"]

        for i in range(n_rows):
            row = res.iloc[i]
            row_signals: List[str] = []
            row_reasons: List[str] = []
            ev: Dict[str, Any] = {
                "observations": [],
                "cost_details": None,
                "financial_details": None,
                "utilization_details": None,
            }

            active_scores: List[float] = []

            # 1. Cost signal
            if cost_res is not None:
                cr = cost_res[i]
                c_score = cr["cost_anomaly_score"]
                cost_scores[i] = c_score
                ev["cost_details"] = cr["details"]
                if c_score is not None:
                    active_scores.append(c_score)
                    if cr["is_anomalous"] or c_score >= threshold:
                        row_signals.append("cost_anomaly")
                if cr["observations"]:
                    row_reasons.extend(cr["observations"])
                    ev["observations"].extend(cr["observations"])

            # 2. Financial signal
            if fin_res is not None:
                fr = fin_res[i]
                f_score = fr["financial_anomaly_score"]
                fin_scores[i] = f_score
                ev["financial_details"] = fr["details"]
                if f_score is not None:
                    active_scores.append(f_score)
                    if fr["is_anomalous"] or f_score >= threshold:
                        row_signals.append("financial_anomaly")
                if fr["observations"]:
                    row_reasons.extend(fr["observations"])
                    ev["observations"].extend(fr["observations"])

            # 3. Utilization signal
            if util_res is not None:
                ur = util_res[i]
                u_score = ur["utilization_anomaly_score"]
                util_scores[i] = u_score
                ev["utilization_details"] = ur["details"]
                if u_score is not None:
                    active_scores.append(u_score)
                    if ur["is_anomalous"] or u_score >= threshold:
                        row_signals.append("utilization_anomaly")
                if ur["observations"]:
                    row_reasons.extend(ur["observations"])
                    ev["observations"].extend(ur["observations"])

            # 4. Timeline consistency signal (work level)
            timeline_score, timeline_flag, timeline_desc = self._evaluate_timeline(
                completion_date=row.get(self.config["completion_date_column"]),
                completion_year=row.get(self.config["completion_year_column"]),
            )
            if timeline_flag:
                row_signals.append("timeline_anomaly")
                row_reasons.append(timeline_desc)
                ev["observations"].append(timeline_desc)
                active_scores.append(timeline_score)

            comp_score = max(active_scores) if active_scores else 0.0
            composite_scores[i] = round(comp_score, 2)

            is_record_anom = bool(comp_score >= threshold or len(row_signals) > 0)
            is_anom_list[i] = is_record_anom
            anom_types_list[i] = ", ".join(row_signals) if row_signals else "none"

            if row_reasons:
                explanations[i] = " ".join(row_reasons)
            else:
                explanations[i] = "Metrics are within normal operational and statistical bounds."

            evidence_list[i] = ev

        res["cost_anomaly_score"] = cost_scores
        res["financial_anomaly_score"] = fin_scores
        res["utilization_anomaly_score"] = util_scores

        # Downstream compatibility aliases for Jayant's Risk Engine
        res["cost_score"] = cost_scores
        res["ml_anomaly_score"] = fin_scores if has_financial else cost_scores
        res["utilization_score"] = util_scores

        # Legacy backward-compatibility composite score
        res["anomaly_score"] = composite_scores

        res["is_anomaly"] = is_anom_list
        res["anomaly_type"] = anom_types_list
        res["explanation"] = explanations
        res["evidence"] = evidence_list

        return res

    def _evaluate_timeline(
        self,
        completion_date: Any,
        completion_year: Any,
    ) -> Tuple[float, bool, Optional[str]]:
        """Validate operational bounds on completion dates."""
        min_year = self.config["min_valid_year"]
        max_year = self.config["max_valid_year"]

        parsed_date: Optional[datetime] = None
        if completion_date is not None and not pd.isna(completion_date):
            if isinstance(completion_date, datetime):
                parsed_date = completion_date
            elif isinstance(completion_date, str):
                try:
                    parsed_date = datetime.fromisoformat(completion_date.replace("Z", ""))
                except Exception:
                    pass

        parsed_year: Optional[int] = None
        if completion_year is not None and not pd.isna(completion_year):
            parsed_year = safe_int(completion_year)
        elif parsed_date:
            parsed_year = parsed_date.year

        if parsed_year is not None:
            if parsed_year < min_year:
                return 75.0, True, f"Recorded completion year ({parsed_year}) precedes the inception of the MPLADS scheme ({min_year})."
            if parsed_year > max_year:
                return 80.0, True, f"Recorded completion year ({parsed_year}) is implausibly in the future."

        if parsed_date and parsed_year and parsed_date.year != parsed_year:
            return 60.0, True, f"Date discrepancy: completion date indicates year {parsed_date.year}, while completion_year indicates {parsed_year}."

        return 0.0, False, None

    def to_records(self, df_with_predictions: pd.DataFrame) -> List[Dict[str, Any]]:
        """Convert scored DataFrame into standardized dictionaries for API or Risk Engine."""
        records: List[Dict[str, Any]] = []
        for _, row in df_with_predictions.iterrows():
            rec = {
                "work_id": row.get("work_id", None) if pd.notna(row.get("work_id", None)) else None,
                "mp_name": row.get("mp_name", None) if pd.notna(row.get("mp_name", None)) else None,
                "cost_anomaly_score": safe_float(row.get("cost_anomaly_score")),
                "financial_anomaly_score": safe_float(row.get("financial_anomaly_score")),
                "utilization_anomaly_score": safe_float(row.get("utilization_anomaly_score")),
                "cost_score": safe_float(row.get("cost_score")),
                "ml_anomaly_score": safe_float(row.get("ml_anomaly_score")),
                "utilization_score": safe_float(row.get("utilization_score")),
                "anomaly_score": safe_float(row.get("anomaly_score")),
                "is_anomaly": bool(row.get("is_anomaly", False)),
                "anomaly_type": str(row.get("anomaly_type", "none")),
                "explanation": str(row.get("explanation", "")),
                "evidence": row.get("evidence", {}),
            }
            records.append(rec)
        return records

    def get_baseline_summary(self) -> Dict[str, Any]:
        """Return diagnostic baseline parameters of fitted detectors."""
        return {
            "is_fitted": self.is_fitted_,
            "cost_detector_fitted": self.cost_detector.is_fitted_,
            "cost_global_stats": self.cost_detector.peer_baselines_["global"],
            "cost_category_count": len(self.cost_detector.peer_baselines_["category"]),
            "financial_detector_fitted": self.financial_detector.is_fitted_,
            "financial_iforest_fitted": self.financial_detector.iforest_model_ is not None,
            "financial_skip_reason": self.financial_detector.iforest_skip_reason_,
            "utilization_detector_fitted": self.utilization_detector.is_fitted_,
            "utilization_cohort_stats": self.utilization_detector.cohort_stats_,
        }
