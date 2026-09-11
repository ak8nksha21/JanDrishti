from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.data_quality import (
    DataQualityBatchResponse,
    DataQualitySummaryResponse,
    WorkQualityReportResponse,
)
from app.services.duplicate import DataQualityService

router = APIRouter(prefix="/data-quality", tags=["Data Quality"])
service = DataQualityService()


@router.get("/audit", response_model=DataQualityBatchResponse)
def audit_dataset_quality(
    constituency: Optional[str] = Query(None, description="Filter audit by constituency"),
    state: Optional[str] = Query(None, description="Filter audit by state"),
    category: Optional[str] = Query(None, description="Filter audit by category"),
    only_issues: bool = Query(False, description="Return only records that have quality issues"),
    limit: int = Query(500, ge=1, le=2000, description="Maximum number of work records to audit"),
    db: Session = Depends(get_db)
):
    """
    Perform a comprehensive data quality and completeness audit across stored works.
    Detects missing fields, invalid GPS, negative/zero costs, future dates, and duplicate work_ids.
    """
    result = service.audit_batch(
        db=db,
        constituency=constituency,
        state=state,
        category=category,
        only_issues=only_issues,
        limit=limit
    )
    return result


@router.get("/summary", response_model=DataQualitySummaryResponse)
def get_data_quality_summary(
    constituency: Optional[str] = Query(None, description="Filter summary by constituency"),
    state: Optional[str] = Query(None, description="Filter summary by state"),
    db: Session = Depends(get_db)
):
    """
    Retrieve high-level summary of dataset quality, issue breakdown by code, and completeness metrics.
    """
    result = service.get_quality_summary(
        db=db,
        constituency=constituency,
        state=state
    )
    return result


@router.get("/works/{work_id}", response_model=WorkQualityReportResponse)
def audit_work_by_id(
    work_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve itemized data quality report for a specific work item by internal ID,
    eSAKSHI work_id, or source ObjectId.
    """
    result = service.audit_single_work(db=db, work_id=work_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Work with identifier '{work_id}' was not found in the database."
        )
    return result
