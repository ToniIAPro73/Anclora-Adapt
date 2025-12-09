# Image Analyzer - Detailed JSON Export Example

## Overview

The new `/api/images/analyze-detailed` endpoint provides a comprehensive JSON export of image analysis. This is perfect for:

- **Fallback when image generation fails**: Copy the JSON and paste into another AI model
- **External model usage**: Use the structured data in other services
- **Analysis sharing**: Share complete visual analysis across platforms
- **Batch processing**: Use the JSON structure for multiple images

## Endpoint

```
POST /api/images/analyze-detailed
```

**Parameters:**
- `image` (file, required): Image to analyze
- `user_prompt` (string, optional): Custom user input
- `deep_thinking` (boolean, optional): Detailed vs standard mode

## Example Response

```json
{
  "metadata": {
    "version": "1.0",
    "analyzer": "CLIP-Ollama",
    "mode": "deep_thinking",
    "file_name": "photo.jpg",
    "file_size_bytes": 245812,
    "content_type": "image/jpeg"
  },
  "visual_analysis": {
    "style": {
      "description": "Artistic style and visual approach",
      "top_options": [
        {
          "value": "photorealistic",
          "score": 0.95
        },
        {
          "value": "digital art",
          "score": 0.12
        },
        {
          "value": "watercolor",
          "score": 0.08
        }
      ]
    },
    "mood": {
      "description": "Emotional tone and atmosphere",
      "top_options": [
        {
          "value": "calm",
          "score": 0.88
        },
        {
          "value": "peaceful",
          "score": 0.81
        },
        {
          "value": "romantic",
          "score": 0.45
        }
      ]
    },
    "composition": {
      "description": "Spatial layout and framing",
      "top_options": [
        {
          "value": "rule of thirds",
          "score": 0.92
        },
        {
          "value": "centered subject",
          "score": 0.31
        },
        {
          "value": "leading lines",
          "score": 0.28
        }
      ]
    },
    "color_palette": {
      "description": "Color scheme and tones",
      "top_options": [
        {
          "value": "warm tones",
          "score": 0.87
        },
        {
          "value": "natural",
          "score": 0.79
        },
        {
          "value": "earth tones",
          "score": 0.61
        }
      ]
    },
    "subjects": {
      "description": "Main subjects and elements",
      "top_options": [
        {
          "value": "portrait",
          "score": 0.91
        },
        {
          "value": "people",
          "score": 0.88
        },
        {
          "value": "nature",
          "score": 0.45
        }
      ]
    }
  },
  "prompts": {
    "detailed_prompt": "A photorealistic portrait photograph featuring a calm, peaceful mood with warm earth tones. The composition follows the rule of thirds with the main subject positioned off-center. Natural lighting creates soft shadows and gentle highlights across the face. The color palette consists of warm golden tones, beige, and soft browns with natural skin tones. The subject's expression is serene and contemplative. Shot with professional portrait techniques using shallow depth of field to blur the background. The overall atmosphere is intimate and serene, captured with fine detail and texture...",
    "original_user_input": "A person in nature",
    "combined_prompt": "A photorealistic portrait photograph featuring a calm, peaceful mood with warm earth tones. The composition follows the rule of thirds with the main subject positioned off-center. Natural lighting creates soft shadows and gentle highlights across the face. The color palette consists of warm golden tones, beige, and soft browns with natural skin tones. The subject's expression is serene and contemplative. Shot with professional portrait techniques using shallow depth of field to blur the background. The overall atmosphere is intimate and serene, captured with fine detail and texture...\n\nContext: A person in nature"
  },
  "usage_instructions": {
    "for_image_generation": [
      "Use 'detailed_prompt' field for best quality with your image model",
      "For iterative refinement, use 'combined_prompt'",
      "Copy the entire prompt text to your image generation model"
    ],
    "for_external_models": [
      "Copy the entire 'visual_analysis' object to provide context to another AI model",
      "Include the 'detailed_prompt' for the model to understand the intended image",
      "The JSON structure allows another model to understand all analyzed aspects",
      "Each category includes scores (0-1) indicating confidence in each aspect"
    ],
    "for_refinement": [
      "Edit the 'detailed_prompt' to adjust any aspects",
      "Combine multiple prompts from 'top_options' for custom variations",
      "Add 'original_user_input' back if desired for personal touches"
    ]
  },
  "analysis_scores": {
    "style": [
      {
        "aspect": "photorealistic",
        "confidence": 0.95,
        "percentage": "95.0%"
      },
      {
        "aspect": "digital art",
        "confidence": 0.12,
        "percentage": "12.0%"
      },
      {
        "aspect": "watercolor",
        "confidence": 0.08,
        "percentage": "8.0%"
      }
    ],
    "mood": [
      {
        "aspect": "calm",
        "confidence": 0.88,
        "percentage": "88.0%"
      },
      {
        "aspect": "peaceful",
        "confidence": 0.81,
        "percentage": "81.0%"
      },
      {
        "aspect": "romantic",
        "confidence": 0.45,
        "percentage": "45.0%"
      }
    ],
    "composition": [
      {
        "aspect": "rule of thirds",
        "confidence": 0.92,
        "percentage": "92.0%"
      },
      {
        "aspect": "centered subject",
        "confidence": 0.31,
        "percentage": "31.0%"
      },
      {
        "aspect": "leading lines",
        "confidence": 0.28,
        "percentage": "28.0%"
      }
    ],
    "color_palette": [
      {
        "aspect": "warm tones",
        "confidence": 0.87,
        "percentage": "87.0%"
      },
      {
        "aspect": "natural",
        "confidence": 0.79,
        "percentage": "79.0%"
      },
      {
        "aspect": "earth tones",
        "confidence": 0.61,
        "percentage": "61.0%"
      }
    ],
    "subjects": [
      {
        "aspect": "portrait",
        "confidence": 0.91,
        "percentage": "91.0%"
      },
      {
        "aspect": "people",
        "confidence": 0.88,
        "percentage": "88.0%"
      },
      {
        "aspect": "nature",
        "confidence": 0.45,
        "percentage": "45.0%"
      }
    ]
  }
}
```

## Usage Examples

### Example 1: Copy to Another Image Model

If your image generation fails, you can use the `detailed_prompt`:

```
Copy from JSON: prompts.detailed_prompt

Then paste into your favorite image model:
- Midjourney
- Stable Diffusion
- DALL-E
- Runway
- Any other image generation API
```

### Example 2: Share Analysis for Review

Share the `visual_analysis` object with someone:

```json
{
  "visual_analysis": {
    "style": { ... },
    "mood": { ... },
    ...
  }
}
```

They can understand exactly what the analyzer detected, with confidence scores.

### Example 3: Use in Another AI Model

Paste the entire JSON into an AI model like ChatGPT:

```
Here's my detailed image analysis:
[PASTE ENTIRE JSON]

Can you:
1. Create a more artistic version of this prompt?
2. Suggest variations for different image styles?
3. Write a detailed scene description?
```

### Example 4: Batch Processing

Process multiple images and collect all JSON responses:

```json
{
  "images": [
    { "image1": {...full json...} },
    { "image2": {...full json...} },
    { "image3": {...full json...} }
  ]
}
```

Then analyze patterns across images.

## JSON Structure Reference

| Field | Type | Description |
|-------|------|-------------|
| `metadata` | object | File info, analyzer version, mode |
| `metadata.version` | string | API version (1.0) |
| `metadata.analyzer` | string | Analyzer name (CLIP-Ollama) |
| `metadata.mode` | string | Analysis mode (deep_thinking or standard) |
| `metadata.file_name` | string | Original filename |
| `metadata.file_size_bytes` | number | Image file size in bytes |
| `metadata.content_type` | string | MIME type (e.g., image/jpeg) |
| `visual_analysis` | object | Complete visual analysis breakdown |
| `visual_analysis.{category}` | object | One of: style, mood, composition, color_palette, subjects |
| `visual_analysis.{category}.description` | string | What this category represents |
| `visual_analysis.{category}.top_options` | array | Top 3 detected options with scores |
| `prompts` | object | Generated prompts for various uses |
| `prompts.detailed_prompt` | string | Main detailed prompt (500-800 tokens) |
| `prompts.original_user_input` | string | User's original input (if provided) |
| `prompts.combined_prompt` | string | Detailed prompt + user input combined |
| `usage_instructions` | object | Guidance on using the JSON |
| `analysis_scores` | object | All aspects with confidence percentages |

## Mode Differences

### Standard Mode (default)

- Token limit: **500 tokens**
- 8-point prompt structure
- Faster analysis
- Good for quick iterations

**When to use:**
- Quick image generation testing
- Iterative refinement
- Multiple image variations

### Deep Thinking Mode

- Token limit: **800 tokens**
- 10-point prompt structure with extra detail
- Includes lighting, technique, and scale information
- Slightly slower but more comprehensive

**When to use:**
- High-quality final images
- Complex subjects requiring detail
- When you need maximum descriptiveness

## Tips for Best Results

1. **Use detailed_prompt** as-is first, without modifications
2. **For variations**, edit specific aspects from analysis_scores
3. **Combine top_options** from different categories for custom prompts
4. **Share with others** by copying visual_analysis section
5. **Version your analyses** by saving the JSON with timestamps

## Troubleshooting

### JSON is empty or incomplete

- Check that deep_thinking is set correctly
- Verify image file is valid and readable
- Ensure Ollama is running with mistral model

### Confidence scores are all low

- Image may be ambiguous or complex
- Try uploading a clearer image
- Multiple similar scoring indicates balance in the image

### Prompt doesn't match image

- This is expected - prompts are generative
- Use analysis_scores to understand detected aspects
- Combine with user_input for more control

## Integration Examples

### Python

```python
import requests
import json

with open('image.jpg', 'rb') as img:
    files = {'image': img}
    data = {'deep_thinking': True}
    response = requests.post(
        'http://localhost:8000/api/images/analyze-detailed',
        files=files,
        data=data
    )
    analysis_json = response.json()

    # Save for later use
    with open('analysis.json', 'w') as f:
        json.dump(analysis_json, f, indent=2)
```

### JavaScript/Node.js

```javascript
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('image', fs.createReadStream('image.jpg'));
form.append('deep_thinking', 'true');

const response = await fetch(
  'http://localhost:8000/api/images/analyze-detailed',
  { method: 'POST', body: form }
);

const analysis = await response.json();
console.log(JSON.stringify(analysis, null, 2));
```

### cURL

```bash
curl -X POST http://localhost:8000/api/images/analyze-detailed \
  -F "image=@image.jpg" \
  -F "deep_thinking=true" \
  -o analysis.json
```

## Next Steps

1. Use `prompts.detailed_prompt` for image generation
2. If generation fails, copy entire JSON to another AI model
3. Refine based on confidence scores in `analysis_scores`
4. Iterate with variations from `top_options`
5. Share analysis JSON with collaborators
