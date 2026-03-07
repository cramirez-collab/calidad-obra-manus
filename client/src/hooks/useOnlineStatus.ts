/**
 * Hook para detectar estado de conexión online/offline.
 * v2: HIPERSENSIBLE — usa navigator.onLine + eventos + NetworkInfo API + polling 1s.
 * NO hace ping a endpoints — eso causaba falsos "sin conexión".
 */
import { useState, useEffect, useCallback } from 'react';

interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnline: Date | null;
}

export function useOnlineStatus(): OnlineStatus {
  const [status, setStatus] = useState<OnlineStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    lastOnline: null,
  });

  const handleOnline = useCallback(() => {
    setStatus(prev => ({
      isOnline: true,
      wasOffline: !prev.isOnline ? true : prev.wasOffline,
      lastOnline: new Date(),
    }));
  }, []);

  const handleOffline = useCallback(() => {
    setStatus(prev => ({
      ...prev,
      isOnline: false,
    }));
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // NetworkInfo API — detecta cambios de tipo de red instantáneamente
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const handleConnectionChange = () => {
      if (navigator.onLine) {
        handleOnline();
      } else {
        handleOffline();
      }
    };
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Polling cada 1s para detectar cambios que los eventos no capturan
    const pollInterval = setInterval(() => {
      const currentOnline = navigator.onLine;
      setStatus(prev => {
        if (prev.isOnline !== currentOnline) {
          return {
            isOnline: currentOnline,
            wasOffline: !currentOnline ? prev.wasOffline : (!prev.isOnline ? true : prev.wasOffline),
            lastOnline: currentOnline ? new Date() : prev.lastOnline,
          };
        }
        return prev;
      });
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
      clearInterval(pollInterval);
    };
  }, [handleOnline, handleOffline]);

  return status;
}
