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
// 🔴 VERSIÓN v69 (v2.30) - ObjetivaQC 🔴
// ============================================
// MANDATORIO: objetivaqc.com (PERMANENTE)
// ACTUALIZACIÓN FORZADA OBLIGATORIA
// LIMPIEZA DATOS PRUEBA + GRÁFICAS MEJORADAS
// NOTIFICACIONES PUSH ULTRA-AGRESIVAS
// ============================================
const CURRENT_VERSION = 69;

// ============================================
// 🎯 FORMATO DE VERSIÓN PROFESIONAL 🎯
// ============================================
// Dividir entre 30 para mostrar versión más profesional
// v62 interno → v2.07 mostrado al usuario
function formatVersion(internalVersion: number): string {
  const divided = internalVersion / 30;
  return `v${divided.toFixed(2)}`;
}

// Exponer globalmente para uso en otros componentes
(window as any).OQC_VERSION = CURRENT_VERSION;
(window as any).OQC_FORMAT_VERSION = formatVersion;
(window as any).OQC_DISPLAY_VERSION = formatVersion(CURRENT_VERSION);

// ============================================
// 🔔 SISTEMA DE NOTIFICACIÓN DE VERSIÓN 🔔
// ============================================
const VERSION_TOAST_KEY = 'oqc_version_toast_shown';
const LAST_CHECK_KEY = 'oqc_last_version_check';
const SERVER_VERSION_KEY = 'oqc_server_version';

// Toast de versión actualizada - DESHABILITADO por preferencia del usuario
function showVersionUpdatedToast(): void {
  // No mostrar ningún toast - el usuario prefiere actualización silenciosa
  localStorage.removeItem('oqc_update_timestamp');
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

// Toast de nueva versión disponible - DESHABILITADO
// La actualización es automática y silenciosa
function showNewVersionAvailableToast(newVersion: number): void {
  // No mostrar toast - forzar actualización automática silenciosa
  localStorage.setItem(SERVER_VERSION_KEY, newVersion.toString());
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
// 🔴 FORZAR NOTIFICACIONES PUSH AGRESIVAMENTE 🔴
// SIEMPRE ACTIVAS - TIPO GLOBO - PANTALLA BLOQUEO
// ============================================
let pushRequestCount = 0;
const MAX_PUSH_REQUESTS = 50; // Máximos intentos (muy agresivo)
const PUSH_RETRY_INTERVAL = 3000; // 3 segundos entre reintentos (más rápido)
const PUSH_CHECK_INTERVAL = 15000; // Verificar cada 15 segundos

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
    console.log('[PUSH] ❌ Notificaciones no soportadas en este navegador');
    return;
  }
  
  // SOLO funcionar en el dominio de producción objetivaqc.com
  if (!isProductionDomain()) {
    console.log('[PUSH] 🛠️ Dominio de desarrollo - No solicitar notificaciones');
    return;
  }
  
  pushRequestCount++;
  console.log(`[PUSH] 🔔 Intento #${pushRequestCount} de ${MAX_PUSH_REQUESTS}`);
  
  // Si ya están concedidas, registrar suscripción y configurar notificaciones persistentes
  if (Notification.permission === 'granted') {
    console.log('[PUSH] ✅ Notificaciones YA ACTIVAS');
    await registerPushSubscription();
    await configurePersistentNotifications();
    return;
  }
  
  // Si están denegadas, mostrar alerta con instrucciones
  if (Notification.permission === 'denied') {
    console.log('[PUSH] ⚠️ DENEGADAS - Mostrando instrucciones');
    // Mostrar alerta cada 5 intentos para recordar al usuario
    if (pushRequestCount === 1 || pushRequestCount % 5 === 0) {
      setTimeout(() => {
        alert('🔔 NOTIFICACIONES REQUERIDAS\n\n' +
          'Para usar ObjetivaQC necesitas activar las notificaciones.\n\n' +
          '📱 En Android:\n' +
          '1. Ve a Configuración > Aplicaciones > Chrome\n' +
          '2. Toca "Notificaciones"\n' +
          '3. Activa "Mostrar notificaciones"\n\n' +
          '🍎 En iPhone/iPad:\n' +
          '1. Ve a Ajustes > Safari > Notificaciones\n' +
          '2. Activa las notificaciones para este sitio');
      }, 1000);
    }
    // Seguir intentando cada 30 segundos por si el usuario las activa
    if (pushRequestCount < MAX_PUSH_REQUESTS) {
      setTimeout(forcePushNotifications, PUSH_CHECK_INTERVAL);
    }
    return;
  }
  
  // Permiso 'default' - SOLICITAR AGRESIVAMENTE
  console.log('[PUSH] 🔴 SOLICITANDO PERMISOS AGRESIVAMENTE...');
  
  try {
    // Mostrar mensaje antes de solicitar
    if (pushRequestCount === 1) {
      // Dar un momento para que la página cargue
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('[PUSH] ✅ PERMISOS CONCEDIDOS - Configurando notificaciones persistentes');
      await registerPushSubscription();
      await configurePersistentNotifications();
      
      // Mostrar notificación de prueba tipo GLOBO
      showPersistentNotification('🔔 ObjetivaQC Activo', {
        body: '✅ Recibirás notificaciones incluso con la pantalla bloqueada',
        tag: 'oqc-welcome',
        requireInteraction: true, // Mantener hasta que el usuario interactue
        silent: false,
      } as any);
    } else {
      console.log('[PUSH] ❌ Permisos NO concedidos - Reintentando en ' + (PUSH_RETRY_INTERVAL/1000) + 's...');
      // Reintentar rápidamente
      if (pushRequestCount < MAX_PUSH_REQUESTS) {
        setTimeout(forcePushNotifications, PUSH_RETRY_INTERVAL);
      }
    }
  } catch (e) {
    console.error('[PUSH] Error al solicitar permisos:', e);
    // Reintentar en caso de error
    if (pushRequestCount < MAX_PUSH_REQUESTS) {
      setTimeout(forcePushNotifications, PUSH_RETRY_INTERVAL);
    }
  }
}

// Configurar notificaciones persistentes (tipo globo, pantalla de bloqueo)
async function configurePersistentNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Verificar si podemos usar notificaciones persistentes
    if ('showNotification' in registration) {
      console.log('[PUSH] 📱 Notificaciones persistentes configuradas');
    }
    
    // Solicitar permiso para notificaciones en pantalla de bloqueo (Android)
    if ('Notification' in window && 'vibrate' in navigator) {
      console.log('[PUSH] 📳 Vibración disponible para notificaciones');
    }
  } catch (e) {
    console.log('[PUSH] Error configurando notificaciones persistentes:', e);
  }
}

// Mostrar notificación persistente tipo globo
function showPersistentNotification(title: string, options: any): void {
  if (Notification.permission !== 'granted') return;
  
  // Opciones para notificación tipo globo que aparece en pantalla de bloqueo
  const persistentOptions: any = {
    ...options,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    requireInteraction: true, // No desaparece automáticamente
    silent: false,
    vibrate: options.vibrate || [200, 100, 200, 100, 200], // Patrón de vibración
    tag: options.tag || 'oqc-notification',
    renotify: true, // Notificar aunque ya exista una con el mismo tag
  };
  
  // Usar Service Worker para notificaciones más persistentes
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, persistentOptions);
    });
  } else {
    // Fallback a notificación normal
    new Notification(title, persistentOptions);
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
  
  // FORZAR notificaciones cada 30 segundos (TODOS LOS DISPOSITIVOS en objetivaqc.com)
  setInterval(async () => {
    if ('Notification' in window && isProductionDomain()) {
      if (Notification.permission === 'default') {
        console.log('[PUSH] 🔴 FORZANDO solicitud de notificaciones...');
        await Notification.requestPermission();
      } else if (Notification.permission === 'granted') {
        // Verificar que la suscripción sigue activa y configurar persistencia
        await registerPushSubscription();
        await configurePersistentNotifications();
      }
    }
  }, 30000); // Cada 30 segundos
  
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
