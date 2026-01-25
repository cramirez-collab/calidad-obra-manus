const CACHE_NAME = 'calidad-obra-v1';
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
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching assets');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activar Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Estrategia de cache: Network First con fallback a cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones a APIs externas y WebSocket
  if (url.origin !== location.origin) {
    return;
  }

  // Para peticiones de API, usar Network Only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Si falla, guardar en IndexedDB para sincronizar después
        return new Response(
          JSON.stringify({ error: 'offline', message: 'Sin conexión. Los datos se sincronizarán cuando vuelva la conexión.' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Para navegación, usar Network First
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Guardar en cache
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

  // Para otros recursos, usar Cache First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Actualizar cache en background
        fetch(request).then((response) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response);
          });
        });
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // Guardar en cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      });
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
        console.error('[SW] Error syncing item:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Error in sync:', error);
  }
}

// Helpers para IndexedDB
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CalidadObraOffline', 1);
    
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
    self.registration.showNotification(data.title || 'Calidad de Obra', options)
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
