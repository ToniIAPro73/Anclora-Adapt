import os
import uuid
import logging
import tempfile
import platform
from pathlib import Path
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import pyttsx3

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Habilitar CORS para todas las rutas

# Configuración del puerto y host
PORT = int(os.environ.get('TTS_PORT', 9000))
HOST = os.environ.get('TTS_HOST', '0.0.0.0')

# Configuración de limpieza de archivos temporales
TEMP_DIR = Path(tempfile.gettempdir()) / "anclora_tts"
TEMP_DIR.mkdir(exist_ok=True)

# Constantes de validación
MAX_TEXT_LENGTH = 5000  # máximo 5000 caracteres
MIN_TEXT_LENGTH = 1

def get_engine():
    """
    Inicializa el motor TTS de pyttsx3.
    Cada petición obtiene su propia instancia para evitar problemas de concurrencia.
    """
    try:
        engine = pyttsx3.init()
        # Configuración básica
        engine.setProperty('rate', 150)  # Velocidad de habla
        return engine
    except Exception as e:
        logger.error(f"Error al inicializar motor TTS: {str(e)}")
        raise

def get_voice_by_preset(engine, preset):
    """
    Intenta encontrar una voz que coincida con el preset (ej: 'es', 'en', 'es_male').

    Estrategia de búsqueda:
    1. Búsqueda exacta por ID
    2. Búsqueda por código de idioma (ej: 'es' -> Spanish)
    3. Fallback: primera voz disponible
    """
    try:
        voices = engine.getProperty('voices')
        if not voices:
            logger.warning("No voices available on this system")
            return None

        preset = preset.lower() if preset else ""

        # 1. Búsqueda exacta por ID
        for voice in voices:
            if voice.id.lower() == preset:
                logger.info(f"Voz encontrada por ID exacto: {voice.id}")
                return voice.id

        # 2. Búsqueda por idioma
        lang_map = {
            'es': 'spanish',
            'en': 'english',
            'fr': 'french',
            'de': 'german',
            'it': 'italian',
            'pt': 'portuguese',
            'ja': 'japanese',
            'zh': 'chinese'
        }

        target_lang = None
        for code, name in lang_map.items():
            if preset.startswith(code):
                target_lang = name
                break

        if target_lang:
            for voice in voices:
                if target_lang in voice.name.lower():
                    logger.info(f"Voz encontrada por idioma '{target_lang}': {voice.id}")
                    return voice.id

        # 3. Fallback: primera voz disponible
        logger.warning(f"Preset '{preset}' no encontrado. Usando voz por defecto: {voices[0].id}")
        return voices[0].id if voices else None

    except Exception as e:
        logger.error(f"Error al buscar voz: {str(e)}")
        return None

def validate_input(text):
    """
    Valida el texto de entrada.

    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    if not text:
        return False, "El texto no puede estar vacío"

    if len(text) < MIN_TEXT_LENGTH:
        return False, f"El texto debe tener al menos {MIN_TEXT_LENGTH} carácter"

    if len(text) > MAX_TEXT_LENGTH:
        return False, f"El texto no puede exceder {MAX_TEXT_LENGTH} caracteres. Actual: {len(text)}"

    return True, None

def cleanup_temp_files():
    """
    Limpia archivos temporales antiguos en el directorio de TTS.
    """
    try:
        if TEMP_DIR.exists():
            for file in TEMP_DIR.glob("tts_*.wav"):
                try:
                    file.unlink()
                except Exception as e:
                    logger.warning(f"No se pudo eliminar {file}: {str(e)}")
    except Exception as e:
        logger.error(f"Error durante limpieza de archivos: {str(e)}")

@app.route('/tts', methods=['POST'])
def tts_endpoint():
    """
    Endpoint principal para síntesis de texto a voz.

    Espera JSON:
    {
        "model": "optional_model_id",
        "inputs": "texto a convertir a voz",
        "parameters": {
            "voice_preset": "es" | "en" | etc.
        }
    }
    """
    filepath = None
    engine = None

    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON body provided"}), 400

        # Obtener y validar texto
        text = data.get('inputs', '').strip()
        is_valid, error_msg = validate_input(text)
        if not is_valid:
            return jsonify({"error": error_msg}), 400

        # Obtener parámetros
        parameters = data.get('parameters', {})
        voice_preset = parameters.get('voice_preset', 'es').lower()

        logger.info(f"📝 Generando TTS - Texto: '{text[:50]}...' ({len(text)} chars), Voz: {voice_preset}")

        # Inicializar motor TTS
        engine = get_engine()

        # Configurar voz
        voice_id = get_voice_by_preset(engine, voice_preset)
        if voice_id:
            engine.setProperty('voice', voice_id)
            logger.info(f"✓ Voz configurada: {voice_id}")
        else:
            logger.warning("No se encontró voz compatible, usando sistema por defecto")

        # Generar nombre de archivo único en el directorio temporal
        filename = f"tts_{uuid.uuid4()}.wav"
        filepath = TEMP_DIR / filename

        # Guardar audio a archivo
        logger.info(f"🎙️  Generando audio a {filepath}")
        engine.save_to_file(text, str(filepath))
        engine.runAndWait()

        # Verificar que el archivo fue creado
        if not filepath.exists():
            logger.error(f"Fallo al generar archivo: {filepath}")
            return jsonify({"error": "Failed to generate audio file"}), 500

        logger.info(f"✓ Audio generado exitosamente: {filepath.stat().st_size} bytes")

        # Leer archivo en memoria y eliminarlo
        with open(filepath, 'rb') as f:
            audio_data = f.read()

        filepath.unlink()  # Eliminar archivo temporal
        logger.info(f"✓ Archivo temporal eliminado")

        # Enviar como respuesta
        from io import BytesIO
        return send_file(
            BytesIO(audio_data),
            mimetype='audio/wav',
            as_attachment=True,
            download_name='audio.wav'
        )

    except Exception as e:
        logger.error(f"❌ Error en TTS: {str(e)}", exc_info=True)
        # Limpiar archivo si existe
        if filepath and filepath.exists():
            try:
                filepath.unlink()
            except:
                pass
        return jsonify({"error": f"TTS error: {str(e)}"}), 500
    finally:
        # Limpiar motor si se inicializó
        if engine:
            try:
                engine.stop()
            except:
                pass

@app.route('/health', methods=['GET'])
def health():
    """
    Health check del servidor TTS.
    """
    try:
        # Verificar que pyttsx3 funciona
        test_engine = pyttsx3.init()
        voices = test_engine.getProperty('voices')
        test_engine.stop()

        return jsonify({
            "status": "ok",
            "service": "Local TTS Server (pyttsx3)",
            "platform": platform.system(),
            "available_voices": len(voices) if voices else 0
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            "status": "error",
            "service": "Local TTS Server",
            "error": str(e)
        }), 503

@app.route('/voices', methods=['GET'])
def list_voices():
    """
    Lista las voces disponibles en el sistema.
    Útil para debugging y configuración.
    """
    try:
        engine = pyttsx3.init()
        voices = engine.getProperty('voices')
        engine.stop()

        voices_list = []
        for voice in voices:
            voices_list.append({
                "id": voice.id,
                "name": voice.name,
                "languages": getattr(voice, 'languages', [])
            })

        logger.info(f"Voces disponibles: {len(voices_list)}")
        return jsonify({
            "platform": platform.system(),
            "voices": voices_list
        }), 200
    except Exception as e:
        logger.error(f"Error listing voices: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Limpiar archivos temporales al inicio
    cleanup_temp_files()

    print("\n" + "="*70)
    print("🔊 SERVIDOR TTS LOCAL - ANCLORA ADAPT")
    print("="*70)
    print(f"✓ Servidor escuchando en http://{HOST}:{PORT}")
    print(f"✓ Endpoint TTS: POST http://localhost:{PORT}/tts")
    print(f"✓ Health check: GET http://localhost:{PORT}/health")
    print(f"✓ Listar voces: GET http://localhost:{PORT}/voices")
    print(f"✓ Archivos temporales: {TEMP_DIR}")
    print("\n📋 INSTRUCCIONES:")
    print("1. Configura en .env.local:")
    print(f"   VITE_TTS_ENDPOINT=http://localhost:{PORT}/tts")
    print("\n2. Reinicia la app:")
    print("   npm run dev")
    print("\n3. Ve a modo 'Voz' y prueba generar audio")
    print("="*70 + "\n")

    app.run(host=HOST, port=PORT, debug=False)
