"""
prompt_optimizer.py
Optimizador de prompts usando un LLM open source vía Ollama (Qwen2.5).
"""

from __future__ import annotations

from typing import List
from pydantic import BaseModel
from ollama import chat


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
    Llama al modelo local vía Ollama y devuelve un PromptImprovement.

    raw_prompt: prompt original escrito por el usuario.
    deep_thinking: si True, pide un prompt más detallado y exhaustivo.
    model: nombre del modelo en Ollama (Qwen2.5 recomendado).
    """
    messages = build_optimizer_messages(raw_prompt, deep_thinking)

    response = chat(
        model=model,
        messages=messages,
        # Structured outputs: pedimos que respete el esquema JSON de PromptImprovement
        format=PromptImprovement.model_json_schema(),
        options={
            "temperature": 0.3,  # más estable y menos creativo
        },
    )

    # Manejo flexible de la respuesta (puede ser dict o objeto)
    if isinstance(response, dict):
        content = response.get("message", {}).get("content", "")
    else:
        content = response.message.content

    return PromptImprovement.model_validate_json(content)


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
