import csv
import os
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.work import Work
from app.models.mp_summary import MPFinancialSummary
from app.models.macro_summary import MacroMetric
from app.models.risk import RiskScore, Alert, AuditLog
from app.services.risk.service import run_full_risk_pipeline

router = APIRouter(prefix="/dataset", tags=["Dataset Management"])


def normalize_constituency(name: str) -> str:
    """Normalize constituency spelling."""
    if not name:
        return "UNKNOWN"
    clean = name.strip().upper()
    if "RAEBAR" in clean or "RAE BAREL" in clean:
        return "RAE BARELI"
    if "SHAHJAHAN" in clean:
        return "SHAHJAHANPUR"
    return clean


@router.get("/stats")
def get_dataset_stats(db: Session = Depends(get_db)):
    works_count = db.query(Work).count()
    mps_count = db.query(MPFinancialSummary).count()
    macros_count = db.query(MacroMetric).count()
    risk_scores_count = db.query(RiskScore).count()
    alerts_count = db.query(Alert).count()

    constituencies_count = db.query(func.count(func.distinct(Work.constituency))).scalar() or 0
    states_count = db.query(func.count(func.distinct(Work.state))).scalar() or 0

    return {
        "works_count": works_count,
        "mps_count": mps_count,
        "macro_metrics_count": macros_count,
        "risk_scores_count": risk_scores_count,
        "alerts_count": alerts_count,
        "distinct_constituencies": constituencies_count,
        "distinct_states": states_count
    }


@router.post("/load-csv")
def load_csv_dataset(
    max_records: int = Query(500, ge=10, le=10000, description="Max works to ingest from MPLADS.csv"),
    constituency: Optional[str] = Query(None, description="Optional constituency filter"),
    db: Session = Depends(get_db)
):
    """
    Ingests works from data/MPLADS.csv into the works database table,
    then automatically runs the composite risk scoring pipeline.
    """
    csv_path = "data/MPLADS.csv"
    if not os.path.exists(csv_path):
        csv_path = "../data/MPLADS.csv"
    if not os.path.exists(csv_path):
        csv_path = "data/raw/MPLADS.csv"

    if not os.path.exists(csv_path):
        return {"status": "error", "message": f"CSV file not found at {csv_path}"}

    target_const = normalize_constituency(constituency) if (isinstance(constituency, str) and constituency) else None

    inserted = 0
    with open(csv_path, mode="r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f, delimiter=";")
        for idx, row in enumerate(reader):
            if inserted >= max_records:
                break

            row_const = normalize_constituency(row.get("CONSTITUENCY", ""))
            if target_const and target_const not in row_const:
                continue

            # Parse cost (Allocation Amount in INR -> converted to Lakhs)
            try:
                raw_amt = float(row.get("ALLOCATION AMOUNT") or 0.0)
                cost_lakhs = round(raw_amt / 100000.0, 2)
            except Exception:
                cost_lakhs = 5.0

            # Generate synthetic but stable work_id from index/source
            work_id_val = 1000000 + idx

            existing = db.query(Work).filter(Work.work_id == work_id_val).first()
            if not existing:
                loc_parts = [row.get("VILLAGE", ""), row.get("BLOCK", ""), row.get("CITY", "")]
                loc = ", ".join([p for p in loc_parts if p])

                rec_date = None
                date_str = row.get("RECOMMENDED DATE", "")
                if date_str:
                    try:
                        rec_date = datetime.strptime(date_str, "%Y-%m-%d")
                    except Exception:
                        pass

                w = Work(
                    work_id=work_id_val,
                    source_id=f"csv_{idx}",
                    work_description=row.get("WORK", "Community Infrastructure Development"),
                    cost=cost_lakhs,
                    category=row.get("CATEGORY", "General Infrastructure"),
                    mp_name=row.get("MP NAME", "Hon. Member of Parliament"),
                    constituency=row_const,
                    state=row.get("STATE", "Uttar Pradesh"),
                    house=row.get("HOUSE", "Lok Sabha"),
                    district=row.get("CONSTITUENCY", "District"),
                    location=loc or "Constituency Area",
                    implementing_agency=row.get("IDA", "District Planning Office"),
                    completion_date=rec_date,
                    source="csv_esakshi"
                )
                db.add(w)
                inserted += 1

    db.commit()

    # Re-run risk scoring
    risk_summary = run_full_risk_pipeline(db)

    # Log audit
    audit = AuditLog(
        user_id="system",
        action="CSV_INGESTION_RUN",
        resource_type="DATASET_CSV",
        resource_id=f"inserted_{inserted}",
        metadata_json={
            "inserted_count": inserted,
            "filter_constituency": constituency,
            "risk_status": risk_summary
        }
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "inserted_records": inserted,
        "risk_pipeline": risk_summary
    }
