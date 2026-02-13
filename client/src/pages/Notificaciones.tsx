import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { 
  Bell, 
  BellRing,
  CheckCheck, 
  ArrowLeft,
  ExternalLink,
  Settings,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { useProject } from "@/contexts/ProjectContext";

interface Notificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  leida: boolean;
  itemId: number | null;
  createdAt: Date;
}

export default function Notificaciones() {
  const [, navigate] = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const { selectedProjectId } = useProject();
  
  const { data: notificaciones = [], refetch } = trpc.notificaciones.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : {},
    { staleTime: 5000 }
  );
  const { data: countData, refetch: refetchCount } = trpc.notificaciones.count.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined
  );
  const marcarLeidaMutation = trpc.notificaciones.marcarLeida.useMutation();
  const marcarTodasLeidasMutation = trpc.notificaciones.marcarTodasLeidas.useMutation();
  
  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    permission: pushPermission,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    sendTestNotification,
  } = usePushNotifications();
  
  const unreadCount = typeof countData === 'number' ? countData : 0;
  
  const handleNotificationClick = async (notif: Notificacion) => {
    if (!notif.leida) {
      await marcarLeidaMutation.mutateAsync({ id: notif.id });
      refetch();
      refetchCount();
    }
    if (notif.itemId) {
      navigate(`/items/${notif.itemId}`);
    }
  };
  
  const handleMarkAllRead = async () => {
    await marcarTodasLeidasMutation.mutateAsync(selectedProjectId ? { proyectoId: selectedProjectId } : undefined);
    refetch();
    refetchCount();
  };
  
  const handleTogglePush = async () => {
    if (pushSubscribed) {
      await unsubscribePush();
    } else {
      await subscribePush();
    }
  };
  
  const getNotificationIcon = (tipo: string) => {
    switch (tipo) {
      case 'item_aprobado': return '✅';
      case 'item_rechazado': return '❌';
      case 'item_pendiente':
      case 'item_pendiente_aprobacion':
      case 'item_pendiente_foto': return '⏳';
      case 'mencion': return '💬';
      default: return '🔔';
    }
  };
  
  const getNotificationColor = (tipo: string) => {
    switch (tipo) {
      case 'item_aprobado': return 'bg-green-500/10 border-green-500/20';
      case 'item_rechazado': return 'bg-red-500/10 border-red-500/20';
      case 'item_pendiente':
      case 'item_pendiente_aprobacion':
      case 'item_pendiente_foto': return 'bg-amber-500/10 border-amber-500/20';
      case 'mencion': return 'bg-blue-500/10 border-blue-500/20';
      default: return 'bg-muted';
    }
  };

  // Agrupar notificaciones por fecha
  const groupedNotifications = notificaciones.reduce((groups: Record<string, Notificacion[]>, notif: Notificacion) => {
    const date = format(new Date(notif.createdAt), 'yyyy-MM-dd');
    const label = (() => {
      const today = new Date();
      const notifDate = new Date(notif.createdAt);
      const diffDays = Math.floor((today.getTime() - notifDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Hoy';
      if (diffDays === 1) return 'Ayer';
      return format(notifDate, "EEEE d 'de' MMMM", { locale: es });
    })();
    if (!groups[label]) groups[label] = [];
    groups[label].push(notif);
    return groups;
  }, {});
  
  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => navigate('/bienvenida')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold">Notificaciones</h1>
              {unreadCount > 0 && (
                <Badge className="bg-red-600 text-white text-xs">
                  {unreadCount} nuevas
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Leer todas
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Configuración Push */}
        {showSettings && (
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Notificaciones Push</p>
                <p className="text-xs text-muted-foreground">
                  Recibe alertas en tu dispositivo, incluso con la pantalla bloqueada
                </p>
              </div>
              <Switch
                checked={pushSubscribed}
                onCheckedChange={handleTogglePush}
                disabled={!pushSupported || pushLoading || pushPermission === 'denied'}
              />
            </div>
            
            {pushSubscribed ? (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-xs text-green-700 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Notificaciones Push ACTIVADAS
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Recibirás alertas de ítems urgentes y cambios de estado directamente en tu dispositivo.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs text-red-700 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                  Notificaciones Push DESACTIVADAS
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Activa el switch para recibir alertas en tu dispositivo.
                </p>
              </div>
            )}
            
            {!pushSupported && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-xs text-yellow-700 font-medium">Navegador no compatible</p>
                <p className="text-xs text-yellow-600 mt-1">Usa Chrome o Safari para recibir notificaciones push.</p>
              </div>
            )}
            
            {pushPermission === 'denied' && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs text-red-700 font-medium">Permiso denegado</p>
                <p className="text-xs text-red-600 mt-1">
                  Ve a Configuración del navegador → Sitios → Notificaciones → Permitir
                </p>
              </div>
            )}
            
            {pushSubscribed && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => sendTestNotification()}
              >
                <Bell className="h-3.5 w-3.5 mr-1.5" />
                Enviar notificación de prueba
              </Button>
            )}
          </div>
        )}
        
        {/* Lista de notificaciones agrupadas por fecha */}
        {notificaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bell className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Sin notificaciones</p>
            <p className="text-xs mt-1">Las alertas de ítems aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedNotifications).map(([dateLabel, notifs]) => (
              <div key={dateLabel}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {dateLabel}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="space-y-1">
                  {(notifs as Notificacion[]).map((notif) => (
                    <div
                      key={notif.id}
                      className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                        !notif.leida 
                          ? 'bg-primary/5 border border-primary/10 shadow-sm' 
                          : 'bg-card border border-transparent hover:bg-muted/50'
                      }`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-base border ${getNotificationColor(notif.tipo)}`}>
                        {getNotificationIcon(notif.tipo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-tight ${!notif.leida ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                            {notif.titulo}
                          </p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {!notif.leida && (
                              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                            )}
                            {notif.itemId && (
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        {notif.mensaje && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {notif.mensaje}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(notif.createdAt), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
