import os
import uuid
from datetime import datetime
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    create_engine,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

load_dotenv()

try:
    from app.core.config import settings

    DATABASE_URL = os.getenv("DATABASE_URL") or getattr(
        settings,
        "DATABASE_URL",
        "postgresql://neuralchain:neuralchain_secret@localhost:5432/neuralchain_db",
    )
except Exception:
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://neuralchain:neuralchain_secret@localhost:5432/neuralchain_db",
    )

try:
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(DATABASE_URL)
    else:
        engine = create_engine(
            DATABASE_URL,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            echo=False,
        )
except Exception:
    engine = create_engine("sqlite:///:memory:")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator:
    """Yield a database session and ensure clean close."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_postgres_connection() -> bool:
    """Execute SELECT 1 to verify database health."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


# ==============================================================================
# SQLAlchemy ORM Models
# ==============================================================================


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    label = Column(String, nullable=False)
    source_type = Column(String, nullable=True)
    file_type = Column(String, nullable=True)  # csv / json / xml
    row_count = Column(Integer, default=0, nullable=False)
    valid_rows = Column(Integer, default=0, nullable=False)
    duplicate_count = Column(Integer, default=0, nullable=False)
    status = Column(
        String, default="pending", nullable=False
    )  # pending / processing / complete / failed
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    transactions = relationship(
        "Transaction",
        back_populates="dataset",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    alerts = relationship(
        "Alert",
        back_populates="dataset",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    model_runs = relationship("ModelRun", back_populates="dataset")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    txid = Column(String, index=True, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    src_ip = Column(String, nullable=True)
    dst_ip = Column(String, nullable=True)
    src_port = Column(Integer, nullable=True)
    dst_port = Column(Integer, nullable=True)
    input_addresses = Column(JSON, default=list, nullable=False)
    output_addresses = Column(JSON, default=list, nullable=False)
    input_amounts = Column(JSON, default=list, nullable=False)
    output_amounts = Column(JSON, default=list, nullable=False)
    fee = Column(Float, default=0.0, nullable=False)
    script_type = Column(String, nullable=True)
    geo_country = Column(String, nullable=True)
    asn = Column(String, nullable=True)
    city = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    ground_truth_label = Column(
        String, nullable=True
    )  # for synthetic data verification
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("dataset_id", "txid", name="uq_dataset_txid"),
    )

    dataset = relationship("Dataset", back_populates="transactions")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    wallet_id = Column(String, index=True, nullable=False)
    risk_score = Column(Float, index=True, nullable=False)
    risk_level = Column(
        String, nullable=False
    )  # critical / high / medium / low
    model_source = Column(
        String, nullable=False
    )  # isolation_forest / autoencoder / node2vec / xgboost / ensemble
    if_score = Column(Float, nullable=True)
    ae_score = Column(Float, nullable=True)
    mixing_score = Column(Float, nullable=True)
    xgb_score = Column(Float, nullable=True)
    top_reasons = Column(JSON, default=list, nullable=False)  # max 3
    shap_values = Column(JSON, default=dict, nullable=False)
    evidence_txids = Column(JSON, default=list, nullable=False)
    text_explanation = Column(String, nullable=True)
    status = Column(
        String, default="new", index=True, nullable=False
    )  # new / under_review / confirmed / dismissed
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    dataset = relationship("Dataset", back_populates="alerts")


class ModelRun(Base):
    __tablename__ = "model_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_name = Column(String, nullable=False)
    dataset_id = Column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    task_id = Column(String, nullable=True, index=True)
    status = Column(
        String, default="queued", nullable=False
    )  # queued / running / complete / failed
    metrics = Column(JSON, default=dict, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    dataset = relationship("Dataset", back_populates="model_runs")


class Entity(Base):
    __tablename__ = "entities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_address = Column(String, unique=True, index=True, nullable=False)
    cluster_id = Column(Integer, nullable=True)
    entity_label = Column(String, nullable=True)
    risk_score = Column(Float, default=0.0, nullable=False)
    tx_count = Column(Integer, default=0, nullable=False)
    total_sent = Column(Float, default=0.0, nullable=False)
    total_received = Column(Float, default=0.0, nullable=False)
    first_seen = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
