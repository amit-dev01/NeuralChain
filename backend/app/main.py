from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import ingest, graph, ml, alerts, reports
from app.core.config import settings

app = FastAPI(
    title="NeuralChain API",
    description="AI-Powered Bitcoin Transaction Monitoring — SIH26146",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(ingest.router, prefix="/api/ingest", tags=["Ingest"])
app.include_router(graph.router, prefix="/api/graph", tags=["Graph"])
app.include_router(ml.router, prefix="/api/ml", tags=["ML"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "project": "NeuralChain", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
