import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getImageUrl } from "@/lib/imageUrl";
import DashboardLayout from "@/components/DashboardLayout";
import { UserAvatar } from "@/components/UserAvatar";
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
  Plus,
  Loader2,
  Filter
} from "lucide-react";
import { useLocation, Redirect } from "wouter";
import { formatDate } from "@/lib/dateFormat";
import { useProject } from "@/contexts/ProjectContext";

type FilterType = "todos" | "foto" | "aprobar" | "corregir";

export default function Bienvenida() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedProjectId, isLoadingProjects } = useProject();
  const { data: pendientes, isLoading } = trpc.pendientes.misPendientes.useQuery();
  const [activeFilter, setActiveFilter] = useState<FilterType>("todos");

  // Redirigir a selección de proyecto si no hay proyecto seleccionado
  if (!isLoadingProjects && !selectedProjectId) {
    return <Redirect to="/seleccionar-proyecto" />;
  }

  // Mostrar loading mientras carga proyectos
  if (isLoadingProjects) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#02B381]" />
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pendiente_foto_despues":
        return { icon: Camera, color: "text-[#002C63]", bg: "bg-[#002C63]/10", label: "Foto", filter: "foto" as FilterType };
      case "pendiente_aprobacion":
        return { icon: Clock, color: "text-[#002C63]", bg: "bg-[#002C63]/10", label: "Aprobar", filter: "aprobar" as FilterType };
      case "rechazado":
        return { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", label: "Corregir", filter: "corregir" as FilterType };
      default:
        return { icon: CheckCircle2, color: "text-[#02B381]", bg: "bg-[#02B381]/10", label: "OK", filter: "todos" as FilterType };
    }
  };

  // Filtrar pendientes según el filtro activo
  const filteredPendientes = pendientes?.filter((item: any) => {
    if (activeFilter === "todos") return true;
    const config = getStatusConfig(item.status);
    return config.filter === activeFilter;
  }) || [];

  // Contar por tipo
  const counts = {
    todos: pendientes?.length || 0,
    foto: pendientes?.filter((i: any) => i.status === "pendiente_foto_despues").length || 0,
    aprobar: pendientes?.filter((i: any) => i.status === "pendiente_aprobacion").length || 0,
    corregir: pendientes?.filter((i: any) => i.status === "rechazado").length || 0,
  };

  // Solo dos acciones: Nuevo y Stats
  const quickActions = [
    { icon: Plus, label: "Nuevo", path: "/nuevo-item", color: "bg-[#02B381]", roles: ['superadmin', 'admin', 'residente', 'jefe_residente'] },
    { icon: BarChart3, label: "Stats", path: "/estadisticas", color: "bg-[#002C63]", roles: ['superadmin', 'admin', 'supervisor'] },
  ];

  const visibleActions = quickActions.filter(a => 
    a.roles.includes('all') || a.roles.includes(user?.role || '')
  );

  const filterButtons: { key: FilterType; label: string; icon: any; color: string }[] = [
    { key: "todos", label: "Todos", icon: Filter, color: "bg-slate-500" },
    { key: "foto", label: "Foto", icon: Camera, color: "bg-[#002C63]" },
    { key: "aprobar", label: "Aprobar", icon: Clock, color: "bg-[#02B381]" },
    { key: "corregir", label: "Corregir", icon: AlertCircle, color: "bg-red-500" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header con iconos de acceso rápido a la derecha */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <UserAvatar 
              name={user?.name} 
              fotoUrl={user?.fotoUrl}
              fotoBase64={(user as any)?.fotoBase64}
              size="lg"
              showName={false}
            />
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-[#002C63]">
                Hola, {user?.name?.split(' ')[0] || 'Usuario'}
              </h1>
              <p className="text-xs text-[#6E6E6E]">
                {filteredPendientes.length} pendientes
              </p>
            </div>
          </div>
          {/* Iconos de acceso rápido - SIEMPRE A LA DERECHA */}
          <div className="flex gap-2 ml-auto">
            {visibleActions.map(action => (
              <Tooltip key={action.path}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className={`h-10 w-10 ${action.color} hover:opacity-90 shadow-md`}
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

        {/* Filtros de estado - solo iconos con contador */}
        <div className="flex gap-1.5 flex-wrap">
          {filterButtons.map(filter => (
            <Tooltip key={filter.key}>
              <TooltipTrigger asChild>
                <Button
                  variant={activeFilter === filter.key ? "default" : "outline"}
                  size="sm"
                  className={`h-9 px-2.5 gap-1 ${
                    activeFilter === filter.key 
                      ? `${filter.color} text-white border-0` 
                      : "bg-white border-slate-200 text-slate-600"
                  }`}
                  onClick={() => setActiveFilter(filter.key)}
                >
                  <filter.icon className="h-4 w-4" />
                  <span className={`text-xs font-medium ${
                    activeFilter === filter.key 
                      ? "text-white" 
                      : "text-slate-500"
                  }`}>
                    {counts[filter.key]}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{filter.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Lista de pendientes - compacta */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#02B381]" />
          </div>
        ) : filteredPendientes.length > 0 ? (
          <div className="space-y-2">
            {filteredPendientes.map((item: any) => {
              const config = getStatusConfig(item.status);
              const Icon = config.icon;
              return (
                <Card 
                  key={item.id}
                  className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99] border-0 shadow-sm"
                  onClick={() => setLocation(`/items/${item.id}`)}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      {/* Miniatura de foto antes */}
                      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                        {item.fotoAntes ? (
                          <img 
                            src={getImageUrl(item.fotoAntes)} 
                            alt="Foto antes" 
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className={`h-full w-full ${config.bg} flex items-center justify-center`}>
                            <Camera className={`h-5 w-5 ${config.color}`} />
                          </div>
                        )}
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
                        <p className="text-sm truncate mt-0.5 text-[#2E2E2E]">{item.titulo}</p>
                        <div className="flex items-center gap-2 text-xs text-[#6E6E6E] mt-1">
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
                      <ArrowRight className="h-5 w-5 text-[#6E6E6E] shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-[#02B381]/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-[#02B381]" />
              </div>
              <p className="font-semibold text-[#002C63]">
                {activeFilter === "todos" ? "¡Todo al día!" : `Sin ítems de "${activeFilter}"`}
              </p>
              <p className="text-sm text-[#6E6E6E]">
                {activeFilter === "todos" ? "Sin pendientes" : "Prueba otro filtro"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
