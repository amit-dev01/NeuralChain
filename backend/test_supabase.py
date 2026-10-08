import urllib.request
import urllib.error
import json
import os
import sys
from dotenv import load_dotenv

# Load from .env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
BASE_URL = SUPABASE_URL.rstrip("/") + "/rest/v1" if SUPABASE_URL else ""
ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

tables = ["datasets", "transactions", "alerts", "model_runs", "entities", "reports"]

print("=" * 60)
print("1. TESTING SUPABASE REST API - PUBLIC / ANON KEY")
print("=" * 60)

for t in tables:
    req = urllib.request.Request(
        f"{BASE_URL}/{t}?select=*&limit=1",
        headers={
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"  [PASS] Table '{t}': HTTP {resp.status} (Rows found: {len(data)})")
    except urllib.error.HTTPError as e:
        print(f"  [FAIL] Table '{t}': HTTP {e.code} - {e.read().decode()}")
    except Exception as e:
        print(f"  [ERROR] Table '{t}': {e}")

print("\n" + "=" * 60)
print("2. TESTING SUPABASE SERVICE ROLE KEY - FULL CRUD WORKFLOW")
print("=" * 60)

try:
    # 2.1 CREATE (INSERT)
    insert_payload = json.dumps({
        "label": "NeuralChain Supabase Connectivity Check",
        "source_type": "verification_agent",
        "status": "in_progress"
    }).encode("utf-8")

    req_create = urllib.request.Request(
        f"{BASE_URL}/datasets",
        data=insert_payload,
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        method="POST"
    )
    with urllib.request.urlopen(req_create) as resp:
        created_records = json.loads(resp.read().decode())
        test_id = created_records[0]["id"]
        print(f"  [PASS] CREATE: Inserted dataset row with UUID: {test_id}")

    # 2.2 READ (SELECT)
    req_read = urllib.request.Request(
        f"{BASE_URL}/datasets?id=eq.{test_id}&select=*",
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}"
        }
    )
    with urllib.request.urlopen(req_read) as resp:
        read_records = json.loads(resp.read().decode())
        print(f"  [PASS] READ: Successfully queried dataset '{read_records[0]['label']}'")

    # 2.3 UPDATE (PATCH)
    update_payload = json.dumps({"status": "verified_ok"}).encode("utf-8")
    req_update = urllib.request.Request(
        f"{BASE_URL}/datasets?id=eq.{test_id}",
        data=update_payload,
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        method="PATCH"
    )
    with urllib.request.urlopen(req_update) as resp:
        updated_records = json.loads(resp.read().decode())
        print(f"  [PASS] UPDATE: Status modified to '{updated_records[0]['status']}'")

    # 2.4 DELETE
    req_delete = urllib.request.Request(
        f"{BASE_URL}/datasets?id=eq.{test_id}",
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}"
        },
        method="DELETE"
    )
    with urllib.request.urlopen(req_delete) as resp:
        print(f"  [PASS] DELETE: Cleaned up test record (HTTP {resp.status})")

    print("\n>>> ALL SUPABASE CRUD OPERATIONS VERIFIED SUCCESSFULLY! <<<")

except urllib.error.HTTPError as e:
    print(f"  [FAIL] Service Role operation failed: HTTP {e.code} - {e.read().decode()}")
except Exception as e:
    print(f"  [ERROR] {e}")

print("\n" + "=" * 60)
print("3. TESTING POSTGRESQL DIRECT CONNECTION (SQLAlchemy)")
print("=" * 60)
if "[YOUR_DB_PASSWORD]" in DATABASE_URL or "[REGION]" in DATABASE_URL:
    print("  [INFO] DATABASE_URL still contains placeholder '[YOUR_DB_PASSWORD]' or '[REGION]'.")
    print("         To enable direct SQLAlchemy/PostgreSQL queries, replace these in .env with your credentials.")
else:
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(DATABASE_URL, connect_args={"sslmode": "require"})
        with engine.connect() as conn:
            res = conn.execute(text("SELECT current_database(), current_user, version();")).fetchone()
            print("  [PASS] Direct PostgreSQL connection verified via SQLAlchemy!")
            print(f"         Database : {res[0]}")
            print(f"         User     : {res[1]}")
            print(f"         Postgres : {res[2][:45]}")
    except Exception as e:
        print(f"  [ERROR] Connection test raised: {e}")

print("=" * 60)
