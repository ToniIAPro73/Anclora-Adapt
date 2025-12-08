"""
Image Analyzer Service using Qwen3-VL via Ollama
Analyzes uploaded images and generates detailed prompts for image generation
Uses Qwen3-VL:8b for superior vision understanding
"""

import base64
import logging
import requests
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class ImageAnalyzer:
    """Analyzes images using Qwen3-VL and generates detailed prompts via Ollama"""

    def __init__(
        self,
        ollama_host: str = "http://localhost:11434",
        vision_model: str = "qwen3-vl:8b",
        refinement_model: str = "mistral:latest"
    ):
        """
        Initialize ImageAnalyzer with Qwen3-VL for vision analysis

        Args:
            ollama_host: Ollama server host
            vision_model: Ollama vision model to use for image analysis (e.g., qwen3-vl:8b)
            refinement_model: Ollama model to use for prompt refinement (e.g., mistral:latest)
        """
        try:
            self.ollama_host = ollama_host
            self.ollama_chat_url = f"{ollama_host}/api/chat"
            self.vision_model = vision_model
            self.refinement_model = refinement_model

            logger.info(f"ImageAnalyzer initialized with vision_model={vision_model}, refinement_model={refinement_model}")
            logger.info(f"Ollama host: {ollama_host}")

        except Exception as e:
            logger.error(f"Error initializing ImageAnalyzer: {str(e)}")
            raise

    def analyze_image(
        self,
        image_bytes: bytes,
        user_prompt: Optional[str] = None,
        deep_thinking: bool = False,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyzes image using Qwen3-VL and generates detailed prompt

        Args:
            image_bytes: Image file bytes
            user_prompt: Optional user input for prompt refinement
            deep_thinking: If True, generates more detailed analysis
            language: Output language code (e.g., 'es', 'en', 'fr'). Default: 'es'

        Returns:
            dict with generated prompt
        """
        try:
            if not language:
                language = "es"

            # Convert image bytes to base64
            base64_image = base64.b64encode(image_bytes).decode('utf-8')

            # Generate prompt using Qwen3-VL directly
            generated_prompt = self._generate_prompt_with_vision(
                base64_image=base64_image,
                user_input=user_prompt,
                deep_thinking=deep_thinking,
                language=language
            )

            return {
                "success": True,
                "generatedPrompt": generated_prompt,
                "analysis": {},  # No longer needed with Qwen3-VL
                "userInput": user_prompt or ""
            }

        except Exception as e:
            logger.error(f"Error analyzing image: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "generatedPrompt": user_prompt or ""
            }

    def _generate_prompt_with_vision(
        self,
        base64_image: str,
        user_input: Optional[str] = None,
        deep_thinking: bool = False,
        language: str = "es"
    ) -> str:
        """
        Generates prompt using Qwen3-VL vision model

        Args:
            base64_image: Image in base64 format
            user_input: Optional user input
            deep_thinking: If True, requests more detailed analysis
            language: Output language (es, en, fr, etc.)
        """
        try:
            # Build language-specific system message
            language_instructions = {
                "es": """Eres un experto en análisis de imágenes y creación de prompts detallados para generar imágenes similares.
Responde SIEMPRE en ESPAÑOL, sin excepción.
Analiza la imagen y crea un prompt detallado, específico y profesional que capture todos los elementos visuales importantes.
El prompt debe ser lo suficientemente detallado como para permitir a otro modelo de generación de imágenes crear una imagen muy similar.""",
                "en": """You are an expert in image analysis and detailed prompt creation for generating similar images.
Always respond in ENGLISH, without exception.
Analyze the image and create a detailed, specific, and professional prompt that captures all important visual elements.
The prompt should be detailed enough to allow another image generation model to create a very similar image.""",
                "fr": """Vous êtes un expert en analyse d'images et en création de prompts détaillés pour générer des images similaires.
Répondez TOUJOURS en FRANÇAIS, sans exception.
Analysez l'image et créez un prompt détaillé, spécifique et professionnel qui capture tous les éléments visuels importants.
Le prompt doit être suffisamment détaillé pour permettre à un autre modèle de génération d'images de créer une image très similaire.""",
                "de": """Sie sind ein Experte für Bildanalyse und detaillierte Prompt-Erstellung zum Generieren ähnlicher Bilder.
Antworten Sie IMMER auf DEUTSCH, ohne Ausnahme.
Analysieren Sie das Bild und erstellen Sie einen detaillierten, spezifischen und professionellen Prompt, der alle wichtigen visuellen Elemente erfasst.
Der Prompt sollte detailliert genug sein, damit ein anderes Bildgenerierungsmodell ein sehr ähnliches Bild erstellen kann.""",
                "it": """Sei un esperto nell'analisi di immagini e nella creazione di prompt dettagliati per generare immagini simili.
Rispondi SEMPRE in ITALIANO, senza eccezioni.
Analizza l'immagine e crea un prompt dettagliato, specifico e professionale che catturi tutti gli elementi visivi importanti.
Il prompt dovrebbe essere sufficientemente dettagliato da consentire a un altro modello di generazione di immagini di creare un'immagine molto simile.""",
                "pt": """Você é um especialista em análise de imagens e criação de prompts detalhados para gerar imagens similares.
Responda SEMPRE em PORTUGUÊS, sem exceção.
Analise a imagem e crie um prompt detalhado, específico e profissional que capture todos os elementos visuais importantes.
O prompt deve ser detalhado o suficiente para permitir que outro modelo de geração de imagens crie uma imagem muito similar.""",
                "ja": """あなたは画像分析と、同様の画像を生成するための詳細なプロンプト作成の専門家です。
常に日本語で応答してください。例外はありません。
画像を分析し、すべての重要な視覚要素をキャプチャする詳細で具体的かつプロフェッショナルなプロンプトを作成してください。
プロンプトは、別の画像生成モデルが非常に類似した画像を作成できるほど詳細である必要があります。""",
                "zh": """您是图像分析和详细提示创建的专家，用于生成相似的图像。
始终用中文回复，没有例外。
分析图像并创建一个详细、具体和专业的提示，捕捉所有重要的视觉元素。
提示应该足够详细，以便另一个图像生成模型可以创建非常相似的图像。""",
                "ar": """أنت خبير في تحليل الصور وإنشاء رموز مفصلة لتوليد صور مشابهة.
رد دائما باللغة العربية، بدون استثناء.
حلل الصورة وأنشئ رمزًا مفصلاً وحديًا واحترافيًا يعكس جميع العناصر البصرية المهمة.
يجب أن يكون الرمز مفصلاً بدرجة كافية للسماح لنموذج توليد صورة آخر بإنشاء صورة مشابهة جدًا."""
            }

            system_msg = language_instructions.get(language, language_instructions["es"])

            # Build user message based on detail level
            if deep_thinking:
                user_msg = f"""Analiza esta imagen en detalle y crea un prompt EXTREMADAMENTE DETALLADO y específico para generar una imagen idéntica.

{f'El usuario sugiere: {user_input}' if user_input else ''}

El prompt debe incluir:
- Estilo artístico exacto
- Tema y sujetos específicos
- Composición visual detallada
- Paleta de colores exacta
- Mood y atmósfera
- Iluminación específica
- Materiales y texturas
- Ambiente y contexto
- Técnica de rendering

Sé EXTREMADAMENTE específico y detallado."""
            else:
                user_msg = f"""Analiza esta imagen y crea un prompt DETALLADO y específico para generar una imagen muy similar.

{f'El usuario sugiere: {user_input}' if user_input else ''}

El prompt debe incluir todos los elementos visuales importantes:
- Estilo artístico
- Tema y sujetos
- Composición
- Colores
- Mood y atmósfera
- Iluminación
- Ambiente

Sé específico pero conciso."""

            # Call Ollama Qwen3-VL
            payload = {
                "model": self.vision_model,
                "messages": [
                    {"role": "system", "content": system_msg},
                    {
                        "role": "user",
                        "content": user_msg,
                        "images": [base64_image]
                    }
                ],
                "stream": False,
                "options": {
                    "temperature": 0.7 if deep_thinking else 0.5,
                    "top_p": 0.9,
                    "num_predict": 1500 if deep_thinking else 800
                }
            }

            logger.info(f"Calling Qwen3-VL at {self.ollama_chat_url} with language={language}")

            response = requests.post(self.ollama_chat_url, json=payload, timeout=120)
            response.raise_for_status()

            response_data = response.json()

            if "message" not in response_data:
                raise ValueError(f"Unexpected response format: {response_data}")

            prompt_text = response_data.get("message", {}).get("content", "").strip()

            if not prompt_text:
                logger.warning("Empty response from Qwen3-VL, using user input")
                return user_input or "detailed image prompt"

            return prompt_text

        except requests.exceptions.Timeout:
            logger.error("Qwen3-VL request timed out")
            return user_input or "Image analysis timed out"
        except Exception as e:
            logger.error(f"Error generating prompt with Qwen3-VL: {str(e)}")
            return user_input or "Error analyzing image"
