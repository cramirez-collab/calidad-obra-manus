import { useEffect } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';

export function NotificationBell() {
  const [, navigate] = useLocation();
  
  const { data: countData } = trpc.notificaciones.count.useQuery(
    undefined,
    { 
      refetchInterval: 120_000,
      staleTime: 60_000,
      gcTime: 10 * 60 * 1000,
    }
  );
  
  const unreadCount = typeof countData === 'number' ? countData : 0;
  
  // Actualizar badge del icono de la app cuando cambia el contador
  useEffect(() => {
    if (typeof (window as any).updateAppBadge === 'function') {
      (window as any).updateAppBadge(unreadCount);
    }
  }, [unreadCount]);
  
  return (
    <Button
      variant="outline"
      size="icon"
      className="relative h-9 w-9 sm:h-10 sm:w-10 border-2 border-primary/30 bg-primary/5 hover:bg-primary/10"
      onClick={() => navigate('/notificaciones')}
      title="Notificaciones"
    >
      {unreadCount > 0 ? (
        <BellRing className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-pulse" />
      ) : (
        <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
      )}
      {unreadCount > 0 && (
        <span 
          className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-[11px] font-bold text-white bg-red-600 rounded-full shadow-lg border-2 border-white z-50"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  );
}
