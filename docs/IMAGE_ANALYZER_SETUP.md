# Image Analyzer Setup Guide

## Overview

The Image Analyzer feature automatically analyzes uploaded images and generates detailed prompts for image generation. It uses:

- **CLIP (openai/clip-vit-base-patch32)**: Visual feature extraction and analysis
- **Ollama (mistral model)**: Natural language prompt refinement
- **FastAPI**: REST API endpoints with streaming support
- **React Hook**: Frontend integration with auto-generation

## Prerequisites

### System Requirements

- **Python**: 3.9+
- **CUDA**: 12.1 (for GPU acceleration)
- **VRAM**: 4GB minimum (tested on RTX 3050)
- **Ollama**: Running instance with mistral model
- **RAM**: 8GB+ recommended

### Ollama Setup

Before running the image analyzer, ensure Ollama is installed and running:

#### Windows

1. Download from [ollama.ai](https://ollama.ai)
2. Install and launch the application
3. Verify it's running: Open `http://localhost:11434` in browser

#### Linux/Mac

```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve  # Start Ollama daemon
```

#### Download Mistral Model

In another terminal:

```bash
ollama pull mistral:latest
```

Verify:

```bash
curl http://localhost:11434/api/tags
```

## Backend Setup

### 1. Update Python Dependencies

Add the following to `python-backend/requirements.txt` if not already present:

```
torch>=2.0.0  # or: torch==2.5.1 --index-url https://download.pytorch.org/whl/cu121
transformers>=4.37.0
Pillow>=10.0.0
ollama>=0.0.1
```

Install/update dependencies:

```bash
cd python-backend
pip install --upgrade -r requirements.txt
```

**Note:** First installation takes 10-15 minutes due to PyTorch and transformers dependencies.

### 2. CLIP Model Auto-Download

The CLIP model (`openai/clip-vit-base-patch32`) will be automatically downloaded on first use from HuggingFace. This is ~600MB and happens in the `ImageAnalyzer.__init__()` method.

If you want to pre-download:

```bash
python -c "from transformers import CLIPModel, CLIPProcessor; CLIPModel.from_pretrained('openai/clip-vit-base-patch32')"
```

### 3. Verify Setup

Check that image analyzer can initialize:

```bash
python -c "from app.services.image_analyzer import ImageAnalyzer; a = ImageAnalyzer(); print('✓ Image Analyzer initialized')"
```

Expected output:

```
Loading CLIP model: openai/clip-vit-base-patch32
ImageAnalyzer initialized on cuda
✓ Image Analyzer initialized
```

## API Endpoints

### POST `/api/images/analyze`

Synchronous image analysis with complete response.

**Request:**

```bash
curl -X POST http://localhost:8000/api/images/analyze \
  -F "image=@Captura.png" \
  -F "user_prompt=A beautiful landscape" \
  -F "deep_thinking=false"
```

**Parameters:**

- `image` (file, required): Image to analyze
- `user_prompt` (string, optional): User input for prompt refinement
- `deep_thinking` (boolean, default: false): Detailed analysis mode

**Response:**

```json
{
  "success": true,
  "generatedPrompt": "A serene landscape photograph with warm golden hour lighting...",
  "analysis": {
    "style": [
      {"value": "photorealistic", "score": 0.95},
      {"value": "digital art", "score": 0.12},
      {"value": "watercolor", "score": 0.08}
    ],
    "mood": [...],
    "composition": [...],
    "color_palette": [...],
    "subjects": [...]
  },
  "userInput": "A beautiful landscape"
}
```

### POST `/api/images/analyze-stream`

Streaming analysis with Server-Sent Events for progressive updates.

**Request:**

```bash
curl -X POST http://localhost:8000/api/images/analyze-stream \
  -F "image=@image.jpg" \
  -F "user_prompt=A beautiful landscape" \
  -F "deep_thinking=false"
```

**Response Stream:**

```
data: {"status": "analyzing", "message": "Analyzing image..."}

data: {"status": "analyzed", "analysis": {...}}

data: {"status": "generating", "message": "Generating prompt..."}

data: {"status": "complete", "generatedPrompt": "..."}
```

### GET `/api/images/health`

Health check for image analyzer service.

**Response:**

```json
{
  "status": "ok",
  "service": "image-analyzer",
  "analyzer_initialized": true
}
```

## Frontend Integration

### 1. React Hook Usage

The `useImageAnalyzer` hook handles all image analysis logic:

```typescript
import { useImageAnalyzer } from "@/hooks/useImageAnalyzer";

function MyComponent() {
  const { analyzeImage, isAnalyzing, error, generatedPrompt, analysis } =
    useImageAnalyzer();

  const handleImageSelect = async (imageFile: File) => {
    const result = await analyzeImage(imageFile, "optional user input", false);
    if (result.success) {
      console.log("Generated prompt:", result.generatedPrompt);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files?.[0]) handleImageSelect(e.target.files[0]);
        }}
      />
      {isAnalyzing && <p>Analyzing...</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

### 2. Intelligent Mode Integration

The `IntelligentModeImageOptions` component automatically:

- Detects when an image is selected
- Calls `analyzeImage()` via the hook
- Auto-populates the prompt textarea with generated prompt
- Shows loading state during analysis
- Displays error message if analysis fails

No additional changes needed in your component code - it's already integrated!

## Environment Configuration

Update `.env.local` in the frontend:

```env
# Image Analyzer Backend
VITE_API_BASE_URL=http://localhost:8000
```

The API URL is read from:

```typescript
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
```

## Docker Setup (Optional)

### docker-compose.yml

Create `docker-compose.yml` in the project root:

```yaml
version: "3.8"

services:
  # Ollama Service
  ollama:
    image: ollama/ollama:latest
    container_name: anclora-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0:11434
    # Pull mistral on startup
    command: /bin/sh -c "ollama pull mistral:latest && ollama serve"
    profiles:
      - with-ollama

  # FastAPI Backend
  backend:
    build:
      context: ./python-backend
      dockerfile: Dockerfile
    container_name: anclora-backend
    ports:
      - "8000:8000"
    volumes:
      - ./python-backend:/app
      - clip_cache:/root/.cache # CLIP model cache
      - ollama_data:/root/.ollama # Ollama models
    environment:
      - DEVICE=cuda # or 'cpu'
      - OLLAMA_HOST=http://ollama:11434 # Internal network reference
    depends_on:
      - ollama
    profiles:
      - with-ollama

volumes:
  ollama_data:
  clip_cache:
```

### Dockerfile

Create `python-backend/Dockerfile`:

```dockerfile
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

WORKDIR /app

# Install Python and pip
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run application
CMD ["python", "main.py"]
```

### Running with Docker

```bash
# Start with Ollama
docker-compose --profile with-ollama up -d

# Verify services
docker-compose ps

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

## Performance Optimization

### VRAM Usage

The image analyzer uses float16 precision on GPU to minimize VRAM usage:

```python
if self.device == "cuda":
    self.clip_model = self.clip_model.half()  # float16
```

**Expected VRAM usage on RTX 3050 (4GB):**

- CLIP model: ~2.5GB
- Ollama mistral: ~4GB (on separate process)
- Buffer: ~1.5GB available for operations

### Image Size Handling

Images are automatically resized to 512x512 for analysis:

```python
image = image.resize((512, 512))
```

This balances accuracy with speed. For faster analysis on low-end hardware, modify in `image_analyzer.py`:

```python
# Faster but less accurate
image = image.resize((256, 256))
```

## Troubleshooting

### Error: "Failed to initialize ImageAnalyzer"

**Cause:** CLIP model download failed or torch not installed

**Solution:**

```bash
# Reinstall PyTorch with CUDA support
pip install torch --index-url https://download.pytorch.org/whl/cu121

# Or for CPU-only
pip install torch

# Clear cache and retry
pip cache purge
python -c "from transformers import CLIPModel; CLIPModel.from_pretrained('openai/clip-vit-base-patch32')"
```

### Error: "Ollama connection error"

**Cause:** Ollama service not running or mistral model not downloaded

**Solution:**

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Pull mistral if not present
ollama pull mistral:latest

# Or start Ollama
ollama serve
```

### Error: "CUDA out of memory"

**Cause:** GPU VRAM exhausted

**Solution:**

1. Close GPU-intensive applications (Chrome, games, Adobe)
2. Reduce image size in `image_analyzer.py` (line 111):
   ```python
   image = image.resize((256, 256))  # Reduce from 512
   ```
3. Use CPU-only mode (slower):
   ```python
   self.device = "cpu"  # In __init__
   ```

### Error: "Image file too large"

**Cause:** File exceeds 20MB limit

**Solution:** Compress image before uploading. Max file size is set in `image_analysis.py:58`:

```python
if len(contents) > 20 * 1024 * 1024:  # Change this value
```

### Slow image analysis

**Cause:** Model downloading or first-time initialization

**Solution:**

- First request downloads CLIP model (~600MB) - this is normal
- Subsequent requests are much faster
- For faster responses on repeated images, consider caching results

## Configuration Parameters

### ImageAnalyzer

In `app/services/image_analyzer.py:__init__()`:

```python
clip_model_name: str = "openai/clip-vit-base-patch32"  # Change model
ollama_host: str = "http://localhost:11434"             # Ollama server
ollama_model: str = "mistral:latest"                    # LLM model
```

### Prompt Generation

In `app/services/image_analyzer.py:_generate_prompt()`:

```python
# Temperature control
"temperature": 0.7 if deep_thinking else 0.5,  # 0-1, higher = more creative

# Token limits
"num_predict": 300 if deep_thinking else 150,  # Max tokens in response
```

### Analysis Categories

In `app/services/image_analyzer.py:_analyze_visual_elements()`:

Modify the `categories` dictionary to customize what aspects are analyzed:

```python
categories = {
    "style": [...],          # Artistic style
    "mood": [...],           # Emotional tone
    "composition": [...],    # Layout/framing
    "color_palette": [...],  # Colors
    "subjects": [...],       # Objects/subjects
}
```

## Next Steps

1. **Test the API** using curl or Postman
2. **Monitor performance** with `docker-compose logs`
3. **Adjust parameters** based on your hardware
4. **Integrate results** into image generation workflow
5. **Cache results** for repeated images (future enhancement)

## Additional Resources

- [CLIP Documentation](https://github.com/openai/CLIP)
- [Ollama Documentation](https://ollama.ai)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [Project Documentation](./CONTEXTO.md)
- [Hardware Profiles](../python-backend/hardware_profiles.py)

## Support

For issues:

1. Check this guide's troubleshooting section
2. Review backend logs: `python-backend/logs/` (if enabled)
3. Check CLIP cache: `~/.cache/huggingface/hub/`
4. Verify Ollama: `curl http://localhost:11434/api/tags`
5. Consult `docs/ANALISIS_MODELO_CLI.md` for detailed architecture
