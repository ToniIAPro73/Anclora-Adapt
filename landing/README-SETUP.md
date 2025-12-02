# 📁 Carpeta Landing Page - Guía Completa

Esta carpeta contiene la **landing page completamente autónoma** de Anclora Adapt. Puedes mover esta carpeta a cualquier lugar o eliminarla sin afectar la aplicación principal.

## 📂 Estructura de Carpeta

```
landing/
├── index.html                 # Landing page completa
├── assets/
│   └── anclora-interface.svg # SVG del mockup
├── sitemap.xml               # SEO sitemap
├── robots.txt                # Configuración de crawlers
├── README.md                 # Instrucciones de uso
├── CUSTOMIZATION.md          # Guía de personalización
├── FEATURES.md               # Especificaciones técnicas
├── IMPROVEMENTS.md           # Mejoras implementadas
├── PORT_CONFIGURATION.md     # Configuración de puertos
├── LANDING_DEPLOYMENT.md     # Guía de deployment
├── kill-port.bat             # Script para limpiar puertos (Windows)
├── kill-port.ps1             # Script PowerShell para puertos
└── old-landing-page.html     # Backup de versión anterior
```

## 🚀 Ejecución Rápida

### Opción 1: Usar npm desde la raíz
```bash
npm run dev:landing
# Abre http://localhost:4174
```

### Opción 2: Servir directamente con Python
```bash
cd landing
python -m http.server 4174
# Abre http://localhost:4174
```

### Opción 3: Abrir HTML directamente
```bash
# Simplemente abre landing/index.html en el navegador
```

## 🔌 Configuración de Puertos

- **Puerto 4173**: Aplicación React (npm run dev)
- **Puerto 4174**: Landing Page (npm run dev:landing)

Ver `PORT_CONFIGURATION.md` para más detalles.

## 📋 Archivos Importantes

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Landing page completa (68 KB) con 9 mejoras premium |
| `sitemap.xml` | SEO sitemap con 8 URLs |
| `robots.txt` | Configuración para crawlers |
| `assets/` | Recursos (SVG, imágenes) |
| `IMPROVEMENTS.md` | Documentación de 6 mejoras SEO + 9 premium |

## ✨ Características Implementadas

### 6 Mejoras SEO
✅ Imagen hero profesional (SVG)
✅ Dark mode con toggle y localStorage
✅ Formulario de contacto con validación
✅ Analytics con Plausible
✅ Sitemap dinámico para SEO
✅ Open Graph para redes sociales

### 9 Mejoras Premium
✅ Backdrop filter en badges (blur)
✅ Smooth scroll en toda la página
✅ Transiciones con easing natural
✅ Animaciones sincronizadas
✅ Glow effect dinámico en cards
✅ Pseudo-elementos para efectos visuales
✅ Respeto a prefers-reduced-motion
✅ Focus states visibles
✅ Contraste accesible (WCAG 2.1 AA)

## 🗑️ Para Eliminar la Landing

Si deseas eliminar completamente la landing del proyecto:

1. **Elimina esta carpeta**: `rm -r landing/`
2. **Actualiza package.json**: Elimina el script `"dev:landing"`
3. **Listo**: El proyecto vuelve al estado original

```bash
# La aplicación React seguirá funcionando:
npm run dev  # http://localhost:4173
```

## 📊 Estadísticas

- **Tamaño**: 68 KB (HTML + CSS + JS)
- **Líneas de código**: ~2000
- **Dependencias**: 0 (HTML puro)
- **Animaciones**: 8 keyframes diferentes
- **Easing curves**: 5 (Material Design 3)
- **WCAG Compliance**: 2.1 AA
- **Browser Support**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## 🔧 Scripts Útiles

### Limpiar puerto (Windows)
```bash
# Batch
landing\kill-port.bat

# PowerShell
landing\kill-port.ps1 4174
```

## 📖 Documentación Completa

Dentro de esta carpeta encontrarás:

- **README.md** - Guía de uso rápido
- **IMPROVEMENTS.md** - Detalle de todas las mejoras (11KB)
- **FEATURES.md** - Especificaciones técnicas
- **CUSTOMIZATION.md** - Cómo personalizar colores, fuentes, etc
- **PORT_CONFIGURATION.md** - Configuración avanzada de puertos
- **LANDING_DEPLOYMENT.md** - Guía de deployment a producción

## ✅ Checklist para Producción

- [ ] Cambiar URLs en `sitemap.xml` a dominio real
- [ ] Actualizar meta tags (og:url, twitter:url, etc) en `index.html`
- [ ] Cambiar contactos/enlaces a URLs reales
- [ ] Configurar Plausible Analytics con dominio real
- [ ] Servir con HTTPS
- [ ] Probar en navegadores reales (Chrome, Firefox, Safari, Edge)
- [ ] Verificar sitemap en Google Search Console

## 🆘 Soporte

Para problemas comunes, ver:
- **Puerto ocupado**: `landing/PORT_CONFIGURATION.md`
- **Personalizar**: `landing/CUSTOMIZATION.md`
- **Mejorar performance**: `landing/FEATURES.md`

---

**Última actualización**: 2 de Diciembre de 2025
