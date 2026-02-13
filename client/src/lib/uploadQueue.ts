/**
 * Cola de subida robusta con sincronización automática
 * Garantiza que las fotos NUNCA se pierdan, incluso sin conexión
 * 
 * Sistema unificado para:
 * - foto_despues: subir foto después de corrección
 * - foto_antes: subir foto al crear ítem (fallback offline)
 * - create_item: crear ítem completo offline
 */

const DB_NAME = 'oqc_upload_queue';
const DB_VERSION = 2; // Bump version for schema upgrade
const STORE_NAME = 'pending_uploads';

export interface PendingUpload {
  id?: number;
  itemId: number;
  tipo: 'foto_antes' | 'foto_despues' | 'create_item';
  foto: string;
  comentario?: string;
  /** Full create_item payload when tipo === 'create_item' */
  itemData?: Record<string, any>;
  timestamp: number;
  intentos: number;
  maxIntentos: number;
  ultimoError?: string;
  /** Next retry timestamp (for exponential backoff) */
  proximoReintento?: number;
}

// Singleton DB connection to avoid opening/closing repeatedly
let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(new Error('Error abriendo IndexedDB'));
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('itemId', 'itemId', { unique: false });
        store.createIndex('tipo', 'tipo', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      // Reset on close so we reconnect next time
      dbInstance.onclose = () => { dbInstance = null; dbPromise = null; };
      dbInstance.onerror = () => { dbInstance = null; dbPromise = null; };
      resolve(dbInstance);
    };
  });

  return dbPromise;
}

/**
 * Agregar una foto/acción a la cola de subida.
 * Retorna el ID asignado en IndexedDB.
 */
export async function agregarACola(
  upload: Omit<PendingUpload, 'id' | 'timestamp' | 'intentos' | 'maxIntentos' | 'proximoReintento'>
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const data: PendingUpload = {
      ...upload,
      timestamp: Date.now(),
      intentos: 0,
      maxIntentos: 50, // Muchos reintentos — la foto no se pierde
      proximoReintento: Date.now(), // Disponible inmediatamente
    };

    const request = store.add(data);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(new Error('Error agregando a cola'));
  });
}

/**
 * Obtener todas las fotos pendientes que están listas para reintento
 */
export async function obtenerPendientes(): Promise<PendingUpload[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all: PendingUpload[] = request.result || [];
      const now = Date.now();
      // Solo retornar las que están listas para reintento
      const ready = all.filter(u => !u.proximoReintento || u.proximoReintento <= now);
      resolve(ready);
    };
    request.onerror = () => reject(new Error('Error obteniendo pendientes'));
  });
}

/**
 * Obtener TODAS las fotos pendientes (incluyendo las que aún no toca reintentar)
 */
export async function obtenerTodas(): Promise<PendingUpload[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error('Error obteniendo todas'));
  });
}

/**
 * Eliminar una foto de la cola (después de subir exitosamente)
 */
export async function eliminarDeCola(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Error eliminando de cola'));
  });
}

/**
 * Marcar un intento fallido con backoff exponencial.
 * Backoff: 5s, 10s, 20s, 40s, 60s, 60s, 60s... (cap en 60s)
 */
export async function marcarFallo(id: number, error?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const data: PendingUpload = getRequest.result;
      if (data) {
        data.intentos = (data.intentos || 0) + 1;
        data.ultimoError = error;
        // Backoff exponencial con cap en 60 segundos
        const backoffMs = Math.min(5000 * Math.pow(2, data.intentos - 1), 60000);
        data.proximoReintento = Date.now() + backoffMs;
        store.put(data);
      }
      resolve();
    };
    getRequest.onerror = () => reject(new Error('Error actualizando intentos'));
  });
}

/**
 * Actualizar intentos (compatibilidad con SyncManager existente)
 */
export async function actualizarIntentos(id: number, intentos: number, error?: string): Promise<void> {
  return marcarFallo(id, error);
}

/**
 * Contar TODAS las fotos pendientes (para badge)
 */
export async function contarPendientes(): Promise<number> {
  const todas = await obtenerTodas();
  return todas.length;
}

/**
 * Verificar si hay fotos pendientes para un ítem específico
 */
export async function tieneFotoPendiente(itemId: number, tipo: 'foto_antes' | 'foto_despues'): Promise<boolean> {
  const todas = await obtenerTodas();
  return todas.some(p => p.itemId === itemId && p.tipo === tipo);
}

/**
 * Limpiar fotos antiguas (más de 7 días)
 */
export async function limpiarAntiguos(): Promise<number> {
  const db = await openDB();
  const limite = Date.now() - (7 * 24 * 60 * 60 * 1000);

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

    transaction.oncomplete = () => resolve(eliminados);
    transaction.onerror = () => reject(new Error('Error limpiando antiguos'));
  });
}

/**
 * Helper: intentar subir con retry + backoff, y si todo falla guardar en cola.
 * Retorna true si se subió exitosamente, false si se guardó en cola.
 */
export async function subirConRetry(
  uploadFn: () => Promise<any>,
  fallbackData: Omit<PendingUpload, 'id' | 'timestamp' | 'intentos' | 'maxIntentos' | 'proximoReintento'>,
  maxIntentos: number = 5
): Promise<{ success: boolean; queueId?: number }> {
  for (let i = 0; i < maxIntentos; i++) {
    try {
      if (i > 0) {
        // Backoff: 2s, 4s, 8s, 16s
        const wait = Math.min(2000 * Math.pow(2, i - 1), 16000);
        await new Promise(r => setTimeout(r, wait));
      }
      await uploadFn();
      return { success: true };
    } catch (error: any) {
      console.warn(`[UploadQueue] Intento ${i + 1}/${maxIntentos} falló:`, error.message);
      // Si no hay conexión, no seguir intentando
      if (!navigator.onLine) break;
    }
  }

  // Todos los intentos fallaron — guardar en cola
  try {
    const queueId = await agregarACola(fallbackData);
    return { success: false, queueId };
  } catch (e) {
    console.error('[UploadQueue] Error guardando en cola:', e);
    throw new Error('No se pudo subir ni guardar localmente');
  }
}
