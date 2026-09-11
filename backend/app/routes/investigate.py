from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.agent.investigator import AIAgentInvestigator
from app.schemas.agent import InvestigationResult, InvestigationRequest

router = APIRouter(prefix="/investigate", tags=["AI Investigation Agent"])


@router.post("/brief", response_model=InvestigationResult)
def generate_investigation_brief(
    req: InvestigationRequest,
    db: Session = Depends(get_db)
):
    """
    Generate an explainable AI investigation brief on a target work item using
    deterministic analytical tools and verifiable database records.
    """
    agent = AIAgentInvestigator(db)
    result = agent.investigate(req.work_id)
    return result


@router.get("/tools")
def list_investigation_tools():
    """List available analytical tools for inspection."""
    return {
        "tools": [
            {
                "name": "get_work_details",
                "description": "Fetch complete source metadata and current status for a work."
            },
            {
                "name": "get_risk_breakdown",
                "description": "Retrieve the 6 individual component risk scores and composite rating."
            },
            {
                "name": "get_cost_analysis",
                "description": "Compare work cost against peer category in the same district/state."
            },
            {
                "name": "get_mp_financials",
                "description": "Fetch MP summary and financial utilization ratios."
            },
            {
                "name": "check_duplicate",
                "description": "Check duplicate and text/cost similarity matches."
            },
            {
                "name": "check_data_quality",
                "description": "Audit record completeness and missing critical fields."
            },
            {
                "name": "get_geographic_context",
                "description": "Analyze spatial proximity to neighboring works (<60m collision check)."
            }
        ]
    }
