/**
 * SyncManager — ÚNICO sistema de sincronización offline.
 * Cubre: uploadQueue (fotos), offlineStorage (ítems), offlineDB (legacy).
 * 
 * POLÍTICA: NUNCA eliminar ítems de la cola por fallos de sincronización.
 * Los ítems solo se eliminan cuando se sincronizan exitosamente o son duplicados.
 * Si un ítem falla repetidamente, se pausa y se notifica al usuario.
 * 
 * v4: PRIORITY SYNC + RE-COMPRESSION
 * - Sync por prioridad: primero ítems sin foto (ligeros), luego con foto (pesados)
 * - Re-compresión automática de fotos base64 > 200KB antes de sincronizar
 * - Timeout de 30s por operación individual (fotos grandes necesitan más tiempo)
 * - Timeout global de 120s por ciclo de sync completo
 * - Si una operación cuelga, se aborta y se marca como fallida
 * - Polling de conexión cada 3s
 * - Sync inmediata al detectar red (0ms delay)
 * - NetworkInformation API para detectar cambios de red instantáneamente
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

// ===== TIMEOUTS ESTRICTOS =====
const SINGLE_OP_TIMEOUT_MS = 30_000;  // 30s max por operación individual
const GLOBAL_CYCLE_TIMEOUT_MS = 120_000; // 120s max por ciclo completo
const CONNECTIVITY_CHECK_TIMEOUT_MS = 5_000; // 5s para verificar conectividad

// Máximo de reintentos antes de PAUSAR (no eliminar)
const MAX_RETRIES_BEFORE_PAUSE = 10;
// Track failure counts in memory (resets on page reload — allows fresh retries)
const failureCounts = new Map<string, number>();
// Track if we already notified about failures (avoid spam)
let lastFailureNotification = 0;

// ===== RE-COMPRESSION CONFIG =====
const MAX_BASE64_SIZE_FOR_SYNC_KB = 200; // Re-comprimir si > 200KB

function trackFailure(id: string): boolean {
  const count = (failureCounts.get(id) || 0) + 1;
  failureCounts.set(id, count);
  if (count >= MAX_RETRIES_BEFORE_PAUSE) {
    console.warn(`[SyncManager] Ítem ${id} falló ${count} veces — pausando reintentos (NO eliminado)`);
    return true;
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
  if (now - lastFailureNotification < 60000) return;
  lastFailureNotification = now;
  
  toast.warning(
    `${failedCount} elemento(s) pendiente(s) de sincronizar. Verifica tu conexión a internet.`,
    {
      duration: 8000,
      action: {
        label: 'Reintentar',
        onClick: () => {
          failureCounts.clear();
        },
      },
    }
  );
}

/**
 * Wrapper que agrega timeout a cualquier Promise.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: ${label} excedió ${ms}ms`));
    }, ms);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Extraer mensaje de error útil para el usuario
 */
function getErrorMessage(error: any): string {
  if (!error) return 'Error desconocido';
  
  if (error.message?.includes('TIMEOUT')) {
    return 'Tiempo de espera agotado. La conexión es muy lenta.';
  }
  if (error.message?.includes('UNAUTHORIZED') || error.data?.code === 'UNAUTHORIZED') {
    return 'Sesión expirada. Cierra y abre la app de nuevo.';
  }
  if (error.message?.includes('FORBIDDEN') || error.data?.code === 'FORBIDDEN') {
    return 'Sin permisos para esta acción.';
  }
  if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
    return 'Sin conexión al servidor.';
  }
  if (error.data?.httpStatus >= 500 || error.message?.includes('INTERNAL_SERVER_ERROR')) {
    return 'Error del servidor. Intenta más tarde.';
  }
  
  return error.message || 'Error desconocido';
}

/**
 * Verificar conectividad real con un fetch ligero — con timeout estricto
 */
async function checkRealConnectivity(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTIVITY_CHECK_TIMEOUT_MS);
    const response = await fetch('/api/trpc/auth.me', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    return response.ok || response.status === 401;
  } catch {
    return false;
  }
}

/**
 * Contar total de pendientes en todas las colas — con timeout
 */
async function getTotalPending(): Promise<number> {
  let total = 0;
  try { total += await withTimeout(contarPendientes(), 3000, 'contarPendientes'); } catch {}
  try { total += await withTimeout(countPendingActions(), 3000, 'countPendingActions'); } catch {}
  try { const legacy = await withTimeout(getOfflineDBActions(), 3000, 'getOfflineDBActions'); total += legacy.length; } catch {}
  return total;
}

/**
 * Obtener tamaño de un string base64 en KB
 */
function getBase64SizeKB(base64: string | undefined | null): number {
  if (!base64) return 0;
  const data = base64.split(',')[1] || base64;
  return Math.round((data.length * 3) / 4 / 1024);
}

/**
 * Re-comprimir una imagen base64 si excede el límite para sync.
 * Usa canvas nativo del navegador — no requiere librería externa.
 */
async function recompressForSync(base64: string): Promise<string> {
  const sizeKB = getBase64SizeKB(base64);
  if (sizeKB <= MAX_BASE64_SIZE_FOR_SYNC_KB) return base64;
  
  console.log(`[SyncManager] Re-comprimiendo foto: ${sizeKB}KB → objetivo ${MAX_BASE64_SIZE_FOR_SYNC_KB}KB`);
  
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        // Reducir a max 800px
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(base64); return; }
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Intentar con calidad decreciente hasta alcanzar objetivo
        let quality = 0.65;
        let result = canvas.toDataURL('image/jpeg', quality);
        
        while (getBase64SizeKB(result) > MAX_BASE64_SIZE_FOR_SYNC_KB && quality > 0.25) {
          quality -= 0.05;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        
        const finalSize = getBase64SizeKB(result);
        console.log(`[SyncManager] Re-comprimido: ${sizeKB}KB → ${finalSize}KB (quality: ${quality.toFixed(2)})`);
        resolve(result);
      } catch {
        resolve(base64); // Fallback: usar original
      }
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

/**
 * Determinar si un ítem offline tiene foto (es "pesado")
 */
function hasPhoto(data: any): boolean {
  return !!(data?.fotoAntesBase64 || data?.fotoAntesMarcadaBase64);
}

/**
 * Estimar tamaño total de un ítem en KB
 */
function estimateItemSizeKB(data: any): number {
  let size = 1; // 1KB base para metadatos
  if (data?.fotoAntesBase64) size += getBase64SizeKB(data.fotoAntesBase64);
  if (data?.fotoAntesMarcadaBase64) size += getBase64SizeKB(data.fotoAntesMarcadaBase64);
  return size;
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

    // Global cycle timeout
    const cycleAbort = new AbortController();
    const cycleTimer = setTimeout(() => {
      cycleAbort.abort();
      console.warn('[SyncManager] Ciclo de sync abortado por timeout global');
    }, GLOBAL_CYCLE_TIMEOUT_MS);

    try {
      syncingRef.current = true;
      let failedItems = 0;

      const checkAbort = () => {
        if (cycleAbort.signal.aborted) throw new Error('CYCLE_ABORTED');
      };

      // 1. Limpiar fotos antiguas (>7d)
      try {
        await withTimeout(limpiarAntiguos(), 5000, 'limpiarAntiguos');
      } catch {}

      // 2. Sincronizar cola de fotos (uploadQueue)
      let syncedFotos = 0;
      try {
        const pendientes = await withTimeout(obtenerPendientes(), 5000, 'obtenerPendientes');

        for (const upload of pendientes) {
          checkAbort();
          const fotoId = `foto-${upload.id}`;
          if (isPaused(fotoId)) { failedItems++; continue; }
          
          try {
            if (upload.tipo === 'foto_despues') {
              // Re-comprimir foto si es muy grande
              const fotoComprimida = await recompressForSync(upload.foto);
              
              await withTimeout(
                uploadFotoDespuesMutation.mutateAsync({
                  itemId: upload.itemId,
                  fotoBase64: fotoComprimida,
                  comentario: upload.comentario,
                }),
                SINGLE_OP_TIMEOUT_MS,
                `uploadFoto-${upload.id}`
              );
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
              } else {
                try { await marcarFallo(upload.id, getErrorMessage(error)); } catch {}
              }
            }
          }
        }
      } catch (e: any) {
        if (e.message === 'CYCLE_ABORTED') throw e;
        console.error('[SyncManager] Error en cola de fotos:', e);
      }

      // 3. Sincronizar cola de ítems offline (offlineStorage) — PRIORITY SYNC
      let syncedItems = 0;
      try {
        checkAbort();
        const offlineActions = await withTimeout(getPendingActions(), 5000, 'getPendingActions');
        
        // === PRIORITY SORT ===
        // Primero ítems sin foto (ligeros, se sincronizan rápido)
        // Luego ítems con foto (pesados, pueden tardar más)
        const sorted = [...offlineActions].sort((a, b) => {
          const aHasPhoto = hasPhoto(a.data);
          const bHasPhoto = hasPhoto(b.data);
          if (!aHasPhoto && bHasPhoto) return -1; // sin foto primero
          if (aHasPhoto && !bHasPhoto) return 1;
          // Dentro del mismo grupo, los más pequeños primero
          return estimateItemSizeKB(a.data) - estimateItemSizeKB(b.data);
        });
        
        for (const action of sorted) {
          checkAbort();
          const actionId = `os-${action.id}`;
          if (isPaused(actionId)) { failedItems++; continue; }
          
          try {
            if (action.type === 'create_item' && action.data) {
              // Re-comprimir fotos si son muy grandes
              let fotoAntes = action.data.fotoAntesBase64;
              let fotoMarcada = action.data.fotoAntesMarcadaBase64;
              
              if (fotoAntes) {
                fotoAntes = await recompressForSync(fotoAntes);
              }
              if (fotoMarcada) {
                fotoMarcada = await recompressForSync(fotoMarcada);
              }
              
              await withTimeout(
                createItemMutation.mutateAsync({
                  proyectoId: action.data.proyectoId,
                  empresaId: action.data.empresaId,
                  unidadId: action.data.unidadId,
                  especialidadId: action.data.especialidadId,
                  defectoId: action.data.defectoId,
                  espacioId: action.data.espacioId,
                  titulo: action.data.titulo,
                  fotoAntesBase64: fotoAntes,
                  fotoAntesMarcadaBase64: fotoMarcada,
                  clientId: action.data.clientId,
                  codigoQrPreasignado: action.data.codigoQrPreasignado,
                }),
                SINGLE_OP_TIMEOUT_MS,
                `createItem-${action.id}`
              );
              syncedItems++;
            }
            await removePendingAction(action.id);
            clearFailure(actionId);
          } catch (error: any) {
            if (error.message === 'CYCLE_ABORTED') throw error;
            if (error.message?.includes('duplicate') || error.message?.includes('DUPLICATE')) {
              await removePendingAction(action.id);
              clearFailure(actionId);
              syncedItems++;
            } else {
              const shouldPause = trackFailure(actionId);
              if (shouldPause) failedItems++;
              console.error(`[SyncManager] Error ítem ${action.id}:`, error.message);
            }
          }
        }
      } catch (e: any) {
        if (e.message === 'CYCLE_ABORTED') throw e;
      }

      // 3b. Sincronizar cola de offlineDB (legacy) — same priority sort
      try {
        checkAbort();
        const legacyActions = await withTimeout(getOfflineDBActions(), 5000, 'getOfflineDBActions');
        
        const sortedLegacy = [...legacyActions].sort((a, b) => {
          const aHasPhoto = hasPhoto(a.data);
          const bHasPhoto = hasPhoto(b.data);
          if (!aHasPhoto && bHasPhoto) return -1;
          if (aHasPhoto && !bHasPhoto) return 1;
          return estimateItemSizeKB(a.data) - estimateItemSizeKB(b.data);
        });
        
        for (const action of sortedLegacy) {
          checkAbort();
          const actionId = `db-${action.id}`;
          if (isPaused(actionId)) { failedItems++; continue; }
          
          try {
            if (((action.type as string) === 'create_item' || action.type === 'createItem') && action.data) {
              // Re-comprimir fotos si son muy grandes
              let fotoAntes = action.data.fotoAntesBase64;
              let fotoMarcada = action.data.fotoAntesMarcadaBase64;
              
              if (fotoAntes) {
                fotoAntes = await recompressForSync(fotoAntes);
              }
              if (fotoMarcada) {
                fotoMarcada = await recompressForSync(fotoMarcada);
              }
              
              await withTimeout(
                createItemMutation.mutateAsync({
                  proyectoId: action.data.proyectoId,
                  empresaId: action.data.empresaId,
                  unidadId: action.data.unidadId,
                  especialidadId: action.data.especialidadId,
                  defectoId: action.data.defectoId,
                  espacioId: action.data.espacioId,
                  titulo: action.data.titulo,
                  fotoAntesBase64: fotoAntes,
                  fotoAntesMarcadaBase64: fotoMarcada,
                  clientId: action.data.clientId,
                  codigoQrPreasignado: action.data.codigoQrPreasignado,
                }),
                SINGLE_OP_TIMEOUT_MS,
                `createItemLegacy-${action.id}`
              );
              syncedItems++;
            }
            await removeOfflineDBAction(action.id);
            clearFailure(actionId);
          } catch (error: any) {
            if (error.message === 'CYCLE_ABORTED') throw error;
            if (error.message?.includes('duplicate') || error.message?.includes('DUPLICATE')) {
              await removeOfflineDBAction(action.id);
              clearFailure(actionId);
              syncedItems++;
            } else {
              const shouldPause = trackFailure(actionId);
              if (shouldPause) failedItems++;
              console.error(`[SyncManager] Error legacy ítem ${action.id}:`, error.message);
            }
          }
        }
      } catch (e: any) {
        if (e.message === 'CYCLE_ABORTED') throw e;
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
    } catch (error: any) {
      if (error.message === 'CYCLE_ABORTED') {
        console.warn('[SyncManager] Ciclo abortado por timeout global — se reintentará');
      } else {
        console.error('[SyncManager] Error general:', error);
      }
    } finally {
      clearTimeout(cycleTimer);
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

    // === NETWORK INFORMATION API ===
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const handleConnectionChange = () => {
      console.log('[SyncManager] Cambio de red detectado (NetworkInfo API)');
      if (navigator.onLine) {
        failureCounts.clear();
        sincronizar();
      }
    };

    // === POLLING DE CONECTIVIDAD (cada 3s) ===
    const pollingInterval = setInterval(async () => {
      const currentOnline = navigator.onLine;
      
      if (currentOnline && !lastOnlineState.current) {
        console.log('[SyncManager] Polling detectó reconexión — sincronizando');
        failureCounts.clear();
        lastOnlineState.current = true;
        sincronizar();
        return;
      }
      
      lastOnlineState.current = currentOnline;
      
      if (currentOnline && !syncingRef.current) {
        const pending = await getTotalPending();
        hasPendingRef.current = pending > 0;
        
        if (pending > 0) {
          const reallyOnline = await checkRealConnectivity();
          if (reallyOnline) {
            sincronizar();
          }
        }
      }
    }, 3000);

    // === INTERVALO DE RESPALDO (cada 15s) ===
    const backupInterval = setInterval(() => {
      if (navigator.onLine && !syncingRef.current) {
        sincronizar();
      }
    }, 15000);

    // === REGISTRAR LISTENERS ===
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // === SERVICE WORKER SYNC ===
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
