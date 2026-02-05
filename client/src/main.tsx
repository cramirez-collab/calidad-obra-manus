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
// 🔴 VERSIÓN v3.52 - ObjetivaQC 🔴
// ============================================
// MANDATORIO: objetivaqc.com (PERMANENTE)
// SIEMPRE LA ÚLTIMA VERSIÓN - OBLIGATORIO
// Scroll en usuarios + @mentions en selector de residentes
// ============================================
const CURRENT_VERSION = 211;

// ============================================
// 🎯 FORMATO DE VERSIÓN UNIFICADO 🎯
// ============================================
// Factor de división: 60 (ej: 208/60 = 3.47)
function formatVersion(internalVersion: number): string {
  return 'v' + (internalVersion / 60).toFixed(2);
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

function showVersionUpdatedToast(): void {
  localStorage.removeItem('oqc_update_timestamp');
}

async function checkForNewVersion(): Promise<void> {
  try {
    const response = await fetch('/?check_version=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    const html = await response.text();
    const match = html.match(/REQUIRED_VERSION\s*=\s*(\d+)/);
    if (match) {
      const serverVersion = parseInt(match[1]);
      console.log(`[VERSION CHECK] Local: v${CURRENT_VERSION}, Servidor: v${serverVersion}`);
      if (serverVersion > CURRENT_VERSION) {
        localStorage.setItem(SERVER_VERSION_KEY, serverVersion.toString());
      }
    }
  } catch (e) {
    console.log('[VERSION CHECK] Error al verificar:', e);
  }
}

function showNewVersionAvailableToast(newVersion: number): void {
  localStorage.setItem(SERVER_VERSION_KEY, newVersion.toString());
}

// ============================================
// 🔴 ACTUALIZACIÓN FORZADA AGRESIVA DE VERSIÓN 🔴
// ============================================
// MANDATORIO: Todos los usuarios SIEMPRE en la última versión
// Sin excepciones, sin posibilidad de versiones antiguas
// ============================================
function checkAndUpdateVersion(): boolean {
  const storedVersion = parseInt(localStorage.getItem('oqc_installed_version') || '0');
  
  // Si la versión almacenada es diferente a la actual, FORZAR actualización
  if (storedVersion !== CURRENT_VERSION) {
    console.log(`🔴🔴🔴 ACTUALIZACIÓN FORZADA: v${storedVersion} → v${CURRENT_VERSION}`);
    console.log(`🔴 Limpiando cachés y Service Workers...`);
    
    // Guardar nueva versión ANTES de limpiar
    localStorage.setItem('oqc_installed_version', CURRENT_VERSION.toString());
    localStorage.setItem('oqc_update_timestamp', Date.now().toString());
    localStorage.setItem('oqc_force_update', 'true');
    
    // Desregistrar TODOS los Service Workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        console.log(`🔴 Desregistrando ${regs.length} Service Workers...`);
        regs.forEach(reg => {
          reg.unregister();
          console.log(`🔴 SW desregistrado:`, reg.scope);
        });
      });
    }
    
    // Eliminar TODAS las cachés
    if ('caches' in window) {
      caches.keys().then(names => {
        console.log(`🔴 Eliminando ${names.length} cachés...`);
        names.forEach(name => {
          caches.delete(name);
          console.log(`🔴 Caché eliminada:`, name);
        });
      });
    }
    
    // Forzar recarga completa con parámetros anti-caché
    const newUrl = window.location.pathname + '?v=' + CURRENT_VERSION + '&t=' + Date.now() + '&force=1';
    console.log(`🔴 Redirigiendo a:`, newUrl);
    window.location.replace(newUrl);
    return false;
  }
  
  // Limpiar flag de actualización forzada
  localStorage.removeItem('oqc_force_update');
  return true;
}

// ============================================
// 🔴 VERIFICACIÓN PERIÓDICA DE VERSIÓN 🔴
// ============================================
// Verificar cada 30 segundos si hay nueva versión
function startVersionChecker(): void {
  setInterval(async () => {
    try {
      // Hacer fetch al servidor para obtener la versión actual
      const response = await fetch('/api/version?t=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.version && data.version > CURRENT_VERSION) {
          console.log(`🔴 Nueva versión detectada: v${data.version}`);
          // Forzar actualización
          localStorage.setItem('oqc_installed_version', '0');
          window.location.reload();
        }
      }
    } catch (e) {
      // Silenciar errores de red
    }
  }, 30000); // Cada 30 segundos
}

// ============================================
// 🔴🔴🔴 NOTIFICACIONES PUSH OBLIGATORIAS 🔴🔴🔴
// ============================================
// MANDATORIO - FORZOSO - NO OPCIONAL
// TODOS LOS DISPOSITIVOS: PC, TABLET, MÓVIL
// BADGES EN ICONO DE LA APP
// GLOBOS EN PANTALLA DE BLOQUEO
// ============================================
let pushRequestCount = 0;
const MAX_PUSH_REQUESTS = 100; // Máximos intentos (MUY agresivo)
const PUSH_RETRY_INTERVAL = 2000; // 2 segundos entre reintentos
const PUSH_CHECK_INTERVAL = 10000; // Verificar cada 10 segundos
let notificationBlockerShown = false;

// Verificar si estamos en el dominio de producción
function isProductionDomain(): boolean {
  return window.location.hostname === 'objetivaqc.com' || 
         window.location.hostname === 'www.objetivaqc.com';
}

// ============================================
// 🔴 BLOQUEAR APP SIN NOTIFICACIONES 🔴
// ============================================
function showNotificationBlocker(): void {
  if (notificationBlockerShown) return;
  notificationBlockerShown = true;
  
  // Crear overlay de bloqueo
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
        NOTIFICACIONES REQUERIDAS
      </h1>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
        Para usar ObjetivaQC es <strong style="color: #ff6b6b;">OBLIGATORIO</strong> 
        activar las notificaciones push.
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
        ✅ ACTIVAR NOTIFICACIONES
      </button>
      <div style="color: #888; font-size: 13px; margin-top: 20px;">
        <p style="margin-bottom: 10px;"><strong>📱 Android:</strong> Configuración > Apps > Chrome > Notificaciones</p>
        <p style="margin-bottom: 10px;"><strong>🍎 iPhone/iPad:</strong> Ajustes > Safari > Notificaciones</p>
        <p><strong>💻 PC:</strong> Haz clic en el candado 🔒 junto a la URL</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(blocker);
  
  // Botón para activar notificaciones
  const btn = document.getElementById('enable-notifications-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.textContent = '⏳ Solicitando permisos...';
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        blocker.remove();
        notificationBlockerShown = false;
        await registerPushSubscription();
        await updateAppBadge();
        showWelcomeNotification();
      } else {
        btn.textContent = '❌ Permisos denegados - Inténtalo de nuevo';
        btn.style.background = '#ff6b6b';
        setTimeout(() => {
          btn.textContent = '✅ ACTIVAR NOTIFICACIONES';
          btn.style.background = '#02B381';
        }, 3000);
      }
    });
  }
}

// Remover bloqueador si las notificaciones están activas
function removeNotificationBlocker(): void {
  const blocker = document.getElementById('notification-blocker');
  if (blocker) {
    blocker.remove();
    notificationBlockerShown = false;
  }
}

// ============================================
// 🔴 BADGES EN ICONO DE LA APP 🔴
// ============================================
async function updateAppBadge(count?: number): Promise<void> {
  try {
    // Obtener contador de pendientes si no se proporciona
    if (count === undefined) {
      // Intentar obtener del localStorage o usar 0
      count = parseInt(localStorage.getItem('oqc_pending_count') || '0');
    }
    
    // Guardar en localStorage para persistencia
    localStorage.setItem('oqc_pending_count', count.toString());
    
    // API de Badge para PWA (Chrome, Edge, Safari)
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        await (navigator as any).setAppBadge(count);
        console.log(`[BADGE] ✅ Badge actualizado: ${count}`);
      } else {
        await (navigator as any).clearAppBadge();
        console.log('[BADGE] ✅ Badge limpiado');
      }
    }
    
    // También actualizar el título de la página con el contador
    const baseTitle = 'ObjetivaQC';
    if (count > 0) {
      document.title = `(${count}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
    
    // Notificar al Service Worker para actualizar badge
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_BADGE',
        data: { count }
      });
    }
  } catch (e) {
    console.log('[BADGE] Error actualizando badge:', e);
  }
}

// Exponer función globalmente para uso en otros componentes
(window as any).updateAppBadge = updateAppBadge;

// ============================================
// 🔴 NOTIFICACIÓN DE BIENVENIDA 🔴
// ============================================
function showWelcomeNotification(): void {
  if (Notification.permission !== 'granted') return;
  
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('🔔 ObjetivaQC Activado', {
        body: '✅ Recibirás notificaciones de ítems pendientes, aprobaciones y rechazos.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'oqc-welcome',
        requireInteraction: true,
        renotify: true,
      } as any);
    });
  } else {
    new Notification('🔔 ObjetivaQC Activado', {
      body: '✅ Recibirás notificaciones de ítems pendientes, aprobaciones y rechazos.',
      icon: '/icon-192.png',
      requireInteraction: true,
    } as any);
  }
}

// ============================================
// 🔴 FORZAR NOTIFICACIONES PUSH 🔴
// ============================================
async function forcePushNotifications(): Promise<void> {
  if (!('Notification' in window)) {
    console.log('[PUSH] ❌ Notificaciones no soportadas');
    return;
  }
  
  // SOLO funcionar en el dominio de producción
  if (!isProductionDomain()) {
    console.log('[PUSH] 🛠️ Dominio de desarrollo - No bloquear');
    return;
  }
  
  pushRequestCount++;
  console.log(`[PUSH] 🔔 Intento #${pushRequestCount} de ${MAX_PUSH_REQUESTS}`);
  
  // Si ya están concedidas
  if (Notification.permission === 'granted') {
    console.log('[PUSH] ✅ Notificaciones ACTIVAS');
    removeNotificationBlocker();
    await registerPushSubscription();
    await updateAppBadge();
    return;
  }
  
  // Si están denegadas - BLOQUEAR APP
  if (Notification.permission === 'denied') {
    console.log('[PUSH] ⚠️ DENEGADAS - BLOQUEANDO APP');
    showNotificationBlocker();
    // Seguir verificando por si el usuario las activa manualmente
    if (pushRequestCount < MAX_PUSH_REQUESTS) {
      setTimeout(forcePushNotifications, PUSH_CHECK_INTERVAL);
    }
    return;
  }
  
  // Permiso 'default' - SOLICITAR
  console.log('[PUSH] 🔴 SOLICITANDO PERMISOS...');
  
  try {
    // Mostrar bloqueador mientras se solicitan permisos
    if (pushRequestCount >= 3) {
      showNotificationBlocker();
    }
    
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('[PUSH] ✅ PERMISOS CONCEDIDOS');
      removeNotificationBlocker();
      await registerPushSubscription();
      await updateAppBadge();
      showWelcomeNotification();
    } else {
      console.log('[PUSH] ❌ Permisos NO concedidos');
      if (pushRequestCount < MAX_PUSH_REQUESTS) {
        setTimeout(forcePushNotifications, PUSH_RETRY_INTERVAL);
      }
    }
  } catch (e) {
    console.error('[PUSH] Error:', e);
    if (pushRequestCount < MAX_PUSH_REQUESTS) {
      setTimeout(forcePushNotifications, PUSH_RETRY_INTERVAL);
    }
  }
}

// ============================================
// 🔴 REGISTRAR SUSCRIPCIÓN PUSH 🔴
// ============================================
async function registerPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Verificar si ya hay suscripción
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('[PUSH] Creando nueva suscripción...');
      
      // Obtener VAPID key del servidor
      try {
        const response = await fetch('/api/trpc/push.getVapidKey');
        const data = await response.json();
        const vapidKey = data?.result?.data?.vapidKey;
        
        if (vapidKey) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
          });
          
          // Enviar suscripción al servidor
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
          
          console.log('[PUSH] ✅ Suscripción registrada');
        }
      } catch (e) {
        console.log('[PUSH] Error obteniendo VAPID key:', e);
      }
    } else {
      console.log('[PUSH] ✅ Suscripción existente activa');
    }
  } catch (e) {
    console.log('[PUSH] Error registrando suscripción:', e);
  }
}

// Helper para convertir VAPID key
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

// ============================================
// VERIFICACIÓN PERIÓDICA
// ============================================
function startVersionCheck(): void {
  showVersionUpdatedToast();
  
  // Verificar versión cada 30 segundos
  setInterval(() => {
    const storedVersion = parseInt(localStorage.getItem('oqc_installed_version') || '0');
    if (storedVersion !== CURRENT_VERSION) {
      console.log(`🔴 Versión desactualizada: v${storedVersion} → v${CURRENT_VERSION}`);
      localStorage.setItem('oqc_installed_version', CURRENT_VERSION.toString());
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(n => caches.delete(n)));
      }
      window.location.reload();
    }
  }, 30000);
  
  // Verificar nueva versión en servidor cada 5 minutos
  checkForNewVersion();
  setInterval(checkForNewVersion, 5 * 60 * 1000);
  
  // Verificar cuando la app vuelve a estar visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const lastCheck = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0');
      if (Date.now() - lastCheck > 60000) {
        checkForNewVersion();
        localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
      }
    }
  });
  
  // 🔴 FORZAR notificaciones cada 10 segundos (OBLIGATORIO)
  setInterval(async () => {
    if ('Notification' in window && isProductionDomain()) {
      if (Notification.permission === 'default') {
        console.log('[PUSH] 🔴 FORZANDO solicitud...');
        await forcePushNotifications();
      } else if (Notification.permission === 'granted') {
        removeNotificationBlocker();
        await registerPushSubscription();
      } else if (Notification.permission === 'denied') {
        showNotificationBlocker();
      }
    }
  }, 10000);
  
  // Verificar al volver a la app
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isProductionDomain()) {
      console.log('[PUSH] App visible - Verificando...');
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
  // CONEXIÓN 24/7 AL SERVIDOR
  // ============================================
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
  
  window.addEventListener('online', () => {
    console.log('[24/7] Conexión restaurada');
    queryClient.invalidateQueries();
  });
  
  window.addEventListener('offline', () => {
    console.log('[24/7] Modo offline activado');
  });
  
  // Wake lock para mantener app activa
  if ('wakeLock' in navigator) {
    const requestWakeLock = async () => {
      try {
        await (navigator as any).wakeLock.request('screen');
        console.log('[24/7] Wake lock activo');
      } catch (e) {}
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
  // 🔴 FORZAR NOTIFICACIONES AL INICIAR 🔴
  // ============================================
  window.addEventListener('load', () => {
    // Esperar 1 segundo para que la página cargue
    setTimeout(() => {
      forcePushNotifications();
    }, 1000);
  });
  
  // ============================================
  // 🔴 INICIAR VERIFICACIÓN DE VERSIÓN 🔴
  // ============================================
  startVersionCheck();
  startVersionChecker(); // Verificar nueva versión cada 30 segundos

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
