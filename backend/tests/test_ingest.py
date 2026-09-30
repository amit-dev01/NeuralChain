import json
import os
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.core.config import settings
from app.ingest.deduplicator import deduplicate_by_txid
from app.ingest.enricher import enrich_with_geoip
from app.ingest.models import ScriptType, TimestampFormat, TransactionRecord
from app.ingest.parser import parse_csv
from app.ingest.validator import validate_schema


def sample_5_records_with_2_duplicates() -> list[TransactionRecord]:
    """Helper creating 5 TransactionRecord objects where 2 have duplicate txids."""
    now = datetime.now(timezone.utc)
    return [
        TransactionRecord(
            txid="txid_unique_001_aaaaaaaaaaaaaaaaa",
            timestamp=now,
            fee=0.001,
            input_addresses=["1AddrA11111111111111111111111111"],
            output_addresses=["1AddrB11111111111111111111111111"],
        ),
        TransactionRecord(
            txid="txid_unique_002_bbbbbbbbbbbbbbbbb",
            timestamp=now,
            fee=0.002,
            input_addresses=["1AddrC11111111111111111111111111"],
            output_addresses=["1AddrD11111111111111111111111111"],
        ),
        TransactionRecord(
            txid="txid_unique_003_ccccccccccccccccc",
            timestamp=now,
            fee=0.003,
            input_addresses=["1AddrE11111111111111111111111111"],
            output_addresses=["1AddrF11111111111111111111111111"],
        ),
        # Duplicates of 001 and 002
        TransactionRecord(
            txid="txid_unique_001_aaaaaaaaaaaaaaaaa",
            timestamp=now,
            fee=0.001,
            input_addresses=["1AddrA11111111111111111111111111"],
            output_addresses=["1AddrB11111111111111111111111111"],
        ),
        TransactionRecord(
            txid="txid_unique_002_bbbbbbbbbbbbbbbbb",
            timestamp=now,
            fee=0.002,
            input_addresses=["1AddrC11111111111111111111111111"],
            output_addresses=["1AddrD11111111111111111111111111"],
        ),
    ]


def test_upload_csv_valid(client, tmp_path):
    """Test valid CSV file upload returns 202 with task_id and dataset_id."""
    csv_file = tmp_path / "valid_txs.csv"
    csv_content = (
        "txid,timestamp,input_addresses,output_addresses,input_amounts,output_amounts,fee\n"
        "tx000000000000000000000000000001,2026-01-01T12:00:00Z,1AddrA,1AddrB,1.0,0.999,0.001\n"
        "tx000000000000000000000000000002,2026-01-01T12:01:00Z,1AddrC,1AddrD,2.0,1.999,0.001\n"
        "tx000000000000000000000000000003,2026-01-01T12:02:00Z,1AddrE,1AddrF,3.0,2.999,0.001\n"
        "tx000000000000000000000000000004,2026-01-01T12:03:00Z,1AddrG,1AddrH,4.0,3.999,0.001\n"
        "tx000000000000000000000000000005,2026-01-01T12:04:00Z,1AddrI,1AddrJ,5.0,4.999,0.001\n"
    )
    csv_file.write_text(csv_content, encoding="utf-8")

    with open(csv_file, "rb") as f:
        response = client.post(
            "/api/v1/ingest/upload",
            files={"file": ("valid_txs.csv", f, "text/csv")},
            data={"label": "test_csv_dataset"},
        )

    assert response.status_code == 202
    body = response.json()
    assert "task_id" in body
    assert "dataset_id" in body
    assert isinstance(body["task_id"], str) and len(body["task_id"]) > 0


def test_upload_json_valid(client, tmp_path):
    """Test valid JSON file upload returns 202."""
    json_file = tmp_path / "valid_txs.json"
    txs = [
        {
            "txid": f"tx_json_{i:028d}",
            "timestamp": "2026-01-01T12:00:00Z",
            "fee": 0.001,
            "input_addresses": [f"1InAddr{i}"],
            "output_addresses": [f"1OutAddr{i}"],
        }
        for i in range(5)
    ]
    json_file.write_text(json.dumps(txs), encoding="utf-8")

    with open(json_file, "rb") as f:
        response = client.post(
            "/api/v1/ingest/upload",
            files={"file": ("valid_txs.json", f, "application/json")},
            data={"label": "test_json_dataset"},
        )

    assert response.status_code == 202
    body = response.json()
    assert "task_id" in body
    assert "dataset_id" in body


def test_upload_xml_valid(client, tmp_path):
    """Test valid XML file upload returns 202."""
    xml_file = tmp_path / "valid_txs.xml"
    xml_content = """<?xml version="1.0" encoding="UTF-8"?>
<transactions>
  <transaction>
    <txid>tx_xml_0000000000000000000000000001</txid>
    <timestamp>2026-01-01T12:00:00Z</timestamp>
    <fee>0.001</fee>
    <input_addresses><address>1XmlIn1</address></input_addresses>
    <output_addresses><address>1XmlOut1</address></output_addresses>
  </transaction>
  <transaction>
    <txid>tx_xml_0000000000000000000000000002</txid>
    <timestamp>2026-01-01T12:01:00Z</timestamp>
    <fee>0.001</fee>
    <input_addresses><address>1XmlIn2</address></input_addresses>
    <output_addresses><address>1XmlOut2</address></output_addresses>
  </transaction>
  <transaction>
    <txid>tx_xml_0000000000000000000000000003</txid>
    <timestamp>2026-01-01T12:02:00Z</timestamp>
    <fee>0.001</fee>
    <input_addresses><address>1XmlIn3</address></input_addresses>
    <output_addresses><address>1XmlOut3</address></output_addresses>
  </transaction>
</transactions>"""
    xml_file.write_text(xml_content, encoding="utf-8")

    with open(xml_file, "rb") as f:
        response = client.post(
            "/api/v1/ingest/upload",
            files={"file": ("valid_txs.xml", f, "application/xml")},
            data={"label": "test_xml_dataset"},
        )

    assert response.status_code == 202
    body = response.json()
    assert "task_id" in body
    assert "dataset_id" in body


def test_upload_invalid_format_rejected(client, tmp_path):
    """Test unsupported file format upload returns 400 error."""
    txt_file = tmp_path / "invalid_data.txt"
    txt_file.write_text("random plaintext data", encoding="utf-8")

    with open(txt_file, "rb") as f:
        response = client.post(
            "/api/v1/ingest/upload",
            files={"file": ("invalid_data.txt", f, "text/plain")},
            data={"label": "test_invalid"},
        )

    assert response.status_code == 400
    body = response.json()
    error_msg = str(body.get("error", body.get("detail", ""))).lower()
    assert "format" in error_msg or "type" in error_msg or "extension" in error_msg


def test_deduplication_removes_duplicates():
    """Verify deduplication removes duplicate transactions by txid."""
    records = sample_5_records_with_2_duplicates()
    unique, dup_count = deduplicate_by_txid(records)
    assert dup_count == 2
    assert len(unique) == 3
    txids = [r.txid for r in unique]
    assert len(set(txids)) == len(txids)


def test_geoip_enrichment_adds_country(tmp_path):
    """Test GeoIP adds country and coordinates if MaxMind DB is available."""
    db_path = getattr(settings, "MAXMIND_DB_PATH", "/app/data/GeoLite2-City.mmdb")
    if not os.path.exists(db_path):
        pytest.skip("MaxMind DB not available in test env")

    now = datetime.now(timezone.utc)
    records = [
        TransactionRecord(
            txid="tx_pub_0000000000000000000000000001",
            timestamp=now,
            src_ip="8.8.8.8",
            fee=0.001,
        ),
        TransactionRecord(
            txid="tx_pub_0000000000000000000000000002",
            timestamp=now,
            src_ip="1.1.1.1",
            fee=0.001,
        ),
    ]
    enrich_with_geoip(records, db_path)
    assert records[0].geo_country is not None
    assert records[0].lat is not None


def test_geoip_enrichment_handles_private_ip(monkeypatch):
    """Verify private/unresolved IP does not raise and leaves geo_country None."""
    now = datetime.now(timezone.utc)
    record = TransactionRecord(
        txid="tx_priv_0000000000000000000000000001",
        timestamp=now,
        src_ip="192.168.1.1",
        fee=0.001,
    )

    try:
        import geoip2.database
        import geoip2.errors

        mock_reader = MagicMock()
        mock_reader.city.side_effect = geoip2.errors.AddressNotFoundError(
            "Address not found"
        )
        monkeypatch.setattr(
            geoip2.database, "Reader", lambda path: mock_reader
        )
    except ImportError:
        pass

    # Should not raise exception
    enrich_with_geoip([record], "non_existent_mock.mmdb")
    assert record.geo_country is None


def test_schema_validation_catches_bad_rows(sample_transactions):
    """Ensure business rules identify invalid rows like negative fees or missing txid."""
    now = datetime.now(timezone.utc)
    bad_records = [
        TransactionRecord.model_construct(
            txid="valid-txid-with-neg-fee-000000001",
            timestamp=now,
            fee=-0.05,
            input_addresses=["1AddrA"],
            output_addresses=["1AddrB"],
        ),
        TransactionRecord.model_construct(
            txid="",
            timestamp=now,
            fee=0.001,
            input_addresses=["1AddrC"],
            output_addresses=["1AddrD"],
        ),
    ]

    result = validate_schema(sample_transactions + bad_records)
    assert result.invalid_rows == 2
    assert result.valid_rows == len(sample_transactions)
    assert len(result.errors) == 2


def test_parser_csv_handles_missing_columns(tmp_path):
    """Verify parse_csv handles minimal columns (txid, timestamp) and defaults fee to 0.0."""
    csv_file = tmp_path / "minimal.csv"
    csv_content = (
        "txid,timestamp\n"
        "tx_min_00000000000000000000000000001,2026-01-01T12:00:00Z\n"
        "tx_min_00000000000000000000000000002,2026-01-01T12:01:00Z\n"
        "tx_min_00000000000000000000000000003,2026-01-01T12:02:00Z\n"
    )
    csv_file.write_text(csv_content, encoding="utf-8")

    records, errors = parse_csv(str(csv_file), TimestampFormat.ISO_8601)
    assert len(records) + len(errors) == 3
    assert len(records) == 3
    assert all(r.fee == 0.0 for r in records)
