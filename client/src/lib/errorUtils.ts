/**
 * Sanitiza un mensaje de error para evitar mostrar Base64 u otros datos largos
 * @param error - El error capturado
 * @param defaultMessage - Mensaje por defecto si el error es muy largo
 * @returns Mensaje de error sanitizado
 */
export function sanitizeErrorMessage(
  error: unknown,
  defaultMessage: string = "Error. Intenta de nuevo."
): string {
  if (!error) return defaultMessage;
  
  const message = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : String(error);
  
  // Si el mensaje es muy largo (probablemente contiene Base64), usar mensaje por defecto
  if (message.length > 100) {
    return defaultMessage;
  }
  
  // Si el mensaje contiene patrones de Base64, usar mensaje por defecto
  if (message.includes('data:image') || message.includes('base64')) {
    return defaultMessage;
  }
  
  return message || defaultMessage;
}

/**
 * Extrae un mensaje de error seguro de cualquier tipo de error
 * @param error - El error capturado
 * @param prefix - Prefijo opcional para el mensaje
 * @param defaultMessage - Mensaje por defecto
 * @returns Mensaje de error con prefijo
 */
export function getErrorMessage(
  error: unknown,
  prefix?: string,
  defaultMessage: string = "Error desconocido"
): string {
  const sanitized = sanitizeErrorMessage(error, defaultMessage);
  return prefix ? `${prefix}: ${sanitized}` : sanitized;
}
