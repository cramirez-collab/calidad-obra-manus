import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getImageUrl } from "@/lib/imageUrl";
import DashboardLayout from "@/components/DashboardLayout";
import { UserAvatar } from "@/components/UserAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
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
  Filter,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckSquare,
  Square,
  X
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocation, Redirect } from "wouter";
import { formatDate } from "@/lib/dateFormat";
import { useProject } from "@/contexts/ProjectContext";

type FilterType = "todos" | "foto" | "aprobar" | "corregir";

const ITEMS_PER_PAGE = 20;

export default function Bienvenida() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedProjectId, isLoadingProjects } = useProject();
  const { data: pendientes, isLoading } = trpc.pendientes.misPendientes.useQuery();
  const [activeFilter, setActiveFilter] = useState<FilterType>("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Estado para selección múltiple
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showDeleteMultipleDialog, setShowDeleteMultipleDialog] = useState(false);
  
  const utils = trpc.useUtils();
  const deleteItemMutation = trpc.items.delete.useMutation({
    onSuccess: () => {
      toast.success("Ítem eliminado correctamente");
      utils.pendientes.misPendientes.invalidate();
      setItemToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message || "Error al eliminar el ítem");
    },
  });
  
  // Mutación para eliminar múltiples ítems
  const deleteMultipleMutation = trpc.items.deleteMultiple.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.deleted} ítems eliminados correctamente`);
      utils.pendientes.misPendientes.invalidate();
      setSelectedItems(new Set());
      setSelectionMode(false);
      setShowDeleteMultipleDialog(false);
    },
    onError: (error) => {
      toast.error(error.message || "Error al eliminar los ítems");
    },
  });
  
  const handleDeleteItem = async (itemId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete(itemId);
  };
  
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await deleteItemMutation.mutateAsync({ id: itemToDelete });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Funciones para selección múltiple
  const toggleItemSelection = (itemId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };
  
  const selectAllVisible = () => {
    const newSelected = new Set(selectedItems);
    paginatedItems.forEach((item: any) => newSelected.add(item.id));
    setSelectedItems(newSelected);
  };
  
  const deselectAll = () => {
    setSelectedItems(new Set());
  };
  
  const confirmDeleteMultiple = async () => {
    if (selectedItems.size === 0) return;
    setIsDeleting(true);
    try {
      await deleteMultipleMutation.mutateAsync({ ids: Array.from(selectedItems) });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedItems(new Set());
    }
    setSelectionMode(!selectionMode);
  };
  
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";

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

  // Paginación
  const totalPages = Math.ceil(filteredPendientes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filteredPendientes.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Resetear página cuando cambia el filtro
  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

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

  const filterButtons: { key: FilterType; tooltip: string; icon: any; color: string }[] = [
    { key: "todos", tooltip: "Todos", icon: Filter, color: "bg-slate-500" },
    { key: "foto", tooltip: "Pendiente foto después", icon: Camera, color: "bg-[#002C63]" },
    { key: "aprobar", tooltip: "Pendiente aprobación", icon: Clock, color: "bg-[#02B381]" },
    { key: "corregir", tooltip: "Rechazado - Corregir", icon: AlertCircle, color: "bg-red-500" },
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

        {/* Filtros de estado - SOLO iconos con contador (sin texto) */}
        <div className="flex gap-2 items-center">
          {filterButtons.map(filter => (
            <Tooltip key={filter.key}>
              <TooltipTrigger asChild>
                <Button
                  variant={activeFilter === filter.key ? "default" : "outline"}
                  size="icon"
                  className={`h-10 w-10 relative ${
                    activeFilter === filter.key 
                      ? `${filter.color} text-white border-0 shadow-md` 
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                  onClick={() => handleFilterChange(filter.key)}
                >
                  <filter.icon className="h-5 w-5" />
                  {/* Badge con contador */}
                  {counts[filter.key] > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${
                      activeFilter === filter.key 
                        ? "bg-white text-slate-700" 
                        : `${filter.color} text-white`
                    }`}>
                      {counts[filter.key]}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{filter.tooltip}</TooltipContent>
            </Tooltip>
          ))}
          
          {/* Botón de modo selección múltiple - Solo para superadmin */}
          {isSuperadmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={selectionMode ? "default" : "outline"}
                  size="icon"
                  className={`h-10 w-10 ml-auto ${
                    selectionMode 
                      ? "bg-red-500 text-white border-0 shadow-md hover:bg-red-600" 
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                  onClick={toggleSelectionMode}
                >
                  {selectionMode ? <X className="h-5 w-5" /> : <CheckSquare className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {selectionMode ? "Cancelar selección" : "Selección múltiple"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Barra de acciones de selección múltiple */}
        {selectionMode && isSuperadmin && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
            <span className="text-sm font-medium text-red-700">
              {selectedItems.size} seleccionados
            </span>
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllVisible}
                className="text-xs"
              >
                <CheckSquare className="h-3 w-3 mr-1" />
                Seleccionar página
              </Button>
              {selectedItems.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAll}
                    className="text-xs"
                  >
                    <Square className="h-3 w-3 mr-1" />
                    Deseleccionar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteMultipleDialog(true)}
                    className="text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Eliminar ({selectedItems.size})
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Lista de pendientes - compacta con paginación */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#02B381]" />
          </div>
        ) : paginatedItems.length > 0 ? (
          <div className="space-y-2">
            {paginatedItems.map((item: any) => {
              const config = getStatusConfig(item.status);
              const Icon = config.icon;
              const isSelected = selectedItems.has(item.id);
              return (
                <Card 
                  key={item.id}
                  className={`cursor-pointer hover:shadow-md transition-all active:scale-[0.99] border-0 shadow-sm ${
                    isSelected ? "ring-2 ring-red-500 bg-red-50" : ""
                  }`}
                  onClick={() => {
                    if (selectionMode) {
                      toggleItemSelection(item.id, { stopPropagation: () => {} } as React.MouseEvent);
                    } else {
                      setLocation(`/items/${item.id}`);
                    }
                  }}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      {/* Checkbox para selección múltiple */}
                      {selectionMode && isSuperadmin && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {
                            const newSelected = new Set(selectedItems);
                            if (isSelected) {
                              newSelected.delete(item.id);
                            } else {
                              newSelected.add(item.id);
                            }
                            setSelectedItems(newSelected);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-5 w-5 border-2 border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                        />
                      )}
                      
                      {/* Miniatura de foto antes */}
                      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                        {item.fotoAntes ? (
                          <img 
                            src={getImageUrl(item.fotoAntes)} 
                            alt="Foto antes" 
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
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
                            {item.codigo} <span className="text-[#02B381]">#{item.numeroInterno || '-'}</span>
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

                      {/* Botón eliminar para superadmin (solo si no está en modo selección) */}
                      {isSuperadmin && !selectionMode && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                              onClick={(e) => handleDeleteItem(item.id, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar ítem</TooltipContent>
                        </Tooltip>
                      )}

                      {/* Flecha (solo si no está en modo selección) */}
                      {!selectionMode && (
                        <ArrowRight className="h-5 w-5 text-[#6E6E6E] shrink-0" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Controles de paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-[#6E6E6E] px-3">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
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

      {/* Diálogo de confirmación para eliminar un ítem */}
      <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este ítem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El ítem y todas sus fotos serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación para eliminar múltiples ítems */}
      <AlertDialog open={showDeleteMultipleDialog} onOpenChange={setShowDeleteMultipleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              ¿Eliminar {selectedItems.size} ítems?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los {selectedItems.size} ítems seleccionados y todas sus fotos serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMultiple}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Eliminando {selectedItems.size}...
                </>
              ) : (
                `Eliminar ${selectedItems.size} ítems`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
