# Modelo y Selección de Infraestructura – Anclora‑Adapt

Este documento describe los modelos actualmente disponibles en Ollama, los motores auxiliares del backend y los criterios que aplica la aplicación para elegir el modelo más adecuado según el hardware detectado y las opciones que introduce el usuario antes de generar contenido.

## 1. Modelos instalados en Ollama

| Familia                    | Nombre/ID                                                                                            | Peso aprox. | Uso principal                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Razón premium**          | `phi4:14b`, `qwen2.5:14b`, `deepseek-r1:8b`                                                          | 5‑9 GB      | Modos Intelligent/Campaign/Recycle cuando el usuario solicita “Pensamiento profundo”, múltiples plataformas o prompts largos. |
| **Multilingüe balanceado** | `mistral:latest`, `qwen2.5:7b`, `qwen2.5:7b-instruct`, `qwen2.5:7b-instruct-q4_K_M`, `llama2:latest` | 3‑5 GB      | Modos BASIC, Chat y Live Chat cuando la latencia importa o el hardware es medio (≥4 GB VRAM o ≥16 GB RAM).                    |
| **Ligero / Edge**          | `phi3:latest`, `phi3:3.8b-mini-128k-instruct-q4_K_M`, `gemma3:4b`, `gemma3:1b`, `llama3.2:latest`    | 0.8‑3 GB    | Hardware limitado (RAM <16 GB o sin GPU), modo “rápido” y tareas de traducción literal.                                       |
| **Visión**                 | `Llava:latest`, `qwen3-vl:8b`                                                                        | 4.7‑6.1 GB  | Análisis automático de imágenes y generación de prompts para Intelligent mode.                                                |

La lista completa detectada actualmente:

```text
phi4:14b, deepseek-r1:8b, qwen2.5:7b-instruct-q4_K_M, phi3:3.8b-mini-128k-instruct-q4_K_M,
phi3:latest, Llava:latest, qwen3-vl:8b, qwen2.5:7b-instruct, llama2:latest,
llama3.2:latest, mistral:latest, qwen2.5:14b, qwen2.5:7b, gemma3:4b, gemma3:1b
```

## 2. Modelos auxiliares (no Ollama)

| Tipo                     | Modelo / Librería                     | Estado actual                                                                          | Observaciones                                                               |
| ------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **TTS**                  | Kokoro ONNX (82 M)                    | Soportado si los pesos `kokoro.onnx` y `voices.json` están en `python-backend/models`. | Usado por `/api/tts` y modo Voz.                                            |
| **STT**                  | Faster‑Whisper `large-v3-turbo`       | ⚠️ Librería no instalada → advertencia al arrancar.                                    | Instalar `faster-whisper` para habilitar transcripción local.               |
| **Generación de imagen** | SDXL Lightning (Diffusers + Euler)    | ⚠️ Difusores no instalados → advertencia al arrancar.                                  | Requiere GPU y paquetes `diffusers`, `transformers`, etc.                   |
| **Análisis de imagen**   | Llava/qwen3-vl vía FastAPI + fallback | OK                                                                                     | Depende de `requests` + Ollama vision; si falla, se genera prompt genérico. |

## 3. Flujo de selección

### 3.1 Detección de hardware

1. Al iniciar el frontend se consulta `/api/system/capabilities`.
2. El backend devuelve CPU, RAM, GPU, VRAM y si CUDA está disponible.
3. `hardware_profiles.detect_hardware_profile()` marca modelos recomendados y modos permitidos (por ejemplo, desactiva SDXL si no hay GPU).

### 3.2 Evaluación por modo y preferencia del usuario

| Entrada del usuario                                                        | Impacto en la selección                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idioma (`Idioma` en Intelligent/Campaign/Recycle)                          | `modelCapabilities` define qué modelos soportan cada idioma; si se selecciona JP/ZH se priorizan qwen2.5/phi4.                                                                                                                                                |
| “Pensamiento profundo”                                                     | Solicita modelos ≥7 B con mejor contexto (`qwen2.5:14b`, `phi4:14b`, `deepseek-r1:8b`). Si hardware no lo permite se cae a `mistral`/`qwen2.5:7b`.                                                                                                            |
| “Mejorar prompt”                                                           | Invoca `/api/prompts/optimize`. Si el backend responde JSON válido, se usa el prompt optimizado. Si hay timeout o JSON inválido (por ejemplo, falta una coma en la respuesta de Ollama), el frontend muestra el aviso rojo y usa el fallback detallado local. |
| Selección de plataformas (Campaign/Intelligent) y requisitos de caracteres | El auto-model da prioridad a modelos con mejor control de longitud (qwen/mistral). Si `minChars > 500` o se piden >3 plataformas, sube de nivel la selección.                                                                                                 |
| “Incluir imagen”                                                           | Dispara `useImageAnalyzer` que llama al backend (Llava/qwen3-vl). Si el analizador falla, se muestra una alerta y se mantiene el campo para edición manual.                                                                                                   |
| Voz (STT/TTS)                                                              | Si `faster-whisper` o Kokoro no están disponibles, los botones de grabación/TTS muestran error “servicio no disponible”.                                                                                                                                      |

### 3.3 Fallbacks

- **Texto**: se prueban hasta 3 candidatos ordenados (según hardware + contexto). Si todos devuelven JSON inválido o no cumplen la longitud, se lanza error. En Intelligent mode se usa el prompt fallback (con secciones Rol, Contexto, etc.) mientras se muestran los avisos sobre el optimizador.
- **Visión**: `ModelFallbackManager` intenta en orden (Llava → qwen3-vl → genérico). Si todos fallan, se construye prompt genérico en el idioma elegido.
- **TTS/STT/Image**: si faltan librerías, el backend registra advertencia y responde 500/501; el frontend avisa al usuario que la funcionalidad requiere instalar las dependencias correspondientes.

## 4. Recomendaciones operativas

1. **Instalar dependencias faltantes**

   - `pip install diffusers transformers accelerate` para SDXL Lightning.
   - `pip install faster-whisper` para STT.
   - Verificar que los pesos de Kokoro estén ubicados en `python-backend/models`.

2. **Refuerzo del optimizador de prompts**

   - Ajustar `app/services/prompt_optimizer.py` para permitir JSON “relajado” (por ejemplo, insertando la coma faltante) o añadir un recordatorio adicional al mensaje del sistema para que Ollama devuelva JSON estricto.
   - Mientras tanto, el fallback local garantiza que siempre se muestre un prompt completo aun con el aviso “No se pudo optimizar el prompt”.

3. **Mantenimiento de modelos**

   - Usar `scripts/manage-ollama.ps1` para reiniciar Ollama, precargar el modelo deseado y limpiar estados inconsistentes.
   - Revisar `ollama list` tras cada actualización para asegurarse de que las versiones se mantienen y no se duplican IDs.

4. **Transparencia en la UI**
   - Mantener los avisos rojos cuando el backend falla (timeout, JSON inválido, librerías ausentes). Esto ayuda a diagnosticar por qué se muestra el fallback.

## 5. Resumen rápido por modo

| Modo                     | Modelos principales                                            | Dependencias extra            | Notas                                                              |
| ------------------------ | -------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| **Básico / Chat / Live** | Auto-model (qwen/mistral/phi3 según hardware)                  | STT/TTS para Live             | Live Chat usa STT + TTS; si faltan, limita funcionalidad a texto.  |
| **Inteligente**          | qwen2.5/phi4/mistral (`pensamiento profundo` prioriza 14 B)    | Vision analyzer + optimizador | Si el optimizador falla, fallback local generará prompt completo.  |
| **Campańa / Reciclar**   | Similar a Intelligent pero con más peso en control de longitud | —                             | Filtrado por plataformas seleccionadas.                            |
| **Imagen**               | SDXL Lightning backend                                         | Diffusers + GPU               | No operativa hasta instalar librerías; warning al iniciar backend. |
| **Voz**                  | Kokoro + Faster-Whisper                                        | Librerías mencionadas         | Si faltan deps se avisa en la UI.                                  |

Con este documento quedará trazabilidad del estado actual de modelos y las reglas que se aplican automáticamente para satisfacer cada solicitud dentro de Anclora‑Adapt.
