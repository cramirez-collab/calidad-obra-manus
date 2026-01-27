import { useState, useEffect, useCallback } from 'react';

interface PendingAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: any;
  timestamp: number;
}

const STORAGE_KEY = 'objetiva_offline_queue';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Cargar acciones pendientes del localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPendingActions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[Offline] Error cargando cola:', error);
    }
  }, []);

  // Guardar acciones pendientes en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingActions));
    } catch (error) {
      console.error('[Offline] Error guardando cola:', error);
    }
  }, [pendingActions]);

  // Escuchar cambios de conectividad
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Offline] Conexión restaurada');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('[Offline] Sin conexión');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Agregar acción a la cola
  const queueAction = useCallback((action: Omit<PendingAction, 'id' | 'timestamp'>) => {
    const newAction: PendingAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    setPendingActions(prev => [...prev, newAction]);
    console.log('[Offline] Acción encolada:', newAction);
    
    return newAction.id;
  }, []);

  // Remover acción de la cola
  const removeAction = useCallback((actionId: string) => {
    setPendingActions(prev => prev.filter(a => a.id !== actionId));
  }, []);

  // Limpiar toda la cola
  const clearQueue = useCallback(() => {
    setPendingActions([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Sincronizar acciones pendientes
  const syncPendingActions = useCallback(async (
    syncHandler: (action: PendingAction) => Promise<boolean>
  ) => {
    if (!isOnline || pendingActions.length === 0 || isSyncing) {
      return { synced: 0, failed: 0 };
    }

    setIsSyncing(true);
    let synced = 0;
    let failed = 0;

    // Ordenar por timestamp (más antiguo primero)
    const sortedActions = [...pendingActions].sort((a, b) => a.timestamp - b.timestamp);

    for (const action of sortedActions) {
      try {
        const success = await syncHandler(action);
        if (success) {
          removeAction(action.id);
          synced++;
          console.log('[Offline] Acción sincronizada:', action.id);
        } else {
          failed++;
          console.log('[Offline] Acción falló:', action.id);
        }
      } catch (error) {
        failed++;
        console.error('[Offline] Error sincronizando:', action.id, error);
      }
    }

    setIsSyncing(false);
    return { synced, failed };
  }, [isOnline, pendingActions, isSyncing, removeAction]);

  return {
    isOnline,
    isOffline: !isOnline,
    pendingActions,
    pendingCount: pendingActions.length,
    isSyncing,
    queueAction,
    removeAction,
    clearQueue,
    syncPendingActions,
  };
}

export default useOffline;
