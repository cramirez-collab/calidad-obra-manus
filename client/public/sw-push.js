// Service Worker para notificaciones push - OQC
const CACHE_NAME = 'oqc-push-v3';

// Evento de instalación
self.addEventListener('install', (event) => {
  console.log('[SW Push] Instalado v3');
  self.skipWaiting();
});

// Evento de activación
self.addEventListener('activate', (event) => {
  console.log('[SW Push] Activado v3');
  event.waitUntil(clients.claim());
});

// Evento de notificación push recibida
self.addEventListener('push', (event) => {
  console.log('[SW Push] Notificación recibida');
  
  let data = {
    title: 'OQC',
    body: 'Nueva notificación',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'oqc-notification',
    data: {},
    // Información del ítem para mostrar en la notificación
    itemCodigo: null,
    unidadNombre: null,
    defectoNombre: null,
    itemId: null,
    // Seguridad
    incidenteId: null,
    codigoSeg: null,
    severidad: null,
    tipoIncidente: null
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  // Construir el cuerpo de la notificación con información del ítem o incidente
  let notificationBody = data.body;
  if (data.codigoSeg || data.tipoIncidente) {
    // Notificación de seguridad
    const parts = [];
    if (data.codigoSeg) parts.push(`🚨 ${data.codigoSeg}`);
    if (data.tipoIncidente) parts.push(`${data.tipoIncidente}`);
    if (data.severidad) parts.push(`Severidad: ${data.severidad.toUpperCase()}`);
    notificationBody = parts.join(' | ');
    if (data.body && data.body !== 'Nueva notificación') {
      notificationBody = `${data.body}\n${notificationBody}`;
    }
  } else if (data.itemCodigo || data.unidadNombre || data.defectoNombre) {
    const parts = [];
    if (data.itemCodigo) parts.push(`📋 ${data.itemCodigo}`);
    if (data.unidadNombre) parts.push(`🏠 ${data.unidadNombre}`);
    if (data.defectoNombre) parts.push(`⚠️ ${data.defectoNombre}`);
    notificationBody = parts.join(' | ');
    if (data.body && data.body !== 'Nueva notificación') {
      notificationBody = `${data.body}\n${notificationBody}`;
    }
  }
  
  // Vibración según severidad de seguridad
  let vibratePattern = [300, 100, 300, 100, 300]; // default
  if (data.severidad === 'critica') {
    vibratePattern = [500, 100, 500, 100, 500, 100, 500, 100, 500]; // alarma larga
  } else if (data.severidad === 'alta') {
    vibratePattern = [400, 100, 400, 100, 400, 100, 400]; // fuerte
  } else if (data.severidad === 'media') {
    vibratePattern = [300, 100, 300, 100, 300]; // medio
  } else if (data.severidad === 'baja') {
    vibratePattern = [200, 100, 200]; // suave
  }

  // Determinar acciones según tipo
  const isSeguridad = !!data.incidenteId || !!data.codigoSeg;
  const actions = isSeguridad
    ? [
        { action: 'ver', title: '🔍 Ver Incidente', icon: '/icons/view-icon.png' },
        { action: 'cerrar', title: '✖️ Cerrar', icon: '/icons/close-icon.png' }
      ]
    : [
        { action: 'ver', title: '👁️ Ver Ítem', icon: '/icons/view-icon.png' },
        { action: 'cerrar', title: '✖️ Cerrar', icon: '/icons/close-icon.png' }
      ];

  const options = {
    body: notificationBody,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || (isSeguridad ? `oqc-seg-${data.incidenteId || Date.now()}` : `oqc-item-${data.itemId || Date.now()}`),
    data: {
      ...data.data,
      itemId: data.itemId || data.data?.itemId,
      incidenteId: data.incidenteId,
      url: data.data?.url || (data.incidenteId ? '/seguridad' : data.itemId ? `/items/${data.itemId}` : '/')
    },
    vibrate: vibratePattern,
    requireInteraction: data.severidad === 'critica' || data.severidad === 'alta' || true,
    renotify: true,
    silent: false,
    urgency: data.severidad === 'critica' ? 'very-low' : 'high', // very-low = max priority in some browsers
    actions,
    timestamp: Date.now()
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Evento de click en notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[SW Push] Click en notificación', event.action);
  event.notification.close();
  
  // Si el usuario hizo click en cerrar, no hacer nada más
  if (event.action === 'cerrar') {
    return;
  }
  
  // Obtener la URL del ítem desde los datos de la notificación
  const itemId = event.notification.data?.itemId;
  const urlToOpen = event.notification.data?.url || (itemId ? `/items/${itemId}` : '/');
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Buscar ventana existente de la app
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Enfocar la ventana existente
            return client.focus().then(() => {
              // Navegar al ítem específico
              if (urlToOpen && urlToOpen !== '/') {
                return client.navigate(self.location.origin + urlToOpen);
              }
            });
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(self.location.origin + urlToOpen);
        }
      })
  );
});

// Evento de cierre de notificación
self.addEventListener('notificationclose', (event) => {
  console.log('[SW Push] Notificación cerrada por el usuario');
});

// Evento para manejar mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
