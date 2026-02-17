/**
 * Context para compatibilidad — la sincronización real la hace SyncManager.
 * Este context ya NO ejecuta sync propio para evitar duplicación.
 */
import { createContext, useContext, ReactNode } from 'react';

interface OfflineSyncContextType {
  // Placeholder para compatibilidad
}

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  // NO registrar handlers ni iniciar autoSync aquí.
  // SyncManager (en main.tsx) es el ÚNICO sistema de sincronización.
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
