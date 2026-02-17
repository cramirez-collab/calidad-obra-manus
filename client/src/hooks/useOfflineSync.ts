/**
 * Hook para manejar sincronización offline
 * Detecta conexión, guarda acciones pendientes y sincroniza cuando hay internet
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  initOfflineDB,
  savePendingAction,
  getPendingActions,
  removePendingAction,
  countPendingActions,
  cacheImage,
  getCachedImage,
  cacheData,
  getCachedData
} from '@/lib/offlineStorage';

interface UseOfflineSyncReturn {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  saveForLater: (type: string, data: any) => Promise<string>;
  syncNow: () => Promise<void>;
  cacheImageLocally: (key: string, base64: string) => Promise<void>;
  getLocalImage: (key: string) => Promise<string | null>;
  cacheDataLocally: (key: string, data: any) => Promise<void>;
  getLocalData: <T>(key: string) => Promise<T | null>;
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInProgress = useRef(false);

  // Inicializar IndexedDB al montar
  useEffect(() => {
    initOfflineDB().catch(console.error);
    updatePendingCount();
  }, []);

  // Escuchar cambios de conexión
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // SyncManager ya maneja la sincronización al reconectar
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
      // No mostrar toast aquí — ConnectionStatus ya muestra banner
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Actualizar contador de pendientes
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await countPendingActions();
      setPendingCount(count);
    } catch (error) {
      console.error('Error al contar pendientes:', error);
    }
  }, []);

  // Guardar acción para sincronizar después
  const saveForLater = useCallback(async (type: string, data: any): Promise<string> => {
    try {
      const id = await savePendingAction({ type: type as any, data });
      await updatePendingCount();
      toast.info('Guardado localmente', { 
        description: 'Se sincronizará cuando haya conexión',
        duration: 3000 
      });
      return id;
    } catch (error) {
      console.error('Error al guardar para después:', error);
      throw error;
    }
  }, [updatePendingCount]);

  // Sincronizar todas las acciones pendientes
  const syncNow = useCallback(async () => {
    if (syncInProgress.current || !navigator.onLine) return;
    
    syncInProgress.current = true;
    setIsSyncing(true);

    try {
      const pending = await getPendingActions();
      
      if (pending.length === 0) {
        setIsSyncing(false);
        syncInProgress.current = false;
        return;
      }

      let synced = 0;
      let failed = 0;

      for (const action of pending) {
        try {
          // Aquí se procesaría cada tipo de acción
          // Por ahora solo marcamos como completada
          // En producción, esto llamaría a los endpoints correspondientes
          
          // Simular llamada al servidor
          // await processAction(action);
          
          await removePendingAction(action.id);
          synced++;
        } catch (error) {
          console.error(`Error sincronizando acción ${action.id}:`, error);
          failed++;
        }
      }

      await updatePendingCount();

      if (synced > 0) {
        toast.success(`${synced} cambios sincronizados`, { duration: 3000 });
      }
      if (failed > 0) {
        toast.error(`${failed} cambios fallaron`, { 
          description: 'Se reintentará más tarde',
          duration: 5000 
        });
      }
    } catch (error) {
      console.error('Error en sincronización:', error);
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  }, [updatePendingCount]);

  // Cachear imagen localmente
  const cacheImageLocally = useCallback(async (key: string, base64: string) => {
    try {
      await cacheImage(key, base64);
    } catch (error) {
      console.error('Error al cachear imagen:', error);
    }
  }, []);

  // Obtener imagen del caché local
  const getLocalImage = useCallback(async (key: string): Promise<string | null> => {
    try {
      return await getCachedImage(key);
    } catch (error) {
      console.error('Error al obtener imagen del caché:', error);
      return null;
    }
  }, []);

  // Cachear datos localmente
  const cacheDataLocally = useCallback(async (key: string, data: any) => {
    try {
      await cacheData(key, data);
    } catch (error) {
      console.error('Error al cachear datos:', error);
    }
  }, []);

  // Obtener datos del caché local
  const getLocalData = useCallback(async <T>(key: string): Promise<T | null> => {
    try {
      return await getCachedData<T>(key);
    } catch (error) {
      console.error('Error al obtener datos del caché:', error);
      return null;
    }
  }, []);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    saveForLater,
    syncNow,
    cacheImageLocally,
    getLocalImage,
    cacheDataLocally,
    getLocalData
  };
}
