# Testing Guide - Mejoras del Sistema de Análisis de Imágenes

Guía completa para verificar todas las mejoras implementadas.

---

## ✅ Pre-requisitos

Antes de testear, asegúrate de:

```bash
# 1. Backend FastAPI corriendo
python python-backend/main.py
# Debería ver: "🚀 Servidor Anclora Backend iniciado"

# 2. Ollama corriendo
ollama serve
# En otra terminal: ollama pull qwen3-vl:8b

# 3. Modelos de fallback disponibles (opcional)
ollama pull llava:latest
```

---

## 📋 Test Suite

### Test 1: Validación de Seguridad

**Objetivo:** Verificar que el sistema rechaza archivos inválidos

```bash
# 1.1 Archivo no imagen (debería rechazar)
curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@document.txt" \
  -F "language=es"
# Esperado: "File is not a valid image format" (400)

# 1.2 Imagen válida (debería aceptar)
curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_image.jpg" \
  -F "language=es"
# Esperado: success=true, status=200

# 1.3 Archivo demasiado grande (> 50MB)
# Crear archivo dummy > 50MB
dd if=/dev/zero bs=1M count=60 of=large.jpg
curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@large.jpg"
# Esperado: "File too large" (413)

# 1.4 MIME type incorrecto pero extensión correcta
# Cambiar Content-Type manualmente
curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test.jpg;type=text/plain"
# Esperado: rechazo si MIME validation es strict
```

**✅ Criterios de éxito:**
- Rechaza archivos no-imagen
- Rechaza archivos > 50MB
- Acepta formatos válidos (JPEG, PNG, WEBP, GIF, TIFF)
- Maneja errores gracefully

---

### Test 2: Caché - Hit/Miss

**Objetivo:** Verificar funcionamiento del sistema de caché

```bash
# 2.1 Primer análisis (cache miss)
time curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_photo.jpg" \
  -F "language=es" > response1.json
# Esperado:
#   - "cached": false
#   - Tiempo: ~2500-3500ms

# 2.2 Segundo análisis MISMA imagen (cache hit)
time curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_photo.jpg" \
  -F "language=es" > response2.json
# Esperado:
#   - "cached": true
#   - Tiempo: ~10-50ms (99% más rápido)

# 2.3 Verificar que el contenido es idéntico
diff <(jq .image_context response1.json) \
     <(jq .image_context response2.json)
# Esperado: sin diferencias (diff vacío)

# 2.4 Imagen diferente (nuevo cache entry)
time curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@different_photo.jpg" \
  -F "language=es" > response3.json
# Esperado:
#   - "cached": false (imagen nueva)
#   - Tiempo: ~2500-3500ms
```

**✅ Criterios de éxito:**
- Primera análisis: cached=false, ~3s
- Segunda análisis (misma): cached=true, ~10-50ms
- Tercera análisis (diferente): cached=false, ~3s

---

### Test 3: Fallback Models

**Objetivo:** Verificar cadena de fallback cuando modelo primario no disponible

```bash
# 3.1 Estado actual (debe estar disponible)
curl http://localhost:8000/api/images/health | jq
# Esperado: status="ok", analyzer_initialized=true

# 3.2 Simular fallo de Qwen3-VL (detener Ollama temporalmente)
# En terminal de Ollama, hacer Ctrl+C

# 3.3 Intentar análisis (debería usar fallback)
curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_photo.jpg" \
  -F "language=es" | jq
# Esperado:
#   - success=true (no falla)
#   - metadata.model_fallback_used=true
#   - metadata.confidence_score < 1.0 (maybe 0.8)
#   - metadata.model_used="llava:latest" (o similar)

# 3.4 Verificar logs del servidor
# Debería ver: "Primary model... not available, using fallback..."

# 3.5 Reiniciar Ollama
ollama serve

# 3.6 Verificar que vuelve a usar Qwen3-VL
curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_photo.jpg" \
  -F "language=es" | jq .metadata.model_fallback_used
# Esperado: false (vuelve a usar primario)
```

**✅ Criterios de éxito:**
- Si Qwen3-VL no disponible, usa fallback
- Análisis sigue siendo exitosa (no error 500)
- confidence_score más bajo en fallback
- Vuelve a Qwen3-VL cuando está disponible

---

### Test 4: Estadísticas de Caché

**Objetivo:** Verificar endpoints de monitoreo de caché

```bash
# 4.1 Hacer varios análisis
for i in {1..5}; do
  curl -X POST http://localhost:8000/api/images/analyze \
    -F "image=@test_photo.jpg" \
    -F "language=es" \
    -s > /dev/null
  echo "Análisis $i completada"
done

# 4.2 Ver estadísticas
curl http://localhost:8000/api/images/cache-stats | jq
# Esperado:
# {
#   "status": "ok",
#   "cache_stats": {
#     "total_entries": 1,           (solo 1 imagen única)
#     "total_accesses": 5,          (accedida 5 veces)
#     "avg_accesses_per_entry": 5,  (promedio 5)
#     "oldest_entry": "2025-12-...",
#     "most_recent_access": "2025-12-..."
#   },
#   "cache_location": "./python-backend/cache/image_analysis_cache.db"
# }

# 4.3 Verificar en health check
curl http://localhost:8000/api/images/health | jq .cache_stats
# Esperado: mismas estadísticas que 4.2
```

**✅ Criterios de éxito:**
- Endpoint `/cache-stats` retorna JSON válido
- total_entries == número de imágenes únicas
- total_accesses == número de llamadas
- avg_accesses_per_entry correcto

---

### Test 5: Esquema Extendido

**Objetivo:** Verificar que nueva respuesta incluye campos extendidos

```bash
# 5.1 Hacer análisis
curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_photo.jpg" \
  -F "language=es" | jq > response.json

# 5.2 Verificar campos nuevos
cat response.json | jq '.image_context | keys'
# Esperado: incluye
#   - "composition"
#   - "lighting"
#   - "technical_details"
#   - "palette_hex"
#   - "semantic_tags"
#   - "adapted_prompts"

# 5.3 Verificar campos de adapted_prompts
cat response.json | jq '.image_context.adapted_prompts | keys'
# Esperado: ["campaign", "intelligent", "recycle", "basic"]

# 5.4 Verificar metadata
cat response.json | jq '.metadata | keys'
# Esperado: incluye
#   - "model_used"
#   - "language"
#   - "deep_thinking"
#   - "processing_time_seconds"
#   - "confidence_score"
#   - "model_fallback_used"

# 5.5 Verificar tipos
cat response.json | jq '
  .image_context as $ctx |
  .metadata as $meta |
  {
    brief_caption_es_string: ($ctx.brief_caption | type),
    composition_es_string: ($ctx.composition | type),
    palette_hex_es_array: ($ctx.palette_hex | type),
    processing_time_es_numero: ($meta.processing_time_seconds | type),
    confidence_es_numero: ($meta.confidence_score | type)
  }
'
# Esperado: todos "string", "array" o "number" según corresponda
```

**✅ Criterios de éxito:**
- image_context contiene TODOS los campos nuevos
- adapted_prompts tiene 4 variantes
- metadata documenta el proceso
- Tipos de datos correctos

---

### Test 6: Prompts Adaptados

**Objetivo:** Verificar que cada modo genera prompt diferente

```bash
# 6.1 Obtener prompts adaptados
curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_photo.jpg" \
  -F "language=es" | jq '.image_context.adapted_prompts' > prompts.json

# 6.2 Extraer cada uno
echo "=== CAMPAIGN ===" && jq -r '.campaign' prompts.json | head -50
echo "=== INTELLIGENT ===" && jq -r '.intelligent' prompts.json | head -50
echo "=== RECYCLE ===" && jq -r '.recycle' prompts.json | head -50
echo "=== BASIC ===" && jq -r '.basic' prompts.json | head -50

# 6.3 Verificar que son diferentes
jq -r '.campaign' prompts.json > campaign.txt
jq -r '.intelligent' prompts.json > intelligent.txt
jq -r '.recycle' prompts.json > recycle.txt
jq -r '.basic' prompts.json > basic.txt

diff campaign.txt intelligent.txt
diff campaign.txt recycle.txt
diff campaign.txt basic.txt

# Esperado: archivos tienen diferencias
```

**✅ Criterios de éxito:**
- Cada modo genera variante diferente
- campaign: enfocado en marketing
- intelligent: con profundidad semántica
- recycle: conciso para reutilización
- basic: simplificado

---

### Test 7: Limpiar Caché Expirado

**Objetivo:** Verificar mantenimiento de caché

```bash
# 7.1 Ver caché actual
curl http://localhost:8000/api/images/cache-stats | jq '.cache_stats.total_entries'
# Esperado: N entradas

# 7.2 Limpiar caché expirado
curl -X POST http://localhost:8000/api/images/cache-clear-expired | jq
# Esperado:
# {
#   "status": "ok",
#   "deleted_entries": 0,  (es reciente, no expira)
#   "message": "Cleared 0 expired cache entries"
# }

# 7.3 Verificar que caché sigue intacto
curl http://localhost:8000/api/images/cache-stats | jq '.cache_stats.total_entries'
# Esperado: N entradas (sin cambios porque son recientes)
```

**✅ Criterios de éxito:**
- Endpoint `/cache-clear-expired` es accesible
- Retorna número de borrados
- No borra entradas recientes
- Status es 200 OK

---

### Test 8: Múltiples Idiomas

**Objetivo:** Verificar prompts en diferentes idiomas

```bash
# 8.1 Español
curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_photo.jpg" \
  -F "language=es" | jq '.image_context.brief_caption'

# 8.2 English
curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_photo.jpg" \
  -F "language=en" | jq '.image_context.brief_caption'

# 8.3 Français
curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_photo.jpg" \
  -F "language=fr" | jq '.image_context.brief_caption'

# 8.4 Verificar que son diferentes
es=$(curl -s -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_photo.jpg" -F "language=es" | jq -r '.image_context.brief_caption')
en=$(curl -s -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_photo.jpg" -F "language=en" | jq -r '.image_context.brief_caption')

if [ "$es" != "$en" ]; then
  echo "✅ Idiomas funcionan correctamente"
else
  echo "❌ Prompts son idénticos en diferentes idiomas"
fi
```

**✅ Criterios de éxito:**
- Responde en idioma solicitado
- Captions diferentes para cada idioma
- No hay errores 500

---

### Test 9: Performance Benchmark

**Objetivo:** Medir impacto de rendimiento del caché

```bash
#!/bin/bash

# Script: benchmark_cache.sh

echo "=== BENCHMARK CACHE ==="
echo ""

# Test 1: Análisis sin caché (imagen nueva)
echo "Test 1: Primera análisis (sin caché)"
time_start=$(date +%s%N)
curl -s -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_new_$(date +%s).jpg" \
  -F "language=es" > /dev/null
time_end=$(date +%s%N)
time_first=$(( (time_end - time_start) / 1000000 ))
echo "Tiempo: ${time_first}ms"
echo ""

# Test 2: Análisis con caché (misma imagen)
echo "Test 2: Segunda análisis (con caché)"
time_start=$(date +%s%N)
curl -s -X POST http://localhost:8000/api/images/analyze \
  -F "image=@test_photo.jpg" \
  -F "language=es" > /dev/null
time_end=$(date +%s%N)
time_cached=$(( (time_end - time_start) / 1000000 ))
echo "Tiempo: ${time_cached}ms"
echo ""

# Cálculo de mejora
echo "=== RESULTADOS ==="
improvement=$(( 100 - (time_cached * 100 / time_first) ))
echo "Mejora de rendimiento: ${improvement}%"
echo "Speedup: $((time_first / time_cached))x más rápido"
```

**✅ Criterios de éxito:**
- Primera análisis: 2500-3500ms
- Segunda análisis: <100ms
- Speedup: >25x

---

## 📊 Resultado Final

Completa esta tabla después de testear:

| Test | Status | Resultado | Observaciones |
|------|--------|-----------|---------------|
| 1. Validación de Seguridad | ✅/❌ | | |
| 2. Caché Hit/Miss | ✅/❌ | | |
| 3. Fallback Models | ✅/❌ | | |
| 4. Estadísticas de Caché | ✅/❌ | | |
| 5. Esquema Extendido | ✅/❌ | | |
| 6. Prompts Adaptados | ✅/❌ | | |
| 7. Limpiar Caché | ✅/❌ | | |
| 8. Múltiples Idiomas | ✅/❌ | | |
| 9. Performance Benchmark | ✅/❌ | | |

---

## 🐛 Debugging

Si algún test falla:

```bash
# 1. Ver logs del servidor
# Buscar en la consola del backend: ERROR, WARNING

# 2. Verificar caché existe
ls -la python-backend/cache/image_analysis_cache.db

# 3. Verificar Ollama está corriendo
curl http://localhost:11434/api/tags

# 4. Verificar modelo está disponible
ollama list | grep qwen

# 5. Reset completo (cuidado: borra caché)
rm -rf python-backend/cache/image_analysis_cache.db
python python-backend/main.py
```

---

## ✨ Conclusión

Si todos los tests pasan (✅), las mejoras están lista para producción.

**Checkpoints clave:**
- ✅ Security validation funciona
- ✅ Caché mejora rendimiento 90%+
- ✅ Fallback mantiene disponibilidad
- ✅ Esquema extendido es compatible
- ✅ Performance es aceptable

¡Feliz testing! 🎉
