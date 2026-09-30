import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel
from sqlalchemy import desc, func, text
from sqlalchemy.orm import Session

from app.db.postgres import Alert, Transaction, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["geo"])

ISO_COUNTRY_NAMES: Dict[str, str] = {
    "US": "United States",
    "GB": "United Kingdom",
    "DE": "Germany",
    "CN": "China",
    "RU": "Russia",
    "IN": "India",
    "JP": "Japan",
    "SG": "Singapore",
    "NL": "Netherlands",
    "CA": "Canada",
    "FR": "France",
    "BR": "Brazil",
    "CH": "Switzerland",
    "AU": "Australia",
    "KR": "South Korea",
    "HK": "Hong Kong",
    "SE": "Sweden",
    "ES": "Spain",
    "IT": "Italy",
    "UA": "Ukraine",
    "PL": "Poland",
    "RO": "Romania",
    "VN": "Vietnam",
    "NG": "Nigeria",
    "ZA": "South Africa",
    "TR": "Turkey",
    "AE": "United Arab Emirates",
    "IR": "Iran",
    "KP": "North Korea",
    "SC": "Seychelles",
    "VG": "British Virgin Islands",
    "PA": "Panama",
    "KY": "Cayman Islands",
    "MT": "Malta",
    "CY": "Cyprus",
    "EE": "Estonia",
    "LT": "Lithuania",
    "LV": "Latvia",
    "BG": "Bulgaria",
    "CZ": "Czech Republic",
    "AT": "Austria",
    "BE": "Belgium",
    "DK": "Denmark",
    "FI": "Finland",
    "NO": "Norway",
    "IE": "Ireland",
    "IL": "Israel",
    "TW": "Taiwan",
    "MX": "Mexico",
    "ID": "Indonesia",
    "PH": "Philippines",
}


class HeatmapPoint(BaseModel):
    lat: float
    lng: float
    weight: float  # normalized 0.0-1.0


class GeoAlert(BaseModel):
    ip: str
    lat: float
    lng: float
    risk: float
    wallet_count: int
    tx_count: int
    country: str
    asn: Optional[str] = None


class TransactionArc(BaseModel):
    src_country: str
    dst_country: str
    volume: float  # total BTC
    flagged: bool
    tx_count: int


class CountryStats(BaseModel):
    code: str
    name: str
    total_ips: int
    flagged_ips: int
    flagged_pct: float
    total_transactions: int
    flagged_transactions: int
    top_asns: List[Dict[str, Any]]  # [{ "asn": str, "count": int, "pct": float }]


class CountryIP(BaseModel):
    ip: str
    tx_count: int
    risk: float
    wallet_count: int
    first_seen: datetime


class CountryDetail(BaseModel):
    stats: CountryStats
    ips: List[CountryIP]
    recent_transactions: List[Dict[str, Any]]


@router.get(
    "/heatmap",
    response_model=List[HeatmapPoint],
    summary="Get latitude/longitude geolocation activity density points",
)
def get_geo_heatmap(db: Session = Depends(get_db)) -> List[HeatmapPoint]:
    """
    Retrieve geographic coordinates of transactions aggregated by lat/lon,
    normalized to weight in [0.0, 1.0].
    """
    query = (
        db.query(
            Transaction.lat,
            Transaction.lon,
            func.count(Transaction.id).label("cnt"),
        )
        .filter(Transaction.lat.isnot(None), Transaction.lon.isnot(None))
        .group_by(Transaction.lat, Transaction.lon)
    )
    rows = query.all()

    if not rows:
        return []

    max_cnt = max((int(r.cnt) for r in rows), default=1)
    if max_cnt <= 0:
        max_cnt = 1

    return [
        HeatmapPoint(
            lat=float(r.lat),
            lng=float(r.lon),
            weight=round(float(r.cnt) / max_cnt, 4),
        )
        for r in rows
    ]


@router.get(
    "/alerts",
    response_model=List[GeoAlert],
    summary="Get localized high-risk alerts grouped by source IP location",
)
def get_geo_alerts(db: Session = Depends(get_db)) -> List[GeoAlert]:
    """
    Locate high-risk transactions (risk > 0.5) with known GPS coordinates
    and group them by source IP, geolocation, and autonomous system.
    """
    alerts_list: List[GeoAlert] = []
    dialect_name = db.bind.dialect.name if db.bind else "postgresql"

    try:
        if dialect_name == "postgresql":
            # PostgreSQL optimized query
            sql = text(
                """
                SELECT
                    t.src_ip,
                    t.lat,
                    t.lon,
                    t.geo_country,
                    t.asn,
                    COUNT(DISTINCT cast(t.input_addresses as text)) AS wallet_count,
                    COUNT(t.id) AS tx_count,
                    AVG(a.risk_score) AS avg_risk
                FROM transactions t
                JOIN alerts a ON (
                    cast(t.output_addresses as text) LIKE '%' || a.wallet_id || '%'
                    OR cast(t.input_addresses as text) LIKE '%' || a.wallet_id || '%'
                )
                WHERE t.lat IS NOT NULL
                  AND t.lon IS NOT NULL
                  AND a.risk_score > 0.5
                GROUP BY t.src_ip, t.lat, t.lon, t.geo_country, t.asn
                ORDER BY avg_risk DESC
                LIMIT 500
                """
            )
            rows = db.execute(sql).fetchall()
            for r in rows:
                if r[0] and r[1] is not None and r[2] is not None:
                    alerts_list.append(
                        GeoAlert(
                            ip=str(r[0]),
                            lat=float(r[1]),
                            lng=float(r[2]),
                            country=str(r[3] or "UNKNOWN"),
                            asn=str(r[4]) if r[4] else None,
                            wallet_count=int(r[5] or 1),
                            tx_count=int(r[6] or 1),
                            risk=round(float(r[7] or 0.5), 3),
                        )
                    )
        else:
            # Fallback for SQLite / generic environment
            tx_rows = (
                db.query(
                    Transaction.src_ip,
                    Transaction.lat,
                    Transaction.lon,
                    Transaction.geo_country,
                    Transaction.asn,
                    func.count(Transaction.id).label("cnt"),
                )
                .filter(Transaction.lat.isnot(None), Transaction.lon.isnot(None), Transaction.src_ip.isnot(None))
                .group_by(Transaction.src_ip, Transaction.lat, Transaction.lon, Transaction.geo_country, Transaction.asn)
                .limit(500)
                .all()
            )
            for r in tx_rows:
                alerts_list.append(
                    GeoAlert(
                        ip=str(r.src_ip),
                        lat=float(r.lat),
                        lng=float(r.lon),
                        country=str(r.geo_country or "UNKNOWN"),
                        asn=str(r.asn) if r.asn else None,
                        wallet_count=1,
                        tx_count=int(r.cnt),
                        risk=0.75,
                    )
                )
    except Exception as e:
        logger.error("Geo alerts query error: %s", e)

    return alerts_list


@router.get(
    "/arcs",
    response_model=List[TransactionArc],
    summary="Get cross-border transaction flow arcs between origin and destination countries",
)
def get_transaction_arcs(db: Session = Depends(get_db)) -> List[TransactionArc]:
    """
    Approximate international transaction pathways by computing sequential country transitions
    and aggregating total transferred BTC volume and risk flags.
    """
    arcs_map: Dict[tuple[str, str], Dict[str, Any]] = {}
    dialect_name = db.bind.dialect.name if db.bind else "postgresql"

    try:
        if dialect_name == "postgresql":
            # PostgreSQL window function for consecutive hops
            sql = text(
                """
                WITH ranked_txs AS (
                    SELECT
                        geo_country AS src_country,
                        LAG(geo_country) OVER (ORDER BY timestamp) AS dst_country,
                        output_amounts,
                        txid
                    FROM transactions
                    WHERE geo_country IS NOT NULL
                )
                SELECT src_country, dst_country, output_amounts, txid
                FROM ranked_txs
                WHERE dst_country IS NOT NULL AND src_country <> dst_country
                LIMIT 1500
                """
            )
            rows = db.execute(sql).fetchall()
            for r in rows:
                src = str(r[0]).upper()
                dst = str(r[1]).upper()
                if not src or not dst or src == dst:
                    continue

                amounts = r[2]
                amt_sum = 0.0
                if isinstance(amounts, list):
                    amt_sum = sum(float(x) for x in amounts if isinstance(x, (int, float)))

                key = (src, dst)
                if key not in arcs_map:
                    arcs_map[key] = {"volume": 0.0, "tx_count": 0, "flagged": False}
                arcs_map[key]["volume"] += amt_sum
                arcs_map[key]["tx_count"] += 1
        else:
            # Fallback for SQLite / generic environment
            txs = (
                db.query(Transaction.geo_country, Transaction.output_amounts)
                .filter(Transaction.geo_country.isnot(None))
                .order_by(Transaction.timestamp.asc())
                .limit(500)
                .all()
            )
            prev_country = None
            for country, amounts in txs:
                if prev_country and country and prev_country != country:
                    src = prev_country.upper()
                    dst = country.upper()
                    key = (src, dst)
                    if key not in arcs_map:
                        arcs_map[key] = {"volume": 0.0, "tx_count": 0, "flagged": False}
                    amt_sum = 0.0
                    if isinstance(amounts, list):
                        amt_sum = sum(float(x) for x in amounts if isinstance(x, (int, float)))
                    arcs_map[key]["volume"] += amt_sum
                    arcs_map[key]["tx_count"] += 1
                prev_country = country
    except Exception as e:
        logger.error("Transaction arcs query error: %s", e)

    results: List[TransactionArc] = []
    for (src, dst), data in arcs_map.items():
        results.append(
            TransactionArc(
                src_country=src,
                dst_country=dst,
                volume=round(float(data["volume"]), 4),
                flagged=bool(data["flagged"] or data["volume"] > 50.0),
                tx_count=int(data["tx_count"]),
            )
        )

    # Sort descending by transaction volume
    results.sort(key=lambda a: a.volume, reverse=True)
    return results[:100]


@router.get(
    "/country/{code}",
    response_model=CountryDetail,
    summary="Get comprehensive forensic and geographic breakdown for a country code",
)
def get_country_detail(
    code: str = Path(..., min_length=2, max_length=3, description="ISO country code (e.g. US, DE)"),
    db: Session = Depends(get_db),
) -> CountryDetail:
    """
    Retrieve forensic statistics, top source IP addresses, ASN distribution,
    and recent Bitcoin transactions associated with the given country code.
    """
    country_code = code.strip().upper()
    country_name = ISO_COUNTRY_NAMES.get(country_code, country_code)

    # 1. Total transactions in country
    total_tx = (
        db.query(func.count(Transaction.id))
        .filter(func.upper(Transaction.geo_country) == country_code)
        .scalar()
        or 0
    )

    # 2. Total unique source IPs
    total_ips = (
        db.query(func.count(func.distinct(Transaction.src_ip)))
        .filter(
            func.upper(Transaction.geo_country) == country_code,
            Transaction.src_ip.isnot(None),
        )
        .scalar()
        or 0
    )

    # 3. Flagged transactions in country
    dialect_name = db.bind.dialect.name if db.bind else "postgresql"
    flagged_tx_count = 0
    flagged_ips_count = 0

    try:
        if dialect_name == "postgresql":
            flagged_sql = text(
                """
                SELECT
                    COUNT(DISTINCT t.id) AS flagged_tx,
                    COUNT(DISTINCT t.src_ip) AS flagged_ips
                FROM transactions t
                JOIN alerts a ON (
                    cast(t.output_addresses as text) LIKE '%' || a.wallet_id || '%'
                    OR cast(t.input_addresses as text) LIKE '%' || a.wallet_id || '%'
                )
                WHERE UPPER(t.geo_country) = :code
                  AND a.risk_score > 0.5
                """
            )
            r = db.execute(flagged_sql, {"code": country_code}).fetchone()
            if r:
                flagged_tx_count = int(r[0] or 0)
                flagged_ips_count = int(r[1] or 0)
        else:
            flagged_tx_count = (
                db.query(func.count(Alert.id))
                .filter(Alert.risk_score > 0.5)
                .scalar()
                or 0
            )
            flagged_ips_count = min(flagged_tx_count, total_ips)
    except Exception as e:
        logger.debug("Flagged count query fallback: %s", e)

    flagged_pct = round((flagged_ips_count / total_ips * 100.0), 2) if total_ips > 0 else 0.0

    # 4. Top ASNs in country
    asn_rows = (
        db.query(Transaction.asn, func.count(Transaction.id).label("cnt"))
        .filter(
            func.upper(Transaction.geo_country) == country_code,
            Transaction.asn.isnot(None),
        )
        .group_by(Transaction.asn)
        .order_by(desc("cnt"))
        .limit(10)
        .all()
    )

    top_asns = []
    for asn_val, cnt in asn_rows:
        pct = round((cnt / total_tx * 100.0), 2) if total_tx > 0 else 0.0
        top_asns.append({"asn": str(asn_val), "count": int(cnt), "pct": pct})

    stats = CountryStats(
        code=country_code,
        name=country_name,
        total_ips=total_ips,
        flagged_ips=flagged_ips_count,
        flagged_pct=flagged_pct,
        total_transactions=total_tx,
        flagged_transactions=flagged_tx_count,
        top_asns=top_asns,
    )

    # 5. Top 50 IPs in country
    ip_rows = (
        db.query(
            Transaction.src_ip,
            func.count(Transaction.id).label("tx_cnt"),
            func.min(Transaction.timestamp).label("first_seen"),
        )
        .filter(
            func.upper(Transaction.geo_country) == country_code,
            Transaction.src_ip.isnot(None),
        )
        .group_by(Transaction.src_ip)
        .order_by(desc("tx_cnt"))
        .limit(50)
        .all()
    )

    ips: List[CountryIP] = []
    for ip_val, tx_cnt, f_seen in ip_rows:
        ips.append(
            CountryIP(
                ip=str(ip_val),
                tx_count=int(tx_cnt),
                risk=round(min(float(tx_cnt) / 50.0, 0.95), 2),
                wallet_count=1,
                first_seen=f_seen if isinstance(f_seen, datetime) else datetime.utcnow(),
            )
        )

    # 6. Recent 20 transactions in country
    recent_txs = (
        db.query(Transaction)
        .filter(func.upper(Transaction.geo_country) == country_code)
        .order_by(desc(Transaction.timestamp))
        .limit(20)
        .all()
    )

    recent_list = []
    for t in recent_txs:
        amounts = t.output_amounts or []
        vol = sum(float(x) for x in amounts if isinstance(x, (int, float))) if isinstance(amounts, list) else 0.0
        recent_list.append(
            {
                "txid": t.txid,
                "timestamp": t.timestamp.isoformat() if t.timestamp else datetime.utcnow().isoformat(),
                "fee": float(t.fee or 0.0),
                "amount": round(vol, 8),
                "src_ip": t.src_ip,
                "dst_ip": t.dst_ip,
                "script_type": t.script_type,
                "asn": t.asn,
                "city": t.city,
            }
        )

    return CountryDetail(
        stats=stats,
        ips=ips,
        recent_transactions=recent_list,
    )
