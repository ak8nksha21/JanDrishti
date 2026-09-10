from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Text, Float, DateTime, JSON, Index, UniqueConstraint
from app.database import Base


class Work(Base):
    """
    Model representing an individual MPLADS completed/sanctioned work item.
    Populated with actual data fields discovered from authoritative sources.
    """
    __tablename__ = "works"

    id = Column(Integer, primary_key=True, autoincrement=True)
    work_id = Column(BigInteger, nullable=True, index=True)
    source_id = Column(String(64), nullable=True, index=True)
    
    work_description = Column(Text, nullable=True)
    work_description_hi = Column(Text, nullable=True)
    
    cost = Column(Float, nullable=True)
    completion_date = Column(DateTime, nullable=True)
    completion_year = Column(Integer, nullable=True)
    
    mp_name = Column(String(255), nullable=True, index=True)
    mp_name_hi = Column(String(255), nullable=True)
    constituency = Column(String(255), nullable=True, index=True)
    constituency_hi = Column(String(255), nullable=True)
    state = Column(String(255), nullable=True, index=True)
    state_hi = Column(String(255), nullable=True)
    house = Column(String(100), nullable=True)
    
    category = Column(String(255), nullable=True, index=True)
    category_hi = Column(String(255), nullable=True)
    district = Column(String(255), nullable=True, index=True)
    district_hi = Column(String(255), nullable=True)
    location = Column(Text, nullable=True)
    location_hi = Column(Text, nullable=True)
    
    beneficiaries = Column(Integer, nullable=True)
    implementing_agency = Column(String(255), nullable=True)
    implementing_agency_hi = Column(String(255), nullable=True)
    
    quality_rating = Column(Float, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    photos_metadata = Column(JSON, nullable=True)
    impact_metrics = Column(JSON, nullable=True)
    
    source = Column(String(100), default="empowered_indian", nullable=False, index=True)
    raw_data_path = Column(String(512), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("source", "work_id", name="uq_works_source_work_id"),
        UniqueConstraint("source", "source_id", name="uq_works_source_source_id"),
        Index("ix_works_source_work_id", "source", "work_id"),
        Index("ix_works_source_source_id", "source", "source_id"),
    )
