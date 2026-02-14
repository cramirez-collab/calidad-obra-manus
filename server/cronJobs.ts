/**
 * Cron Jobs para tareas programadas
 * 
 * Incluye notificaciones automáticas para ítems pendientes
 */

import cron from 'node-cron';
import { getDb } from './db';
import * as db from './db';
import { items, pushSubscriptions, defectos, unidades, proyectos } from '../drizzle/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';
import pushService from './pushService';
import { invokeLLM } from './_core/llm';
import { notifyOwner } from './_core/notification';
import { getResumenEjecutivoEmailTemplate, sendEmail } from './emailService';

// Zona horaria de México (CST/CDT)
const TIMEZONE = 'America/Mexico_City';

// Días de antigüedad para considerar un ítem como "pendiente urgente"
const DIAS_URGENTE = 3;

/**
 * Envía notificaciones push a usuarios con ítems pendientes de más de X días
 */
async function notificarItemsPendientesUrgentes() {
  console.log('[CronJobs] Verificando ítems pendientes urgentes...');
  
  const db = await getDb();
  if (!db) {
    console.log('[CronJobs] Base de datos no disponible');
    return;
  }
  
  try {
    // Calcular fecha límite (hace X días)
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - DIAS_URGENTE);
    
    // Buscar ítems pendientes de foto después con más de X días
    const itemsPendientesFoto = await db
      .select({
        id: items.id,
        codigo: items.codigo,
        residenteId: items.residenteId,
        defectoId: items.defectoId,
        unidadId: items.unidadId,
        fechaCreacion: items.fechaCreacion,
      })
      .from(items)
      .where(
        and(
          eq(items.status, 'pendiente_foto_despues'),
          lt(items.fechaCreacion, fechaLimite)
        )
      );
    
    // Buscar ítems pendientes de aprobación con más de X días
    const itemsPendientesAprobacion = await db
      .select({
        id: items.id,
        codigo: items.codigo,
        supervisorId: items.supervisorId,
        defectoId: items.defectoId,
        unidadId: items.unidadId,
        fechaCreacion: items.fechaCreacion,
      })
      .from(items)
      .where(
        and(
          eq(items.status, 'pendiente_aprobacion'),
          lt(items.fechaCreacion, fechaLimite)
        )
      );
    
    console.log(`[CronJobs] Encontrados ${itemsPendientesFoto.length} ítems pendientes de foto y ${itemsPendientesAprobacion.length} pendientes de aprobación`);
    
    // Obtener IDs únicos de usuarios a notificar
    const residenteIds = Array.from(new Set(itemsPendientesFoto.map(i => i.residenteId).filter(Boolean))) as number[];
    const supervisorIds = Array.from(new Set(itemsPendientesAprobacion.map(i => i.supervisorId).filter(Boolean))) as number[];
    const allUserIds = Array.from(new Set([...residenteIds, ...supervisorIds]));
    
    if (allUserIds.length === 0) {
      console.log('[CronJobs] No hay usuarios para notificar');
      return;
    }
    
    // Obtener suscripciones push de los usuarios
    const suscripciones = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          inArray(pushSubscriptions.usuarioId, allUserIds),
          eq(pushSubscriptions.activo, true)
        )
      );
    
    console.log(`[CronJobs] Encontradas ${suscripciones.length} suscripciones push activas`);
    
    // Agrupar suscripciones por usuario
    const subsByUser = new Map<number, typeof suscripciones>();
    for (const sub of suscripciones) {
      if (!subsByUser.has(sub.usuarioId)) {
        subsByUser.set(sub.usuarioId, []);
      }
      subsByUser.get(sub.usuarioId)!.push(sub);
    }
    
    let notificacionesEnviadas = 0;
    
    // Notificar a residentes sobre ítems pendientes de foto
    for (const item of itemsPendientesFoto) {
      if (!item.residenteId) continue;
      
      const userSubs = subsByUser.get(item.residenteId);
      if (!userSubs || userSubs.length === 0) continue;
      
      // Obtener info del defecto y unidad
      const [defecto] = item.defectoId ? await db.select().from(defectos).where(eq(defectos.id, item.defectoId)).limit(1) : [null];
      const [unidad] = item.unidadId ? await db.select().from(unidades).where(eq(unidades.id, item.unidadId)).limit(1) : [null];
      
      const diasPendiente = Math.floor((Date.now() - new Date(item.fechaCreacion).getTime()) / (1000 * 60 * 60 * 24));
      
      for (const sub of userSubs) {
        await pushService.sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          {
            title: `⚠️ Ítem pendiente hace ${diasPendiente} días`,
            body: `${item.codigo} necesita foto "después"`,
            itemCodigo: item.codigo,
            unidadNombre: unidad?.nombre || '',
            defectoNombre: defecto?.nombre || '',
            itemId: item.id,
            data: { url: `/items/${item.id}`, itemId: item.id, tipo: 'urgente' }
          }
        );
        notificacionesEnviadas++;
      }
    }
    
    // Notificar a supervisores sobre ítems pendientes de aprobación
    for (const item of itemsPendientesAprobacion) {
      if (!item.supervisorId) continue;
      
      const userSubs = subsByUser.get(item.supervisorId);
      if (!userSubs || userSubs.length === 0) continue;
      
      // Obtener info del defecto y unidad
      const [defecto] = item.defectoId ? await db.select().from(defectos).where(eq(defectos.id, item.defectoId)).limit(1) : [null];
      const [unidad] = item.unidadId ? await db.select().from(unidades).where(eq(unidades.id, item.unidadId)).limit(1) : [null];
      
      const diasPendiente = Math.floor((Date.now() - new Date(item.fechaCreacion).getTime()) / (1000 * 60 * 60 * 24));
      
      for (const sub of userSubs) {
        await pushService.sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          {
            title: `⚠️ Ítem pendiente hace ${diasPendiente} días`,
            body: `${item.codigo} espera tu aprobación`,
            itemCodigo: item.codigo,
            unidadNombre: unidad?.nombre || '',
            defectoNombre: defecto?.nombre || '',
            itemId: item.id,
            data: { url: `/items/${item.id}`, itemId: item.id, tipo: 'urgente' }
          }
        );
        notificacionesEnviadas++;
      }
    }
    
    console.log(`[CronJobs] Enviadas ${notificacionesEnviadas} notificaciones push`);
    
  } catch (error) {
    console.error('[CronJobs] Error en notificación de ítems pendientes:', error);
  }
}

/**
 * Inicializa los cron jobs
 */
export function initializeCronJobs() {
  console.log('[CronJobs] Sistema de tareas programadas iniciado.');
  console.log(`[CronJobs] Zona horaria: ${TIMEZONE}`);
  
  // Notificar ítems pendientes urgentes cada día a las 9am y 3pm
  cron.schedule('0 9,15 * * 1-6', async () => {
    console.log('[CronJobs] Ejecutando notificación de ítems pendientes urgentes...');
    await notificarItemsPendientesUrgentes();
  }, { timezone: TIMEZONE });
  
  console.log('[CronJobs] Cron configurado: Notificaciones de \u00edtems urgentes (9am y 3pm, L-S)');

  // Resumen ejecutivo semanal: mi\u00e9rcoles a las 6pm
  cron.schedule('0 18 * * 3', async () => {
    console.log('[CronJobs] Ejecutando generaci\u00f3n de resumen ejecutivo semanal...');
    await generarYEnviarResumenSemanal();
  }, { timezone: TIMEZONE });

  console.log('[CronJobs] Cron configurado: Resumen ejecutivo semanal (mi\u00e9rcoles 6pm)');
}

/**
 * Genera y env\u00eda el resumen ejecutivo semanal para todos los proyectos activos
 */
async function generarYEnviarResumenSemanal() {
  const dbConn = await getDb();
  if (!dbConn) {
    console.log('[CronJobs] BD no disponible para resumen semanal');
    return;
  }

  try {
    // Obtener todos los proyectos activos
    const proyectosActivos = await dbConn.select().from(proyectos)
      .where(eq(proyectos.activo, true));

    console.log(`[CronJobs] Generando resumen semanal para ${proyectosActivos.length} proyectos`);

    for (const proyecto of proyectosActivos) {
      try {
        // 1. Recopilar datos
        const datos = await db.getDatosCompletosParaAnalisisIA(proyecto.id);

        // 2. Generar resumen con LLM
        const systemPrompt = `Eres un director de calidad en construcci\u00f3n. Genera un resumen ejecutivo conciso y estrat\u00e9gico.
REGLAS:
- M\u00e1ximo 1 cuartilla (400-500 palabras)
- Enfoque estrat\u00e9gico y accionable
- Cada conclusi\u00f3n debe referenciar datos espec\u00edficos
- Prioriza problemas cr\u00edticos
- Incluye instrucciones claras para el equipo
- Formato Markdown limpio
- Espa\u00f1ol profesional, tono ejecutivo`;

        const userPrompt = `Genera un RESUMEN EJECUTIVO del proyecto "${datos.proyecto.nombre}" basado en estos datos:
${JSON.stringify(datos, null, 2)}
Estructura obligatoria:
1. **Estado del Proyecto** (1 p\u00e1rrafo: m\u00e9tricas clave, tendencia general)
2. **Hallazgos Cr\u00edticos** (3-5 bullets con datos espec\u00edficos)
3. **Empresas con Atenci\u00f3n Prioritaria** (ranking por rendimiento)
4. **Acciones Inmediatas Requeridas** (instrucciones concretas para el equipo)
5. **Indicadores a Monitorear** (KPIs clave para la pr\u00f3xima semana)
M\u00e1ximo 500 palabras. Cada punto debe incluir n\u00fameros y referencias a datos reales.`;

        const response = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });

        const resumen = typeof response.choices[0]?.message?.content === 'string'
          ? response.choices[0].message.content
          : 'Error al generar resumen';

        // 3. Obtener versi\u00f3n y guardar en BD
        const version = await db.getNextReporteVersion(proyecto.id);
        const fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

        const { id: reporteId } = await db.createReporteIA({
          proyectoId: proyecto.id,
          tipo: 'resumen_ejecutivo',
          titulo: `Resumen Ejecutivo Semanal v${version} - ${proyecto.nombre}`,
          contenido: resumen,
          resumenEjecutivo: resumen,
          datosAnalizados: JSON.stringify(datos),
          version,
          creadoPorId: null, // Generado autom\u00e1ticamente
        });

        // 4. Obtener emails de usuarios del proyecto
        const destinatarios = await db.getEmailsUsuariosProyecto(proyecto.id);
        console.log(`[CronJobs] Enviando resumen de ${proyecto.nombre} a ${destinatarios.length} usuarios`);

        // 5. Enviar email a cada usuario
        const emailHtml = getResumenEjecutivoEmailTemplate(proyecto.nombre, resumen, version, fecha);
        const emailsEnviados: string[] = [];

        for (const dest of destinatarios) {
          const sent = await sendEmail({
            to: dest.email,
            subject: `Resumen Ejecutivo Semanal - ${proyecto.nombre} (v${version})`,
            html: emailHtml,
          });
          if (sent) emailsEnviados.push(dest.email);
        }

        // 6. Marcar como enviado
        await db.updateReporteIA(reporteId, {
          enviado: true,
          fechaEnvio: new Date(),
          destinatariosEnvio: JSON.stringify(emailsEnviados),
        });

        console.log(`[CronJobs] Resumen v${version} de ${proyecto.nombre} enviado a ${emailsEnviados.length} usuarios`);

        // 7. Notificar al owner
        await notifyOwner({
          title: `Resumen Semanal Generado - ${proyecto.nombre}`,
          content: `Se gener\u00f3 y envi\u00f3 el resumen ejecutivo v${version} a ${emailsEnviados.length} usuarios del proyecto ${proyecto.nombre}.`,
        });

      } catch (err) {
        console.error(`[CronJobs] Error generando resumen para proyecto ${proyecto.nombre}:`, err);
      }
    }

    console.log('[CronJobs] Generaci\u00f3n de res\u00famenes semanales completada');
  } catch (error) {
    console.error('[CronJobs] Error general en resumen semanal:', error);
  }
}

// Exportar funciones para pruebas manuales
export { notificarItemsPendientesUrgentes, generarYEnviarResumenSemanal };