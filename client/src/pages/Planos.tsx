import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import html2canvas from "html2canvas";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, PlusCircle, Trash2, Edit2, ZoomIn, ZoomOut, RotateCcw, Layers, Image as ImageIcon, X, Upload, ChevronLeft, ChevronRight, MapPin, MapPinOff, Eye, Search, Filter, Download, Maximize, Minimize, ExternalLink, Users, ListChecks } from "lucide-react";
import CapturaRapida from "@/components/CapturaRapida";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";

// Colores de pin según estado del ítem
const PIN_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pendiente_foto_despues: { bg: "#f59e0b", border: "#d97706", text: "#fff" },
  pendiente_aprobacion: { bg: "#3b82f6", border: "#2563eb", text: "#fff" },
  aprobado: { bg: "#10b981", border: "#059669", text: "#fff" },
  rechazado: { bg: "#ef4444", border: "#dc2626", text: "#fff" },
  sin_item: { bg: "#6b7280", border: "#4b5563", text: "#fff" },
};

const STATUS_LABELS: Record<string, string> = {
  pendiente_foto_despues: "Pend. Foto",
  pendiente_aprobacion: "Pend. Aprob.",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  sin_item: "Sin ítem",
};

export default function Planos() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "superadmin" || user?.role === "admin";
  const { selectedProjectId } = useProject();

  // Queries
  const { data: planosData, isLoading, refetch } = trpc.planos.listar.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  // Proyecto para diasCorreccion
  const { data: proyectoData } = trpc.proyectos.get.useQuery(
    { id: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  const diasCorreccion = proyectoData?.diasCorreccion || 8;

  // Items del proyecto para vincular pines
  const { data: itemsData } = trpc.items.list.useQuery(
    { proyectoId: selectedProjectId!, limit: 500, offset: 0 },
    { enabled: !!selectedProjectId }
  );

  // Mutations planos
  const crearPlano = trpc.planos.crear.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano subido correctamente"); setShowAddDialog(false); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });
  const actualizarPlano = trpc.planos.actualizar.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano actualizado"); setShowEditDialog(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const eliminarPlano = trpc.planos.eliminar.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano eliminado"); },
    onError: (e: any) => toast.error(e.message),
  });

  // State general
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<any>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [nombre, setNombre] = useState("");
  const [nivel, setNivel] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagenBase64, setImagenBase64] = useState("");
  const [imagenNombre, setImagenNombre] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [editNombre, setEditNombre] = useState("");
  const [editNivel, setEditNivel] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const planoContainerRef = useRef<HTMLDivElement>(null);

  // State pines
  const [pinMode, setPinMode] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [selectedPin, setSelectedPin] = useState<any>(null);
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [pendingPinPos, setPendingPinPos] = useState<{ x: number; y: number } | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [pinNota, setPinNota] = useState("");

  // State para interacción de taps
  const [tappedPin, setTappedPin] = useState<any>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const pinModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  // State para filtro de pines por estado
  const [pinFilter, setPinFilter] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  // State para filtro por residente
  const [residenteFilter, setResidenteFilter] = useState<string | null>(null);
  const [showResidenteMenu, setShowResidenteMenu] = useState(false);
  // State para tooltip hover
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);

  // State para captura rápida inline
  const [showCapturaRapida, setShowCapturaRapida] = useState(false);
  const [capturaRapidaPinPos, setCapturaRapidaPinPos] = useState<{ x: number; y: number } | null>(null);
  const [itemsCreadosSesion, setItemsCreadosSesion] = useState<any[]>([]);
  const [showSeguimiento, setShowSeguimiento] = useState(false);

  // State para fullscreen del plano
  const [isFullscreen, setIsFullscreen] = useState(false);
  // State para subir/cambiar imagen del plano desde el visor
  const [pendingImageBase64, setPendingImageBase64] = useState("");
  const [pendingImageNombre, setPendingImageNombre] = useState("");
  const viewerFileInputRef = useRef<HTMLInputElement>(null);

  // State para filtro por nivel
  const [filterNivel, setFilterNivel] = useState<number | null>(null);

  // Query pines del plano actual
  const planos = planosData || [];
  const currentPlano = planos[viewerIndex];
  const { data: pinesData, refetch: refetchPines } = trpc.planos.pines.listar.useQuery(
    { planoId: currentPlano?.id! },
    { enabled: !!currentPlano?.id && showViewer }
  );

  // Mutations pines
  const crearPin = trpc.planos.pines.crear.useMutation({
    onSuccess: () => { refetchPines(); toast.success("Pin agregado"); setShowItemSelector(false); setPendingPinPos(null); setPinNota(""); },
    onError: (e: any) => toast.error(e.message),
  });
  const eliminarPin = trpc.planos.pines.eliminar.useMutation({
    onSuccess: () => { refetchPines(); toast.success("Pin eliminado"); setSelectedPin(null); setTappedPin(null); setShowPinModal(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const pines = pinesData || [];

  // Filtrar pines por estado y residente
  const filteredPines = useMemo(() => {
    let result = pines;
    if (pinFilter) result = result.filter((p: any) => (p.itemEstado || "sin_item") === pinFilter);
    if (residenteFilter) result = result.filter((p: any) => p.residenteNombre === residenteFilter);
    return result;
  }, [pines, pinFilter, residenteFilter]);

  // Residentes únicos para filtro
  const residentesUnicos = useMemo(() => {
    const names = new Set<string>();
    pines.forEach((p: any) => { if (p.residenteNombre) names.add(p.residenteNombre); });
    return Array.from(names).sort();
  }, [pines]);

  // Niveles únicos para filtro
  const nivelesUnicos = useMemo(() => {
    const niveles = new Set<number>();
    planos.forEach((p: any) => niveles.add(p.nivel ?? 0));
    return Array.from(niveles).sort((a, b) => a - b);
  }, [planos]);

  // Planos filtrados por nivel
  const planosFiltrados = useMemo(() => {
    if (filterNivel === null) return planos;
    return planos.filter((p: any) => (p.nivel ?? 0) === filterNivel);
  }, [planos, filterNivel]);

  // Conteo de pines por estado
  const pinCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pines.forEach((p: any) => {
      const estado = p.itemEstado || "sin_item";
      counts[estado] = (counts[estado] || 0) + 1;
    });
    return counts;
  }, [pines]);

  // Filtrar items para el selector
  const allItems = useMemo(() => {
    const list = (itemsData as any)?.items || itemsData || [];
    return Array.isArray(list) ? list : [];
  }, [itemsData]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return allItems.slice(0, 30);
    const q = itemSearch.toLowerCase();
    return allItems.filter((it: any) =>
      it.codigo?.toLowerCase().includes(q) ||
      it.titulo?.toLowerCase().includes(q) ||
      String(it.numeroInterno || "").includes(q)
    ).slice(0, 30);
  }, [allItems, itemSearch]);

  const resetForm = () => {
    setNombre(""); setNivel(""); setDescripcion(""); setImagenBase64(""); setImagenNombre(""); setPreviewUrl("");
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Solo se permiten imágenes"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("Máximo 15MB por imagen"); return; }
    setImagenNombre(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setImagenBase64(base64);
      setPreviewUrl(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = () => {
    if (!nombre.trim()) { toast.error("Ingresa un nombre para el plano"); return; }
    if (!imagenBase64) { toast.error("Selecciona una imagen del plano"); return; }
    if (!selectedProjectId) return;
    crearPlano.mutate({
      proyectoId: selectedProjectId,
      nombre: nombre.trim(),
      nivel: nivel ? parseInt(nivel) : 0,
      descripcion: descripcion.trim() || undefined,
      imagenBase64,
      imagenNombre,
    });
  };

  const handleEdit = () => {
    if (!selectedPlano || !editNombre.trim()) return;
    actualizarPlano.mutate({
      id: selectedPlano.id,
      nombre: editNombre.trim(),
      nivel: editNivel ? parseInt(editNivel) : 0,
      descripcion: editDescripcion.trim() || undefined,
    });
  };

  const openEditDialog = (plano: any) => {
    setSelectedPlano(plano);
    setEditNombre(plano.nombre);
    setEditNivel(plano.nivel?.toString() || "");
    setEditDescripcion(plano.descripcion || "");
    setShowEditDialog(true);
  };

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPinMode(false);
    setSelectedPin(null);
    setTappedPin(null);
    setShowPinModal(false);
    setPinFilter(null);
    setShowViewer(true);
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Auto-abrir visor cuando hay planos disponibles (entrada directa al visor)
  const [autoOpened, setAutoOpened] = useState(false);

  // Refetch pines al cambiar de plano
  // CERRAR VISOR Y RESETEAR al cambiar de proyecto — aislamiento agresivo
  useEffect(() => {
    setShowViewer(false);
    setPinMode(false);
    setSelectedPin(null);
    setTappedPin(null);
    setShowPinModal(false);
    setViewerIndex(0);
    setFilterNivel(null);
    setAutoOpened(false); // Resetear para que se auto-abra con el nuevo proyecto
  }, [selectedProjectId]);

  useEffect(() => {
    if (currentPlano?.id) {
      refetchPines();
      setSelectedPin(null);
      setTappedPin(null);
      setShowPinModal(false);
    }
  }, [viewerIndex, currentPlano?.id]);

  useEffect(() => {
    if (!autoOpened && planos.length > 0 && !showViewer && !isLoading) {
      setAutoOpened(true);
      openViewer(0);
    }
  }, [planos.length, isLoading, autoOpened, showViewer]);

  // Limpiar timer del modal al desmontar
  useEffect(() => {
    return () => {
      if (pinModalTimerRef.current) clearTimeout(pinModalTimerRef.current);
    };
  }, []);

  // === LONG PRESS en PIN: Mostrar modal ===
  const handlePinPointerDown = useCallback((pin: any, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (pinMode) return;
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setTappedPin(pin);
      setShowPinModal(true);
    }, 800); // 800ms long press
  }, [pinMode]);

  const handlePinPointerUp = useCallback((pin: any, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Si no fue long press, es click normal → ir al ítem
    if (!longPressTriggeredRef.current && !pinMode) {
      if (pin.itemId) {
        setShowViewer(false);
        navigate(`/item/${pin.itemId}`);
      } else {
        toast.info(pin.nota || "Pin sin ítem vinculado");
      }
    }
  }, [pinMode, navigate]);

  const handlePinPointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Ir al ítem inmediatamente
  const goToItem = useCallback((itemId: number) => {
    if (pinModalTimerRef.current) clearTimeout(pinModalTimerRef.current);
    setShowPinModal(false);
    setShowViewer(false);
    navigate(`/item/${itemId}`);
  }, [navigate]);

  // Cerrar modal de pin
  const closePinModal = useCallback(() => {
    if (pinModalTimerRef.current) clearTimeout(pinModalTimerRef.current);
    setShowPinModal(false);
    setTappedPin(null);
  }, []);

  // Click en el plano para agregar pin
  const handlePlanoClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode || isDragging) return;
    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    setPendingPinPos({ x, y });
    setItemSearch("");
    setPinNota("");
    setShowItemSelector(true);
  }, [pinMode, isDragging]);

  // Confirmar pin con ítem seleccionado
  const confirmPin = (itemId?: number) => {
    if (!pendingPinPos || !currentPlano) return;
    crearPin.mutate({
      planoId: currentPlano.id,
      itemId: itemId,
      posX: pendingPinPos.x.toFixed(4),
      posY: pendingPinPos.y.toFixed(4),
      nota: pinNota.trim() || undefined,
    });
  };

  // Crear nuevo ítem desde pin: navegar a NuevoItem con datos del pin
  const handleCreateItemFromPin = () => {
    if (!pendingPinPos || !currentPlano) return;
    const params = new URLSearchParams();
    params.set('pinPlanoId', currentPlano.id.toString());
    params.set('pinPosX', pendingPinPos.x.toFixed(4));
    params.set('pinPosY', pendingPinPos.y.toFixed(4));
    if (currentPlano.nivel) params.set('nivel', currentPlano.nivel.toString());
    if (pinNota.trim()) params.set('pinNota', pinNota.trim());
    setShowItemSelector(false);
    setPendingPinPos(null);
    setPinNota('');
    setShowViewer(false);
    setPinMode(false);
    navigate(`/nuevo-item?${params.toString()}`);
  };

  // Descargar plano CON pines renderizados como imagen
  const handleDownloadPlano = useCallback(async () => {
    if (!currentPlano?.imagenUrl) return;
    const container = planoContainerRef.current;
    const img = imgRef.current;
    if (!container || !img) {
      // Fallback: descargar imagen base via fetch+blob
      try {
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(currentPlano.imagenUrl)}`;
        const resp = await fetch(proxyUrl);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Plano_${currentPlano.nombre || "plano"}.png`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      } catch {
        toast.error("Error al descargar plano");
      }
      return;
    }
    toast.info("Capturando plano con pines...");
    try {
      // Paso 1: Convertir imagen a base64 via proxy para evitar CORS con html2canvas
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(currentPlano.imagenUrl)}`;
      const imgResp = await fetch(proxyUrl);
      const imgBlob = await imgResp.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imgBlob);
      });
      
      // Paso 2: Temporalmente reemplazar src de la imagen con base64
      const originalSrc = img.src;
      img.src = base64;
      // Esperar a que la imagen base64 cargue
      await new Promise<void>((resolve) => {
        if (img.complete) { resolve(); return; }
        img.onload = () => resolve();
        setTimeout(resolve, 2000); // timeout safety
      });
      
      // Paso 3: Capturar con html2canvas
      const canvas = await html2canvas(container, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
      });
      
      // Paso 4: Restaurar src original
      img.src = originalSrc;
      
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) { toast.error("Error al generar imagen"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const nombreArchivo = `Plano_${currentPlano.nombre || "plano"}_N${currentPlano.nivel ?? 0}_con_pines.png`;
      a.download = nombreArchivo;
      a.setAttribute("download", nombreArchivo);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      toast.success("Plano descargado con pines");
    } catch (err) {
      console.error("Error capturando plano:", err);
      // Fallback: descargar imagen base via fetch+blob
      try {
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(currentPlano.imagenUrl)}`;
        const resp = await fetch(proxyUrl);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Plano_${currentPlano.nombre || "plano"}.png`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
        toast.success("Plano descargado (sin pines)");
      } catch {
        toast.error("Error al descargar plano");
      }
    }
  }, [currentPlano]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      viewerRef.current?.parentElement?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (pinMode) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || pinMode) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (pinMode) return;
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1 || pinMode) return;
    setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  };
  const handleTouchEnd = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.2, Math.min(5, prev + delta)));
  };

  if (!selectedProjectId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Selecciona un proyecto primero
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            Planos por Nivel
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {planos.length} plano{planos.length !== 1 ? "s" : ""} cargado{planos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro por nivel */}
          {nivelesUnicos.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setFilterNivel(null)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${filterNivel === null ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Todos
              </button>
              {nivelesUnicos.map(n => (
                <button
                  key={n}
                  onClick={() => setFilterNivel(n)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${filterNivel === n ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  N{n}
                </button>
              ))}
            </div>
          )}
          {isAdmin && (
            <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <Plus className="w-4 h-4" /> Subir Plano
            </Button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && planos.length === 0 && (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">Sin planos</h3>
            <p className="text-sm text-slate-500 mb-4 max-w-sm">
              Sube imágenes de los planos arquitectónicos de cada nivel del proyecto
            </p>
            {isAdmin && (
              <Button onClick={() => { resetForm(); setShowAddDialog(true); }} variant="outline" className="gap-1.5">
                <Upload className="w-4 h-4" /> Subir primer plano
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grid de planos */}
      {!isLoading && planosFiltrados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {planosFiltrados.map((plano: any) => {
            const originalIndex = planos.findIndex((p: any) => p.id === plano.id);
            return (
              <Card key={plano.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                <div
                  className="relative h-44 bg-slate-50 overflow-hidden"
                  onClick={() => openViewer(originalIndex)}
                >
                  <img
                    src={plano.imagenUrl}
                    alt={plano.nombre}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs font-bold text-slate-700 shadow-sm">
                    Nivel {plano.nivel ?? 0}
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
                  </div>
                </div>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate text-sm">{plano.nombre}</h3>
                      {plano.descripcion && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{plano.descripcion}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditDialog(plano); }}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`¿Eliminar plano "${plano.nombre}"?`)) {
                              eliminarPlano.mutate({ id: plano.id });
                            }
                          }}
                          className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========== VISOR FULLSCREEN CON PINES ========== */}
      {showViewer && currentPlano && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
          {/* === BARRA SUPERIOR FIJA: Cerrar + Nombre + Subir/Guardar/Descargar === */}
          <div className="flex-shrink-0 bg-slate-900 text-white border-b border-slate-700 z-50">
            <div className="flex items-center justify-between px-2 sm:px-3 py-2 gap-2">
              {/* Izquierda: Cerrar + Nombre */}
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => { setShowViewer(false); setPinMode(false); setSelectedPin(null); setTappedPin(null); setShowPinModal(false); if (pinModalTimerRef.current) clearTimeout(pinModalTimerRef.current); }} className="p-2 hover:bg-white/10 rounded-lg flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <span className="font-semibold text-xs sm:text-sm truncate block">{currentPlano.nombre}</span>
                  <span className="text-[10px] text-white/60">N{currentPlano.nivel ?? 0} — {filteredPines.length} pin{filteredPines.length !== 1 ? "es" : ""}</span>
                </div>
              </div>
              {/* Derecha: Botones de acción */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap justify-end">
                {isAdmin && (
                  <>
                    <input
                      ref={viewerFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 15 * 1024 * 1024) { toast.error("Imagen demasiado grande (máx 15MB)"); return; }
                        const reader = new FileReader();
                        reader.onload = () => {
                          setPendingImageBase64(reader.result as string);
                          setPendingImageNombre(file.name);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <button
                      onClick={() => viewerFileInputRef.current?.click()}
                      className="px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition-colors"
                      title="Subir/cambiar imagen del plano"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="hidden xs:inline sm:inline">Subir</span>
                    </button>
                    {pendingImageBase64 && (
                      <button
                        onClick={() => {
                          if (!currentPlano) return;
                          actualizarPlano.mutate({
                            id: currentPlano.id,
                            nombre: currentPlano.nombre,
                            nivel: currentPlano.nivel ?? 0,
                            descripcion: currentPlano.descripcion || undefined,
                            imagenBase64: pendingImageBase64,
                            imagenNombre: pendingImageNombre,
                          }, {
                            onSuccess: () => {
                              setPendingImageBase64("");
                              setPendingImageNombre("");
                              toast.success("Imagen del plano actualizada");
                            }
                          });
                        }}
                        disabled={actualizarPlano.isPending}
                        className="px-3 sm:px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 animate-pulse shadow-lg shadow-emerald-500/30"
                        title="Guardar imagen del plano"
                      >
                        {actualizarPlano.isPending ? (
                          <RotateCcw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>Guardar</span>
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
                <button onClick={handleDownloadPlano} className="px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition-colors" title="Descargar plano con pines">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Descargar</span>
                </button>
              </div>
            </div>
          </div>

          {/* === BARRA DE HERRAMIENTAS: Pines, filtros, zoom === */}
          <div className="flex-shrink-0 flex items-center justify-between px-2 py-1 bg-black/80 text-white gap-1">
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* Filtro por estado */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(f => !f)}
                  className={`p-1.5 rounded-lg transition-colors ${pinFilter ? 'bg-emerald-600' : 'hover:bg-white/10'}`}
                  title="Filtrar pines"
                >
                  <Filter className="w-4 h-4" />
                </button>
                {showFilterMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-slate-900 rounded-lg shadow-xl border border-slate-700 py-1 min-w-[160px] z-50">
                    <button
                      onClick={() => { setPinFilter(null); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 ${!pinFilter ? 'text-emerald-400 font-bold' : 'text-white'}`}
                    >
                      Todos ({pines.length})
                    </button>
                    {Object.entries(PIN_COLORS).map(([key, colors]) => (
                      <button
                        key={key}
                        onClick={() => { setPinFilter(key); setShowFilterMenu(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2 ${pinFilter === key ? 'font-bold' : ''}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors.bg }} />
                        <span>{STATUS_LABELS[key]} ({pinCounts[key] || 0})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Filtro por residente */}
              <div className="relative">
                <button
                  onClick={() => { setShowResidenteMenu(f => !f); setShowFilterMenu(false); }}
                  className={`p-1.5 rounded-lg transition-colors ${residenteFilter ? 'bg-blue-600' : 'hover:bg-white/10'}`}
                  title="Filtrar por residente"
                >
                  <Users className="w-4 h-4" />
                </button>
                {showResidenteMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-slate-900 rounded-lg shadow-xl border border-slate-700 py-1 min-w-[180px] z-50 max-h-[250px] overflow-y-auto">
                    <button
                      onClick={() => { setResidenteFilter(null); setShowResidenteMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 ${!residenteFilter ? 'text-blue-400 font-bold' : 'text-white'}`}
                    >
                      Todos los residentes
                    </button>
                    {residentesUnicos.map((nombre) => {
                      const count = pines.filter((p: any) => p.residenteNombre === nombre).length;
                      const getInit = (n: string) => { const p = n.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : p[0].substring(0,2).toUpperCase(); };
                      return (
                        <button
                          key={nombre}
                          onClick={() => { setResidenteFilter(nombre); setShowResidenteMenu(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2 ${residenteFilter === nombre ? 'text-blue-400 font-bold' : 'text-white'}`}
                        >
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">{getInit(nombre)}</span>
                          <span className="truncate">{nombre} ({count})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Toggle pines */}
              <button
                onClick={() => setShowPins(p => !p)}
                className={`p-1.5 rounded-lg transition-colors ${showPins ? 'bg-emerald-600 hover:bg-emerald-700' : 'hover:bg-white/10'}`}
                title={showPins ? "Ocultar pines" : "Mostrar pines"}
              >
                {showPins ? <MapPin className="w-4 h-4" /> : <MapPinOff className="w-4 h-4" />}
              </button>
              {/* Agregar pin (admin) */}
              {isAdmin && (
                <button
                  onClick={() => { setPinMode(p => !p); setSelectedPin(null); }}
                  className={`p-1.5 rounded-lg transition-colors ${pinMode ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'hover:bg-white/10'}`}
                  title={pinMode ? "Cancelar modo pin" : "Agregar pin"}
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* Zoom */}
              <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} className="p-1.5 hover:bg-white/10 rounded-lg">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[10px] text-white/50 w-8 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(5, z + 0.2))} className="p-1.5 hover:bg-white/10 rounded-lg">
                <ZoomIn className="w-4 h-4" />
              </button>
              {/* Fullscreen */}
              <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/10 rounded-lg" title="Pantalla completa">
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
              {/* Reset */}
              <button onClick={resetView} className="p-1.5 hover:bg-white/10 rounded-lg" title="Restablecer vista">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pin mode banner */}
          {pinMode && (
            <div className="flex-shrink-0 bg-red-500 text-white text-center py-1.5 text-sm font-medium animate-pulse">
              Toca sobre el plano para colocar un pin
            </div>
          )}

          {/* === ÁREA DEL PLANO: ocupa todo el espacio restante === */}
          <div
            ref={viewerRef}
            className={`flex-1 min-h-0 overflow-hidden select-none ${pinMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            <div
              className="w-full h-full flex items-center justify-center relative"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: isDragging ? 'none' : 'transform 0.1s' }}
            >
              <div ref={planoContainerRef} className="relative" onClick={handlePlanoClick}>
                <img
                  ref={imgRef}
                  src={currentPlano.imagenUrl}
                  alt={currentPlano.nombre}
                  className="max-w-none"
                  style={{ maxHeight: 'calc(100vh - 140px)', maxWidth: '100vw', objectFit: 'contain' }}
                  draggable={false}
                />

                {/* Pines: tipo pin de mapa con iniciales del residente */}
                {showPins && filteredPines.map((pin: any) => {
                  const estado = pin.itemEstado || "sin_item";
                  const colors = PIN_COLORS[estado] || PIN_COLORS.sin_item;
                  const isTapped = tappedPin?.id === pin.id;
                  const getInitials = (name: string | null | undefined) => {
                    if (!name) return "?";
                    const parts = name.trim().split(/\s+/);
                    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                    return parts[0].substring(0, 2).toUpperCase();
                  };
                  const initials = getInitials(pin.residenteNombre);
                  const pinSize = isTapped ? 38 : 30;

                  const isHovered = hoveredPin === pin.id;

                  return (
                    <div
                      key={pin.id}
                      className="absolute"
                      style={{
                        left: `${parseFloat(pin.posX)}%`,
                        top: `${parseFloat(pin.posY)}%`,
                        transform: 'translate(-50%, -100%)',
                        zIndex: isTapped || isHovered ? 50 : 10,
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease',
                      }}
                      onMouseDown={(e) => handlePinPointerDown(pin, e)}
                      onMouseUp={(e) => handlePinPointerUp(pin, e)}
                      onMouseEnter={() => setHoveredPin(pin.id)}
                      onMouseLeave={() => { setHoveredPin(null); handlePinPointerLeave(); }}
                      onTouchStart={(e) => handlePinPointerDown(pin, e)}
                      onTouchEnd={(e) => handlePinPointerUp(pin, e)}
                    >
                      {/* Tooltip hover (desktop) */}
                      {isHovered && !showPinModal && pin.residenteNombre && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-[10px] rounded-md whitespace-nowrap shadow-lg pointer-events-none z-50"
                          style={{ minWidth: 'max-content' }}>
                          <span className="font-semibold">{pin.residenteNombre}</span>
                          {pin.itemCodigo && <span className="text-white/60 ml-1.5">{pin.itemCodigo}</span>}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-slate-900" />
                        </div>
                      )}
                      {/* SVG Pin de mapa real */}
                      <svg width={pinSize} height={pinSize * 1.35} viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg"
                        style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}>
                        {/* Forma del pin: gota invertida */}
                        <path d="M15 38C15 38 28 22 28 14C28 6.82 22.18 1 15 1C7.82 1 2 6.82 2 14C2 22 15 38 15 38Z"
                          fill={colors.bg} stroke={colors.border} strokeWidth="1.5" />
                        {/* Círculo interior blanco */}
                        <circle cx="15" cy="14" r="9" fill="white" fillOpacity="0.25" />
                        {/* Iniciales */}
                        <text x="15" y="14" textAnchor="middle" dominantBaseline="central"
                          fill="white" fontWeight="700" fontSize={initials.length > 2 ? '8' : '10'}
                          fontFamily="system-ui, -apple-system, sans-serif">
                          {initials}
                        </text>
                      </svg>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Leyenda de estados en la parte inferior */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 bg-black/80 text-white text-[10px] gap-2 overflow-x-auto">
            <div className="flex items-center gap-3">
              {Object.entries(PIN_COLORS).map(([key, colors]) => {
                const count = pinCounts[key] || 0;
                if (count === 0 && key === "sin_item") return null;
                return (
                  <button
                    key={key}
                    onClick={() => setPinFilter(pinFilter === key ? null : key)}
                    className={`flex items-center gap-1 whitespace-nowrap transition-opacity ${pinFilter && pinFilter !== key ? 'opacity-40' : 'opacity-100'}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.bg }} />
                    <span>{STATUS_LABELS[key]} ({count})</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-white/60 flex-shrink-0">
              <span>{filteredPines.length} pin{filteredPines.length !== 1 ? "es" : ""}</span>
            </div>
          </div>

          {/* Navigation arrows */}
          {planos.length > 1 && (
            <>
              <button
                onClick={() => { setViewerIndex(i => (i - 1 + planos.length) % planos.length); resetView(); setSelectedPin(null); setTappedPin(null); setShowPinModal(false); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white z-20"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setViewerIndex(i => (i + 1) % planos.length); resetView(); setSelectedPin(null); setTappedPin(null); setShowPinModal(false); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white z-20"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Bottom thumbnails */}
          {planos.length > 1 && (
            <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-black/80 overflow-x-auto">
              {planos.map((p: any, i: number) => (
                <button
                  key={p.id}
                  onClick={() => { setViewerIndex(i); resetView(); setSelectedPin(null); setTappedPin(null); setShowPinModal(false); }}
                  className={`flex-shrink-0 w-14 h-10 rounded-md overflow-hidden border-2 transition-all ${
                    i === viewerIndex ? 'border-emerald-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== MODAL: Info completa del pin ========== */}
      {showPinModal && tappedPin && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" onClick={closePinModal}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md mx-auto overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con estado y código */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: PIN_COLORS[tappedPin.itemEstado || "sin_item"]?.bg || "#6b7280" }}
                />
                <span className="text-xs font-semibold uppercase" style={{ color: PIN_COLORS[tappedPin.itemEstado || "sin_item"]?.bg || "#6b7280" }}>
                  {STATUS_LABELS[tappedPin.itemEstado || "sin_item"] || "Sin estado"}
                </span>
                {tappedPin.itemCodigo && (
                  <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{tappedPin.itemCodigo}</span>
                )}
              </div>
              <button onClick={closePinModal} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Fotos antes/después */}
            {(tappedPin.itemFotoAntes || tappedPin.itemFotoDespues) && (
              <div className="flex gap-1 px-4 pt-3">
                {tappedPin.itemFotoAntes && (
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-400 mb-1">Antes</p>
                    <img src={tappedPin.itemFotoAntes} alt="Antes" className="w-full h-20 rounded-lg object-cover" />
                  </div>
                )}
                {tappedPin.itemFotoDespues && (
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-400 mb-1">Después</p>
                    <img src={tappedPin.itemFotoDespues} alt="Después" className="w-full h-20 rounded-lg object-cover" />
                  </div>
                )}
              </div>
            )}

            {/* Datos del ítem */}
            <div className="px-4 py-3 space-y-1.5">
              {tappedPin.itemTitulo && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Defecto</span>
                  <span className="text-xs font-medium text-slate-700">{tappedPin.itemTitulo}</span>
                </div>
              )}
              {tappedPin.itemDescripcion && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Descripción</span>
                  <span className="text-xs text-slate-600 line-clamp-2">{tappedPin.itemDescripcion}</span>
                </div>
              )}
              {tappedPin.residenteNombre && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Residente</span>
                  <span className="text-xs font-medium text-slate-700">{tappedPin.residenteNombre}</span>
                </div>
              )}
              {tappedPin.empresaNombre && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Empresa</span>
                  <span className="text-xs text-slate-600">{tappedPin.empresaNombre}</span>
                </div>
              )}
              {tappedPin.unidadNombre && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Unidad</span>
                  <span className="text-xs text-slate-600">{tappedPin.unidadNombre}</span>
                </div>
              )}
              {tappedPin.especialidadNombre && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Especialidad</span>
                  <span className="text-xs text-slate-600">{tappedPin.especialidadNombre}</span>
                </div>
              )}
              {tappedPin.defectoNombre && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Tipo defecto</span>
                  <span className="text-xs text-slate-600">{tappedPin.defectoNombre}</span>
                </div>
              )}
              {tappedPin.itemConsecutivo && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Consecutivo</span>
                  <span className="text-xs font-mono text-slate-600">#{tappedPin.itemConsecutivo}</span>
                </div>
              )}
              {tappedPin.itemCreatedAt && (() => {
                const fechaAlta = new Date(tappedPin.itemCreatedAt);
                const fechaTerminacion = new Date(fechaAlta.getTime() + diasCorreccion * 24 * 60 * 60 * 1000);
                const hoy = new Date();
                const vencido = hoy > fechaTerminacion;
                return (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Fecha Alta</span>
                      <span className="text-xs text-slate-600">{fechaAlta.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Límite ({diasCorreccion}d)</span>
                      <span className={`text-xs font-semibold ${vencido ? 'text-red-600' : 'text-emerald-600'}`}>
                        {fechaTerminacion.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        {vencido && ' (Vencido)'}
                      </span>
                    </div>
                  </>
                );
              })()}
              {tappedPin.nota && !tappedPin.itemId && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Nota</span>
                  <span className="text-xs text-slate-500 italic">{tappedPin.nota}</span>
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="px-4 pb-4 flex gap-2">
              {tappedPin.itemId && (
                <button
                  onClick={() => goToItem(tappedPin.itemId)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#002C63] hover:bg-[#001d42] text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Ver Ítem Completo
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => {
                    if (confirm("¿Eliminar este pin?")) eliminarPin.mutate({ id: tappedPin.id });
                  }}
                  className="px-3 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 rounded-lg py-2.5 text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== DIALOG: Pin colocado - Captura rápida o vincular ========== */}
      <Dialog open={showItemSelector} onOpenChange={(open) => { if (!open) { setShowItemSelector(false); setPendingPinPos(null); } }}>
        <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-5 h-5 text-emerald-600" />
              Pin colocado
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">Elige qué hacer con este pin</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* === OPCIÓN PRINCIPAL: Captura Rápida Inline === */}
            <div className="px-4 pt-4 pb-3">
              <button
                onClick={() => {
                  if (!pendingPinPos) return;
                  setCapturaRapidaPinPos(pendingPinPos);
                  setShowItemSelector(false);
                  setShowCapturaRapida(true);
                }}
                className="w-full flex items-center gap-4 p-4 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-300 hover:border-emerald-500 rounded-xl transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <PlusCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-emerald-800 text-sm">Captura Rápida</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Crear ítem aquí mismo sin salir del plano</p>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:text-emerald-600 flex-shrink-0" />
              </button>
            </div>

            {/* Separador */}
            <div className="flex items-center gap-3 px-4 py-1">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-[10px] text-slate-400 font-medium uppercase">otras opciones</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* Opción: Ir a formulario completo */}
            <div className="px-4 pt-2 pb-2">
              <button
                onClick={handleCreateItemFromPin}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
              >
                <ExternalLink className="w-5 h-5 text-slate-400" />
                <div className="text-left flex-1">
                  <p className="text-sm font-medium text-slate-700">Formulario completo</p>
                  <p className="text-[10px] text-slate-500">Abrir formulario de nuevo ítem con más opciones</p>
                </div>
              </button>
            </div>

            {/* === OPCIÓN: Vincular a ítem existente === */}
            <div className="px-4 pt-1 pb-3 space-y-2">
              <div>
                <label className="text-xs font-medium text-slate-500">Vincular a ítem existente</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    placeholder="Código, título o #consecutivo..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
              {itemSearch.trim() && (
                <div className="border rounded-lg divide-y max-h-[150px] overflow-y-auto">
                  {filteredItems.map((item: any) => {
                    const estado = item.status || "pendiente_foto_despues";
                    const colors = PIN_COLORS[estado] || PIN_COLORS.sin_item;
                    return (
                      <button
                        key={item.id}
                        onClick={() => confirmPin(item.id)}
                        className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex items-center gap-2"
                      >
                        {item.fotoAntesUrl && (
                          <img src={item.fotoAntesUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 truncate">{item.codigo}</p>
                          <p className="text-[10px] text-slate-500 truncate">{item.titulo}</p>
                        </div>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colors.bg + '20', color: colors.bg }}
                        >
                          #{item.numeroInterno}
                        </span>
                      </button>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <div className="text-center py-3 text-xs text-slate-400">No se encontraron ítems</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-slate-50 flex gap-2">
            <Button variant="outline" onClick={() => { setShowItemSelector(false); setPendingPinPos(null); }} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={() => confirmPin()} className="flex-1 bg-slate-600 hover:bg-slate-700 text-white">
              Pin sin ítem
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== CAPTURA RÁPIDA INLINE ========== */}
      {showCapturaRapida && capturaRapidaPinPos && currentPlano && (
        <CapturaRapida
          pinPos={capturaRapidaPinPos}
          planoId={currentPlano.id}
          planoNivel={currentPlano.nivel}
          onClose={() => {
            setShowCapturaRapida(false);
            setCapturaRapidaPinPos(null);
            setPendingPinPos(null);
          }}
          onItemCreated={(item) => {
            setItemsCreadosSesion(prev => [item, ...prev]);
            // Crear el pin vinculado al ítem
            if (capturaRapidaPinPos && currentPlano && item.id) {
              crearPin.mutate({
                planoId: currentPlano.id,
                itemId: item.id,
                posX: capturaRapidaPinPos.x.toFixed(4),
                posY: capturaRapidaPinPos.y.toFixed(4),
              });
            }
            setShowCapturaRapida(false);
            setCapturaRapidaPinPos(null);
            setPendingPinPos(null);
            // Mantener modo pin activo para seguir colocando
            setPinMode(true);
          }}
          onContinuePin={() => {
            setShowCapturaRapida(false);
            setCapturaRapidaPinPos(null);
            setPendingPinPos(null);
            setPinMode(true);
          }}
        />
      )}

      {/* ========== PANEL DE SEGUIMIENTO: Ítems creados en la sesión ========== */}
      {showViewer && itemsCreadosSesion.length > 0 && (
        <div className="fixed bottom-16 right-3 z-[150]">
          <button
            onClick={() => setShowSeguimiento(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg text-xs font-bold transition-all"
          >
            <ListChecks className="w-4 h-4" />
            {itemsCreadosSesion.length} creado{itemsCreadosSesion.length !== 1 ? 's' : ''}
          </button>
          {showSeguimiento && (
            <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-xl shadow-2xl border overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
              <div className="px-3 py-2 bg-emerald-50 border-b flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">Ítems creados esta sesión</span>
                <button onClick={() => setShowSeguimiento(false)} className="p-0.5 hover:bg-emerald-100 rounded">
                  <X className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              </div>
              <div className="max-h-[200px] overflow-y-auto divide-y">
                {itemsCreadosSesion.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (item.id) {
                        setShowViewer(false);
                        navigate(`/item/${item.id}`);
                      }
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-3 h-3 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{item.codigo || 'OFFLINE'}</p>
                      <p className="text-[10px] text-slate-500 truncate">{item.titulo}</p>
                    </div>
                    <Eye className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog: Agregar plano */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[95vh] flex flex-col p-0 gap-0">
          {/* Barra superior fija con título y botones */}
          <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-sm sm:text-base">Subir Plano</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSubmit} disabled={crearPlano.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {crearPlano.isPending ? "Subiendo..." : "Subir Plano"}
              </Button>
            </div>
          </div>
          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Nombre del plano *</label>
                <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Planta Baja, Nivel 1, Azotea" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Número de nivel</label>
                <Input type="number" value={nivel} onChange={e => setNivel(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Descripción (opcional)</label>
              <Input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción del plano" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Imagen del plano *</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              {previewUrl ? (
                <div className="relative mt-1">
                  <div className="w-full bg-slate-50 rounded-lg border overflow-auto" style={{ maxHeight: '50vh' }}>
                    <img src={previewUrl} alt="Preview" className="max-w-none" style={{ minWidth: '100%' }} />
                  </div>
                  <button
                    onClick={() => { setPreviewUrl(""); setImagenBase64(""); setImagenNombre(""); }}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <p className="text-xs text-slate-400 mt-1 text-center">Pellizca o usa scroll para hacer zoom en el plano</p>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                >
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                  <span className="text-sm text-slate-500">Toca para seleccionar imagen</span>
                  <span className="text-xs text-slate-400">JPG, PNG, WebP — máx 15MB</span>
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar plano */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg max-h-[95vh] flex flex-col p-0 gap-0">
          {/* Barra superior fija con título y botones */}
          <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-sm sm:text-base">Editar Plano</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleEdit} disabled={actualizarPlano.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {actualizarPlano.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Nombre del plano *</label>
              <Input value={editNombre} onChange={e => setEditNombre(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Número de nivel</label>
              <Input type="number" value={editNivel} onChange={e => setEditNivel(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Descripción</label>
              <Input value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
