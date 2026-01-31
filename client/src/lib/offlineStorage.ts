/**
 * Sistema de almacenamiento offline con IndexedDB
 * Permite trabajar sin internet y sincronizar cuando haya conexión
 */

const DB_NAME = 'objetiva-qc-offline';
const DB_VERSION = 1;

interface PendingAction {
  id: string;
  type: 'create_item' | 'upload_foto_antes' | 'upload_foto_despues' | 'send_message' | 'update_item';
  data: any;
  timestamp: number;
  retries: number;
}

interface CachedImage {
  key: string;
  base64: string;
  timestamp: number;
}

let db: IDBDatabase | null = null;

/**
 * Inicializa la base de datos IndexedDB
 */
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
      
      // Store para acciones pendientes de sincronizar
      if (!database.objectStoreNames.contains('pendingActions')) {
        const store = database.createObjectStore('pendingActions', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
      
      // Store para imágenes cacheadas
      if (!database.objectStoreNames.contains('cachedImages')) {
        const store = database.createObjectStore('cachedImages', { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Store para datos de proyectos cacheados
      if (!database.objectStoreNames.contains('cachedData')) {
        database.createObjectStore('cachedData', { keyPath: 'key' });
      }
    };
  });
}

/**
 * Guarda una acción pendiente para sincronizar después
 */
export async function savePendingAction(action: Omit<PendingAction, 'id' | 'timestamp' | 'retries'>): Promise<string> {
  const database = await initOfflineDB();
  const id = `${action.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const pendingAction: PendingAction = {
    ...action,
    id,
    timestamp: Date.now(),
    retries: 0
  };
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('pendingActions', 'readwrite');
    const store = tx.objectStore('pendingActions');
    const request = store.add(pendingAction);
    
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene todas las acciones pendientes
 */
export async function getPendingActions(): Promise<PendingAction[]> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('pendingActions', 'readonly');
    const store = tx.objectStore('pendingActions');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Elimina una acción pendiente (después de sincronizar)
 */
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

/**
 * Guarda una imagen en caché local
 */
export async function cacheImage(key: string, base64: string): Promise<void> {
  const database = await initOfflineDB();
  
  const cachedImage: CachedImage = {
    key,
    base64,
    timestamp: Date.now()
  };
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('cachedImages', 'readwrite');
    const store = tx.objectStore('cachedImages');
    const request = store.put(cachedImage);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene una imagen del caché local
 */
export async function getCachedImage(key: string): Promise<string | null> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('cachedImages', 'readonly');
    const store = tx.objectStore('cachedImages');
    const request = store.get(key);
    
    request.onsuccess = () => {
      const result = request.result as CachedImage | undefined;
      resolve(result?.base64 || null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda datos en caché (proyectos, usuarios, etc.)
 */
export async function cacheData(key: string, data: any): Promise<void> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('cachedData', 'readwrite');
    const store = tx.objectStore('cachedData');
    const request = store.put({ key, data, timestamp: Date.now() });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene datos del caché
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('cachedData', 'readonly');
    const store = tx.objectStore('cachedData');
    const request = store.get(key);
    
    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.data || null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Limpia imágenes antiguas del caché (más de 7 días)
 */
export async function cleanOldCache(): Promise<void> {
  const database = await initOfflineDB();
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('cachedImages', 'readwrite');
    const store = tx.objectStore('cachedImages');
    const index = store.index('timestamp');
    const range = IDBKeyRange.upperBound(sevenDaysAgo);
    const request = index.openCursor(range);
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Cuenta las acciones pendientes
 */
export async function countPendingActions(): Promise<number> {
  const actions = await getPendingActions();
  return actions.length;
}
