# Checklist de QA manual

## Pre-flight
- npm run build
- npm run check:health (comprueba `/api/tags` de Ollama y los endpoints locales de imagen/TTS/STT si existen)
- Confirmar que el tema y el idioma persisten tras recargar (localStorage)
- Revisar consola del navegador sin errores de TypeScript

## Modos de texto
- Básico: validar errores sin idea ni plataformas, comprobar contador de caracteres y copia al portapapeles.
- Inteligente: probar con y sin imagen, verificar que se limpia la vista previa y que los estados de carga muestran progreso.
- Campaña: validar errores sin idea, comprobar salidas múltiples en formato JSON.
- Reciclar: probar cada formato objetivo y que el idioma/tono se respetan.
- Chat: enviar varios turnos, copiar respuestas y comprobar que no hay cortes en mensajes largos.

## Audio
- Voz (TTS): traducir antes de sintetizar, cambiar idioma/voz y verificar descarga de audio.
- Live Chat: conceder permisos de micro, grabar y validar transcripción + respuesta TTS; manejar error cuando el micro está bloqueado.

## Imagen
- Imagen: probar generación con prompt y con imagen subida, comprobar que se resetea la previsualización, que los errores se muestran y que se puede descargar la imagen.
- Modos Inteligente/Campaña: probar generación combinada texto + imagen desde el bridge local.

## Estados y errores
- Simular timeouts o endpoints caídos (imagen/audio) para verificar mensajes localizados.
- Revisar que el selector de modelo carga la lista de `/api/tags`, permite refrescar y persiste la selección.
