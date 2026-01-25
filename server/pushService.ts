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
    tipo?: string;
  };
}

/**
 * Envía una notificación push a una suscripción específica
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
      tag: payload.tag || "objetivaoqc-notification",
      data: payload.data || {},
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

export default {
  sendPushNotification,
  sendPushToMultiple,
  getVapidPublicKey,
};
