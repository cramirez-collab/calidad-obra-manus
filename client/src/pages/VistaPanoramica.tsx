import React, { useState, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
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
  QrCode,
  FileDown,
  Calendar,
  Pencil,
  Save,
  Settings2,
  X
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
  DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

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

// Componente para celda vacía (placeholder) - solo visible en modo organización
function CeldaVacia({ 
  posicion, 
  nivel, 
  onInsertarUnidad,
  modoOrganizacion = false
}: { 
  posicion: number; 
  nivel: number; 
  onInsertarUnidad: (posicion: number, nivel: number) => void;
  modoOrganizacion?: boolean;
}) {
  if (!modoOrganizacion) return null;
  
  return (
    <button
      onClick={() => onInsertarUnidad(posicion, nivel)}
      className="
        w-full h-20 rounded-lg
        border-2 border-dashed border-primary/50
        flex flex-col items-center justify-center
        transition-all duration-200
        hover:border-primary hover:bg-primary/10
        cursor-pointer
        group
        bg-primary/5
      "
    >
      <Plus className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
      <span className="text-xs text-primary/60 group-hover:text-primary mt-1">Espacio</span>
    </button>
  );
}

// Componente sortable para unidad con mejor feedback visual
function SortableUnidadCard({ 
  celda, 
  onTap, 
  onDoubleTap,
  onEditFechas,
  selectedId,
  isMobile,
  isOverlay = false,
  modoOrganizacion = false
}: { 
  celda: CeldaStacking; 
  onTap: (unidad: UnidadPanoramica) => void;
  onDoubleTap: (unidadId: number) => void;
  onEditFechas: (unidad: UnidadPanoramica) => void;
  selectedId: number | null;
  isMobile: boolean;
  isOverlay?: boolean;
  modoOrganizacion?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ 
    id: celda.id,
    transition: {
      duration: 250, // Animación más suave
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 250ms cubic-bezier(0.25, 1, 0.5, 1)',
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1000 : 1,
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
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`
        relative group
        transition-all duration-200 ease-out
        ${isOver && !isDragging ? 'ring-2 ring-primary ring-offset-2 scale-105' : ''}
      `}
    >
      {/* Handle para arrastrar - solo visible en modo organización */}
      {modoOrganizacion && (
        <div
          {...attributes}
          {...listeners}
          className={`
            absolute -left-1 top-1/2 -translate-y-1/2 z-10 
            transition-all duration-200 
            cursor-grab active:cursor-grabbing 
            bg-primary/90 rounded p-1 shadow-md
            ${isDragging ? 'opacity-0' : 'opacity-80 group-hover:opacity-100 hover:bg-primary hover:shadow-lg'}
          `}
        >
          <GripVertical className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Botón de editar fechas */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEditFechas(unidad);
        }}
        className="absolute -right-1 top-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded p-0.5 shadow hover:bg-white"
      >
        <Calendar className="h-3 w-3 text-gray-500" />
      </button>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClick}
              className={`
                ${bgColor} ${textColor}
                w-full h-20 rounded-lg p-2
                flex flex-col items-center justify-center
                transition-all duration-250
                shadow-md hover:shadow-lg
                cursor-pointer
                ${isDragging ? 'scale-105 shadow-xl ring-2 ring-primary ring-offset-2' : ''}
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
              {/* Fechas visibles */}
              {(unidad.fechaInicio || unidad.fechaFin) && (
                <div className="text-[10px] opacity-80 mt-0.5 flex gap-1">
                  {unidad.fechaInicio && (
                    <span>i:{format(new Date(unidad.fechaInicio), 'dd-MM-yy')}</span>
                  )}
                  {unidad.fechaFin && (
                    <span>f:{format(new Date(unidad.fechaFin), 'dd-MM-yy')}</span>
                  )}
                </div>
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
                {(unidad.fechaInicio || unidad.fechaFin) && (
                  <div className="text-xs border-t pt-1 mt-1">
                    {unidad.fechaInicio && <p>📅 Inicio: {format(new Date(unidad.fechaInicio), "dd/MM/yy")}</p>}
                    {unidad.fechaFin && <p>📅 Fin: {format(new Date(unidad.fechaFin), "dd/MM/yy")}</p>}
                  </div>
                )}
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
  onVerItems,
  onEditFechas
}: { 
  unidad: UnidadPanoramica | null; 
  open: boolean; 
  onClose: () => void;
  onVerItems: () => void;
  onEditFechas: () => void;
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
              onClick={onEditFechas}
              className="flex-1"
            >
              <Calendar className="h-4 w-4 mr-1" />
              Fechas
            </Button>
          </div>
          <Button 
            variant="outline" 
            onClick={() => window.open(`/generar-qr?unidadId=${unidad.id}`, '_blank')}
            className="w-full"
          >
            <QrCode className="h-4 w-4 mr-1" />
            Generar QR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Modal para crear nueva unidad
function ModalNuevaUnidad({
  open,
  onClose,
  nivel,
  proyectoId,
  onSuccess
}: {
  open: boolean;
  onClose: () => void;
  nivel: number;
  proyectoId: number;
  onSuccess: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const createMutation = trpc.unidades.create.useMutation({
    onSuccess: () => {
      toast.success("Unidad creada exitosamente");
      onSuccess();
      onClose();
      setNombre("");
      setCodigo("");
      setFechaInicio("");
      setFechaFin("");
    },
    onError: (error) => {
      toast.error("Error al crear unidad: " + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    createMutation.mutate({
      proyectoId,
      nombre: nombre.trim(),
      codigo: codigo.trim() || undefined,
      nivel,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
      fechaFin: fechaFin ? new Date(fechaFin) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Nueva Unidad - Nivel {nivel}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Departamento 101"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="codigo">Código</Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej: 101"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fechaInicio">Fecha Inicio</Label>
              <Input
                id="fechaInicio"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaFin">Fecha Fin</Label>
              <Input
                id="fechaFin"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creando..." : "Crear Unidad"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Modal para editar fechas
function ModalEditarFechas({
  unidad,
  open,
  onClose,
  onSuccess
}: {
  unidad: UnidadPanoramica | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  React.useEffect(() => {
    if (unidad) {
      setFechaInicio(unidad.fechaInicio ? format(new Date(unidad.fechaInicio), "yyyy-MM-dd") : "");
      setFechaFin(unidad.fechaFin ? format(new Date(unidad.fechaFin), "yyyy-MM-dd") : "");
    }
  }, [unidad]);

  const updateMutation = trpc.unidades.update.useMutation({
    onSuccess: () => {
      toast.success("Fechas actualizadas");
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error("Error al actualizar: " + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unidad) return;

    updateMutation.mutate({
      id: unidad.id,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      fechaFin: fechaFin ? new Date(fechaFin) : null,
    });
  };

  if (!unidad) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Editar Fechas - {unidad.nombre}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fechaInicioEdit">Fecha de Inicio</Label>
            <Input
              id="fechaInicioEdit"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaFinEdit">Fecha de Fin</Label>
            <Input
              id="fechaFinEdit"
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {updateMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
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
  const [showNuevaUnidadModal, setShowNuevaUnidadModal] = useState(false);
  const [showEditFechasModal, setShowEditFechasModal] = useState(false);
  const [nivelParaNueva, setNivelParaNueva] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{id: number, orden: number, nivel?: number}[]>([]);
  const [localUnidades, setLocalUnidades] = useState<UnidadPanoramica[] | null>(null);
  const [modoOrganizacion, setModoOrganizacion] = useState(false);
  
  // Detectar si es móvil
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: serverUnidades, isLoading, refetch } = trpc.unidades.panoramica.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  // Sincronizar unidades del servidor con el estado local
  React.useEffect(() => {
    if (serverUnidades && !hasUnsavedChanges) {
      setLocalUnidades(serverUnidades as UnidadPanoramica[]);
    }
  }, [serverUnidades, hasUnsavedChanges]);

  // Usar unidades locales si existen, sino las del servidor
  const unidades = localUnidades || serverUnidades;

  const updateOrdenMutation = trpc.unidades.updateOrden.useMutation({
    onSuccess: () => {
      setHasUnsavedChanges(false);
      setPendingChanges([]);
      setLocalUnidades(null); // Resetear para que use datos del servidor
      refetch();
      toast.success("Orden guardado correctamente");
    },
    onError: (error) => {
      toast.error("Error al guardar: " + error.message);
    }
  });

  // Función para guardar todos los cambios pendientes
  const handleGuardarOrden = () => {
    if (pendingChanges.length === 0) {
      toast.info("No hay cambios pendientes");
      return;
    }
    updateOrdenMutation.mutate({ unidades: pendingChanges });
  };

  // Sensores para drag and drop - configuración simplificada para mejor funcionamiento
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Distancia mínima para iniciar drag
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

  // Obtener el nivel máximo para agregar nuevo nivel
  const nivelMaximo = useMemo(() => {
    if (celdasPorNivel.size === 0) return 0;
    return Math.max(...Array.from(celdasPorNivel.keys()));
  }, [celdasPorNivel]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;
    if (!localUnidades) return;

    // Extraer IDs de las unidades
    const activeIdNum = parseInt((active.id as string).replace('unidad-', ''));
    const overIdNum = parseInt((over.id as string).replace('unidad-', ''));

    // Encontrar las unidades involucradas
    const activeUnidadIndex = localUnidades.findIndex(u => u.id === activeIdNum);
    const overUnidadIndex = localUnidades.findIndex(u => u.id === overIdNum);

    if (activeUnidadIndex === -1 || overUnidadIndex === -1) return;

    const activeUnidad = localUnidades[activeUnidadIndex];
    const overUnidad = localUnidades[overUnidadIndex];

    // Crear copia de las unidades para modificar
    const newUnidades = [...localUnidades];

    // Reordenar dentro del mismo nivel
    if (activeUnidad.nivel === overUnidad.nivel) {
      // Obtener unidades del mismo nivel
      const nivelUnidades = newUnidades.filter(u => u.nivel === activeUnidad.nivel);
      const oldIndex = nivelUnidades.findIndex(u => u.id === activeIdNum);
      const newIndex = nivelUnidades.findIndex(u => u.id === overIdNum);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Reordenar usando arrayMove
        const reordered = arrayMove(nivelUnidades, oldIndex, newIndex);
        
        // Actualizar el orden de cada unidad
        const updates: {id: number, orden: number}[] = [];
        reordered.forEach((unidad, index) => {
          const globalIndex = newUnidades.findIndex(u => u.id === unidad.id);
          if (globalIndex !== -1) {
            newUnidades[globalIndex] = { ...newUnidades[globalIndex], orden: index };
            updates.push({ id: unidad.id, orden: index });
          }
        });

        // Actualizar estado local inmediatamente
        setLocalUnidades(newUnidades);
        
        // Acumular cambios pendientes
        setPendingChanges(prev => {
          const existingIds = new Set(updates.map(u => u.id));
          const filtered = prev.filter(p => !existingIds.has(p.id));
          return [...filtered, ...updates];
        });
        setHasUnsavedChanges(true);
        toast.info("Cambios pendientes - Presiona Guardar Orden para confirmar");
      }
    } else {
      // Mover unidad a otro nivel
      const targetNivel = overUnidad.nivel;
      const targetNivelUnidades = newUnidades.filter(u => u.nivel === targetNivel);
      const targetIndex = targetNivelUnidades.findIndex(u => u.id === overIdNum);
      
      // Actualizar la unidad movida
      const globalIndex = newUnidades.findIndex(u => u.id === activeIdNum);
      if (globalIndex !== -1) {
        newUnidades[globalIndex] = {
          ...newUnidades[globalIndex],
          nivel: targetNivel,
          orden: targetIndex >= 0 ? targetIndex : targetNivelUnidades.length,
        };

        // Actualizar estado local inmediatamente
        setLocalUnidades(newUnidades);
        
        // Acumular cambio pendiente
        const update = {
          id: activeIdNum,
          orden: targetIndex >= 0 ? targetIndex : targetNivelUnidades.length,
          nivel: targetNivel,
        };
        
        setPendingChanges(prev => {
          const filtered = prev.filter(p => p.id !== update.id);
          return [...filtered, update];
        });
        setHasUnsavedChanges(true);
        toast.info("Cambios pendientes - Presiona Guardar Orden para confirmar");
      }
    }
  }, [localUnidades]);

  const handleTap = (unidad: UnidadPanoramica) => {
    setSelectedUnidad(unidad);
    setShowStatsModal(true);
  };

  const handleDoubleTap = (unidadId: number) => {
    setLocation(`/items?unidadId=${unidadId}`);
  };

  const handleAgregarUnidad = (nivel: number) => {
    setNivelParaNueva(nivel);
    setShowNuevaUnidadModal(true);
  };

  const handleEditFechas = (unidad: UnidadPanoramica) => {
    setSelectedUnidad(unidad);
    setShowEditFechasModal(true);
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
              Arrastra unidades entre niveles • {isMobile ? "Toca para ver stats" : "Clic para ver ítems"}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Botón Organizar - Solo para Admin y Superadmin */}
            {(user?.role === 'admin' || user?.role === 'superadmin') && !modoOrganizacion && (
              <Button 
                onClick={() => setModoOrganizacion(true)}
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Organizar
              </Button>
            )}
            {/* Botones de modo organización */}
            {modoOrganizacion && (
              <>
                <Button 
                  onClick={handleGuardarOrden}
                  disabled={updateOrdenMutation.isPending || !hasUnsavedChanges}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateOrdenMutation.isPending ? "Guardando..." : "Guardar Orden"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setModoOrganizacion(false);
                    setHasUnsavedChanges(false);
                    setPendingChanges([]);
                    setLocalUnidades(null);
                    refetch();
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </>
            )}
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
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Cuadrícula de Unidades por Nivel
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleAgregarUnidad(nivelMaximo + 1)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nuevo Nivel
              </Button>
            </div>
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
                  Crea unidades directamente o importa desde Excel.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => handleAgregarUnidad(1)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Unidad
                  </Button>
                  <Button variant="outline" onClick={() => setLocation("/unidades/importar")}>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Excel
                  </Button>
                </div>
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
                          onClick={() => handleAgregarUnidad(nivel)}
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
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                          {celdas.map((celda) => (
                            <SortableUnidadCard
                              key={celda.id}
                              celda={celda}
                              onTap={handleTap}
                              onDoubleTap={handleDoubleTap}
                              onEditFechas={handleEditFechas}
                              selectedId={selectedUnidad?.id || null}
                              isMobile={isMobile}
                              modoOrganizacion={modoOrganizacion}
                            />
                          ))}
                          {/* Celda vacía al final para insertar - solo en modo organización */}
                          <CeldaVacia 
                            posicion={celdas.length} 
                            nivel={nivel}
                            onInsertarUnidad={() => handleAgregarUnidad(nivel)}
                            modoOrganizacion={modoOrganizacion}
                          />
                        </div>
                      </SortableContext>
                    </div>
                  ))}
                </div>

                {/* Overlay durante el drag - elemento flotante que sigue al cursor */}
                <DragOverlay dropAnimation={{
                  duration: 200,
                  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                }}>
                  {activeUnidad && (
                    <div className={`
                      ${activeUnidad.estado === 'completado' ? 'bg-emerald-500' : 
                        activeUnidad.estado === 'rechazado' ? 'bg-red-500' : 
                        activeUnidad.estado === 'pendiente' ? 'bg-amber-500' : 'bg-gray-300'}
                      ${activeUnidad.estado === 'sin_items' ? 'text-gray-700' : 'text-white'}
                      w-24 h-20 rounded-xl p-2
                      flex flex-col items-center justify-center
                      shadow-2xl
                      cursor-grabbing
                      transform scale-110 rotate-2
                      ring-4 ring-primary/50 ring-offset-2
                      animate-pulse
                    `}>
                      <GripVertical className="absolute -left-1 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
                      <span className="font-bold text-sm truncate w-full text-center">
                        {activeUnidad.codigo || activeUnidad.nombre}
                      </span>
                      <span className="text-xs mt-1 font-medium">{activeUnidad.porcentaje}%</span>
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
        onEditFechas={() => {
          setShowStatsModal(false);
          setShowEditFechasModal(true);
        }}
      />

      {/* Modal para crear nueva unidad */}
      <ModalNuevaUnidad
        open={showNuevaUnidadModal}
        onClose={() => setShowNuevaUnidadModal(false)}
        nivel={nivelParaNueva}
        proyectoId={selectedProjectId}
        onSuccess={() => refetch()}
      />

      {/* Modal para editar fechas */}
      <ModalEditarFechas
        unidad={selectedUnidad}
        open={showEditFechasModal}
        onClose={() => {
          setShowEditFechasModal(false);
          setSelectedUnidad(null);
        }}
        onSuccess={() => refetch()}
      />
    </DashboardLayout>
  );
}
