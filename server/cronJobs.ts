/**
 * Cron Jobs para tareas programadas
 * 
 * Incluye notificaciones automáticas para ítems pendientes
 */

import cron from 'node-cron';
import { getDb } from './db';
import { items, pushSubscriptions, defectos, unidades, programaSemanal, users } from '../drizzle/schema';
import { eq, and, lt, inArray, isNull, ne } from 'drizzle-orm';
import pushService from './pushService';
import { sendEmail } from './emailService';
import { notifyOwner } from './_core/notification';

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
/**
 * Alerta viernes 12pm: usuarios que no han entregado su programa semanal
 */
async function alertaProgramaNoEntregado() {
  console.log('[CronJobs] Verificando programas semanales no entregados...');
  const db = await getDb();
  if (!db) return;

  try {
    // Calcular lunes de esta semana
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    // Buscar programas entregados esta semana
    const programasEntregados = await db.select({
      usuarioId: programaSemanal.usuarioId,
      proyectoId: programaSemanal.proyectoId,
    })
      .from(programaSemanal)
      .where(
        and(
          eq(programaSemanal.semanaInicio, monday),
          ne(programaSemanal.status, 'borrador')
        )
      );

    const entregadosSet = new Set(programasEntregados.map(p => `${p.usuarioId}-${p.proyectoId}`));

    // Buscar usuarios activos con rol de residente/jefe_residente que deberían entregar
    const usuariosActivos = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      proyectoActivoId: users.proyectoActivoId,
    })
      .from(users)
      .where(
        and(
          eq(users.activo, true),
          inArray(users.role, ['residente', 'jefe_residente'])
        )
      );

    const noEntregaron: { name: string; email: string | null; proyectoId: number }[] = [];

    for (const u of usuariosActivos) {
      if (!u.proyectoActivoId) continue;
      const key = `${u.id}-${u.proyectoActivoId}`;
      if (!entregadosSet.has(key)) {
        noEntregaron.push({ name: u.name || 'Sin nombre', email: u.email, proyectoId: u.proyectoActivoId });
      }
    }

    if (noEntregaron.length === 0) {
      console.log('[CronJobs] Todos los usuarios han entregado su programa semanal');
      return;
    }

    console.log(`[CronJobs] ${noEntregaron.length} usuarios no han entregado programa semanal`);

    // Enviar push a usuarios que no entregaron
    for (const u of noEntregaron) {
      // Buscar suscripciones push del usuario
      const userObj = usuariosActivos.find(x => x.name === u.name);
      if (!userObj) continue;

      const subs = await db.select()
        .from(pushSubscriptions)
        .where(and(
          eq(pushSubscriptions.usuarioId, userObj.id),
          eq(pushSubscriptions.activo, true)
        ));

      for (const sub of subs) {
        await pushService.sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          {
            title: '⚠️ Programa Semanal pendiente',
            body: 'No has entregado tu programa semanal. Fecha límite: hoy viernes.',
            data: { url: '/programa-semanal', tipo: 'programa_pendiente' }
          }
        ).catch(() => {});
      }

      // Enviar email si tiene
      if (u.email) {
        await sendEmail({
          to: u.email,
          subject: '⚠️ Programa Semanal pendiente de entrega',
          html: `<h2>Programa Semanal Pendiente</h2><p>Hola ${u.name},</p><p>Aún no has entregado tu programa semanal. La fecha límite es hoy viernes.</p><p>Ingresa a <a href="https://objetivaqc.com/programa-semanal">ObjetivaQC</a> para entregar tu programa.</p>`,
        }).catch(() => {});
      }
    }

    // Notificar al owner con resumen
    const nombres = noEntregaron.map(u => u.name).join(', ');
    await notifyOwner({
      title: `⚠️ ${noEntregaron.length} programas semanales sin entregar`,
      content: `Usuarios pendientes: ${nombres}`,
    }).catch(() => {});

    console.log(`[CronJobs] Alertas enviadas a ${noEntregaron.length} usuarios por programa no entregado`);
  } catch (error) {
    console.error('[CronJobs] Error en alerta de programa no entregado:', error);
  }
}

/**
 * Alerta miércoles 12pm: usuarios que no han hecho corte semanal
 */
async function alertaCorteNoRealizado() {
  console.log('[CronJobs] Verificando cortes semanales no realizados...');
  const db = await getDb();
  if (!db) return;

  try {
    // Calcular lunes de esta semana
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    // Buscar programas entregados esta semana SIN corte
    const programasSinCorte = await db.select({
      id: programaSemanal.id,
      usuarioId: programaSemanal.usuarioId,
      proyectoId: programaSemanal.proyectoId,
    })
      .from(programaSemanal)
      .where(
        and(
          eq(programaSemanal.semanaInicio, monday),
          eq(programaSemanal.status, 'entregado') // Entregado pero sin corte
        )
      );

    if (programasSinCorte.length === 0) {
      console.log('[CronJobs] Todos los programas entregados ya tienen corte');
      return;
    }

    console.log(`[CronJobs] ${programasSinCorte.length} programas sin corte de miércoles`);

    const userIds = Array.from(new Set(programasSinCorte.map(p => p.usuarioId)));
    const usuariosInfo = await db.select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));

    const userMap = new Map(usuariosInfo.map(u => [u.id, u]));

    for (const prog of programasSinCorte) {
      const usuario = userMap.get(prog.usuarioId);
      if (!usuario) continue;

      // Push
      const subs = await db.select()
        .from(pushSubscriptions)
        .where(and(
          eq(pushSubscriptions.usuarioId, prog.usuarioId),
          eq(pushSubscriptions.activo, true)
        ));

      for (const sub of subs) {
        await pushService.sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          {
            title: '✂️ Corte semanal pendiente',
            body: 'No has realizado el corte de avance de tu programa semanal. Fecha límite: hoy miércoles.',
            data: { url: '/programa-semanal', tipo: 'corte_pendiente' }
          }
        ).catch(() => {});
      }

      // Email
      if (usuario.email) {
        await sendEmail({
          to: usuario.email,
          subject: '✂️ Corte semanal pendiente',
          html: `<h2>Corte Semanal Pendiente</h2><p>Hola ${usuario.name},</p><p>Aún no has realizado el corte de avance de tu programa semanal. La fecha límite es hoy miércoles.</p><p>Ingresa a <a href="https://objetivaqc.com/programa-semanal">ObjetivaQC</a> para registrar tu avance.</p>`,
        }).catch(() => {});
      }
    }

    // Notificar al owner
    const nombres = programasSinCorte.map(p => userMap.get(p.usuarioId)?.name || 'Desconocido').join(', ');
    await notifyOwner({
      title: `✂️ ${programasSinCorte.length} cortes semanales pendientes`,
      content: `Usuarios pendientes: ${nombres}`,
    }).catch(() => {});

    console.log(`[CronJobs] Alertas enviadas a ${programasSinCorte.length} usuarios por corte no realizado`);
  } catch (error) {
    console.error('[CronJobs] Error en alerta de corte no realizado:', error);
  }
}

export function initializeCronJobs() {
  console.log('[CronJobs] Sistema de tareas programadas iniciado.');
  console.log(`[CronJobs] Zona horaria: ${TIMEZONE}`);
  
  // Notificar ítems pendientes urgentes cada día a las 9am y 3pm
  cron.schedule('0 9,15 * * 1-6', async () => {
    console.log('[CronJobs] Ejecutando notificación de ítems pendientes urgentes...');
    await notificarItemsPendientesUrgentes();
  }, { timezone: TIMEZONE });
  
  // Alerta viernes 12pm: programas no entregados
  cron.schedule('0 12 * * 5', async () => {
    console.log('[CronJobs] Ejecutando alerta de programas no entregados (viernes)...');
    await alertaProgramaNoEntregado();
  }, { timezone: TIMEZONE });

  // Alerta miércoles 12pm: cortes no realizados
  cron.schedule('0 12 * * 3', async () => {
    console.log('[CronJobs] Ejecutando alerta de cortes no realizados (miércoles)...');
    await alertaCorteNoRealizado();
  }, { timezone: TIMEZONE });
  
  console.log('[CronJobs] Cron configurado: Notificaciones de ítems urgentes (9am y 3pm, L-S)');
  console.log('[CronJobs] Cron configurado: Alerta programa no entregado (viernes 12pm)');
  console.log('[CronJobs] Cron configurado: Alerta corte no realizado (miércoles 12pm)');
}

// Exportar funciones para pruebas manuales
export { notificarItemsPendientesUrgentes, alertaProgramaNoEntregado, alertaCorteNoRealizado };
