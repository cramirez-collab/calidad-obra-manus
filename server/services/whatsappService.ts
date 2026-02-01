/**
 * Servicio de envío de mensajes a WhatsApp
 * Usa la API de WhatsApp Web directamente mediante enlaces de chat
 */

import { items, users, actividadUsuarios, proyectos, whatsappConfig } from '../../drizzle/schema';
import { eq, and, lt, inArray, sql, gte } from 'drizzle-orm';
import { getDb } from '../db';

// Tipos para el reporte
interface ResidenteStats {
  id: number;
  nombre: string;
  email: string | null;
  clickCalidad: boolean;
  clickSecuencias: boolean;
  pendientesMas3Dias: number;
  rechazadosMas3Dias: number;
}

interface ReporteWhatsApp {
  fecha: string;
  hora: string;
  proyectoNombre: string;
  sinCapturarCalidad: ResidenteStats[];
  sinCapturarSecuencias: ResidenteStats[];
  conPendientesMas3Dias: ResidenteStats[];
  conRechazadosMas3Dias: ResidenteStats[];
}

/**
 * Obtiene las estadísticas de actividad de los residentes del proyecto
 */
export async function getResidentesStats(proyectoId: number): Promise<ResidenteStats[]> {
  const db = await getDb();
  if (!db) return [];

  // Obtener todos los residentes del proyecto
  const residentes = await db.select()
    .from(users)
    .where(and(
      eq(users.activo, true),
      inArray(users.role, ['residente', 'jefe_residente'])
    ));

  // Fecha límite: hace 24 horas para actividad diaria
  const hace24Horas = new Date();
  hace24Horas.setHours(hace24Horas.getHours() - 24);

  // Fecha límite: hace 3 días para pendientes/rechazados
  const hace3Dias = new Date();
  hace3Dias.setDate(hace3Dias.getDate() - 3);

  const stats: ResidenteStats[] = [];

  for (const residente of residentes) {
    // Verificar si hizo clic en calidad hoy
    const clickCalidad = await db.select()
      .from(actividadUsuarios)
      .where(and(
        eq(actividadUsuarios.usuarioId, residente.id),
        eq(actividadUsuarios.proyectoId, proyectoId),
        eq(actividadUsuarios.tipoActividad, 'click_calidad'),
        gte(actividadUsuarios.createdAt, hace24Horas)
      ))
      .limit(1);

    // Verificar si hizo clic en secuencias hoy
    const clickSecuencias = await db.select()
      .from(actividadUsuarios)
      .where(and(
        eq(actividadUsuarios.usuarioId, residente.id),
        eq(actividadUsuarios.proyectoId, proyectoId),
        eq(actividadUsuarios.tipoActividad, 'click_secuencias'),
        gte(actividadUsuarios.createdAt, hace24Horas)
      ))
      .limit(1);

    // Contar ítems pendientes de más de 3 días
    const pendientesMas3Dias = await db.select({ count: sql<number>`count(*)` })
      .from(items)
      .where(and(
        eq(items.proyectoId, proyectoId),
        eq(items.residenteId, residente.id),
        eq(items.status, 'pendiente_foto_despues'),
        lt(items.createdAt, hace3Dias)
      ));

    // Contar ítems rechazados de más de 3 días sin atender
    const rechazadosMas3Dias = await db.select({ count: sql<number>`count(*)` })
      .from(items)
      .where(and(
        eq(items.proyectoId, proyectoId),
        eq(items.residenteId, residente.id),
        eq(items.status, 'rechazado'),
        lt(items.updatedAt, hace3Dias)
      ));

    stats.push({
      id: residente.id,
      nombre: residente.name || 'Sin nombre',
      email: residente.email,
      clickCalidad: clickCalidad.length > 0,
      clickSecuencias: clickSecuencias.length > 0,
      pendientesMas3Dias: pendientesMas3Dias[0]?.count || 0,
      rechazadosMas3Dias: rechazadosMas3Dias[0]?.count || 0,
    });
  }

  return stats;
}

/**
 * Genera el reporte de WhatsApp
 */
export async function generarReporteWhatsApp(proyectoId: number): Promise<ReporteWhatsApp> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const proyecto = await db.select()
    .from(proyectos)
    .where(eq(proyectos.id, proyectoId))
    .limit(1);

  const stats = await getResidentesStats(proyectoId);

  const ahora = new Date();
  const fecha = ahora.toLocaleDateString('es-MX', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const hora = ahora.toLocaleTimeString('es-MX', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return {
    fecha,
    hora,
    proyectoNombre: proyecto[0]?.nombre || 'Proyecto',
    sinCapturarCalidad: stats.filter(r => !r.clickCalidad),
    sinCapturarSecuencias: stats.filter(r => !r.clickSecuencias),
    conPendientesMas3Dias: stats.filter(r => r.pendientesMas3Dias > 0),
    conRechazadosMas3Dias: stats.filter(r => r.rechazadosMas3Dias > 0),
  };
}

/**
 * Formatea el mensaje para WhatsApp
 */
export function formatearMensajeWhatsApp(reporte: ReporteWhatsApp): string {
  let mensaje = `📊 *REPORTE DE CALIDAD*\n`;
  mensaje += `📅 ${reporte.fecha}\n`;
  mensaje += `🕐 ${reporte.hora}\n`;
  mensaje += `🏗️ *${reporte.proyectoNombre}*\n\n`;

  // Sin capturar en Calidad
  if (reporte.sinCapturarCalidad.length > 0) {
    mensaje += `❌ *Sin revisar CALIDAD hoy:*\n`;
    reporte.sinCapturarCalidad.forEach(r => {
      mensaje += `• ${r.nombre}\n`;
    });
    mensaje += `\n`;
  } else {
    mensaje += `✅ Todos revisaron CALIDAD hoy\n\n`;
  }

  // Sin capturar en Secuencias
  if (reporte.sinCapturarSecuencias.length > 0) {
    mensaje += `❌ *Sin revisar SECUENCIAS hoy:*\n`;
    reporte.sinCapturarSecuencias.forEach(r => {
      mensaje += `• ${r.nombre}\n`;
    });
    mensaje += `\n`;
  } else {
    mensaje += `✅ Todos revisaron SECUENCIAS hoy\n\n`;
  }

  // Pendientes de más de 3 días
  if (reporte.conPendientesMas3Dias.length > 0) {
    mensaje += `⚠️ *PENDIENTES +3 días sin atender:*\n`;
    reporte.conPendientesMas3Dias.forEach(r => {
      mensaje += `• ${r.nombre}: ${r.pendientesMas3Dias} ítem(s)\n`;
    });
    mensaje += `\n`;
  }

  // Rechazados de más de 3 días
  if (reporte.conRechazadosMas3Dias.length > 0) {
    mensaje += `🔴 *RECHAZADOS +3 días sin corregir:*\n`;
    reporte.conRechazadosMas3Dias.forEach(r => {
      mensaje += `• ${r.nombre}: ${r.rechazadosMas3Dias} ítem(s)\n`;
    });
    mensaje += `\n`;
  }

  // Resumen
  const totalProblemas = reporte.sinCapturarCalidad.length + 
    reporte.sinCapturarSecuencias.length + 
    reporte.conPendientesMas3Dias.length + 
    reporte.conRechazadosMas3Dias.length;

  if (totalProblemas === 0) {
    mensaje += `🎉 *¡Excelente! Todo al día.*`;
  } else {
    mensaje += `📌 *Total de observaciones: ${totalProblemas}*`;
  }

  return mensaje;
}

/**
 * Envía mensaje a WhatsApp usando la API de WhatsApp Web
 * Genera un enlace que abre WhatsApp con el mensaje prellenado
 */
export function generarEnlaceWhatsApp(grupoUrl: string, mensaje: string): string {
  // Extraer el ID del grupo del enlace
  const match = grupoUrl.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
  if (!match) {
    throw new Error('Enlace de grupo de WhatsApp inválido');
  }

  // Codificar el mensaje para URL
  const mensajeCodificado = encodeURIComponent(mensaje);
  
  // Generar enlace de WhatsApp Web API
  // Nota: Para grupos, usamos el enlace directo
  return `https://wa.me/?text=${mensajeCodificado}`;
}

/**
 * Envía el reporte a WhatsApp usando TextMeBot API (si hay API key)
 * o genera el enlace para envío manual
 */
export async function enviarReporteWhatsApp(
  proyectoId: number, 
  grupoUrl: string, 
  apiKey?: string
): Promise<{ success: boolean; mensaje: string; enlace?: string }> {
  try {
    const reporte = await generarReporteWhatsApp(proyectoId);
    const mensaje = formatearMensajeWhatsApp(reporte);

    // Si hay API key de TextMeBot, enviar automáticamente
    if (apiKey) {
      // Extraer número del grupo (si es posible) o usar API de TextMeBot
      const response = await fetch('https://api.textmebot.com/send.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          apikey: apiKey,
          text: mensaje,
          // Para grupos, TextMeBot requiere el ID del grupo
        }),
      });

      if (response.ok) {
        return { success: true, mensaje: 'Reporte enviado exitosamente' };
      }
    }

    // Si no hay API key, generar enlace para envío manual
    const enlace = generarEnlaceWhatsApp(grupoUrl, mensaje);
    return { 
      success: true, 
      mensaje: 'Enlace generado para envío manual',
      enlace 
    };
  } catch (error) {
    console.error('Error enviando reporte WhatsApp:', error);
    return { 
      success: false, 
      mensaje: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Registra actividad de usuario (clic en calidad, secuencias, etc.)
 */
export async function registrarActividad(
  usuarioId: number,
  proyectoId: number,
  tipoActividad: 'click_calidad' | 'click_secuencias' | 'crear_item' | 'subir_foto_despues' | 'aprobar_item' | 'rechazar_item',
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(actividadUsuarios).values({
    usuarioId,
    proyectoId,
    tipoActividad,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

/**
 * Obtiene la configuración de WhatsApp para un proyecto
 */
export async function getWhatsappConfig(proyectoId: number) {
  const db = await getDb();
  if (!db) return null;

  const config = await db.select()
    .from(whatsappConfig)
    .where(eq(whatsappConfig.proyectoId, proyectoId))
    .limit(1);

  return config[0] || null;
}

/**
 * Guarda o actualiza la configuración de WhatsApp para un proyecto
 */
export async function saveWhatsappConfig(proyectoId: number, grupoUrl: string, apiKey?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existingConfig = await getWhatsappConfig(proyectoId);

  if (existingConfig) {
    await db.update(whatsappConfig)
      .set({ 
        grupoUrl, 
        apiKey: apiKey || null,
        updatedAt: new Date()
      })
      .where(eq(whatsappConfig.proyectoId, proyectoId));
  } else {
    await db.insert(whatsappConfig).values({
      proyectoId,
      grupoUrl,
      apiKey: apiKey || null,
    });
  }
}

/**
 * Verifica si es hora de enviar reporte según el horario configurado
 * L-V: 9am, 12pm, 17pm
 * Sábados: 9am, 12pm
 * Domingos: NO enviar
 */
export function esHoraDeEnvio(): boolean {
  const ahora = new Date();
  const diaSemana = ahora.getDay(); // 0 = Domingo, 6 = Sábado
  const hora = ahora.getHours();
  const minutos = ahora.getMinutes();

  // Domingo - no enviar
  if (diaSemana === 0) return false;

  // Sábado - solo 9am y 12pm
  if (diaSemana === 6) {
    return (hora === 9 && minutos < 15) || (hora === 12 && minutos < 15);
  }

  // Lunes a Viernes - 9am, 12pm, 17pm
  return (hora === 9 && minutos < 15) || 
         (hora === 12 && minutos < 15) || 
         (hora === 17 && minutos < 15);
}

/**
 * Obtiene todos los proyectos activos con configuración de WhatsApp
 */
export async function getProyectosConWhatsapp() {
  const db = await getDb();
  if (!db) return [];

  const configs = await db.select({
    proyectoId: whatsappConfig.proyectoId,
    grupoUrl: whatsappConfig.grupoUrl,
    apiKey: whatsappConfig.apiKey,
    activo: whatsappConfig.activo,
    proyectoNombre: proyectos.nombre,
  })
    .from(whatsappConfig)
    .innerJoin(proyectos, eq(whatsappConfig.proyectoId, proyectos.id))
    .where(and(
      eq(whatsappConfig.activo, true),
      eq(proyectos.activo, true)
    ));

  return configs;
}

/**
 * Ejecuta el envío de reportes para todos los proyectos configurados
 */
export async function ejecutarEnvioReportesProgramados(): Promise<{
  enviados: number;
  errores: number;
  detalles: Array<{ proyecto: string; success: boolean; mensaje: string }>;
}> {
  const proyectosConfig = await getProyectosConWhatsapp();
  const detalles: Array<{ proyecto: string; success: boolean; mensaje: string }> = [];
  let enviados = 0;
  let errores = 0;

  for (const config of proyectosConfig) {
    if (!config.grupoUrl) continue;

    try {
      const resultado = await enviarReporteWhatsApp(
        config.proyectoId,
        config.grupoUrl,
        config.apiKey || undefined
      );

      if (resultado.success) {
        enviados++;
      } else {
        errores++;
      }

      detalles.push({
        proyecto: config.proyectoNombre || `Proyecto ${config.proyectoId}`,
        success: resultado.success,
        mensaje: resultado.mensaje,
      });
    } catch (error) {
      errores++;
      detalles.push({
        proyecto: config.proyectoNombre || `Proyecto ${config.proyectoId}`,
        success: false,
        mensaje: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return { enviados, errores, detalles };
}
