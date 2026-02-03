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
// SISTEMA DE ACTUALIZACIÓN FORZADA AGRESIVA v35
// ============================================
// OBLIGA a todos los usuarios a tener la misma versión.
// Si detecta versión anterior, ELIMINA TODO y actualiza.
// ============================================
const CURRENT_VERSION = 35;
const VERSION_KEY = 'oqc_app_version';
const FORCE_UPDATE_KEY = 'oqc_force_update';

// Función AGRESIVA para eliminar TODO y forzar actualización
async function forceAggressiveUpdate() {
  console.log('🔴 [ACTUALIZACIÓN FORZADA] Limpieza total iniciada...');
  
  const isUpdating = sessionStorage.getItem(FORCE_UPDATE_KEY);
  if (isUpdating === 'updating') {
    console.log('✅ [ACTUALIZACIÓN] Completada');
    sessionStorage.removeItem(FORCE_UPDATE_KEY);
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION.toString());
    return false;
  }
  
  sessionStorage.setItem(FORCE_UPDATE_KEY, 'updating');
  
  // 1. ELIMINAR TODOS LOS SERVICE WORKERS
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.error('[SW] Error:', e);
    }
  }
  
  // 2. ELIMINAR TODOS LOS CACHES
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    } catch (e) {
      console.error('[CACHE] Error:', e);
    }
  }
  
  // 3. LIMPIAR LOCALSTORAGE (preservar datos offline críticos)
  const keysToPreserve = ['oqc_offline_items', 'oqc_pending_sync'];
  const preservedData: Record<string, string> = {};
  keysToPreserve.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) preservedData[key] = value;
  });
  localStorage.clear();
  Object.entries(preservedData).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
  
  // 4. GUARDAR NUEVA VERSIÓN
  localStorage.setItem(VERSION_KEY, CURRENT_VERSION.toString());
  
  // 5. FORZAR RECARGA COMPLETA
  window.location.replace(window.location.pathname + '?v=' + CURRENT_VERSION + '&t=' + Date.now());
  return true;
}

// VERIFICACIÓN DE VERSIÓN AL INICIO
const storedVersion = parseInt(localStorage.getItem(VERSION_KEY) || '0');
const isUpdating = sessionStorage.getItem(FORCE_UPDATE_KEY);

console.log(`📱 [OQC v${CURRENT_VERSION}] Instalada: v${storedVersion || 'ninguna'}`);

if (storedVersion !== CURRENT_VERSION && isUpdating !== 'updating') {
  console.log(`⚠️ [OBSOLETA] v${storedVersion} → v${CURRENT_VERSION}`);
  forceAggressiveUpdate();
} else if (isUpdating === 'updating') {
  sessionStorage.removeItem(FORCE_UPDATE_KEY);
  localStorage.setItem(VERSION_KEY, CURRENT_VERSION.toString());
}

// REGISTRO DE SERVICE WORKER
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none'
      });
      registration.update();
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (error) {
      console.error('[PWA] Error:', error);
    }
  });
}

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
  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;
  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
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

// LISTENERS
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[SW] Controlador actualizado');
  });
}

// Verificar versión cada 30 segundos
setInterval(() => {
  const currentStored = parseInt(localStorage.getItem(VERSION_KEY) || '0');
  if (currentStored !== CURRENT_VERSION) {
    forceAggressiveUpdate();
  }
}, 30000);
