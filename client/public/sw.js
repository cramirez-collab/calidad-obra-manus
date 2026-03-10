// ============================================
// OBJETIVAQC - SERVICE WORKER v4.09
// ============================================
// VERSIÓN UNIFICADA: Debe coincidir con shared/version.ts VERSION_NUMBER
// ESTRATEGIA: Network-first para todo, cache solo como fallback offline
// REGLA: /api/ NUNCA se cachea
// FORCE-UPDATE: Al activarse, fuerza reload en TODOS los clientes
// ============================================
const APP_VERSION = 409;
const DISPLAY_VERSION = 'v4.09';
const CACHE_NAME = `oqc-v409`;
const OFFLINE_URL = '/offline.html';

// Recursos esenciales para modo offline
const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
];

// ==================== INSTALACIÓN ====================
self.addEventListener('install', (event) => {
  console.log(`[SW ${DISPLAY_VERSION}] Instalando...`);
  
  event.waitUntil(
    (async () => {
      // Limpiar TODAS las caches antiguas inmediatamente
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => {
          console.log(`[SW ${DISPLAY_VERSION}] Eliminando cache antigua: ${name}`);
          return caches.delete(name);
        })
      );
      
      // Crear nueva cache con recursos mínimos offline
      const cache = await caches.open(CACHE_NAME);
      for (const url of PRECACHE_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn(`[SW ${DISPLAY_VERSION}] No se pudo cachear: ${url}`);
        }
      }
      
      console.log(`[SW ${DISPLAY_VERSION}] Instalación completa`);
    })()
  );
  
  // FORZAR activación inmediata - no esperar a que se cierren tabs
  self.skipWaiting();
});

// ==================== ACTIVACIÓN ====================
self.addEventListener('activate', (event) => {
  console.log(`[SW ${DISPLAY_VERSION}] Activando...`);
  
  event.waitUntil(
    (async () => {
      // Limpiar caches que no sean la actual
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log(`[SW ${DISPLAY_VERSION}] Limpiando cache: ${name}`);
            return caches.delete(name);
          })
      );
      
      // Tomar control de TODOS los clientes inmediatamente
      await self.clients.claim();
      console.log(`[SW ${DISPLAY_VERSION}] Control tomado`);
      
      // ===== FORCE-UPDATE AGRESIVO =====
      // Notificar a TODOS los clientes que deben recargar INMEDIATAMENTE
      const allClients = await self.clients.matchAll({ includeUncontrolled: true });
      allClients.forEach(client => {
        client.postMessage({
          type: 'FORCE_RELOAD',
          version: APP_VERSION,
          displayVersion: DISPLAY_VERSION,
          reason: 'Nueva versión del Service Worker activada'
        });
      });
    })()
  );
});

// ==================== FETCH ====================
// ESTRATEGIA PRINCIPAL: Network-first para todo
// /api/ → SIEMPRE red, NUNCA cache
// Navegación → Network-first, fallback a offline.html
// Assets → Network-first, cache como fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requests de otros orígenes (CDN, fonts, etc.)
  if (url.origin !== location.origin) {
    return;
  }
  
  // ===== /api/ → SIEMPRE RED, NUNCA CACHE =====
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'offline',
            message: 'Sin conexión a internet.',
            offline: true
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'X-Offline': 'true'
            }
          }
        );
      })
    );
    return;
  }
  
  // ===== Navegación → Network-first, fallback offline =====
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cachear para offline
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          // Intentar cache
          const cached = await caches.match(request);
          if (cached) return cached;
          
          // Fallback a index para SPA
          const indexCached = await caches.match('/');
          if (indexCached) return indexCached;
          
          // Último recurso: página offline
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) return offlinePage;
          
          return new Response('Sin conexión', { status: 503 });
        })
    );
    return;
  }
  
  // ===== Assets con hash (inmutables) → Cache-first (nunca cambian) =====
  if (url.pathname.match(/\/assets\/.*\.[a-f0-9]{8}\./)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ===== Assets estáticos sin hash → Stale-while-revalidate =====
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached || new Response('', { status: 404 }));
        return cached || fetchPromise;
      })
    );
    return;
  }
  
  // ===== Todo lo demás → Network-first =====
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then(r => r || new Response('', { status: 404 })))
  );
});

// Verificar si es un asset estático cacheable
function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)$/i.test(pathname) ||
         pathname.startsWith('/assets/');
}

// ==================== SINCRONIZACIÓN HIPERSENSIBLE ====================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-items' || event.tag === 'sync-pending-items') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_PENDING', timestamp: Date.now() });
        });
      })
    );
  }
});

// Escuchar mensajes del cliente para sincronización inmediata
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FORCE_SYNC') {
    // Notificar a TODOS los clientes que sincronicen
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'SYNC_PENDING', timestamp: Date.now() });
      });
    });
  }
});

// ==================== PUSH NOTIFICATIONS ====================
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(data.badge || 1).catch(() => {});
  }
  
  let notificationBody = data.body || 'Nueva notificación';
  if (data.comentarioPreview) {
    notificationBody += '\n💬 ' + data.comentarioPreview;
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'OQC', {
      body: notificationBody,
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
  
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }
  
  if (event.action === 'dismiss') return;
  
  const notifData = event.notification.data || {};
  let targetUrl = '/';
  if (notifData.itemId) {
    targetUrl = `/items/${notifData.itemId}`;
  } else if (notifData.url) {
    targetUrl = notifData.url;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(targetUrl));
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ==================== MENSAJES DE CONTROL ====================
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.source?.postMessage({ type: 'VERSION', version: APP_VERSION, displayVersion: DISPLAY_VERSION });
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then(names => 
        Promise.all(names.map(n => caches.delete(n)))
      ).then(() => {
        event.source?.postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
      
    case 'SET_BADGE':
      if ('setAppBadge' in navigator) {
        navigator.setAppBadge(data?.count || 0).catch(() => {});
      }
      break;
      
    case 'CLEAR_BADGE':
      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {});
      }
      break;
      
    case 'CACHE_ASSETS':
      if (data?.urls?.length) {
        caches.open(CACHE_NAME).then(cache => {
          data.urls.forEach(url => cache.add(url).catch(() => {}));
        });
      }
      break;
      
    case 'CHECK_UPDATE':
      // Cliente solicita verificar si hay actualización
      event.source?.postMessage({ 
        type: 'VERSION', 
        version: APP_VERSION, 
        displayVersion: DISPLAY_VERSION 
      });
      break;
  }
});

console.log(`[SW ${DISPLAY_VERSION}] Service Worker cargado`);
