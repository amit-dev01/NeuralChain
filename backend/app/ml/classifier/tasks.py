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
from app.ml.classifier.features import (
    CLASSIFIER_FEATURE_COLUMNS,
    extract_classifier_features,
)
from app.ml.classifier.xgboost_model import RansomwareClassifier
from app.ml.model_registry import register_model_run, update_model_run

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="ml.run_classification")
def run_classification_task(self, dataset_id: str) -> Dict[str, Any]:
    """
    Celery task running supervised XGBoost classification for ransomware and darknet attribution.
    """
    task_id = self.request.id or str(uuid.uuid4())
    logger.info("Executing run_classification_task %s for dataset %s", task_id, dataset_id)

    db = SessionLocal()
    parsed_ds_uuid = None
    try:
        parsed_ds_uuid = uuid.UUID(str(dataset_id))
    except (ValueError, TypeError):
        pass

    try:
        # Register model run
        register_model_run(
            model_name="xgboost",
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
            logger.info("No transactions found for classification on dataset %s", dataset_id)
            metrics = {"n_scored": 0, "n_ransomware_detected": 0, "metrics": {}}
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

        # 2. Load existing alert scores for cluster_risk_avg lookup
        existing_alerts = {
            a.wallet_id: a
            for a in db.query(Alert).filter(Alert.dataset_id == parsed_ds_uuid).all()
        }
        alert_scores = {w: float(a.risk_score) for w, a in existing_alerts.items()}

        # 3. Extract classifier features
        df = extract_classifier_features(records, alert_scores=alert_scores)
        X = df[CLASSIFIER_FEATURE_COLUMNS]

        # 4. Build labels y
        has_ground_truth = any(
            (r.ground_truth_label or "").lower() in ("ransomware", "darknet", "illicit")
            for r in records
        )
        if has_ground_truth:
            y_list = [
                1 if (r.ground_truth_label or "").lower() in ("ransomware", "darknet", "illicit") else 0
                for r in records
            ]
        else:
            # Generate heuristic pseudo-labels based on structural indicators
            y_list = [
                1 if (df.iloc[i]["peel_chain_member_flag"] == 1.0 or df.iloc[i]["amount_roundness"] == 1.0) else 0
                for i in range(len(df))
            ]

        # Ensure at least 2 distinct classes exist for training stability
        if len(set(y_list)) <= 1 and len(y_list) > 1:
            y_list[0] = 1 if y_list[0] == 0 else 0

        y = np.array(y_list, dtype=int)

        # 5. Train or load RansomwareClassifier
        os.makedirs(settings.MODEL_STORE_PATH, exist_ok=True)
        model_path = os.path.join(settings.MODEL_STORE_PATH, f"xgboost_{dataset_id}.json")
        if not os.path.exists(model_path):
            for candidate in ["xgboost_model.json", "xgboost.json", "xgboost_default.json"]:
                cand_path = os.path.join(settings.MODEL_STORE_PATH, candidate)
                if os.path.exists(cand_path):
                    model_path = cand_path
                    break

        classifier = RansomwareClassifier(n_estimators=100, max_depth=5)

        if os.path.exists(model_path):
            try:
                classifier.load_model(model_path)
                train_metrics = {}
            except Exception as e:
                logger.warning("Failed loading XGBoost model '%s': %s", model_path, e)
                train_metrics = classifier.train(X, y)
                classifier.save_model(model_path)
        else:
            train_metrics = classifier.train(X, y)
            classifier.save_model(model_path)

        # 6. Predict illicit probabilities
        scores = classifier.predict_proba(X)

        # 7. Upsert Alert rows with xgb_score
        ransomware_detected = 0
        for i, rec in enumerate(records):
            prob = float(scores[i]) if i < len(scores) else 0.0
            if prob > 0.5:
                ransomware_detected += 1

            wallet_id = rec.output_addresses[0] if rec.output_addresses else rec.txid

            if wallet_id in existing_alerts:
                alert = existing_alerts[wallet_id]
                alert.xgb_score = prob
                alert.updated_at = datetime.utcnow()
                if prob > 0.6:
                    alert.risk_score = max(alert.risk_score, prob)
                    alert.risk_level = "critical" if alert.risk_score > 0.8 else "high"
            else:
                new_alert = Alert(
                    id=uuid.uuid4(),
                    dataset_id=parsed_ds_uuid,
                    wallet_id=wallet_id,
                    risk_score=prob,
                    risk_level="critical" if prob > 0.8 else "high" if prob > 0.6 else "medium" if prob > 0.3 else "low",
                    model_source="ensemble",
                    if_score=None,
                    ae_score=None,
                    mixing_score=None,
                    xgb_score=prob,
                    top_reasons=["High XGBoost classification probability for illicit/ransomware attribution"],
                    shap_values={},
                    evidence_txids=[rec.txid],
                    text_explanation=f"XGBoost classifier estimated {prob * 100:.1f}% probability of darknet/ransomware nexus",
                    status="new",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(new_alert)
                existing_alerts[wallet_id] = new_alert

        db.commit()

        run_metrics = {
            "n_scored": len(records),
            "n_ransomware_detected": ransomware_detected,
            "metrics": train_metrics,
        }
        update_model_run(task_id=task_id, status="complete", metrics=run_metrics, db=db)
        logger.info("Classification task complete for dataset %s: %s", dataset_id, run_metrics)
        return run_metrics

    except Exception as e:
        logger.exception("Error in run_classification_task for dataset %s: %s", dataset_id, e)
        update_model_run(
            task_id=task_id,
            status="failed",
            metrics={"error": str(e)},
            db=db,
        )
        raise e
    finally:
        db.close()
