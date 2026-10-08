import logging
import os
from contextlib import contextmanager
from typing import Any, Dict, Generator, List, Optional

from dotenv import load_dotenv
from neo4j import Driver, GraphDatabase, Session

load_dotenv()

logger = logging.getLogger(__name__)

try:
    from app.core.config import settings

    NEO4J_URI = os.getenv("NEO4J_URI") or getattr(
        settings, "NEO4J_URI", "bolt://localhost:7687"
    )
    NEO4J_USER = os.getenv("NEO4J_USER") or getattr(
        settings, "NEO4J_USER", "neo4j"
    )
    NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD") or getattr(
        settings, "NEO4J_PASSWORD", "neuralchain_neo4j"
    )
except Exception:
    NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "neuralchain_neo4j")

# Module-level driver singleton
_driver: Optional[Driver] = None


def get_driver() -> Driver:
    """Get or create the singleton Neo4j driver instance."""
    global _driver
    if _driver is None:
        uri = os.getenv("NEO4J_URI", NEO4J_URI)
        user = os.getenv("NEO4J_USER", NEO4J_USER)
        pwd = os.getenv("NEO4J_PASSWORD", NEO4J_PASSWORD)
        _driver = GraphDatabase.driver(
            uri,
            auth=(user, pwd),
        )
    return _driver


def close_driver() -> None:
    """Close the active Neo4j driver and reset the singleton reference."""
    global _driver
    if _driver is not None:
        try:
            _driver.close()
        except Exception as e:
            logger.error("Error closing Neo4j driver: %s", e)
        finally:
            _driver = None


@contextmanager
def get_neo4j_session(database: Optional[str] = None) -> Generator[Session, None, None]:
    """Context manager yielding a Neo4j session with auto-closure."""
    target_db = database or os.getenv("NEO4J_DATABASE", None)
    driver = get_driver()
    session = driver.session(database=target_db) if target_db else driver.session()
    try:
        yield session
    finally:
        session.close()


def ping() -> bool:
    """Verify connectivity by running RETURN 1 (never raises)."""
    try:
        driver = get_driver()
        driver.verify_connectivity()
        with get_neo4j_session() as session:
            result = session.run("RETURN 1 AS num")
            record = result.single()
            return bool(record and record["num"] == 1)
    except Exception as e:
        logger.warning("Neo4j ping check failed: %s", e)
        return False


def run_query(cypher: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Convenience wrapper to run a Cypher query and return a list of record dicts."""
    if params is None:
        params = {}
    with get_neo4j_session() as session:
        result = session.run(cypher, params)
        return [record.data() for record in result]


# Compatibility proxy for app.main
class Neo4jClientProxy:
    @property
    def driver(self) -> Driver:
        return get_driver()

    def ping(self) -> bool:
        return ping()

    def close(self) -> None:
        close_driver()


neo4j_client = Neo4jClientProxy()
