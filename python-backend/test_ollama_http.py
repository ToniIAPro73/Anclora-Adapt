#!/usr/bin/env python3
"""
Script para probar la conexion HTTP con Ollama
"""

import json
import requests
import sys

# Configurar encoding para Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

OLLAMA_API_URL = "http://localhost:11434/api/chat"

print("=" * 80)
print("TEST: Verificar conexion a Ollama")
print("=" * 80)

# Prueba 1: Verificar que Ollama está corriendo
print("\n1. Intentando conectar a Ollama...")
try:
    response = requests.get("http://localhost:11434", timeout=5)
    print(f"   [OK] Ollama esta accesible (status: {response.status_code})")
except requests.exceptions.ConnectionError:
    print(f"   [ERROR] No se puede conectar a Ollama en http://localhost:11434")
    print(f"   Verifica que Ollama esta ejecutandose: ollama serve")
    exit(1)
except Exception as e:
    print(f"   [ERROR] {e}")
    exit(1)

# Prueba 2: Verificar que el modelo está disponible
print("\n2. Verificando modelos disponibles...")
try:
    response = requests.get("http://localhost:11434/api/tags", timeout=5)
    models_data = response.json()
    models = [m['name'] for m in models_data.get('models', [])]
    print(f"   Modelos disponibles: {models}")

    if 'qwen2.5:7b-instruct' not in models:
        print(f"   [WARN] qwen2.5:7b-instruct no esta en la lista")
        if models:
            print(f"   Usando {models[0]} en su lugar")
            model_to_use = models[0].split(':')[0]
        else:
            print(f"   [ERROR] No hay modelos disponibles. Instala uno: ollama pull qwen2.5:7b-instruct")
            exit(1)
    else:
        model_to_use = "qwen2.5:7b-instruct"
        print(f"   [OK] qwen2.5:7b-instruct disponible")
except Exception as e:
    print(f"   [ERROR] listando modelos: {e}")
    exit(1)

# Prueba 3: Hacer una petición simple
print(f"\n3. Probando peticion simple al modelo...")
try:
    payload = {
        "model": model_to_use,
        "messages": [
            {"role": "user", "content": "Hola, cual es tu nombre?"}
        ],
        "stream": False,
    }

    print(f"   Enviando peticion a {OLLAMA_API_URL}...")
    response = requests.post(OLLAMA_API_URL, json=payload, timeout=120)
    response.raise_for_status()

    data = response.json()
    print(f"   [OK] Respuesta recibida")
    print(f"   Estructura: {list(data.keys())}")

    if 'message' in data and 'content' in data['message']:
        print(f"   Contenido: {data['message']['content'][:100]}...")
    else:
        print(f"   [WARN] Estructura inesperada: {json.dumps(data, indent=2)[:200]}")

except requests.exceptions.Timeout:
    print(f"   [ERROR] Timeout (120 segundos)")
    exit(1)
except requests.exceptions.ConnectionError as e:
    print(f"   [ERROR] Conexion rechazada: {e}")
    exit(1)
except Exception as e:
    print(f"   [ERROR] {e}")
    exit(1)

# Prueba 4: Petición con JSON estructurado
print(f"\n4. Probando peticion con respuesta JSON...")
try:
    payload = {
        "model": model_to_use,
        "messages": [
            {
                "role": "system",
                "content": "Retorna SOLO un JSON valido, sin mas texto."
            },
            {
                "role": "user",
                "content": """Retorna un JSON con esta estructura EXACTA:
{
  "improved_prompt": "version mejorada del prompt",
  "rationale": "breve explicacion de los cambios",
  "checklist": ["item1", "item2"]
}

Aqui esta el prompt a mejorar:
"Necesito posicionarme como el mejor asesor inmobiliario especializado en los Emiratos Arabes Unidos"
"""
            }
        ],
        "stream": False,
        "options": {
            "temperature": 0.3,
        }
    }

    print(f"   Enviando peticion...")
    response = requests.post(OLLAMA_API_URL, json=payload, timeout=120)
    response.raise_for_status()

    data = response.json()
    print(f"   [OK] Respuesta recibida")

    if 'message' in data and 'content' in data['message']:
        content = data['message']['content']
        print(f"\n   Contenido de la respuesta:")
        print(f"   {content}")

        # Intentar parsear como JSON
        print(f"\n   Intentando parsear como JSON...")
        try:
            json_data = json.loads(content)
            print(f"   [OK] JSON valido")
            print(f"   Campos: {list(json_data.keys())}")

            if 'improved_prompt' in json_data:
                print(f"   [OK] improved_prompt: {json_data['improved_prompt'][:50]}...")
            else:
                print(f"   [WARN] No contiene 'improved_prompt'")

        except json.JSONDecodeError as e:
            print(f"   [ERROR] parseando JSON: {e}")
            print(f"   Contenido: {content[:200]}...")
    else:
        print(f"   [WARN] Estructura inesperada")

except Exception as e:
    print(f"   [ERROR] {e}")
    import traceback
    traceback.print_exc()
    exit(1)

print("\n" + "=" * 80)
print("PRUEBA COMPLETADA")
print("=" * 80)
