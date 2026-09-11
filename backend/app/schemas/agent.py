from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class ToolInvocation(BaseModel):
    tool: str
    arguments: Dict[str, Any]
    output: Any


class InvestigationRequest(BaseModel):
    work_id: str


class InvestigationResult(BaseModel):
    work_id: str
    work_title: str
    risk_level: str
    overall_score: float
    primary_reasons: List[str]
    supporting_evidence: Dict[str, Any]
    matched_works: List[Dict[str, Any]]
    data_limitations: List[str]
    recommended_action: str
    tools_called: List[ToolInvocation]
    generated_at: str
