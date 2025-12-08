"""
prompt_optimization.py
Rutas FastAPI para optimización de prompts usando Qwen2.5 + Ollama.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.prompt_optimizer import improve_prompt, PromptImprovement

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


class PromptOptimizeRequest(BaseModel):
    """Solicitud para optimizar un prompt."""
    prompt: str
    deep_thinking: bool = False
    model: str = "qwen2.5:7b-instruct"


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
    Optimiza un prompt usando Qwen2.5 vía Ollama.

    - **prompt**: Prompt original a optimizar
    - **deep_thinking**: Si True, genera un prompt más detallado
    - **model**: Modelo de Ollama a usar (default: qwen2.5:7b-instruct)

    Devuelve un prompt mejorado siguiendo mejores prácticas de prompt engineering.
    """
    try:
        result: PromptImprovement = improve_prompt(
            raw_prompt=payload.prompt,
            deep_thinking=payload.deep_thinking,
            model=payload.model,
        )

        return PromptOptimizeResponse(
            success=True,
            improved_prompt=result.improved_prompt,
            rationale=result.rationale,
            checklist=result.checklist,
        )

    except Exception as e:
        return PromptOptimizeResponse(
            success=False,
            improved_prompt="",
            rationale="",
            checklist=[],
            error=f"Error al optimizar prompt: {str(e)}",
        )


@router.get("/health/optimizer")
async def health_check() -> dict:
    """
    Verifica que el servicio de optimización de prompts esté disponible.
    """
    return {
        "status": "ok",
        "service": "prompt-optimizer",
        "model": "qwen2.5:7b-instruct",
        "endpoints": {
            "/optimize": "POST - Optimiza un prompt con Qwen2.5"
        }
    }
