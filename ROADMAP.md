# Hoja de ruta: migración a stack 100% local/gratuito

Este documento desglosa las tareas necesarias para que la app funcione con modelos locales/gratuitos (texto, imagen, TTS, STT) en un portátil con Intel Core Ultra 7, 32GB RAM y GPU RTX 3050 4GB. Las tareas están ordenadas para minimizar bloqueos y facilitar QA incremental.

## 1) Preparación de entorno y configuraciones
- Documentar `.env.local` mínimo para dev offline (`VITE_OLLAMA_BASE_URL`, `VITE_TEXT_MODEL_ID`).
- Añadir sección de hardware/perfiles sugeridos (CPU vs GPU) y lista de modelos ligeros a descargar (`llama2`, `mistral`, `neural-chat`, `orca-mini`).
- Crear scripts npm o docs para arrancar `ollama serve` y comprobación de salud del endpoint (`/api/generate`).

## 2) Refactor estructural (desbloquea nuevas pipelines)
- Crear estructura `src/` con carpetas `api/`, `components/`, `hooks/`, `types/`, `utils/` y migrar gradualmente desde `index.tsx`.
- Extraer helpers de red a `src/api/` (`callTextModel`, `callImageModel`, `callTextToSpeech`, `callSpeechToText`) con typing compartido.
- Mantener puntos de entrada y traducciones sincronizados; añadir alias en `tsconfig` si es necesario.

## 3) Texto: consolidar integración Ollama
- Unificar uso de `VITE_OLLAMA_BASE_URL` y `VITE_TEXT_MODEL_ID` en `callTextModel` (ya existente) con manejo de timeouts/errores consistente.
- Añadir selector de modelo en UI (opcional) leyendo modelos descargados vía `/api/tags` de Ollama.
- Mejorar prompts para los 8 modos con validaciones de entrada y feedback de estado.

## 4) Imagen: backend local + UI
- Seleccionar backend local compatible con 4GB VRAM (p. ej., Stable Diffusion 1.5 cuantizada vía `ollama pull llava` si se usa vision, o servidor `sd-webui`/`comfyui` ligero).
- Implementar un micro-servicio/bridge HTTP en `scripts/` o `src/api/` que reciba prompt/base64 y devuelva imagen base64; documentar cómo lanzarlo.
- Reemplazar el placeholder de `callImageModel` para que apunte al backend local configurable (env `VITE_IMAGE_MODEL_ENDPOINT`/`VITE_IMAGE_MODEL_ID`).
- Ajustar el modo Imagen e Inteligente/Campaña para mostrar progreso y manejar errores (sin dependencia de HF API key).

## 5) Audio: TTS y STT locales
- Evaluar modelos ligeros: Whisper small/base para STT; Bark/MeloTTS/XTTS v2 para TTS en CPU/GPU.
- Añadir endpoints locales configurables (`VITE_TTS_ENDPOINT`, `VITE_TTS_MODEL_ID`, `VITE_STT_ENDPOINT`, `VITE_STT_MODEL_ID`) y actualizar `callTextToSpeech`/`callSpeechToText`.
- Manejar captura de micrófono y reproducción de audio con feedback de permisos/errores.
- Integrar en modos Voz y Live Chat: subida de audio, transcripción, respuesta TTS en streaming o descarga.

## 6) QA y DX
- Añadir scripts de verificación: `npm run build` obligatorio y chequeo rápido de salud de endpoints (ping text/image/audio).
- Crear checklist de QA manual para los 8 modos (tema/idioma persistencia, errores sin credenciales, timeouts, permisos).
- (Opcional) Introducir pruebas unitarias para helpers de red con `Vitest` y mocks de fetch.

## 7) Documentación y entrega
- Actualizar README con flujo local completo (instalación de Ollama, descarga de modelos, arranque de backends de imagen/audio).
- Incluir tabla de modelos recomendados con requisitos de RAM/VRAM y comandos de descarga.
- Registrar limitaciones conocidas (VRAM 4GB → limitar resolución/pasos en SD; latencia CPU en Whisper/Bark) y posibles optimizaciones.
