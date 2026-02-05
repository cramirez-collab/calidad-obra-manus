/**
 * VERSIÓN CENTRALIZADA DE LA APLICACIÓN
 * 
 * Este archivo es la ÚNICA fuente de verdad para la versión de la app.
 * Se usa en: Header, Service Worker, PWA, y verificación de actualizaciones.
 * 
 * IMPORTANTE: Incrementar este número con cada cambio significativo.
 */

// Versión principal de la aplicación (formato: MAJOR.MINOR)
export const APP_VERSION = "2.85";

// Número de build para el Service Worker (incrementar con cada deploy)
export const SW_BUILD = 85;

// Timestamp de la última actualización (se actualiza automáticamente)
export const BUILD_TIMESTAMP = Date.now();

// Versión completa para mostrar en UI
export const FULL_VERSION = `v${APP_VERSION}`;

// Versión para comparación numérica
export const VERSION_NUMBER = parseFloat(APP_VERSION);
