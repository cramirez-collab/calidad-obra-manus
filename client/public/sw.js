const CACHE_NAME = 'oqc-v12';
const OFFLINE_URL = '/offline.html';

// Solo recursos estáticos mínimos
const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Intervalo de limpieza automática: 4 horas en milisegundos
const AUTO_CLEAR_INTERVAL = 4 * 60 * 60 * 1000; // 4 horas

// Instalar Service Worker - Limpieza TOTAL de toda caché anterior
self.addEventListener('install', (event) => {
  console.log('[SW v12] Installing - CLEARING ALL CACHE...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('[SW v12] Found caches to delete:', cacheNames);
      return Promise.all(
        cacheNames.map((name) => {
          console.log('[SW v12] Deleting cache:', name);
          return caches.delete(name);
        })
      );
    }).then(() => {
      console.log('[SW v12] All old caches deleted, creating new cache...');
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      });
    }).then(() => {
      console.log('[SW v12] Installation complete');
    })
  );
  // Forzar activación inmediata
  self.skipWaiting();
});

// Activar - Tomar control inmediato y limpiar cualquier caché restante
self.addEventListener('activate', (event) => {
  console.log('[SW v12] Activating - Taking control...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW v12] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW v12] Claiming all clients...');
      return self.clients.claim();
    }).then(() => {
      // Notificar a todos los clientes que recarguen
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: 'v12' });
        });
      });
    }).then(() => {
      // Iniciar limpieza automática cada 4 horas
      startAutoCacheClear();
    })
  );
});

// Función para limpiar caché automáticamente
async function clearAllCaches() {
  console.log('[SW v12] Auto-clearing all caches...');
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  
  // Recrear caché con assets mínimos
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(PRECACHE_ASSETS);
  
  console.log('[SW v12] Auto-clear complete at', new Date().toISOString());
  
  // Notificar a los clientes
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'AUTO_CACHE_CLEARED', timestamp: Date.now() });
  });
}

// Iniciar limpieza automática cada 4 horas
function startAutoCacheClear() {
  console.log('[SW v12] Starting auto-clear interval (every 4 hours)');
  setInterval(() => {
    clearAllCaches();
  }, AUTO_CLEAR_INTERVAL);
}

// Fetch - Network Only para TODO (máxima frescura, sin caché)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar otros orígenes
  if (url.origin !== location.origin) return;

  // API - Network Only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'offline' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Navegación - Network con fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Todo lo demás - Network Only (sin cache)
  event.respondWith(fetch(request));
});

// Push notifications con badges
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  // Actualizar badge del icono de la app
  if ('setAppBadge' in navigator) {
    const badgeCount = data.badge || 1;
    navigator.setAppBadge(badgeCount).catch(err => {
      console.log('[SW] Error setting badge:', err);
    });
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'OQC', {
      body: data.body || 'Nueva notificación',
      icon: '/icon-192.png',
      badge: '/icon-72.png', // Badge pequeño para la notificación
      vibrate: [200, 100, 200],
      tag: data.tag || 'oqc-notification', // Agrupar notificaciones similares
      renotify: true,
      requireInteraction: data.requireInteraction || false,
      data: { 
        url: data.url || '/',
        itemId: data.itemId,
        tipo: data.tipo
      },
      actions: data.actions || [
        { action: 'open', title: 'Ver' },
        { action: 'dismiss', title: 'Cerrar' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Limpiar badge al hacer click
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(err => {
      console.log('[SW] Error clearing badge:', err);
    });
  }
  
  const action = event.action;
  const url = event.notification.data?.url || '/';
  
  if (action === 'dismiss') {
    return; // Solo cerrar
  }
  
  // Abrir o enfocar la ventana existente
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Buscar ventana existente
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Si no hay ventana, abrir una nueva
      return clients.openWindow(url);
    })
  );
});

// Limpiar badge cuando se cierra la notificación
self.addEventListener('notificationclose', (event) => {
  // Verificar si hay más notificaciones pendientes
  self.registration.getNotifications().then(notifications => {
    if (notifications.length === 0 && 'clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  });
});

// Mensajes de control
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    clearAllCaches().then(() => {
      event.source?.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
  if (event.data?.type === 'FORCE_CLEAR_NOW') {
    clearAllCaches();
  }
  // Actualizar badge manualmente
  if (event.data?.type === 'SET_BADGE') {
    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(event.data.count || 0).catch(() => {});
    }
  }
  if (event.data?.type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }
});
