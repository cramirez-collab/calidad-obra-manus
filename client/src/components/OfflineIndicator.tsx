import { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw, Cloud } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing, syncPendingItems } = useOfflineSync();
  const [showStatus, setShowStatus] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowStatus(true);
      setWasOffline(true);
    } else if (wasOffline) {
      // Mostrar brevemente que se reconectó
      setTimeout(() => {
        setShowStatus(false);
        setWasOffline(false);
      }, 2000);
    }
  }, [isOnline, wasOffline]);

  // No mostrar nada si está online y no hay pendientes
  if (isOnline && !showStatus && pendingCount === 0) return null;

  return (
    <>
      {/* Indicador sutil de estado de conexión - esquina inferior izquierda */}
      {showStatus && (
        <div 
          className={`fixed bottom-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
            isOnline 
              ? 'bg-emerald-100 text-emerald-700' 
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="h-3 w-3" />
              <span>Conectado</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span>Offline</span>
            </>
          )}
        </div>
      )}

      {/* Indicador discreto de sincronización pendiente */}
      {pendingCount > 0 && isOnline && (
        <button
          onClick={syncPendingItems}
          disabled={isSyncing}
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
        >
          {isSyncing ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Sincronizando...</span>
            </>
          ) : (
            <>
              <Cloud className="h-3 w-3" />
              <span>{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>
            </>
          )}
        </button>
      )}
    </>
  );
}

export default OfflineIndicator;
