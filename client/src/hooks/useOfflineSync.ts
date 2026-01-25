import { useState, useEffect, useCallback } from 'react';

interface PendingItem {
  id?: number;
  type: 'item' | 'photo';
  data: any;
  timestamp: number;
}

const DB_NAME = 'CalidadObraOffline';
const DB_VERSION = 1;

// Abrir IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('pendingItems')) {
        db.createObjectStore('pendingItems', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pendingPhotos')) {
        db.createObjectStore('pendingPhotos', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('cachedData')) {
        db.createObjectStore('cachedData', { keyPath: 'key' });
      }
    };
  });
}

// Hook principal
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Actualizar estado de conexión
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Intentar sincronizar cuando vuelve la conexión
      syncPendingItems();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Contar ítems pendientes
  const updatePendingCount = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(['pendingItems', 'pendingPhotos'], 'readonly');
      
      const itemsStore = transaction.objectStore('pendingItems');
      const photosStore = transaction.objectStore('pendingPhotos');
      
      const itemsCount = await new Promise<number>((resolve) => {
        const request = itemsStore.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });
      
      const photosCount = await new Promise<number>((resolve) => {
        const request = photosStore.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });
      
      setPendingCount(itemsCount + photosCount);
    } catch (error) {
      console.error('[OfflineSync] Error counting pending items:', error);
    }
  }, []);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  // Guardar ítem para sincronización posterior
  const savePendingItem = useCallback(async (type: 'item' | 'photo', data: any) => {
    try {
      const db = await openDB();
      const storeName = type === 'item' ? 'pendingItems' : 'pendingPhotos';
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const item: PendingItem = {
        type,
        data,
        timestamp: Date.now(),
      };
      
      await new Promise<void>((resolve, reject) => {
        const request = store.add(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      updatePendingCount();
      
      // Registrar sync en background si está disponible
      if ('serviceWorker' in navigator && 'sync' in (window as any).registration) {
        try {
          await (navigator.serviceWorker.ready as any).then((reg: any) => {
            return reg.sync.register('sync-items');
          });
        } catch (e) {
          console.log('[OfflineSync] Background sync not available');
        }
      }
      
      return true;
    } catch (error) {
      console.error('[OfflineSync] Error saving pending item:', error);
      return false;
    }
  }, [updatePendingCount]);

  // Sincronizar ítems pendientes
  const syncPendingItems = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    
    setIsSyncing(true);
    
    try {
      const db = await openDB();
      
      // Sincronizar ítems
      const itemsTransaction = db.transaction(['pendingItems'], 'readwrite');
      const itemsStore = itemsTransaction.objectStore('pendingItems');
      
      const items = await new Promise<PendingItem[]>((resolve) => {
        const request = itemsStore.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve([]);
      });
      
      for (const item of items) {
        try {
          const response = await fetch('/api/trpc/items.create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ json: item.data }),
          });
          
          if (response.ok) {
            // Eliminar ítem sincronizado
            const deleteTransaction = db.transaction(['pendingItems'], 'readwrite');
            const deleteStore = deleteTransaction.objectStore('pendingItems');
            deleteStore.delete(item.id!);
          }
        } catch (error) {
          console.error('[OfflineSync] Error syncing item:', error);
        }
      }
      
      // Sincronizar fotos
      const photosTransaction = db.transaction(['pendingPhotos'], 'readwrite');
      const photosStore = photosTransaction.objectStore('pendingPhotos');
      
      const photos = await new Promise<PendingItem[]>((resolve) => {
        const request = photosStore.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve([]);
      });
      
      for (const photo of photos) {
        try {
          const response = await fetch('/api/trpc/items.uploadFotoDespues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ json: photo.data }),
          });
          
          if (response.ok) {
            const deleteTransaction = db.transaction(['pendingPhotos'], 'readwrite');
            const deleteStore = deleteTransaction.objectStore('pendingPhotos');
            deleteStore.delete(photo.id!);
          }
        } catch (error) {
          console.error('[OfflineSync] Error syncing photo:', error);
        }
      }
      
      updatePendingCount();
    } catch (error) {
      console.error('[OfflineSync] Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, updatePendingCount]);

  // Guardar datos en caché
  const cacheData = useCallback(async (key: string, data: any) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(['cachedData'], 'readwrite');
      const store = transaction.objectStore('cachedData');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put({ key, data, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[OfflineSync] Error caching data:', error);
    }
  }, []);

  // Obtener datos del caché
  const getCachedData = useCallback(async <T>(key: string): Promise<T | null> => {
    try {
      const db = await openDB();
      const transaction = db.transaction(['cachedData'], 'readonly');
      const store = transaction.objectStore('cachedData');
      
      return new Promise((resolve) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result?.data || null);
        request.onerror = () => resolve(null);
      });
    } catch (error) {
      console.error('[OfflineSync] Error getting cached data:', error);
      return null;
    }
  }, []);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    savePendingItem,
    syncPendingItems,
    cacheData,
    getCachedData,
  };
}

export default useOfflineSync;
