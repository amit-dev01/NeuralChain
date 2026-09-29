# NeuralChain 🧠⛓️
### AI-Powered Monitoring & Analysis of Bitcoin Transaction Traffic
> **SIH 2026 | PS: SIH26146 | Organisation: NTRO | Theme: Blockchain & Cybersecurity**

---

## Overview
NeuralChain is a complete **offline** system that ingests bulk Bitcoin transaction/network metadata, correlates network-layer (IP/port/timing) observations with blockchain-layer (wallet/TXID/amount) data, and applies AI/ML to detect anomalies, cluster entities, and generate prioritized, explainable investigative leads.

## Tech Stack
- **Backend**: FastAPI + Celery + PostgreSQL + Neo4j + Redis
- **ML**: scikit-learn, XGBoost, PyTorch, PyTorch Geometric, SHAP
- **Frontend**: React 18 + Vite
- **Deployment**: Docker Compose (fully offline, Linux)

## Quick Start
```bash
cp .env.example .env
make up
```

## Project Structure
```
NeuralChain/
├── backend/         # FastAPI app + ML pipeline
├── frontend/        # React dashboard
├── data/            # Raw input files + GeoIP DB
├── ml_notebooks/    # Jupyter notebooks for model development
├── synthetic_data_gen/  # Synthetic dataset generator
├── docs/            # Technical writeup
└── docker-compose.yml
```

## Modules
1. **Ingest** — CSV/JSON/XML parsing, GeoIP enrichment, async Celery tasks
2. **Graph** — Neo4j entity/transaction graph (Wallet ↔ IP ↔ TXID)
3. **ML Engine** — Isolation Forest, Node2Vec+DBSCAN, LSTM, XGBoost
4. **Alerts** — SHAP-powered explainable ranked alert list
5. **Dashboard** — react-force-graph link analysis + GeoIP heatmap

## License
MIT
