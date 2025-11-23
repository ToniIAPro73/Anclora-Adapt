# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Anclora-Adapt** is a React SPA (Single Page Application) for AI-powered product strategy and analysis. It integrates with Hugging Face models to provide eight distinct operational modes with text, image, voice, and chat capabilities. The entire application lives in `index.tsx` with inline styling in `index.html`.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (hot reload on http://localhost:4173)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

No test suite exists—all changes require manual QA across all eight modes in Chromium browsers.

## Environment Configuration

Create `.env.local` (never commit) with:

```text
HF_API_KEY=<your_hugging_face_api_key>
VITE_HF_BASE_URL=https://router.huggingface.co/hf-inference  # Optional
VITE_USE_PROXY=true                                           # Use dev proxy in local dev
VITE_TEXT_MODEL_ID=meta-llama/Meta-Llama-3-8B-Instruct       # Optional override
VITE_IMAGE_MODEL_ID=black-forest-labs/FLUX.1-dev             # Optional override
VITE_TTS_MODEL_ID=suno/bark-small                            # Optional override
VITE_STT_MODEL_ID=openai/whisper-large-v3-turbo              # Optional override
```

## High-Level Architecture

### Monolithic Structure

All logic resides in `index.tsx` (currently ~80KB). The application:

1. **Initializes at module load**: Model IDs, API endpoints, proxy configuration, and translations are defined as top-level constants.

2. **Manages single global state** via `App` component with `useState`:

   - `mode`: Current UI mode (Basic, Smart, Campaign, Recycle, Chat, Voice, Live Chat, Image)
   - `theme`: Light/dark/system, persisted to `localStorage`
   - `language`: Spanish/English, persisted to `localStorage`
   - `outputs`: Array of `{ platform, content }` objects for each message
   - UI state for inputs, loading, errors, microphone permissions, etc.

3. **Makes API calls** through dedicated helper functions:

   - `callTextModel()`: POST to TEXT_ENDPOINT with prompt
   - `callImageModel()`: POST to IMAGE_ENDPOINT with text prompt (optional base64 image)
   - `callTextToSpeech()`: POST to TTS_ENDPOINT with text input
   - `callSpeechToText()`: POST to STT_ENDPOINT with audio blob
   - All use `fetchWithFallback()` to try proxy first, then direct Hugging Face endpoint

4. **Manages Hugging Face integration**:

   - In dev: proxies through `/api/hf-*` routes (configured in `vite.config.ts`)
   - In prod: calls Hugging Face Router directly at `https://router.huggingface.co/hf-inference/models/<model_id>`
   - Fallback logic handles 404/410 errors gracefully

5. **Renders UI** with inline CSS variables for theming (light/dark modes defined in `index.html`)

### Key Flow

```text
User Input (text/image/voice)
    → Validate mode-specific logic (build prompt, gather context)
    → Call API helper (callTextModel/callImageModel/etc)
    → Parse response
    → Format as { platform, content }
    → Add to outputs array
    → Render to DOM
```

## Important Implementation Details

### Monolithic with Modular Intent

Currently, all code is in `index.tsx`. When refactoring toward a future `src/` structure:

- Keep the same module boundaries: separate helpers for each model type, separate components for each mode
- Maintain the `outputs: [{ platform, content }]` format throughout—it's hardcoded in prompts
- Preserve translation object structure (ES and EN keys at parallel levels)

### Translation Management

The `translations` object contains all UI text. Add new strings in both ES and EN:

```typescript
const translations = {
  es: {
    /* Spanish keys */
  },
  en: {
    /* English keys */
  },
};
```

### Theming

Colors are CSS variables in `index.html`. Dark mode is applied via `data-theme="dark"` on the root element. Theme preference persists to `localStorage` and respects system preference if set to "system".

### Model Configuration

Eight modes use specific model combinations. Current defaults (all from Hugging Face, free tier):

| Mode      | Text Model                         | Image Model                           | TTS Model                                | STT Model            |
| --------- | ---------------------------------- | ------------------------------------- | ---------------------------------------- | -------------------- |
| Basic     | mistralai/Mistral-7B-Instruct-v0.1 | —                                     | —                                        | —                    |
| Smart     | mistralai/Mistral-7B-Instruct-v0.1 | stabilityai/stable-diffusion-3-medium | —                                        | —                    |
| Campaign  | mistralai/Mistral-7B-Instruct-v0.1 | stabilityai/stable-diffusion-3-medium | —                                        | —                    |
| Recycle   | mistralai/Mistral-7B-Instruct-v0.1 | stabilityai/stable-diffusion-3-medium | —                                        | —                    |
| Chat      | mistralai/Mistral-7B-Instruct-v0.1 | —                                     | —                                        | —                    |
| Voice     | mistralai/Mistral-7B-Instruct-v0.1 | —                                     | espnet/kan-bayashi_libritts_xvector_vits | openai/whisper-small |
| Live Chat | mistralai/Mistral-7B-Instruct-v0.1 | —                                     | —                                        | —                    |
| Image     | —                                  | stabilityai/stable-diffusion-3-medium | —                                        | —                    |

Override via `.env.local` or `vite.config.ts` if needed.

### API Response Parsing

Each model endpoint returns different JSON structures. The helpers normalize them:

- **Text**: Extracts `generated_text` from array or object
- **Image**: Returns base64 PNG
- **TTS**: Returns base64 WAV
- **STT**: Returns transcribed text

### Proxy Configuration

`vite.config.ts` creates dynamic proxy routes. For dev:

- `/api/hf-text` → `<HF_BASE_URL>/models/<TEXT_MODEL_ID>`
- `/api/hf-image` → `<HF_BASE_URL>/models/<IMAGE_MODEL_ID>`
- etc.

In production, these routes are bypassed and calls go directly to Hugging Face Router.

## Branch & Deployment Strategy

The repository uses four synchronized branches:

- **development**: Active development branch
- **main**: Production-ready, used by Vercel for stable deploys
- **preview**: Pre-production validation environment
- **production**: Publicly validated code

Use `./scripts/promote.ps1` to keep all branches in sync. Run with `-DryRun` to preview changes.

## Common Coding Patterns

### Adding a New Mode

1. Add mode name and UI to the mode selector
2. Add translations for the mode in both ES and EN
3. Add state variables (inputs, loading, etc.) to the `App` component
4. Add a conditional render block for the mode's UI
5. Implement the mode's logic in an event handler
6. Ensure output format matches `{ platform, content }` structure

### Adding a New Helper Function

1. Define at module level alongside other helpers (`callTextModel`, etc.)
2. Use `ensureApiKey()` to validate credentials
3. Use `fetchWithFallback()` to handle proxy + direct endpoint logic
4. Return normalized data (strings for text, base64 for images/audio)

### UI Styling

Use inline styles or CSS-in-JS within the JSX. Reference CSS variables from `index.html` for theming consistency:

```javascript
style={{
  color: 'var(--texto)',
  backgroundColor: 'var(--panel-bg)',
  borderColor: 'var(--panel-border)'
}}
```

## API Helper Changes (Latest)

### Text Model (`callTextModel`)

The text model helper was refactored to use the standard Hugging Face Inference API format:

- **Old format**: Used `/chat/completions` endpoint with chat-specific model naming (`model:hf-inference`)
- **New format**: Uses standard `/models/<model_id>` endpoint with `inputs` and `parameters` (consistent with image, TTS, STT)
- **Benefit**: Works with any text generation model (Mistral, Llama, etc.) without special chat formatting

The helper now uses `fetchWithFallback()` like other models, providing better fallback handling and proxy support.

## Known Limitations & Future Improvements

1. **No automated test suite**: All validation is manual. Consider adding Vitest or React Testing Library.
2. **Monolithic file**: No module separation. Plan migration to `src/` structure with per-mode files.
3. **Browser-only storage**: Uses `localStorage` for theme/language; no backend persistence.
4. **No CI/CD pipeline**: Builds and deploys are manual via Vercel integrations.
5. **Voice mode requires microphone**: Gracefully falls back if permission denied.

## Security Notes

- Never commit `.env.local` or expose `HF_API_KEY`
- API keys are injected at build time via `vite.config.ts` and available in `process.env`
- All Hugging Face calls require valid Bearer token authorization
- CORS handled by proxy in dev; direct calls in prod use Hugging Face Router (CORS-enabled)

## QA Checklist Before PR

1. Test all 8 modes in light and dark theme
2. Test language toggle (ES ↔ EN) and verify it persists after page reload
3. Test theme toggle (Light ↔ Dark ↔ System) and verify persistence
4. Run `npm run build` and confirm no TypeScript errors
5. Test microphone/speaker functionality in Voice mode
6. Verify error messages display gracefully when API key is missing
7. Confirm outputs format matches `{ platform, content }` structure
8. Clear `localStorage` and verify theme/language defaults correctly

## Related Documentation

- **AGENTS.md**: Repository guidelines, commit conventions, model names, and coding style
- **CONTEXTO.md**: Recent changes to Hugging Face router integration and 404 error handling
- **scripts/README.md**: Detailed guide for `promote.ps1` and branch synchronization
