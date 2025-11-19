# Repository Guidelines

## Project Structure & Module Organization
La aplicacion es un SPA en React contenido en `index.tsx`; ahi viven los modos de contenido, helpers de audio y las llamadas a Hugging Face. `index.html` define los tokens y estilos base, mientras que la configuracion de Vite y TypeScript reside en `vite.config.ts`, `tsconfig.json` y `package.json`. Nuevos helpers pueden vivir cerca del componente que los usa o en una futura carpeta `src/` si crecen lo suficiente.

## Build, Test, and Development Commands
Despues de `npm install`, arranca con `npm run dev` en <http://localhost:4173>. `npm run build` valida la compilacion de produccion y `npm run preview` permite revisar el empaquetado antes de compartir enlaces.

## Coding Style & Naming Conventions
Todo el código es TypeScript/React funcional. Agrupa los `useState/useEffect` al inicio del componente, usa `const` siempre que sea posible y evita abreviaturas crípticas. La comunicación con Hugging Face debe pasar por helpers centralizados (`callTextModel`, `callImageModel`, etc.) y nunca desde JSX directo.

## Testing Guidelines
No existe una suite automatizada todavia. Verifica manualmente cada modo (texto, voz, live chat e imagen) en Chrome antes de subir cambios. Para logica compleja crea pruebas con Vitest o React Testing Library dentro de carpetas `__tests__`, cubriendo al menos escenarios de error (falta de API key, grabacion cancelada, tiempo de espera del modelo).

## Commit & Pull Request Guidelines
Usa Conventional Commits (`feat:`, `fix:`, etc.) y agrupa cambios por funcionalidad. Cada PR debe incluir resumen, pasos manuales de validación (`npm run build`, capturas de los modos afectados) y variables de entorno necesarias (`HF_API_KEY`). Enlaza issues o tickets relevantes cuando existan.

## Security & Configuration Tips
La app depende de modelos open source consumidos vía Hugging Face, por lo que la variable `HF_API_KEY` es obligatoria en `.env.local`. Nunca incluyas claves en el repositorio ni en logs. Si agregas dependencias nuevas verifica compatibilidad con Vite/ESM y que sean seguras para ejecutarse en el navegador.
