"""
ai_router.py — Google GenAI (Gemma 4 & Gemini) REST Endpoints

Exposes:
- GET  /api/v1/ai/status           — Health check & configuration state for Gemma 4 / Gemini
- POST /api/v1/ai/generate-summary — AI-generated forensic executive brief for case dossiers
- POST /api/v1/ai/explain-shap     — Plain-language XAI interpretation of SHAP & anomaly vectors
- POST /api/v1/ai/copilot          — Interactive forensic co-pilot assistant for investigators
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.gemini_client import (
    explain_shap_attribution,
    generate_content_with_fallback_async,
    generate_forensic_executive_brief,
    is_gemini_configured,
)

logger = logging.getLogger("neuralchain.api.ai")

router = APIRouter(prefix="", tags=["ai"])


# --- Request & Response Models ---

class AIStatusResponse(BaseModel):
    configured: bool
    primary_model: str
    fallback_model: str
    temperature: float
    max_output_tokens: int
    mode: str
    message: str


class AISummaryRequest(BaseModel):
    total_transactions: int = Field(default=1000, description="Total transactions in time window")
    active_alerts: int = Field(default=24, description="Count of anomalous alerts detected")
    high_risk_entities: int = Field(default=5, description="Number of distinct high-risk entities")
    risk_threshold: float = Field(default=0.70, description="Confidence threshold used")
    top_typologies: List[str] = Field(default_factory=lambda: ["peeling_chain", "tumbler_flow", "high_fan_out"])
    time_window: Optional[str] = Field(default="Past 30 Days")


class AISummaryResponse(BaseModel):
    summary: str
    model_used: str
    fallback_applied: bool
    is_offline_simulated: bool
    success: bool
    error: Optional[str] = None


class AIExplainShapRequest(BaseModel):
    address: str = Field(..., description="Suspect Bitcoin wallet address or TXID")
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Composite anomaly risk score")
    anomaly_type: Optional[str] = Field(default="Peel Chain / Rapid Splitting")
    shap_features: Optional[Dict[str, float]] = Field(
        default_factory=lambda: {
            "velocity_ratio": 0.42,
            "fee_rate_deviation": 0.31,
            "fan_out_divergence": 0.27,
        }
    )
    typologies: Optional[List[str]] = Field(default_factory=lambda: ["peeling_chain", "zero_change_pass_through"])


class AICopilotRequest(BaseModel):
    prompt: str = Field(..., min_length=2, description="Forensics query from investigator")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Optional wallet/graph telemetry context")


class AICopilotResponse(BaseModel):
    response: str
    model_used: str
    fallback_applied: bool
    is_offline_simulated: bool
    success: bool
    error: Optional[str] = None


# --- Endpoints ---

@router.get(
    "/status",
    response_model=AIStatusResponse,
    summary="Check Gemma 4 / Gemini API status",
)
async def get_ai_status() -> AIStatusResponse:
    """
    Returns current configuration status, targeted models, and active mode.
    """
    configured = is_gemini_configured()
    return AIStatusResponse(
        configured=configured,
        primary_model=settings.GEMINI_MODEL,
        fallback_model=settings.GEMINI_FALLBACK_MODEL,
        temperature=settings.GEMINI_TEMPERATURE,
        max_output_tokens=settings.GEMINI_MAX_OUTPUT_TOKENS,
        mode="live_genai_api" if configured else "sovereign_offline_simulated",
        message=(
            f"Using primary model '{settings.GEMINI_MODEL}' via Google AI Studio API key."
            if configured
            else "GEMINI_API_KEY is not configured. Running in sovereign air-gapped simulation mode."
        ),
    )


@router.post(
    "/generate-summary",
    response_model=AISummaryResponse,
    summary="Generate court-ready forensic executive brief",
)
async def create_summary(request: AISummaryRequest) -> AISummaryResponse:
    """
    Synthesize high-level case metrics into an authoritative, SIH-standard forensic summary.
    """
    result = await generate_forensic_executive_brief(request.model_dump())
    return AISummaryResponse(
        summary=result["text"],
        model_used=result["model_used"],
        fallback_applied=result["fallback_applied"],
        is_offline_simulated=result["is_offline_simulated"],
        success=result["success"],
        error=result.get("error"),
    )


@router.post(
    "/explain-shap",
    response_model=AISummaryResponse,
    summary="Translate SHAP anomaly features into plain-English explanation",
)
async def explain_shap(request: AIExplainShapRequest) -> AISummaryResponse:
    """
    Provide human-readable forensic interpretation of why an address/transaction was flagged.
    """
    result = await explain_shap_attribution(request.model_dump())
    return AISummaryResponse(
        summary=result["text"],
        model_used=result["model_used"],
        fallback_applied=result["fallback_applied"],
        is_offline_simulated=result["is_offline_simulated"],
        success=result["success"],
        error=result.get("error"),
    )


@router.post(
    "/copilot",
    response_model=AICopilotResponse,
    summary="Interactive forensic investigation co-pilot query",
)
async def forensic_copilot(request: AICopilotRequest) -> AICopilotResponse:
    """
    Query the forensic assistant on Bitcoin transaction typologies, wallet behaviors, or investigation tips.
    """
    system_instruction = (
        "You are NeuralChain AI Co-Pilot, a specialized forensic assistant for Bitcoin UTXO blockchain "
        "surveillance and money laundering investigations (SIH 2026 / NTRO). Provide concise, technical, "
        "and actionable guidance on crypto clustering, peel chains, tumblers, and evidence preservation."
    )
    user_prompt = request.prompt
    if request.context:
        user_prompt += f"\n\nInvestigation Context:\n{request.context}"

    result = await generate_content_with_fallback_async(
        prompt=user_prompt,
        system_instruction=system_instruction,
    )
    return AICopilotResponse(
        response=result["text"],
        model_used=result["model_used"],
        fallback_applied=result["fallback_applied"],
        is_offline_simulated=result["is_offline_simulated"],
        success=result["success"],
        error=result.get("error"),
    )
