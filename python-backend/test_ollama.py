#!/usr/bin/env python3
"""
Script para probar directamente qué retorna Ollama
"""

from ollama import chat
import json

# Mensaje simple para prueba
messages = [
    {
        "role": "system",
        "content": "Eres un asistente útil que retorna JSON."
    },
    {
        "role": "user",
        "content": """Retorna un JSON con esta estructura exacta:
{
  "improved_prompt": "texto mejorado",
  "rationale": "explicación",
  "checklist": ["item1"]
}"""
    }
]

print("=" * 80)
print("PROBANDO OLLAMA - CHAT SIN FORMAT")
print("=" * 80)

try:
    response = chat(
        model="qwen2.5:7b-instruct",
        messages=messages,
    )

    print(f"\nTipo de respuesta: {type(response)}")
    print(f"\nRespuesta completa:\n{response}")
    print(f"\nClaves de respuesta: {response.keys() if isinstance(response, dict) else 'No es dict'}")

    if isinstance(response, dict):
        print("\n--- Intentando acceder a response['message'] ---")
        if 'message' in response:
            print(f"response['message'] existe")
            print(f"Tipo: {type(response['message'])}")
            print(f"Contenido: {response['message']}")

            if isinstance(response['message'], dict):
                print(f"\nClaves en message: {response['message'].keys()}")
                if 'content' in response['message']:
                    content = response['message']['content']
                    print(f"\nContenido del message:\n{content}")

                    # Intentar parsear como JSON
                    try:
                        json_data = json.loads(content)
                        print(f"\nJSON parseado exitosamente:")
                        print(json.dumps(json_data, indent=2, ensure_ascii=False))
                    except json.JSONDecodeError as e:
                        print(f"\nError parseando JSON: {e}")

except Exception as e:
    print(f"\nError: {e}")
    import traceback
    traceback.print_exc()
