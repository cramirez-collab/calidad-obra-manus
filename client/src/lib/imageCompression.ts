/**
 * Utilidad para comprimir imágenes antes de guardarlas
 * Reduce el tamaño de las fotos para carga rápida y uso offline
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.7,
  mimeType: 'image/jpeg'
};

/**
 * Comprime una imagen base64 a un tamaño más pequeño
 */
export async function compressImage(
  base64: string,
  options: CompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Calcular nuevas dimensiones manteniendo proporción
        let { width, height } = img;
        const maxW = opts.maxWidth!;
        const maxH = opts.maxHeight!;
        
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        // Crear canvas y dibujar imagen redimensionada
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo crear contexto de canvas'));
          return;
        }
        
        // Fondo blanco para imágenes con transparencia
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        
        // Dibujar imagen
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir a base64 comprimido
        const compressedBase64 = canvas.toDataURL(opts.mimeType, opts.quality);
        resolve(compressedBase64);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Error al cargar imagen para compresión'));
    };
    
    img.src = base64;
  });
}

/**
 * Comprime un archivo de imagen a base64
 */
export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target?.result as string;
        const compressed = await compressImage(base64, options);
        resolve(compressed);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Error al leer archivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Obtiene el tamaño aproximado de un string base64 en KB
 */
export function getBase64SizeKB(base64: string): number {
  // Remover el prefijo data:image/...;base64,
  const base64Data = base64.split(',')[1] || base64;
  // Calcular tamaño: cada 4 caracteres base64 = 3 bytes
  const sizeBytes = (base64Data.length * 3) / 4;
  return Math.round(sizeBytes / 1024);
}

/**
 * Comprime imagen solo si excede el tamaño máximo
 */
export async function compressIfNeeded(
  base64: string,
  maxSizeKB: number = 200,
  options: CompressionOptions = {}
): Promise<string> {
  const currentSize = getBase64SizeKB(base64);
  
  if (currentSize <= maxSizeKB) {
    return base64;
  }
  
  // Comprimir con calidad progresivamente menor si es necesario
  let quality = options.quality || 0.7;
  let compressed = await compressImage(base64, { ...options, quality });
  
  // Si aún es muy grande, reducir calidad
  while (getBase64SizeKB(compressed) > maxSizeKB && quality > 0.3) {
    quality -= 0.1;
    compressed = await compressImage(base64, { ...options, quality });
  }
  
  return compressed;
}
