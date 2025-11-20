# Repository Guidelines

## Project Structure & Module Organization
Anclora-Adapt es un SPA en React sin carpeta `src`: todo el arbol de modos, helpers y estado global vive en `index.tsx`. `index.html` define los tokens de color/tema y monta el `#root`, mientras que `vite.config.ts`, `tsconfig.json` y `package.json` gobiernan compilacion y tipos. Usa `.env.local` para credenciales (`HF_API_KEY`) y mantiene `dist/` y `node_modules/` fuera del control de versiones; cualquier helper nuevo deberia vivir junto al componente que lo consume o evolucionar hacia un futuro `src/` manteniendo la misma estructura modular.

## Build, Test, and Development Commands
Despues de instalar dependencias con `npm install`, ejecuta `npm run dev` para iterar en caliente y `npm run preview` para revisar exactamente lo que Vite servira en produccion. Antes de abrir un PR o hacer push, ejecuta `npm run build`; es la unica verificacion automatizada disponible y detecta rapidamente problemas de tipos, rutas o dependencias faltantes. Cambia manualmente los toggles de idioma (ES/EN) y tema (claro, oscuro, sistema) en cada sesion de QA para asegurar que persisten en `localStorage`.

## Coding Style & Naming Conventions
Trabaja con componentes funcionales, manteniendo `useState`/`useEffect` agrupados al inicio y extrayendo cualquier llamada a Hugging Face en helpers (`callTextModel`, `callImageModel`, `callTextToSpeech`, `callSpeechToText`). La UI se alimenta del objeto `translations`, por lo que toda copia nueva debe agregarse alli en ES y EN. Usa `CamelCase` para componentes, `camelCase` para funciones/estados, `SCREAMING_SNAKE_CASE` para constantes globales, y mantente fiel al formato JSON requerido (`outputs: [{ platform, content }]`) en cada prompt.

## Testing Guidelines
No existe una suite automatizada, asi que cada cambio requiere verificacion manual de los ocho modos (Basico, Inteligente, Campaña, Reciclar, Chat, Voz, Live chat e Imagen) en navegadores Chromium. Inspecciona los mensajes de error locales (sin API key, timeouts, microfono denegado) y valida que el tema oscuro y el idioma vuelvan a su estado inicial tras limpiar cache. Si introduces logica compleja, agrega pruebas con Vitest o React Testing Library en carpetas `__tests__/` junto al componente afectado y deja instrucciones claras para ejecutarlas.

## Commit & Pull Request Guidelines
Sigue Conventional Commits (`feat:`, `fix:`, `docs:`) y agrupa cambios por modo o helper. Cada PR debe incluir resumen, lista de archivos clave, evidencias (capturas o GIFs si cambia la UI), asi como los comandos de verificacion ejecutados (`npm run build`, navegadores probados). Antes de sincronizar, consulta `git status`, haz `git pull --rebase origin main` y, si necesitas forzar, usa `git push --force-with-lease` para evitar sobrescribir trabajo ajeno.

## AI Model & Configuration Notes
El repositorio ya esta migrado a modelos open source en Hugging Face: `meta-llama/Meta-Llama-3-8B-Instruct` para texto, `black-forest-labs/FLUX.1-schnell` para imagen, `suno/bark-small` para TTS y `openai/whisper-large-v3-turbo` para STT. Mantener esa lista sincronizada en `index.tsx` evita regresar a dependencias prohibidas como Gemini. Nunca comprometas `.env.local`, documenta cualquier variable nueva y reaprovecha los toggles de Contexto/Destino en Inteligente, Campaña y Reciclar para construir prompts mas precisos.
