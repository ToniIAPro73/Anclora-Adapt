import os
import io
import time
import json
import psutil
import logging
import torch
import soundfile as sf
import numpy as np
import importlib
from contextlib import asynccontextmanager
from typing import Optional, Literal, List, Dict, Any, TYPE_CHECKING
from pathlib import Path

from hardware_profiles import detect_hardware_profile

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import Response, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.routes.social import oauth

StableDiffusionXLPipelineType = Any
StableDiffusionXLPipelineOutputType = Any
EulerDiscreteSchedulerType = Any
WhisperModelType = Any
KokoroType = Any


def _import_attr(module_path: str, attr: str):
    try:
        module = importlib.import_module(module_path)
        return getattr(module, attr)
    except ImportError:
        return None


StableDiffusionXLPipeline = _import_attr(
    "diffusers.pipelines.stable_diffusion_xl.pipeline_stable_diffusion_xl",
    "StableDiffusionXLPipeline",
)
StableDiffusionXLPipelineOutput = _import_attr(
    "diffusers.pipelines.stable_diffusion_xl.pipeline_output",
    "StableDiffusionXLPipelineOutput",
)
EulerDiscreteScheduler = _import_attr(
    "diffusers.schedulers.scheduling_euler_discrete", "EulerDiscreteScheduler"
)
if StableDiffusionXLPipeline is None or StableDiffusionXLPipelineOutput is None:
    print("⚠️ Advertencia: Librerías de Diffusers no encontradas.")

hf_hub_download = _import_attr("huggingface_hub", "hf_hub_download")
if hf_hub_download is None:
    print("⚠️ Advertencia: huggingface_hub no disponible.")

WhisperModel = _import_attr("faster_whisper", "WhisperModel")
if WhisperModel is None:
    print("⚠️ Advertencia: Faster-Whisper no encontrado.")

Kokoro = _import_attr("kokoro_onnx", "Kokoro")
if Kokoro is None:
    print("⚠️ Advertencia: Kokoro-ONNX no encontrado.")

try:
    from app.routes.image_analysis import router as image_analyzer_router
except ImportError:
    print("⚠️ Advertencia: Image Analyzer no disponible (faltan dependencias CLIP/Ollama).")
    image_analyzer_router = None

try:
    from app.routes.prompt_optimization import router as prompt_optimizer_router
except ImportError:
    print("⚠️ Advertencia: Prompt Optimizer no disponible (faltan dependencias Ollama/Pydantic).")
    prompt_optimizer_router = None

# --- Configuración de Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Gestión de Hardware y Modelos ---
DEFAULT_VOICES = [
    {"id": "es_male_0", "name": "Mateo (ES)", "languages": ["es-ES"], "gender": "male"},
    {"id": "es_female_0", "name": "Clara (ES)", "languages": ["es-ES"], "gender": "female"},
    {"id": "en_male_0", "name": "Noah (EN)", "languages": ["en-US", "en-GB"], "gender": "male"},
    {"id": "en_female_0", "name": "Ava (EN)", "languages": ["en-US", "en-GB"], "gender": "female"},
    {"id": "fr_male_0", "name": "Louis (FR)", "languages": ["fr-FR"], "gender": "male"},
    {"id": "fr_female_0", "name": "Chloé (FR)", "languages": ["fr-FR"], "gender": "female"},
    {"id": "de_male_0", "name": "Felix (DE)", "languages": ["de-DE"], "gender": "male"},
    {"id": "de_female_0", "name": "Lena (DE)", "languages": ["de-DE"], "gender": "female"},
    {"id": "pt_male_0", "name": "Caio (PT)", "languages": ["pt-BR", "pt-PT"], "gender": "male"},
    {"id": "pt_female_0", "name": "Marina (PT)", "languages": ["pt-BR", "pt-PT"], "gender": "female"},
    {"id": "it_male_0", "name": "Marco (IT)", "languages": ["it-IT"], "gender": "male"},
    {"id": "it_female_0", "name": "Giulia (IT)", "languages": ["it-IT"], "gender": "female"},
    {"id": "zh_male_0", "name": "Wei (ZH)", "languages": ["zh-CN", "zh-TW"], "gender": "male"},
    {"id": "zh_female_0", "name": "Lan (ZH)", "languages": ["zh-CN", "zh-TW"], "gender": "female"},
    {"id": "ja_male_0", "name": "Ren (JA)", "languages": ["ja-JP"], "gender": "male"},
    {"id": "ja_female_0", "name": "Yui (JA)", "languages": ["ja-JP"], "gender": "female"},
    {"id": "ru_male_0", "name": "Ivan (RU)", "languages": ["ru-RU"], "gender": "male"},
    {"id": "ru_female_0", "name": "Eva (RU)", "languages": ["ru-RU"], "gender": "female"},
    {"id": "af_sarah", "name": "Sarah (EN)", "languages": ["en-US"], "gender": "female"},
    {"id": "am_adam", "name": "Adam (EN)", "languages": ["en-US"], "gender": "male"},
]

class ModelManager:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tts_model: Any = None
        self.stt_model: Any = None
        self.image_pipe: Any = None
        self.models_path = Path(__file__).parent / "models"
        self.models_path.mkdir(exist_ok=True)
        logger.info(f"🚀 Iniciando en dispositivo: {self.device}")
        logger.info(f"📁 Modelos en: {self.models_path}")

    def get_hardware_info(self):
        """Detecta capacidades actuales para el frontend"""
        vram_gb = 0
        gpu_name = "CPU Only"
        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            vram_gb = props.total_memory / (1024**3)
            gpu_name = torch.cuda.get_device_name(0)

        return {
            "cpu_cores": psutil.cpu_count(logical=False),
            "ram_gb": round(psutil.virtual_memory().total / (1024**3), 1),
            "gpu_model": gpu_name,
            "gpu_vram_gb": round(vram_gb, 1),
            "device": self.device
        }

    def load_tts(self):
        """Carga Kokoro TTS (Ligero, se mantiene en memoria si es posible)"""
        if self.tts_model is None:
            if Kokoro is None:
                raise HTTPException(
                    status_code=500,
                    detail="Dependencia Kokoro-ONNX no instalada. Ejecuta 'pip install kokoro-onnx'.",
                )
            logger.info("🔊 Cargando Kokoro TTS...")
            # Verifica si los archivos existen
            kokoro_path = self.models_path / "kokoro.onnx"
            voices_path = self.models_path / "voices.json"

            if not kokoro_path.exists() or not voices_path.exists():
                logger.error(f"❌ Modelos Kokoro no encontrados en {self.models_path}")
                logger.info("📥 Descarga kokoro.onnx y voices.json desde:")
                logger.info("   https://huggingface.co/hexgrad/Kokoro-82M")
                raise HTTPException(
                    status_code=500,
                    detail=f"Modelos Kokoro no encontrados. Colócalos en {self.models_path}"
                )

            try:
                self.tts_model = Kokoro(str(kokoro_path), str(voices_path))
                logger.info("✓ Kokoro TTS cargado correctamente")
            except Exception as e:
                logger.error(f"Error cargando Kokoro: {e}")
                raise HTTPException(status_code=500, detail="Error al cargar modelo TTS")
        return self.tts_model

    def load_stt(self):
        """Carga Faster-Whisper. Descarga Imagen si es necesario para liberar VRAM."""
        if self.stt_model is None:
            if WhisperModel is None:
                raise HTTPException(
                    status_code=500,
                    detail="Dependencia Faster-Whisper no instalada. Ejecuta 'pip install faster-whisper'.",
                )
            self.unload_image_model()  # Liberar VRAM de la GPU
            logger.info("👂 Cargando Faster-Whisper Large-v3-Turbo...")
            try:
                # Usamos int8 para velocidad en la RTX 3050
                self.stt_model = WhisperModel("large-v3-turbo", device=self.device, compute_type="int8")
                logger.info("✓ Faster-Whisper cargado correctamente")
            except Exception as e:
                logger.error(f"Error cargando Whisper: {e}")
                raise HTTPException(status_code=500, detail="Error al cargar modelo STT")
        return self.stt_model

    def load_image_model(self):
        """Carga SDXL Lightning. Descarga Whisper si es necesario."""
        if self.image_pipe is None:
            if (
                StableDiffusionXLPipeline is None
                or EulerDiscreteScheduler is None
                or hf_hub_download is None
            ):
                raise HTTPException(
                    status_code=500,
                    detail="Dependencias de Diffusers no instaladas. Ejecuta 'pip install diffusers huggingface_hub'.",
                )
            self.unload_stt_model()  # Liberar VRAM crítica
            logger.info("🎨 Cargando SDXL Lightning...")

            try:
                base = "stabilityai/stable-diffusion-xl-base-1.0"
                repo = "ByteDance/SDXL-Lightning"
                ckpt = "sdxl_lightning_4step_unet.safetensors"

                logger.info("📥 Descargando componentes SDXL Lightning...")
                pipe = StableDiffusionXLPipeline.from_pretrained(
                    base,
                    torch_dtype=torch.float16,
                    variant="fp16",
                ).to(self.device)

                ckpt_path = hf_hub_download(repo, ckpt)
                state_dict = torch.load(ckpt_path, map_location=self.device)
                pipe.unet.load_state_dict(state_dict)

                pipe.scheduler = EulerDiscreteScheduler.from_config(
                    pipe.scheduler.config, timestep_spacing="trailing"
                )
                self.image_pipe = pipe
                logger.info("✓ SDXL Lightning cargado correctamente")
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error cargando SDXL: {e}")
                raise HTTPException(status_code=500, detail="Error al cargar modelo de imagen")
        return self.image_pipe

    def unload_image_model(self):
        if self.image_pipe is not None:
            logger.info("🧹 Descargando modelo de Imagen para liberar VRAM...")
            del self.image_pipe
            self.image_pipe = None
            torch.cuda.empty_cache()

    def unload_stt_model(self):
        if self.stt_model is not None:
            logger.info("🧹 Descargando modelo STT para liberar VRAM...")
            del self.stt_model
            self.stt_model = None
            torch.cuda.empty_cache()

    def list_available_voices(self) -> List[Dict[str, Any]]:
        voices_path = self.models_path / "voices.json"

        if not voices_path.exists():
            return DEFAULT_VOICES

        try:
            with open(voices_path, "r", encoding="utf-8") as file:
                data = json.load(file)
        except Exception as exc:
            logger.warning(f"No se pudo leer voices.json: {exc}")
            return DEFAULT_VOICES

        raw_voices: List[Dict[str, Any]] = []
        if isinstance(data, list):
            raw_voices = [voice for voice in data if isinstance(voice, dict)]
        elif isinstance(data, dict):
            if isinstance(data.get("voices"), list):
                raw_voices = [
                    voice for voice in data["voices"] if isinstance(voice, dict)
                ]
            else:
                for key, value in data.items():
                    if isinstance(value, dict):
                        voice_entry = value.copy()
                        voice_entry.setdefault("id", key)
                        raw_voices.append(voice_entry)
        else:
            return DEFAULT_VOICES

        normalized: List[Dict[str, Any]] = []
        for voice in raw_voices:
            voice_id = voice.get("id") or voice.get("voice") or voice.get("name")
            if not voice_id:
                continue
            languages = voice.get("languages")
            if isinstance(languages, str):
                languages = [languages]
            elif not isinstance(languages, list):
                languages = []

            if voice.get("language"):
                languages.append(voice["language"])

            normalized.append(
                {
                    "id": voice_id,
                    "name": voice.get("name") or voice_id,
                    "languages": list(
                        {lang.lower() for lang in languages if isinstance(lang, str)}
                    ),
                    "gender": voice.get("gender"),
                }
            )

        return normalized or DEFAULT_VOICES

model_manager = ModelManager()

# --- Definición de la API FastAPI ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicio
    logger.info("🚀 Servidor Anclora Backend iniciado")
    yield
    # Cierre
    logger.info("🛑 Apagando servidor...")

app = FastAPI(title="Anclora Local Backend", lifespan=lifespan)

# Configuración CORS para permitir peticiones desde Vite (localhost:4173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4173", "http://localhost:5173", "http://127.0.0.1:4173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(oauth.router)

# Registrar router del Image Analyzer si está disponible
if image_analyzer_router:
    app.include_router(image_analyzer_router)
    logger.info("✓ Image Analyzer router registrado")

# Registrar router del Prompt Optimizer si está disponible
if prompt_optimizer_router:
    app.include_router(prompt_optimizer_router)
    logger.info("✓ Prompt Optimizer router registrado")

# --- Modelos de Datos (Pydantic) ---
class TTSRequest(BaseModel):
    inputs: str
    model: Optional[str] = "kokoro"
    language: Optional[str] = "es"
    voice_preset: Optional[str] = "af_sarah"

class ImageRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    width: Optional[int] = 1024
    height: Optional[int] = 1024
    num_inference_steps: Optional[int] = 4  # SDXL Lightning usa 4 pasos

# --- Endpoints ---

@app.get("/")
async def root():
    endpoints = {
        "health": "/api/health",
        "capabilities": "/api/system/capabilities",
        "tts": "/api/tts",
        "stt": "/api/stt",
        "image": "/api/image"
    }
    if image_analyzer_router:
        endpoints.update({
            "image_analyze": "/api/images/analyze",
            "image_analyze_stream": "/api/images/analyze-stream",
            "image_health": "/api/images/health"
        })
    return {
        "service": "Anclora Local Backend",
        "version": "1.0",
        "endpoints": endpoints
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "hardware": model_manager.get_hardware_info()
    }

@app.get("/api/system/capabilities")
async def get_capabilities():
    """Endpoint para el detector de hardware del frontend"""
    return detect_hardware_profile()

@app.post("/api/tts")
async def generate_tts(req: TTSRequest):
    """Genera audio usando Kokoro-82M"""
    try:
        text = req.inputs
        voice = req.voice_preset
        language = req.language

        # Validar longitud para proteger la cola
        if len(text) > 2000:
            raise HTTPException(status_code=400, detail="Texto demasiado largo (máx 2000 caracteres)")

        logger.info(f"🎤 Generando TTS: '{text[:50]}...' ({language}, voz: {voice})")

        tts = model_manager.load_tts()

        # Generar audio (retorna muestras raw y sample rate)
        try:
            samples, sample_rate = tts.create(text, voice=voice, speed=1.0, lang=language)
        except Exception as e:
            logger.warning(f"Voz {voice} no disponible, usando voz por defecto: {e}")
            samples, sample_rate = tts.create(text, voice="af_sarah", speed=1.0, lang=language)

        # Convertir a WAV en memoria
        byte_io = io.BytesIO()
        sf.write(byte_io, samples, sample_rate, format='WAV')
        byte_io.seek(0)

        logger.info(f"✓ Audio generado: {len(byte_io.getvalue())} bytes")
        return StreamingResponse(byte_io, media_type="audio/wav")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error TTS: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/stt")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio usando Faster-Whisper Large-v3-Turbo"""
    try:
        # Leer archivo en memoria
        contents = await file.read()
        audio_file = io.BytesIO(contents)

        logger.info(f"👂 Transcribiendo audio ({len(contents)} bytes)...")

        model = model_manager.load_stt()

        segments, info = model.transcribe(audio_file, beam_size=5)

        text = "".join([segment.text for segment in segments])

        logger.info(f"✓ Transcripción completa: {len(text)} caracteres")

        return {
            "text": text.strip(),
            "language": info.language,
            "probability": info.language_probability
        }

    except Exception as e:
        logger.error(f"Error STT: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/image")
async def generate_image(req: ImageRequest):
    """Genera imagen usando SDXL Lightning (4-step)"""
    try:
        pipe = model_manager.load_image_model()

        logger.info(f"🎨 Generando imagen: {req.prompt}")

        steps = req.num_inference_steps or 4
        negative_prompt = req.negative_prompt or None
        image_result = pipe(
            req.prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=steps,
            guidance_scale=0,
        )

        if not hasattr(image_result, "images"):
            raise HTTPException(status_code=500, detail="Respuesta inesperada del generador de imágenes.")
        image = image_result.images[0]

        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)

        logger.info(f"✓ Imagen generada: {len(img_byte_arr.getvalue())} bytes")
        return StreamingResponse(img_byte_arr, media_type="image/png")

    except Exception as e:
        logger.error(f"Error Imagen: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/voices")
async def list_tts_voices():
    """Lista las voces disponibles para el servicio de TTS"""
    try:
        return {"voices": model_manager.list_available_voices()}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error al listar voces: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="No se pudieron listar las voces")

if __name__ == "__main__":
    import uvicorn
    logger.info("=" * 70)
    logger.info("🚀 SERVIDOR ANCLORA BACKEND - INICIANDO")
    logger.info("=" * 70)
    logger.info(f"📍 Escuchando en: http://0.0.0.0:8000")
    logger.info(f"📊 Documentación: http://localhost:8000/docs")
    logger.info(f"⚙️  Hardware: {model_manager.get_hardware_info()}")
    logger.info("=" * 70)
    uvicorn.run(app, host="0.0.0.0", port=8000)
