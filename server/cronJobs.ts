/**
 * Cron Jobs para reportes automáticos de WhatsApp
 * 
 * Horarios:
 * - Lunes a Viernes: 9am, 12pm, 5pm (hora de México)
 * - Sábados: 9am, 12pm
 * - Domingos: NO enviar
 */

import cron from 'node-cron';
import { ejecutarEnvioReportesProgramados, esHoraDeEnvio } from './services/whatsappService';

// Zona horaria de México (CST/CDT)
const TIMEZONE = 'America/Mexico_City';

/**
 * Inicializa los cron jobs para reportes de WhatsApp
 */
export function initializeCronJobs() {
  console.log('[CronJobs] Inicializando tareas programadas...');

  // Reporte de las 9:00 AM (L-S)
  // Cron: minuto hora día-mes mes día-semana
  // "0 9 * * 1-6" = 9:00 AM de Lunes a Sábado
  cron.schedule('0 9 * * 1-6', async () => {
    console.log('[CronJobs] Ejecutando reporte de 9:00 AM...');
    try {
      const resultado = await ejecutarEnvioReportesProgramados();
      console.log(`[CronJobs] Reporte 9AM completado: ${resultado.enviados} enviados, ${resultado.errores} errores`);
    } catch (error) {
      console.error('[CronJobs] Error en reporte 9AM:', error);
    }
  }, {
    timezone: TIMEZONE
  });

  // Reporte de las 12:00 PM (L-S)
  cron.schedule('0 12 * * 1-6', async () => {
    console.log('[CronJobs] Ejecutando reporte de 12:00 PM...');
    try {
      const resultado = await ejecutarEnvioReportesProgramados();
      console.log(`[CronJobs] Reporte 12PM completado: ${resultado.enviados} enviados, ${resultado.errores} errores`);
    } catch (error) {
      console.error('[CronJobs] Error en reporte 12PM:', error);
    }
  }, {
    timezone: TIMEZONE
  });

  // Reporte de las 5:00 PM (L-V solamente)
  cron.schedule('0 17 * * 1-5', async () => {
    console.log('[CronJobs] Ejecutando reporte de 5:00 PM...');
    try {
      const resultado = await ejecutarEnvioReportesProgramados();
      console.log(`[CronJobs] Reporte 5PM completado: ${resultado.enviados} enviados, ${resultado.errores} errores`);
    } catch (error) {
      console.error('[CronJobs] Error en reporte 5PM:', error);
    }
  }, {
    timezone: TIMEZONE
  });

  console.log('[CronJobs] Tareas programadas inicializadas:');
  console.log('  - 9:00 AM (L-S)');
  console.log('  - 12:00 PM (L-S)');
  console.log('  - 5:00 PM (L-V)');
  console.log(`  - Zona horaria: ${TIMEZONE}`);
}

/**
 * Ejecuta manualmente el envío de reportes (para pruebas)
 */
export async function ejecutarReportesManual() {
  console.log('[CronJobs] Ejecutando reportes manualmente...');
  const resultado = await ejecutarEnvioReportesProgramados();
  console.log(`[CronJobs] Resultado: ${resultado.enviados} enviados, ${resultado.errores} errores`);
  return resultado;
}
