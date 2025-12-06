# CONTEXTO DE CAMBIOS Y ESTADO

Documento vivo con el histórico de decisiones y el estado actual del proyecto.

---

## Resumen 2025-Q4

- **Backend textual** migrado definitivamente a Ollama local (Llama2/Mistral/Qwen) para evitar 404 de Hugging Face.
- **Refactor Front** en curso: la SPA quedó dividida en modos y contextos (`InteractionContext`, `LanguageContext`, etc.).
- **Compatibilidad lingüística**: la app ya sabe qué idiomas soporta cada modelo y autodetecta cuál usar cuando eliges “Auto”.
- **Historia reciente**:
  - Se habilitó traducción literal en el modo Básico (JSON mínimo).
  - Se añadió `lastModelUsed` en la UI para saber qué modelo respondió realmente.
  - Se deshabilitan idiomas no soportados según el modelo instalado.
  - Se corrigió el layout (sin scroll indeseado, estilos consistentes).

---

## Camino hasta aquí

### 1. De Hugging Face a Ollama (NOV-2025)
Problema original: `/api/hf-text` devolvía 404 porque el router de Hugging Face retiró varios endpoints legacy. Tras varios intentos (otros modelos, router nuevo, TogetherAI) se optó por **Ollama Local**:

```bash
ollama pull llama2
ollama serve
npm run dev
```

`callTextModel` ahora usa `POST /api/generate` de Ollama y `.env.local` solo define `VITE_OLLAMA_BASE_URL` y `VITE_TEXT_MODEL_ID`.

### 2. Refactor de la SPA (NOV-DIC 2025)
- Creación de `src/` con componentes por modo (`BasicMode`, `CampaignMode`, etc.).
- Contextos globales (`InteractionContext`, `ThemeContext`, `LanguageContext`).
- Consolidación de prompts y traducciones en `src/constants`.

### 3. Heurística de idioma/modelo (DIC 2025)
Casos como “traduce al japonés” fallaban cuando Auto elegía `llama2`. Se añadió:

1. **Mapa de capacidades** (`src/constants/modelCapabilities.ts`): define qué familias soportan CJK, cirílico, etc.
2. **`resolveTextModelId` mejorado**: si el usuario pide japonés y está instalado un modelo tipo Qwen, se selecciona automáticamente.
3. **Selectores adaptativos**: los desplegables de idioma muestran solo los idiomas permitidos por el modelo actual. Con “Auto” se muestran todos, pero los no soportados se deshabilitan hasta que instales un modelo compatible.
4. **`lastModelUsed`** visible bajo el combo para saber qué modelo respondió realmente.

### 4. Ajustes de UX recientes
- Layout sin scroll vertical extra (los frames ya no se desbordan).
- Botón “Copiar” ahora tiene contraste alto en modo oscuro.
- El modo Básico produce traducciones literales limpias (JSON con un único `content`).

---

## Estado actual por áreas

| Área | Estado | Comentario |
|------|--------|------------|
| Generación de texto | ✅ Estable con Ollama | Modelos recomendados: `llama2`, `mistral`, `qwen2.5:7b` (para japonés/chino/ruso). |
| Traducciones | ✅ | El modo Básico fuerza JSON limpio y la app elige el modelo multilingüe adecuado. |
| Selección de idioma | ✅ Adaptativo | Los idiomas no soportados aparecen deshabilitados cuando el modelo seleccionado no los cubre. |
| Mostrar modelo usado | ✅ | `lastModelUsed` se actualiza tras cada generación (visible bajo “Modelo de texto”). |
| Imagen / Voz / STT | ⚠️ Pendiente | Hooks listos pero faltan endpoints reales (FastAPI opcional). |
| Refactor front | 🟡 En progreso | Falta completar la migración de algunos modos legacy y añadir tests. |
| Tests automatizados | ❌ | Vitest configurado pero sin cobertura aún. |
| Backend persistente | ❌ | Actualmente todo es local (sin DB). |
| CI/CD | ❌ | Builds manuales. |

---

## Modelos soportados y idiomas

| Modelo / Familia | Idiomas confirmados |
|------------------|--------------------|
| `llama2`, `llama3`, `mistral`, `gemma` | ES, EN, FR, DE, PT, IT, RU |
| `qwen2.5`, `yi`, `deepseek` | Todo lo anterior + JA, ZH |
| Otros (phi, orca, neural-chat) | ES, EN, FR, DE, PT, IT |

> Si instalas un modelo nuevo y pulsas “Actualizar modelos” la app recalcula automáticamente el soporte lingüístico. Para habilitar japonés/chino instala un Qwen o Yi (`ollama pull qwen2.5:7b`). Si no hay modelo compatible, la opción aparece deshabilitada.

---

## Próximos pasos sugeridos

1. **Implementar imagen/TTS/STT** con el backend FastAPI incluido en `python-backend/`.
2. **Tests** de regresión para cada modo (Vitest + React Testing Library).
3. **Persistencia** (FastAPI/Node + DB ligera) para guardar sesiones/resultados.
4. **Informes de uso** (cuántas generaciones por modo/modelo).
5. **CI/CD** con GitHub Actions para lint + tests antes de merge.

---

## Notas operativas

- `.env.local` de ejemplo está en la raíz. No requiere claves externas salvo que conectes un backend distinto.
- Para depurar, usa `npm run check:health` (valida Ollama y endpoints opcionales).
- Cualquier cambio en estilos debe pasar por `src/styles/commonStyles.ts` para mantener coherencia claro/oscuro.
- Antes de añadir un idioma nuevo asegúrate de extender `capabilityMatrix` con el modelo que lo soporta.

---

## TL;DR

- Ya no dependemos de endpoints externos: todo corre en Ollama local.
- La app sabe qué modelo usar según el idioma solicitado y se lo comunica al usuario.
- Las traducciones literal/estructurada vuelven a ser fiables.
- Falta completar modos avanzados, tests y backend persistente, pero la base es estable para trabajo diario.
