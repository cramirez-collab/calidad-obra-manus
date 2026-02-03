import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { OfflineSyncProvider } from "./contexts/OfflineSyncContext";
import { SyncManager } from "./components/SyncManager";
import "./index.css";

// ============================================
// 🔴 VERSIÓN v39 - ObjetivaQC 🔴
// ============================================
// MANDATORIO: objetivaqc.com (PERMANENTE)
// CONEXIÓN 24/7 AL SERVIDOR (OBLIGATORIO)
// ============================================
const CURRENT_VERSION = 39;

// Verificar versión al cargar (síncrono, antes de React)
const storedVersion = parseInt(localStorage.getItem('oqc_installed_version') || '0');

if (storedVersion !== CURRENT_VERSION) {
  console.log(`🔴 Actualizando de v${storedVersion} a v${CURRENT_VERSION}...`);
  
  // Marcar nueva versión PRIMERO
  localStorage.setItem('oqc_installed_version', CURRENT_VERSION.toString());
  
  // Limpiar caches y SW en background (no bloquea)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
  }
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  
  // Recargar con parámetros únicos
  window.location.replace(window.location.pathname + '?v=' + CURRENT_VERSION + '&t=' + Date.now());
} else {
  // Versión correcta - inicializar React
  console.log(`✅ [OQC v${CURRENT_VERSION}] Iniciando...`);
  
  // REACT QUERY CONFIG
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        networkMode: 'always', // SIEMPRE intentar conectar
      },
      mutations: {
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        networkMode: 'always', // SIEMPRE intentar conectar
      },
    },
  });

  const redirectToLoginIfUnauthorized = (error: unknown) => {
    if (!(error instanceof TRPCClientError)) return;
    if (typeof window === "undefined") return;
    if (error.message === UNAUTHED_ERR_MSG) {
      window.location.href = getLoginUrl();
    }
  };

  queryClient.getQueryCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      redirectToLoginIfUnauthorized(event.query.state.error);
    }
  });

  queryClient.getMutationCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      redirectToLoginIfUnauthorized(event.mutation.state.error);
    }
  });

  const trpcClient = trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
            cache: 'no-store',
          });
        },
      }),
    ],
  });

  // ============================================
  // CONEXIÓN 24/7 AL SERVIDOR (MANDATORIO)
  // ============================================
  let isOnline = navigator.onLine;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 999999; // Infinito prácticamente
  
  // Ping al servidor cada 30 segundos para mantener conexión viva
  const keepAlive = () => {
    setInterval(async () => {
      try {
        const response = await fetch('/api/trpc/auth.me', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });
        if (response.ok) {
          isOnline = true;
          reconnectAttempts = 0;
          console.log('[24/7] Conexión activa ✅');
        }
      } catch (e) {
        console.log('[24/7] Intentando reconectar...');
        reconnectAttempts++;
      }
    }, 30000); // Cada 30 segundos
  };
  
  // Reconexión automática cuando se pierde conexión
  window.addEventListener('online', () => {
    console.log('[24/7] Conexión restaurada - Sincronizando...');
    isOnline = true;
    queryClient.invalidateQueries(); // Refrescar todos los datos
  });
  
  window.addEventListener('offline', () => {
    console.log('[24/7] Conexión perdida - Modo offline activado');
    isOnline = false;
  });
  
  // Mantener la app activa incluso en background (móvil)
  if ('wakeLock' in navigator) {
    let wakeLock: WakeLockSentinel | null = null;
    
    const requestWakeLock = async () => {
      try {
        wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('[24/7] Wake lock activo');
      } catch (e) {
        console.log('[24/7] Wake lock no disponible');
      }
    };
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        // Refrescar datos al volver a la app
        queryClient.invalidateQueries();
      }
    });
    
    requestWakeLock();
  }
  
  // Iniciar keep-alive
  keepAlive();

  // Ocultar splash screen
  const hideSplashScreen = () => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.style.display = 'none', 300);
    }
  };

  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { 
          updateViaCache: 'none' 
        });
        console.log('[SW v39] Registrado');
        reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch (e) {
        console.error('[SW] Error:', e);
      }
    });
  }

  // Solicitar notificaciones push (MANDATORIO)
  if ('Notification' in window && Notification.permission === 'default') {
    window.addEventListener('load', () => {
      Notification.requestPermission();
    });
  }

  // RENDERIZAR APP
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <OfflineSyncProvider>
          <SyncManager />
          <App />
        </OfflineSyncProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );

  setTimeout(hideSplashScreen, 500);
}
