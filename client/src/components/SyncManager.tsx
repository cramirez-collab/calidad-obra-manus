/**
 * Componente de sincronización automática de fotos pendientes
 * Se ejecuta en segundo plano y sincroniza fotos guardadas offline
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { 
  obtenerPendientes, 
  eliminarDeCola, 
  actualizarIntentos,
  limpiarAntiguos,
  contarPendientes
} from '@/lib/uploadQueue';

export function SyncManager() {
  const syncingRef = useRef(false);
  const utils = trpc.useUtils();
  
  const uploadFotoDespuesMutation = trpc.items.uploadFotoDespues.useMutation();
  const createItemMutation = trpc.items.create.useMutation();

  // Función de sincronización
  const sincronizar = async () => {
    if (syncingRef.current) return;
    
    try {
      syncingRef.current = true;
      
      // Limpiar fotos antiguas primero
      await limpiarAntiguos();
      
      const pendientes = await obtenerPendientes();
      if (pendientes.length === 0) return;
      
      console.log(`[SyncManager] ${pendientes.length} fotos pendientes de sincronizar`);
      
      for (const upload of pendientes) {
        try {
          if (upload.tipo === 'foto_despues') {
            await uploadFotoDespuesMutation.mutateAsync({
              itemId: upload.itemId,
              fotoBase64: upload.foto,
              comentario: upload.comentario,
            });
          }
          // Para foto_antes, se maneja en el flujo de creación de ítem
          
          // Eliminar de la cola si fue exitoso
          if (upload.id) {
            await eliminarDeCola(upload.id);
            console.log(`[SyncManager] Foto ${upload.id} sincronizada exitosamente`);
          }
          
          // Invalidar queries para refrescar datos
          utils.items.invalidate();
          
        } catch (error: any) {
          console.error(`[SyncManager] Error sincronizando foto ${upload.id}:`, error);
          
          // Actualizar contador de intentos
          if (upload.id) {
            await actualizarIntentos(upload.id, (upload.intentos || 0) + 1, error.message);
          }
          
          // Si ya tiene muchos intentos, notificar al usuario
          if ((upload.intentos || 0) >= 5) {
            toast.error(`No se pudo sincronizar una foto. Verifica tu conexión.`);
          }
        }
      }
      
    } catch (error) {
      console.error('[SyncManager] Error en sincronización:', error);
    } finally {
      syncingRef.current = false;
    }
  };

  // Sincronizar cuando hay conexión
  useEffect(() => {
    // Sincronizar al montar
    sincronizar();
    
    // Sincronizar cuando vuelve la conexión
    const handleOnline = () => {
      console.log('[SyncManager] Conexión restaurada, sincronizando...');
      toast.info('Conexión restaurada. Sincronizando fotos pendientes...');
      sincronizar();
    };
    
    window.addEventListener('online', handleOnline);
    
    // Sincronizar periódicamente (cada 30 segundos)
    const interval = setInterval(sincronizar, 30000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, []);

  // Mostrar indicador si hay fotos pendientes
  useEffect(() => {
    const checkPendientes = async () => {
      const count = await contarPendientes();
      if (count > 0) {
        toast.info(`${count} foto(s) pendiente(s) de sincronizar`, {
          duration: 3000,
          id: 'sync-pending',
        });
      }
    };
    
    checkPendientes();
  }, []);

  // Este componente no renderiza nada visible
  return null;
}

export default SyncManager;
