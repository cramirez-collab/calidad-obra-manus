const CACHE_NAME = 'oqc-v10';
const OFFLINE_URL = '/offline.html';

// Solo recursos estáticos mínimos
const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Instalar Service Worker - Limpieza TOTAL de toda caché anterior
self.addEventListener('install', (event) => {
  console.log('[SW v10] Installing - CLEARING ALL CACHE...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('[SW v10] Found caches to delete:', cacheNames);
      return Promise.all(
        cacheNames.map((name) => {
          console.log('[SW v10] Deleting cache:', name);
          return caches.delete(name);
        })
      );
    }).then(() => {
      console.log('[SW v10] All old caches deleted, creating new cache...');
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      });
    }).then(() => {
      console.log('[SW v10] Installation complete');
    })
  );
  // Forzar activación inmediata
  self.skipWaiting();
});

// Activar - Tomar control inmediato y limpiar cualquier caché restante
self.addEventListener('activate', (event) => {
  console.log('[SW v10] Activating - Taking control...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW v10] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW v10] Claiming all clients...');
      return self.clients.claim();
    }).then(() => {
      // Notificar a todos los clientes que recarguen
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: 'v10' });
        });
      });
    })
  );
});

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
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => {
      event.source?.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});
