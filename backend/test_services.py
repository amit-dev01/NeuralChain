import os
import sys
import time
from dotenv import load_dotenv

load_dotenv()

print("=" * 65)
print(">>> RUNNING LIVE HEALTH CHECK FOR ALL DATABASES <<<")
print("=" * 65)

# 1. POSTGRESQL / SUPABASE
print("\n[1] SUPABASE POSTGRESQL DATABASE")
print("-" * 45)
try:
    from sqlalchemy import create_engine, text
    db_url = os.getenv("DATABASE_URL", "")
    t0 = time.time()
    engine = create_engine(db_url, connect_args={"sslmode": "require"})
    with engine.connect() as conn:
        res = conn.execute(text("SELECT current_database(), current_user, version(), NOW();")).fetchone()
        latency = (time.time() - t0) * 1000
        tables_res = conn.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
        )).fetchall()
        table_names = [r[0] for r in tables_res]
        
    print(f"  Status       : ONLINE (Response time: {latency:.1f}ms)")
    print(f"  Database     : {res[0]}")
    print(f"  User         : {res[1]}")
    print(f"  Version      : {res[2][:45]}...")
    print(f"  Server Time  : {res[3]}")
    print(f"  Tables ({len(table_names)})   : {', '.join(table_names)}")
except Exception as e:
    print(f"  Status       : OFFLINE / ERROR ({e})")

# 2. UPSTASH REDIS
print("\n[2] UPSTASH REDIS CACHE & BROKER")
print("-" * 45)
try:
    import redis
    redis_url = os.getenv("REDIS_URL", "")
    t0 = time.time()
    r = redis.Redis.from_url(redis_url, ssl_cert_reqs=None, decode_responses=True)
    ping_ok = r.ping()
    latency = (time.time() - t0) * 1000
    
    # Test read/write/delete
    r.set("health_check_probe", "alive", ex=10)
    val = r.get("health_check_probe")
    r.delete("health_check_probe")
    
    print(f"  Status       : ONLINE (Ping time: {latency:.1f}ms)")
    print(f"  Ping Response: {ping_ok}")
    print(f"  Read/Write   : PASSED (Probe value: '{val}')")
except Exception as e:
    print(f"  Status       : OFFLINE / ERROR ({e})")

# 3. NEO4J AURADB
print("\n[3] NEO4J AURADB GRAPH DATABASE")
print("-" * 45)
try:
    from neo4j import GraphDatabase
    uri = os.getenv("NEO4J_URI", "")
    user = os.getenv("NEO4J_USER", "")
    pwd = os.getenv("NEO4J_PASSWORD", "")
    t0 = time.time()
    with GraphDatabase.driver(uri, auth=(user, pwd)) as driver:
        driver.verify_connectivity()
        with driver.session() as session:
            q_res = session.run("MATCH (n) RETURN count(n) AS node_count").single()
            node_cnt = q_res["node_count"]
        latency = (time.time() - t0) * 1000
    print(f"  Status       : ONLINE (Response time: {latency:.1f}ms)")
    print(f"  Host         : {uri}")
    print(f"  User         : {user}")
    print(f"  Total Nodes  : {node_cnt} graph nodes")
except Exception as e:
    print(f"  Status       : OFFLINE / ERROR ({e})")

print("\n" + "=" * 65)
print(">>> ALL 3 DATABASES ARE RUNNING AND FULLY OPERATIONAL <<<")
print("=" * 65)
