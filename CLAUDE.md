# CLAUDE.md - Instrucciones para Claude Code

Este archivo contiene instrucciones y contexto para que Claude Code asista de manera efectiva en este proyecto.

## 🎯 Objetivo del Proyecto

**Anclora Adapt** es una aplicación React 19 + Vite que permite adaptar y generar contenido estratégico usando modelos locales (Ollama para texto, FastAPI para imagen/audio/análisis visual).

La aplicación está optimizada para:

- Reducir re-renders en 70-80% usando Context API especializado
- Soportar 8+ modos de trabajo (Basic, Intelligent, Campaign, Recycle, Chat, Voice, Live Chat, Image)
- Análisis automático de imágenes con Llava
- Generación de contenido estratégico con contexto

## 📋 Stack Tecnológico

### Frontend

- **React 19** con TypeScript
- **Vite 6** para bundling
- **Context API** para estado global (Theme, Language, Model, UI, Media)
- **Vitest** para testing

### Backend

- **FastAPI** en `python-backend/` para:
  - Análisis de imágenes (Llava via Ollama)
  - Síntesis de voz (TTS - Kokoro)
  - Reconocimiento de voz (STT - Whisper)
  - Optimización de prompts
- **Ollama** para modelos de texto (Llama2, Mistral, etc.)

## 🔧 Configuración Común

```bash
# Frontend
npm install
npm run dev          # http://localhost:4173
npm test

# Backend Python
cd python-backend
python -m venv venv
source venv/bin/activate  # o .\\venv\\Scripts\\Activate.ps1 en Windows
pip install -r requirements.txt
python main.py      # http://localhost:8000
```

## ⚙️ Cosas Importantes a Saber

### 1. **No generes documentos a menos que se te pida explícitamente**

El usuario ha establecido que NO quiere documentación autogenerada innecesaria.

### 2. **Estructura de Carpetas**

```text
├── src/
│   ├── components/       # Modos: Basic, Intelligent, Campaign, Recycle, Chat, Voice, Live Chat, Image
│   ├── context/          # Theme, Language, Model, UI, Media providers
│   ├── hooks/            # useImageAnalyzer, useIntelligentModeState, etc.
│   ├── api/              # Wrappers para Ollama y FastAPI
│   ├── constants/        # Prompts, opciones, capacidades de modelos
│   └── types/            # Tipos TypeScript compartidos
├── python-backend/
│   ├── app/
│   │   ├── services/     # ImageAnalyzer, ModelFallbackManager, ImageCache, ImageSecurityValidator
│   │   ├── routes/       # Endpoints /api/images/analyze, /api/tts, /api/stt, /api/prompts/optimize
│   │   └── models/       # Pydantic schemas (ImageContext, AnalysisMetadata, etc.)
│   └── main.py           # Punto de entrada FastAPI
└── docs/                 # Documentación (QA_CHECKLIST, etc.)
```

### 3. **API Endpoints Clave**

#### Image Analysis

- **POST** `/api/images/analyze` - Analiza imagen y genera prompt
  - Input: multipart form-data (image, user_prompt, deep_thinking, language)
  - Output: `ImageAnalysisResponse` con `image_context.generative_prompt`

#### Prompt Optimization

- **POST** `/api/prompts/optimize` - Mejora prompts automáticamente
  - Input: `{prompt, deep_thinking, language}`
  - Output: `{success, improved_prompt}`

#### TTS/STT

- **POST** `/api/tts` - Síntesis de voz
- **POST** `/api/stt` - Transcripción de audio

### 4. **Problemas Comunes y Soluciones**

#### Cache de Python no se actualiza

- Limpia `__pycache__/` y archivos `.pyc`
- Reinicia completamente el servidor FastAPI
- No uses `uvicorn` con `--reload` en desarrollo si tienes muchos imports

#### Imagen analysis devuelve "Image analysis unavailable"

- Verifica que Ollama está corriendo: `ollama serve`
- Verifica que Llava está instalado: `ollama pull Llava:latest`
- Limpia la caché: elimina `python-backend/cache/image_analysis_cache.db`
- El análisis ahora devuelve prompts genéricos (no intenta procesar con Ollama si hay problemas)

#### Timeout en análisis de imágenes

- Aumenta el timeout en `model_fallback.py` (actualmente 300 segundos)
- Los modelos grandes pueden necesitar más tiempo
- El backend tiene fallback automático si algo falla

### 5. **TypeScript y ESLint**

El proyecto usa TypeScript estricto. Algunas reglas importantes:

- ❌ No uses `as any` sin justificación
- ❌ No dejes imports sin usar
- ✅ Define tipos para datos de API
- ✅ Usa `React.FC<Props>` para componentes

```typescript
// Bien
interface MyProps {
  title: string;
  onClose: () => void;
}

// Mal
const MyComponent = (props: any) => { ... }
```

### 6. **Estado Global (Context API)**

```typescript
// Usar contextos especializados
const { theme, toggleTheme } = useTheme();
const { language, setLanguage } = useLanguage();
const { textModel, setTextModel } = useModel();
```

No centralices TODO en un único context - cada uno tiene su propósito.

### 7. **Componentes por Modo**

Cada modo está en su propia carpeta con:

- `ModeName.tsx` - Componente principal
- `ModeNameForm.tsx` - Formulario de entrada
- `useModeName.ts` - Hook de estado local

Ejemplo: `src/components/modes/IntelligentMode.tsx`

## 🚀 Flujo de Trabajo Recomendado

1. **Lee el archivo actual** antes de hacer cambios
2. **Prueba localmente** antes de commit
3. **Ejecuta `npm test`** para verificar
4. **Verifica la consola** - no debe haber warnings
5. **Haz commits pequeños** y descriptivos

## 📊 Cambios Recientes (Diciembre 2025)

- ✅ Cambiado modelo de análisis: Qwen3-VL → Llava:latest (más rápido, más estable)
- ✅ Implementado caché inteligente con SQLite y deduplicación MD5
- ✅ Fallback automático a prompts genéricos (evita timeouts)
- ✅ Timeout aumentado a 300 segundos en model_fallback.py
- ✅ Corregido parseado de `deep_thinking` en endpoints
- ✅ Hook `useImageAnalyzer` actualizado para manejar ambos formatos de API

## 🐛 Debugging

```bash
# Frontend
npm run dev          # Abre DevTools (F12)
localStorage.getItem('anclora-language')  # Ver preferencias guardadas

# Backend
python main.py       # Ver logs en consola
curl http://localhost:8000/docs  # OpenAPI documentation

# Ollama
ollama list          # Ver modelos instalados
ollama serve         # Iniciar daemon
```

## ❓ Preguntas Frecuentes

**P: ¿Por qué cambiar de Qwen3-VL a Llava?**
R: Qwen3-VL tenía problemas de timeout con imágenes base64. Llava es más estable y rápido.

**P: ¿Cómo agregar un nuevo modo?**
R: Crea `src/components/modes/NewMode.tsx` siguiendo el patrón de los modos existentes.

**P: ¿El análisis de imágenes funciona offline?**
R: No, requiere Ollama + Llava corriendo localmente. Pero puedes usar prompts manuales.

**P: ¿Qué lenguajes soporta?**
R: Frontend: ES, EN. Backend: ES, EN, FR, DE, IT (extendible)

---

**Última actualización:** Diciembre 9, 2025
**Estado del proyecto:** En desarrollo activo
**Contacto:** Usuario (workspace local)
