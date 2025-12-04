# XTTS v2 - Guía de Instalación Paso a Paso

## Para tu Sistema
- Intel Core Ultra 7 ✅
- 32GB RAM ✅
- RTX 3050 4GB ✅ (justo, pero funciona)

---

## Paso 1: Verificar CUDA y GPU

### 1.1 Verificar que tu RTX 3050 es reconocida por NVIDIA

```powershell
# Abre PowerShell como administrador
nvidia-smi
```

**Salida esperada:**
```
NVIDIA-SMI 561.09                Driver Version: 561.09
GPU Memory: 4095 MB (4GB)
GPU Name: NVIDIA GeForce RTX 3050
CUDA Capability: 8.6
```

Si NO ves esto:
- Actualiza drivers de NVIDIA desde: https://www.nvidia.com/Download/driverDetails.html
- Busca RTX 3050
- Descarga e instala

### 1.2 Verificar CUDA Toolkit

```powershell
nvcc --version
```

**Salida esperada:**
```
release 12.x (o 11.x)
```

Si NO está instalado:
- Descarga CUDA Toolkit 12.1: https://developer.nvidia.com/cuda-12-1-0-download-archive
- Selecciona: Windows → x86_64 → Windows 10
- Instala (toma ~10 minutos)

---

## Paso 2: Preparar Entorno Python

### 2.1 Crear ambiente virtual

```powershell
# Navega a tu carpeta del proyecto
cd C:\Users\Usuario\Workspace\01_Proyectos\Anclora-Adapt

# Crear ambiente virtual
python -m venv venv_xtts

# Activar ambiente
.\venv_xtts\Scripts\Activate.ps1
```

**Resultado:**
```
(venv_xtts) PS C:\...\Anclora-Adapt>
```

### 2.2 Upgrade pip

```powershell
python -m pip install --upgrade pip
```

---

## Paso 3: Instalar XTTS v2

### 3.1 Instalación Simple (Opción A - RECOMENDADA)

```powershell
# En el ambiente activado
pip install coqui-tts
```

**Tiempo:** ~5-10 minutos (descarga modelos)

**Verifica:**
```powershell
python -c "from TTS.api import TTS; print('✓ XTTS v2 instalado correctamente')"
```

### 3.2 Instalación Servidor (Opción B - MEJOR PARA APP)

Si prefieres un servidor HTTP (recomendado para integración con tu app):

```powershell
# Clonar servidor de streaming
git clone https://github.com/coqui-ai/xtts-streaming-server.git
cd xtts-streaming-server

# Instalar dependencias
pip install -r requirements.txt

# Instalar XTTS con CUDA
pip install coqui-tts[cuda]
```

---

## Paso 4: Descarga de Modelos (IMPORTANTE)

La primera vez que ejecutes XTTS v2, descargará ~2GB de modelos.

```powershell
# Descarga de modelos
python -c "
from TTS.api import TTS
tts = TTS(model_name='tts_models/multilingual/multi-dataset/xtts_v2', gpu=True)
print('✓ Modelos descargados')
"
```

**Esto tarda:**
- Primera vez: 5-15 minutos (depende conexión internet)
- Próximas veces: Instantáneo (usa caché)

**Espacio necesario:**
- ~/TTS Models: ~2GB
- Total en disco: ~2.5GB

---

## Paso 5: Prueba Básica Local

### 5.1 Generar Audio Simple

```powershell
# Crear archivo test_xtts.py
@"
from TTS.api import TTS

# Inicializar XTTS v2 en GPU
tts = TTS(model_name='tts_models/multilingual/multi-dataset/xtts_v2', gpu=True)

# Generar audio en español
tts.tts_to_file(
    text="Hola mundo, esto es una prueba de XTTS v2",
    speaker_wav=None,  # Usar voz por defecto
    language="es",
    file_path="output_spanish.wav"
)

print("✓ Audio generado: output_spanish.wav")
"@ | Out-File test_xtts.py

# Ejecutar
python test_xtts.py
```

**Resultado esperado:**
- Se crea `output_spanish.wav`
- Primera generación: 15-30 segundos (es normal)
- Próximas: 10-15 segundos

**Reproducir:**
```powershell
# Windows
.\output_spanish.wav
# O: start output_spanish.wav
```

### 5.2 Generar Audio en Inglés

```powershell
@"
from TTS.api import TTS

tts = TTS(model_name='tts_models/multilingual/multi-dataset/xtts_v2', gpu=True)

tts.tts_to_file(
    text="Hello world, this is XTTS v2 test",
    speaker_wav=None,
    language="en",
    file_path="output_english.wav"
)

print("✓ Audio generado: output_english.wav")
"@ | Out-File test_xtts_en.py

python test_xtts_en.py
```

---

## Paso 6: Clonación de Voz (OPCIONAL pero RECOMENDADO)

Este es el poder de XTTS v2: crear voces personalizadas.

### 6.1 Preparar Audio de Referencia

**Necesitas:**
- Audio de 6-30 segundos en el idioma
- Formato: MP3, WAV, OGG
- Calidad: Clara, sin ruido de fondo
- Contenido: Voz natural hablando el idioma

**Opciones:**
1. Grabar tú mismo (micrófono)
2. Descargar voces de ejemplo
3. Usar audios existentes

### 6.2 Generar Audio Clonado

```powershell
# Ejemplo: usar audio de referencia para clonar voz
@"
from TTS.api import TTS

tts = TTS(model_name='tts_models/multilingual/multi-dataset/xtts_v2', gpu=True)

# Generar con voz clonada
tts.tts_to_file(
    text="Hola, esta es mi voz clonada",
    speaker_wav="ruta/a/tu/audio_referencia.wav",  # Reemplaza con tu audio
    language="es",
    file_path="output_cloned_spanish.wav"
)

print("✓ Audio clonado generado")
"@ | Out-File test_xtts_clone.py

python test_xtts_clone.py
```

---

## Paso 7: Servidor HTTP (Para tu App)

### 7.1 Iniciar Servidor XTTS

```powershell
# Si instalaste con Opción B (servidor)
cd xtts-streaming-server

# Iniciar servidor
python demo.py
```

**Salida esperada:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Endpoint disponibles:**
- GET `http://localhost:8000/docs` - Swagger UI
- POST `http://localhost:8000/tts` - Generar audio
- GET `http://localhost:8000/voices` - Listar voces

### 7.2 Probar Servidor

```powershell
# En otra terminal (PowerShell)
# Generar audio vía servidor

curl -X POST "http://localhost:8000/tts" `
  -H "Content-Type: application/json" `
  -d '{
    "text": "Hola mundo desde el servidor",
    "language": "es"
  }' `
  --output test_server.wav

# Reproducir
start test_server.wav
```

---

## Paso 8: Idiomas Soportados

XTTS v2 soporta:

```
Español (es)         ✅
English (en)         ✅
Français (fr)        ✅
Deutsch (de)         ✅
Italiano (it)        ✅
Português (pt)       ✅
Polski (pl)          ✅
Türkçe (tr)          ✅
Русский (ru)         ✅
Nederlands (nl)      ✅
Čeština (cs)         ✅
العربية (ar)         ✅
中文 (zh-cn)         ✅
日本語 (ja)          ✅
Magyar (hu)          ✅
한국어 (ko)          ✅
```

**Uso:**
```python
tts.tts_to_file(
    text="Tu texto aquí",
    language="es",  # Cambiar código según idioma
    file_path="output.wav"
)
```

---

## Paso 9: Solucionar Problemas

### Problema: "CUDA out of memory"

**Causa:** Tu RTX 3050 4GB está llena

**Soluciones:**
```python
# Solución 1: Usar CPU (más lento)
tts = TTS(gpu=False)  # Usa CPU en lugar de GPU

# Solución 2: Cerrar otras apps
# - Chrome
# - Games
# - Adobe apps
# Anything usando GPU

# Solución 3: Reducir tamaño texto
# En lugar de: "Texto de 500 palabras..."
# Usa: "Texto de 50 palabras..." (múltiples calls)
```

### Problema: "Modelos no encontrados"

**Solución:**
```powershell
# Forzar descarga
python -c "
from TTS.api import TTS
tts = TTS(model_name='tts_models/multilingual/multi-dataset/xtts_v2', gpu=True)
"
```

### Problema: "NVIDIA drivers not found"

**Solución:**
1. Actualiza drivers desde NVIDIA website
2. O usa CPU: `tts = TTS(gpu=False)`

### Problema: Puerto 8000 en uso (si usas servidor)

**Solución:**
```python
# En demo.py, cambiar puerto
uvicorn.run(
    app,
    host="0.0.0.0",
    port=8001  # Cambiar a otro puerto
)
```

---

## Paso 10: Integración con tu App React

### 10.1 Crear nuevo archivo tts_xtts_server.py

```python
# scripts/tts_xtts_server.py
import os
from TTS.api import TTS
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from io import BytesIO
import logging

# Setup
app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inicializar XTTS v2
logger.info("Inicializando XTTS v2...")
tts = TTS(
    model_name="tts_models/multilingual/multi-dataset/xtts_v2",
    gpu=True,
    progress_bar=False
)
logger.info("✓ XTTS v2 listo")

@app.route('/tts', methods=['POST'])
def tts_endpoint():
    try:
        data = request.json
        text = data.get('inputs', '').strip()
        language = data.get('language', 'es')

        if not text:
            return jsonify({"error": "Text is required"}), 400

        logger.info(f"Generando: '{text[:50]}...' ({language})")

        # Generar audio
        wav_data = BytesIO()
        tts.tts_to_file(
            text=text,
            language=language,
            file_path=None,  # Devolver en memoria
            speaker_wav=None
        )

        logger.info(f"✓ Audio generado: {len(wav_data.getvalue())} bytes")

        return send_file(
            wav_data,
            mimetype='audio/wav',
            as_attachment=True,
            download_name='audio.wav'
        )
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "XTTS v2 Server"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9000, debug=False)
```

### 10.2 Actualizar .env.local

```
VITE_TTS_ENDPOINT=http://localhost:9000/tts
VITE_TTS_MODEL_ID=xtts-v2
```

### 10.3 Iniciar Servidor

```powershell
cd C:\Users\Usuario\Workspace\01_Proyectos\Anclora-Adapt
.\venv_xtts\Scripts\Activate.ps1
python scripts/tts_xtts_server.py
```

### 10.4 Iniciar App React

```powershell
# En otra terminal
npm run dev
```

---

## Checklist de Verificación

- [ ] NVIDIA drivers instalados
- [ ] CUDA Toolkit 12.1 instalado
- [ ] Python 3.9+ instalado
- [ ] Ambiente virtual creado y activado
- [ ] XTTS v2 instalado correctamente
- [ ] Modelos descargados (~2GB)
- [ ] Test local generó audio correcto
- [ ] Servidor HTTP iniciado
- [ ] Endpoint `/tts` responde
- [ ] App React conectada
- [ ] Modo Voz genera audio con XTTS v2

---

## Performance Esperado

### Con tu RTX 3050 4GB

**Primera generación:**
- Cold start: 20-30 segundos (carga modelo)
- Generación: 15-25 segundos

**Generaciones siguientes:**
- Generación: 10-15 segundos
- Ideal para: ~4-6 audios por minuto

**Memoria:**
- VRAM usado: 3.5-4GB (casi todo)
- RAM usado: 1-2GB
- Espacio en disco: 2.5GB

---

## Optimizaciones (Si es muy lento)

### Opción 1: Batch Processing
Generar múltiples audios en paralelo

### Opción 2: Caché de Resultados
Guardar audios generados para reutilizar

### Opción 3: Fallback a MeloTTS
Si XTTS v2 es muy lento, usar MeloTTS (más rápido pero menos flexible)

### Opción 4: Reducir Calidad
```python
# No hay opción built-in, pero puedes:
# - Reducir sample rate
# - Usar modelos más pequeños
```

---

## Próximos Pasos

1. **Hoy:** Instala XTTS v2 y prueba localmente
2. **Mañana:** Prepara voces personalizadas
3. **Semana:** Integra servidor en tu app
4. **Semana 2:** Testing y optimización

¿Dudas en algún paso?
