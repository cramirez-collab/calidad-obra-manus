import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  CheckCheck, 
  CheckCircle2,
  XCircle,
  Clock,
  Camera
} from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useRealTimeNotifications } from "@/hooks/useRealTimeData";

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
  
  const { data: count = 0, refetch: refetchCount } = trpc.notificaciones.count.useQuery(
    undefined,
    { 
      refetchInterval: 30000, // Refetch cada 30 segundos
      staleTime: 10000,
    }
  );
  const { data: notificaciones = [], refetch: refetchList } = trpc.notificaciones.list.useQuery(
    {},
    { 
      enabled: open,
      staleTime: 5000,
    }
  );
  
  // Escuchar notificaciones en tiempo real
  useRealTimeNotifications();
  
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
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-9 w-9 rounded-full hover:bg-muted/60 transition-colors"
        >
          <Bell className="h-[18px] w-[18px] text-muted-foreground" />
          {count > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-0 shadow-lg border-border/50" 
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
          <span className="text-sm font-medium text-foreground/80">Notificaciones</span>
          {count > 0 && (
            <button 
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              onClick={() => marcarTodasLeidasMutation.mutate()}
            >
              <CheckCheck className="h-3 w-3" />
              Limpiar
            </button>
          )}
        </div>
        <ScrollArea className="max-h-[280px]">
          {notificaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">Sin notificaciones</p>
            </div>
          ) : (
            <div className="py-1">
              {notificaciones.slice(0, 8).map((notificacion) => {
                const Icon = tipoIcons[notificacion.tipo] || Bell;
                const colorClass = tipoColors[notificacion.tipo] || "text-muted-foreground";
                
                return (
                  <button
                    key={notificacion.id}
                    className={`w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors ${
                      !notificacion.leida ? "bg-blue-50/30" : ""
                    }`}
                    onClick={() => handleNotificationClick(notificacion)}
                  >
                    <div className="flex gap-2.5 items-start">
                      <div className={`mt-0.5 ${colorClass} opacity-70`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs font-medium truncate ${
                            !notificacion.leida ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {notificacion.titulo}
                          </p>
                          {!notificacion.leida && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground/70 line-clamp-1 mt-0.5">
                          {notificacion.mensaje}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
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
