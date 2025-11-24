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

## Notas adicionales
- `npm run build` sigue siendo la verificación obligatoria antes de publicar cambios.
- El alias `@/` ahora apunta a `src/` para importar helpers, hooks y tipos.
- Los modos de Voz/Live Chat dependen de que configures endpoints TTS/STT locales; si no están definidos, la UI mostrará el error correspondiente.
