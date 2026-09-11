import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
import httpx

logger = logging.getLogger("jandrishti.ingestion.empowered_indian")


class EmpoweredIndianAdapter:
    """
    Source adapter for Empowered Indian public APIs providing granular
    completed works and MP-wise financial & execution summaries.
    """
    BASE_URL = "https://api.empoweredindian.in/api"

    def __init__(self, raw_data_dir: Optional[str] = None, timeout: float = 30.0):
        self.timeout = timeout
        if raw_data_dir:
            self.raw_data_dir = raw_data_dir
        else:
            # Fallback path to data/raw in project root
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
            self.raw_data_dir = os.path.join(base_dir, "data", "raw")
        os.makedirs(self.raw_data_dir, exist_ok=True)

    def _save_raw(self, prefix: str, data: Any) -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"empowered_indian_{prefix}_{timestamp}.json"
        filepath = os.path.join(self.raw_data_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"Preserved raw API response at {filepath}")
        return filepath

    def fetch_completed_works(
        self,
        constituency: Optional[str] = None,
        state: Optional[str] = None,
        page: int = 1,
        limit: int = 100
    ) -> Dict[str, Any]:
        """Fetch a single paginated page of completed works with optional constituency/state filter."""
        url = f"{self.BASE_URL}/works/completed"
        safe_limit = min(max(1, limit), 100)
        params: Dict[str, Any] = {"page": page, "limit": safe_limit}
        if constituency:
            params["constituency"] = constituency.strip()
        if state:
            params["state"] = state.strip()

        headers = {"User-Agent": "JanDrishti-Ingestion-Engine/1.0"}
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(url, params=params, headers=headers)
                response.raise_for_status()
                data = response.json()
                return data
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching completed works: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error fetching completed works: {e}")
            raise

    def fetch_all_completed_works(
        self,
        constituency: Optional[str] = None,
        state: Optional[str] = None,
        max_pages: Optional[int] = None,
        page_limit: int = 100
    ) -> (List[Dict[str, Any]], str):
        """
        Fetch paginated completed works for a constituency, state, or nationally
        and preserve the combined raw dataset.
        """
        all_works: List[Dict[str, Any]] = []
        current_page = 1
        total_pages = 1
        safe_page_limit = min(max(1, page_limit), 100)

        scope_desc = f"constituency={constituency}" if constituency else (f"state={state}" if state else "national")
        logger.info(f"Starting completed works fetch (scope={scope_desc}, max_pages={max_pages})")

        while current_page <= total_pages:
            if max_pages and current_page > max_pages:
                break

            try:
                resp_data = self.fetch_completed_works(
                    constituency=constituency,
                    state=state,
                    page=current_page,
                    limit=safe_page_limit
                )
            except Exception as page_err:
                logger.error(f"Failed fetching page {current_page} for {scope_desc}: {page_err}")
                if all_works:
                    break
                raise

            data_section = resp_data.get("data", {})
            works = data_section.get("completedWorks", [])
            all_works.extend(works)

            pagination = data_section.get("pagination", {})
            total_pages = pagination.get("totalPages", current_page)
            has_next = pagination.get("hasNext", False)

            logger.info(
                f"Fetched page {current_page}/{total_pages} ({len(works)} works, total accumulated: {len(all_works)})"
            )

            if not has_next:
                break
            current_page += 1

        if constituency:
            clean_name = "".join(c if c.isalnum() else "_" for c in constituency.lower())
            prefix = f"completed_works_constituency_{clean_name}"
        elif state:
            clean_name = "".join(c if c.isalnum() else "_" for c in state.lower())
            prefix = f"completed_works_state_{clean_name}"
        else:
            prefix = "completed_works_national"

        raw_filepath = self._save_raw(prefix, all_works)
        return all_works, raw_filepath

    def fetch_individual_work(self, mongo_id: str) -> Dict[str, Any]:
        """Fetch full details for an individual work by its MongoDB ObjectId."""
        url = f"{self.BASE_URL}/works/completed/{mongo_id}"
        headers = {"User-Agent": "JanDrishti-Ingestion-Engine/1.0"}
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(url, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch individual work {mongo_id}: {e}")
            raise

    def fetch_mp_summaries(self, page: int = 1, limit: int = 800) -> Dict[str, Any]:
        """Fetch MP financial and execution summaries."""
        url = f"{self.BASE_URL}/summary/mps"
        params = {"page": page, "limit": limit}
        headers = {"User-Agent": "JanDrishti-Ingestion-Engine/1.0"}
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(url, params=params, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch MP summaries: {e}")
            raise

    def fetch_all_mp_summaries(self, page_limit: int = 800) -> (List[Dict[str, Any]], str):
        """Fetch all MP summaries across both houses and save raw response."""
        all_mps: List[Dict[str, Any]] = []
        current_page = 1
        total_pages = 1

        logger.info("Starting MP summaries fetch")
        while current_page <= total_pages:
            resp_data = self.fetch_mp_summaries(page=current_page, limit=page_limit)
            mps = resp_data.get("data", [])
            all_mps.extend(mps)

            pagination = resp_data.get("pagination", {})
            total_pages = pagination.get("totalPages", current_page)
            if pagination.get("currentPage", current_page) >= total_pages:
                break
            current_page += 1

        logger.info(f"Total MP summaries retrieved: {len(all_mps)}")
        raw_filepath = self._save_raw("mp_summaries", all_mps)
        return all_mps, raw_filepath
