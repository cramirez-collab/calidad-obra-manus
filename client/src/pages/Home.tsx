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
  Tag,
  BarChart3,
  AlertTriangle,
  Scissors,
  FileCheck,
  CalendarDays
} from "lucide-react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  
  // Estadísticas y datos filtrados por proyecto desde el backend
  const { data: stats } = trpc.estadisticas.general.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : {},
    { enabled: !!selectedProjectId, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 }
  );
  const { data: empresas } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 }
  );
  const { data: unidades } = trpc.unidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 }
  );
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 }
  );

  const statusCounts = stats?.porStatus?.reduce((acc, item) => {
    acc[item.status] = Number(item.count);
    return acc;
  }, {} as Record<string, number>) || {};

  const statCards = [
    { icon: ClipboardCheck, label: "Total", value: stats?.total || 0, color: "text-[#002C63]", bg: "bg-[#002C63]/10" },
    { icon: Clock, label: "Foto", value: statusCounts['pendiente_foto_despues'] || 0, color: "text-[#002C63]", bg: "bg-[#002C63]/5" },
    { icon: Clock, label: "Aprobar", value: statusCounts['pendiente_aprobacion'] || 0, color: "text-[#002C63]", bg: "bg-[#002C63]/5" },
    { icon: CheckCircle2, label: "OK", value: statusCounts['aprobado'] || 0, color: "text-[#02B381]", bg: "bg-[#02B381]/10" },
    { icon: XCircle, label: "No", value: statusCounts['rechazado'] || 0, color: "text-red-600", bg: "bg-red-50" },
  ];

  const catalogCards = [
    { icon: Building2, label: "Empresas", value: empresas?.length || 0, path: "/empresas" },
    { icon: MapPin, label: "Unidades", value: unidades?.length || 0, path: "/unidades" },
    { icon: Wrench, label: "Especialidades", value: especialidades?.length || 0, path: "/especialidades" },
    { icon: Tag, label: "Atributos", path: "/atributos" },
    { icon: Users, label: "Usuarios", path: "/usuarios" },
  ];

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  // Estado del programa semanal del usuario
  const { data: statusSemanal } = trpc.programaSemanal.statusSemanal.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId, staleTime: 2 * 60 * 1000, gcTime: 5 * 60 * 1000 }
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Banner de estado de Programa Semanal */}
        {statusSemanal && (
          <div
            className="rounded-xl border shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
            onClick={() => {
              if (statusSemanal.programaId) {
                setLocation('/programa-semanal');
              } else {
                setLocation('/programa-semanal');
              }
            }}
          >
            <div className="flex items-stretch">
              {/* Programa */}
              <div className={`flex-1 p-3 sm:p-4 flex items-center gap-3 ${
                statusSemanal.programaEntregado
                  ? 'bg-emerald-50 border-r border-emerald-200'
                  : 'bg-amber-50 border-r border-amber-200'
              }`}>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  statusSemanal.programaEntregado
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-amber-100 text-amber-600'
                }`}>
                  {statusSemanal.programaEntregado
                    ? <FileCheck className="h-5 w-5" />
                    : <AlertTriangle className="h-5 w-5" />
                  }
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${
                    statusSemanal.programaEntregado ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {statusSemanal.programaEntregado ? 'Programa Entregado' : 'Falta Programa'}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {statusSemanal.tienePrograma
                      ? (statusSemanal.status === 'borrador' ? 'En borrador - entregar' : '')
                      : 'No has creado programa esta semana'
                    }
                  </p>
                </div>
              </div>

              {/* Corte */}
              <div className={`flex-1 p-3 sm:p-4 flex items-center gap-3 ${
                statusSemanal.corteRealizado
                  ? 'bg-emerald-50'
                  : statusSemanal.esMiercolesODespues && statusSemanal.programaEntregado
                    ? 'bg-red-50'
                    : 'bg-gray-50'
              }`}>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  statusSemanal.corteRealizado
                    ? 'bg-emerald-100 text-emerald-600'
                    : statusSemanal.esMiercolesODespues && statusSemanal.programaEntregado
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  <Scissors className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${
                    statusSemanal.corteRealizado
                      ? 'text-emerald-700'
                      : statusSemanal.esMiercolesODespues && statusSemanal.programaEntregado
                        ? 'text-red-700'
                        : 'text-gray-500'
                  }`}>
                    {statusSemanal.corteRealizado
                      ? 'Corte Realizado'
                      : 'Falta Corte'
                    }
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {statusSemanal.corteRealizado
                      ? ''
                      : statusSemanal.esMiercolesODespues && statusSemanal.programaEntregado
                        ? 'Realiza el corte semanal'
                        : !statusSemanal.programaEntregado
                          ? 'Primero entrega el programa'
                          : 'Disponible a partir del miercoles'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats - Grid compacto */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {statCards.map((stat, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <Card className="cursor-default border-0 shadow-sm">
                  <CardContent className="p-2 sm:p-3 flex flex-col items-center text-center">
                    <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg ${stat.bg} flex items-center justify-center mb-1`}>
                      <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                    </div>
                    <span className="text-lg sm:text-xl font-bold text-[#002C63]">{stat.value}</span>
                    <span className="text-[10px] sm:text-xs text-[#6E6E6E]">{stat.label}</span>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>{stat.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Acciones rápidas - Colores corporativos Objetiva */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation('/nuevo-item')}
                className="flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl bg-[#02B381] text-white hover:bg-[#02B381]/90 transition-all active:scale-95 shadow-md"
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
                className="flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl bg-[#002C63] text-white hover:bg-[#002C63]/90 transition-all active:scale-95 shadow-md"
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
                className="flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl bg-[#002C63]/80 text-white hover:bg-[#002C63]/70 transition-all active:scale-95 shadow-md"
              >
                <BarChart3 className="h-8 w-8 sm:h-10 sm:w-10" />
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
                    className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl bg-[#E5E5E5]/50 hover:bg-[#E5E5E5] border border-[#E5E5E5] transition-all active:scale-95"
                  >
                    <cat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-[#002C63]" />
                    {cat.value !== undefined && (
                      <span className="text-sm sm:text-base font-semibold mt-1 text-[#002C63]">{cat.value}</span>
                    )}
                    <span className="text-[9px] sm:text-[10px] text-[#6E6E6E]">{cat.label}</span>
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
