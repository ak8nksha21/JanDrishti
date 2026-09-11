import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
import app.models  # Ensures all models are registered on Base.metadata
from app.routes.works import router as works_router
from app.routes.mps import router as mps_router
from app.routes.dashboard import router as dashboard_router
from app.routes.sync import router as sync_router
from app.routes.risk import router as risk_router
from app.routes.investigate import router as investigate_router
from app.routes.alerts import router as alerts_router
from app.routes.audit import router as audit_router
from app.routes.dataset import router as dataset_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("jandrishti.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure database tables exist
    logger.info("Initializing database schema on startup...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database schema initialized successfully.")
    except Exception as e:
        logger.error(f"Error creating database tables on startup: {e}")
    yield
    # Shutdown
    logger.info("JanDrishti backend shutting down.")


app = FastAPI(
    title="JanDrishti API",
    description="AI-powered MPLADS Risk Monitoring & Anomaly Detection Platform",
    version="0.2.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers under /api
app.include_router(works_router, prefix="/api")
app.include_router(mps_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(sync_router, prefix="/api")
app.include_router(risk_router, prefix="/api")
app.include_router(investigate_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(dataset_router, prefix="/api")



@app.get("/")
def read_root():
    return {
        "project": "JanDrishti",
        "message": "MPLADS AI Risk Monitoring API",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }
