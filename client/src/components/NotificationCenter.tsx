import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  Check, 
  CheckCheck, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Camera
} from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const tipoIcons: Record<string, typeof Bell> = {
  item_pendiente_foto: Camera,
  item_pendiente_aprobacion: Clock,
  item_aprobado: CheckCircle2,
  item_rechazado: XCircle,
};

const tipoColors: Record<string, string> = {
  item_pendiente_foto: "text-amber-500",
  item_pendiente_aprobacion: "text-blue-500",
  item_aprobado: "text-emerald-500",
  item_rechazado: "text-red-500",
};

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  
  const { data: count = 0, refetch: refetchCount } = trpc.notificaciones.count.useQuery();
  const { data: notificaciones = [], refetch: refetchList } = trpc.notificaciones.list.useQuery(
    {},
    { enabled: open }
  );
  
  const marcarLeidaMutation = trpc.notificaciones.marcarLeida.useMutation({
    onSuccess: () => {
      refetchCount();
      refetchList();
    },
  });
  
  const marcarTodasLeidasMutation = trpc.notificaciones.marcarTodasLeidas.useMutation({
    onSuccess: () => {
      refetchCount();
      refetchList();
    },
  });

  const handleNotificationClick = (notificacion: any) => {
    if (!notificacion.leida) {
      marcarLeidaMutation.mutate({ id: notificacion.id });
    }
    if (notificacion.itemId) {
      setLocation(`/items/${notificacion.itemId}`);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {count > 9 ? "9+" : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">Notificaciones</h4>
          {count > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-7"
              onClick={() => marcarTodasLeidasMutation.mutate()}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas leídas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notificaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
              <Bell className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No hay notificaciones</p>
            </div>
          ) : (
            <div className="divide-y">
              {notificaciones.map((notificacion) => {
                const Icon = tipoIcons[notificacion.tipo] || AlertCircle;
                const colorClass = tipoColors[notificacion.tipo] || "text-gray-500";
                
                return (
                  <button
                    key={notificacion.id}
                    className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                      !notificacion.leida ? "bg-blue-50/50" : ""
                    }`}
                    onClick={() => handleNotificationClick(notificacion)}
                  >
                    <div className="flex gap-3">
                      <div className={`mt-0.5 ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium truncate ${
                            !notificacion.leida ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {notificacion.titulo}
                          </p>
                          {!notificacion.leida && (
                            <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notificacion.mensaje}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notificacion.createdAt), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
