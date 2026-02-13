import { useState, useEffect } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";

/**
 * Banner flotante que aparece cuando se pierde la conexión a internet.
 * Se oculta automáticamente 3s después de reconectar.
 */
export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Mostrar "Conexión restaurada" por 3s
        setTimeout(() => {
          setShowBanner(false);
          setWasOffline(false);
        }, 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Verificar estado inicial
    if (!navigator.onLine) {
      setIsOnline(false);
      setWasOffline(true);
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  if (!showBanner) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[99999] transition-all duration-300 ${
        isOnline
          ? "bg-emerald-600 text-white"
          : "bg-red-600 text-white"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium">
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>Conexión restaurada</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 animate-pulse" />
            <span>Sin conexión a internet</span>
            <button
              onClick={() => window.location.reload()}
              className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs flex items-center gap-1 hover:bg-white/30 active:scale-95 transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              Reintentar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
