"""
Synthetic Bitcoin transaction dataset generator.
Usage: python generate.py --n 10000 --output data/raw/
"""

import argparse
import csv
import json
import os
import random
import string
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    from faker import Faker
    fake = Faker()
except ImportError:
    class Faker:
        """Fallback Faker implementation when external package is not installed."""
        @classmethod
        def seed(cls, s: int = 42) -> None:
            pass

        def ipv4_public(self) -> str:
            first = random.choice([x for x in range(1, 224) if x not in (10, 127, 169, 172, 192)])
            return f"{first}.{random.randint(1, 254)}.{random.randint(1, 254)}.{random.randint(1, 254)}"

    fake = Faker()

import numpy as np

try:
    from markov_chain import AmountState, MarkovAmountGenerator
except ImportError:
    from synthetic_data_gen.markov_chain import AmountState, MarkovAmountGenerator

Faker.seed(42)
rng = np.random.default_rng(42)


# ─── Address Generation ─────────────────────────────────────

def generate_btc_address(prefix: str = "1") -> str:
    """
    Generates a realistic-looking Base58 Bitcoin address.
    Does not use bitcoinaddress library (not always available).
    Generates plausible P2PKH (starts with 1) or P2SH (starts with 3)
    or bech32 (starts with bc1) addresses of correct lengths.
    """
    base58_chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    if prefix == "bc1":
        return "bc1" + "".join(random.choices("qpzry9x8gf2tvdw0s3jn54khce6mua7l", k=39))
    elif prefix == "3":
        return "3" + "".join(random.choices(base58_chars, k=33))
    else:
        return "1" + "".join(random.choices(base58_chars, k=33))


def generate_txid() -> str:
    """Generate a random 64-character hex transaction ID."""
    return "".join(random.choices(string.hexdigits[:16], k=64)).lower()


def generate_ip() -> str:
    """Generate a random public IPv4 address."""
    return fake.ipv4_public()


def random_asn() -> str:
    """Generate a plausible Autonomous System Number and organization label."""
    orgs = [
        "Hetzner Online GmbH",
        "OVH SAS",
        "Tor Project",
        "Cloudflare Inc",
        "Amazon AWS",
        "DigitalOcean LLC",
        "Bulletproof Hosting Ltd",
        "Cogent Communications",
    ]
    return f"AS{rng.integers(1000, 65000)} {rng.choice(orgs)}"


def random_country() -> Tuple[str, float, float]:
    """Returns (iso_code, lat, lon) for typical Bitcoin node distribution hubs."""
    countries = [
        ("US", 37.09, -95.71),
        ("RU", 61.52, 105.31),
        ("CN", 35.86, 104.19),
        ("DE", 51.16, 10.45),
        ("NL", 52.13, 5.29),
        ("KP", 40.34, 127.51),
        ("UA", 48.37, 31.16),
        ("BR", -14.23, -51.92),
        ("IN", 20.59, 78.96),
        ("GB", 55.37, -3.43),
        ("FR", 46.22, 2.21),
        ("IR", 32.42, 53.68),
    ]
    return countries[rng.integers(0, len(countries))]


# ─── Base Transaction Generation ────────────────────────────

def generate_transaction(
    timestamp: datetime,
    markov: MarkovAmountGenerator,
    label: str = "normal",
    src_ip: Optional[str] = None,
    wallet_pool: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Generate a single Bitcoin transaction with Dirichlet-weighted output splitting."""
    n_inputs = int(rng.integers(1, 4))
    n_outputs = int(rng.integers(1, 5))

    # Use wallet pool if provided (for pattern injection)
    if wallet_pool and len(wallet_pool) >= n_inputs + n_outputs:
        input_addresses = random.sample(wallet_pool, n_inputs)
        output_addresses = random.sample(
            [w for w in wallet_pool if w not in input_addresses], n_outputs
        )
    else:
        input_addresses = [generate_btc_address() for _ in range(n_inputs)]
        output_addresses = [generate_btc_address() for _ in range(n_outputs)]

    input_amounts = [round(markov.next_amount(), 8) for _ in range(n_inputs)]
    total_in = sum(input_amounts)
    fee = round(total_in * float(rng.uniform(0.001, 0.05)), 8)
    total_out = max(total_in - fee, 0.000001)

    # Distribute to outputs (Dirichlet distribution)
    weights = rng.dirichlet(np.ones(n_outputs))
    output_amounts = [round(float(total_out * w), 8) for w in weights]

    ip = src_ip or generate_ip()
    country_code, lat, lon = random_country()
    script_types = ["P2PKH", "P2SH", "P2WPKH", "P2WSH"]

    return {
        "txid": generate_txid(),
        "timestamp": timestamp.isoformat(),
        "src_ip": ip,
        "dst_ip": generate_ip(),
        "src_port": int(rng.integers(1024, 65535)),
        "dst_port": int(rng.integers(1024, 65535)),
        "input_addresses": input_addresses,
        "output_addresses": output_addresses,
        "input_amounts": input_amounts,
        "output_amounts": output_amounts,
        "fee": fee,
        "script_type": str(rng.choice(script_types)),
        "geo_country": country_code,
        "asn": random_asn(),
        "lat": round(float(lat + rng.uniform(-2, 2)), 4),
        "lon": round(float(lon + rng.uniform(-2, 2)), 4),
        "ground_truth_label": label,
    }


# ─── Anomaly Injection Functions ────────────────────────────

def inject_peel_chains(
    n_chains: int = 50,
    chain_length: int = 8,
    base_time: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Creates chains of transactions where each tx has exactly 1 output
    that becomes the input of the next tx (peeling).
    """
    transactions: List[Dict[str, Any]] = []
    base_time = base_time or (datetime.now(timezone.utc) - timedelta(hours=6))
    markov = MarkovAmountGenerator(initial_state=AmountState.MEDIUM)

    for _ in range(n_chains):
        current_wallet = generate_btc_address()
        current_amount = round(markov.next_amount(), 8)
        t = base_time + timedelta(seconds=int(rng.integers(0, 3600)))

        for hop in range(chain_length):
            next_wallet = generate_btc_address()
            fee = round(current_amount * 0.002, 8)
            out_amount = round(current_amount - fee, 8)
            tx = {
                "txid": generate_txid(),
                "timestamp": (t + timedelta(minutes=hop * 2)).isoformat(),
                "src_ip": generate_ip(),
                "dst_ip": generate_ip(),
                "src_port": int(rng.integers(1024, 65535)),
                "dst_port": int(rng.integers(1024, 65535)),
                "input_addresses": [current_wallet],
                "output_addresses": [next_wallet],
                "input_amounts": [current_amount],
                "output_amounts": [out_amount],
                "fee": fee,
                "script_type": "P2WPKH",
                "geo_country": "RU",
                "asn": "AS13335 Cloudflare",
                "lat": round(float(55.75 + rng.uniform(-1, 1)), 4),
                "lon": round(float(37.61 + rng.uniform(-1, 1)), 4),
                "ground_truth_label": "peel_chain",
            }
            transactions.append(tx)
            current_wallet = next_wallet
            current_amount = out_amount

    return transactions


def inject_fan_out_mixing(
    n_events: int = 30,
    base_time: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """Creates transactions with 1 input -> 50+ outputs (mixing/tumbling)."""
    transactions: List[Dict[str, Any]] = []
    base_time = base_time or (datetime.now(timezone.utc) - timedelta(hours=4))
    markov = MarkovAmountGenerator(initial_state=AmountState.LARGE)

    for _ in range(n_events):
        n_outputs = int(rng.integers(50, 100))
        total_in = round(markov.next_amount(), 8)
        fee = round(total_in * 0.01, 8)
        total_out = max(total_in - fee, 0.0001)
        weights = rng.dirichlet(np.ones(n_outputs))
        output_amounts = [round(float(total_out * w), 8) for w in weights]
        t = base_time + timedelta(seconds=int(rng.integers(0, 7200)))

        tx = {
            "txid": generate_txid(),
            "timestamp": t.isoformat(),
            "src_ip": generate_ip(),
            "dst_ip": generate_ip(),
            "src_port": int(rng.integers(1024, 65535)),
            "dst_port": int(rng.integers(1024, 65535)),
            "input_addresses": [generate_btc_address()],
            "output_addresses": [generate_btc_address() for _ in range(n_outputs)],
            "input_amounts": [total_in],
            "output_amounts": output_amounts,
            "fee": fee,
            "script_type": "P2SH",
            "geo_country": "NL",
            "asn": "AS60068 CDN77",
            "lat": round(float(52.37 + rng.uniform(-0.5, 0.5)), 4),
            "lon": round(float(4.89 + rng.uniform(-0.5, 0.5)), 4),
            "ground_truth_label": "mixing",
        }
        transactions.append(tx)

    return transactions


def inject_rapid_reuse(
    n_events: int = 40,
    base_time: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Creates bursts where the same IP is used by many different wallets
    in a very short time window (<5 minutes).
    """
    transactions: List[Dict[str, Any]] = []
    base_time = base_time or (datetime.now(timezone.utc) - timedelta(hours=2))
    markov = MarkovAmountGenerator(initial_state=AmountState.SMALL)

    for event in range(n_events):
        shared_ip = generate_ip()
        n_wallets = int(rng.integers(10, 30))
        burst_start = base_time + timedelta(minutes=event * 10)

        for _ in range(n_wallets):
            wallet = generate_btc_address()
            t = burst_start + timedelta(seconds=int(rng.integers(0, 270)))
            amount = round(markov.next_amount(), 8)
            fee = round(amount * 0.003, 8)

            tx = {
                "txid": generate_txid(),
                "timestamp": t.isoformat(),
                "src_ip": shared_ip,  # SAME IP for all in burst
                "dst_ip": generate_ip(),
                "src_port": int(rng.integers(1024, 65535)),
                "dst_port": int(rng.integers(1024, 65535)),
                "input_addresses": [wallet],
                "output_addresses": [generate_btc_address()],
                "input_amounts": [amount],
                "output_amounts": [round(amount - fee, 8)],
                "fee": fee,
                "script_type": "P2PKH",
                "geo_country": "RU",
                "asn": random_asn(),
                "lat": 55.75,
                "lon": 37.61,
                "ground_truth_label": "rapid_reuse",
            }
            transactions.append(tx)

    return transactions


def inject_round_amounts(
    n: int = 60,
    base_time: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """Creates transactions with exact round BTC amounts (ransomware signature)."""
    transactions: List[Dict[str, Any]] = []
    base_time = base_time or (datetime.now(timezone.utc) - timedelta(hours=3))
    markov = MarkovAmountGenerator(initial_state=AmountState.MEDIUM)

    for i in range(n):
        round_amount = markov.get_round_amount()
        fee = round(round_amount * 0.002, 8)
        t = base_time + timedelta(minutes=i * 15)
        victim_wallet = generate_btc_address()
        attacker_wallet = generate_btc_address()

        tx = {
            "txid": generate_txid(),
            "timestamp": t.isoformat(),
            "src_ip": generate_ip(),
            "dst_ip": generate_ip(),
            "src_port": int(rng.integers(1024, 65535)),
            "dst_port": int(rng.integers(1024, 65535)),
            "input_addresses": [victim_wallet],
            "output_addresses": [attacker_wallet],
            "input_amounts": [round(round_amount + fee, 8)],
            "output_amounts": [round_amount],
            "fee": fee,
            "script_type": "P2WPKH",
            "geo_country": "KP",
            "asn": "AS131293 KP National",
            "lat": round(float(39.03 + rng.uniform(-1, 1)), 4),
            "lon": round(float(125.75 + rng.uniform(-1, 1)), 4),
            "ground_truth_label": "ransomware",
        }
        transactions.append(tx)

    return transactions


def inject_darknet_cluster(
    n_wallets: int = 20,
    txs_per_wallet: int = 5,
    base_time: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Creates a tightly-knit cluster of wallets that all transact
    with each other (darknet marketplace pattern).
    All wallets share inputs frequently.
    """
    transactions: List[Dict[str, Any]] = []
    base_time = base_time or (datetime.now(timezone.utc) - timedelta(days=1))
    markov = MarkovAmountGenerator(initial_state=AmountState.SMALL)
    cluster_wallets = [generate_btc_address() for _ in range(n_wallets)]
    shared_ip_pool = [generate_ip() for _ in range(5)]  # few shared IPs

    for i in range(n_wallets * txs_per_wallet):
        # Pick 1-3 inputs from the cluster
        n_inputs = int(rng.integers(1, 4))
        n_outputs = int(rng.integers(1, 4))
        input_wallets = random.sample(cluster_wallets, min(n_inputs, n_wallets))
        output_wallets = random.sample(cluster_wallets, min(n_outputs, n_wallets))
        amounts_in = [round(markov.next_amount(), 8) for _ in input_wallets]
        total_in = sum(amounts_in)
        fee = round(total_in * 0.003, 8)
        total_out = max(total_in - fee, 0.000001)
        weights = rng.dirichlet(np.ones(len(output_wallets)))
        amounts_out = [round(float(total_out * w), 8) for w in weights]
        t = base_time + timedelta(hours=i * 0.5)

        tx = {
            "txid": generate_txid(),
            "timestamp": t.isoformat(),
            "src_ip": random.choice(shared_ip_pool),
            "dst_ip": generate_ip(),
            "src_port": int(rng.integers(1024, 65535)),
            "dst_port": int(rng.integers(1024, 65535)),
            "input_addresses": input_wallets,
            "output_addresses": output_wallets,
            "input_amounts": amounts_in,
            "output_amounts": amounts_out,
            "fee": fee,
            "script_type": "P2SH",
            "geo_country": "DE",
            "asn": "AS24940 Hetzner Online GmbH",
            "lat": round(float(48.13 + rng.uniform(-1, 1)), 4),
            "lon": round(float(11.58 + rng.uniform(-1, 1)), 4),
            "ground_truth_label": "darknet",
        }
        transactions.append(tx)

    return transactions


# ─── Main Generator ─────────────────────────────────────────

def generate_dataset(
    n: int = 10000,
    output_dir: str = "data/raw/",
) -> str:
    """
    Generates a synthetic Bitcoin transaction dataset.
    Returns path to output CSV file.
    """
    print(f"Generating {n} transactions...")
    base_time = datetime.now(timezone.utc) - timedelta(hours=24)
    markov = MarkovAmountGenerator(seed=42)

    # Normal transactions: 75% of total
    n_normal = int(n * 0.75)
    transactions: List[Dict[str, Any]] = []
    for i in range(n_normal):
        t = base_time + timedelta(seconds=i * 8)
        transactions.append(generate_transaction(t, markov, label="normal"))
    print(f"  ✓ {n_normal} normal transactions")

    # Inject anomalies: 25% of total
    anomaly_budget = n - n_normal

    peel = inject_peel_chains(
        n_chains=50, chain_length=8, base_time=base_time
    )[: int(anomaly_budget * 0.25)]
    transactions.extend(peel)
    print(f"  ✓ {len(peel)} peel chain transactions")

    mixing = inject_fan_out_mixing(
        n_events=30, base_time=base_time
    )[: int(anomaly_budget * 0.20)]
    transactions.extend(mixing)
    print(f"  ✓ {len(mixing)} mixing/fan-out transactions")

    reuse = inject_rapid_reuse(
        n_events=40, base_time=base_time
    )[: int(anomaly_budget * 0.25)]
    transactions.extend(reuse)
    print(f"  ✓ {len(reuse)} rapid reuse transactions")

    ransomware = inject_round_amounts(
        n=60, base_time=base_time
    )[: int(anomaly_budget * 0.15)]
    transactions.extend(ransomware)
    print(f"  ✓ {len(ransomware)} ransomware transactions")

    darknet = inject_darknet_cluster(
        n_wallets=20, txs_per_wallet=5, base_time=base_time
    )[: int(anomaly_budget * 0.15)]
    transactions.extend(darknet)
    print(f"  ✓ {len(darknet)} darknet cluster transactions")

    # Shuffle all transactions randomly
    random.shuffle(transactions)

    # Trim to exactly n
    transactions = transactions[:n]

    # Write CSV
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "synthetic_transactions.csv")

    fieldnames = [
        "txid",
        "timestamp",
        "src_ip",
        "dst_ip",
        "src_port",
        "dst_port",
        "input_addresses",
        "output_addresses",
        "input_amounts",
        "output_amounts",
        "fee",
        "script_type",
        "geo_country",
        "asn",
        "lat",
        "lon",
        "ground_truth_label",
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for tx in transactions:
            # Serialize list fields as JSON strings for CSV
            row = tx.copy()
            for list_field in [
                "input_addresses",
                "output_addresses",
                "input_amounts",
                "output_amounts",
            ]:
                row[list_field] = json.dumps(tx[list_field])
            writer.writerow(row)

    label_counts: Dict[str, int] = {}
    for tx in transactions:
        label = str(tx["ground_truth_label"])
        label_counts[label] = label_counts.get(label, 0) + 1

    print(f"\n✅ Dataset saved to {output_path}")
    print(f"   Total: {len(transactions)} transactions")
    print(f"   Label distribution:")
    for label, count in sorted(label_counts.items()):
        pct = count / len(transactions) * 100
        print(f"     {label:20s}: {count:5d} ({pct:.1f}%)")

    return output_path


# ─── CLI ────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate synthetic Bitcoin transaction dataset"
    )
    parser.add_argument(
        "--n",
        type=int,
        default=10000,
        help="Number of transactions to generate (default: 10000)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/raw/",
        help="Output directory (default: data/raw/)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility",
    )
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    Faker.seed(args.seed)

    output_file = generate_dataset(n=args.n, output_dir=args.output)
    print(f"\nRun ingestion with:")
    print(f"  python -m app.ingest.tasks {output_file}")
