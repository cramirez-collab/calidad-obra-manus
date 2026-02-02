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
// SISTEMA DE VERSIONADO AUTOMÁTICO v13
// ============================================
const CURRENT_VERSION = 13;
const VERSION_KEY = 'oqc_app_version';

// Función para forzar actualización completa
async function forceFullUpdate() {
  console.log('[App] Forzando actualización completa...');
  
  // 1. Limpiar TODOS los caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[App] Todos los caches eliminados:', cacheNames);
  }
  
  // 2. Desregistrar TODOS los Service Workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log('[App] SW desregistrado');
    }
  }
  
  // 3. Limpiar localStorage excepto datos críticos
  const projectId = localStorage.getItem('selectedProjectId');
  localStorage.clear();
  if (projectId) localStorage.setItem('selectedProjectId', projectId);
  
  // 4. Guardar nueva versión
  localStorage.setItem(VERSION_KEY, CURRENT_VERSION.toString());
  
  // 5. Recargar página con parámetro anti-caché
  const url = new URL(window.location.href);
  url.searchParams.set('v', CURRENT_VERSION.toString());
  url.searchParams.set('t', Date.now().toString());
  window.location.href = url.toString();
}

// Verificar versión al inicio
(async () => {
  const storedVersion = parseInt(localStorage.getItem(VERSION_KEY) || '0');
  
  console.log(`[App] Versión actual: ${CURRENT_VERSION}, Versión almacenada: ${storedVersion}`);
  
  // Si la versión es diferente, forzar actualización
  if (storedVersion !== CURRENT_VERSION) {
    console.log('[App] Nueva versión detectada - Forzando actualización...');
    await forceFullUpdate();
    return; // No continuar, la página se recargará
  }
  
  // Registrar nuevo Service Worker
  if ('serviceWorker' in navigator) {
    try {
      // Agregar timestamp para evitar caché del SW
      const swUrl = `/sw.js?v=${CURRENT_VERSION}&t=${Date.now()}`;
      const registration = await navigator.serviceWorker.register(swUrl, {
        updateViaCache: 'none' // NUNCA usar caché para el SW
      });
      console.log('[PWA] Service Worker registered:', registration.scope);
      
      // Forzar actualización inmediata
      registration.update();
      
      // Si hay un SW esperando, activarlo
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (error) {
      console.error('[PWA] SW registration failed:', error);
    }
  }
})();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Datos siempre frescos
      gcTime: 60 * 1000, // 1 minuto en memoria
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: 0,
      networkMode: 'online', // Siempre usar red
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
          cache: 'no-store', // NUNCA usar caché para API
        });
      },
    }),
  ],
});

// Ocultar splash screen cuando la app esté lista
const hideSplashScreen = () => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.style.display = 'none';
    }, 300);
  }
};

// Renderizar la app y ocultar splash
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

// Ocultar splash después de un breve delay
setTimeout(hideSplashScreen, 500);

// Escuchar cuando hay un nuevo SW disponible y recargar
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[App] Service Worker actualizado - Recargando...');
    window.location.reload();
  });
  
  // Escuchar mensajes del SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      console.log('[App] SW actualizado a v' + event.data.version);
      if (event.data.forceReload) {
        localStorage.setItem(VERSION_KEY, event.data.version.toString());
        window.location.reload();
      }
    }
    if (event.data?.type === 'CACHE_CLEARED') {
      console.log('[App] Caché limpiada por SW');
    }
  });
}

// Verificar versión periódicamente (cada 2 minutos)
setInterval(() => {
  const storedVersion = parseInt(localStorage.getItem(VERSION_KEY) || '0');
  if (storedVersion !== CURRENT_VERSION) {
    console.log('[App] Versión desactualizada detectada - Actualizando...');
    forceFullUpdate();
  }
}, 2 * 60 * 1000);
