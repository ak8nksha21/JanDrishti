import logging
import re
from datetime import datetime
from typing import Dict, Any, Optional, List
from app.utils.sanitizer import sanitize_text

logger = logging.getLogger("jandrishti.ingestion.validation")


def parse_datetime(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        val = val.strip()
        # Handle ISO formats e.g. 2024-11-25T00:00:00.000Z
        try:
            if val.endswith("Z"):
                val = val[:-1]
            return datetime.fromisoformat(val)
        except Exception:
            # Fallback to date pattern matching
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                try:
                    return datetime.strptime(val, fmt)
                except ValueError:
                    pass
    return None


def parse_float(val: Any) -> Optional[float]:
    if val is None or val == "":
        return None
    try:
        if isinstance(val, str):
            clean_str = val.replace(",", "").replace("\xa0", "").strip()
            return float(clean_str)
        return float(val)
    except (ValueError, TypeError):
        return None


def parse_int(val: Any) -> Optional[int]:
    if val is None or val == "":
        return None
    try:
        if isinstance(val, str):
            clean_str = val.replace(",", "").replace("\xa0", "").strip()
            return int(float(clean_str))
        return int(val)
    except (ValueError, TypeError):
        return None


def normalize_work(raw_item: Dict[str, Any], raw_filepath: Optional[str] = None, source: str = "empowered_indian") -> Dict[str, Any]:
    """
    Normalize raw work record into standardized database dictionary with
    PII sanitization and accurate data types.
    """
    mp_details = raw_item.get("mp_details") or {}
    gps = raw_item.get("gps_coordinates") or {}
    
    # Extract GPS if available (do not fabricate if missing)
    lat = parse_float(gps.get("latitude") or gps.get("lat"))
    lon = parse_float(gps.get("longitude") or gps.get("lng") or gps.get("long"))

    # Photos metadata
    photos = raw_item.get("photos")
    if not photos or (isinstance(photos, dict) and not photos.get("before") and not photos.get("after")):
        photos_meta = None
    else:
        photos_meta = photos

    # Impact metrics
    impact = raw_item.get("impact_metrics")
    impact_meta = impact if impact and isinstance(impact, dict) and len(impact) > 0 else None

    # MP info
    mp_name = mp_details.get("name") or raw_item.get("mp_name")
    if mp_name:
        mp_name = mp_name.strip()
    
    mp_name_hi = mp_details.get("name_hi") or raw_item.get("mp_name_hi")
    if mp_name_hi:
        mp_name_hi = mp_name_hi.strip()

    constituency = mp_details.get("constituency") or raw_item.get("constituency")
    if constituency:
        constituency = constituency.strip()

    constituency_hi = mp_details.get("constituency_hi") or raw_item.get("constituency_hi")
    if constituency_hi:
        constituency_hi = constituency_hi.strip()

    house = mp_details.get("house") or mp_details.get("party") or raw_item.get("house")

    return {
        "work_id": parse_int(raw_item.get("work_id")),
        "source_id": str(raw_item.get("_id")) if raw_item.get("_id") else None,
        "work_description": sanitize_text(raw_item.get("work_description")),
        "work_description_hi": sanitize_text(raw_item.get("work_description_hi")),
        "cost": parse_float(raw_item.get("cost")),
        "completion_date": parse_datetime(raw_item.get("completion_date")),
        "completion_year": parse_int(raw_item.get("completion_year")),
        "mp_name": mp_name,
        "mp_name_hi": mp_name_hi,
        "constituency": constituency,
        "constituency_hi": constituency_hi,
        "state": (raw_item.get("state") or "").strip() or None,
        "state_hi": (raw_item.get("state_hi") or "").strip() or None,
        "house": house,
        "category": (raw_item.get("category") or "").strip() or None,
        "category_hi": (raw_item.get("category_hi") or "").strip() or None,
        "district": (raw_item.get("district") or "").strip() or None,
        "district_hi": (raw_item.get("district_hi") or "").strip() or None,
        "location": sanitize_text(raw_item.get("location")),
        "location_hi": sanitize_text(raw_item.get("location_hi")),
        "beneficiaries": parse_int(raw_item.get("beneficiaries")),
        "implementing_agency": raw_item.get("implementing_agency"),
        "implementing_agency_hi": raw_item.get("implementing_agency_hi"),
        "quality_rating": parse_float(raw_item.get("quality_rating")),
        "latitude": lat,
        "longitude": lon,
        "photos_metadata": photos_meta,
        "impact_metrics": impact_meta,
        "source": source,
        "raw_data_path": raw_filepath
    }


def normalize_mp_summary(raw_item: Dict[str, Any], raw_filepath: Optional[str] = None, source: str = "empowered_indian") -> Dict[str, Any]:
    """
    Normalize raw MP financial and execution summary metrics.
    """
    mp_name = raw_item.get("mpName") or raw_item.get("name")
    if mp_name:
        mp_name = mp_name.strip()

    constituency = raw_item.get("constituency")
    if constituency:
        constituency = constituency.strip()

    state = raw_item.get("state")
    if state:
        state = state.strip()

    return {
        "source_id": str(raw_item.get("id") or raw_item.get("_id") or ""),
        "mp_name": mp_name,
        "house": raw_item.get("house"),
        "state": state,
        "constituency": constituency,
        "allocated_amount": parse_float(raw_item.get("allocatedAmount")),
        "total_expenditure": parse_float(raw_item.get("totalExpenditure")),
        "total_recommended_amount": parse_float(raw_item.get("totalRecommendedAmount")),
        "utilization_percentage": parse_float(raw_item.get("utilizationPercentage")),
        "recommendation_utilization_percentage": parse_float(raw_item.get("recommendationUtilizationPercentage")),
        "expenditure_percentage": parse_float(raw_item.get("expenditurePercentage")),
        "utilization_definition": raw_item.get("utilizationDefinition"),
        "completed_works_count": parse_int(raw_item.get("completedWorksCount")),
        "recommended_works_count": parse_int(raw_item.get("recommendedWorksCount")),
        "completion_rate": parse_float(raw_item.get("completionRate")),
        "pending_works": parse_int(raw_item.get("pendingWorks")),
        "unspent_amount": parse_float(raw_item.get("unspentAmount")),
        "unpaid_balance": parse_float(raw_item.get("unpaidBalance")),
        "completed_works_value": parse_float(raw_item.get("completedWorksValue")),
        "total_completed_amount": parse_float(raw_item.get("totalCompletedAmount")),
        "in_progress_payments": parse_float(raw_item.get("inProgressPayments")),
        "payment_gap_percentage": parse_float(raw_item.get("paymentGapPercentage")),
        "source": source,
        "raw_data_path": raw_filepath
    }


def normalize_mospi_tiles(raw_data: Dict[str, Any], raw_filepath: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Normalize MoSPI tiles data into a list of macro metric records.
    """
    metrics = []
    
    mapping = {
        "Allocated Limit for Hon'ble MPs": "allocated_limit",
        "Expenditure on Completed and On-going Works as on Date": "expenditure_completed_ongoing",
        "Works Recommended": "works_recommended",
        "Works Sanctioned": "works_sanctioned",
        "Works Completed": "works_completed"
    }

    for key, values in raw_data.items():
        metric_key = mapping.get(key, re.sub(r'[^a-zA-Z0-9_]', '_', key.lower()))
        metric_name = key
        raw_val = None
        crores_val = None
        count_val = None

        if isinstance(values, list):
            if len(values) == 2:
                raw_val = values[0].strip()
                crores_val = values[1].strip()
            elif len(values) >= 3:
                count_val = parse_int(values[0])
                raw_val = values[1].strip()
                crores_val = values[2].strip()

        metrics.append({
            "metric_key": metric_key,
            "metric_name": metric_name,
            "metric_value_raw": raw_val,
            "metric_value_crores": crores_val,
            "metric_count": count_val,
            "source": "mospi_esakshi",
            "raw_data_path": raw_filepath
        })

    return metrics
