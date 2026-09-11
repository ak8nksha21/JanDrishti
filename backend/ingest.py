#!/usr/bin/env python3
"""
JanDrishti Data Ingestion CLI

Usage:
    python ingest.py --all                      # Ingest MoSPI, 774 MPs, and first 5 national works pages (500 works)
    python ingest.py --all-works                # Full batch ingestion of ALL 44,028 national completed works
    python ingest.py --constituency SHAHJAHANPUR
    python ingest.py --state "Uttar Pradesh"
    python ingest.py --max-pages 10
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
    parser.add_argument("--all", action="store_true", help="Ingest MoSPI, MPs, and sample national completed works")
    parser.add_argument("--all-works", action="store_true", help="Full batch ingestion of ALL national completed works (44,000+ items)")
    parser.add_argument("--constituency", type=str, help="Ingest completed works for a specific constituency (e.g. SHAHJAHANPUR, MALKAJGIRI)")
    parser.add_argument("--state", type=str, help="Ingest completed works for a specific state (e.g. 'Uttar Pradesh', 'Goa')")
    parser.add_argument("--max-pages", type=int, default=None, help="Cap maximum pages to fetch (default: None for all matching pages)")
    parser.add_argument("--mps", action="store_true", help="Ingest MP financial & execution summaries")
    parser.add_argument("--mospi", action="store_true", help="Ingest MoSPI eSAKSHI macro dashboard tiles")
    parser.add_argument("--init-db", action="store_true", help="Initialize database tables if they do not exist")

    args = parser.parse_args()

    # Ensure tables exist
    logger.info("Verifying database schema...")
    Base.metadata.create_all(bind=engine)

    service = IngestionService()

    if args.init_db and not (args.all or args.all_works or args.constituency or args.state or args.mps or args.mospi):
        logger.info("Database schema initialized successfully.")
        return

    if args.all:
        logger.info("=== Running Full Ingestion Pipeline ===")
        max_p = args.max_pages or 5
        res = service.sync_all(constituency=args.constituency, state=args.state, max_pages=max_p)
        logger.info(f"Sync Results: {res}")
        logger.info("=== Ingestion Finished Successfully ===")
        return

    if args.all_works:
        logger.info("=== Running Full National Completed Works Batch Ingestion ===")
        works_res = service.ingest_completed_works(constituency=None, state=None, max_pages=args.max_pages)
        logger.info(f"National Works Ingestion: {works_res}")
        return

    if args.mospi:
        mospi_res = service.ingest_mospi_macro_data()
        logger.info(f"MoSPI Ingestion: {mospi_res}")

    if args.mps:
        mp_res = service.ingest_mp_summaries(max_pages=args.max_pages)
        logger.info(f"MP Summaries Ingestion: {mp_res}")

    if args.constituency or args.state:
        works_res = service.ingest_completed_works(
            constituency=args.constituency,
            state=args.state,
            max_pages=args.max_pages
        )
        logger.info(f"Works Ingestion: {works_res}")

    if not (args.mospi or args.mps or args.constituency or args.state or args.all_works):
        # Default sample ingestion
        logger.info("No specific flag provided, running standard sample ingestion (max 5 national pages)...")
        res = service.sync_all(max_pages=args.max_pages or 5)
        logger.info(f"Sync Results: {res}")

    logger.info("=== Ingestion Finished Successfully ===")


if __name__ == "__main__":
    main()
