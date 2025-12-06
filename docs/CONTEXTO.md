# CONTEXTO DE CAMBIOS Y ESTADO

Documento vivo con el histórico de decisiones y el estado actual del proyecto.  
Última revisión: **diciembre 2025**.

---

## Resumen actual

- **Backend textual** se ejecuta al 100 % en **Ollama local** (Llama2/Mistral/Qwen). Sin dependencias externas ni rate limits.
- **SPA modular** (React + Vite) organizada en modos (`BasicMode`, `CampaignMode`, etc.) y contextos globales (`InteractionContext`, `ThemeContext`, `LanguageContext`).
- **Compatibilidad lingüística adaptativa**: la aplicación detecta los modelos instalados, deshabilita los idiomas que no cubren y recalcula todo cuando se pulsa "Actualizar modelos".
- **Auto + fallback inteligente**: `resolveTextModelId` puntúa los modelos disponibles (prioriza Qwen/Mistral para CJK/RU) y `handleGenerate` reintenta automáticamente con el siguiente candidato cuando el modelo seleccionado devuelve JSON inválido, incluso si lo eligió manualmente el usuario.
- **Mejoras recientes de UX**:
  - Layout del modo Básico a altura completa, sin scroll extra y con el botón **Generar contenido / Generar traducción** siempre visible.
  - Botones de modo centrados, toggle de idioma con texto visible en claro/oscuro y botón "Copiar" contrastado.
  - La casilla "Forzar traducción literal" cambia el texto del CTA a **Generar traducción** y vuelve a **Generar contenido** al desmarcarla.
  - `lastModelUsed` muestra el modelo real utilizado justo después de cada generación.

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
- `src/constants/modelCapabilities.ts` amplió la matriz de capacidades (llama3.2, Mixtral, Command, etc.) para reflejar los idiomas que soporta cada familia.
- `resolveTextModelId` puntúa cada modelo según idioma objetivo, velocidad o profundidad y prioriza Qwen/Yi para japonés/chino/ruso.
- El modo **Auto** ya no se queda en un único modelo: `handleGenerate` crea una lista ordenada y reintenta con el siguiente candidato cuando el primero devuelve un JSON inválido.
- Aunque el usuario seleccione un modelo manualmente, se registra `lastModelUsed` y, si el modelo falla, se muestra un mensaje que sugiere alternativas multilingües (mistral/qwen).

### 4. Ajustes de interfaz
- Botones de modo centrados entre las líneas divisorias y CTA principal siempre visible (sin necesidad de hacer scroll).
- Toggle de idioma, botón de reinicio y chips de plataformas con mejor contraste en claro/oscuro.
- CTA dinámico **Generar contenido / Generar traducción** según la casilla de traducción literal.
- Botón "Copiar" con texto blanco y estilos consistentes con el tema.
- Script `scripts/manage-ollama.ps1` para listar modelos, precargar el seleccionado y reiniciar el daemon sin procesos huérfanos.

---

## Estado por áreas

| Área | Estado | Comentario |
|------|--------|------------|
| 🧠 Generación de texto | ✅ Estable | Auto prioriza mistral/qwen y reintenta si un modelo devuelve JSON inválido. |
| 🌐 Traducción literal | ✅ | JSON limpio y CTA dinámico **Generar traducción** cuando corresponde. |
| 🎯 Selector de idiomas | ✅ Adaptativo | Idiomas no soportados aparecen deshabilitados con tooltip. |
| 📌 Modelo usado | ✅ | Visible bajo "Modelo de texto" tras cada generación. |
| 🖼️ Imagen / 🔊 Voz / 🎙️ STT | ⚠️ Pendiente | FastAPI expone endpoints, pero falta afinar modelos (Kokoro/Whisper/SD). |
| 🧩 Refactor front | ⚙️ En progreso | Modos legacy pendientes de limpieza y tests. |
| 🧪 Tests automatizados | ⏳ | Vitest configurado, aún sin suites. |
| 💾 Persistencia | ⏳ | No hay DB; datos en localStorage. |
| 🚀 CI/CD | ⏳ | Builds manuales (sin GitHub Actions). |

---

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
