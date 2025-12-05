# Anclora Adapt

![GHBanner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

Aplicación React 19 + Vite 6 + TypeScript para generar/adaptar contenido con modelos locales (Ollama para texto y endpoints propios para imagen/TTS/STT). La UI está refactorizada en componentes por modo y usa contextos globales (`ThemeContext`, `LanguageContext`, `InteractionContext`) para evitar prop drilling.

---

## Stack & requisitos

| Capa            | Detalle                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| UI              | React 19, Vite 6, TypeScript, CSS-in-JS básico                          |
| Estado global   | Context API (`src/context`)                                             |
| Modelos texto   | [Ollama](https://ollama.ai/) (`/api/generate`, `/api/tags`)             |
| Imagen          | Endpoint HTTP (SD 1.5/SDXL, bridge incluido)                            |
| Audio (TTS/STT) | Endpoints locales (Whisper/Kokoro/etc.)                                 |
| Tests           | [Vitest](https://vitest.dev/) + React Testing Library                   |

**Requisitos previos**

- Node.js 18+
- Ollama en local (`ollama serve`)
- (Opcional) backend de imagen en `http://localhost:9090/image`
- (Opcional) backend de TTS/STT (puedes usar `python-backend` o tus propios servidores)

---

## Estructura del repositorio

```
.
├── assets/               # Recursos estáticos (capturas, audio demo)
├── docs/                 # Documentación viva (AGENTS, ROADMAP, setups, etc.)
├── src/                  # Código de la SPA (App.tsx, contextos, componentes)
│   ├── api/              # wrappers a Ollama/otros servicios
│   ├── components/       # layout + modos (Basic/Intelligent/...)
│   ├── constants/        # prompts, opciones, traducciones
│   ├── context/          # Theme/Language/Interaction providers
│   ├── hooks/, services/ # hooks reutilizables y helpers
│   └── types/, utils/    # Tipos y utilidades comunes
├── scripts/              # utilidades (clean ports, image bridge, tts server…)
├── python-backend/       # (Opcional) FastAPI/Fast endpoints unificados
├── dist/                 # build de producción (generado por Vite)
└── achive/               # archivos legacy (App.back.tsx, planes históricos, etc.)
```

La raíz queda reservada para archivos estándar de un proyecto Vite/React (`package*.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.env.local`, `.gitignore`, `README.md`).

---

## Configuración rápida (`.env.local`)

```dotenv
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_TEXT_MODEL_ID=llama2

# Imagen (bridge local opcional)
VITE_IMAGE_MODEL_ENDPOINT=http://localhost:9090/image
VITE_IMAGE_MODEL_ID=stable-diffusion

# Audio (configura tus endpoints si los tienes)
VITE_TTS_ENDPOINT=http://localhost:9000/tts
VITE_TTS_MODEL_ID=pyttsx3
VITE_STT_ENDPOINT=
VITE_STT_MODEL_ID=

# (Opcional) Token para backends externos
VITE_MODEL_API_KEY=
```

Los toggles de idioma/tema/modelo guardan su estado en `localStorage` (`anclora-language`, `anclora-theme`, `anclora.textModel`).

---

## Scripts principales

```bash
npm install          # Dependencias
npm run dev          # Dev server (http://localhost:4173)
npm run build        # Build de producción
npm test             # Vitest + React Testing Library
npm run check:health # Valida Ollama y endpoints configurados
npm run image:bridge # Bridge HTTP -> Stable Diffusion (si lo necesitas)
npm run tts:server   # Ejemplo simple de TTS (pyttsx3)
```

> **Tip:** ejecuta `npm run check:health` antes de QA para asegurarte de que Ollama y tus endpoints opcionales responden.

---

## Modelos y perfiles recomendados

| Tipo   | Modelo             | RAM/VRAM aprox. | Uso sugerido                    |
| ------ | ------------------ | --------------- | --------------------------------|
| Texto  | `llama2`           | 4 GB            | Equilibrado generalista         |
| Texto  | `mistral`          | ~5 GB           | Mayor contexto/calidad          |
| Texto  | `neural-chat`      | 4 GB            | Conversación                    |
| Texto  | `orca-mini`        | 2 GB            | Rápido/ligero                   |
| Imagen | SD 1.5 / SDXL-Lite | 4 GB VRAM       | Generación base 768px           |
| TTS    | pyttsx3/Kokoro     | CPU/GPU ligera  | Síntesis local simple/neuronal  |
| STT    | Whisper small/base | CPU/GPU 4–6 GB  | Transcripción de clips cortos   |

Perfiles ejemplo:

- **RTX 3050** → `llama2` o `mistral`, bridge SDXL Lightning (4 pasos), TTS Kokoro + STT Whisper.
- **Solo CPU** → `orca-mini`, imagen deshabilitada, TTS pyttsx3.
- **Texto únicamente** → define solo `VITE_OLLAMA_BASE_URL` y `VITE_TEXT_MODEL_ID`.

---

## Flujo de desarrollo

1. **Instala dependencias**  
   `npm install`

2. **Arranca Ollama**  
   `ollama pull llama2` → `ollama serve`

3. **(Opcional) Endpoints de imagen/voz**  
   - Imagen: `npm run image:bridge` o apunta a tu servidor SD.
   - TTS/STT: usa `python-backend` o scripts propios y actualiza `.env.local`.

4. **Dev server**  
   `npm run dev` → <http://localhost:4173>

5. **Tests & build antes de publicar**  
   `npm test` → `npm run build`

---

## QA manual (resumen)

Consulta `docs/QA_CHECKLIST.md`. Cada cambio debe validar:

- Los 8 modos (Basic, Intelligent, Campaign, Recycle, Chat, Voice, Live Chat, Image).
- Persistencia de tema (Light/Dark/System) y lenguaje (ES/EN) tras recargar.
- Manejo de errores (sin API key, timeouts, micrófono denegado, endpoints caídos).
- Consola limpia y `npm run build` sin fallos.

---

## Notas finales

- El alias `@/` apunta a `src/` (ver `tsconfig.json`).
- Los componentes consumen estado global mediante `useTheme`, `useLanguage`, `useInteraction`.
- `achive/` guarda referencias históricas (App back, planes de refactor, herramientas de migración). No borres nada sin revisar.

Si necesitas más contexto (roadmap, instrucciones de agentes, setups), revisa la carpeta `docs/`. ¡Feliz hacking! 🎯
