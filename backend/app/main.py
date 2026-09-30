import logging
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.alerts.router import router as alerts_router
from app.api.geo_router import router as geo_router
from app.api.stats_router import router as stats_router
from app.api.timeline_router import router as timeline_router
from app.core.celery_app import celery_app
from app.core.config import settings
from app.db.neo4j_client import neo4j_client
from app.db.postgres import engine
from app.db.redis_client import redis_client
from app.graph.router import router as graph_router
from app.ingest.router import router as ingest_router
from app.ml.router import router as ml_router
from app.reports.router import router as reports_router

# 9. Logging setup at module level
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("sih26146")

# 1. FastAPI app instance
app = FastAPI(
    title="SIH26146 — Bitcoin Transaction Monitor",
    description="AI-powered Bitcoin transaction analysis system",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# 2. Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:80",
        "http://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 3. Router inclusion — ALL routers under /api/v1 prefix
app.include_router(ingest_router, prefix="/api/v1/ingest", tags=["ingest"])
app.include_router(graph_router, prefix="/api/v1/graph", tags=["graph"])
app.include_router(ml_router, prefix="/api/v1/ml", tags=["ml"])
app.include_router(alerts_router, prefix="/api/v1/alerts", tags=["alerts"])
app.include_router(reports_router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(stats_router, prefix="/api/v1/stats", tags=["stats"])
app.include_router(timeline_router, prefix="/api/v1/timeline", tags=["timeline"])
app.include_router(geo_router, prefix="/api/v1/geo", tags=["geo"])


# --- Health check helper functions ---
def check_postgres() -> str:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return "ok"
    except Exception as e:
        logger.error("PostgreSQL ping failed: %s", e)
        return "error"


def check_redis() -> str:
    try:
        if redis_client.ping():
            return "ok"
        return "error"
    except Exception as e:
        logger.error("Redis ping failed: %s", e)
        return "error"


def check_neo4j() -> str:
    try:
        if neo4j_client.ping():
            return "ok"
        return "error"
    except Exception as e:
        logger.error("Neo4j ping failed: %s", e)
        return "error"


def check_celery(timeout: float = 2.0) -> str:
    try:
        inspect = celery_app.control.inspect(timeout=timeout)
        ping_res = inspect.ping()
        if ping_res:
            return "ok"
        return "error"
    except Exception as e:
        logger.error("Celery ping failed: %s", e)
        return "error"


# 4. Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("Running startup connectivity checks...")

    # PostgreSQL ping
    if check_postgres() == "ok":
        logger.info("PostgreSQL connection: OK")
    else:
        logger.error("PostgreSQL connection: FAILED")

    # Redis ping
    if check_redis() == "ok":
        logger.info("Redis connection: OK")
    else:
        logger.error("Redis connection: FAILED")

    # Neo4j ping
    if check_neo4j() == "ok":
        logger.info("Neo4j connection: OK")
    else:
        logger.error("Neo4j connection: FAILED")

    # Celery ping (2s timeout)
    if check_celery(timeout=2.0) == "ok":
        logger.info("Celery connection: OK")
    else:
        logger.error("Celery connection: FAILED")

    logger.info("Startup connectivity checks complete")


# 5. Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Executing shutdown sequence...")

    # Close Neo4j driver
    try:
        neo4j_client.close()
        logger.info("Neo4j driver closed successfully")
    except Exception as e:
        logger.error("Error closing Neo4j driver: %s", e)

    # Close Redis connection pool
    try:
        if hasattr(redis_client, "close"):
            redis_client.close()
        if hasattr(redis_client, "connection_pool") and hasattr(
            redis_client.connection_pool, "disconnect"
        ):
            redis_client.connection_pool.disconnect()
        logger.info("Redis connection pool closed successfully")
    except Exception as e:
        logger.error("Error closing Redis connection pool: %s", e)

    # Dispose SQLAlchemy engine
    try:
        engine.dispose()
        logger.info("SQLAlchemy engine disposed successfully")
    except Exception as e:
        logger.error("Error disposing SQLAlchemy engine: %s", e)

    logger.info("Application shutdown complete")


# 6. Health check endpoint
@app.get("/health", tags=["health"])
async def health():
    pg = check_postgres()
    r = check_redis()
    n4j = check_neo4j()
    cel = check_celery(timeout=0.2)

    all_ok = pg == "ok" and r == "ok" and n4j == "ok" and cel == "ok"

    return {
        "status": "ok" if all_ok else "degraded",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": "1.0.0",
        "services": {
            "postgres": pg,
            "redis": r,
            "neo4j": n4j,
            "celery": cel,
        },
    }


# 7. Root endpoint
@app.get("/", tags=["root"])
async def root():
    return {
        "message": "SIH26146 API running",
        "docs": "/api/docs",
    }


# 8. Custom exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation failed",
            "details": exc.errors(),
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server exception: %s", exc)
    content = {"error": "Internal server error"}
    if getattr(settings, "DEBUG", False):
        content["detail"] = str(exc)
    else:
        content["detail"] = "An unexpected error occurred."
    return JSONResponse(
        status_code=500,
        content=content,
    )
