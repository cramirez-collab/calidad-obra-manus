import { useState, useMemo, useCallback, useRef } from "react";
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
  ArrowUpDown,
} from "lucide-react";

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

// ========== Prueba Row Component ==========
function PruebaRow({
  prueba,
  index,
  onEdit,
  onDelete,
  onReactivar,
  isDeleting,
  isReactivating,
  dragState,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  prueba: any;
  index: number;
  onEdit: (p: any) => void;
  onDelete: (id: number) => void;
  onReactivar: (id: number) => void;
  isDeleting: boolean;
  isReactivating: boolean;
  dragState: { draggingId: number | null; overId: number | null };
  onDragStart: (id: number) => void;
  onDragEnter: (id: number) => void;
  onDragEnd: () => void;
}) {
  const isDragging = dragState.draggingId === prueba.id;
  const isDropTarget = dragState.overId === prueba.id && dragState.draggingId !== prueba.id;

  return (
    <div
      data-prueba-id={prueba.id}
      className={`flex items-center gap-2 px-3 py-2.5 border-b border-gray-50 last:border-0 group transition-all duration-150 ${
        !prueba.activo ? "opacity-50 bg-gray-50" : "bg-white"
      } ${isDragging ? "opacity-30 bg-blue-50" : ""} ${
        isDropTarget ? "bg-[#02B381]/5 border-l-2 border-l-[#02B381] shadow-inner" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter(prueba.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd();
      }}
    >
      {/* Drag handle - native HTML5 drag */}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(prueba.id));
          // Small delay so browser captures the element
          requestAnimationFrame(() => onDragStart(prueba.id));
        }}
        onDragEnd={() => {
          onDragEnd();
        }}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 rounded hover:bg-gray-100 transition-colors select-none"
      >
        <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </div>

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

  // Drag state: simple swap between dragging item and drop target
  const [dragState, setDragState] = useState<{
    draggingId: number | null;
    overId: number | null;
    sistema: string | null;
  }>({ draggingId: null, overId: null, sistema: null });

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
    onError: (e: any) => toast.error(e.message),
  });

  const actualizarMut = trpc.pruebas.actualizarPrueba.useMutation({
    onSuccess: () => {
      toast.success("Prueba actualizada");
      refetch();
      setEditModal(null);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const eliminarMut = trpc.pruebas.eliminarPrueba.useMutation({
    onSuccess: () => {
      toast.success("Prueba desactivada");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reactivarMut = trpc.pruebas.reactivarPrueba.useMutation({
    onSuccess: () => {
      toast.success("Prueba reactivada");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reordenarMut = trpc.pruebas.reordenarPruebas.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (e: any) => {
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

  // ===== SWAP-only drag handlers =====
  // When user drags A onto B, A takes B's orden and B takes A's orden.
  // NO other items move. Pure swap.

  const handleDragStartItem = useCallback((id: number) => {
    if (!catalogo) return;
    const item = catalogo.find((p: any) => p.id === id);
    if (!item) return;
    setDragState({ draggingId: id, overId: null, sistema: item.sistema });
  }, [catalogo]);

  const handleDragEnterItem = useCallback((id: number) => {
    setDragState((prev) => {
      if (!prev.draggingId || prev.draggingId === id) return prev;
      // Only allow drop within same sistema
      if (!catalogo) return prev;
      const overItem = catalogo.find((p: any) => p.id === id);
      if (!overItem || overItem.sistema !== prev.sistema) return prev;
      return { ...prev, overId: id };
    });
  }, [catalogo]);

  const handleDragEndSwap = useCallback(() => {
    const { draggingId, overId } = dragState;
    // Reset drag state immediately
    setDragState({ draggingId: null, overId: null, sistema: null });

    if (!draggingId || !overId || draggingId === overId || !catalogo || !selectedProjectId) return;

    const itemA = catalogo.find((p: any) => p.id === draggingId);
    const itemB = catalogo.find((p: any) => p.id === overId);
    if (!itemA || !itemB) return;
    if (itemA.sistema !== itemB.sistema) return;

    // SWAP: A gets B's orden, B gets A's orden. Nothing else changes.
    const updates = [
      { id: itemA.id, orden: itemB.orden },
      { id: itemB.id, orden: itemA.orden },
    ];

    reordenarMut.mutate({
      proyectoId: selectedProjectId,
      items: updates,
    });

    toast.success(
      `"${itemA.nombre}" ↔ "${itemB.nombre}"`,
      { duration: 2000 }
    );
  }, [dragState, catalogo, selectedProjectId, reordenarMut]);

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
              sistemas
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

        {/* Instruction banner */}
        <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
          <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>Arrastra</strong> una prueba sobre otra para <strong>intercambiar posiciones</strong>. Solo se mueven las 2 pruebas involucradas, las demás no cambian.
          </span>
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

        {/* Systems list */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-[#02B381]" />
          </div>
        ) : (
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

                    {/* Pruebas list */}
                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {pruebas.map((prueba: any, idx: number) => (
                          <PruebaRow
                            key={prueba.id}
                            prueba={prueba}
                            index={idx}
                            onEdit={openEdit}
                            onDelete={(id) =>
                              eliminarMut.mutate({ id })
                            }
                            onReactivar={(id) =>
                              reactivarMut.mutate({ id })
                            }
                            isDeleting={eliminarMut.isPending}
                            isReactivating={reactivarMut.isPending}
                            dragState={dragState}
                            onDragStart={handleDragStartItem}
                            onDragEnter={handleDragEnterItem}
                            onDragEnd={handleDragEndSwap}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
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
