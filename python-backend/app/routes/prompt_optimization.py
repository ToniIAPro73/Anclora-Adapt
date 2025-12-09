"""
prompt_optimization.py
Rutas FastAPI para optimización de prompts usando Qwen2.5 + Ollama.
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.prompt_optimizer import improve_prompt, PromptImprovement

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


class PromptOptimizeRequest(BaseModel):
    """Solicitud para optimizar un prompt."""
    prompt: str
    deep_thinking: bool = False
    model: str | None = None  # Si es None, el backend usa el mejor modelo disponible
    language: str | None = None  # Idioma del prompt de salida (es, en, fr, etc.)


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
    - **model**: Modelo de Ollama a usar (opcional). Si es None, usa: mistral > qwen2.5:14b > qwen2.5:7b

    Devuelve un prompt mejorado siguiendo mejores prácticas de prompt engineering.
    El prompt resultante será 3-7x más detallado si deep_thinking está activado.
    """
    try:
        logger.info(f"Optimizing prompt with model: {payload.model}, deep_thinking: {payload.deep_thinking}, language: {payload.language}")
        logger.info(f"Raw prompt: {payload.prompt[:100]}...")

        result: PromptImprovement = improve_prompt(
            raw_prompt=payload.prompt,
            deep_thinking=payload.deep_thinking,
            model=payload.model,
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
        logger.error(f"{error_msg}", exc_info=True)
        return PromptOptimizeResponse(
            success=False,
            improved_prompt="",
            rationale="",
            checklist=[],
            error=error_msg,
        )


@router.get("/health/optimizer")
async def health_check() -> dict:
    """
    Verifica que el servicio de optimización de prompts esté disponible.
    """
    return {
        "status": "ok",
        "service": "prompt-optimizer",
        "model_priority": "mistral:latest > qwen2.5:14b > qwen2.5:7b",
        "endpoints": {
            "/optimize": "POST - Optimiza un prompt con el mejor modelo disponible"
        }
    }
