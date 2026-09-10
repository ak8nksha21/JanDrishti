"""Source Adapters for MPLADS Data Ingestion"""
from app.services.ingestion.sources.empowered_indian import EmpoweredIndianAdapter
from app.services.ingestion.sources.mospi_esakshi import MoSPIeSAKSHIAdapter

__all__ = ["EmpoweredIndianAdapter", "MoSPIeSAKSHIAdapter"]
