# 🚀 Running NeuralChain ML Training in Google Colab

You have two simple ways to train the 4-tier ML ensemble on Google Colab:

---

### Option A: Upload the Notebook (Recommended)
1. Go to [Google Colab](https://colab.research.google.com/).
2. Click **Upload** and select [`neuralchain_colab_training.ipynb`](./neuralchain_colab_training.ipynb).
3. (Optional) In Colab, go to **Runtime** → **Change runtime type** → select **T4 GPU** for faster PyTorch training.
4. Click **Runtime** → **Run all** (`Ctrl+F9`).
5. When complete, Colab will automatically download `neuralchain_models.zip` containing all trained weights:
   - `isolation_forest.pkl`
   - `autoencoder.pt`
   - `xgboost_model.json`
   - `scaler.pkl`
   - `label_encoder.pkl`
   - `metadata.json`

---

### Option B: Copy & Paste Single Code Cell
1. Open a blank [Google Colab Notebook](https://colab.research.google.com/#create=true).
2. Copy the entire contents of [`train_colab.py`](./train_colab.py).
3. Paste into the first code cell and press **Shift + Enter**.
4. The script will automatically install dependencies, generate the 5,000 transaction dataset, train all 4 models, run SHAP explainability, and prompt download of `neuralchain_models.zip`.

---

### Deploying the Trained Models to NeuralChain
Extract the downloaded `neuralchain_models.zip` into `NeuralChain/data/models/` or `NeuralChain/backend/models/`.
The backend will immediately pick up the production weights.
