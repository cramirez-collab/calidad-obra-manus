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
// 🔴 ACTUALIZACIÓN NUCLEAR v39 🔴
// ============================================
// MANDATORIO Y OBLIGATORIO:
// - Dominio: objetivaqc.com (PERMANENTE)
// - Notificaciones push: SIEMPRE ACTIVADAS
// - Modo offline: SIEMPRE ACTIVADO
// - TODOS los dispositivos DEBEN tener v39
// - NO HAY OPCIÓN de quedarse en versión antigua
// ============================================
const CURRENT_VERSION = 39;

// ============================================
// FUNCIÓN PARA INICIALIZAR LA APP
// ============================================
function initializeApp() {
  // REACT QUERY CONFIG
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: true,
        retry: 0,
        networkMode: 'online',
      },
      mutations: {
        retry: 1,
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

  // RENDERIZAR APP
  const hideSplashScreen = () => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.style.display = 'none', 300);
    }
  };

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

// ============================================
// FORZAR ACTUALIZACIÓN - SIN ESCAPE
// ============================================
async function checkAndForceUpdate(): Promise<boolean> {
  const storedVersion = parseInt(localStorage.getItem('oqc_installed_version') || '0');
  
  console.log(`🔍 [OQC] Versión actual: ${storedVersion}, Requerida: ${CURRENT_VERSION}`);
  
  // Si la versión NO es exactamente la actual, FORZAR actualización
  if (storedVersion !== CURRENT_VERSION) {
    console.log('🔴🔴🔴 ACTUALIZACIÓN OBLIGATORIA 🔴🔴🔴');
    console.log(`Actualizando de v${storedVersion} a v${CURRENT_VERSION}...`);
    
    // PASO 1: Marcar la nueva versión PRIMERO (evita ciclos)
    localStorage.setItem('oqc_installed_version', CURRENT_VERSION.toString());
    
    // PASO 2: Eliminar TODOS los Service Workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log(`[SW] Eliminando ${registrations.length} service workers...`);
        for (const reg of registrations) {
          await reg.unregister();
        }
      } catch (e) {
        console.error('[SW] Error al eliminar:', e);
      }
    }
    
    // PASO 3: Eliminar TODOS los caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        console.log(`[CACHE] Eliminando ${cacheNames.length} caches...`);
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (e) {
        console.error('[CACHE] Error al eliminar:', e);
      }
    }
    
    // PASO 4: Limpiar TODOS los flags antiguos
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('oqc_version') || key.includes('oqc_updated') || key.includes('oqc_force'))) {
        if (key !== 'oqc_installed_version') {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // PASO 5: RECARGAR - Forzar nueva carga desde servidor
    console.log('🔄 Recargando aplicación...');
    window.location.replace(window.location.pathname + '?v=' + CURRENT_VERSION + '&t=' + Date.now());
    return false; // No inicializar app, se va a recargar
  }
  
  console.log(`✅ [OQC v${CURRENT_VERSION}] Versión correcta instalada`);
  return true; // Versión correcta, inicializar app
}

// ============================================
// REGISTRAR SERVICE WORKER
// ============================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { 
          updateViaCache: 'none' 
        });
        console.log('[SW v39] Registrado correctamente');
        
        // Forzar actualización del SW
        reg.update();
        
        // Si hay uno esperando, activarlo inmediatamente
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        
        // Escuchar actualizaciones
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      } catch (error) {
        console.error('[SW] Error de registro:', error);
      }
    });
    
    // Recargar cuando el SW tome control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] Nuevo controlador activo');
    });
  }
}

// ============================================
// FORZAR NOTIFICACIONES PUSH (MANDATORIO)
// ============================================
function requestPushNotifications() {
  window.addEventListener('load', async () => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'default') {
      console.log('[PUSH] Solicitando permiso de notificaciones...');
      await Notification.requestPermission();
    }
    
    console.log('[PUSH] Estado:', Notification.permission);
  });
}

// ============================================
// INICIAR APLICACIÓN
// ============================================
(async function main() {
  // Primero verificar y forzar actualización si es necesario
  const shouldInitialize = await checkAndForceUpdate();
  
  // Solo inicializar si la versión es correcta (no se va a recargar)
  if (shouldInitialize) {
    registerServiceWorker();
    requestPushNotifications();
    initializeApp();
  }
})();
