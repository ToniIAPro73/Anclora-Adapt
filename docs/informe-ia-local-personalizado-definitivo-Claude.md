# Guía de Modelos IA para Ejecución Local
## Configuración: Intel Core Ultra 7 + 32GB LPDDR5x + RTX 3050 Laptop

**Fecha**: Diciembre 2025  
**Hardware objetivo**: Portátil ultraligero con GPU dedicada

---

## Análisis de Tu Hardware

| Componente | Especificación | Implicación para IA |
|------------|----------------|---------------------|
| **CPU** | Intel Core Ultra 7 | 8-16 núcleos, NPU integrada (AI Boost), excelente para inferencia |
| **RAM** | 32GB LPDDR5x | Suficiente para modelos 7B-14B con offloading parcial |
| **GPU** | RTX 3050 Laptop | ~6GB VRAM*, Tensor Cores, TDP limitado (~35-80W) |
| **NPU** | Intel AI Boost | Hasta 34 TOPS, aceleración específica para IA |
| **Almacenamiento** | 1TB NVMe Gen4 | Carga rápida de modelos, swap eficiente |

*La RTX 3050 laptop típicamente tiene 4GB o 6GB VRAM. Este informe asume 6GB. Si tienes 4GB, reduce las recomendaciones un tier.

### Perfil de Rendimiento Esperado

```
┌─────────────────────────────────────────────────────────────┐
│  MODO GPU PURO (modelos ≤5GB)     → 25-40 tokens/segundo   │
│  MODO HÍBRIDO (GPU + offload)     → 8-15 tokens/segundo    │
│  MODO CPU PURO (Intel Core Ultra) → 5-12 tokens/segundo    │
│  MODO NPU (modelos compatibles)   → Variable, baja latencia│
└─────────────────────────────────────────────────────────────┘
```

---

## Frameworks Recomendados para Tu Configuración

| Framework | Uso Principal | Por Qué Lo Recomiendo |
|-----------|---------------|----------------------|
| **LM Studio** | LLMs general | Detección automática GPU/CPU, interfaz amigable |
| **Ollama** | LLMs rápido | Gestión sencilla, buen offloading automático |
| **ComfyUI** | Generación imagen | Optimización VRAM excelente para RTX 3050 |
| **Fooocus** | Imagen (principiantes) | Modo Speed optimizado para VRAM limitada |
| **OpenVINO** | Inferencia CPU/NPU | Aprovecha tu NPU Intel AI Boost |
| **Faster-Whisper** | Speech-to-Text | CTranslate2, óptimo para tu hardware |

### Instalación Esencial

```bash
# Ollama (recomendado para empezar)
winget install Ollama.Ollama

# LM Studio (alternativa con GUI)
# Descargar desde: https://lmstudio.ai

# ComfyUI (para imagen/video)
# Usar ComfyUI Portable o Pinokio para instalación sencilla
```

---

## Sección 1: Modelos de Texto (LLMs)

### 1.1 Chat e Instrucción General

#### Tier 1: GPU Pura (Máximo Rendimiento)

| Modelo | Cuantización | VRAM | Velocidad | Licencia |
|--------|--------------|------|-----------|----------|
| **Qwen 2.5 3B Instruct** | Q4_K_M | ~2.5 GB | 35-45 t/s | Apache 2.0 |
| **Llama 3.2 3B Instruct** | Q4_K_M | ~2.5 GB | 30-40 t/s | Llama Community |
| **Phi-3 Mini 3.8B** | Q4_K_M | ~3 GB | 30-40 t/s | MIT |
| **Gemma 2 2B** | Q4_K_M | ~1.8 GB | 40-50 t/s | Gemma License |

**✅ MEJOR OPCIÓN**: **Phi-3 Mini 3.8B Q4_K_M**
- Contexto de 128K tokens (excepcional para documentos largos)
- Razonamiento superior a modelos de su tamaño
- Cabe cómodamente en tu RTX 3050

```bash
# Instalación con Ollama
ollama pull phi3:3.8b

# O versión específica
ollama pull phi3:3.8b-mini-128k-instruct-q4_K_M
```

#### Tier 2: Modo Híbrido (GPU + CPU Offload)

Tu configuración brilla aquí: 32GB RAM + 6GB VRAM permite ejecutar modelos de 7-8B con offloading parcial.

| Modelo | Cuantización | VRAM+RAM | Velocidad | Licencia |
|--------|--------------|----------|-----------|----------|
| **Qwen 2.5 7B Instruct** | Q4_K_M | 3GB + 3GB | 12-18 t/s | Apache 2.0 |
| **Llama 3.1 8B Instruct** | Q4_K_M | 3GB + 4GB | 10-15 t/s | Llama Community |
| **Mistral 7B v0.3** | Q4_K_M | 3GB + 3GB | 12-18 t/s | Apache 2.0 |
| **Gemma 2 9B** | Q4_K_M | 4GB + 4GB | 8-12 t/s | Gemma License |

**✅ MEJOR OPCIÓN**: **Qwen 2.5 7B Instruct Q4_K_M**
- Mejor equilibrio calidad/velocidad en modo híbrido
- Excelente en español e inglés
- Instrucciones complejas bien ejecutadas

```bash
# Instalación
ollama pull qwen2.5:7b

# Configurar offloading en LM Studio:
# Settings → GPU Offload → ~50-60% de capas a GPU
```

#### Tier 3: CPU Puro (Modelos Grandes)

Con tus 32GB LPDDR5x puedes ejecutar modelos de hasta 14B en CPU puro.

| Modelo | Cuantización | RAM | Velocidad | Licencia |
|--------|--------------|-----|-----------|----------|
| **Qwen 2.5 14B** | Q4_K_M | ~10 GB | 4-8 t/s | Apache 2.0 |
| **Phi-4 14B** | Q4_K_M | ~10 GB | 4-8 t/s | MIT |
| **Llama 3.3 70B** | Q2_K | ~28 GB | 1-3 t/s | Llama Community |

**Nota**: A 4-8 t/s la experiencia sigue siendo usable para tareas que no requieren respuesta instantánea.

---

### 1.2 Modelos de Código

| Modelo | Cuantización | Modo | Velocidad | Benchmark |
|--------|--------------|------|-----------|-----------|
| **DeepSeek Coder 1.3B** | Q4_K_M | GPU pura | 40+ t/s | Snippets funcionales |
| **Qwen 2.5 Coder 3B** | Q4_K_M | GPU pura | 30-40 t/s | Mejor calidad |
| **Qwen 2.5 Coder 7B** | Q4_K_M | Híbrido | 10-15 t/s | **58% Aider** |
| **DeepSeek Coder 6.7B** | Q4_K_M | Híbrido | 10-15 t/s | Excelente FIM |

**✅ MEJOR OPCIÓN GPU PURA**: **Qwen 2.5 Coder 3B Q4_K_M**
- Fill-in-the-Middle (FIM) para autocompletado
- Soporte para 90+ lenguajes
- Calidad sorprendente para 3B parámetros

**✅ MEJOR OPCIÓN HÍBRIDO**: **Qwen 2.5 Coder 7B Q4_K_M**
- 58% en benchmark Aider (nivel profesional)
- Vale la pena la reducción de velocidad

```bash
ollama pull qwen2.5-coder:3b
# o para mayor calidad
ollama pull qwen2.5-coder:7b
```

---

### 1.3 Razonamiento (Chain of Thought)

| Modelo | Cuantización | Modo | Capacidad | Licencia |
|--------|--------------|------|-----------|----------|
| **DeepSeek-R1-Distill-Qwen-1.5B** | Q4_K_M | GPU pura | Básico | MIT |
| **Qwen3 4B (thinking mode)** | Q4_K_M | GPU pura | Bueno | Apache 2.0 |
| **DeepSeek-R1-Distill-Qwen-7B** | Q4_K_M | Híbrido | Sólido | MIT |
| **QwQ-8B** | Q4_K_M | Híbrido | Matemáticas | Apache 2.0 |

**✅ MEJOR OPCIÓN**: **DeepSeek-R1-Distill-Qwen-7B Q4_K_M**
- Razonamiento tipo o1 de OpenAI
- Muestra su proceso de pensamiento
- Excelente para matemáticas y lógica

**Uso óptimo**: Forzar tokens `<think>` al inicio, temperatura 0.6, sin system prompt.

```bash
# Disponible en Ollama
ollama pull deepseek-r1:7b
```

---

## Sección 2: Generación de Imagen

Tu RTX 3050 con ~6GB VRAM puede ejecutar generación de imagen local con las optimizaciones correctas.

### 2.1 Modelos Recomendados

| Modelo | VRAM | Tiempo/Imagen | Resolución | Calidad |
|--------|------|---------------|------------|---------|
| **SD 1.5 + LCM-LoRA** | ~4 GB | 8-15 s | 512×512 | ⭐⭐⭐ |
| **SDXL Lightning** | ~5.5 GB | 20-40 s | 1024×1024 | ⭐⭐⭐⭐ |
| **SD 3.5 Medium** | ~5.5 GB | 30-60 s | 1024×1024 | ⭐⭐⭐⭐⭐ |
| **FLUX.1 schnell NF4** | ~5.5 GB | 90-150 s | 1024×1024 | ⭐⭐⭐⭐ |

**✅ MEJOR EQUILIBRIO**: **SDXL Lightning (4-step)**
- 4 pasos de inferencia = velocidad excelente
- Calidad muy buena para la mayoría de usos
- Funciona bien con 6GB VRAM

**✅ MEJOR CALIDAD**: **SD 3.5 Medium**
- La mejor calidad que cabe en tu VRAM
- Excelente seguimiento de prompts
- Texto legible en imágenes

### 2.2 Configuración Óptima

**Framework recomendado**: Fooocus (modo Speed) o ComfyUI con --lowvram

```
Configuración Fooocus para RTX 3050:
├── Performance: Speed (4 steps)
├── Aspect Ratio: 1152×896 o inferior
├── Image Number: 1
└── Advanced → Enable LOWVRAM mode
```

**ComfyUI con bandera lowvram**:
```bash
python main.py --lowvram --preview-method auto
```

### 2.3 Modelos Fine-Tuned Recomendados (SD 1.5 base)

| Modelo | Estilo | Tamaño |
|--------|--------|--------|
| **Realistic Vision v6** | Fotorrealismo | ~2 GB |
| **DreamShaper v8** | Versatil | ~2 GB |
| **Deliberate v3** | Arte/Ilustración | ~2 GB |
| **AbsoluteReality v1.8** | Fotografía | ~2 GB |

Estos modelos SD 1.5 funcionan muy rápido (~8-15s) en tu RTX 3050.

---

## Sección 3: Generación de Video

### 3.1 Viabilidad en Tu Hardware

| Modelo | VRAM Req. | Tu Hardware | Viabilidad |
|--------|-----------|-------------|------------|
| **LTX Video 2B** | ~6 GB | 6 GB | ⚠️ Ajustado |
| **SVD (Image-to-Video)** | ~6 GB | 6 GB | ⚠️ Ajustado |
| **AnimateDiff** | ~6-8 GB | 6 GB | ⚠️ Con --lowvram |
| **CogVideoX-2B** | ~8 GB | 6 GB | ❌ Insuficiente |
| **Wan2.1** | ~8+ GB | 6 GB | ❌ Insuficiente |

### 3.2 Opciones Viables

#### LTX Video 2B (Con Limitaciones)
```
Configuración para 6GB VRAM:
├── Resolución: 512×512 (máximo)
├── Frames: 25-33 (1-1.5 segundos)
├── Tiempo esperado: 5-15 minutos
└── Modo: --lowvram obligatorio
```

#### SVD (Stable Video Diffusion)
- **Uso**: Imagen estática → Video corto (2-4 segundos)
- **VRAM**: ~5-6 GB con optimizaciones
- **Calidad**: Buena para movimiento sutil

### 3.3 Alternativa Cloud Gratuita

Para video de mayor calidad, usar:
- **Hugging Face Spaces**: CogVideoX, Wan2.1 demos gratuitos
- **Google Colab**: T4 GPU gratuita (15GB VRAM)
- **Replicate**: Tier gratuito limitado

---

## Sección 4: Audio

### 4.1 Speech-to-Text (Transcripción)

| Modelo | Framework | VRAM/RAM | Velocidad | Calidad |
|--------|-----------|----------|-----------|---------|
| **Whisper tiny** | whisper.cpp | CPU ~500MB | 32x RT | ⭐⭐ |
| **Whisper base** | whisper.cpp | CPU ~1GB | 16x RT | ⭐⭐⭐ |
| **Whisper small** | Faster-Whisper | GPU ~2GB | 6x RT | ⭐⭐⭐⭐ |
| **Whisper medium** | Faster-Whisper | GPU ~3GB | 2x RT | ⭐⭐⭐⭐ |
| **Whisper large-v3-turbo** | Faster-Whisper | GPU ~4GB | 1.5x RT | ⭐⭐⭐⭐⭐ |

**✅ MEJOR OPCIÓN**: **Whisper large-v3-turbo** con Faster-Whisper
- Calidad de large-v3 con 8x menos latencia
- Cabe perfectamente en tu RTX 3050
- Soporte multilingüe excelente (incluido español)

```bash
# Instalación
pip install faster-whisper

# Uso
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", device="cuda", compute_type="float16")
segments, info = model.transcribe("audio.mp3")
```

### 4.2 Text-to-Speech (Síntesis de Voz)

| Modelo | VRAM/RAM | Latencia | Voice Cloning | Licencia |
|--------|----------|----------|---------------|----------|
| **Piper TTS** | CPU ~500MB | Tiempo real | ❌ | MIT |
| **MeloTTS** | GPU ~2GB | <1s | ❌ | MIT |
| **Kokoro-82M** | CPU ~200MB | <300ms | ❌ | Apache 2.0 |
| **XTTS v2** | GPU ~4GB | Streaming | ✅ | Coqui (NC) |
| **Fish Speech 1.5** | GPU ~6GB | ~150ms | ✅ | Apache 2.0 |

**✅ MEJOR OPCIÓN RÁPIDA**: **Piper TTS** o **Kokoro-82M**
- Funcionan en tiempo real incluso en CPU
- Calidad muy buena para la mayoría de usos
- Licencia permisiva

**✅ MEJOR OPCIÓN CON VOICE CLONING**: **XTTS v2**
- Clona voces con solo 6 segundos de audio
- Cabe en tu VRAM
- Licencia no comercial (Coqui Public License)

```bash
# Piper (más fácil)
pip install piper-tts

# XTTS v2
pip install TTS
tts --model_name tts_models/multilingual/multi-dataset/xtts_v2
```

### 4.3 Generación de Música

| Modelo | VRAM/RAM | Viabilidad | Calidad |
|--------|----------|------------|---------|
| **MusicGen-small** | ~4GB | ✅ Viable | ⭐⭐⭐ |
| **MusicGen-medium** | ~8GB | ❌ Excede | ⭐⭐⭐⭐ |
| **Stable Audio Open** | ~8GB | ❌ Excede | ⭐⭐⭐⭐ |

**✅ ÚNICA OPCIÓN LOCAL**: **MusicGen-small**
- Genera clips de 30 segundos
- Tiempo: ~2-5 minutos por clip
- Calidad aceptable para demos

**Alternativa**: Usar MusicGen-medium en Google Colab gratuito.

---

## Sección 5: OCR y Visión

### 5.1 OCR (Reconocimiento de Texto)

| Modelo | RAM/VRAM | Velocidad | Precisión | Mejor Para |
|--------|----------|-----------|-----------|------------|
| **Tesseract 5.x** | CPU ~500MB | 3-4 s/img | ~85-90% | Docs limpios |
| **PaddleOCR PP-OCRv4** | GPU ~2GB | <1 s/img | ~93% | Multilingüe |
| **EasyOCR** | GPU ~2GB | 1-2 s/img | ~90% | Fácil setup |
| **Surya OCR** | GPU ~4GB | <1 s/img | **97.7%** | Alta precisión |

**✅ MEJOR OPCIÓN**: **Surya OCR**
- 97.7% precisión en benchmarks
- Excelente para facturas, documentos escaneados
- Cabe en tu VRAM con margen

```bash
pip install surya-ocr

# Uso básico
from surya.ocr import run_ocr
results = run_ocr(images, det_model, rec_model)
```

### 5.2 Modelos de Visión (VLM)

| Modelo | VRAM | Capacidad |
|--------|------|-----------|
| **LLaVA 1.6 7B Q4** | ~5-6GB | Descripción, OCR básico |
| **Qwen2-VL 2B** | ~3-4GB | Multimodal eficiente |
| **Moondream 2B** | ~2-3GB | Ultra-ligero |

**✅ MEJOR OPCIÓN**: **Moondream 2B** o **Qwen2-VL 2B**
- Describen imágenes con buena precisión
- Responden preguntas sobre contenido visual
- Funcionan fluidamente en tu hardware

---

## Sección 6: Embeddings y RAG

### 6.1 Modelos de Embeddings

| Modelo | Parámetros | VRAM | MTEB | Contexto |
|--------|------------|------|------|----------|
| **all-MiniLM-L6-v2** | 22M | CPU ~400MB | ~59 | 256 |
| **bge-base-en-v1.5** | 110M | CPU ~1GB | ~64 | 512 |
| **nomic-embed-text-v1.5** | 137M | CPU ~1GB | ~63 | **8192** |
| **bge-m3** | 355M | GPU ~2GB | ~65 | **8192** |
| **gte-Qwen2-1.5B** | 1.5B | GPU ~4GB | ~67 | 8192 |

**✅ MEJOR OPCIÓN GENERAL**: **nomic-embed-text-v1.5**
- Contexto de 8192 tokens (crítico para RAG)
- Funciona bien en CPU
- Licencia Apache 2.0

**✅ MEJOR OPCIÓN CALIDAD**: **bge-m3** o **gte-Qwen2-1.5B**
- Mayor puntuación MTEB
- Multilingüe (incluye español)
- Aceleración GPU en tu RTX 3050

```bash
# Con sentence-transformers
pip install sentence-transformers

from sentence_transformers import SentenceTransformer
model = SentenceTransformer('nomic-ai/nomic-embed-text-v1.5')
embeddings = model.encode(["Tu texto aquí"])
```

### 6.2 Stack RAG Recomendado

```
Tu Stack RAG Local:
├── Embeddings: nomic-embed-text-v1.5 o bge-m3
├── Vector DB: ChromaDB o LanceDB (locales)
├── LLM: Qwen 2.5 7B Q4_K_M (modo híbrido)
├── Framework: LangChain o LlamaIndex
└── Chunking: 512-1024 tokens con overlap 50-100
```

---

## Sección 7: Aprovechando la NPU Intel

Tu Intel Core Ultra 7 incluye una **NPU (Neural Processing Unit)** con hasta 34 TOPS de rendimiento para IA.

### 7.1 Estado Actual del Soporte NPU

| Framework | Soporte NPU | Madurez |
|-----------|-------------|---------|
| **OpenVINO** | ✅ Completo | Producción |
| **ONNX Runtime** | ✅ Parcial | Beta |
| **DirectML** | ⚠️ Limitado | Experimental |
| **Ollama/LM Studio** | ❌ No | — |

### 7.2 Modelos Optimizados para NPU

| Modelo | Formato | Uso |
|--------|---------|-----|
| **Whisper (tiny/base/small)** | OpenVINO IR | STT |
| **YOLO v8** | OpenVINO IR | Detección objetos |
| **Stable Diffusion** | OpenVINO IR | Imagen (experimental) |
| **Phi-3 Mini** | OpenVINO IR | Chat (beta) |

### 7.3 Instalación OpenVINO

```bash
pip install openvino openvino-dev

# Verificar NPU
from openvino import Core
core = Core()
print(core.available_devices)
# Debería mostrar: ['CPU', 'GPU', 'NPU']
```

### 7.4 Caso de Uso Práctico: Whisper en NPU

```python
from optimum.intel import OVModelForSpeechSeq2Seq
from transformers import AutoProcessor

model = OVModelForSpeechSeq2Seq.from_pretrained(
    "OpenVINO/whisper-small-fp16-ov",
    device="NPU"
)
processor = AutoProcessor.from_pretrained("openai/whisper-small")
```

**Beneficio**: Libera GPU para otras tareas mientras la NPU maneja transcripción.

---

## Sección 8: Gestión Térmica

Tu portátil ultraligero (1.2kg) tiene limitaciones térmicas importantes.

### 8.1 Recomendaciones

| Aspecto | Recomendación |
|---------|---------------|
| **Superficie** | Usar base con ventilación o elevada |
| **Ambiente** | Temperatura <25°C ideal |
| **Sesiones largas** | Monitorizar con HWiNFO64 |
| **Throttling** | Normal si GPU baja de boost clock |

### 8.2 Señales de Throttling

```
Síntomas de throttling térmico:
├── Velocidad de generación cae >30% tras 5-10 minutos
├── Ventiladores al máximo constante
├── GPU clock baja de ~1500MHz a ~1000MHz
└── Temperatura GPU >85°C sostenida
```

### 8.3 Mitigación

1. **Limitar TDP de GPU** en NVIDIA Control Panel
2. **Usar modos de eficiencia** cuando no necesites máxima velocidad
3. **Alternar tareas** GPU intensivas con pausas
4. **Preferir modelos más pequeños** para sesiones largas

---

## Resumen: Configuración Óptima Recomendada

### Stack Principal

| Tarea | Modelo | Framework | Modo |
|-------|--------|-----------|------|
| **Chat diario** | Phi-3 Mini 3.8B Q4_K_M | Ollama | GPU pura |
| **Chat avanzado** | Qwen 2.5 7B Q4_K_M | LM Studio | Híbrido |
| **Código** | Qwen 2.5 Coder 7B Q4_K_M | LM Studio | Híbrido |
| **Razonamiento** | DeepSeek-R1-7B Q4_K_M | Ollama | Híbrido |
| **Imagen** | SDXL Lightning 4-step | Fooocus | GPU |
| **STT** | Whisper large-v3-turbo | Faster-Whisper | GPU |
| **TTS** | Piper / XTTS v2 | Nativo | CPU/GPU |
| **OCR** | Surya OCR | Python | GPU |
| **Embeddings** | nomic-embed-text-v1.5 | sentence-transformers | CPU |

### Comandos de Instalación Rápida

```bash
# 1. Instalar Ollama
winget install Ollama.Ollama

# 2. Descargar modelos esenciales
ollama pull phi3:3.8b
ollama pull qwen2.5:7b
ollama pull qwen2.5-coder:7b
ollama pull deepseek-r1:7b

# 3. Python dependencies
pip install faster-whisper surya-ocr sentence-transformers TTS

# 4. Fooocus para imagen (descargar release)
# https://github.com/lllyasviel/Fooocus/releases
```

---

## Limitaciones de Tu Hardware

| Capacidad | Estado | Alternativa |
|-----------|--------|-------------|
| LLMs 3-7B | ✅ Excelente | — |
| LLMs 8-14B | ⚠️ CPU/Híbrido lento | Cloud para urgencias |
| LLMs >14B | ❌ No práctico | Google Colab / API |
| Imagen SD 1.5 | ✅ Excelente | — |
| Imagen SDXL | ✅ Bueno | — |
| Imagen FLUX | ⚠️ Lento | HuggingFace Spaces |
| Video corto | ⚠️ Muy limitado | Colab / Cloud |
| Video largo | ❌ No viable | Runway / Kling |
| STT | ✅ Excelente | — |
| TTS | ✅ Excelente | — |
| Música | ⚠️ Limitado | Suno / Udio |

---

## Recursos y Enlaces

### Descargas de Modelos
- **Hugging Face**: https://huggingface.co/models
- **Ollama Library**: https://ollama.ai/library
- **CivitAI** (SD models): https://civitai.com

### Frameworks
- **LM Studio**: https://lmstudio.ai
- **Ollama**: https://ollama.ai
- **Fooocus**: https://github.com/lllyasviel/Fooocus
- **ComfyUI**: https://github.com/comfyanonymous/ComfyUI

### Documentación
- **OpenVINO NPU**: https://docs.openvino.ai
- **Faster-Whisper**: https://github.com/SYSTRAN/faster-whisper

---

## Licencias Relevantes

| Modelo | Licencia | Uso Comercial |
|--------|----------|---------------|
| Qwen 2.5 | Apache 2.0 | ✅ Libre |
| Phi-3/Phi-4 | MIT | ✅ Libre |
| Llama 3.x | Llama Community | ✅ <700M usuarios |
| DeepSeek-R1 | MIT | ✅ Libre |
| SDXL | OpenRAIL-M | ✅ Con restricciones |
| XTTS v2 | Coqui Public | ❌ No comercial |
| Whisper | MIT | ✅ Libre |
| Surya OCR | GPL-3.0 | ⚠️ Copyleft |

---

*Informe generado: Diciembre 2025*  
*Configuración: Intel Core Ultra 7 + 32GB LPDDR5x + RTX 3050 Laptop*
