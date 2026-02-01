/**
 * Servicio de envío de mensajes a WhatsApp
 * Integración con TextMeBot API para envío automático
 */

import { items, users, actividadUsuarios, proyectos, whatsappConfig, itemHistorial } from '../../drizzle/schema';
import { eq, and, lt, inArray, sql, gte, isNotNull } from 'drizzle-orm';
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
  tiempoPromedioResolucion: number | null; // en horas
}

interface ReporteWhatsApp {
  fecha: string;
  hora: string;
  proyectoNombre: string;
  sinCapturarCalidad: ResidenteStats[];
  sinCapturarSecuencias: ResidenteStats[];
  conPendientesMas3Dias: ResidenteStats[];
  conRechazadosMas3Dias: ResidenteStats[];
  tiempoPromedioGlobal: number | null; // en horas
}

/**
 * Calcula el tiempo promedio de resolución de ítems para un residente
 * Tiempo desde creación hasta aprobación
 */
async function calcularTiempoPromedioResolucion(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  residenteId: number,
  proyectoId: number
): Promise<number | null> {
  // Obtener ítems aprobados del residente con sus fechas
  const itemsAprobados = await db.select({
    id: items.id,
    createdAt: items.createdAt,
    updatedAt: items.updatedAt,
  })
    .from(items)
    .where(and(
      eq(items.proyectoId, proyectoId),
      eq(items.residenteId, residenteId),
      eq(items.status, 'aprobado')
    ));

  if (itemsAprobados.length === 0) return null;

  // Calcular tiempo promedio en horas
  let totalHoras = 0;
  let itemsConTiempo = 0;

  for (const item of itemsAprobados) {
    if (item.createdAt && item.updatedAt) {
      const creacion = new Date(item.createdAt).getTime();
      const aprobacion = new Date(item.updatedAt).getTime();
      const horasDiferencia = (aprobacion - creacion) / (1000 * 60 * 60);
      
      if (horasDiferencia > 0) {
        totalHoras += horasDiferencia;
        itemsConTiempo++;
      }
    }
  }

  return itemsConTiempo > 0 ? Math.round(totalHoras / itemsConTiempo * 10) / 10 : null;
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

    // Calcular tiempo promedio de resolución
    const tiempoPromedio = await calcularTiempoPromedioResolucion(db, residente.id, proyectoId);

    stats.push({
      id: residente.id,
      nombre: residente.name || 'Sin nombre',
      email: residente.email,
      clickCalidad: clickCalidad.length > 0,
      clickSecuencias: clickSecuencias.length > 0,
      pendientesMas3Dias: pendientesMas3Dias[0]?.count || 0,
      rechazadosMas3Dias: rechazadosMas3Dias[0]?.count || 0,
      tiempoPromedioResolucion: tiempoPromedio,
    });
  }

  return stats;
}

/**
 * Calcula el tiempo promedio global de resolución del proyecto
 */
async function calcularTiempoPromedioGlobal(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  proyectoId: number
): Promise<number | null> {
  const itemsAprobados = await db.select({
    createdAt: items.createdAt,
    updatedAt: items.updatedAt,
  })
    .from(items)
    .where(and(
      eq(items.proyectoId, proyectoId),
      eq(items.status, 'aprobado')
    ));

  if (itemsAprobados.length === 0) return null;

  let totalHoras = 0;
  let itemsConTiempo = 0;

  for (const item of itemsAprobados) {
    if (item.createdAt && item.updatedAt) {
      const creacion = new Date(item.createdAt).getTime();
      const aprobacion = new Date(item.updatedAt).getTime();
      const horasDiferencia = (aprobacion - creacion) / (1000 * 60 * 60);
      
      if (horasDiferencia > 0) {
        totalHoras += horasDiferencia;
        itemsConTiempo++;
      }
    }
  }

  return itemsConTiempo > 0 ? Math.round(totalHoras / itemsConTiempo * 10) / 10 : null;
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
  const tiempoPromedioGlobal = await calcularTiempoPromedioGlobal(db, proyectoId);

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
    tiempoPromedioGlobal,
  };
}

/**
 * Formatea el tiempo en horas a un formato legible
 */
function formatearTiempo(horas: number): string {
  if (horas < 1) {
    return `${Math.round(horas * 60)} min`;
  } else if (horas < 24) {
    return `${Math.round(horas * 10) / 10} hrs`;
  } else {
    const dias = Math.round(horas / 24 * 10) / 10;
    return `${dias} días`;
  }
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

  // Tiempo promedio de resolución
  if (reporte.tiempoPromedioGlobal !== null) {
    mensaje += `⏱️ *Tiempo promedio de resolución:* ${formatearTiempo(reporte.tiempoPromedioGlobal)}\n\n`;
  }

  // Top 3 residentes más rápidos
  const residentesConTiempo = [...reporte.sinCapturarCalidad, ...reporte.sinCapturarSecuencias, 
    ...reporte.conPendientesMas3Dias, ...reporte.conRechazadosMas3Dias]
    .filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i) // Eliminar duplicados
    .filter(r => r.tiempoPromedioResolucion !== null)
    .sort((a, b) => (a.tiempoPromedioResolucion || 999) - (b.tiempoPromedioResolucion || 999));

  if (residentesConTiempo.length > 0) {
    mensaje += `🏆 *Top 3 más rápidos:*\n`;
    residentesConTiempo.slice(0, 3).forEach((r, i) => {
      const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      mensaje += `${medalla} ${r.nombre}: ${formatearTiempo(r.tiempoPromedioResolucion!)}\n`;
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
 * Envía mensaje usando TextMeBot API
 * Documentación: https://textmebot.com
 * Endpoint: https://api.textmebot.com/send.php
 * Parámetros: recipient (número), apikey, text
 */
async function enviarConTextMeBot(
  apiKey: string,
  recipient: string,
  mensaje: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Limpiar el número de teléfono (solo dígitos)
    const numeroLimpio = recipient.replace(/\D/g, '');
    
    // Construir URL con parámetros GET (TextMeBot usa GET)
    const params = new URLSearchParams({
      recipient: numeroLimpio,
      apikey: apiKey,
      text: mensaje,
    });

    const url = `https://api.textmebot.com/send.php?${params.toString()}`;
    
    console.log(`[TextMeBot] Enviando mensaje a ${numeroLimpio.substring(0, 4)}...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log(`[TextMeBot] Respuesta: ${responseText}`);

    // TextMeBot retorna "success" o un mensaje de error
    if (response.ok && responseText.toLowerCase().includes('success')) {
      return { success: true };
    }

    return { 
      success: false, 
      error: responseText || 'Error desconocido de TextMeBot' 
    };
  } catch (error) {
    console.error('[TextMeBot] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error de conexión' 
    };
  }
}

/**
 * Extrae el número de teléfono del administrador del proyecto para enviar el mensaje
 */
async function obtenerNumeroAdmin(proyectoId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  // Buscar el admin o superadmin del proyecto
  const admin = await db.select({
    telefono: users.telefono,
  })
    .from(users)
    .where(and(
      eq(users.activo, true),
      inArray(users.role, ['superadmin', 'admin']),
      isNotNull(users.telefono)
    ))
    .limit(1);

  return admin[0]?.telefono || null;
}

/**
 * Envía el reporte a WhatsApp usando TextMeBot API (si hay API key)
 * o genera el enlace para envío manual
 */
export async function enviarReporteWhatsApp(
  proyectoId: number, 
  grupoUrl: string, 
  apiKey?: string,
  numeroDestino?: string
): Promise<{ success: boolean; mensaje: string; enlace?: string }> {
  try {
    const reporte = await generarReporteWhatsApp(proyectoId);
    const mensaje = formatearMensajeWhatsApp(reporte);

    // Si hay API key de TextMeBot, intentar enviar automáticamente
    if (apiKey) {
      // Obtener número de destino (del parámetro o del admin)
      let numero: string | undefined = numeroDestino;
      if (!numero) {
        const adminNumero = await obtenerNumeroAdmin(proyectoId);
        numero = adminNumero || undefined;
      }

      if (numero) {
        console.log(`[WhatsApp] Intentando envío automático con TextMeBot...`);
        const resultado = await enviarConTextMeBot(apiKey, numero, mensaje);
        
        if (resultado.success) {
          // Actualizar último envío
          const db = await getDb();
          if (db) {
            await db.update(whatsappConfig)
              .set({ ultimoEnvio: new Date() })
              .where(eq(whatsappConfig.proyectoId, proyectoId));
          }
          
          return { 
            success: true, 
            mensaje: 'Reporte enviado automáticamente via TextMeBot' 
          };
        } else {
          console.log(`[WhatsApp] TextMeBot falló: ${resultado.error}. Generando enlace manual...`);
          // Fallback a enlace manual si falla
        }
      } else {
        console.log(`[WhatsApp] No hay número de destino configurado. Generando enlace manual...`);
      }
    }

    // Si no hay API key o falló, generar enlace para envío manual
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
export async function saveWhatsappConfig(
  proyectoId: number, 
  grupoUrl: string, 
  apiKey?: string,
  numeroDestino?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existingConfig = await getWhatsappConfig(proyectoId);

  if (existingConfig) {
    await db.update(whatsappConfig)
      .set({ 
        grupoUrl, 
        apiKey: apiKey || null,
        numeroDestino: numeroDestino || null,
        updatedAt: new Date()
      })
      .where(eq(whatsappConfig.proyectoId, proyectoId));
  } else {
    await db.insert(whatsappConfig).values({
      proyectoId,
      grupoUrl,
      apiKey: apiKey || null,
      numeroDestino: numeroDestino || null,
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
    numeroDestino: whatsappConfig.numeroDestino,
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
        config.apiKey || undefined,
        config.numeroDestino || undefined
      );

      if (resultado.success && !resultado.enlace) {
        // Solo contar como enviado si fue automático (sin enlace)
        enviados++;
      } else if (!resultado.success) {
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
