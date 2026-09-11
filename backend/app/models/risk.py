from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Float, DateTime, Text, JSON, Index
from app.database import Base


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    work_id = Column(String(64), index=True, nullable=False)
    cost_score = Column(Float, default=0.0)
    duplicate_score = Column(Float, default=0.0)
    ml_anomaly_score = Column(Float, default=0.0)
    utilization_score = Column(Float, default=0.0)
    geographic_score = Column(Float, default=0.0)
    data_quality_score = Column(Float, default=0.0)
    overall_score = Column(Float, index=True, default=0.0)
    risk_level = Column(String(32), index=True, default="Low")  # Low, Medium, High, Critical
    model_version = Column(String(64), default="v1.0-ensemble")
    flags_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    work_id = Column(String(64), index=True, nullable=False)
    risk_score = Column(Float, nullable=False)
    severity = Column(String(32), index=True, default="Medium")  # Low, Medium, High, Critical
    reason = Column(Text, nullable=False)
    evidence_json = Column(JSON, nullable=True)
    status = Column(String(64), index=True, default="New")  # New, Under Review, Verified, Dismissed, Resolved
    reviewed_by = Column(String(128), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(DateTime, nullable=True)


class SimilarWork(Base):
    __tablename__ = "similar_works"

    id = Column(Integer, primary_key=True, autoincrement=True)
    work_id = Column(String(64), index=True, nullable=False)
    matched_work_id = Column(String(64), index=True, nullable=False)
    text_similarity = Column(Float, default=0.0)
    cost_similarity = Column(Float, default=0.0)
    geographic_similarity = Column(Float, default=0.0)
    combined_similarity = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(128), default="system")
    action = Column(String(128), index=True, nullable=False)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(64), nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, index=True, default=lambda: datetime.now(timezone.utc))

