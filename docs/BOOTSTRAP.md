# Bootstrap y Fase 3 – Provisionamiento Automático

Este documento describe cómo ejecutar los nuevos scripts de la Fase 3:

- Descarga inicial de modelos (texto, visión, audio)
- Comprobaciones de dependencias
- Limpieza de cachés locales
- Health-checks automáticos tras el arranque

## 1. Requerimientos previos

- Windows PowerShell 5.1+ (o PowerShell 7)
- Python 3.10+
- Node.js 20+
- Ollama instalado y agregado al `PATH`
- Acceso a internet para descargar modelos

## 2. Script `scripts/bootstrap.ps1`

Ejecuta todas las tareas críticas al iniciar el proyecto.

```powershell
cd C:\Users\Usuario\Workspace\01_Proyectos\Anclora-Adapt
pwsh ./scripts/bootstrap.ps1
```

### Qué hace

1. **Valida prerequisitos** (`python`, `node`, `npm`, `ollama`)
2. **Descarga de modelos** definidos en `provisioning/models.json` (texto + visión)
3. **Comprueba dependencias Python** esenciales (`diffusers`, `faster-whisper`)
4. **Ejecuta `npm install`** si todavía no se ha hecho
5. **Health check opcional** (`node scripts/check-endpoints.js`)

### Parámetros útiles

| Flag | Descripción |
| --- | --- |
| `-SkipModels` | No ejecuta la descarga de modelos Ollama |
| `-SkipPythonDeps` | Omite la verificación de módulos Python |
| `-SkipNodeDeps` | Evita `npm install` |
| `-SkipHealth` | Omite el health check final |

Ejemplo: `pwsh ./scripts/bootstrap.ps1 -SkipHealth`

## 3. Archivo `provisioning/models.json`

Define los modelos recomendados por categoría:

- `text`: Lista de modelos LLM locales (premium, balanced, light, etc.)
- `vision`: Modelos Llava / Qwen-VL
- `audio.tts`: Archivos necesarios (kokoro.onnx y voices.json)
- `audio.stt`: Módulo `faster-whisper`

El script se apoya en este archivo para decidir qué descargar y qué advertencias mostrar.

## 4. Limpieza de cachés

Para mantener el rendimiento y liberar espacio:

```powershell
pwsh ./scripts/cache-maintenance.ps1 -MaxAgeDays 7 -Vacuum
```

Esto ejecuta `python-backend/scripts/cache_cleanup.py`, el cual:

1. Borra assets generados (audio, imágenes intermedias) más antiguos que `MaxAgeDays`
2. Llama a `ImageAnalysisCache.clear_expired()` para purgar entradas obsoletas
3. Ejecuta `VACUUM` sobre `image_analysis_cache.db` si se usa `-Vacuum`

Puedes programar este script en el Programador de tareas de Windows (por ejemplo, semanalmente).

## 5. Health checks recomendados

Después de correr el bootstrap:

1. `python python-backend/main.py` → backend FastAPI (ver que no haya warnings críticos)
2. `npm run dev` → frontend Vite
3. `npm run build` → verificación final antes de commit
4. `scripts/cache-maintenance.ps1` → limpieza periódica

## 6. Solución de problemas

| Problema | Solución |
| --- | --- |
| `bootstrap.ps1` no encuentra Ollama | Revisa `ollama version` y que esté en el PATH |
| Faltan archivos Kokoro | Descarga desde la URL indicada en `provisioning/models.json` y colócalos en `python-backend/models/` |
| `faster-whisper` no instalado | Activa el venv del backend y ejecuta `pip install faster-whisper` |
| Cache desbordada | Ejecuta `scripts/cache-maintenance.ps1 -Vacuum`, o programa la tarea |

---

Con estos pasos la Fase 3 queda automatizada: la aplicación prepara todos los modelos necesarios y gestiona los artefactos generados sin intervención manual constante. Ajusta los scripts según tus necesidades si agregas nuevos proveedores o caches adicionales.
