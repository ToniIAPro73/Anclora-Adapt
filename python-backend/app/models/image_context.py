"""
Extended ImageContext schema for comprehensive image analysis
Includes visual analysis, composition details, and mode-specific prompts
"""

from typing import List, Dict, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class ImageContext(BaseModel):
    """Complete image context with structured visual analysis"""

    # Basic caption and descriptions
    brief_caption: str = Field(
        ...,
        description="Brief 1-2 sentence summary in Spanish"
    )
    detailed_description: str = Field(
        ...,
        description="Long narrative description in Spanish"
    )

    # Visual elements breakdown
    objects: List[str] = Field(
        default_factory=list,
        description="List of relevant objects in the image"
    )
    people: List[str] = Field(
        default_factory=list,
        description="Descriptions of people/characters if present"
    )
    setting: str = Field(
        ...,
        description="Type of setting (interior/exterior, urban/natural, etc.)"
    )
    mood: str = Field(
        ...,
        description="Emotional tone and atmosphere"
    )
    style: str = Field(
        ...,
        description="Visual style (photorealistic, illustration, cyberpunk, etc.)"
    )
    colors: List[str] = Field(
        default_factory=list,
        description="Dominant color names and palettes in Spanish"
    )
    text_in_image: str = Field(
        default="",
        description="Any readable text found in the image"
    )

    # IMPROVED ADDITIONS
    composition: str = Field(
        ...,
        description="Composition analysis (rule of thirds, symmetry, depth, framing)"
    )
    lighting: str = Field(
        ...,
        description="Lighting type and direction (natural, dramatic, soft, backlighting, etc.)"
    )
    technical_details: Dict[str, str] = Field(
        default_factory=dict,
        description="Detected technical details (e.g., focal length style, depth of field)"
    )
    palette_hex: List[str] = Field(
        default_factory=list,
        description="Hex color codes for color palette (#RRGGBB format)"
    )
    semantic_tags: List[str] = Field(
        default_factory=list,
        description="Tags for search/categorization (photography, illustration, 3d-render, etc.)"
    )

    # Prompts for different modes
    generative_prompt: str = Field(
        ...,
        description="Long English prompt optimized for Stable Diffusion/Midjourney"
    )
    adapted_prompts: Dict[str, str] = Field(
        default_factory=dict,
        description="Mode-specific prompts (campaign, recycle, intelligent, basic, etc.)"
    )

    # Metadata for caching and tracking
    analysis_timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="When this analysis was generated"
    )
    image_hash: Optional[str] = Field(
        default=None,
        description="MD5 hash of the original image for caching"
    )


class AnalysisMetadata(BaseModel):
    """Metadata about the analysis process"""

    model_config = ConfigDict(protected_namespaces=())

    model_used: str = Field(..., description="Vision model used (qwen3-vl, llava, etc.)")
    language: str = Field(default="es", description="Output language code")
    deep_thinking: bool = Field(default=False, description="Whether deep thinking mode was enabled")
    processing_time_seconds: float = Field(..., description="Time taken to complete analysis")
    confidence_score: float = Field(
        default=1.0,
        description="Confidence in the analysis (0-1, lower if fallback was used)"
    )
    model_fallback_used: bool = Field(
        default=False,
        description="Whether a fallback model was used instead of primary"
    )


class ImageAnalysisResponse(BaseModel):
    """Complete response from image analysis endpoint"""

    success: bool = Field(..., description="Whether analysis succeeded")
    image_context: Optional[ImageContext] = Field(
        default=None,
        description="Full analysis result"
    )
    metadata: AnalysisMetadata = Field(
        ...,
        description="Analysis process metadata"
    )
    user_input: Optional[str] = Field(
        default=None,
        description="Original user input that was used"
    )
    error: Optional[str] = Field(
        default=None,
        description="Error message if analysis failed"
    )
    cached: bool = Field(
        default=False,
        description="Whether this result was retrieved from cache"
    )


class AdaptedPromptsConfig(BaseModel):
    """Configuration for generating mode-specific prompts"""

    campaign: Optional[str] = Field(
        default=None,
        description="Instructions for Campaign mode prompts"
    )
    recycle: Optional[str] = Field(
        default=None,
        description="Instructions for Recycle mode prompts"
    )
    intelligent: Optional[str] = Field(
        default=None,
        description="Instructions for Intelligent mode prompts"
    )
    basic: Optional[str] = Field(
        default=None,
        description="Instructions for Basic mode prompts"
    )
