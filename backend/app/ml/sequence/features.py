from datetime import datetime
from typing import Dict, List, Tuple

import numpy as np

from app.ingest.models import TransactionRecord


def group_transactions_by_wallet(
    records: List[TransactionRecord],
) -> Dict[str, List[TransactionRecord]]:
    """
    Group transaction records by recipient wallet address (first output address).
    Sorts each wallet's transaction history chronologically by timestamp.
    """
    grouped: Dict[str, List[TransactionRecord]] = {}

    for r in records:
        # Use first output address if available, else first input address or txid
        if r.output_addresses and len(r.output_addresses) > 0:
            w_id = r.output_addresses[0]
        elif r.input_addresses and len(r.input_addresses) > 0:
            w_id = r.input_addresses[0]
        else:
            w_id = r.txid

        if w_id not in grouped:
            grouped[w_id] = []
        grouped[w_id].append(r)

    # Sort each wallet's transactions chronologically
    for w_id in grouped:
        grouped[w_id].sort(
            key=lambda t: t.timestamp.timestamp()
            if hasattr(t.timestamp, "timestamp")
            else 0.0
        )

    return grouped


def build_tx_sequences(
    transactions_by_wallet: Dict[str, List[TransactionRecord]],
    seq_length: int = 20,
) -> Tuple[np.ndarray, List[str]]:
    """
    Transform wallet transaction histories into padded 3D temporal sequence tensors.
    Features per timestep (6):
      [log1p(amount_total_out), fee_ratio, fan_out, time_delta_seconds (normalized),
       round_amount_flag, address_reuse_count]

    Returns:
      X: shape [n_wallets, seq_length, 6]
      wallet_ids: list of wallet address strings aligned with X
    """
    wallet_ids = list(transactions_by_wallet.keys())
    n_wallets = len(wallet_ids)
    n_features = 6

    if n_wallets == 0:
        return np.zeros((0, seq_length, n_features), dtype=np.float32), []

    X = np.zeros((n_wallets, seq_length, n_features), dtype=np.float32)

    for i, w_id in enumerate(wallet_ids):
        tx_list = transactions_by_wallet[w_id]
        if not tx_list:
            continue

        # Extract features for all transactions in order
        vectors: List[List[float]] = []
        prev_ts: float | None = None

        for tx in tx_list:
            out_amts = [float(x) for x in tx.output_amounts or []]
            in_amts = [float(x) for x in tx.input_amounts or []]
            sum_out = sum(out_amts) if out_amts else 0.0
            sum_in = sum(in_amts) if in_amts else 0.0

            # 1. log1p(amount_total_out)
            f_amt = float(np.log1p(max(0.0, sum_out)))

            # 2. fee_ratio: fee / sum(input_amounts)
            f_fee = float(tx.fee / sum_in) if sum_in > 0 else 0.0

            # 3. fan_out
            f_fan_out = float(len(tx.output_addresses or []))

            # 4. time_delta_seconds (normalized: log1p(delta))
            curr_ts = (
                tx.timestamp.timestamp()
                if hasattr(tx.timestamp, "timestamp")
                else 0.0
            )
            if prev_ts is None:
                delta_sec = 0.0
            else:
                delta_sec = max(0.0, curr_ts - prev_ts)
            prev_ts = curr_ts
            f_time_delta = float(np.log1p(delta_sec))

            # 5. round_amount_flag
            round_flag = 0.0
            for a in out_amts:
                if a > 0:
                    rem = a % 0.001
                    if rem < 1e-8 or abs(rem - 0.001) < 1e-8:
                        round_flag = 1.0
                        break

            # 6. address_reuse_count
            reuse_cnt = float(
                len(set(tx.input_addresses or []) & set(tx.output_addresses or []))
            )

            vectors.append([f_amt, f_fee, f_fan_out, f_time_delta, round_flag, reuse_cnt])

        # Truncate to last seq_length if longer
        if len(vectors) > seq_length:
            vectors = vectors[-seq_length:]

        # Pad with zeros at the beginning (pre-padding)
        pad_len = seq_length - len(vectors)
        for t_idx, feat_vec in enumerate(vectors):
            X[i, pad_len + t_idx, :] = feat_vec

    return X, wallet_ids
