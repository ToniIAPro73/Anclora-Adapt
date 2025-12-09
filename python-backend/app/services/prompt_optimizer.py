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
Eres un ingeniero de prompts EXPERTO en marketing digital y content creation. Tu trabajo es transformar briefings breves en prompts profesionales, detallados y altamente efectivos.

PRINCIPIOS CLAVE:
1. **Estructura clara**: Todo prompt debe tener rol, contexto, objetivo, restricciones y formato de salida
2. **Detalle estratégico**: Añade información de valor sobre el público, la plataforma, el tono y el enfoque
3. **Lenguaje profesional**: Mantén el idioma original, usa vocabulario preciso y términos del marketing
4. **Restricciones explícitas**: Define exactamente QUÉ HACER y QUÉ NO HACER
5. **Ejemplos cuando sea necesario**: Proporciona muestras de salida esperada si mejora la claridad

ESTRUCTURA QUE DEBES SEGUIR:
- **ROL**: Define claramente el rol/persona del modelo (ej: "Eres un especialista en marketing inmobiliario...")
- **CONTEXTO AMPLIO**: Explica el escenario, el público objetivo, el objetivo de negocio
- **ESPECIFICIDAD**: Demográfica, psicográfica, pain points del cliente
- **PLATAFORMA**: Si es para redes sociales, menciona la plataforma, formato, límites de caracteres
- **OBJETIVO PRINCIPAL**: Qué quieres lograr (engagement, conversión, posicionamiento, etc.)
- **TONO Y ESTILO**: Formal, coloquial, experto, inspirador, etc.
- **RESTRICCIONES**: Lo que NO debe incluir, errores a evitar
- **FORMATO DE SALIDA**: Cómo debe estructurarse la respuesta
- **EJEMPLOS**: Opcional pero recomendado para claridad

MEJORAS QUE DEBES HACER:
- Amplía significativamente el contexto (3-4x más detalle)
- Añade instrucciones sobre tono, lenguaje y estilo de escritura
- Define KPIs o métricas de éxito implícitamente
- Incluye consideraciones culturales si son relevantes
- Especifica la longitud y densidad de información esperada
- Añade "pistas" sobre cómo estructurar el contenido

Mantén el idioma del prompt original. Sé directo, profesional y útil.
""".strip()


def build_optimizer_messages(raw_prompt: str, deep_thinking: bool = False, language: str = None) -> list[dict]:
    """Construye el array de mensajes para ollama.chat()."""
    # Si no se especifica idioma, usar español por defecto
    if not language:
        language = "es"

    # Mapeo de códigos de idioma a nombres legibles
    language_names = {
        "es": "español",
        "en": "inglés",
        "fr": "francés",
        "de": "alemán",
        "it": "italiano",
        "pt": "portugués",
        "ja": "japonés",
        "zh": "chino",
        "ar": "árabe",
    }

    language_name = language_names.get(language, "español")

    detail_instruction = ""
    if deep_thinking:
        detail_instruction = """

⚠️ IMPORTANTE - PENSAMIENTO PROFUNDO ACTIVADO:
El usuario ha marcado 'Pensamiento profundo'. Esto significa:
- AMPLÍA el prompt sustancialmente (5-7x más detallado que el original)
- AÑADE secciones completas sobre: público objetivo detallado, buyer personas, pain points, objections, CTAs específicos
- INCLUYE ejemplos concretos de salida esperada
- DETALLA restricciones y "pitfalls" a evitar
- ESPECIFICA KPIs, métricas y objetivos de negocio
- PROPORCIONA guía sobre tono, lenguaje, estilo de redacción
- ESTRUCTURA el contenido de forma clara y escalable

El prompt resultante debe ser 4-5 veces más extenso y detallado que el original."""

    user_content = f"""
Vas a recibir un PROMPT_ORIGINAL escrito por el usuario. Este es un brief o resumen que NECESITA ser transformado en un prompt profesional completo.

Tu tarea:
1. **ANALIZAR** el brief: identifica el rol, el objetivo, la audiencia, la plataforma
2. **EXPANDIR significativamente** usando la estructura que te di: rol detallado, contexto amplio, restricciones claras, formato de salida
3. **ENRIQUECER** con información de marketing: buyer personas, CTAs, metricas de éxito, consideraciones culturales
4. **DEVOLVER ÚNICAMENTE** un objeto JSON con esta estructura exacta:

{{
  "improved_prompt": "PROMPT FINAL PROFESIONAL Y DETALLADO - LISTO PARA USAR CON UN LLM",
  "rationale": "RESUMEN BREVE (máx. 10 líneas) explicando los cambios clave y mejoras aplicadas",
  "checklist": [
    "punto clave que el usuario debería revisar",
    "elemento importante a personalizar",
    "consideración estratégica"
  ]
}}

REGLAS OBLIGATORIAS:
- ✓ Mantén EXACTAMENTE el idioma del PROMPT_ORIGINAL ({language_name} en este caso)
- ✓ Preserva la intención fundamental del usuario
- ✓ El "improved_prompt" debe ser PROFESIONAL, DETALLADO y LISTO PARA PRODUCCIÓN
- ✓ NO abrevies ni simplifiques - EXPANDE y ENRIQUECE
- ✓ Si hay lagunas, menciónalo en la checklist para que el usuario las complete
- ✓ Devuelve SOLO el JSON, sin explicaciones adicionales
- ✓ IMPORTANTE: Genera la respuesta SIEMPRE en {language_name.upper()}, no en otro idioma{detail_instruction}

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
    model: str = None,
    language: str = None,
) -> PromptImprovement:
    """
    Llama al modelo local vía Ollama (HTTP) y devuelve un PromptImprovement.

    raw_prompt: prompt original escrito por el usuario.
    deep_thinking: si True, pide un prompt más detallado y exhaustivo.
    model: nombre del modelo en Ollama. Si es None, usa la mejor opción disponible.
           Prioridad: mistral > qwen2.5:14b > qwen2.5:7b-instruct
    language: idioma de salida del prompt (e.g., 'es', 'en', 'fr'). Si es None, usa español.
    """
    # Si no se especifica modelo, usar el mejor disponible
    if not model:
        model = "mistral:latest"  # Mistral es excelente para prompt engineering

    messages = build_optimizer_messages(raw_prompt, deep_thinking, language)

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

        response = requests.post(OLLAMA_API_URL, json=payload, timeout=300)
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


def build_fallback_improvement(raw_prompt: str) -> PromptImprovement:
    """
    Construye un PromptImprovement fallback cuando Ollama no está disponible.
    Devuelve el prompt original como fallback garantizando estructura JSON válida.
    """
    return PromptImprovement(
        improved_prompt=raw_prompt,
        rationale="Backend de optimización no disponible. Se devuelve el prompt original.",
        checklist=[
            "Verifica que Ollama esté corriendo (ollama serve)",
            "Considera usar el prompt tal cual o refinarlo manualmente",
            "El prompt original es funcional pero podría mejorarse con optimización"
        ]
    )


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
