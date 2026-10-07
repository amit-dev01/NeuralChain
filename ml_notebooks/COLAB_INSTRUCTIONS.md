# 🚀 Running NeuralChain ML Training in Google Colab (Elliptic Dataset)

The training script uses the **real Elliptic Bitcoin Dataset** from Kaggle —
203,769 labeled Bitcoin transactions, 166 features, annotated as `illicit` / `licit`.

---

## Step 0 — Get your Kaggle API Token (one-time setup)
1. Go to [kaggle.com/settings](https://www.kaggle.com/settings)
2. Scroll to the **API** section → click **"Create New Token"**
3. `kaggle.json` will be downloaded — open it to get your **username** and **key**

---

## Step 1 — Open Colab & Configure Runtime
1. Go to [colab.research.google.com](https://colab.research.google.com/#create=true)
2. **Runtime → Change runtime type → T4 GPU** (recommended, free)

---

## Step 2 — Fill in your credentials
Open [`train_colab.py`](./train_colab.py), find these two lines near the top:
```python
KAGGLE_USERNAME = "YOUR_KAGGLE_USERNAME"
KAGGLE_KEY      = "YOUR_KAGGLE_API_KEY"
```
Replace with your values from `kaggle.json`.

---

## Step 3 — Run the script
1. Copy **all** contents of [`train_colab.py`](./train_colab.py)
2. Paste into the first Colab code cell
3. Press **Shift + Enter** (or **Runtime → Run all**)

The script will:
- Auto-install all dependencies (`kaggle`, `xgboost`, `torch`, `shap`, `imbalanced-learn`)
- Download the Elliptic dataset directly from Kaggle (~40 MB)
- Train **4 models** on real Bitcoin transaction data:
  - `Isolation Forest` — unsupervised anomaly detector (fit on licit baseline)
  - `PyTorch Autoencoder` (164 → 16 → 164) — reconstruction-error scoring
  - `XGBoost` binary classifier — illicit vs licit (SMOTE-balanced, ROC-AUC ~0.97)
  - Saves `scaler.pkl` + `label_encoder.pkl` for inference
- Generate `shap_summary.png` + `confusion_matrix.png`
- Auto-download `neuralchain_models.zip` (~5–10 min on GPU, ~20 min on CPU)

---

## Step 4 — Deploy to NeuralChain backend
Extract `neuralchain_models.zip` into:
```
NeuralChain/backend/models/
```
The backend will immediately pick up the production weights.

---

## About the Elliptic Dataset
| Stat | Value |
|---|---|
| Source | [kaggle.com/ellipticco/elliptic-data-set](https://www.kaggle.com/datasets/ellipticco/elliptic-data-set) |
| Transactions | 203,769 |
| Labeled | 46,564 (illicit + licit) |
| Features | 164 (94 local + 70 aggregated graph features) |
| Time steps | 49 (real blockchain time) |
| Illicit rate | ~21% of labeled rows |
