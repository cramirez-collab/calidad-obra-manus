const CACHE_NAME = 'oqc-v5';
const OFFLINE_URL = '/offline.html';

// Recursos mínimos que se cachean
const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Instalar Service Worker - Limpieza agresiva
self.addEventListener('install', (event) => {
  console.log('[SW v5] Installing - Clearing ALL caches...');
  event.waitUntil(
    // Primero eliminar TODOS los caches existentes
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          console.log('[SW v5] Deleting cache:', name);
          return caches.delete(name);
        })
      );
    }).then(() => {
      // Luego crear el nuevo cache mínimo
      return caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW v5] Precaching minimal assets');
        return cache.addAll(PRECACHE_ASSETS);
      });
    })
  );
  // Forzar activación inmediata
  self.skipWaiting();
});

// Activar Service Worker - Tomar control inmediato
self.addEventListener('activate', (event) => {
  console.log('[SW v5] Activating - Taking control...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW v5] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW v5] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Estrategia: NETWORK ONLY para todo excepto offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones a otros orígenes y WebSocket
  if (url.origin !== location.origin) {
    return;
  }

  // Para peticiones de API, Network Only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'offline', message: 'Sin conexión.' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Para navegación, Network First con fallback a offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Para TODOS los demás recursos: NETWORK ONLY (sin cache)
  // Esto garantiza que siempre se cargue la versión más reciente
  event.respondWith(
    fetch(request).catch(() => {
      // Solo para imágenes, intentar cache como fallback
      if (request.destination === 'image') {
        return caches.match(request);
      }
      return new Response('', { status: 404 });
    })
  );
});

// Sincronización en background
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-items') {
    event.waitUntil(syncPendingItems());
  }
});

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
        console.error('[SW v5] Error syncing item:', error);
      }
    }
  } catch (error) {
    console.error('[SW v5] Error in sync:', error);
  }
}

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
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Ver' },
      { action: 'close', title: 'Cerrar' },
    ],
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'OQC', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});

// Mensaje para forzar actualización y limpieza
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    }).then(() => {
      event.source.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});
