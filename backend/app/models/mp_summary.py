from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Index, UniqueConstraint
from app.database import Base


class MPFinancialSummary(Base):
    """
    Model representing an MP's MPLADS financial and execution summary metrics.
    Populated with actual fields discovered from the API.
    """
    __tablename__ = "mp_financial_summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String(64), nullable=True, index=True)
    
    mp_name = Column(String(255), nullable=True, index=True)
    house = Column(String(100), nullable=True)
    state = Column(String(255), nullable=True, index=True)
    constituency = Column(String(255), nullable=True, index=True)
    
    allocated_amount = Column(Float, nullable=True)
    total_expenditure = Column(Float, nullable=True)
    total_recommended_amount = Column(Float, nullable=True)
    
    utilization_percentage = Column(Float, nullable=True)
    recommendation_utilization_percentage = Column(Float, nullable=True)
    expenditure_percentage = Column(Float, nullable=True)
    utilization_definition = Column(String(100), nullable=True)
    
    completed_works_count = Column(Integer, nullable=True)
    recommended_works_count = Column(Integer, nullable=True)
    completion_rate = Column(Float, nullable=True)
    pending_works = Column(Integer, nullable=True)
    
    unspent_amount = Column(Float, nullable=True)
    unpaid_balance = Column(Float, nullable=True)
    completed_works_value = Column(Float, nullable=True)
    total_completed_amount = Column(Float, nullable=True)
    in_progress_payments = Column(Float, nullable=True)
    payment_gap_percentage = Column(Float, nullable=True)
    
    source = Column(String(100), default="empowered_indian", nullable=False, index=True)
    raw_data_path = Column(String(512), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("source", "source_id", name="uq_mp_source_source_id"),
        Index("ix_mp_source_source_id", "source", "source_id"),
        Index("ix_mp_name_constituency", "mp_name", "constituency"),
    )
