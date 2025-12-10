"""
model_selector.py
Selecciona dinámicamente los mejores modelos disponibles en Ollama
basándose en calidad, tamaño y disponibilidad.
"""

import logging
import requests
from typing import List

logger = logging.getLogger(__name__)

OLLAMA_API_URL = "http://localhost:11434/api/tags"

# Modelos ordenados por preferencia (mejor a peor)
MODEL_PRIORITY = [
    "qwen2.5:14b",      # 1. Mejor: 14B params, excelente calidad
    "qwen2.5:7b-instruct",  # 2. Optimizado para instrucciones
    "qwen2.5:7b",       # 3. Fallback Qwen
    "mistral:latest",   # 4. Alternativa: buen rendimiento
    "mistral",
    "llama3.2:latest",  # 5. Última opción
    "llama3.2",
    "llama2:latest",
    "llama2",
]


def get_available_models() -> List[str]:
    """
    Obtiene la lista de modelos actualmente disponibles en Ollama.

    Returns:
        Lista de nombres de modelos disponibles, o lista vacía si no se puede conectar.
    """
    try:
        response = requests.get(OLLAMA_API_URL, timeout=5)
        response.raise_for_status()
        data = response.json()

        # Extraer nombres de modelos, removiendo etiquetas (:latest, etc)
        models = []
        for model in data.get("models", []):
            model_name = model.get("name", "")
            if model_name:
                models.append(model_name)

        logger.info(f"Available models in Ollama: {models}")
        return models
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Cannot connect to Ollama at {OLLAMA_API_URL}: {str(e)}")
        return []
    except Exception as e:
        logger.warning(f"Could not fetch available models: {str(e)}")
        return []


def select_best_models(available_models: List[str], count: int = 3) -> List[str]:
    """
    Selecciona los mejores modelos disponibles ordenados por preferencia.

    Args:
        available_models: Lista de modelos disponibles en Ollama
        count: Cantidad de modelos a retornar (default: 3)

    Returns:
        Lista ordenada de los mejores modelos disponibles
    """
    if not available_models:
        logger.warning("No available models provided, using model priority list as fallback")
        # Si no hay modelos disponibles, retornar la lista prioritaria como fallback
        # Esto asume que al menos uno de estos modelos está disponible en Ollama
        return MODEL_PRIORITY[:count]

    selected = []

    # Iterar sobre la lista prioritaria
    for priority_model in MODEL_PRIORITY:
        for available in available_models:
            # Verificar si el modelo prioritario coincide con uno disponible
            # (ej: "qwen2.5:14b" coincide con "qwen2.5:14b")
            if priority_model.lower() in available.lower() or available.lower() in priority_model.lower():
                if available not in selected:
                    selected.append(available)
                    logger.info(f"Selected model #{len(selected)}: {available}")

                    if len(selected) >= count:
                        logger.info(f"Returning top {count} models: {selected}")
                        return selected

    # Si no hay suficientes candidatos prioritarios, retornar los disponibles
    if selected:
        logger.info(f"Returning {len(selected)} best available models: {selected}")
        return selected

    # Último recurso: retornar lo que sea disponible
    logger.warning(f"No priority models found, using available: {available_models[:count]}")
    return available_models[:count]


def get_model_candidates(available_models: List[str] | None = None, count: int = 3) -> List[str]:
    """
    Obtiene dinámicamente los mejores modelos candidatos para usar.

    Args:
        available_models: Lista de modelos disponibles (si None, la obtiene automáticamente)
        count: Cantidad de modelos a retornar (default: 3)

    Returns:
        Lista ordenada de los mejores modelos disponibles
    """
    if available_models is None:
        available_models = get_available_models()

    return select_best_models(available_models, count)
