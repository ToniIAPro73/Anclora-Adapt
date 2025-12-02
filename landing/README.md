# Landing Page - Anclora Adapt

Landing page moderna, responsive y accesible para Anclora Adapt.

## Características

✅ **Mobile-First**: Diseño completamente responsive (mobile, tablet, desktop)
✅ **Accesible**: WCAG 2.1 compliance con navegación por teclado
✅ **Moderno**: Animaciones suaves, efectos visuales, gradientes
✅ **Rápido**: HTML puro (sin dependencias externas)
✅ **Botones Operativos**: Todos los CTA vinculados a:

- Descarga (Google Drive)
- GitHub (repositorio)
- Navegación interna (smooth scroll)

## Ejecutar la Landing Page

### Opción 1: Con npm (recomendado)

```bash
npm run dev:landing
```

Luego abre `http://localhost:4173` en tu navegador.

### Opción 2: Con cualquier servidor HTTP

```bash
# Con Python 3
python -m http.server 8000 --directory landing

# Con Node.js (si tienes http-server instalado)
npx http-server landing -p 8000
```

### Opción 3: Abrir directamente

Simplemente abre el archivo `landing/index.html` en tu navegador (sin servidor).

## Secciones

1. **Hero**: Headline principal, badge, CTA primario
2. **Problem**: Dolor de los usuarios actuales
3. **Solution**: Presentación de Anclora Adapt con tabla comparativa
4. **Features**: Grid con 8 modos de funcionamiento
5. **Technical**: Stack tecnológico y requisitos de hardware
6. **CTA**: Call-to-action final
7. **Footer**: Enlaces y copyright

## Efectos Visuales

- **Cards**: Elevación en hover + brillo de borde (glow effect)
- **Botones**: Transformación Y + box-shadow animado
- **Gradientes**: Fondos con animación sutil (drift)
- **Transiciones**: Animaciones con cubic-bezier para suavidad
- **Scroll**: Smooth scroll en navegación interna

## Accesibilidad

- ✅ Contraste de colores WCAG AA
- ✅ Focus visible en todos los elementos interactivos
- ✅ Skip-to-content link
- ✅ Semantic HTML (section, footer, role attributes)
- ✅ Alt text en imágenes
- ✅ Respeta `prefers-reduced-motion`

## Responsividad

- **Desktop** (1024px+): 4 columnas en features, tamaños normales
- **Tablet** (768px-1023px): 2 columnas, ajustes de tipografía
- **Mobile** (480px-767px): 1 columna, botones a ancho completo
- **Mobile Small** (<480px): Versión ultra-compacta

## URLs Configuradas

- **Descarga**: `https://drive.google.com/drive/folders/18PupvacPOEjy0Bytw25IW8SaCcdauYj1?usp=sharing`
- **GitHub**: `https://github.com/ToniIAPro73/Anclora-Adapt`
- **Issues**: `https://github.com/ToniIAPro73/Anclora-Adapt/issues`
- **Discussions**: `https://github.com/ToniIAPro73/Anclora-Adapt/discussions`

## Personalización

### Cambiar colores

Edita las variables CSS en `<style>`:

```css
:root {
  --color-primary: #1c2a47; /* Azul profundo */
  --color-accent: #00bcd4; /* Cyan */
  --color-success: #27ae60; /* Verde */
}
```

### Cambiar tipografía

Modifica `--font-family`:

```css
--font-family: "Tu-Fuente", sans-serif;
```

### Agregar/Editar secciones

Todas las secciones están encapsuladas en `<section id="...">` con contenedor `.container`.

## Performance

- **Zero dependencies**: HTML + CSS + vanilla JavaScript
- **Tamaño**: ~45KB (HTML puro)
- **Load time**: <100ms (en conexión local)
- **LCP (Largest Contentful Paint)**: <1s

## Browser Support

- ✅ Chrome/Chromium 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers modernos

## Notas

- Los botones abren URLs en pestañas nuevas (`target="_blank"`)
- Los enlaces internos usan smooth scroll automático
- Incluye tracking básico de clics (console log)
- Soporta lazy loading de imágenes (con `data-src`)
