import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, ZoomIn, ZoomOut, RotateCcw, Layers, Image as ImageIcon, X, Upload, ChevronLeft, ChevronRight } from "lucide-react";

export default function Planos() {
  const { user } = useAuth();
  const isAdmin = user?.role === "superadmin" || user?.role === "admin";
  const selectedProjectId = user?.proyectoActivoId;

  const { data: planosData, isLoading, refetch } = trpc.planos.listar.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  const crearPlano = trpc.planos.crear.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano subido correctamente"); setShowAddDialog(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const actualizarPlano = trpc.planos.actualizar.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano actualizado"); setShowEditDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const eliminarPlano = trpc.planos.eliminar.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano eliminado"); },
    onError: (e) => toast.error(e.message),
  });

  // State
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
    setShowViewer(true);
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Touch/mouse pan handlers for viewer
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  };
  const handleTouchEnd = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.2, Math.min(5, prev + delta)));
  };

  const planos = planosData || [];
  const currentPlano = planos[viewerIndex];

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

      {/* Visor fullscreen */}
      {showViewer && currentPlano && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/80 text-white">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowViewer(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5" />
              </button>
              <div>
                <span className="font-semibold text-sm">{currentPlano.nombre}</span>
                <span className="text-xs text-white/60 ml-2">Nivel {currentPlano.nivel ?? 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} className="p-2 hover:bg-white/10 rounded-lg">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(5, z + 0.2))} className="p-2 hover:bg-white/10 rounded-lg">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={resetView} className="p-2 hover:bg-white/10 rounded-lg ml-1">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Image area */}
          <div
            ref={viewerRef}
            className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none"
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
              className="w-full h-full flex items-center justify-center"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: isDragging ? 'none' : 'transform 0.1s' }}
            >
              <img
                src={currentPlano.imagenUrl}
                alt={currentPlano.nombre}
                className="max-w-none"
                style={{ maxHeight: '90vh', maxWidth: '95vw', objectFit: 'contain' }}
                draggable={false}
              />
            </div>
          </div>

          {/* Navigation arrows */}
          {planos.length > 1 && (
            <>
              <button
                onClick={() => { setViewerIndex(i => (i - 1 + planos.length) % planos.length); resetView(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => { setViewerIndex(i => (i + 1) % planos.length); resetView(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white"
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
                  onClick={() => { setViewerIndex(i); resetView(); }}
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
