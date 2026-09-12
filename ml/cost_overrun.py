"""
JanDrishti - Work-Level Cost Overrun Detection Module

Calculates exact budgetary deviation and cost overruns on a work-by-work level
where sanctioned cost and actual expenditure/disbursed amount are available.

IMPORTANT CONCEPTUAL DISTINCTION:
- Cost Overrun = Actual expenditure exceeds sanctioned cost for an individual work.
- Cost Anomaly = Statistical cost deviation relative to peer works in the same category or region.
Never confuse or conflate peer-based cost anomaly with work-level cost overrun.

DISCLAIMER:
All overrun severity thresholds and status classifications are JanDrishti analytical
indicators, not official government thresholds.
"""

from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from ml.config import (
    DEFAULT_OVERRUN_TOLERANCE_PCT,
    DEFAULT_MODERATE_OVERRUN_PCT,
    DEFAULT_CRITICAL_OVERRUN_PCT,
    JANDRISHTI_ANALYTICAL_DISCLAIMER,
)


def safe_float(val: Any) -> Optional[float]:
    """
    Safely convert an input to float.
    Handles None, NaN, empty strings, formatted strings (e.g. '1,250,000'), and percentages.
    Returns None if missing or non-convertible. Never converts missing to 0.0.
    """
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


class CostOverrunDetector:
    """
    Evaluates work-level budget execution by comparing sanctioned cost
    with actual expenditure/disbursement.
    """

    def __init__(
        self,
        tolerance_pct: float = DEFAULT_OVERRUN_TOLERANCE_PCT,
        moderate_pct: float = DEFAULT_MODERATE_OVERRUN_PCT,
        critical_pct: float = DEFAULT_CRITICAL_OVERRUN_PCT,
    ):
        self.tolerance_pct = float(tolerance_pct)
        self.moderate_pct = float(moderate_pct)
        self.critical_pct = float(critical_pct)
        self.disclaimer = JANDRISHTI_ANALYTICAL_DISCLAIMER

    def _extract_costs(self, work: Union[Dict[str, Any], Any]) -> Tuple[Optional[float], Optional[float], Optional[str]]:
        """
        Extract sanctioned cost and actual expenditure from a work dict or ORM object.
        Supports standard canonical fields and common source aliases.
        """
        if work is None:
            return None, None, None

        # Extract work identifier
        work_id = None
        if isinstance(work, dict):
            work_id = work.get("work_id") or work.get("id") or work.get("source_id")
            # Sanctioned cost candidates
            s_val = (
                work.get("sanctioned_cost")
                if "sanctioned_cost" in work
                else work.get("sanctioned_amount")
                if "sanctioned_amount" in work
                else work.get("estimated_cost")
                if "estimated_cost" in work
                else work.get("sanction_amount")
            )
            # Actual expenditure candidates
            e_val = (
                work.get("actual_expenditure")
                if "actual_expenditure" in work
                else work.get("expenditure")
                if "expenditure" in work
                else work.get("disbursed_amount")
                if "disbursed_amount" in work
                else work.get("actual_cost")
                if "actual_cost" in work
                else work.get("completed_cost")
            )

            # If only 'cost' is provided without explicit separate expenditure,
            # we check if expenditure is explicitly provided under another key.
            if s_val is None and "cost" in work and e_val is not None:
                s_val = work.get("cost")
            elif e_val is None and "cost" in work and s_val is not None:
                e_val = work.get("cost")
        else:
            work_id = getattr(work, "work_id", None) or getattr(work, "id", None) or getattr(work, "source_id", None)
            s_val = getattr(work, "sanctioned_cost", None) or getattr(work, "sanctioned_amount", None) or getattr(work, "cost", None)
            e_val = getattr(work, "actual_expenditure", None) or getattr(work, "expenditure", None) or getattr(work, "disbursed_amount", None)

        sanctioned_cost = safe_float(s_val)
        actual_expenditure = safe_float(e_val)
        work_id_str = str(work_id) if work_id is not None else None

        return sanctioned_cost, actual_expenditure, work_id_str

    def evaluate_work(self, work: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """
        Evaluate a single work item for cost overrun.

        Returns:
            Dict containing:
                - sanctioned_cost
                - actual_expenditure
                - overrun_amount (actual_expenditure - sanctioned_cost)
                - overrun_percentage (((actual_expenditure - sanctioned_cost) / sanctioned_cost) * 100)
                - overrun_score (0–100 scale, or None if insufficient data)
                - overrun_status
                - is_overrun (bool)
                - evidence (list of explanatory text strings)
                - analytical_disclaimer
        """
        sanctioned_cost, actual_expenditure, work_id = self._extract_costs(work)
        evidence: List[str] = []

        # 1. Check for missing data
        if sanctioned_cost is None or actual_expenditure is None:
            missing_parts = []
            if sanctioned_cost is None:
                missing_parts.append("sanctioned cost")
            if actual_expenditure is None:
                missing_parts.append("actual expenditure")
            
            evidence.append(
                f"Work-level cost overrun evaluation is unavailable due to missing {' and '.join(missing_parts)}."
            )
            evidence.append(
                f"Note: {self.disclaimer}"
            )
            return {
                "work_id": work_id,
                "sanctioned_cost": sanctioned_cost,
                "actual_expenditure": actual_expenditure,
                "overrun_amount": None,
                "overrun_percentage": None,
                "overrun_score": None,
                "overrun_status": "insufficient_data",
                "is_overrun": False,
                "evidence": evidence,
                "analytical_disclaimer": self.disclaimer,
            }

        # 2. Check for negative financial data anomalies
        if sanctioned_cost < 0 or actual_expenditure < 0:
            evidence.append(
                f"Invalid financial values detected: sanctioned cost ₹{sanctioned_cost:,.2f}, "
                f"actual expenditure ₹{actual_expenditure:,.2f}."
            )
            return {
                "work_id": work_id,
                "sanctioned_cost": sanctioned_cost,
                "actual_expenditure": actual_expenditure,
                "overrun_amount": None,
                "overrun_percentage": None,
                "overrun_score": None,
                "overrun_status": "invalid_negative_values",
                "is_overrun": False,
                "evidence": evidence,
                "analytical_disclaimer": self.disclaimer,
            }

        # 3. Check for zero sanctioned cost with positive expenditure
        if sanctioned_cost == 0.0:
            overrun_amount = round(actual_expenditure, 2)
            if actual_expenditure > 0.0:
                evidence.append(
                    f"Expenditure of ₹{actual_expenditure:,.2f} recorded against zero sanctioned cost baseline."
                )
                evidence.append(
                    f"Threshold indicator: [{self.disclaimer}]"
                )
                return {
                    "work_id": work_id,
                    "sanctioned_cost": 0.0,
                    "actual_expenditure": actual_expenditure,
                    "overrun_amount": overrun_amount,
                    "overrun_percentage": None,
                    "overrun_score": 85.0,
                    "overrun_status": "zero_cost_baseline_overrun",
                    "is_overrun": True,
                    "evidence": evidence,
                    "analytical_disclaimer": self.disclaimer,
                }
            else:
                # 0 sanctioned, 0 expenditure
                evidence.append("Both sanctioned cost and expenditure are zero.")
                return {
                    "work_id": work_id,
                    "sanctioned_cost": 0.0,
                    "actual_expenditure": 0.0,
                    "overrun_amount": 0.0,
                    "overrun_percentage": 0.0,
                    "overrun_score": 0.0,
                    "overrun_status": "no_overrun",
                    "is_overrun": False,
                    "evidence": evidence,
                    "analytical_disclaimer": self.disclaimer,
                }

        # 4. Standard Calculation
        overrun_amount = round(actual_expenditure - sanctioned_cost, 2)
        overrun_percentage = round(((actual_expenditure - sanctioned_cost) / sanctioned_cost) * 100.0, 2)

        is_overrun = overrun_percentage > self.tolerance_pct
        overrun_score = 0.0
        overrun_status = "no_overrun"

        if overrun_percentage <= self.tolerance_pct:
            overrun_status = "no_overrun"
            overrun_score = 0.0
            if overrun_amount < 0:
                evidence.append(
                    f"Expenditure is within sanctioned budget (savings of ₹{abs(overrun_amount):,.2f} / {abs(overrun_percentage):.1f}% under budget)."
                )
            else:
                evidence.append("Expenditure exactly matches sanctioned cost.")
        elif overrun_percentage <= self.moderate_pct:
            overrun_status = "moderate_overrun"
            # Scale score proportionally between 35 and 60
            progress = (overrun_percentage - self.tolerance_pct) / max(1.0, (self.moderate_pct - self.tolerance_pct))
            overrun_score = round(35.0 + (progress * 25.0), 1)
            evidence.append(
                f"Expenditure exceeded sanctioned cost by ₹{overrun_amount:,.2f} ({overrun_percentage:.1f}%). "
                f"Categorized as moderate cost overrun. [{self.disclaimer}]"
            )
        elif overrun_percentage <= self.critical_pct:
            overrun_status = "high_overrun"
            # Scale score proportionally between 61 and 80
            progress = (overrun_percentage - self.moderate_pct) / max(1.0, (self.critical_pct - self.moderate_pct))
            overrun_score = round(61.0 + (progress * 19.0), 1)
            evidence.append(
                f"Expenditure exceeded sanctioned cost by ₹{overrun_amount:,.2f} ({overrun_percentage:.1f}%). "
                f"Categorized as elevated cost overrun. [{self.disclaimer}]"
            )
        else:
            overrun_status = "critical_overrun"
            # Scale score proportionally between 81 and 100
            excess_factor = min(1.0, (overrun_percentage - self.critical_pct) / 50.0)
            overrun_score = round(81.0 + (excess_factor * 19.0), 1)
            evidence.append(
                f"Significant budget overrun detected: expenditure of ₹{actual_expenditure:,.2f} exceeds "
                f"sanctioned cost of ₹{sanctioned_cost:,.2f} by ₹{overrun_amount:,.2f} ({overrun_percentage:.1f}%). "
                f"[{self.disclaimer}]"
            )

        return {
            "work_id": work_id,
            "sanctioned_cost": sanctioned_cost,
            "actual_expenditure": actual_expenditure,
            "overrun_amount": overrun_amount,
            "overrun_percentage": overrun_percentage,
            "overrun_score": float(np.clip(overrun_score, 0.0, 100.0)),
            "overrun_status": overrun_status,
            "is_overrun": is_overrun,
            "evidence": evidence,
            "analytical_disclaimer": self.disclaimer,
        }

    def predict(self, data: Union[pd.DataFrame, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """
        Evaluate a batch of works for cost overruns.
        Accepts a pandas DataFrame or list of dicts.
        """
        if data is None:
            return []

        if isinstance(data, pd.DataFrame):
            records = data.to_dict(orient="records")
        elif isinstance(data, list):
            records = data
        else:
            return []

        return [self.evaluate_work(record) for record in records]

    def audit_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Enrich a pandas DataFrame with cost overrun analysis columns.
        """
        if df is None or not isinstance(df, pd.DataFrame) or df.empty:
            return pd.DataFrame()

        results = self.predict(df)
        enriched_df = df.copy()

        enriched_df["overrun_amount"] = [r["overrun_amount"] for r in results]
        enriched_df["overrun_percentage"] = [r["overrun_percentage"] for r in results]
        enriched_df["overrun_score"] = [r["overrun_score"] for r in results]
        enriched_df["overrun_status"] = [r["overrun_status"] for r in results]
        enriched_df["is_cost_overrun"] = [r["is_overrun"] for r in results]

        return enriched_df
