import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.work import Work
from app.schemas.investigation import InvestigationResponse
from app.schemas.agent import InvestigationResult, InvestigationRequest
from app.services.agent.agent import InvestigationAgent
from app.services.agent.investigator import AIAgentInvestigator

logger = logging.getLogger("jandrishti.routes.investigate")

router = APIRouter(prefix="/investigate", tags=["Investigation Agent"])


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


@router.post("/{work_id}", response_model=InvestigationResponse, status_code=status.HTTP_200_OK)
def investigate_work(
    work_id: str,
    db: Session = Depends(get_db)
):
    """
    Trigger an AI-driven investigation on an individual MPLADS work item.

    Orchestrates evidence gathering across 8 structured investigation tools,
    computes composite risk scores, and synthesizes actionable verification
    checklists for inspection officers.
    """
    logger.info(f"Received investigation request for work_id='{work_id}'")
    work = None

    # Polymorphic lookup: eSAKSHI work_id or internal database ID
    if work_id.isdigit():
        numeric_id = int(work_id)
        work = db.query(Work).filter(
            or_(Work.work_id == numeric_id, Work.id == numeric_id)
        ).first()

    # Fallback to source_id (MongoDB hex string)
    if not work:
        work = db.query(Work).filter(Work.source_id == work_id).first()

    if not work:
        logger.warning(f"Work identifier '{work_id}' not found in database.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work with identifier '{work_id}' was not found in the database."
        )

    agent = InvestigationAgent(db=db)
    return agent.investigate(work)
