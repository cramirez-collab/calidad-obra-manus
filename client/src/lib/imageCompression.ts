/**
 * Utilidad para comprimir imágenes antes de guardarlas
 * 
 * MODO ADAPTATIVO v41:
 * - Detecta tipo de conexión del usuario
 * - Ajusta calidad y tamaño según velocidad de red
 * - Prioriza calidad en WiFi, velocidad en 2G/3G
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
}

// Tipos de conexión
type ConnectionType = 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'unknown';

interface AdaptiveSettings {
  maxSizeKB: number;
  maxWidth: number;
  quality: number;
  connectionLabel: string;
  estimatedUploadTime: string;
}

// ============================================
// CONFIGURACIÓN ADAPTATIVA v41
// ============================================
// Velocidades típicas:
// - 2G: 50-100 Kbps = 6-12 KB/s
// - 3G: 384 Kbps - 2 Mbps = 48-250 KB/s
// - 4G: 5-50 Mbps = 625KB-6MB/s
// - WiFi: 10-100+ Mbps = 1.25MB-12MB/s
// ============================================

const ADAPTIVE_SETTINGS: Record<ConnectionType, AdaptiveSettings> = {
  'slow-2g': { 
    maxSizeKB: 80,    // ~8 segundos en 2G lento
    maxWidth: 800, 
    quality: 0.45, 
    connectionLabel: '2G Lento (80KB)',
    estimatedUploadTime: '~8s'
  },
  '2g': { 
    maxSizeKB: 100,   // ~10 segundos en 2G
    maxWidth: 900, 
    quality: 0.50, 
    connectionLabel: '2G (100KB)',
    estimatedUploadTime: '~10s'
  },
  '3g': { 
    maxSizeKB: 150,   // ~3 segundos en 3G típico
    maxWidth: 1000, 
    quality: 0.60, 
    connectionLabel: '3G (150KB)',
    estimatedUploadTime: '~3s'
  },
  '4g': { 
    maxSizeKB: 250,   // <1 segundo en 4G
    maxWidth: 1200, 
    quality: 0.70, 
    connectionLabel: '4G (250KB)',
    estimatedUploadTime: '<1s'
  },
  'wifi': { 
    maxSizeKB: 400,   // Instantáneo en WiFi
    maxWidth: 1400, 
    quality: 0.80, 
    connectionLabel: 'WiFi (400KB)',
    estimatedUploadTime: 'Instantáneo'
  },
  'unknown': { 
    maxSizeKB: 150,   // Por defecto como 3G
    maxWidth: 1000, 
    quality: 0.60, 
    connectionLabel: 'Auto (150KB)',
    estimatedUploadTime: '~3s'
  }
};

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1000,
  maxHeight: 1000,
  quality: 0.60,
  mimeType: 'image/jpeg'
};

/**
 * Detecta el tipo de conexión del dispositivo
 */
export function detectConnectionType(): ConnectionType {
  // @ts-ignore - Network Information API
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  if (!connection) {
    return 'unknown';
  }
  
  const effectiveType = connection.effectiveType as string;
  
  if (effectiveType === 'slow-2g') return 'slow-2g';
  if (effectiveType === '2g') return '2g';
  if (effectiveType === '3g') return '3g';
  if (effectiveType === '4g') {
    // Verificar si es WiFi o datos móviles
    const type = connection.type as string;
    if (type === 'wifi' || type === 'ethernet') {
      return 'wifi';
    }
    return '4g';
  }
  
  // Fallback por tipo de conexión
  const type = connection.type as string;
  if (type === 'wifi' || type === 'ethernet') {
    return 'wifi';
  }
  
  return 'unknown';
}

/**
 * Obtiene la configuración según la conexión actual
 */
export function getAdaptiveSettings(): AdaptiveSettings {
  const connectionType = detectConnectionType();
  return ADAPTIVE_SETTINGS[connectionType];
}

/**
 * Obtiene información de la conexión para mostrar al usuario
 */
export function getConnectionInfo(): { 
  type: ConnectionType; 
  label: string; 
  maxSizeKB: number;
  estimatedUploadTime: string;
} {
  const connectionType = detectConnectionType();
  const settings = ADAPTIVE_SETTINGS[connectionType];
  return {
    type: connectionType,
    label: settings.connectionLabel,
    maxSizeKB: settings.maxSizeKB,
    estimatedUploadTime: settings.estimatedUploadTime
  };
}

/**
 * Comprime una imagen base64
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
        let { width, height } = img;
        const maxW = opts.maxWidth!;
        const maxH = opts.maxHeight!;
        
        // Redimensionar si excede dimensiones máximas
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo crear contexto de canvas'));
          return;
        }
        
        // Fondo blanco para transparencias
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
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
 * Obtiene el tamaño de un string base64 en KB
 */
export function getBase64SizeKB(base64: string): number {
  const base64Data = base64.split(',')[1] || base64;
  const sizeBytes = (base64Data.length * 3) / 4;
  return Math.round(sizeBytes / 1024);
}

/**
 * Comprime imagen si excede el tamaño máximo
 */
export async function compressIfNeeded(
  base64: string,
  maxSizeKB: number = 150,
  options: CompressionOptions = {}
): Promise<string> {
  const currentSize = getBase64SizeKB(base64);
  
  if (currentSize <= maxSizeKB) {
    return base64;
  }
  
  let quality = options.quality || 0.60;
  let compressed = await compressImage(base64, { ...options, quality });
  
  // Reducir calidad iterativamente hasta alcanzar objetivo
  while (getBase64SizeKB(compressed) > maxSizeKB && quality > 0.2) {
    quality -= 0.1;
    compressed = await compressImage(base64, { ...options, quality });
  }
  
  return compressed;
}

/**
 * COMPRESIÓN ADAPTATIVA v41 - Función principal
 * Comprime la imagen según el tipo de conexión del usuario
 * 
 * @param base64 - Imagen en formato base64
 * @returns Objeto con imagen comprimida e información
 */
export async function compressAdaptive(base64: string): Promise<{
  compressed: string;
  originalSizeKB: number;
  compressedSizeKB: number;
  connectionType: ConnectionType;
  connectionLabel: string;
  targetSizeKB: number;
  estimatedUploadTime: string;
}> {
  const originalSizeKB = getBase64SizeKB(base64);
  const connectionType = detectConnectionType();
  const settings = ADAPTIVE_SETTINGS[connectionType];
  
  console.log(`[Compresión Adaptativa v41] Conexión: ${connectionType}, Objetivo: ${settings.maxSizeKB}KB, Original: ${originalSizeKB}KB`);
  
  // Si ya es pequeña, no comprimir
  if (originalSizeKB <= settings.maxSizeKB) {
    return {
      compressed: base64,
      originalSizeKB,
      compressedSizeKB: originalSizeKB,
      connectionType,
      connectionLabel: settings.connectionLabel,
      targetSizeKB: settings.maxSizeKB,
      estimatedUploadTime: settings.estimatedUploadTime
    };
  }
  
  // Comprimir según configuración de conexión
  const options: CompressionOptions = {
    maxWidth: settings.maxWidth,
    maxHeight: settings.maxWidth,
    quality: settings.quality,
    mimeType: 'image/jpeg'
  };
  
  let compressed = await compressImage(base64, options);
  let compressedSizeKB = getBase64SizeKB(compressed);
  
  // Reducir calidad iterativamente hasta alcanzar objetivo
  let quality = settings.quality;
  while (compressedSizeKB > settings.maxSizeKB && quality > 0.25) {
    quality -= 0.05;
    compressed = await compressImage(base64, { ...options, quality });
    compressedSizeKB = getBase64SizeKB(compressed);
  }
  
  // Si aún es grande, reducir dimensiones
  let maxWidth = settings.maxWidth;
  while (compressedSizeKB > settings.maxSizeKB && maxWidth > 600) {
    maxWidth -= 100;
    compressed = await compressImage(base64, { 
      ...options, 
      maxWidth, 
      maxHeight: maxWidth,
      quality: Math.max(0.25, quality) 
    });
    compressedSizeKB = getBase64SizeKB(compressed);
  }
  
  console.log(`[Compresión Adaptativa v41] ${originalSizeKB}KB → ${compressedSizeKB}KB (${settings.connectionLabel})`);
  
  return {
    compressed,
    originalSizeKB,
    compressedSizeKB,
    connectionType,
    connectionLabel: settings.connectionLabel,
    targetSizeKB: settings.maxSizeKB,
    estimatedUploadTime: settings.estimatedUploadTime
  };
}

/**
 * Comprime imagen de forma adaptativa y retorna solo el base64
 */
export async function compressAdaptiveSimple(base64: string): Promise<string> {
  const result = await compressAdaptive(base64);
  return result.compressed;
}

/**
 * Obtiene emoji de señal según tipo de conexión
 */
export function getConnectionEmoji(connectionType: ConnectionType): string {
  switch (connectionType) {
    case 'slow-2g':
    case '2g':
      return '📶';
    case '3g':
      return '📶';
    case '4g':
      return '📶';
    case 'wifi':
      return '📶';
    default:
      return '📶';
  }
}
