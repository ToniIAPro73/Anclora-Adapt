# CONTEXTO DE CAMBIOS Y ESTADO

Documento vivo con el historico de decisiones y el estado actual del proyecto.  
Ultima revision: **diciembre 2025**.

---

## Resumen actual

- **Backend textual** funciona al 100% sobre **Ollama local** (Llama2, Mistral, Qwen). No hay dependencias externas ni rate limits.
- **SPA modular** (React + Vite) dividida en modos (`BasicMode`, `CampaignMode`, etc.) y contextos globales (`InteractionContext`, `ThemeContext`, `LanguageContext`).
- **Compatibilidad linguistica adaptativa**: tras pulsar "Actualizar modelos" se consulta Ollama, se recalculan las capacidades de cada modelo e idiomas no soportados quedan deshabilitados con tooltip.
- **Auto + fallback inteligente**: `resolveTextModelId` puntua los modelos disponibles (prioriza Qwen/Mistral para CJK) y `handleGenerate` reintenta automaticamente con el siguiente candidato cuando el modelo seleccionado devuelve JSON invalido, incluso si lo eligio manualmente el usuario.
- **Ajuste de hardware bajo demanda**: boton "Ajuste hardware" que consulta `/api/system/capabilities`, detecta CPU/RAM/VRAM reales (via `torch` o `nvidia-smi`) y devuelve los modelos recomendados en orden, ademas de indicar que modos pueden usarse en la UI.
- **Mejoras de UX** recientes: layout del modo Basico sin scroll vertical, CTA siempre visible con texto dinamico (**Generar contenido** / **Generar traduccion**), chips y toggles con contraste en claro/oscuro y boton "Copiar" con texto blanco.
- **Trabajo pendiente sobre la cabecera**: seguimos refinando la barra "Modelo de texto / Actualizar modelo / Ajuste hardware" para que nunca genere nuevas lineas ni desplace el formulario. Tras cada ajuste se vuelve a tener que comprobar que:
  1. El selector y los botones se mantengan alineados con el subtitulo;
  2. Al pulsar "Ajuste hardware" la informacion detectada y, en caso de modo `Auto`, el "Modelo usado" aparezcan en una sola línea inmediatamente debajo del grupo anterior, sin desplazar los chips ni los campos "Forzar traducción" y "Max. carac.";
  3. La línea inferior se adapte al ancho disponible (recortando o moviendo el texto hacia la izquierda) para evitar que aparezcan scrolls o saltos de línea adicionales.
  
  Esta alineación está siendo delicada porque la cabecera contiene varios bloques con diferentes longitudes: traducción, alternancia de idioma, selector de modelo, botones y la información dinámica de hardware/modelo usado. Cada cambio de estilo puede causar desbordes y scroll si no se controla bien `flexShrink`, `minWidth` y `white-space`, de ahí los múltiples ajustes recientes.

---

## Camino hasta aqui

### 1. Migracion a Ollama (noviembre 2025)
El endpoint antiguo de Hugging Face (`/api/hf-text`) quedo obsoleto y se reemplazo por Ollama:

```bash
ollama pull llama2
ollama serve            # o scripts/manage-ollama.ps1
npm run dev             # Vite + FastAPI
```

`POST /api/generate` usa Ollama, de modo que `.env.local` solo necesita `VITE_OLLAMA_BASE_URL` y un modelo por defecto.

### 2. Refactor de la SPA
- Carpeta `src/` organizada por modos y componentes compartidos.
- Estados globales via contextos para outputs, idioma, tema y ayudas.
- Prompts y textos centralizados en `src/constants`.

### 3. Heuristica de idioma/modelo
- `src/constants/modelCapabilities.ts` recoge la matriz de soportes por modelo (llama3.2, Mixtral, Qwen2.5, etc.).
- `resolveTextModelId` elige el mejor modelo segun idioma, velocidad y si se pide razonamiento; autoprioriza Qwen/Mistral para japones/chino/ruso.
- El modo **Auto** construye una lista ordenada y `handleGenerate` reintenta con el siguiente elemento cuando el primero falla por JSON invalido o timeout.
- `lastModelUsed` indica el modelo real usado tras cada generacion, incluso si el usuario habia escogido otro.

### 4. Ajustes de interfaz y experiencia
- Botones de modo centrados entre las lineas divisorias y CTA principal visible sin scroll.
- Toggle de idioma, boton de reinicio y chips de plataformas con contraste adecuado en ambos temas.
- Checkbox "Forzar traduccion literal" deshabilita campos no necesarios y cambia el CTA a **Generar traduccion** (regresa a **Generar contenido** al desmarcar).
- Boton "Copiar" y outputs con contraste, iconos y estados de error coherentes.
- Script `scripts/manage-ollama.ps1` lista modelos (`ollama list`), permite precargar uno, cierra procesos en el puerto 11434 y arranca `ollama serve` limpio.

### 5. Deteccion de hardware y recomendaciones
- `python-backend/hardware_profiles.py` expone `detect_hardware_profile()` usado por `/api/system/capabilities`.
- La deteccion primero usa `torch.cuda.is_available()`; si no encuentra GPU recurre a `nvidia-smi` (via `subprocess` + `shutil.which`) y convierte la memoria de MiB a GB para mostrar valores reales (ejemplo: RTX 3050 -> 4.0 GB).
- Se devuelven:
  - Datos base (cores, hilos, RAM, VRAM, almacenamiento, flag CUDA).
  - `recommendations.text`: lista ordenada de modelos sugeridos con razon y requisitos.
  - `mode_support`: modos habilitados/deshabilitados con motivo (voz, live chat, imagen dependen de VRAM/RAM).
- El boton "Ajuste hardware" guarda el resultado en contexto, actualiza el selector de modelos (los recomendados van primero), desactiva tabs no soportados y muestra el resumen detectado bajo el boton.

---

## Estado por areas

| Area | Estado | Comentario |
|------|--------|------------|
| Generacion de texto | Estable | Auto prioriza modelos multilingues y reintenta si uno devuelve JSON invalido. |
| Traduccion literal | Estable | JSON limpio y CTA dinamico **Generar traduccion**. |
| Selector de idiomas | Adaptativo | Idiomas no soportados quedan deshabilitados con tooltip. |
| Indicador de modelo usado | Completo | Visible bajo "Modelo de texto" tras cada generacion. |
| Imagen / Voz / STT | Pendiente | FastAPI expone `/api/image`, `/api/tts`, `/api/stt` pero requieren modelos definitivos (SDXL, Kokoro, Whisper). |
| Refactor front | En progreso | Modos legacy pendientes de limpieza y tests. |
| Tests automatizados | Basico | Vitest listo pero sin suites completas. |
| Persistencia | Basico | Sin BD; algunos datos se guardan en localStorage. |
| CI/CD | Manual | No hay GitHub Actions; despliegue manual. |

---

## Modelos e idiomas soportados

| Familia / Modelo | Idiomas |
|------------------|---------|
| `llama2`, `llama3`, `mistral`, `gemma` | ES, EN, FR, DE, PT, IT, RU |
| `qwen2.5`, `yi`, `deepseek` | Todo lo anterior + JA, ZH |
| `phi`, `orca`, `neural-chat` | ES, EN, FR, DE, PT, IT |

> Tras pulsar "Actualizar modelos" la app recalcula la cobertura. Si falta un idioma (ej. japones) instala un modelo compatible (`ollama pull qwen2.5:7b`) y vuelve a ejecutar el ajuste.

---

## Proximos pasos sugeridos

1. **Backend creativo**: completar la integracion de Kokoro (`kokoro.onnx` + `voices.json` en `python-backend/models/`) y ajustar Stable Diffusion en `/api/image`.
2. **Tests de regresion**: cobertura minima para los modos criticos (`BasicMode`, `CampaignMode`, `ChatMode`).
3. **Persistencia e historial**: guardar prompts/outputs en SQLite o Postgres ligero.
4. **Observabilidad**: metricas basicas y logs estructurados por modo/modelo.
5. **CI/CD**: pipeline de GitHub Actions con lint + tests antes de mergear a `development`.
6. **Optimizar assets**: seguir reduciendo tiempo de carga (lazy de contextos pesados y division por modos).

---

## Notas operativas

- `.env.local` en la raiz (sin credenciales sensibles). Usa `VITE_OLLAMA_BASE_URL`, `VITE_TEXT_MODEL_ID` y los endpoints locales.
- `npm run check:health` comprueba Ollama (`/api/tags`) y los backends locales de imagen/TTS/STT.
- Cambios de estilo viven en `src/styles/commonStyles.ts` para mantener paridad entre temas.
- Antes de sumar un idioma nuevo se debe ampliar `capabilityMatrix` con el modelo que lo soporte; si no, el idioma aparecera deshabilitado.
- Script util: `.\scripts\manage-ollama.ps1` para listar modelos, precargar uno y arrancar `ollama serve` tras matar procesos en el puerto 11434.

---

## TL;DR

- Front y backend ya no dependen de servicios externos: todo corre en Ollama + FastAPI locales.
- La UI se adapta tanto al hardware como a los modelos instalados (idiomas, modos habilitados y modelo efectivamente usado).
- Falta cerrar la parte multimedia, sumar pruebas y automatizar la entrega, pero la base actual es estable para trabajo diario. El siguiente hito es completar Kokoro/Whisper/SDXL y endurecer las suites de regresion.
