import re
from datetime import datetime, timedelta, timezone
from typing import List, Set

from app.ingest.models import RowError, TransactionRecord, ValidationResult

TXID_REGEX = re.compile(r"^[a-zA-Z0-9\-]+$")


def validate_schema(records: List[TransactionRecord]) -> ValidationResult:
    """Validate list of transaction records against business & forensic schema rules."""
    errors: List[RowError] = []
    now = datetime.now(timezone.utc)
    max_allowed_time = now + timedelta(seconds=60)

    for idx, rec in enumerate(records):
        # 1. txid: non-empty, alphanumeric + hyphens only
        if not rec.txid or not TXID_REGEX.match(rec.txid):
            errors.append(
                RowError(
                    row_index=idx,
                    field="txid",
                    error="TXID must be a non-empty string containing only alphanumeric characters and hyphens",
                )
            )

        # 2. timestamp: must not be in the future (> now + 60s)
        rec_time = rec.timestamp
        if rec_time.tzinfo is None:
            rec_time = rec_time.replace(tzinfo=timezone.utc)
        if rec_time > max_allowed_time:
            errors.append(
                RowError(
                    row_index=idx,
                    field="timestamp",
                    error=f"Timestamp cannot be in the future ({rec.timestamp} > {now})",
                )
            )

        # 3. fee: must be >= 0 and < sum(input_amounts) if inputs present
        if rec.fee < 0:
            errors.append(
                RowError(
                    row_index=idx,
                    field="fee",
                    error=f"Transaction fee cannot be negative (got {rec.fee})",
                )
            )
        elif rec.input_amounts and len(rec.input_amounts) > 0:
            sum_inputs = sum(rec.input_amounts)
            if rec.fee >= sum_inputs and sum_inputs > 0:
                errors.append(
                    RowError(
                        row_index=idx,
                        field="fee",
                        error=f"Fee ({rec.fee}) must be less than total input amount ({sum_inputs})",
                    )
                )

        # 4. at least one input OR output address required
        if not rec.input_addresses and not rec.output_addresses:
            errors.append(
                RowError(
                    row_index=idx,
                    field="addresses",
                    error="Transaction must contain at least one input or output address",
                )
            )

        # 5. amounts: no negative values in lists
        if any(amt < 0 for amt in rec.input_amounts):
            errors.append(
                RowError(
                    row_index=idx,
                    field="input_amounts",
                    error="Negative values are not permitted in input amounts",
                )
            )
        if any(amt < 0 for amt in rec.output_amounts):
            errors.append(
                RowError(
                    row_index=idx,
                    field="output_amounts",
                    error="Negative values are not permitted in output amounts",
                )
            )

    invalid_indices: Set[int] = {e.row_index for e in errors}
    total_rows = len(records)
    invalid_rows = len(invalid_indices)
    valid_rows = total_rows - invalid_rows

    return ValidationResult(
        total_rows=total_rows,
        valid_rows=valid_rows,
        invalid_rows=invalid_rows,
        duplicate_rows=0,
        errors=errors,
    )


def filter_valid_records(
    records: List[TransactionRecord], errors: List[RowError]
) -> List[TransactionRecord]:
    """Filter out any records flagged with row validation errors."""
    invalid_indices: Set[int] = {e.row_index for e in errors}
    return [rec for idx, rec in enumerate(records) if idx not in invalid_indices]
