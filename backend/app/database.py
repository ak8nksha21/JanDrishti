import logging
import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

logger = logging.getLogger("jandrishti.database")

db_url = settings.database_url

if db_url.startswith("sqlite"):
    engine_kwargs = {"connect_args": {"check_same_thread": False}}
    if ":memory:" in db_url or db_url in ("sqlite://", "sqlite:///"):
        engine_kwargs["poolclass"] = StaticPool
    engine = create_engine(db_url, **engine_kwargs)
else:
    try:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_recycle=300
        )
    except Exception as exc:
        logger.warning(
            f"Unable to initialize PostgreSQL engine ({exc}). Falling back to local SQLite database."
        )
        # Search for data/jandrishti.db in project root or relative directories
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        possible_paths = [
            os.path.join(base_dir, "data", "jandrishti.db"),
            os.path.join(base_dir, "backend", "data", "jandrishti.db"),
            os.path.abspath("data/jandrishti.db"),
            os.path.abspath("backend/data/jandrishti.db"),
            os.path.abspath("../data/jandrishti.db"),
        ]
        db_file = None
        for p in possible_paths:
            if os.path.exists(p) and os.path.getsize(p) > 0:
                db_file = p
                break
        if not db_file:
            db_file = possible_paths[0]
            os.makedirs(os.path.dirname(db_file), exist_ok=True)
            
        sqlite_url = f"sqlite:///{db_file}"
        logger.info(f"Using SQLite database at {db_file}")
        engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
