/**
 * Página de Pendientes de Sincronización
 * Muestra ítems y fotos que no se han podido sincronizar con el servidor.
 * Permite reintentar manualmente o eliminar ítems atascados.
 * 
 * v3: ANTI-HANG — Cada operación tiene timeout estricto.
 * - Timeout de 30s por operación individual
 * - Timeout global de 90s para "Sincronizar todo"
 * - Estados visuales claros: pendiente, sincronizando, error, éxito
 * - Si algo cuelga, se aborta automáticamente y se muestra error
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  getPendingActions,
  removePendingAction,
} from "@/lib/offlineStorage";
import {
  obtenerPendientes,
  eliminarDeCola,
} from "@/lib/uploadQueue";
import {
  getPendingActions as getOfflineDBActions,
  removePendingAction as removeOfflineDBAction,
} from "@/lib/offlineDB";
import {
  RefreshCw,
  Trash2,
  Upload,
  Clock,
  AlertTriangle,
  CheckCircle2,
  WifiOff,
  Wifi,
  Loader2,
  ArrowLeft,
  Image as ImageIcon,
  FileText,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { useLocation } from "wouter";
import { isOnline } from "@/lib/offlineStorage";

// ===== TIMEOUTS ESTRICTOS =====
const SINGLE_OP_TIMEOUT_MS = 30_000;  // 30s max por operación individual
const GLOBAL_SYNC_TIMEOUT_MS = 90_000; // 90s max para "Sincronizar todo"

type ItemSyncStatus = 'pending' | 'syncing' | 'success' | 'error' | 'timeout';

interface PendingItem {
  id: string;
  type: 'create_item' | 'upload_foto' | 'legacy_item';
  source: 'offlineStorage' | 'uploadQueue' | 'offlineDB';
  titulo: string;
  empresa: string;
  timestamp: number;
  data: any;
  syncStatus: ItemSyncStatus;
  errorMsg?: string;
}

/**
 * Wrapper que agrega timeout a cualquier Promise.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: ${label} excedió ${Math.round(ms / 1000)}s`));
    }, ms);

    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

export default function PendientesSinc() {
  const [, setLocation] = useLocation();
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [online, setOnline] = useState(isOnline());
  const abortRef = useRef(false);

  const createItemMutation = trpc.items.create.useMutation();
  const uploadFotoDespuesMutation = trpc.items.uploadFotoDespues.useMutation();
  const utils = trpc.useUtils();

  // Cargar todos los pendientes
  const loadPendingItems = useCallback(async () => {
    setLoading(true);
    const items: PendingItem[] = [];

    try {
      // 1. offlineStorage (ítems)
      try {
        const offlineActions = await withTimeout(getPendingActions(), 5000, 'loadOfflineStorage');
        for (const action of offlineActions) {
          if (action.type === 'create_item' && action.data) {
            items.push({
              id: action.id,
              type: 'create_item',
              source: 'offlineStorage',
              titulo: action.data.titulo || 'Sin título',
              empresa: `Empresa #${action.data.empresaId}`,
              timestamp: action.timestamp,
              data: action.data,
              syncStatus: 'pending',
            });
          }
        }
      } catch {}

      // 2. uploadQueue (fotos)
      try {
        const uploads = await withTimeout(obtenerPendientes(), 5000, 'loadUploadQueue');
        for (const upload of uploads) {
          items.push({
            id: String(upload.id || `upload-${Date.now()}`),
            type: 'upload_foto',
            source: 'uploadQueue',
            titulo: `Foto después - Ítem #${upload.itemId}`,
            empresa: '',
            timestamp: upload.timestamp || Date.now(),
            data: upload,
            syncStatus: 'pending',
          });
        }
      } catch {}

      // 3. offlineDB (legacy)
      try {
        const legacyActions = await withTimeout(getOfflineDBActions(), 5000, 'loadOfflineDB');
        for (const action of legacyActions) {
          if ((action.type as string) === 'create_item' || action.type === 'createItem') {
            items.push({
              id: action.id,
              type: 'legacy_item',
              source: 'offlineDB',
              titulo: action.data?.titulo || 'Sin título (legacy)',
              empresa: `Empresa #${action.data?.empresaId || '?'}`,
              timestamp: action.timestamp || Date.now(),
              data: action.data,
              syncStatus: 'pending',
            });
          }
        }
      } catch {}

      // Ordenar por timestamp (más recientes primero)
      items.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('[PendientesSinc] Error cargando pendientes:', error);
    }

    setPendingItems(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPendingItems();

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Refrescar cada 10s
    const interval = setInterval(loadPendingItems, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [loadPendingItems]);

  // Actualizar estado de un ítem en la lista
  const updateItemStatus = useCallback((id: string, status: ItemSyncStatus, errorMsg?: string) => {
    setPendingItems(prev => prev.map(item => 
      item.id === id ? { ...item, syncStatus: status, errorMsg } : item
    ));
  }, []);

  // Remover ítem de la lista (después de sync exitoso)
  const removeItemFromList = useCallback((id: string) => {
    setPendingItems(prev => prev.filter(item => item.id !== id));
  }, []);

  /**
   * Sincronizar un ítem individual — CON TIMEOUT ESTRICTO
   */
  const syncSingleItem = async (item: PendingItem): Promise<boolean> => {
    updateItemStatus(item.id, 'syncing');

    try {
      if (item.type === 'create_item' || item.type === 'legacy_item') {
        await withTimeout(
          createItemMutation.mutateAsync({
            proyectoId: item.data.proyectoId,
            empresaId: item.data.empresaId,
            unidadId: item.data.unidadId,
            especialidadId: item.data.especialidadId,
            defectoId: item.data.defectoId,
            espacioId: item.data.espacioId,
            titulo: item.data.titulo,
            fotoAntesBase64: item.data.fotoAntesBase64,
            fotoAntesMarcadaBase64: item.data.fotoAntesMarcadaBase64,
            clientId: item.data.clientId,
            codigoQrPreasignado: item.data.codigoQrPreasignado,
          }),
          SINGLE_OP_TIMEOUT_MS,
          `sync-${item.id}`
        );

        // Eliminar de la cola correspondiente
        if (item.source === 'offlineStorage') {
          await removePendingAction(item.id);
        } else if (item.source === 'offlineDB') {
          await removeOfflineDBAction(item.id);
        }

        updateItemStatus(item.id, 'success');
        return true;

      } else if (item.type === 'upload_foto') {
        await withTimeout(
          uploadFotoDespuesMutation.mutateAsync({
            itemId: item.data.itemId,
            fotoBase64: item.data.foto,
            comentario: item.data.comentario,
          }),
          SINGLE_OP_TIMEOUT_MS,
          `syncFoto-${item.id}`
        );
        await eliminarDeCola(Number(item.id));
        updateItemStatus(item.id, 'success');
        return true;
      }

      return false;
    } catch (error: any) {
      const msg = error.message || 'Error desconocido';
      
      // Duplicado = ya existe en servidor, safe to remove
      if (msg.includes('duplicate') || msg.includes('DUPLICATE')) {
        if (item.source === 'offlineStorage') await removePendingAction(item.id);
        else if (item.source === 'offlineDB') await removeOfflineDBAction(item.id);
        else if (item.source === 'uploadQueue') await eliminarDeCola(Number(item.id));
        updateItemStatus(item.id, 'success');
        return true;
      }

      // Timeout
      if (msg.includes('TIMEOUT')) {
        updateItemStatus(item.id, 'timeout', 'Tiempo agotado. Conexión muy lenta.');
        return false;
      }

      // Otro error
      updateItemStatus(item.id, 'error', msg);
      return false;
    }
  };

  // Reintentar un ítem individual
  const retryItem = async (item: PendingItem) => {
    if (!online) {
      toast.error("Sin conexión a internet. Conéctate primero.");
      return;
    }

    const success = await syncSingleItem(item);
    
    if (success) {
      toast.success(`"${item.titulo}" sincronizado correctamente`);
      utils.items.invalidate();
      // Remover después de 1.5s para que se vea el check verde
      setTimeout(() => removeItemFromList(item.id), 1500);
    } else {
      toast.error(`Error sincronizando "${item.titulo}"`);
    }
  };

  // Eliminar un ítem de la cola (sin sincronizar)
  const deleteItem = async (item: PendingItem) => {
    try {
      if (item.source === 'offlineStorage') {
        await removePendingAction(item.id);
      } else if (item.source === 'uploadQueue') {
        await eliminarDeCola(Number(item.id));
      } else if (item.source === 'offlineDB') {
        await removeOfflineDBAction(item.id);
      }
      toast.success("Elemento eliminado de pendientes");
      removeItemFromList(item.id);
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  // Reintentar todos — CON TIMEOUT GLOBAL
  const retryAll = async () => {
    if (!online) {
      toast.error("Sin conexión a internet.");
      return;
    }

    setSyncingAll(true);
    abortRef.current = false;
    let synced = 0;
    let failed = 0;

    // Timeout global para "Sincronizar todo"
    const globalTimer = setTimeout(() => {
      abortRef.current = true;
      console.warn('[PendientesSinc] Sincronizar todo abortado por timeout global');
    }, GLOBAL_SYNC_TIMEOUT_MS);

    const itemsToSync = pendingItems.filter(i => i.syncStatus !== 'success');

    for (const item of itemsToSync) {
      if (abortRef.current) {
        // Marcar restantes como timeout
        updateItemStatus(item.id, 'timeout', 'Tiempo global agotado');
        failed++;
        continue;
      }

      const success = await syncSingleItem(item);
      if (success) {
        synced++;
      } else {
        failed++;
      }
    }

    clearTimeout(globalTimer);
    setSyncingAll(false);

    if (synced > 0) utils.items.invalidate();
    
    if (failed === 0 && synced > 0) {
      toast.success(`${synced} elemento(s) sincronizado(s) correctamente`);
      // Recargar lista después de 1.5s
      setTimeout(loadPendingItems, 1500);
    } else if (synced > 0 && failed > 0) {
      toast.warning(`${synced} sincronizado(s), ${failed} fallido(s). Puedes reintentar los fallidos.`);
      setTimeout(loadPendingItems, 2000);
    } else if (failed > 0) {
      toast.error(`${failed} elemento(s) fallaron. Verifica tu conexión e intenta de nuevo.`);
    }
  };

  // Cancelar sync en progreso
  const cancelSync = () => {
    abortRef.current = true;
    toast.info("Sincronización cancelada");
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'create_item': return <FileText className="h-4 w-4" />;
      case 'upload_foto': return <ImageIcon className="h-4 w-4" />;
      case 'legacy_item': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'create_item': return 'Nuevo ítem';
      case 'upload_foto': return 'Foto después';
      case 'legacy_item': return 'Ítem (legacy)';
      default: return 'Desconocido';
    }
  };

  const getStatusIcon = (item: PendingItem) => {
    switch (item.syncStatus) {
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'timeout':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return null;
    }
  };

  const getStatusBg = (status: ItemSyncStatus) => {
    switch (status) {
      case 'syncing': return 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20';
      case 'success': return 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20';
      case 'error': return 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20';
      case 'timeout': return 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20';
      default: return '';
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/bienvenida")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pendientes de Sincronización</h1>
            <p className="text-sm text-muted-foreground">
              Elementos guardados localmente que aún no se han enviado al servidor
            </p>
          </div>
          {/* Estado de conexión */}
          <Badge variant={online ? "default" : "destructive"} className="gap-1">
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? "En línea" : "Sin conexión"}
          </Badge>
        </div>

        {/* Acciones globales */}
        {pendingItems.length > 0 && (
          <div className="flex gap-2">
            {syncingAll ? (
              <Button
                onClick={cancelSync}
                variant="destructive"
                size="sm"
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Cancelar
              </Button>
            ) : (
              <Button
                onClick={retryAll}
                disabled={!online}
                className="gap-2"
                size="sm"
              >
                <Upload className="h-4 w-4" />
                Sincronizar todo ({pendingItems.filter(i => i.syncStatus !== 'success').length})
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadPendingItems}
              disabled={loading || syncingAll}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        )}

        {/* Progress bar durante sync all */}
        {syncingAll && (
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div 
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500 animate-pulse"
              style={{ 
                width: `${Math.max(5, (pendingItems.filter(i => i.syncStatus === 'success').length / Math.max(1, pendingItems.length)) * 100)}%` 
              }}
            />
          </div>
        )}

        {/* Lista de pendientes */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pendingItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
              <h3 className="font-semibold text-lg">Todo sincronizado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No hay elementos pendientes de sincronización
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pendingItems.map((item) => (
              <Card key={item.id} className={`overflow-hidden transition-all duration-300 ${getStatusBg(item.syncStatus)}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Icono tipo + estado */}
                    <div className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 mt-0.5 ${
                      item.syncStatus === 'success' ? 'bg-emerald-500/10 text-emerald-600' :
                      item.syncStatus === 'error' ? 'bg-red-500/10 text-red-600' :
                      item.syncStatus === 'timeout' ? 'bg-amber-500/10 text-amber-600' :
                      item.syncStatus === 'syncing' ? 'bg-blue-500/10 text-blue-600' :
                      'bg-amber-500/10 text-amber-600'
                    }`}>
                      {item.syncStatus === 'syncing' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : item.syncStatus === 'success' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        getTypeIcon(item.type)
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm truncate">{item.titulo}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {getTypeLabel(item.type)}
                        </Badge>
                        {getStatusIcon(item)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {item.empresa && <span>{item.empresa}</span>}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(item.timestamp)}
                        </span>
                      </div>
                      {/* Error message */}
                      {(item.syncStatus === 'error' || item.syncStatus === 'timeout') && item.errorMsg && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                          {item.errorMsg}
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1 shrink-0">
                      {item.syncStatus === 'success' ? (
                        <span className="text-xs text-emerald-600 font-medium px-2">Listo</span>
                      ) : item.syncStatus === 'syncing' ? (
                        <span className="text-xs text-blue-500 font-medium px-2">Subiendo...</span>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => retryItem(item)}
                            disabled={!online || syncingAll}
                            title="Reintentar sincronización"
                          >
                            {item.syncStatus === 'error' || item.syncStatus === 'timeout' ? (
                              <RotateCcw className="h-4 w-4" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => deleteItem(item)}
                            disabled={syncingAll}
                            title="Eliminar de pendientes (se perderá)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Nota informativa */}
        {pendingItems.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Estos elementos se guardaron localmente</p>
              <p className="mt-0.5 opacity-80">
                Se sincronizan automáticamente cuando hay conexión estable. 
                Cada operación tiene un límite de 30 segundos — si la conexión es muy lenta, se marcará como fallida y podrás reintentar.
                Al eliminar, el elemento se pierde permanentemente.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
