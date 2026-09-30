import logging
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List

import numpy as np

from app.celery_app import celery_app
from app.core.config import settings
from app.db.postgres import Alert, SessionLocal, Transaction
from app.ingest.models import ScriptType, TransactionRecord
from app.ml.model_registry import register_model_run, update_model_run
from app.ml.sequence.features import build_tx_sequences, group_transactions_by_wallet
from app.ml.sequence.lstm_model import MixingDetector

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="ml.run_mixing_detection")
def run_mixing_detection_task(self, dataset_id: str) -> Dict[str, Any]:
    """
    Celery task analyzing transaction sequences with LSTM to detect CoinJoin or tumbling mixing.
    """
    task_id = self.request.id or str(uuid.uuid4())
    logger.info("Executing run_mixing_detection_task %s for dataset %s", task_id, dataset_id)

    db = SessionLocal()
    parsed_ds_uuid = None
    try:
        parsed_ds_uuid = uuid.UUID(str(dataset_id))
    except (ValueError, TypeError):
        pass

    try:
        # Register model run
        register_model_run(
            model_name="autoencoder",  # tracking temporal sequence runner
            task_id=task_id,
            dataset_id=dataset_id,
            db=db,
        )

        # 1. Load transactions for dataset_id from postgres
        tx_query = db.query(Transaction)
        if parsed_ds_uuid:
            tx_query = tx_query.filter(Transaction.dataset_id == parsed_ds_uuid)

        db_txs = tx_query.all()
        if not db_txs:
            logger.info("No transactions found for mixing detection on dataset %s", dataset_id)
            metrics = {"n_wallets_scored": 0, "n_mixing_detected": 0}
            update_model_run(task_id=task_id, status="complete", metrics=metrics, db=db)
            return metrics

        records: List[TransactionRecord] = []
        for t in db_txs:
            s_val = ScriptType.UNKNOWN
            try:
                if t.script_type:
                    s_val = ScriptType(t.script_type)
            except Exception:
                s_val = ScriptType.UNKNOWN

            records.append(
                TransactionRecord(
                    txid=t.txid,
                    timestamp=t.timestamp,
                    src_ip=t.src_ip,
                    dst_ip=t.dst_ip,
                    src_port=t.src_port,
                    dst_port=t.dst_port,
                    input_addresses=t.input_addresses or [],
                    output_addresses=t.output_addresses or [],
                    input_amounts=[float(x) for x in t.input_amounts or []],
                    output_amounts=[float(x) for x in t.output_amounts or []],
                    fee=float(t.fee or 0.0),
                    script_type=s_val,
                    geo_country=t.geo_country,
                    asn=t.asn,
                    city=t.city,
                    lat=t.lat,
                    lon=t.lon,
                    ground_truth_label=t.ground_truth_label,
                )
            )

        # 2. Group by wallet
        grouped = group_transactions_by_wallet(records)

        # 3. Build sequences
        X, wallet_ids = build_tx_sequences(grouped, seq_length=20)

        # 4. Generate pseudo-labels
        y_list = []
        for w in wallet_ids:
            txs = grouped[w]
            is_mixing = any(len(tx.output_addresses or []) > 20 for tx in txs)
            y_list.append(1 if is_mixing else 0)
        y = np.array(y_list, dtype=np.float32)

        # 5. Train or load MixingDetector
        os.makedirs(settings.MODEL_STORE_PATH, exist_ok=True)
        model_path = os.path.join(settings.MODEL_STORE_PATH, f"lstm_mixing_{dataset_id}.pt")
        detector = MixingDetector(input_size=6, hidden_size=64, num_layers=2, epochs=10)

        if os.path.exists(model_path):
            try:
                detector.load_model(model_path)
            except Exception as e:
                logger.warning("Failed loading saved LSTM model '%s': %s", model_path, e)
                detector.train(X, y)
                detector.save_model(model_path)
        else:
            detector.train(X, y)
            detector.save_model(model_path)

        # 6. Predict scores
        scores = detector.predict(X)

        # 7. Upsert Alert rows with mixing_score
        mixing_detected_count = 0
        existing_alerts = {
            a.wallet_id: a
            for a in db.query(Alert).filter(Alert.dataset_id == parsed_ds_uuid).all()
        }

        for i, w_id in enumerate(wallet_ids):
            mix_score = float(scores[i]) if i < len(scores) else 0.0
            if mix_score > 0.5:
                mixing_detected_count += 1

            if w_id in existing_alerts:
                alert = existing_alerts[w_id]
                alert.mixing_score = mix_score
                alert.updated_at = datetime.utcnow()
                if mix_score > 0.6:
                    alert.risk_score = max(alert.risk_score, mix_score)
                    alert.risk_level = "critical" if alert.risk_score > 0.8 else "high"
            else:
                new_alert = Alert(
                    id=uuid.uuid4(),
                    dataset_id=parsed_ds_uuid,
                    wallet_id=w_id,
                    risk_score=mix_score,
                    risk_level="high" if mix_score > 0.6 else "medium" if mix_score > 0.3 else "low",
                    model_source="ensemble",
                    if_score=None,
                    ae_score=None,
                    mixing_score=mix_score,
                    xgb_score=None,
                    top_reasons=["High CoinJoin / mixing pattern detected in sequence"],
                    shap_values={},
                    evidence_txids=[grouped[w_id][0].txid] if grouped[w_id] else [],
                    text_explanation=f"LSTM temporal model flagged wallet with mixing probability {mix_score:.2f}",
                    status="new",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(new_alert)
                existing_alerts[w_id] = new_alert

        db.commit()

        metrics = {
            "n_wallets_scored": len(wallet_ids),
            "n_mixing_detected": mixing_detected_count,
        }
        update_model_run(task_id=task_id, status="complete", metrics=metrics, db=db)
        logger.info("Mixing detection task complete for %s: %s", dataset_id, metrics)
        return metrics

    except Exception as e:
        logger.exception("Error in run_mixing_detection_task for dataset %s: %s", dataset_id, e)
        update_model_run(
            task_id=task_id,
            status="failed",
            metrics={"error": str(e)},
            db=db,
        )
        raise e
    finally:
        db.close()
