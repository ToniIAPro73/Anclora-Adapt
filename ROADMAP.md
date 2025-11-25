# Hoja de ruta: migración a stack 100% local/gratuito

Este documento desglosa las tareas necesarias para que la app funcione con modelos locales/gratuitos (texto, imagen, TTS, STT) en un portátil con Intel Core Ultra 7, 32GB RAM y GPU RTX 3050 4GB. Las tareas están ordenadas para minimizar bloqueos y facilitar QA incremental.

## 1) Preparación de entorno y configuraciones
- [x] Documentar `.env.local` mínimo para dev offline (`VITE_OLLAMA_BASE_URL`, `VITE_TEXT_MODEL_ID`).
- [x] Añadir sección de hardware/perfiles sugeridos (CPU vs GPU) y lista de modelos ligeros a descargar (`llama2`, `mistral`, `neural-chat`, `orca-mini`).
- [x] Crear scripts npm o docs para arrancar `ollama serve` y comprobación de salud del endpoint (`/api/generate`).

## 2) Refactor estructural (desbloquea nuevas pipelines)
- [x] Crear estructura `src/` con carpetas `api/`, `components/`, `hooks/`, `types/`, `utils/` y migrar gradualmente desde `index.tsx`.
- [x] Extraer helpers de red a `src/api/` (`callTextModel`, `callImageModel`, `callTextToSpeech`, `callSpeechToText`) con typing compartido.
- [x] Mantener puntos de entrada y traducciones sincronizados; añadir alias en `tsconfig`.

## 3) Texto: consolidar integración Ollama
- [x] Unificar uso de `VITE_OLLAMA_BASE_URL` y `VITE_TEXT_MODEL_ID` en `callTextModel` con manejo de errores y timeout.
- [ ] Añadir selector de modelo en UI (opcional) leyendo modelos descargados vía `/api/tags` de Ollama.
- [ ] Mejorar prompts para los 8 modos con validaciones de entrada y feedback de estado.

## 4) Imagen: backend local + UI
- [x] Seleccionar backend local compatible con 4GB VRAM (ejemplo SD 1.5 vía webui o comfyui) y exponerlo mediante bridge HTTP.
- [x] Implementar un micro-servicio/bridge HTTP en `scripts/image-bridge.js` que reciba prompt y devuelva PNG desde SD.
- [x] Reemplazar el placeholder de `callImageModel` para que apunte al backend local configurable (`VITE_IMAGE_MODEL_ENDPOINT`/`VITE_IMAGE_MODEL_ID`).
- [ ] Ajustar el modo Imagen e Inteligente/Campaña para mostrar progreso y manejar errores (sin dependencia de HF API key).

## 5) Audio: TTS y STT locales
- [x] Definir variables de entorno para TTS/STT locales y adaptar los helpers para consumir endpoints configurables.
- [ ] Evaluar e integrar modelos ligeros (Whisper/Bark) en un backend local equivalente al bridge de imagen.
- [ ] Manejar captura de micrófono y reproducción de audio con feedback de permisos/errores.
- [ ] Integrar en modos Voz y Live Chat: subida de audio, transcripción, respuesta TTS en streaming o descarga.

## 6) QA y DX
- [x] Añadir scripts de verificación: `npm run build` obligatorio y chequeo rápido de salud de endpoints (`npm run check:health`).
- [ ] Crear checklist de QA manual para los 8 modos (tema/idioma persistencia, errores sin credenciales, timeouts, permisos).
- [ ] (Opcional) Introducir pruebas unitarias para helpers de red con `Vitest` y mocks de fetch.

## 7) Documentación y entrega
- [x] Actualizar README con flujo local completo (instalación de Ollama, modelos y bridge de imagen/audio configurables).
- [ ] Incluir tabla detallada de modelos recomendados con requisitos de RAM/VRAM y comandos de descarga.
- [ ] Registrar limitaciones conocidas (VRAM 4GB → limitar resolución/pasos en SD; latencia CPU en Whisper/Bark) y posibles optimizaciones.

## Tareas pendientes tras las últimas PR
Estas tareas consolidan lo que falta por implementar tras los dos últimos PR y priorizan el trabajo para alcanzar el objetivo de funcionamiento 100% local.

1. **Selector de modelo y mejoras de prompts (Texto)**
   - [ ] Añadir endpoint `/api/tags` de Ollama al health check para listar modelos disponibles y almacenarlos en estado global.
   - [ ] Incorporar selector de modelo en la UI (modo Básico/Inteligente/Campaña) con persistencia en `localStorage`.
   - [ ] Revisar y endurecer los prompts de los 8 modos: validar entrada (longitud, formato), mostrar estados de carga/errores y normalizar el formato `outputs`.

2. **Experiencia de imagen (SD local)**
   - [ ] Conectar el modo Imagen y los modos que usan imágenes (Inteligente/Campaña) al bridge `VITE_IMAGE_MODEL_ENDPOINT`, mostrando progreso y tiempos estimados.
   - [ ] Añadir manejo de errores detallado (timeout, VRAM insuficiente, endpoint caído) con mensajes localizados ES/EN.
   - [ ] Permitir configuración de parámetros básicos (steps, resolución, sampler) con valores seguros para 4GB VRAM.

3. **Audio local (TTS/STT) y permisos**
   - [ ] Implementar clientes para TTS/STT apuntando a endpoints configurables (`VITE_TTS_ENDPOINT`, `VITE_STT_ENDPOINT`) con timeouts y reintentos.
   - [ ] Gestionar captura de micrófono y reproducción de audio con feedback de permisos denegados y fallos de conversión.
   - [ ] Integrar STT + TTS en modos Voz y Live Chat: subir audio, transcribir, generar respuesta en audio y mostrar fallback de texto.

4. **QA y DX**
   - [ ] Completar checklist de QA manual para los 8 modos (tema/idioma persistencia, errores por credenciales faltantes, timeouts, permisos) y añadirlo al repositorio.
   - [ ] Documentar en los scripts de salud (`npm run check:health`) la verificación de endpoints de imagen y audio.
   - [ ] (Opcional) Crear baterías mínimas de Vitest para los helpers de red con `fetch` mockeado.

5. **Documentación ampliada**
   - [ ] Añadir tabla de modelos recomendados con requisitos de RAM/VRAM, consumo estimado y comandos `ollama pull`/descarga SD.
   - [ ] Documentar limitaciones conocidas (resolución/steps para 4GB VRAM, latencia en CPU para Whisper/Bark) y trucos de optimización.
   - [ ] Incluir ejemplos de configuración completa (`.env.local`) para perfiles CPU-only y GPU RTX 3050.
