# Anclora Adapt

![GHBanner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

Aplicación React 19 + Vite 6 + TypeScript para generar/adaptar contenido estratégico con modelos locales (Ollama para texto y endpoints propios para imagen/TTS/STT). Es una **SPA (Single Page Application)** refactorizada con **contextos especializados** (Theme, Language, Model, UI, Media) minimizando re-renders en 70-80%, y componentes modulares por modo (Basic, Intelligent, Campaign, Recycle, Chat, Voice, Live Chat, Image).

---

## Stack & requisitos

| Capa            | Detalle                                                     |
| --------------- | ----------------------------------------------------------- |
| UI              | React 19, Vite 6, TypeScript, CSS-in-JS básico              |
| Estado global   | Context API (`src/context`)                                 |
| Modelos texto   | [Ollama](https://ollama.ai/) (`/api/generate`, `/api/tags`) |
| Imagen          | Endpoint HTTP (SD 1.5/SDXL, bridge incluido)                |
| Audio (TTS/STT) | Endpoints locales (Whisper/Kokoro/etc.)                     |
| Tests           | [Vitest](https://vitest.dev/) + React Testing Library       |

## Requisitos previos

- Node.js 18+
- Ollama en local (`ollama serve`)
- (Opcional) backend de imagen en `http://localhost:9090/image`
- (Opcional) backend de TTS/STT (puedes usar `python-backend` o tus propios servidores)

---

## Estructura del repositorio

```Tree
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
VITE_API_BASE_URL=http://localhost:8000
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_TEXT_MODEL_ID=llama2

# Imagen (FastAPI expone /api/image)
VITE_IMAGE_MODEL_ENDPOINT=http://localhost:8000/api/image
VITE_IMAGE_MODEL_ID=sdxl-lightning

# Audio (FastAPI expone /api/tts y /api/stt)
VITE_TTS_ENDPOINT=http://localhost:8000/api/tts
VITE_TTS_MODEL_ID=kokoro
VITE_STT_ENDPOINT=http://localhost:8000/api/stt
VITE_STT_MODEL_ID=whisper-large-v3

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
node achive/tools/image-bridge.js # Bridge → Automatic1111 (legacy, opcional)
python python-backend/main.py  # Backend FastAPI (Kokoro + Whisper + SDXL)
```

> **Tip:** ejecuta `npm run check:health` antes de QA para asegurarte de que Ollama y tus endpoints opcionales responden.

---

## Modelos y perfiles recomendados

| Tipo   | Modelo             | RAM/VRAM aprox. | Uso sugerido                   |
| ------ | ------------------ | --------------- | ------------------------------ |
| Texto  | `llama2`           | 4 GB            | Equilibrado generalista        |
| Texto  | `mistral`          | ~5 GB           | Mayor contexto/calidad         |
| Texto  | `neural-chat`      | 4 GB            | Conversación                   |
| Texto  | `orca-mini`        | 2 GB            | Rápido/ligero                  |
| Imagen | SD 1.5 / SDXL-Lite | 4 GB VRAM       | Generación base 768px          |
| TTS    | pyttsx3/Kokoro     | CPU/GPU ligera  | Síntesis local simple/neuronal |
| STT    | Whisper small/base | CPU/GPU 4–6 GB  | Transcripción de clips cortos  |

Perfiles ejemplo:

- **RTX 3050** → `llama2` o `mistral`, bridge SDXL Lightning (4 pasos), TTS Kokoro + STT Whisper.
- **Solo CPU** → `orca-mini`, imagen deshabilitada, TTS pyttsx3.
- **Texto únicamente** → define solo `VITE_OLLAMA_BASE_URL` y `VITE_TEXT_MODEL_ID`.

**Nota sobre el Analizador de Imágenes (Llava)**:

El modo **Inteligente** incluye análisis automático de imágenes usando el modelo **Llava:latest** (más rápido y estable que Qwen3-VL). Cuando subes una imagen:

1. El backend genera un prompt genérico para la imagen
2. Si proporcionas tu propio prompt, se usa directamente
3. Soporta múltiples idiomas (ES, EN, FR, DE, IT)
4. Respuesta inmediata sin timeouts

Para usar esta funcionalidad:

````bash
ollama pull Llava:latest   # Descarga el modelo de visión
# El backend debe estar corriendo en http://localhost:8000
python python-backend/main.py
```text

**Características técnicas**:

- Caché inteligente con deduplicación MD5
- Fallback automático a prompts genéricos si hay problemas
- SQLite para persistencia de análisis previos (30 días TTL)

---

## Flujo de desarrollo

1. **Instala dependencias**
   `npm install`

2. **Backend FastAPI (python-backend/)**

   ```bash
   cd python-backend
   C:\Users\Usuario\AppData\Local\Programs\Python\Python311\python.exe -m venv venv
   .\\venv\\Scripts\\Activate.ps1
   pip install -r requirements.txt
   # Descarga kokoro.onnx + voices.json en python-backend/models/
   # (usa `huggingface-cli login` si tu cuenta es privada)
   huggingface-cli download hexgrad/Kokoro-82M kokoro.onnx --local-dir models --local-dir-use-symlinks False
   huggingface-cli download hexgrad/Kokoro-82M voices.json --local-dir models --local-dir-use-symlinks False
   python main.py
````

El backend expone `/api/tts`, `/api/stt`, `/api/image`, `/api/voices` y `/api/images/analyze` (Qwen3-VL para análisis visual).

3. **Arranca Ollama**  
   `ollama pull llama2` → `ollama serve`

4. **(Opcional) Otros endpoints**

   - Imagen: por defecto el front envía un POST a `http://localhost:8000/api/image` (servido por `python-backend/main.py`). Arranca ese backend o apunta `VITE_IMAGE_MODEL_ENDPOINT` hacia tu servicio favorito. Si prefieres Automatic1111, ejecuta `node achive/tools/image-bridge.js` (legacy).
   - TTS/STT legacy: `npm run tts:server` sólo para pruebas rápidas.

5. **Dev server**  
   `npm run dev` → <http://localhost:4173>

6. **Tests & build antes de publicar**  
   `npm test` → `npm run build`

---

## Selector de modelo, voces y salud

- El selector de modelos consulta `GET ${VITE_OLLAMA_BASE_URL}/api/tags` y persiste la elección en `localStorage`.
- El modo **Voz** llama a `GET ${VITE_TTS_ENDPOINT}/voices` (FastAPI expone `/api/voices`) para poblar idiomas/presets. Si la llamada falla, se muestran presets locales como fallback.
- `npm run check:health` confirma rápidamente que Ollama y los endpoints configurados responden antes de abrir la SPA.
- El modo **Imagen** permite elegir dimensiones (512–1216), pasos y negative prompt; todo se procesa desde `/api/image` (SDXL Lightning, 4–8 pasos recomendados).
- El modo **Inteligente** genera contenido estratégico con contexto (ideas + contexto + idioma + pensamiento profundo). Opcionalmente puede generar una imagen complementaria: introduce un prompt para describir la imagen deseada. **NUEVO**: Si subes una imagen para análisis, el backend usa Llava:latest para analizar automáticamente todos los elementos visuales (objetos, colores, estilos, composición, iluminación, atmósfera) y genera un prompt detallado que captura los detalles específicos de la imagen. Soporta múltiples idiomas con prompts específicos por idioma. **NUEVO (Dic 10)**: El backend ahora selecciona dinámicamente los mejores modelos disponibles: Qwen2.5:14b (primario) > 7b-instruct (secundario) > 7b (terciario) > Mistral > Llama, consultando `GET /api/tags` de Ollama en tiempo de ejecución.

---

## QA manual (resumen)

Consulta `docs/QA_CHECKLIST.md`. Cada cambio debe validar:

- Los 8 modos (Basic, Intelligent, Campaign, Recycle, Chat, Voice, Live Chat, Image).
- Persistencia de tema (Light/Dark/System) y lenguaje (ES/EN) tras recargar.
- Manejo de errores (sin API key, timeouts, micrófono denegado, endpoints caídos).
- Consola limpia y `npm run build` sin fallos.

---

## Despliegue en contenedores

- Contamos con **Dockerfile.frontend** y **Dockerfile.backend** multi-stage. El frontend se sirve con Nginx y el backend corre con Uvicorn.
- `docker-compose.yml` orquesta frontend, backend y una base PostgreSQL opcional. Los volúmenes `backend-models` y `backend-cache` preservan descargas de modelos/cachés.
- Copia `docker/.env.docker.example` a `docker/.env.docker`, ajusta variables y ejecuta:

```bash
docker compose up --build
```

- El pipeline de GitHub Actions (`.github/workflows/ci.yml`) repite `npm run lint:check`, `npm run build`, arranca el backend y ejecuta `node scripts/check-endpoints.js` como smoke test.
- Para más detalles (hardware recomendado, comandos de verificación y pasos manuales), revisa `docs/DEPLOYMENT.md`.

---

## Notas finales

- El alias `@/` apunta a `src/` (ver `tsconfig.json`).
- Los componentes consumen estado global mediante `useTheme`, `useLanguage`, `useInteraction`.
- `achive/` guarda referencias históricas (App back, planes de refactor, herramientas de migración). No borres nada sin revisar.

Si necesitas más contexto (roadmap, instrucciones de agentes, setups), revisa la carpeta `docs/`. ¡Feliz hacking! 🎯
