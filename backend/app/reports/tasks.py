import json
import logging
import os
import uuid
from typing import Any, Dict

from app.celery_app import celery_app
from app.db.postgres import Report, SessionLocal
from app.reports.generator import (
    _collect_report_data,
    generate_csv_report,
    generate_json_report,
    generate_pdf_report,
)
from app.reports.models import ReportConfig, ReportFormat

logger = logging.getLogger(__name__)


def get_reports_dir() -> str:
    """Resolve report storage directory with local and container fallback."""
    env_path = os.getenv("REPORTS_STORE_PATH")
    if env_path:
        return env_path
    if os.name == "nt":
        return os.path.join(os.getcwd(), "data", "reports")
    return "/app/data/reports"


@celery_app.task(bind=True, name="reports.generate_report")
def generate_report_task(
    self, config_dict: Dict[str, Any], report_id: str
) -> Dict[str, Any]:
    """
    Celery asynchronous worker task for assembling, rendering, and persisting reports.
    """
    db = SessionLocal()
    try:
        config = ReportConfig(**config_dict)
        try:
            report_uuid = uuid.UUID(report_id)
        except ValueError:
            report_uuid = report_id

        # Update record status to generating
        report = db.query(Report).filter(Report.id == report_uuid).first()
        if report:
            report.status = "generating"
            db.commit()

        # Collect data from postgres
        data = _collect_report_data(config, db)

        # Render format
        if config.format == ReportFormat.PDF:
            raw_bytes = generate_pdf_report(config, data)
        elif config.format == ReportFormat.CSV:
            csv_str = generate_csv_report(config, data)
            raw_bytes = csv_str.encode("utf-8")
        elif config.format == ReportFormat.JSON:
            json_dict = generate_json_report(config, data)
            raw_bytes = json.dumps(json_dict, indent=2, default=str).encode("utf-8")
        else:
            raw_bytes = generate_pdf_report(config, data)

        # Write to disk
        reports_dir = get_reports_dir()
        os.makedirs(reports_dir, exist_ok=True)
        file_path = os.path.join(reports_dir, f"{report_id}.{config.format.value}")

        with open(file_path, "wb") as f:
            f.write(raw_bytes)

        # Mark complete
        if report:
            report.status = "complete"
            report.file_path = file_path
            report.size_bytes = len(raw_bytes)
            db.commit()

        return {
            "report_id": str(report_id),
            "file_path": file_path,
            "size_bytes": len(raw_bytes),
        }
    except Exception as e:
        logger.exception("Failed to generate report %s: %s", report_id, e)
        try:
            report = db.query(Report).filter(Report.id == report_uuid).first()
            if report:
                report.status = "failed"
                report.error_message = str(e)
                db.commit()
        except Exception as db_err:
            logger.error("Failed to record report failure status: %s", db_err)
        raise e
    finally:
        db.close()
