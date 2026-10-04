# NeuralChain (SIH26146) — AI-Powered Bitcoin Transaction Monitoring
## Comprehensive Technical Architecture & Engineering Documentation

---

## 1. Executive Summary

### 1.1 Problem Statement
Cryptocurrency ecosystems, particularly Bitcoin (BTC), present severe forensic challenges to law enforcement, financial intelligence units (FIUs), and compliance officers due to their pseudonymous nature, non-custodial structure, and rapid technological obfuscation. Illicit actors systematically exploit:
- **Peel Chains**: Chained single-output transactions dispersing small change increments over hundreds of hops.
- **Mixers and Tumblers**: High fan-out architectures (e.g., CoinJoin, Wasabi, ChipMixer) shuffling unspent transaction outputs (UTXOs) across arbitrary destinations.
- **Rapid Address Reuse**: Automated bots cycling addresses over ephemeral public IP subnets or Tor nodes in sub-5-minute windows.
- **Ransomware & Darknet Markets**: Clustered multi-input transaction groups demanding exact round BTC quantities or operating shared deposit pools.

### 1.2 The NeuralChain Mission
**NeuralChain (SIH26146)** is a production-grade, offline-capable forensic intelligence and monitoring platform designed for real-time unmasking, behavioral classification, graph topology analysis, and explainable risk scoring of Bitcoin transactions.

The platform provides:
1. **Multi-Format Ingestion Engine**: Automated parsing, schema validation, deduplication, and offline MaxMind GeoIP/ASN enrichment.
2. **Property Graph Analytics**: Neo4j graph correlation with specialized Cypher traversal heuristics (ego-graphs, peel chains, shortest forensic paths, common-input clustering).
3. **Four-Tier AI/ML Ensemble**:
   - Tabular + Sequential Anomaly Detection (Isolation Forest + Deep PyTorch Autoencoder).
   - Graph Entity Resolution & Sybil Clustering (PyTorch Geometric Node2Vec + DBSCAN).
   - Laundering Sequence Classification (Temporal Bidirectional PyTorch LSTM).
   - Malicious Signature Classifier (XGBoost + SHAP feature attribution).
4. **Explainable Risk Scoring**: Dynamic weight normalization generating human-readable narrative intelligence reports.
5. **Interactive Operations Center**: Force-directed 2D graph visualizations, geographic heatmaps, timeline velocity monitors, and automated PDF/CSV/JSON report generation.

---

## 2. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                NEURALCHAIN PLATFORM                                    │
│                                                                                        │
│   ┌─────────────────────┐       ┌──────────────────────┐      ┌────────────────────┐   │
│   │  DATA INGESTION     │       │  CORRELATION & GRAPH │      │  AI/ML DETECTION   │   │
│   │  (CSV, JSON, XML)   │──────▶│  (Neo4j 5.x)         │─────▶│  ENSEMBLE (4x ML)  │   │
│   └─────────────────────┘       └──────────────────────┘      └────────────────────┘   │
│              │                             │                            │              │
│              ▼                             ▼                            ▼              │
│   ┌─────────────────────┐       ┌──────────────────────┐      ┌────────────────────┐   │
│   │ Schema Validator,   │       │ Cypher Heuristics:   │      │ - Isolation Forest │   │
│   │ Deduplicator &      │       │ - Ego-Network        │      │ - Autoencoder      │   │
│   │ GeoIP2 .mmdb Parser │       │ - Peel-Chains        │      │ - Node2Vec+DBSCAN  │   │
│   └─────────────────────┘       │ - Common Inputs      │      │ - LSTM Tumbler     │   │
│              │                  │ - Shortest Paths     │      │ - XGBoost + SHAP   │   │
│              ▼                  └──────────────────────┘      └────────────────────┘   │
│   ┌─────────────────────┐                  │                            │              │
│   │ PostgreSQL 15 &     │                  │                            ▼              │
│   │ Redis 7 Hot Cache   │                  │                  ┌────────────────────┐   │
│   └─────────────────────┘                  │                  │ Normalized Risk    │   │
│              │                             │                  │ Scorer & Natural   │   │
│              │                             │                  │ Language Explainer │   │
│              │                             │                  └────────────────────┘   │
│              ▼                             ▼                            │              │
│   ┌─────────────────────────────────────────────────────────────────────▼──────────┐   │
│   │                 FASTAPI ASYNCHRONOUS BACKEND & CELERY WORKERS                 │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
│                                            │                                           │
│                                            ▼                                           │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                 REACT 18 + VITE FORENSIC DASHBOARD                             │   │
│   │  • Force-Directed Graph   • Leaflet GeoMap   • Timeline   • Report Generator   │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Ingestion & Preprocessing Pipeline

### 3.1 Supported Formats & Parsing
The ingestion layer (`app/ingest/`) handles bulk ingestion across three standardized protocols:
1. **CSV Ingestion**: Handles raw transaction tables with variable string representations of multi-input and multi-output arrays.
2. **JSON Ingestion**: Standard JSON arrays of transaction objects.
3. **XML Ingestion**: Hierarchical XML structures parsed via streaming XML processors to prevent memory exhaustion on large datasets.

### 3.2 Schema Validation
Using Pydantic v2 validation models (`app/ingest/models.py`), incoming transactions are strictly validated against Bitcoin protocol constraints:
- `txid`: Cryptographic hex string (minimum 8 characters, maximum 128 characters).
- `timestamp`: ISO-8601 or UNIX epoch timestamp format.
- `fee`: Floating-point non-negative value ($fee \ge 0.0$).
- `input_amounts` & `output_amounts`: Positive numerical arrays adhering to Satoshi conservation ($total\_in \ge total\_out + fee$).
- `script_type`: Enumerated Bitcoin script formats (`P2PKH`, `P2SH`, `P2WPKH`, `P2WSH`, `UNKNOWN`).

### 3.3 Cryptographic Deduplication
Transactions are deduplicated by their unique cryptographic `txid` using in-memory set indexing and database unique constraints. Duplicate transaction hashes are aggregated and tracked without corrupting downstream graph structures.

### 3.4 Offline GeoIP & ASN Enrichment
To maintain air-gapped forensic capability without transmitting external queries, the platform integrates **MaxMind GeoLite2-City (`.mmdb`)**:
- Resolves `src_ip` and `dst_ip` to ISO country codes, latitude, longitude, and Autonomous System Numbers (ASN).
- Detects VPN/Tor/Hosting infrastructure through ASN organizational profiling (e.g., Hetzner, OVH, DigitalOcean, Tor Project exit nodes).
- Safely handles RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) without throwing exceptions.

---

## 4. Property Graph Analytics (Neo4j)

### 4.1 Graph Ontology
The graph database schema models Bitcoin's UTXO network as a typed, directed multigraph:

| Entity Type | Label | Properties |
|---|---|---|
| **Node** | `Wallet` | `address`, `risk_score`, `cluster_id`, `first_seen`, `last_seen` |
| **Node** | `Transaction`| `txid`, `timestamp`, `fee`, `total_amount`, `script_type` |
| **Node** | `IP` | `ip_address`, `country`, `asn` |
| **Node** | `Country` | `code`, `name`, `risk_level` |
| **Node** | `ASN` | `asn_number`, `organization` |
| **Relationship** | `SENT` | `amount`, `output_index` |
| **Relationship** | `RECEIVED` | `amount`, `input_index` |
| **Relationship** | `CONNECTED_FROM` | `port`, `timestamp` |
| **Relationship** | `BELONGS_TO` | `confidence` |

### 4.2 Forensic Cypher Heuristics

#### 1. Common-Input-Ownership Clustering
```cypher
MATCH (w1:Wallet)-[:SENT]->(t:Transaction)<-[:SENT]-(w2:Wallet)
WHERE w1 <> w2
RETURN w1.address AS wallet_a, w2.address AS wallet_b, count(t) AS shared_inputs
ORDER BY shared_inputs DESC
```
*Forensic Rationale*: When multiple private keys sign inputs in the same transaction, those wallets are controlled by the same entity with $\ge 98\%$ heuristic certainty.

#### 2. Peel Chain Detection
```cypher
MATCH path = (w1:Wallet)-[:SENT]->(t1:Transaction)-[:RECEIVED]->(w2:Wallet)-[:SENT]->(t2:Transaction)-[:RECEIVED]->(w3:Wallet)
WHERE size((t1)-[:RECEIVED]->()) = 2 AND size((t2)-[:RECEIVED]->()) = 2
RETURN path LIMIT 50
```
*Forensic Rationale*: Detects peel chains where a large balance is incrementally stripped over successive hops, peeling off small change while forwarding the bulk balance.

#### 3. Shortest Forensic Path
```cypher
MATCH (src:Wallet {address: $from_wallet}), (dst:Wallet {address: $to_wallet})
MATCH path = shortestPath((src)-[:SENT|RECEIVED*..8]-(dst))
RETURN path
```
*Forensic Rationale*: Rapidly establishes the shortest laundering trail between a victim's wallet and an illicit cash-out entity.

---

## 5. Four-Tier AI/ML Detection Engine

NeuralChain avoids single-model vulnerability by combining 4 complementary machine learning architectures:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AI/ML DETECTION ENSEMBLE                              │
│                                                                             │
│  ┌───────────────────────┐                    ┌──────────────────────────┐  │
│  │ MODEL 1: ANOMALY      │                    │ MODEL 2: GRAPH ENTITY    │  │
│  │ Isolation Forest (IF) │                    │ Node2Vec Embeddings      │  │
│  │ + Deep Autoencoder(AE)│                    │ + DBSCAN Clustering      │  │
│  │ Contamination: 5%     │                    │ Entity Resolution        │  │
│  └───────────────────────┘                    └──────────────────────────┘  │
│             │                                               │               │
│             ▼                                               ▼               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    DYNAMIC NORMALIZED RISK SCORER                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│             ▲                                               ▲               │
│             │                                               │               │
│  ┌───────────────────────┐                    ┌──────────────────────────┐  │
│  │ MODEL 3: SEQUENCE     │                    │ MODEL 4: CLASSIFIER      │  │
│  │ Bidirectional PyTorch │                    │ XGBoost Behavioral Trees │  │
│  │ LSTM Mixing Tumbler   │                    │ + SHAP Explainer         │  │
│  └───────────────────────┘                    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Model 1: Tabular & Latent Anomaly Detection
Combines an unsupervised tree isolation algorithm with a deep non-linear neural autoencoder:
- **Isolation Forest**: Subsamples transactions and measures average path depth across 200 isolation trees. Anomaly score:
  $$s_{\text{IF}}(x) = 2^{-\frac{E(h(x))}{c(n)}}$$
- **PyTorch Deep Autoencoder**:
  - Encoder: 7-feature input $\rightarrow 32 \rightarrow 16 \rightarrow$ 8-dimensional bottleneck latent space.
  - Decoder: 8 $\rightarrow 16 \rightarrow 32 \rightarrow 7$ reconstruction.
  - Loss function: Mean Squared Error (MSE).
  - Anomaly score: Normalized reconstruction error $\|x - \hat{x}\|_2^2$.
- **Ensemble Blend**:
  $$S_{\text{anomaly}} = 0.60 \cdot s_{\text{IF}} + 0.40 \cdot s_{\text{AE}}$$

### 5.2 Model 2: Graph Entity Resolution (Node2Vec + DBSCAN)
- **PyTorch Geometric Node2Vec**: Performs second-order biased random walks balancing breadth-first search (microscopic neighborhood) and depth-first search (macroscopic structural role):
  $$\pi_{vx} = \alpha_{pq}(t, x) \cdot w_{vx}$$
- Embeds wallets into a continuous 32-dimensional topological vector space.
- **DBSCAN Clustering**: Identifies dense clusters of cooperating wallets without requiring a predetermined cluster count ($k$). Automatically isolates outlier and bridge wallets.

### 5.3 Model 3: Temporal Tumbler Detector (Bidirectional LSTM)
- Models transactions as sequential time series over rolling wallet windows.
- Architecture: 2-layer Bidirectional LSTM (hidden dimension 64, dropout 0.2) + Dense Sigmoid classifier.
- Detects time-delay hopping, cyclic tumbling, and split-merge mixing patterns invariant to permutation.

### 5.4 Model 4: Ransomware & Darknet Classifier (XGBoost + SHAP)
- **Extreme Gradient Boosting (XGBoost)** trained on engineered forensic features:
  - `fee_ratio`: Fee divided by transaction volume.
  - `fan_out_degree`: Number of recipient outputs.
  - `round_amount_flag`: Exact round amounts (0.1, 0.5, 1.0, 5.0, 10.0 BTC).
  - `velocity_zscore`: Velocity deviation from historical baseline.
  - `address_reuse_count`: Rapid repetition frequency.
- Generates probability distribution $P(\text{illicit} \mid x) \in [0.0, 1.0]$.
- **SHAP (SHapley Additive exPlanations)** computes local additive feature attributions:
  $$g(z') = \phi_0 + \sum_{j=1}^M \phi_j z_j'$$

---

## 6. Risk Scoring & Forensic Explainability

### 6.1 Multi-Model Weight Normalization
When only a subset of models produce scores for a transaction, weights are dynamically normalized to maintain a fair $[0.0, 1.0]$ risk score range:

$$R = \frac{\sum_{m \in M_{\text{active}}} w_m \cdot s_m}{\sum_{m \in M_{\text{active}}} w_m}$$

*Default Model Weight Configuration*:
- XGBoost Classifier: $w = 0.35$
- Isolation Forest: $w = 0.20$
- Deep Autoencoder: $w = 0.20$
- LSTM Sequence Tumbler: $w = 0.15$
- Graph Node2Vec: $w = 0.10$

### 6.2 Risk Categorization Bands
- **Critical Risk** ($R \ge 0.90$): Immediate freeze / automated law enforcement alert.
- **High Risk** ($0.70 \le R < 0.90$): Priority manual investigator review.
- **Medium Risk** ($0.50 \le R < 0.70$): Automated watchlist tracking.
- **Low Risk** ($R < 0.50$): Normal commercial / retail transaction behavior.

### 6.3 Explainability Engine
Rather than presenting raw numerical SHAP values, the explainability module (`app/alerts/explainer.py`) translates statistical attributions into investigative narrative paragraphs:

```
"Entity flagged with Critical Risk (Score: 0.961) by XGBoost Classifier. 
Primary contributing factors:
1. Abnormally high fee ratio (4.5x network baseline), indicative of urgent laundering transit.
2. Exact round transaction value (5.000 BTC), highly characteristic of ransomware extortion demands.
3. Rapid hop velocity within 120 seconds of initial UTXO creation across RU ASN 13335."
```

---

## 7. Reporting & Forensic Export Module

The reporting engine (`app/reports/generator.py`) generates court-ready forensic intelligence documents:
- **PDF Export**: Built with ReportLab and FPDF2; includes executive summaries, KPI dashboards, color-coded alert tables, SHAP feature importance charts, and evidentiary TXID lists.
- **CSV Export**: Tabular extracts formatted for ingestion into external forensic suites (e.g., Chainalysis, Elliptic, Maltego).
- **JSON Export**: Structured machine-readable schema for SIEM/SOAR ingestion (Splunk, Elastic, Cortex XSOAR).

---

## 8. Frontend Operations Dashboard

Built on **React 18 + Vite** with a sleek dark-mode glassmorphic interface:
- **Overview Page**: System health, 24-hour transaction volume, live active alerts, and model status indicators.
- **Graph Explorer**: Real-time 2D force-directed interactive graph with node drag-and-drop, risk-based node sizing, and relationship inspection.
- **Alerts Center**: Searchable, paginated alert table with status triage (`new`, `under_review`, `confirmed`, `dismissed`).
- **GeoMap**: Leaflet-based world map showing geographic origin and destination IP clusters.
- **Timeline View**: Temporal distribution of transaction flow and volume spikes.
- **Ingestion Center**: Drag-and-drop file upload with real-time Celery task progress tracking.
- **Reports Center**: Custom report configuration and one-click PDF generation.

---

## 9. Comprehensive Testing & Quality Assurance

The test suite in [`backend/tests/`](file:///c:/Users/AMIT/Desktop/script/NeuralChain/backend/tests/) provides complete automated test coverage:

| Test Module | Tests | Status |
|---|:---:|:---:|
| `test_alerts.py` | 8 | PASSED |
| `test_graph.py` | 5 | PASSED |
| `test_health.py` | 3 | PASSED |
| `test_ingest.py` | 9 | PASSED (1 skipped for optional local file) |
| `test_ml.py` | 5 | PASSED |
| **Total** | **30** | **29 Passed, 1 Skipped (1.35s)** |

---

## 10. Deployment & Infrastructure

### 10.1 Multi-Service Docker Compose
The system is fully containerized in [`docker-compose.yml`](file:///c:/Users/AMIT/Desktop/script/NeuralChain/docker-compose.yml):
```bash
docker-compose up -d
```
Services orchestrated:
1. `postgres`: Relational data store.
2. `redis`: Message broker and cache.
3. `neo4j`: Graph database.
4. `backend`: FastAPI API server.
5. `celery_worker`: Background task worker.
6. `frontend`: React SPA served via Nginx.
7. `nginx`: Reverse proxy and SSL termination.

### 10.2 Render Cloud Deployment
Configured with [`render.yaml`](file:///c:/Users/AMIT/Desktop/script/NeuralChain/render.yaml) for automated Blueprint deployment:
- Managed PostgreSQL database.
- Managed Redis cache.
- Web Service with dynamic port allocation (`$PORT`).
- Celery Background Worker.
- Cloud Neo4j AuraDB integration.

---

## 11. Conclusion
**NeuralChain (SIH26146)** delivers an end-to-end, mathematically grounded, and forensically explainable Bitcoin transaction monitoring system. By unifying multi-format ingestion, property graph heuristics, deep representation learning, and natural language explainability, it empowers financial investigators to detect, trace, and dismantle complex cryptocurrency laundering networks efficiently.
