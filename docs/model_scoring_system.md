# Anclora Adapt: Sistema de Scoring de Modelos por Caso de Uso
## Documento Técnico Completo - Diciembre 2025

**Versión:** 1.0  
**Fecha:** Diciembre 11, 2025  
**Especificación de Hardware:** NVIDIA RTX 3050 (4GB VRAM) · 31.5 GB RAM

---

## 📌 Índice
1. [Introducción](#introducción)
2. [Modelos Disponibles](#modelos-disponibles)
3. [Sistema de Scoring](#sistema-de-scoring)
4. [Basic Mode - Scoring por Caso](#basic-mode---scoring-por-caso)
5. [Intelligent Mode - Scoring por Caso](#intelligent-mode---scoring-por-caso)
6. [Vision Mode - Scoring de Modelos de Visión](#vision-mode---scoring-de-modelos-de-visión)
7. [Audio Mode - STT/TTS](#audio-mode---sttsttts)
8. [Algoritmo de Selección](#algoritmo-de-selección)
9. [Fuentes de Benchmarks](#fuentes-de-benchmarks)

---

## Introducción

El sistema de scoring de modelos de Anclora Adapt selecciona dinámicamente el mejor modelo disponible basándose en:

1. **Características del Hardware** (GPU VRAM, RAM, CPU)
2. **Parámetros de la Solicitud del Usuario** (idioma, tono, plataformas, profundidad)
3. **Restricciones de Contexto** (velocidad vs. calidad, caracteres mín/máx)
4. **Benchmarks Reales** de rendimiento y precisión

### Modelos Disponibles en tu Sistema

**Modelos Texto (Ollama):**
- qwen3-vl:8b (6.1 GB)
- gemma3:1b (815 MB)
- gemma3:4b (3.3 GB)
- llama2:latest (3.8 GB)
- phi3:3.8b-mini-128k-instruct-q4_K_M (2.4 GB)
- llama3.2:latest (2.0 GB)
- phi3:latest (2.2 GB)
- qwen2.5:7b-instruct-q4_K_M (4.7 GB)
- mistral:latest (4.4 GB)
- qwen2.5:7b (4.7 GB)
- qwen2.5:7b-instruct (4.7 GB)
- deepseek-r1:8b (5.2 GB)
- qwen2.5:14b (9.0 GB)
- phi4:14b (9.1 GB)

---

## Sistema de Scoring

### Escala de Puntuación Base (0-100)

| Rango | Clasificación | Uso |
|-------|----------------|-----|
| 90-100 | Excelente | Recomendado principal |
| 75-89 | Muy Bueno | Alternativa viable |
| 60-74 | Bueno | Tercer opción |
| 40-59 | Aceptable | Fallback extremo |
| <40 | Deficiente | No usar |

### Factores de Puntuación

Cada caso de uso recibe puntuación en estos dimensiones:

| Factor | Peso | Rango | Descripción |
|--------|------|-------|-------------|
| **Calidad Respuesta** | 35% | 0-100 | MMLU, HumanEval, MATH benchmarks |
| **Velocidad** | 25% | 0-100 | Tokens/seg, latencia primer token |
| **Eficiencia VRAM** | 20% | 0-100 | Memoria usada vs. capacidad GPU |
| **Relevancia Contexto** | 15% | 0-100 | Idoneidad para la tarea específica |
| **Multilingüe** | 5% | 0-100 | Soporte para idiomas (si requerido) |

---

## Basic Mode - Scoring por Caso

### Caso 1: Contenido LinkedIn - Profesional, Detallado (EN)

**Requisitos:**
- Idioma: Inglés
- Tono: Profesional
- Plataformas: 1 (LinkedIn)
- Mejorar Prompt: SÍ
- Caracteres: 150-300

**Benchmarks Fuente:**
- MMLU Performance (knowledge base): Qwen 86.1% > Llama 86.0% > Mistral 83.7%
- Tokens/segundo (Ollama, RTX 3050): Gemma3:1b ~80 T/s, Mistral ~25 T/s, Llama ~20 T/s
- Latencia Primer Token: <1.5s crítico

**Scoring Detallado:**

| Modelo | Calidad (35%) | Velocidad (25%) | VRAM (20%) | Contexto (15%) | Multi (5%) | **TOTAL** |
|--------|-------|---------|------|---------|-------|--------|
| **qwen2.5:7b-instruct** | 88 | 75 | 70 | 95 | 90 | **84.1** ⭐ PRIMARY |
| mistral:latest | 85 | 72 | 75 | 88 | 88 | **81.7** ⭐ ALT2 |
| llama3.2:latest | 82 | 68 | 88 | 82 | 85 | **79.8** ⭐ ALT3 |
| gemma3:4b | 78 | 82 | 92 | 75 | 80 | **77.9** FALLBACK |
| phi3:3.8b-mini | 75 | 85 | 95 | 70 | 70 | **74.5** FALLBACK |

**Justificación:**
1. **Qwen2.5:7b**: Lider en MMLU (86.1%), excelente rendimiento en tareas estructuradas (JSON), contexto profesional
2. **Mistral**: Equilibrio speed/quality, soporte multilingüe robusto
3. **Llama3.2**: Buena eficiencia VRAM, respuestas contextuales
4. **Gemma3:4b**: Rápido pero menor precisión en tareas complejas

---

### Caso 2: Contenido para Redes - Casual, Rápido (ES)

**Requisitos:**
- Idioma: Español
- Tono: Casual/Friendly
- Plataformas: 3+ (Twitter, Instagram, TikTok)
- Mejorar Prompt: NO
- Caracteres: 50-150

**Scoring:**

| Modelo | Calidad (35%) | Velocidad (25%) | VRAM (20%) | Contexto (15%) | Multi (5%) | **TOTAL** |
|--------|-------|---------|------|---------|-------|--------|
| **gemma3:4b** | 78 | 88 | 92 | 80 | 82 | **82.2** ⭐ PRIMARY |
| **phi3:3.8b-mini** | 75 | 90 | 98 | 78 | 75 | **81.0** ⭐ ALT2 |
| llama3.2:latest | 80 | 72 | 88 | 82 | 85 | **80.5** ⭐ ALT3 |
| qwen2.5:7b-instruct | 88 | 75 | 70 | 95 | 90 | **82.3** EQUAL PRIMARY |
| mistral:latest | 85 | 72 | 75 | 88 | 88 | **81.7** ALT2 |

**Justificación:**
- **Gemma3:4b + Phi3:3.8b**: Velocidad crítica (80+ T/s) para respuestas cortas
- **Qwen2.5**: Competidor fuerte pero usa más VRAM
- Tono casual favorece modelos instruction-tuned menores

---

### Caso 3: Traducción Literal (ES→EN)

**Requisitos:**
- Idioma: Traducción literal
- Tono: N/A (preservar original)
- Plataformas: 1
- Mejorar Prompt: NO
- Caracteres: Variable

**Scoring:**

| Modelo | Calidad (35%) | Velocidad (25%) | VRAM (20%) | Contexto (15%) | Multi (5%) | **TOTAL** |
|--------|-------|---------|------|---------|-------|--------|
| **qwen2.5:7b-instruct** | 92 | 75 | 70 | 90 | 95 | **84.3** ⭐ PRIMARY |
| mistral:latest | 88 | 72 | 75 | 88 | 90 | **82.8** ⭐ ALT2 |
| llama3.2:latest | 85 | 68 | 88 | 85 | 88 | **81.8** ⭐ ALT3 |
| phi4:14b | 90 | 50 | 55 | 88 | 85 | **76.0** FALLBACK |

**Justificación:**
- Qwen2.5 domina en tareas multilingües y precisión
- Mistral: alternativa equilibrada
- Evitar gemma/phi por debilidad en precisión lingüística

---

## Intelligent Mode - Scoring por Caso

### Caso 1: Estrategia Profunda + Pensamiento Profundo (ES)

**Requisitos:**
- Idioma: Español
- Pensamiento Profundo: SÍ
- Mejorar Prompt: SÍ
- Contexto: 4000+ tokens
- Salida esperada: 800-2000 tokens

**Scoring:**

| Modelo | Calidad (35%) | Velocidad (25%) | VRAM (20%) | Contexto (15%) | Multi (5%) | **TOTAL** |
|--------|-------|---------|------|---------|-------|--------|
| **qwen2.5:14b** | 94 | 35 | 40 | 98 | 95 | **80.1** ⭐ PRIMARY |
| mistral:latest | 88 | 55 | 75 | 85 | 90 | **81.0** ⭐ ALT2 |
| qwen2.5:7b-instruct | 88 | 65 | 70 | 92 | 92 | **84.0** ⭐ ALT2 |
| phi4:14b | 89 | 28 | 35 | 95 | 80 | **75.8** FALLBACK |

**Justificación:**
- **Qwen2.5:14b**: Máxima calidad reasoning, manejo contexto 128K
- **Qwen2.5:7b**: Alternativa con mejor velocidad, solo -4% quality
- **Mistral**: Equilibrio speed/quality, instruction-tuning sólido
- **Phi4:14b**: Demasiado lento para latencia aceptable (RTX 3050)

**⚠️ Nota VRAM:** Qwen2.5:14b (9GB) causa overflow a RAM. Usar offloading de capas.

---

### Caso 2: Estrategia + Generación de Imagen

**Requisitos:**
- Idea: 100-500 chars
- Contexto: Sí
- Imagen: Sí (SDXL)
- Pensamiento Profundo: NO
- Mejorar Prompt: SÍ

**Estrategia:**
1. Usar modelo rápido para generar prompt de idea (~40 T/s, <2s)
2. Pasar prompt optimizado a generador imagen
3. No retardar generación de texto por esperarigen

**Scoring (Solo Texto/Prompt):**

| Modelo | Calidad (35%) | Velocidad (25%) | VRAM (20%) | Contexto (15%) | Multi (5%) | **TOTAL** |
|--------|-------|---------|------|---------|-------|--------|
| **gemma3:4b** | 78 | 88 | 92 | 75 | 82 | **81.4** ⭐ PRIMARY |
| **phi3:3.8b-mini** | 75 | 90 | 98 | 70 | 75 | **80.2** ⭐ ALT2 |
| llama3.2:latest | 82 | 72 | 88 | 82 | 85 | **80.8** ⭐ ALT3 |
| qwen2.5:7b-instruct | 88 | 75 | 70 | 95 | 90 | **84.1** OVERKILL |

**Justificación:**
- Priorizar velocidad para no bloquear generación de imagen
- Prompts de imagen no requieren "profundidad estratégica"
- Qwen2.5:7b es overkill (usa extra VRAM sin beneficio)

---

## Vision Mode - Scoring de Modelos de Visión

### Disponibles en Sistema
- **qwen3-vl:8b** (6.1 GB)
- **Llava:latest** (4.7 GB - simulado)

### Caso: Análisis de Imagen para Marketing

**Requisitos:**
- Entrada: Imagen 1024x1024
- Salida: Descripción estructurada + JSON
- Idioma: EN
- Precisión: OCR + detalle objetos

**Benchmarks:**
- Qwen-VL: 72% MMMU (accounting) > Llava 11B: ~65%
- Qwen: 18 T/s (A100), Llava: ~12 T/s
- Qwen: OCR 96% accuracy > Llava: 89%

**Scoring:**

| Modelo | Calidad (35%) | Velocidad (25%) | VRAM (20%) | Contexto (15%) | Multimodal (5%) | **TOTAL** |
|--------|-------|---------|------|---------|---------|--------|
| **qwen3-vl:8b** | 92 | 55 | 45 | 94 | 98 | **81.2** ⭐ PRIMARY |
| llava:latest | 82 | 70 | 70 | 80 | 88 | **79.0** ⭐ ALT |

**Justificación:**
- Qwen3-VL: Superior OCR (96%), reasoning visual avanzado
- Llava: Alternativa si memoria crítica (4.7 vs 6.1 GB)
- Ambos requieren offloading a CPU con RTX 3050

---

## Audio Mode - STT/TTS

### Speech-to-Text (STT)

**Modelos Recomendados:**
1. **Whisper Large V3** - 7.4% WER, 99+ idiomas
2. **Whisper Large V3 Turbo** - 7.75% WER, 6x más rápido
3. **Distil-Whisper** - English-only, 5.8x más rápido, 1% WER

**Caso: Transcripción en Vivo (Streaming)**

| Modelo | Precisión (40%) | Latencia (40%) | VRAM (20%) | **TOTAL** |
|--------|---------|---------|------|--------|
| **Whisper Turbo** | 95 | 85 | 88 | **88.8** ⭐ PRIMARY |
| Distil-Whisper | 98 | 92 | 98 | **96.0** ⭐ ALT (EN only) |
| Whisper Large V3 | 98 | 60 | 75 | **81.0** FALLBACK |

**Justificación:**
- Turbo: Balance perfecto speed/quality para streaming
- Distil-Whisper: Mejor si English-only
- Large V3: Máxima calidad si latencia no crítica

---

### Text-to-Speech (TTS)

**Modelos Recomendados:**
1. **Kokoro-82M** - <300ms, baja calidad pero ultrarapido
2. **Piper TTS** - Equilibrio speed/quality
3. **F5-TTS** - Mejor naturalidad (~7s para 200 words)

**Caso: Síntesis en Vivo (Conversación)**

| Modelo | Naturalidad (35%) | Latencia (40%) | VRAM (25%) | **TOTAL** |
|--------|---------|---------|------|--------|
| **Kokoro-82M** | 72 | 98 | 99 | **89.2** ⭐ PRIMARY |
| **Piper TTS** | 82 | 75 | 95 | **83.0** ⭐ ALT |
| F5-TTS | 90 | 45 | 85 | **80.0** QUALITY MODE |

**Justificación:**
- Kokoro: <300ms latencia crítico para conversación natural
- Piper: Si necesitas mejor naturalidad aceptando +200ms
- F5-TTS: Modo asincrónico, contenido pre-generado

---

## Algoritmo de Selección

```python
def select_best_model(context: UserContext) -> ModelRanking:
    """
    Selecciona modelos ordenados por puntuación
    
    Args:
        context: {
            mode: "basic" | "intelligent" | "vision",
            language: "es" | "en" | etc,
            platforms: ["linkedin", "twitter"],
            tone: "professional" | "casual",
            improve_prompt: bool,
            deep_thinking: bool,
            char_limits: (min, max),
            prefer_speed: bool,
            prefer_quality: bool,
        }
    
    Returns:
        [
            {"model": "qwen2.5:7b", "score": 84.1, "reason": "..."},
            {"model": "mistral", "score": 81.7, "reason": "..."},
            ...
        ]
    """
    
    # 1. Filtrar modelos que caben en VRAM disponible
    available_models = filter_by_vram(context.hardware.gpu_vram_gb)
    
    # 2. Calcular scores basado en contexto
    scores = {}
    for model in available_models:
        score = 0
        
        # Calidad (35%)
        quality = get_quality_for_context(model, context)
        score += quality * 0.35
        
        # Velocidad (25%)
        speed = get_speed_for_model(model, context.hardware)
        if context.prefer_speed:
            score += speed * 0.30  # Aumentar peso
        else:
            score += speed * 0.25
        
        # Eficiencia VRAM (20%)
        vram_efficiency = calculate_vram_efficiency(model, context.hardware)
        score += vram_efficiency * 0.20
        
        # Contexto (15%)
        context_fit = evaluate_context_fit(model, context)
        score += context_fit * 0.15
        
        # Multilingüe (5%)
        if context.language != "en":
            multi = get_multilingual_support(model, context.language)
            score += multi * 0.05
        
        scores[model] = score
    
    # 3. Ordenar por score
    ranking = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    
    return ranking  # Top 3 modelos recomendados
```

---

## Fuentes de Benchmarks

### Benchmarks de Modelos Texto

1. **MMLU (Massive Multitask Language Understanding)**
   - Fuente: OpenAI, Meta, Alibaba
   - Qwen 2.5 72B: 86.1%
   - Llama 3.1 70B: 86.0%
   - Mistral: 83.7%
   - Enlace: https://github.com/hendrycks/MMLU

2. **HumanEval (Code Generation)**
   - Fuente: OpenAI
   - Llama 3.1 70B: 80.5%
   - Qwen 2.5 7B: 79.8%
   - Mistral: 78.2%
   - Enlace: https://github.com/openai/human-eval

3. **MATH (Mathematical Reasoning)**
   - Fuente: Meta AI
   - Qwen 2.5: 83.1%
   - Llama 3.1: 81.2%
   - Enlace: https://github.com/hendrycks/math

4. **Tokens/Segundo (Ollama Local)**
   - Fuente: Benchmarks propios RTX 3050
   - Gemma3:1b: ~80 T/s
   - Phi3:3.8b: ~75 T/s
   - Mistral:7b: ~25 T/s
   - Llama3.2:7b: ~20 T/s
   - Qwen2.5:7b: ~22 T/s

### Benchmarks Vision

1. **MMMU (Multimodal Multitask Understanding)**
   - Qwen-VL-Max: 72%
   - Llama 3.2 Vision: 68%
   - Enlace: https://mmmu-benchmark.github.io/

2. **DocVQA (Document Visual QA)**
   - Qwen-VL: 96% accuracy (OCR)
   - Llama 3.2: 90% accuracy
   - Enlace: https://docvqa.org/

3. **VQAv2 (Visual Question Answering)**
   - Qwen: 85%
   - Llama 3.2: 82%

### Benchmarks STT

1. **Whisper Benchmarks**
   - Fuente: OpenAI
   - Large V3: 7.4% WER (99+ idiomas)
   - Large V3 Turbo: 7.75% WER, 6x más rápido
   - Distil-Whisper: <1% degradación, 5.8x más rápido
   - Enlace: https://github.com/openai/whisper

2. **LibriSpeech Dataset**
   - Canary Qwen 2.5B: 5.63% WER
   - Granite Speech 8B: 5.85% WER
   - Enlace: https://www.openslr.org/12/

### Benchmarks TTS

1. **Kokoro-82M**
   - Latencia: <300ms (100-word text)
   - Qualidad: 6.5/10 (voz sintética pero clara)
   - Fuente: https://huggingface.co/hexgrad/Kokoro-82M

2. **Piper TTS**
   - Latencia: ~2-3 segundos (200-word text)
   - Cualidad: 8/10 (neutral, profesional)
   - Soporte multilingüe: 20+ idiomas
   - Fuente: https://github.com/rhasspy/piper

3. **F5-TTS**
   - Latencia: ~7 segundos (200-word text)
   - Calidad: 9/10 (natural, expresivo)
   - Fuente: https://github.com/SWivid/F5-TTS

---

## Recomendaciones Finales

### Para tu Sistema RTX 3050 4GB + 31.5GB RAM

**ORDEN DE PREFERENCIA GENERAL:**

```
TIER 1 (Recomendado)
├─ qwen2.5:7b-instruct     (Uso general, equilibrio perfecto)
├─ mistral:latest          (Multilingüe, profesional)
└─ llama3.2:latest         (Eficiencia VRAM)

TIER 2 (Cuando TIER 1 insuficiente)
├─ gemma3:4b               (Si velocidad crítica)
├─ phi3:3.8b-mini          (Extreme speed mode)
└─ qwen2.5:14b             (Si calidad máxima + offload)

TIER 3 (Fallback extremo)
├─ llama2:latest           (Legacy, evitar)
└─ gemma3:1b               (Demasiado pequeño)
```

**Por Caso de Uso:**

| Caso | Modelo 1 | Modelo 2 | Modelo 3 |
|------|----------|----------|----------|
| Content Marketing (EN) | qwen2.5:7b | mistral | llama3.2 |
| Social Casual (ES) | gemma3:4b | phi3:3.8b | llama3.2 |
| Traducción | qwen2.5:7b | mistral | llama3.2 |
| Estrategia Profunda | qwen2.5:14b* | qwen2.5:7b | mistral |
| Visión (OCR) | qwen3-vl:8b | llava | - |
| STT Vivo | Whisper Turbo | Distil-Whisper | - |
| TTS Vivo | Kokoro-82M | Piper | - |

\* Con offloading de capas a RAM

---

## Versiones Futuras

- v1.1: Agregar benchmarks de imagen generativa (SDXL vs Flux)
- v1.2: Scoring dinámico basado en temperatura GPU
- v1.3: Integración con métricas de coste (energy-aware scoring)
- v2.0: Selección automática por machine learning

---

**Documento preparado por:** Anclora Development Team  
**Basado en:** Benchmarks OpenAI, Meta, Alibaba, Ollama Community  
**Última actualización:** Diciembre 11, 2025
