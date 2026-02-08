/**
 * VERSIÓN CENTRALIZADA DE LA APLICACIÓN - ÚNICA FUENTE DE VERDAD
 * 
 * ⚠️ ESTE ES EL ÚNICO LUGAR DONDE SE DEFINE LA VERSIÓN.
 * NO definir versiones en main.tsx, index.ts, sw.js, ni ningún otro archivo.
 * 
 * IMPORTANTE: Incrementar APP_VERSION con cada cambio significativo.
 * IMPORTANTE: Actualizar también sw.js y index.html con el mismo VERSION_NUMBER.
 */

// Versión de la aplicación (formato directo, sin fórmulas)
export const APP_VERSION = "3.97";

// Número interno para comparación y forzar actualizaciones (incrementar con cada deploy)
export const VERSION_NUMBER = 397;

// Versión para mostrar en UI
export const FULL_VERSION = `v${APP_VERSION}`;

// Número de build para el Service Worker (incrementar con cada deploy)
export const SW_BUILD = VERSION_NUMBER;

// Timestamp de la última actualización
export const BUILD_TIMESTAMP = Date.now();
