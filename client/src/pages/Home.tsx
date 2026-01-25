import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { 
  Camera, 
  ClipboardCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Building2,
  MapPin,
  Wrench,
  Users,
  Tag
} from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const { data: stats } = trpc.estadisticas.general.useQuery({});
  const { data: empresas } = trpc.empresas.list.useQuery();
  const { data: unidades } = trpc.unidades.list.useQuery();
  const { data: especialidades } = trpc.especialidades.list.useQuery();

  const statusCounts = stats?.porStatus?.reduce((acc, item) => {
    acc[item.status] = Number(item.count);
    return acc;
  }, {} as Record<string, number>) || {};

  const statCards = [
    { icon: ClipboardCheck, label: "Total", value: stats?.total || 0, color: "text-[#002C63]", bg: "bg-[#002C63]/10" },
    { icon: Clock, label: "Foto", value: statusCounts['pendiente_foto_despues'] || 0, color: "text-amber-500", bg: "bg-amber-50" },
    { icon: Clock, label: "Aprobar", value: statusCounts['pendiente_aprobacion'] || 0, color: "text-blue-500", bg: "bg-blue-50" },
    { icon: CheckCircle2, label: "OK", value: statusCounts['aprobado'] || 0, color: "text-[#02B381]", bg: "bg-[#02B381]/10" },
    { icon: XCircle, label: "No", value: statusCounts['rechazado'] || 0, color: "text-red-500", bg: "bg-red-50" },
  ];

  const catalogCards = [
    { icon: Building2, label: "Empresas", value: empresas?.length || 0, path: "/empresas" },
    { icon: MapPin, label: "Unidades", value: unidades?.length || 0, path: "/unidades" },
    { icon: Wrench, label: "Especialidades", value: especialidades?.length || 0, path: "/especialidades" },
    { icon: Tag, label: "Atributos", path: "/atributos" },
    { icon: Users, label: "Usuarios", path: "/usuarios" },
  ];

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Stats - Grid compacto */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {statCards.map((stat, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <Card className="cursor-default">
                  <CardContent className="p-2 sm:p-3 flex flex-col items-center text-center">
                    <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg ${stat.bg} flex items-center justify-center mb-1`}>
                      <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                    </div>
                    <span className="text-lg sm:text-xl font-bold">{stat.value}</span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</span>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>{stat.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Acciones rápidas */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation('/nuevo-item')}
                className="flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl bg-[#02B381] text-white hover:opacity-90 transition-all active:scale-95"
              >
                <Camera className="h-8 w-8 sm:h-10 sm:w-10" />
                <span className="text-xs sm:text-sm mt-2 font-medium">Nuevo</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Registrar nuevo ítem</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation('/items')}
                className="flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl bg-[#002C63] text-white hover:opacity-90 transition-all active:scale-95"
              >
                <ClipboardCheck className="h-8 w-8 sm:h-10 sm:w-10" />
                <span className="text-xs sm:text-sm mt-2 font-medium">Ítems</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Ver todos los ítems</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation('/estadisticas')}
                className="flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl bg-amber-500 text-white hover:opacity-90 transition-all active:scale-95"
              >
                <Clock className="h-8 w-8 sm:h-10 sm:w-10" />
                <span className="text-xs sm:text-sm mt-2 font-medium">Stats</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Ver estadísticas</TooltipContent>
          </Tooltip>
        </div>

        {/* Catálogos - Solo admin */}
        {isAdmin && (
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {catalogCards.map((cat, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setLocation(cat.path)}
                    className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl bg-accent hover:bg-accent/80 transition-all active:scale-95"
                  >
                    <cat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                    {cat.value !== undefined && (
                      <span className="text-sm sm:text-base font-semibold mt-1">{cat.value}</span>
                    )}
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground">{cat.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{cat.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
