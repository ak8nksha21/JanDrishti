"""
JanDrishti - Payment & Financial Execution Anomaly Analysis Module

Evaluates aggregate financial execution risk, fund-flow consistency, and
financial-vs-physical execution alignment across MPLADS MP records and works.

IMPORTANT CONSTRAINTS & PRINCIPLES:
- Does NOT claim transaction-level payment fraud because public data exposes
  aggregate financial returns and summary statements, not granular bank vouchers.
- Uses Isolation Forest when sufficient valid samples exist (>= 10), with
  transparent fallback to robust statistical ratio analysis when data is sparse.
- Highlights explainable discrepancies: e.g. high expenditure with low physical completion,
  or significant payment gaps between recorded completions and disbursements.
"""

from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from ml.config import (
    DEFAULT_MIN_PAYMENT_SAMPLES_IFOREST,
    DEFAULT_PAYMENT_GAP_THRESHOLD_PCT,
    DEFAULT_CRITICAL_PAYMENT_GAP_PCT,
    DEFAULT_DISPROPORTIONATE_EXPENDITURE_PCT,
    DEFAULT_LOW_PHYSICAL_COMPLETION_PCT,
    JANDRISHTI_ANALYTICAL_DISCLAIMER,
)


def safe_float(val: Any) -> Optional[float]:
    """Safely convert input to float. Never converts missing to 0.0."""
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (int, float, np.integer, np.floating)):
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


def safe_ratio(num: Any, den: Any) -> Optional[float]:
    """Safely compute num / den. Returns None if either is missing or den <= 0."""
    n = safe_float(num)
    d = safe_float(den)
    if n is None or d is None or d <= 0.0:
        return None
    return float(n / d)


class PaymentAnomalyDetector:
    """
    Payment & Financial Execution Anomaly Detector.
    Identifies financial-vs-physical execution mismatches and payment gap anomalies.
    """

    DEFAULT_CONFIG = {
        "min_samples_iforest": DEFAULT_MIN_PAYMENT_SAMPLES_IFOREST,
        "payment_gap_threshold_pct": DEFAULT_PAYMENT_GAP_THRESHOLD_PCT,
        "critical_payment_gap_pct": DEFAULT_CRITICAL_PAYMENT_GAP_PCT,
        "disproportionate_expenditure_pct": DEFAULT_DISPROPORTIONATE_EXPENDITURE_PCT,
        "low_physical_completion_pct": DEFAULT_LOW_PHYSICAL_COMPLETION_PCT,
        "iforest_n_estimators": 100,
        "iforest_contamination": 0.05,
        "iforest_random_state": 42,
    }

    FEATURE_COLS = [
        "expenditure_ratio",
        "completion_rate_norm",
        "payment_gap_ratio",
        "unspent_ratio",
    ]

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        self.disclaimer = (
            "JanDrishti analytical indicators based on aggregate financial returns, "
            "not transaction-level bank vouchers."
        )
        self.is_fitted_: bool = False
        self.iforest_model_: Optional[IsolationForest] = None
        self.valid_training_samples_: int = 0

    def _extract_financial_features(self, record: Union[Dict[str, Any], Any]) -> Dict[str, Optional[float]]:
        """
        Extract and normalize key financial execution fields.
        """
        if record is None:
            return {}

        def get_val(keys: List[str]) -> Optional[float]:
            for k in keys:
                if isinstance(record, dict) and k in record:
                    v = safe_float(record.get(k))
                    if v is not None:
                        return v
                elif not isinstance(record, dict) and hasattr(record, k):
                    v = safe_float(getattr(record, k, None))
                    if v is not None:
                        return v
            return None

        allocated = get_val(["allocated_amount", "sanctioned_amount", "sanctioned_cost", "total_recommended_amount"])
        expenditure = get_val(["total_expenditure", "expenditure", "actual_expenditure", "disbursed_amount"])
        utilization = get_val(["utilization_percentage", "expenditure_percentage"])
        payment_gap = get_val(["payment_gap_percentage"])
        completion_rate = get_val(["completion_rate"])
        completed_count = get_val(["completed_works_count"])
        recommended_count = get_val(["recommended_works_count"])
        pending_works = get_val(["pending_works"])
        unspent = get_val(["unspent_amount", "unpaid_balance"])
        in_progress = get_val(["in_progress_payments"])

        # Compute derived metrics where direct percentage is missing
        if utilization is None and allocated is not None and expenditure is not None and allocated > 0:
            utilization = round((expenditure / allocated) * 100.0, 2)

        if completion_rate is None and recommended_count is not None and completed_count is not None and recommended_count > 0:
            completion_rate = round((completed_count / recommended_count) * 100.0, 2)

        expenditure_ratio = (utilization / 100.0) if utilization is not None else None
        completion_rate_norm = (completion_rate / 100.0) if completion_rate is not None else None
        payment_gap_ratio = (payment_gap / 100.0) if payment_gap is not None else None
        unspent_ratio = (unspent / allocated) if (unspent is not None and allocated is not None and allocated > 0) else None

        return {
            "allocated_amount": allocated,
            "total_expenditure": expenditure,
            "utilization_percentage": utilization,
            "completion_rate": completion_rate,
            "payment_gap_percentage": payment_gap,
            "unspent_amount": unspent,
            "in_progress_payments": in_progress,
            "pending_works": pending_works,
            "expenditure_ratio": expenditure_ratio,
            "completion_rate_norm": completion_rate_norm,
            "payment_gap_ratio": payment_gap_ratio,
            "unspent_ratio": unspent_ratio,
        }

    def fit(self, data: Union[pd.DataFrame, List[Dict[str, Any]]]) -> "PaymentAnomalyDetector":
        """
        Fit Isolation Forest on available financial execution records if sufficient
        valid samples exist (>= min_samples_iforest); otherwise falls back gracefully.
        """
        if data is None:
            self.is_fitted_ = True
            return self

        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, pd.DataFrame):
            df = data.copy()
        else:
            self.is_fitted_ = True
            return self

        if df.empty:
            self.is_fitted_ = True
            return self

        # Extract normalized feature matrix
        feature_rows = []
        for _, row in df.iterrows():
            feats = self._extract_financial_features(row.to_dict())
            vec = [
                feats.get("expenditure_ratio"),
                feats.get("completion_rate_norm"),
                feats.get("payment_gap_ratio"),
                feats.get("unspent_ratio"),
            ]
            # Keep row if at least 2 primary features are non-null
            non_null_count = sum(1 for v in vec if v is not None)
            if non_null_count >= 2:
                # Impute missing feature dimensions with standard median defaults
                cleaned_vec = [
                    vec[0] if vec[0] is not None else 0.5,
                    vec[1] if vec[1] is not None else 0.5,
                    vec[2] if vec[2] is not None else 0.1,
                    vec[3] if vec[3] is not None else 0.3,
                ]
                feature_rows.append(cleaned_vec)

        self.valid_training_samples_ = len(feature_rows)

        # Strictly fit Isolation Forest ONLY if there are enough valid observations
        if self.valid_training_samples_ >= self.config["min_samples_iforest"]:
            try:
                X = np.array(feature_rows, dtype=float)
                self.iforest_model_ = IsolationForest(
                    n_estimators=self.config["iforest_n_estimators"],
                    contamination=self.config["iforest_contamination"],
                    random_state=self.config["iforest_random_state"],
                )
                self.iforest_model_.fit(X)
            except Exception as e:
                logger.warning(f"Failed to fit IsolationForest in PaymentAnomalyDetector: {e}")
                self.iforest_model_ = None
        else:
            self.iforest_model_ = None

        self.is_fitted_ = True
        return self

    def evaluate_record(self, record: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """
        Evaluate payment and financial execution risk for an MP or financial summary.

        Returns:
            Dict containing:
                - payment_risk_score (0–100 scale, or None if insufficient data)
                - financial_execution_status
                - discrepancy_signals (List[str])
                - observations (List[str])
                - metrics (Dict[str, Optional[float]])
                - engine_mode
                - analytical_disclaimer
        """
        if record is None:
            return {
                "source_id": None,
                "mp_name": None,
                "payment_risk_score": None,
                "financial_execution_status": "insufficient_data",
                "discrepancy_signals": [],
                "observations": ["No record provided for payment execution analysis."],
                "metrics": {},
                "engine_mode": "insufficient_data",
                "analytical_disclaimer": self.disclaimer,
            }

        # Extract identifiers
        source_id = None
        mp_name = None
        if isinstance(record, dict):
            source_id = record.get("source_id") or record.get("id")
            mp_name = record.get("mp_name")
        else:
            source_id = getattr(record, "source_id", None) or getattr(record, "id", None)
            mp_name = getattr(record, "mp_name", None)

        feats = self._extract_financial_features(record)
        utilization = feats.get("utilization_percentage")
        completion_rate = feats.get("completion_rate")
        payment_gap = feats.get("payment_gap_percentage")
        unspent_amount = feats.get("unspent_amount")
        allocated = feats.get("allocated_amount")
        pending_works = feats.get("pending_works")

        # 1. Insufficient Data Check
        if utilization is None and completion_rate is None and payment_gap is None:
            return {
                "source_id": str(source_id) if source_id is not None else None,
                "mp_name": mp_name,
                "payment_risk_score": None,
                "financial_execution_status": "insufficient_data",
                "discrepancy_signals": [],
                "observations": [
                    "Payment execution analysis unavailable due to missing utilization, completion rate, and payment gap metrics."
                ],
                "metrics": feats,
                "engine_mode": "insufficient_data",
                "analytical_disclaimer": self.disclaimer,
            }

        discrepancy_signals: List[str] = []
        observations: List[str] = []
        risk_penalties: List[float] = []

        # 2. Financial vs. Physical Execution Mismatch Signal
        # Example: High expenditure (> 75%) with low physical completion (< 35%)
        if utilization is not None and completion_rate is not None:
            if (
                utilization >= self.config["disproportionate_expenditure_pct"]
                and completion_rate <= self.config["low_physical_completion_pct"]
            ):
                gap = utilization - completion_rate
                discrepancy_signals.append("FINANCIAL_PHYSICAL_MISMATCH")
                observations.append(
                    f"Financial execution discrepancy: fund expenditure is high ({utilization:.1f}%) while "
                    f"physical completion rate is low ({completion_rate:.1f}%). Fund disbursement gap: {gap:.1f}%."
                )
                # Severe mismatch penalty (40–70)
                risk_penalties.append(min(70.0, 35.0 + (gap * 0.7)))
            elif utilization > completion_rate + 30.0:
                discrepancy_signals.append("ELEVATED_DISBURSEMENT_LEAD")
                gap = utilization - completion_rate
                observations.append(
                    f"Associated parliamentary portfolio shows expenditure utilization of {utilization:.1f}% versus physical completion of {completion_rate:.1f}%."
                )
                risk_penalties.append(min(45.0, 20.0 + (gap * 0.5)))
            else:
                observations.append(
                    f"Financial expenditure ({utilization:.1f}%) aligns reasonably with physical completion rate ({completion_rate:.1f}%)."
                )

        # 3. Payment Gap Divergence Signal
        if payment_gap is not None:
            if payment_gap >= self.config["critical_payment_gap_pct"]:
                discrepancy_signals.append("CRITICAL_PAYMENT_GAP")
                observations.append(
                    f"Substantial payment gap of {payment_gap:.1f}% between completed works and disbursed payments."
                )
                risk_penalties.append(65.0)
            elif payment_gap >= self.config["payment_gap_threshold_pct"]:
                discrepancy_signals.append("MODERATE_PAYMENT_GAP")
                observations.append(
                    f"Moderate payment gap of {payment_gap:.1f}% detected."
                )
                risk_penalties.append(35.0)

        # 4. Idle Fund with High Pending Works Signal
        if unspent_amount is not None and allocated is not None and allocated > 0 and pending_works is not None:
            unspent_ratio = unspent_amount / allocated
            if unspent_ratio > 0.6 and pending_works > 5 and (completion_rate is not None and completion_rate < 30.0):
                discrepancy_signals.append("IDLE_UNSPENT_BALANCE")
                observations.append(
                    f"High unspent balance of ₹{unspent_amount:,.2f} ({unspent_ratio * 100:.1f}% of allocation) "
                    f"persists with {int(pending_works)} pending works."
                )
                risk_penalties.append(30.0)

        # 5. Model Inference: Isolation Forest (if fitted) combined with ratio penalties
        iforest_score: Optional[float] = None
        engine_mode = "statistical_ratio_fallback"

        if self.iforest_model_ is not None:
            vec = [
                feats.get("expenditure_ratio") if feats.get("expenditure_ratio") is not None else 0.5,
                feats.get("completion_rate_norm") if feats.get("completion_rate_norm") is not None else 0.5,
                feats.get("payment_gap_ratio") if feats.get("payment_gap_ratio") is not None else 0.1,
                feats.get("unspent_ratio") if feats.get("unspent_ratio") is not None else 0.3,
            ]
            try:
                # Decision function: lower values indicate higher anomaly likelihood
                raw_decision = float(self.iforest_model_.decision_function([vec])[0])
                # Normalize decision function (typically in range [-0.5, 0.5]) to [0, 100] risk scale
                iforest_score = float(np.clip((0.3 - raw_decision) * 100.0, 0.0, 100.0))
                engine_mode = "isolation_forest_and_ratios"
            except Exception as e:
                logger.warning(f"Error evaluating IsolationForest in PaymentAnomalyDetector: {e}")
                iforest_score = None

        # 6. Composite Score Synthesis
        if not risk_penalties and iforest_score is None:
            payment_risk_score = 10.0  # Normal baseline
        elif not risk_penalties and iforest_score is not None:
            payment_risk_score = iforest_score
        elif risk_penalties and iforest_score is None:
            payment_risk_score = max(risk_penalties)
        else:
            # Weighted synthesis: 60% explainable ratio penalties + 40% Isolation Forest
            payment_risk_score = (0.60 * max(risk_penalties)) + (0.40 * iforest_score)

        final_score = round(float(np.clip(payment_risk_score, 0.0, 100.0)), 1)

        # Determine Status
        if final_score <= 30.0:
            status = "normal_execution"
        elif final_score <= 60.0:
            status = "moderate_discrepancy"
        elif final_score <= 80.0:
            status = "elevated_execution_risk"
        else:
            status = "critical_execution_mismatch"

        return {
            "source_id": str(source_id) if source_id is not None else None,
            "mp_name": mp_name,
            "payment_risk_score": final_score,
            "financial_execution_status": status,
            "discrepancy_signals": discrepancy_signals,
            "observations": observations,
            "metrics": {
                "utilization_percentage": utilization,
                "completion_rate": completion_rate,
                "payment_gap_percentage": payment_gap,
                "unspent_amount": unspent_amount,
                "allocated_amount": allocated,
            },
            "engine_mode": engine_mode,
            "analytical_disclaimer": self.disclaimer,
        }

    def predict(self, data: Union[pd.DataFrame, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Evaluate a batch of MP or financial records."""
        if data is None:
            return []

        if isinstance(data, pd.DataFrame):
            records = data.to_dict(orient="records")
        elif isinstance(data, list):
            records = data
        else:
            return []

        return [self.evaluate_record(record) for record in records]
