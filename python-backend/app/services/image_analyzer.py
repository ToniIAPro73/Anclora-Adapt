"""
Image Analyzer Service using Qwen3-VL via Ollama
Analyzes uploaded images and generates detailed prompts for image generation
Uses Qwen3-VL:8b for superior vision understanding
Includes caching, fallback models, and security validation
"""

import base64
import logging
import requests
import time
from typing import Optional, Dict, Any
from pathlib import Path

from app.models.image_context import ImageContext, AnalysisMetadata, ImageAnalysisResponse
from app.services.image_cache import ImageAnalysisCache
from app.services.model_fallback import ModelFallbackManager, ImageSecurityValidator

logger = logging.getLogger(__name__)


class ImageAnalyzer:
    """Analyzes images using Qwen3-VL and generates detailed prompts via Ollama"""

    def __init__(
        self,
        ollama_host: str = "http://localhost:11434",
        vision_model: str = "Llava:latest",
        refinement_model: str = "mistral:latest",
        enable_cache: bool = True,
        cache_dir: Optional[Path] = None
    ):
        """
        Initialize ImageAnalyzer with Qwen3-VL for vision analysis

        Args:
            ollama_host: Ollama server host
            vision_model: Ollama vision model to use for image analysis (e.g., qwen3-vl:8b)
            refinement_model: Ollama model to use for prompt refinement (e.g., mistral:latest)
            enable_cache: Enable caching of analysis results
            cache_dir: Directory for cache storage
        """
        try:
            self.ollama_host = ollama_host
            self.ollama_chat_url = f"{ollama_host}/api/chat"
            self.vision_model = vision_model
            self.refinement_model = refinement_model

            # Initialize cache
            self.cache = ImageAnalysisCache(cache_dir) if enable_cache else None

            # Initialize fallback manager
            self.fallback_manager = ModelFallbackManager(ollama_host)

            # Security validator
            self.security_validator = ImageSecurityValidator()

            logger.info(f"ImageAnalyzer initialized with vision_model={vision_model}, refinement_model={refinement_model}")
            logger.info(f"Ollama host: {ollama_host}")
            logger.info(f"Cache enabled: {enable_cache}")

        except Exception as e:
            logger.error(f"Error initializing ImageAnalyzer: {str(e)}")
            raise

    def analyze_image(
        self,
        image_bytes: bytes,
        content_type: Optional[str] = None,
        user_prompt: Optional[str] = None,
        deep_thinking: bool = False,
        language: Optional[str] = None
    ) -> ImageAnalysisResponse:
        """
        Analyzes image using Qwen3-VL and generates detailed prompt
        Includes security validation, caching, and fallback models

        Args:
            image_bytes: Image file bytes
            content_type: MIME type of the image
            user_prompt: Optional user input for prompt refinement
            deep_thinking: If True, generates more detailed analysis
            language: Output language code (e.g., 'es', 'en', 'fr'). Default: 'es'

        Returns:
            ImageAnalysisResponse with complete analysis or error
        """
        start_time = time.time()

        try:
            if not language:
                language = "es"

            # 1. SECURITY VALIDATION
            is_valid, error_msg = self.security_validator.validate_upload(image_bytes, content_type or "image/jpeg")
            if not is_valid:
                logger.warning(f"Security validation failed: {error_msg}")
                return ImageAnalysisResponse(
                    success=False,
                    error=error_msg,
                    metadata=AnalysisMetadata(
                        model_used="none",
                        language=language,
                        deep_thinking=deep_thinking,
                        processing_time_seconds=time.time() - start_time,
                        confidence_score=0
                    )
                )

            # 2. CHECK CACHE
            if self.cache:
                cached_result = self.cache.get(image_bytes)
                if cached_result:
                    context, metadata = cached_result
                    processing_time = time.time() - start_time

                    return ImageAnalysisResponse(
                        success=True,
                        image_context=context,
                        metadata=AnalysisMetadata(
                            model_used=metadata.model_used,
                            language=metadata.language,
                            deep_thinking=metadata.deep_thinking,
                            processing_time_seconds=processing_time,
                            confidence_score=1.0
                        ),
                        user_input=user_prompt,
                        cached=True
                    )

            # 3. CONVERT TO BASE64
            base64_image = base64.b64encode(image_bytes).decode("utf-8")

            # 4. GENERATE ANALYSIS WITH FALLBACK
            generated_prompt, model_used, is_fallback = self.fallback_manager.analyze_with_fallback(
                base64_image=base64_image,
                user_prompt=user_prompt,
                primary_model=self.vision_model,
                language=language,
                deep_thinking=deep_thinking,
            )

            # 5. BUILD IMAGE CONTEXT (Extended schema)
            image_context = self._build_extended_context(
                generated_prompt=generated_prompt,
                user_prompt=user_prompt,
                language=language,
                deep_thinking=deep_thinking
            )

            # 6. CACHE RESULT
            processing_time = time.time() - start_time
            metadata = AnalysisMetadata(
                model_used=model_used,
                language=language,
                deep_thinking=deep_thinking,
                processing_time_seconds=processing_time,
                confidence_score=0.8 if is_fallback else 1.0,
                model_fallback_used=is_fallback
            )

            if self.cache:
                self.cache.set(image_bytes, image_context, metadata)

            return ImageAnalysisResponse(
                success=True,
                image_context=image_context,
                metadata=metadata,
                user_input=user_prompt,
                cached=False
            )

        except Exception as e:
            logger.error(f"Error analyzing image: {str(e)}", exc_info=True)
            processing_time = time.time() - start_time

            return ImageAnalysisResponse(
                success=False,
                error=str(e),
                metadata=AnalysisMetadata(
                    model_used="error",
                    language=language or "es",
                    deep_thinking=deep_thinking,
                    processing_time_seconds=processing_time,
                    confidence_score=0
                )
            )

    def _build_extended_context(
        self,
        generated_prompt: str,
        user_prompt: Optional[str] = None,
        language: str = "es",
        deep_thinking: bool = False
    ) -> ImageContext:
        """
        Build extended ImageContext from generated prompt
        Parses and structures the analysis into detailed fields
        """
        # Extract key elements from the generated prompt
        # This is a basic implementation - can be enhanced with NLP
        lines = generated_prompt.split('\n')

        return ImageContext(
            brief_caption=lines[0] if lines else "Image analysis",
            detailed_description=generated_prompt,
            objects=[],  # Could parse from prompt
            people=[],   # Could parse from prompt
            setting="Scene setting to be determined from image context",
            mood="Mood/atmosphere to be analyzed",
            style="Visual style to be identified",
            colors=[],   # Could parse from prompt
            text_in_image="",
            composition="Composition analysis pending",
            lighting="Lighting analysis pending",
            technical_details={},
            palette_hex=[],
            semantic_tags=["analyzed", "vision-model"],
            generative_prompt=generated_prompt,
            adapted_prompts={
                "campaign": self._adapt_prompt_for_mode(generated_prompt, "campaign"),
                "recycle": self._adapt_prompt_for_mode(generated_prompt, "recycle"),
                "intelligent": self._adapt_prompt_for_mode(generated_prompt, "intelligent"),
                "basic": self._adapt_prompt_for_mode(generated_prompt, "basic")
            }
        )

    def _adapt_prompt_for_mode(self, base_prompt: str, mode: str) -> str:
        """
        Adapt prompt for specific application mode

        Args:
            base_prompt: Original generated prompt
            mode: Target mode (campaign, recycle, intelligent, basic)

        Returns:
            Adapted prompt for the mode
        """
        mode_instructions = {
            "campaign": "Adapt this for marketing/campaign use: Focus on brand appeal and commercial viability.",
            "recycle": "Adapt this for content recycling: Make it concise and reusable across platforms.",
            "intelligent": "Adapt this for intelligent analysis: Include semantic depth and contextual layers.",
            "basic": "Adapt this for basic usage: Simplify while maintaining visual integrity."
        }

        instruction = mode_instructions.get(mode, "")
        if instruction:
            return f"{base_prompt}\n\n[{mode.upper()} MODE]: {instruction}"
        return base_prompt

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
Tu tarea es analizar CUIDADOSAMENTE cada elemento visual de la imagen y crear un prompt extremadamente detallado.
El prompt debe capturar todos los aspectos visuales específicos: sujetos exactos, estilos, colores, composición, iluminación, atmósfera, texturas, materiales, fondos y ambiente.""",
                "en": """You are an expert in image analysis and detailed prompt creation for generating similar images.
Always respond in ENGLISH, without exception.
Your task is to analyze CAREFULLY each visual element in the image and create an extremely detailed prompt.
The prompt must capture all specific visual aspects: exact subjects, styles, colors, composition, lighting, atmosphere, textures, materials, backgrounds and environment.""",
                "fr": """Vous êtes un expert en analyse d'images et en création de prompts détaillés pour générer des images similaires.
Répondez TOUJOURS en FRANÇAIS, sans exception.
Votre tâche est d'analyser ATTENTIVEMENT chaque élément visuel de l'image et de créer un prompt extrêmement détaillé.
Le prompt doit capturer tous les aspects visuels spécifiques: sujets exacts, styles, couleurs, composition, éclairage, atmosphère, textures, matériaux, arrière-plans et environnement.""",
                "de": """Sie sind ein Experte für Bildanalyse und detaillierte Prompt-Erstellung zum Generieren ähnlicher Bilder.
Antworten Sie IMMER auf DEUTSCH, ohne Ausnahme.
Ihre Aufgabe ist es, jedes visuelle Element im Bild SORGFÄLTIG zu analysieren und einen äußerst detaillierten Prompt zu erstellen.
Der Prompt muss alle spezifischen visuellen Aspekte erfassen: genaue Themen, Stile, Farben, Komposition, Beleuchtung, Atmosphäre, Texturen, Materialien, Hintergründe und Umgebung.""",
                "it": """Sei un esperto nell'analisi di immagini e nella creazione di prompt dettagliati per generare immagini simili.
Rispondi SEMPRE in ITALIANO, senza eccezioni.
Il tuo compito è analizzare ATTENTAMENTE ogni elemento visivo dell'immagine e creare un prompt estremamente dettagliato.
Il prompt deve catturare tutti gli aspetti visivi specifici: soggetti esatti, stili, colori, composizione, illuminazione, atmosfera, texture, materiali, sfondi e ambiente.""",
                "pt": """Você é um especialista em análise de imagens e criação de prompts detalhados para gerar imagens similares.
Responda SEMPRE em PORTUGUÊS, sem exceção.
Sua tarefa é analisar CUIDADOSAMENTE cada elemento visual da imagem e criar um prompt extremamente detalhado.
O prompt deve capturar todos os aspectos visuais específicos: temas exatos, estilos, cores, composição, iluminação, atmosfera, texturas, materiais, fundos e ambiente.""",
                "ja": """あなたは画像分析と、同様の画像を生成するための詳細なプロンプト作成の専門家です。
常に日本語で応答してください。例外はありません。
あなたのタスクは、画像の各視覚要素を注意深く分析し、非常に詳細なプロンプトを作成することです。
プロンプトは、すべての具体的な視覚的側面を捉える必要があります：正確な被写体、スタイル、色、構成、照明、雰囲気、テクスチャ、材料、背景と環境。""",
                "zh": """您是图像分析和详细提示创建的专家，用于生成相似的图像。
始终用中文回复，没有例外。
您的任务是仔细分析图像中的每个视觉元素，并创建一个极其详细的提示。
提示必须捕捉所有特定的视觉方面：确切的对象、风格、颜色、构图、照明、气氛、纹理、材料、背景和环境。""",
                "ar": """أنت خبير في تحليل الصور وإنشاء رموز مفصلة لتوليد صور مشابهة.
رد دائما باللغة العربية، بدون استثناء.
مهمتك هي تحليل كل عنصر بصري في الصورة بعناية وإنشاء رمز مفصل للغاية.
يجب أن يعكس الرمز جميع الجوانب البصرية المحددة: الموضوعات الدقيقة والأنماط والألوان والتكوين والإضاءة والأجواء والملمس والمواد والخلفيات والبيئة."""
            }

            system_msg = language_instructions.get(language, language_instructions["es"])

            # Build user message with two-stage approach: first analyze, then create prompt
            if deep_thinking:
                user_msg = f"""Sigue estos pasos EXACTAMENTE:

PASO 1: Describe exhaustivamente TODOS los elementos visuales que ves en la imagen:
- Objetos principales y secundarios
- Colores específicos y gradientes
- Estilos artísticos y técnicas
- Composición y perspectiva
- Iluminación y sombras
- Texturas y materiales
- Atmósfera y mood
- Fondos y ambiente
- Perspectiva y profundidad

PASO 2: Basándote en tu análisis, crea un PROMPT EXTREMADAMENTE DETALLADO para generar una imagen idéntica.

{f'El usuario sugiere que incluyas: {user_input}' if user_input else ''}

El prompt final debe ser muy extenso (mínimo 300 palabras), extremadamente específico y listo para usar en un generador de imágenes profesional.
NO resumas ni simplifiques - SÉ EXHAUSTIVO en todos los detalles."""
            else:
                user_msg = f"""Sigue estos pasos EXACTAMENTE:

PASO 1: Identifica y describe los elementos visuales clave en la imagen:
- Sujetos principales
- Colores dominantes
- Estilo artístico
- Composición
- Iluminación principal
- Atmósfera
- Ambiente/contexto

PASO 2: Crea un PROMPT DETALLADO basado en tu análisis para generar una imagen similar.

{f'El usuario sugiere que incluyas: {user_input}' if user_input else ''}

El prompt debe ser completo, específico y suficientemente detallado para un generador de imágenes profesional."""

            # Log image data size for debugging
            logger.info(f"Image data size: {len(base64_image)} characters ({len(base64_image) / 1024:.1f} KB)")
            logger.info(f"Calling Qwen3-VL at {self.ollama_chat_url} with language={language}, deep_thinking={deep_thinking}")

            # Call Ollama Qwen3-VL with improved payload
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
                    "num_predict": 2000 if deep_thinking else 1000
                }
            }

            logger.debug(f"Payload structure: model={payload['model']}, num_messages={len(payload['messages'])}, has_image={bool(payload['messages'][1].get('images'))}")

            response = requests.post(self.ollama_chat_url, json=payload, timeout=120)
            response.raise_for_status()

            response_data = response.json()
            logger.debug(f"Response received: status={response.status_code}, has_message={('message' in response_data)}")

            if "message" not in response_data:
                logger.error(f"Unexpected response format: {response_data}")
                raise ValueError(f"Unexpected response format: {response_data}")

            prompt_text = response_data.get("message", {}).get("content", "").strip()

            if not prompt_text:
                logger.warning("Empty response from Qwen3-VL, using user input as fallback")
                return user_input or "detailed image prompt"

            logger.info(f"Generated prompt length: {len(prompt_text)} characters")
            return prompt_text

        except requests.exceptions.Timeout:
            logger.error("Qwen3-VL request timed out after 120 seconds")
            return user_input or "Image analysis timed out"
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error to Ollama at {self.ollama_chat_url}: {str(e)}")
            return user_input or "Cannot connect to image analyzer"
        except Exception as e:
            logger.error(f"Error generating prompt with Qwen3-VL: {str(e)}", exc_info=True)
            return user_input or "Error analyzing image"
