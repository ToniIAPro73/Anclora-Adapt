# Anclora Adapt – Guía de despliegue y verificación

Esta guía documenta la fase 5 del plan de acción: empaquetar el frontend y backend en contenedores, exponer variables de entorno para alternar proveedores y describir los pasos de verificación antes de cada liberación.

## 1. Contenedores multi-stage

### Frontend (`Dockerfile.frontend`)

- Basado en `node:20-slim` con `npm ci` en una etapa dedicada a dependencias.
- Parámetros `ARG` para todos los `VITE_*`. Permiten cambiar endpoints sin modificar el código (`docker compose` los lee desde `docker/.env.docker`).
- Artefacto final servido por `nginx` con configuración SPA (`deploy/nginx/default.conf`).

### Backend (`Dockerfile.backend`)

- Basado en `python:3.11-slim` con instalación de dependencias en `/install` para cachear capas.
- Volúmenes declarados para `models` y `cache`, permitiendo persistir descargas de Ollama y análisis.
- Variables `DATABASE_URL`, `ANCLORA_MASTER_KEY`, `LINKEDIN_*` se leen desde `docker/.env.docker`.

## 2. Orquestación (`docker-compose.yml`)

Servicios incluidos:

| Servicio  | Puerto | Notas |
| --------- | ------ | ----- |
| `backend` | 8000   | FastAPI con healthcheck (`/api/health`) y volúmenes `backend-models`, `backend-cache`. |
| `frontend`| 4173   | Nginx sirviendo `dist/`. |
| `postgres`| 5432   | Base de datos de referencia activable con `--profile local-db`. Si ya tienes `anclora-postgres`, omite este perfil y apunta `DATABASE_URL` a dicha instancia. |

### 2.1. Asegurar que el backend vea el hardware real

Docker, por defecto, puede limitar la GPU/VRAM y la memoria que oye FastAPI, por lo que `/api/system/capabilities` devuelve valores inventados (CPU only, 16 GB de RAM). A partir de esta versión:

1. El servicio `backend` pasa la GPU al contenedor usando `deploy.resources.reservations.devices` (reconocido por Docker Compose V2 cuando `nvidia-container-toolkit` está activo). Asegúrate de tenerlo instalado y configurado antes de ejecutar:

   ```bash
   docker compose --env-file .env.local up --build backend frontend
   ```

2. Los portales pueden sobreescribir la detección automática con las variables `HOST_CPU_CORES`, `HOST_CPU_THREADS`, `HOST_RAM_GB`, `HOST_STORAGE_GB`, `HOST_GPU_MODEL`, `HOST_GPU_VRAM_GB` y `HOST_HAS_CUDA`. Si en tu entorno Docker la GPU o la RAM no son detectadas correctamente, configura esos valores reales en `.env.local` (por ejemplo `HOST_RAM_GB=32`) para que el frontend muestre tus 4 GB VRAM y 32 GB RAM.

3. Comprueba que la información ya es válida:

   ```bash
   curl http://localhost:8000/api/system/capabilities
   ```

   Deberías ver el modelo de GPU como `RTX ...` y los GB de VRAM/RAM correctos. Si falta la GPU, revisa que `nvidia-container-toolkit` esté instalado y que el sistema ejecute `docker compose` con `device_requests`.

### Variables y volúmenes

### Usar la base incluida

1. Copia `docker/.env.docker.example` a `docker/.env.docker`.
2. Ejecuta el stack completo (incluyendo PostgreSQL embebido):

```bash
docker compose --profile local-db up --build
```

Los volúmenes `backend-models`, `backend-cache` y `pgdata` guardan modelos y datos entre reinicios.

### Conectar a un `anclora-postgres` existente

1. Ajusta `DATABASE_URL` en `docker/.env.docker` o `python-backend/.env.local` para que apunte a tu contenedor existente, por ejemplo `postgresql://anclora_user:Anc1ora%402024%21Secure@anclora-postgres:5432/anclora_db`.
2. Asegúrate de que el backend pueda resolver el host (conecta ambos contenedores a la misma red o expón PostgreSQL en el host y usa `host.docker.internal`).
3. Levanta solo frontend + backend:

```bash
docker compose up --build backend frontend
```

De esta forma no se crea `anclora-adapt-postgres-1` y se reutiliza tu base actual.

## 3. Pipeline CI/CD mínimo

El workflow `.github/workflows/ci.yml` valida cada push/PR:

1. `npm ci`, `npm run lint:check`, `npm run build`.
2. Instala dependencias del backend.
3. Arranca FastAPI (usando PostgreSQL de Actions) y hace `curl http://127.0.0.1:8000/api/health`.
4. Ejecuta `node scripts/check-endpoints.js`, asegurando que los endpoints configurados responden (smoke test).

> Nota: para pruebas completas de generación se necesita un servidor Ollama. Este pipeline confirma que el backend inicia, expone `/api/health` y que los endpoints están configurados correctamente.

## 4. Comandos de verificación antes de liberar

1. **Frontend**
   - `npm run lint:check`
   - `npm run build`
2. **Backend**
   - `python -m compileall python-backend`
   - `uvicorn main:app --reload` y comprobar `/api/health`
3. **Smoke tests**
   - `node scripts/check-endpoints.js`
4. **Manual** – validar los 8 modos en Chrom*:
   - Básico, Inteligente, Campaña, Reciclar, Chat, Voz, Live chat, Imagen.
   - Confirmar persistencia de idioma/tema, manejo de errores y generación con/sin imagen.

Documenta los resultados (capturas/videos) antes de subir a producción.

## 5. Requisitos de hardware por perfil

| Perfil           | CPU/RAM                  | GPU                   | Modos soportados                                    |
| ---------------- | ------------------------ | --------------------- | --------------------------------------------------- |
| **Edge**         | ≥ 8 núcleos / 16 GB RAM  | CPU only              | Básico, Campaña, Reciclar, Chat, TTS (con backend). |
| **Balanced**     | ≥ 12 núcleos / 24 GB RAM | 4 GB VRAM (RTX 3050)  | Todos los modos excepto generación de imagen 8K.    |
| **Pro / Creativo** | ≥ 16 núcleos / 32 GB RAM | ≥ 8 GB VRAM           | Todos los modos en paralelo + análisis profundo.    |

Para despliegues en servidores sin GPU se aconseja usar proveedores cloud (configurables mediante las variables `VITE_*` y `DATABASE_URL`).

## 6. Requisitos manuales de QA

1. Ejecutar `npm run build` y `python main.py`.
2. Probar, en Chromium, cada modo con los siguientes escenarios:
   - **Básico/Reciclar/Campaña**: probar límites de caracteres, traducción literal y plataformas múltiples.
   - **Inteligente**: subir imagen + “Pensamiento profundo” + “Mejorar prompt”.
   - **Chat/Live chat**: conversaciones con 3+ turnos, cambio de modelo “Auto”.
   - **Voz**: STT + TTS (reintentos de permisos).
   - **Imagen**: generar sin imagen y con fallback cuando no hay GPU.
3. Documentar resultados y ejecutar `docker compose up --build` para asegurar que la build containerizada funciona.

Con estos pasos la fase 5 queda cubierta: contenedores multi-stage, orquestación con variables dinámicas, pipeline de verificación y documentación clara de comandos/hardware.
