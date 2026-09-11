"""API Route Handlers"""
from app.routes.works import router as works_router
from app.routes.mps import router as mps_router
from app.routes.dashboard import router as dashboard_router
from app.routes.sync import router as sync_router
from app.routes.anomalies import router as anomalies_router
from app.routes.risk import router as risk_router

__all__ = [
    "works_router",
    "mps_router",
    "dashboard_router",
    "sync_router",
    "anomalies_router",
    "risk_router",
]

