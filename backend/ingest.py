#!/usr/bin/env python3
"""
JanDrishti Data Ingestion CLI

Usage:
    python ingest.py --all
    python ingest.py --constituency SHAHJAHANPUR
    python ingest.py --mps
    python ingest.py --mospi
"""
import sys
import argparse
import logging
from app.database import engine, Base
from app.services.ingestion.service import IngestionService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("jandrishti.cli")


def main():
    parser = argparse.ArgumentParser(description="JanDrishti MPLADS Data Ingestion Tool")
    parser.add_argument("--all", action="store_true", help="Ingest all available data (works, MPs, MoSPI macro)")
    parser.add_argument("--constituency", type=str, help="Ingest completed works for a specific constituency (e.g. SHAHJAHANPUR)")
    parser.add_argument("--mps", action="store_true", help="Ingest MP financial & execution summaries")
    parser.add_argument("--mospi", action="store_true", help="Ingest MoSPI eSAKSHI macro dashboard tiles")
    parser.add_argument("--init-db", action="store_true", help="Initialize database tables if they do not exist")

    args = parser.parse_args()

    # Ensure tables exist
    logger.info("Verifying database schema...")
    Base.metadata.create_all(bind=engine)

    service = IngestionService()

    if args.init_db and not (args.all or args.constituency or args.mps or args.mospi):
        logger.info("Database schema initialized successfully.")
        return

    if args.all:
        logger.info("=== Running Full Ingestion Pipeline ===")
        # 1. MoSPI macro metrics
        try:
            mospi_res = service.ingest_mospi_macro_data()
            logger.info(f"MoSPI Ingestion: {mospi_res}")
        except Exception as e:
            logger.error(f"MoSPI Ingestion failed: {e}")

        # 2. MP Summaries
        try:
            mp_res = service.ingest_mp_summaries()
            logger.info(f"MP Summaries Ingestion: {mp_res}")
        except Exception as e:
            logger.error(f"MP Summaries Ingestion failed: {e}")

        # 3. Shahjahanpur Works (and default constituency)
        try:
            works_res = service.ingest_completed_works(constituency=args.constituency or "SHAHJAHANPUR")
            logger.info(f"Works Ingestion: {works_res}")
        except Exception as e:
            logger.error(f"Works Ingestion failed: {e}")

    else:
        if args.mospi:
            mospi_res = service.ingest_mospi_macro_data()
            logger.info(f"MoSPI Ingestion: {mospi_res}")

        if args.mps:
            mp_res = service.ingest_mp_summaries()
            logger.info(f"MP Summaries Ingestion: {mp_res}")

        if args.constituency:
            works_res = service.ingest_completed_works(constituency=args.constituency)
            logger.info(f"Works Ingestion: {works_res}")

        if not (args.mospi or args.mps or args.constituency):
            # Default to Shahjahanpur + MP summaries + MoSPI
            logger.info("No specific flag provided, running standard sample ingestion...")
            try:
                service.ingest_mospi_macro_data()
            except Exception as e:
                logger.warning(f"MoSPI macro ingestion warning: {e}")
            service.ingest_mp_summaries()
            service.ingest_completed_works(constituency="SHAHJAHANPUR")

    logger.info("=== Ingestion Finished Successfully ===")


if __name__ == "__main__":
    main()
