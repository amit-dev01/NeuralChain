import logging
import math
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.db.neo4j_client import get_neo4j_session
from app.db.postgres import Alert, Transaction, get_db
from app.graph.queries import get_peel_chains

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["timeline"])

GRANULARITY_MAP = {
    "1m": "minute",
    "5m": "5 minutes",
    "15m": "15 minutes",
    "1h": "hour",
    "1d": "day",
}

GRANULARITY_SECONDS = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "1d": 86400,
}


class TimelineBucket(BaseModel):
    timestamp: str
    tx_count: int
    flagged_count: int
    anomaly_burst: bool  # True if tx_count > 2σ above mean for this range


class HeatmapCell(BaseModel):
    day: int  # 0=Mon, 6=Sun
    hour: int  # 0-23
    tx_count: int
    flagged_count: int


class PeelChainHop(BaseModel):
    wallet_id: str
    txid: str
    amount: float
    timestamp: datetime


class PeelChain(BaseModel):
    chain_id: str
    hops: List[PeelChainHop]
    total_btc: float
    duration_seconds: int
    avg_fee_per_hop: float
    risk_score: float


class RapidReuseEvent(BaseModel):
    ip_address: str
    wallets_used: List[str]
    tx_count: int
    time_window_seconds: int
    from_time: datetime
    to_time: datetime
    risk_score: float


@router.get(
    "",
    response_model=List[TimelineBucket],
    summary="Get temporal timeline buckets with anomaly burst detection",
)
@router.get(
    "/",
    response_model=List[TimelineBucket],
    include_in_schema=False,
)
def get_timeline(
    from_ts: Optional[datetime] = Query(None, description="Start datetime filter"),
    to_ts: Optional[datetime] = Query(None, description="End datetime filter"),
    granularity: str = Query("5m", description="Bucket size: 1m, 5m, 15m, 1h, 1d"),
    db: Session = Depends(get_db),
) -> List[TimelineBucket]:
    """
    Generate time series buckets with transaction and alert volumes.
    Computes rolling burst anomalies if volume exceeds 2 standard deviations above mean.
    """
    if granularity not in GRANULARITY_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid granularity '{granularity}'. Supported options: {list(GRANULARITY_MAP.keys())}",
        )

    sec_step = GRANULARITY_SECONDS[granularity]
    now = datetime.utcnow()

    if to_ts is None:
        to_ts = now
    if from_ts is None:
        # Default windows based on granularity
        if granularity in ("1m", "5m"):
            from_ts = to_ts - timedelta(hours=6)
        elif granularity == "15m":
            from_ts = to_ts - timedelta(hours=24)
        elif granularity == "1h":
            from_ts = to_ts - timedelta(days=7)
        else:
            from_ts = to_ts - timedelta(days=30)

    if from_ts > to_ts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="from_ts must be before to_ts",
        )

    # Generate reference buckets in step increments
    step_delta = timedelta(seconds=sec_step)
    bucket_slots: List[datetime] = []
    curr = from_ts.replace(microsecond=0)
    # round down curr to multiple of sec_step
    epoch = int(curr.timestamp())
    curr = datetime.utcfromtimestamp(epoch - (epoch % sec_step))

    while curr <= to_ts:
        bucket_slots.append(curr)
        curr += step_delta

    tx_counts: Dict[str, int] = {}
    flagged_counts: Dict[str, int] = {}
    dialect_name = db.bind.dialect.name if db.bind else "postgresql"

    try:
        if dialect_name == "postgresql":
            # PostgreSQL epoch binning query for transactions
            tx_sql = text(
                """
                SELECT
                    to_timestamp(floor(extract('epoch' from created_at) / :sec) * :sec) AT TIME ZONE 'UTC' AS bucket,
                    COUNT(*) AS cnt
                FROM transactions
                WHERE created_at >= :from_ts AND created_at <= :to_ts
                GROUP BY bucket
                ORDER BY bucket ASC
                """
            )
            tx_rows = db.execute(
                tx_sql, {"sec": sec_step, "from_ts": from_ts, "to_ts": to_ts}
            ).fetchall()
            for r in tx_rows:
                if r[0]:
                    k = r[0].strftime("%Y-%m-%d %H:%M:%S")
                    tx_counts[k] = int(r[1])

            # Query alerts
            alert_sql = text(
                """
                SELECT
                    to_timestamp(floor(extract('epoch' from created_at) / :sec) * :sec) AT TIME ZONE 'UTC' AS bucket,
                    COUNT(*) AS cnt
                FROM alerts
                WHERE created_at >= :from_ts AND created_at <= :to_ts
                GROUP BY bucket
                ORDER BY bucket ASC
                """
            )
            alert_rows = db.execute(
                alert_sql, {"sec": sec_step, "from_ts": from_ts, "to_ts": to_ts}
            ).fetchall()
            for r in alert_rows:
                if r[0]:
                    k = r[0].strftime("%Y-%m-%d %H:%M:%S")
                    flagged_counts[k] = int(r[1])
        else:
            # Fallback for SQLite in memory testing
            txs = (
                db.query(Transaction.created_at)
                .filter(Transaction.created_at >= from_ts, Transaction.created_at <= to_ts)
                .all()
            )
            for (t_created,) in txs:
                if t_created:
                    e = int(t_created.timestamp())
                    b = datetime.utcfromtimestamp(e - (e % sec_step))
                    k = b.strftime("%Y-%m-%d %H:%M:%S")
                    tx_counts[k] = tx_counts.get(k, 0) + 1

            alerts = (
                db.query(Alert.created_at)
                .filter(Alert.created_at >= from_ts, Alert.created_at <= to_ts)
                .all()
            )
            for (a_created,) in alerts:
                if a_created:
                    e = int(a_created.timestamp())
                    b = datetime.utcfromtimestamp(e - (e % sec_step))
                    k = b.strftime("%Y-%m-%d %H:%M:%S")
                    flagged_counts[k] = flagged_counts.get(k, 0) + 1
    except Exception as e:
        logger.error("Timeline SQL query failure: %s", e)

    # Build initial list of buckets
    bucket_objects: List[TimelineBucket] = []
    counts_list: List[int] = []

    for slot in bucket_slots:
        k = slot.strftime("%Y-%m-%d %H:%M:%S")
        tc = tx_counts.get(k, 0)
        fc = flagged_counts.get(k, 0)
        counts_list.append(tc)
        bucket_objects.append(
            TimelineBucket(
                timestamp=slot.strftime("%Y-%m-%dT%H:%M:%SZ"),
                tx_count=tc,
                flagged_count=fc,
                anomaly_burst=False,
            )
        )

    # Compute burst anomaly threshold: tx_count > 2.0 * std above mean
    if len(counts_list) > 1:
        mean_val = float(np.mean(counts_list))
        std_val = float(np.std(counts_list))
        threshold = mean_val + (2.0 * std_val)
        if std_val > 0.0:
            for b in bucket_objects:
                if b.tx_count > threshold and b.tx_count > 0:
                    b.anomaly_burst = True

    return bucket_objects


@router.get(
    "/heatmap",
    response_model=List[HeatmapCell],
    summary="Get 7x24 Day-Hour activity heatmap matrix",
)
def get_activity_heatmap(db: Session = Depends(get_db)) -> List[HeatmapCell]:
    """
    Build complete 7x24 day-of-week by hour activity matrix.
    day: 0=Monday through 6=Sunday. hour: 0-23.
    """
    tx_map: Dict[tuple[int, int], int] = {}
    flagged_map: Dict[tuple[int, int], int] = {}
    dialect_name = db.bind.dialect.name if db.bind else "postgresql"

    try:
        if dialect_name == "postgresql":
            # PostgreSQL ISODOW: 1=Mon, 7=Sun -> subtract 1 to get 0=Mon, 6=Sun
            tx_sql = text(
                """
                SELECT
                    (EXTRACT(ISODOW FROM created_at) - 1)::int AS day,
                    EXTRACT(HOUR FROM created_at)::int AS hour,
                    COUNT(*) AS cnt
                FROM transactions
                GROUP BY day, hour
                """
            )
            for r in db.execute(tx_sql).fetchall():
                if r[0] is not None and r[1] is not None:
                    tx_map[(int(r[0]), int(r[1]))] = int(r[2])

            alert_sql = text(
                """
                SELECT
                    (EXTRACT(ISODOW FROM created_at) - 1)::int AS day,
                    EXTRACT(HOUR FROM created_at)::int AS hour,
                    COUNT(*) AS cnt
                FROM alerts
                GROUP BY day, hour
                """
            )
            for r in db.execute(alert_sql).fetchall():
                if r[0] is not None and r[1] is not None:
                    flagged_map[(int(r[0]), int(r[1]))] = int(r[2])
        else:
            # Fallback for SQLite / generic python aggregation
            for (t_dt,) in db.query(Transaction.created_at).all():
                if t_dt:
                    tx_map[(t_dt.weekday(), t_dt.hour)] = tx_map.get((t_dt.weekday(), t_dt.hour), 0) + 1
            for (a_dt,) in db.query(Alert.created_at).all():
                if a_dt:
                    flagged_map[(a_dt.weekday(), a_dt.hour)] = flagged_map.get((a_dt.weekday(), a_dt.hour), 0) + 1
    except Exception as e:
        logger.error("Heatmap query failed: %s", e)

    cells: List[HeatmapCell] = []
    for day in range(7):
        for hour in range(24):
            cells.append(
                HeatmapCell(
                    day=day,
                    hour=hour,
                    tx_count=tx_map.get((day, hour), 0),
                    flagged_count=flagged_map.get((day, hour), 0),
                )
            )

    return cells


@router.get(
    "/peel-chains",
    response_model=List[PeelChain],
    summary="Detect and retrieve peeled transaction sequences from Neo4j",
)
def get_detected_peel_chains(
    limit: int = Query(5, ge=1, le=50, description="Max number of peel chains to retrieve"),
) -> List[PeelChain]:
    """
    Search Neo4j graph for peel chain structures (length >= 3),
    extract serialized hop sequences, and compute cumulative transaction metrics.
    """
    peel_chains: List[PeelChain] = []

    try:
        cypher, params = get_peel_chains(min_length=3)
        with get_neo4j_session() as session:
            result = session.run(cypher, params)
            records = list(result)

        for record in records:
            path = record.get("path")
            if not path:
                continue

            nodes = getattr(path, "nodes", [])
            if not nodes:
                continue

            hops: List[PeelChainHop] = []
            wallets: List[Dict[str, Any]] = []
            txs: List[Dict[str, Any]] = []

            for n in nodes:
                props = dict(n.items()) if hasattr(n, "items") else {}
                labels = set(getattr(n, "labels", []))
                if "Wallet" in labels:
                    wallets.append(props)
                elif "Transaction" in labels:
                    txs.append(props)

            # Pair up wallet -> transaction hops
            num_hops = min(len(wallets), len(txs))
            for i in range(num_hops):
                w_props = wallets[i]
                t_props = txs[i]

                wallet_addr = w_props.get("address") or f"wallet_{i}"
                txid_val = t_props.get("txid") or f"tx_{i}"
                amt = float(t_props.get("amount") or t_props.get("output_amounts", [0.0])[0] if isinstance(t_props.get("output_amounts"), list) else 0.0)
                ts_val = t_props.get("timestamp")
                if isinstance(ts_val, datetime):
                    hop_ts = ts_val
                elif isinstance(ts_val, str):
                    try:
                        hop_ts = datetime.fromisoformat(ts_val.replace("Z", "+00:00"))
                    except Exception:
                        hop_ts = datetime.utcnow()
                else:
                    hop_ts = datetime.utcnow()

                hops.append(
                    PeelChainHop(
                        wallet_id=wallet_addr,
                        txid=txid_val,
                        amount=amt,
                        timestamp=hop_ts,
                    )
                )

            if len(hops) < 2:
                continue

            total_btc = round(sum(h.amount for h in hops), 8)
            duration_sec = int((hops[-1].timestamp - hops[0].timestamp).total_seconds())
            avg_fee = 0.0001
            risk = round(min(0.55 + (0.08 * len(hops)), 0.99), 2)

            peel_chains.append(
                PeelChain(
                    chain_id=f"peel_{uuid.uuid4().hex[:8]}",
                    hops=hops,
                    total_btc=total_btc,
                    duration_seconds=max(0, duration_sec),
                    avg_fee_per_hop=avg_fee,
                    risk_score=risk,
                )
            )
    except Exception as e:
        logger.warning("Peel chain discovery query failed: %s", e)

    # Sort descending by chain length (number of hops) and risk score
    peel_chains.sort(key=lambda c: (len(c.hops), c.risk_score), reverse=True)
    return peel_chains[:limit]


@router.get(
    "/rapid-reuse",
    response_model=List[RapidReuseEvent],
    summary="Detect IP addresses rapidly rotating multiple Bitcoin wallets",
)
def get_rapid_reuse_events(db: Session = Depends(get_db)) -> List[RapidReuseEvent]:
    """
    Detect IP-based rapid address hopping: IPs generating > 5 transactions
    across multiple addresses in under 5 minutes (300 seconds).
    """
    events: List[RapidReuseEvent] = []
    dialect_name = db.bind.dialect.name if db.bind else "postgresql"

    try:
        if dialect_name == "postgresql":
            # PostgreSQL rapid reuse query
            reuse_sql = text(
                """
                SELECT
                    src_ip,
                    COUNT(DISTINCT cast(input_addresses as text)) AS wallet_count,
                    COUNT(*) AS tx_count,
                    MIN(created_at) AS from_time,
                    MAX(created_at) AS to_time,
                    EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) AS window_sec
                FROM transactions
                WHERE src_ip IS NOT NULL
                GROUP BY src_ip
                HAVING COUNT(*) > 5
                  AND EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) < 300
                ORDER BY tx_count DESC
                LIMIT 50
                """
            )
            rows = db.execute(reuse_sql).fetchall()

            for r in rows:
                src_ip = str(r[0])
                tx_c = int(r[2])
                from_t = r[3] if isinstance(r[3], datetime) else datetime.utcnow()
                to_t = r[4] if isinstance(r[4], datetime) else datetime.utcnow()
                win_sec = int(float(r[5])) if r[5] is not None else 0

                # Query sample of wallets used
                sample_txs = (
                    db.query(Transaction.input_addresses)
                    .filter(Transaction.src_ip == src_ip)
                    .limit(20)
                    .all()
                )
                wallets_set = set()
                for (in_addrs,) in sample_txs:
                    if isinstance(in_addrs, list):
                        for a in in_addrs:
                            if isinstance(a, str):
                                wallets_set.add(a)

                risk = round(min(tx_c / 100.0, 1.0), 3)

                events.append(
                    RapidReuseEvent(
                        ip_address=src_ip,
                        wallets_used=list(wallets_set)[:10],
                        tx_count=tx_c,
                        time_window_seconds=win_sec,
                        from_time=from_t,
                        to_time=to_t,
                        risk_score=risk,
                    )
                )
        else:
            # Fallback for SQLite / generic environment
            src_ips = (
                db.query(Transaction.src_ip, func.count(Transaction.id))
                .filter(Transaction.src_ip.isnot(None))
                .group_by(Transaction.src_ip)
                .having(func.count(Transaction.id) > 5)
                .all()
            )
            for src_ip, tx_c in src_ips:
                txs = (
                    db.query(Transaction.created_at, Transaction.input_addresses)
                    .filter(Transaction.src_ip == src_ip)
                    .order_by(Transaction.created_at.asc())
                    .all()
                )
                if not txs:
                    continue
                first_t = txs[0][0]
                last_t = txs[-1][0]
                diff_sec = int((last_t - first_t).total_seconds()) if (first_t and last_t) else 0
                if diff_sec < 300:
                    wallets_set = set()
                    for _, in_addrs in txs:
                        if isinstance(in_addrs, list):
                            for a in in_addrs:
                                if isinstance(a, str):
                                    wallets_set.add(a)
                    events.append(
                        RapidReuseEvent(
                            ip_address=src_ip,
                            wallets_used=list(wallets_set)[:10],
                            tx_count=tx_c,
                            time_window_seconds=diff_sec,
                            from_time=first_t or datetime.utcnow(),
                            to_time=last_t or datetime.utcnow(),
                            risk_score=round(min(tx_c / 100.0, 1.0), 3),
                        )
                    )
    except Exception as e:
        logger.error("Rapid reuse query failed: %s", e)

    return events
