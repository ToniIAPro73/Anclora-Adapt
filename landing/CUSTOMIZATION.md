# Guía de Personalización - Landing Page

Esta guía te ayuda a personalizar la landing page sin necesidad de modificar HTML.

## 1. Variables CSS Principales

Localiza la sección `:root` en `<style>` y modifica:

```css
:root {
    /* COLORES PRIMARIOS */
    --color-primary: #1C2A47;        /* Azul profundo - headers */
    --color-secondary: #2A2E3E;      /* Azul secundario - fondos gradientes */
    --color-accent: #00BCD4;         /* Cyan - botones, highlights */
    --color-accent-dark: #00A8C8;    /* Cyan oscuro - hover */

    /* COLORES ACENTOS */
    --color-success: #27AE60;        /* Verde - ventajas */
    --color-warning: #FFC979;        /* Ámbar */
    --color-error: #E74C3C;          /* Rojo */

    /* TIPOGRAFÍA */
    --font-family: 'Inter', sans-serif;  /* Cambiar fuente */
    --font-size-h1: clamp(1.75rem, 5vw, 3.5rem);

    /* ESPACIADO */
    --spacing-lg: 2rem;
    --spacing-xl: 3rem;
    --spacing-2xl: 4rem;

    /* EFECTOS */
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --shadow-lg: 0 20px 60px rgba(0, 0, 0, 0.15);
}
```

## 2. Cambiar Esquema de Colores

### Opción A: Tema Oscuro Moderno
```css
:root {
    --color-primary: #0A1428;
    --color-secondary: #111729;
    --color-accent: #FF6B6B;
    --color-white: #E8E8E8;
    --color-light: #1A1F3A;
}
```

### Opción B: Tema Tech Minimalista
```css
:root {
    --color-primary: #001F3F;
    --color-secondary: #003D82;
    --color-accent: #00D9FF;
    --color-success: #00FF88;
}
```

### Opción C: Tema Cálido
```css
:root {
    --color-primary: #8B4513;
    --color-accent: #FF7F50;
    --color-success: #FFD700;
}
```

## 3. Modificar Tipografía

### Agregar fuente desde Google Fonts
En `<head>`, reemplaza:
```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
```

Y en CSS:
```css
--font-family: 'Poppins', sans-serif;
```

### Opciones recomendadas:
- **Moderno**: `Poppins`, `Plus Jakarta Sans`, `Space Grotesk`
- **Elegante**: `Playfair Display`, `Cormorant Garamond`
- **Tech**: `IBM Plex Mono`, `JetBrains Mono`

## 4. Ajustar Animaciones

### Desactivar animaciones
```css
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0 !important;
        transition-duration: 0 !important;
    }
}
```

### Cambiar velocidad
```css
--transition: all 0.5s ease-out;  /* Más lenta */
--transition-fast: all 0.1s ease-out;  /* Más rápida */
```

### Modificar animación hero
```css
@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-30px);  /* Más distancia */
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

## 5. Cambiar Sombras y Bordes

```css
/* Sombras más pronunciadas */
--shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.15);
--shadow-md: 0 12px 32px rgba(0, 0, 0, 0.2);
--shadow-lg: 0 24px 80px rgba(0, 0, 0, 0.25);

/* Bordes redondeados */
--border-radius: 16px;  /* Más redondeado */
--border-radius: 4px;   /* Más cuadrado */
```

## 6. Personalizar Cards

### Efecto elevación más dramático
```css
.feature-card:hover {
    transform: translateY(-12px);  /* Más arriba */
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
}
```

### Agregar borde completo en hover
```css
.feature-card:hover {
    border: 2px solid var(--color-accent);
    border-left: 4px solid var(--color-accent);
}
```

### Cambiar color de fondo en hover
```css
.feature-card:hover {
    background: linear-gradient(135deg, var(--color-accent) 0%, transparent 100%);
}
```

## 7. Modificar Botones

### Botón más grande
```css
.btn {
    padding: 1.25rem 2rem;  /* Más padding */
    font-size: 1.1rem;
}
```

### Botón con borde
```css
.btn-primary {
    border: 2px solid transparent;
    background-clip: padding-box;
}

.btn-primary:hover {
    border-color: var(--color-accent);
}
```

### Botón con icono (requiere HTML)
```css
.btn::before {
    content: '→ ';
    margin-right: 0.5rem;
}
```

## 8. Responsive Customization

### Aumentar tamaño en mobile
```css
@media (max-width: 768px) {
    :root {
        --font-size-h1: 2.5rem;  /* Más grande */
        --spacing-lg: 2.5rem;    /* Más espaciado */
    }
}
```

### Cambiar layout de features
```css
.feature-grid {
    grid-template-columns: 1fr;  /* Una columna */
    grid-template-columns: repeat(2, 1fr);  /* Dos columnas en mobile */
}
```

## 9. Agregar Secciones

```html
<!-- Plantilla para nueva sección -->
<section id="nueva-seccion">
    <div class="container">
        <h2>Título de Sección</h2>
        <p>Contenido aquí</p>
    </div>
</section>

<!-- CSS -->
<style>
#nueva-seccion {
    background-color: var(--color-white);
    padding: var(--spacing-2xl) var(--spacing-lg);
}

#nueva-seccion h2 {
    text-align: center;
    color: var(--color-primary);
    margin-bottom: var(--spacing-2xl);
}
</style>
```

## 10. URLs y Links

Para cambiar URLs, busca y reemplaza:

```html
<!-- Descargar -->
<a href="https://drive.google.com/drive/folders/...">

<!-- GitHub -->
<a href="https://github.com/ToniIAPro73/Anclora-Adapt">

<!-- Otros -->
<a href="#features">
```

## 11. Content Editable

### Cambiar headlines
```html
<h1>Tu nuevo título principal</h1>
```

### Cambiar descripciones
```html
<p class="subheadline">Tu nuevo subtítulo</p>
```

### Cambiar copy
Todos los textos están en HTML directo, sin variables. Modifica libremente.

## 12. Performance Tips

- Comprimir imágenes antes de agregar
- Usar `loading="lazy"` en `<img>`
- Minificar CSS si lo copias
- Reducir `--transition` durations si está lento
- Desactivar animaciones en mobile si es necesario

## 13. Validación

Para validar tu HTML:
- Online: https://validator.w3.org/
- Accessibility: https://wave.webaim.org/

## 14. Ejemplos de Cambios Comunes

### A. Cambiar tema a oscuro completo
```css
:root {
    --color-white: #000;
    --color-light: #1a1a1a;
    --color-dark-text: #e0e0e0;
}

body {
    background-color: #000;
    color: #e0e0e0;
}
```

### B. Hacer hero más corto
```css
#hero {
    min-height: 60vh;  /* En lugar de 100vh */
    padding: var(--spacing-xl) var(--spacing-lg);
}
```

### C. Agregar imagen de fondo
```css
#hero {
    background-image: url('tu-imagen.jpg');
    background-size: cover;
    background-position: center;
}

#hero::before {
    background: rgba(28, 42, 71, 0.8);  /* Overlay oscuro */
}
```

## 15. Debugging

Si algo se ve mal:

1. Abre DevTools (F12)
2. Inspecciona el elemento
3. Busca en CSS la variable que controla ese estilo
4. Modifica en `<style>`
5. Recarga la página

Si no cambios nada:
- Limpia cache del navegador (Ctrl+Shift+Delete)
- Desactiva caché en DevTools
- Verifica que estés editando el archivo correcto
