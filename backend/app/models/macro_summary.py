from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, DateTime
from app.database import Base


class MacroMetric(Base):
    """
    Model representing national macro indicators and totals from official sources like MoSPI.
    """
    __tablename__ = "macro_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    metric_key = Column(String(128), unique=True, index=True, nullable=False)
    metric_name = Column(String(255), nullable=True)
    metric_value_raw = Column(String(255), nullable=True)
    metric_value_crores = Column(String(255), nullable=True)
    metric_count = Column(BigInteger, nullable=True)
    source = Column(String(100), default="mospi_esakshi", nullable=False)
    raw_data_path = Column(String(512), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
