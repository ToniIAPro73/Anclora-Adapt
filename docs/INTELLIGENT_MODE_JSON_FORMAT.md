# Intelligent Mode JSON Format (`inteligente.json`)

## Overview

The Intelligent Mode generates a comprehensive JSON file named `inteligente.json` after analysis. This file contains all inputs and outputs from your analysis session.

## When JSON is Generated

The JSON file is automatically created and available for download when you:
1. Click the **"Generar"** button in Intelligent Mode
2. Provide the required **"Idea"** field
3. Provide either:
   - An **image** (with or without manual prompt), OR
   - A manual **prompt** (when image is not marked)

## JSON Structure

```json
{
  "metadata": {
    "version": "1.0",
    "timestamp": "2025-12-08T14:30:45.123Z",
    "mode": "intelligent"
  },
  "inputs": {
    "idea": "Estrategia de marketing para Dubai",
    "contexto": "Empresas de LATAM dirigidas a mercado árabe",
    "idioma": "Español",
    "pensamiento_profundo": true,
    "imagen_incluida": false,
    "imagen_prompt": null,
    "imagen_analizada": null
  },
  "resultados": {
    "contenido_generado": "Análisis estratégico completo generado por el modelo..."
  }
}
```

## Field Descriptions

### metadata

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | API version (currently "1.0") |
| `timestamp` | string | ISO 8601 timestamp of generation |
| `mode` | string | Always "intelligent" for this endpoint |

### inputs

| Field | Type | Description | Conditional |
|-------|------|-------------|-------------|
| `idea` | string | Your main idea/strategy (required) | Always present |
| `contexto` | string | Context or "General" if empty | Always present |
| `idioma` | string | Selected language name (e.g., "Español", "English") | Always present |
| `pensamiento_profundo` | boolean | Deep thinking mode enabled? | Always present |
| `imagen_incluida` | boolean | Was "Incluir Imagen" checkbox marked? | Always present |
| `imagen_prompt` | string \| null | Image prompt (auto-generated or manual) | Only if `imagen_incluida: true` |
| `imagen_analizada` | boolean \| null | Was an image actually uploaded & analyzed? | Only if `imagen_incluida: true` |

### resultados

| Field | Type | Description | Conditional |
|-------|------|-------------|-------------|
| `contenido_generado` | string | Complete text output from the model | Always present |
| `imagen_url` | string \| undefined | Generated image URL (if generated) | Only if image generation was performed |

## Complete Example: With Image

```json
{
  "metadata": {
    "version": "1.0",
    "timestamp": "2025-12-08T14:30:45.123Z",
    "mode": "intelligent"
  },
  "inputs": {
    "idea": "Crear una campaña visual para posicionar un producto de lujo en Dubai",
    "contexto": "Empresas de LATAM dirigidas a mercado árabe, CEO de 35-55 años",
    "idioma": "Español",
    "pensamiento_profundo": true,
    "imagen_incluida": true,
    "imagen_prompt": "Una fotografía profesional en estilo fotorealista que muestra un producto de lujo elegante con composición de regla de tercios. Iluminación profesional con tonos cálidos dorados y neutrales. Fondo borroso con bokeh. Textura de tejido premium. Mood sofisticado y exclusivo...",
    "imagen_analizada": true
  },
  "resultados": {
    "contenido_generado": "# Estrategia Visual para Mercado Árabe\n\n## Análisis del Público Objetivo\n...[complete analysis]...",
    "imagen_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA..."
  }
}
```

## Complete Example: Without Image

```json
{
  "metadata": {
    "version": "1.0",
    "timestamp": "2025-12-08T14:35:20.456Z",
    "mode": "intelligent"
  },
  "inputs": {
    "idea": "Análisis de mercado para expandir presencia en Middle East",
    "contexto": "Compañía de tecnología, 500+ empleados, presupuesto $2M",
    "idioma": "Español",
    "pensamiento_profundo": false,
    "imagen_incluida": false
  },
  "resultados": {
    "contenido_generado": "## Análisis de Mercado: Expansión Middle East\n\n### 1. Oportunidades de Mercado\n...[strategic analysis]..."
  }
}
```

## Image Logic

### Scenario 1: Image Checkbox NOT Marked ❌

```json
{
  "inputs": {
    "imagen_incluida": false
    // NO imagen_prompt field
    // NO imagen_analizada field
  },
  "resultados": {
    // NO imagen_url field
  }
}
```

**What happens:**
- Image-related fields completely omitted
- User can focus purely on text analysis
- JSON is cleaner and smaller

### Scenario 2: Image Checkbox Marked + Image Uploaded ✅

```json
{
  "inputs": {
    "imagen_incluida": true,
    "imagen_prompt": "Auto-generated detailed prompt from image analysis (500-800 tokens)...",
    "imagen_analizada": true
  },
  "resultados": {
    "contenido_generado": "...",
    "imagen_url": "https://..."
  }
}
```

**What happens:**
- System analyzes uploaded image with CLIP
- Auto-generates detailed prompt (or uses manual if provided)
- If image generation enabled, `imagen_url` is included

### Scenario 3: Image Checkbox Marked + Manual Prompt ✅

```json
{
  "inputs": {
    "imagen_incluida": true,
    "imagen_prompt": "Un producto de lujo en ambiente de oficina ejecutiva...",
    "imagen_analizada": false
  },
  "resultados": {
    "contenido_generado": "...",
    "imagen_url": "https://..."
  }
}
```

**What happens:**
- User entered prompt manually (no image uploaded)
- `imagen_analizada: false` indicates no CLIP analysis
- Image still generated if functionality enabled

## Deep Thinking Impact

When **"Pensamiento Profundo"** is enabled:

- **Idea processing**: More detailed analysis and longer response
- **Context processing**: Deeper contextual analysis
- **Image prompts**: Much more detailed (500-800 tokens vs 150-300)
- **Output**: More comprehensive strategic recommendations

All reflected in `contenido_generado` field.

## Use Cases

### 1. Archive & Reference
Save JSON files with meaningful dates:
```
inteligente_2025-12-08_marketing-dubai.json
inteligente_2025-12-08_tech-expansion.json
```

### 2. Share Analysis
Email the JSON to stakeholders who can:
- Review exact inputs and prompts used
- See complete outputs
- Verify reasoning and context

### 3. Further Refinement
Use the JSON with other AI models:
```
"Based on this Intelligent Mode analysis:
[PASTE JSON]

Can you create variations or improvements?"
```

### 4. Document Decision-Making
Include JSON in meeting notes:
- What was analyzed
- What prompts were used
- What timeframe
- What were the results

### 5. Batch Analysis
Collect multiple JSONs for comparison:
```
analyses/
├── inteligente_idea1.json
├── inteligente_idea2.json
├── inteligente_idea3.json
```

Then summarize trends across analyses.

## Download Button

The **📥 Descargar inteligente.json** button appears:
- ✅ After generation completes
- ✅ Below the generated content
- ✅ In the Results section

**Click to:**
1. Download as `inteligente.json`
2. Save to your downloads folder
3. Rename for organization
4. Share with others
5. Use in other applications

## Tips & Best Practices

### File Naming

```
Good:
inteligente_2025-12-08_dubai-strategy.json
inteligente_expansion-tech-2025.json
inteligente_idea1_deepthinking.json

Less helpful:
inteligente.json (loses context)
inteligente (1).json (backup clutter)
inteligente_copy.json (unclear)
```

### Organizing Files

```
MyProject/
├── analyses/
│   ├── 2025-12/
│   │   ├── inteligente_marketing.json
│   │   ├── inteligente_strategy.json
│   │   └── inteligente_vision.json
│   └── 2025-11/
│       └── inteligente_research.json
└── README.md
```

### Comparing Analyses

Compare the `inputs` across multiple JSONs:
```
Idea 1: "Marketing strategy"
Idea 2: "Sales strategy"
Idea 3: "Customer success strategy"

Which generated the best output?
Which was enhanced by Deep Thinking?
Which included image analysis?
```

### Version Control

Include in git/version control:
```bash
git add *.json
git commit -m "Add Intelligent Mode analyses for Q4 planning"
```

Then track changes over time.

## Troubleshooting

### JSON Not Downloading

**Problem**: Download button doesn't appear
**Solution**:
- Wait for generation to complete
- Check that error message isn't displayed
- Scroll down in results section
- Refresh page if needed

### Missing Image Data

**Problem**: `imagen_url` field is null/empty
**Situation**: Normal if:
- Image checkbox unchecked
- Image analysis enabled but no image generated
- Image generation service unavailable

### Very Large JSON

**Problem**: File is very large (>5MB)
**Cause**: Usually `imagen_url` contains base64 encoded image
**Solution**:
- This is normal for generated images
- Remove `imagen_url` if sharing text-only
- Or use web URL instead of base64

### Encoding Issues

**Problem**: File opens with strange characters
**Solution**:
- Save as UTF-8 encoding
- Use a JSON viewer app
- Open with VS Code or text editor

## Integration with Other Tools

### Option 1: ChatGPT/Claude

1. Open JSON file
2. Paste entire content to AI model
3. Ask: "Based on this Intelligent Mode analysis, can you create variations or improvements?"

### Option 2: Python Processing

```python
import json

with open('inteligente.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

idea = data['inputs']['idea']
output = data['resultados']['contenido_generado']
has_image = data['inputs']['imagen_incluida']

print(f"Idea: {idea}")
print(f"Deep Thinking: {data['inputs']['pensamiento_profundo']}")
print(f"Image Included: {has_image}")
```

### Option 3: Excel/Sheets

1. Open Google Sheets
2. Tools → Import data from file
3. Select JSON
4. Create spreadsheet with columns from JSON fields
5. Compare multiple analyses side-by-side

## Version Information

- **Format Version**: 1.0 (current)
- **Compatibility**: All Intelligent Mode analyses
- **Last Updated**: December 2025

Future versions may include:
- Analysis quality score
- Processing time
- Model version used
- Confidence scores
