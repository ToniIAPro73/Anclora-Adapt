"""
Fallback models for image analysis
Provides graceful degradation when primary model is unavailable
Supports: Qwen3-VL -> LLaVA -> CLIP Interrogator
"""

import base64
import logging
import requests
from typing import Optional, Tuple

from app.config import OLLAMA_BASE_URL

logger = logging.getLogger(__name__)


class ModelFallbackManager:
    """Manages fallback chain for vision models"""

    def __init__(self, ollama_host: Optional[str] = None):
        """
        Initialize fallback manager

        Args:
            ollama_host: Ollama server host
        """
        base_host = (ollama_host or OLLAMA_BASE_URL).rstrip("/")
        self.ollama_host = base_host
        self.ollama_chat_url = f"{base_host}/api/chat"
        self.ollama_tags_url = f"{base_host}/api/tags"
        self._available_models = None

    def get_available_vision_models(self) -> list:
        """
        Get list of available vision models from Ollama

        Returns:
            List of available model names
        """
        if self._available_models is not None:
            return self._available_models

        try:
            response = requests.get(self.ollama_tags_url, timeout=5)
            response.raise_for_status()
            data = response.json()

            models = data.get("models", [])
            vision_models = [
                m["name"] for m in models
                if any(x in m["name"].lower() for x in ["qwen", "llava", "llama-vision"])
            ]

            self._available_models = vision_models
            logger.info(f"Found {len(vision_models)} available vision models: {vision_models}")
            return vision_models

        except Exception as e:
            logger.warning(f"Could not fetch available models: {e}")
            return []

    def select_fallback_model(self, primary: str = "qwen3-vl:8b") -> Tuple[str, bool]:
        """
        Select the best available fallback model

        Args:
            primary: Primary model to try first

        Returns:
            Tuple of (model_name, is_fallback)
        """
        available = self.get_available_vision_models()

        # Try primary first
        if primary in available:
            logger.info(f"Using primary model: {primary}")
            return primary, False

        # Fallback order: Llava first (faster) then Qwen2.5 models, then Llama2-vision
        fallback_order = [
            "Llava:latest",
            "llava:latest",
            "llava:13b",
            "llava-phi",
            "qwen3-vl:8b",
            "qwen2.5:14b",
            "qwen2.5:7b",
            "llama2-vision"
        ]

        for fallback in fallback_order:
            if fallback in available:
                logger.warning(f"Primary model {primary} not available, using fallback: {fallback}")
                return fallback, True

        logger.error(f"No vision models available. Available: {available}")
        return None, True

    def analyze_with_fallback(
        self,
        base64_image: str,
        user_prompt: Optional[str] = None,
        primary_model: str = "qwen3-vl:8b",
        language: str = "es",
        deep_thinking: bool = False
    ) -> Tuple[str, str, bool]:
        """
        Analyze image with automatic fallback

        Args:
            base64_image: Base64 encoded image
            user_prompt: Optional user input
            primary_model: Primary model to use
            language: Output language

        Returns:
            Tuple of (prompt_text, model_used, is_fallback)
        """
        # Select model with fallback
        selected_model, is_fallback = self.select_fallback_model(primary_model)

        if selected_model is None:
            logger.error("No vision models available for fallback")
            raise RuntimeError(
                "Image analysis unavailable with current backend or models. "
                "Please ensure LLaVA/qwen3-vl is running on Ollama and retry."
            )

        # Try to analyze with selected model
        try:
            logger.info(f"Calling _call_vision_model with model={selected_model}, language={language}")
            prompt = self._call_vision_model(
                selected_model,
                base64_image,
                user_prompt,
                language,
                deep_thinking
            )
            logger.info(f"Success! Generated prompt length: {len(prompt)}")
            return prompt, selected_model, is_fallback

        except Exception as e:
            logger.error(f"Error with {selected_model}: {e}", exc_info=True)

            # Try next fallback
            if is_fallback:
                # Already on fallback, no more options
                logger.error("All vision models failed")
                raise RuntimeError(
                    "Image analysis failed after trying available vision models"
                ) from e

            # Try manual CLIP fallback
            try:
                logger.info("Attempting CLIP Interrogator fallback...")
                prompt = self._clip_interrogator_fallback(base64_image)
                return prompt, "clip-interrogator", True
            except Exception as clip_error:
                logger.error(f"CLIP fallback also failed: {clip_error}")
                raise RuntimeError(
                    "Image analysis unavailable; install a vision model (llava/qwen3-vl) "
                    "or enable CLIP Interrogator."
                ) from clip_error

    def _call_vision_model(
        self,
        model: str,
        base64_image: str,
        user_prompt: Optional[str] = None,
        language: str = "es",
        deep_thinking: bool = False
    ) -> str:
        """Call vision model via Ollama"""
        system_message = self._get_system_message(language, deep_thinking)
        user_instructions = (
            "Describe every relevant visual element with precise detail. "
            "Return a single, cohesive prompt optimized for image generation "
            "covering subjects, setting, composition, lighting, camera/lens style, "
            "textures, mood, and color palette."
        )

        if user_prompt:
            user_instructions = (
                f"{user_instructions}\nUsuario: {user_prompt.strip()}"
            )

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_message},
                {
                    "role": "user",
                    "content": user_instructions,
                    "images": [base64_image],
                },
            ],
            "stream": False,
            "options": {
                "temperature": 0.6 if deep_thinking else 0.4,
                "top_p": 0.9,
                "num_predict": 2048 if deep_thinking else 1024,
            },
        }

        try:
            response = requests.post(
                self.ollama_chat_url,
                json=payload,
                timeout=300,
            )
            response.raise_for_status()
        except Exception as http_error:
            logger.error(
                "Vision model request failed for %s: %s",
                model,
                http_error,
                exc_info=True,
            )
            raise

        data = response.json()
        prompt_text = data.get("message", {}).get("content")

        if not prompt_text:
            raise ValueError("Vision model returned empty content")

        return prompt_text

    def _clip_interrogator_fallback(self, base64_image: str) -> str:
        """
        Fallback to CLIP Interrogator (lightweight alternative)

        This requires PIL and clip-interrogator to be installed
        """
        try:
            from PIL import Image
            from io import BytesIO
            from clip_interrogator import Config, Interrogator

            # Decode image
            image_bytes = bytes.fromhex(base64_image) if base64_image.startswith('0x') else \
                          base64.b64decode(base64_image)
            image = Image.open(BytesIO(image_bytes)).convert("RGB")

            # Run CLIP interrogation
            cfg = Config(clip_model_name="ViT-L-14/openai")
            interrogator = Interrogator(cfg)
            prompt = interrogator.interrogate(image)

            logger.info("CLIP Interrogator analysis successful")
            return prompt

        except ImportError:
            logger.warning("CLIP Interrogator not installed")
            raise Exception("CLIP Interrogator not available")
        except Exception as e:
            logger.error(f"CLIP Interrogator error: {e}")
            raise

    @staticmethod
    def _get_system_message(language: str = "es", deep_thinking: bool = False) -> str:
        """Get language-specific system message"""
        messages = {
            "es": "Eres un experto senior en análisis de imágenes. Devuelve un único prompt en inglés listo para modelos generativos que incluya sujeto, entorno, composición, iluminación, óptica/cámara, estilo visual, texturas y paleta. Usa pensamiento profundo para cubrir matices y relaciones entre elementos." if deep_thinking else "Eres un experto en análisis de imágenes. Devuelve un prompt en inglés que resuma con claridad sujeto, contexto, iluminación y estilo para recrear la escena.",
            "en": "You are a senior image analysis expert. Return a single English prompt ready for generative models covering subject, environment, composition, lighting, camera/lens, visual style, textures, and palette. Use deep reasoning to capture subtle relationships." if deep_thinking else "You are an expert in image analysis. Provide an English prompt summarizing subject, context, lighting, and style to recreate the scene.",
            "fr": "Vous êtes un expert en analyse d'images. Renvoyez un prompt anglais unique prêt pour la génération, couvrant sujet, décor, composition, éclairage, optique, style et palette." if not deep_thinking else "Vous êtes un expert senior en analyse d'images. Créez un prompt unique en anglais pour la génération incluant sujet, environnement, composition, éclairage, optique/caméra, style visuel, textures et palette, avec un raisonnement approfondi.",
            "de": "Sie sind Experte für Bildanalyse. Geben Sie einen einzigen englischen Prompt zurück, der Motiv, Umgebung, Komposition, Beleuchtung, Optik, Stil und Palette abdeckt." if not deep_thinking else "Sie sind ein Senior-Experte für Bildanalyse. Erstellen Sie einen einzigen englischen Prompt für Generatormodelle mit Motiv, Umgebung, Komposition, Licht, Kamera/Objektiv, Stil, Texturen und Palette und nutzen Sie tiefes Nachdenken.",
        }
        return messages.get(language, messages["es"])


class ImageSecurityValidator:
    """Validates uploaded images for security and compliance"""

    # Allowed MIME types
    ALLOWED_MIME_TYPES = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/bmp",
        "image/tiff"
    }

    # Maximum file sizes
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    MIN_FILE_SIZE = 100  # 100 bytes

    @staticmethod
    def validate_mime_type(content_type: str) -> bool:
        """Validate MIME type"""
        if not content_type:
            return False
        return content_type in ImageSecurityValidator.ALLOWED_MIME_TYPES

    @staticmethod
    def validate_file_size(file_size: int) -> bool:
        """Validate file size"""
        return ImageSecurityValidator.MIN_FILE_SIZE <= file_size <= ImageSecurityValidator.MAX_FILE_SIZE

    @staticmethod
    def validate_image_format(image_bytes: bytes) -> bool:
        """
        Validate that file is actually a valid image
        Checks magic bytes (file signatures)
        """
        if len(image_bytes) < 4:
            return False

        # Common image magic bytes
        magic_bytes = [
            b'\xFF\xD8\xFF',  # JPEG
            b'\x89\x50\x4E\x47',  # PNG
            b'\x52\x49\x46\x46',  # RIFF (WEBP, etc)
            b'\x47\x49\x46\x38',  # GIF
            b'\x42\x4D',  # BMP
            b'\x49\x49\x2A\x00',  # TIFF (little-endian)
            b'\x4D\x4D\x00\x2A',  # TIFF (big-endian)
        ]

        for magic in magic_bytes:
            if image_bytes.startswith(magic):
                return True

        return False

    @classmethod
    def validate_upload(cls, file_bytes: bytes, content_type: str) -> Tuple[bool, str]:
        """
        Complete validation of uploaded image

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check MIME type
        if not cls.validate_mime_type(content_type):
            return False, f"Invalid MIME type: {content_type}"

        # Check file size
        if not cls.validate_file_size(len(file_bytes)):
            return False, f"File size invalid. Must be {cls.MIN_FILE_SIZE}B to {cls.MAX_FILE_SIZE//1024//1024}MB"

        # Check actual file format
        if not cls.validate_image_format(file_bytes):
            return False, "File is not a valid image format"

        return True, ""


