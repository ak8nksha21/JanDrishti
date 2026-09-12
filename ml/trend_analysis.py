"""
JanDrishti - Trend Intelligence & Detection Module
Reusable, explainable, and statistically grounded trend analysis for MPLADS monitoring.

CRITICAL POLICY:
- Preserves the canonical 6-signal Work Risk Engine unchanged.
- Does NOT fabricate historical expenditure or synthetic time-series.
- Evaluates Project Completion Velocity strictly based on source-reported completion_date.
- Single-point financial snapshots return structured "insufficient_data" with transparent methodology notes.
- Strictly non-accusatory language. Never claims fraud, corruption, or guilt.
"""

from datetime import datetime, date
from typing import Dict, List, Any, Optional, Union
import math


class TrendDetector:
    """
    Explainable, rule-based and statistical trend detector for parliamentary infrastructure metrics.
    """

    def __init__(
        self,
        stable_threshold_pct: float = 5.0,
        medium_strength_threshold_pct: float = 10.0,
        high_strength_threshold_pct: float = 30.0,
        min_periods_for_trend: int = 2,
        min_active_periods_for_trend: int = 1,
    ):
        """
        Initialize trend thresholds.
        :param stable_threshold_pct: Maximum absolute percentage change considered 'stable' (default +/- 5%).
        :param medium_strength_threshold_pct: Percentage change threshold for 'medium' strength (default >= 10%).
        :param high_strength_threshold_pct: Percentage change threshold for 'high' strength (default >= 30%).
        :param min_periods_for_trend: Minimum chronological periods required to attempt trend detection.
        :param min_active_periods_for_trend: Minimum periods with non-zero activity required.
        """
        self.stable_threshold_pct = stable_threshold_pct
        self.medium_strength_threshold_pct = medium_strength_threshold_pct
        self.high_strength_threshold_pct = high_strength_threshold_pct
        self.min_periods_for_trend = min_periods_for_trend
        self.min_active_periods_for_trend = min_active_periods_for_trend

    def analyze_series(
        self,
        series: List[Dict[str, Any]],
        metric_name: str,
        period_key: str = "period",
        value_key: str = "value",
        unit: str = "works",
    ) -> Dict[str, Any]:
        """
        Analyze a chronological series of periodic observations.
        
        :param series: Chronologically ordered list of dicts with period and value.
        :param metric_name: Name of the metric being analyzed.
        :param period_key: Key for period identifier (e.g. "Q1 2025").
        :param value_key: Key for numeric value.
        :param unit: Unit label (e.g. "works", "INR", "%").
        :return: Standardized Trend Intelligence dict.
        """
        # 1. Clean and validate inputs
        valid_points = []
        for item in (series or []):
            if not isinstance(item, dict):
                continue
            period = item.get(period_key)
            val = item.get(value_key)
            if period is not None and val is not None:
                try:
                    num_val = float(val)
                    if not (math.isnan(num_val) or math.isinf(num_val)):
                        valid_points.append({"period": str(period), "value": num_val})
                except (ValueError, TypeError):
                    continue

        total_periods = len(valid_points)
        active_periods = sum(1 for p in valid_points if p["value"] > 0)
        total_observations = sum(p["value"] for p in valid_points)

        # 2. Check sufficiency
        if (
            total_periods < self.min_periods_for_trend
            or active_periods < self.min_active_periods_for_trend
        ):
            return {
                "metric": metric_name,
                "trend_direction": "insufficient_data",
                "trend_strength": "insufficient_data",
                "current_value": valid_points[-1]["value"] if valid_points else None,
                "previous_value": valid_points[-2]["value"] if len(valid_points) >= 2 else None,
                "change_percentage": None,
                "observation_period": f"{valid_points[0]['period']} – {valid_points[-1]['period']}" if len(valid_points) >= 2 else (valid_points[0]["period"] if valid_points else "None"),
                "baseline": "Insufficient Historical Baseline",
                "interpretation": f"Insufficient historical observations to establish a statistically reliable trend for {metric_name.lower()} (found {total_periods} periods, {active_periods} active).",
                "confidence": "insufficient_data",
                "status": "insufficient_data",
                "total_periods": total_periods,
                "active_periods": active_periods,
                "total_observations": total_observations,
                "historical_series": valid_points,
            }

        # 3. Period-over-period calculation
        prev_point = valid_points[-2]
        curr_point = valid_points[-1]
        prev_val = prev_point["value"]
        curr_val = curr_point["value"]

        # Calculate percentage change
        if prev_val == 0:
            if curr_val > 0:
                change_pct = None
                direction = "increasing"
                strength = "high"
                interpretation = f"{metric_name} increased from 0 {unit} in {prev_point['period']} to {curr_val:.0f} {unit} in {curr_point['period']}."
            else:
                change_pct = 0.0
                direction = "stable"
                strength = "low"
                interpretation = f"{metric_name} remained at 0 {unit} across {prev_point['period']} and {curr_point['period']}."
        else:
            change_pct = round(((curr_val - prev_val) / abs(prev_val)) * 100.0, 1)

            if change_pct > self.stable_threshold_pct:
                direction = "increasing"
            elif change_pct < -self.stable_threshold_pct:
                direction = "decreasing"
            else:
                direction = "stable"

            abs_change = abs(change_pct)
            if abs_change >= self.high_strength_threshold_pct:
                strength = "high"
            elif abs_change >= self.medium_strength_threshold_pct:
                strength = "medium"
            else:
                strength = "low"

            sign = "+" if change_pct > 0 else ""
            if direction == "increasing":
                interpretation = f"{metric_name} increased by {sign}{change_pct}% ({prev_val:.0f} to {curr_val:.0f} {unit}) from {prev_point['period']} to {curr_point['period']}."
            elif direction == "decreasing":
                interpretation = f"{metric_name} decreased by {change_pct}% ({prev_val:.0f} to {curr_val:.0f} {unit}) from {prev_point['period']} to {curr_point['period']}."
            else:
                interpretation = f"{metric_name} remained stable ({sign}{change_pct}%, {prev_val:.0f} vs {curr_val:.0f} {unit}) between {prev_point['period']} and {curr_point['period']}."

        # 4. Multi-period linear slope (if >= 3 points)
        slope = None
        overall_trajectory = direction
        if total_periods >= 3:
            n = total_periods
            x_vals = list(range(n))
            y_vals = [p["value"] for p in valid_points]
            x_mean = sum(x_vals) / n
            y_mean = sum(y_vals) / n
            numerator = sum((x_vals[i] - x_mean) * (y_vals[i] - y_mean) for i in range(n))
            denominator = sum((x_vals[i] - x_mean) ** 2 for i in range(n))
            slope = round(numerator / denominator, 2) if denominator != 0 else 0.0

            if slope > 1.0:
                overall_trajectory = "increasing"
            elif slope < -1.0:
                overall_trajectory = "decreasing"
            else:
                overall_trajectory = "stable"

        # 5. Determine analytical confidence
        if total_observations >= 100 and active_periods >= 5:
            confidence = "medium"
        elif total_observations >= 30 and active_periods >= 3:
            confidence = "medium"
        else:
            confidence = "low"

        obs_period_str = f"{valid_points[0]['period']} – {valid_points[-1]['period']}"

        return {
            "metric": metric_name,
            "trend_direction": direction,
            "trend_strength": strength,
            "overall_trajectory": overall_trajectory,
            "current_value": curr_val,
            "previous_value": prev_val,
            "change_percentage": change_pct,
            "linear_slope": slope,
            "observation_period": obs_period_str,
            "baseline": f"{prev_point['period']} ({prev_val:.0f} {unit})",
            "interpretation": interpretation,
            "confidence": confidence,
            "status": "available",
            "total_periods": total_periods,
            "active_periods": active_periods,
            "total_observations": total_observations,
            "unit": unit,
            "historical_series": valid_points,
        }

    def analyze_completion_activity(
        self,
        works_records: List[Any],
        granularity: str = "quarter",
    ) -> Dict[str, Any]:
        """
        Aggregate works by source-reported completion_date into chronological periods
        and evaluate project completion activity trend.
        
        :param works_records: List of Work ORM models or dicts containing completion_date.
        :param granularity: 'quarter' (default) or 'month'.
        :return: Standardized Trend Intelligence dict for completion activity.
        """
        parsed_dates = []
        for w in works_records:
            dt = None
            if isinstance(w, dict):
                dt_val = w.get("completion_date")
            else:
                dt_val = getattr(w, "completion_date", None)

            if isinstance(dt_val, datetime):
                dt = dt_val
            elif isinstance(dt_val, date):
                dt = datetime(dt_val.year, dt_val.month, dt_val.day)
            elif isinstance(dt_val, str) and dt_val.strip():
                try:
                    dt = datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
                except Exception:
                    try:
                        dt = datetime.strptime(dt_val[:10], "%Y-%m-%d")
                    except Exception:
                        pass

            if dt:
                parsed_dates.append(dt)

        if not parsed_dates:
            return {
                "metric": "Project Completion Activity",
                "trend_direction": "insufficient_data",
                "trend_strength": "insufficient_data",
                "current_value": None,
                "previous_value": None,
                "change_percentage": None,
                "observation_period": "None",
                "baseline": "Insufficient Historical Baseline",
                "interpretation": "No verified completion dates found in the ingested work records.",
                "confidence": "insufficient_data",
                "status": "insufficient_data",
                "total_periods": 0,
                "active_periods": 0,
                "total_observations": 0,
                "historical_series": [],
            }

        min_dt = min(parsed_dates)
        max_dt = max(parsed_dates)

        # Build chronological quarters
        def dt_to_quarter_key(dt: datetime) -> (int, int):
            return dt.year, (dt.month - 1) // 3 + 1

        min_yr, min_q = dt_to_quarter_key(min_dt)
        max_yr, max_q = dt_to_quarter_key(max_dt)

        # Generate continuous list of quarters
        quarters_list = []
        curr_yr, curr_q = min_yr, min_q
        while (curr_yr < max_yr) or (curr_yr == max_yr and curr_q <= max_q):
            quarters_list.append(f"Q{curr_q} {curr_yr}")
            curr_q += 1
            if curr_q > 4:
                curr_q = 1
                curr_yr += 1

        # Count occurrences per quarter
        counts = {q: 0 for q in quarters_list}
        for dt in parsed_dates:
            q_str = f"Q{(dt.month - 1) // 3 + 1} {dt.year}"
            if q_str in counts:
                counts[q_str] += 1

        series = [{"period": q, "value": counts[q]} for q in quarters_list]

        result = self.analyze_series(
            series=series,
            metric_name="Project Completion Activity",
            period_key="period",
            value_key="value",
            unit="works",
        )

        # Add explicit note regarding data scope
        result["data_scope_note"] = (
            f"Completion activity is based on the currently ingested {len(parsed_dates)} itemized works "
            f"and their source-reported completion dates across {result.get('total_periods', 0)} quarters."
        )
        return result

    def analyze_financial_metric(
        self,
        metric_name: str,
        current_value: Optional[float] = None,
        unit: str = "₹ Cr",
    ) -> Dict[str, Any]:
        """
        Standardized handler for single-snapshot financial metrics (Expenditure, Recommendations, Unspent Balance).
        Returns transparent 'insufficient_data' status without fabricating time-series.
        """
        formatted_val = f"₹{current_value:.2f} Cr" if current_value is not None else "N/A"
        return {
            "metric": metric_name,
            "trend_direction": "insufficient_data",
            "trend_strength": "insufficient_data",
            "current_value": current_value,
            "previous_value": None,
            "change_percentage": None,
            "observation_period": "Current Legislative Tenure (Single Cumulative Snapshot)",
            "baseline": "Insufficient Historical Baseline",
            "interpretation": (
                f"Current public data provides a single cumulative snapshot of {metric_name.lower()} ({formatted_val}). "
                f"Periodic historical disbursements (monthly or quarterly ledger releases) are required to establish an expenditure trend."
            ),
            "confidence": "insufficient_data",
            "status": "insufficient_data",
            "total_periods": 1,
            "active_periods": 1 if current_value and current_value > 0 else 0,
            "unit": unit,
            "required_data": "Periodic (monthly/quarterly) financial disbursement ledger releases.",
        }
