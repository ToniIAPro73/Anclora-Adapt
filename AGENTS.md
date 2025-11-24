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

Anclora-Adapt es un **SPA monolítico sin carpeta `src`**: toda la lógica, componentes, helpers y estado global viven en `index.tsx` (~80KB). La estructura es:

```
.
├── index.html          # DOM root, CSS variables (tema), favicon inline
├── index.tsx           # Monolithic app (TODO: refactor to src/)
├── vite.config.ts      # Proxy config, API key injection
├── tsconfig.json       # TypeScript config (target ES2022, JSX react-jsx)
├── package.json        # Dependencies (React 19, Vite 6)
├── .env.local          # Ollama config (VITE_OLLAMA_BASE_URL, VITE_TEXT_MODEL_ID)
├── CLAUDE.md           # Claude Code guidance
├── AGENTS.md           # This file
├── CONTEXTO.md         # Historical context & known issues
├── dist/               # Build output (ignored)
└── node_modules/       # Dependencies (ignored)
```

**Futuro**: Migrar a estructura `src/` con:
- `src/components/` - Componentes por modo
- `src/hooks/` - Custom hooks (useTheme, useLanguage, useTextModel)
- `src/api/` - Helpers para Ollama (callTextModel, callImageModel, etc.)
- `src/utils/` - Utilidades generales
- `src/types/` - Tipos TypeScript compartidos

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
- `callImageModel(prompt, base64Image?)` → Placeholder para imagen
- `callTextToSpeech(text, voicePreset)` → Placeholder para TTS
- `callSpeechToText(audioBlob)` → Placeholder para STT
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

### Limitaciones Actuales:
1. **Monolítico** - Todo en index.tsx (~80KB), difícil de mantener
2. **Texto solo** - Imagen/TTS/STT no implementados (placeholders)
3. **Sin tests automatizados** - Solo QA manual
4. **Sin CI/CD** - Build y deploy manuales
5. **Sin persistencia** - Solo localStorage, no backend
6. **Sin autenticación** - Acceso público sin restricciones

### Áreas de Mejora (Priority Order):
1. **Refactor a estructura `src/`** - Separar por modo/funcionalidad
2. **Implementar imagen en Ollama** - Integrar Stable Diffusion localmente
3. **Implementar TTS/STT** - Usar Bark/Whisper vía Ollama
4. **Agregar tests** - Vitest para helpers, React Testing Library para componentes
5. **Multi-user backend** - Guardar sesiones, historial, preferencias
6. **API REST** - Exponer funcionalidades como API pública
7. **Autenticación** - Login, roles, límites por usuario
8. **Analytics** - Tracking de uso, métricas de engagement

---

## Security Notes

- **No subir `.env.local`** - Contiene credenciales (Ollama API, si aplica)
- **Ollama local es seguro** - No viaja por internet
- **CORS en dev** - El proxy de Vite maneja CORS automáticamente
- **Validación de entrada** - Sanitizar prompts antes de enviar a modelos
- **Errores sensibles** - No mostrar detalles internos (URLs, modelos) a usuarios finales
