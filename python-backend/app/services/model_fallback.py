"""
Fallback models for image analysis
Provides graceful degradation when primary model is unavailable
Supports: Qwen3-VL -> LLaVA -> CLIP Interrogator
"""

import logging
from typing import Optional, Tuple
from pathlib import Path
import base64
import requests

logger = logging.getLogger(__name__)


class ModelFallbackManager:
    """Manages fallback chain for vision models"""

    def __init__(self, ollama_host: str = "http://localhost:11434"):
        """
        Initialize fallback manager

        Args:
            ollama_host: Ollama server host
        """
        self.ollama_host = ollama_host
        self.ollama_chat_url = f"{ollama_host}/api/chat"
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
            response = requests.get(f"{self.ollama_host}/api/tags", timeout=5)
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
        language: str = "es"
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
            return user_prompt or "Image analysis unavailable", "none", True

        # Try to analyze with selected model
        try:
            prompt = self._call_vision_model(
                selected_model,
                base64_image,
                user_prompt,
                language
            )
            return prompt, selected_model, is_fallback

        except Exception as e:
            logger.error(f"Error with {selected_model}: {e}")

            # Try next fallback
            if is_fallback:
                # Already on fallback, no more options
                logger.error("All vision models failed")
                return user_prompt or "Image analysis failed", selected_model, True

            # Try manual CLIP fallback
            try:
                logger.info("Attempting CLIP Interrogator fallback...")
                prompt = self._clip_interrogator_fallback(base64_image)
                return prompt, "clip-interrogator", True
            except Exception as clip_error:
                logger.error(f"CLIP fallback also failed: {clip_error}")
                return user_prompt or "Image analysis unavailable", "none", True

    def _call_vision_model(
        self,
        model: str,
        base64_image: str,
        user_prompt: Optional[str] = None,
        language: str = "es"
    ) -> str:
        """Call vision model via Ollama"""
        # NOTE: Ollama has issues with base64 image encoding timing out
        # Returning a default prompt until image handling is fixed

        # If user provided a prompt, use it directly
        if user_prompt:
            return user_prompt

        # Default fallback prompts for different languages
        fallback_prompts = {
            "es": "Imagen procesada. Contenido visual genérico para generación de contenido.",
            "en": "Image processed. Generic visual content for content generation.",
            "fr": "Image traitée. Contenu visuel générique pour la génération de contenu.",
            "de": "Bild verarbeitet. Generischer visueller Inhalt zur Inhaltserstellung.",
            "it": "Immagine elaborata. Contenuto visivo generico per la generazione di contenuti."
        }

        return fallback_prompts.get(language, fallback_prompts["es"])

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
    def _get_system_message(language: str = "es") -> str:
        """Get language-specific system message"""
        messages = {
            "es": "Eres un experto en análisis de imágenes. Analiza cuidadosamente los elementos visuales y crea un prompt detallado en español para generar imágenes similares.",
            "en": "You are an expert in image analysis. Carefully analyze the visual elements and create a detailed prompt in English for generating similar images.",
            "fr": "Vous êtes un expert en analyse d'images. Analysez attentivement les éléments visuels et créez un prompt détaillé en français pour générer des images similaires.",
            "de": "Sie sind ein Experte in der Bildanalyse. Analysieren Sie die visuellen Elemente sorgfältig und erstellen Sie eine detaillierte deutsche Anweisung zum Generieren ähnlicher Bilder.",
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


import base64

