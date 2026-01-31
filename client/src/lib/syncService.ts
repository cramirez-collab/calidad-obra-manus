/**
 * Servicio de sincronización automática
 * Procesa la cola de acciones pendientes cuando hay conexión
 */
import { 
  getPendingActions, 
  removePendingAction, 
  updatePendingActionRetries,
} from './offlineDB';

interface PendingAction {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retries: number;
}

type SyncCallback = (action: PendingAction) => Promise<boolean>;

const MAX_RETRIES = 3;
let syncInProgress = false;
let syncCallbacks: Map<string, SyncCallback> = new Map();

/**
 * Registrar callback para procesar un tipo de acción
 */
export function registerSyncHandler(type: string, callback: SyncCallback) {
  syncCallbacks.set(type, callback);
}

/**
 * Procesar todas las acciones pendientes
 */
export async function processPendingActions(): Promise<{
  processed: number;
  failed: number;
  remaining: number;
}> {
  if (syncInProgress) {
    return { processed: 0, failed: 0, remaining: 0 };
  }

  syncInProgress = true;
  let processed = 0;
  let failed = 0;

  try {
    const actions = await getPendingActions();
    
    for (const action of actions) {
      const callback = syncCallbacks.get(action.type);
      
      if (!callback) {
        console.warn(`No sync handler for action type: ${action.type}`);
        continue;
      }

      try {
        const success = await callback(action);
        
        if (success) {
          await removePendingAction(action.id);
          processed++;
        } else {
          // Incrementar reintentos
          const newRetries = action.retries + 1;
          if (newRetries >= MAX_RETRIES) {
            // Máximo de reintentos alcanzado, eliminar
            await removePendingAction(action.id);
            failed++;
            console.error(`Action ${action.id} failed after ${MAX_RETRIES} retries`);
          } else {
            await updatePendingActionRetries(action.id, newRetries);
          }
        }
      } catch (error) {
        console.error(`Error processing action ${action.id}:`, error);
        const newRetries = action.retries + 1;
        if (newRetries >= MAX_RETRIES) {
          await removePendingAction(action.id);
          failed++;
        } else {
          await updatePendingActionRetries(action.id, newRetries);
        }
      }
    }

    const remaining = (await getPendingActions()).length;
    return { processed, failed, remaining };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Iniciar sincronización automática cuando hay conexión
 */
export function startAutoSync(intervalMs: number = 10000) {
  const sync = async () => {
    if (navigator.onLine) {
      await processPendingActions();
    }
  };

  // Sincronizar cuando vuelve la conexión
  window.addEventListener('online', sync);

  // Sincronizar periódicamente
  const interval = setInterval(sync, intervalMs);

  // Sincronizar inmediatamente
  sync();

  return () => {
    window.removeEventListener('online', sync);
    clearInterval(interval);
  };
}
