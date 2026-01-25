import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CloudOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing, syncPendingItems } = useOfflineSync();
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
      setWasOffline(true);
    } else if (wasOffline) {
      // Mostrar mensaje de reconexión brevemente
      setTimeout(() => {
        setShowBanner(false);
        setWasOffline(false);
      }, 3000);
    }
  }, [isOnline, wasOffline]);

  if (!showBanner && pendingCount === 0) return null;

  return (
    <>
      {/* Banner de estado offline */}
      {showBanner && (
        <div 
          className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium transition-all ${
            isOnline 
              ? 'bg-emerald-500 text-white' 
              : 'bg-amber-500 text-white'
          }`}
        >
          {isOnline ? (
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>Conexión restaurada</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <WifiOff className="h-4 w-4" />
              <span>Sin conexión - Modo offline activo</span>
            </div>
          )}
        </div>
      )}

      {/* Indicador de ítems pendientes */}
      {pendingCount > 0 && isOnline && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-white rounded-lg shadow-lg border p-4 max-w-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-full">
                <CloudOff className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {pendingCount} {pendingCount === 1 ? 'elemento' : 'elementos'} pendiente{pendingCount !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Datos guardados mientras estabas offline
                </p>
                <Button 
                  size="sm" 
                  className="mt-2 w-full"
                  onClick={syncPendingItems}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sincronizar ahora
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default OfflineIndicator;
