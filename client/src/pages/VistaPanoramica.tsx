import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useLocation } from "wouter";
import { 
  Building2, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Upload,
  Eye,
  Layers
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Colores de Objetiva
const COLORS = {
  completado: "#02B381", // Verde Objetiva / Azul claro como pidió el usuario
  rechazado: "#EF4444", // Rojo
  pendiente: "#F59E0B", // Amarillo/Verde
  sin_items: "#9CA3AF", // Gris
};

type UnidadPanoramica = {
  id: number;
  nombre: string;
  codigo: string | null;
  nivel: number;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  estado: 'completado' | 'rechazado' | 'pendiente' | 'sin_items';
  items: {
    total: number;
    aprobados: number;
    rechazados: number;
    pendientes: number;
    okSupervisor: number;
  };
  porcentaje: number;
};

function UnidadCard({ unidad, onClick }: { unidad: UnidadPanoramica; onClick: () => void }) {
  const bgColor = {
    completado: "bg-emerald-500 hover:bg-emerald-600",
    rechazado: "bg-red-500 hover:bg-red-600",
    pendiente: "bg-amber-500 hover:bg-amber-600",
    sin_items: "bg-gray-300 hover:bg-gray-400",
  }[unidad.estado];

  const textColor = unidad.estado === 'sin_items' ? 'text-gray-700' : 'text-white';

  const estadoLabel = {
    completado: "100% Completado",
    rechazado: "Con Rechazados",
    pendiente: "Con Pendientes",
    sin_items: "Sin Ítems",
  }[unidad.estado];

  const estadoIcon = {
    completado: <CheckCircle2 className="h-3 w-3" />,
    rechazado: <AlertCircle className="h-3 w-3" />,
    pendiente: <Clock className="h-3 w-3" />,
    sin_items: <Eye className="h-3 w-3" />,
  }[unidad.estado];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={`
              ${bgColor} ${textColor}
              w-full h-20 rounded-lg p-2
              flex flex-col items-center justify-center
              transition-all duration-200
              shadow-md hover:shadow-lg
              cursor-pointer
              border-2 border-transparent hover:border-white/30
            `}
          >
            <span className="font-bold text-sm truncate w-full text-center">
              {unidad.codigo || unidad.nombre}
            </span>
            <div className="flex items-center gap-1 mt-1">
              {estadoIcon}
              <span className="text-xs">{unidad.porcentaje}%</span>
            </div>
            {unidad.items.total > 0 && (
              <span className="text-xs opacity-80 mt-0.5">
                {unidad.items.total} ítems
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-bold">{unidad.nombre}</p>
            {unidad.codigo && <p className="text-xs text-muted-foreground">Código: {unidad.codigo}</p>}
            <p className="text-sm">{estadoLabel}</p>
            <div className="text-xs space-y-0.5 border-t pt-1 mt-1">
              <p>Total: {unidad.items.total} ítems</p>
              <p className="text-emerald-600">✓ Aprobados: {unidad.items.aprobados}</p>
              <p className="text-red-600">✗ Rechazados: {unidad.items.rechazados}</p>
              <p className="text-amber-600">◷ Pendientes: {unidad.items.pendientes}</p>
              <p className="text-blue-600">★ OK Supervisor: {unidad.items.okSupervisor}</p>
            </div>
            {(unidad.fechaInicio || unidad.fechaFin) && (
              <div className="text-xs border-t pt-1 mt-1">
                {unidad.fechaInicio && (
                  <p>Inicio: {format(new Date(unidad.fechaInicio), "dd/MM/yyyy", { locale: es })}</p>
                )}
                {unidad.fechaFin && (
                  <p>Fin: {format(new Date(unidad.fechaFin), "dd/MM/yyyy", { locale: es })}</p>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function LeyendaEstados() {
  return (
    <div className="flex flex-wrap gap-4 items-center justify-center p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-emerald-500" />
        <span className="text-sm">100% Completado</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-amber-500" />
        <span className="text-sm">Con Pendientes</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-red-500" />
        <span className="text-sm">Con Rechazados</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-gray-300" />
        <span className="text-sm">Sin Ítems</span>
      </div>
    </div>
  );
}

export default function VistaPanoramica() {
  const { selectedProjectId } = useProject();
  const [, setLocation] = useLocation();

  const { data: unidades, isLoading } = trpc.unidades.panoramica.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  // Agrupar unidades por nivel
  const unidadesPorNivel = useMemo((): Map<number, UnidadPanoramica[]> => {
    if (!unidades) return new Map<number, UnidadPanoramica[]>();
    
    const grouped = new Map<number, UnidadPanoramica[]>();
    (unidades as UnidadPanoramica[]).forEach((unidad: UnidadPanoramica) => {
      const nivel = unidad.nivel || 1;
      if (!grouped.has(nivel)) {
        grouped.set(nivel, []);
      }
      grouped.get(nivel)!.push(unidad);
    });
    
    // Ordenar por nivel descendente (niveles más altos arriba)
    return new Map(Array.from(grouped.entries()).sort((a, b) => b[0] - a[0]));
  }, [unidades]);

  // Estadísticas generales
  const estadisticas = useMemo(() => {
    if (!unidades) return { total: 0, completadas: 0, pendientes: 0, rechazadas: 0, sinItems: 0 };
    
    return {
      total: unidades.length,
      completadas: unidades.filter((u: UnidadPanoramica) => u.estado === 'completado').length,
      pendientes: unidades.filter((u: UnidadPanoramica) => u.estado === 'pendiente').length,
      rechazadas: unidades.filter((u: UnidadPanoramica) => u.estado === 'rechazado').length,
      sinItems: unidades.filter((u: UnidadPanoramica) => u.estado === 'sin_items').length,
    };
  }, [unidades]);

  const handleUnidadClick = (unidadId: number) => {
    // Navegar a la lista de ítems filtrada por esta unidad
    setLocation(`/items?unidadId=${unidadId}`);
  };

  if (!selectedProjectId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Selecciona un Proyecto</h2>
          <p className="text-muted-foreground">
            Usa el selector de proyecto en el menú lateral para ver la vista panorámica.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              Vista Panorámica
            </h1>
            <p className="text-muted-foreground">
              Vista general de todas las unidades del proyecto
            </p>
          </div>
          <Button variant="outline" onClick={() => setLocation("/unidades/importar")}>
            <Upload className="h-4 w-4 mr-2" />
            Importar Excel
          </Button>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{estadisticas.total}</p>
              <p className="text-xs text-muted-foreground">Total Unidades</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{estadisticas.completadas}</p>
              <p className="text-xs text-muted-foreground">Completadas</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{estadisticas.pendientes}</p>
              <p className="text-xs text-muted-foreground">Con Pendientes</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{estadisticas.rechazadas}</p>
              <p className="text-xs text-muted-foreground">Con Rechazados</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-50 to-gray-100">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-600">{estadisticas.sinItems}</p>
              <p className="text-xs text-muted-foreground">Sin Ítems</p>
            </CardContent>
          </Card>
        </div>

        {/* Leyenda */}
        <LeyendaEstados />

        {/* Cuadrícula por niveles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Cuadrícula de Unidades por Nivel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-6 w-24" />
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                      {[1, 2, 3, 4, 5, 6].map((j) => (
                        <Skeleton key={j} className="h-20 w-full" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : unidadesPorNivel.size === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay unidades</h3>
                <p className="text-muted-foreground mb-4">
                  Importa unidades desde un archivo Excel o créalas manualmente.
                </p>
                <Button onClick={() => setLocation("/unidades/importar")}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Excel
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(unidadesPorNivel.entries()).map(([nivel, unidadesNivel]) => (
                  <div key={nivel} className="space-y-2">
                    <div className="flex items-center gap-2 sticky top-0 bg-background py-1">
                      <Badge variant="outline" className="font-bold">
                        Nivel {nivel}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({unidadesNivel.length} unidades)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                      {unidadesNivel.map((unidad) => (
                        <UnidadCard
                          key={unidad.id}
                          unidad={unidad}
                          onClick={() => handleUnidadClick(unidad.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
