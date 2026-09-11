from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class SyncResponse(BaseModel):
    status: str
    message: str
    timestamp: datetime
    summary: Dict[str, Any]
    errors: List[str] = []
