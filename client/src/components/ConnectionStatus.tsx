/**
 * Indicador visual de estado de conexión.
 * Solo muestra banner cuando navigator.onLine es false (offline real).
 * No hace pings ni verificaciones que puedan dar falsos positivos.
 */
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ConnectionStatus() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Online y sin transición reciente → no mostrar nada
  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <>
      {/* Banner de reconexión — breve, 2.5s */}
      {showReconnected && isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white py-2 px-4 text-center text-sm font-medium animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-center gap-2">
            <Wifi className="h-4 w-4" />
            <span>Conexión restaurada</span>
          </div>
        </div>
      )}

      {/* Banner offline — solo cuando navigator.onLine === false */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white py-2 px-4 text-center text-sm font-medium">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="h-4 w-4" />
            <span>Sin conexión</span>
          </div>
        </div>
      )}
    </>
  );
}
