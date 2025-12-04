#!/usr/bin/env python3
"""
Script de setup para descargar modelos necesarios para Anclora Backend

Descarga:
1. Kokoro TTS (kokoro.onnx + voices.json)
2. Modelos de Faster-Whisper (automático en first run)
3. SDXL Lightning (automático en first run)
"""

import os
import sys
import logging
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# === CONFIGURACIÓN ===
MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

KOKORO_REPO = "hexgrad/Kokoro-82M"
KOKORO_FILES = ["kokoro.onnx", "voices.json"]

# === FUNCIONES ===

def check_kokoro_models() -> bool:
    """Verifica si los modelos de Kokoro están descargados"""
    missing = []
    for file in KOKORO_FILES:
        path = MODELS_DIR / file
        if not path.exists():
            missing.append(file)

    if missing:
        logger.warning(f"❌ Modelos Kokoro faltantes: {', '.join(missing)}")
        logger.info(f"📍 Esperados en: {MODELS_DIR}")
        return False
    else:
        logger.info(f"✓ Modelos Kokoro encontrados en {MODELS_DIR}")
        return True

def download_kokoro_manual():
    """Instruye al usuario cómo descargar Kokoro manualmente"""
    logger.info("\n" + "="*70)
    logger.info("📥 DESCARGA MANUAL DE KOKORO TTS")
    logger.info("="*70)
    logger.info("\nKokoro no se puede descargar automáticamente.")
    logger.info("Por favor, descárgalo manualmente desde HuggingFace:\n")
    logger.info(f"1. Ir a: https://huggingface.co/{KOKORO_REPO}")
    logger.info(f"2. Descargar los archivos:")
    for file in KOKORO_FILES:
        logger.info(f"   - {file}")
    logger.info(f"\n3. Colocar en: {MODELS_DIR}/")
    logger.info(f"\nEstructura esperada:")
    logger.info(f"   {MODELS_DIR}/")
    logger.info(f"   ├── kokoro.onnx")
    logger.info(f"   └── voices.json")
    logger.info("="*70 + "\n")

def check_torch_cuda():
    """Verifica si torch tiene CUDA disponible"""
    try:
        import torch
        if torch.cuda.is_available():
            logger.info(f"✓ GPU Detectada: {torch.cuda.get_device_name(0)}")
            logger.info(f"   VRAM: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.1f} GB")
            return True
        else:
            logger.warning("⚠️  GPU NO detectada. Usando CPU (lento).")
            return False
    except ImportError:
        logger.error("❌ torch no está instalado. Ejecuta: pip install -r requirements.txt")
        return False

def download_whisper_models():
    """Descarga modelos de Faster-Whisper (automático en runtime)"""
    logger.info("\n📍 Modelos de Faster-Whisper se descargarán automáticamente")
    logger.info("   en el primer uso (~2GB). Esto puede tardar 5-10 minutos.")
    logger.info("   Asegúrate de tener suficiente espacio en disco.")

def download_sdxl_models():
    """Información sobre SDXL Lightning"""
    logger.info("\n📍 Modelos de SDXL Lightning se descargarán automáticamente")
    logger.info("   en el primer uso (~4GB). Esto puede tardar 5-10 minutos.")
    logger.info("   Asegúrate de tener suficiente espacio en disco y VRAM disponible.")

def main():
    logger.info("\n" + "="*70)
    logger.info("🚀 SETUP: ANCLORA LOCAL BACKEND")
    logger.info("="*70)

    # Paso 1: Verificar CUDA
    logger.info("\n[1/4] Verificando GPU...")
    cuda_available = check_torch_cuda()

    # Paso 2: Verificar Kokoro (REQUERIDO)
    logger.info("\n[2/4] Verificando Kokoro TTS...")
    kokoro_ready = check_kokoro_models()

    if not kokoro_ready:
        logger.warning("\n⚠️  Kokoro es REQUERIDO para que el servidor funcione.")
        download_kokoro_manual()
        return False

    # Paso 3: Whisper (se descargará automáticamente)
    logger.info("\n[3/4] Configurando Faster-Whisper...")
    download_whisper_models()

    # Paso 4: SDXL Lightning (se descargará automáticamente)
    logger.info("\n[4/4] Configurando SDXL Lightning...")
    download_sdxl_models()

    logger.info("\n" + "="*70)
    logger.info("✅ SETUP COMPLETADO")
    logger.info("="*70)
    logger.info("\nPróximos pasos:")
    logger.info("1. Ejecuta el servidor: python main.py")
    logger.info("2. Accede a: http://localhost:8000")
    logger.info("3. Documentación: http://localhost:8000/docs")
    logger.info("="*70 + "\n")

    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
