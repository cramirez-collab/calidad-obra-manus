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
// 🔴 VERSIÓN v46 - ObjetivaQC 🔴
// ============================================
// MANDATORIO: objetivaqc.com (PERMANENTE)
// CONEXIÓN 24/7 AL SERVIDOR (OBLIGATORIO)
// NOTIFICACIONES PUSH SUPER AGRESIVAS (FORZAR SIEMPRE)
// ACTUALIZACIÓN ITERATIVA DE VERSIÓN (OBLIGATORIO)
// SELECTOR DE RESIDENTES: DRAWER DESDE ABAJO (MÓVIL/TABLET)
// ============================================
const CURRENT_VERSION = 46;

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
// 🔴 NOTIFICACIONES PUSH SUPER AGRESIVAS 🔴
// ============================================
// FORZAR SIEMPRE - NO IMPORTA QUÉ
let pushRequestCount = 0;
const MAX_PUSH_REQUESTS = 10;

async function forcePushNotifications(): Promise<void> {
  if (!('Notification' in window)) {
    console.log('[PUSH] ❌ Notificaciones no soportadas');
    return;
  }
  
  pushRequestCount++;
  console.log(`[PUSH] 🔴 Intento #${pushRequestCount} de forzar notificaciones...`);
  
  // Si ya están concedidas, registrar suscripción
  if (Notification.permission === 'granted') {
    console.log('[PUSH] ✅ Notificaciones ACTIVAS');
    await registerPushSubscription();
    return;
  }
  
  // Si están denegadas, SEGUIR INTENTANDO (mostrar alerta)
  if (Notification.permission === 'denied') {
    console.log('[PUSH] ⚠️ DENEGADAS - Mostrando alerta al usuario');
    // Mostrar alerta cada 30 segundos si están denegadas
    if (pushRequestCount <= 3) {
      setTimeout(() => {
        alert('⚠️ IMPORTANTE: Las notificaciones están desactivadas.\n\nPara recibir alertas de ítems y actualizaciones, activa las notificaciones en la configuración de tu navegador.\n\nEn Chrome: Configuración > Privacidad > Notificaciones > Permitir objetivaqc.com');
      }, 2000);
    }
    return;
  }
  
  // Solicitar permisos AGRESIVAMENTE
  console.log('[PUSH] 🔴 SOLICITANDO PERMISOS...');
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('[PUSH] ✅ PERMISOS CONCEDIDOS');
      await registerPushSubscription();
      // Mostrar notificación de prueba
      new Notification('ObjetivaQC', {
        body: '✅ Notificaciones activadas correctamente',
        icon: '/icon-192.png'
      });
    } else {
      console.log('[PUSH] ❌ Permisos NO concedidos - Reintentando...');
      // Reintentar en 10 segundos si no se concedieron
      if (pushRequestCount < MAX_PUSH_REQUESTS) {
        setTimeout(forcePushNotifications, 10000);
      }
    }
  } catch (e) {
    console.error('[PUSH] Error:', e);
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
  // Verificar versión cada 30 segundos (más agresivo)
  setInterval(() => {
    const storedVersion = parseInt(localStorage.getItem('oqc_installed_version') || '0');
    if (storedVersion !== CURRENT_VERSION) {
      console.log(`🔴 Versión desactualizada: v${storedVersion} → v${CURRENT_VERSION}`);
      localStorage.setItem('oqc_installed_version', CURRENT_VERSION.toString());
      // Limpiar caches y recargar
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(n => caches.delete(n)));
      }
      window.location.reload();
    }
  }, 30000);
  
  // FORZAR notificaciones cada 60 segundos (AGRESIVO)
  setInterval(async () => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        console.log('[PUSH] 🔴 FORZANDO solicitud de notificaciones...');
        await Notification.requestPermission();
      } else if (Notification.permission === 'granted') {
        // Verificar que la suscripción sigue activa
        await registerPushSubscription();
      }
    }
  }, 60000);
  
  // Verificar notificaciones al volver a la app
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      console.log('[PUSH] 🔴 App visible - Verificando notificaciones...');
      await forcePushNotifications();
    }
  });
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
