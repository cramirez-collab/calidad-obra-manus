/**
 * Componente de sincronización automática de fotos y acciones pendientes.
 * Se ejecuta en segundo plano y sincroniza todo lo guardado offline.
 *
 * Unifica las dos colas:
 * - uploadQueue (oqc_upload_queue): fotos pendientes
 * - offlineStorage (oqc_offline_db): ítems creados offline
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

export function SyncManager() {
  const syncingRef = useRef(false);
  const utils = trpc.useUtils();

  const uploadFotoDespuesMutation = trpc.items.uploadFotoDespues.useMutation();
  const createItemMutation = trpc.items.create.useMutation();

  const sincronizar = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;

    try {
      syncingRef.current = true;

      // 1. Limpiar fotos antiguas
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
            syncedFotos++;
            console.log(`[SyncManager] Foto ${upload.id} sincronizada`);
          }
        } catch (error: any) {
          console.error(`[SyncManager] Error foto ${upload.id}:`, error.message);
          if (upload.id) {
            await marcarFallo(upload.id, error.message);
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
          } catch (error: any) {
            if (error.message?.includes('duplicate') || error.message?.includes('DUPLICATE')) {
              await removePendingAction(action.id);
              syncedItems++;
            } else {
              console.error(`[SyncManager] Error ítem ${action.id}:`, error.message);
            }
          }
        }
      } catch (e) {
        // offlineStorage puede no estar disponible
      }

      // 4. Notificar al usuario
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

  // Sincronizar al montar + cuando vuelve la conexión + periódicamente
  useEffect(() => {
    sincronizar();

    const handleOnline = () => {
      console.log('[SyncManager] Conexión restaurada');
      toast.info('Conexión restaurada. Sincronizando pendientes...');
      setTimeout(sincronizar, 1000);
    };

    // Sync when app regains focus (user switches back to the tab/app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('[SyncManager] App visible, sincronizando...');
        setTimeout(sincronizar, 500);
      }
    };

    const handleFocus = () => {
      if (navigator.onLine) {
        console.log('[SyncManager] Ventana enfocada, sincronizando...');
        setTimeout(sincronizar, 500);
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Sync every 5 seconds (was 15s)
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

  // Mostrar indicador de pendientes al montar
  useEffect(() => {
    const check = async () => {
      const fotoCount = await contarPendientes();
      let itemCount = 0;
      try { itemCount = await countPendingActions(); } catch {}
      const total = fotoCount + itemCount;
      if (total > 0) {
        toast.info(`${total} elemento(s) pendiente(s) de sincronizar`, {
          duration: 4000,
          id: 'sync-pending',
        });
      }
    };
    check();
  }, []);

  return null;
}

export default SyncManager;
