import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  XCircle, 
  CheckCircle2, 
  Shield,
  MessageCircle,
  AlertCircle
} from "lucide-react";
import { useLocation } from "wouter";

export function BadgeNotifications() {
  const [, setLocation] = useLocation();
  const { data: badges, isLoading } = trpc.badges.me.useQuery();
  const { data: notificaciones } = trpc.notificaciones.list.useQuery();
  const utils = trpc.useUtils();

  const marcarLeidos = trpc.badges.marcarMensajesLeidos.useMutation({
    onSuccess: () => {
      utils.badges.me.invalidate();
    }
  });

  const marcarNotificacionLeida = trpc.notificaciones.marcarLeida.useMutation({
    onSuccess: () => {
      utils.notificaciones.list.invalidate();
    }
  });

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  const totalBadges = (badges?.rechazados || 0) + 
                      (badges?.aprobadosJefe || 0) + 
                      (badges?.aprobadosSupervisor || 0) + 
                      (badges?.mensajesNoLeidos || 0);

  const notificacionesNoLeidas = notificaciones?.filter((n: any) => !n.leida) || [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalBadges > 0 && (
            <span className="absolute -top-3 -right-2 h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full shadow-lg ring-2 ring-white z-10">
              {totalBadges > 99 ? "99+" : totalBadges}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h3 className="font-semibold">Notificaciones</h3>
        </div>
        
        {/* Badges de estado */}
        <div className="p-3 border-b bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">Resumen de ítems</p>
          <div className="grid grid-cols-2 gap-2">
            {/* Badge Rojo - Rechazados */}
            <div 
              className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
              onClick={() => setLocation("/items?status=rechazado")}
            >
              <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center">
                <XCircle className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-red-700">{badges?.rechazados || 0}</p>
                <p className="text-xs text-red-600">Rechazados</p>
              </div>
            </div>
            
            {/* Badge Verde - Aprobados por Jefe */}
            <div 
              className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors"
              onClick={() => setLocation("/items?status=aprobado")}
            >
              <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-700">{badges?.aprobadosJefe || 0}</p>
                <p className="text-xs text-emerald-600">Aprobados</p>
              </div>
            </div>
            
            {/* Badge Azul - Aprobados por Supervisor */}
            <div 
              className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => setLocation("/items?supervisorOk=true")}
            >
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-blue-700">{badges?.aprobadosSupervisor || 0}</p>
                <p className="text-xs text-blue-600">OK Supervisor</p>
              </div>
            </div>
            
            {/* Badge Mensajes */}
            <div 
              className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors"
              onClick={() => {
                marcarLeidos.mutate();
              }}
            >
              <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-purple-700">{badges?.mensajesNoLeidos || 0}</p>
                <p className="text-xs text-purple-600">Mensajes</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Lista de notificaciones */}
        <ScrollArea className="h-64">
          {notificacionesNoLeidas.length > 0 ? (
            <div className="divide-y">
              {notificacionesNoLeidas.slice(0, 10).map((notif: any) => (
                <div 
                  key={notif.id} 
                  className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    marcarNotificacionLeida.mutate({ id: notif.id });
                    if (notif.itemId) {
                      setLocation(`/items/${notif.itemId}`);
                    }
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      notif.tipo === 'mencion' ? 'bg-purple-100' :
                      notif.tipo === 'item_aprobado' ? 'bg-emerald-100' :
                      notif.tipo === 'item_rechazado' ? 'bg-red-100' :
                      'bg-blue-100'
                    }`}>
                      {notif.tipo === 'mencion' ? (
                        <MessageCircle className="h-4 w-4 text-purple-600" />
                      ) : notif.tipo === 'item_aprobado' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : notif.tipo === 'item_rechazado' ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{notif.titulo}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notif.mensaje}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(notif.createdAt).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {!notif.leida && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No hay notificaciones nuevas</p>
            </div>
          )}
        </ScrollArea>
        
        {notificacionesNoLeidas.length > 0 && (
          <div className="p-2 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs"
              onClick={() => setLocation("/notificaciones")}
            >
              Ver todas las notificaciones
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
