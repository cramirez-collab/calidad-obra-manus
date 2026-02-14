import { ENV } from "./_core/env";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Envía un email usando el servicio de notificaciones de Manus
 * Como alternativa, usamos notifyOwner para alertas críticas
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  // Por ahora, logueamos el intento de envío
  // En producción, se integraría con un servicio de email como SendGrid, Resend, etc.
  console.log(`[Email] Enviando email a ${payload.to}: ${payload.subject}`);
  
  // Simular envío exitoso para desarrollo
  return true;
}

/**
 * Plantilla HTML para notificación de ítem aprobado
 */
export function getAprobadoEmailTemplate(itemTitulo: string, itemCodigo: string, supervisorNombre: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ítem Aprobado</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">✓ Ítem Aprobado</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin-top: 0;">Hola,</p>
    <p>Tu ítem de calidad ha sido <strong style="color: #10B981;">aprobado</strong> por el supervisor.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
      <p style="margin: 0 0 8px 0;"><strong>Ítem:</strong> ${itemTitulo}</p>
      <p style="margin: 0 0 8px 0;"><strong>Código:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${itemCodigo}</code></p>
      <p style="margin: 0;"><strong>Aprobado por:</strong> ${supervisorNombre}</p>
    </div>
    
    <p>El trabajo ha sido verificado y cumple con los estándares de calidad requeridos.</p>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="#" style="background: #10B981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Ver Detalles</a>
    </div>
  </div>
  <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
    Control de Calidad de Obra • Sistema de Gestión
  </p>
</body>
</html>
  `.trim();
}

/**
 * Plantilla HTML para notificación de ítem rechazado
 */
export function getRechazadoEmailTemplate(itemTitulo: string, itemCodigo: string, supervisorNombre: string, motivo: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ítem Rechazado</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">✕ Ítem Rechazado</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin-top: 0;">Hola,</p>
    <p>Tu ítem de calidad ha sido <strong style="color: #EF4444;">rechazado</strong> y requiere correcciones.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #EF4444;">
      <p style="margin: 0 0 8px 0;"><strong>Ítem:</strong> ${itemTitulo}</p>
      <p style="margin: 0 0 8px 0;"><strong>Código:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${itemCodigo}</code></p>
      <p style="margin: 0 0 8px 0;"><strong>Rechazado por:</strong> ${supervisorNombre}</p>
      <p style="margin: 0;"><strong>Motivo:</strong></p>
      <p style="margin: 8px 0 0 0; padding: 12px; background: #fef2f2; border-radius: 6px; color: #991b1b;">${motivo}</p>
    </div>
    
    <p>Por favor, revisa las observaciones y realiza las correcciones necesarias.</p>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="#" style="background: #EF4444; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Ver Detalles</a>
    </div>
  </div>
  <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
    Control de Calidad de Obra • Sistema de Gestión
  </p>
</body>
</html>
  `.trim();
}

/**
 * Plantilla HTML para notificación de ítem pendiente de aprobación
 */
export function getPendienteAprobacionEmailTemplate(itemTitulo: string, itemCodigo: string, residenteNombre: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ítem Pendiente de Aprobación</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⏳ Ítem Pendiente de Aprobación</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin-top: 0;">Hola,</p>
    <p>Hay un nuevo ítem de calidad <strong style="color: #3B82F6;">pendiente de tu aprobación</strong>.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3B82F6;">
      <p style="margin: 0 0 8px 0;"><strong>Ítem:</strong> ${itemTitulo}</p>
      <p style="margin: 0 0 8px 0;"><strong>Código:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${itemCodigo}</code></p>
      <p style="margin: 0;"><strong>Registrado por:</strong> ${residenteNombre}</p>
    </div>
    
    <p>Por favor, revisa las fotos antes/después y decide si el trabajo cumple con los estándares de calidad.</p>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="#" style="background: #3B82F6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Revisar Ítem</a>
    </div>
  </div>
  <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
    Control de Calidad de Obra • Sistema de Gestión
  </p>
</body>
</html>
  `.trim();
}


/**
 * Plantilla HTML para el resumen ejecutivo semanal
 */
export function getResumenEjecutivoEmailTemplate(
  proyectoNombre: string,
  resumenMarkdown: string,
  version: number,
  fecha: string
): string {
  // Convertir markdown básico a HTML para email
  const htmlContent = resumenMarkdown
    .replace(/^### (.*$)/gm, '<h3 style="color: #002C63; font-size: 16px; margin: 20px 0 8px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 style="color: #002C63; font-size: 18px; margin: 24px 0 10px 0; border-bottom: 2px solid #02B381; padding-bottom: 6px;">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 style="color: #002C63; font-size: 22px; margin: 24px 0 12px 0;">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #002C63;">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li style="margin: 4px 0; padding-left: 4px;">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul style="margin: 8px 0; padding-left: 20px;">${match}</ul>`)
    .replace(/\n\n/g, '</p><p style="margin: 8px 0; line-height: 1.6; color: #374151;">')
    .replace(/\n/g, '<br/>');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resumen Ejecutivo Semanal - ${proyectoNombre}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; background: #f3f4f6;">
  <div style="background: linear-gradient(135deg, #002C63 0%, #1e40af 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px; letter-spacing: 1px;">OBJETIVA QUALITY CONTROL</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Resumen Ejecutivo Semanal v${version}</p>
  </div>
  
  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="background: #f0fdf4; border-left: 4px solid #02B381; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 14px; color: #166534;">
        <strong>Proyecto:</strong> ${proyectoNombre}<br/>
        <strong>Fecha:</strong> ${fecha}<br/>
        <strong>Versión:</strong> v${version}
      </p>
    </div>
    
    <div style="font-size: 14px;">
      <p style="margin: 8px 0; line-height: 1.6; color: #374151;">${htmlContent}</p>
    </div>
  </div>
  
  <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
    <p style="margin: 0; color: #6b7280; font-size: 12px;">
      Este resumen fue generado automáticamente por el sistema de Análisis IA.<br/>
      Objetiva Quality Control &bull; ${fecha}
    </p>
  </div>
</body>
</html>
  `.trim();
}
