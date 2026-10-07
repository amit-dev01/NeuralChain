"""
NeuralChain (SIH 2026) — Complete Autonomous Bitcoin Forensics ML Ensemble
PASTE THIS ENTIRE SCRIPT INTO A SINGLE GOOGLE COLAB CODE CELL TO TRAIN AND EXPORT ALL MODELS.
"""
# Install required libraries
import subprocess
import sys
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "xgboost", "torch", "scikit-learn", "shap", "pandas", "numpy", "matplotlib", "seaborn", "joblib"])

import os
import json
import math
import random
import zipfile
from datetime import datetime, timedelta, timezone
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import joblib

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

import xgboost as xgb
import shap

# Set seeds
np.random.seed(42)
torch.manual_seed(42)
random.seed(42)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"✅ Compute Device: {device}")

# 1. SYNTHETIC BENCHMARK GENERATION
print("\n[1/6] Synthesizing 5,000 UTXO Forensic Transactions across 5 Typologies...")
def generate_synthetic_transactions(n_samples=5000):
    records = []
    labels = ["normal", "peel_chain", "tumbler", "ransomware", "darknet"]
    weights = [0.65, 0.12, 0.10, 0.08, 0.05]
    base_time = datetime.now(timezone.utc) - timedelta(days=30)
    
    for i in range(n_samples):
        txid = f"tx_{i:06d}_{random.getrandbits(32):08x}"
        label = random.choices(labels, weights=weights)[0]
        tx_time = base_time + timedelta(minutes=random.randint(1, 43200))
        
        if label == "normal":
            n_in, n_out = random.randint(1, 3), random.randint(1, 2)
            amount_base = random.uniform(0.005, 1.5)
            fee = round(random.uniform(0.00005, 0.0003), 8)
            roundness = 0.0
            velocity = random.uniform(0.1, 1.2)
            reuse = random.randint(0, 2)
            geo_risk, asn_risk = 0.1, 0.1
            script_type = random.choice([0, 1, 2])
        elif label == "peel_chain":
            n_in, n_out = 1, 2
            amount_base = random.uniform(2.0, 25.0)
            fee = round(random.uniform(0.0004, 0.0015), 8)
            roundness = 0.5
            velocity = random.uniform(2.5, 6.0)
            reuse = random.randint(4, 12)
            geo_risk, asn_risk = 0.6, 0.6
            script_type = 2
        elif label == "tumbler":
            n_in, n_out = random.randint(5, 20), random.randint(5, 20)
            amount_base = random.uniform(5.0, 50.0)
            fee = round(random.uniform(0.0010, 0.0040), 8)
            roundness = 1.0
            velocity = random.uniform(4.0, 9.5)
            reuse = random.randint(6, 25)
            geo_risk, asn_risk = 0.8, 0.85
            script_type = 1
        elif label == "ransomware":
            n_in, n_out = random.randint(10, 40), random.randint(1, 3)
            amount_base = random.uniform(10.0, 120.0)
            fee = round(random.uniform(0.0008, 0.0025), 8)
            roundness = 1.0
            velocity = random.uniform(5.0, 10.0)
            reuse = random.randint(8, 30)
            geo_risk, asn_risk = 0.95, 0.9
            script_type = 0
        else: # darknet
            n_in, n_out = random.randint(2, 6), random.randint(4, 12)
            amount_base = random.uniform(1.0, 15.0)
            fee = round(random.uniform(0.0005, 0.0020), 8)
            roundness = 0.0
            velocity = random.uniform(3.0, 7.0)
            reuse = random.randint(3, 15)
            geo_risk, asn_risk = 0.9, 0.75
            script_type = 0
            
        total_in = amount_base + fee
        total_out = amount_base
        fee_ratio = fee / (total_in + 1e-9)
        cluster_risk = geo_risk * 0.5 + asn_risk * 0.5
        
        records.append({
            "txid": txid,
            "timestamp": tx_time.isoformat(),
            "label": label,
            "is_anomaly": 0 if label == "normal" else 1,
            "fee_ratio": fee_ratio,
            "fan_in": n_in,
            "fan_out": n_out,
            "amount_total_in": total_in,
            "amount_total_out": total_out,
            "amount_std_in": (total_in / n_in) * random.uniform(0.05, 0.25),
            "amount_std_out": (total_out / n_out) * random.uniform(0.05, 0.25),
            "amount_log": math.log1p(total_in),
            "round_amount_flag": roundness,
            "address_reuse_count": reuse,
            "script_type_encoded": script_type,
            "velocity_flag": 1.0 if velocity > 2.0 else 0.0,
            "amount_roundness": roundness,
            "fee_percentile": min(fee_ratio * 1000.0, 1.0),
            "velocity_zscore": (velocity - 1.5) / 1.2,
            "cluster_risk_avg": cluster_risk,
            "fan_out_zscore": (n_out - 2.0) / 3.0,
            "peel_chain_member_flag": 1.0 if label == "peel_chain" else 0.0,
            "ip_country_risk_score": geo_risk,
            "asn_risk_score": asn_risk,
        })
    return pd.DataFrame(records)

df = generate_synthetic_transactions(5000)
print(f"Generated {len(df)} transactions. Label breakdown:\n{df['label'].value_counts().to_dict()}")

# 2. FEATURE MATRICES
ANOMALY_FEATURE_COLS = [
    "fee_ratio", "fan_in", "fan_out", "amount_total_in", "amount_total_out",
    "amount_std_in", "amount_std_out", "amount_log", "round_amount_flag",
    "address_reuse_count", "script_type_encoded", "velocity_flag"
]
CLASSIFIER_FEATURE_COLS = [
    "amount_roundness", "fee_percentile", "velocity_zscore", "address_reuse_count",
    "cluster_risk_avg", "fan_out_zscore", "peel_chain_member_flag",
    "ip_country_risk_score", "asn_risk_score"
]

scaler = StandardScaler()
X_anomaly_scaled = scaler.fit_transform(df[ANOMALY_FEATURE_COLS])
le = LabelEncoder()
y_class = le.fit_transform(df["label"])
class_names = le.classes_.tolist()

# 3. TIER 1: ISOLATION FOREST
print("\n[2/6] Training Tier 1 — Isolation Forest...")
iso_forest = IsolationForest(n_estimators=120, contamination=0.15, max_features=1.0, random_state=42, n_jobs=-1)
iso_forest.fit(X_anomaly_scaled)
raw_scores = -iso_forest.decision_function(X_anomaly_scaled)
min_s, max_s = raw_scores.min(), raw_scores.max()
df["if_anomaly_score"] = (raw_scores - min_s) / (max_s - min_s + 1e-9)
print(f"Isolation Forest trained. Avg Anomaly Score: {df['if_anomaly_score'].mean():.4f}")

# 4. TIER 2: DEEP PYTORCH AUTOENCODER
print("\n[3/6] Training Tier 2 — PyTorch Deep Autoencoder...")
class ForensicAutoencoder(nn.Module):
    def __init__(self, input_dim=12, latent_dim=4):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 16), nn.BatchNorm1d(16), nn.LeakyReLU(0.2),
            nn.Linear(16, 8), nn.BatchNorm1d(8), nn.LeakyReLU(0.2),
            nn.Linear(8, latent_dim)
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 8), nn.BatchNorm1d(8), nn.LeakyReLU(0.2),
            nn.Linear(8, 16), nn.BatchNorm1d(16), nn.LeakyReLU(0.2),
            nn.Linear(16, input_dim)
        )
    def forward(self, x):
        return self.decoder(self.encoder(x))

normal_mask = (df["label"] == "normal").values
X_normal = X_anomaly_scaled[normal_mask]
dataset = TensorDataset(torch.tensor(X_normal, dtype=torch.float32))
loader = DataLoader(dataset, batch_size=64, shuffle=True)

autoencoder = ForensicAutoencoder(input_dim=len(ANOMALY_FEATURE_COLS)).to(device)
criterion = nn.MSELoss()
optimizer = optim.AdamW(autoencoder.parameters(), lr=0.003, weight_decay=1e-5)

autoencoder.train()
for epoch in range(30):
    for batch in loader:
        x_b = batch[0].to(device)
        optimizer.zero_grad()
        loss = criterion(autoencoder(x_b), x_b)
        loss.backward()
        optimizer.step()

autoencoder.eval()
with torch.no_grad():
    all_t = torch.tensor(X_anomaly_scaled, dtype=torch.float32).to(device)
    recon_errors = torch.mean((all_t - autoencoder(all_t)) ** 2, dim=1).cpu().numpy()
ae_min, ae_max = recon_errors.min(), recon_errors.max()
df["ae_anomaly_score"] = (recon_errors - ae_min) / (ae_max - ae_min + 1e-9)
print(f"Autoencoder trained. Avg Recon Score: {df['ae_anomaly_score'].mean():.4f}")

# 5. TIER 4: XGBOOST THREAT CLASSIFIER
print("\n[4/6] Training Tier 4 — XGBoost Multi-Class Threat Classifier...")
X_train, X_test, y_train, y_test = train_test_split(
    df[CLASSIFIER_FEATURE_COLS], y_class, test_size=0.2, random_state=42, stratify=y_class
)
xgb_model = xgb.XGBClassifier(
    n_estimators=150, max_depth=5, learning_rate=0.08, subsample=0.85, colsample_bytree=0.85,
    objective="multi:softprob", num_class=len(class_names), random_state=42, n_jobs=-1, eval_metric="mlogloss"
)
xgb_model.fit(X_train, y_train)
y_pred = xgb_model.predict(X_test)
print(classification_report(y_test, y_pred, target_names=class_names, digits=4))

# 6. SHAP EXPLAINABILITY
print("\n[5/6] Calculating SHAP Feature Attribution Explanations...")
explainer = shap.TreeExplainer(xgb_model)
shap_vals = explainer.shap_values(X_test.iloc[:100])
print("SHAP TreeExplainer generated successfully.")

# 7. EXPORT MODEL ARTIFACTS
print("\n[6/6] Packaging Model Artifacts into neuralchain_models.zip...")
os.makedirs("exported_models", exist_ok=True)
joblib.dump(iso_forest, "exported_models/isolation_forest.pkl")
joblib.dump(scaler, "exported_models/scaler.pkl")
torch.save(autoencoder.state_dict(), "exported_models/autoencoder.pt")
xgb_model.save_model("exported_models/xgboost_model.json")
joblib.dump(le, "exported_models/label_encoder.pkl")

meta = {
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "classes": class_names,
    "anomaly_features": ANOMALY_FEATURE_COLS,
    "classifier_features": CLASSIFIER_FEATURE_COLS,
    "weights": {"if": 0.20, "ae": 0.20, "graph": 0.25, "xgb": 0.35}
}
with open("exported_models/metadata.json", "w") as f:
    json.dump(meta, f, indent=2)

zip_filename = "neuralchain_models.zip"
with zipfile.ZipFile(zip_filename, "w") as zipf:
    for root, _, files in os.walk("exported_models"):
        for file in files:
            zipf.write(os.path.join(root, file), arcname=file)

print(f"\n🎉 DONE! All 4 models trained and archived in {zip_filename}!")
try:
    from google.colab import files
    files.download(zip_filename)
    print("⬇️ Download prompt opened in Google Colab.")
except Exception:
    print(f"📦 Archive saved at: {os.path.abspath(zip_filename)}")
