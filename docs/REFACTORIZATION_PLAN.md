# Plan de Refactorización del Frontend - Anclora Adapt

## Objetivo
Desmonolitar `src/App.tsx` (~80KB) en una arquitectura modular y escalable.

## Estructura Target

```
src/
├── components/
│   ├── modes/
│   │   ├── BasicMode.tsx
│   │   ├── SmartMode.tsx
│   │   ├── CampaignMode.tsx
│   │   ├── RecycleMode.tsx
│   │   ├── ChatMode.tsx
│   │   ├── VoiceMode.tsx
│   │   ├── LiveChatMode.tsx
│   │   └── ImageMode.tsx
│   │
│   ├── common/
│   │   ├── Header.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── ThemeSwitcher.tsx
│   │   ├── LanguageSelector.tsx
│   │   └── OutputDisplay.tsx
│   │
│   └── layout/
│       └── MainLayout.tsx
│
├── hooks/
│   ├── useTheme.ts          ← useTheme, useLanguage extraction
│   ├── useLanguage.ts
│   ├── useTextModel.ts
│   ├── useTTS.ts            ← Nuevo, conecta con backend FastAPI
│   ├── useSTT.ts            ← Nuevo, conecta con backend FastAPI
│   └── useImageGeneration.ts
│
├── services/
│   ├── api.ts               ← CAMBIO CRÍTICO: http://localhost:8000
│   ├── models.ts
│   ├── audio.ts             ← TTS/STT helpers
│   ├── image.ts
│   └── backend.ts           ← Comunicación con FastAPI
│
├── context/
│   ├── InteractionContext.tsx ← Estado global unificado
│   ├── ThemeContext.tsx      ← Extraído
│   └── LanguageContext.tsx   ← Extraído
│
├── types/
│   ├── modes.ts             ← Tipos para cada modo
│   ├── api.ts               ← Tipos de respuestas API
│   └── index.ts             ← Exports centralizados
│
├── App.tsx                  ← SIMPLIFICADO: Solo routing y providers
├── main.tsx
├── vite-env.d.ts
└── styles.css
```

---

## Fases de Refactorización

### **FASE 1.1: Creación de Contextos Globales**

**Objetivo:** Centralizar estado (theme, language, models)

Archivos a crear:
1. `src/types/index.ts` - Tipos compartidos
2. `src/context/InteractionContext.tsx` - Estado unificado
3. `src/context/ThemeContext.tsx` - Estado de tema
4. `src/context/LanguageContext.tsx` - Estado de idioma

**Impacto:** Todos los componentes peuvent acceder a `useContext()` sin prop drilling

---

### **FASE 1.2: Refactorización de Servicios (APIs)**

**Objetivo:** Migrar de `callTextModel()`, `callImageModel()` a llamadas HTTP unificadas

**CAMBIOS CRÍTICOS:**

```typescript
// ANTES (src/App.tsx)
const callTextModel = async (prompt: string) => {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {...})
  return response.json()
}

// DESPUÉS (src/services/api.ts)
import { API_BASE_URL } from '@/config'

export const ApiService = {
  // Llamadas al backend unificado
  async generateTTS(text: string, voice: string) {
    const response = await fetch(`${API_BASE_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text, voice_preset: voice })
    })
    return response.blob()
  },

  async transcribeAudio(audioBlob: Blob) {
    const formData = new FormData()
    formData.append('file', audioBlob)
    const response = await fetch(`${API_BASE_URL}/api/stt`, {
      method: 'POST',
      body: formData
    })
    return response.json()
  }
}
```

**Archivos a crear/modificar:**
1. `src/services/api.ts` - Interfaz centralizada con backend
2. `src/services/audio.ts` - Helpers para TTS/STT
3. `src/services/image.ts` - Generación de imágenes
4. `src/config.ts` - URLs de endpoints (NEW)

---

### **FASE 1.3: Custom Hooks**

**Objetivo:** Extraer lógica de React en hooks reutilizables

**Hooks a crear:**

1. **`useTheme.ts`**
   ```typescript
   const { theme, setTheme } = useTheme()
   ```

2. **`useLanguage.ts`**
   ```typescript
   const { language, setLanguage } = useLanguage()
   ```

3. **`useTTS.ts`** (NUEVO - CRÍTICO)
   ```typescript
   const { generateTTS, isLoading, error } = useTTS()
   // Usa nuevo backend FastAPI en lugar de pyttsx3
   ```

4. **`useSTT.ts`** (NUEVO - CRÍTICO)
   ```typescript
   const { transcribe, isLoading } = useSTT()
   // Usa Faster-Whisper del backend
   ```

5. **`useTextModel.ts`**
   ```typescript
   const { generate, isLoading } = useTextModel('qwen2.5:7b')
   // Mantiene Ollama para LLM
   ```

6. **`useImageGeneration.ts`** (NUEVO)
   ```typescript
   const { generate, isLoading } = useImageGeneration()
   // Usa SDXL Lightning del backend
   ```

---

### **FASE 1.4: Extracción de Componentes (Modos)**

**Objetivo:** Cada modo UI es un componente independiente

**Estructura:**

```typescript
// src/components/modes/VoiceMode.tsx
import { useTTS } from '@/hooks/useTTS'
import { useLanguage } from '@/hooks/useLanguage'

export const VoiceMode: React.FC = () => {
  const { generateTTS, isLoading } = useTTS()
  const { language } = useLanguage()

  return (
    <div>
      {/* UI específica de Voz */}
      {/* Llama a generateTTS() del hook, NO a pyttsx3 */}
    </div>
  )
}
```

**Componentes a crear:**
- `src/components/modes/BasicMode.tsx`
- `src/components/modes/SmartMode.tsx`
- `src/components/modes/CampaignMode.tsx`
- `src/components/modes/RecycleMode.tsx`
- `src/components/modes/ChatMode.tsx`
- `src/components/modes/VoiceMode.tsx` ← Refactorizado para nuevo backend
- `src/components/modes/LiveChatMode.tsx`
- `src/components/modes/ImageMode.tsx`

---

### **FASE 1.5: Simplificación de App.tsx**

**ANTES:** 80KB monolito

**DESPUÉS:**
```typescript
// src/App.tsx
import { InteractionProvider } from '@/context/InteractionContext'
import { BasicMode } from '@/components/modes/BasicMode'
import { VoiceMode } from '@/components/modes/VoiceMode'
// ... etc

export default function App() {
  const [activeTab, setActiveTab] = useState('basic')

  return (
    <InteractionProvider>
      <MainLayout>
        {activeTab === 'basic' && <BasicMode />}
        {activeTab === 'voice' && <VoiceMode />}
        {/* ... etc */}
      </MainLayout>
    </InteractionProvider>
  )
}
```

**Tamaño esperado:** 1-2KB (solo routing y providers)

---

## Changelog y Cambios Críticos

### **Cambio 1: Endpoint de Backend**

```javascript
// .env.local - ACTUALIZAR
VITE_API_BASE_URL=http://localhost:8000
VITE_TTS_ENDPOINT=http://localhost:8000/api/tts
VITE_STT_ENDPOINT=http://localhost:8000/api/stt
VITE_IMAGE_ENDPOINT=http://localhost:8000/api/image
```

### **Cambio 2: Integración TTS**

```typescript
// ANTES (pyttsx3 en Windows SAPI5)
const callTextToSpeech = async (text: string) => {
  const response = await fetch('http://localhost:9000/tts', {
    method: 'POST',
    body: JSON.stringify({ inputs: text })
  })
  return response.blob()
}

// DESPUÉS (Kokoro en backend FastAPI)
const { generateTTS } = useTTS()
const audio = await generateTTS(text, 'es', 'af_sarah')
```

### **Cambio 3: Integración STT**

```typescript
// ANTES (nada - modo Live Chat no funciona bien)
// DESPUÉS (Faster-Whisper en backend)
const { transcribe } = useSTT()
const text = await transcribe(audioBlob)
```

### **Cambio 4: Integración Imagen**

```typescript
// ANTES (Stable Diffusion 1.5 lento)
// DESPUÉS (SDXL Lightning 4-step rápido)
const { generate } = useImageGeneration()
const image = await generate('Un gato astronauta en el espacio')
```

---

## Pasos de Implementación

### **Paso 1:** Crear Tipos (1 hora)
```bash
# Crear archivo tipos centralizados
touch src/types/index.ts
```

### **Paso 2:** Crear Contextos Globales (1.5 horas)
```bash
# InteractionContext con estado unificado
# ThemeContext, LanguageContext
```

### **Paso 3:** Refactorizar Servicios (2 horas)
```bash
# Crear src/services/api.ts que apunte a http://localhost:8000
# Crear helpers para TTS/STT/Imagen
```

### **Paso 4:** Crear Custom Hooks (2 horas)
```bash
# Crear hooks reutilizables
# Especial énfasis en useTTS, useSTT (NUEVOS)
```

### **Paso 5:** Extraer Componentes (3 horas)
```bash
# Crear componentes para cada modo
# Reemplazar lógica en monolito
```

### **Paso 6:** Simplificar App.tsx (1 hora)
```bash
# Eliminar lógica, dejar solo routing
# Envolver con providers
```

---

## Testing Checklist

Una vez refactorizado:

- [ ] Modo Básico funciona
- [ ] Modo Inteligente funciona
- [ ] Modo Campaña funciona
- [ ] Modo Reciclar funciona
- [ ] Modo Chat funciona
- [ ] **Modo Voz** → Usa backend FastAPI TTS ✓
- [ ] **Modo Live Chat** → Usa backend FastAPI STT ✓
- [ ] Modo Imagen → Usa backend FastAPI SDXL Lightning ✓
- [ ] Theme persiste
- [ ] Idioma persiste
- [ ] No hay errores en console

---

## Estimación de Tiempo

| Fase | Tiempo |
|------|--------|
| 1.1 - Contextos | 1.0 h |
| 1.2 - Servicios | 2.0 h |
| 1.3 - Hooks | 2.0 h |
| 1.4 - Componentes | 3.0 h |
| 1.5 - App.tsx | 1.0 h |
| Testing | 1.0 h |
| **TOTAL** | **10 h** |

**En paralelo con backend:** 10 horas de trabajo frontend mientras se descargan modelos Python en background.

---

## Próximos Pasos

1. ✅ Crear estructura de carpetas (HECHO)
2. ⏳ Comenzar con tipos (src/types/index.ts)
3. ⏳ Crear contextos globales
4. ⏳ Refactorizar servicios
5. ⏳ Crear hooks
6. ⏳ Extraer componentes
7. ⏳ Simplificar App.tsx
8. ⏳ Testing

---

## Notas Importantes

**CRÍTICO:** Una vez backend FastAPI esté corriendo en `http://localhost:8000`, los endpoints de TTS/STT/Imagen cambiarán automáticamente. El frontend debe estar preparado para esta migración.

**Config centralizada:**
```typescript
// src/config.ts (NEW)
export const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8000'
export const OLLAMA_BASE_URL = process.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'
```

**Beneficios finales:**
- ✅ Frontend modular y escalable
- ✅ Fácil de mantener y testear
- ✅ Preparado para nuevas características
- ✅ TTS/STT/Imagen mejorados del backend Python
