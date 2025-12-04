# Anclora Local Backend - FastAPI

Backend unificado que gestiona TTS, STT e Imagen para Anclora Adapt.

## Características

- 🎤 **TTS (Text-to-Speech)**: Kokoro-82M - Voces naturales en español
- 👂 **STT (Speech-to-Text)**: Faster-Whisper Large-v3-Turbo - Transcripción rápida
- 🎨 **Imagen**: SDXL Lightning (4-step) - Generación rápida de imágenes
- ⚡ **Gestión inteligente de VRAM**: Carga/descarga modelos según se necesite
- 🔧 **Detección automática de hardware**: Se adapta a tu RTX 3050 4GB

## Instalación

### 1. Requisitos Previos

- Python 3.9+
- CUDA 12.1 (para GPU)
- 4GB VRAM mínimo (RTX 3050)
- 32GB RAM recomendado

### 2. Crear Ambiente Virtual

```bash
cd python-backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate  # Linux/Mac
```

### 3. Instalar Dependencias

```bash
pip install -r requirements.txt
```

**Nota:** Primera instalación toma 10-15 minutos por las dependencias de PyTorch y transformers.

### 4. Descargar Modelos

#### Kokoro TTS (REQUERIDO para funcionar)

El modelo Kokoro debe descargarse manualmente:

```bash
# Opción 1: Descarga manual desde HuggingFace
# Ir a: https://huggingface.co/hexgrad/Kokoro-82M
# Descargar:
#   - kokoro.onnx
#   - voices.json
# Colocar en: python-backend/models/

# Opción 2: Script de descarga automática (próximamente)
python download_models.py
```

**Estructura esperada:**
```
python-backend/
├── models/
│   ├── kokoro.onnx       ← Descargar
│   └── voices.json       ← Descargar
├── main.py
├── requirements.txt
└── README.md
```

## Ejecutar

```bash
# Terminal 1: Backend FastAPI
python main.py

# Salida esperada:
# 🚀 SERVIDOR ANCLORA BACKEND - INICIANDO
# 📍 Escuchando en: http://0.0.0.0:8000
# 📊 Documentación: http://localhost:8000/docs
```

## Endpoints

### GET `/`
Información del servidor

```bash
curl http://localhost:8000/
```

### GET `/api/health`
Health check del backend

```bash
curl http://localhost:8000/api/health
```

**Respuesta:**
```json
{
  "status": "ok",
  "hardware": {
    "cpu_cores": 8,
    "ram_gb": 32.0,
    "gpu_model": "NVIDIA GeForce RTX 3050",
    "gpu_vram_gb": 4.0,
    "device": "cuda"
  }
}
```

### GET `/api/system/capabilities`
Detalles de capacidades del hardware

```bash
curl http://localhost:8000/api/system/capabilities
```

### POST `/api/tts`
Generar audio desde texto

```bash
curl -X POST "http://localhost:8000/api/tts" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": "Hola mundo",
    "language": "es",
    "voice_preset": "af_sarah"
  }' \
  --output audio.wav
```

**Parámetros:**
- `inputs` (string, requerido): Texto a convertir a voz
- `language` (string, default: "es"): Código de idioma (es, en, fr, de, etc.)
- `voice_preset` (string, default: "af_sarah"): Voz a usar (depende de Kokoro)
- `model` (string, default: "kokoro"): Modelo a usar

**Respuesta:** Audio WAV en stream

### POST `/api/stt`
Transcribir audio

```bash
curl -X POST "http://localhost:8000/api/stt" \
  -F "file=@audio.wav"
```

**Parámetros:**
- `file` (UploadFile, requerido): Archivo de audio

**Respuesta:**
```json
{
  "text": "Texto transcrito",
  "language": "es",
  "probability": 0.95
}
```

### POST `/api/image`
Generar imagen

```bash
curl -X POST "http://localhost:8000/api/image" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Un gato astronauta en el espacio",
    "negative_prompt": "baja calidad, borroso",
    "width": 1024,
    "height": 1024,
    "num_inference_steps": 4
  }' \
  --output image.png
```

**Parámetros:**
- `prompt` (string, requerido): Descripción de la imagen
- `negative_prompt` (string, default: ""): Lo que NO debe aparecer
- `width` (int, default: 1024): Ancho en píxeles
- `height` (int, default: 1024): Alto en píxeles
- `num_inference_steps` (int, default: 4): Pasos de inferencia (4 para Lightning)

**Respuesta:** Imagen PNG en stream

## Documentación Interactiva

Una vez el servidor está corriendo, accede a:

```
http://localhost:8000/docs
```

Swagger UI con todos los endpoints documentados y probables interactivamente.

## Troubleshooting

### Error: "Modelos Kokoro no encontrados"

**Causa:** Falta descargar los archivos de Kokoro

**Solución:**
1. Ir a https://huggingface.co/hexgrad/Kokoro-82M
2. Descargar `kokoro.onnx` y `voices.json`
3. Colocar en `python-backend/models/`

### Error: "CUDA out of memory"

**Causa:** Tu RTX 3050 4GB se quedó sin memoria

**Solución:**
1. Cerrar otras aplicaciones que usan GPU (Chrome, games, Adobe)
2. Reducir tamaño de imagen (width/height)
3. Usar CPU (más lento): Editar `main.py`, cambiar `device` a "cpu"

### Error: "WhisperModel not found"

**Causa:** Falta descargar modelo de Whisper

**Solución:** Es automático en primera ejecución. Espera a que se descargue (~2GB).

### Servidor lento

**Causas comunes:**
- GPU completamente utilizada (reducir tamaño de imagen)
- CPU sin suficientes núcleos disponibles
- Disco duro lento (necesita más RAM para caché)

**Soluciones:**
- Usar una imagen por vez
- Cerrar aplicaciones pesadas
- Esperar a que cache se genere (segunda llamada es más rápida)

## Configuración desde Frontend

Actualiza tu `.env.local`:

```bash
# Backend Unificado (Python FastAPI)
VITE_API_BASE_URL=http://localhost:8000

# Endpoints mapeados al backend unificado
VITE_TTS_ENDPOINT=http://localhost:8000/api/tts
VITE_STT_ENDPOINT=http://localhost:8000/api/stt
VITE_IMAGE_MODEL_ENDPOINT=http://localhost:8000/api/image
```

## Arquitectura

```
Backend (FastAPI)
├── ModelManager
│   ├── TTS Kokoro (ligero, siempre cargado)
│   ├── STT Whisper (carga bajo demanda)
│   └── Imagen SDXL Lightning (carga bajo demanda)
│
├── CORS Middleware
│   └── Permite http://localhost:4173 (Vite)
│
└── Endpoints REST
    ├── /api/tts → TTS
    ├── /api/stt → STT
    └── /api/image → Imagen
```

## Performance en RTX 3050 4GB

| Tarea | Tiempo | Notas |
|-------|--------|-------|
| **TTS (Kokoro)** | 0.5-1 seg | Ligero, siempre en memoria |
| **STT (Whisper)** | 2-5 seg | Primer audio lento (descarga modelo), próximos rápidos |
| **Imagen (SDXL Lightning)** | 8-15 seg | 4 pasos, rápido para SDXL |

## Futuras Mejoras

- [ ] Download automático de modelos (script de setup)
- [ ] Caché de resultados frecuentes
- [ ] Soporte para múltiples voces Kokoro
- [ ] Integración con Ollama para texto
- [ ] WebSocket para streaming de audio
- [ ] Métricas y monitoring

## Licencias

- FastAPI: MIT
- PyTorch: BSD
- Faster-Whisper: MIT
- Diffusers: Apache 2.0
- Kokoro: MIT

## Soporte

Para problemas, consulta:
1. Este README
2. `docs/Optimizacion-Anclora-Adapt-Definitivo-Gemini.md`
3. `docs/Backend_Unificado_en_Python_usando_FastAPI-Gemini.md`
