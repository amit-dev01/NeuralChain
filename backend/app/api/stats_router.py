from fastapi import APIRouter

router = APIRouter()


@router.get("/overview")
async def get_stats_overview():
    return {
        "total_transactions": 0,
        "unique_wallets": 0,
        "active_alerts": 0,
        "high_risk_entities": 0,
        "models_running": 0,
    }
