/**
 * SyncManager — ÚNICO sistema de sincronización offline.
 * Cubre: uploadQueue (fotos), offlineStorage (ítems), offlineDB (legacy).
 * 
 * POLÍTICA: NUNCA eliminar ítems de la cola por fallos de sincronización.
 * Los ítems solo se eliminan cuando se sincronizan exitosamente o son duplicados.
 * Si un ítem falla repetidamente, se pausa y se notifica al usuario.
 * 
 * v2: HIPERSENSIBLE — detecta red y sube inmediatamente.
 * - Polling de conexión cada 1s (no depende solo de eventos del browser)
 * - Sync inmediata al detectar red (0ms delay)
 * - Intervalo reducido a 3s cuando hay pendientes
 * - NetworkInformation API para detectar cambios de red instantáneamente
 * - Fetch heartbeat para confirmar conectividad real
 */
import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  obtenerPendientes,
  eliminarDeCola,
  marcarFallo,
  limpiarAntiguos,
  contarPendientes,
  obtenerTodas,
} from '@/lib/uploadQueue';
import {
  getPendingActions,
  removePendingAction,
  countPendingActions,
} from '@/lib/offlineStorage';
import {
  getPendingActions as getOfflineDBActions,
  removePendingAction as removeOfflineDBAction,
} from '@/lib/offlineDB';

// Máximo de reintentos antes de PAUSAR (no eliminar)
const MAX_RETRIES_BEFORE_PAUSE = 10;
// Track failure counts in memory (resets on page reload — allows fresh retries)
const failureCounts = new Map<string, number>();
// Track if we already notified about failures (avoid spam)
let lastFailureNotification = 0;

function trackFailure(id: string): boolean {
  const count = (failureCounts.get(id) || 0) + 1;
  failureCounts.set(id, count);
  if (count >= MAX_RETRIES_BEFORE_PAUSE) {
    // PAUSAR, no eliminar — el ítem se reintentará en el próximo reload
    console.warn(`[SyncManager] Ítem ${id} falló ${count} veces — pausando reintentos (NO eliminado)`);
    return true; // should be paused (skipped this cycle)
  }
  return false;
}

function clearFailure(id: string) {
  failureCounts.delete(id);
}

function isPaused(id: string): boolean {
  return (failureCounts.get(id) || 0) >= MAX_RETRIES_BEFORE_PAUSE;
}

function notifyUserAboutFailures(failedCount: number) {
  const now = Date.now();
  // Solo notificar cada 60 segundos para no spamear
  if (now - lastFailureNotification < 60000) return;
  lastFailureNotification = now;
  
  toast.warning(
    `${failedCount} elemento(s) pendiente(s) de sincronizar. Verifica tu conexión a internet.`,
    {
      duration: 8000,
      action: {
        label: 'Reintentar',
        onClick: () => {
          // Reset all failure counts to allow fresh retries
          failureCounts.clear();
        },
      },
    }
  );
}

/**
 * Extraer mensaje de error útil para el usuario
 */
function getErrorMessage(error: any): string {
  if (!error) return 'Error desconocido';
  
  // Error de autenticación
  if (error.message?.includes('UNAUTHORIZED') || error.data?.code === 'UNAUTHORIZED') {
    return 'Sesión expirada. Cierra y abre la app de nuevo.';
  }
  
  // Error de permisos
  if (error.message?.includes('FORBIDDEN') || error.data?.code === 'FORBIDDEN') {
    return 'Sin permisos para esta acción.';
  }
  
  // Error de red
  if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
    return 'Sin conexión al servidor.';
  }
  
  // Error de servidor
  if (error.data?.httpStatus >= 500 || error.message?.includes('INTERNAL_SERVER_ERROR')) {
    return 'Error del servidor. Intenta más tarde.';
  }
  
  return error.message || 'Error desconocido';
}

/**
 * Verificar conectividad real con un fetch ligero (HEAD request)
 */
async function checkRealConnectivity(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('/api/trpc/auth.me', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    return response.ok || response.status === 401; // 401 = server reachable
  } catch {
    return false;
  }
}

/**
 * Contar total de pendientes en todas las colas
 */
async function getTotalPending(): Promise<number> {
  let total = 0;
  try { total += await contarPendientes(); } catch {}
  try { total += await countPendingActions(); } catch {}
  try { const legacy = await getOfflineDBActions(); total += legacy.length; } catch {}
  return total;
}

export function SyncManager() {
  const syncingRef = useRef(false);
  const lastOnlineState = useRef(navigator.onLine);
  const hasPendingRef = useRef(false);
  const utils = trpc.useUtils();

  const uploadFotoDespuesMutation = trpc.items.uploadFotoDespues.useMutation();
  const createItemMutation = trpc.items.create.useMutation();

  const sincronizar = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;

    try {
      syncingRef.current = true;
      let failedItems = 0;

      // 1. Limpiar fotos antiguas (>48h)
      await limpiarAntiguos();

      // 2. Sincronizar cola de fotos (uploadQueue)
      const pendientes = await obtenerPendientes();
      let syncedFotos = 0;

      for (const upload of pendientes) {
        const fotoId = `foto-${upload.id}`;
        if (isPaused(fotoId)) { failedItems++; continue; }
        
        try {
          if (upload.tipo === 'foto_despues') {
            await uploadFotoDespuesMutation.mutateAsync({
              itemId: upload.itemId,
              fotoBase64: upload.foto,
              comentario: upload.comentario,
            });
          }
          if (upload.id) {
            await eliminarDeCola(upload.id);
            clearFailure(fotoId);
            syncedFotos++;
          }
        } catch (error: any) {
          console.error(`[SyncManager] Error foto ${upload.id}:`, error.message);
          if (upload.id) {
            const shouldPause = trackFailure(fotoId);
            if (shouldPause) {
              failedItems++;
              console.warn(`[SyncManager] Foto ${upload.id} pausada — Error: ${getErrorMessage(error)}`);
            } else {
              await marcarFallo(upload.id, getErrorMessage(error));
            }
          }
        }
      }

      // 3. Sincronizar cola de ítems offline (offlineStorage)
      let syncedItems = 0;
      try {
        const offlineActions = await getPendingActions();
        for (const action of offlineActions) {
          const actionId = `os-${action.id}`;
          if (isPaused(actionId)) { failedItems++; continue; }
          
          try {
            if (action.type === 'create_item' && action.data) {
              await createItemMutation.mutateAsync({
                proyectoId: action.data.proyectoId,
                empresaId: action.data.empresaId,
                unidadId: action.data.unidadId,
                especialidadId: action.data.especialidadId,
                defectoId: action.data.defectoId,
                espacioId: action.data.espacioId,
                titulo: action.data.titulo,
                fotoAntesBase64: action.data.fotoAntesBase64,
                fotoAntesMarcadaBase64: action.data.fotoAntesMarcadaBase64,
                clientId: action.data.clientId,
                codigoQrPreasignado: action.data.codigoQrPreasignado,
              });
              syncedItems++;
            }
            await removePendingAction(action.id);
            clearFailure(actionId);
          } catch (error: any) {
            if (error.message?.includes('duplicate') || error.message?.includes('DUPLICATE')) {
              // Duplicado = ya existe en servidor, safe to remove
              await removePendingAction(action.id);
              clearFailure(actionId);
              syncedItems++;
            } else {
              const shouldPause = trackFailure(actionId);
              if (shouldPause) {
                failedItems++;
                console.warn(`[SyncManager] Ítem ${action.id} pausado — Error: ${getErrorMessage(error)}`);
              }
              console.error(`[SyncManager] Error ítem ${action.id}:`, error.message);
            }
          }
        }
      } catch (e) {
        // offlineStorage puede no estar disponible
      }

      // 3b. Sincronizar cola de offlineDB (legacy)
      try {
        const legacyActions = await getOfflineDBActions();
        for (const action of legacyActions) {
          const actionId = `db-${action.id}`;
          if (isPaused(actionId)) { failedItems++; continue; }
          
          try {
            if (((action.type as string) === 'create_item' || action.type === 'createItem') && action.data) {
              await createItemMutation.mutateAsync({
                proyectoId: action.data.proyectoId,
                empresaId: action.data.empresaId,
                unidadId: action.data.unidadId,
                especialidadId: action.data.especialidadId,
                defectoId: action.data.defectoId,
                espacioId: action.data.espacioId,
                titulo: action.data.titulo,
                fotoAntesBase64: action.data.fotoAntesBase64,
                fotoAntesMarcadaBase64: action.data.fotoAntesMarcadaBase64,
                clientId: action.data.clientId,
                codigoQrPreasignado: action.data.codigoQrPreasignado,
              });
              syncedItems++;
            }
            await removeOfflineDBAction(action.id);
            clearFailure(actionId);
          } catch (error: any) {
            if (error.message?.includes('duplicate') || error.message?.includes('DUPLICATE')) {
              await removeOfflineDBAction(action.id);
              clearFailure(actionId);
              syncedItems++;
            } else {
              const shouldPause = trackFailure(actionId);
              if (shouldPause) {
                failedItems++;
                console.warn(`[SyncManager] Legacy ítem ${action.id} pausado — Error: ${getErrorMessage(error)}`);
              }
              console.error(`[SyncManager] Error legacy ítem ${action.id}:`, error.message);
            }
          }
        }
      } catch (e) {
        // offlineDB puede no estar disponible
      }

      // 4. Invalidar queries si se sincronizó algo
      const total = syncedFotos + syncedItems;
      if (total > 0) {
        console.log(`[SyncManager] ${total} elemento(s) sincronizado(s)`);
        toast.success(`${total} elemento(s) sincronizado(s) correctamente`, { duration: 3000 });
        utils.items.invalidate();
      }
      
      // 5. Notificar al usuario si hay ítems que no se pudieron sincronizar
      if (failedItems > 0) {
        notifyUserAboutFailures(failedItems);
      }

      // 6. Actualizar flag de pendientes
      hasPendingRef.current = (await getTotalPending()) > 0;
    } catch (error) {
      console.error('[SyncManager] Error general:', error);
    } finally {
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // === SYNC INMEDIATA AL MONTAR ===
    sincronizar();

    // === EVENTO ONLINE DEL BROWSER (0ms delay) ===
    const handleOnline = () => {
      console.log('[SyncManager] Conexión restaurada — sincronizando INMEDIATAMENTE');
      failureCounts.clear();
      lastOnlineState.current = true;
      // Sin delay — sincronizar al instante
      sincronizar();
    };

    const handleOffline = () => {
      lastOnlineState.current = false;
    };

    // === VISIBILITY CHANGE — sync al volver a la app ===
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        sincronizar();
      }
    };

    // === FOCUS — sync al tocar la app ===
    const handleFocus = () => {
      if (navigator.onLine) sincronizar();
    };

    // === NETWORK INFORMATION API (cambios de tipo de red instantáneos) ===
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const handleConnectionChange = () => {
      console.log('[SyncManager] Cambio de red detectado (NetworkInfo API)');
      if (navigator.onLine) {
        failureCounts.clear();
        sincronizar();
      }
    };

    // === POLLING AGRESIVO DE CONECTIVIDAD ===
    // Cada 1s verifica si hay conexión Y si hay pendientes
    // Si detecta que pasó de offline a online, sincroniza inmediatamente
    const pollingInterval = setInterval(async () => {
      const currentOnline = navigator.onLine;
      
      // Detectar transición offline → online
      if (currentOnline && !lastOnlineState.current) {
        console.log('[SyncManager] Polling detectó reconexión — sincronizando');
        failureCounts.clear();
        lastOnlineState.current = true;
        sincronizar();
        return;
      }
      
      lastOnlineState.current = currentOnline;
      
      // Si hay conexión y hay pendientes, verificar conectividad real y sincronizar
      if (currentOnline) {
        const pending = await getTotalPending();
        hasPendingRef.current = pending > 0;
        
        if (pending > 0 && !syncingRef.current) {
          // Verificar conectividad real con fetch
          const reallyOnline = await checkRealConnectivity();
          if (reallyOnline) {
            sincronizar();
          }
        }
      }
    }, 1000); // Cada 1 segundo — hipersensible

    // === INTERVALO DE RESPALDO (cada 3s si hay pendientes, 10s si no) ===
    const backupInterval = setInterval(() => {
      if (navigator.onLine && !syncingRef.current) {
        sincronizar();
      }
    }, hasPendingRef.current ? 3000 : 10000);

    // === REGISTRAR LISTENERS ===
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // === SERVICE WORKER SYNC (Background Sync API) ===
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        (registration as any).sync?.register?.('sync-pending-items').catch(() => {});
      }).catch(() => {});
    }

    // === ESCUCHAR MENSAJES DEL SERVICE WORKER ===
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_PENDING') {
        console.log('[SyncManager] SW solicitó sincronización');
        sincronizar();
      }
    };
    navigator.serviceWorker?.addEventListener?.('message', handleSWMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener?.('message', handleSWMessage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
      clearInterval(pollingInterval);
      clearInterval(backupInterval);
    };
  }, [sincronizar]);

  return null;
}

export default SyncManager;
