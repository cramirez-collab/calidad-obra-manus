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
// SISTEMA DE ACTUALIZACIÓN FORZADA v36
// ============================================
// Dominio mandatorio: objetivaqc.com
// Actualización sin ciclos infinitos
// ============================================
const CURRENT_VERSION = 36;
const VERSION_KEY = 'oqc_app_version';
const UPDATED_KEY = 'oqc_updated_to';

// Verificar si ya se actualizó a esta versión (evita ciclos)
const alreadyUpdated = localStorage.getItem(UPDATED_KEY) === CURRENT_VERSION.toString();
const storedVersion = parseInt(localStorage.getItem(VERSION_KEY) || '0');

console.log(`📱 [OQC v${CURRENT_VERSION}] Versión almacenada: ${storedVersion}, Ya actualizado: ${alreadyUpdated}`);

// Solo actualizar si la versión es diferente Y no hemos actualizado ya
if (storedVersion !== CURRENT_VERSION && !alreadyUpdated) {
  console.log(`⚠️ [ACTUALIZACIÓN] v${storedVersion} → v${CURRENT_VERSION}`);
  
  // Marcar que vamos a actualizar a esta versión (ANTES de hacer nada)
  localStorage.setItem(UPDATED_KEY, CURRENT_VERSION.toString());
  
  // Función asíncrona para limpiar y recargar
  (async () => {
    // 1. Eliminar Service Workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      } catch (e) {
        console.error('[SW] Error:', e);
      }
    }
    
    // 2. Eliminar caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (e) {
        console.error('[CACHE] Error:', e);
      }
    }
    
    // 3. Actualizar versión
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION.toString());
    
    // 4. Recargar UNA sola vez
    window.location.reload();
  })();
} else {
  // Asegurar que la versión esté guardada correctamente
  localStorage.setItem(VERSION_KEY, CURRENT_VERSION.toString());
  // Limpiar flag de actualización si ya pasó
  if (alreadyUpdated) {
    localStorage.removeItem(UPDATED_KEY);
  }
}

// REGISTRO DE SERVICE WORKER (solo si no estamos actualizando)
if ('serviceWorker' in navigator && storedVersion === CURRENT_VERSION) {
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

// LISTENERS (sin verificación periódica para evitar ciclos)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[SW] Controlador actualizado');
  });
}
