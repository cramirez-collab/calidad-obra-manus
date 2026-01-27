import React, { useState, useMemo, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Upload,
  Eye,
  Layers,
  GripVertical,
  Plus,
  X,
  QrCode,
  FileDown
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type UnidadPanoramica = {
  id: number;
  nombre: string;
  codigo: string | null;
  nivel: number;
  orden: number;
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

type CeldaStacking = {
  id: string;
  unidad: UnidadPanoramica | null;
  posicion: number;
  nivel: number;
};

// Componente para celda vacía (placeholder)
function CeldaVacia({ 
  posicion, 
  nivel, 
  onInsertarUnidad 
}: { 
  posicion: number; 
  nivel: number; 
  onInsertarUnidad: (posicion: number, nivel: number) => void;
}) {
  return (
    <button
      onClick={() => onInsertarUnidad(posicion, nivel)}
      className="
        w-full h-20 rounded-lg
        border-2 border-dashed border-gray-300
        flex flex-col items-center justify-center
        transition-all duration-200
        hover:border-primary hover:bg-primary/5
        cursor-pointer
        group
      "
    >
      <Plus className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
      <span className="text-xs text-gray-400 group-hover:text-primary mt-1">Insertar</span>
    </button>
  );
}

// Componente sortable para unidad
function SortableUnidadCard({ 
  celda, 
  onTap, 
  onDoubleTap,
  selectedId,
  isMobile,
  canEdit
}: { 
  celda: CeldaStacking; 
  onTap: (unidad: UnidadPanoramica) => void;
  onDoubleTap: (unidadId: number) => void;
  selectedId: number | null;
  isMobile: boolean;
  canEdit: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: celda.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!celda.unidad) return null;

  const unidad = celda.unidad;
  const isSelected = selectedId === unidad.id;

  const bgColor = {
    completado: "bg-emerald-500 hover:bg-emerald-600",
    rechazado: "bg-red-500 hover:bg-red-600",
    pendiente: "bg-amber-500 hover:bg-amber-600",
    sin_items: "bg-gray-300 hover:bg-gray-400",
  }[unidad.estado];

  const textColor = unidad.estado === 'sin_items' ? 'text-gray-700' : 'text-white';

  const estadoIcon = {
    completado: <CheckCircle2 className="h-3 w-3" />,
    rechazado: <AlertCircle className="h-3 w-3" />,
    pendiente: <Clock className="h-3 w-3" />,
    sin_items: <Eye className="h-3 w-3" />,
  }[unidad.estado];

  const handleClick = () => {
    if (isMobile) {
      if (isSelected) {
        // Segundo tap - ir a ítems
        onDoubleTap(unidad.id);
      } else {
        // Primer tap - mostrar stats
        onTap(unidad);
      }
    } else {
      // Desktop - ir directo a ítems
      onDoubleTap(unidad.id);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Handle para arrastrar - solo visible para admin/superadmin */}
      {canEdit && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-white/90 rounded p-0.5 shadow"
        >
          <GripVertical className="h-4 w-4 text-gray-500" />
        </div>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClick}
              className={`
                ${bgColor} ${textColor}
                w-full h-20 rounded-lg p-2
                flex flex-col items-center justify-center
                transition-all duration-200
                shadow-md hover:shadow-lg
                cursor-pointer
                ${isSelected ? 'ring-4 ring-primary ring-offset-2' : 'border-2 border-transparent hover:border-white/30'}
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
          {!isMobile && (
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-bold">{unidad.nombre}</p>
                {unidad.codigo && <p className="text-xs text-muted-foreground">Código: {unidad.codigo}</p>}
                <div className="text-xs space-y-0.5 border-t pt-1 mt-1">
                  <p>Total: {unidad.items.total} ítems</p>
                  <p className="text-emerald-600">✓ Aprobados: {unidad.items.aprobados}</p>
                  <p className="text-red-600">✗ Rechazados: {unidad.items.rechazados}</p>
                  <p className="text-amber-600">◷ Pendientes: {unidad.items.pendientes}</p>
                </div>
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// Modal de estadísticas para móvil
function ModalEstadisticas({ 
  unidad, 
  open, 
  onClose, 
  onVerItems 
}: { 
  unidad: UnidadPanoramica | null; 
  open: boolean; 
  onClose: () => void;
  onVerItems: () => void;
}) {
  if (!unidad) return null;

  const estadoLabel = {
    completado: "100% Completado",
    rechazado: "Con Rechazados",
    pendiente: "Con Pendientes",
    sin_items: "Sin Ítems",
  }[unidad.estado];

  const estadoColor = {
    completado: "text-emerald-600",
    rechazado: "text-red-600",
    pendiente: "text-amber-600",
    sin_items: "text-gray-600",
  }[unidad.estado];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {unidad.nombre}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {unidad.codigo && (
            <p className="text-sm text-muted-foreground">Código: {unidad.codigo}</p>
          )}
          
          <div className={`text-lg font-semibold ${estadoColor}`}>
            {estadoLabel} - {unidad.porcentaje}%
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{unidad.items.total}</p>
              <p className="text-xs text-muted-foreground">Total Ítems</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{unidad.items.aprobados}</p>
              <p className="text-xs text-muted-foreground">Aprobados</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{unidad.items.rechazados}</p>
              <p className="text-xs text-muted-foreground">Rechazados</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{unidad.items.pendientes}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </div>
          </div>

          {(unidad.fechaInicio || unidad.fechaFin) && (
            <div className="text-sm border-t pt-3 space-y-1">
              {unidad.fechaInicio && (
                <p>📅 Inicio: {format(new Date(unidad.fechaInicio), "dd/MM/yyyy", { locale: es })}</p>
              )}
              {unidad.fechaFin && (
                <p>📅 Fin: {format(new Date(unidad.fechaFin), "dd/MM/yyyy", { locale: es })}</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={onVerItems} className="flex-1">
              Ver Ítems
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.open(`/generar-qr?unidadId=${unidad.id}`, '_blank')}
              className="flex-1"
            >
              <QrCode className="h-4 w-4 mr-1" />
              QR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedUnidad, setSelectedUnidad] = useState<UnidadPanoramica | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Solo admin y superadmin pueden editar el stacking
  const canEdit = user?.role === 'admin' || user?.role === 'superadmin';

  // Detectar si es móvil
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: unidades, isLoading } = trpc.unidades.panoramica.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  const updateOrdenMutation = trpc.unidades.updateOrden.useMutation();

  // Sensores para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Crear celdas del stacking (incluyendo espacios vacíos)
  const celdasPorNivel = useMemo((): Map<number, CeldaStacking[]> => {
    if (!unidades) return new Map<number, CeldaStacking[]>();
    
    const grouped = new Map<number, CeldaStacking[]>();
    
    (unidades as UnidadPanoramica[]).forEach((unidad: UnidadPanoramica) => {
      const nivel = unidad.nivel || 1;
      if (!grouped.has(nivel)) {
        grouped.set(nivel, []);
      }
      grouped.get(nivel)!.push({
        id: `unidad-${unidad.id}`,
        unidad,
        posicion: unidad.orden || grouped.get(nivel)!.length,
        nivel,
      });
    });
    
    // Ordenar por posición dentro de cada nivel
    grouped.forEach((celdas, nivel) => {
      celdas.sort((a, b) => a.posicion - b.posicion);
      grouped.set(nivel, celdas);
    });
    
    // Ordenar niveles ascendente (piso menor primero, para revisar de abajo hacia arriba)
    return new Map(Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]));
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    // Encontrar las celdas involucradas
    let sourceNivel: number | null = null;
    let targetNivel: number | null = null;
    let sourceCeldas: CeldaStacking[] = [];
    let targetCeldas: CeldaStacking[] = [];

    celdasPorNivel.forEach((celdas, nivel) => {
      const sourceIndex = celdas.findIndex(c => c.id === active.id);
      const targetIndex = celdas.findIndex(c => c.id === over.id);
      
      if (sourceIndex !== -1) {
        sourceNivel = nivel;
        sourceCeldas = celdas;
      }
      if (targetIndex !== -1) {
        targetNivel = nivel;
        targetCeldas = celdas;
      }
    });

    if (sourceNivel === null || targetNivel === null) return;

    // Permitir reordenar dentro del mismo nivel
    if (sourceNivel === targetNivel) {
      const oldIndex = sourceCeldas.findIndex(c => c.id === active.id);
      const newIndex = sourceCeldas.findIndex(c => c.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sourceCeldas, oldIndex, newIndex);
        
        // Actualizar orden en el backend
        const updates = newOrder.map((celda, index) => ({
          id: celda.unidad!.id,
          orden: index,
        }));
        
        updateOrdenMutation.mutate({ unidades: updates });
      }
    } else {
      // Mover unidad a otro nivel
      const sourceCelda = sourceCeldas.find(c => c.id === active.id);
      if (sourceCelda?.unidad) {
        // Actualizar nivel y orden de la unidad
        const targetIndex = targetCeldas.findIndex(c => c.id === over.id);
        updateOrdenMutation.mutate({ 
          unidades: [{
            id: sourceCelda.unidad.id,
            orden: targetIndex >= 0 ? targetIndex : targetCeldas.length,
            nivel: targetNivel,
          }]
        });
      }
    }
  }, [celdasPorNivel, updateOrdenMutation]);

  const handleTap = (unidad: UnidadPanoramica) => {
    setSelectedUnidad(unidad);
    setShowStatsModal(true);
  };

  const handleDoubleTap = (unidadId: number) => {
    setLocation(`/items?unidadId=${unidadId}`);
  };

  const handleInsertarUnidad = (posicion: number, nivel: number) => {
    // Navegar a crear nueva unidad con posición y nivel predefinidos
    setLocation(`/unidades?insertar=true&posicion=${posicion}&nivel=${nivel}`);
  };

  const handleVerItems = () => {
    if (selectedUnidad) {
      setShowStatsModal(false);
      setLocation(`/items?unidadId=${selectedUnidad.id}`);
    }
  };

  // Encontrar la unidad activa para el overlay
  const activeUnidad = useMemo(() => {
    if (!activeId) return null;
    const allCeldas = Array.from(celdasPorNivel.values());
    for (const celdas of allCeldas) {
      const celda = celdas.find((c: CeldaStacking) => c.id === activeId);
      if (celda?.unidad) return celda.unidad;
    }
    return null;
  }, [activeId, celdasPorNivel]);

  if (!selectedProjectId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Selecciona un Proyecto</h2>
          <p className="text-muted-foreground">
            Usa el selector de proyecto en el menú lateral para ver el stacking.
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
              Stacking
            </h1>
            <p className="text-muted-foreground">
              Arrastra y suelta las unidades para reorganizar • {isMobile ? "Toca para ver stats, toca de nuevo para ver ítems" : "Clic para ver ítems"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLocation("/stacking/pdf")}>
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={() => setLocation("/unidades/importar")}>
              <Upload className="h-4 w-4 mr-2" />
              Importar Excel
            </Button>
          </div>
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

        {/* Cuadrícula por niveles con drag and drop */}
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
            ) : celdasPorNivel.size === 0 ? (
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="space-y-6">
                  {Array.from(celdasPorNivel.entries()).map(([nivel, celdas]) => (
                    <div key={nivel} className="space-y-2">
                      <div className="flex items-center gap-2 sticky top-0 bg-background py-1 z-10">
                        <Badge variant="outline" className="font-bold">
                          Nivel {nivel}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          ({celdas.length} unidades)
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleInsertarUnidad(celdas.length, nivel)}
                          className="ml-auto"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar
                        </Button>
                      </div>
                      <SortableContext
                        items={celdas.map(c => c.id)}
                        strategy={rectSortingStrategy}
                      >
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                          {celdas.map((celda) => (
                            <SortableUnidadCard
                              key={celda.id}
                              celda={celda}
                              onTap={handleTap}
                              onDoubleTap={handleDoubleTap}
                              selectedId={selectedUnidad?.id || null}
                              isMobile={isMobile}
                              canEdit={canEdit}
                            />
                          ))}
                          {/* Celda vacía al final para insertar */}
                          <CeldaVacia 
                            posicion={celdas.length} 
                            nivel={nivel}
                            onInsertarUnidad={handleInsertarUnidad}
                          />
                        </div>
                      </SortableContext>
                    </div>
                  ))}
                </div>

                {/* Overlay durante el drag */}
                <DragOverlay>
                  {activeUnidad && (
                    <div className={`
                      ${activeUnidad.estado === 'completado' ? 'bg-emerald-500' : 
                        activeUnidad.estado === 'rechazado' ? 'bg-red-500' : 
                        activeUnidad.estado === 'pendiente' ? 'bg-amber-500' : 'bg-gray-300'}
                      ${activeUnidad.estado === 'sin_items' ? 'text-gray-700' : 'text-white'}
                      w-24 h-20 rounded-lg p-2
                      flex flex-col items-center justify-center
                      shadow-xl
                      cursor-grabbing
                      opacity-90
                    `}>
                      <span className="font-bold text-sm truncate w-full text-center">
                        {activeUnidad.codigo || activeUnidad.nombre}
                      </span>
                      <span className="text-xs mt-1">{activeUnidad.porcentaje}%</span>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de estadísticas para móvil */}
      <ModalEstadisticas
        unidad={selectedUnidad}
        open={showStatsModal}
        onClose={() => {
          setShowStatsModal(false);
          setSelectedUnidad(null);
        }}
        onVerItems={handleVerItems}
      />
    </DashboardLayout>
  );
}
