import logging
import os
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.db.postgres import Report, get_db
from app.reports.models import (
    ReportConfig,
    ReportGenerateResponse,
    ReportMeta,
)
from app.reports.tasks import generate_report_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["reports"])

MEDIA_TYPES = {
    "pdf": "application/pdf",
    "csv": "text/csv",
    "json": "application/json",
}


@router.post(
    "/generate",
    response_model=ReportGenerateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue asynchronous forensic report generation",
)
def generate_report(
    config: ReportConfig,
    db: Session = Depends(get_db),
) -> ReportGenerateResponse:
    """
    Register a placeholder Report record and dispatch asynchronous worker task
    to generate and persist the document in the requested format (PDF, CSV, JSON).
    """
    report = Report(
        title=config.title,
        type=config.report_type.value,
        format=config.format.value,
        status="generating",
        section_count=len(config.sections),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Queue background generation task
    try:
        task = generate_report_task.delay(config.model_dump(mode="json"), str(report.id))
        task_id = str(task.id) if hasattr(task, "id") else f"task_{uuid.uuid4().hex[:8]}"
    except Exception as e:
        logger.error("Failed to enqueue Celery task, running inline: %s", e)
        # Fallback to local synchronous execution if Celery broker unavailable
        try:
            generate_report_task(config.model_dump(mode="json"), str(report.id))
            task_id = f"inline_{uuid.uuid4().hex[:8]}"
        except Exception as inline_err:
            logger.exception("Inline report generation failed: %s", inline_err)
            task_id = "failed"

    return ReportGenerateResponse(
        task_id=task_id,
        message=f"Report '{config.title}' generation initiated successfully",
    )


@router.get(
    "",
    response_model=List[ReportMeta],
    summary="List all generated and pending forensic reports",
)
@router.get(
    "/",
    response_model=List[ReportMeta],
    include_in_schema=False,
)
def list_reports(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
) -> List[ReportMeta]:
    """Retrieve paginated metadata records of generated reports ordered chronologically."""
    offset = (page - 1) * limit
    reports = (
        db.query(Report)
        .order_by(desc(Report.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        ReportMeta(
            id=str(r.id),
            title=r.title,
            report_type=r.type,
            format=r.format,
            created_at=r.created_at,
            file_path=r.file_path,
            size_bytes=r.size_bytes,
            status=r.status,
            section_count=r.section_count,
        )
        for r in reports
    ]


@router.get(
    "/{id}/download",
    summary="Download completed forensic report file",
)
def download_report(
    id: str,
    db: Session = Depends(get_db),
):
    """Stream generated report file in its rendered format (PDF, CSV, JSON)."""
    try:
        report_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid report UUID format",
        )

    report = db.query(Report).filter(Report.id == report_uuid).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report {id} not found",
        )

    if report.status != "complete":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "Report not ready yet", "current_status": report.status},
        )

    if not report.file_path or not os.path.exists(report.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report artifact not found on filesystem storage",
        )

    media_type = MEDIA_TYPES.get(report.format.lower(), "application/octet-stream")
    file_name = f"report_{id}.{report.format.lower()}"

    return FileResponse(
        path=report.file_path,
        media_type=media_type,
        filename=file_name,
    )


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a report metadata and its stored artifact file",
)
def delete_report(
    id: str,
    db: Session = Depends(get_db),
) -> None:
    """Permanently delete report record and remove disk artifact."""
    try:
        report_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid report UUID format",
        )

    report = db.query(Report).filter(Report.id == report_uuid).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report {id} not found",
        )

    # Clean up disk file if present
    if report.file_path and os.path.exists(report.file_path):
        try:
            os.remove(report.file_path)
        except Exception as e:
            logger.warning("Could not delete report file %s: %s", report.file_path, e)

    db.delete(report)
    db.commit()
    return None
