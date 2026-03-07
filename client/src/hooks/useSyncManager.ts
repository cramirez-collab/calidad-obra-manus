/**
 * Hook ligero para exponer estado de sincronización al UI.
 * NO ejecuta sincronización — eso lo hace SyncManager (único sistema).
 * Solo lee contadores de pendientes para mostrar badges.
 * 
 * v2: Actualización más frecuente (1s) y detección de red con NetworkInfo API.
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

  // Escuchar cambios de conexión (browser events + NetworkInfo API)
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      // Actualizar pendientes inmediatamente al reconectar
      updatePendingCount();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // NetworkInfo API — detecta cambios de tipo de red instantáneamente
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const handleConnectionChange = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) updatePendingCount();
    };
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [updatePendingCount]);

  // Actualizar contador cada 1s (era 5s — ahora hipersensible)
  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 1000);
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
