"""Data Ingestion Services and Source Adapters"""
from app.services.ingestion.service import IngestionService
from app.services.ingestion.validation import normalize_work, normalize_mp_summary, normalize_mospi_tiles
from app.services.ingestion.sources.empowered_indian import EmpoweredIndianAdapter
from app.services.ingestion.sources.mospi_esakshi import MoSPIeSAKSHIAdapter

__all__ = [
    "IngestionService",
    "normalize_work",
    "normalize_mp_summary",
    "normalize_mospi_tiles",
    "EmpoweredIndianAdapter",
    "MoSPIeSAKSHIAdapter"
]
