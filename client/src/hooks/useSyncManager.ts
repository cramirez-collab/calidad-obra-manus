/**
 * Hook ligero para exponer estado de sincronización al UI.
 * NO ejecuta sincronización — eso lo hace SyncManager (único sistema).
 * Solo lee contadores de pendientes para mostrar badges.
 */

import { useEffect, useState, useCallback } from 'react';
import { countPendingActions, isOnline } from '@/lib/offlineStorage';
import { contarPendientes } from '@/lib/uploadQueue';

export function useSyncManager() {
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(isOnline());

  const updatePendingCount = useCallback(async () => {
    try {
      const offlineCount = await countPendingActions();
      const uploadCount = await contarPendientes();
      setPendingCount(offlineCount + uploadCount);
    } catch {
      setPendingCount(0);
    }
  }, []);

  // Escuchar cambios de conexión
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Actualizar contador cada 5s
  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  return {
    pendingCount,
    isSyncing: false, // SyncManager maneja esto internamente
    online,
    syncAll: () => {}, // No-op — SyncManager se encarga
    updatePendingCount,
  };
}
