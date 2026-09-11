"""
JanDrishti - Work Data Quality & Consistency Audit Module

Evaluates data completeness, validity, and integrity for MPLADS Work records.
Produces structured, explainable issue codes and quality metrics for consumption
by the Risk Engine and Investigation Agent.

Important Principles:
- Never convert NULL into zero.
- Never invent missing values.
- Do not fabricate GPS, cost, beneficiary or fraud information.
- This is an objective data-quality and compliance signal, NOT a fraud accusation.
"""
from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Union
import pandas as pd

from ml.geo_detection import validate_coordinates

# MPLADS was officially launched by the Government of India in December 1993
MPLADS_EARLIEST_YEAR = 1993
MAX_PLAUSIBLE_FUTURE_YEAR = 2030

# Common placeholder/junk text strings found in uncurated datasets
SUSPICIOUS_PLACEHOLDERS = {
    "na", "n/a", "n.a.", "nil", "null", "none", "no", ".", "-", "--", "---",
    "test", "testing", "demo", "sample", "xxx", "xxxx", "xyz", "asdf", "0", "?"
}


class QualityIssueSeverity:
    CRITICAL = "CRITICAL"  # Missing mandatory identifier, negative cost, mathematically impossible coordinates
    WARNING = "WARNING"    # Missing important metadata, date mismatch, suspicious placeholder description
    INFO = "INFO"          # Missing optional fields (e.g., GPS coordinates, photos, beneficiaries)


class QualityIssueCode:
    # Identifiers
    MISSING_ALL_IDENTIFIERS = "MISSING_ALL_IDENTIFIERS"
    MISSING_WORK_ID = "MISSING_WORK_ID"
    MISSING_SOURCE_ID = "MISSING_SOURCE_ID"
    DUPLICATE_WORK_ID = "DUPLICATE_WORK_ID"

    # Description
    MISSING_DESCRIPTION = "MISSING_DESCRIPTION"
    SUSPICIOUS_PLACEHOLDER_DESCRIPTION = "SUSPICIOUS_PLACEHOLDER_DESCRIPTION"
    TOO_SHORT_DESCRIPTION = "TOO_SHORT_DESCRIPTION"

    # Cost / Financials
    NEGATIVE_COST = "NEGATIVE_COST"
    ZERO_COST = "ZERO_COST"
    MISSING_COST = "MISSING_COST"
    EXTREME_COST_OUTLIER = "EXTREME_COST_OUTLIER"

    # Dates & Execution Timeline
    FUTURE_COMPLETION_DATE = "FUTURE_COMPLETION_DATE"
    PRE_MPLADS_COMPLETION_DATE = "PRE_MPLADS_COMPLETION_DATE"
    DATE_YEAR_MISMATCH = "DATE_YEAR_MISMATCH"
    MISSING_COMPLETION_DATE = "MISSING_COMPLETION_DATE"

    # Location & Administration
    MISSING_LOCATION = "MISSING_LOCATION"
    SUSPICIOUS_PLACEHOLDER_LOCATION = "SUSPICIOUS_PLACEHOLDER_LOCATION"
    MISSING_CONSTITUENCY = "MISSING_CONSTITUENCY"
    MISSING_STATE = "MISSING_STATE"
    MISSING_DISTRICT = "MISSING_DISTRICT"

    # GPS / Coordinates
    MISSING_GPS_COORDINATES = "MISSING_GPS_COORDINATES"
    INVALID_GPS_COORDINATES = "INVALID_GPS_COORDINATES"
    NULL_ISLAND_GPS = "NULL_ISLAND_GPS"
    SWAPPED_GPS_COORDINATES = "SWAPPED_GPS_COORDINATES"
    OUT_OF_BOUNDS_GPS = "OUT_OF_BOUNDS_GPS"

    # Other metadata
    MISSING_MP_NAME = "MISSING_MP_NAME"
    MISSING_CATEGORY = "MISSING_CATEGORY"


class WorkDataQualityAuditor:
    """
    Deterministic rule-based auditor that validates integrity, completeness,
    and consistency for individual works and batches.
    """

    def __init__(self, max_single_work_cost_inr: float = 1_000_000_000.0):
        """
        :param max_single_work_cost_inr: Cap for realistic single local MPLADS work (default 100 Crore INR).
        """
        self.max_single_work_cost_inr = max_single_work_cost_inr

    def _extract_dict(self, record: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """Convert SQLAlchemy model or dict into standard dictionary."""
        if isinstance(record, dict):
            return dict(record)
        if hasattr(record, "__dict__"):
            return {k: v for k, v in record.__dict__.items() if not k.startswith("_")}
        if hasattr(record, "to_dict"):
            return record.to_dict()
        return dict(record)

    def audit_work(self, work: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """
        Perform comprehensive data quality audit on a single work record.
        Returns a structured dictionary with detected issues, severity counts, and completeness.
        """
        w = self._extract_dict(work)
        issues: List[Dict[str, Any]] = []
        field_status: Dict[str, str] = {}

        # 1. Identifier Validation
        work_id = w.get("work_id")
        source_id = w.get("source_id")

        if work_id is None and not source_id:
            issues.append({
                "code": QualityIssueCode.MISSING_ALL_IDENTIFIERS,
                "severity": QualityIssueSeverity.CRITICAL,
                "field": "work_id",
                "message": "Both official work_id and source_id are missing. Work cannot be uniquely referenced."
            })
            field_status["identifiers"] = "missing_all"
        else:
            if work_id is None:
                issues.append({
                    "code": QualityIssueCode.MISSING_WORK_ID,
                    "severity": QualityIssueSeverity.WARNING,
                    "field": "work_id",
                    "message": "Official eSAKSHI work_id is missing (present only as source_id)."
                })
                field_status["work_id"] = "missing"
            else:
                field_status["work_id"] = "valid"

            if not source_id:
                issues.append({
                    "code": QualityIssueCode.MISSING_SOURCE_ID,
                    "severity": QualityIssueSeverity.INFO,
                    "field": "source_id",
                    "message": "Source MongoDB ObjectId is missing."
                })
                field_status["source_id"] = "missing"
            else:
                field_status["source_id"] = "valid"

        # 2. Description Validation
        desc = w.get("work_description")
        if desc is None or not isinstance(desc, str) or not desc.strip():
            issues.append({
                "code": QualityIssueCode.MISSING_DESCRIPTION,
                "severity": QualityIssueSeverity.CRITICAL,
                "field": "work_description",
                "message": "Work description is missing or blank."
            })
            field_status["work_description"] = "missing"
        else:
            clean_desc = desc.strip()
            if clean_desc.lower() in SUSPICIOUS_PLACEHOLDERS:
                issues.append({
                    "code": QualityIssueCode.SUSPICIOUS_PLACEHOLDER_DESCRIPTION,
                    "severity": QualityIssueSeverity.CRITICAL,
                    "field": "work_description",
                    "message": f"Work description is a placeholder/junk value: '{clean_desc}'."
                })
                field_status["work_description"] = "placeholder"
            elif len(clean_desc) < 5:
                issues.append({
                    "code": QualityIssueCode.TOO_SHORT_DESCRIPTION,
                    "severity": QualityIssueSeverity.WARNING,
                    "field": "work_description",
                    "message": f"Work description is suspiciously brief ({len(clean_desc)} chars): '{clean_desc}'."
                })
                field_status["work_description"] = "too_short"
            else:
                field_status["work_description"] = "valid"

        # 3. Cost / Financial Validation (Never convert NULL to 0)
        cost = w.get("cost")
        if cost is None or cost == "":
            issues.append({
                "code": QualityIssueCode.MISSING_COST,
                "severity": QualityIssueSeverity.WARNING,
                "field": "cost",
                "message": "Recorded cost is NULL (cost data not provided by source API)."
            })
            field_status["cost"] = "missing"
        else:
            try:
                f_cost = float(cost)
                if math.isnan(f_cost) or math.isinf(f_cost):
                    issues.append({
                        "code": QualityIssueCode.NEGATIVE_COST,
                        "severity": QualityIssueSeverity.CRITICAL,
                        "field": "cost",
                        "message": "Cost contains NaN or infinite value."
                    })
                    field_status["cost"] = "invalid"
                elif f_cost < 0:
                    issues.append({
                        "code": QualityIssueCode.NEGATIVE_COST,
                        "severity": QualityIssueSeverity.CRITICAL,
                        "field": "cost",
                        "message": f"Recorded expenditure is negative (₹{f_cost:,.2f})."
                    })
                    field_status["cost"] = "negative"
                elif f_cost == 0:
                    issues.append({
                        "code": QualityIssueCode.ZERO_COST,
                        "severity": QualityIssueSeverity.WARNING,
                        "field": "cost",
                        "message": "Recorded expenditure is exactly ₹0.00."
                    })
                    field_status["cost"] = "zero"
                elif f_cost > self.max_single_work_cost_inr:
                    issues.append({
                        "code": QualityIssueCode.EXTREME_COST_OUTLIER,
                        "severity": QualityIssueSeverity.WARNING,
                        "field": "cost",
                        "message": f"Recorded expenditure of ₹{f_cost:,.2f} exceeds realistic local MPLADS limit."
                    })
                    field_status["cost"] = "extreme_outlier"
                else:
                    field_status["cost"] = "valid"
            except (ValueError, TypeError):
                issues.append({
                    "code": QualityIssueCode.NEGATIVE_COST,
                    "severity": QualityIssueSeverity.CRITICAL,
                    "field": "cost",
                    "message": f"Non-numeric cost value: '{cost}'."
                })
                field_status["cost"] = "invalid_format"

        # 4. Dates & Timeline Validation
        comp_date = w.get("completion_date")
        comp_year = w.get("completion_year")
        parsed_dt: Optional[datetime] = None

        if comp_date is not None:
            if isinstance(comp_date, datetime):
                parsed_dt = comp_date
            elif isinstance(comp_date, str) and comp_date.strip():
                try:
                    parsed_dt = datetime.fromisoformat(comp_date.replace("Z", ""))
                except Exception:
                    pass

        if parsed_dt is not None:
            field_status["completion_date"] = "valid"
            # Future date check
            current_year = datetime.now().year
            if parsed_dt.year > current_year + 1 or parsed_dt.year > MAX_PLAUSIBLE_FUTURE_YEAR:
                issues.append({
                    "code": QualityIssueCode.FUTURE_COMPLETION_DATE,
                    "severity": QualityIssueSeverity.CRITICAL,
                    "field": "completion_date",
                    "message": f"Completion date {parsed_dt.strftime('%Y-%m-%d')} is in the future."
                })
                field_status["completion_date"] = "future_date"
            elif parsed_dt.year < MPLADS_EARLIEST_YEAR:
                issues.append({
                    "code": QualityIssueCode.PRE_MPLADS_COMPLETION_DATE,
                    "severity": QualityIssueSeverity.CRITICAL,
                    "field": "completion_date",
                    "message": f"Completion date year ({parsed_dt.year}) precedes MPLADS program inception (1993)."
                })
                field_status["completion_date"] = "pre_mplads_date"

            # Check year consistency
            if comp_year is not None and comp_year != parsed_dt.year:
                issues.append({
                    "code": QualityIssueCode.DATE_YEAR_MISMATCH,
                    "severity": QualityIssueSeverity.WARNING,
                    "field": "completion_year",
                    "message": f"Recorded completion_year ({comp_year}) mismatches completion_date year ({parsed_dt.year})."
                })
        else:
            if comp_year is not None:
                if comp_year < MPLADS_EARLIEST_YEAR or comp_year > MAX_PLAUSIBLE_FUTURE_YEAR:
                    issues.append({
                        "code": QualityIssueCode.PRE_MPLADS_COMPLETION_DATE,
                        "severity": QualityIssueSeverity.CRITICAL,
                        "field": "completion_year",
                        "message": f"Recorded completion year ({comp_year}) is out of valid range (1993-{MAX_PLAUSIBLE_FUTURE_YEAR})."
                    })
                field_status["completion_date"] = "year_only"
            else:
                issues.append({
                    "code": QualityIssueCode.MISSING_COMPLETION_DATE,
                    "severity": QualityIssueSeverity.INFO,
                    "field": "completion_date",
                    "message": "Completion date and year are both missing."
                })
                field_status["completion_date"] = "missing"

        # 5. Geographic Coordinates Validation
        lat = w.get("latitude")
        lon = w.get("longitude")
        geo_val = validate_coordinates(lat, lon)

        if geo_val["status"] == "missing":
            issues.append({
                "code": QualityIssueCode.MISSING_GPS_COORDINATES,
                "severity": QualityIssueSeverity.INFO,
                "field": "latitude",
                "message": "GPS coordinates not available in source data."
            })
            field_status["gps"] = "missing"
        elif geo_val["status"] == "null_island_placeholder":
            issues.append({
                "code": QualityIssueCode.NULL_ISLAND_GPS,
                "severity": QualityIssueSeverity.CRITICAL,
                "field": "latitude",
                "message": "GPS coordinates recorded as (0.0, 0.0) Null Island placeholder."
            })
            field_status["gps"] = "null_island"
        elif geo_val["status"] == "suspected_swapped_coordinates":
            issues.append({
                "code": QualityIssueCode.SWAPPED_GPS_COORDINATES,
                "severity": QualityIssueSeverity.WARNING,
                "field": "latitude",
                "message": geo_val["reason"]
            })
            field_status["gps"] = "swapped"
        elif geo_val["status"] == "outside_india_bounding_box":
            issues.append({
                "code": QualityIssueCode.OUT_OF_BOUNDS_GPS,
                "severity": QualityIssueSeverity.WARNING,
                "field": "latitude",
                "message": geo_val["reason"]
            })
            field_status["gps"] = "out_of_bounds"
        elif not geo_val["is_usable"]:
            issues.append({
                "code": QualityIssueCode.INVALID_GPS_COORDINATES,
                "severity": QualityIssueSeverity.CRITICAL,
                "field": "latitude",
                "message": geo_val["reason"]
            })
            field_status["gps"] = "invalid"
        else:
            field_status["gps"] = "valid"

        # 6. Location & Administration Validation
        loc = w.get("location")
        if not loc or not str(loc).strip():
            issues.append({
                "code": QualityIssueCode.MISSING_LOCATION,
                "severity": QualityIssueSeverity.INFO,
                "field": "location",
                "message": "Specific location text is missing."
            })
            field_status["location"] = "missing"
        elif str(loc).strip().lower() in SUSPICIOUS_PLACEHOLDERS:
            issues.append({
                "code": QualityIssueCode.SUSPICIOUS_PLACEHOLDER_LOCATION,
                "severity": QualityIssueSeverity.WARNING,
                "field": "location",
                "message": f"Specific location text is a generic placeholder: '{loc}'."
            })
            field_status["location"] = "placeholder"
        else:
            field_status["location"] = "valid"

        if not w.get("constituency") or not str(w.get("constituency")).strip():
            issues.append({
                "code": QualityIssueCode.MISSING_CONSTITUENCY,
                "severity": QualityIssueSeverity.WARNING,
                "field": "constituency",
                "message": "Parliamentary constituency is not specified."
            })
            field_status["constituency"] = "missing"
        else:
            field_status["constituency"] = "valid"

        if not w.get("state") or not str(w.get("state")).strip():
            issues.append({
                "code": QualityIssueCode.MISSING_STATE,
                "severity": QualityIssueSeverity.WARNING,
                "field": "state",
                "message": "State name is not specified."
            })
            field_status["state"] = "missing"
        else:
            field_status["state"] = "valid"

        if not w.get("district") or not str(w.get("district")).strip():
            issues.append({
                "code": QualityIssueCode.MISSING_DISTRICT,
                "severity": QualityIssueSeverity.INFO,
                "field": "district",
                "message": "District name is not specified."
            })
            field_status["district"] = "missing"
        else:
            field_status["district"] = "valid"

        if not w.get("category") or not str(w.get("category")).strip():
            issues.append({
                "code": QualityIssueCode.MISSING_CATEGORY,
                "severity": QualityIssueSeverity.INFO,
                "field": "category",
                "message": "Category classification is missing."
            })
            field_status["category"] = "missing"
        else:
            field_status["category"] = "valid"

        if not w.get("mp_name") or not str(w.get("mp_name")).strip():
            issues.append({
                "code": QualityIssueCode.MISSING_MP_NAME,
                "severity": QualityIssueSeverity.INFO,
                "field": "mp_name",
                "message": "MP Name is not specified."
            })
            field_status["mp_name"] = "missing"
        else:
            field_status["mp_name"] = "valid"

        # Completeness calculation across 8 core fields
        core_fields = ["work_description", "cost", "completion_date", "constituency", "state", "district", "category", "mp_name"]
        present_count = sum(1 for f in core_fields if field_status.get(f) in ("valid", "year_only"))
        completeness_score = round(present_count / len(core_fields), 4)

        crit_count = sum(1 for i in issues if i["severity"] == QualityIssueSeverity.CRITICAL)
        warn_count = sum(1 for i in issues if i["severity"] == QualityIssueSeverity.WARNING)
        info_count = sum(1 for i in issues if i["severity"] == QualityIssueSeverity.INFO)

        return {
            "work_id": w.get("id"),
            "external_work_id": w.get("work_id"),
            "source_id": w.get("source_id"),
            "has_issues": len(issues) > 0,
            "total_issues": len(issues),
            "critical_issues_count": crit_count,
            "warning_issues_count": warn_count,
            "info_issues_count": info_count,
            "completeness_score": completeness_score,
            "field_status": field_status,
            "issues": issues
        }

    def audit_batch(
        self,
        works: List[Union[Dict[str, Any], Any]]
    ) -> Dict[str, Any]:
        """
        Audit a batch of works and detect dataset-level issues like duplicate work_ids or source_ids.
        """
        dict_works = [self._extract_dict(w) for w in works]
        total_works = len(dict_works)

        work_reports = [self.audit_work(w) for w in dict_works]

        # Check for batch-level duplicate IDs
        seen_work_ids: Dict[int, List[int]] = {}
        seen_source_ids: Dict[str, List[int]] = {}

        for idx, w in enumerate(dict_works):
            w_id = w.get("work_id")
            s_id = w.get("source_id")
            if w_id is not None:
                seen_work_ids.setdefault(w_id, []).append(idx)
            if s_id:
                seen_source_ids.setdefault(s_id, []).append(idx)

        # Flag duplicate work_ids in reports
        for w_id, indices in seen_work_ids.items():
            if len(indices) > 1:
                for idx in indices:
                    work_reports[idx]["issues"].append({
                        "code": QualityIssueCode.DUPLICATE_WORK_ID,
                        "severity": QualityIssueSeverity.CRITICAL,
                        "field": "work_id",
                        "message": f"Duplicate work_id '{w_id}' shared across {len(indices)} separate database records."
                    })
                    work_reports[idx]["critical_issues_count"] += 1
                    work_reports[idx]["total_issues"] += 1
                    work_reports[idx]["has_issues"] = True

        # Aggregate statistics
        total_critical = sum(r["critical_issues_count"] for r in work_reports)
        total_warnings = sum(r["warning_issues_count"] for r in work_reports)
        total_info = sum(r["info_issues_count"] for r in work_reports)
        avg_completeness = (
            round(sum(r["completeness_score"] for r in work_reports) / total_works, 4)
            if total_works > 0 else 1.0
        )

        # Issue code breakdown
        code_counts: Dict[str, int] = {}
        for r in work_reports:
            for issue in r["issues"]:
                code = issue["code"]
                code_counts[code] = code_counts.get(code, 0) + 1

        works_with_critical = sum(1 for r in work_reports if r["critical_issues_count"] > 0)
        works_with_warnings = sum(1 for r in work_reports if r["warning_issues_count"] > 0)
        clean_works = sum(1 for r in work_reports if r["critical_issues_count"] == 0 and r["warning_issues_count"] == 0)

        return {
            "total_works_audited": total_works,
            "clean_works_count": clean_works,
            "works_with_critical_issues": works_with_critical,
            "works_with_warnings": works_with_warnings,
            "average_completeness_score": avg_completeness,
            "total_critical_issues": total_critical,
            "total_warnings": total_warnings,
            "total_info_notices": total_info,
            "issue_breakdown_by_code": code_counts,
            "work_reports": work_reports
        }
