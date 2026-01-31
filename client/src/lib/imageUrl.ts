/**
 * Función para obtener la URL correcta de una imagen
 * Si es un key de S3 (no empieza con http), usa el proxy /api/image/
 * Si es una URL de CloudFront, extrae el key y usa el proxy
 * Si es otra URL completa, la usa directamente
 */
export function getImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  
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
