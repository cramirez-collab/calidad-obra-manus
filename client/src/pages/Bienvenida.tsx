import { useState, useEffect, useRef, useCallback } from "react";
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
  X,
  Check,
  XCircle,
  Megaphone,
  Layers
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ZoomablePlano from "@/components/ZoomablePlano";
import type { PlanoPin } from "@/components/ZoomablePlano";
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
// jsPDF se importa dinámicamente para evitar conflicto con React context
// Heartbeat via tRPC en vez de socket para usuarios en línea

type FilterType = "todos" | "foto" | "aprobar" | "corregir";

const ITEMS_PER_BATCH = 20; // Para scroll infinito

export default function Bienvenida() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedProjectId, isLoadingProjects } = useProject();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // Heartbeat: registra actividad cada 3 min (throttled en servidor a 1/min)
  const heartbeatMut = trpc.avisos.heartbeat.useMutation();
  useEffect(() => {
    if (!selectedProjectId) return;
    // Enviar heartbeat inmediato al entrar
    heartbeatMut.mutate({ proyectoId: selectedProjectId });
    const interval = setInterval(() => {
      // Solo enviar si la tab está visible (ahorra en 3G)
      if (document.visibilityState === 'visible') {
        heartbeatMut.mutate({ proyectoId: selectedProjectId });
      }
    }, 3 * 60 * 1000); // cada 3 min
    return () => clearInterval(interval);
  }, [selectedProjectId]);

  // Usuarios en línea (heartbeat BD, últimos 5 min)
  const enLineaQuery = trpc.avisos.enLinea.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId, refetchInterval: 180_000, staleTime: 180_000, gcTime: 30 * 60 * 1000 }
  );
  const usersCount = enLineaQuery.data?.total ?? 0;
  const connectedUsers = enLineaQuery.data?.usuarios ?? [];

  const handleDownloadEnLineaPDF = async () => {
    if (!connectedUsers.length) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(0, 44, 99);
    doc.text('Usuarios En Linea', 20, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 20, 28);
    doc.text(`Total: ${connectedUsers.length} usuarios conectados ahora`, 20, 34);
    
    let y = 45;
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(0, 44, 99);
    doc.rect(20, y - 5, 170, 8, 'F');
    doc.text('#', 25, y);
    doc.text('Nombre', 35, y);
    doc.text('Rol', 120, y);
    y += 10;
    
    doc.setTextColor(50, 50, 50);
    connectedUsers.forEach((u: any, i: number) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(20, y - 5, 170, 8, 'F');
      }
      doc.text(`${i + 1}`, 25, y);
      doc.text(u.name || '', 35, y);
      doc.text(u.role || '', 120, y);
      y += 8;
    });
    
    doc.save(`usuarios_en_linea_${new Date().toISOString().slice(0, 10)}.pdf`);
  };
  
  // Avisos no leídos
  const { data: avisosNoLeidos } = trpc.avisos.noLeidos.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId, refetchInterval: 300_000, staleTime: 300_000, gcTime: 30 * 60 * 1000 }
  );
  
  // Planos del proyecto para el selector de nivel
  const { data: planosData } = trpc.planos.listar.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 }
  );
  const { data: pendientes, isLoading } = trpc.pendientes.misPendientes.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId, staleTime: 60_000, gcTime: 10 * 60 * 1000 }
  );
  const [activeFilter, setActiveFilter] = useState<FilterType>("todos");
  const [showOnlineList, setShowOnlineList] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_BATCH);
  const listRef = useRef<HTMLDivElement>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Estado para selección múltiple
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showDeleteMultipleDialog, setShowDeleteMultipleDialog] = useState(false);
  const [showPlanoSelector, setShowPlanoSelector] = useState(false);
  const [selectedPlanoId, setSelectedPlanoId] = useState<number | null>(null);
  const [showPlanoViewer, setShowPlanoViewer] = useState(false);

  // Pin count por plano
  const { data: pinCountData } = trpc.planos.pinCount.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 }
  );
  const pinCountMap = new Map((pinCountData || []).map((p: any) => [p.planoId, Number(p.count)]));

  // Pins del plano seleccionado
  const { data: planosPins } = trpc.items.pinsByPlano.useQuery(
    { planoId: selectedPlanoId! },
    { enabled: !!selectedPlanoId, staleTime: 30_000 }
  );
  
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
  
  // Estado para swipe
  const [swipingItemId, setSwipingItemId] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef(false);
  
  // Mutación para aprobar ítem (swipe derecha)
  const aprobarMutation = trpc.items.aprobar.useMutation({
    onSuccess: () => {
      toast.success("✅ Ítem aprobado");
      utils.pendientes.misPendientes.invalidate();
      resetSwipe();
    },
    onError: (error) => {
      toast.error(error.message || "Error al aprobar");
      resetSwipe();
    },
  });
  
  // Mutación para rechazar ítem (swipe izquierda)
  const rechazarMutation = trpc.items.rechazar.useMutation({
    onSuccess: () => {
      toast.success("❌ Ítem rechazado");
      utils.pendientes.misPendientes.invalidate();
      resetSwipe();
    },
    onError: (error) => {
      toast.error(error.message || "Error al rechazar");
      resetSwipe();
    },
  });
  
  const resetSwipe = () => {
    setSwipingItemId(null);
    setSwipeOffset(0);
    setSwipeDirection(null);
    isHorizontalSwipe.current = false;
  };
  
  const handleTouchStart = (e: React.TouchEvent, itemId: number) => {
    if (selectionMode) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwipingItemId(itemId);
    isHorizontalSwipe.current = false;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipingItemId || selectionMode) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    
    // Determinar si es swipe horizontal o vertical
    if (!isHorizontalSwipe.current && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
    
    if (!isHorizontalSwipe.current) {
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
      if (!isHorizontalSwipe.current) {
        resetSwipe();
        return;
      }
    }
    
    // Limitar el swipe
    const maxSwipe = 120;
    const clampedOffset = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));
    setSwipeOffset(clampedOffset);
    setSwipeDirection(clampedOffset > 30 ? 'right' : clampedOffset < -30 ? 'left' : null);
  };
  
  const handleTouchEnd = (itemId: number, itemStatus: string) => {
    if (!swipingItemId || selectionMode) return;
    
    const threshold = 80;
    
    if (swipeOffset > threshold && itemStatus === 'pendiente_aprobacion') {
      // Swipe derecha = Aprobar
      aprobarMutation.mutate({ itemId });
    } else if (swipeOffset < -threshold && itemStatus === 'pendiente_aprobacion') {
      // Swipe izquierda = Rechazar
      rechazarMutation.mutate({ itemId, comentario: 'Rechazado por swipe' });
    } else {
      resetSwipe();
    }
  };
  
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
    visibleItems.forEach((item: any) => newSelected.add(item.id));
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

  // Actualizar badge del icono de la app con el número de pendientes
  useEffect(() => {
    if (pendientes && typeof (window as any).updateAppBadge === 'function') {
      (window as any).updateAppBadge(pendientes.length);
    }
  }, [pendientes]);

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

  // Scroll infinito - mostrar solo los primeros N ítems
  const visibleItems = filteredPendientes.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPendientes.length;

  // Resetear contador cuando cambia el filtro
  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setVisibleCount(ITEMS_PER_BATCH);
  };

  // Cargar más ítems al hacer scroll
  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount(prev => prev + ITEMS_PER_BATCH);
    }
  }, [hasMore]);

  // Detectar scroll cerca del final
  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  // Redirigir a selección de proyecto si no hay proyecto seleccionado
  if (!isLoadingProjects && !selectedProjectId) {
    return <Redirect to="/seleccionar-proyecto" />;
  }

  // Mostrar skeleton instantáneo mientras carga proyectos
  if (isLoadingProjects) {
    return (
      <DashboardLayout>
        <div className="space-y-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-slate-200" />
            <div className="space-y-2"><div className="h-5 w-32 bg-slate-200 rounded" /><div className="h-3 w-20 bg-slate-200 rounded" /></div>
          </div>
          <div className="flex gap-2">{[1,2,3].map(i=><div key={i} className="h-8 w-20 bg-slate-200 rounded-full" />)}</div>
          {[1,2,3,4,5].map(i=><div key={i} className="h-20 bg-slate-200 rounded-xl" />)}
        </div>
      </DashboardLayout>
    );
  }

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
            {/* Botón Ver Planos con Pines */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 border-slate-300 hover:bg-slate-50"
                  onClick={() => setShowPlanoSelector(true)}
                >
                  <MapPin className="h-5 w-5 text-[#002C63]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver Pines</TooltipContent>
            </Tooltip>
            {/* Botón Avisos con badge rojo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 relative border-slate-300 hover:bg-slate-50"
                  onClick={() => setLocation('/avisos')}
                >
                  <Megaphone className="h-5 w-5 text-[#002C63]" />
                  {(avisosNoLeidos ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 z-50 h-5 min-w-[20px] px-1 flex items-center justify-center text-[11px] font-bold text-white bg-red-600 rounded-full shadow-lg border-2 border-white animate-pulse">
                      {avisosNoLeidos}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Avisos</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Indicador de Usuarios EN LÍNEA - Heartbeat BD */}
        {usersCount > 0 && (
          <div className="relative">
            <button
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 hover:from-emerald-100 hover:to-teal-100 transition-all cursor-pointer shadow-sm"
              onClick={() => setShowOnlineList(prev => !prev)}
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-bold text-emerald-700">{usersCount} en línea</span>
              <svg className={`w-3.5 h-3.5 text-emerald-500 transition-transform ${showOnlineList ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {/* Lista desplegable de usuarios en línea */}
            {showOnlineList && (
              <div className="mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-50 max-h-60 overflow-y-auto">
                <div className="flex items-center justify-between px-2 pb-1.5 border-b border-slate-100 mb-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Usuarios en línea</span>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadEnLineaPDF(); }}
                      className="text-[10px] text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      PDF
                    </button>
                  )}
                </div>
                {connectedUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-slate-700 truncate">
                        {u.name}{u.empresaNombre ? ` — ${u.empresaNombre}` : ''}
                      </span>
                      {u.especialidadNombre && (
                        <span className="text-[10px] text-slate-400 truncate">{u.especialidadNombre}</span>
                      )}
                    </div>
                  </div>
                ))}
                {connectedUsers.length === 0 && (
                  <div className="text-xs text-slate-400 px-2 py-1">Cargando...</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Filtros de estado - Card con botones bien espaciados */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
          <div className="flex gap-4 items-center justify-start overflow-x-auto pb-1">
            {filterButtons.map(filter => (
              <Tooltip key={filter.key}>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-1 min-w-[60px]">
                    <Button
                      variant={activeFilter === filter.key ? "default" : "outline"}
                      size="icon"
                      className={`h-11 w-11 relative ${
                        activeFilter === filter.key 
                          ? `${filter.color} text-white border-0 shadow-md` 
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                      }`}
                      onClick={() => handleFilterChange(filter.key)}
                    >
                      <filter.icon className="h-5 w-5" />
                    </Button>
                    {/* Badge DEBAJO del botón - siempre visible */}
                    <span className={`min-w-[28px] h-[20px] rounded-full text-[11px] font-bold flex items-center justify-center px-2 ${
                      activeFilter === filter.key 
                        ? "bg-[#002C63] text-white" 
                        : counts[filter.key] > 0 
                          ? `${filter.color} text-white`
                          : "bg-slate-200 text-slate-500"
                    }`}>
                      {counts[filter.key]}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">{filter.tooltip}</TooltipContent>
              </Tooltip>
            ))}
          
            {/* Botón de modo selección múltiple - Solo para superadmin */}
            {isSuperadmin && (
              <div className="flex flex-col items-center gap-1 min-w-[60px] ml-auto">
                <Button
                  variant={selectionMode ? "default" : "outline"}
                  size="icon"
                  className={`h-11 w-11 ${
                    selectionMode 
                      ? "bg-red-500 text-white border-0 shadow-md hover:bg-red-600" 
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                  onClick={toggleSelectionMode}
                >
                  {selectionMode ? <X className="h-5 w-5" /> : <CheckSquare className="h-5 w-5" />}
                </Button>
                <span className="text-[9px] text-slate-400 whitespace-nowrap">
                  {selectionMode ? "Cancelar" : "Seleccionar"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Barra de acciones de selección múltiple - REDISEÑADA PARA MÓVIL */}
        {selectionMode && isSuperadmin && (
          <div className="bg-red-50 rounded-lg border border-red-200 p-2 sm:p-3">
            {/* Fila 1: Contador y Botón Eliminar (SIEMPRE VISIBLE) */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-bold text-red-700 whitespace-nowrap">
                {selectedItems.size} seleccionados
              </span>
              {/* BOTÓN ELIMINAR - GRANDE Y VISIBLE EN MÓVIL */}
              {selectedItems.size > 0 && (
                <Button
                  variant="destructive"
                  size="default"
                  onClick={() => setShowDeleteMultipleDialog(true)}
                  className="h-10 px-4 text-sm font-bold shadow-lg"
                >
                  <Trash2 className="h-5 w-5 mr-2" />
                  Eliminar ({selectedItems.size})
                </Button>
              )}
            </div>
            {/* Fila 2: Botones de selección */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllVisible}
                className="text-xs flex-1 min-w-[100px]"
              >
                <CheckSquare className="h-3 w-3 mr-1" />
                Seleccionar página
              </Button>
              {selectedItems.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deselectAll}
                  className="text-xs flex-1 min-w-[100px]"
                >
                  <Square className="h-3 w-3 mr-1" />
                  Deseleccionar todo
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Lista de pendientes - scroll infinito */}
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="rounded-xl bg-white shadow-sm p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
                <div className="h-6 w-16 bg-slate-200 rounded-full" />
              </div>
            ))}
          </div>
        ) : visibleItems.length > 0 ? (
          <div className="space-y-2" ref={listRef}>
            {visibleItems.map((item: any) => {
              const config = getStatusConfig(item.status);
              const Icon = config.icon;
              const isSelected = selectedItems.has(item.id);
              const isSwipeable = item.status === 'pendiente_aprobacion' && !selectionMode;
              const isCurrentlySwipingThis = swipingItemId === item.id;
              
              return (
                <div key={item.id} className="relative overflow-hidden rounded-xl">
                  {/* Fondo de swipe - Aprobar (verde) */}
                  {isSwipeable && isCurrentlySwipingThis && swipeOffset > 0 && (
                    <div 
                      className="absolute inset-y-0 left-0 bg-[#02B381] flex items-center justify-start pl-4 rounded-l-xl"
                      style={{ width: Math.abs(swipeOffset) }}
                    >
                      <Check className="h-6 w-6 text-white" />
                      {swipeOffset > 50 && <span className="text-white text-xs ml-1 font-bold">Aprobar</span>}
                    </div>
                  )}
                  {/* Fondo de swipe - Rechazar (rojo) */}
                  {isSwipeable && isCurrentlySwipingThis && swipeOffset < 0 && (
                    <div 
                      className="absolute inset-y-0 right-0 bg-red-500 flex items-center justify-end pr-4 rounded-r-xl"
                      style={{ width: Math.abs(swipeOffset) }}
                    >
                      {swipeOffset < -50 && <span className="text-white text-xs mr-1 font-bold">Rechazar</span>}
                      <XCircle className="h-6 w-6 text-white" />
                    </div>
                  )}
                  
                  <Card 
                    className={`cursor-pointer hover:shadow-md transition-all border-0 shadow-sm relative ${
                      isSelected ? "ring-2 ring-red-500 bg-red-50" : ""
                    } ${isSwipeable ? 'touch-pan-y' : ''}`}
                    style={{
                      transform: isCurrentlySwipingThis ? `translateX(${swipeOffset}px)` : 'translateX(0)',
                      transition: isCurrentlySwipingThis ? 'none' : 'transform 0.3s ease-out'
                    }}
                    onClick={() => {
                      if (selectionMode) {
                        toggleItemSelection(item.id, { stopPropagation: () => {} } as React.MouseEvent);
                      } else if (!isCurrentlySwipingThis || Math.abs(swipeOffset) < 10) {
                        setLocation(`/items/${item.id}`);
                      }
                    }}
                    onTouchStart={(e) => isSwipeable && handleTouchStart(e, item.id)}
                    onTouchMove={(e) => isSwipeable && handleTouchMove(e)}
                    onTouchEnd={() => isSwipeable && handleTouchEnd(item.id, item.status)}
                  >
                  <CardContent className="p-2 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
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
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                          <span className="font-mono text-xs sm:text-sm font-bold text-[#002C63]">
                            {item.codigo} <span className="text-[#02B381]">#{item.numeroInterno || '-'}</span>
                          </span>
                          <span className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm truncate mt-0.5 text-[#2E2E2E]">{item.titulo}</p>
                        <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-[#6E6E6E] mt-1 flex-wrap">
                          {/* Residente asignado (prioridad: asignadoA > especialidadResidente > residente) */}
                          {(item.asignadoANombre || item.especialidadResidenteNombre || item.residenteNombre) && (
                            <span className="font-semibold text-[#02B381] bg-[#02B381]/10 px-1.5 py-0.5 rounded" title="Residente asignado">
                              {(item.asignadoANombre || item.especialidadResidenteNombre || item.residenteNombre || '').split(' ').slice(0, 2).join(' ')}
                            </span>
                          )}
                          {item.ubicacion && (
                            <span className="flex items-center gap-1 truncate max-w-[80px] sm:max-w-none">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{item.ubicacion}</span>
                            </span>
                          )}
                          {/* Creado por */}
                          {item.creadoPorNombre && (
                            <span className="shrink-0 text-slate-500" title="Creado por">
                              ✍️ {item.creadoPorNombre.split(' ')[0]} {formatDate(item.fechaCreacion)}
                            </span>
                          )}
                          {!item.creadoPorNombre && (
                            <span className="shrink-0">{formatDate(item.fechaCreacion)}</span>
                          )}
                          {/* Fecha de foto después si existe */}
                          {item.fechaFotoDespues && (
                            <span className="text-blue-600 shrink-0" title="Foto después">
                              📷 {formatDate(item.fechaFotoDespues)}
                            </span>
                          )}
                          {/* Aprobado/Rechazado por */}
                          {item.aprobadoPorNombre && item.fechaAprobacion && (
                            <span className={`shrink-0 ${item.status === 'aprobado' ? 'text-green-600' : 'text-red-600'}`} title={item.status === 'aprobado' ? 'Aprobado por' : 'Rechazado por'}>
                              {item.status === 'aprobado' ? '✓' : '✗'} {item.aprobadoPorNombre.split(' ')[0]} {formatDate(item.fechaAprobacion)}
                            </span>
                          )}
                          {!item.aprobadoPorNombre && item.fechaAprobacion && (
                            <span className="text-green-600 shrink-0" title="Aprobado">
                              ✓ {formatDate(item.fechaAprobacion)}
                            </span>
                          )}
                        </div>
                        {/* Preview de 3 palabras del comentario con indicador de quién comentó */}
                        {(item.comentarioResidente || item.comentarioSupervisor) && (
                          <p className="text-[10px] sm:text-xs text-[#02B381] mt-0.5 truncate italic flex items-center gap-1">
                            <span className="font-bold not-italic text-slate-500">
                              {item.comentarioResidente ? 'R:' : 'S:'}
                            </span>
                            "{(() => {
                              const comentario = item.comentarioResidente || item.comentarioSupervisor || '';
                              const palabras = comentario.split(' ');
                              return palabras.slice(0, 3).join(' ') + (palabras.length > 3 ? '...' : '');
                            })()}"
                          </p>
                        )}
                      </div>

                      {/* Botón eliminar para superadmin/admin (solo si no está en modo selección) */}
                      {isSuperadmin && !selectionMode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 sm:h-10 sm:w-10 min-w-[36px] sm:min-w-[40px] text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0 flex-none ml-1"
                          onClick={(e) => handleDeleteItem(item.id, e)}
                        >
                          <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                      )}

                      {/* Flecha (solo si no está en modo selección) - oculta en móvil cuando hay botón eliminar */}
                      {!selectionMode && (
                        <ArrowRight className={`h-5 w-5 text-[#6E6E6E] shrink-0 ${isSuperadmin ? 'hidden sm:block' : ''}`} />
                      )}
                    </div>
                  </CardContent>
                </Card>
                </div>
              );
            })}

            {/* Indicador de scroll infinito */}
            {hasMore && (
              <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-2 text-sm text-[#6E6E6E]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Cargando más... ({visibleItems.length} de {filteredPendientes.length})</span>
                </div>
              </div>
            )}
            {!hasMore && filteredPendientes.length > ITEMS_PER_BATCH && (
              <div className="text-center py-4 text-sm text-[#6E6E6E]">
                Mostrando todos los {filteredPendientes.length} ítems
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
      {/* Modal Selector de Plano/Nivel */}
      <Dialog open={showPlanoSelector} onOpenChange={setShowPlanoSelector}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#002C63] flex items-center gap-2">
              <Layers className="h-5 w-5" /> Seleccionar Nivel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {!planosData || planosData.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No hay planos configurados para este proyecto</p>
            ) : (
              planosData.map((plano: any) => (
                <button
                  key={plano.id}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-[#02B381] transition-all text-left"
                  onClick={() => {
                    setSelectedPlanoId(plano.id);
                    setShowPlanoSelector(false);
                    setShowPlanoViewer(true);
                  }}
                >
                  <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    <img src={getImageUrl(plano.imagenUrl)} alt={plano.nombre} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[#002C63] truncate">{plano.nombre}</p>
                    {plano.descripcion && <p className="text-xs text-gray-500 truncate">{plano.descripcion}</p>}
                  </div>
                  {(pinCountMap.get(plano.id) ?? 0) > 0 && (
                    <span className="text-[10px] font-bold text-white bg-[#002C63] rounded-full px-2 py-0.5 shrink-0">
                      {pinCountMap.get(plano.id)} pin{(pinCountMap.get(plano.id) ?? 0) !== 1 ? 'es' : ''}
                    </span>
                  )}
                  <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Visor de Plano con Pines */}
      {showPlanoViewer && selectedPlanoId && (() => {
        const plano = planosData?.find((p: any) => p.id === selectedPlanoId);
        if (!plano) return null;
        const pins: PlanoPin[] = (planosPins || []).map((p: any) => ({
          id: p.id,
          codigo: p.codigo,
          descripcion: p.descripcion,
          status: p.status,
          pinPosX: p.pinPosX,
          pinPosY: p.pinPosY,
          numeroInterno: p.numeroInterno,
          residenteNombre: p.residenteNombre,
        }));
        return (
          <Dialog open={showPlanoViewer} onOpenChange={(open) => { if (!open) setShowPlanoViewer(false); }}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
              <div className="flex flex-col h-[90vh]">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[#002C63]" />
                    <span className="font-semibold text-sm text-[#002C63]">{plano.nombre}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{pins.length} pins</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setShowPlanoViewer(false); setShowPlanoSelector(true); }}>
                    <Layers className="h-4 w-4 mr-1" /> Cambiar nivel
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ZoomablePlano
                    imagenUrl={getImageUrl(plano.imagenUrl)}
                    nombre={plano.nombre}
                    allPins={pins}
                    onPinClick={(itemId) => {
                      setShowPlanoViewer(false);
                      setLocation(`/items/${itemId}`);
                    }}
                    className="h-full"
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </DashboardLayout>
  );
}
