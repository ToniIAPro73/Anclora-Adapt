"""
FastAPI routes for image analysis
Endpoints for CLIP-based image analysis and prompt generation
"""

import logging
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
import json
import io
from PIL import Image

from app.services.image_analyzer import ImageAnalyzer

router = APIRouter(prefix="/api/images", tags=["images"])
logger = logging.getLogger(__name__)

# Global analyzer instance
# In production, use dependency injection
try:
    analyzer = ImageAnalyzer()
except Exception as e:
    logger.error(f"Failed to initialize ImageAnalyzer: {str(e)}")
    analyzer = None


@router.post("/analyze")
async def analyze_image(
    image: UploadFile = File(...),
    user_prompt: Optional[str] = Form(default=""),
    deep_thinking: bool = Form(default=False)
):
    """
    Analyzes uploaded image and generates improved prompt

    Parameters:
    - image: Image file (required)
    - user_prompt: Optional user input for prompt refinement
    - deep_thinking: If true, generates more detailed analysis

    Returns:
    - generatedPrompt: The improved/generated prompt
    - analysis: Visual analysis breakdown
    - success: Whether operation succeeded
    """

    if not analyzer:
        raise HTTPException(status_code=500, detail="Image analyzer not initialized")

    try:
        # Validate file type
        if not image.content_type or not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Only images are allowed")

        # Read and validate size (20MB max)
        contents = await image.read()
        if len(contents) > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image too large (max 20MB)")

        # Validate it's a readable image
        try:
            Image.open(io.BytesIO(contents))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image format")

        # Analyze image
        result = analyzer.analyze_image(
            image_bytes=contents,
            user_prompt=user_prompt.strip() if user_prompt else None,
            deep_thinking=deep_thinking
        )

        if not result['success']:
            raise HTTPException(status_code=500, detail=result.get('error'))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /analyze: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-stream")
async def analyze_image_stream(
    image: UploadFile = File(...),
    user_prompt: Optional[str] = Form(default=""),
    deep_thinking: bool = Form(default=False)
):
    """
    Streaming version of image analysis
    Returns updates as Server-Sent Events (SSE)

    Better UX: shows "Analyzing..." then results progressively
    """

    if not analyzer:
        raise HTTPException(status_code=500, detail="Image analyzer not initialized")

    async def generate():
        try:
            contents = await image.read()

            # Validate
            if len(contents) > 20 * 1024 * 1024:
                yield f"data: {json.dumps({'status': 'error', 'error': 'Image too large'})}\n\n"
                return

            # Send: analyzing...
            yield f"data: {json.dumps({'status': 'analyzing', 'message': 'Analyzing image...'})}\n\n"

            # Visual analysis
            image_obj = Image.open(io.BytesIO(contents))
            visual_analysis = analyzer._analyze_visual_elements(image_obj)

            yield f"data: {json.dumps({'status': 'analyzed', 'analysis': visual_analysis})}\n\n"

            # Refinement
            yield f"data: {json.dumps({'status': 'generating', 'message': 'Generating prompt...'})}\n\n"

            prompt = analyzer._generate_prompt(
                visual_analysis=visual_analysis,
                user_input=user_prompt.strip() if user_prompt else None,
                deep_thinking=deep_thinking
            )

            yield f"data: {json.dumps({'status': 'complete', 'generatedPrompt': prompt})}\n\n"

        except Exception as e:
            logger.error(f"Error in stream: {str(e)}")
            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"}
    )


@router.get("/health")
async def health_check():
    """Health check for image analyzer service"""
    return {
        "status": "ok" if analyzer else "error",
        "service": "image-analyzer",
        "analyzer_initialized": analyzer is not None
    }
