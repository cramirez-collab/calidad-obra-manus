/**
 * Página de Pendientes de Sincronización
 * Muestra ítems y fotos que no se han podido sincronizar con el servidor.
 * Permite reintentar manualmente o eliminar ítems atascados.
 */
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  getPendingActions,
  removePendingAction,
  countPendingActions,
} from "@/lib/offlineStorage";
import {
  obtenerPendientes,
  eliminarDeCola,
  contarPendientes,
} from "@/lib/uploadQueue";
import {
  getPendingActions as getOfflineDBActions,
  removePendingAction as removeOfflineDBAction,
} from "@/lib/offlineDB";
import {
  RefreshCw,
  Trash2,
  Upload,
  Camera,
  Clock,
  AlertTriangle,
  CheckCircle2,
  WifiOff,
  Wifi,
  Loader2,
  ArrowLeft,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { useLocation } from "wouter";
import { isOnline } from "@/lib/offlineStorage";

interface PendingItem {
  id: string;
  type: 'create_item' | 'upload_foto' | 'legacy_item';
  source: 'offlineStorage' | 'uploadQueue' | 'offlineDB';
  titulo: string;
  empresa: string;
  timestamp: number;
  data: any;
}

export default function PendientesSinc() {
  const [, setLocation] = useLocation();
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [online, setOnline] = useState(isOnline());

  const createItemMutation = trpc.items.create.useMutation();
  const uploadFotoDespuesMutation = trpc.items.uploadFotoDespues.useMutation();
  const utils = trpc.useUtils();

  // Cargar todos los pendientes
  const loadPendingItems = useCallback(async () => {
    setLoading(true);
    const items: PendingItem[] = [];

    try {
      // 1. offlineStorage (ítems)
      const offlineActions = await getPendingActions();
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
          });
        }
      }

      // 2. uploadQueue (fotos)
      const uploads = await obtenerPendientes();
      for (const upload of uploads) {
        items.push({
          id: String(upload.id || `upload-${Date.now()}`),
          type: 'upload_foto',
          source: 'uploadQueue',
          titulo: `Foto después - Ítem #${upload.itemId}`,
          empresa: '',
          timestamp: upload.timestamp || Date.now(),
          data: upload,
        });
      }

      // 3. offlineDB (legacy)
      try {
        const legacyActions = await getOfflineDBActions();
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
            });
          }
        }
      } catch {
        // offlineDB puede no estar disponible
      }

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

  // Reintentar un ítem individual
  const retryItem = async (item: PendingItem) => {
    if (!online) {
      toast.error("Sin conexión a internet. Conéctate primero.");
      return;
    }

    setSyncing(item.id);
    try {
      if (item.type === 'create_item' || item.type === 'legacy_item') {
        await createItemMutation.mutateAsync({
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
        });

        // Eliminar de la cola correspondiente
        if (item.source === 'offlineStorage') {
          await removePendingAction(item.id);
        } else if (item.source === 'offlineDB') {
          await removeOfflineDBAction(item.id);
        }

        toast.success(`"${item.titulo}" sincronizado correctamente`);
        utils.items.invalidate();
      } else if (item.type === 'upload_foto') {
        await uploadFotoDespuesMutation.mutateAsync({
          itemId: item.data.itemId,
          fotoBase64: item.data.foto,
          comentario: item.data.comentario,
        });
        await eliminarDeCola(Number(item.id));
        toast.success(`Foto sincronizada correctamente`);
        utils.items.invalidate();
      }

      // Recargar lista
      await loadPendingItems();
    } catch (error: any) {
      const msg = error.message || 'Error desconocido';
      if (msg.includes('duplicate') || msg.includes('DUPLICATE')) {
        // Ya existe, eliminar de cola
        if (item.source === 'offlineStorage') await removePendingAction(item.id);
        else if (item.source === 'offlineDB') await removeOfflineDBAction(item.id);
        else if (item.source === 'uploadQueue') await eliminarDeCola(Number(item.id));
        toast.info("Este elemento ya existía en el servidor. Eliminado de pendientes.");
        await loadPendingItems();
      } else {
        toast.error(`Error: ${msg}`);
      }
    } finally {
      setSyncing(null);
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
      await loadPendingItems();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  // Reintentar todos
  const retryAll = async () => {
    if (!online) {
      toast.error("Sin conexión a internet.");
      return;
    }

    let synced = 0;
    let failed = 0;

    for (const item of pendingItems) {
      setSyncing(item.id);
      try {
        if (item.type === 'create_item' || item.type === 'legacy_item') {
          await createItemMutation.mutateAsync({
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
          });
          if (item.source === 'offlineStorage') await removePendingAction(item.id);
          else if (item.source === 'offlineDB') await removeOfflineDBAction(item.id);
          synced++;
        } else if (item.type === 'upload_foto') {
          await uploadFotoDespuesMutation.mutateAsync({
            itemId: item.data.itemId,
            fotoBase64: item.data.foto,
            comentario: item.data.comentario,
          });
          await eliminarDeCola(Number(item.id));
          synced++;
        }
      } catch (error: any) {
        if (error.message?.includes('duplicate') || error.message?.includes('DUPLICATE')) {
          if (item.source === 'offlineStorage') await removePendingAction(item.id);
          else if (item.source === 'offlineDB') await removeOfflineDBAction(item.id);
          else if (item.source === 'uploadQueue') await eliminarDeCola(Number(item.id));
          synced++;
        } else {
          failed++;
        }
      }
    }

    setSyncing(null);
    if (synced > 0) utils.items.invalidate();
    
    if (failed === 0 && synced > 0) {
      toast.success(`${synced} elemento(s) sincronizado(s) correctamente`);
    } else if (failed > 0) {
      toast.warning(`${synced} sincronizado(s), ${failed} fallido(s)`);
    }

    await loadPendingItems();
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
            <Button
              onClick={retryAll}
              disabled={!online || syncing !== null}
              className="gap-2"
              size="sm"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Sincronizar todo ({pendingItems.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadPendingItems}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
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
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Icono tipo */}
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 shrink-0 mt-0.5">
                      {getTypeIcon(item.type)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm truncate">{item.titulo}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {getTypeLabel(item.type)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {item.empresa && <span>{item.empresa}</span>}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(item.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => retryItem(item)}
                        disabled={!online || syncing !== null}
                        title="Reintentar sincronización"
                      >
                        {syncing === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => deleteItem(item)}
                        disabled={syncing !== null}
                        title="Eliminar de pendientes (se perderá)"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                Si un elemento falla repetidamente, puedes reintentarlo manualmente o eliminarlo.
                Al eliminar, el elemento se pierde permanentemente.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
