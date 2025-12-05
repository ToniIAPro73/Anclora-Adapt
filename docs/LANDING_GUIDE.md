# 📱 Landing Page - Guía de Estructura

## Resumen

La **landing page está completamente aislada** en la carpeta `/landing/`. Esto significa:

✅ Puedes eliminar `/landing/` y la aplicación React seguirá funcionando perfectamente
✅ La landing page es completamente independiente
✅ Cero conflictos entre la aplicación y la landing page

---

## 🏗️ Estructura del Proyecto

```
Anclora-Adapt/
├── src/                    # Código React (aplicación principal)
├── index.html             # Entry point de React (1 KB)
├── vite.config.ts         # Configuración Vite
├── package.json           # Scripts npm
│
├── landing/               # 📍 LANDING PAGE (completamente aislada)
│   ├── index.html         # Landing page (68 KB)
│   ├── assets/            # SVGs, imágenes
│   ├── sitemap.xml        # SEO sitemap
│   ├── robots.txt         # Configuración crawlers
│   ├── README.md          # Instrucciones
│   ├── IMPROVEMENTS.md    # Mejoras implementadas
│   ├── PORT_CONFIGURATION.md
│   ├── LANDING_DEPLOYMENT.md
│   ├── kill-port.bat      # Limpiar puertos (Windows)
│   ├── kill-port.ps1      # Limpiar puertos (PowerShell)
│   └── README-SETUP.md    # Guía de setup
│
├── README.md              # Documentación del proyecto
├── CLAUDE.md              # Instrucciones para Claude Code
├── AGENTS.md              # Información de agentes
├── CONTEXTO.md            # Contexto del proyecto
└── ROADMAP.md             # Roadmap futuro
```

---

## 🚀 Cómo Ejecutar

### Aplicación React (Desarrollo)
```bash
npm run dev
# Abre http://localhost:4173
# Muestra la aplicación React completa
```

### Landing Page (Desarrollo)
```bash
npm run dev:landing
# Abre http://localhost:4174
# Muestra la landing page estática
```

### Ambas Simultáneamente
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:landing

# Accede a:
# - App: http://localhost:4173
# - Landing: http://localhost:4174
```

---

## 🗑️ Para Eliminar la Landing Page

Si deseas eliminar completamente la landing del proyecto:

### Paso 1: Eliminar carpeta
```bash
# Windows
rmdir /s landing

# Linux/Mac
rm -r landing
```

### Paso 2: Actualizar package.json (Opcional)
Si quieres limpiar el script (no afecta si lo dejas):
```json
{
  "scripts": {
    "dev": "vite",
    // "dev:landing": "python -m http.server 4174 --directory landing"  // Comentar o eliminar
  }
}
```

### Paso 3: Verificar
```bash
npm run dev
# Debería ejecutarse perfectamente en http://localhost:4173
```

---

## 📋 Qué Contiene la Landing Page

### Archivos Principales
- **index.html** (68 KB)
  - HTML + CSS + JavaScript integrados
  - 0 dependencias externas
  - 9 mejoras premium incluidas
  - WCAG 2.1 AA compliant

- **assets/anclora-interface.svg** (7 KB)
  - SVG profesional del mockup

- **sitemap.xml**
  - 8 URLs para SEO

- **robots.txt**
  - Configuración para crawlers

### Documentación
- **README.md** - Uso rápido
- **IMPROVEMENTS.md** - Detalles de mejoras
- **FEATURES.md** - Especificaciones
- **CUSTOMIZATION.md** - Personalización
- **PORT_CONFIGURATION.md** - Configuración avanzada
- **LANDING_DEPLOYMENT.md** - Deployment
- **README-SETUP.md** - Guía de setup completa

### Herramientas
- **kill-port.bat** - Limpiar puertos (Windows batch)
- **kill-port.ps1** - Limpiar puertos (PowerShell)

---

## ⚙️ Configuración de Puertos

| Servicio | Puerto | Comando | URL |
|----------|--------|---------|-----|
| **React App** | 4173 | `npm run dev` | http://localhost:4173 |
| **Landing** | 4174 | `npm run dev:landing` | http://localhost:4174 |

**¿Por qué puertos diferentes?**

Inicialmente ambos usaban 4173, causando conflictos. Ahora:
- ✅ React en 4173 (aplicación principal)
- ✅ Landing en 4174 (contenido estático)
- ✅ Ambos pueden ejecutarse simultáneamente

Para más detalles, ver: `landing/PORT_CONFIGURATION.md`

---

## 🎯 Features de la Landing Page

### 6 Mejoras SEO
1. ✅ Imagen hero profesional (SVG)
2. ✅ Dark mode con toggle y localStorage
3. ✅ Formulario de contacto con validación
4. ✅ Analytics (Plausible)
5. ✅ Sitemap dinámico
6. ✅ Open Graph para redes sociales

### 9 Mejoras Premium
1. ✅ Backdrop filter (blur)
2. ✅ Smooth scroll
3. ✅ Easing natural
4. ✅ Animaciones sincronizadas
5. ✅ Glow effect dinámico
6. ✅ Pseudo-elementos visuales
7. ✅ prefers-reduced-motion
8. ✅ Focus states visibles
9. ✅ Contraste WCAG 2.1 AA

---

## 📊 Estadísticas

| Métrica | Valor |
|---------|-------|
| Tamaño total | 68 KB |
| Dependencias | 0 |
| Animaciones | 8 keyframes |
| Easing curves | 5 |
| WCAG Level | 2.1 AA |
| Browsers | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |

---

## ❓ Preguntas Frecuentes

### ¿Qué pasa si elimino `/landing/`?
**Respuesta**: La aplicación React seguirá funcionando perfectamente. El script `dev:landing` fallará, pero puedes comentarlo o borrarlo de `package.json`.

### ¿Puedo ejecutar ambos simultáneamente?
**Respuesta**: Sí, completamente. En terminal 1: `npm run dev`, en terminal 2: `npm run dev:landing`.

### ¿Cómo cambio el puerto de la landing?
**Respuesta**:
```bash
# En package.json, cambia:
"dev:landing": "python -m http.server 4175 --directory landing"
# (De 4174 a 4175, o el que prefieras)
```

### ¿Puedo desplegar la landing a producción?
**Respuesta**: Sí, ver `landing/LANDING_DEPLOYMENT.md` para instrucciones completas.

### ¿Puedo personalizar la landing?
**Respuesta**: Sí, ver `landing/CUSTOMIZATION.md` para cambiar colores, fuentes, etc.

---

## 🔧 Troubleshooting

### "Puerto 4174 no disponible"
```bash
# Solución: Cambiar puerto en package.json
"dev:landing": "python -m http.server 4175 --directory landing"
```

### "Ver landing cuando abro http://localhost:4173"
**Causa**: Proceso viejo de Python ejecutándose en 4173

**Solución Windows**:
```bash
cd landing
kill-port.bat
```

**Solución PowerShell**:
```powershell
cd landing
.\kill-port.ps1 4173
```

---

## 📚 Documentación Completa

Toda la documentación está en `/landing/`:

```bash
cd landing

# Lee cualquiera de estos:
cat README.md                    # Inicio rápido
cat IMPROVEMENTS.md              # Qué se mejoró
cat FEATURES.md                  # Características técnicas
cat CUSTOMIZATION.md             # Personalización
cat PORT_CONFIGURATION.md        # Puertos y networking
cat LANDING_DEPLOYMENT.md        # Desplegar a producción
cat README-SETUP.md              # Guía completa de setup
```

---

## ✅ Próximos Pasos

1. **Para desarrollar**: `npm run dev` (React app)
2. **Para ver landing**: `npm run dev:landing` (en otra terminal)
3. **Para producción**: Seguir guía en `landing/LANDING_DEPLOYMENT.md`
4. **Para personalizar**: Leer `landing/CUSTOMIZATION.md`

---

**Conclusión**: La landing page es completamente **independiente, modular y fácil de eliminar**. La aplicación React funciona perfectamente sin ella.

---

**Última actualización**: 2 de Diciembre de 2025
