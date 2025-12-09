# Integración Frontend - Mejoras de Image Analyzer

Guía para integrar las mejoras del sistema de análisis de imágenes en el frontend React.

---

## 📝 Cambios en la Respuesta de API

La respuesta de `/api/images/analyze` ahora es más extendida. El frontend debe adaptarse:

### Antes (estructura antigua)

```javascript
{
  success: true,
  generatedPrompt: "...",
  analysis: {},
  userInput: "..."
}
```

### Después (estructura nueva - EXTENDIDA)

```javascript
{
  success: true,
  image_context: {
    brief_caption: "...",
    detailed_description: "...",
    objects: [...],
    people: [...],
    setting: "...",
    mood: "...",
    style: "...",
    colors: [...],
    text_in_image: "...",
    composition: "...",           // NUEVO
    lighting: "...",              // NUEVO
    technical_details: {...},     // NUEVO
    palette_hex: [...],           // NUEVO
    semantic_tags: [...],         // NUEVO
    generative_prompt: "...",
    adapted_prompts: {            // NUEVO
      campaign: "...",
      intelligent: "...",
      recycle: "...",
      basic: "..."
    },
    analysis_timestamp: "2025-12-09T...",
    image_hash: "abc123def456..."
  },
  metadata: {                      // NUEVO
    model_used: "qwen3-vl:8b",
    language: "es",
    deep_thinking: false,
    processing_time_seconds: 2.34,
    confidence_score: 1.0,
    model_fallback_used: false
  },
  user_input: "...",
  cached: false                    // NUEVO
}
```

---

## 🔄 Actualizar Hooks/Services

### 1. Actualizar tipo de respuesta

**archivo: `src/types/api.ts` (o similar)**

```typescript
// ANTES
interface ImageAnalysisResponse {
  success: boolean;
  generatedPrompt: string;
  analysis: Record<string, any>;
  userInput: string;
}

// DESPUÉS
interface ImageContext {
  brief_caption: string;
  detailed_description: string;
  objects: string[];
  people: string[];
  setting: string;
  mood: string;
  style: string;
  colors: string[];
  text_in_image: string;
  composition: string;
  lighting: string;
  technical_details: Record<string, string>;
  palette_hex: string[];
  semantic_tags: string[];
  generative_prompt: string;
  adapted_prompts: {
    campaign: string;
    intelligent: string;
    recycle: string;
    basic: string;
  };
  analysis_timestamp: string;
  image_hash: string;
}

interface AnalysisMetadata {
  model_used: string;
  language: string;
  deep_thinking: boolean;
  processing_time_seconds: number;
  confidence_score: number;
  model_fallback_used: boolean;
}

interface ImageAnalysisResponse {
  success: boolean;
  image_context?: ImageContext;
  metadata?: AnalysisMetadata;
  user_input?: string;
  error?: string;
  cached: boolean;
}
```

---

### 2. Actualizar servicio de API

**archivo: `src/api/imageService.ts` (o similar)**

```typescript
export async function analyzeImage(
  imageFile: File,
  userPrompt?: string,
  deepThinking?: boolean,
  language?: string
): Promise<ImageAnalysisResponse> {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("user_prompt", userPrompt || "");
  formData.append("deep_thinking", deepThinking ? "true" : "false");
  formData.append("language", language || "es");

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/api/images/analyze`,
    {
      method: "POST",
      body: formData,
      // NO establecer Content-Type (FormData lo maneja)
    }
  );

  if (!response.ok) {
    throw new Error(`Image analysis failed: ${response.statusText}`);
  }

  const data = (await response.json()) as ImageAnalysisResponse;

  if (!data.success) {
    throw new Error(data.error || "Unknown error");
  }

  return data;
}

// NUEVO: obtener estadísticas de caché
export async function getCacheStats(): Promise<any> {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/api/images/cache-stats`
  );

  if (!response.ok) {
    throw new Error("Could not fetch cache stats");
  }

  return response.json();
}

// NUEVO: limpiar caché expirado
export async function clearExpiredCache(): Promise<any> {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/api/images/cache-clear-expired`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error("Could not clear cache");
  }

  return response.json();
}
```

---

## 🎨 Actualizar Componentes

### 3. En Modo Inteligente

**archivo: `src/components/modes/IntelligentMode.tsx` (o similar)**

```typescript
import { analyzeImage } from "@/api/imageService";
import type { ImageAnalysisResponse, ImageContext } from "@/types/api";

// En el manejador de análisis
async function handleImageAnalysis(imageFile: File) {
  try {
    setIsLoading(true);

    const response = await analyzeImage(
      imageFile,
      userPrompt,
      deepThinking,
      language
    );

    // ANTES accedías a response.generatedPrompt
    // AHORA accedes a response.image_context
    const context = response.image_context;

    // Usar el nuevo campo extendido
    const mainPrompt = context?.generative_prompt || "";

    // Mostrar información adicional
    console.log("Mood:", context?.mood);
    console.log("Style:", context?.style);
    console.log("Lighting:", context?.lighting);
    console.log("Modelo usado:", response.metadata?.model_used);
    console.log("Desde caché:", response.cached);

    // Actualizar estado con la nueva estructura
    setImageAnalysis({
      success: true,
      prompt: mainPrompt,
      context: context,
      metadata: response.metadata,
      cached: response.cached,
    });

    // Si fue desde caché, mostrar notificación
    if (response.cached) {
      showNotification("Resultado recuperado del caché (muy rápido!)");
    }

    // Mostrar confidence_score si es fallback
    if (response.metadata?.model_fallback_used) {
      showNotification(
        `Usando modelo alternativo (confianza: ${(
          response.metadata.confidence_score * 100
        ).toFixed(0)}%)`
      );
    }
  } catch (error) {
    // Manejo de error mejorado
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Image analysis error:", errorMsg);
    setError(errorMsg);
  } finally {
    setIsLoading(false);
  }
}
```

---

### 4. Mostrar Información Extendida

**Componente para mostrar contexto extendido:**

```typescript
interface ImageContextDisplayProps {
  context: ImageContext;
  metadata?: AnalysisMetadata;
}

export function ImageContextDisplay({
  context,
  metadata,
}: ImageContextDisplayProps) {
  return (
    <div className="image-analysis-results">
      {/* Información básica */}
      <section>
        <h3>Análisis Visual</h3>
        <p>
          <strong>Caption:</strong> {context.brief_caption}
        </p>
        <p>
          <strong>Mood:</strong> {context.mood}
        </p>
        <p>
          <strong>Style:</strong> {context.style}
        </p>
      </section>

      {/* NUEVA: Información extendida */}
      <section>
        <h3>Detalles Visuales (NUEVO)</h3>
        <p>
          <strong>Composition:</strong> {context.composition}
        </p>
        <p>
          <strong>Lighting:</strong> {context.lighting}
        </p>

        {context.palette_hex.length > 0 && (
          <div>
            <strong>Color Palette:</strong>
            <div className="color-palette">
              {context.palette_hex.map((hex) => (
                <div
                  key={hex}
                  className="color-swatch"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* NUEVA: Prompts adaptados */}
      <section>
        <h3>Prompts Adaptados por Modo (NUEVO)</h3>
        <div className="adapted-prompts">
          {Object.entries(context.adapted_prompts).map(([mode, prompt]) => (
            <details key={mode}>
              <summary>{mode.toUpperCase()}</summary>
              <p>{prompt}</p>
              <button onClick={() => copyToClipboard(prompt)}>Copiar</button>
            </details>
          ))}
        </div>
      </section>

      {/* NUEVA: Metadatos de análisis */}
      {metadata && (
        <section className="metadata">
          <h3>Detalles del Análisis</h3>
          <dl>
            <dt>Modelo:</dt>
            <dd>{metadata.model_used}</dd>

            <dt>Tiempo:</dt>
            <dd>{metadata.processing_time_seconds.toFixed(2)}s</dd>

            <dt>Confianza:</dt>
            <dd>{(metadata.confidence_score * 100).toFixed(0)}%</dd>

            {metadata.model_fallback_used && (
              <>
                <dt>Status:</dt>
                <dd>⚠️ Usando fallback (primario no disponible)</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {/* Información de caché */}
      {/* Si fue cached=true, mostrar badge */}
      <div className="cache-badge">Resultado rápido (desde caché)</div>
    </div>
  );
}
```

---

### 5. Indicador de Caché en UI

**Mostrar visualmente si resultado fue cacheado:**

```typescript
// Componente simple para Badge de caché
export function CacheBadge({ cached }: { cached?: boolean }) {
  if (!cached) return null;

  return (
    <div className="cache-badge cached">
      <span className="icon">⚡</span>
      <span className="text">Recuperado del caché</span>
    </div>
  );
}

// Uso en componente
<CacheBadge cached={response.cached} />;
```

**Estilos (CSS):**

```css
.cache-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #e8f5e9;
  border: 1px solid #4caf50;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #1b5e20;
  margin-top: 1rem;
}

.cache-badge .icon {
  font-size: 1.1rem;
}

.color-palette {
  display: flex;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.color-swatch {
  width: 30px;
  height: 30px;
  border-radius: 4px;
  border: 1px solid #ccc;
  cursor: pointer;
}

.color-swatch:hover {
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.2);
}
```

---

### 6. Barra de Progreso Mejorada

Si deseas mostrar el tiempo de procesamiento:

```typescript
export function AnalysisProgressBar({
  isLoading,
  processingTime,
  cached,
}: {
  isLoading: boolean;
  processingTime?: number;
  cached?: boolean;
}) {
  if (!isLoading && !processingTime) return null;

  return (
    <div className="progress-container">
      {isLoading ? (
        <>
          <div className="progress-bar">
            <div className="progress-fill" />
          </div>
          <p className="progress-text">Analizando imagen...</p>
        </>
      ) : (
        <p className="progress-text success">
          {cached ? "⚡ Análisis rápido" : "✓ Análisis completado"}({processingTime?.toFixed(
            2
          )}s)
        </p>
      )}
    </div>
  );
}
```

---

## 🔧 Backward Compatibility

**Importante:** El código antiguo que accede a `response.generatedPrompt` seguirá funcionando si lo cambias a:

```typescript
// ANTES (pueden dejar de funcionar)
const prompt = response.generatedPrompt;

// DESPUÉS (compatible)
const prompt = response.image_context?.generative_prompt;

// SAFE: Fallback a antiguo si existe
const prompt =
  response.image_context?.generative_prompt ||
  (response as any).generatedPrompt ||
  "";
```

---

## 📊 Monitoreo en Frontend

Puedes mostrar estadísticas de caché en un panel admin:

```typescript
import { getCacheStats } from "@/api/imageService";

export function AdminCachePanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchStats() {
    try {
      setLoading(true);
      const data = await getCacheStats();
      setStats(data.cache_stats);
    } catch (error) {
      console.error("Could not fetch cache stats:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-panel">
      <h3>Cache Statistics</h3>
      <button onClick={fetchStats} disabled={loading}>
        {loading ? "Loading..." : "Refresh Stats"}
      </button>

      {stats && (
        <table>
          <tbody>
            <tr>
              <td>Total Entries:</td>
              <td>{stats.total_entries}</td>
            </tr>
            <tr>
              <td>Total Accesses:</td>
              <td>{stats.total_accesses}</td>
            </tr>
            <tr>
              <td>Avg Accesses/Entry:</td>
              <td>{stats.avg_accesses_per_entry}</td>
            </tr>
            <tr>
              <td>Most Recent Access:</td>
              <td>{new Date(stats.most_recent_access).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

## ✅ Checklist de Integración

- [ ] Actualizar tipos TypeScript (`ImageAnalysisResponse`, `ImageContext`)
- [ ] Actualizar servicio de API (`analyzeImage`)
- [ ] Actualizar componentes que usen análisis de imagen
- [ ] Actualizar para usar `image_context` en lugar de respuesta plana
- [ ] Agregar visualización de información extendida
- [ ] Mostrar badge de caché cuando `cached=true`
- [ ] Mostrar fallback warning si `model_fallback_used=true`
- [ ] Testear con respuestas de caché
- [ ] Testear con fallback models
- [ ] Verificar que UI es responsive con más información

---

## 🎯 Ejemplo Completo

Aquí está un flujo completo de uso:

```typescript
// 1. Usuario sube imagen
const imageFile = event.target.files[0];

// 2. Llamar API
const response = await analyzeImage(
  imageFile,
  userPrompt,
  deepThinking,
  language
);

// 3. Extraer contexto
const context = response.image_context;
const metadata = response.metadata;
const fromCache = response.cached;

// 4. Actualizar UI
setPrompt(context.generative_prompt);

// 5. Mostrar metadatos
console.log(`
  Modelo: ${metadata.model_used}
  Tiempo: ${metadata.processing_time_seconds}s
  Desde caché: ${fromCache}
  Confianza: ${metadata.confidence_score * 100}%
`);

// 6. Opcionalmente mostrar información extendida
if (showDetails) {
  displayComposition(context.composition);
  displayLighting(context.lighting);
  displayColorPalette(context.palette_hex);
  displayAdaptedPrompts(context.adapted_prompts);
}
```

---

## 🚀 Próximos Pasos

1. Actualizar tipos y servicios
2. Adaptar componentes existentes
3. Testear con frontend local
4. Verificar que datos se muestran correctamente
5. Agregar visualizaciones adicionales si lo deseas

---

**Documento completo para integración frontend.** ¡Feliz implementación! 🎉
