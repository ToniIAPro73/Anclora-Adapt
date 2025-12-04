# XTTS v2 - Quick Start (5 minutos)

## Tu Configuración
✅ Intel Core Ultra 7
✅ 32GB RAM
✅ RTX 3050 4GB

---

## TL;DR - Qué Necesitas Hacer

### Terminal 1: Descargar e Instalar XTTS v2
```powershell
# 1. Crea venv
python -m venv venv_xtts
.\venv_xtts\Scripts\Activate.ps1

# 2. Instala XTTS v2
pip install coqui-tts

# 3. Descarga modelos (tarda primera vez)
python -c "from TTS.api import TTS; TTS(model_name='tts_models/multilingual/multi-dataset/xtts_v2', gpu=True)"

# 4. Prueba simple
python -c "
from TTS.api import TTS
tts = TTS(model_name='tts_models/multilingual/multi-dataset/xtts_v2', gpu=True)
tts.tts_to_file(text='Hola, esto funciona', language='es', file_path='test.wav')
print('✓ Audio generado: test.wav')
"

# 5. Si ves "✓ Audio generado" → FUNCIONA ✅
```

### Terminal 2: (Opcional) Servidor HTTP

```powershell
# Si quieres servidor REST (para la app React)
cd xtts-streaming-server
pip install -r requirements.txt
python demo.py
# Escucha en: http://localhost:8000
```

---

## Próximos Pasos

1. **Esta semana:**
   - Sigue pasos arriba
   - Prueba audios en español/inglés
   - Verifica velocidad (debería ser 10-15 seg)

2. **Próxima semana:**
   - Prepara voces clonadas (opcional)
   - Integra en tu app React
   - Conecta endpoint `/tts`

3. **Documental completo:**
   - Ver: `docs/XTTS_INSTALLATION_GUIDE.md`

---

## Documentos Relacionados

- `docs/XTTS_INSTALLATION_GUIDE.md` - Guía paso a paso completa
- `docs/TTS_SOLUTIONS_ANALYSIS.md` - Análisis de todas las opciones
- `docs/TTS_TROUBLESHOOTING.md` - Solución de problemas
- `docs/TTS_VOICES_SETUP.md` - Configuración de voces

---

## ¿Dudas?

Si tienes algún problema, sigue este orden:

1. Revisar paso de la guía completa
2. Consultar troubleshooting en guía completa
3. Si CUDA error → Actualizar drivers NVIDIA
4. Si memoria error → Cerrar otras apps que usan GPU

---

## ¿Listo? Empeza ahora 🚀

```powershell
python -m venv venv_xtts
.\venv_xtts\Scripts\Activate.ps1
pip install coqui-tts
python -c "from TTS.api import TTS; print('✓ XTTS v2 listo')"
```

Reporta cómo va en los próximos días! 🎤
