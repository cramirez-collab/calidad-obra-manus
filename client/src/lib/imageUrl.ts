/**
 * Convierte un string Base64 a Blob
 * @param base64 - String Base64 con o sin prefijo data:
 * @param mime - Tipo MIME de la imagen (por defecto image/jpeg)
 * @returns Blob de la imagen
 */
export function base64ToBlob(base64: string, mime: string = 'image/jpeg'): Blob {
  // Extraer el contenido Base64 sin el prefijo data:
  const raw = base64.includes(',') ? base64.split(',')[1] : base64;
  
  try {
    const bytes = atob(raw);
    const array = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      array[i] = bytes.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  } catch {
    // Si falla la conversión, devolver un blob vacío
    return new Blob([], { type: mime });
  }
}

/**
 * Convierte un string Base64 a una URL de objeto
 * @param base64 - String Base64 con o sin prefijo data:
 * @param mime - Tipo MIME de la imagen (por defecto image/jpeg)
 * @returns URL de objeto para usar en src de img
 */
export function base64ToObjectUrl(base64: string, mime: string = 'image/jpeg'): string {
  // Si ya tiene el prefijo data:, extraer el mime type
  if (base64.startsWith('data:')) {
    const mimeMatch = base64.match(/^data:(image\/\w+);base64,/);
    if (mimeMatch) {
      mime = mimeMatch[1];
    }
  }
  
  const blob = base64ToBlob(base64, mime);
  return URL.createObjectURL(blob);
}

/**
 * Verifica si un string es Base64
 */
export function isBase64(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  
  // Verificar si tiene el prefijo data:image
  if (str.startsWith('data:image')) return true;
  
  // Verificar si es un string Base64 puro (muy largo y solo caracteres válidos)
  if (str.length > 100 && /^[A-Za-z0-9+/=]+$/.test(str)) return true;
  
  return false;
}

/**
 * Función para obtener la URL correcta de una imagen
 * Maneja URLs, keys de S3, y strings Base64
 * @param url - URL, key de S3, o string Base64
 * @returns URL válida para usar en src de img
 */
export function getImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  // Si es Base64, convertir a URL de objeto
  if (isBase64(url)) {
    return base64ToObjectUrl(url);
  }
  
  // Si ya es una URL completa (http/https)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Si es una URL de CloudFront que puede estar expirada, usar el proxy
    if (url.includes('cloudfront.net')) {
      try {
        const parsedUrl = new URL(url);
        const pathParts = parsedUrl.pathname.split('/');
        // El key empieza después del app ID (ej: /310519663201051818/LjHhpq7m8HsaWSJ2BF6kdt/usuarios/...)
        const keyStartIndex = pathParts.findIndex(p => p === 'usuarios' || p === 'items' || p === 'proyectos');
        if (keyStartIndex > 0) {
          const key = pathParts.slice(keyStartIndex).join('/');
          return `/api/image/${key}`;
        }
      } catch {
        // Si falla el parsing, usar la URL original
      }
    }
    return url;
  }
  
  // Si es un key de S3 (no empieza con http), usar el proxy
  return `/api/image/${url}`;
}

/**
 * Hook para limpiar URLs de objeto cuando el componente se desmonta
 * Usar con useEffect para evitar memory leaks
 */
export function revokeObjectUrl(url: string): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/**
 * FUNCIÓN GLOBAL DEFINITIVA para convertir cualquier valor de foto a URI válida
 * REGLA: Ningún Base64 debe renderizarse como texto
 * 
 * @param value - URL, Base64, o cualquier string de foto
 * @returns URI válida para usar en <Image source={{uri}} /> o null si no es válido
 */
export function toImageUri(value: string | undefined | null): string | null {
  if (!value || typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  
  const trimmed = value.trim();
  
  // Si ya es una URL válida (http, https, file, content)
  if (trimmed.startsWith('http://') || 
      trimmed.startsWith('https://') || 
      trimmed.startsWith('file://') || 
      trimmed.startsWith('content://')) {
    return trimmed;
  }
  
  // Si ya tiene el prefijo data:image
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  
  // Si es Base64 de JPEG (empieza con /9j)
  if (trimmed.startsWith('/9j')) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  
  // Si es Base64 de PNG (empieza con iVBOR)
  if (trimmed.startsWith('iVBOR')) {
    return `data:image/png;base64,${trimmed}`;
  }
  
  // Si es Base64 de GIF (empieza con R0lGOD)
  if (trimmed.startsWith('R0lGOD')) {
    return `data:image/gif;base64,${trimmed}`;
  }
  
  // Si es Base64 de WebP (empieza con UklGR)
  if (trimmed.startsWith('UklGR')) {
    return `data:image/webp;base64,${trimmed}`;
  }
  
  // Si parece ser Base64 genérico (muy largo y solo caracteres válidos)
  if (trimmed.length > 100 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  
  // Si es un key de S3 o path relativo, usar el proxy de imagen
  if (!trimmed.includes(' ') && (trimmed.includes('/') || trimmed.includes('.'))) {
    return `/api/image/${trimmed}`;
  }
  
  // No es una imagen válida
  return null;
}
