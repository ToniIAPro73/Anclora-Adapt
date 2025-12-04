¡Manos a la obra\! Aquí tienes la implementación completa del **Backend Unificado en Python** usando **FastAPI**.

Este código consolida tus scripts dispersos (tts\_server.py, image-bridge.js, etc.) en una sola aplicación robusta que gestiona la memoria (VRAM) de tu RTX 3050 de forma inteligente, cargando y descargando modelos según sea necesario.

### **1\. Preparación del Entorno**

Primero, crea una carpeta llamada python-backend en la raíz de tu proyecto y dentro crea este archivo requirements.txt.

**Archivo:** python-backend/requirements.txt

Plaintext

fastapi==0.109.0  
uvicorn==0.27.0  
python-multipart==0.0.9  
torch==2.1.2 \--index-url https://download.pytorch.org/whl/cu121  
diffusers==0.26.3  
transformers==4.37.2  
accelerate==0.27.2  
soundfile==0.12.1  
faster-whisper==1.0.0  
psutil==5.9.8  
kokoro-onnx==0.3.1  \# Asegúrate de tener los archivos .onnx y voices.json de Kokoro  
numpy\<2.0.0  
Pillow

### **2\. El Servidor Unificado (main.py)**

Este es el cerebro de tu nueva arquitectura. Copia este código en python-backend/main.py.

He incluido una clase ModelManager que gestiona tu VRAM de 4-6GB: si vas a generar una imagen, descarga Whisper de la GPU para hacer espacio, y viceversa.

Python

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

from fastapi import FastAPI, UploadFile, File, HTTPException, Form  
from fastapi.responses import Response, JSONResponse, StreamingResponse  
from fastapi.middleware.cors import CORSMiddleware  
from pydantic import BaseModel

\# Librerías de IA (Importaciones condicionales para manejo de errores)  
try:  
    from diffusers import StableDiffusionXLPipeline, EulerDiscreteScheduler, UNet2DConditionModel  
    from huggingface\_hub import hf\_hub\_download  
except ImportError:  
    print("⚠️ Advertencia: Librerías de Diffusers no encontradas.")

try:  
    from faster\_whisper import WhisperModel  
except ImportError:  
    print("⚠️ Advertencia: Faster-Whisper no encontrado.")

try:  
    from kokoro\_onnx import Kokoro  
except ImportError:  
    print("⚠️ Advertencia: Kokoro-ONNX no encontrado.")

\# \--- Configuración de Logging \---  
logging.basicConfig(level=logging.INFO, format\='%(asctime)s \- %(levelname)s \- %(message)s')  
logger \= logging.getLogger(\_\_name\_\_)

\# \--- Gestión de Hardware y Modelos \---  
class ModelManager:  
    def \_\_init\_\_(self):  
        self.device \= "cuda" if torch.cuda.is\_available() else "cpu"  
        self.tts\_model \= None  
        self.stt\_model \= None  
        self.image\_pipe \= None  
        logger.info(f"🚀 Iniciando en dispositivo: {self.device}")

    def get\_hardware\_info(self):  
        """Detecta capacidades actuales para el frontend"""  
        vram\_gb \= 0  
        gpu\_name \= "CPU Only"  
        if torch.cuda.is\_available():  
            props \= torch.cuda.get\_device\_properties(0)  
            vram\_gb \= props.total\_memory / (1024\*\*3)  
            gpu\_name \= torch.cuda.get\_device\_name(0)  
          
        return {  
            "cpu\_cores": psutil.cpu\_count(logical=False),  
            "ram\_gb": round(psutil.virtual\_memory().total / (1024\*\*3), 1),  
            "gpu\_model": gpu\_name,  
            "gpu\_vram\_gb": round(vram\_gb, 1),  
            "device": self.device  
        }

    def load\_tts(self):  
        """Carga Kokoro TTS (Ligero, se mantiene en memoria si es posible)"""  
        if self.tts\_model is None:  
            logger.info("🔊 Cargando Kokoro TTS...")  
            \# Asegúrate de tener kokoro.onnx y voices.json en la carpeta 'models'  
            try:  
                self.tts\_model \= Kokoro("models/kokoro.onnx", "models/voices.json")  
            except Exception as e:  
                logger.error(f"Error cargando Kokoro: {e}. ¿Tienes los archivos .onnx?")  
                raise HTTPException(status\_code=500, detail="Modelo TTS no encontrado.")  
        return self.tts\_model

    def load\_stt(self):  
        """Carga Faster-Whisper. Descarga Imagen si es necesario para liberar VRAM."""  
        if self.stt\_model is None:  
            self.unload\_image\_model() \# Liberar VRAM de la GPU  
            logger.info("👂 Cargando Faster-Whisper...")  
            \# Usamos int8 para velocidad en la RTX 3050  
            self.stt\_model \= WhisperModel("large-v3-turbo", device=self.device, compute\_type="int8")  
        return self.stt\_model

    def load\_image\_model(self):  
        """Carga SDXL Lightning. Descarga Whisper si es necesario."""  
        if self.image\_pipe is None:  
            self.unload\_stt\_model() \# Liberar VRAM crítica  
            logger.info("🎨 Cargando SDXL Lightning...")  
              
            base \= "stabilityai/stable-diffusion-xl-base-1.0"  
            repo \= "ByteDance/SDXL-Lightning"  
            ckpt \= "sdxl\_lightning\_4step\_unet.safetensors"

            \# Cargar UNet optimizado  
            unet \= UNet2DConditionModel.from\_config(base, subfolder="unet").to(self.device, torch.float16)  
            unet.load\_state\_dict(torch.load(hf\_hub\_download(repo, ckpt), map\_location=self.device))  
              
            self.image\_pipe \= StableDiffusionXLPipeline.from\_pretrained(  
                base, unet=unet, torch\_dtype=torch.float16, variant="fp16"  
            ).to(self.device)  
              
            self.image\_pipe.scheduler \= EulerDiscreteScheduler.from\_config(  
                self.image\_pipe.scheduler.config, timestep\_spacing="trailing"  
            )  
        return self.image\_pipe

    def unload\_image\_model(self):  
        if self.image\_pipe is not None:  
            logger.info("🧹 Descargando modelo de Imagen para liberar VRAM...")  
            del self.image\_pipe  
            self.image\_pipe \= None  
            torch.cuda.empty\_cache()

    def unload\_stt\_model(self):  
        if self.stt\_model is not None:  
            logger.info("🧹 Descargando modelo STT para liberar VRAM...")  
            del self.stt\_model  
            self.stt\_model \= None  
            torch.cuda.empty\_cache()

model\_manager \= ModelManager()

\# \--- Definición de la API FastAPI \---  
@asynccontextmanager  
async def lifespan(app: FastAPI):  
    \# Inicio  
    logger.info("Servidor Anclora Backend iniciado")  
    yield  
    \# Cierre  
    logger.info("Apagando servidor...")

app \= FastAPI(title="Anclora Local Backend", lifespan=lifespan)

\# Configuración CORS para permitir peticiones desde Vite (localhost:4173)  
app.add\_middleware(  
    CORSMiddleware,  
    allow\_origins=\["http://localhost:4173", "http://localhost:5173", "http://127.0.0.1:4173"\],  
    allow\_credentials=True,  
    allow\_methods=\["\*"\],  
    allow\_headers=\["\*"\],  
)

\# \--- Modelos de Datos (Pydantic) \---  
class TTSRequest(BaseModel):  
    inputs: str  
    model: Optional\[str\] \= "kokoro"  
    voice\_preset: Optional\[str\] \= "af\_sarah" \# Voz por defecto

class ImageRequest(BaseModel):  
    prompt: str  
    negative\_prompt: Optional\[str\] \= ""  
    width: Optional\[int\] \= 1024  
    height: Optional\[int\] \= 1024  
    num\_inference\_steps: Optional\[int\] \= 4 \# SDXL Lightning usa 4 pasos

\# \--- Endpoints \---

@app.get("/api/health")  
async def health\_check():  
    return {"status": "ok", "hardware": model\_manager.get\_hardware\_info()}

@app.get("/api/system/capabilities")  
async def get\_capabilities():  
    """Endpoint para el detector de hardware del frontend"""  
    return model\_manager.get\_hardware\_info()

@app.post("/api/tts")  
async def generate\_tts(req: TTSRequest):  
    """Genera audio usando Kokoro-82M"""  
    try:  
        text \= req.inputs  
        voice \= req.voice\_preset  
          
        \# Validar longitud para proteger la cola  
        if len(text) \> 2000:  
            raise HTTPException(status\_code=400, detail="Texto demasiado largo (máx 2000 caracteres)")

        tts \= model\_manager.load\_tts()  
          
        \# Generar audio (retorna muestras raw y sample rate)  
        \# Nota: Ajusta 'af\_sarah' según las voces que tengas en voices.json  
        samples, sample\_rate \= tts.create(text, voice=voice, speed=1.0, lang="en-us") 

        \# Convertir a WAV en memoria  
        byte\_io \= io.BytesIO()  
        sf.write(byte\_io, samples, sample\_rate, format\='WAV')  
        byte\_io.seek(0)

        return StreamingResponse(byte\_io, media\_type="audio/wav")

    except Exception as e:  
        logger.error(f"Error TTS: {e}")  
        raise HTTPException(status\_code=500, detail=str(e))

@app.post("/api/stt")  
async def transcribe\_audio(file: UploadFile \= File(...)):  
    """Transcribe audio usando Faster-Whisper Large-v3-Turbo"""  
    try:  
        \# Leer archivo en memoria  
        contents \= await file.read()  
        audio\_file \= io.BytesIO(contents)  
          
        model \= model\_manager.load\_stt()  
          
        segments, info \= model.transcribe(audio\_file, beam\_size=5)  
          
        text \= "".join(\[segment.text for segment in segments\])  
          
        return {  
            "text": text.strip(),  
            "language": info.language,  
            "probability": info.language\_probability  
        }

    except Exception as e:  
        logger.error(f"Error STT: {e}")  
        raise HTTPException(status\_code=500, detail=str(e))

@app.post("/api/image")  
async def generate\_image(req: ImageRequest):  
    """Genera imagen usando SDXL Lightning (4-step)"""  
    try:  
        pipe \= model\_manager.load\_image\_model()  
          
        logger.info(f"Generando imagen: {req.prompt}")  
        image \= pipe(  
            req.prompt,   
            num\_inference\_steps=req.num\_inference\_steps,   
            guidance\_scale=0  
        ).images\[0\]

        img\_byte\_arr \= io.BytesIO()  
        image.save(img\_byte\_arr, format\='PNG')  
        img\_byte\_arr.seek(0)

        return StreamingResponse(img\_byte\_arr, media\_type="image/png")

    except Exception as e:  
        logger.error(f"Error Imagen: {e}")  
        raise HTTPException(status\_code=500, detail=str(e))

if \_\_name\_\_ \== "\_\_main\_\_":  
    import uvicorn  
    \# Ejecutar en puerto 8000  
    uvicorn.run(app, host="0.0.0.0", port=8000)

### **3\. Pasos Siguientes para la Ejecución**

Una vez guardados los archivos:

1. Descarga los modelos de Kokoro:  
   Como kokoro no descarga modelos automáticamente como diffusers, necesitas colocarlos manualmente. Descarga kokoro-v0\_19.onnx y voices.json desde Hugging Face y ponlos en una carpeta python-backend/models/.  
2. Instala y Ejecuta:  
   Abre una terminal en python-backend:  
   Bash  
   pip install \-r requirements.txt  
   python main.py

3. Configura el Frontend:  
   Actualiza tu .env.local como indicamos en el análisis para apuntar a http://localhost:8000.

Este servidor gestionará automáticamente el "baile" entre la memoria RAM y la VRAM de tu RTX 3050, permitiéndote usar modelos de alta calidad que antes habrían crasheado tu sistema.