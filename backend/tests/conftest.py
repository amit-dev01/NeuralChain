import uuid
from datetime import datetime, timedelta, timezone
from typing import List
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.postgres import Alert, Base, Dataset, get_db
from app.ingest.models import ScriptType, TransactionRecord
from app.main import app


from sqlalchemy.pool import StaticPool


@pytest.fixture(scope="session")
def engine():
    """Create an in-memory SQLite engine with all platform database tables."""
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)



@pytest.fixture
def db(engine):
    """
    Provide an isolated test database session.
    Rolls back changes and empties tables after each test.
    """
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=engine
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        # Clean all table data
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()
        session.close()


@pytest.fixture(autouse=True)
def mock_startup_checks(monkeypatch):
    """Mock startup dependency health checks to prevent real network timeouts."""
    monkeypatch.setattr("app.main.check_postgres", lambda: "ok")
    monkeypatch.setattr("app.main.check_redis", lambda: "ok")
    monkeypatch.setattr("app.main.check_neo4j", lambda: "ok")
    monkeypatch.setattr("app.main.check_celery", lambda timeout=2.0: "ok")


@pytest.fixture
def client(db):
    """Provide a FastAPI TestClient with the database dependency overridden."""
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()



@pytest.fixture
def mock_redis(monkeypatch):
    """Mock Redis client using fakeredis or in-memory dictionary proxy."""
    try:
        import fakeredis

        fake_r = fakeredis.FakeRedis(decode_responses=True)
    except ImportError:

        class FakeRedis:
            def __init__(self):
                self.store = {}

            def get(self, k):
                return self.store.get(k)

            def set(self, k, v, *args, **kwargs):
                self.store[k] = v
                return True

            def setex(self, k, t, v):
                self.store[k] = v
                return True

            def ping(self):
                return True

            def close(self):
                pass

        fake_r = FakeRedis()

    monkeypatch.setattr("app.db.redis_client.get_redis", lambda: fake_r)
    monkeypatch.setattr("app.db.redis_client.redis_client", fake_r)
    monkeypatch.setattr("app.api.stats_router.redis_client", fake_r)
    return fake_r


@pytest.fixture
def mock_neo4j(monkeypatch):
    """Mock Neo4j session and query execution with MagicMock."""
    import sys
    import app.db.neo4j_client as nc
    import app.graph.router as gr_module

    # If app.graph.router is shadowed by the router attribute, grab the actual module from sys.modules
    mod = sys.modules.get("app.graph.router", gr_module)
    if not hasattr(mod, "__file__"):
        import importlib
        mod = importlib.import_module("app.graph.router")

    mock_session = MagicMock()
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = mock_session
    mock_ctx.__exit__.return_value = None

    monkeypatch.setattr(nc, "get_neo4j_session", lambda *a, **k: mock_ctx)
    monkeypatch.setattr(mod, "get_neo4j_session", lambda *a, **k: mock_ctx)
    monkeypatch.setattr(nc, "run_query", lambda *a, **k: [])
    return mock_session


@pytest.fixture
def sample_transactions() -> List[TransactionRecord]:
    """
    Generate 10 realistic TransactionRecord objects matching forensic topologies:
      - 2 normal (low amounts, small fan-out)
      - 2 with round amounts (ransomware payment patterns)
      - 2 with high fan-out (>20 outputs) (mixing / tumbling patterns)
      - 2 forming a peel chain (fan_in=1, fan_out=1)
      - 2 with same src_ip, different wallets (rapid address reuse)
    """
    now = datetime.now(timezone.utc) - timedelta(hours=2)

    records: List[TransactionRecord] = [
        # 1-2: Normal low-volume transactions
        TransactionRecord(
            txid="a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f01",
            timestamp=now - timedelta(minutes=50),
            src_ip="198.51.100.10",
            dst_ip="198.51.100.11",
            input_addresses=["1NormalWalletA11111111111111111111"],
            output_addresses=["1NormalWalletB22222222222222222222"],
            input_amounts=[0.055],
            output_amounts=[0.054],
            fee=0.001,
            script_type=ScriptType.P2PKH,
            geo_country="US",
            asn="AS15169",
            city="Mountain View",
            lat=37.4056,
            lon=-122.0775,
        ),
        TransactionRecord(
            txid="a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f02",
            timestamp=now - timedelta(minutes=45),
            src_ip="198.51.100.12",
            dst_ip="198.51.100.13",
            input_addresses=["1NormalWalletC33333333333333333333"],
            output_addresses=["1NormalWalletD44444444444444444444"],
            input_amounts=[0.12],
            output_amounts=[0.119],
            fee=0.001,
            script_type=ScriptType.P2WPKH,
            geo_country="DE",
            asn="AS3320",
            city="Frankfurt",
            lat=50.1109,
            lon=8.6821,
        ),
        # 3-4: Round amounts (ransomware patterns)
        TransactionRecord(
            txid="b1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f03",
            timestamp=now - timedelta(minutes=40),
            src_ip="203.0.113.20",
            dst_ip="203.0.113.21",
            input_addresses=["1VictimWallet111111111111111111111"],
            output_addresses=["1RansomWallet22222222222222222222"],
            input_amounts=[5.0005],
            output_amounts=[5.0000],
            fee=0.0005,
            script_type=ScriptType.P2PKH,
            geo_country="RU",
            asn="AS8359",
            city="Moscow",
            lat=55.7558,
            lon=37.6173,
        ),
        TransactionRecord(
            txid="b1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f04",
            timestamp=now - timedelta(minutes=35),
            src_ip="203.0.113.22",
            dst_ip="203.0.113.23",
            input_addresses=["1VictimWallet333333333333333333333"],
            output_addresses=["1RansomWallet44444444444444444444"],
            input_amounts=[10.001],
            output_amounts=[10.000],
            fee=0.001,
            script_type=ScriptType.P2SH,
            geo_country="RU",
            asn="AS8359",
            city="Moscow",
            lat=55.7558,
            lon=37.6173,
        ),
        # 5-6: High fan-out (> 20 outputs, mixing / distribution)
        TransactionRecord(
            txid="c1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f05",
            timestamp=now - timedelta(minutes=30),
            src_ip="192.0.2.50",
            dst_ip="192.0.2.51",
            input_addresses=["1MixerSourceWallet1111111111111111"],
            output_addresses=[f"1FanOutDest{i:03d}11111111111111111" for i in range(25)],
            input_amounts=[25.5],
            output_amounts=[1.0] * 25,
            fee=0.5,
            script_type=ScriptType.P2WPKH,
            geo_country="NL",
            asn="AS1103",
            city="Amsterdam",
            lat=52.3676,
            lon=4.9041,
        ),
        TransactionRecord(
            txid="c1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f06",
            timestamp=now - timedelta(minutes=25),
            src_ip="192.0.2.52",
            dst_ip="192.0.2.53",
            input_addresses=["1MixerSourceWallet2222222222222222"],
            output_addresses=[f"1FanOutDest{i:03d}22222222222222222" for i in range(22)],
            input_amounts=[11.2],
            output_amounts=[0.5] * 22,
            fee=0.2,
            script_type=ScriptType.P2WPKH,
            geo_country="NL",
            asn="AS1103",
            city="Amsterdam",
            lat=52.3676,
            lon=4.9041,
        ),
        # 7-8: Peel chain sequence (fan_in=1, fan_out=1)
        TransactionRecord(
            txid="d1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f07",
            timestamp=now - timedelta(minutes=20),
            src_ip="198.51.100.88",
            dst_ip="198.51.100.89",
            input_addresses=["1PeelHopOneInput111111111111111111"],
            output_addresses=["1PeelHopOneOutput22222222222222222"],
            input_amounts=[15.0],
            output_amounts=[14.8],
            fee=0.2,
            script_type=ScriptType.P2PKH,
            geo_country="SG",
            asn="AS4657",
            city="Singapore",
            lat=1.3521,
            lon=103.8198,
        ),
        TransactionRecord(
            txid="d1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f08",
            timestamp=now - timedelta(minutes=15),
            src_ip="198.51.100.88",
            dst_ip="198.51.100.90",
            input_addresses=["1PeelHopOneOutput22222222222222222"],
            output_addresses=["1PeelHopTwoOutput33333333333333333"],
            input_amounts=[14.8],
            output_amounts=[14.6],
            fee=0.2,
            script_type=ScriptType.P2PKH,
            geo_country="SG",
            asn="AS4657",
            city="Singapore",
            lat=1.3521,
            lon=103.8198,
        ),
        # 9-10: Rapid reuse: same src_ip, different wallet addresses
        TransactionRecord(
            txid="e1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f09",
            timestamp=now - timedelta(minutes=5),
            src_ip="185.220.101.5",
            dst_ip="185.220.101.6",
            input_addresses=["1RapidWalletAlpha11111111111111111"],
            output_addresses=["1TargetExchangeA11111111111111111"],
            input_amounts=[2.4],
            output_amounts=[2.399],
            fee=0.001,
            script_type=ScriptType.P2WPKH,
            geo_country="CH",
            asn="AS13030",
            city="Zurich",
            lat=47.3769,
            lon=8.5417,
        ),
        TransactionRecord(
            txid="e1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f10",
            timestamp=now - timedelta(minutes=4),
            src_ip="185.220.101.5",
            dst_ip="185.220.101.7",
            input_addresses=["1RapidWalletBeta222222222222222222"],
            output_addresses=["1TargetExchangeB22222222222222222"],
            input_amounts=[3.1],
            output_amounts=[3.099],
            fee=0.001,
            script_type=ScriptType.P2WPKH,
            geo_country="CH",
            asn="AS13030",
            city="Zurich",
            lat=47.3769,
            lon=8.5417,
        ),
    ]
    return records


@pytest.fixture
def sample_alerts(db) -> List[Alert]:
    """
    Seed 5 diverse Alert ORM objects into the testing database:
      - 1 critical (risk 0.95, status=new, model=xgboost)
      - 1 high (risk 0.75, status=under_review, model=isolation_forest)
      - 1 medium (risk 0.60, status=new, model=autoencoder)
      - 1 low (risk 0.30, status=dismissed, model=node2vec_dbscan)
      - 1 confirmed (risk 0.88, status=confirmed, model=xgboost)
    """
    alerts = [
        Alert(
            id=uuid.uuid4(),
            wallet_id="1CriticalRansomWallet99999999999999",
            risk_score=0.95,
            risk_level="critical",
            model_source="xgboost",
            top_reasons=[
                "Abnormal velocity: 3.8σ above mean",
                "Round-number payment detected",
            ],
            shap_values={"fee_ratio": 0.45, "round_amount_flag": 0.35},
            evidence_txids=["tx_crit_01", "tx_crit_02"],
            status="new",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ),
        Alert(
            id=uuid.uuid4(),
            wallet_id="1HighRiskAnomalyWallet7777777777777",
            risk_score=0.75,
            risk_level="high",
            model_source="isolation_forest",
            top_reasons=[
                "Transaction fan-out of 42 outputs",
                "High-risk country origin (score 0.88)",
            ],
            shap_values={"fan_out": 0.52, "ip_country_risk_score": 0.28},
            evidence_txids=["tx_high_01"],
            status="under_review",
            created_at=datetime.utcnow() - timedelta(hours=2),
            updated_at=datetime.utcnow() - timedelta(hours=1),
        ),
        Alert(
            id=uuid.uuid4(),
            wallet_id="1MediumReconstructionWallet5555555",
            risk_score=0.60,
            risk_level="medium",
            model_source="autoencoder",
            top_reasons=["Part of a peel chain sequence"],
            shap_values={"peel_chain_member_flag": 0.38},
            evidence_txids=["tx_med_01"],
            status="new",
            created_at=datetime.utcnow() - timedelta(hours=4),
            updated_at=datetime.utcnow() - timedelta(hours=3),
        ),
        Alert(
            id=uuid.uuid4(),
            wallet_id="1LowRiskDismissedWallet33333333333",
            risk_score=0.30,
            risk_level="low",
            model_source="node2vec_dbscan",
            top_reasons=["Address reused 2 times"],
            shap_values={"address_reuse_count": 0.12},
            evidence_txids=["tx_low_01"],
            status="dismissed",
            created_at=datetime.utcnow() - timedelta(days=1),
            updated_at=datetime.utcnow(),
        ),
        Alert(
            id=uuid.uuid4(),
            wallet_id="1ConfirmedLaundererWallet888888888",
            risk_score=0.88,
            risk_level="high",
            model_source="xgboost",
            top_reasons=[
                "Fee ratio 0.15 (increases risk)",
                "Address reused 8 times",
            ],
            shap_values={"fee_ratio": 0.58, "address_reuse_count": 0.32},
            evidence_txids=["tx_conf_01", "tx_conf_02"],
            status="confirmed",
            created_at=datetime.utcnow() - timedelta(hours=6),
            updated_at=datetime.utcnow() - timedelta(minutes=30),
        ),
    ]

    for a in alerts:
        db.add(a)
    db.commit()
    return alerts


@pytest.fixture
def sample_dataset(db) -> Dataset:
    """Create and commit a Dataset record with status complete."""
    ds = Dataset(
        id=uuid.uuid4(),
        label="bitcoin_mempool_dump_2026",
        source_type="raw_mempool",
        file_type="csv",
        row_count=1000,
        valid_rows=980,
        duplicate_count=20,
        status="complete",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)
    return ds
