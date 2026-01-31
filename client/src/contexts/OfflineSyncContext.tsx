/**
 * Context para manejar sincronización offline
 */
import { createContext, useContext, useEffect, ReactNode } from 'react';
import { registerSyncHandler, startAutoSync } from '@/lib/syncService';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface OfflineSyncContextType {
  // Placeholder para futuras funciones
}

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const createItemMutation = trpc.items.create.useMutation();

  useEffect(() => {
    // Registrar handler para crear ítems
    registerSyncHandler('createItem', async (action) => {
      try {
        await createItemMutation.mutateAsync(action.data);
        // Invalidar lista de ítems
        utils.items.list.invalidate();
        toast.success('Ítem sincronizado correctamente');
        return true;
      } catch (error: any) {
        // Si el error es de duplicado (ya existe), considerarlo exitoso
        if (error.message?.includes('ya existe') || error.message?.includes('duplicate')) {
          return true;
        }
        console.error('Error sincronizando ítem:', error);
        return false;
      }
    });

    // Iniciar sincronización automática cada 10 segundos
    const cleanup = startAutoSync(10000);

    return cleanup;
  }, [createItemMutation, utils]);

  return (
    <OfflineSyncContext.Provider value={{}}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error('useOfflineSync must be used within OfflineSyncProvider');
  }
  return context;
}
