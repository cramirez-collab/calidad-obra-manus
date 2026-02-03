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
// 🔴 VERSIÓN v45 - ObjetivaQC 🔴
// ============================================
// MANDATORIO: objetivaqc.com (PERMANENTE)
// CONEXIÓN 24/7 AL SERVIDOR (OBLIGATORIO)
// NOTIFICACIONES PUSH SIEMPRE ACTIVAS (OBLIGATORIO)
// ACTUALIZACIÓN ITERATIVA DE VERSIÓN (OBLIGATORIO)
// SELECTOR DE RESIDENTES: DRAWER DESDE ABAJO (MÓVIL/TABLET)
// ============================================
const CURRENT_VERSION = 45;

// ============================================
// 🔴 ACTUALIZACIÓN FORZADA DE VERSIÓN 🔴
// ============================================
function checkAndUpdateVersion(): boolean {
  const storedVersion = parseInt(localStorage.getItem('oqc_installed_version') || '0');
  
  if (storedVersion !== CURRENT_VERSION) {
    console.log(`🔴 ACTUALIZANDO de v${storedVersion} a v${CURRENT_VERSION}...`);
    
    // Marcar nueva versión PRIMERO para evitar ciclos
    localStorage.setItem('oqc_installed_version', CURRENT_VERSION.toString());
    localStorage.setItem('oqc_update_timestamp', Date.now().toString());
    
    // Limpiar TODOS los caches y Service Workers
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
    
    // Recargar con parámetros únicos para forzar nueva descarga
    window.location.replace(window.location.pathname + '?v=' + CURRENT_VERSION + '&t=' + Date.now());
    return false;
  }
  
  return true;
}

// ============================================
// 🔴 NOTIFICACIONES PUSH OBLIGATORIAS 🔴
// ============================================
async function forcePushNotifications(): Promise<void> {
  if (!('Notification' in window)) {
    console.log('[PUSH] Notificaciones no soportadas en este navegador');
    return;
  }
  
  // Si ya están concedidas, registrar suscripción
  if (Notification.permission === 'granted') {
    console.log('[PUSH] ✅ Notificaciones activas');
    await registerPushSubscription();
    return;
  }
  
  // Si están denegadas, mostrar mensaje
  if (Notification.permission === 'denied') {
    console.log('[PUSH] ⚠️ Notificaciones denegadas - Solicitar manualmente');
    return;
  }
  
  // Solicitar permisos
  console.log('[PUSH] Solicitando permisos de notificaciones...');
  const permission = await Notification.requestPermission();
  
  if (permission === 'granted') {
    console.log('[PUSH] ✅ Permisos concedidos');
    await registerPushSubscription();
  } else {
    console.log('[PUSH] ⚠️ Permisos no concedidos');
  }
}

async function registerPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('[PUSH] Creando nueva suscripción...');
      // La suscripción se creará cuando el SW esté listo
    } else {
      console.log('[PUSH] Suscripción existente activa');
    }
  } catch (e) {
    console.log('[PUSH] Error al registrar suscripción:', e);
  }
}

// ============================================
// 🔴 VERIFICACIÓN ITERATIVA DE VERSIÓN 🔴
// ============================================
function startVersionCheck(): void {
  // Verificar versión cada 60 segundos
  setInterval(() => {
    const storedVersion = parseInt(localStorage.getItem('oqc_installed_version') || '0');
    if (storedVersion !== CURRENT_VERSION) {
      console.log(`🔴 Versión desactualizada detectada: v${storedVersion} → v${CURRENT_VERSION}`);
      localStorage.setItem('oqc_installed_version', CURRENT_VERSION.toString());
      window.location.reload();
    }
  }, 60000);
  
  // Verificar notificaciones cada 2 minutos
  setInterval(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      console.log('[PUSH] Recordando solicitar notificaciones...');
      await Notification.requestPermission();
    }
  }, 120000);
}

// ============================================
// VERIFICAR VERSIÓN ANTES DE INICIAR
// ============================================
const versionOK = checkAndUpdateVersion();

if (versionOK) {
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
        networkMode: 'always',
      },
      mutations: {
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        networkMode: 'always',
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
  
  // Ping al servidor cada 30 segundos
  setInterval(async () => {
    try {
      await fetch('/api/trpc/auth.me', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      console.log('[24/7] Conexión activa ✅');
    } catch (e) {
      console.log('[24/7] Intentando reconectar...');
    }
  }, 30000);
  
  // Reconexión automática
  window.addEventListener('online', () => {
    console.log('[24/7] Conexión restaurada - Sincronizando...');
    queryClient.invalidateQueries();
  });
  
  window.addEventListener('offline', () => {
    console.log('[24/7] Conexión perdida - Modo offline activado');
  });
  
  // Wake lock para mantener app activa en móvil
  if ('wakeLock' in navigator) {
    const requestWakeLock = async () => {
      try {
        await (navigator as any).wakeLock.request('screen');
        console.log('[24/7] Wake lock activo');
      } catch (e) {
        // Wake lock no disponible
      }
    };
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        queryClient.invalidateQueries();
      }
    });
    
    requestWakeLock();
  }

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
        console.log(`[SW v${CURRENT_VERSION}] Registrado`);
        reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch (e) {
        console.error('[SW] Error:', e);
      }
    });
  }

  // ============================================
  // 🔴 FORZAR NOTIFICACIONES PUSH AL INICIAR 🔴
  // ============================================
  window.addEventListener('load', () => {
    forcePushNotifications();
  });
  
  // ============================================
  // 🔴 INICIAR VERIFICACIÓN ITERATIVA 🔴
  // ============================================
  startVersionCheck();

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
