import logging
from collections import OrderedDict
from typing import List, Set, Tuple

from sqlalchemy.orm import Session

from app.db.postgres import Transaction
from app.ingest.models import TransactionRecord

logger = logging.getLogger(__name__)


def deduplicate_by_txid(
    records: List[TransactionRecord],
) -> Tuple[List[TransactionRecord], int]:
    """Deduplicate records by txid in-memory preserving original insertion order."""
    unique_map: OrderedDict[str, TransactionRecord] = OrderedDict()
    duplicate_count = 0

    for rec in records:
        if rec.txid not in unique_map:
            unique_map[rec.txid] = rec
        else:
            duplicate_count += 1

    if duplicate_count > 0:
        logger.info("Removed %d duplicate TXIDs during deduplication", duplicate_count)

    return list(unique_map.values()), duplicate_count


def find_existing_txids(txids: List[str], db: Session) -> Set[str]:
    """Query postgres for existing TXIDs in chunks to prevent large SQL expression limits."""
    if not txids:
        return set()

    existing_set: Set[str] = set()
    chunk_size = 1000

    for i in range(0, len(txids), chunk_size):
        chunk = txids[i : i + chunk_size]
        rows = (
            db.query(Transaction.txid)
            .filter(Transaction.txid.in_(chunk))
            .all()
        )
        for (existing_txid,) in rows:
            existing_set.add(existing_txid)

    return existing_set
