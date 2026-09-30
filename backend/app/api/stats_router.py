import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.db.postgres import Alert, Entity, ModelRun, Transaction, get_db
from app.db.redis_client import redis_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["stats"])


class OverviewStats(BaseModel):
    total_transactions: int
    unique_wallets: int
    active_alerts: int
    high_risk_entities: int
    models_running: int
    last_updated: datetime


class IngestionDataPoint(BaseModel):
    timestamp: str  # "HH:MM" or ISO
    tx_count: int
    flagged_count: int


@router.get(
    "/overview",
    response_model=OverviewStats,
    summary="Get high-level platform monitoring overview statistics",
)
def get_overview_stats(db: Session = Depends(get_db)) -> OverviewStats:
    """
    Fetch global statistics: total transactions, unique wallets, active alerts,
    high risk entities, and actively executing ML model runs. Caches result in Redis for 30s.
    """
    cache_key = "stats:overview"

    # 1. Try to read from Redis cache
    try:
        cached = redis_client.get(cache_key)
        if cached:
            cached_dict = json.loads(cached)
            return OverviewStats(**cached_dict)
    except Exception as e:
        logger.debug("Redis cache read failed for %s: %s", cache_key, e)

    # 2. Query database counts
    # total_transactions: COUNT(*) FROM transactions
    total_tx = db.query(func.count(Transaction.id)).scalar() or 0

    # unique_wallets: COUNT(DISTINCT wallet_address) FROM entities
    unique_wallets = (
        db.query(func.count(func.distinct(Entity.wallet_address))).scalar() or 0
    )
    if unique_wallets == 0 and total_tx > 0:
        # Fallback if entities table has not yet been populated by clustering
        unique_wallets = (
            db.query(func.count(func.distinct(Alert.wallet_id))).scalar() or 0
        )

    # active_alerts: COUNT(*) FROM alerts WHERE status != 'dismissed'
    active_alerts = (
        db.query(func.count(Alert.id))
        .filter(Alert.status != "dismissed")
        .scalar()
        or 0
    )

    # high_risk_entities: COUNT(*) FROM alerts WHERE risk_level IN ('critical','high') AND status != 'dismissed'
    high_risk_entities = (
        db.query(func.count(Alert.id))
        .filter(
            Alert.risk_level.in_(["critical", "high"]),
            Alert.status != "dismissed",
        )
        .scalar()
        or 0
    )

    # models_running: COUNT(*) FROM model_runs WHERE status = 'running'
    models_running = (
        db.query(func.count(ModelRun.id))
        .filter(ModelRun.status == "running")
        .scalar()
        or 0
    )

    now = datetime.utcnow()
    overview = OverviewStats(
        total_transactions=total_tx,
        unique_wallets=unique_wallets,
        active_alerts=active_alerts,
        high_risk_entities=high_risk_entities,
        models_running=models_running,
        last_updated=now,
    )

    # 3. Cache in Redis for 30 seconds
    try:
        redis_client.setex(cache_key, 30, overview.model_dump_json())
    except Exception as e:
        logger.debug("Redis cache write failed for %s: %s", cache_key, e)

    return overview


@router.get(
    "/ingestion-rate",
    response_model=List[IngestionDataPoint],
    summary="Get ingestion throughput per minute with flagged transaction counts",
)
def get_ingestion_rate(
    minutes: int = Query(60, ge=5, le=1440, description="Window in minutes"),
    db: Session = Depends(get_db),
) -> List[IngestionDataPoint]:
    """
    Generate minute-by-minute ingestion metrics over the past N minutes.
    Fills in missing intervals with zero counts.
    """
    now = datetime.utcnow().replace(second=0, microsecond=0)
    start_time = now - timedelta(minutes=minutes)

    # Generate complete list of minute buckets
    expected_buckets = [start_time + timedelta(minutes=i) for i in range(minutes + 1)]

    # Query transaction counts per minute bucket
    dialect_name = db.bind.dialect.name if db.bind else "postgresql"
    tx_counts_map = {}
    flagged_counts_map = {}

    try:
        if dialect_name == "postgresql":
            # PostgreSQL date_trunc
            tx_sql = text(
                """
                SELECT date_trunc('minute', created_at) AS bucket, COUNT(*) AS tx_count
                FROM transactions
                WHERE created_at >= :start_time
                GROUP BY bucket
                ORDER BY bucket ASC
                """
            )
            tx_rows = db.execute(tx_sql, {"start_time": start_time}).fetchall()
            for row in tx_rows:
                b_dt = row[0]
                if isinstance(b_dt, datetime):
                    key = b_dt.strftime("%Y-%m-%d %H:%M")
                    tx_counts_map[key] = int(row[1])

            # Query flagged alerts per minute bucket
            alert_sql = text(
                """
                SELECT date_trunc('minute', created_at) AS bucket, COUNT(*) AS flagged_count
                FROM alerts
                WHERE created_at >= :start_time
                GROUP BY bucket
                ORDER BY bucket ASC
                """
            )
            alert_rows = db.execute(alert_sql, {"start_time": start_time}).fetchall()
            for row in alert_rows:
                b_dt = row[0]
                if isinstance(b_dt, datetime):
                    key = b_dt.strftime("%Y-%m-%d %H:%M")
                    flagged_counts_map[key] = int(row[1])
        else:
            # Fallback for SQLite / generic testing
            tx_sql = text(
                """
                SELECT strftime('%Y-%m-%d %H:%M', created_at) AS bucket, COUNT(*) AS tx_count
                FROM transactions
                WHERE created_at >= :start_time
                GROUP BY bucket
                ORDER BY bucket ASC
                """
            )
            tx_rows = db.execute(tx_sql, {"start_time": start_time}).fetchall()
            for row in tx_rows:
                if row[0]:
                    tx_counts_map[str(row[0])] = int(row[1])

            alert_sql = text(
                """
                SELECT strftime('%Y-%m-%d %H:%M', created_at) AS bucket, COUNT(*) AS flagged_count
                FROM alerts
                WHERE created_at >= :start_time
                GROUP BY bucket
                ORDER BY bucket ASC
                """
            )
            alert_rows = db.execute(alert_sql, {"start_time": start_time}).fetchall()
            for row in alert_rows:
                if row[0]:
                    flagged_counts_map[str(row[0])] = int(row[1])
    except Exception as e:
        logger.error("Error querying ingestion rate buckets: %s", e)

    # Format result filling all gaps with 0
    results: List[IngestionDataPoint] = []
    for b in expected_buckets:
        key = b.strftime("%Y-%m-%d %H:%M")
        results.append(
            IngestionDataPoint(
                timestamp=b.strftime("%H:%M"),
                tx_count=tx_counts_map.get(key, 0),
                flagged_count=flagged_counts_map.get(key, 0),
            )
        )

    return results
