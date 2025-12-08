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

Anclora-Adapt es un **SPA modular** (refactorizada en diciembre 2025) con estructura `src/` organizada por funcionalidad:

```
.
├── index.html                  # DOM root, CSS variables (tema)
├── index.tsx                   # Entry point (mínimo, solo imports)
├── vite.config.ts              # Configuración Vite + API proxy
├── tsconfig.json               # TypeScript config (ES2022, JSX react-jsx)
├── package.json                # Dependencies (React 19, Vite 6)
├── .env.local                  # Ollama config (VITE_OLLAMA_BASE_URL, VITE_TEXT_MODEL_ID)
├── src/
│   ├── App.tsx                 # Componente principal
│   ├── main.tsx                # Provider wrapper (contextos)
│   ├── api/                    # API helpers (callTextModel, callImageModel, etc.)
│   ├── components/
│   │   ├── modes/              # Componentes de modo (BasicMode, IntelligentMode, TTSMode, etc.)
│   │   │   ├── BasicMode.tsx           # 240 líneas (+ 3 sub-componentes)
│   │   │   ├── BasicModeForm.tsx       # Sub-componente
│   │   │   ├── BasicModeOptions.tsx    # Sub-componente
│   │   │   ├── useBasicModeState.ts    # Custom hook
│   │   │   ├── IntelligentMode.tsx     # 180 líneas (+ 3 sub-componentes)
│   │   │   ├── TTSMode.tsx             # 160 líneas (+ 3 sub-componentes)
│   │   │   └── ... (otros modos)
│   │   ├── common/             # Componentes compartidos (OutputDisplay, etc.)
│   │   └── layout/             # Componentes de layout (MainLayout, Header, etc.)
│   ├── context/                # Contextos especializados (Fases 1-5)
│   │   ├── ModelContext.tsx     # Gestiona selectedModel, lastModelUsed, hardwareProfile
│   │   ├── UIContext.tsx        # Gestiona loading, error, outputs, activeMode
│   │   ├── MediaContext.tsx     # Gestiona selectedFile, audioBlob
│   │   ├── useContextSelectors.ts  # Hooks especializados (useModeState, useLayoutState)
│   │   └── InteractionContext.tsx  # Legacy wrapper para backward compatibility
│   ├── hooks/                  # Custom hooks (useTheme, useLanguage, useImageGeneration, etc.)
│   ├── types/                  # Tipos TypeScript compartidos
│   ├── utils/                  # Utilidades generales (formatters, converters, etc.)
│   ├── constants/              # Constantes (translations, options, prompts, etc.)
│   └── styles/                 # Estilos globales (commonStyles.ts)
├── docs/
│   ├── CLAUDE.md               # Claude Code guidance (actualizado)
│   ├── AGENTS.md               # This file (actualizado)
│   └── CONTEXTO.md             # Historical context & optimization phases (actualizado)
├── dist/                       # Build output (ignored)
└── node_modules/               # Dependencies (ignored)
```

**Status**: ✅ Estructura completada en diciembre 2025 con:
- 3 contextos especializados (ModelContext, UIContext, MediaContext)
- Componentes modularizados con custom hooks
- 70-80% reducción en re-renders innecesarios
- 58-68% reducción en tamaño de archivos principales

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

**Component Structure** (en `src/`):
- Imports en la parte superior
- Type definitions al inicio del archivo
- Componentes con custom hooks para state management
- Helpers en `src/api/` y `src/utils/`
- Constants en `src/constants/`
- Translations object en `src/constants/translations.ts` (ES y EN siempre en paralelo)

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
```
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
```bash
# Instalar Ollama desde https://ollama.ai

# Descargar modelo (ej: Llama 2, ~4GB)
ollama pull llama2

# Ejecutar servidor
ollama serve
```

**Modelos Recomendados:**
| Modelo | Tamaño | Uso | Comando |
|--------|--------|-----|---------|
| llama2 | 4GB | Texto general | `ollama pull llama2` |
| mistral | 5GB | Mejor calidad | `ollama pull mistral` |
| neural-chat | 4GB | Chat optimizado | `ollama pull neural-chat` |
| orca-mini | 2GB | Rápido/ligero | `ollama pull orca-mini` |

**Variables de Configuración:**
```
VITE_OLLAMA_BASE_URL=http://localhost:11434  # URL del servidor Ollama
VITE_TEXT_MODEL_ID=llama2                     # Modelo a usar
```

**Imagen/TTS/STT:**
Ollama solo soporta texto nativamente. Para imagen/TTS/STT:
- Implementación futura: Integrar modelos adicionales (Stable Diffusion, Bark, Whisper)
- O: Usar endpoints públicos gratuitos cuando sea necesario

---

## Known Limitations & Future Improvements

### Limitaciones Actuales (Diciembre 2025):
1. ~~**Monolítico**~~ - **FIXED**: Refactorizado a estructura `src/` modular con contextos especializados (70-80% menos re-renders)
2. **Texto solo** - Imagen/TTS/STT no completamente integrados (APIs expuestas pero requieren modelos definitivos)
3. **Sin tests automatizados** - Solo QA manual en los 8 modos
4. **Sin CI/CD** - Build y deploy manuales
5. **Sin persistencia completa** - localStorage solo, no backend con BD
6. **Sin autenticación** - Acceso público sin restricciones

### Áreas de Mejora (Priority Order):

**Alta Prioridad:**
1. ✅ ~~**Refactor a estructura `src/`**~~ - **Completado** (Fases 1-7, diciembre 2025)
2. **Implementar imagen en Ollama** - Integrar Stable Diffusion localmente
3. **Implementar TTS/STT** - Usar Kokoro/Whisper vía backends (APIs ya definidas)
4. **Agregar tests** - Vitest para helpers, React Testing Library para componentes

**Media Prioridad:**
5. **Multi-user backend** - Guardar sesiones, historial, preferencias en BD
6. **CI/CD pipeline** - GitHub Actions con lint, tests, build validation
7. **Code splitting por modos** - Lazy loading para mejorar initial load time

**Baja Prioridad:**
8. **Autenticación** - Login, roles, límites por usuario
9. **Analytics** - Tracking de uso, métricas de engagement
10. **API REST pública** - Exponer funcionalidades como API

---

## Security Notes

- **No subir `.env.local`** - Contiene credenciales (Ollama API, si aplica)
- **Ollama local es seguro** - No viaja por internet
- **CORS en dev** - El proxy de Vite maneja CORS automáticamente
- **Validación de entrada** - Sanitizar prompts antes de enviar a modelos
- **Errores sensibles** - No mostrar detalles internos (URLs, modelos) a usuarios finales
