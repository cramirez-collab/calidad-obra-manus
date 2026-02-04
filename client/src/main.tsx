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
// 🔴 VERSIÓN v61 - ObjetivaQC 🔴
// ============================================
// MANDATORIO: objetivaqc.com (PERMANENTE)
// CONEXIÓN 24/7 AL SERVIDOR (OBLIGATORIO)
// NOTIFICACIONES PUSH SOLO EN PRODUCCIÓN
// ACTUALIZACIÓN ITERATIVA DE VERSIÓN (OBLIGATORIO)
// CONSECUTIVO #N INCREMENTAL DEBAJO DE OBJETIVA (OBLIGATORIO)
// RESOLUCIÓN FOTOS: 275px (BALANCE CALIDAD/VELOCIDAD)
// TAMAÑO LÁPIZ: 2 (FINO PARA PRECISIÓN)
// ESTADÍSTICAS FILTRADAS POR PROYECTO (OBLIGATORIO)
// TOAST DE VERSIÓN ACTUALIZADA + AUTO-DETECCIÓN
// ============================================
const CURRENT_VERSION = 61;

// ============================================
// 🔔 SISTEMA DE NOTIFICACIÓN DE VERSIÓN 🔔
// ============================================
const VERSION_TOAST_KEY = 'oqc_version_toast_shown';
const LAST_CHECK_KEY = 'oqc_last_version_check';
const SERVER_VERSION_KEY = 'oqc_server_version';

// Mostrar toast de versión actualizada
function showVersionUpdatedToast(): void {
  const lastToastVersion = localStorage.getItem(VERSION_TOAST_KEY);
  const updateTimestamp = localStorage.getItem('oqc_update_timestamp');
  
  // Solo mostrar si hubo una actualización reciente (en los últimos 30 segundos)
  if (updateTimestamp) {
    const timeSinceUpdate = Date.now() - parseInt(updateTimestamp);
    if (timeSinceUpdate < 30000 && lastToastVersion !== CURRENT_VERSION.toString()) {
      // Esperar a que React cargue para mostrar el toast
      setTimeout(() => {
        // Crear toast nativo si sonner no está disponible aún
        const toastContainer = document.createElement('div');
        toastContainer.id = 'version-toast';
        toastContainer.innerHTML = `
          <div style="
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(16, 185, 129, 0.4);
            z-index: 99999;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideUp 0.5s ease-out;
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 90vw;
          ">
            <span style="font-size: 28px;">🚀</span>
            <div>
              <div style="font-weight: 700; font-size: 16px;">¡Actualizado a v${CURRENT_VERSION}!</div>
              <div style="font-size: 13px; opacity: 0.9;">Disfrutas de las últimas mejoras</div>
            </div>
          </div>
          <style>
            @keyframes slideUp {
              from { transform: translateX(-50%) translateY(100px); opacity: 0; }
              to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
          </style>
        `;
        document.body.appendChild(toastContainer);
        
        // Remover después de 5 segundos
        setTimeout(() => {
          toastContainer.style.opacity = '0';
          toastContainer.style.transition = 'opacity 0.3s';
          setTimeout(() => toastContainer.remove(), 300);
        }, 5000);
        
        localStorage.setItem(VERSION_TOAST_KEY, CURRENT_VERSION.toString());
        localStorage.removeItem('oqc_update_timestamp');
      }, 1500);
    }
  }
}

// Auto-detección de nueva versión disponible
async function checkForNewVersion(): Promise<void> {
  try {
    // Hacer fetch al index.html para obtener la versión del servidor
    const response = await fetch('/?check_version=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    const html = await response.text();
    
    // Buscar REQUIRED_VERSION en el HTML
    const match = html.match(/REQUIRED_VERSION\s*=\s*(\d+)/);
    if (match) {
      const serverVersion = parseInt(match[1]);
      const lastKnownServerVersion = parseInt(localStorage.getItem(SERVER_VERSION_KEY) || '0');
      
      console.log(`[VERSION CHECK] Local: v${CURRENT_VERSION}, Servidor: v${serverVersion}`);
      
      if (serverVersion > CURRENT_VERSION) {
        // Hay nueva versión disponible - mostrar notificación
        showNewVersionAvailableToast(serverVersion);
        localStorage.setItem(SERVER_VERSION_KEY, serverVersion.toString());
      }
    }
  } catch (e) {
    console.log('[VERSION CHECK] Error al verificar:', e);
  }
}

// Mostrar toast de nueva versión disponible
function showNewVersionAvailableToast(newVersion: number): void {
  // Evitar mostrar múltiples veces
  const alreadyNotified = localStorage.getItem('oqc_new_version_notified');
  if (alreadyNotified === newVersion.toString()) return;
  
  const toastContainer = document.createElement('div');
  toastContainer.id = 'new-version-toast';
  toastContainer.innerHTML = `
    <div style="
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(59, 130, 246, 0.4);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      animation: slideDown 0.5s ease-out;
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 90vw;
      min-width: 280px;
    ">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 28px;">🆕</span>
        <div>
          <div style="font-weight: 700; font-size: 16px;">¡Nueva versión v${newVersion} disponible!</div>
          <div style="font-size: 13px; opacity: 0.9;">Tienes v${CURRENT_VERSION} instalada</div>
        </div>
      </div>
      <button id="update-now-btn" style="
        background: white;
        color: #1d4ed8;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: transform 0.2s;
      ">
        🚀 ACTUALIZAR AHORA
      </button>
    </div>
    <style>
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      #update-now-btn:hover { transform: scale(1.02); }
      #update-now-btn:active { transform: scale(0.98); }
    </style>
  `;
  document.body.appendChild(toastContainer);
  
  // Agregar evento al botón
  document.getElementById('update-now-btn')?.addEventListener('click', async () => {
    // Ejecutar actualización nuclear
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) await reg.unregister();
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      const proyectoGuardado = localStorage.getItem('selectedProjectId');
      const offlineData = localStorage.getItem('oqc_offline_queue');
      localStorage.clear();
      sessionStorage.clear();
      if (proyectoGuardado) localStorage.setItem('selectedProjectId', proyectoGuardado);
      if (offlineData) localStorage.setItem('oqc_offline_queue', offlineData);
      localStorage.setItem('oqc_app_version', '0');
      localStorage.setItem('oqc_installed_version', '0');
      window.location.href = `${window.location.origin}/?nuclear=${Date.now()}`;
    } catch (e) {
      window.location.href = `${window.location.origin}/?force=${Date.now()}`;
    }
  });
  
  localStorage.setItem('oqc_new_version_notified', newVersion.toString());
  
  // Auto-cerrar después de 30 segundos si no hace clic
  setTimeout(() => {
    if (document.getElementById('new-version-toast')) {
      toastContainer.style.opacity = '0';
      toastContainer.style.transition = 'opacity 0.3s';
      setTimeout(() => toastContainer.remove(), 300);
    }
  }, 30000);
}

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
// 🔴 NOTIFICACIONES PUSH - SOLO objetivaqc.com 🔴
// ============================================
// FORZAR AGRESIVAMENTE SOLO EN MÓVILES/TABLETS
// EN PC: solicitar una vez sin ser agresivo
// EN DESARROLLO: NO solicitar nada
let pushRequestCount = 0;
const MAX_PUSH_REQUESTS = 10;

// Detectar si es móvil o tablet (NO PC)
function isMobileOrTablet(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
  const isTablet = /tablet|ipad|playbook|silk/i.test(userAgent) || 
    (navigator.maxTouchPoints > 0 && /macintosh/i.test(userAgent)); // iPad con iOS 13+
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 1024; // Tablets y móviles
  
  // Es móvil/tablet si: tiene user agent de móvil O (tiene touch Y pantalla pequeña)
  return isMobile || isTablet || (hasTouch && isSmallScreen);
}

// Verificar si estamos en el dominio de producción
function isProductionDomain(): boolean {
  return window.location.hostname === 'objetivaqc.com' || 
         window.location.hostname === 'www.objetivaqc.com';
}

async function forcePushNotifications(): Promise<void> {
  if (!('Notification' in window)) {
    console.log('[PUSH] ❌ Notificaciones no soportadas');
    return;
  }
  
  // SOLO funcionar en el dominio de producción objetivaqc.com
  if (!isProductionDomain()) {
    console.log('[PUSH] 🛠️ Dominio de desarrollo - No solicitar notificaciones');
    return;
  }
  
  pushRequestCount++;
  
  // En PC: solicitar UNA vez sin ser agresivo, sin alertas
  if (!isMobileOrTablet()) {
    console.log('[PUSH] 💻 PC en objetivaqc.com - Solicitar una vez');
    if (Notification.permission === 'default' && pushRequestCount === 1) {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      await registerPushSubscription();
    }
    return;
  }
  
  // MÓVIL/TABLET en objetivaqc.com: FORZAR AGRESIVAMENTE
  console.log(`[PUSH] 📱 Móvil/Tablet objetivaqc.com - Intento #${pushRequestCount}`);
  
  // Si ya están concedidas, registrar suscripción
  if (Notification.permission === 'granted') {
    console.log('[PUSH] ✅ Notificaciones ACTIVAS');
    await registerPushSubscription();
    return;
  }
  
  // Si están denegadas en móvil/tablet, mostrar alerta (solo una vez)
  if (Notification.permission === 'denied') {
    console.log('[PUSH] ⚠️ DENEGADAS en móvil/tablet');
    if (pushRequestCount === 1) {
      setTimeout(() => {
        alert('⚠️ Las notificaciones están desactivadas.\n\nPara recibir alertas, actívalas en la configuración de tu dispositivo.');
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
// VERIFICACIÓN PERIÓDICA DE VERSIÓN
// ============================================
function startVersionCheck(): void {
  // Mostrar toast si acabamos de actualizar
  showVersionUpdatedToast();
  
  // Verificar versión local cada 30 segundos
  setInterval(() => {
    const storedVersion = parseInt(localStorage.getItem('oqc_installed_version') || '0');
    if (storedVersion !== CURRENT_VERSION) {
      console.log(`🔴 Versión desactualizada: v${storedVersion} → v${CURRENT_VERSION}`);
      localStorage.setItem('oqc_installed_version', CURRENT_VERSION.toString());
      localStorage.setItem('oqc_update_timestamp', Date.now().toString());
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(n => caches.delete(n)));
      }
      window.location.reload();
    }
  }, 30000);
  
  // Auto-detección de nueva versión en servidor cada 5 minutos
  checkForNewVersion(); // Verificar al inicio
  setInterval(() => {
    checkForNewVersion();
  }, 5 * 60 * 1000); // Cada 5 minutos
  
  // También verificar cuando la app vuelve a estar visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const lastCheck = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0');
      const timeSinceLastCheck = Date.now() - lastCheck;
      // Si pasó más de 1 minuto desde la última verificación
      if (timeSinceLastCheck > 60000) {
        checkForNewVersion();
        localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
      }
    }
  });
  
  // FORZAR notificaciones cada 60 segundos (SOLO MÓVIL/TABLET en objetivaqc.com)
  setInterval(async () => {
    if ('Notification' in window && isProductionDomain() && isMobileOrTablet()) {
      if (Notification.permission === 'default') {
        console.log('[PUSH] 📱 Móvil/Tablet objetivaqc.com - FORZANDO solicitud...');
        await Notification.requestPermission();
      } else if (Notification.permission === 'granted') {
        // Verificar que la suscripción sigue activa
        await registerPushSubscription();
      }
    }
  }, 60000);
  
  // Verificar notificaciones al volver a la app (SOLO objetivaqc.com)
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isProductionDomain()) {
      console.log('[PUSH] App visible en objetivaqc.com - Verificando notificaciones...');
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
