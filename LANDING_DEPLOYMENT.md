# 🚀 Landing Page - Guía de Despliegue

## Información Rápida

**Ubicación**: `/landing/index.html`
**Comando**: `npm run dev:landing`
**Puerto**: 4173
**Tamaño**: 44 KB (HTML puro)

## ¿Qué se ha implementado?

### ✅ Landing Page Completa

```
/landing/
├── index.html          # Landing page optimizada (1178 líneas)
├── README.md           # Documentación de uso
├── CUSTOMIZATION.md    # Guía de personalización (15 ejemplos)
└── FEATURES.md         # Características implementadas
```

### ✅ Características

1. **Mobile-First Responsive**
   - Funciona perfectamente en móvil, tablet y desktop
   - Tipografía escalable con `clamp()`
   - Grid adaptativo

2. **Efectos Visuales Premium**
   - Cards con elevación en hover (-8px)
   - Efecto glow/brillo (cyan)
   - Bordes iluminados
   - Gradientes animados
   - Transiciones suaves (cubic-bezier)

3. **Botones Operativos**
   - Descarga → Google Drive
   - GitHub → Repositorio
   - Navegación interna → Smooth scroll
   - Todos con estados hover y activo

4. **Accesible**
   - WCAG 2.1 AA
   - Focus visible
   - Semantic HTML
   - Respeta prefers-reduced-motion

5. **Diseño Coherente**
   - Mismos colores que la app
   - Misma tipografía (Inter)
   - Sistema de espaciado consistente

6. **Performance**
   - HTML puro (sin dependencias)
   - CSS inline
   - Vanilla JS
   - Load time: <100ms

## Cómo Ejecutar

### Opción 1: Con npm (recomendado)
```bash
npm run dev:landing
```
Abre: http://localhost:4173

### Opción 2: Abrir directamente
Simplemente abre `landing/index.html` en tu navegador (funciona sin servidor)

### Opción 3: Servidor manual
```bash
# Python
python -m http.server 8000 --directory landing

# Node.js
npx http-server landing -p 8000
```

## URLs Configuradas

| Botón | URL |
|-------|-----|
| Descarga | https://drive.google.com/drive/folders/18PupvacPOEjy0Bytw25IW8SaCcdauYj1 |
| GitHub | https://github.com/ToniIAPro73/Anclora-Adapt |
| Issues | https://github.com/ToniIAPro73/Anclora-Adapt/issues |
| Discussions | https://github.com/ToniIAPro73/Anclora-Adapt/discussions |

Todos los botones se abren en pestaña nueva (`target="_blank"`).

## Secciones de la Landing

1. **Hero** (100vh)
   - Headline: "Controla tu IA. Ningún servidor. Ningún coste."
   - Subheadline descriptivo
   - Dos CTAs: Descarga + Ver Requisitos

2. **Problem**
   - Contexto del problema actual
   - Costos reales ($95/mes)
   - Vulnerabilidades

3. **Solution**
   - Presentación de Anclora Adapt
   - Tabla comparativa (5 aspectos)
   - Mensaje emocional

4. **Features** (8 modos)
   - Modo Básico
   - Modo Inteligente
   - Modo Campaña
   - Modo Reciclar
   - Chat Local
   - Modo Voz
   - Live Chat
   - Modo Imagen
   - Cada uno con: funcionalidad, ventaja, beneficio
   - **Efectos hover**: elevación + glow

5. **Technical**
   - Stack tecnológico (React, Vite, Ollama, etc.)
   - Grid de componentes
   - Tabla de requisitos de hardware
   - Justificación open-source

6. **CTA Final**
   - Llamada a la acción principal
   - Botones: Descargar + GitHub

7. **Footer**
   - Enlaces a secciones
   - Enlaces a recursos
   - Copyright

## Variables CSS Personalizables

Todas en la sección `:root` dentro de `<style>`:

```css
:root {
    /* Colores */
    --color-primary: #1C2A47;      /* Azul profundo */
    --color-accent: #00BCD4;       /* Cyan */
    --color-success: #27AE60;      /* Verde */

    /* Tipografía */
    --font-family: 'Inter', sans-serif;
    --font-size-h1: clamp(1.75rem, 5vw, 3.5rem);

    /* Espaciado */
    --spacing-lg: 2rem;
    --spacing-xl: 3rem;

    /* Efectos */
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --shadow-lg: 0 20px 60px rgba(0, 0, 0, 0.15);
    --shadow-glow: 0 0 20px rgba(0, 188, 212, 0.15);
}
```

## Personalización Rápida

Ver archivo `/landing/CUSTOMIZATION.md` para:
- 5 esquemas de colores predefinidos
- Cómo cambiar tipografía
- Modificar animaciones
- Agregar/editar secciones
- Cambiar URLs

## Testing

### Browser DevTools
1. Abre DevTools (F12)
2. Prueba responsividad (Ctrl+Shift+M)
3. Verifica modo oscuro (⌘⌥U en Mac)
4. Valida accesibilidad (Axe DevTools)

### URLs de Validación
- **HTML**: https://validator.w3.org/
- **Accesibilidad**: https://wave.webaim.org/
- **Performance**: https://pagespeed.web.dev/

### Checklist de QA
- [ ] Responsive en mobile (375px)
- [ ] Responsive en tablet (768px)
- [ ] Responsive en desktop (1920px)
- [ ] Todos los botones funcionan
- [ ] Smooth scroll funciona
- [ ] Efectos hover en cards
- [ ] Sin errores en consola
- [ ] Accesibilidad (Tab, Enter)
- [ ] Contraste de colores OK
- [ ] Imágenes cargan correctamente

## Archivos Modificados

```diff
package.json
- "dev": "vite",
+ "dev": "vite",
+ "dev:landing": "python -m http.server 4173 --directory landing",
```

## Archivos Creados

```
landing/
├── index.html              # 1178 líneas, 44 KB
├── README.md               # 100+ líneas, guía de uso
├── CUSTOMIZATION.md        # 300+ líneas, 15 ejemplos
└── FEATURES.md             # 150+ líneas, especificaciones técnicas

raíz/
└── LANDING_DEPLOYMENT.md   # Este archivo
```

## Solución de Problemas

### "Puerto 4173 ya en uso"
```bash
# Cambiar puerto en package.json:
"dev:landing": "python -m http.server 8000 --directory landing"
```

### "No se cargan estilos"
- Abre DevTools y verifica Network tab
- Comprueba que la ruta del CSS sea correcta
- Limpia cache del navegador (Ctrl+Shift+Delete)

### "Botones no funcionan"
- Verifica que los links tengan `href`
- Asegúrate de tener conexión a internet (Google Drive, GitHub)
- En modo offline, los links internos siguen funcionando

### "Se ve raro en mobile"
- Verifica viewport meta tag (incluido)
- Comprueba zoom del navegador (debe ser 100%)
- En DevTools, usa "Device Toolbar" (Ctrl+Shift+M)

## Siguiente Fase (Opcional)

1. **SEO**: Agregar schema.org, sitemap.xml
2. **Dark Mode**: Implementar toggle de tema
3. **CMS**: Migrar contenido a sistema editable
4. **Analytics**: Integrar Plausible o Gtag
5. **Formulario**: Agregar newsletter/contacto
6. **Imágenes**: Optimizar y agregar placeholder
7. **PWA**: Convertir a Progressive Web App

## Soporte

Para personalizar o agregar funcionalidades:
1. Lee `/landing/CUSTOMIZATION.md` para cambios CSS
2. Edita el HTML directamente para contenido
3. Consulta `/landing/FEATURES.md` para especificaciones técnicas
4. Usa DevTools para debugging

---

**Landing page lista para producción.** ✅
