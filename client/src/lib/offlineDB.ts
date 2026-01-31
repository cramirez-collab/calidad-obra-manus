/**
 * Sistema de almacenamiento offline con IndexedDB
 * Permite trabajar sin internet en la obra
 */

const DB_NAME = 'objetiva-oqc-offline';
const DB_VERSION = 1;

interface PendingAction {
  id: string;
  type: 'createItem' | 'updateItem' | 'uploadFoto' | 'sendMessage';
  data: any;
  timestamp: number;
  retries: number;
}

interface CachedData {
  key: string;
  data: any;
  timestamp: number;
  expiresAt?: number;
}

let db: IDBDatabase | null = null;

export async function initOfflineDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Store para acciones pendientes (cola de sincronización)
      if (!database.objectStoreNames.contains('pendingActions')) {
        const store = database.createObjectStore('pendingActions', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }

      // Store para datos cacheados (proyectos, items, usuarios, etc.)
      if (!database.objectStoreNames.contains('cache')) {
        const store = database.createObjectStore('cache', { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Store para imágenes cacheadas
      if (!database.objectStoreNames.contains('images')) {
        const store = database.createObjectStore('images', { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// ==================== ACCIONES PENDIENTES ====================

export async function addPendingAction(action: Omit<PendingAction, 'id' | 'timestamp' | 'retries'>): Promise<string> {
  const database = await initOfflineDB();
  const id = `${action.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const pendingAction: PendingAction = {
    ...action,
    id,
    timestamp: Date.now(),
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = database.transaction('pendingActions', 'readwrite');
    const store = tx.objectStore('pendingActions');
    const request = store.add(pendingAction);
    
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingActions(): Promise<PendingAction[]> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('pendingActions', 'readonly');
    const store = tx.objectStore('pendingActions');
    const index = store.index('timestamp');
    const request = index.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingAction(id: string): Promise<void> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('pendingActions', 'readwrite');
    const store = tx.objectStore('pendingActions');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updatePendingActionRetries(id: string, retries: number): Promise<void> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('pendingActions', 'readwrite');
    const store = tx.objectStore('pendingActions');
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const action = getRequest.result;
      if (action) {
        action.retries = retries;
        store.put(action);
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// ==================== CACHÉ DE DATOS ====================

export async function cacheData(key: string, data: any, ttlMinutes?: number): Promise<void> {
  const database = await initOfflineDB();
  
  const cached: CachedData = {
    key,
    data,
    timestamp: Date.now(),
    expiresAt: ttlMinutes ? Date.now() + (ttlMinutes * 60 * 1000) : undefined,
  };

  return new Promise((resolve, reject) => {
    const tx = database.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    const request = store.put(cached);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('cache', 'readonly');
    const store = tx.objectStore('cache');
    const request = store.get(key);
    
    request.onsuccess = () => {
      const cached = request.result as CachedData | undefined;
      if (!cached) {
        resolve(null);
        return;
      }
      
      // Verificar si expiró
      if (cached.expiresAt && cached.expiresAt < Date.now()) {
        // Eliminar dato expirado
        const deleteTx = database.transaction('cache', 'readwrite');
        deleteTx.objectStore('cache').delete(key);
        resolve(null);
        return;
      }
      
      resolve(cached.data as T);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearCache(): Promise<void> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==================== CACHÉ DE IMÁGENES ====================

export async function cacheImage(key: string, base64: string): Promise<void> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('images', 'readwrite');
    const store = tx.objectStore('images');
    const request = store.put({ key, data: base64, timestamp: Date.now() });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedImage(key: string): Promise<string | null> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('images', 'readonly');
    const store = tx.objectStore('images');
    const request = store.get(key);
    
    request.onsuccess = () => {
      const cached = request.result;
      resolve(cached?.data || null);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== UTILIDADES ====================

export async function getOfflineStats(): Promise<{
  pendingActions: number;
  cachedItems: number;
  cachedImages: number;
}> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const stats = { pendingActions: 0, cachedItems: 0, cachedImages: 0 };
    
    const tx = database.transaction(['pendingActions', 'cache', 'images'], 'readonly');
    
    tx.objectStore('pendingActions').count().onsuccess = (e) => {
      stats.pendingActions = (e.target as IDBRequest).result;
    };
    
    tx.objectStore('cache').count().onsuccess = (e) => {
      stats.cachedItems = (e.target as IDBRequest).result;
    };
    
    tx.objectStore('images').count().onsuccess = (e) => {
      stats.cachedImages = (e.target as IDBRequest).result;
    };
    
    tx.oncomplete = () => resolve(stats);
    tx.onerror = () => reject(tx.error);
  });
}
