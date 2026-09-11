"""
JanDrishti - Machine Learning Configuration & Thresholds

Centralizes all default ML parameters, geometric constraints, administrative bounds,
and heuristic thresholds across duplicate detection, geographic analysis, and data quality auditing.
"""

# Duplicate Detection Thresholds
DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD: float = 0.85
DEFAULT_TARGET_SIMILARITY_THRESHOLD: float = 0.75
DEFAULT_COST_SIMILARITY_RATIO_THRESHOLD: float = 0.95

# Geographic Analysis Thresholds
DEFAULT_MAX_GEO_DISTANCE_METERS: float = 500.0
DEFAULT_IMMEDIATE_OVERLAP_METERS: float = 50.0
DEFAULT_STREET_COMPOUND_METERS: float = 200.0
DEFAULT_NEIGHBORHOOD_METERS: float = 1000.0
DEFAULT_LOCALITY_METERS: float = 5000.0

# Geographic Duplicate Confidence Thresholds
DEFAULT_GEO_SIMILARITY_THRESHOLD: float = 0.75
DEFAULT_GEO_DUPLICATE_SIMILARITY_THRESHOLD: float = 0.85
DEFAULT_GEO_DUPLICATE_CATEGORY_SIMILARITY_THRESHOLD: float = 0.70
DEFAULT_GEO_DUPLICATE_MAX_DISTANCE_METERS: float = 50.0

# Geographic Territorial Bounding Box for India (inclusive of island territories)
INDIA_LAT_MIN: float = 6.0
INDIA_LAT_MAX: float = 38.0
INDIA_LON_MIN: float = 68.0
INDIA_LON_MAX: float = 98.0

# Data Quality Auditing Constants
MPLADS_EARLIEST_YEAR: int = 1993
MAX_PLAUSIBLE_FUTURE_YEAR: int = 2030
MAX_SINGLE_WORK_COST_INR: float = 1_000_000_000.0  # 100 Crore INR realistic single local work cap
MIN_DESCRIPTION_LENGTH: int = 5
