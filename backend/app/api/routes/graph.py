from fastapi import APIRouter

router = APIRouter()


@router.get("/wallets/{address}")
async def get_wallet_graph(address: str, depth: int = 2):
    """Get the transaction graph for a wallet address up to N hops."""
    # TODO: query Neo4j
    return {"address": address, "depth": depth, "nodes": [], "edges": []}


@router.get("/transactions/{txid}")
async def get_transaction(txid: str):
    """Get full transaction details and related graph nodes."""
    # TODO: query Neo4j
    return {"txid": txid, "inputs": [], "outputs": []}


@router.get("/clusters")
async def get_clusters():
    """Get all detected wallet clusters."""
    # TODO: query Neo4j cluster labels
    return {"clusters": []}
