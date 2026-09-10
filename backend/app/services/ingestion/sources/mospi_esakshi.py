import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger("jandrishti.ingestion.mospi")


class MoSPIeSAKSHIAdapter:
    """
    Source adapter for the official Ministry of Statistics and Programme Implementation
    (MoSPI) e-SAKSHI public portal. Fetches unauthenticated public macro dashboard tiles,
    sanction totals, and state metadata.
    """
    BASE_URL = "https://mplads.mospi.gov.in"

    def __init__(self, raw_data_dir: Optional[str] = None, timeout: float = 30.0):
        self.timeout = timeout
        if raw_data_dir:
            self.raw_data_dir = raw_data_dir
        else:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
            self.raw_data_dir = os.path.join(base_dir, "data", "raw")
        os.makedirs(self.raw_data_dir, exist_ok=True)

    def _save_raw(self, prefix: str, data: Any) -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"mospi_esakshi_{prefix}_{timestamp}.json"
        filepath = os.path.join(self.raw_data_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"Preserved raw MoSPI response at {filepath}")
        return filepath

    def fetch_tiles_data(self) -> (Dict[str, Any], str):
        """
        Fetch national macro indicators (Allocated Limit, Expenditure, Works Recommended,
        Works Sanctioned, Works Completed) from MoSPI pre-login dashboard.
        """
        url = f"{self.BASE_URL}/rest/PreLoginDashboardData/getTilesData"
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json"
        }
        payload = {"uname": "0,0,0,2"}
        try:
            # verify=False is used if government portal SSL bundle is self-signed/expired
            with httpx.Client(timeout=self.timeout, verify=False) as client:
                response = client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                raw_path = self._save_raw("tiles", data)
                return data, raw_path
        except Exception as e:
            logger.error(f"Failed to fetch MoSPI tiles data: {e}")
            raise

    def fetch_state_data(self) -> (Any, str):
        """Fetch state list and IDs from MoSPI dashboard."""
        url = f"{self.BASE_URL}/rest/PreLoginDashboardData/getStateData"
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json"
        }
        payload = {"uname": "0,0,0,2"}
        try:
            with httpx.Client(timeout=self.timeout, verify=False) as client:
                response = client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                raw_path = self._save_raw("states", data)
                return data, raw_path
        except Exception as e:
            logger.error(f"Failed to fetch MoSPI state data: {e}")
            raise
