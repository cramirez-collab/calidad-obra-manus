// ============================================
// ============================================
// SISTEMA OFFLINE v54 - NUCLEAR
// ============================================
// MANDATORIO Y OBLIGATORIO:
// - Dominio: objetivaqc.com (PERMANENTE)
// - Modo offline: SIEMPRE ACTIVADO
// - Resolución fotos: 275px BALANCE CALIDAD/VELOCIDAD
// - Tamaño lápiz: 2 FINO PARA PRECISIÓN
// - CONSECUTIVO #N INCREMENTAL DEBAJO DE OBJETIVA
// - ESTADÍSTICAS FILTRADAS POR PROYECTO
// - TODOS los dispositivos DEBEN tener v54
// ============================================
const APP_VERSION = 54;
const CACHE_NAME = `oqc-v${APP_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Recursos que SIEMPRE deben estar disponibles offline
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Patrones de URLs que deben cachearse para offline
const CACHEABLE_PATTERNS = [
  /\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)$/i,
  /^\/assets\//,
  /^\/src\//,
];

// ==================== INSTALACIÓN ====================
self.addEventListener('install', (event) => {
  console.log(`[SW v${APP_VERSION}] Instalando - Modo Offline 24/7`);
  
  event.waitUntil(
    (async () => {
      // Limpiar caches antiguas
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log(`[SW v${APP_VERSION}] Eliminando cache antigua:`, name);
            return caches.delete(name);
          })
      );
      
      // Crear nueva cache con recursos esenciales
      const cache = await caches.open(CACHE_NAME);
      console.log(`[SW v${APP_VERSION}] Cacheando recursos esenciales...`);
      
      // Cachear recursos uno por uno para evitar fallos
      for (const url of PRECACHE_ASSETS) {
        try {
          await cache.add(url);
          console.log(`[SW v${APP_VERSION}] Cacheado:`, url);
        } catch (err) {
          console.warn(`[SW v${APP_VERSION}] No se pudo cachear:`, url, err);
        }
      }
      
      console.log(`[SW v${APP_VERSION}] Instalación completa`);
    })()
  );
  
  // Activar inmediatamente
  self.skipWaiting();
});

// ==================== ACTIVACIÓN ====================
self.addEventListener('activate', (event) => {
  console.log(`[SW v${APP_VERSION}] Activando - Tomando control...`);
  
  event.waitUntil(
    (async () => {
      // Tomar control de todos los clientes
      await self.clients.claim();
      console.log(`[SW v${APP_VERSION}] Control tomado de todos los clientes`);
      
      // Notificar a los clientes de la nueva versión
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_UPDATED',
          version: APP_VERSION
        });
      });
    })()
  );
});

// ==================== FETCH - ESTRATEGIA OFFLINE-FIRST ====================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Solo manejar requests del mismo origen
  if (url.origin !== location.origin) {
    return;
  }
  
  // API calls - Network first con fallback offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // Navegación - Cache first para funcionamiento offline
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }
  
  // Assets estáticos - Cache first para velocidad
  if (shouldCache(url.pathname)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }
  
  // Otros requests - Network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Manejar requests de API
async function handleAPIRequest(request) {
  try {
    // Intentar red primero
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    console.log(`[SW v${APP_VERSION}] API offline:`, request.url);
    
    // Si es un GET, intentar cache
    if (request.method === 'GET') {
      const cached = await caches.match(request);
      if (cached) return cached;
    }
    
    // Retornar respuesta de error offline
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'Sin conexión. Los datos se sincronizarán cuando vuelva la conexión.',
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
  }
}

// Manejar navegación
async function handleNavigationRequest(request) {
  try {
    // Intentar red primero
    const response = await fetch(request);
    
    // Cachear la respuesta para uso offline
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    
    return response;
  } catch (error) {
    console.log(`[SW v${APP_VERSION}] Navegación offline, sirviendo desde cache`);
    
    // Intentar servir desde cache
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Fallback a index.html para SPA
    const indexCached = await caches.match('/');
    if (indexCached) return indexCached;
    
    // Último recurso: página offline
    return caches.match(OFFLINE_URL);
  }
}

// Manejar assets estáticos
async function handleStaticAsset(request) {
  // Cache first para velocidad
  const cached = await caches.match(request);
  if (cached) {
    // Actualizar cache en background
    updateCacheInBackground(request);
    return cached;
  }
  
  // Si no está en cache, obtener de red
  try {
    const response = await fetch(request);
    
    // Cachear para uso futuro
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    
    return response;
  } catch (error) {
    console.log(`[SW v${APP_VERSION}] Asset no disponible offline:`, request.url);
    return new Response('', { status: 404 });
  }
}

// Actualizar cache en background
function updateCacheInBackground(request) {
  fetch(request)
    .then(response => {
      if (response.ok) {
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, response);
        });
      }
    })
    .catch(() => {});
}

// Verificar si una URL debe cachearse
function shouldCache(pathname) {
  return CACHEABLE_PATTERNS.some(pattern => pattern.test(pathname));
}

// ==================== SINCRONIZACIÓN EN BACKGROUND ====================
self.addEventListener('sync', (event) => {
  console.log(`[SW v${APP_VERSION}] Background sync:`, event.tag);
  
  if (event.tag === 'sync-items') {
    event.waitUntil(syncPendingItems());
  }
});

async function syncPendingItems() {
  // Notificar a los clientes para que sincronicen
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_PENDING',
      timestamp: Date.now()
    });
  });
}

// ==================== PUSH NOTIFICATIONS ====================
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  // Actualizar badge
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(data.badge || 1).catch(() => {});
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
  
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }
  
  const action = event.action;
  const notifData = event.notification.data || {};
  
  // Si el usuario cierra, no hacer nada
  if (action === 'dismiss') return;
  
  // Determinar URL de destino - priorizar itemId para navegar al item
  let targetUrl = '/';
  if (notifData.itemId) {
    targetUrl = `/items/${notifData.itemId}`;
  } else if (notifData.url) {
    targetUrl = notifData.url;
  }
  
  console.log(`[SW v${APP_VERSION}] Notificacion click - navegando a:`, targetUrl);
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Buscar ventana existente de la app
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Enfocar y navegar al item
          return client.focus().then(() => {
            return client.navigate(targetUrl);
          });
        }
      }
      // Si no hay ventana abierta, abrir una nueva
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
      event.source?.postMessage({ type: 'VERSION', version: APP_VERSION });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
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
      cacheAdditionalAssets(data?.urls || []);
      break;
  }
});

// Limpiar todas las caches
async function clearAllCaches() {
  console.log(`[SW v${APP_VERSION}] Limpiando todas las caches...`);
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  
  // Recrear cache con assets esenciales
  const cache = await caches.open(CACHE_NAME);
  for (const url of PRECACHE_ASSETS) {
    try {
      await cache.add(url);
    } catch (err) {
      console.warn(`[SW v${APP_VERSION}] No se pudo re-cachear:`, url);
    }
  }
  
  console.log(`[SW v${APP_VERSION}] Cache limpiada y recreada`);
}

// Cachear assets adicionales
async function cacheAdditionalAssets(urls) {
  const cache = await caches.open(CACHE_NAME);
  for (const url of urls) {
    try {
      await cache.add(url);
      console.log(`[SW v${APP_VERSION}] Asset adicional cacheado:`, url);
    } catch (err) {
      console.warn(`[SW v${APP_VERSION}] No se pudo cachear:`, url);
    }
  }
}

console.log(`[SW v${APP_VERSION}] Service Worker cargado - Modo Offline 24/7 activado`);
