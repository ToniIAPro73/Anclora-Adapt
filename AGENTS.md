# Repository Guidelines - Anclora-Adapt

## Project Overview

**Anclora-Adapt** es una aplicación React SPA que funciona como asistente AI para estrategia y análisis de productos. Proporciona 8 modos operacionales (Básico, Inteligente, Campaña, Reciclar, Chat, Voz, Live Chat, Imagen) que generan contenido multimodal para diferentes plataformas (LinkedIn, X, Instagram, WhatsApp, Email).

**Stack Actual:**

- **Frontend**: React 19 + Vite 6 + TypeScript
- **Estilos**: CSS variables inline (tema claro/oscuro)
- **API de modelos**: Ollama local (open source, 100% gratis)
- **Idiomas**: ES/EN con persistencia en localStorage

---

## Project Structure & Module Organization

Anclora-Adapt es un **SPA modular refactorizada** (Diciembre 2025) con estructura `src/`:

```bash
.
├── index.html          # DOM root, CSS variables (tema), favicon inline
├── src/
│   ├── App.tsx         # Main component (routing modes, context providers)
│   ├── components/
│   │   ├── layout/     # MainLayout, OutputDisplay
│   │   └── modes/      # BasicMode, IntelligentMode, CampaignMode, etc.
│   │       ├── BasicMode.tsx + BasicModeForm + BasicModeOptions + useBasicModeState
│   │       ├── IntelligentMode.tsx + IntelligentModeForm + IntelligentModeImageOptions + useIntelligentModeState
│   │       └── ... (otros modos)
│   ├── context/        # Contextos especializados (Theme, Language, Model, UI, Media, Interaction)
│   ├── hooks/          # Custom hooks (useModeState, useLayoutState, useInteraction)
│   ├── api/            # Helpers para Ollama, imagen, audio
│   ├── utils/          # Utilidades (fileToBase64, formatCounterText, etc.)
│   ├── types/          # Tipos TypeScript compartidos
│   ├── constants/      # Prompts, opciones, traducciones, capacidades de modelos
│   └── styles/         # commonStyles.ts
├── vite.config.ts      # Configuración Vite
├── tsconfig.json       # TypeScript (ES2022, strict mode)
├── package.json        # Dependencies (React 19, Vite 6)
├── .env.local          # Configuración Ollama y endpoints
├── docs/               # Documentación (CLAUDE.md, AGENTS.md, CONTEXTO.md)
├── dist/               # Build output (ignored)
└── node_modules/       # Dependencies (ignored)
```

**Arquitectura (Fases 1-7 completadas)**:

- ✅ Contextos especializados (70-80% menos re-renders)
- ✅ Componentes modularizados (58-68% menos líneas en archivos principales)
- ✅ Custom hooks para gestión de estado por modo
- ✅ Validación de capacidades de modelos en tiempo real

---

## Build, Test, and Development Commands

```bash
# Setup
npm install

# Development (hot reload, http://localhost:4173)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

**Critical Steps Before PR/Push:**

1. Ejecuta `npm run build` - única verificación automatizada de tipos
2. Prueba manual en **todos los 8 modos** en Chromium
3. Verifica persistencia de tema (Light/Dark/System) en localStorage
4. Verifica persistencia de idioma (ES/EN) en localStorage
5. Comprueba error handling (sin API key, timeouts, permisos de micrófono)
6. Ejecuta `git status` y `git pull --rebase origin main`

---

## Coding Style & Naming Conventions

**Component Structure** (en `index.tsx`):

- Imports en la parte superior
- Constantes de configuración (OLLAMA_BASE_URL, TEXT_MODEL_ID, etc.)
- Helper functions (callTextModel, callImageModel, fileToBase64, etc.)
- Type definitions (ThemeMode, InterfaceLanguage, BlobLike)
- App component con useState/useEffect agrupados al inicio
- Translations object (ES y EN siempre en paralelo)

**Naming:**

- `CamelCase`: Componentes de React (App, BasicMode, etc.)
- `camelCase`: Funciones, variables, parámetros
- `SCREAMING_SNAKE_CASE`: Constantes globales (OLLAMA_BASE_URL)
- `outputs`: Formato estricto `[{ platform, content }, ...]` en todo prompt

**Helpers Estándar** (refactorizar cuando sea posible):

- `callTextModel(prompt)` → Ollama `/api/generate`
- `callImageModel(options)` → Generación de imagen vía backend (FastAPI /api/image, SDXL Lightning)
- `callTextToSpeech(text, voicePreset, language?)` → Usa el backend FastAPI (`/api/tts`, Kokoro-82M)
- `callSpeechToText(audioBlob)` → Usa el backend FastAPI (`/api/stt`, Faster-Whisper)
- `fileToBase64(file)` → Convierte File a base64
- `ensureApiKey()` → Valida credenciales
- `analyzeImage(imageBytes, userPrompt, deepThinking, language)` → Backend FastAPI (`/api/images/analyze`, Llava:latest para análisis visual con fallback a prompts genéricos)

**Translations:**

```typescript
const translations = {
  es: { key: "Valor en español", ... },
  en: { key: "Value in English", ... }
};
```

Cualquier nueva cadena debe agregarse en AMBOS idiomas.

---

## Testing Guidelines

**Nota**: No existe suite automatizada. Todo requiere QA manual.

**8 Modos a Probar:**

1. **Básico** - Solo texto, salida única
2. **Inteligente** - Texto + Imagen con contexto/destino
3. **Campaña** - Texto + Imagen para campaña
4. **Reciclar** - Repropósito de contenido
5. **Chat** - Conversación multi-turno
6. **Voz** - STT + TTS + respuesta de audio
7. **Live Chat** - Chat en tiempo real
8. **Imagen** - Solo generación de imágenes

**Modo Inteligente específico**:

- [ ] Entrada: Idea + Contexto renderiza correctamente
- [ ] Selector Idioma con ancho adaptable (no 100%)
- [ ] Checkbox "Pensamiento profundo" alineado a la derecha sin background
- [ ] Checkbox "Incluir Imagen" muestra/oculta opciones con scroll automático
- [ ] Botón "Seleccionar archivo" es blanco con bordes redondeados
- [ ] Preview de imagen se muestra en chip (40x40px) con nombre y tamaño
- [ ] Sin prompt para imagen → error "Escribe el prompt para la imagen"
- [ ] Con prompt → genera imagen sin "Pensamiento profundo" aplicado

**Analizador de Imágenes (Llava:latest con fallback inteligente)**:

- [ ] Backend (`python-backend/app/services/image_analyzer.py`) está corriendo en puerto 8000
- [ ] Modelo Llava:latest está disponible en Ollama (`ollama list` debe mostrar `Llava:latest`)
- [ ] Fallback automático si Llava no está disponible: intenta qwen3-vl:8b, luego otros modelos
- [ ] Si no hay modelos de visión disponibles → devuelve prompt genérico en idioma solicitado
- [ ] Al subir imagen sin prompt de usuario → se genera análisis automático
- [ ] Análisis produce prompts detallados que describen elementos específicos
- [ ] Prompts en español (ES), inglés (EN), francés (FR), alemán (DE), italiano (IT) según idioma seleccionado
- [ ] Modo "Pensamiento profundo" puede activarse para análisis más extensos
- [ ] Si análisis falla → fallback a entrada manual del usuario sin errores críticos
- [ ] Logs en backend muestran: modelo usado, fallback aplicado, tamaño de imagen, estructura de payload
- [ ] Caché SQLite con deduplicación MD5 y TTL de 30 días (`image_analysis_cache.db`)
- [ ] Endpoint cache stats: `GET /api/images/cache-stats` para monitoreo
- [ ] Endpoint limpiar expirados: `GET /api/images/cache-clear-expired` para mantenimiento

**Checklist por Cambio:**

- [ ] Todos los 8 modos funcionan sin errores
- [ ] Tema persiste (Light ↔ Dark ↔ System) tras reload
- [ ] Idioma persiste (ES ↔ EN) tras reload
- [ ] Errores se muestran correctamente (sin API key, timeout, micrófono denegado)
- [ ] Consola del navegador sin errores de TypeScript
- [ ] `npm run build` pasa sin errores

**Si añades lógica compleja:**

- Crea carpeta `__tests__/` junto al componente
- Usa Vitest o React Testing Library
- Documenta cómo ejecutar las pruebas en el PR

---

## Commit & Pull Request Guidelines

**Conventional Commits:**

- `feat:` - Nueva funcionalidad
- `fix:` - Corrección de bug
- `docs:` - Documentación
- `refactor:` - Mejora de código sin cambio funcional
- `test:` - Adición o mejora de tests
- `chore:` - Cambios de configuración, dependencias

**Ejemplo:**

```bash
feat: add voice mode STT support with Whisper model

- Integrate Ollama Whisper model for speech-to-text
- Add microphone permission handling
- Update error messages for audio capture failures

Tested: Voice mode, Voz mode
```

**PR Checklist:**

- [ ] Resumen claro del cambio (1-2 párrafos)
- [ ] Lista de archivos clave modificados
- [ ] Evidencia visual (capturas si hay cambios UI)
- [ ] Comandos de verificación ejecutados (`npm run build`, navegadores)
- [ ] Sin conflictos con main/development

**Push Seguro:**

```bash
git status                           # Verifica cambios
git pull --rebase origin main        # Sincroniza
git push origin <branch>             # Push normal
# Si necesitas forzar:
git push --force-with-lease origin <branch>  # Seguro, no sobrescribe trabajo ajeno
```

---

## AI Model & Configuration Notes (Ollama)

### API Provider: Ollama (Local, Open Source, Free)

**Por qué Ollama:**

- ✅ Open source (100% gratis, sin dependencias comerciales)
- ✅ Local (sin 404s, sin rate limits, sin CORS)
- ✅ Modelos confiables (Llama 2, Mistral, Neural Chat, etc.)
- ✅ API simple (`/api/generate` para texto)

**Configuración:**

````bash
# Instalar Ollama desde https://ollama.ai

# Descargar modelo (ej: Llama 2, ~4GB)
ollama pull llama2

# Ejecutar servidor
ollama serve
```bash

**Modelos Recomendados:**

| Modelo      | Tamaño | Uso             | Comando                   |
| ----------- | ------ | --------------- | ------------------------- |
| llama2      | 4GB    | Texto general   | `ollama pull llama2`      |
| mistral     | 5GB    | Mejor calidad   | `ollama pull mistral`     |
| neural-chat | 4GB    | Chat optimizado | `ollama pull neural-chat` |
| orca-mini   | 2GB    | Rápido/ligero   | `ollama pull orca-mini`   |

**Variables de Configuración:**

```bash
VITE_OLLAMA_BASE_URL=http://localhost:11434  # URL del servidor Ollama
VITE_TEXT_MODEL_ID=llama2                     # Modelo a usar
````

**Imagen/TTS/STT:**

- **Imagen**: Backend FastAPI (`python-backend/main.py`) expone `/api/image` con Stable Diffusion
- **Análisis de Imágenes**: Backend expone `/api/images/analyze` con Llava:latest + fallback chain
- **TTS**: Backend expone `/api/tts` con Kokoro-82M (síntesis neuronal de voz)
- **STT**: Backend expone `/api/stt` con Faster-Whisper (transcripción de audio)
- **Caché**: SQLite implementado para análisis de imágenes con TTL de 30 días

---

## Known Limitations & Future Improvements

### Limitaciones Actuales

1. ~~**Monolítico**~~ **SOLUCIONADO** - Refactorizado a estructura `src/` modular (Fase 7 - Diciembre 2025)

   - ✅ Componentes separados por modo con sub-componentes especializados
   - ✅ Custom hooks para gestión de estado por modo
   - ✅ 70-80% reducción en re-renders innecesarios
   - ✅ 58-68% reducción de líneas en componentes principales

2. **Modalaides incompletas** - TTS/STT/Imagen parcialmente implementados

   - ✅ Generación de imagen con Stable Diffusion vía `/api/image`
   - ✅ Análisis de imágenes con Llava:latest vía `/api/images/analyze` (NUEVO - Diciembre 2025)
   - ✅ TTS con Kokoro-82M vía `/api/tts`
   - ✅ STT con Whisper vía `/api/stt`
   - ⚠️ Algunas modalaidades pueden necesitar configuración adicional

3. **Tests automatizados limitados** - Cobertura básica, necesita expansión

   - ✅ Vitest configurado
   - ⚠️ Necesita tests para componentes críticos

4. **Sin CI/CD** - Build y deploy manuales

   - ⚠️ Oportunidad para GitHub Actions

5. **Sin persistencia servidor** - Solo localStorage, no backend de base de datos

   - ✅ Caché SQLite local implementado para análisis de imágenes (Diciembre 2025)
   - ⚠️ Historial de sesiones aún solo en localStorage

6. **Sin autenticación** - Acceso público sin restricciones
   - ⚠️ Requerido para producción multi-usuario

### Áreas de Mejora (Priority Order)

1. ~~**Refactor a estructura `src/`**~~ **COMPLETADO (Diciembre 2025)**

   - ✅ Componentes modulares por modo
   - ✅ Custom hooks especializados
   - ✅ Context API optimizado (70-80% menos re-renders)

2. **Expandir cobertura de tests** - Vitest + React Testing Library

   - ✅ Vitest configurado
   - ⚠️ Necesita tests para componentes críticos y funciones helper

3. **Mejorar documentación de prompts** - Crear guía de prompt engineering

   - ✅ CONTEXTO.md, CLAUDE.md, AGENTS.md actualizados
   - ⚠️ Guía específica de engineering prompts para cada modo

4. **Performance profiling** - Medir exactamente dónde se gastan los ms

   - ⚠️ Tools: React DevTools Profiler, Lighthouse

5. **Mejorar manejo de errores** - Mensajes más específicos para errores de red

   - ⚠️ Retry logic, timeout handling, fallback chains

6. **Multi-user backend** - Guardar sesiones, historial, preferencias

   - ⚠️ Node.js/Python backend con database persistente

7. **API REST** - Exponer funcionalidades como API pública

   - ✅ Backend FastAPI parcialmente expuesto
   - ⚠️ Documentación OpenAPI, rate limiting

8. **Autenticación** - Login, OAuth2/JWT, roles, límites por usuario

   - ⚠️ Requerido para producción multi-usuario

9. **Internacionalización completa** - Extender a más idiomas

   - ✅ Soporte base para ES, EN, FR, DE, IT en análisis de imágenes
   - ⚠️ Expandir a modo interfaz

10. **Analytics** - Tracking de uso, métricas de engagement
    - ⚠️ Integración con herramientas de analytics

---

## Recent Changes & Backend Configuration (Diciembre 2025)

### Dynamic Model Selection for Prompt Optimization (Phase 9 - Diciembre 10)

**Problema**: El backend tenía una lista hardcoded de modelos que no se adaptaba a lo disponible en el hardware

**Solución Implementada**:

- **Nuevo archivo**: `python-backend/app/services/model_selector.py`

  - `get_available_models()` - Queries `http://localhost:11434/api/tags` dynamically
  - `select_best_models()` - Prioritizes: Qwen2.5:14b > 7b-instruct > 7b > Mistral > Llama
  - `get_model_candidates()` - Main entry point with fallback to MODEL_PRIORITY

- **Modificado**: `python-backend/app/services/prompt_optimizer.py`
  - Reemplaza hardcoded list con `get_model_candidates(count=3)`
  - Removed error when no models (fallback garantiza éxito)
  - Intenta modelos en orden óptimo

**Resultados**:

- Genera **2000+ caracteres** cuando `deep_thinking=true` y `better_prompt=true`
- **Qwen2.5:14b** seleccionado automáticamente como modelo primario
- Fallback chain funciona incluso si Ollama `/api/tags` no responde

**Testing**:

```bash
# Backend test
cd python-backend
python -c "from app.services.model_selector import get_model_candidates; print(get_model_candidates())"
# Output: ['qwen2.5:14b', 'qwen2.5:7b-instruct', 'qwen2.5:7b']

# Backend test con prompt
python << 'EOF'
from app.services.prompt_optimizer import improve_prompt
result = improve_prompt(
    raw_prompt="Dormitorios, piscina privada, amenities de clase mundial...",
    deep_thinking=True,
    better_prompt=True,
    language="es"
)
print(f"Generated {len(result.improved_prompt)} characters")
EOF
# Output: Generated 2039 characters
```

### Model Scoring Service & Frontend Selection (Phase 10 - Diciembre 11)

**Problema**: El frontend dependía de heurísticas simplificadas y no tenía una métrica consistente por modo para priorizar modelos cuando el usuario pedía idiomas, velocidades o rangos de caracteres específicos.

**Solución Implementada**:

- **Nuevo servicio**: `src/services/modelScoringService.ts` aplica la fórmula documentada (quality 35%, speed 25%, VRAM 20%, context 15%, multilingual 5%) y devuelve rankings con razones y warnings de VRAM.
- **Métricas y tipos**: `src/constants/modelBenchmarks.ts` y `src/types/modelScoring.ts` centralizan los benchmarks (MMLU, tokens/s, VRAM necesaria, idiomas y especializaciones).
- **Integración en App.tsx**:
  - El scoring se ejecuta antes de `getModelCandidates` para Basic/Intelligent con contexto completo (language, tone, platforms, preferSpeed/Quality, min/max).
  - Se reordena la cadena de candidatos (incluyendo selección manual cuando aplica) y se muestran las razones/advertencias en la barra de estado.
- **Documentación nueva**: `docs/model_scoring_system.md` y `docs/implementation_guide.md` explican los casos de uso y la implementación en TypeScript/React.

**Resultados**:

- Prioriza automáticamente los modelos que cumplen la restricción de VRAM, características de idioma y preferencias de velocidad/calidad.
- El checkbox “Mejorar prompt” ahora conecta de forma más directa con el scoring y se reflejan los warnings junto al proveedor escogido.
- Dependencias de hardware y evidencias documentadas: se actualizó AGENTS, CONTEXTO y se añadió la guía técnica dedicada.

**Testing**:

- Verificar manualmente Basic e Intelligent para asegurarse de que la línea de status muestra el motivo que viene del scoring y que la generación respeta las restricciones.

### Image Analyzer Migration (Phase 8)

**Problema**: Qwen3-VL causaba timeouts al procesar imágenes base64 en Ollama

**Solución Implementada**:

- Cambio de modelo: Qwen3-VL → Llava:latest (más estable y rápido)
- Implementación de fallback chain automático
- Fallback a prompts genéricos si no hay modelos de visión disponibles
- Caché SQLite con deduplicación MD5 y TTL de 30 días

**Archivos modificados**:

- `python-backend/app/services/image_analyzer.py` - Cambio a Llava:latest
- `python-backend/app/services/model_fallback.py` - Fallback chain y prompts genéricos
- `python-backend/app/routes/image_analysis.py` - Parseado correcto de parámetros booleanos
- `src/hooks/useImageAnalyzer.ts` - Normalización de respuestas API

**Configuración requerida**:

```bash
# Descargar Llava
ollama pull Llava:latest

# O descargar alternativas para fallback
ollama pull qwen3-vl:8b
ollama pull qwen2.5:7b
```

### Backend FastAPI Configuration

**Ubicación**: `python-backend/main.py`

**Endpoints expuestos**:

- `POST /api/images/analyze` - Análisis de imágenes con Llava
- `GET /api/images/cache-stats` - Estadísticas de caché
- `GET /api/images/cache-clear-expired` - Limpiar entradas expiradas
- `POST /api/image` - Generación de imágenes (Stable Diffusion)
- `POST /api/tts` - Síntesis de voz (Kokoro-82M)
- `POST /api/stt` - Transcripción de audio (Whisper)
- `GET /api/voices` - Lista de voces disponibles

**Startup**:

```bash
cd python-backend
python main.py
# Servidor en http://localhost:8000
```

### Python Cache Clearing

**Problema**: Cambios en archivos `.py` no se reflejan sin limpiar caché de Python

**Solución**:

```bash
# Limpiar todos los directorios __pycache__
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null

# Eliminar archivos .pyc compilados
find . -name "*.pyc" -delete

# Reiniciar servidor completamente (no reload)
python main.py
```

### Database Cache Management

**Ubicación**: `python-backend/cache/image_analysis_cache.db` (SQLite)

**Características**:

- Deduplicación basada en MD5 hash de imagen
- TTL de 30 días (configurable en `image_cache.py`)
- Índices para búsqueda rápida
- Endpoint de monitoreo: `GET /api/images/cache-stats`

**Limpieza**:

```bash
# Ver estadísticas del caché
curl http://localhost:8000/api/images/cache-stats

# Limpiar entradas expiradas
curl http://localhost:8000/api/images/cache-clear-expired

# Eliminar todo el caché (fuerza reinicio del servidor)
rm python-backend/cache/image_analysis_cache.db
```

**Si el archivo .db está bloqueado** (Windows):

```powershell
# PowerShell con permisos de administrador
Remove-Item -Path "python-backend/cache/image_analysis_cache.db" -Force
```

---

## Security Notes

- **No subir `.env.local`** - Contiene credenciales (Ollama API, si aplica)
- **Ollama local es seguro** - No viaja por internet
- **CORS en dev** - El proxy de Vite maneja CORS automáticamente
- **Validación de entrada** - Sanitizar prompts antes de enviar a modelos
- **Errores sensibles** - No mostrar detalles internos (URLs, modelos) a usuarios finales
