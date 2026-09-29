"""
NeuralChain — Synthetic Dataset Generator
Generates realistic Bitcoin P2P transaction metadata with injected anomaly patterns.
"""

import random
import json
import csv
import hashlib
import uuid
from datetime import datetime, timedelta
from faker import Faker

fake = Faker()

# ── Config ──────────────────────────────────────────────────────────────────
NUM_NORMAL_TXS = 9000
NUM_ANOMALY_TXS = 1000  # 10% anomaly rate
OUTPUT_CSV = "../data/processed/synthetic_transactions.csv"
OUTPUT_JSON = "../data/processed/synthetic_transactions.json"

SCRIPT_TYPES = ["P2PKH", "P2SH", "P2WPKH", "P2WSH", "P2TR"]
COUNTRIES = ["US", "RU", "CN", "DE", "NL", "UA", "IN", "BR", "FR", "GB"]
ANOMALY_TYPES = ["peel_chain", "fan_out", "rapid_reuse", "round_amount", "darknet_cluster"]


def btc_address():
    """Generate a fake Bitcoin address."""
    prefix = random.choice(["1", "3", "bc1q"])
    body = hashlib.sha256(uuid.uuid4().bytes).hexdigest()[:30]
    return prefix + body


def txid():
    return hashlib.sha256(uuid.uuid4().bytes).hexdigest()


def generate_normal_tx(base_time: datetime) -> dict:
    n_inputs = random.randint(1, 4)
    n_outputs = random.randint(1, 3)
    input_amounts = [round(random.uniform(0.001, 2.0), 8) for _ in range(n_inputs)]
    total_in = sum(input_amounts)
    fee = round(random.uniform(0.00001, 0.0005), 8)
    output_amounts = [round(total_in - fee, 8)] if n_outputs == 1 else _split_amount(total_in - fee, n_outputs)

    return {
        "timestamp": (base_time + timedelta(seconds=random.randint(0, 86400))).isoformat(),
        "src_ip": fake.ipv4_public(),
        "dst_ip": fake.ipv4_public(),
        "src_port": random.randint(1024, 65535),
        "dst_port": 8333,
        "txid": txid(),
        "input_addresses": [btc_address() for _ in range(n_inputs)],
        "output_addresses": [btc_address() for _ in range(n_outputs)],
        "input_amounts": input_amounts,
        "output_amounts": output_amounts,
        "fee": fee,
        "script_type": random.choice(SCRIPT_TYPES),
        "geo_country": random.choice(COUNTRIES),
        "asn": f"AS{random.randint(1000, 99999)}",
        "anomaly_type": "normal",
        "is_anomaly": False,
    }


def generate_peel_chain(base_time: datetime, chain_length: int = 8) -> list:
    """Single input → single output, repeated — classic peel chain."""
    txs = []
    current_addr = btc_address()
    amount = round(random.uniform(0.5, 5.0), 8)
    ip = fake.ipv4_public()

    for i in range(chain_length):
        fee = round(random.uniform(0.00001, 0.0001), 8)
        next_addr = btc_address()
        txs.append({
            "timestamp": (base_time + timedelta(minutes=i * 3)).isoformat(),
            "src_ip": ip,
            "dst_ip": fake.ipv4_public(),
            "src_port": random.randint(1024, 65535),
            "dst_port": 8333,
            "txid": txid(),
            "input_addresses": [current_addr],
            "output_addresses": [next_addr],
            "input_amounts": [round(amount, 8)],
            "output_amounts": [round(amount - fee, 8)],
            "fee": fee,
            "script_type": "P2PKH",
            "geo_country": random.choice(COUNTRIES),
            "asn": f"AS{random.randint(1000, 99999)}",
            "anomaly_type": "peel_chain",
            "is_anomaly": True,
        })
        current_addr = next_addr
        amount -= fee
    return txs


def generate_fan_out(base_time: datetime) -> dict:
    """1 input → 50-100 outputs — mixing pattern."""
    n_outputs = random.randint(50, 100)
    total_in = round(random.uniform(5.0, 50.0), 8)
    fee = round(random.uniform(0.001, 0.005), 8)
    return {
        "timestamp": base_time.isoformat(),
        "src_ip": fake.ipv4_public(),
        "dst_ip": fake.ipv4_public(),
        "src_port": random.randint(1024, 65535),
        "dst_port": 8333,
        "txid": txid(),
        "input_addresses": [btc_address()],
        "output_addresses": [btc_address() for _ in range(n_outputs)],
        "input_amounts": [total_in],
        "output_amounts": _split_amount(total_in - fee, n_outputs),
        "fee": fee,
        "script_type": "P2SH",
        "geo_country": random.choice(COUNTRIES),
        "asn": f"AS{random.randint(1000, 99999)}",
        "anomaly_type": "fan_out",
        "is_anomaly": True,
    }


def generate_round_amount(base_time: datetime) -> dict:
    """Ransomware signature: exact round BTC amounts."""
    round_amounts = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 0.25, 0.05]
    amount = random.choice(round_amounts)
    return {
        "timestamp": base_time.isoformat(),
        "src_ip": fake.ipv4_public(),
        "dst_ip": fake.ipv4_public(),
        "src_port": random.randint(1024, 65535),
        "dst_port": 8333,
        "txid": txid(),
        "input_addresses": [btc_address()],
        "output_addresses": [btc_address()],
        "input_amounts": [round(amount + 0.0001, 8)],
        "output_amounts": [amount],
        "fee": 0.0001,
        "script_type": "P2WPKH",
        "geo_country": random.choice(["RU", "UA", "CN"]),
        "asn": f"AS{random.randint(1000, 99999)}",
        "anomaly_type": "round_amount",
        "is_anomaly": True,
    }


def _split_amount(total: float, n: int) -> list:
    parts = sorted([random.random() for _ in range(n - 1)] + [0, 1])
    return [round((parts[i + 1] - parts[i]) * total, 8) for i in range(n)]


def generate_dataset():
    base_time = datetime(2024, 1, 1)
    transactions = []

    # Normal transactions
    for _ in range(NUM_NORMAL_TXS):
        transactions.append(generate_normal_tx(base_time))

    # Anomaly injections
    for _ in range(200):
        transactions.extend(generate_peel_chain(base_time))
    for _ in range(300):
        transactions.append(generate_fan_out(base_time))
    for _ in range(500):
        transactions.append(generate_round_amount(base_time))

    random.shuffle(transactions)

    # Save CSV
    if transactions:
        keys = transactions[0].keys()
        with open(OUTPUT_CSV, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(transactions)

    # Save JSON
    with open(OUTPUT_JSON, "w") as f:
        json.dump(transactions, f, indent=2)

    print(f"Generated {len(transactions)} transactions")
    print(f"  Anomalies: {sum(1 for t in transactions if t['is_anomaly'])}")
    print(f"  Normal: {sum(1 for t in transactions if not t['is_anomaly'])}")
    print(f"CSV → {OUTPUT_CSV}")
    print(f"JSON → {OUTPUT_JSON}")


if __name__ == "__main__":
    generate_dataset()
