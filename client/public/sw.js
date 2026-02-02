const CACHE_NAME = 'oqc-v4';
const OFFLINE_URL = '/offline.html';

// Recursos que se cachean inmediatamente
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW v4] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW v4] Precaching assets');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Forzar activación inmediata
  self.skipWaiting();
});

// Activar Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW v4] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW v4] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW v4] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Estrategia de cache: Network First para todo
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones a otros orígenes y WebSocket
  if (url.origin !== location.origin) {
    return;
  }

  // Para peticiones de API, usar Network Only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'offline', message: 'Sin conexión. Los datos se sincronizarán cuando vuelva la conexión.' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Para archivos JS/TS/TSX, SIEMPRE usar Network First (nunca cache)
  if (url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.ts') || 
      url.pathname.endsWith('.tsx') ||
      url.pathname.includes('/src/') ||
      url.pathname.includes('/@vite/') ||
      url.pathname.includes('/@fs/') ||
      url.pathname.includes('/node_modules/')) {
    event.respondWith(
      fetch(request).catch(() => {
        console.log('[SW v4] Network failed for:', url.pathname);
        return caches.match(request);
      })
    );
    return;
  }

  // Para navegación, usar Network First
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // Para otros recursos estáticos (imágenes, CSS), usar Network First con cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Sincronización en background
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-items') {
    event.waitUntil(syncPendingItems());
  }
});

// Función para sincronizar ítems pendientes
async function syncPendingItems() {
  try {
    const db = await openIndexedDB();
    const pendingItems = await getAllPendingItems(db);
    
    for (const item of pendingItems) {
      try {
        const response = await fetch('/api/trpc/items.create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data),
        });
        
        if (response.ok) {
          await deletePendingItem(db, item.id);
        }
      } catch (error) {
        console.error('[SW v4] Error syncing item:', error);
      }
    }
  } catch (error) {
    console.error('[SW v4] Error in sync:', error);
  }
}

// Helpers para IndexedDB
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OQCOffline', 2);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingItems')) {
        db.createObjectStore('pendingItems', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pendingPhotos')) {
        db.createObjectStore('pendingPhotos', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getAllPendingItems(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingItems'], 'readonly');
    const store = transaction.objectStore('pendingItems');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deletePendingItem(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingItems'], 'readwrite');
    const store = transaction.objectStore('pendingItems');
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Notificaciones push
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || 'Nueva notificación',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: [
      { action: 'open', title: 'Ver' },
      { action: 'close', title: 'Cerrar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'OQC', options)
  );
});

// Click en notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Mensaje para forzar actualización
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});
