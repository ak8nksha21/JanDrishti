import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import SessionLocal
from app.models.work import Work
from app.models.mp_summary import MPFinancialSummary
from app.models.macro_summary import MacroMetric
from app.services.ingestion.sources.empowered_indian import EmpoweredIndianAdapter
from app.services.ingestion.sources.mospi_esakshi import MoSPIeSAKSHIAdapter
from app.services.ingestion.validation import (
    normalize_work,
    normalize_mp_summary,
    normalize_mospi_tiles
)

logger = logging.getLogger("jandrishti.ingestion.service")


class IngestionService:
    """
    Core ingestion service coordinating source adapters, normalization,
    validation, and idempotent PostgreSQL upserts.
    """

    def __init__(
        self,
        db: Optional[Session] = None,
        empowered_adapter: Optional[EmpoweredIndianAdapter] = None,
        mospi_adapter: Optional[MoSPIeSAKSHIAdapter] = None
    ):
        self._external_db = db
        self.empowered_adapter = empowered_adapter or EmpoweredIndianAdapter()
        self.mospi_adapter = mospi_adapter or MoSPIeSAKSHIAdapter()

    def _get_db(self) -> Session:
        return self._external_db if self._external_db is not None else SessionLocal()

    def ingest_completed_works(
        self,
        constituency: Optional[str] = None,
        state: Optional[str] = None,
        max_pages: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Ingest completed works from Empowered Indian API into PostgreSQL.
        Supports constituency filter, state filter, or national pagination.
        Guarantees idempotency on repeated executions.
        """
        scope_desc = f"constituency={constituency}" if constituency else (f"state={state}" if state else "national")
        logger.info(f"Starting works ingestion (scope={scope_desc}, max_pages={max_pages})")
        raw_works, raw_filepath = self.empowered_adapter.fetch_all_completed_works(
            constituency=constituency,
            state=state,
            max_pages=max_pages
        )

        db = self._get_db()
        inserted_count = 0
        updated_count = 0
        error_count = 0

        try:
            for item in raw_works:
                try:
                    norm_data = normalize_work(item, raw_filepath=raw_filepath, source="empowered_indian")
                    work_id = norm_data.get("work_id")
                    source_id = norm_data.get("source_id")

                    # Find existing record by work_id or source_id
                    existing_work = None
                    if work_id:
                        existing_work = db.query(Work).filter(
                            Work.source == "empowered_indian",
                            Work.work_id == work_id
                        ).first()
                    elif source_id:
                        existing_work = db.query(Work).filter(
                            Work.source == "empowered_indian",
                            Work.source_id == source_id
                        ).first()

                    if existing_work:
                        for k, v in norm_data.items():
                            setattr(existing_work, k, v)
                        updated_count += 1
                    else:
                        new_work = Work(**norm_data)
                        db.add(new_work)
                        inserted_count += 1
                except Exception as row_err:
                    logger.error(f"Error processing work record {item.get('work_id')}: {row_err}")
                    error_count += 1

            db.commit()
            logger.info(f"Works Ingestion Complete ({scope_desc}): Fetched={len(raw_works)}, Inserted={inserted_count}, Updated={updated_count}, Errors={error_count}")
            return {
                "source": "empowered_indian",
                "type": "completed_works",
                "scope": "constituency" if constituency else ("state" if state else "national"),
                "constituency": constituency,
                "state": state,
                "total_fetched": len(raw_works),
                "inserted": inserted_count,
                "updated": updated_count,
                "errors": error_count,
                "raw_file": raw_filepath
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Critical error during works ingestion: {e}")
            raise
        finally:
            if self._external_db is None:
                db.close()

    def ingest_mp_summaries(self, max_pages: Optional[int] = None) -> Dict[str, Any]:
        """
        Ingest MP financial and performance summaries into PostgreSQL.
        Guarantees idempotency on repeated executions.
        """
        logger.info("Starting MP summaries ingestion")
        raw_mps, raw_filepath = self.empowered_adapter.fetch_all_mp_summaries()

        db = self._get_db()
        inserted_count = 0
        updated_count = 0
        error_count = 0

        try:
            for item in raw_mps:
                try:
                    norm_data = normalize_mp_summary(item, raw_filepath=raw_filepath, source="empowered_indian")
                    source_id = norm_data.get("source_id")
                    mp_name = norm_data.get("mp_name")
                    constituency = norm_data.get("constituency")

                    existing_mp = None
                    if source_id:
                        existing_mp = db.query(MPFinancialSummary).filter(
                            MPFinancialSummary.source == "empowered_indian",
                            MPFinancialSummary.source_id == source_id
                        ).first()
                    
                    if not existing_mp and mp_name and constituency:
                        existing_mp = db.query(MPFinancialSummary).filter(
                            MPFinancialSummary.source == "empowered_indian",
                            MPFinancialSummary.mp_name == mp_name,
                            MPFinancialSummary.constituency == constituency
                        ).first()

                    if existing_mp:
                        for k, v in norm_data.items():
                            setattr(existing_mp, k, v)
                        updated_count += 1
                    else:
                        new_mp = MPFinancialSummary(**norm_data)
                        db.add(new_mp)
                        inserted_count += 1
                except Exception as row_err:
                    logger.error(f"Error processing MP summary record: {row_err}")
                    error_count += 1

            db.commit()
            logger.info(f"MP Summaries Ingestion Complete: Fetched={len(raw_mps)}, Inserted={inserted_count}, Updated={updated_count}, Errors={error_count}")
            return {
                "source": "empowered_indian",
                "type": "mp_summaries",
                "total_fetched": len(raw_mps),
                "inserted": inserted_count,
                "updated": updated_count,
                "errors": error_count,
                "raw_file": raw_filepath
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Critical error during MP summary ingestion: {e}")
            raise
        finally:
            if self._external_db is None:
                db.close()

    def ingest_mospi_macro_data(self) -> Dict[str, Any]:
        """
        Ingest official MoSPI national macro indicators into PostgreSQL.
        """
        logger.info("Starting MoSPI macro metrics ingestion")
        tiles_data, raw_filepath = self.mospi_adapter.fetch_tiles_data()
        normalized_metrics = normalize_mospi_tiles(tiles_data, raw_filepath=raw_filepath)

        db = self._get_db()
        inserted_count = 0
        updated_count = 0

        try:
            for metric_data in normalized_metrics:
                metric_key = metric_data["metric_key"]
                existing_metric = db.query(MacroMetric).filter(
                    MacroMetric.metric_key == metric_key
                ).first()

                if existing_metric:
                    for k, v in metric_data.items():
                        setattr(existing_metric, k, v)
                    updated_count += 1
                else:
                    new_metric = MacroMetric(**metric_data)
                    db.add(new_metric)
                    inserted_count += 1

            db.commit()
            logger.info(f"MoSPI Macro Ingestion Complete: Inserted={inserted_count}, Updated={updated_count}")
            return {
                "source": "mospi_esakshi",
                "type": "macro_metrics",
                "total_metrics": len(normalized_metrics),
                "inserted": inserted_count,
                "updated": updated_count,
                "raw_file": raw_filepath
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Error ingesting MoSPI macro data: {e}")
            raise
        finally:
            if self._external_db is None:
                db.close()

    def sync_all(
        self,
        constituency: Optional[str] = None,
        state: Optional[str] = None,
        max_pages: Optional[int] = 5
    ) -> Dict[str, Any]:
        """
        Execute full synchronization across all configured external sources:
        1. MoSPI macro metrics
        2. Empowered Indian MP summaries
        3. Empowered Indian completed works (defaults to 5 national pages / 500 works,
           or filtered by constituency / state if provided)

        Guarantees that partial failures in one source do not wipe or corrupt
        other sources or existing database data.
        """
        scope_desc = f"constituency={constituency}" if constituency else (f"state={state}" if state else f"national (max_pages={max_pages})")
        results: Dict[str, Any] = {
            "status": "success",
            "message": "Data synchronization completed successfully",
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {},
            "errors": []
        }

        # 1. MoSPI Macro Metrics
        try:
            mospi_res = self.ingest_mospi_macro_data()
            results["summary"]["macro_metrics"] = {
                "total_metrics": mospi_res.get("total_metrics", 0),
                "inserted": mospi_res.get("inserted", 0),
                "updated": mospi_res.get("updated", 0)
            }
        except Exception as e:
            err_msg = f"MoSPI macro metrics sync failed: {str(e)}"
            logger.error(err_msg)
            results["errors"].append(err_msg)
            results["summary"]["macro_metrics"] = {"error": str(e), "inserted": 0, "updated": 0}

        # 2. MP Financial Summaries
        try:
            mps_res = self.ingest_mp_summaries()
            results["summary"]["mp_summaries"] = {
                "fetched": mps_res.get("total_fetched", 0),
                "inserted": mps_res.get("inserted", 0),
                "updated": mps_res.get("updated", 0),
                "errors": mps_res.get("errors", 0)
            }
        except Exception as e:
            err_msg = f"MP summaries sync failed: {str(e)}"
            logger.error(err_msg)
            results["errors"].append(err_msg)
            results["summary"]["mp_summaries"] = {"error": str(e), "inserted": 0, "updated": 0}

        # 3. Completed Works
        try:
            works_res = self.ingest_completed_works(
                constituency=constituency,
                state=state,
                max_pages=max_pages
            )
            results["summary"]["works"] = {
                "scope": works_res.get("scope", "national"),
                "constituency": constituency,
                "state": state,
                "max_pages": max_pages,
                "fetched": works_res.get("total_fetched", 0),
                "inserted": works_res.get("inserted", 0),
                "updated": works_res.get("updated", 0),
                "errors": works_res.get("errors", 0)
            }
        except Exception as e:
            err_msg = f"Works sync failed ({scope_desc}): {str(e)}"
            logger.error(err_msg)
            results["errors"].append(err_msg)
            results["summary"]["works"] = {
                "scope": "constituency" if constituency else ("state" if state else "national"),
                "constituency": constituency,
                "state": state,
                "max_pages": max_pages,
                "fetched": 0,
                "inserted": 0,
                "updated": 0,
                "error": str(e)
            }

        if len(results["errors"]) == 3:
            results["status"] = "failed"
            results["message"] = "All data source synchronization tasks failed"
        elif len(results["errors"]) > 0:
            results["status"] = "partial_success"
            results["message"] = "Data synchronization completed with partial warnings/errors"

        return results

