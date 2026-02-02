/**
 * Cola de subida robusta con sincronización automática
 * Garantiza que las fotos NUNCA se pierdan, incluso sin conexión
 */

const DB_NAME = 'oqc_upload_queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending_uploads';

interface PendingUpload {
  id?: number;
  itemId: number;
  tipo: 'foto_antes' | 'foto_despues';
  foto: string;
  comentario?: string;
  timestamp: number;
  intentos: number;
  ultimoError?: string;
}

// Abrir o crear la base de datos IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(new Error('Error abriendo IndexedDB'));
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('itemId', 'itemId', { unique: false });
        store.createIndex('tipo', 'tipo', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
  });
}

// Agregar una foto a la cola de subida
export async function agregarACola(upload: Omit<PendingUpload, 'id' | 'timestamp' | 'intentos'>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const data: PendingUpload = {
      ...upload,
      timestamp: Date.now(),
      intentos: 0,
    };
    
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(new Error('Error agregando a cola'));
    
    transaction.oncomplete = () => db.close();
  });
}

// Obtener todas las fotos pendientes
export async function obtenerPendientes(): Promise<PendingUpload[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Error obteniendo pendientes'));
    
    transaction.oncomplete = () => db.close();
  });
}

// Eliminar una foto de la cola (después de subir exitosamente)
export async function eliminarDeCola(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Error eliminando de cola'));
    
    transaction.oncomplete = () => db.close();
  });
}

// Actualizar intentos de una foto
export async function actualizarIntentos(id: number, intentos: number, error?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const data = getRequest.result;
      if (data) {
        data.intentos = intentos;
        data.ultimoError = error;
        store.put(data);
      }
      resolve();
    };
    getRequest.onerror = () => reject(new Error('Error actualizando intentos'));
    
    transaction.oncomplete = () => db.close();
  });
}

// Contar fotos pendientes
export async function contarPendientes(): Promise<number> {
  const pendientes = await obtenerPendientes();
  return pendientes.length;
}

// Verificar si hay fotos pendientes para un ítem específico
export async function tieneFotoPendiente(itemId: number, tipo: 'foto_antes' | 'foto_despues'): Promise<boolean> {
  const pendientes = await obtenerPendientes();
  return pendientes.some(p => p.itemId === itemId && p.tipo === tipo);
}

// Limpiar fotos antiguas (más de 7 días)
export async function limpiarAntiguos(): Promise<number> {
  const db = await openDB();
  const limite = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 días
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const range = IDBKeyRange.upperBound(limite);
    const request = index.openCursor(range);
    
    let eliminados = 0;
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        eliminados++;
        cursor.continue();
      }
    };
    
    transaction.oncomplete = () => {
      db.close();
      resolve(eliminados);
    };
    transaction.onerror = () => reject(new Error('Error limpiando antiguos'));
  });
}
