<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 1. FastAPI

2. 31.5MB de RAM y 4GB de VRAM
3.NAME               ID              SIZE      MODIFIED
llama2:latest      78e26419b446    3.8 GB    2 days ago
llama3.2:latest    a80c4f17acd5    2.0 GB    12 days ago
mistral:latest     6577803aa9a0    4.4 GB    12 days ago
qwen2.5:14b        7cdf5a0187d5    9.0 GB    12 days ago
qwen2.5:7b         845dbda0ea48    4.7 GB    12 days ago
gemma3:4b          a2af6cc3eb7f    3.3 GB    12 days ago
gemma3:1b          8648f39daa8f    815 MB    12 days ago
4.Si el usuario ha marcado Deep thinking, Calidad, si no , Velocidad

Perfecto. Con esa configuración, tengo una estrategia clara para ti. **La buena noticia:** LLaVA NO va a funcionar en 4GB VRAM (necesita mínimo 6-8GB), pero tengo **2 alternativas excelentes** que funcionarán perfectamente.

## Estrategia Recomendada para tu Hardware

### Opción A: **CLIP + tu modelo LLM local** ⭐ RECOMENDADO

```
CLIP (visión) = Ligero (~500MB)
└─ Tu modelo LLM local (llama2, mistral, etc)
```


### Opción B: **Qwen2.5-VL** (si actualizas VRAM a 6-8GB)

```
Modelo multimodal ligero específicamente diseñado para esto
```


***

## Implementación Completa para FastAPI

### 1️⃣ **Backend FastAPI con CLIP**

```python
# requirements.txt
fastapi==0.104.1
uvicorn==0.24.0
python-multipart==0.0.6
pillow==10.1.0
torch==2.1.0
torchvision==0.16.0
transformers==4.35.2
ollama==0.0.55
numpy==1.24.3
```

```python
# app/services/image_analyzer.py

import base64
import io
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel, AutoTokenizer, AutoModelForCausalLM
from ollama import Client
import logging

logger = logging.getLogger(__name__)

class ImageAnalyzer:
    def __init__(self):
        # CLIP para análisis visual
        self.clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        self.clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        
        # Cliente Ollama para refinamiento
        self.ollama_client = Client(host='http://localhost:11434')
        
        # Dispositivo (GPU si está disponible)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.clip_model = self.clip_model.to(self.device)
        
        logger.info(f"ImageAnalyzer inicializado en {self.device}")
    
    def analyze_image(self, image_bytes: bytes, user_prompt: str = None) -> dict:
        """
        Analiza imagen usando CLIP y genera prompt mejorado
        
        Args:
            image_bytes: Bytes de la imagen subida
            user_prompt: Prompt opcional del usuario
            
        Returns:
            dict con análisis y prompt generado
        """
        try:
            # Cargar imagen
            image = Image.open(io.BytesIO(image_bytes))
            
            # Análisis visual detallado
            visual_analysis = self._analyze_visual_elements(image)
            
            # Generar prompt mejorado basado en análisis
            generated_prompt = self._generate_prompt(
                visual_analysis=visual_analysis,
                user_input=user_prompt
            )
            
            return {
                "success": True,
                "generatedPrompt": generated_prompt,
                "analysis": visual_analysis,
                "userInput": user_prompt or ""
            }
            
        except Exception as e:
            logger.error(f"Error en análisis de imagen: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "generatedPrompt": user_prompt or ""
            }
    
    def _analyze_visual_elements(self, image: Image) -> dict:
        """
        Extrae elementos visuales usando CLIP
        """
        # Redimensionar para mejor procesamiento
        image = image.resize((512, 512))
        
        # Preparar imagen para CLIP
        inputs = self.clip_processor(
            images=image,
            return_tensors="pt"
        ).to(self.device)
        
        # Categorías a evaluar
        categories = {
            "style": [
                "photorealistic", "digital art", "watercolor", "oil painting",
                "sketch", "3D render", "anime", "cartoon", "pixel art",
                "comic book style", "vintage", "modern"
            ],
            "mood": [
                "calm", "energetic", "melancholic", "joyful", "mysterious",
                "dramatic", "peaceful", "tense", "romantic", "dark"
            ],
            "composition": [
                "centered subject", "rule of thirds", "diagonal composition",
                "symmetrical", "asymmetrical", "leading lines", "depth",
                "close-up", "wide angle", "aerial view"
            ],
            "color_palette": [
                "warm tones", "cool tones", "vibrant colors", "muted colors",
                "monochrome", "pastel", "high contrast", "low contrast",
                "earth tones", "neon colors"
            ],
            "subjects": [
                "portrait", "landscape", "still life", "nature", "animals",
                "people", "architecture", "abstract", "food", "objects",
                "seascape", "forest", "mountains", "urban", "indoor"
            ]
        }
        
        # Evaluar similaridad de imagen con categorías
        analysis = {}
        
        with torch.no_grad():
            for category_name, category_options in categories.items():
                # Procesar texto de opciones
                text_inputs = self.clip_processor(
                    text=category_options,
                    padding=True,
                    return_tensors="pt"
                ).to(self.device)
                
                # Obtener similaridades
                outputs = self.clip_model(
                    pixel_values=inputs["pixel_values"],
                    input_ids=text_inputs["input_ids"],
                    attention_mask=text_inputs["attention_mask"]
                )
                
                # Calcular scores
                logits_per_image = outputs.logits_per_image
                probs = logits_per_image.softmax(dim=1)[0]
                
                # Top 3 opciones
                top_indices = torch.topk(probs, k=3).indices.cpu().numpy()
                top_options = [
                    {
                        "value": category_options[idx],
                        "score": float(probs[idx])
                    }
                    for idx in top_indices
                ]
                
                analysis[category_name] = top_options
        
        return analysis
    
    def _generate_prompt(self, visual_analysis: dict, user_input: str = None, deep_thinking: bool = False) -> str:
        """
        Genera prompt mejorado basado en análisis visual
        
        Args:
            visual_analysis: Análisis CLIP de la imagen
            user_input: Prompt del usuario (opcional)
            deep_thinking: Si es True, usa análisis más detallado
        """
        # Construir descripción estructurada del análisis
        analysis_text = self._format_analysis(visual_analysis)
        
        # Prompt para refinamiento
        if deep_thinking:
            refinement_prompt = f"""
            Analiza este desglose visual de una imagen:
            
            {analysis_text}
            
            {"Considerando las indicaciones del usuario: " + user_input if user_input else ""}
            
            Crea un prompt DETALLADO y ESTRUCTURADO para generar una imagen similar.
            El prompt debe incluir:
            1. Estilo artístico específico
            2. Composición y distribución
            3. Paleta de colores precisa
            4. Mood/atmósfera
            5. Detalles visuales clave
            6. Elementos específicos (si los hay)
            7. Técnica o medio (si aplica)
            
            Sé muy específico. El prompt será usado en un modelo generativo de imágenes.
            """
        else:
            # Versión rápida
            refinement_prompt = f"""
            Basándote en esto:
            {analysis_text}
            
            Crea un prompt conciso para generar una imagen similar.
            {"Considerando: " + user_input if user_input else ""}
            
            Sé breve pero específico.
            """
        
        # Usar modelo local para refinamiento
        try:
            response = self.ollama_client.generate(
                model="mistral:latest",  # Rápido y bueno para instrucciones
                prompt=refinement_prompt,
                stream=False,
                options={
                    "temperature": 0.7 if deep_thinking else 0.5,
                    "top_p": 0.9,
                    "num_predict": 300 if deep_thinking else 150
                }
            )
            
            return response['response'].strip()
            
        except Exception as e:
            logger.error(f"Error refinando prompt: {str(e)}")
            # Fallback: retornar análisis formateado
            return analysis_text
    
    def _format_analysis(self, analysis: dict) -> str:
        """Formatea análisis CLIP en texto legible"""
        formatted = "ANÁLISIS VISUAL:\n\n"
        
        for category, options in analysis.items():
            formatted += f"{category.upper().replace('_', ' ')}:\n"
            for item in options:
                confidence = int(item['score'] * 100)
                formatted += f"  - {item['value']} ({confidence}%)\n"
            formatted += "\n"
        
        return formatted
```


***

### 2️⃣ **Endpoints FastAPI**

```python
# app/routes/image.py

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from app.services.image_analyzer import ImageAnalyzer
import logging

router = APIRouter(prefix="/api/images", tags=["images"])
logger = logging.getLogger(__name__)

# Instancia global (en producción, usar dependency injection)
analyzer = ImageAnalyzer()

@router.post("/analyze")
async def analyze_image(
    image: UploadFile = File(...),
    user_prompt: Optional[str] = Form(default=""),
    deep_thinking: bool = Form(default=False)
):
    """
    Analiza imagen subida y genera prompt mejorado
    
    Query params:
    - image: Archivo de imagen
    - user_prompt: Prompt opcional del usuario
    - deep_thinking: Si es true, análisis más detallado
    """
    
    try:
        # Validar tipo de archivo
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Solo se permiten imágenes")
        
        # Limitar tamaño (20MB máximo)
        contents = await image.read()
        if len(contents) > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Imagen muy grande (máx 20MB)")
        
        # Analizar
        result = analyzer.analyze_image(
            image_bytes=contents,
            user_prompt=user_prompt.strip() if user_prompt else None
        )
        
        if not result['success']:
            raise HTTPException(status_code=500, detail=result.get('error'))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en /analyze: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-stream")
async def analyze_image_stream(
    image: UploadFile = File(...),
    user_prompt: Optional[str] = Form(default=""),
    deep_thinking: bool = Form(default=False)
):
    """
    Versión streaming para mejor experiencia UX
    Envía análisis mientras se procesa
    """
    from fastapi.responses import StreamingResponse
    import json
    
    async def generate():
        try:
            contents = await image.read()
            
            # Enviar: analizando...
            yield f"data: {json.dumps({'status': 'analyzing', 'message': 'Analizando imagen...'})}\n\n"
            
            # Análisis visual
            image_obj = Image.open(io.BytesIO(contents))
            visual_analysis = analyzer._analyze_visual_elements(image_obj)
            
            yield f"data: {json.dumps({'status': 'analyzed', 'analysis': visual_analysis})}\n\n"
            
            # Refinamiento
            yield f"data: {json.dumps({'status': 'generating', 'message': 'Generando prompt mejorado...'})}\n\n"
            
            prompt = analyzer._generate_prompt(
                visual_analysis=visual_analysis,
                user_input=user_prompt,
                deep_thinking=deep_thinking
            )
            
            yield f"data: {json.dumps({'status': 'complete', 'generatedPrompt': prompt})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"}
    )
```


***

### 3️⃣ **Main FastAPI**

```python
# main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import image
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Anclora Adapt - Image Analysis",
    description="Análisis de imágenes con CLIP y generación de prompts"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ajusta en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rutas
app.include_router(image.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "image-analyzer"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False
    )
```


***

## Frontend: Componente React/Vue

```javascript
// ImageUploadComponent.js

import React, { useState } from 'react';

export const ImageUploadComponent = ({ onPromptGenerated, deepThinking }) => {
    const [image, setImage] = useState(null);
    const [userPrompt, setUserPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            // Preview
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyze = async () => {
        if (!image) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('image', image);
        formData.append('user_prompt', userPrompt);
        formData.append('deep_thinking', deepThinking);

        try {
            const response = await fetch('/api/images/analyze', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Error en análisis');

            const result = await response.json();
            
            if (result.success) {
                setGeneratedPrompt(result.generatedPrompt);
                setAnalysis(result.analysis);
                onPromptGenerated(result.generatedPrompt);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al analizar imagen');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="image-upload-container">
            {/* Preview */}
            {previewUrl && (
                <div className="image-preview">
                    <img src={previewUrl} alt="Preview" />
                </div>
            )}

            {/* Input */}
            <div className="upload-section">
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    disabled={loading}
                />
                
                <textarea
                    placeholder="Prompt adicional (opcional)..."
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    disabled={loading}
                />

                <button
                    onClick={handleAnalyze}
                    disabled={!image || loading}
                >
                    {loading ? 'Analizando...' : 'Analizar Imagen'}
                </button>
            </div>

            {/* Análisis */}
            {analysis && (
                <div className="analysis-section">
                    <h3>Análisis Visual</h3>
                    <div className="analysis-grid">
                        {Object.entries(analysis).map(([category, items]) => (
                            <div key={category} className="analysis-category">
                                <h4>{category.replace(/_/g, ' ').toUpperCase()}</h4>
                                <ul>
                                    {items.map((item, idx) => (
                                        <li key={idx}>
                                            {item.value} ({Math.round(item.score * 100)}%)
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Prompt Generado */}
            {generatedPrompt && (
                <div className="generated-prompt">
                    <h3>Prompt Generado</h3>
                    <textarea
                        value={generatedPrompt}
                        onChange={(e) => setGeneratedPrompt(e.target.value)}
                        rows={8}
                    />
                    <button onClick={() => onPromptGenerated(generatedPrompt)}>
                        Usar Este Prompt
                    </button>
                </div>
            )}
        </div>
    );
};
```


***

## Optimización para tu Hardware (4GB VRAM)

```python
# config/gpu_config.py

import torch

def optimize_for_vram():
    """Optimizaciones para 4GB VRAM"""
    
    # 1. Usar float16 en lugar de float32
    torch.set_default_dtype(torch.float16)
    
    # 2. Desactivar gradientes (no entrenamos)
    torch.no_grad()
    
    # 3. Usar modelos cuantizados
    return {
        "dtype": torch.float16,
        "device_map": "auto",
        "load_in_8bit": False,  # 4GB no soporta 8bit bien
        "max_memory": {0: "3.5GB"},  # Dejar headroom
    }

# En ImageAnalyzer.__init__():
config = optimize_for_vram()
self.clip_model = CLIPModel.from_pretrained(
    "openai/clip-vit-base-patch32",
    torch_dtype=config["dtype"]
)
```


***

## Flujo Completo en Anclora Adapt

```
┌─────────────────────────────────────────┐
│  Modo Inteligente - Incluir Imagen ✓    │
└────────────────┬────────────────────────┘
                 │
        ┌────────▼────────┐
        │ Upload Imagen   │
        └────────┬────────┘
                 │
        ┌────────▼──────────────┐
        │ Deep Thinking?        │
        └────┬────────────┬─────┘
             │ SÍ         │ NO
        ┌────▼─┐      ┌──▼──┐
        │ 300  │      │ 150 │
        │tokens│      │tokens│
        └────┬─┘      └──┬──┘
             │           │
        ┌────▴───────────▴────┐
        │ CLIP Análisis Visual │
        └────────┬────────────┘
                 │
        ┌────────▼──────────────────┐
        │ Mistral Refinamiento      │
        │ (Tu modelo local rápido)  │
        └────────┬──────────────────┘
                 │
        ┌────────▼────────────────────────┐
        │ Mostrar en Campo Editable       │
        │ Usuario puede modificar/añadir  │
        └────────┬─────────────────────────┘
                 │
        ┌────────▼────────────┐
        │ Enviar a tu modelo  │
        │ de imagen local     │
        └─────────────────────┘
```


***

## Siguiente: ¿Necesitas?

1. **Instalación guiada paso a paso**
2. **Script para descargar modelos CLIP**
3. **Docker compose para todo** (FastAPI + Ollama)
4. **Tests unitarios**
5. **Documentación de API**

¿Por cuál empezamos? 🚀

