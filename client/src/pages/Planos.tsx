import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, ZoomIn, ZoomOut, RotateCcw, Layers, Image as ImageIcon, X, Upload, ChevronLeft, ChevronRight, MapPin, MapPinOff, Eye, Search } from "lucide-react";
import { useLocation } from "wouter";

// Colores de pin según estado del ítem
const PIN_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pendiente_foto_despues: { bg: "#f59e0b", border: "#d97706", text: "#fff" },
  pendiente_aprobacion: { bg: "#3b82f6", border: "#2563eb", text: "#fff" },
  aprobado: { bg: "#10b981", border: "#059669", text: "#fff" },
  rechazado: { bg: "#ef4444", border: "#dc2626", text: "#fff" },
  sin_item: { bg: "#6b7280", border: "#4b5563", text: "#fff" },
};

export default function Planos() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "superadmin" || user?.role === "admin";
  const selectedProjectId = user?.proyectoActivoId;

  // Queries
  const { data: planosData, isLoading, refetch } = trpc.planos.listar.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

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

  // State pines
  const [pinMode, setPinMode] = useState(false); // Modo agregar pin
  const [showPins, setShowPins] = useState(true);
  const [selectedPin, setSelectedPin] = useState<any>(null);
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [pendingPinPos, setPendingPinPos] = useState<{ x: number; y: number } | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [pinNota, setPinNota] = useState("");

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
    onSuccess: () => { refetchPines(); toast.success("Pin eliminado"); setSelectedPin(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const pines = pinesData || [];

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
    setShowViewer(true);
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Refetch pines al cambiar de plano
  useEffect(() => {
    if (currentPlano?.id) {
      refetchPines();
      setSelectedPin(null);
    }
  }, [viewerIndex, currentPlano?.id]);

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

  // Pan handlers - solo si no estamos en modo pin
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            Planos por Nivel
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {planos.length} plano{planos.length !== 1 ? "s" : ""} cargado{planos.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
            <Plus className="w-4 h-4" /> Subir Plano
          </Button>
        )}
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
      {!isLoading && planos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {planos.map((plano: any, index: number) => (
            <Card key={plano.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
              <div
                className="relative h-44 bg-slate-50 overflow-hidden"
                onClick={() => openViewer(index)}
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
          ))}
        </div>
      )}

      {/* ========== VISOR FULLSCREEN CON PINES ========== */}
      {showViewer && currentPlano && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 bg-black/80 text-white gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => { setShowViewer(false); setPinMode(false); setSelectedPin(null); }} className="p-2 hover:bg-white/10 rounded-lg flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <span className="font-semibold text-sm truncate block">{currentPlano.nombre}</span>
                <span className="text-xs text-white/60">Nivel {currentPlano.nivel ?? 0} — {pines.length} pin{pines.length !== 1 ? "es" : ""}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Toggle pines visibles */}
              <button
                onClick={() => setShowPins(p => !p)}
                className={`p-2 rounded-lg transition-colors ${showPins ? 'bg-emerald-600 hover:bg-emerald-700' : 'hover:bg-white/10'}`}
                title={showPins ? "Ocultar pines" : "Mostrar pines"}
              >
                {showPins ? <MapPin className="w-4 h-4" /> : <MapPinOff className="w-4 h-4" />}
              </button>
              {/* Modo agregar pin */}
              <button
                onClick={() => { setPinMode(p => !p); setSelectedPin(null); }}
                className={`p-2 rounded-lg transition-colors ${pinMode ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'hover:bg-white/10'}`}
                title={pinMode ? "Cancelar modo pin" : "Agregar pin"}
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-white/20 mx-1" />
              <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} className="p-2 hover:bg-white/10 rounded-lg">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(5, z + 0.2))} className="p-2 hover:bg-white/10 rounded-lg">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={resetView} className="p-2 hover:bg-white/10 rounded-lg">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pin mode banner */}
          {pinMode && (
            <div className="bg-red-500 text-white text-center py-1.5 text-sm font-medium animate-pulse">
              Toca sobre el plano para colocar un pin
            </div>
          )}

          {/* Image area con pines */}
          <div
            ref={viewerRef}
            className={`flex-1 overflow-hidden select-none ${pinMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
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
              <div className="relative" onClick={handlePlanoClick}>
                <img
                  ref={imgRef}
                  src={currentPlano.imagenUrl}
                  alt={currentPlano.nombre}
                  className="max-w-none"
                  style={{ maxHeight: '85vh', maxWidth: '95vw', objectFit: 'contain' }}
                  draggable={false}
                />

                {/* Pines renderizados sobre la imagen */}
                {showPins && pines.map((pin: any) => {
                  const estado = pin.itemEstado || "sin_item";
                  const colors = PIN_COLORS[estado] || PIN_COLORS.sin_item;
                  const isSelected = selectedPin?.id === pin.id;

                  return (
                    <div
                      key={pin.id}
                      className="absolute group"
                      style={{
                        left: `${parseFloat(pin.posX)}%`,
                        top: `${parseFloat(pin.posY)}%`,
                        transform: 'translate(-50%, -100%)',
                        zIndex: isSelected ? 50 : 10,
                      }}
                      onClick={(e) => { e.stopPropagation(); setSelectedPin(isSelected ? null : pin); }}
                    >
                      {/* Pin marker */}
                      <div
                        className="relative flex flex-col items-center"
                        style={{ filter: isSelected ? 'drop-shadow(0 0 6px rgba(255,255,255,0.8))' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                      >
                        <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
                          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill={colors.bg} stroke={colors.border} strokeWidth="1.5"/>
                          <circle cx="14" cy="13" r="5" fill="white" fillOpacity="0.9"/>
                          <text x="14" y="16" textAnchor="middle" fontSize="8" fontWeight="bold" fill={colors.bg}>
                            {pin.itemConsecutivo || "#"}
                          </text>
                        </svg>
                      </div>

                      {/* Tooltip al seleccionar */}
                      {isSelected && (
                        <div
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white rounded-lg shadow-xl border border-slate-200 p-2.5 min-w-[200px] max-w-[280px] z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-start gap-2">
                            {pin.itemFotoAntes && (
                              <img src={pin.itemFotoAntes} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              {pin.itemCodigo && (
                                <p className="text-xs font-bold text-slate-800 truncate">{pin.itemCodigo}</p>
                              )}
                              {pin.itemConsecutivo ? (
                                <p className="text-xs text-slate-500">#{pin.itemConsecutivo}</p>
                              ) : null}
                              {pin.itemDescripcion && (
                                <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{pin.itemDescripcion}</p>
                              )}
                              {pin.nota && !pin.itemId && (
                                <p className="text-xs text-slate-600 mt-0.5 italic">{pin.nota}</p>
                              )}
                              {pin.itemEstado && (
                                <span
                                  className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                  style={{ backgroundColor: colors.bg + '20', color: colors.bg }}
                                >
                                  {pin.itemEstado.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
                            {pin.itemId && (
                              <button
                                onClick={() => navigate(`/item/${pin.itemId}`)}
                                className="flex-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded px-2 py-1 font-medium flex items-center justify-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> Ver ítem
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm("¿Eliminar este pin?")) eliminarPin.mutate({ id: pin.id });
                              }}
                              className="text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded px-2 py-1 font-medium flex items-center justify-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Quitar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Navigation arrows */}
          {planos.length > 1 && (
            <>
              <button
                onClick={() => { setViewerIndex(i => (i - 1 + planos.length) % planos.length); resetView(); setSelectedPin(null); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white z-20"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => { setViewerIndex(i => (i + 1) % planos.length); resetView(); setSelectedPin(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white z-20"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Bottom thumbnails */}
          {planos.length > 1 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-black/80 overflow-x-auto">
              {planos.map((p: any, i: number) => (
                <button
                  key={p.id}
                  onClick={() => { setViewerIndex(i); resetView(); setSelectedPin(null); }}
                  className={`flex-shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-all ${
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

      {/* ========== DIALOG: Seleccionar ítem para pin ========== */}
      <Dialog open={showItemSelector} onOpenChange={(open) => { if (!open) { setShowItemSelector(false); setPendingPinPos(null); } }}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              Vincular Pin a Ítem
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            {/* Nota opcional */}
            <div>
              <label className="text-xs font-medium text-slate-600">Nota (opcional)</label>
              <Input value={pinNota} onChange={e => setPinNota(e.target.value)} placeholder="Nota del pin..." />
            </div>

            {/* Buscar ítem */}
            <div>
              <label className="text-xs font-medium text-slate-600">Buscar ítem para vincular</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  placeholder="Código, título o #consecutivo..."
                  className="pl-8"
                />
              </div>
            </div>

            {/* Lista de ítems */}
            <div className="flex-1 overflow-y-auto border rounded-lg divide-y max-h-[300px]">
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
                <div className="text-center py-6 text-sm text-slate-400">
                  No se encontraron ítems
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" onClick={() => { setShowItemSelector(false); setPendingPinPos(null); }} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={() => confirmPin()} className="flex-1 bg-slate-600 hover:bg-slate-700 text-white">
              Pin sin ítem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Agregar plano */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              Subir Plano
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Nombre del plano *</label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Planta Baja, Nivel 1, Azotea" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Número de nivel</label>
              <Input type="number" value={nivel} onChange={e => setNivel(e.target.value)} placeholder="0" />
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
                  <img src={previewUrl} alt="Preview" className="w-full h-40 object-contain bg-slate-50 rounded-lg border" />
                  <button
                    onClick={() => { setPreviewUrl(""); setImagenBase64(""); setImagenNombre(""); }}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={crearPlano.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {crearPlano.isPending ? "Subiendo..." : "Subir Plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar plano */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              Editar Plano
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={actualizarPlano.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {actualizarPlano.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
