from fastapi import APIRouter

router = APIRouter()


@router.get("/heatmap")
async def get_geo_heatmap():
    return {"points": []}
