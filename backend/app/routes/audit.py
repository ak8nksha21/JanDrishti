from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.risk import AuditLog

router = APIRouter(prefix="/audit", tags=["Audit Trail"])


@router.get("/logs")
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "metadata": l.metadata_json or {},
            "created_at": l.created_at.isoformat() if l.created_at else None
        }
        for l in logs
    ]
