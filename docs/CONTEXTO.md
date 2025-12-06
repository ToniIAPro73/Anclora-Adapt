# CONTEXTO DE CAMBIOS Y ESTADO

Documento vivo con el histórico de decisiones y el estado actual del proyecto.  
Última revisión: **diciembre 2025**.

---

## Resumen actual

- **Backend textual** se ejecuta 100 % en **Ollama local** (Llama2/Mistral/Qwen). Sin dependencias externas, sin rate limits.
- **SPA modular** (React + Vite) organizada en modos (`BasicMode`, `CampaignMode`, etc.) y contextos globales (`InteractionContext`, `ThemeContext`, `LanguageContext`).
- **Compatibilidad lingüística** dinámica: la app detecta qué modelos tienes instalados y habilita sólo los idiomas que soportan. Cuando eliges “Auto”, el selector muestra los idiomas disponibles y deshabilita el resto (con un tooltip).
- **Mejoras recientes de UX**:
  - Layout sin scroll vertical extra; los botones y campos se muestran completos en 1080p.
  - Botón “Copiar” y el toggle de idioma tienen contraste correcto en claro/oscuro.
  - El modo Básico ofrece “Generar traducción” cuando fuerzas traducción literal y produce JSON limpio (un único `content`).
  - `lastModelUsed` se muestra bajo “Modelo de texto” para saber qué modelo respondió realmente.
- **Backend FastAPI** (`python-backend`) expone `/api/tts`, `/api/stt`, `/api/image` y `/api/voices`. Se integra con Kokoro (ONNX), Whisper y Stable Diffusion (pendiente de pulir modelos/descargas).

---

## Camino hasta aquí

### 1. Migración a Ollama (noviembre 2025)
El endpoint `/api/hf-text` devolvía 404 porque Hugging Face retiró `api-inference`. Tras varios intentos (router nuevo, TogetherAI) se migró a **Ollama**:

```bash
ollama pull llama2
ollama serve   # o el script manage-ollama.ps1
npm run dev
```

El front usa ahora `POST /api/generate` y `.env.local` solo necesita:

```ini
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_TEXT_MODEL_ID=llama2   # se puede cambiar a mistral, qwen, etc.
```

### 2. Refactor de la SPA
- Creación de `src/` con componentes separados por modo.
- Contextos globales para estado (modo activo, outputs, idioma, tema).
- Prompts/traducciones centralizados en `src/constants`.

### 3. Heurística de idioma/modelo
- `src/constants/modelCapabilities.ts`: define qué familias soportan CJK, cirílico, etc.
- `resolveTextModelId` intenta Qwen/Yi cuando se solicita japonés/chino/ruso.
- El selector de idioma se alimenta con `buildLanguageOptions`: deshabilita idiomas no soportados y muestra tooltips explicativos.
- Se registra `lastModelUsed` para enseñar al usuario qué modelo se usó realmente incluso en modo “Auto”.

### 4. Ajustes de interfaz
- Botón “Copiar” y toggle de idioma con estilos uniformes.
- “Generar traducción” cuando activas el checkbox de traducción literal.
- Script `scripts/manage-ollama.ps1` para listar modelos, precargar el seleccionado y reiniciar el daemon sin procesos huérfanos.

---

## Estado por áreas

| Área | Estado | Comentario |
|------|--------|------------|
| ✍️ Generación de texto | ✅ Estable | Modelos recomendados: `llama2`, `mistral`, `qwen2.5:7b` (CJK). |
| 🌐 Traducción literal | ✅ | JSON limpio; se selecciona modelo multilingüe automáticamente. |
| 🌍 Selector de idiomas | ✅ Adaptativo | Idiomas no soportados aparecen deshabilitados con tooltip. |
| 📊 Modelo usado | ✅ | Visible bajo “Modelo de texto”. |
| 🎨 Imagen / 🔊 Voz / 🗣️ STT | ⚠️ Pendiente | FastAPI expone endpoints, pero falta afinar modelos (Kokoro/Whisper/SD). |
| 🧩 Refactor front | 🟡 En progreso | Algunos modos legacy requieren limpieza y tests. |
| ✅ Tests automatizados | ❌ | Vitest configurado, pero sin suites aún. |
| 🗄️ Persistencia | ❌ | No hay DB; todo se mantiene en localStorage. |
| 🔁 CI/CD | ❌ | Builds y merges manuales (sin GitHub Actions todavía). |

---

## Modelos e idiomas soportados

| Familia / Modelo | Idiomas |
|------------------|---------|
| `llama2`, `llama3`, `mistral`, `gemma` | ES, EN, FR, DE, PT, IT, RU |
| `qwen2.5`, `yi`, `deepseek` | Todo lo anterior + JA, ZH |
| `phi`, `orca`, `neural-chat` | ES, EN, FR, DE, PT, IT |

> Tras pulsar “Actualizar modelos”, la app recalcula la cobertura. Si faltan idiomas (por ejemplo japonés), instala un modelo compatible (`ollama pull qwen2.5:7b`). El selector mostrará esos idiomas en cuanto el modelo esté disponible.

---

## Próximos pasos sugeridos

1. **Backend creativo**: completar la integración de Kokoro (descarga `kokoro.onnx` + `voices.json` en `python-backend/models/`) y ajustar Stable Diffusion en `/api/image`.
2. **Tests de regresión**: cobertura mínima para los modos críticos (`BasicMode`, `CampaignMode`, `ChatMode`).
3. **Persistencia y sesiones**: guardar prompts/outputs en una base ligera (SQLite/Postgres) y permitir historial.
4. **Observabilidad**: métricas básicas (conteo de generaciones por modo/modelo) y logs estructurados.
5. **CI/CD**: pipeline de GitHub Actions con lint + tests antes de mergear en `development`.
6. **Optimización de assets**: revisar bundle y lazy loading más granular (solo si no afecta UX).

---

## Notas operativas

- `.env.local` en la raíz; no expone credenciales sensibles salvo que conectes backends externos.
- Para comprobar servicios locales, usa `npm run check:health`.
- Cambios en estilos van a `src/styles/commonStyles.ts` para mantener consistencia claro/oscuro.
- Antes de añadir un idioma nuevo, extiende `capabilityMatrix` con el modelo que lo soporta; de lo contrario aparecerá deshabilitado.
- Script útil: `.\scripts\manage-ollama.ps1` (PowerShell) lista modelos, precarga el seleccionado y reinicia `ollama serve`.

---

## TL;DR

- El front ya no depende de servicios externos: todo corre en Ollama + FastAPI locales.
- La UI se adapta al modelo instalado (idiomas, modelo usado, traducciones literales fiables).
- Falta completar el backend multimedia, añadir tests y automatizar la entrega, pero la base es estable para trabajo diario.  
- Siguiente hito: cerrar la integración de Kokoro/Whisper/SDXL y añadir pruebas automatizadas.
