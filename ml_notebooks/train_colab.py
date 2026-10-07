"""
NeuralChain (SIH 2026) — Bitcoin Forensics ML Ensemble
Trained on the REAL Elliptic Bitcoin Dataset from Kaggle
(203,769 transactions · 166 features · labeled illicit / licit)

PASTE THIS ENTIRE SCRIPT INTO A SINGLE GOOGLE COLAB CODE CELL.
You need a Kaggle API token — instructions inside.
"""

# ─── 0. Install dependencies ────────────────────────────────────────────────────
import subprocess, sys
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q",
    "kaggle", "xgboost", "torch", "scikit-learn", "shap",
    "pandas", "numpy", "matplotlib", "seaborn", "joblib", "imbalanced-learn"])

import os, json, math, zipfile, warnings
from datetime import datetime, timezone
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
warnings.filterwarnings("ignore")

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
from imblearn.over_sampling import SMOTE

import xgboost as xgb
import shap

np.random.seed(42)
torch.manual_seed(42)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"✅ Compute device: {device}")

# ─── 1. KAGGLE AUTHENTICATION ───────────────────────────────────────────────────
print("\n[1/7] Setting up Kaggle credentials...")

# ── How to get your token ────────────────────────────────────────────────────────
# 1. Go to https://www.kaggle.com/settings
# 2. Scroll to "API" section → click "Create New Token"
# 3. kaggle.json will be downloaded — open it, copy username and key below

KAGGLE_USERNAME = "YOUR_KAGGLE_USERNAME"   # <── fill in
KAGGLE_KEY      = "YOUR_KAGGLE_API_KEY"    # <── fill in

os.makedirs("/root/.config/kaggle", exist_ok=True)
with open("/root/.config/kaggle/kaggle.json", "w") as f:
    json.dump({"username": KAGGLE_USERNAME, "key": KAGGLE_KEY}, f)
os.chmod("/root/.config/kaggle/kaggle.json", 0o600)
print("✅ Kaggle credentials configured.")

# ─── 2. DOWNLOAD ELLIPTIC DATASET ───────────────────────────────────────────────
print("\n[2/7] Downloading Elliptic Bitcoin Dataset from Kaggle...")
# Dataset: https://www.kaggle.com/datasets/ellipticco/elliptic-data-set
# 203,769 real Bitcoin transactions | 49 time steps | labeled illicit / licit
os.makedirs("elliptic_data", exist_ok=True)
subprocess.check_call([
    "kaggle", "datasets", "download",
    "-d", "ellipticco/elliptic-data-set",
    "-p", "elliptic_data",
    "--unzip"
])
print("✅ Download complete. Files:")
for f in os.listdir("elliptic_data"):
    size_mb = os.path.getsize(os.path.join("elliptic_data", f)) / 1e6
    print(f"  → {f}  ({size_mb:.1f} MB)")

# ─── 3. LOAD & MERGE ────────────────────────────────────────────────────────────
print("\n[3/7] Loading and merging CSVs...")

# Features CSV has NO header row:
#   col 0  = txId
#   col 1  = time_step (1–49)
#   col 2–165 = f1–f164  (94 local + 70 aggregated features)
feat_cols = ["txId", "time_step"] + [f"f{i}" for i in range(1, 165)]
df_feat   = pd.read_csv("elliptic_data/elliptic_txs_features.csv",
                        header=None, names=feat_cols)
df_class  = pd.read_csv("elliptic_data/elliptic_txs_classes.csv")

df = df_feat.merge(df_class, on="txId", how="inner")
print(f"Total transactions : {len(df):,}")
print(f"Label breakdown    : {df['class'].value_counts().to_dict()}")

# ─── 4. PREPROCESSING ───────────────────────────────────────────────────────────
print("\n[4/7] Preprocessing...")

# Keep only labeled rows (drop 'unknown')
df_lab = df[df["class"] != "unknown"].copy()
df_lab["class"] = df_lab["class"].astype(int)
# Elliptic: 1 = illicit, 2 = licit  →  remap to 1 = illicit, 0 = licit
df_lab["is_illicit"] = (df_lab["class"] == 1).astype(int)

n_illicit = df_lab["is_illicit"].sum()
n_licit   = (df_lab["is_illicit"] == 0).sum()
print(f"Labeled rows : {len(df_lab):,}")
print(f"Illicit      : {n_illicit:,}  ({n_illicit/len(df_lab)*100:.1f}%)")
print(f"Licit        : {n_licit:,}  ({n_licit/len(df_lab)*100:.1f}%)")

FEATURE_COLS = [f"f{i}" for i in range(1, 165)]
X_raw = df_lab[FEATURE_COLS].values
y     = df_lab["is_illicit"].values

scaler   = StandardScaler()
X_scaled = scaler.fit_transform(X_raw)

# SMOTE to balance classes for the XGBoost classifier
print("Applying SMOTE to balance classes for XGBoost...")
smote        = SMOTE(random_state=42)
X_bal, y_bal = smote.fit_resample(X_scaled, y)
print(f"After SMOTE  : {X_bal.shape[0]:,} samples (balanced 50/50)")

X_train, X_test, y_train, y_test = train_test_split(
    X_bal, y_bal, test_size=0.2, random_state=42, stratify=y_bal)

# ─── 5a. ISOLATION FOREST ───────────────────────────────────────────────────────
print("\n[5a/7] Training Isolation Forest (fit on licit baseline)...")
X_licit    = X_scaled[y == 0]
iso_forest = IsolationForest(
    n_estimators=150,
    contamination=round(n_illicit / len(df_lab), 4),
    max_features=1.0,
    random_state=42,
    n_jobs=-1,
)
iso_forest.fit(X_licit)
raw_s = -iso_forest.decision_function(X_scaled)
mn, mx = raw_s.min(), raw_s.max()
df_lab["if_score"] = (raw_s - mn) / (mx - mn + 1e-9)
print(f"✅ Isolation Forest done. Mean anomaly score: {df_lab['if_score'].mean():.4f}")

# ─── 5b. PYTORCH AUTOENCODER ────────────────────────────────────────────────────
print("\n[5b/7] Training PyTorch Autoencoder (164 → 16 → 164)...")

class ForensicAutoencoder(nn.Module):
    def __init__(self, input_dim=164, latent_dim=16):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 128), nn.BatchNorm1d(128), nn.LeakyReLU(0.2), nn.Dropout(0.1),
            nn.Linear(128, 64),        nn.BatchNorm1d(64),  nn.LeakyReLU(0.2),
            nn.Linear(64, latent_dim),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 64),  nn.BatchNorm1d(64),  nn.LeakyReLU(0.2),
            nn.Linear(64, 128),         nn.BatchNorm1d(128), nn.LeakyReLU(0.2), nn.Dropout(0.1),
            nn.Linear(128, input_dim),
        )
    def forward(self, x):
        return self.decoder(self.encoder(x))

licit_t    = torch.tensor(X_licit, dtype=torch.float32)
loader_ae  = DataLoader(TensorDataset(licit_t), batch_size=256, shuffle=True)
autoencoder = ForensicAutoencoder(164, 16).to(device)
optimizer   = optim.AdamW(autoencoder.parameters(), lr=1e-3, weight_decay=1e-5)
scheduler   = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=40)
criterion   = nn.MSELoss()

autoencoder.train()
for epoch in range(40):
    ep_loss = 0.0
    for (xb,) in loader_ae:
        xb = xb.to(device)
        optimizer.zero_grad()
        loss = criterion(autoencoder(xb), xb)
        loss.backward()
        optimizer.step()
        ep_loss += loss.item()
    scheduler.step()
    if (epoch + 1) % 10 == 0:
        print(f"  Epoch {epoch+1:2d}/40 — loss: {ep_loss/len(loader_ae):.6f}")

autoencoder.eval()
with torch.no_grad():
    all_t  = torch.tensor(X_scaled, dtype=torch.float32).to(device)
    recon  = torch.mean((all_t - autoencoder(all_t)) ** 2, dim=1).cpu().numpy()
ae_mn, ae_mx = recon.min(), recon.max()
df_lab["ae_score"] = (recon - ae_mn) / (ae_mx - ae_mn + 1e-9)
print(f"✅ Autoencoder done. Mean reconstruction score: {df_lab['ae_score'].mean():.4f}")

# ─── 5c. XGBOOST BINARY CLASSIFIER ─────────────────────────────────────────────
print("\n[5c/7] Training XGBoost binary classifier (illicit vs licit)...")
xgb_model = xgb.XGBClassifier(
    n_estimators=300, max_depth=6, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    min_child_weight=5, gamma=1,
    reg_alpha=0.1, reg_lambda=1.0,
    objective="binary:logistic", eval_metric="auc",
    use_label_encoder=False, random_state=42, n_jobs=-1,
    tree_method="hist", device=str(device),
)
xgb_model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=50)

y_pred  = xgb_model.predict(X_test)
y_prob  = xgb_model.predict_proba(X_test)[:, 1]
roc_auc = roc_auc_score(y_test, y_prob)
print(f"\n{classification_report(y_test, y_pred, target_names=['licit','illicit'], digits=4)}")
print(f"ROC-AUC: {roc_auc:.4f}")

le = LabelEncoder()
le.classes_ = np.array(["licit", "illicit"])

# ─── 6. SHAP + CONFUSION MATRIX ─────────────────────────────────────────────────
print("\n[6/7] SHAP feature importance & confusion matrix...")

explainer = shap.TreeExplainer(xgb_model)
shap_vals = explainer.shap_values(X_test[:500])
plt.figure(figsize=(10, 7))
shap.summary_plot(shap_vals, X_test[:500], feature_names=FEATURE_COLS,
                  max_display=20, show=False)
plt.tight_layout()
plt.savefig("shap_summary.png", dpi=150, bbox_inches="tight")
plt.close()

cm = confusion_matrix(y_test, y_pred)
fig, ax = plt.subplots(figsize=(5, 4))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
            xticklabels=["licit","illicit"], yticklabels=["licit","illicit"], ax=ax)
ax.set_title("XGBoost Confusion Matrix — Elliptic Dataset")
ax.set_ylabel("True"); ax.set_xlabel("Predicted")
plt.tight_layout()
plt.savefig("confusion_matrix.png", dpi=150, bbox_inches="tight")
plt.close()
print("  Plots saved: shap_summary.png, confusion_matrix.png")

# ─── 7. EXPORT ──────────────────────────────────────────────────────────────────
print("\n[7/7] Packaging artifacts → neuralchain_models.zip ...")
os.makedirs("exported_models", exist_ok=True)
joblib.dump(iso_forest,  "exported_models/isolation_forest.pkl")
joblib.dump(scaler,      "exported_models/scaler.pkl")
joblib.dump(le,          "exported_models/label_encoder.pkl")
torch.save(autoencoder.state_dict(), "exported_models/autoencoder.pt")
xgb_model.save_model("exported_models/xgboost_model.json")

meta = {
    "trained_at"       : datetime.now(timezone.utc).isoformat(),
    "dataset"          : "Elliptic Bitcoin Dataset (kaggle: ellipticco/elliptic-data-set)",
    "n_labeled_txs"    : int(len(df_lab)),
    "n_features"       : len(FEATURE_COLS),
    "feature_cols"     : FEATURE_COLS,
    "classes"          : ["licit", "illicit"],
    "xgb_roc_auc"      : round(roc_auc, 4),
    "ensemble_weights" : {"isolation_forest": 0.20, "autoencoder": 0.20,
                          "node2vec_dbscan": 0.25,  "xgboost": 0.35},
}
with open("exported_models/metadata.json", "w") as f:
    json.dump(meta, f, indent=2)

zip_filename = "neuralchain_models.zip"
with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, _, files in os.walk("exported_models"):
        for file in files:
            zipf.write(os.path.join(root, file), arcname=file)
    zipf.write("shap_summary.png")
    zipf.write("confusion_matrix.png")

print(f"\n🎉 DONE!  Trained on REAL Elliptic data.")
print(f"   Labeled transactions : {len(df_lab):,}")
print(f"   XGBoost ROC-AUC     : {roc_auc:.4f}")
print(f"   Archive              : {zip_filename}")

try:
    from google.colab import files
    files.download(zip_filename)
    print("⬇️  Download started.")
except Exception:
    print(f"📦 Saved at: {os.path.abspath(zip_filename)}")
