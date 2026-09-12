"""
JanDrishti - Official MoSPI e-SAKSHI Sanction Enrichment Service

Provides read-only retrieval and caching of verified official sanction baselines
(sanction amount, administrative approval date, activity number, work stage)
directly matched from official MoSPI e-SAKSHI data on:
    WORK_RECOMMENDATION_DTL_ID == work_id

STRICT INTEGRITY RULES:
1. Zero synthetic or inferred data: if a work is not present in official data, returns None.
2. Never fall back to works.cost or recommended_amount as an official baseline.
3. Total records count is dynamically calculated as len(records) (an integer).
4. Automated tests run strictly offline against the cached snapshot without live network calls.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Union, List

logger = logging.getLogger("jandrishti.enrichment.esakshi")


def _find_cache_path(custom_path: Optional[str] = None) -> str:
    if custom_path and os.path.exists(custom_path):
        return custom_path

    # Standard candidate paths across host and Docker environments
    candidates = [
        # Relative to this file: backend/app/services/enrichment/esakshi.py -> data/processed/...
        os.path.abspath(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "..",
                "..",
                "..",
                "data",
                "processed",
                "mospi_esakshi_sanctions_cache.json",
            )
        ),
        # Docker root or container working dir: /app/data/processed/...
        "/app/data/processed/mospi_esakshi_sanctions_cache.json",
        # Local workspace direct path
        "/Users/akankshayadav/Documents/JanDrishti/data/processed/mospi_esakshi_sanctions_cache.json",
        # Current working directory fallback
        os.path.abspath(os.path.join("data", "processed", "mospi_esakshi_sanctions_cache.json")),
    ]

    for p in candidates:
        if os.path.exists(p):
            return p

    # Default to first candidate even if not yet created
    return candidates[0]


class OfficialSanctionService:
    """
    Service for looking up verified MoSPI e-SAKSHI sanction baselines.
    Operates offline using the deduplicated local cache snapshot.
    """

    def __init__(self, cache_file_path: Optional[str] = None):
        self.cache_file_path = _find_cache_path(cache_file_path)
        self.source_name = "MoSPI e-SAKSHI"
        self.endpoint = "/rest/PreLoginDashboardData/getTilesReportData"
        self.retrieved_at: Optional[str] = None
        self.records: Dict[str, Dict[str, Any]] = {}
        self.load_cache()

    @property
    def total_records(self) -> int:
        """Dynamic record count derived strictly from the unique records dictionary."""
        return len(self.records)

    def load_cache(self) -> bool:
        """Load and index official sanction records from the cached snapshot file."""
        if not os.path.exists(self.cache_file_path):
            logger.warning(
                f"Official e-SAKSHI cache file not found at {self.cache_file_path}. "
                "Service initialized with empty records."
            )
            self.records = {}
            self.retrieved_at = None
            return False

        try:
            with open(self.cache_file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            self.source_name = data.get("source", "MoSPI e-SAKSHI")
            self.endpoint = data.get("endpoint", "/rest/PreLoginDashboardData/getTilesReportData")
            self.retrieved_at = data.get("retrieved_at")
            raw_records = data.get("records", {})

            # Index by string work_id for fast lookup
            indexed_records: Dict[str, Dict[str, Any]] = {}
            for k, v in raw_records.items():
                wid = str(v.get("work_recommendation_dtl_id") or v.get("WORK_RECOMMENDATION_DTL_ID") or k).strip()
                if wid:
                    indexed_records[wid] = v

            self.records = indexed_records
            logger.info(
                f"Loaded {len(self.records)} unique official sanction records from cache "
                f"({self.cache_file_path}, retrieved_at={self.retrieved_at})."
            )
            return True
        except Exception as e:
            logger.error(f"Failed to load e-SAKSHI cache from {self.cache_file_path}: {e}")
            self.records = {}
            return False

    def get_sanction_info(self, work_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        """
        Retrieve verified official sanction baseline for a specific work item.

        Returns:
            Dict containing:
                - official_sanction_amount (float)
                - official_sanction_date (str, e.g. '22-Apr-2026')
                - official_sanction_source ('MoSPI e-SAKSHI')
                - official_sanction_field ('SANCTION_AMOUNT')
                - official_sanction_match_key ('WORK_RECOMMENDATION_DTL_ID == work_id')
                - official_sanction_verified (True)
                - official_sanction_work_number (str)
                - activity_name (str)
                - work_stage (str)
                - mp_name (str)
                - constituency (str)
                - state_name (str)
                - retrieved_at (str)
            or None if no official match is found.
        """
        if work_id is None:
            return None

        wid_str = str(work_id).strip()
        rec = self.records.get(wid_str)
        if not rec:
            return None

        # Extract amount
        raw_amt = rec.get("sanction_amount") if "sanction_amount" in rec else rec.get("SANCTION_AMOUNT")
        sanction_amount = None
        if raw_amt is not None:
            try:
                sanction_amount = float(raw_amt)
            except (ValueError, TypeError):
                sanction_amount = None

        # Extract date
        sanction_date = rec.get("sanction_date") or rec.get("SANCTION_DATE")

        # Extract activity name and work number
        activity_name = rec.get("activity_name") or rec.get("ACTIVITY_NAME") or ""
        work_number = (
            activity_name.split("-")[0].strip()
            if "-" in activity_name
            else activity_name.strip()
        )

        work_stage = rec.get("work_stage") or rec.get("WORK_STAGE")
        mp_name = rec.get("mp_name") or rec.get("MP_NAME")
        constituency = rec.get("constituency") or rec.get("CONSTITUENCY")
        state_name = rec.get("state_name") or rec.get("STATE_NAME")

        return {
            "work_id": int(wid_str) if wid_str.isdigit() else wid_str,
            "official_sanction_amount": sanction_amount,
            "official_sanction_date": sanction_date,
            "official_sanction_source": self.source_name,
            "official_sanction_field": "SANCTION_AMOUNT",
            "official_sanction_match_key": "WORK_RECOMMENDATION_DTL_ID == work_id",
            "official_sanction_verified": True,
            "official_sanction_work_number": work_number,
            "activity_name": activity_name,
            "work_stage": work_stage,
            "mp_name": mp_name,
            "constituency": constituency,
            "state_name": state_name,
            "retrieved_at": self.retrieved_at,
        }

    @staticmethod
    def build_cache_dict(
        raw_records_list: List[Dict[str, Any]],
        retrieved_at: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Deterministically merge and deduplicate raw records by WORK_RECOMMENDATION_DTL_ID.
        Computes total_records = len(records) dynamically as an integer.
        """
        deduped_records: Dict[str, Dict[str, Any]] = {}
        for item in raw_records_list:
            wid = item.get("WORK_RECOMMENDATION_DTL_ID") or item.get("work_recommendation_dtl_id")
            if wid is not None:
                wid_str = str(wid).strip()
                # Store normalized schema
                raw_amt = item.get("SANCTION_AMOUNT") if "SANCTION_AMOUNT" in item else item.get("sanction_amount")
                try:
                    amt = float(raw_amt) if raw_amt is not None else None
                except (ValueError, TypeError):
                    amt = None

                s_date = item.get("SANCTION_DATE") or item.get("sanction_date")
                act_name = item.get("ACTIVITY_NAME") or item.get("activity_name")
                stage = item.get("WORK_STAGE") or item.get("work_stage")
                mp = item.get("MP_NAME") or item.get("mp_name")
                const = item.get("CONSTITUENCY") or item.get("constituency")
                state = item.get("STATE_NAME") or item.get("state_name")

                deduped_records[wid_str] = {
                    "work_recommendation_dtl_id": int(wid_str) if wid_str.isdigit() else wid_str,
                    "sanction_amount": amt,
                    "sanction_date": s_date,
                    "activity_name": act_name,
                    "work_stage": stage,
                    "mp_name": mp,
                    "constituency": const,
                    "state_name": state,
                }

        iso_timestamp = retrieved_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        return {
            "source": "MoSPI e-SAKSHI",
            "endpoint": "/rest/PreLoginDashboardData/getTilesReportData",
            "retrieved_at": iso_timestamp,
            "total_records": len(deduped_records),  # Dynamic integer count
            "records": deduped_records,
        }

    def save_cache_file(
        self,
        raw_records_list: List[Dict[str, Any]],
        output_path: Optional[str] = None,
        retrieved_at: Optional[str] = None
    ) -> str:
        """Save a new snapshot cache file and reload internal index."""
        target_path = output_path or self.cache_file_path
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        cache_data = self.build_cache_dict(raw_records_list, retrieved_at=retrieved_at)
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)

        self.cache_file_path = target_path
        self.load_cache()
        logger.info(f"Persisted official e-SAKSHI snapshot with {self.total_records} records to {target_path}")
        return target_path


# Global singleton instance for application use
official_sanction_service = OfficialSanctionService()
