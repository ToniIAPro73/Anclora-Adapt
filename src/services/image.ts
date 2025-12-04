/**
 * src/services/image.ts
 *
 * Utilidades para manejo de imágenes
 * Helpers para generación y manipulación de imágenes
 *
 * FASE 1.2 - Refactorización de Servicios
 */

// ==========================================
// IMAGE CONVERSION UTILITIES
// ==========================================

/**
 * Convierte un Blob de imagen a base64
 */
export const imageToBase64 = (imageBlob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const commaIndex = result.indexOf(",");
        resolve(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
      } else {
        reject(new Error("No se pudo convertir imagen a base64"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Error al leer archivo de imagen"));
    };
    reader.readAsDataURL(imageBlob);
  });
};

/**
 * Convierte un Blob de imagen a una URL de objeto
 */
export const imageToObjectUrl = (imageBlob: Blob): string => {
  return URL.createObjectURL(imageBlob);
};

/**
 * Libera una URL de objeto creada con imageToObjectUrl
 */
export const revokeObjectUrl = (url: string): void => {
  URL.revokeObjectURL(url);
};

// ==========================================
// IMAGE DOWNLOAD & SAVE
// ==========================================

/**
 * Descarga una imagen al dispositivo del usuario
 */
export const downloadImage = (
  imageBlob: Blob,
  filename: string = "image.png"
): void => {
  const url = URL.createObjectURL(imageBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Genera un nombre de archivo con timestamp
 */
export const generateImageFilename = (
  prefix: string = "image",
  ext: string = "png"
): string => {
  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}.${ext}`;
};

// ==========================================
// IMAGE DIMENSIONS & VALIDATION
// ==========================================

export interface ImageDimensions {
  width: number;
  height: number;
}

export const COMMON_IMAGE_DIMENSIONS: Record<string, ImageDimensions> = {
  square_512: { width: 512, height: 512 },
  square_768: { width: 768, height: 768 },
  square_1024: { width: 1024, height: 1024 },
  landscape_16_9_512: { width: 896, height: 512 },
  landscape_16_9_1024: { width: 1792, height: 1024 },
  portrait_9_16_512: { width: 512, height: 896 },
  portrait_9_16_1024: { width: 1024, height: 1792 },
};

/**
 * Valida las dimensiones de imagen
 * SDXL Lightning funciona mejor con múltiplos de 64
 */
export const validateImageDimensions = (
  width: number,
  height: number
): boolean => {
  // Deben ser múltiplos de 64 para SDXL
  if (width % 64 !== 0 || height % 64 !== 0) {
    return false;
  }

  // Mínimo 256x256, máximo 2048x2048
  if (width < 256 || height < 256 || width > 2048 || height > 2048) {
    return false;
  }

  return true;
};

/**
 * Redondea dimensiones al múltiplo de 64 más cercano
 */
export const roundDimensionsTo64 = (
  width: number,
  height: number
): ImageDimensions => {
  return {
    width: Math.round(width / 64) * 64,
    height: Math.round(height / 64) * 64,
  };
};

// ==========================================
// IMAGE FORMAT DETECTION
// ==========================================

/**
 * Detecta el tipo de imagen de un Blob
 */
export const detectImageType = (blob: Blob): string => {
  if (blob.type) {
    return blob.type;
  }

  const reader = new Uint8Array(blob.slice(0, 8));

  // PNG
  if (
    reader[0] === 0x89 &&
    reader[1] === 0x50 &&
    reader[2] === 0x4e &&
    reader[3] === 0x47
  ) {
    return "image/png";
  }

  // JPEG
  if (reader[0] === 0xff && reader[1] === 0xd8 && reader[2] === 0xff) {
    return "image/jpeg";
  }

  // WebP
  if (
    reader[0] === 0x52 &&
    reader[1] === 0x49 &&
    reader[2] === 0x46 &&
    reader[3] === 0x46
  ) {
    return "image/webp";
  }

  // Fallback
  return "image/png";
};

/**
 * Valida que un Blob sea una imagen válida
 */
export const validateImageBlob = (blob: Blob): boolean => {
  if (!blob || blob.size === 0) {
    return false;
  }

  const validTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/svg+xml",
  ];
  return validTypes.includes(blob.type) || detectImageType(blob).startsWith("image/");
};

// ==========================================
// IMAGE PROCESSING
// ==========================================

/**
 * Redimensiona una imagen manteniendo aspect ratio
 * NOTA: Esto es solo para preview en el cliente
 * El redimensionamiento real ocurre en el backend
 */
export const resizeImageForPreview = (
  imageUrl: string,
  maxWidth: number = 512,
  maxHeight: number = 512
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      // Calcular nuevas dimensiones manteniendo aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo obtener contexto 2D del canvas"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => {
      reject(new Error("Error al cargar imagen para redimensionar"));
    };

    img.src = imageUrl;
  });
};

// ==========================================
// PROMPT ENGINEERING UTILITIES
// ==========================================

/**
 * Templates de prompts mejorados para SDXL
 */
export const PROMPT_TEMPLATES = {
  portrait: "Portrait of {subject}, professional photography, studio lighting, sharp focus",
  landscape:
    "Landscape of {subject}, cinematic composition, dramatic lighting, high resolution",
  product:
    "Product photography of {subject}, minimal background, studio lights, sharp details",
  abstract: "Abstract art of {subject}, modern style, vibrant colors, dynamic composition",
  cartoon: "Cartoon style illustration of {subject}, colorful, playful, clean lines",
  scifi: "Sci-fi concept art of {subject}, futuristic, high tech, neon colors",
  fantasy: "Fantasy art of {subject}, magical, detailed, epic composition",
  realistic: "Ultra-realistic 3D render of {subject}, photorealistic, high quality",
};

/**
 * Negative prompts genéricos para mejorar calidad
 */
export const NEGATIVE_PROMPTS = {
  default:
    "low quality, blurry, distorted, bad proportions, nsfw, watermark, signature",
  detailed:
    "low quality, blurry, distorted, bad proportions, amateur, broken, error, nsfw, watermark, text, signature, cropped, out of frame",
  realistic:
    "illustration, cartoon, drawing, painting, sketch, doll, toy, figurine, animation, anime, render, 3d, cgi",
};

/**
 * Mejora un prompt aplicando un template
 */
export const enhancePrompt = (
  userPrompt: string,
  template?: keyof typeof PROMPT_TEMPLATES
): string => {
  if (!template || !PROMPT_TEMPLATES[template]) {
    return userPrompt;
  }

  return PROMPT_TEMPLATES[template].replace("{subject}", userPrompt);
};

/**
 * Construye un negative prompt combinando opciones
 */
export const buildNegativePrompt = (
  base: "default" | "detailed" | "realistic" = "default",
  additionalNegatives: string[] = []
): string => {
  const basePrompt = NEGATIVE_PROMPTS[base];
  const combined = [basePrompt, ...additionalNegatives]
    .filter(Boolean)
    .join(", ");
  return combined;
};

// ==========================================
// IMAGE METADATA
// ==========================================

export interface ImageMetadata {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  timestamp: string;
  model: string;
}

/**
 * Crea metadata para una imagen generada
 */
export const createImageMetadata = (
  prompt: string,
  width: number,
  height: number,
  steps: number = 4,
  negativePrompt?: string
): ImageMetadata => {
  return {
    prompt,
    negativePrompt,
    width,
    height,
    steps,
    timestamp: new Date().toISOString(),
    model: "SDXL Lightning",
  };
};

/**
 * Convierte metadata a JSON para guardar
 */
export const serializeImageMetadata = (metadata: ImageMetadata): string => {
  return JSON.stringify(metadata, null, 2);
};
