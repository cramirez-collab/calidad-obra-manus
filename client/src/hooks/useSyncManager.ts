/**
 * Hook para sincronizar automáticamente los ítems pendientes
 * cuando vuelve la conexión a internet
 */

import { useEffect, useCallback, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { 
  getPendingActions, 
  removePendingAction, 
  isOnline, 
  onConnectionChange,
  countPendingActions
} from '@/lib/offlineStorage';
import { toast } from 'sonner';

export function useSyncManager() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [online, setOnline] = useState(isOnline());
  
  const createItemMutation = trpc.items.create.useMutation();
  
  // Actualizar contador de pendientes
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await countPendingActions();
      setPendingCount(count);
    } catch (error) {
      console.error('[SyncManager] Error contando pendientes:', error);
    }
  }, []);
  
  // Sincronizar una acción pendiente
  const syncAction = useCallback(async (action: any): Promise<boolean> => {
    console.log('[SyncManager] Sincronizando acción:', action.type, action.id);
    
    try {
      if (action.type === 'create_item') {
        const data = action.data;
        await createItemMutation.mutateAsync({
          proyectoId: data.proyectoId,
          empresaId: data.empresaId,
          unidadId: data.unidadId,
          especialidadId: data.especialidadId,
          defectoId: data.defectoId,
          espacioId: data.espacioId,
          titulo: data.titulo,
          fotoAntesBase64: data.fotoAntesBase64,
          fotoAntesMarcadaBase64: data.fotoAntesMarcadaBase64,
          clientId: data.clientId,
          // Código QR preasignado (si viene de escanear etiqueta nueva)
          codigoQrPreasignado: data.codigoQrPreasignado,
        });
        console.log('[SyncManager] Ítem sincronizado:', action.id);
        return true;
      }
      
      // Otros tipos de acciones...
      console.warn('[SyncManager] Tipo de acción no soportado:', action.type);
      return true; // Marcar como sincronizado para eliminarlo
    } catch (error: any) {
      console.error('[SyncManager] Error sincronizando:', error);
      
      // Si es error de duplicado, marcar como sincronizado
      if (error.message?.includes('duplicate') || error.message?.includes('DUPLICATE')) {
        console.log('[SyncManager] Ítem duplicado, marcando como sincronizado');
        return true;
      }
      
      return false;
    }
  }, [createItemMutation]);
  
  // Sincronizar todas las acciones pendientes
  const syncAll = useCallback(async () => {
    if (!isOnline() || isSyncing) {
      console.log('[SyncManager] No se puede sincronizar:', { online: isOnline(), isSyncing });
      return;
    }
    
    setIsSyncing(true);
    console.log('[SyncManager] Iniciando sincronización...');
    
    try {
      const pendingActions = await getPendingActions();
      
      if (pendingActions.length === 0) {
        console.log('[SyncManager] No hay acciones pendientes');
        return;
      }
      
      console.log('[SyncManager] Acciones pendientes:', pendingActions.length);
      let syncedCount = 0;
      let failedCount = 0;
      
      for (const action of pendingActions) {
        const success = await syncAction(action);
        
        if (success) {
          await removePendingAction(action.id);
          syncedCount++;
        } else {
          failedCount++;
        }
      }
      
      await updatePendingCount();
      
      if (syncedCount > 0) {
        toast.success(`${syncedCount} ítem(s) sincronizado(s)`);
      }
      
      if (failedCount > 0) {
        toast.warning(`${failedCount} ítem(s) pendiente(s) de sincronizar`);
      }
      
      console.log('[SyncManager] Sincronización completada:', { syncedCount, failedCount });
    } catch (error) {
      console.error('[SyncManager] Error en sincronización:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, syncAction, updatePendingCount]);
  
  // Escuchar cambios de conexión
  useEffect(() => {
    const unsubscribe = onConnectionChange((isOnlineNow) => {
      console.log('[SyncManager] Cambio de conexión:', isOnlineNow);
      setOnline(isOnlineNow);
      
      if (isOnlineNow) {
        // Sincronizar INMEDIATAMENTE al detectar conexión
        console.log('[SyncManager] Conexión detectada, sincronizando inmediatamente...');
        syncAll();
      }
    });
    
    return unsubscribe;
  }, [syncAll]);
  
  // Sincronizar al montar el componente si hay conexión
  useEffect(() => {
    updatePendingCount();
    
    if (isOnline()) {
      // Sincronizar rápidamente al cargar (1 segundo)
      const timer = setTimeout(() => {
        syncAll();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Sincronizar periódicamente cada 5 segundos si hay conexión (INSTANTÁNEO)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline() && !isSyncing) {
        updatePendingCount();
        syncAll();
      }
    }, 5000); // Cada 5 segundos para sincronización INSTANTÁNEA
    
    return () => clearInterval(interval);
  }, [isSyncing, syncAll, updatePendingCount]);
  
  return {
    pendingCount,
    isSyncing,
    online,
    syncAll,
    updatePendingCount,
  };
}
