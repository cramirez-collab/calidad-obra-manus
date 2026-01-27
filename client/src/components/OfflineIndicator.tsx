import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CloudOff, Cloud } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useOffline } from '@/hooks/useOffline';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { isConnected } = useSocket();
  const { isOnline, pendingCount, isSyncing } = useOffline();
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Mostrar banner cuando hay cambios de estado
  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
      setWasOffline(true);
    } else if (wasOffline && isOnline) {
      // Mostrar brevemente que se reconectó
      setShowBanner(true);
      const timer = setTimeout(() => {
        setShowBanner(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // No mostrar nada si todo está bien
  if (isOnline && isConnected && pendingCount === 0 && !showBanner) {
    return null;
  }

  return (
    <>
      {/* Banner de estado */}
      {showBanner && (
        <div
          className={cn(
            "fixed top-14 left-0 right-0 z-40 px-4 py-2 text-center text-sm font-medium transition-all duration-300",
            !isOnline 
              ? "bg-red-500 text-white" 
              : "bg-green-500 text-white"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            {!isOnline ? (
              <>
                <WifiOff className="h-4 w-4" />
                <span>Sin conexión a internet - Los cambios se guardarán localmente</span>
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4" />
                <span>Conexión restaurada</span>
                {pendingCount > 0 && (
                  <span className="ml-2">
                    - Sincronizando {pendingCount} cambios...
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Indicador compacto en header */}
      <div className="flex items-center gap-1">
        {/* Estado de conexión a internet */}
        {!isOnline && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 text-red-600">
            <CloudOff className="h-4 w-4" />
            <span className="text-xs font-medium hidden sm:inline">Offline</span>
          </div>
        )}

        {/* Estado de Socket.io */}
        {isOnline && !isConnected && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-100 text-yellow-600">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-xs font-medium hidden sm:inline">Reconectando...</span>
          </div>
        )}

        {/* Acciones pendientes */}
        {pendingCount > 0 && (
          <div 
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md",
              isSyncing 
                ? "bg-blue-100 text-blue-600" 
                : "bg-orange-100 text-orange-600"
            )}
          >
            {isSyncing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Cloud className="h-4 w-4" />
            )}
            <span className="text-xs font-medium">
              {isSyncing ? 'Sincronizando...' : `${pendingCount} pendientes`}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

export default OfflineIndicator;
