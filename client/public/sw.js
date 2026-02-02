const CACHE_NAME = 'oqc-v11';
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
  console.log('[SW v11] Installing - CLEARING ALL CACHE...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('[SW v11] Found caches to delete:', cacheNames);
      return Promise.all(
        cacheNames.map((name) => {
          console.log('[SW v11] Deleting cache:', name);
          return caches.delete(name);
        })
      );
    }).then(() => {
      console.log('[SW v11] All old caches deleted, creating new cache...');
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      });
    }).then(() => {
      console.log('[SW v11] Installation complete');
    })
  );
  // Forzar activación inmediata
  self.skipWaiting();
});

// Activar - Tomar control inmediato y limpiar cualquier caché restante
self.addEventListener('activate', (event) => {
  console.log('[SW v11] Activating - Taking control...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW v11] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW v11] Claiming all clients...');
      return self.clients.claim();
    }).then(() => {
      // Notificar a todos los clientes que recarguen
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: 'v11' });
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
  console.log('[SW v11] Auto-clearing all caches...');
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  
  // Recrear caché con assets mínimos
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(PRECACHE_ASSETS);
  
  console.log('[SW v11] Auto-clear complete at', new Date().toISOString());
  
  // Notificar a los clientes
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'AUTO_CACHE_CLEARED', timestamp: Date.now() });
  });
}

// Iniciar limpieza automática cada 4 horas
function startAutoCacheClear() {
  console.log('[SW v11] Starting auto-clear interval (every 4 hours)');
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

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'OQC', {
      body: data.body || 'Nueva notificación',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
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
});
