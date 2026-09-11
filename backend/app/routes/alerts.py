from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.work import Work
from app.models.risk import Alert, AuditLog
from app.schemas.alert import AlertOut, AlertUpdate
from app.services.risk.service import get_work_id_str

router = APIRouter(prefix="/alerts", tags=["Alerts & Triage"])


@router.get("", response_model=List[AlertOut])
def get_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    if status and status != "All":
        query = query.filter(Alert.status == status)
    if severity and severity != "All":
        query = query.filter(Alert.severity == severity)

    alerts = query.order_by(Alert.risk_score.desc(), Alert.id.desc()).all()

    # Enrich with work metadata
    results = []
    for a in alerts:
        work = None
        if a.work_id.isdigit():
            num = int(a.work_id)
            work = db.query(Work).filter(or_(Work.work_id == num, Work.id == num)).first()
        if not work:
            work = db.query(Work).filter(or_(Work.source_id == a.work_id, Work.work_id == a.work_id)).first()

        results.append(AlertOut(
            id=a.id,
            work_id=a.work_id,
            risk_score=a.risk_score,
            severity=a.severity,
            reason=a.reason,
            evidence_json=a.evidence_json,
            status=a.status,
            reviewed_by=a.reviewed_by,
            notes=a.notes,
            created_at=a.created_at,
            reviewed_at=a.reviewed_at,
            work_title=(work.work_description if work else "Unknown Work")[:80],
            constituency=work.constituency if work else "Unknown",
            category=work.category if work else "General",
            cost=round(float(work.cost or 0.0), 2) if work else 0.0
        ))

    return results


@router.patch("/{alert_id}", response_model=AlertOut)
def update_alert(
    alert_id: int,
    payload: AlertUpdate,
    db: Session = Depends(get_db)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = payload.status
    if payload.reviewed_by:
        alert.reviewed_by = payload.reviewed_by
    if payload.notes is not None:
        alert.notes = payload.notes
    alert.reviewed_at = datetime.now(timezone.utc)

    # Log audit event
    audit = AuditLog(
        user_id=payload.reviewed_by or "officer",
        action="ALERT_STATUS_UPDATE",
        resource_type="ALERT",
        resource_id=str(alert_id),
        metadata_json={
            "new_status": payload.status,
            "notes": payload.notes
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(alert)

    work = db.query(Work).filter(or_(Work.source_id == alert.work_id, Work.work_id == alert.work_id)).first()

    return AlertOut(
        id=alert.id,
        work_id=alert.work_id,
        risk_score=alert.risk_score,
        severity=alert.severity,
        reason=alert.reason,
        evidence_json=alert.evidence_json,
        status=alert.status,
        reviewed_by=alert.reviewed_by,
        notes=alert.notes,
        created_at=alert.created_at,
        reviewed_at=alert.reviewed_at,
        work_title=(work.work_description if work else "Work")[:80],
        constituency=work.constituency if work else "Unknown",
        category=work.category if work else "General",
        cost=round(float(work.cost or 0.0), 2) if work else 0.0
    )
