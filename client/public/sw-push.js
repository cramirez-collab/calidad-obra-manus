// Service Worker para notificaciones push - ObjetivaOQC
const CACHE_NAME = 'objetivaoqc-push-v1';

// Evento de instalación
self.addEventListener('install', (event) => {
  console.log('[SW Push] Instalado');
  self.skipWaiting();
});

// Evento de activación
self.addEventListener('activate', (event) => {
  console.log('[SW Push] Activado');
  event.waitUntil(clients.claim());
});

// Evento de notificación push recibida
self.addEventListener('push', (event) => {
  console.log('[SW Push] Notificación recibida');
  
  let data = {
    title: 'ObjetivaOQC',
    body: 'Nueva notificación',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'objetivaoqc-notification',
    data: {}
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Ver' },
      { action: 'close', title: 'Cerrar' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Evento de click en notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[SW Push] Click en notificación');
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Buscar ventana existente
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (urlToOpen !== '/') {
              client.navigate(urlToOpen);
            }
            return;
          }
        }
        // Abrir nueva ventana si no hay ninguna
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Evento de cierre de notificación
self.addEventListener('notificationclose', (event) => {
  console.log('[SW Push] Notificación cerrada');
});
