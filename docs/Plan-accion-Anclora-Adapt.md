# Plan de acción priorizado (Anclora-Adapt)

Este plan sintetiza y mejora el documento original `Plan-Anclora-Adapt-Sistema-Universal-Auto-Adaptativo.docx`, estructurándolo en fases priorizadas para lograr un sistema auto-adaptativo y sin fricción.

## Fase 1 · Arquitectura de proveedores universales (prioridad máxima)
- Definir interfaz única para modelos (texto, voz, imagen) con capacidades declaradas y validación en tiempo real.
- Diseñar fallback chain para degradar con gracia: local → cloud económico → cloud premium.
- Centralizar configuración (endpoints, timeouts, límites de tokens, tamaños de imagen/audio) y aplicar circuit breakers.
- Implementar telemetría mínima (latencia, tasa de errores, modelo activo) respetando privacidad.

## Fase 2 · Detección y selección de hardware/proveedor
- Auto-detección de recursos locales (GPU, RAM, CPU) y disponibilidad de Ollama/servicios backend.
- Benchmark rápido de calentamiento (tokens/s, latencia p50/p95) para elegir proveedor por modo.
- Políticas de privacidad: no enviar datos sensibles a cloud si hay capacidad local suficiente.
- Persistir decisiones y permitir override manual para debugging.

## Fase 3 · Provisionamiento automático
- Descarga e inicialización de modelos según modo: texto general, visión, TTS, STT, SDXL.
- Reintentos con retroceso exponencial y verificación de integridad de modelos descargados.
- Gestión de caché y limpieza programada (imágenes, audios, embeddings, SQLite) para mantener rendimiento.
- Scripts de bootstrap: instalación mínima (Ollama, dependencias Python, env vars) y health checks posteriores.

## Fase 4 · Modos adaptativos y experiencia de usuario
- Ajustar prompts y parámetros según capacidades reales detectadas (p. ej., tamaño máximo de imagen, longitud de contexto).
- UI que comunique modo activo y degradaciones («ejecutando en local», «fallback a cloud»).
- Controles offline/online y colas de reintento para operaciones largas (generación de imagen, TTS, uploads grandes).
- Validar outputs multicanal (LinkedIn/X/Instagram/WhatsApp/Email) y traducciones ES/EN sincronizadas.

## Fase 5 · Despliegue y empaquetado (Docker)
- Imágenes multi-stage: frontend (Vite) y backend (FastAPI) con cachés de build para tiempos rápidos.
- Variables de entorno para alternar proveedores sin reimágenes; volúmenes para modelos y cachés persistentes.
- Pipelines CI/CD mínimos: lint/format, build, smoke tests de health endpoints y generación básica en cada modo.
- Documentar comandos de verificación (`npm run build`, pruebas manuales en 8 modos) y requisitos de hardware por perfil.

## Riesgos y mitigaciones
- **Timeouts o bloqueos de modelos** → Circuit breakers, timeouts configurables, fallback chain.
- **Uso de cloud con datos sensibles** → Políticas de privacidad y opt-out explícito; preferencia por local cuando sea viable.
- **Descargas incompletas** → Checksums, reintentos y verificación de integridad antes de activar modelos.
- **Degradación en UX** → Mensajería clara de estado y métricas de latencia para detectar y ajustar.

## Hitos medibles
- ✅ Fase 1 completada cuando exista interfaz única y fallback chain operativa con métricas básicas.
- ✅ Fase 2 completada cuando la app seleccione automáticamente proveedor por modo tras benchmark local.
- ✅ Fase 3 completada con scripts de bootstrap que instalen y validen modelos clave (texto, visión, TTS/STT, SDXL).
- ✅ Fase 4 completada con UI que indique degradaciones y colas de reintento funcionando en operaciones largas.
- ✅ Fase 5 completada con imágenes Docker publicadas y pipeline CI/CD ejecutando build + smoke tests.
