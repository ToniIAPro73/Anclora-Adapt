"""
prompt_optimizer.py
Optimizador de prompts usando un LLM open source vía Ollama (Qwen2.5).
"""

from __future__ import annotations

import json
import logging
from typing import List

import requests
from pydantic import BaseModel

from app.config import OLLAMA_CHAT_URL
from app.services.model_selector import get_model_candidates

logger = logging.getLogger(__name__)


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


def build_optimizer_messages(raw_prompt: str, deep_thinking: bool = False, better_prompt: bool = False, language: str | None = None) -> list[dict]:
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
    if deep_thinking and better_prompt:
        # Ambos activados: profundidad Y mejora
        detail_instruction = """

⚠️ IMPORTANTE - PENSAMIENTO PROFUNDO + MEJORAR PROMPT ACTIVADOS:
El usuario ha marcado ambas opciones. Esto significa:
- AMPLÍA el prompt sustancialmente (5-7x más detallado que el original)
- OPTIMIZA para máxima claridad, pasos accionables y coherencia narrativa
- AÑADE secciones completas sobre: público objetivo detallado, buyer personas, pain points, objections, CTAs específicos
- INCLUYE ejemplos concretos de salida esperada
- DETALLA restricciones y "pitfalls" a evitar
- ESPECIFICA KPIs, métricas y objetivos de negocio
- PROPORCIONA guía completa sobre tono, lenguaje, estilo de redacción
- ESTRUCTURA el contenido de forma clara, escalable y profesional

El prompt resultante debe ser 5-7 veces más extenso, detallado Y completamente optimizado para producción."""
    elif deep_thinking:
        # Solo pensamiento profundo
        detail_instruction = """

⚠️ IMPORTANTE - PENSAMIENTO PROFUNDO ACTIVADO:
El usuario ha marcado 'Pensamiento profundo'. Esto significa:
- AMPLÍA el prompt sustancialmente (4-5x más detallado que el original)
- AÑADE secciones completas sobre: público objetivo detallado, buyer personas, pain points, objections, CTAs específicos
- INCLUYE ejemplos concretos de salida esperada
- DETALLA restricciones y "pitfalls" a evitar
- ESPECIFICA KPIs, métricas y objetivos de negocio
- PROPORCIONA guía sobre tono, lenguaje, estilo de redacción
- ESTRUCTURA el contenido de forma clara y escalable

El prompt resultante debe ser 4-5 veces más extenso y detallado que el original."""
    elif better_prompt:
        # Solo mejorar prompt
        detail_instruction = """

⚠️ IMPORTANTE - MEJORAR PROMPT ACTIVADO:
El usuario ha marcado 'Mejorar prompt'. Esto significa:
- OPTIMIZA el prompt para máxima claridad, pasos accionables y coherencia narrativa
- MEJORA la estructura sin amplificar excesivamente la extensión
- REFINA el lenguaje para mayor precisión y profesionalismo
- AÑADE instrucciones claras sobre tono y formato esperado
- DEFINE restricciones explícitas para evitar ambigüedad

El prompt resultante debe ser mejorado y optimizado, pero manteniendo una longitud razonable."""

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
    better_prompt: bool = False,
    model: str | None = None,
    language: str | None = None,
) -> PromptImprovement:
    """
    Llama al modelo local vía Ollama (HTTP) y devuelve un PromptImprovement.

    raw_prompt: prompt original escrito por el usuario.
    deep_thinking: si True, añade análisis profundo y detallado.
    better_prompt: si True, optimiza y mejora el prompt para producción.
    model: nombre del modelo en Ollama. Si es None, detecta automáticamente los mejores disponibles.
           Prioridad automática: Qwen2.5:14b > Qwen2.5:7b-instruct > Qwen2.5:7b > Mistral > Llama
    language: idioma de salida del prompt (e.g., 'es', 'en', 'fr'). Si es None, usa español.
    """
    # Si se especifica modelo, usarlo. Si no, detectar los mejores disponibles
    if model:
        model_candidates = [model]
    else:
        model_candidates = get_model_candidates(count=3)
        # get_model_candidates siempre retorna al menos una lista de modelos prioritarios como fallback

    logger.info(f"Model candidates for optimization: {model_candidates}")
    messages = build_optimizer_messages(raw_prompt, deep_thinking, better_prompt, language)

    last_error = None

    for attempt_model in model_candidates:
        try:
            logger.info(f"Attempting to optimize prompt with model: {attempt_model}")

            # Hacer petición HTTP a Ollama
            payload = {
                "model": attempt_model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                }
            }

            logger.debug(f"Payload: {json.dumps(payload, indent=2, ensure_ascii=False)[:200]}...")

            response = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=300)
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
            json_data = None
            try:
                json_data = json.loads(content)
            except json.JSONDecodeError as e:
                # Si falla, intentar sanitizar de varias formas
                logger.warning(f"First JSON parse failed: {str(e)}. Attempting to sanitize...")

                # Intento 1: Reemplazar saltos de línea literales por espacios dentro de strings
                try:
                    sanitized_content = content.replace('\n', ' ').replace('\r', ' ')
                    json_data = json.loads(sanitized_content)
                    logger.info("Successfully parsed JSON after newline sanitization")
                except json.JSONDecodeError as e2:
                    logger.warning(f"Newline sanitization failed: {str(e2)}")

                    # Intento 2: Extraer el JSON válido si está embebido en texto
                    try:
                        import re
                        # Buscar el JSON entre { ... }
                        json_match = re.search(r'\{.*\}', content, re.DOTALL)
                        if json_match:
                            potential_json = json_match.group(0)
                            # Sanitizar también este
                            potential_json = potential_json.replace('\n', ' ').replace('\r', ' ')
                            json_data = json.loads(potential_json)
                            logger.info("Successfully parsed JSON after extraction and sanitization")
                    except Exception as e3:
                        logger.warning(f"JSON extraction failed: {str(e3)}")

                if not json_data:
                    logger.error(f"Could not parse JSON after all attempts. First 500 chars: {content[:500]}")
                    raise ValueError(f"La respuesta no es un JSON válido después de intentar sanitizar")

            # Validar que tiene los campos requeridos
            improved_prompt = json_data.get("improved_prompt", "")
            rationale = json_data.get("rationale", "")
            checklist = json_data.get("checklist", [])

            if not improved_prompt:
                raise ValueError("El JSON no contiene 'improved_prompt' o está vacío")

            logger.info(f"Successfully parsed improved prompt ({len(improved_prompt)} chars) with model {attempt_model}")

            return PromptImprovement(
                improved_prompt=improved_prompt,
                rationale=rationale,
                checklist=checklist if isinstance(checklist, list) else []
            )

        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError, ValueError) as e:
            last_error = e
            logger.warning(f"Failed with model {attempt_model}: {str(e)}. Trying next model...")
            continue
        except Exception as e:
            last_error = e
            logger.warning(f"Unexpected error with model {attempt_model}: {str(e)}. Trying next model...")
            continue

    # Si llegamos aquí, ningún modelo funcionó
    if isinstance(last_error, requests.exceptions.ConnectionError):
        logger.error(f"Cannot connect to Ollama at {OLLAMA_CHAT_URL}")
        raise ValueError(f"No se puede conectar a Ollama. ¿Está ejecutándose en {OLLAMA_CHAT_URL}?")
    elif isinstance(last_error, requests.exceptions.Timeout):
        logger.error("All models timed out")
        raise ValueError("Todos los modelos tardaron demasiado. Intenta con un modelo más pequeño.")
    else:
        logger.error(f"Error in improve_prompt with all candidates: {str(last_error)}", exc_info=True)
        raise ValueError(f"No se pudo optimizar el prompt con ningún modelo disponible")


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
