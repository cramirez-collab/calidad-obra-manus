import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { VERSION_NUMBER, FULL_VERSION } from '@shared/version';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { OfflineSyncProvider } from "./contexts/OfflineSyncContext";
import { SyncManager } from "./components/SyncManager";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";
import "./index.css";

// ============================================
// VERSIÓN - ObjetivaQC
// ============================================
// ÚNICA FUENTE DE VERDAD: shared/version.ts
// ============================================
const CURRENT_VERSION = VERSION_NUMBER;

// Exponer globalmente
(window as any).OQC_VERSION = CURRENT_VERSION;
(window as any).OQC_FORMAT_VERSION = () => FULL_VERSION;
(window as any).OQC_DISPLAY_VERSION = FULL_VERSION;

// ============================================
// VERIFICACIÓN DE VERSIÓN
// ============================================
// Sincronizar oqc_installed_version con la versión actual.
// El index.html ya maneja la limpieza nuclear si hay discrepancia
// con REQUIRED_VERSION. Aquí solo aseguramos consistencia.
function checkAndUpdateVersion(): boolean {
  const storedVersion = parseInt(localStorage.getItem('oqc_installed_version') || '0');
  
  if (storedVersion !== CURRENT_VERSION) {
    console.log(`[VERSION] Actualizando: ${storedVersion} → ${CURRENT_VERSION}`);
    
    // Guardar nueva versión inmediatamente para evitar loops
    localStorage.setItem('oqc_installed_version', CURRENT_VERSION.toString());
    localStorage.setItem('oqc_app_version', CURRENT_VERSION.toString());
    
    // Limpiar caches obsoletas en background (no bloquea)
    if ('caches' in window) {
      caches.keys().then(names => {
        const currentCacheName = `oqc-v${CURRENT_VERSION}`;
        names.filter(n => n !== currentCacheName).forEach(n => caches.delete(n));
      });
    }
    
    // NUNCA hacer reload aquí - index.html ya maneja la limpieza nuclear
    // Continuar normalmente, la app ya tiene el código correcto
    return true;
  }
  
  return true;
}

// Verificar periódicamente contra el servidor (cada 5 min, no cada 60s)
function startVersionChecker(): void {
  setInterval(async () => {
    if (document.visibilityState !== 'visible') return; // No verificar si tab oculta
    try {
      const response = await fetch('/api/version?t=' + Date.now(), {
        cache: 'no-store',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.version && data.version > CURRENT_VERSION) {
          console.log(`[VERSION] Nueva versión disponible: v${data.version}`);
          // Solo actualizar localStorage, el reload lo hace el usuario o al navegar
          localStorage.setItem('oqc_installed_version', '0');
          localStorage.setItem('oqc_app_version', '0');
          // Reload suave - solo si la diferencia es significativa
          if (data.version - CURRENT_VERSION >= 2) {
            window.location.reload();
          }
        }
      }
    } catch (e) {
      // Silenciar errores de red
    }
  }, 5 * 60 * 1000); // Cada 5 minutos
}

// ============================================
// NOTIFICACIONES PUSH
// ============================================
let notificationBlockerShown = false;

function isProductionDomain(): boolean {
  return window.location.hostname === 'objetivaqc.com' || 
         window.location.hostname === 'www.objetivaqc.com';
}

function showNotificationBlocker(): void {
  if (notificationBlockerShown) return;
  notificationBlockerShown = true;
  
  const blocker = document.createElement('div');
  blocker.id = 'notification-blocker';
  blocker.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  `;
  
  blocker.innerHTML = `
    <div style="text-align: center; max-width: 400px;">
      <div style="font-size: 80px; margin-bottom: 20px;">🔔</div>
      <h1 style="color: white; font-size: 24px; margin-bottom: 15px;">
        Activar Notificaciones
      </h1>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
        Para recibir alertas de ítems y actualizaciones en tiempo real, 
        es necesario activar las notificaciones.
      </p>
      <button id="enable-notifications-btn" style="
        background: #02B381;
        color: white;
        border: none;
        padding: 15px 40px;
        font-size: 18px;
        font-weight: bold;
        border-radius: 10px;
        cursor: pointer;
        margin-bottom: 20px;
        width: 100%;
        max-width: 300px;
      ">
        ACTIVAR NOTIFICACIONES
      </button>
      <div style="color: #888; font-size: 13px; margin-top: 20px;">
        <p style="margin-bottom: 10px;"><strong>Android:</strong> Configuración > Apps > Chrome > Notificaciones</p>
        <p style="margin-bottom: 10px;"><strong>iPhone/iPad:</strong> Ajustes > Safari > Notificaciones</p>
        <p><strong>PC:</strong> Haz clic en el candado junto a la URL</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(blocker);
  
  const btn = document.getElementById('enable-notifications-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.textContent = 'Solicitando permisos...';
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        blocker.remove();
        notificationBlockerShown = false;
        await registerPushSubscription();
        await updateAppBadge();
        showWelcomeNotification();
      } else {
        btn.textContent = 'Permisos denegados - Inténtalo de nuevo';
        btn.style.background = '#ff6b6b';
        setTimeout(() => {
          btn.textContent = 'ACTIVAR NOTIFICACIONES';
          btn.style.background = '#02B381';
        }, 3000);
      }
    });
  }
}

function removeNotificationBlocker(): void {
  const blocker = document.getElementById('notification-blocker');
  if (blocker) {
    blocker.remove();
    notificationBlockerShown = false;
  }
}

async function updateAppBadge(count?: number): Promise<void> {
  try {
    if (count === undefined) {
      count = parseInt(localStorage.getItem('oqc_pending_count') || '0');
    }
    
    localStorage.setItem('oqc_pending_count', count.toString());
    
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        await (navigator as any).setAppBadge(count);
      } else {
        await (navigator as any).clearAppBadge();
      }
    }
    
    const baseTitle = 'ObjetivaQC';
    document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
    
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_BADGE',
        data: { count }
      });
    }
  } catch (e) {
    // Silenciar
  }
}

(window as any).updateAppBadge = updateAppBadge;

function showWelcomeNotification(): void {
  if (Notification.permission !== 'granted') return;
  
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('ObjetivaQC Activado', {
        body: 'Recibirás notificaciones de ítems pendientes, aprobaciones y rechazos.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'oqc-welcome',
        requireInteraction: false,
      } as any);
    });
  }
}

async function forcePushNotifications(): Promise<void> {
  if (!('Notification' in window)) return;
  if (!isProductionDomain()) return;
  
  if (Notification.permission === 'granted') {
    removeNotificationBlocker();
    await registerPushSubscription();
    await updateAppBadge();
    return;
  }
  
  if (Notification.permission === 'denied') {
    showNotificationBlocker();
    return;
  }
  
  // Permiso 'default' - solicitar
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      removeNotificationBlocker();
      await registerPushSubscription();
      await updateAppBadge();
      showWelcomeNotification();
    } else if (permission === 'denied') {
      showNotificationBlocker();
    }
  } catch (e) {
    console.log('[PUSH] Error:', e);
  }
}

async function registerPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      try {
        const response = await fetch('/api/trpc/push.getVapidKey');
        const data = await response.json();
        const vapidKey = data?.result?.data?.vapidKey;
        
        if (vapidKey) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
          });
          
          const p256dhKey = subscription.getKey('p256dh');
          const authKey = subscription.getKey('auth');
          if (p256dhKey && authKey) {
            const p256dhArray = new Uint8Array(p256dhKey as ArrayBuffer);
            const authArray = new Uint8Array(authKey as ArrayBuffer);
            let p256dhStr = '';
            let authStr = '';
            for (let i = 0; i < p256dhArray.length; i++) {
              p256dhStr += String.fromCharCode(p256dhArray[i]);
            }
            for (let i = 0; i < authArray.length; i++) {
              authStr += String.fromCharCode(authArray[i]);
            }
            await fetch('/api/trpc/push.subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                endpoint: subscription.endpoint,
                p256dh: btoa(p256dhStr),
                auth: btoa(authStr)
              }),
              credentials: 'include'
            });
          }
        }
      } catch (e) {
        console.log('[PUSH] Error VAPID:', e);
      }
    }
  } catch (e) {
    console.log('[PUSH] Error registro:', e);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function startPeriodicChecks(): void {
  // Verificar notificaciones al inicio
  setTimeout(() => forcePushNotifications(), 2000);
  
  // Verificar periódicamente (solo en producción, cada 5 min)
  setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    if ('Notification' in window && isProductionDomain()) {
      if (Notification.permission === 'granted') {
        removeNotificationBlocker();
        await registerPushSubscription();
      } else if (Notification.permission === 'denied') {
        showNotificationBlocker();
      }
    }
  }, 5 * 60 * 1000);
  
  // Al volver a la app
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      if (isProductionDomain()) {
        await forcePushNotifications();
      }
    }
  });
}

// ============================================
// INICIALIZACIÓN
// ============================================
const versionOK = checkAndUpdateVersion();

if (versionOK) {
  console.log(`[OQC ${FULL_VERSION}] Iniciando...`);
  
  // Helper: detectar si un error es de red (DNS, timeout, conexión)
  const isNetworkError = (error: unknown): boolean => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('failed to fetch') ||
        msg.includes('network') ||
        msg.includes('socket') ||
        msg.includes('dns') ||
        msg.includes('host lookup') ||
        msg.includes('err_internet') ||
        msg.includes('err_name_not_resolved') ||
        msg.includes('err_connection') ||
        msg.includes('load failed') ||
        msg.includes('timeout') ||
        msg.includes('aborted')
      );
    }
    return false;
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 60 * 1000,    // 10min: datos frescos — navegación INSTANTÁNEA entre secciones
        gcTime: 30 * 60 * 1000,       // 30min: cache en memoria mucho más tiempo
        refetchOnWindowFocus: false,   // NO refetch al volver a la pestaña
        refetchOnReconnect: true,      // Sí refetch al reconectar
        refetchOnMount: false,         // NO refetch si datos en cache y no stale
        retry: (failureCount, error) => {
          // Errores de red: reintentar hasta 3 veces con backoff
          if (isNetworkError(error)) return failureCount < 3;
          // Errores de auth: no reintentar
          if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) return false;
          // Otros: 1 reintento
          return failureCount < 1;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // 1s, 2s, 4s... max 10s
        networkMode: 'online',
      },
      mutations: {
        retry: (failureCount, error) => {
          if (isNetworkError(error)) return failureCount < 2;
          return false;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
        networkMode: 'online',
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

  // Throttle para no mostrar múltiples toasts de red seguidos
  let lastNetworkToast = 0;
  const showNetworkToast = () => {
    const now = Date.now();
    if (now - lastNetworkToast < 10000) return; // Max 1 toast cada 10s
    lastNetworkToast = now;
    // Usar un div nativo en vez de sonner para no depender de que esté montado
    const existing = document.getElementById('oqc-network-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'oqc-network-toast';
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: white; padding: 12px 20px; border-radius: 12px;
      font-size: 14px; font-weight: 500; z-index: 999999; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      display: flex; align-items: center; gap: 8px; max-width: 90vw;
      animation: slideUp 0.3s ease-out;
    `;
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l22 22"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
      <span>Sin conexión. Reintentando...</span>
    `;
    // Agregar animación CSS
    if (!document.getElementById('oqc-toast-style')) {
      const style = document.createElement('style');
      style.id = 'oqc-toast-style';
      style.textContent = '@keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }';
      document.head.appendChild(style);
    }
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 6000);
  };

  queryClient.getQueryCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      const error = event.query.state.error;
      if (isNetworkError(error)) {
        showNetworkToast();
        return; // No redirigir a login por errores de red
      }
      redirectToLoginIfUnauthorized(error);
    }
  });

  queryClient.getMutationCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      const error = event.mutation.state.error;
      if (isNetworkError(error)) {
        showNetworkToast();
        return;
      }
      redirectToLoginIfUnauthorized(error);
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

  // Keepalive: verificar conexión cada 5 min (no cada 30s - ahorra 90% de requests)
  setInterval(async () => {
    if (document.visibilityState !== 'visible') return; // No hacer keepalive si tab oculta
    try {
      await fetch('/api/version?t=' + Date.now(), {
        method: 'GET',
        cache: 'no-store',
      });
    } catch (e) {
      // Silenciar
    }
  }, 5 * 60 * 1000); // 5 minutos
  
  window.addEventListener('online', () => {
    // Limpiar toast de error de red
    const netToast = document.getElementById('oqc-network-toast');
    if (netToast) netToast.remove();
    // Solo invalidar queries críticas al reconectar, no todas
    queryClient.invalidateQueries({ queryKey: ['auth'] });
    queryClient.invalidateQueries({ queryKey: ['items'] });
    queryClient.invalidateQueries({ queryKey: ['badges'] });
    queryClient.invalidateQueries({ queryKey: ['pendientes'] });
  });
  
  // Wake lock
  if ('wakeLock' in navigator) {
    const requestWakeLock = async () => {
      try {
        await (navigator as any).wakeLock.request('screen');
      } catch (e) {}
    };
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        // Solo invalidar datos críticos al volver, no todo
        queryClient.invalidateQueries({ queryKey: ['badges'] });
        queryClient.invalidateQueries({ queryKey: ['pendientes'] });
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
        console.log(`[SW ${FULL_VERSION}] Registrado`);
        reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch (e) {
        console.error('[SW] Error:', e);
      }
    });
  }

  // Iniciar verificaciones periódicas
  startPeriodicChecks();
  startVersionChecker();

  // RENDERIZAR APP
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <OfflineSyncProvider>
          <NetworkStatusBanner />
          <SyncManager />
          <App />
        </OfflineSyncProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );

  setTimeout(hideSplashScreen, 500);
}
