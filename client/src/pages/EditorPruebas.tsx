import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Loader2,
  ClipboardCheck,
  Zap,
  Search,
  Eye,
  EyeOff,
  GripVertical,
} from "lucide-react";

// @dnd-kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SISTEMAS_DEFAULT = [
  "Eléctrico",
  "Hidráulico",
  "Sanitario",
  "Gas",
  "Acabados",
  "Impermeabilización",
  "Herrería",
  "HVAC",
  "Especiales",
];

// ========== Sortable Item Component ==========
function SortablePruebaItem({
  prueba,
  onEdit,
  onDelete,
  onReactivar,
  isDeleting,
  isReactivating,
}: {
  prueba: any;
  onEdit: (p: any) => void;
  onDelete: (id: number) => void;
  onReactivar: (id: number) => void;
  isDeleting: boolean;
  isReactivating: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prueba.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : "auto" as any,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2.5 border-b border-gray-50 last:border-0 group ${
        !prueba.activo ? "opacity-50 bg-gray-50" : "bg-white"
      } ${isDragging ? "shadow-lg rounded-lg border border-[#02B381]/30" : ""}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 rounded hover:bg-gray-100 transition-colors"
        tabIndex={-1}
      >
        <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${
              !prueba.activo
                ? "line-through text-muted-foreground"
                : "text-foreground"
            }`}
          >
            {prueba.nombre}
          </span>
          {!prueba.activo && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-red-500 border-red-200"
            >
              Inactiva
            </Badge>
          )}
          {prueba.requiereEvidencia && prueba.activo && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-blue-500 border-blue-200"
            >
              Foto
            </Badge>
          )}
        </div>
        {prueba.descripcion && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {prueba.descripcion}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-muted-foreground font-mono mr-1 hidden sm:inline">
          #{prueba.orden}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(prueba)}
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
        {prueba.activo ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onDelete(prueba.id)}
            disabled={isDeleting}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onReactivar(prueba.id)}
            disabled={isReactivating}
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#02B381]" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ========== Drag Overlay Item (ghost) ==========
function DragOverlayItem({ prueba }: { prueba: any }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-2 border-[#02B381] rounded-lg shadow-2xl">
      <GripVertical className="w-4 h-4 text-[#02B381] shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground">
          {prueba.nombre}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground font-mono">
        #{prueba.orden}
      </span>
    </div>
  );
}

// ========== Main Component ==========
export default function EditorPruebas() {
  const { selectedProjectId } = useProject();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [expandedSistemas, setExpandedSistemas] = useState<Set<string>>(
    new Set()
  );
  const [showInactive, setShowInactive] = useState(false);
  const [editModal, setEditModal] = useState<any>(null);
  const [createModal, setCreateModal] = useState(false);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  // Form state
  const [formNombre, setFormNombre] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formSistema, setFormSistema] = useState("");
  const [formOrden, setFormOrden] = useState(0);
  const [formRequiereEvidencia, setFormRequiereEvidencia] = useState(true);

  const isAdmin =
    user?.role === "admin" || user?.role === "superadmin";

  const {
    data: catalogo,
    isLoading,
    refetch,
  } = trpc.pruebas.catalogoAll.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId && isAdmin }
  );

  const crearMut = trpc.pruebas.crearPrueba.useMutation({
    onSuccess: () => {
      toast.success("Prueba creada");
      refetch();
      setCreateModal(false);
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const actualizarMut = trpc.pruebas.actualizarPrueba.useMutation({
    onSuccess: () => {
      toast.success("Prueba actualizada");
      refetch();
      setEditModal(null);
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const eliminarMut = trpc.pruebas.eliminarPrueba.useMutation({
    onSuccess: () => {
      toast.success("Prueba desactivada");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const reactivarMut = trpc.pruebas.reactivarPrueba.useMutation({
    onSuccess: () => {
      toast.success("Prueba reactivada");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const reordenarMut = trpc.pruebas.reordenarPruebas.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (e) => {
      toast.error("Error al reordenar: " + e.message);
      refetch();
    },
  });

  const resetForm = () => {
    setFormNombre("");
    setFormDescripcion("");
    setFormSistema("");
    setFormOrden(0);
    setFormRequiereEvidencia(true);
  };

  const openCreate = (sistema?: string) => {
    resetForm();
    if (sistema) setFormSistema(sistema);
    setCreateModal(true);
  };

  const openEdit = (prueba: any) => {
    setFormNombre(prueba.nombre);
    setFormDescripcion(prueba.descripcion || "");
    setFormSistema(prueba.sistema);
    setFormOrden(prueba.orden);
    setFormRequiereEvidencia(prueba.requiereEvidencia);
    setEditModal(prueba);
  };

  const handleCreate = () => {
    if (!formNombre.trim() || !formSistema.trim()) {
      toast.error("Nombre y sistema son obligatorios");
      return;
    }
    crearMut.mutate({
      proyectoId: selectedProjectId!,
      nombre: formNombre.trim(),
      descripcion: formDescripcion.trim() || undefined,
      sistema: formSistema.trim(),
      orden: formOrden,
      requiereEvidencia: formRequiereEvidencia,
    });
  };

  const handleUpdate = () => {
    if (!editModal) return;
    actualizarMut.mutate({
      id: editModal.id,
      nombre: formNombre.trim() || undefined,
      descripcion: formDescripcion.trim(),
      sistema: formSistema.trim() || undefined,
      orden: formOrden,
      requiereEvidencia: formRequiereEvidencia,
    });
  };

  // Group by sistema
  const grouped = useMemo(() => {
    if (!catalogo) return new Map<string, any[]>();
    const filtered = catalogo.filter((p: any) => {
      if (!showInactive && !p.activo) return false;
      if (
        search &&
        !p.nombre.toLowerCase().includes(search.toLowerCase()) &&
        !p.sistema.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
    const map = new Map<string, any[]>();
    for (const p of filtered) {
      if (!map.has(p.sistema)) map.set(p.sistema, []);
      map.get(p.sistema)!.push(p);
    }
    // Sort each group by orden
    Array.from(map.entries()).forEach(([, items]) => {
      items.sort((a: any, b: any) => a.orden - b.orden);
    });
    return map;
  }, [catalogo, search, showInactive]);

  const toggleSistema = (sis: string) => {
    setExpandedSistemas((prev) => {
      const next = new Set(prev);
      if (next.has(sis)) next.delete(sis);
      else next.add(sis);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSistemas(new Set(Array.from(grouped.keys())));
  };

  // DnD sensors with activation constraint to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeDragPrueba = useMemo(() => {
    if (!activeDragId || !catalogo) return null;
    return catalogo.find((p: any) => p.id === activeDragId) || null;
  }, [activeDragId, catalogo]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as number);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id || !catalogo || !selectedProjectId) return;

      // Find which sistema both items belong to
      const activeItem = catalogo.find((p: any) => p.id === active.id);
      const overItem = catalogo.find((p: any) => p.id === over.id);
      if (!activeItem || !overItem || activeItem.sistema !== overItem.sistema) return;

      const sistema = activeItem.sistema;
      const sistemaItems = grouped.get(sistema);
      if (!sistemaItems) return;

      const oldIndex = sistemaItems.findIndex((p: any) => p.id === active.id);
      const newIndex = sistemaItems.findIndex((p: any) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      // Reorder locally
      const reordered = arrayMove(sistemaItems, oldIndex, newIndex);

      // Assign new orden values (1-based)
      const updates = reordered.map((item: any, idx: number) => ({
        id: item.id,
        orden: idx + 1,
      }));

      // Persist to backend
      reordenarMut.mutate({
        proyectoId: selectedProjectId,
        items: updates,
      });

      toast.success(`Prueba movida a posición ${newIndex + 1}`, {
        duration: 1500,
      });
    },
    [catalogo, grouped, selectedProjectId, reordenarMut]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  const totalPruebas = catalogo?.length || 0;
  const activePruebas = catalogo?.filter((p: any) => p.activo).length || 0;
  const sistemas = Array.from(grouped.keys());

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            Acceso restringido a administradores.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/configuracion")}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-[#002C63] flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#002C63] truncate">
              Editor de Pruebas
            </h1>
            <p className="text-sm text-muted-foreground">
              {activePruebas} activas de {totalPruebas} · {sistemas.length}{" "}
              sistemas · Arrastra para reordenar
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => openCreate()}
            className="bg-[#02B381] hover:bg-[#02B381]/90 text-white shrink-0"
          >
            <Plus className="w-4 h-4 mr-1" /> Nueva
          </Button>
        </div>

        {/* Search + Filters */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar prueba..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-lg"
            />
          </div>
          <Button
            variant={showInactive ? "default" : "outline"}
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
            className="h-10 px-3 text-xs shrink-0"
          >
            {showInactive ? (
              <Eye className="w-3.5 h-3.5 mr-1" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 mr-1" />
            )}
            {showInactive ? "Todas" : "Inactivas"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={expandAll}
            className="h-10 px-3 text-xs shrink-0"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Systems list with DnD */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-[#02B381]" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            measuring={{
              droppable: {
                strategy: MeasuringStrategy.Always,
              },
            }}
          >
            <div className="space-y-2">
              {sistemas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Sin pruebas configuradas</p>
                  <p className="text-sm">
                    Agrega pruebas con el botón "Nueva".
                  </p>
                </div>
              ) : (
                sistemas.map((sistema) => {
                  const pruebas = grouped.get(sistema) || [];
                  const isExpanded = expandedSistemas.has(sistema);
                  const activas = pruebas.filter(
                    (p: any) => p.activo
                  ).length;
                  const pruebaIds = pruebas.map((p: any) => p.id);

                  return (
                    <div
                      key={sistema}
                      className="bg-white border border-gray-100 rounded-xl overflow-hidden"
                    >
                      {/* System header */}
                      <button
                        onClick={() => toggleSistema(sistema)}
                        className="w-full flex items-center gap-3 p-3 sm:p-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#002C63]/10 flex items-center justify-center shrink-0">
                          <Zap className="w-4 h-4 text-[#002C63]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-[#002C63]">
                            {sistema}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {activas} prueba
                            {activas !== 1 ? "s" : ""} activa
                            {activas !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreate(sistema);
                          }}
                        >
                          <Plus className="w-4 h-4 text-[#02B381]" />
                        </Button>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </button>

                      {/* Pruebas list with sortable context */}
                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          <SortableContext
                            items={pruebaIds}
                            strategy={verticalListSortingStrategy}
                          >
                            {pruebas.map((prueba: any) => (
                              <SortablePruebaItem
                                key={prueba.id}
                                prueba={prueba}
                                onEdit={openEdit}
                                onDelete={(id) =>
                                  eliminarMut.mutate({ id })
                                }
                                onReactivar={(id) =>
                                  reactivarMut.mutate({ id })
                                }
                                isDeleting={eliminarMut.isPending}
                                isReactivating={reactivarMut.isPending}
                              />
                            ))}
                          </SortableContext>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Drag overlay - follows cursor precisely */}
            <DragOverlay dropAnimation={{
              duration: 200,
              easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
            }}>
              {activeDragPrueba ? (
                <DragOverlayItem prueba={activeDragPrueba} />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={createModal} onOpenChange={setCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#02B381]" />
              Nueva Prueba
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sistema / Especialidad</Label>
              <Select value={formSistema} onValueChange={setFormSistema}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sistema" />
                </SelectTrigger>
                <SelectContent>
                  {SISTEMAS_DEFAULT.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                  {sistemas
                    .filter((s) => !SISTEMAS_DEFAULT.includes(s))
                    .map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre de la prueba</Label>
              <Input
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej: Prueba de presión"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={formDescripcion}
                onChange={(e) => setFormDescripcion(e.target.value)}
                placeholder="Detalles de qué se evalúa..."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="space-y-2 flex-1">
                <Label>Orden</Label>
                <Input
                  type="number"
                  value={formOrden}
                  onChange={(e) => setFormOrden(Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formRequiereEvidencia}
                  onCheckedChange={setFormRequiereEvidencia}
                />
                <Label className="text-sm">Requiere foto</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={crearMut.isPending}
              className="bg-[#02B381] hover:bg-[#02B381]/90 text-white"
            >
              {crearMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog
        open={!!editModal}
        onOpenChange={(open) => !open && setEditModal(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[#002C63]" />
              Editar Prueba
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sistema / Especialidad</Label>
              <Select value={formSistema} onValueChange={setFormSistema}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sistema" />
                </SelectTrigger>
                <SelectContent>
                  {SISTEMAS_DEFAULT.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                  {sistemas
                    .filter((s) => !SISTEMAS_DEFAULT.includes(s))
                    .map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre de la prueba</Label>
              <Input
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej: Prueba de presión"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={formDescripcion}
                onChange={(e) => setFormDescripcion(e.target.value)}
                placeholder="Detalles de qué se evalúa..."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="space-y-2 flex-1">
                <Label>Orden</Label>
                <Input
                  type="number"
                  value={formOrden}
                  onChange={(e) => setFormOrden(Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formRequiereEvidencia}
                  onCheckedChange={setFormRequiereEvidencia}
                />
                <Label className="text-sm">Requiere foto</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={actualizarMut.isPending}
              className="bg-[#002C63] hover:bg-[#002C63]/90 text-white"
            >
              {actualizarMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Pencil className="w-4 h-4 mr-2" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
