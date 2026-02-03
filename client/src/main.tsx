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
// SISTEMA DE VERSIONADO AUTOMÁTICO v29
// ============================================
const CURRENT_VERSION = 29;
const VERSION_KEY = 'oqc_app_version';
const UPDATE_IN_PROGRESS_KEY = 'oqc_update_in_progress';

// Función para forzar actualización completa (solo se ejecuta UNA vez)
async function forceFullUpdate() {
  // Verificar si ya estamos en proceso de actualización para evitar loops
  const updateInProgress = sessionStorage.getItem(UPDATE_IN_PROGRESS_KEY);
  if (updateInProgress === 'true') {
    console.log('[App] Actualización ya en progreso, saltando...');
    // Limpiar flag y continuar normalmente
    sessionStorage.removeItem(UPDATE_IN_PROGRESS_KEY);
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION.toString());
    return false; // No recargar
  }
  
  console.log('[App] Forzando actualización completa...');
  
  // Marcar que estamos actualizando (en sessionStorage para que persista durante la recarga)
  sessionStorage.setItem(UPDATE_IN_PROGRESS_KEY, 'true');
  
  // 1. Limpiar TODOS los caches del navegador
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[App] Todos los caches eliminados:', cacheNames);
    } catch (e) {
      console.log('[App] Error limpiando caches:', e);
    }
  }
  
  // 2. Desregistrar TODOS los Service Workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('[App] SW desregistrado');
      }
    } catch (e) {
      console.log('[App] Error desregistrando SW:', e);
    }
  }
  
  // 3. Guardar nueva versión ANTES de recargar
  localStorage.setItem(VERSION_KEY, CURRENT_VERSION.toString());
  
  // 4. Recargar página (sin parámetros extra para evitar problemas)
  window.location.reload();
  return true; // Indica que se recargará
}

// Verificar versión al inicio (ejecutar de forma síncrona para evitar race conditions)
const storedVersion = parseInt(localStorage.getItem(VERSION_KEY) || '0');
console.log(`[App] Versión actual: ${CURRENT_VERSION}, Versión almacenada: ${storedVersion}`);

// Solo forzar actualización si la versión es diferente Y no estamos ya actualizando
if (storedVersion !== CURRENT_VERSION) {
  const updateInProgress = sessionStorage.getItem(UPDATE_IN_PROGRESS_KEY);
  if (updateInProgress !== 'true') {
    console.log('[App] Nueva versión detectada - Forzando actualización...');
    forceFullUpdate();
  } else {
    // Ya estamos en proceso de actualización, solo actualizar la versión
    console.log('[App] Completando actualización...');
    sessionStorage.removeItem(UPDATE_IN_PROGRESS_KEY);
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION.toString());
  }
}

// Registrar Service Worker (sin bloquear la app)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none'
      });
      console.log('[PWA] Service Worker registered:', registration.scope);
      
      // Forzar actualización
      registration.update();
      
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (error) {
      console.error('[PWA] SW registration failed:', error);
    }
  });
}

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

// Ocultar splash screen
const hideSplashScreen = () => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.style.display = 'none';
    }, 300);
  }
};

// Renderizar la app
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

// Escuchar actualizaciones del SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[App] Service Worker actualizado');
    // NO recargar automáticamente para evitar loops
  });
  
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      console.log('[App] SW actualizado a v' + event.data.version);
    }
    if (event.data?.type === 'CACHE_CLEARED') {
      console.log('[App] Caché limpiada por SW');
    }
  });
}
