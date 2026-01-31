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
    itemId: null
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  // Construir el cuerpo de la notificación con información del ítem
  let notificationBody = data.body;
  if (data.itemCodigo || data.unidadNombre || data.defectoNombre) {
    const parts = [];
    if (data.itemCodigo) parts.push(`📋 ${data.itemCodigo}`);
    if (data.unidadNombre) parts.push(`🏠 ${data.unidadNombre}`);
    if (data.defectoNombre) parts.push(`⚠️ ${data.defectoNombre}`);
    notificationBody = parts.join(' | ');
    if (data.body && data.body !== 'Nueva notificación') {
      notificationBody = `${data.body}\n${notificationBody}`;
    }
  }
  
  const options = {
    body: notificationBody,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || `oqc-item-${data.itemId || Date.now()}`,
    data: {
      ...data.data,
      itemId: data.itemId || data.data?.itemId,
      url: data.data?.url || (data.itemId ? `/items/${data.itemId}` : '/')
    },
    // Configuración para pantalla bloqueada
    vibrate: [300, 100, 300, 100, 300], // Vibración más larga para llamar atención
    requireInteraction: true, // Mantener visible hasta que el usuario interactúe
    renotify: true, // Notificar aunque ya exista una con el mismo tag
    silent: false, // Reproducir sonido
    // Prioridad alta para mostrarse incluso con pantalla bloqueada
    urgency: 'high',
    // Acciones disponibles
    actions: [
      { action: 'ver', title: '👁️ Ver Ítem', icon: '/icons/view-icon.png' },
      { action: 'cerrar', title: '✖️ Cerrar', icon: '/icons/close-icon.png' }
    ],
    // Timestamp para ordenar notificaciones
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
