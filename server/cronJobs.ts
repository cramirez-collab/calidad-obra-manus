/**
 * Cron Jobs para tareas programadas
 * 
 * Incluye notificaciones automáticas para ítems pendientes
 */

import cron from 'node-cron';
import { getDb } from './db';
import { items, pushSubscriptions, defectos, unidades } from '../drizzle/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';
import pushService from './pushService';

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
  
  console.log('[CronJobs] Cron configurado: Notificaciones de ítems urgentes (9am y 3pm, L-S)');
}

// Exportar funciones para pruebas manuales
export { notificarItemsPendientesUrgentes };
