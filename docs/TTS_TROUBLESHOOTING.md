# TTS Server - Guía de Troubleshooting

## Problema: Audio Vacío o Sin Reproducción

### Síntomas
- El servidor genera un archivo de audio pero está vacío (0 bytes)
- O: El archivo se descarga pero no tiene audio
- O: El reproductor de la app no muestra nada

### Soluciones

#### **Paso 1: Verificar que el servidor TTS funciona**

```bash
# Probar endpoint de health check
curl http://localhost:9000/health

# Respuesta esperada:
{
  "status": "ok",
  "service": "Local TTS Server (pyttsx3)",
  "platform": "Windows",
  "available_voices": 4
}
```

Si esto falla → El servidor TTS no está corriendo

#### **Paso 2: Verificar que hay voces disponibles**

```bash
# Listar voces del sistema
curl http://localhost:9000/voices

# Respuesta esperada:
{
  "platform": "Windows",
  "driver": "sapi5",
  "voices": [
    {
      "id": "HKEY_LOCAL_MACHINE\\...",
      "name": "Microsoft David",
      "languages": []
    },
    ...
  ]
}
```

Si `voices` está vacío → No hay voces instaladas en Windows (ver solución abajo)

#### **Paso 3: Prueba de generación simple**

```bash
# Generar audio de prueba (sin pasar por la app React)
curl http://localhost:9000/test --output test.wav

# Verificar que el archivo tiene contenido
ls -la test.wav

# Si test.wav > 0 bytes, TTS funciona correctamente
```

Si `test.wav` está vacío (0 bytes):
1. El servidor TTS tiene problema de configuración
2. Revisar logs del servidor para ver errores
3. Reiniciar servidor: `npm run tts:server`

#### **Paso 4: Verificar .env.local**

```bash
# Verificar que .env.local tiene la configuración correcta
cat .env.local | grep VITE_TTS

# Salida esperada:
VITE_TTS_ENDPOINT=http://localhost:9000/tts
VITE_TTS_MODEL_ID=pyttsx3
```

Si no está configurado:
```bash
echo "VITE_TTS_ENDPOINT=http://localhost:9000/tts" >> .env.local
echo "VITE_TTS_MODEL_ID=pyttsx3" >> .env.local
npm run dev  # Reiniciar la app
```

---

## Problema: "ModuleNotFoundError: No module named 'flask'"

### Causa
Las dependencias de Python no están instaladas

### Solución

```bash
pip install flask flask-cors pyttsx3
```

Verificar que se instaló correctamente:
```bash
pip list | grep -E "flask|pyttsx3"
```

---

## Problema: "No voices available" (Sin voces en Windows)

### Causa
Windows no tiene voces TTS de texto a voz instaladas

### Solución en Windows 11/10

1. **Abrir Configuración de Voz**
   ```
   Inicio → Configuración → Accesibilidad → Síntesis de voz
   ```

2. **Instalar una voz (si es necesario)**
   - Hacer clic en "Voces disponibles"
   - Descargar al menos una voz
   - Windows incluye "Microsoft David" por defecto

3. **Verificar que las voces están disponibles**
   ```bash
   curl http://localhost:9000/voices
   ```
   Debe listar al menos 1 voz en el JSON

4. **Reiniciar el servidor TTS**
   ```bash
   npm run tts:server
   ```

---

## Problema: "Port 9000 in use" (Puerto ocupado)

### Causa
Otro proceso está usando el puerto 9000

### Solución

**Opción 1: Cambiar el puerto**
```bash
TTS_PORT=9001 npm run tts:server
```

Luego actualizar `.env.local`:
```
VITE_TTS_ENDPOINT=http://localhost:9001/tts
```

**Opción 2: Liberar el puerto (Windows)**
```bash
# Encontrar el proceso usando el puerto 9000
netstat -ano | findstr :9000

# Terminar el proceso (cambiar PID según resultado anterior)
taskkill /PID <PID> /F
```

**Opción 3: Liberar el puerto (macOS/Linux)**
```bash
# Encontrar proceso
lsof -i :9000

# Terminar
kill -9 <PID>
```

---

## Problema: Logs del servidor no muestran información

### Solución

Si el servidor TTS corre pero no ves logs detallados:

1. **Reiniciar con output visible**
   ```bash
   npm run tts:server 2>&1 | tee tts_server.log
   ```

2. **Cambiar nivel de logging en tts_server.py**
   - Abre `scripts/tts_server.py` línea 13
   - Cambia `level=logging.INFO` a `level=logging.DEBUG`
   - Reinicia el servidor

3. **Revisar el archivo de log**
   ```bash
   cat tts_server.log | grep -E "ERROR|✓|❌"
   ```

---

## Problema: Audio generado pero no se escucha en la app

### Debugging paso a paso

1. **¿El endpoint /test genera audio?**
   ```bash
   curl http://localhost:9000/test --output test.wav
   file test.wav  # Debe decir "RIFF (little-endian) data, WAVE audio"
   ```

2. **¿La app React recibe la URL del audio?**
   - Abrir DevTools (F12)
   - Network tab → Buscar POST request a `localhost:9000/tts`
   - Response debe ser un archivo WAV descargable

3. **¿El reproductor HTML5 funciona?**
   - Ir a modo "Voz"
   - Abrir DevTools Console
   - Escribir: `document.querySelectorAll('audio')`
   - Debe mostrar al menos 1 elemento `<audio>`

4. **¿El audioUrl está siendo seteado?**
   - En DevTools Console, escribir:
   ```javascript
   // Buscar el elemento audio
   document.querySelector('audio')?.src
   // Debe mostrar algo como: blob:http://localhost:4173/...
   ```

---

## Checklist de Verificación

Ejecutar estos comandos en orden para verificar que todo funciona:

```bash
# 1. ¿El servidor TTS está corriendo?
curl http://localhost:9000/health
# ✓ Esperado: {"status": "ok", ...}

# 2. ¿Hay voces disponibles?
curl http://localhost:9000/voices
# ✓ Esperado: voices array con elementos

# 3. ¿Se puede generar audio?
curl http://localhost:9000/test --output test.wav
# ✓ Esperado: test.wav > 0 bytes
file test.wav
# ✓ Esperado: "RIFF (little-endian) data, WAVE audio"

# 4. ¿Está configurada la app?
grep VITE_TTS_ENDPOINT .env.local
# ✓ Esperado: VITE_TTS_ENDPOINT=http://localhost:9000/tts

# 5. ¿La app está reiniciada?
npm run dev
# ✓ Ir a modo "Voz" en la app
# ✓ Escribir texto
# ✓ Cliquear "Generar voz"
# ✓ Escuchar audio
# ✓ Descargar audio.wav
```

---

## Logs Esperados del Servidor

Cuando funciona correctamente, verás algo así:

```
========================================================================
🔊 SERVIDOR TTS LOCAL - ANCLORA ADAPT
========================================================================
✓ Servidor escuchando en http://0.0.0.0:9000
✓ Platform: Windows
✓ Temp dir: C:\Users\...\AppData\Local\Temp\anclora_tts

📍 ENDPOINTS DISPONIBLES:
   POST   http://localhost:9000/tts      - Generar audio
   GET    http://localhost:9000/health   - Health check
   GET    http://localhost:9000/voices   - Listar voces
   GET    http://localhost:9000/test     - Prueba simple

2025-12-02 10:30:15 - INFO - ✓ Motor TTS inicializado (Windows - sapi5)
2025-12-02 10:30:16 - INFO - 📝 Generando TTS - Texto: 'Hola mundo' (10 chars), Voz: es
2025-12-02 10:30:16 - INFO - ✓ Voz configurada: HKEY_LOCAL_MACHINE\...
2025-12-02 10:30:16 - INFO - 🎙️  Generando audio a ...
2025-12-02 10:30:17 - INFO - ✓ Audio generado exitosamente: 45264 bytes
2025-12-02 10:30:17 - INFO - ✓ Datos leídos correctamente: 45264 bytes
2025-12-02 10:30:17 - INFO - ✓ Archivo temporal eliminado
```

Si ves `❌ Audio generado pero vacío` o `❌ Fallo al generar archivo` → Revisar sección "Audio Vacío" arriba.

---

## Contacto / Más Ayuda

Si nada de esto funciona:

1. **Verificar instalación de Python**
   ```bash
   python --version  # Debe ser 3.8+
   pip --version
   ```

2. **Reinstalar dependencias**
   ```bash
   pip uninstall flask flask-cors pyttsx3 -y
   pip install flask flask-cors pyttsx3
   ```

3. **Revisar logs completos**
   ```bash
   TTS_PORT=9000 npm run tts:server 2>&1 > tts_error.log
   # Abrir tts_error.log y buscar "ERROR" o "Exception"
   ```

4. **Formato del error**
   Si el error dice:
   - `pyttsx3.init()` fails → Problema con SAPI5 en Windows
   - `Permission denied` → Problema de permisos en la carpeta temp
   - `File not found` → Problema con la ruta del archivo temporal

5. **Contacto en código**
   - Archivo principal: `scripts/tts_server.py`
   - Configuración: `.env.local` (VITE_TTS_ENDPOINT)
   - Integración en App: `src/App.tsx` línea 289 (callTextToSpeech)
