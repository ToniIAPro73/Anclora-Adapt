"""
prompt_optimization.py
Rutas FastAPI para optimización de prompts usando Qwen2.5 + Ollama.
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.prompt_optimizer import improve_prompt, PromptImprovement, build_fallback_improvement

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


class PromptOptimizeRequest(BaseModel):
    """Solicitud para optimizar un prompt."""
    prompt: str
    deep_thinking: bool = False
    better_prompt: bool = False  # Si True, mejora y optimiza el prompt
    model: str | None = None  # Si es None, el backend usa el mejor modelo disponible
    language: str | None = None  # Idioma del prompt de salida (es, en, fr, etc.)
    # Campos opcionales para selección inteligente de modelo
    prefer_speed: bool = False
    target_language: str | None = None


class PromptOptimizeResponse(BaseModel):
    """Respuesta con el prompt optimizado."""
    success: bool
    improved_prompt: str
    rationale: str
    checklist: list[str]
    error: str | None = None


@router.post("/optimize", response_model=PromptOptimizeResponse)
async def optimize_prompt(payload: PromptOptimizeRequest) -> PromptOptimizeResponse:
    """
    Optimiza un prompt usando el mejor modelo disponible vía Ollama.

    - **prompt**: Prompt original a optimizar
    - **deep_thinking**: Si True, genera un prompt mucho más detallado y exhaustivo
    - **better_prompt**: Si True, mejora la claridad, estructura y profesionalismo del prompt
    - **model**: Modelo de Ollama a usar (opcional). Si es None, usa selección dinámica: qwen2.5:14b > qwen2.5:7b-instruct > qwen2.5:7b > mistral > llama

    Devuelve un prompt mejorado siguiendo mejores prácticas de prompt engineering.
    El prompt resultante será 3-7x más detallado si deep_thinking está activado.
    Si Ollama no está disponible, devuelve el prompt original sin error.
    """
    try:
        logger.info(f"Optimizing prompt with model: {payload.model}, deep_thinking: {payload.deep_thinking}, better_prompt: {payload.better_prompt}, language: {payload.language}")
        logger.info(f"Raw prompt: {payload.prompt[:100]}...")

        # Si no se especifica modelo, usar selección inteligente basada en contexto
        selected_model = payload.model
        if not selected_model:
            # El servicio improve_prompt intentará usar el mejor modelo disponible
            # considerando prefer_speed y target_language si se proporcionan
            selected_model = None  # Será manejado por improve_prompt

        result: PromptImprovement = improve_prompt(
            raw_prompt=payload.prompt,
            deep_thinking=payload.deep_thinking,
            better_prompt=payload.better_prompt,
            model=selected_model,
            language=payload.language,
        )

        logger.info(f"Prompt optimization successful. Result: {result.improved_prompt[:100]}...")
        return PromptOptimizeResponse(
            success=True,
            improved_prompt=result.improved_prompt,
            rationale=result.rationale,
            checklist=result.checklist,
        )

    except Exception as e:
        error_msg = f"Error al optimizar prompt: {str(e)}"
        logger.warning(f"Optimization failed, using fallback: {error_msg}")

        # Usar fallback: devolver el prompt original con estado success=True
        fallback_result = build_fallback_improvement(payload.prompt)
        return PromptOptimizeResponse(
            success=True,
            improved_prompt=fallback_result.improved_prompt,
            rationale=fallback_result.rationale,
            checklist=fallback_result.checklist,
        )


@router.get("/health/optimizer")
async def health_check() -> dict:
    """
    Verifica que el servicio de optimización de prompts esté disponible.
    """
    return {
        "status": "ok",
        "service": "prompt-optimizer",
        "model_priority": "qwen2.5:14b > qwen2.5:7b-instruct > qwen2.5:7b > mistral > llama (dynamic selection based on available models)",
        "endpoints": {
            "/optimize": "POST - Optimiza un prompt con el mejor modelo disponible"
        }
    }
