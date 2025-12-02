# 🔌 Configuración de Puertos - Anclora Adapt

## Resumen

Para evitar conflictos de puerto entre la aplicación principal (React) y la landing page, se ha configurado lo siguiente:

## Puertos Asignados

### Puerto 4173 - Aplicación Principal (React + Vite)
```bash
npm run dev
# Accede a http://localhost:4173
```

**Qué es:**
- Aplicación React completa con integración Ollama
- 8 modos de funcionamiento
- Sistema de IA local
- Hot reload en desarrollo

**Archivos:**
- `src/index.tsx` - Componente React principal
- `vite.config.ts` - Configuración de Vite
- `index.html` - Punto de entrada

---

### Puerto 4174 - Landing Page
```bash
npm run dev:landing
# Accede a http://localhost:4174
```

**Qué es:**
- Página de marketing estática
- HTML + CSS + JavaScript (sin dependencias)
- 6 secciones (Hero, Problem, Solution, Features, Technical, CTA)
- 9 mejoras premium implementadas

**Archivos:**
- `landing/index.html` - Landing page completa
- `landing/sitemap.xml` - SEO sitemap
- `landing/robots.txt` - Configuración de crawlers
- `landing/assets/` - Recursos (SVG, etc)

---

## ¿Por qué dos puertos diferentes?

### Antes (Conflicto)
- `npm run dev` usaba puerto 4173 (Vite)
- `npm run dev:landing` usaba puerto 4173 (Python HTTP Server)
- **Resultado:** Colisión de puertos, imposible ejecutar ambos simultáneamente

### Ahora (Resuelto)
- `npm run dev` → **Puerto 4173** (aplicación React)
- `npm run dev:landing` → **Puerto 4174** (landing page)
- **Resultado:** Ambos pueden ejecutarse sin conflictos

---

## Cómo ejecutar cada uno

### Ejecutar la aplicación React
```bash
# En una terminal
npm run dev

# Abre http://localhost:4173
```

### Ejecutar la landing page
```bash
# En otra terminal
npm run dev:landing

# Abre http://localhost:4174
```

### Ejecutar ambos simultáneamente
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:landing

# Luego accede a:
# - Aplicación: http://localhost:4173
# - Landing: http://localhost:4174
```

---

## Cambios realizados

### Archivos modificados

1. **package.json**
   - `dev:landing`: `python -m http.server 4173` → `python -m http.server 4174`

2. **landing/index.html**
   - URLs canónicas: `localhost:4173` → `localhost:4174` (6 instancias)
   - Meta tags (og:url, twitter:url, linkedin:url)
   - Imágenes (og:image, twitter:image)

3. **landing/sitemap.xml**
   - Todas las URLs: `localhost:4173` → `localhost:4174` (8 URLs)

4. **landing/robots.txt**
   - Sitemap URL: `localhost:4173/sitemap.xml` → `localhost:4174/sitemap.xml`

5. **landing/README.md**
   - Instrucciones: actualizado a puerto 4174

6. **landing/IMPROVEMENTS.md**
   - Ejemplos de testing: actualizado a puerto 4174

---

## Verificación

Para verificar que todo está funcionando correctamente:

```bash
# Terminal 1: Aplicación React
npm run dev
# Deberías ver: VITE v6.2.0  ready in XXX ms
# ➜  Local:   http://localhost:4173/

# Terminal 2: Landing Page
npm run dev:landing
# Deberías ver: Serving HTTP on 0.0.0.0 port 4174
```

---

## Notas importantes

⚠️ **Puerto 4173 (Aplicación React)**
- Este es el puerto principal de la aplicación
- Mantiene la compatibilidad con configuraciones existentes
- Vite hot reload funciona en este puerto

⚠️ **Puerto 4174 (Landing Page)**
- Este es el puerto alternativo para la landing page
- Usa un servidor HTTP Python simple
- No tiene hot reload (requiere refresh manual)

✅ **Ambos puertos pueden ejecutarse simultáneamente**
- No hay conflictos de puerto
- Cada uno es independiente
- Perfecto para desarrollo completo

---

## Producción

En producción:
- La aplicación React se buildea: `npm run build` → `dist/`
- La landing page se sirve desde `/landing` como recurso estático
- Ambas pueden servirse desde el mismo servidor web (nginx, Apache, etc)

```bash
# Build
npm run build

# Resultado
dist/          # Aplicación React compilada
landing/       # Landing page estática
```

---

## Resumen de puertos

| Servicio | Puerto | Comando | URL |
|----------|--------|---------|-----|
| React + Vite | 4173 | `npm run dev` | http://localhost:4173 |
| Landing Page | 4174 | `npm run dev:landing` | http://localhost:4174 |

---

**Última actualización:** 2 de Diciembre de 2025
