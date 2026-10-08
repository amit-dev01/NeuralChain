import json
import logging
import os
from typing import Any, Dict, Optional

import redis
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

try:
    from app.core.config import settings

    REDIS_URL = os.getenv("REDIS_URL") or getattr(
        settings, "REDIS_URL", "redis://localhost:6379/0"
    )
except Exception:
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Redis connection pool
extra_pool_kwargs = {}
if REDIS_URL.startswith("rediss://"):
    extra_pool_kwargs["ssl_cert_reqs"] = None

pool = redis.ConnectionPool.from_url(
    REDIS_URL,
    max_connections=20,
    decode_responses=True,
    **extra_pool_kwargs,
)

# Constants
TASK_PROGRESS_TTL = 3600  # 1 hour
CACHE_TTL = 300  # 5 minutes


def get_redis() -> redis.Redis:
    """Get a Redis client instance backed by the shared connection pool."""
    return redis.Redis(connection_pool=pool)


# Default client instance
redis_client = get_redis()


def check_redis_connection() -> bool:
    """Ping Redis to check connection status without raising exceptions."""
    try:
        client = get_redis()
        return bool(client.ping())
    except Exception as e:
        logger.debug("Redis ping check failed: %s", e)
        return False


def set_task_progress(task_id: str, progress: Dict[str, Any]) -> None:
    """Store task progress as a serialized JSON string with TTL."""
    try:
        client = get_redis()
        key = f"task_progress:{task_id}"
        client.setex(key, TASK_PROGRESS_TTL, json.dumps(progress))
    except Exception as e:
        logger.error(
            "Failed to set task progress in Redis for task %s: %s", task_id, e
        )


def get_task_progress(task_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve and deserialize task progress from Redis."""
    try:
        client = get_redis()
        key = f"task_progress:{task_id}"
        val = client.get(key)
        if val:
            return json.loads(val)
        return None
    except Exception as e:
        logger.error(
            "Failed to get task progress from Redis for task %s: %s", task_id, e
        )
        return None
