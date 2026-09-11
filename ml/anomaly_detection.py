"""
JanDrishti - Anomaly Detection Module

Provides interfaces and pipelines for detecting statistical and pattern-based anomalies
in MPLADS project expenditures, timelines, and allocation metrics.

Note: Anomaly detection flags statistical outliers and data inconsistencies for human review;
it does NOT claim that an anomaly constitutes fraud.
"""

from datetime import datetime
import logging
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

logger = logging.getLogger("jandrishti.ml.anomaly")


class AnomalyDetector:
    """
    Statistical and machine learning anomaly detection pipeline for MPLADS works.

    Implements:
    1. IQR-based Cost Anomaly Detection (univariate statistical distribution)
    2. Isolation Forest Anomaly Detection (unsupervised multivariate isolation)
    3. Timeline and Date Consistency Checks (within validated data boundaries)

    Important Principles:
    - Never fabricates missing values or converts NULL to zero.
    - Flags statistical cost anomalies; does NOT declare 'cost overrun' without a sanctioned baseline.
    - Never makes accusations of fraud; provides transparent, evidence-based explanations.
    """

    DEFAULT_CONFIG: Dict[str, Any] = {
        # Cost IQR settings
        "cost_column": "cost",
        "iqr_multiplier": 1.5,
        "extreme_iqr_multiplier": 3.0,
        "min_samples_for_iqr": 4,

        # Category-based grouping
        "group_by_category": True,
        "category_column": "category",
        "min_category_samples": 5,

        # Isolation Forest settings
        "enable_isolation_forest": True,
        "iforest_random_state": 42,
        "iforest_contamination": 0.05,
        "iforest_n_estimators": 100,
        "min_samples_for_iforest": 15,

        # Timeline validation bounds (MPLADS established Dec 1993)
        "completion_date_column": "completion_date",
        "completion_year_column": "completion_year",
        "min_valid_year": 1993,
        "max_valid_year": 2030,

        # Score blending & flagging
        "anomaly_threshold": 0.5,
        "iqr_weight": 0.6,
        "iforest_weight": 0.4,
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        self.is_fitted_: bool = False
        self.baseline_stats_: Dict[str, Any] = {}
        self.iforest_model_: Optional[IsolationForest] = None
        self.iforest_skip_reason_: Optional[str] = None
        self.iforest_feature_cols_: List[str] = []

    # -------------------------------------------------------------------------
    # FIT
    # -------------------------------------------------------------------------
    def fit(self, data: pd.DataFrame) -> "AnomalyDetector":
        """
        Fit baseline statistical models and unsupervised anomaly detectors
        on ingested MPLADS works records.
        """
        if data is None or not isinstance(data, pd.DataFrame) or data.empty:
            logger.warning("Empty or invalid DataFrame passed to fit(). Skipping model training.")
            self.is_fitted_ = True
            return self

        cost_col = self.config["cost_column"]
        self.baseline_stats_ = {
            "global_cost": None,
            "category_cost": {},
            "total_records": len(data),
        }

        # 1. Compute Global Cost IQR baseline
        if cost_col in data.columns:
            valid_costs = self._extract_valid_costs(data[cost_col])
            if len(valid_costs) >= self.config["min_samples_for_iqr"]:
                self.baseline_stats_["global_cost"] = self._compute_iqr_stats(valid_costs)
                logger.info(
                    "Global cost baseline established on %d records: Q1=%.2f, Q3=%.2f, IQR=%.2f, UpperBound=%.2f",
                    len(valid_costs),
                    self.baseline_stats_["global_cost"]["q1"],
                    self.baseline_stats_["global_cost"]["q3"],
                    self.baseline_stats_["global_cost"]["iqr"],
                    self.baseline_stats_["global_cost"]["upper_bound"],
                )
            else:
                logger.info(
                    "Sample size (%d valid costs) is below minimum (%d) for global IQR.",
                    len(valid_costs),
                    self.config["min_samples_for_iqr"],
                )

        # 2. Compute Category-wise Cost IQR baselines (if enabled and category column exists)
        cat_col = self.config["category_column"]
        if self.config["group_by_category"] and cat_col in data.columns and cost_col in data.columns:
            for category_val, cat_group in data.groupby(cat_col):
                if pd.notna(category_val):
                    cat_costs = self._extract_valid_costs(cat_group[cost_col])
                    if len(cat_costs) >= self.config["min_category_samples"]:
                        self.baseline_stats_["category_cost"][str(category_val)] = self._compute_iqr_stats(cat_costs)

        # 3. Fit Isolation Forest if enabled and sufficient valid records exist
        if self.config["enable_isolation_forest"]:
            self._fit_isolation_forest(data)

        self.is_fitted_ = True
        return self

    # -------------------------------------------------------------------------
    # PREDICT
    # -------------------------------------------------------------------------
    def predict(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Score records and return anomaly indicators, composite anomaly scores,
        anomaly types, and explainability narratives.

        Preserves all original columns while adding:
        - anomaly_score: float in [0.0, 1.0]
        - is_anomaly: bool
        - anomaly_type: str ('none', 'cost_anomaly', 'timeline_anomaly', etc.)
        - explanation: str (evidence-based, objective explanation)
        """
        if data is None or not isinstance(data, pd.DataFrame):
            raise ValueError("Input data must be a valid pandas DataFrame.")

        # Ensure model is fitted before prediction
        if not self.is_fitted_:
            logger.info("Detector predict() called without prior fit(); fitting on provided data.")
            self.fit(data)

        if data.empty:
            result_df = data.copy()
            result_df["anomaly_score"] = pd.Series(dtype=float)
            result_df["is_anomaly"] = pd.Series(dtype=bool)
            result_df["anomaly_type"] = pd.Series(dtype=str)
            result_df["explanation"] = pd.Series(dtype=str)
            return result_df

        result_df = data.copy()
        n_rows = len(result_df)

        scores: List[float] = [0.0] * n_rows
        is_anom: List[bool] = [False] * n_rows
        anom_types: List[str] = ["none"] * n_rows
        explanations: List[str] = [""] * n_rows

        cost_col = self.config["cost_column"]
        cat_col = self.config["category_column"]
        date_col = self.config["completion_date_column"]
        year_col = self.config["completion_year_column"]
        threshold = self.config["anomaly_threshold"]

        # Run Isolation Forest prediction on valid feature matrix if model exists
        iforest_scores = self._predict_isolation_forest(result_df)

        for i in range(n_rows):
            row = result_df.iloc[i]
            row_signals: List[str] = []
            row_reasons: List[str] = []

            # --- A. Cost Evaluation ---
            raw_cost = row.get(cost_col, None) if cost_col in result_df.columns else None
            cost_score, cost_flag, cost_desc = self._evaluate_cost(
                cost=raw_cost,
                category=row.get(cat_col, None) if cat_col in result_df.columns else None,
            )
            if cost_flag:
                row_signals.append("cost_anomaly")
            if cost_desc:
                row_reasons.append(cost_desc)

            # --- B. Isolation Forest Evaluation ---
            iforest_score = iforest_scores[i] if iforest_scores is not None else None
            iforest_flag = False
            if iforest_score is not None:
                if iforest_score >= threshold:
                    iforest_flag = True
                    if "cost_anomaly" not in row_signals:
                        row_signals.append("multivariate_anomaly")
                    row_reasons.append(
                        f"Unsupervised Isolation Forest flags structural outlier characteristics "
                        f"(anomaly signal: {iforest_score:.2f})."
                    )

            # --- C. Timeline Evaluation ---
            raw_date = row.get(date_col, None) if date_col in result_df.columns else None
            raw_year = row.get(year_col, None) if year_col in result_df.columns else None
            timeline_score, timeline_flag, timeline_desc = self._evaluate_timeline(
                completion_date=raw_date,
                completion_year=raw_year,
            )
            if timeline_flag:
                row_signals.append("timeline_anomaly")
            if timeline_desc:
                row_reasons.append(timeline_desc)

            # --- D. Composite Score Calculation ---
            # Blend IQR cost score and Isolation Forest score if available
            if cost_score is not None and iforest_score is not None:
                blended_numeric = (
                    cost_score * self.config["iqr_weight"]
                    + iforest_score * self.config["iforest_weight"]
                )
            elif cost_score is not None:
                blended_numeric = cost_score
            elif iforest_score is not None:
                blended_numeric = iforest_score
            else:
                blended_numeric = 0.0

            final_score = max(blended_numeric, timeline_score)
            final_score = float(np.clip(final_score, 0.0, 1.0))
            final_score = round(final_score, 4)

            is_record_anomalous = bool(final_score >= threshold or len(row_signals) > 0)

            # Assemble Explanation Narrative
            if not row_reasons:
                if cost_score is not None and cost_score < threshold:
                    explanation_text = "Project cost and timeline metrics are within normal statistical distribution bounds."
                else:
                    explanation_text = "No statistical anomalies detected on available record fields."
            else:
                explanation_text = " ".join(row_reasons)

            # If small sample size prevented Isolation Forest, document transparency
            if self.iforest_skip_reason_ and not iforest_scores:
                explanation_text += f" [{self.iforest_skip_reason_}]"

            scores[i] = final_score
            is_anom[i] = is_record_anomalous
            anom_types[i] = ", ".join(row_signals) if row_signals else "none"
            explanations[i] = explanation_text

        result_df["anomaly_score"] = scores
        result_df["is_anomaly"] = is_anom
        result_df["anomaly_type"] = anom_types
        result_df["explanation"] = explanations

        return result_df

    # -------------------------------------------------------------------------
    # HELPER METHODS: IQR & COST
    # -------------------------------------------------------------------------
    def _extract_valid_costs(self, series: pd.Series) -> np.ndarray:
        """
        Extract valid, non-null, non-negative numeric cost values.
        Missing values are completely excluded from baseline distribution calculation.
        """
        numeric_series = pd.to_numeric(series, errors="coerce")
        valid = numeric_series[numeric_series.notna() & (numeric_series >= 0)].values
        return valid.astype(float)

    def _compute_iqr_stats(self, values: np.ndarray) -> Dict[str, float]:
        """Compute quartiles, IQR, and upper/lower fences."""
        q1 = float(np.percentile(values, 25))
        q3 = float(np.percentile(values, 75))
        iqr = float(q3 - q1)
        median = float(np.median(values))
        mean = float(np.mean(values))
        std = float(np.std(values))

        multiplier = self.config["iqr_multiplier"]
        extreme_multiplier = self.config["extreme_iqr_multiplier"]

        upper_bound = q3 + (multiplier * iqr)
        extreme_upper = q3 + (extreme_multiplier * iqr)
        lower_bound = max(0.0, q1 - (multiplier * iqr))

        return {
            "q1": q1,
            "q3": q3,
            "iqr": iqr,
            "median": median,
            "mean": mean,
            "std": std,
            "upper_bound": upper_bound,
            "extreme_upper_bound": extreme_upper,
            "lower_bound": lower_bound,
            "count": len(values),
        }

    def _evaluate_cost(
        self,
        cost: Any,
        category: Any = None,
    ) -> Tuple[Optional[float], bool, Optional[str]]:
        """
        Evaluate single cost against fitted baseline IQR distributions.
        Returns: (cost_score, is_anomaly_flag, description)
        """
        # Handle missing cost: NEVER convert to zero, never fabricate
        if cost is None or pd.isna(cost):
            return 0.0, False, "Cost data is missing; cost anomaly detection skipped."

        try:
            cost_val = float(cost)
        except (ValueError, TypeError):
            return 0.0, False, "Cost value is non-numeric; cost anomaly detection skipped."

        # Handle negative cost (anomalous data quality event)
        if cost_val < 0:
            return (
                0.90,
                True,
                f"Negative cost value of ₹{cost_val:,.2f} recorded; project expenditures cannot be negative.",
            )

        # Select category-specific or global baseline
        stats = None
        stat_scope = "global"
        if category and pd.notna(category):
            cat_str = str(category)
            if cat_str in self.baseline_stats_.get("category_cost", {}):
                stats = self.baseline_stats_["category_cost"][cat_str]
                stat_scope = f"category '{cat_str}'"

        if stats is None:
            stats = self.baseline_stats_.get("global_cost")
            stat_scope = "global"

        if stats is None:
            return (
                0.0,
                False,
                f"Cost of ₹{cost_val:,.2f} recorded; baseline sample size is insufficient to compute statistical IQR bounds.",
            )

        q1 = stats["q1"]
        q3 = stats["q3"]
        iqr = stats["iqr"]
        ub = stats["upper_bound"]
        eub = stats["extreme_upper_bound"]
        lb = stats["lower_bound"]

        # Handle constant/uniform baseline dataset (IQR == 0)
        if iqr == 0.0:
            if cost_val == q1:
                return 0.0, False, f"Cost of ₹{cost_val:,.2f} matches uniform baseline cost."
            deviation_ratio = (cost_val - q1) / max(q1, 1.0)
            if deviation_ratio > 0:
                score = float(np.clip(0.60 + 0.30 * min(deviation_ratio, 3.0) / 3.0, 0.60, 0.95))
                return (
                    score,
                    True,
                    f"Cost of ₹{cost_val:,.2f} deviates significantly from uniform baseline of ₹{q1:,.2f}.",
                )
            return 0.0, False, None

        # Standard IQR evaluation
        if cost_val > ub:
            if cost_val >= eub:
                # Extreme upper outlier
                excess = cost_val - eub
                scaled_excess = 1.0 - np.exp(-excess / max(iqr, 1.0))
                score = float(0.85 + 0.15 * scaled_excess)
                desc = (
                    f"Cost of ₹{cost_val:,.2f} is an extreme upper outlier, exceeding 3x IQR threshold of "
                    f"₹{eub:,.2f} ({stat_scope} Q3: ₹{q3:,.2f}, IQR: ₹{iqr:,.2f})."
                )
            else:
                # Moderate upper outlier
                ratio = (cost_val - ub) / max(eub - ub, 1.0)
                score = float(0.50 + 0.35 * ratio)
                desc = (
                    f"Cost of ₹{cost_val:,.2f} exceeds IQR upper bound of "
                    f"₹{ub:,.2f} ({stat_scope} Q3: ₹{q3:,.2f}, IQR: ₹{iqr:,.2f})."
                )
            return score, True, desc

        if cost_val < lb and lb > 0:
            # Lower bound outlier
            ratio = (lb - cost_val) / lb
            score = float(0.50 + 0.30 * ratio)
            desc = f"Cost of ₹{cost_val:,.2f} falls unusually below IQR lower bound of ₹{lb:,.2f} ({stat_scope})."
            return score, True, desc

        # Within normal bounds
        if q3 > q1:
            normal_ratio = max(0.0, (cost_val - q1) / (ub - q1))
            score = float(0.40 * normal_ratio)
        else:
            score = 0.0
        return score, False, None

    # -------------------------------------------------------------------------
    # HELPER METHODS: ISOLATION FOREST
    # -------------------------------------------------------------------------
    def _fit_isolation_forest(self, data: pd.DataFrame) -> None:
        """
        Fit Isolation Forest using valid numeric features.
        Identifiers (work_id, id, source_id) are strictly excluded.
        """
        cost_col = self.config["cost_column"]
        features_to_use: List[str] = []

        if cost_col in data.columns:
            features_to_use.append(cost_col)

        year_col = self.config["completion_year_column"]
        if year_col in data.columns and data[year_col].nunique(dropna=True) > 1:
            features_to_use.append(year_col)

        if not features_to_use:
            self.iforest_model_ = None
            self.iforest_skip_reason_ = "No valid numeric features available for Isolation Forest training."
            return

        # Prepare clean numeric dataset
        X = data[features_to_use].copy()
        for col in features_to_use:
            X[col] = pd.to_numeric(X[col], errors="coerce")

        # Drop rows with NaN in features
        clean_X = X.dropna()

        min_samples = self.config["min_samples_for_iforest"]
        if len(clean_X) < min_samples:
            self.iforest_model_ = None
            self.iforest_skip_reason_ = (
                f"Sample size (N={len(clean_X)}) is below minimum required ({min_samples}) "
                f"for unsupervised Isolation Forest modeling."
            )
            logger.info(self.iforest_skip_reason_)
            return

        try:
            model = IsolationForest(
                n_estimators=self.config["iforest_n_estimators"],
                contamination=self.config["iforest_contamination"],
                random_state=self.config["iforest_random_state"],
            )
            model.fit(clean_X.values)
            self.iforest_model_ = model
            self.iforest_feature_cols_ = features_to_use
            self.iforest_skip_reason_ = None
            logger.info("Isolation Forest fitted successfully on %d records with features: %s", len(clean_X), features_to_use)
        except Exception as err:
            logger.error("Error fitting Isolation Forest: %s", err)
            self.iforest_model_ = None
            self.iforest_skip_reason_ = f"Isolation Forest fitting error: {err}"

    def _predict_isolation_forest(self, data: pd.DataFrame) -> Optional[List[Optional[float]]]:
        """Score rows using fitted Isolation Forest."""
        if self.iforest_model_ is None or not self.iforest_feature_cols_:
            return None

        n_rows = len(data)
        scores: List[Optional[float]] = [None] * n_rows

        X = data[self.iforest_feature_cols_].copy()
        for col in self.iforest_feature_cols_:
            X[col] = pd.to_numeric(X[col], errors="coerce")

        valid_idx = X.dropna().index
        if len(valid_idx) == 0:
            return scores

        valid_X = X.loc[valid_idx].values
        try:
            # decision_function yields negative for outliers, positive for inliers
            dec_fn = self.iforest_model_.decision_function(valid_X)
            # Map decision function to [0.0, 1.0] anomaly score where >= 0.5 is anomalous
            # dec_fn = 0 -> score = 0.5
            # dec_fn < 0 -> score > 0.5
            norm_scores = 1.0 / (1.0 + np.exp(8.0 * dec_fn))

            for row_idx, score_val in zip(valid_idx, norm_scores):
                pos = data.index.get_loc(row_idx)
                scores[pos] = float(np.clip(score_val, 0.0, 1.0))
        except Exception as err:
            logger.warning("Error predicting with Isolation Forest: %s", err)

        return scores

    # -------------------------------------------------------------------------
    # HELPER METHODS: TIMELINE & DATES
    # -------------------------------------------------------------------------
    def _evaluate_timeline(
        self,
        completion_date: Any,
        completion_year: Any,
    ) -> Tuple[float, bool, Optional[str]]:
        """
        Evaluate completion dates for data consistency and operational bounds.
        Note: Project delay/overrun calculation is NOT supported because sanction/start
        dates are not exposed in the completed works feed.
        """
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

        # Evaluate parsed completion year
        parsed_year: Optional[int] = None
        if completion_year is not None and not pd.isna(completion_year):
            try:
                parsed_year = int(float(completion_year))
            except (ValueError, TypeError):
                pass
        elif parsed_date:
            parsed_year = parsed_date.year

        if parsed_year is not None:
            if parsed_year < min_year:
                return (
                    0.75,
                    True,
                    f"Recorded completion year ({parsed_year}) precedes the inception of the MPLADS scheme ({min_year}).",
                )
            if parsed_year > max_year:
                return (
                    0.80,
                    True,
                    f"Recorded completion year ({parsed_year}) is implausibly in the future.",
                )

        # Check year discrepancy between completion_date and completion_year
        if parsed_date and parsed_year and parsed_date.year != parsed_year:
            return (
                0.60,
                True,
                f"Date discrepancy: completion date indicates year {parsed_date.year}, while completion_year indicates {parsed_year}.",
            )

        return 0.0, False, None

    # -------------------------------------------------------------------------
    # UTILITY METHODS
    # -------------------------------------------------------------------------
    def to_records(self, df_with_predictions: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Convert scored DataFrame into standardized dictionaries suitable for
        downstream consumption by the Risk Engine or API serializers.
        """
        records: List[Dict[str, Any]] = []
        for _, row in df_with_predictions.iterrows():
            work_id_val = row.get("work_id", None)
            if pd.isna(work_id_val):
                work_id_val = None

            records.append({
                "work_id": work_id_val,
                "anomaly_score": float(row.get("anomaly_score", 0.0)),
                "is_anomaly": bool(row.get("is_anomaly", False)),
                "anomaly_type": str(row.get("anomaly_type", "none")),
                "explanation": str(row.get("explanation", "")),
            })
        return records

    def get_baseline_summary(self) -> Dict[str, Any]:
        """Return human-readable summary of fitted baseline parameters."""
        return {
            "is_fitted": self.is_fitted_,
            "global_cost": self.baseline_stats_.get("global_cost"),
            "category_count": len(self.baseline_stats_.get("category_cost", {})),
            "isolation_forest_enabled": self.config["enable_isolation_forest"],
            "isolation_forest_fitted": self.iforest_model_ is not None,
            "isolation_forest_skip_reason": self.iforest_skip_reason_,
        }
