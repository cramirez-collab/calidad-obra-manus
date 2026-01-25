import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Clock, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  MapPin,
  BarChart3,
  TrendingUp,
  ClipboardCheck
} from "lucide-react";
import { useLocation } from "wouter";
import { formatDate } from "@/lib/dateFormat";

export default function Bienvenida() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: pendientes, isLoading } = trpc.pendientes.misPendientes.useQuery();

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pendiente_foto_despues":
        return { icon: Camera, color: "text-amber-500", bg: "bg-amber-50", label: "Foto" };
      case "pendiente_aprobacion":
        return { icon: Clock, color: "text-blue-500", bg: "bg-blue-50", label: "Aprobar" };
      case "rechazado":
        return { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50", label: "Corregir" };
      default:
        return { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50", label: "OK" };
    }
  };

  const quickActions = [
    { icon: Camera, label: "Nuevo", path: "/nuevo-item", color: "bg-[#02B381]", roles: ['superadmin', 'admin', 'residente'] },
    { icon: ClipboardCheck, label: "Ítems", path: "/items", color: "bg-[#002C63]", roles: ['all'] },
    { icon: BarChart3, label: "Stats", path: "/estadisticas", color: "bg-amber-500", roles: ['superadmin', 'admin', 'supervisor'] },
    { icon: TrendingUp, label: "KPIs", path: "/kpis", color: "bg-purple-500", roles: ['superadmin', 'admin', 'supervisor'] },
  ];

  const visibleActions = quickActions.filter(a => 
    a.roles.includes('all') || a.roles.includes(user?.role || '')
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header compacto */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-[#002C63]">
              Hola, {user?.name?.split(' ')[0] || 'Usuario'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {pendientes?.length || 0} pendientes
            </p>
          </div>
          <div className="flex gap-2">
            {visibleActions.slice(0, 2).map(action => (
              <Tooltip key={action.path}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className={`h-10 w-10 ${action.color} hover:opacity-90`}
                    onClick={() => setLocation(action.path)}
                  >
                    <action.icon className="h-5 w-5 text-white" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{action.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Lista de pendientes - compacta */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#02B381]" />
          </div>
        ) : pendientes && pendientes.length > 0 ? (
          <div className="space-y-2">
            {pendientes.map((item: any) => {
              const config = getStatusConfig(item.status);
              const Icon = config.icon;
              return (
                <Card 
                  key={item.id}
                  className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
                  onClick={() => setLocation(`/items/${item.id}`)}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      {/* Icono de estado */}
                      <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${config.color}`} />
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#002C63]">
                            {item.codigo}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                        <p className="text-sm truncate mt-0.5">{item.titulo}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          {item.ubicacion && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{item.ubicacion}</span>
                            </span>
                          )}
                          <span className="shrink-0">{formatDate(item.fechaCreacion)}</span>
                        </div>
                      </div>

                      {/* Flecha */}
                      <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-[#02B381]/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-[#02B381]" />
              </div>
              <p className="font-semibold text-[#002C63]">¡Todo al día!</p>
              <p className="text-sm text-muted-foreground">Sin pendientes</p>
            </CardContent>
          </Card>
        )}

        {/* Acciones rápidas - Grid compacto */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {visibleActions.map(action => (
            <Tooltip key={action.path}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setLocation(action.path)}
                  className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl ${action.color} text-white hover:opacity-90 transition-all active:scale-95`}
                >
                  <action.icon className="h-6 w-6 sm:h-7 sm:w-7" />
                  <span className="text-[10px] sm:text-xs mt-1 font-medium">{action.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{action.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
