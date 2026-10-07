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
from app.ml.anomaly.autoencoder import AutoencoderDetector
from app.ml.anomaly.ensemble import combine_scores
from app.ml.anomaly.features import FEATURE_COLUMNS, extract_anomaly_features
from app.ml.anomaly.isolation_forest import IsolationForestDetector
from app.ml.model_registry import register_model_run, update_model_run

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="ml.run_anomaly_detection")
def run_anomaly_detection_task(self, dataset_id: str) -> Dict[str, Any]:
    """
    Celery task executing end-to-end unsupervised anomaly detection pipeline for a dataset.
    Extracts features, fits/predicts Isolation Forest and Autoencoder models, fuses scores,
    and upserts alert records into PostgreSQL.
    """
    task_id = self.request.id or str(uuid.uuid4())
    logger.info("Executing run_anomaly_detection_task %s for dataset %s", task_id, dataset_id)

    db = SessionLocal()
    parsed_ds_uuid = None
    try:
        parsed_ds_uuid = uuid.UUID(str(dataset_id))
    except (ValueError, TypeError):
        pass

    try:
        # Register model run tracking in PostgreSQL
        register_model_run(
            model_name="isolation_forest",
            task_id=task_id,
            dataset_id=dataset_id,
            db=db,
        )

        # 1. Load transactions from postgres for dataset_id
        tx_query = db.query(Transaction)
        if parsed_ds_uuid is not None:
            tx_query = tx_query.filter(Transaction.dataset_id == parsed_ds_uuid)

        db_txs = tx_query.all()
        if not db_txs:
            logger.warning("No transactions found in database for dataset %s", dataset_id)
            update_model_run(
                task_id=task_id,
                status="complete",
                metrics={"alerts_created": 0, "mean_risk": 0.0, "total_transactions": 0},
                db=db,
            )
            return {"dataset_id": dataset_id, "alerts_created": 0, "mean_risk": 0.0}

        # 2. Convert to TransactionRecord list
        records: List[TransactionRecord] = []
        for t in db_txs:
            script_val = ScriptType.UNKNOWN
            try:
                if t.script_type:
                    script_val = ScriptType(t.script_type)
            except Exception:
                script_val = ScriptType.UNKNOWN

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
                    script_type=script_val,
                    geo_country=t.geo_country,
                    asn=t.asn,
                    city=t.city,
                    lat=t.lat,
                    lon=t.lon,
                    ground_truth_label=t.ground_truth_label,
                )
            )

        # 3. Extract features
        df = extract_anomaly_features(records)
        X = df[FEATURE_COLUMNS]

        # 5. Train / load IsolationForest
        os.makedirs(settings.MODEL_STORE_PATH, exist_ok=True)
        if_model_path = os.path.join(settings.MODEL_STORE_PATH, f"if_{dataset_id}.joblib")
        if not os.path.exists(if_model_path):
            for candidate in ["isolation_forest.pkl", "isolation_forest.joblib", "if_default.joblib"]:
                cand_path = os.path.join(settings.MODEL_STORE_PATH, candidate)
                if os.path.exists(cand_path):
                    if_model_path = cand_path
                    break

        if_detector = IsolationForestDetector(
            contamination=settings.ISOLATION_FOREST_CONTAMINATION
        )

        if os.path.exists(if_model_path):
            try:
                if_detector.load_model(if_model_path)
            except Exception as e:
                logger.warning("Failed loading IF model from '%s', retraining: %s", if_model_path, e)
                if_detector.train(X)
                if_detector.save_model(if_model_path)
        else:
            if_detector.train(X)
            if_detector.save_model(if_model_path)

        # 6. Train / load Autoencoder
        ae_model_path = os.path.join(settings.MODEL_STORE_PATH, f"ae_{dataset_id}.pt")
        if not os.path.exists(ae_model_path):
            for candidate in ["autoencoder.pt", "ae_default.pt"]:
                cand_path = os.path.join(settings.MODEL_STORE_PATH, candidate)
                if os.path.exists(cand_path):
                    ae_model_path = cand_path
                    break

        ae_detector = AutoencoderDetector(
            input_dim=len(FEATURE_COLUMNS),
            latent_dim=settings.AUTOENCODER_LATENT_DIM,
            epochs=settings.AUTOENCODER_EPOCHS,
            lr=settings.AUTOENCODER_LR,
        )

        if os.path.exists(ae_model_path):
            try:
                ae_detector.load_model(ae_model_path)
            except Exception as e:
                logger.warning("Failed loading AE model from '%s', retraining: %s", ae_model_path, e)
                ae_detector.train(X)
                ae_detector.save_model(ae_model_path)
        else:
            ae_detector.train(X)
            ae_detector.save_model(ae_model_path)

        # 7 & 8. Predict scores
        if_scores = if_detector.predict(X)
        ae_scores = ae_detector.predict(X)

        # 9. Fuse scores using configured ensemble weights
        combined = combine_scores(
            if_scores,
            ae_scores,
            weight_if=settings.ANOMALY_WEIGHT_IF,
            weight_ae=settings.ANOMALY_WEIGHT_AE,
        )

        # 10. Upsert Alert rows in PostgreSQL
        alerts_created = 0
        existing_alerts = {
            a.wallet_id: a
            for a in db.query(Alert).filter(Alert.dataset_id == parsed_ds_uuid).all()
        }

        for i, rec in enumerate(records):
            score = float(combined[i])
            if_s = float(if_scores[i])
            ae_s = float(ae_scores[i])

            # Determine entity wallet id: first output address or fallback to txid
            wallet_id = rec.output_addresses[0] if rec.output_addresses else rec.txid

            # Determine risk tier
            if score >= 0.8:
                risk_tier = "critical"
            elif score >= 0.6:
                risk_tier = "high"
            elif score >= 0.3:
                risk_tier = "medium"
            else:
                risk_tier = "low"

            reasons: List[str] = []
            if if_s > 0.5:
                reasons.append("High topological isolation partition score")
            if ae_s > 0.5:
                reasons.append("High deep reconstruction compression error")
            if len(rec.input_addresses) > 5:
                reasons.append("Abnormal input fan-in clustering")
            if not reasons:
                reasons.append("Standard heuristic anomaly threshold")

            top_reasons = reasons[:3]

            if wallet_id in existing_alerts:
                existing_alert = existing_alerts[wallet_id]
                existing_alert.risk_score = max(existing_alert.risk_score, score)
                existing_alert.risk_level = risk_tier
                existing_alert.model_source = "ensemble"
                existing_alert.if_score = if_s
                existing_alert.ae_score = ae_s
                existing_alert.top_reasons = top_reasons
                existing_evidence = existing_alert.evidence_txids or []
                if rec.txid not in existing_evidence:
                    existing_evidence.append(rec.txid)
                existing_alert.evidence_txids = existing_evidence
                existing_alert.updated_at = datetime.utcnow()
            else:
                new_alert = Alert(
                    id=uuid.uuid4(),
                    dataset_id=parsed_ds_uuid,
                    wallet_id=wallet_id,
                    risk_score=score,
                    risk_level=risk_tier,
                    model_source="ensemble",
                    if_score=if_s,
                    ae_score=ae_s,
                    mixing_score=None,
                    xgb_score=None,
                    top_reasons=top_reasons,
                    shap_values={},
                    evidence_txids=[rec.txid],
                    text_explanation=f"Ensemble anomaly detected with combined confidence {score:.2f}",
                    status="new",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(new_alert)
                existing_alerts[wallet_id] = new_alert
                alerts_created += 1

        db.commit()

        mean_risk = float(np.mean(combined)) if len(combined) > 0 else 0.0
        update_model_run(
            task_id=task_id,
            status="complete",
            metrics={
                "alerts_created": alerts_created,
                "mean_risk": mean_risk,
                "total_transactions": len(records),
            },
            db=db,
        )

        logger.info(
            "Anomaly detection complete for dataset %s: %d alerts created, mean risk %.4f",
            dataset_id,
            alerts_created,
            mean_risk,
        )

        return {
            "dataset_id": dataset_id,
            "alerts_created": alerts_created,
            "mean_risk": mean_risk,
        }

    except Exception as e:
        logger.exception("Error executing run_anomaly_detection_task for dataset %s: %s", dataset_id, e)
        update_model_run(
            task_id=task_id,
            status="failed",
            metrics={"error": str(e)},
            db=db,
        )
        raise e
    finally:
        db.close()
