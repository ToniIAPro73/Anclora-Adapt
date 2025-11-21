# CONTEXTO DE CAMBIOS Y ESTADO

## Qué se intentó resolver

- Error inicial en consola: `410 Gone` al llamar a `/api/hf-text` (proxy hacia Hugging Face). El front mostraba mensaje de HF indicando que `api-inference.huggingface.co` ya no se soporta.
- Objetivo: mover las llamadas al router de Hugging Face y eliminar errores 404/410 y CORS.

## Cambios realizados en el código

- `index.tsx`
  - Base por defecto ahora: `https://router.huggingface.co/hf-inference` (se trimea y se remueve trailing slash). Si se define `VITE_HF_BASE_URL`, se usa ese valor.
  - Se detecta si la base contiene `router.huggingface.co` para construir endpoints directos como `<base>/models/<modelo>` (texto, imagen, TTS, STT).
  - `VITE_USE_PROXY` controla si se usa `/api/hf-*` (dev/proxy) o se llama directo.
  - Se eliminó el fallback al endpoint legacy `api-inference` porque devolvía 410 y CORS.
  - Se añadieron `buildCandidateUrls` y `fetchWithFallback` para intentar la ruta del proxy y luego la ruta directa según la base actual.
- `vite.config.ts`
  - Base por defecto: igual al router. Se trimea y normaliza.
  - El proxy apunta al base (router) y deja que el cliente construya `/models/<modelo>`. Si se usa otra base no-router, se mantiene `/models/<modelo>`.
- `index.html`
  - Se añadió favicon inline SVG para evitar 404 de `/favicon.ico`.

## Configuración `.env.local` observada

- `HF_API_KEY`: presente (no se incluye aquí por seguridad).
- `VITE_HF_BASE_URL`: se vio con typo en algún momento (`hf-inteference`), luego corregido a `https://router.huggingface.co/hf-inference`.

## Estado actual del problema

- Aún aparecen 404 desde el router (según la última captura y consola) incluso con base correcta `https://router.huggingface.co/hf-inference` y proxy activo.
- El endpoint legacy `api-inference` ya no se usa para evitar 410/CORS.

## Próximos pasos sugeridos

1. Confirmar en Network/Console la respuesta del router (body del 404) para validar si la ruta esperada es diferente (p. ej. `https://router.huggingface.co/models/<modelo>` sin `/hf-inference`).
2. Probar temporalmente forzar base a `https://router.huggingface.co` (sin sufijo) en `.env.local` y reiniciar `npm run dev` para ver si desaparecen los 404.
3. Mantener `VITE_USE_PROXY=true` en dev para evitar CORS y que todo pase por `/api/hf-*`.
4. Si el router sigue en 404, consultar documentación actualizada de Hugging Face Router para la ruta exacta de inferencia (puede requerir otro path o headers adicionales).

## Nota de seguridad

- No subir `.env.local` ni claves (`HF_API_KEY`). Limitar su copia a entornos locales.
