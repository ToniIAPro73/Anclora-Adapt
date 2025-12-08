"""
Image Analyzer Service using CLIP + Ollama
Analyzes uploaded images and generates prompts for image generation
"""

import base64
import io
import logging
from typing import Optional, Dict, Any
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel
from ollama import Client

logger = logging.getLogger(__name__)


class ImageAnalyzer:
    """Analyzes images using CLIP and generates prompts via Ollama"""

    def __init__(
        self,
        clip_model_name: str = "openai/clip-vit-base-patch32",
        ollama_host: str = "http://localhost:11434",
        ollama_model: str = "mistral:latest"
    ):
        """
        Initialize ImageAnalyzer with CLIP model and Ollama client

        Args:
            clip_model_name: HuggingFace CLIP model identifier
            ollama_host: Ollama server host
            ollama_model: Ollama model to use for prompt refinement
        """
        try:
            # CLIP para análisis visual
            logger.info(f"Loading CLIP model: {clip_model_name}")
            self.clip_model = CLIPModel.from_pretrained(clip_model_name)
            self.clip_processor = CLIPProcessor.from_pretrained(clip_model_name)

            # Cliente Ollama para refinamiento
            self.ollama_client = Client(host=ollama_host)
            self.ollama_model = ollama_model

            # Dispositivo (GPU si está disponible, CPU fallback)
            self.device = "cuda" if torch.cuda.is_available() else "cpu"

            # Optimizaciones para VRAM limitada
            self.clip_model = self.clip_model.to(self.device)
            if self.device == "cuda":
                self.clip_model = self.clip_model.half()  # float16 para ahorrar VRAM

            logger.info(f"ImageAnalyzer initialized on {self.device}")

        except Exception as e:
            logger.error(f"Error initializing ImageAnalyzer: {str(e)}")
            raise

    def analyze_image(
        self,
        image_bytes: bytes,
        user_prompt: Optional[str] = None,
        deep_thinking: bool = False
    ) -> Dict[str, Any]:
        """
        Analyzes image using CLIP and generates improved prompt

        Args:
            image_bytes: Image file bytes
            user_prompt: Optional user input for prompt refinement
            deep_thinking: If True, generates more detailed analysis

        Returns:
            dict with generated prompt and visual analysis
        """
        try:
            # Load image
            image = Image.open(io.BytesIO(image_bytes))

            # Visual analysis using CLIP
            visual_analysis = self._analyze_visual_elements(image)

            # Generate improved prompt
            generated_prompt = self._generate_prompt(
                visual_analysis=visual_analysis,
                user_input=user_prompt,
                deep_thinking=deep_thinking
            )

            return {
                "success": True,
                "generatedPrompt": generated_prompt,
                "analysis": visual_analysis,
                "userInput": user_prompt or ""
            }

        except Exception as e:
            logger.error(f"Error analyzing image: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "generatedPrompt": user_prompt or ""
            }

    def _analyze_visual_elements(self, image: Image) -> Dict[str, list]:
        """
        Extracts visual elements using CLIP
        Returns scores for different visual categories
        """
        # Resize for better processing
        image = image.resize((512, 512))

        # Prepare image for CLIP
        inputs = self.clip_processor(
            images=image,
            return_tensors="pt"
        ).to(self.device)

        # Categories to evaluate
        categories = {
            "style": [
                "photorealistic", "digital art", "watercolor", "oil painting",
                "sketch", "3D render", "anime", "cartoon", "pixel art",
                "comic book", "vintage", "modern", "surreal", "abstract"
            ],
            "mood": [
                "calm", "energetic", "melancholic", "joyful", "mysterious",
                "dramatic", "peaceful", "tense", "romantic", "dark",
                "bright", "intimate", "epic", "whimsical"
            ],
            "composition": [
                "centered subject", "rule of thirds", "diagonal composition",
                "symmetrical", "asymmetrical", "leading lines", "depth",
                "close-up", "wide angle", "aerial view", "minimal"
            ],
            "color_palette": [
                "warm tones", "cool tones", "vibrant", "muted",
                "monochrome", "pastel", "high contrast", "low contrast",
                "earth tones", "neon", "natural", "saturated"
            ],
            "subjects": [
                "portrait", "landscape", "still life", "nature", "animals",
                "people", "architecture", "abstract", "food", "objects",
                "seascape", "forest", "mountains", "urban", "indoor",
                "technology", "fantasy", "space"
            ]
        }

        analysis = {}

        with torch.no_grad():
            for category_name, category_options in categories.items():
                # Process category options
                text_inputs = self.clip_processor(
                    text=category_options,
                    padding=True,
                    return_tensors="pt"
                ).to(self.device)

                # Get similarities
                outputs = self.clip_model(
                    pixel_values=inputs["pixel_values"],
                    input_ids=text_inputs["input_ids"],
                    attention_mask=text_inputs["attention_mask"]
                )

                # Calculate scores
                logits_per_image = outputs.logits_per_image
                probs = logits_per_image.softmax(dim=1)[0]

                # Top 3 options
                top_k = min(3, len(category_options))
                top_indices = torch.topk(probs, k=top_k).indices.cpu().numpy()
                top_options = [
                    {
                        "value": category_options[int(idx)],
                        "score": float(probs[int(idx)])
                    }
                    for idx in top_indices
                ]

                analysis[category_name] = top_options

        return analysis

    def _generate_prompt(
        self,
        visual_analysis: Dict[str, list],
        user_input: Optional[str] = None,
        deep_thinking: bool = False
    ) -> str:
        """
        Generates improved prompt based on visual analysis
        Uses Ollama for refinement
        """
        # Format analysis as text
        analysis_text = self._format_analysis(visual_analysis)

        # Build refinement prompt
        if deep_thinking:
            refinement_prompt = f"""Analiza este análisis visual detallado de una imagen:

{analysis_text}

{("Usuario sugiere: " + user_input) if user_input else ""}

Crea un prompt DETALLADO y ESTRUCTURADO para generar una imagen similar. El prompt debe incluir:
1. Estilo artístico específico
2. Composición y distribución
3. Paleta de colores precisa
4. Mood/atmósfera
5. Detalles visuales clave
6. Elementos específicos (si los hay)
7. Técnica o medio (si aplica)
8. Iluminación y textura

Sé muy específico y detallado. Máximo 300 tokens."""
        else:
            refinement_prompt = f"""Basándote en este análisis visual:

{analysis_text}

{("Usuario sugiere: " + user_input) if user_input else ""}

Crea un prompt conciso pero específico para generar una imagen similar.
Máximo 150 tokens."""

        # Use Ollama for refinement
        try:
            response = self.ollama_client.generate(
                model=self.ollama_model,
                prompt=refinement_prompt,
                stream=False,
                options={
                    "temperature": 0.7 if deep_thinking else 0.5,
                    "top_p": 0.9,
                    "num_predict": 300 if deep_thinking else 150
                }
            )

            return response.get('response', '').strip()

        except Exception as e:
            logger.error(f"Error refining prompt with Ollama: {str(e)}")
            # Fallback: return formatted analysis
            return analysis_text

    def _format_analysis(self, analysis: Dict[str, list]) -> str:
        """Formats CLIP analysis into readable text"""
        formatted = "ANÁLISIS VISUAL:\n\n"

        for category, options in analysis.items():
            formatted += f"{category.upper().replace('_', ' ')}:\n"
            for item in options:
                confidence = int(item['score'] * 100)
                formatted += f"  • {item['value']} ({confidence}%)\n"
            formatted += "\n"

        return formatted
