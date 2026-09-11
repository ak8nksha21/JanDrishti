import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, status, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.ingestion.service import IngestionService
from app.schemas.sync import SyncResponse

logger = logging.getLogger("jandrishti.routes.sync")

router = APIRouter(prefix="/sync", tags=["Sync"])


@router.post("", response_model=SyncResponse, status_code=status.HTTP_200_OK)
def trigger_sync(
    response: Response,
    constituency: Optional[str] = Query(None, description="Optional constituency filter for completed works synchronization"),
    db: Session = Depends(get_db)
):
    """
    Trigger full data synchronization across external MPLADS sources
    (Empowered Indian and MoSPI eSAKSHI) and update PostgreSQL records idempotently.
    """
    logger.info("Triggered POST /api/sync")
    service = IngestionService(db=db)
    result = service.sync_all(constituency=constituency)

    if result["status"] == "failed":
        response.status_code = status.HTTP_502_BAD_GATEWAY
    elif result["status"] == "partial_success":
        response.status_code = status.HTTP_200_OK  # Keep 200 OK with status='partial_success' for client compatibility

    return result
