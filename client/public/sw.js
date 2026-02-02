// ============================================
// SISTEMA DE VERSIONADO AUTOMÁTICO v14
// ============================================
// Este número DEBE incrementarse con cada deploy
// El SW detectará cambios y forzará actualización en TODOS los dispositivos
const APP_VERSION = 14;
const CACHE_NAME = `oqc-v${APP_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Solo recursos estáticos mínimos
const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Intervalo de verificación de versión: 5 minutos
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000;

// Instalar Service Worker - Limpieza TOTAL de toda caché anterior
self.addEventListener('install', (event) => {
  console.log(`[SW v${APP_VERSION}] Installing - CLEARING ALL CACHE...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log(`[SW v${APP_VERSION}] Found caches to delete:`, cacheNames);
      return Promise.all(
        cacheNames.map((name) => {
          console.log(`[SW v${APP_VERSION}] Deleting cache:`, name);
          return caches.delete(name);
        })
      );
    }).then(() => {
      console.log(`[SW v${APP_VERSION}] All old caches deleted, creating new cache...`);
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      });
    }).then(() => {
      console.log(`[SW v${APP_VERSION}] Installation complete`);
    })
  );
  // Forzar activación inmediata SIN esperar
  self.skipWaiting();
});

// Activar - Tomar control inmediato y limpiar cualquier caché restante
self.addEventListener('activate', (event) => {
  console.log(`[SW v${APP_VERSION}] Activating - Taking control...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log(`[SW v${APP_VERSION}] Deleting old cache:`, name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log(`[SW v${APP_VERSION}] Claiming all clients...`);
      return self.clients.claim();
    }).then(() => {
      // Notificar a todos los clientes que recarguen
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ 
            type: 'SW_UPDATED', 
            version: APP_VERSION,
            forceReload: true 
          });
        });
      });
    }).then(() => {
      // Iniciar verificación periódica de versión
      startVersionCheck();
    })
  );
});

// Función para limpiar caché automáticamente
async function clearAllCaches() {
  console.log(`[SW v${APP_VERSION}] Clearing all caches...`);
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  
  // Recrear caché con assets mínimos
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(PRECACHE_ASSETS);
  
  console.log(`[SW v${APP_VERSION}] Cache cleared at`, new Date().toISOString());
  
  // Notificar a los clientes
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'CACHE_CLEARED', timestamp: Date.now() });
  });
}

// Verificar si hay nueva versión del SW
async function checkForUpdates() {
  try {
    // Forzar actualización del SW
    await self.registration.update();
    console.log(`[SW v${APP_VERSION}] Version check completed`);
  } catch (err) {
    console.log(`[SW v${APP_VERSION}] Version check failed:`, err);
  }
}

// Iniciar verificación periódica de versión
function startVersionCheck() {
  console.log(`[SW v${APP_VERSION}] Starting version check interval (every 5 min)`);
  setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);
}

// Fetch - Network First para TODO (máxima frescura)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar otros orígenes
  if (url.origin !== location.origin) return;

  // API - Network Only (nunca cachear)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => {
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
      fetch(request, { cache: 'no-store' }).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Assets estáticos - Network First con caché como fallback
  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then(response => {
        // Clonar respuesta para guardar en caché
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(request))
  );
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
      badge: '/icon-72.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'oqc-notification',
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
    navigator.clearAppBadge().catch(() => {});
  }
  
  const action = event.action;
  const url = event.notification.data?.url || '/';
  
  if (action === 'dismiss') return;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
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
  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'VERSION', version: APP_VERSION });
  }
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
