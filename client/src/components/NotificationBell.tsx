import { useState, useEffect, useRef } from 'react';
import { Bell, BellRing, Check, CheckCheck, Settings, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useLocation } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Notificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  leida: boolean;
  itemId: number | null;
  createdAt: Date;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  
  const { data: notificaciones, refetch } = trpc.notificaciones.list.useQuery({});
  const { data: countData } = trpc.notificaciones.count.useQuery();
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
  
  // Actualizar badge del icono de la app cuando cambia el contador
  useEffect(() => {
    if (typeof (window as any).updateAppBadge === 'function') {
      (window as any).updateAppBadge(unreadCount);
    }
  }, [unreadCount]);
  
  // Cerrar panel al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowSettings(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  const handleNotificationClick = async (notif: Notificacion) => {
    // Marcar como leída
    if (!notif.leida) {
      await marcarLeidaMutation.mutateAsync({ id: notif.id });
      refetch();
    }
    
    // Navegar al ítem si existe
    if (notif.itemId) {
      setIsOpen(false);
      navigate(`/items/${notif.itemId}`);
    }
  };
  
  const handleMarkAllRead = async () => {
    await marcarTodasLeidasMutation.mutateAsync();
    refetch();
  };
  
  const handleTogglePush = async () => {
    if (pushSubscribed) {
      await unsubscribePush();
    } else {
      await subscribePush();
    }
  };
  
  const handleTestPush = async () => {
    const success = await sendTestNotification();
    if (success) {
      // Mostrar toast de éxito
    }
  };
  
  const getNotificationIcon = (tipo: string) => {
    switch (tipo) {
      case 'item_aprobado':
        return '✅';
      case 'item_rechazado':
        return '❌';
      case 'item_pendiente':
      case 'item_pendiente_aprobacion':
      case 'item_pendiente_foto':
        return '⏳';
      case 'mencion':
        return '💬';
      default:
        return '🔔';
    }
  };
  
  const getNotificationColor = (tipo: string) => {
    switch (tipo) {
      case 'item_aprobado':
        return 'bg-green-500/10 border-green-500/20';
      case 'item_rechazado':
        return 'bg-red-500/10 border-red-500/20';
      case 'item_pendiente':
      case 'item_pendiente_aprobacion':
      case 'item_pendiente_foto':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case 'mencion':
        return 'bg-blue-500/10 border-blue-500/20';
      default:
        return 'bg-muted';
    }
  };
  
  return (
    <div className="relative" ref={panelRef}>
      {/* Botón de campana - MÁS VISIBLE EN MÓVIL */}
      <Button
        variant="outline"
        size="icon"
        className="relative h-9 w-9 sm:h-10 sm:w-10 border-2 border-primary/30 bg-primary/5 hover:bg-primary/10"
        onClick={() => setIsOpen(!isOpen)}
        title="Notificaciones Push"
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-pulse" />
        ) : (
          <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        )}
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1.5 -right-1.5 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-red-500 hover:bg-red-500 border-2 border-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>
      
      {/* Panel de notificaciones */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-background border rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="font-semibold">Notificaciones</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} nuevas
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowSettings(!showSettings)}
                title="Configuración"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Configuración de push */}
          {showSettings && (
            <div className="p-3 border-b bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Notificaciones Push</p>
                  <p className="text-xs text-muted-foreground">
                    Recibe alertas en tu dispositivo
                  </p>
                </div>
                <Switch
                  checked={pushSubscribed}
                  onCheckedChange={handleTogglePush}
                  disabled={!pushSupported || pushLoading || pushPermission === 'denied'}
                />
              </div>
              
              {/* Estado actual de las notificaciones */}
              {pushSubscribed ? (
                <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Notificaciones ACTIVADAS
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Recibirás alertas cuando haya ítems urgentes o cambios de estado.
                  </p>
                </div>
              ) : (
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-700 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Notificaciones DESACTIVADAS
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Activa el switch de arriba para recibir alertas en tu dispositivo.
                  </p>
                </div>
              )}
              
              {!pushSupported && (
                <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-xs text-yellow-700 font-medium">
                    ⚠️ Navegador no compatible
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Usa Chrome o Safari para recibir notificaciones push.
                  </p>
                </div>
              )}
              
              {pushPermission === 'denied' && (
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-700 font-medium">
                    🚫 Permiso denegado
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Ve a Configuración del navegador → Sitios → objetivaoqc.cc → Notificaciones → Permitir
                  </p>
                </div>
              )}
              
              {pushSubscribed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleTestPush}
                >
                  🔔 Enviar notificación de prueba
                </Button>
              )}
            </div>
          )}
          
          {/* Acciones */}
          {unreadCount > 0 && !showSettings && (
            <div className="p-2 border-b bg-muted/10">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Marcar todas como leídas
              </Button>
            </div>
          )}
          
          {/* Lista de notificaciones */}
          <ScrollArea className="max-h-[400px]">
            {notificaciones && notificaciones.length > 0 ? (
              <div className="divide-y">
                {notificaciones.map((notif: Notificacion) => (
                  <div
                    key={notif.id}
                    className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                      !notif.leida ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="flex gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm border ${getNotificationColor(notif.tipo)}`}>
                        {getNotificationIcon(notif.tipo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!notif.leida ? 'font-semibold' : ''}`}>
                            {notif.titulo}
                          </p>
                          {!notif.leida && (
                            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        {notif.mensaje && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {notif.mensaje}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notif.createdAt), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </p>
                      </div>
                      {notif.itemId && (
                        <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay notificaciones</p>
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
