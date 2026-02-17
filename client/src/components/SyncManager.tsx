/**
 * SyncManager — ÚNICO sistema de sincronización offline.
 * Cubre: uploadQueue (fotos), offlineStorage (ítems), offlineDB (legacy).
 * Auto-limpia ítems que fallan >5 veces para evitar pendientes permanentes.
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

const MAX_RETRIES = 5;
// Track failure counts in memory (resets on page reload — that's fine)
const failureCounts = new Map<string, number>();

function trackFailure(id: string): boolean {
  const count = (failureCounts.get(id) || 0) + 1;
  failureCounts.set(id, count);
  if (count >= MAX_RETRIES) {
    console.warn(`[SyncManager] Ítem ${id} falló ${count} veces — eliminando de cola`);
    failureCounts.delete(id);
    return true; // should be removed
  }
  return false;
}

function clearFailure(id: string) {
  failureCounts.delete(id);
}

export function SyncManager() {
  const syncingRef = useRef(false);
  const utils = trpc.useUtils();

  const uploadFotoDespuesMutation = trpc.items.uploadFotoDespues.useMutation();
  const createItemMutation = trpc.items.create.useMutation();

  const sincronizar = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;

    try {
      syncingRef.current = true;

      // 1. Limpiar fotos antiguas (>48h)
      await limpiarAntiguos();

      // 2. Sincronizar cola de fotos (uploadQueue)
      const pendientes = await obtenerPendientes();
      let syncedFotos = 0;

      for (const upload of pendientes) {
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
            clearFailure(`foto-${upload.id}`);
            syncedFotos++;
          }
        } catch (error: any) {
          console.error(`[SyncManager] Error foto ${upload.id}:`, error.message);
          if (upload.id) {
            const shouldRemove = trackFailure(`foto-${upload.id}`);
            if (shouldRemove) {
              await eliminarDeCola(upload.id);
            } else {
              await marcarFallo(upload.id, error.message);
            }
          }
        }
      }

      // 3. Sincronizar cola de ítems offline (offlineStorage)
      let syncedItems = 0;
      try {
        const offlineActions = await getPendingActions();
        for (const action of offlineActions) {
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
            clearFailure(`os-${action.id}`);
          } catch (error: any) {
            if (error.message?.includes('duplicate') || error.message?.includes('DUPLICATE')) {
              await removePendingAction(action.id);
              clearFailure(`os-${action.id}`);
              syncedItems++;
            } else {
              const shouldRemove = trackFailure(`os-${action.id}`);
              if (shouldRemove) {
                await removePendingAction(action.id);
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
            clearFailure(`db-${action.id}`);
          } catch (error: any) {
            if (error.message?.includes('duplicate') || error.message?.includes('DUPLICATE')) {
              await removeOfflineDBAction(action.id);
              clearFailure(`db-${action.id}`);
              syncedItems++;
            } else {
              const shouldRemove = trackFailure(`db-${action.id}`);
              if (shouldRemove) {
                await removeOfflineDBAction(action.id);
              }
              console.error(`[SyncManager] Error legacy ítem ${action.id}:`, error.message);
            }
          }
        }
      } catch (e) {
        // offlineDB puede no estar disponible
      }

      // 4. Notificar solo si se sincronizó algo
      const total = syncedFotos + syncedItems;
      if (total > 0) {
        toast.success(`${total} elemento(s) sincronizado(s)`);
        utils.items.invalidate();
      }
    } catch (error) {
      console.error('[SyncManager] Error general:', error);
    } finally {
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Sincronizar inmediatamente al montar
    sincronizar();

    const handleOnline = () => {
      console.log('[SyncManager] Conexión restaurada');
      setTimeout(sincronizar, 1000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        setTimeout(sincronizar, 500);
      }
    };

    const handleFocus = () => {
      if (navigator.onLine) setTimeout(sincronizar, 500);
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Sync cada 5s
    const interval = setInterval(() => {
      if (navigator.onLine) sincronizar();
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [sincronizar]);

  return null;
}

export default SyncManager;
