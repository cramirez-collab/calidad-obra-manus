import webpush from "web-push";

// VAPID keys para Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BHG3H2kwVs_8UMW7_jnX6M_cSM3GTleYUVIrSlszwpcwnoWgC-YKdHQGNONmta2OSAuPkTWik31oZ4HsbUS4ar4";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "HT5vnOnFsywKcAH1iwXv-u4SFFc0KtMNDjAAHiZ2WQY";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@objetivaoqc.cc";

// Configurar web-push
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    itemId?: number;
    incidenteId?: number;
    tipo?: string;
  };
  // Información detallada del ítem para mostrar en la notificación
  itemCodigo?: string;
  unidadNombre?: string;
  defectoNombre?: string;
  itemId?: number;
  // Preview del comentario (3 palabras)
  comentarioPreview?: string;
  // Seguridad - incidentes
  incidenteId?: number;
  codigoSeg?: string;
  severidad?: string; // baja | media | alta | critica
  tipoIncidente?: string;
}

/**
 * Envía una notificación push a una suscripción específica
 * Incluye información detallada del ítem (código, unidad, defecto)
 */
export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<boolean> {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/icons/icon-192x192.png",
      badge: payload.badge || "/icons/badge-72x72.png",
      tag: payload.tag || (payload.incidenteId ? `oqc-seg-${payload.incidenteId}` : `objetivaoqc-item-${payload.itemId || Date.now()}`),
      data: {
        ...payload.data,
        itemId: payload.itemId,
        incidenteId: payload.incidenteId,
        url: payload.data?.url || (payload.incidenteId ? '/seguridad' : payload.itemId ? `/items/${payload.itemId}` : '/')
      },
      // Información del ítem para mostrar en la notificación
      itemCodigo: payload.itemCodigo,
      unidadNombre: payload.unidadNombre,
      defectoNombre: payload.defectoNombre,
      itemId: payload.itemId,
      comentarioPreview: payload.comentarioPreview,
      // Seguridad
      incidenteId: payload.incidenteId,
      codigoSeg: payload.codigoSeg,
      severidad: payload.severidad,
      tipoIncidente: payload.tipoIncidente
    });

    await webpush.sendNotification(pushSubscription, notificationPayload);
    return true;
  } catch (error: any) {
    console.error("[Push] Error enviando notificación:", error.message);
    // Si el error es 410 (Gone), la suscripción ya no es válida
    if (error.statusCode === 410 || error.statusCode === 404) {
      return false; // Indica que la suscripción debe ser eliminada
    }
    return false;
  }
}

/**
 * Envía notificaciones push a múltiples suscripciones
 */
export async function sendPushToMultiple(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const result = await sendPushNotification(sub, payload);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Obtiene la clave pública VAPID para el cliente
 */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

/**
 * Envía una notificación push con información completa del ítem
 * Esta función es la preferida para notificaciones relacionadas con ítems
 */
export async function sendItemPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  itemInfo: {
    itemId: number;
    codigo: string;
    unidadNombre: string;
    defectoNombre: string;
    titulo?: string;
    tipo: 'nuevo' | 'aprobado' | 'rechazado' | 'mensaje' | 'mencion' | 'foto_despues';
    comentarioResidente?: string | null;
    comentarioSupervisor?: string | null;
  }
): Promise<boolean> {
  const tipoTitulos: Record<string, string> = {
    nuevo: '🆕 Nuevo Ítem Creado',
    aprobado: '✅ Ítem Aprobado',
    rechazado: '❌ Ítem Rechazado',
    mensaje: '💬 Nuevo Mensaje',
    mencion: '📢 Te Mencionaron',
    foto_despues: '📸 Foto Después Agregada'
  };

  // Generar preview del comentario (3 palabras)
  const comentario = itemInfo.comentarioResidente || itemInfo.comentarioSupervisor || '';
  const palabras = comentario.split(' ');
  const comentarioPreview = comentario ? 
    (itemInfo.comentarioResidente ? 'R: ' : 'S: ') + 
    palabras.slice(0, 3).join(' ') + (palabras.length > 3 ? '...' : '') 
    : undefined;

  const payload: PushPayload = {
    title: tipoTitulos[itemInfo.tipo] || 'OQC - Notificación',
    body: itemInfo.titulo || 'Tienes una actualización en un ítem',
    itemCodigo: itemInfo.codigo,
    unidadNombre: itemInfo.unidadNombre,
    defectoNombre: itemInfo.defectoNombre,
    itemId: itemInfo.itemId,
    comentarioPreview,
    tag: `oqc-item-${itemInfo.itemId}-${itemInfo.tipo}`,
    data: {
      itemId: itemInfo.itemId,
      url: `/items/${itemInfo.itemId}`,
      tipo: itemInfo.tipo
    }
  };

  return sendPushNotification(subscription, payload);
}

export default {
  sendPushNotification,
  sendPushToMultiple,
  sendItemPushNotification,
  getVapidPublicKey,
};
