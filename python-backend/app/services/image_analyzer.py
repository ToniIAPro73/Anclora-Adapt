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
                "deep": """TAREA: Crear un prompt EXTREMADAMENTE DETALLADO basado en el análisis visual de una imagen real.

ANÁLISIS VISUAL PROPORCIONADO:
{analysis}

{user_hint}

REQUISITOS - El prompt DEBE:
1. Ser EXTREMADAMENTE ESPECÍFICO: No vago, no genérico. Cada elemento debe estar descrito con precisión.
2. COMBINACIÓN INTELIGENTE: Fusionar los elementos detectados (style, mood, composition, etc.) en una narrativa coherente
3. DETALLE TÉCNICO: Usar términos profesionales específicos para rendering, lighting, materials
4. DESCRIPTIVO PERO CONCISO: Largo pero enfocado, evitando redundancias

ESTRUCTURA OBLIGATORIA:
1. **Estilo artístico específico**: Basado en los estilos detectados, describe la técnica visual exacta (ej: si detectó "3D render" y "modern", especifica "photorealistic 3D render", no solo "3D render")
2. **Tema y sujetos principales**: Los ELEMENTOS ESPECÍFICOS que aparecen en la imagen (usar los "subjects" y "composition" detectados)
3. **Composición visual detallada**: Cómo se distribuyen los elementos, punto focal, perspectiva específica
4. **Paleta de colores PRECISA**: Usar los colores detectados, especificar dominantes y secundarios con nombre exacto de color
5. **Mood y atmósfera ESPECÍFICA**: La emoción exacta basada en análisis detectado
6. **Iluminación técnica**: Tipo exacto de iluminación (ej: "three-point lighting", "soft diffuse", "harsh directional")
7. **Materiales y texturas**: Basado en la técnica, especificar materiales (metal, concrete, glass, etc.)
8. **Elementos ambientales específicos**: Fondos, contexto urbano/natural, detalles del entorno
9. **Técnica y rendering**: Precisar la técnica exacta (ej: Unreal Engine photorealism, Octane render, etc.)
10. **Proporciones y escala**: Relación entre elementos, perspectiva específica

IMPORTANTE: NO inventes elementos que no veas en el análisis. SÓLO elabora y especializa lo que el análisis detectó.

Crea el prompt ahora:""",
                "standard": """TAREA: Crear un prompt DETALLADO basado en el análisis visual de una imagen real.

ANÁLISIS VISUAL PROPORCIONADO:
{analysis}

{user_hint}

REQUISITOS - El prompt DEBE:
1. Ser ESPECÍFICO: Descripciones precisas basadas en los elementos detectados
2. COHERENCIA: Fusionar estilos, mood y composición en una descripción unitaria
3. TÉCNICO PERO ACCESIBLE: Usar términos profesionales pero comprensibles

ESTRUCTURA OBLIGATORIA:
1. **Estilo artístico**: La técnica visual exacta (basada en estilos detectados)
2. **Tema y sujetos**: Los elementos principales que aparecen realmente
3. **Composición**: Distribución espacial, punto focal, perspectiva
4. **Paleta de colores**: Colores detectados con nombres específicos
5. **Mood y atmósfera**: La emoción transmitida por la imagen
6. **Iluminación**: Tipo y dirección de la luz (basada en análisis)
7. **Materiales y texturas**: Superficies y texturas detectadas
8. **Ambiente**: Contexto específico detectado
9. **Técnica**: Técnica de rendering o medio artístico

IMPORTANTE: Basarse ÚNICAMENTE en los elementos del análisis. No inventar.

Crea el prompt:"""
            },
            "en": {
                "deep": """TASK: Create an EXTREMELY DETAILED prompt based on real image visual analysis.

VISUAL ANALYSIS PROVIDED:
{analysis}

{user_hint}

REQUIREMENTS - The prompt MUST:
1. Be EXTREMELY SPECIFIC: Not vague, not generic. Each element must be precisely described.
2. INTELLIGENT COMBINATION: Merge detected elements (style, mood, composition, etc.) into a coherent narrative
3. TECHNICAL DETAIL: Use specific professional terms for rendering, lighting, materials
4. DESCRIPTIVE BUT CONCISE: Long but focused, avoiding redundancies

MANDATORY STRUCTURE:
1. **Specific artistic style**: Based on detected styles, describe the exact visual technique (e.g., if detected "3D render" and "modern", specify "photorealistic 3D render", not just "3D render")
2. **Main theme and subjects**: The SPECIFIC ELEMENTS appearing in the image (use detected "subjects" and "composition")
3. **Detailed visual composition**: How elements are distributed, focal point, specific perspective
4. **PRECISE color palette**: Use detected colors, specify dominant and secondary with exact color names
5. **SPECIFIC mood and atmosphere**: The exact emotion based on detected analysis
6. **Technical lighting**: Exact lighting type (e.g., "three-point lighting", "soft diffuse", "harsh directional")
7. **Materials and textures**: Based on technique, specify materials (metal, concrete, glass, etc.)
8. **Specific environmental elements**: Backgrounds, urban/natural context, environment details
9. **Technique and rendering**: Specify exact technique (e.g., Unreal Engine photorealism, Octane render, etc.)
10. **Proportions and scale**: Relationship between elements, specific perspective

IMPORTANT: Do NOT invent elements not in the analysis. ONLY elaborate and specialize what the analysis detected.

Create the prompt now:""",
                "standard": """TASK: Create a DETAILED prompt based on real image visual analysis.

VISUAL ANALYSIS PROVIDED:
{analysis}

{user_hint}

REQUIREMENTS - The prompt MUST:
1. Be SPECIFIC: Precise descriptions based on detected elements
2. COHERENCE: Merge styles, mood and composition into a unified description
3. TECHNICAL BUT ACCESSIBLE: Use professional terms but understandable

MANDATORY STRUCTURE:
1. **Artistic style**: The exact visual technique (based on detected styles)
2. **Theme and subjects**: The main elements that actually appear
3. **Composition**: Spatial distribution, focal point, perspective
4. **Color palette**: Detected colors with specific names
5. **Mood and atmosphere**: The emotion conveyed by the image
6. **Lighting**: Type and direction of light (based on analysis)
7. **Materials and textures**: Detected surfaces and textures
8. **Environment**: Specific detected context
9. **Technique**: Rendering technique or artistic medium

IMPORTANT: Base ONLY on analysis elements. Do NOT invent.

Create the prompt:"""
            },
            "fr": {
                "deep": """TÂCHE: Créer un prompt EXTRÊMEMENT DÉTAILLÉ basé sur l'analyse visuelle d'une image réelle.

ANALYSE VISUELLE FOURNIE:
{analysis}

{user_hint}

EXIGENCES - Le prompt DOIT:
1. Être EXTRÊMEMENT SPÉCIFIQUE: Pas vague, pas générique. Chaque élément doit être précisément décrit.
2. COMBINAISON INTELLIGENTE: Fusionner les éléments détectés (style, mood, composition, etc.) dans une narration cohérente
3. DÉTAIL TECHNIQUE: Utiliser les termes professionnels spécifiques pour le rendu, l'éclairage, les matériaux
4. DESCRIPTIF MAIS CONCIS: Long mais focalisé, évitant les redondances

STRUCTURE OBLIGATOIRE:
1. **Style artistique spécifique**: Basé sur les styles détectés, décrivez la technique visuelle exacte (ex: si détecté "3D render" et "modern", spécifiez "photorealistic 3D render", pas seulement "3D render")
2. **Thème et sujets principaux**: Les ÉLÉMENTS SPÉCIFIQUES apparaissant dans l'image (utiliser les "subjects" et "composition" détectés)
3. **Composition visuelle détaillée**: Comment les éléments sont distribués, point focal, perspective spécifique
4. **Palette de couleurs PRÉCISE**: Utiliser les couleurs détectées, spécifier dominant et secondaire avec noms exactes
5. **Humeur et atmosphère SPÉCIFIQUE**: L'émotion exacte basée sur l'analyse détectée
6. **Éclairage technique**: Type exact d'éclairage (ex: "three-point lighting", "soft diffuse", "harsh directional")
7. **Matériaux et textures**: Basé sur la technique, spécifier les matériaux (metal, béton, verre, etc.)
8. **Éléments environnementaux spécifiques**: Arrière-plans, contexte urbain/naturel, détails d'environnement
9. **Technique et rendu**: Spécifier la technique exacte (ex: Unreal Engine photorealism, Octane render, etc.)
10. **Proportions et échelle**: Relation entre les éléments, perspective spécifique

IMPORTANT: N'inventez PAS d'éléments absents de l'analyse. SEULEMENT élaborez et spécialisez ce que l'analyse a détecté.

Créez le prompt maintenant:""",
                "standard": """TÂCHE: Créer un prompt DÉTAILLÉ basé sur l'analyse visuelle d'une image réelle.

ANALYSE VISUELLE FOURNIE:
{analysis}

{user_hint}

EXIGENCES - Le prompt DOIT:
1. Être SPÉCIFIQUE: Descriptions précises basées sur les éléments détectés
2. COHÉRENCE: Fusionner les styles, mood et composition dans une description unitaire
3. TECHNIQUE MAIS ACCESSIBLE: Utiliser des termes professionnels mais compréhensibles

STRUCTURE OBLIGATOIRE:
1. **Style artistique**: La technique visuelle exacte (basée sur les styles détectés)
2. **Thème et sujets**: Les éléments principaux qui apparaissent réellement
3. **Composition**: Distribution spatiale, point focal, perspective
4. **Palette de couleurs**: Couleurs détectées avec noms spécifiques
5. **Humeur et atmosphère**: L'émotion transmise par l'image
6. **Éclairage**: Type et direction de la lumière (basé sur l'analyse)
7. **Matériaux et textures**: Surfaces et textures détectées
8. **Environnement**: Contexte spécifique détecté
9. **Technique**: Technique de rendu ou médium artistique

IMPORTANT: Basez-vous SEULEMENT sur les éléments de l'analyse. N'inventez PAS.

Créez le prompt:"""
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
