"""
prompt_optimizer.py
Optimizador de prompts usando un LLM open source vía Ollama (Qwen2.5).
"""

from __future__ import annotations

import logging
import json
import requests
from typing import List
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# URL del servidor Ollama
OLLAMA_API_URL = "http://localhost:11434/api/chat"


# 1) Esquema de salida que queremos del modelo
class PromptImprovement(BaseModel):
    improved_prompt: str
    rationale: str
    checklist: List[str]


# 2) Prompt de sistema del "ingeniero de prompts"
PROMPT_ENGINEER_SYSTEM_PROMPT = """
Eres un ingeniero de prompts senior especializado en diseñar instrucciones claras,
robustas y reutilizables para modelos de lenguaje.

Objetivo:
- Recibir un prompt inicial.
- Devolver una versión optimizada que:
  - Tenga rol claro (quién es el modelo).
  - Explique el contexto y el objetivo final.
  - Especifique entradas y salida esperada.
  - Defina formato de salida (texto libre, JSON, lista, etc.).
  - Incluya reglas y límites (qué hacer y qué NO hacer).
  - Use ejemplos breves si aportan claridad.
  - Sea precisa, no redundante.

Buenas prácticas:
- Mantén el idioma del prompt original.
- Simplifica formulaciones ambiguas.
- Evita órdenes contradictorias.
- Si detectas lagunas (falta de info), añade TODOs o comentarios
  para que el usuario los complete.
- Pide al modelo que organice su razonamiento internamente, pero
  que en la respuesta final sólo muestre el resultado y, como mucho,
  un resumen breve del porqué (no el razonamiento paso a paso).
""".strip()


def build_optimizer_messages(raw_prompt: str, deep_thinking: bool = False) -> list[dict]:
    """Construye el array de mensajes para ollama.chat()."""
    detail_instruction = ""
    if deep_thinking:
        detail_instruction = "\nNota: El usuario ha marcado 'Pensamiento profundo', así que proporciona un prompt MUCHO MÁS detallado y exhaustivo, con más contexto, restricciones y ejemplos."

    user_content = f"""
Vas a recibir un PROMPT_ORIGINAL escrito por el usuario.

Tu tarea:
1. Analizarlo.
2. Reescribirlo y ampliarlo aplicando las mejores prácticas actuales de
   ingeniería de prompts.
3. Devolver ÚNICAMENTE un objeto JSON con esta estructura:

{{
  "improved_prompt": "prompt final listo para usar con un LLM",
  "rationale": "breve explicación (máx. 10 líneas) de los cambios clave",
  "checklist": [
    "punto 1 que el usuario debería revisar o completar",
    "punto 2...",
    "..."
  ]
}}

Notas:
- Mantén el idioma del PROMPT_ORIGINAL.
- No cambies la intención fundamental del usuario.
- Si algo es confuso o falta información, menciónalo en la checklist.{detail_instruction}

PROMPT_ORIGINAL:
\"\"\"{raw_prompt}\"\"\"
""".strip()

    return [
        {"role": "system", "content": PROMPT_ENGINEER_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


def improve_prompt(
    raw_prompt: str,
    deep_thinking: bool = False,
    model: str = "qwen2.5:7b-instruct",
) -> PromptImprovement:
    """
    Llama al modelo local vía Ollama (HTTP) y devuelve un PromptImprovement.

    raw_prompt: prompt original escrito por el usuario.
    deep_thinking: si True, pide un prompt más detallado y exhaustivo.
    model: nombre del modelo en Ollama (Qwen2.5 recomendado).
    """
    messages = build_optimizer_messages(raw_prompt, deep_thinking)

    try:
        logger.info(f"Calling Ollama API at {OLLAMA_API_URL}")

        # Hacer petición HTTP a Ollama
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.3,
            }
        }

        logger.debug(f"Payload: {json.dumps(payload, indent=2, ensure_ascii=False)[:200]}...")

        response = requests.post(OLLAMA_API_URL, json=payload, timeout=120)
        response.raise_for_status()

        response_data = response.json()
        logger.debug(f"Response status: {response.status_code}")
        logger.debug(f"Response data keys: {response_data.keys()}")

        # Extraer el contenido de la respuesta
        if "message" not in response_data:
            raise ValueError(f"La respuesta no contiene 'message': {response_data}")

        message = response_data["message"]
        if "content" not in message:
            raise ValueError(f"El message no contiene 'content': {message}")

        content = message["content"]
        logger.debug(f"Raw content from Ollama:\n{content[:200]}...")

        # Parsear el JSON de la respuesta
        try:
            json_data = json.loads(content)
        except json.JSONDecodeError as e:
            logger.error(f"Could not parse JSON from content: {content}")
            raise ValueError(f"La respuesta no es un JSON válido: {str(e)}")

        # Validar que tiene los campos requeridos
        improved_prompt = json_data.get("improved_prompt", "")
        rationale = json_data.get("rationale", "")
        checklist = json_data.get("checklist", [])

        if not improved_prompt:
            raise ValueError("El JSON no contiene 'improved_prompt' o está vacío")

        logger.info(f"Successfully parsed improved prompt ({len(improved_prompt)} chars)")

        return PromptImprovement(
            improved_prompt=improved_prompt,
            rationale=rationale,
            checklist=checklist if isinstance(checklist, list) else []
        )

    except requests.exceptions.ConnectionError as e:
        logger.error(f"Cannot connect to Ollama at {OLLAMA_API_URL}: {str(e)}")
        raise ValueError(f"No se puede conectar a Ollama. ¿Está ejecutándose en {OLLAMA_API_URL}?")
    except requests.exceptions.Timeout:
        logger.error("Ollama request timed out")
        raise ValueError("La solicitud a Ollama expiró")
    except Exception as e:
        logger.error(f"Error in improve_prompt: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    original = input("Escribe el prompt original:\n\n> ")
    deep = input("\n¿Pensamiento profundo? (s/n): ").lower() == 's'
    result = improve_prompt(original, deep_thinking=deep)

    print("\n=== PROMPT MEJORADO ===\n")
    print(result.improved_prompt)

    print("\n=== RAZONAMIENTO RESUMIDO ===\n")
    print(result.rationale)

    print("\n=== CHECKLIST PARA REVISAR ===")
    for i, item in enumerate(result.checklist, start=1):
        print(f"- [{i}] {item}")
