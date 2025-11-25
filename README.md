# Run and deploy your AI Studio app

![GHBanner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

Este repositorio ahora está preparado para ejecutarse 100% con modelos locales/gratuitos usando Ollama para texto y endpoints locales configurables para imagen/TTS/STT.

## Requisitos previos

- Node.js 18+
- [Ollama](https://ollama.ai/) en tu máquina (`ollama serve`)
- (Opcional) Backend de imagen compatible con Stable Diffusion 1.5/SDXL (p. ej., `automatic1111` en `http://localhost:7860`)
- (Opcional) Backend locales para TTS/STT (p. ej., servidores ligeros de Bark/Whisper)

## Configuración rápida (`.env.local`)

Crea un fichero `.env.local` en la raíz con, como mínimo:

```
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_TEXT_MODEL_ID=llama2

# Imagen local (por defecto el bridge escucha en http://localhost:9090/image)
VITE_IMAGE_MODEL_ENDPOINT=http://localhost:9090/image
VITE_IMAGE_MODEL_ID=stable-diffusion

# Audio local (configura tus endpoints TTS/STT si los tienes)
VITE_TTS_ENDPOINT=
VITE_TTS_MODEL_ID=
VITE_STT_ENDPOINT=
VITE_STT_MODEL_ID=

# (Opcional) Token para backends que lo requieran
VITE_MODEL_API_KEY=
```

### Perfiles de hardware recomendados (Intel Core Ultra 7 + 32GB RAM + RTX 3050 4GB)

- **Texto (Ollama):** `llama2` (4GB, equilibrado), `mistral` (~5GB, más calidad), `neural-chat` (4GB, chat), `orca-mini` (2GB, más rápido).
- **Imagen:** Stable Diffusion 1.5 cuantizado o SDXL con resolución/steps reducidos. Usa el bridge incluido o apunta a tu propio servidor SD.
- **Audio:** Whisper small/base para STT; Bark/MeloTTS/XTTS v2 para TTS (CPU/GPU según consumo).

## Cómo ejecutar

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Arranca Ollama y descarga un modelo ligero, por ejemplo:

   ```bash
   ollama pull llama2
   ollama serve
   ```

3. (Opcional) Lanza el bridge de imagen si usas Stable Diffusion local (necesita que `SD_API_URL` apunte a tu servidor SD, por defecto `http://localhost:7860/sdapi/v1/txt2img`):

   ```bash
   npm run image:bridge
   ```

4. Verifica la salud de los endpoints configurados:

   ```bash
   npm run check:health
   ```

5. Ejecuta la app en dev:

   ```bash
   npm run dev
   ```

   La app quedará disponible en <http://localhost:4173>.

## Selector de modelo y salud de endpoints

- Usa el selector de modelo en la cabecera para elegir cualquiera de los modelos devueltos por `GET /api/tags` de Ollama; la selección persiste en `localStorage`.
- El botón de **Actualizar modelos** vuelve a consultar `/api/tags` por si descargaste nuevos modelos sin recargar la app.
- `npm run check:health` comprueba `/api/tags` y, si están definidos, los endpoints locales de imagen (`VITE_IMAGE_MODEL_ENDPOINT`), TTS y STT.

## Modelos recomendados

| Tipo   | Modelo             | RAM/VRAM aprox.    | Uso sugerido                 | Comando                                                 |
| ------ | ------------------ | ------------------ | ---------------------------- | ------------------------------------------------------- |
| Texto  | llama2             | 4 GB               | Equilibrado generalista      | `ollama pull llama2`                                    |
| Texto  | mistral            | ~5 GB              | Mayor calidad/contexto       | `ollama pull mistral`                                   |
| Texto  | neural-chat        | 4 GB               | Conversación optimizada      | `ollama pull neural-chat`                               |
| Texto  | orca-mini          | 2 GB               | Rápido/ligero en portátiles  | `ollama pull orca-mini`                                 |
| Imagen | SD 1.5 cuantizada  | 4 GB VRAM          | Generación base 768x768      | `npm run image:bridge` (requiere SD corriendo)          |
| Audio  | Whisper small/base | CPU/GPU 4–6 GB RAM | STT local, latencia moderada | Configura `VITE_STT_ENDPOINT` hacia tu servidor Whisper |
| Audio  | Bark/MeloTTS       | GPU recomendada    | TTS multilingüe              | Configura `VITE_TTS_ENDPOINT` hacia tu servidor TTS     |

## Limitaciones y optimización local

- Con 4 GB de VRAM limita resolución/pasos en Stable Diffusion (ej.: 768x768 y ≤20 pasos) y evita ejecutar otros procesos pesados.
- Whisper/Bark en CPU pueden tardar varios segundos por minuto de audio; usa clips cortos o activa aceleración GPU si está disponible.
- Si un endpoint local no está activo, la UI mostrará errores localizados y `npm run check:health` marcará el fallo.

## Perfiles `.env.local` ejemplo

### RTX 3050 (GPU)

```
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_TEXT_MODEL_ID=mistral
VITE_IMAGE_MODEL_ENDPOINT=http://localhost:9090/image
VITE_IMAGE_MODEL_ID=stable-diffusion
VITE_TTS_ENDPOINT=http://localhost:9000/tts
VITE_TTS_MODEL_ID=xtts
VITE_STT_ENDPOINT=http://localhost:9001/stt
VITE_STT_MODEL_ID=whisper-small
```

### Solo CPU

```
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_TEXT_MODEL_ID=orca-mini
VITE_IMAGE_MODEL_ENDPOINT=   # deja vacío si no hay backend de imagen
VITE_TTS_ENDPOINT=
VITE_STT_ENDPOINT=
```

## QA manual

Sigue la [checklist de QA](./QA_CHECKLIST.md) antes de publicar cambios (modos de texto, imagen, audio, persistencia de tema/idioma y manejo de errores).

## Notas adicionales

- `npm run build` sigue siendo la verificación obligatoria antes de publicar cambios.
- El alias `@/` ahora apunta a `src/` para importar helpers, hooks y tipos.
- Los modos de Voz/Live Chat dependen de que configures endpoints TTS/STT locales; si no están definidos, la UI mostrará el error correspondiente.
