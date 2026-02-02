import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { OfflineSyncProvider } from "./contexts/OfflineSyncContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 segundos - datos frescos rápido
      gcTime: 5 * 60 * 1000, // 5 minutos en memoria
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 0, // Sin reintentos para máxima velocidad
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1, // 1 reintento para mutaciones
      networkMode: 'offlineFirst',
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
        <App />
      </OfflineSyncProvider>
    </QueryClientProvider>
  </trpc.Provider>
);

// Ocultar splash después de un breve delay para asegurar que la UI esté lista
setTimeout(hideSplashScreen, 500);

// Forzar actualización del Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.update();
      // Forzar activación inmediata del nuevo SW
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  });
  
  // Escuchar cuando hay un nuevo SW disponible
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[App] Service Worker actualizado, recargando...');
    // No recargar automáticamente para evitar loops
  });
}
