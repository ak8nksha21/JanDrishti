from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.work import Work
from app.models.mp_summary import MPFinancialSummary
from app.models.macro_summary import MacroMetric
from app.schemas.trend import TrendResult, TrendSummaryResponse
from ml.trend_analysis import TrendDetector

router = APIRouter(prefix="/trends", tags=["Trends"])
detector = TrendDetector()


@router.get("", response_model=TrendSummaryResponse, summary="Retrieve comprehensive Trend Intelligence summary")
@router.get("/summary", response_model=TrendSummaryResponse, summary="Retrieve comprehensive Trend Intelligence summary")
def get_trends_summary(
    state: Optional[str] = Query(None, description="Optional state filter for completion activity"),
    constituency: Optional[str] = Query(None, description="Optional constituency filter for completion activity"),
    category: Optional[str] = Query(None, description="Optional category filter for completion activity"),
    db: Session = Depends(get_db),
):
    """
    Generate comprehensive, explainable Trend Intelligence across empirical MPLADS records.
    - Project Completion Activity is dynamically calculated from verified work completion timestamps.
    - Financial metrics (Expenditure, Recommendations, Unspent Balance) are evaluated from the ledger and
      return transparent 'insufficient_data' indicators due to single-point current tenure snapshot scope.
    """
    # 1. Query works for completion activity
    works_query = db.query(Work).filter(Work.completion_date.isnot(None))
    if state and state.strip():
        works_query = works_query.filter(Work.state.ilike(f"%{state.strip()}%"))
    if constituency and constituency.strip():
        works_query = works_query.filter(Work.constituency.ilike(f"%{constituency.strip()}%"))
    if category and category.strip() and category.strip().lower() != "all":
        works_query = works_query.filter(Work.category.ilike(f"%{category.strip()}%"))

    works_records = works_query.all()
    completion_trend = detector.analyze_completion_activity(works_records=works_records)

    # 2. Get national financial figures for snapshot context
    total_exp = db.query(func.sum(MPFinancialSummary.total_expenditure)).scalar() or 0.0
    total_rec = db.query(func.sum(MPFinancialSummary.total_recommended_amount)).scalar() or 0.0
    total_unspent = db.query(func.sum(MPFinancialSummary.unspent_amount)).scalar() or 0.0

    expenditure_trend = detector.analyze_financial_metric(
        metric_name="National Parliamentary Expenditure",
        current_value=round(float(total_exp) / 1e7, 2),  # in Crores
        unit="₹ Cr",
    )

    recommendations_trend = detector.analyze_financial_metric(
        metric_name="Parliamentary Recommendations Value",
        current_value=round(float(total_rec) / 1e7, 2),  # in Crores
        unit="₹ Cr",
    )

    unspent_trend = detector.analyze_financial_metric(
        metric_name="Unspent Parliamentary Outlay",
        current_value=round(float(total_unspent) / 1e7, 2),  # in Crores
        unit="₹ Cr",
    )

    return {
        "completion_activity": completion_trend,
        "expenditure_trend": expenditure_trend,
        "recommendations_trend": recommendations_trend,
        "unspent_balance_trend": unspent_trend,
        "data_audit_notice": (
            "Temporal trend intelligence requires verifiable historical observations. "
            "Completion activity reflects the active granular registry (591 works sample). "
            "Financial ledger totals represent a single cumulative snapshot of current-tenure figures (774 MPs nationwide)."
        ),
    }


@router.get("/completion", response_model=TrendResult, summary="Retrieve project completion velocity trend")
def get_completion_trend(
    state: Optional[str] = Query(None, description="Optional state filter"),
    constituency: Optional[str] = Query(None, description="Optional constituency filter"),
    category: Optional[str] = Query(None, description="Optional category filter"),
    db: Session = Depends(get_db),
):
    """
    Evaluate quarterly project completion activity velocity across itemized completed works.
    """
    query = db.query(Work).filter(Work.completion_date.isnot(None))
    if state and state.strip():
        query = query.filter(Work.state.ilike(f"%{state.strip()}%"))
    if constituency and constituency.strip():
        query = query.filter(Work.constituency.ilike(f"%{constituency.strip()}%"))
    if category and category.strip() and category.strip().lower() != "all":
        query = query.filter(Work.category.ilike(f"%{category.strip()}%"))

    works = query.all()
    return detector.analyze_completion_activity(works_records=works)


@router.get("/financial/{metric_name}", response_model=TrendResult, summary="Retrieve financial metric trend status")
def get_financial_trend(
    metric_name: str,
    db: Session = Depends(get_db),
):
    """
    Retrieve explainable trend status for financial metrics.
    """
    valid_metrics = {
        "expenditure": ("National Parliamentary Expenditure", func.sum(MPFinancialSummary.total_expenditure)),
        "recommendations": ("Parliamentary Recommendations Value", func.sum(MPFinancialSummary.total_recommended_amount)),
        "unspent": ("Unspent Parliamentary Outlay", func.sum(MPFinancialSummary.unspent_amount)),
    }

    key = metric_name.lower().strip()
    if key not in valid_metrics:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown financial metric '{metric_name}'. Supported metrics: expenditure, recommendations, unspent",
        )

    title, col_expr = valid_metrics[key]
    val = db.query(col_expr).scalar() or 0.0
    return detector.analyze_financial_metric(
        metric_name=title,
        current_value=round(float(val) / 1e7, 2),
        unit="₹ Cr",
    )
