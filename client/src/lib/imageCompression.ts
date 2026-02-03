/**
 * Utilidad para comprimir imágenes antes de guardarlas
 * 
 * MODO INSTANTÁNEO v32:
 * - Prioriza VELOCIDAD sobre calidad
 * - Objetivo: subir foto en máximo 2 segundos
 * - Tamaño máximo: 80KB (sube en ~1-2 seg en 3G)
 * - Resolución: 800px (suficiente para ver defectos)
 * - Mantiene legibilidad para control de calidad
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
}

// ============================================
// CONFIGURACIÓN INSTANTÁNEA - MÁXIMO 2 SEGUNDOS
// ============================================
// Cálculo: 3G típico = 384 Kbps = 48 KB/s
// Para subir en 2 segundos: 48 * 2 = 96 KB máximo
// Usamos 80KB para margen de seguridad
// ============================================

const INSTANT_MAX_SIZE_KB = 80;  // Máximo 80KB para carga instantánea
const INSTANT_MAX_WIDTH = 800;   // 800px es suficiente para ver defectos
const INSTANT_QUALITY = 0.5;     // Calidad media-baja pero legible

// Configuración por tipo de conexión (todas optimizadas para velocidad)
const ADAPTIVE_SETTINGS: Record<ConnectionType, AdaptiveSettings> = {
  'slow-2g': { maxSizeKB: 50, maxWidth: 640, quality: 0.4, connectionLabel: '2G ⚡' },
  '2g': { maxSizeKB: 60, maxWidth: 720, quality: 0.45, connectionLabel: '2G ⚡' },
  '3g': { maxSizeKB: 80, maxWidth: 800, quality: 0.5, connectionLabel: '3G ⚡' },
  '4g': { maxSizeKB: 80, maxWidth: 800, quality: 0.55, connectionLabel: '4G ⚡' },
  'wifi': { maxSizeKB: 80, maxWidth: 800, quality: 0.6, connectionLabel: 'WiFi ⚡' },
  'unknown': { maxSizeKB: 80, maxWidth: 800, quality: 0.5, connectionLabel: 'Auto ⚡' }
};

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: INSTANT_MAX_WIDTH,
  maxHeight: INSTANT_MAX_WIDTH,
  quality: INSTANT_QUALITY,
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
    const type = connection.type as string;
    if (type === 'wifi' || type === 'ethernet') {
      return 'wifi';
    }
    return '4g';
  }
  
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
export function getConnectionInfo(): { type: ConnectionType; label: string; maxSizeKB: number } {
  const connectionType = detectConnectionType();
  const settings = ADAPTIVE_SETTINGS[connectionType];
  return {
    type: connectionType,
    label: settings.connectionLabel,
    maxSizeKB: settings.maxSizeKB
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
  maxSizeKB: number = INSTANT_MAX_SIZE_KB,
  options: CompressionOptions = {}
): Promise<string> {
  const currentSize = getBase64SizeKB(base64);
  
  if (currentSize <= maxSizeKB) {
    return base64;
  }
  
  let quality = options.quality || INSTANT_QUALITY;
  let compressed = await compressImage(base64, { ...options, quality });
  
  while (getBase64SizeKB(compressed) > maxSizeKB && quality > 0.2) {
    quality -= 0.1;
    compressed = await compressImage(base64, { ...options, quality });
  }
  
  return compressed;
}

/**
 * COMPRESIÓN INSTANTÁNEA - Función principal
 * Comprime la imagen para carga en máximo 2 segundos
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
}> {
  const originalSizeKB = getBase64SizeKB(base64);
  const connectionType = detectConnectionType();
  const settings = ADAPTIVE_SETTINGS[connectionType];
  
  // Si ya es pequeña, no comprimir
  if (originalSizeKB <= settings.maxSizeKB) {
    return {
      compressed: base64,
      originalSizeKB,
      compressedSizeKB: originalSizeKB,
      connectionType,
      connectionLabel: settings.connectionLabel,
      targetSizeKB: settings.maxSizeKB
    };
  }
  
  // Comprimir agresivamente para carga instantánea
  const options: CompressionOptions = {
    maxWidth: settings.maxWidth,
    maxHeight: settings.maxWidth,
    quality: settings.quality,
    mimeType: 'image/jpeg'
  };
  
  let compressed = await compressImage(base64, options);
  let compressedSizeKB = getBase64SizeKB(compressed);
  
  // Reducir calidad hasta alcanzar objetivo
  let quality = settings.quality;
  while (compressedSizeKB > settings.maxSizeKB && quality > 0.2) {
    quality -= 0.05;
    compressed = await compressImage(base64, { ...options, quality });
    compressedSizeKB = getBase64SizeKB(compressed);
  }
  
  // Si aún es grande, reducir dimensiones agresivamente
  let maxWidth = settings.maxWidth;
  while (compressedSizeKB > settings.maxSizeKB && maxWidth > 400) {
    maxWidth -= 100;
    compressed = await compressImage(base64, { 
      ...options, 
      maxWidth, 
      maxHeight: maxWidth,
      quality: 0.2 
    });
    compressedSizeKB = getBase64SizeKB(compressed);
  }
  
  console.log(`[Compresión Instantánea] ${originalSizeKB}KB → ${compressedSizeKB}KB (${settings.connectionLabel})`);
  
  return {
    compressed,
    originalSizeKB,
    compressedSizeKB,
    connectionType,
    connectionLabel: settings.connectionLabel,
    targetSizeKB: settings.maxSizeKB
  };
}

/**
 * Comprime imagen de forma instantánea y retorna solo el base64
 */
export async function compressAdaptiveSimple(base64: string): Promise<string> {
  const result = await compressAdaptive(base64);
  return result.compressed;
}
