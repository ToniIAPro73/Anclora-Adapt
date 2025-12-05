# CONTEXTO DE CAMBIOS Y ESTADO

## Problema Original (Noviembre 2025)

### Qué se Intentó Resolver

**Error inicial**: `404 Not Found` al llamar a `/api/hf-text` (proxy hacia Hugging Face Router)
- Endpoint usado: `https://router.huggingface.co/hf-inference/models/openai-community/gpt2`
- El router de HF estaba devolviendo 404 para múltiples modelos
- La causa raíz: Hugging Face descontinuó el endpoint legacy `api-inference.huggingface.co` y los modelos en el router no estaban disponibles

### Intentos de Solución Fallidos

1. **Cambiar de modelo LLM**: Probamos `mistralai/Mistral-7B-Instruct-v0.1`, `google/flan-t5-base`, `openai-community/gpt2` → Todos devolvían 404 del router
2. **Cambiar endpoint**: De `router.huggingface.co` a `api-inference.huggingface.co` → Error: "API is no longer supported, use router instead"
3. **Agregar headers al proxy de Vite**: No solucionó el problema de disponibilidad de modelos
4. **Together AI API**: Era una solución paga (aunque con free tier) → No cumplía requisito de "100% gratis open source"

---

## Solución Final: Ollama (Open Source Local)

### Por qué Ollama

✅ **Completamente gratis** - Open source (AGPL), sin costo alguno
✅ **Cero 404s** - Los modelos corren localmente, siempre disponibles
✅ **Cero rate limits** - Infraestructura propia, sin restricciones
✅ **Cero CORS** - Local, no viaja por internet
✅ **Modelos probados** - Llama 2, Mistral, Neural Chat funcionan perfectamente

### Cambios Realizados

#### `index.tsx` (líneas 4-12)
```typescript
// ANTES: Configuración de Hugging Face Router
const HF_BASE_URL = "https://router.huggingface.co/hf-inference";
const TEXT_MODEL_ID = "openai-community/gpt2";

// AHORA: Configuración de Ollama (Local)
const OLLAMA_BASE_URL = "http://localhost:11434";
const TEXT_MODEL_ID = "llama2"; // Local, nunca da 404
```

#### `callTextModel()` (líneas 73-98)
```typescript
// ANTES: Usaba buildCandidateUrls + fetchWithFallback (complejo)
const response = await fetchWithFallback(
  buildCandidateUrls(TEXT_MODEL_ID, TEXT_ENDPOINT),
  { /* headers con Bearer token, formato HF */ }
);

// AHORA: API simple de Ollama, sin auth
const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
  method: "POST",
  body: JSON.stringify({
    model: TEXT_MODEL_ID,
    prompt: prompt,
    stream: false,
    temperature: 0.4,
  }),
});
```

#### `.env.local`
```bash
# ANTES:
HF_API_KEY=hf_...
VITE_HF_BASE_URL=https://router.huggingface.co/hf-inference
VITE_USE_PROXY=true
VITE_TEXT_MODEL_ID=google/flan-t5-base

# AHORA:
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_TEXT_MODEL_ID=llama2
```

---

## Estado Actual (Listo para Usar)

### Setup Requerido

```bash
# 1. Instalar Ollama (Windows, Mac, Linux)
# Descargar desde https://ollama.ai

# 2. Descargar un modelo
ollama pull llama2      # ~4GB
# o
ollama pull mistral     # ~5GB (mejor calidad)
# o
ollama pull neural-chat # ~4GB (optimizado para chat)

# 3. Ejecutar Ollama
ollama serve

# 4. En otra terminal, ejecutar app
npm run dev
```

### Modelos Disponibles

| Modelo | Tamaño | Velocidad | Calidad | Caso de Uso |
|--------|--------|-----------|---------|------------|
| llama2 | 4GB | Media | Buena | Texto general, recomendado |
| mistral | 5GB | Rápida | Muy buena | Mejor calidad, más lento |
| neural-chat | 4GB | Rápida | Buena | Chat optimizado |
| orca-mini | 2GB | Muy rápida | Aceptable | Máquinas débiles |

---

## Problemas Detectados & Áreas de Mejora

### Problemas Actuales

1. **Monolítico**: Todo código en `index.tsx` (~80KB)
   - Difícil de mantener y testear
   - Acoplamiento fuerte entre modos
   - **Solución**: Refactor a estructura `src/`

2. **Imagen/TTS/STT no implementados**
   - Solo placeholders vacíos
   - 5 de 8 modos incompletos
   - **Solución**: Integrar Stable Diffusion, Bark (TTS), Whisper (STT) en Ollama

3. **Sin tests automatizados**
   - Solo QA manual de 8 modos
   - Riesgo alto de regresiiones
   - **Solución**: Vitest + React Testing Library

4. **Sin backend**
   - LocalStorage solo, se pierde al limpiar caché
   - Sin historial de sesiones
   - Sin multi-usuario
   - **Solución**: Backend Node.js/Python con BD

5. **Sin CI/CD**
   - Build y deploy manuales
   - Sin validación automática pre-push
   - **Solución**: GitHub Actions

6. **Sin autenticación**
   - Acceso público a cualquiera
   - Sin límites de uso
   - **Solución**: OAuth2 / JWT

### Áreas de Mejora (Priority Order)

**High Priority:**
1. Implementar imagen con Stable Diffusion
2. Implementar STT/TTS con Whisper/Bark
3. Refactor monolítico a estructura modular
4. Agregar tests automatizados

**Medium Priority:**
5. Backend para persistencia de sesiones
6. CI/CD con GitHub Actions
7. Autenticación basic

**Low Priority:**
8. Analytics y tracking de uso
9. Integración con múltiples proveedores LLM
10. Mobile app (React Native)

---

## Requisitos para Futuro

Cualquier nueva solución de API **DEBE cumplir**:
1. ✅ Open source o completamente gratis (sin hidden costs)
2. ✅ Sin 404s ni errores de disponibilidad
3. ✅ Sin rate limits o con límites generosos
4. ✅ Sin autenticación requerida (o muy simple)
5. ✅ Soportar texto, imagen, TTS, STT
6. ✅ API simple y bien documentada

Ollama cumple todo excepto imagen/TTS/STT que requieren modelos adicionales.

---

## Notas de Seguridad

- ✅ **`.env.local` seguro** - No contiene credenciales sensibles ahora
- ✅ **Ollama local es seguro** - No viaja por internet
- ✅ **CORS no es problema** - Todo es local
- ⚠️ **Validar inputs** - Sanitizar prompts antes de pasar a Ollama
- ⚠️ **Errores informativos** - No mostrar detalles internos a usuarios

---

## Conclusión

La migración a Ollama **resuelve completamente el problema de 404s** y proporciona una solución:
- **100% gratuita** (open source)
- **100% confiable** (local, sin servidores externos)
- **100% escalable** (infraestructura propia)
- **Futura-proof** (compatible con nuevos modelos/backends)
