from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class AlertBase(BaseModel):
    work_id: str
    risk_score: float
    severity: str
    reason: str
    evidence_json: Optional[Any] = None
    status: Optional[str] = "New"


class AlertUpdate(BaseModel):
    status: str  # New, Under Review, Verified, Dismissed, Resolved
    reviewed_by: Optional[str] = None
    notes: Optional[str] = None


class AlertOut(AlertBase):
    id: int
    created_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    notes: Optional[str] = None
    work_title: Optional[str] = None
    constituency: Optional[str] = None
    category: Optional[str] = None
    cost: Optional[float] = None

    class Config:
        from_attributes = True
