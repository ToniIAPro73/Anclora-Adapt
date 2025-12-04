import os
import io
import time
import psutil
import logging
import torch
import soundfile as sf
import numpy as np
from contextlib import asynccontextmanager
from typing import Optional, Literal
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import Response, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Librerías de IA (Importaciones condicionales para manejo de errores)
try:
    from diffusers import StableDiffusionXLPipeline, EulerDiscreteScheduler, UNet2DConditionModel
    from huggingface_hub import hf_hub_download
except ImportError:
    print("⚠️ Advertencia: Librerías de Diffusers no encontradas.")

try:
    from faster_whisper import WhisperModel
except ImportError:
    print("⚠️ Advertencia: Faster-Whisper no encontrado.")

try:
    from kokoro_onnx import Kokoro
except ImportError:
    print("⚠️ Advertencia: Kokoro-ONNX no encontrado.")

# --- Configuración de Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Gestión de Hardware y Modelos ---
class ModelManager:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tts_model = None
        self.stt_model = None
        self.image_pipe = None
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
            self.unload_stt_model()  # Liberar VRAM crítica
            logger.info("🎨 Cargando SDXL Lightning...")

            try:
                base = "stabilityai/stable-diffusion-xl-base-1.0"
                repo = "ByteDance/SDXL-Lightning"
                ckpt = "sdxl_lightning_4step_unet.safetensors"

                # Cargar UNet optimizado
                logger.info("📥 Descargando componentes SDXL Lightning...")
                unet = UNet2DConditionModel.from_config(base, subfolder="unet").to(self.device, torch.float16)
                unet.load_state_dict(
                    torch.load(
                        hf_hub_download(repo, ckpt),
                        map_location=self.device
                    )
                )

                self.image_pipe = StableDiffusionXLPipeline.from_pretrained(
                    base, unet=unet, torch_dtype=torch.float16, variant="fp16"
                ).to(self.device)

                self.image_pipe.scheduler = EulerDiscreteScheduler.from_config(
                    self.image_pipe.scheduler.config, timestep_spacing="trailing"
                )
                logger.info("✓ SDXL Lightning cargado correctamente")
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
    return {
        "service": "Anclora Local Backend",
        "version": "1.0",
        "endpoints": {
            "health": "/api/health",
            "capabilities": "/api/system/capabilities",
            "tts": "/api/tts",
            "stt": "/api/stt",
            "image": "/api/image"
        }
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
    return model_manager.get_hardware_info()

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

        image = pipe(
            req.prompt,
            negative_prompt=req.negative_prompt,
            num_inference_steps=req.num_inference_steps,
            guidance_scale=0
        ).images[0]

        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)

        logger.info(f"✓ Imagen generada: {len(img_byte_arr.getvalue())} bytes")
        return StreamingResponse(img_byte_arr, media_type="image/png")

    except Exception as e:
        logger.error(f"Error Imagen: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
