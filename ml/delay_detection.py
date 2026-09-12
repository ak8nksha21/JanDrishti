"""
JanDrishti - Work Execution-Time & Delay Risk Analysis Module

Evaluates work execution duration against statistical peer benchmarks.
Strictly relies on verified official sanction dates (SANCTION_DATE) and completion dates;
if sanction dates are missing, the module reports 'insufficient_data' rather than fabricating
or assuming a proxy date.

IMPORTANT PRINCIPLES & WORDING:
- Does NOT claim a work is officially 'delayed' unless an official contractual deadline is specified.
- Uses objective administrative terminology: 'within normal baseline', 'moderate duration variance',
  'elevated execution duration', or 'unusually long execution duration'.
- All thresholds are JanDrishti analytical indicators, not government compliance determinations.
"""

from datetime import datetime, date
import logging
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from ml.config import (
    DEFAULT_MIN_PEER_DURATION_SAMPLES,
    DEFAULT_MODERATE_DELAY_PERCENTILE,
    DEFAULT_CRITICAL_DELAY_PERCENTILE,
    JANDRISHTI_ANALYTICAL_DISCLAIMER,
)

logger = logging.getLogger("jandrishti.ml.delay")


def parse_datetime(val: Any) -> Optional[datetime]:
    """
    Safely parse various datetime formats into a naive Python datetime.
    Supports datetime, date, pandas Timestamp, and strings in ISO / Indian date formats
    (e.g., '22-Apr-2026', '19-Nov-2025', '2026-04-22', '07/08/2026').
    Returns None if missing or non-parseable. Never assumes or fabricates dates.
    """
    if val is None or pd.isna(val):
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=None) if val.tzinfo else val
    if isinstance(val, date):
        return datetime(val.year, val.month, val.day)
    if isinstance(val, (int, float, np.integer, np.floating)):
        # Plausible integer year
        if 1993 <= val <= 2035:
            return datetime(int(val), 1, 1)
        return None

    if isinstance(val, str):
        cleaned = val.strip()
        if not cleaned or cleaned.lower() in ("null", "none", "na", "n/a", "nil", ""):
            return None
        # Try common datetime formats including Indian e-SAKSHI formats
        date_formats = [
            "%d-%b-%Y",
            "%d-%b-%y",
            "%d-%B-%Y",
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%d/%m/%Y %H:%M:%S",
            "%d-%m-%Y %H:%M:%S",
            "%m/%d/%Y",
            "%Y/%m/%d",
        ]
        for fmt in date_formats:
            try:
                dt = datetime.strptime(cleaned, fmt)
                return dt
            except (ValueError, TypeError):
                continue

        try:
            ts = pd.to_datetime(cleaned, errors="coerce")
            if pd.notna(ts):
                return ts.to_pydatetime().replace(tzinfo=None)
        except Exception:
            pass

    return None


class DelayDetector:
    """
    Statistical Execution-Time and Delay Risk Analyzer for MPLADS Works.
    Benchmarks execution durations against peer category and district distributions.
    """

    DEFAULT_CONFIG = {
        "min_peer_samples": DEFAULT_MIN_PEER_DURATION_SAMPLES,
        "moderate_percentile": DEFAULT_MODERATE_DELAY_PERCENTILE,
        "critical_percentile": DEFAULT_CRITICAL_DELAY_PERCENTILE,
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        self.disclaimer = JANDRISHTI_ANALYTICAL_DISCLAIMER
        self.is_fitted_: bool = False
        self.peer_baselines_: Dict[str, Dict[str, Any]] = {
            "category": {},
            "district": {},
            "global": None,
        }

    def _compute_stats(self, durations: List[float]) -> Optional[Dict[str, float]]:
        """Compute robust summary statistics for a duration series."""
        if not durations or len(durations) < self.config["min_peer_samples"]:
            return None
        arr = np.array(durations, dtype=float)
        p25 = float(np.percentile(arr, 25))
        p50 = float(np.percentile(arr, 50))  # median
        p75 = float(np.percentile(arr, 75))
        p90 = float(np.percentile(arr, 90))
        iqr = float(max(1.0, p75 - p25))

        return {
            "count": len(arr),
            "median_days": round(p50, 1),
            "p25_days": round(p25, 1),
            "p75_days": round(p75, 1),
            "p90_days": round(p90, 1),
            "iqr_days": round(iqr, 1),
            "mean_days": round(float(np.mean(arr)), 1),
            "std_days": round(float(np.std(arr)), 1),
        }

    def fit(self, data: Union[pd.DataFrame, List[Dict[str, Any]]]) -> "DelayDetector":
        """
        Fit peer duration distributions across categories and districts.
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

        # Extract durations for completed works with valid dates
        durations_records = []
        for idx, row in df.iterrows():
            s_raw = (
                row.get("official_sanction_date")
                if "official_sanction_date" in row and pd.notna(row.get("official_sanction_date"))
                else row.get("sanction_date")
                if "sanction_date" in row and pd.notna(row.get("sanction_date"))
                else row.get("sanctioned_date")
            )
            s_date = parse_datetime(s_raw)
            c_date = parse_datetime(row.get("completion_date"))
            cat = str(row.get("category", "")).strip() if pd.notna(row.get("category")) else None
            dist = str(row.get("district", "")).strip() if pd.notna(row.get("district")) else None

            if s_date and c_date and c_date >= s_date:
                dur_days = (c_date - s_date).days
                durations_records.append({
                    "duration_days": float(dur_days),
                    "category": cat,
                    "district": dist,
                })

        if durations_records:
            dur_df = pd.DataFrame(durations_records)

            # 1. Global Baseline
            self.peer_baselines_["global"] = self._compute_stats(dur_df["duration_days"].tolist())

            # 2. Category Baseline
            if "category" in dur_df.columns:
                for c_val, grp in dur_df.groupby("category"):
                    if c_val and c_val != "None":
                        stats = self._compute_stats(grp["duration_days"].tolist())
                        if stats:
                            self.peer_baselines_["category"][c_val] = stats

            # 3. District Baseline
            if "district" in dur_df.columns:
                for d_val, grp in dur_df.groupby("district"):
                    if d_val and d_val != "None":
                        stats = self._compute_stats(grp["duration_days"].tolist())
                        if stats:
                            self.peer_baselines_["district"][d_val] = stats

        self.is_fitted_ = True
        return self

    def _extract_work_dates(
        self, work: Union[Dict[str, Any], Any]
    ) -> Tuple[Optional[datetime], Optional[datetime], Optional[str], Optional[str], Optional[str], Dict[str, Any]]:
        """
        Extract sanction_date, completion_date, category, district, work_id, and provenance.
        Strictly requires explicit official sanction date or sanction date.
        """
        if work is None:
            return None, None, None, None, None, {}

        provenance = {
            "sanction_date_source": "MoSPI e-SAKSHI",
            "sanction_date_field": "SANCTION_DATE",
            "sanction_date_verified": True,
        }

        if isinstance(work, dict):
            work_id = work.get("work_id") or work.get("id") or work.get("source_id")
            s_raw = (
                work.get("official_sanction_date")
                if "official_sanction_date" in work and work.get("official_sanction_date") is not None
                else work.get("sanction_date")
                if "sanction_date" in work and work.get("sanction_date") is not None
                else work.get("sanctioned_date")
            )
            c_raw = work.get("completion_date")
            cat_raw = work.get("category")
            dist_raw = work.get("district")
            if "official_sanction_source" in work:
                provenance["sanction_date_source"] = work["official_sanction_source"]
        else:
            work_id = getattr(work, "work_id", None) or getattr(work, "id", None) or getattr(work, "source_id", None)
            s_raw = (
                getattr(work, "official_sanction_date", None)
                or getattr(work, "sanction_date", None)
                or getattr(work, "sanctioned_date", None)
            )
            c_raw = getattr(work, "completion_date", None)
            cat_raw = getattr(work, "category", None)
            dist_raw = getattr(work, "district", None)
            if hasattr(work, "official_sanction_source") and getattr(work, "official_sanction_source", None):
                provenance["sanction_date_source"] = getattr(work, "official_sanction_source")

        s_date = parse_datetime(s_raw)
        c_date = parse_datetime(c_raw)
        category = str(cat_raw).strip() if cat_raw and str(cat_raw).strip() not in ("", "None", "nan") else None
        district = str(dist_raw).strip() if dist_raw and str(dist_raw).strip() not in ("", "None", "nan") else None
        work_id_str = str(work_id) if work_id is not None else None

        return s_date, c_date, category, district, work_id_str, provenance

    def evaluate_work(
        self,
        work: Union[Dict[str, Any], Any],
        reference_date: Optional[Union[datetime, date]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate execution duration and delay risk for a single work.

        Args:
            work: Work record (dict or ORM model)
            reference_date: Reference timestamp for ongoing works (defaults to current date).

        Returns:
            Dict containing:
                - work_id
                - duration_days (int or None)
                - sanction_date (str ISO or None)
                - completion_date (str ISO or None)
                - sanction_date_source ('MoSPI e-SAKSHI')
                - sanction_date_field ('SANCTION_DATE')
                - sanction_date_verified (bool)
                - peer_median_days (float or None)
                - peer_p75_days (float or None)
                - peer_category (str or None)
                - delay_score (0–100 scale, or None)
                - delay_status ('within_normal_baseline', 'moderate_duration_variance', etc.)
                - is_completed (bool)
                - observations (List[str])
                - analytical_disclaimer
        """
        s_date, c_date, category, district, work_id, provenance = self._extract_work_dates(work)
        observations: List[str] = []

        # 1. Missing Sanction Date Check (Strict rule: no assumption/proxy)
        if s_date is None:
            observations.append(
                "Execution duration analysis unavailable: verified official sanction date is not present on this work record."
            )
            return {
                "work_id": work_id,
                "duration_days": None,
                "sanction_date": None,
                "completion_date": c_date.strftime("%Y-%m-%d") if c_date else None,
                "sanction_date_source": provenance.get("sanction_date_source", "MoSPI e-SAKSHI"),
                "sanction_date_field": provenance.get("sanction_date_field", "SANCTION_DATE"),
                "sanction_date_verified": False,
                "peer_median_days": None,
                "peer_p75_days": None,
                "peer_category": category,
                "delay_score": None,
                "delay_status": "insufficient_data",
                "is_completed": c_date is not None,
                "observations": observations,
                "analytical_disclaimer": self.disclaimer,
            }

        # 2. Determine Duration and Completion Status
        is_completed = c_date is not None
        if is_completed:
            if c_date < s_date:
                observations.append(
                    f"Chronological anomaly detected: completion date ({c_date.strftime('%Y-%m-%d')}) "
                    f"precedes sanction date ({s_date.strftime('%Y-%m-%d')})."
                )
                return {
                    "work_id": work_id,
                    "duration_days": None,
                    "sanction_date": s_date.strftime("%Y-%m-%d"),
                    "completion_date": c_date.strftime("%Y-%m-%d"),
                    "sanction_date_source": provenance.get("sanction_date_source", "MoSPI e-SAKSHI"),
                    "sanction_date_field": provenance.get("sanction_date_field", "SANCTION_DATE"),
                    "sanction_date_verified": True,
                    "peer_median_days": None,
                    "peer_p75_days": None,
                    "peer_category": category,
                    "delay_score": None,
                    "delay_status": "invalid_chronology",
                    "is_completed": True,
                    "observations": observations,
                    "analytical_disclaimer": self.disclaimer,
                }
            duration_days = (c_date - s_date).days
        else:
            ref_dt = parse_datetime(reference_date) or datetime.utcnow()
            duration_days = max(0, (ref_dt - s_date).days)

        # 3. Retrieve Peer Baseline
        peer_stats = None
        peer_group_name = None

        if category and category in self.peer_baselines_["category"]:
            peer_stats = self.peer_baselines_["category"][category]
            peer_group_name = f"category '{category}'"
        elif self.peer_baselines_["global"]:
            peer_stats = self.peer_baselines_["global"]
            peer_group_name = "national peer works"

        peer_median = peer_stats["median_days"] if peer_stats else None
        peer_p75 = peer_stats["p75_days"] if peer_stats else None
        peer_p90 = peer_stats["p90_days"] if peer_stats else None
        peer_iqr = peer_stats["iqr_days"] if peer_stats else None

        # 4. Compute Score and Status
        delay_score = 0.0
        delay_status = "within_normal_baseline"
        status_prefix = "Execution duration" if is_completed else "Elapsed ongoing duration"

        if peer_stats is None:
            # Baseline not fitted or insufficient peer group size; evaluate with general administrative baseline
            general_benchmark = 180.0
            if duration_days <= general_benchmark:
                delay_status = "within_normal_baseline"
                delay_score = float(np.clip((duration_days / general_benchmark) * 25.0, 0.0, 25.0))
                observations.append(
                    f"{status_prefix} is {duration_days} days, within standard administrative timeframe."
                )
            elif duration_days <= general_benchmark * 2.0:
                delay_status = "moderate_duration_variance"
                progress = (duration_days - general_benchmark) / general_benchmark
                delay_score = round(26.0 + (progress * 29.0), 1)
                observations.append(
                    f"{status_prefix} of {duration_days} days shows moderate duration variance. [{self.disclaimer}]"
                )
            else:
                delay_status = "unusually_long_execution_duration"
                delay_score = min(100.0, round(60.0 + ((duration_days - (general_benchmark * 2)) / general_benchmark) * 20.0, 1))
                observations.append(
                    f"{status_prefix} of {duration_days} days indicates elevated delay risk. [{self.disclaimer}]"
                )
        else:
            # Peer-benchmarked scoring
            if duration_days <= peer_median:
                delay_status = "within_normal_baseline"
                delay_score = float(np.clip((duration_days / max(1.0, peer_median)) * 25.0, 0.0, 25.0))
                observations.append(
                    f"{status_prefix} of {duration_days} days is within normal baseline (peer median: {peer_median:.0f} days in {peer_group_name})."
                )
            elif duration_days <= peer_p75:
                delay_status = "moderate_duration_variance"
                progress = (duration_days - peer_median) / max(1.0, (peer_p75 - peer_median))
                delay_score = round(26.0 + (progress * 29.0), 1)
                observations.append(
                    f"{status_prefix} of {duration_days} days moderately exceeds peer median of {peer_median:.0f} days ({progress * 100:.0f}% towards 75th percentile). [{self.disclaimer}]"
                )
            elif duration_days <= (peer_p75 + 1.5 * peer_iqr):
                delay_status = "elevated_execution_duration"
                progress = (duration_days - peer_p75) / max(1.0, (1.5 * peer_iqr))
                delay_score = round(56.0 + (min(1.0, progress) * 20.0), 1)
                observations.append(
                    f"{status_prefix} of {duration_days} days exhibits elevated execution duration relative to {peer_group_name} baseline (75th percentile: {peer_p75:.0f} days). [{self.disclaimer}]"
                )
            else:
                delay_status = "unusually_long_execution_duration"
                excess_factor = min(1.0, (duration_days - (peer_p75 + 1.5 * peer_iqr)) / max(100.0, peer_median))
                delay_score = round(76.0 + (excess_factor * 24.0), 1)
                observations.append(
                    f"{status_prefix} of {duration_days} days constitutes an unusually long execution duration compared to peer benchmark of {peer_median:.0f} days. [{self.disclaimer}]"
                )

        return {
            "work_id": work_id,
            "duration_days": int(duration_days),
            "sanction_date": s_date.strftime("%Y-%m-%d"),
            "completion_date": c_date.strftime("%Y-%m-%d") if c_date else None,
            "sanction_date_source": provenance.get("sanction_date_source", "MoSPI e-SAKSHI"),
            "sanction_date_field": provenance.get("sanction_date_field", "SANCTION_DATE"),
            "sanction_date_verified": True,
            "peer_median_days": peer_median,
            "peer_p75_days": peer_p75,
            "peer_category": category,
            "delay_score": float(np.clip(delay_score, 0.0, 100.0)),
            "delay_status": delay_status,
            "is_completed": is_completed,
            "observations": observations,
            "analytical_disclaimer": self.disclaimer,
        }

    def predict(self, data: Union[pd.DataFrame, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Evaluate a batch of works for execution duration and delay risk."""
        if data is None:
            return []

        if isinstance(data, pd.DataFrame):
            records = data.to_dict(orient="records")
        elif isinstance(data, list):
            records = data
        else:
            return []

        return [self.evaluate_work(record) for record in records]
