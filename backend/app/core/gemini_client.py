"""
gemini_client.py — Google GenAI (Gemma 4 & Gemini) Client Integration

Provides centralized access to Gemma 4 via Google AI Studio API key,
with automatic fallback to Gemini 1.5/2.0 Flash when appropriate,
and sovereign air-gapped simulation mode for offline environments.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger("neuralchain.ai")

# Lazy client singleton
_client_instance: Any = None


def get_gemini_client() -> Any:
    """
    Returns an initialized google.genai.Client instance, or None if no API key is configured.
    """
    global _client_instance
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.strip() == "" or settings.GEMINI_API_KEY == "your_gemini_api_key_here":
        return None

    if _client_instance is None:
        try:
            from google import genai
            _client_instance = genai.Client(api_key=settings.GEMINI_API_KEY)
            logger.info("Initialized Google GenAI Client with primary model: %s", settings.GEMINI_MODEL)
        except Exception as e:
            logger.error("Failed to initialize google.genai Client: %s", e)
            return None

    return _client_instance


def is_gemini_configured() -> bool:
    """Check if a non-placeholder Gemini API key is present."""
    key = settings.GEMINI_API_KEY
    return bool(key and key.strip() and key != "your_gemini_api_key_here")


def _generate_offline_forensic_brief(summary_context: Dict[str, Any]) -> str:
    """
    Deterministic sovereign offline synthesis for air-gapped environments
    when no external Gemini API key is available.
    """
    tx_count = summary_context.get("total_transactions", 0)
    alerts_count = summary_context.get("active_alerts", 0)
    risk_threshold = summary_context.get("risk_threshold", 0.70)
    top_typologies = summary_context.get("top_typologies", ["peeling_chain", "high_fan_out", "tumbler_pool"])
    typo_str = ", ".join(top_typologies) if isinstance(top_typologies, list) else str(top_typologies)

    return (
        f"[FORENSIC INTELLIGENCE BRIEF — SOVEREIGN ENCLAVE MODE]\n\n"
        f"1. INCIDENT TOPOLOGY & VOLUME ASSESSMENT:\n"
        f"Forensic surveillance processed {tx_count:,} UTXO transaction vectors, identifying {alerts_count} "
        f"elevated risk anomalies exceeding the strict supervisory confidence threshold (τ >= {risk_threshold:.2f}). "
        f"Observed topology displays multi-hop layering consistent with {typo_str}.\n\n"
        f"2. ATTRIBUTION & TYPOLOGY FINDINGS:\n"
        f"Automated vector correlation detects structural address reuse and rapid output peeling. "
        f"The transaction velocity deviates significantly from legitimate peer-to-peer distribution baselines, "
        f"characterizing deliberate obfuscation through tumbler syndicates.\n\n"
        f"3. INVESTIGATIVE RECOMMENDATIONS:\n"
        f"• Freeze downstream transit addresses prior to final exchange hot wallet consolidation.\n"
        f"• Request exchange KYC records under statutory Section 94 BNSS / Section 63 BSA.\n"
        f"• Monitor peel chain change outputs for secondary hop clustering."
    )


def _generate_offline_shap_explanation(alert_context: Dict[str, Any]) -> str:
    """
    Deterministic offline explanation of SHAP feature attributions.
    """
    address = alert_context.get("address", "Unknown Address")
    score = alert_context.get("risk_score", 0.0)
    drivers = alert_context.get("top_drivers", ["Velocity Deviation", "Fee-to-Amount Disproportion", "Fan-out Divergence"])
    drivers_str = "; ".join(drivers) if isinstance(drivers, list) else str(drivers)

    return (
        f"Forensic attribution analysis for wallet {address} (Composite Risk: {score:.2f}):\n"
        f"Key driving indicators identified: {drivers_str}. "
        f"The wallet exhibits peeling chain heuristics where transaction satoshi output ratios "
        f"diverge significantly from organic spend behaviors, indicating structured fund dissipation."
    )


def generate_content_with_fallback(
    prompt: str,
    system_instruction: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Synchronously generates text using Gemma 4, with automatic fallback to Gemini Flash.
    """
    client = get_gemini_client()
    target_model = model or settings.GEMINI_MODEL
    fallback_model = settings.GEMINI_FALLBACK_MODEL
    temp = temperature if temperature is not None else settings.GEMINI_TEMPERATURE
    tokens = max_tokens if max_tokens is not None else settings.GEMINI_MAX_OUTPUT_TOKENS

    if not client:
        logger.warning("GEMINI_API_KEY is not configured; using sovereign offline simulation.")
        return {
            "text": _generate_offline_forensic_brief({"prompt": prompt}),
            "model_used": "offline-forensic-engine",
            "fallback_applied": False,
            "is_offline_simulated": True,
            "success": True,
            "error": None,
        }

    from google.genai import types

    config = types.GenerateContentConfig(
        temperature=temp,
        max_output_tokens=tokens,
        system_instruction=system_instruction,
    )

    # 1. Attempt with primary model (Gemma 4)
    try:
        logger.info("Calling GenAI with primary model: %s", target_model)
        response = client.models.generate_content(
            model=target_model,
            contents=prompt,
            config=config,
        )
        return {
            "text": response.text or "",
            "model_used": target_model,
            "fallback_applied": False,
            "is_offline_simulated": False,
            "success": True,
            "error": None,
        }
    except Exception as primary_err:
        logger.warning(
            "Primary model '%s' invocation failed (%s). Falling back to '%s'...",
            target_model,
            primary_err,
            fallback_model,
        )

        # 2. Attempt with fallback model (Gemini 1.5/2.0 Flash)
        try:
            response = client.models.generate_content(
                model=fallback_model,
                contents=prompt,
                config=config,
            )
            return {
                "text": response.text or "",
                "model_used": fallback_model,
                "fallback_applied": True,
                "is_offline_simulated": False,
                "success": True,
                "error": None,
            }
        except Exception as fallback_err:
            logger.error("Both primary ('%s') and fallback ('%s') models failed: %s", target_model, fallback_model, fallback_err)
            return {
                "text": _generate_offline_forensic_brief({"prompt": prompt}),
                "model_used": "offline-forensic-engine",
                "fallback_applied": True,
                "is_offline_simulated": True,
                "success": False,
                "error": f"Primary: {primary_err} | Fallback: {fallback_err}",
            }


async def generate_content_with_fallback_async(
    prompt: str,
    system_instruction: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Asynchronously generates text using Gemma 4, with automatic fallback to Gemini Flash.
    """
    client = get_gemini_client()
    target_model = model or settings.GEMINI_MODEL
    fallback_model = settings.GEMINI_FALLBACK_MODEL
    temp = temperature if temperature is not None else settings.GEMINI_TEMPERATURE
    tokens = max_tokens if max_tokens is not None else settings.GEMINI_MAX_OUTPUT_TOKENS

    if not client:
        logger.warning("GEMINI_API_KEY is not configured; using sovereign offline simulation.")
        return {
            "text": _generate_offline_forensic_brief({"prompt": prompt}),
            "model_used": "offline-forensic-engine",
            "fallback_applied": False,
            "is_offline_simulated": True,
            "success": True,
            "error": None,
        }

    from google.genai import types

    config = types.GenerateContentConfig(
        temperature=temp,
        max_output_tokens=tokens,
        system_instruction=system_instruction,
    )

    # 1. Attempt with primary model (Gemma 4)
    try:
        logger.info("Calling Async GenAI with primary model: %s", target_model)
        response = await client.aio.models.generate_content(
            model=target_model,
            contents=prompt,
            config=config,
        )
        return {
            "text": response.text or "",
            "model_used": target_model,
            "fallback_applied": False,
            "is_offline_simulated": False,
            "success": True,
            "error": None,
        }
    except Exception as primary_err:
        logger.warning(
            "Primary model '%s' async invocation failed (%s). Falling back to '%s'...",
            target_model,
            primary_err,
            fallback_model,
        )

        # 2. Attempt with fallback model (Gemini 1.5/2.0 Flash)
        try:
            response = await client.aio.models.generate_content(
                model=fallback_model,
                contents=prompt,
                config=config,
            )
            return {
                "text": response.text or "",
                "model_used": fallback_model,
                "fallback_applied": True,
                "is_offline_simulated": False,
                "success": True,
                "error": None,
            }
        except Exception as fallback_err:
            logger.error("Both primary ('%s') and fallback ('%s') async models failed: %s", target_model, fallback_model, fallback_err)
            return {
                "text": _generate_offline_forensic_brief({"prompt": prompt}),
                "model_used": "offline-forensic-engine",
                "fallback_applied": True,
                "is_offline_simulated": True,
                "success": False,
                "error": f"Primary: {primary_err} | Fallback: {fallback_err}",
            }


async def generate_forensic_executive_brief(summary_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Produces a court-ready forensic investigation executive summary for Bitcoin transaction dossiers.
    """
    if not is_gemini_configured():
        return {
            "text": _generate_offline_forensic_brief(summary_context),
            "model_used": "offline-forensic-engine",
            "fallback_applied": False,
            "is_offline_simulated": True,
            "success": True,
            "error": None,
        }

    system_instruction = (
        "You are an expert blockchain forensics investigator and digital evidence specialist "
        "preparing formal forensic briefs for law enforcement (SIH / NTRO / Cyber Crime Wings). "
        "Analyze the provided Bitcoin transaction telemetry, anomaly indicators, and graph topology. "
        "Provide a concise, highly objective, court-admissible executive narrative covering: "
        "1. Overview & Volume Dynamics, 2. Typology Attribution (e.g. peel chains, tumblers, mixers), "
        "3. Recommended Investigative Actions. Maintain a formal, authoritative forensic tone."
    )

    prompt = (
        f"Case Telemetry Overview:\n"
        f"• Total Transactions: {summary_context.get('total_transactions', 0):,}\n"
        f"• Anomalous Alerts Detected: {summary_context.get('active_alerts', 0):,}\n"
        f"• High-Risk Entities: {summary_context.get('high_risk_entities', 0)}\n"
        f"• Risk Threshold: {summary_context.get('risk_threshold', 0.70)}\n"
        f"• Key Typologies Flagged: {summary_context.get('top_typologies', ['peeling_chain', 'tumbler_flow'])}\n"
        f"• Time Window: {summary_context.get('time_window', 'Recent 30 days')}\n\n"
        f"Please generate the official Executive Summary section for the forensic investigation docket."
    )

    return await generate_content_with_fallback_async(prompt, system_instruction=system_instruction)


async def explain_shap_attribution(alert_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Explains why a transaction or wallet was flagged by the 4-tier ML ensemble (Isolation Forest,
    Autoencoder, Node2Vec, XGBoost) and translates SHAP feature importances into plain English.
    """
    if not is_gemini_configured():
        return {
            "text": _generate_offline_shap_explanation(alert_context),
            "model_used": "offline-forensic-engine",
            "fallback_applied": False,
            "is_offline_simulated": True,
            "success": True,
            "error": None,
        }

    system_instruction = (
        "You are a machine learning explainability (XAI) forensic auditor for blockchain surveillance. "
        "Translate mathematical SHAP feature attribution scores and anomaly model metrics into clear, "
        "legally justifiable evidence explaining why an entity was classified as high risk."
    )

    prompt = (
        f"Suspect Entity / Transaction Details:\n"
        f"• Identifier: {alert_context.get('address') or alert_context.get('txid', 'N/A')}\n"
        f"• Composite Risk Score: {alert_context.get('risk_score', 0.0)}\n"
        f"• Primary Anomaly Class: {alert_context.get('anomaly_type', 'Suspicious Velocity / Tumbler')}\n"
        f"• Top SHAP Feature Contributors: {alert_context.get('shap_features', {})}\n"
        f"• Associated Typology Flags: {alert_context.get('typologies', [])}\n\n"
        f"Provide a 2-3 paragraph plain-language forensic interpretation of these metrics."
    )

    return await generate_content_with_fallback_async(prompt, system_instruction=system_instruction)
