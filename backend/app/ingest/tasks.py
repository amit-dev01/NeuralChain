import logging
import uuid
from typing import Any, Dict

from app.celery_app import celery_app
from app.core.config import settings
from app.db.postgres import Dataset, SessionLocal, Transaction
from app.db.redis_client import set_task_progress
from app.ingest.deduplicator import deduplicate_by_txid
from app.ingest.enricher import enrich_with_geoip
from app.ingest.models import TimestampFormat
from app.ingest.parser import (
    detect_file_type,
    parse_csv,
    parse_json,
    parse_xml,
)
from app.ingest.validator import filter_valid_records, validate_schema

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="ingest.ingest_file_task")
def ingest_file_task(
    self, file_path: str, config_dict: dict, dataset_id: str
) -> Dict[str, Any]:
    """Execute complete asynchronous ingestion, validation, enrichment and persistence pipeline."""
    task_id = self.request.id or str(uuid.uuid4())
    logger.info("Starting ingestion task %s for dataset %s", task_id, dataset_id)

    db = SessionLocal()
    try:
        # Step 1: 0% — Starting ingestion
        set_task_progress(
            task_id,
            {
                "status": "running",
                "progress": 0,
                "message": "Starting ingestion and detecting file format...",
                "dataset_id": dataset_id,
            },
        )
        file_type = detect_file_type(file_path)
        ts_fmt = TimestampFormat(config_dict.get("timestamp_format", "iso_8601"))

        if file_type == "csv":
            raw_records, parse_errors = parse_csv(file_path, ts_fmt)
        elif file_type == "json":
            raw_records, parse_errors = parse_json(file_path, ts_fmt)
        elif file_type == "xml":
            raw_records, parse_errors = parse_xml(file_path, ts_fmt)
        else:
            raise ValueError(f"Unsupported file type '{file_type}'")

        # Step 2: 20% — Parsing complete
        total_parsed = len(raw_records)
        set_task_progress(
            task_id,
            {
                "status": "running",
                "progress": 20,
                "message": f"Parsing complete. {total_parsed} rows parsed.",
                "dataset_id": dataset_id,
            },
        )

        # Step 3: 35% — Validating schema
        set_task_progress(
            task_id,
            {
                "status": "running",
                "progress": 35,
                "message": "Validating schema constraints...",
                "dataset_id": dataset_id,
            },
        )
        val_result = validate_schema(raw_records)
        valid_records = filter_valid_records(raw_records, val_result.errors)

        # Step 4: 50% — Deduplicating
        duplicate_count = 0
        if config_dict.get("deduplicate", True):
            set_task_progress(
                task_id,
                {
                    "status": "running",
                    "progress": 50,
                    "message": "Deduplicating transaction records...",
                    "dataset_id": dataset_id,
                },
            )
            valid_records, duplicate_count = deduplicate_by_txid(valid_records)

        # Step 5: 65% — Enriching with GeoIP
        if config_dict.get("geoip_enrich", True):
            set_task_progress(
                task_id,
                {
                    "status": "running",
                    "progress": 65,
                    "message": "Enriching telemetry with GeoIP database...",
                    "dataset_id": dataset_id,
                },
            )
            mmdb_path = getattr(settings, "GEOIP_DB_PATH", "/app/data/geoip/GeoLite2-City.mmdb")
            valid_records = enrich_with_geoip(valid_records, mmdb_path)

        # Step 6: 80% — Writing to PostgreSQL
        set_task_progress(
            task_id,
            {
                "status": "running",
                "progress": 80,
                "message": "Persisting records to PostgreSQL ledger...",
                "dataset_id": dataset_id,
            },
        )

        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if dataset:
            dataset.status = "processing"
            dataset.row_count = total_parsed
            dataset.valid_rows = len(valid_records)
            dataset.duplicate_count = duplicate_count
            dataset.file_type = file_type
            db.commit()

        chunk_size = 1000
        for i in range(0, len(valid_records), chunk_size):
            chunk = valid_records[i : i + chunk_size]
            tx_objs = [
                Transaction(
                    dataset_id=dataset_id,
                    txid=r.txid,
                    timestamp=r.timestamp,
                    src_ip=r.src_ip,
                    dst_ip=r.dst_ip,
                    src_port=r.src_port,
                    dst_port=r.dst_port,
                    input_addresses=r.input_addresses,
                    output_addresses=r.output_addresses,
                    input_amounts=r.input_amounts,
                    output_amounts=r.output_amounts,
                    fee=r.fee,
                    script_type=r.script_type.value if hasattr(r.script_type, "value") else str(r.script_type),
                    geo_country=r.geo_country,
                    asn=r.asn,
                    city=r.city,
                    lat=r.lat,
                    lon=r.lon,
                    ground_truth_label=r.ground_truth_label,
                )
                for r in chunk
            ]
            db.bulk_save_objects(tx_objs)
            db.commit()

        # Step 7: 95% — Building Neo4j graph nodes
        set_task_progress(
            task_id,
            {
                "status": "running",
                "progress": 95,
                "message": "Building Neo4j graph nodes and edge topologies...",
                "dataset_id": dataset_id,
            },
        )
        try:
            from app.graph.builder import build_graph_from_transactions

            build_graph_from_transactions(valid_records)
        except Exception as ge:
            logger.info("Graph node builder deferred or skipped: %s", ge)

        # Step 8: 100% — Ingestion complete
        if dataset:
            dataset.status = "complete"
            db.commit()

        set_task_progress(
            task_id,
            {
                "status": "complete",
                "progress": 100,
                "message": f"Ingestion complete. {len(valid_records)} valid records indexed.",
                "dataset_id": dataset_id,
            },
        )

        # Trigger ML pipeline chain automatically
        if config_dict.get("auto_run_ml", True):
            logger.info("Auto-running ML detection pipeline for dataset %s", dataset_id)
            try:
                run_all_models_task.delay(dataset_id)
            except Exception as d_err:
                logger.info("Celery broker unavailable (%s), triggering pipeline in thread...", d_err)
                run_all_models_task(dataset_id)

        return {
            "dataset_id": dataset_id,
            "valid_rows": len(valid_records),
            "duplicate_count": duplicate_count,
        }

    except Exception as e:
        logger.exception("Ingestion failed for dataset %s: %s", dataset_id, e)
        try:
            dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
            if dataset:
                dataset.status = "failed"
                db.commit()
        except Exception:
            pass

        set_task_progress(
            task_id,
            {
                "status": "failed",
                "progress": 0,
                "message": f"Ingestion failed: {e}",
                "error": str(e),
                "dataset_id": dataset_id,
            },
        )
        raise e
    finally:
        db.close()


@celery_app.task(name="ingest.run_all_models_task")
def run_all_models_task(dataset_id: str) -> None:
    """Chain and trigger all 4 machine learning detection models."""
    from celery import chain

    try:
        from app.ml.anomaly.tasks import run_anomaly_detection_task
        from app.ml.classifier.tasks import run_classification_task
        from app.ml.clustering.tasks import run_clustering_task
        from app.ml.sequence.tasks import run_mixing_detection_task

        chain(
            run_anomaly_detection_task.s(dataset_id),
            run_clustering_task.s(dataset_id),
            run_mixing_detection_task.s(dataset_id),
            run_classification_task.s(dataset_id),
        ).apply_async()
    except Exception as e:
        logger.warning("Could not dispatch Celery chain (%s), executing models in background thread...", e)
        import threading

        def _direct_exec():
            try:
                from app.ml.anomaly.tasks import run_anomaly_detection_task
                from app.ml.classifier.tasks import run_classification_task
                from app.ml.clustering.tasks import run_clustering_task
                from app.ml.sequence.tasks import run_mixing_detection_task

                run_anomaly_detection_task(dataset_id)
                run_clustering_task(dataset_id)
                run_mixing_detection_task(dataset_id)
                run_classification_task(dataset_id)
                logger.info("Direct multi-model execution completed successfully for dataset %s", dataset_id)
            except Exception as direct_err:
                logger.error("Direct model execution failed: %s", direct_err)

        threading.Thread(target=_direct_exec, daemon=True).start()
