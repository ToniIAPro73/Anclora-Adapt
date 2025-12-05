# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Anclora-Adapt** is a React SPA (Single Page Application) for AI-powered product strategy and analysis. It integrates with **Ollama** (local, open-source AI models) to provide eight distinct operational modes (Básico, Inteligente, Campaña, Reciclar, Chat, Voz, Live Chat, Imagen) that generate multimodal content for different platforms.

**Current Stack:**

- **Frontend**: React 19 + Vite 6 + TypeScript
- **AI Backend**: Ollama (local, open-source, completely free)
- **Styling**: CSS variables (light/dark theme)
- **Languages**: Spanish/English with localStorage persistence

## Prerequisites & Setup

### Ollama Installation & Configuration

Before running the app, **you must have Ollama installed and running**:

```bash
# 1. Download Ollama from https://ollama.ai

# 2. Pull a model (one of these):
ollama pull llama2        # Recommended: 4GB, good quality
ollama pull mistral       # Better quality: 5GB
ollama pull neural-chat   # Chat optimized: 4GB
ollama pull orca-mini     # Lightweight: 2GB

# 3. Start the Ollama server (in a separate terminal)
ollama serve

# Ollama will be available at http://localhost:11434
```

### Environment Configuration

Create `.env.local` (never commit) with:

```bash
# Ollama Configuration (Local, Open Source, Free)
VITE_OLLAMA_BASE_URL=http://localhost:11434

# Model selection (must match what you pulled)
# Options: llama2, mistral, neural-chat, orca-mini, etc.
VITE_TEXT_MODEL_ID=llama2
```

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (hot reload on http://localhost:4173)
# Make sure Ollama is running first!
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

**Important**: All changes require manual QA across all eight modes in Chromium browsers. No automated test suite exists yet.

## High-Level Architecture

### Monolithic Structure

All logic resides in `index.tsx` (~80KB). The application:

1. **Initializes at module load**:

   - Ollama connection parameters (OLLAMA_BASE_URL)
   - Model IDs (TEXT_MODEL_ID, IMAGE_MODEL_ID, TTS_MODEL_ID, STT_MODEL_ID)
   - Translations object (ES and EN in parallel)

2. **Manages single global state** via `App` component with `useState`:

   - `mode`: Current UI mode (Basic, Smart, Campaign, Recycle, Chat, Voice, Live Chat, Image)
   - `theme`: Light/dark/system, persisted to `localStorage`
   - `language`: Spanish/English, persisted to `localStorage`
   - `outputs`: Array of `{ platform, content }` objects for each message
   - Input states, loading flags, error messages

3. **Makes API calls** through dedicated helper functions:

   - `callTextModel(prompt)` → POST to Ollama `/api/generate` endpoint
  - `callImageModel(options)` → Llama al backend FastAPI `/api/image` (SDXL Lightning)
  - `callTextToSpeech(text, voicePreset, language?)` → Invoca FastAPI `/api/tts` (Kokoro-82M)
  - `callSpeechToText(audioBlob)` → Invoca FastAPI `/api/stt` (Faster-Whisper)

4. **Manages Ollama integration**:

   - Direct fetch to `http://localhost:11434/api/generate`
   - No authentication required (local)
   - No proxy needed (local)
   - Simple JSON request/response format

5. **Renders UI** with inline CSS variables for theming (light/dark modes defined in `index.html`)

### Key Flow

```
User Input (text/image/voice)
    → Validate mode-specific logic (build prompt, gather context)
    → Call API helper (callTextModel/callImageModel/etc)
    → Parse response from Ollama
    → Format as { platform, content }
    → Add to outputs array
    → Render to DOM
```

## Important Implementation Details

### callTextModel() - The Core Text Generation

Current implementation (lines 73-98 in `index.tsx`):

```typescript
const callTextModel = async (prompt: string): Promise<string> => {
  if (!TEXT_MODEL_ID) {
    throw new Error("Define VITE_TEXT_MODEL_ID en tu .env.local");
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL_ID,
      prompt: prompt,
      stream: false,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama error: ${response.statusText}. Is Ollama running at ${OLLAMA_BASE_URL}?`
    );
  }

  const payload = await response.json();
  return payload?.response ?? JSON.stringify(payload);
};
```

**Key points:**

- Uses Ollama's standard `/api/generate` endpoint
- No authentication required (local server)
- `stream: false` → complete response, not streaming
- Extracts `.response` field from Ollama's response
- Error messages mention Ollama URL for troubleshooting

### Why Ollama vs. Hugging Face

| Aspect      | Hugging Face Router | Ollama                   |
| ----------- | ------------------- | ------------------------ |
| Cost        | Free                | Free                     |
| 404 Errors  | Frequent            | Never (local)            |
| Rate Limits | Yes (free tier)     | No (local)               |
| CORS Issues | Yes (internet)      | No (local)               |
| Setup       | API key only        | Install + download model |
| Speed       | Network latency     | Local latency            |
| Control     | No                  | Full control             |

**Resolution**: Ollama chosen for 100% reliability and zero error rates.

### Monolithic with Modular Intent

Currently, all code is in `index.tsx`. Future refactor to `src/` structure should:

- Keep the same module boundaries: separate helpers for each model type (callTextModel, callImageModel, etc.)
- Separate components for each mode (BasicMode, SmartMode, CampaignMode, etc.)
- Extract custom hooks: useTheme, useLanguage, useTextModel
- Maintain the `outputs: [{ platform, content }]` format—it's hardcoded in all prompts
- Preserve translation object structure (ES and EN keys at parallel levels)

### Translation Management

The `translations` object contains all UI text. Add new strings in both ES and EN:

```typescript
const translations = {
  es: { key: "Valor en español", ... },
  en: { key: "Value in English", ... }
};
```

Whenever you add UI text, **update BOTH languages** or the app will show missing keys.

### Theming

Colors are CSS variables in `index.html`:

```css
:root {
  --azul-profundo: #23436b;
  --azul-claro: #2eafc4;
  --ambar: #ffc979;
  --gris-fondo: #f6f7f9;
  /* ... */
}

:root[data-theme="dark"] {
  --azul-profundo: #e5edf7;
  /* dark mode variants */
}
```

Dark mode is applied by setting `data-theme="dark"` on root element. Theme preference persists to `localStorage`.

### Model Configuration

Currently only **text generation** is implemented. Other modalities are placeholders:

| Mode      | Text      | Image          | TTS            | STT            | Status         |
| --------- | --------- | -------------- | -------------- | -------------- | -------------- |
| Basic     | ✅ Ollama | —              | —              | —              | ✅ Working     |
| Smart     | ✅ Ollama | ❌ Placeholder | —              | —              | ⚠️ Partial     |
| Campaign  | ✅ Ollama | ❌ Placeholder | —              | —              | ⚠️ Partial     |
| Recycle   | ✅ Ollama | ❌ Placeholder | —              | —              | ⚠️ Partial     |
| Chat      | ✅ Ollama | —              | —              | —              | ✅ Working     |
| Voice     | ✅ Ollama | —              | ❌ Placeholder | ❌ Placeholder | ⚠️ Partial     |
| Live Chat | ✅ Ollama | —              | —              | —              | ✅ Working     |
| Image     | —         | ❌ Placeholder | —              | —              | ❌ Not working |

**Future work**: Integrate image generation (Stable Diffusion), TTS (Bark), STT (Whisper) via Ollama or external APIs.

### Ollama API Reference

Ollama's main endpoint for text generation:

```
POST http://localhost:11434/api/generate
Content-Type: application/json

{
  "model": "llama2",
  "prompt": "What is AI?",
  "stream": false,
  "temperature": 0.4
}

Response:
{
  "model": "llama2",
  "created_at": "2025-11-24T...",
  "response": "AI stands for Artificial Intelligence...",
  "done": true,
  "total_duration": 5000000000,
  "load_duration": 200000000,
  "prompt_eval_count": 10,
  "prompt_eval_duration": 300000000,
  "eval_count": 100,
  "eval_duration": 4500000000
}
```

**Common parameters:**

- `temperature` (0-1): Randomness of output (0=deterministic, 1=creative)
- `stream` (bool): Return complete response or stream chunks
- `num_predict` (int): Max tokens to generate

## Known Limitations & Future Improvements

### Current Limitations

1. **Monolithic codebase** - Everything in `index.tsx` (~80KB)

   - Hard to maintain, test, and extend
   - Strong coupling between modes
   - **Solution**: Refactor to `src/` structure with per-mode components

2. **Text-only implementation** - Placeholders for image, TTS, STT

   - 5 of 8 modes are incomplete
   - **Solution**: Integrate Stable Diffusion, Bark (TTS), Whisper (STT) into Ollama

3. **No automated tests** - Only manual QA of 8 modes

   - High regression risk
   - **Solution**: Add Vitest + React Testing Library

4. **No backend** - `localStorage` only

   - Data lost when cache is cleared
   - No session history across devices
   - No multi-user support
   - **Solution**: Add Node.js/Python backend with database

5. **No CI/CD pipeline** - Build and deploy are manual

   - No automated pre-push validation
   - **Solution**: GitHub Actions with linting, build, test steps

6. **No authentication** - Public access to anyone
   - No usage limits per user
   - **Solution**: OAuth2 or JWT-based auth

### Priority Areas for Improvement

**High Priority:**

1. Implement image generation (Stable Diffusion + Ollama)
2. Implement TTS/STT (Bark/Whisper + Ollama)
3. Refactor monolithic structure to modular `src/` layout
4. Add automated testing (unit + E2E)

**Medium Priority:** 5. Backend with persistent storage 6. CI/CD pipeline (GitHub Actions) 7. Basic authentication & usage limits

**Low Priority:** 8. Analytics and usage tracking 9. Multi-provider LLM support 10. Mobile app (React Native)

## QA Checklist Before PR

1. **Ollama running**: Verify `ollama serve` is active in another terminal
2. **Model available**: Confirm `ollama list` shows your model
3. **All 8 modes tested**:
   - Básico ✓
   - Inteligente ✓
   - Campaña ✓
   - Reciclar ✓
   - Chat ✓
   - Voz ✓
   - Live chat ✓
   - Imagen ✓
4. **Theme persistence**: Light → Dark → Light, reload page → persists
5. **Language persistence**: ES → EN → ES, reload page → persists
6. **Error handling**: No API key error shown gracefully
7. **Build passes**: `npm run build` completes without errors
8. **Console clean**: No TypeScript or runtime errors in browser DevTools

## Troubleshooting

### "Error de Ollama: Failed to fetch. ¿Está Ollama ejecutándose...?"

**Cause**: Ollama server not running or wrong URL
**Solution**:

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Verify it's running
curl http://localhost:11434/api/tags

# Terminal 3: Run the app
npm run dev
```

### "Model not found"

**Cause**: Model in `.env.local` doesn't exist locally
**Solution**:

```bash
ollama list                    # See what you have
ollama pull llama2             # Download a model
# Update VITE_TEXT_MODEL_ID in .env.local
```

### Slow responses

**Cause**: Model is large or running on CPU
**Solution**:

- Use a smaller model: `orca-mini` (~2GB)
- Upgrade GPU support in Ollama settings
- Increase max_tokens or reduce temperature in `callTextModel()`

## Related Documentation

- **AGENTS.md**: Full repository guidelines, commit conventions, security notes
- **CONTEXTO.md**: Historical context, problem analysis, solution decision rationale
- **README.md**: Quick start guide for users
