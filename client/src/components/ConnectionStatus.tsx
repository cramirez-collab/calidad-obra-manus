/**
 * Indicador visual de estado de conexión
 * Muestra banner cuando está offline y notificación al reconectar
 */
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPendingActions } from '@/lib/offlineDB';

export function ConnectionStatus() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const checkPending = async () => {
      try {
        const actions = await getPendingActions();
        setPendingCount(actions.length);
      } catch {
        setPendingCount(0);
      }
    };

    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // No mostrar nada si está online y no hay pendientes
  if (isOnline && !showReconnected && pendingCount === 0) {
    return null;
  }

  return (
    <>
      {/* Banner de reconexión */}
      {showReconnected && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white py-2 px-4 text-center text-sm font-medium animate-in slide-in-from-top">
          <div className="flex items-center justify-center gap-2">
            <Wifi className="h-4 w-4" />
            <span>Conexión restaurada</span>
            {pendingCount > 0 && (
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Sincronizando {pendingCount} cambios...
              </span>
            )}
          </div>
        </div>
      )}

      {/* Banner offline */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white py-2 px-4 text-center text-sm font-medium">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="h-4 w-4" />
            <span>Sin conexión - Modo offline activo</span>
            {pendingCount > 0 && (
              <span className="bg-amber-600 px-2 py-0.5 rounded-full text-xs">
                {pendingCount} pendientes
              </span>
            )}
          </div>
        </div>
      )}

      {/* Indicador flotante de pendientes - solo mostrar brevemente al reconectar */}
      {isOnline && showReconnected && pendingCount > 0 && (
        <div className="fixed bottom-20 right-4 z-40 bg-blue-500 text-white px-3 py-2 rounded-full shadow-lg text-sm flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Sincronizando {pendingCount}...</span>
        </div>
      )}
    </>
  );
}
