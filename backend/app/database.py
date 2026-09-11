import logging
import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

logger = logging.getLogger("jandrishti.database")

db_url = settings.database_url

# If SQLite is configured or fallback is needed
connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args)
else:
    try:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_recycle=300
        )
        # Test connection
        with engine.connect() as conn:
            pass
    except Exception as exc:
        logger.warning(
            f"Unable to connect to PostgreSQL ({exc}). Falling back to local SQLite database at data/jandrishti.db"
        )
        os.makedirs("data", exist_ok=True)
        sqlite_url = "sqlite:///./data/jandrishti.db"
        engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

