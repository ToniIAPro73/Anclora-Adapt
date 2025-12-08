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
        deep_thinking: bool = False,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyzes image using CLIP and generates improved prompt

        Args:
            image_bytes: Image file bytes
            user_prompt: Optional user input for prompt refinement
            deep_thinking: If True, generates more detailed analysis
            language: Output language code (e.g., 'es', 'en', 'fr'). Default: 'es'

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
                deep_thinking=deep_thinking,
                language=language
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
        deep_thinking: bool = False,
        language: Optional[str] = None
    ) -> str:
        """
        Generates improved prompt based on visual analysis
        Uses Ollama for refinement with CHAT endpoint for language support

        Args:
            visual_analysis: CLIP analysis results
            user_input: Optional user input for refinement
            deep_thinking: If True, generates more detailed analysis
            language: Output language code (e.g., 'es', 'en', 'fr'). Default: 'es'
        """
        # Default to Spanish if not specified
        if not language:
            language = "es"
        # Format analysis as text
        analysis_text = self._format_analysis(visual_analysis)

        # Build refinement prompt - support multiple languages
        refinement_templates = {
            "es": {
                "deep": """Analiza este análisis visual detallado de una imagen:

{analysis}

{user_hint}

Crea un prompt EXTREMADAMENTE DETALLADO y ESTRUCTURADO para generar una imagen similar. El prompt debe incluir:

1. **Estilo artístico específico**: Describe el estilo visual, movimiento artístico, o referencia artística (ej: oil painting, digital art, photorealism, etc)
2. **Tema y sujetos principales**: Identifica qué o quién es el sujeto principal y contexto de la imagen
3. **Composición visual**: Describe la distribución espacial, punto focal, perspectiva y balance
4. **Paleta de colores**: Lista colores específicos, dominantes, de acentos y matices. Describe las transiciones de color
5. **Mood y atmósfera**: Describe la emoción, energía y atmósfera que transmite la imagen
6. **Iluminación**: Tipo de iluminación, dirección, intensidad, calidad de luz, sombras y reflejos
7. **Detalles visuales clave**: Texturas, patrones, acabados, detalles pequeños importantes
8. **Elementos ambientales**: Fondos, entorno, accesorios, elementos decorativos
9. **Técnica y medio**: Técnica de rendering, material, acabado (oil, acrylic, digital, photograph, mixed media, etc)
10. **Proporciones y escala**: Dimensiones, tamaño relativo de elementos, perspectiva

Sé EXTREMADAMENTE ESPECÍFICO y DETALLADO en cada punto.""",
                "standard": """Analiza este análisis visual detallado de una imagen:

{analysis}

{user_hint}

Crea un prompt DETALLADO y BIEN ESTRUCTURADO para generar una imagen similar. El prompt debe incluir:

1. **Estilo artístico**: El estilo visual y técnica de la obra
2. **Sujeto y tema**: Qué se ve, tema principal y contexto
3. **Composición**: Distribución, punto focal, perspectiva
4. **Paleta de colores**: Colores dominantes, acentos y descripción de tonos
5. **Mood y atmósfera**: La emoción y atmósfera transmitida
6. **Iluminación**: Tipo, dirección e intensidad de la luz
7. **Detalles visuales**: Texturas, patrones y detalles importantes
8. **Ambiente**: Fondo, entorno y elementos contextuales
9. **Técnica**: Técnica de renderizado o medio artístico

Sé ESPECÍFICO y DETALLADO."""
            },
            "en": {
                "deep": """Analyze this detailed visual analysis of an image:

{analysis}

{user_hint}

Create an EXTREMELY DETAILED and STRUCTURED prompt for generating a similar image. The prompt must include:

1. **Specific artistic style**: Describe the visual style, artistic movement, or artistic reference (e.g., oil painting, digital art, photorealism, etc)
2. **Main theme and subjects**: Identify what or who is the main subject and context of the image
3. **Visual composition**: Describe spatial distribution, focal point, perspective and balance
4. **Color palette**: List specific, dominant, accent and nuance colors. Describe color transitions
5. **Mood and atmosphere**: Describe the emotion, energy and atmosphere conveyed by the image
6. **Lighting**: Type of lighting, direction, intensity, light quality, shadows and reflections
7. **Key visual details**: Textures, patterns, finishes, important small details
8. **Environmental elements**: Backgrounds, surroundings, accessories, decorative elements
9. **Technique and medium**: Rendering technique, material, finish (oil, acrylic, digital, photograph, mixed media, etc)
10. **Proportions and scale**: Dimensions, relative size of elements, perspective

Be EXTREMELY SPECIFIC and DETAILED on each point.""",
                "standard": """Analyze this detailed visual analysis of an image:

{analysis}

{user_hint}

Create a DETAILED and WELL-STRUCTURED prompt for generating a similar image. The prompt must include:

1. **Artistic style**: The visual style and technique of the work
2. **Subject and theme**: What is seen, main theme and context
3. **Composition**: Distribution, focal point, perspective
4. **Color palette**: Dominant colors, accents and tone description
5. **Mood and atmosphere**: The emotion and atmosphere conveyed
6. **Lighting**: Type, direction and intensity of light
7. **Visual details**: Textures, patterns and important details
8. **Environment**: Background, surroundings and contextual elements
9. **Technique**: Rendering technique or artistic medium

Be SPECIFIC and DETAILED."""
            },
            "fr": {
                "deep": """Analysez cette analyse visuelle détaillée d'une image:

{analysis}

{user_hint}

Créez un prompt EXTRÊMEMENT DÉTAILLÉ et STRUCTURÉ pour générer une image similaire. Le prompt doit inclure:

1. **Style artistique spécifique**: Décrivez le style visuel, le mouvement artistique ou la référence artistique (par ex: peinture à l'huile, art numérique, photorealisme, etc)
2. **Thème et sujets principaux**: Identifiez le sujet principal et le contexte de l'image
3. **Composition visuelle**: Décrivez la distribution spatiale, le point focal, la perspective et l'équilibre
4. **Palette de couleurs**: Énumérez les couleurs spécifiques, dominantes, d'accent et de nuance. Décrivez les transitions de couleur
5. **Humeur et atmosphère**: Décrivez l'émotion, l'énergie et l'atmosphère transmises par l'image
6. **Éclairage**: Type d'éclairage, direction, intensité, qualité de la lumière, ombres et reflets
7. **Détails visuels clés**: Textures, motifs, finitions, détails petits mais importants
8. **Éléments environnementaux**: Arrière-plans, environnement, accessoires, éléments décoratifs
9. **Technique et médium**: Technique de rendu, matériau, finition (huile, acrylique, numérique, photographie, techniques mixtes, etc)
10. **Proportions et échelle**: Dimensions, taille relative des éléments, perspective

Soyez EXTRÊMEMENT SPÉCIFIQUE et DÉTAILLÉ sur chaque point.""",
                "standard": """Analysez cette analyse visuelle détaillée d'une image:

{analysis}

{user_hint}

Créez un prompt DÉTAILLÉ et BIEN STRUCTURÉ pour générer une image similaire. Le prompt doit inclure:

1. **Style artistique**: Le style visuel et la technique de l'œuvre
2. **Sujet et thème**: Ce qui se voit, thème principal et contexte
3. **Composition**: Distribution, point focal, perspective
4. **Palette de couleurs**: Couleurs dominantes, accents et description des tonalités
5. **Humeur et atmosphère**: L'émotion et l'atmosphère transmises
6. **Éclairage**: Type, direction et intensité de la lumière
7. **Détails visuels**: Textures, motifs et détails importants
8. **Environnement**: Arrière-plan, environnement et éléments contextuels
9. **Technique**: Technique de rendu ou médium artistique

Soyez SPÉCIFIQUE et DÉTAILLÉ."""
            }
        }

        # Get the appropriate template, defaulting to Spanish if language not supported
        templates = refinement_templates.get(language, refinement_templates["es"])
        template_key = "deep" if deep_thinking else "standard"
        template = templates[template_key]

        # Translate user hint based on language
        user_hint_prefixes = {
            "es": "Usuario sugiere: ",
            "en": "User suggests: ",
            "fr": "L'utilisateur suggère: ",
            "de": "Benutzer schlägt vor: ",
            "it": "L'utente suggerisce: ",
            "pt": "O usuário sugere: ",
            "ja": "ユーザーは以下を提案しています: ",
            "zh": "用户建议: ",
            "ar": "يقترح المستخدم: ",
        }
        prefix = user_hint_prefixes.get(language, "Usuario sugiere: ")
        user_hint = f"{prefix}{user_input}" if user_input else ""
        refinement_prompt = template.format(analysis=analysis_text, user_hint=user_hint)

        # Use Ollama CHAT endpoint for better language support
        try:
            # System message to enforce language output (dynamic based on language parameter)
            # Map language codes to language names for system message
            language_instructions = {
                "es": "Eres un experto en análisis de imágenes y generación de prompts detallados.\nTu tarea es generar prompts precisos, detallados y en ESPAÑOL para generar imágenes similares a las analizadas.\nIMPORTANTE: Debes responder SIEMPRE en ESPAÑOL, sin excepción.\nLos prompts deben ser profesionales, estructurados y listos para usar con modelos de generación de imágenes.\nNo incluyas explicaciones adicionales, solo el prompt detallado en español.",
                "en": "You are an expert in image analysis and detailed prompt generation.\nYour task is to generate precise, detailed prompts in ENGLISH for generating images similar to the analyzed ones.\nIMPORTANT: You must ALWAYS respond in ENGLISH, without exception.\nPrompts should be professional, structured and ready to use with image generation models.\nDo not include additional explanations, only the detailed prompt in English.",
                "fr": "Vous êtes un expert en analyse d'images et en génération de prompts détaillés.\nVotre tâche est de générer des prompts précis, détaillés et en FRANÇAIS pour générer des images similaires aux images analysées.\nIMPORTANT: Vous devez TOUJOURS répondre en FRANÇAIS, sans exception.\nLes prompts doivent être professionnels, structurés et prêts à être utilisés avec des modèles de génération d'images.\nN'incluez pas d'explications supplémentaires, seulement le prompt détaillé en français.",
                "de": "Sie sind ein Experte in Bildanalyse und detaillierter Prompt-Generierung.\nIhre Aufgabe besteht darin, präzise, detaillierte Prompts auf DEUTSCH zu erstellen, um ähnliche Bilder zu generieren.\nWICHTIG: Sie müssen IMMER auf DEUTSCH antworten, ohne Ausnahme.\nPrompts sollten professionell, strukturiert und einsatzbereit mit Bildgenerierungsmodellen sein.\nFügen Sie keine zusätzlichen Erklärungen ein, nur den detaillierten Prompt auf Deutsch.",
                "it": "Sei un esperto di analisi di immagini e generazione di prompt dettagliati.\nIl tuo compito è generare prompt precisi, dettagliati e in ITALIANO per generare immagini simili a quelle analizzate.\nIMPORTANTE: Devi SEMPRE rispondere in ITALIANO, senza eccezioni.\nI prompt devono essere professionali, strutturati e pronti per l'uso con modelli di generazione di immagini.\nNon includere spiegazioni aggiuntive, solo il prompt dettagliato in italiano.",
                "pt": "Você é um especialista em análise de imagens e geração de prompts detalhados.\nSua tarefa é gerar prompts precisos, detalhados e em PORTUGUÊS para gerar imagens semelhantes às analisadas.\nIMPORTANTE: Você deve SEMPRE responder em PORTUGUÊS, sem exceção.\nOs prompts devem ser profissionais, estruturados e prontos para uso com modelos de geração de imagens.\nNão inclua explicações adicionais, apenas o prompt detalhado em português.",
                "ja": "あなたは画像分析と詳細なプロンプト生成の専門家です。\nあなたの任務は、分析された画像に似た画像を生成するための、正確で詳細な日本語プロンプトを生成することです。\n重要：常に日本語で応答してください。例外はありません。\nプロンプトは、画像生成モデルで使用できるように、プロフェッショナルで構造化されたものである必要があります。\n追加の説明は含めず、日本語の詳細なプロンプトのみを含めてください。",
                "zh": "您是图像分析和详细提示生成方面的专家。\n您的任务是生成精确、详细的中文提示，以生成与分析的图像相似的图像。\n重要：您必须始终用中文回复，没有例外。\n提示应该是专业的、结构化的，并准备好与图像生成模型一起使用。\n不要包含其他说明，只需提供中文详细提示。",
                "ar": "أنت خبير في تحليل الصور وإنشاء الرموز المفصلة.\nمهمتك هي إنشاء رموز دقيقة ومفصلة باللغة العربية لإنشاء صور مشابهة للصور التي تم تحليلها.\nهام: يجب عليك دائمًا الرد باللغة العربية، بدون استثناء.\nيجب أن تكون الرموز احترافية ومنظمة وجاهزة للاستخدام مع نماذج إنشاء الصور.\nلا تضمن شروحات إضافية، فقط الرمز المفصل باللغة العربية.",
            }

            system_message = language_instructions.get(language, language_instructions["es"])

            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": refinement_prompt}
            ]

            options = {
                "temperature": 0.7 if deep_thinking else 0.5,
                "top_p": 0.9,
                "num_predict": 1500 if deep_thinking else 800  # INCREASED from 300/150
            }

            # Use chat endpoint instead of generate for better system message support
            response = self.ollama_client.chat(
                model=self.ollama_model,
                messages=messages,
                stream=False,
                options=options
            )

            # Handle both dict and object responses
            if isinstance(response, dict):
                return response.get('message', {}).get('content', '').strip()
            else:
                return response.message.content.strip()

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
