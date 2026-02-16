import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ResidenteSelector from "@/components/ResidenteSelector";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  Check,
  X,
  Loader2,
  MapPin,
  Layers,
  AlertTriangle,
  Building2,
  Wrench,
  User,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Eye,
} from "lucide-react";
import { compressAdaptive } from "@/lib/imageCompression";
import { isOnline, savePendingAction } from "@/lib/offlineStorage";
import { getImageUrl } from "@/lib/imageUrl";
import { useLocation } from "wouter";

interface CapturaRapidaProps {
  pinPos: { x: number; y: number } | null;
  planoId?: number;
  planoNivel?: number | null;
  onClose: () => void;
  onItemCreated: (item: any) => void;
  onContinuePin?: () => void;
  onLinkExistingItem?: (itemId: number) => void;
  existingItems?: any[];
  headerTitle?: string;
  headerSubtitle?: string;
}

export default function CapturaRapida({
  pinPos,
  planoId,
  planoNivel,
  onClose,
  onItemCreated,
  onContinuePin,
  onLinkExistingItem,
  existingItems,
  headerTitle,
  headerSubtitle,
}: CapturaRapidaProps) {
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const [, navigate] = useLocation();
  const hasPin = !!pinPos;
  const [activeTab, setActiveTab] = useState<"crear" | "vincular">("crear");
  const [linkSearch, setLinkSearch] = useState("");

  const filteredExistingItems = useMemo(() => {
    if (!existingItems) return [];
    if (!linkSearch.trim()) return existingItems.slice(0, 30);
    const q = linkSearch.toLowerCase();
    return existingItems.filter((it: any) =>
      it.codigo?.toLowerCase().includes(q) ||
      it.titulo?.toLowerCase().includes(q) ||
      String(it.numeroInterno || "").includes(q)
    ).slice(0, 30);
  }, [existingItems, linkSearch]);

  // Form state
  const [residenteId, setResidenteId] = useState("");
  const [unidadId, setUnidadId] = useState("");
  const [nivelId, setNivelId] = useState(planoNivel?.toString() || "");
  const [espacioId, setEspacioId] = useState("");
  const [defectoId, setDefectoId] = useState("");
  const [fotoAntes, setFotoAntes] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Catálogos
  const catStale = { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 };

  const { data: residentesConEmpresasNuevo } = trpc.empresas.getAllResidentesConEmpresas.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId, ...catStale }
  );

  const { data: especialidades } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId, ...catStale }
  );

  const { data: todasUnidades } = trpc.unidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId, ...catStale }
  );

  const { data: espaciosPlantilla } = trpc.espacios.plantilla.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId, ...catStale }
  );

  // Residentes con empresa
  const residentesConEmpresa = useMemo(() => {
    if (!residentesConEmpresasNuevo) return [];
    const residentesMap = new Map<number, any>();
    residentesConEmpresasNuevo.forEach((residente: any) => {
      residente.empresas?.forEach((emp: any) => {
        const key = residente.id * 10000 + emp.empresaId;
        if (!residentesMap.has(key)) {
          residentesMap.set(key, {
            id: residente.id,
            name: residente.name || "Sin nombre",
            empresaId: emp.empresaId,
            empresaNombre: emp.empresaNombre,
            especialidadId: emp.especialidadId || null,
            especialidadNombre: emp.especialidadNombre || null,
            tipoResidente: emp.tipoResidente,
          });
        }
      });
    });
    return Array.from(residentesMap.values());
  }, [residentesConEmpresasNuevo]);

  // Residente seleccionado
  const residenteSeleccionado = useMemo(() => {
    if (!residenteId) return null;
    return residentesConEmpresa.find((r: any) => r.id.toString() === residenteId);
  }, [residenteId, residentesConEmpresa]);

  // Especialidad del residente
  const especialidadDelResidente = useMemo(() => {
    if (!residenteSeleccionado?.especialidadId || !especialidades) return null;
    return especialidades.find((e: any) => e.id === residenteSeleccionado.especialidadId);
  }, [residenteSeleccionado, especialidades]);

  // Niveles únicos
  const niveles = useMemo(() => {
    if (!todasUnidades) return [];
    const nivelesSet = new Set(todasUnidades.map((u: any) => u.nivel).filter(Boolean));
    return Array.from(nivelesSet).sort((a: any, b: any) => (a || 0) - (b || 0));
  }, [todasUnidades]);

  // Unidades filtradas por nivel
  const unidades = useMemo(() => {
    if (!todasUnidades) return [];
    if (!nivelId) return todasUnidades;
    return todasUnidades.filter((u: any) => u.nivel?.toString() === nivelId);
  }, [todasUnidades, nivelId]);

  // Defectos por especialidad
  const especialidadIdParaDefectos = residenteSeleccionado?.especialidadId || 0;
  const { data: defectos } = trpc.defectos.byEspecialidad.useQuery(
    { especialidadId: especialidadIdParaDefectos },
    { enabled: !!especialidadIdParaDefectos, ...catStale }
  );

  const createItemMutation = trpc.items.create.useMutation();

  // Auto-completar al seleccionar residente
  useEffect(() => {
    if (residenteSeleccionado) {
      setDefectoId("");
    }
  }, [residenteSeleccionado]);

  // Comprimir imagen
  const compressImage = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          const result = await compressAdaptive(base64);
          resolve(result.compressed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Manejar foto
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Solo imágenes"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("Máximo 15MB"); return; }
    setIsCapturing(true);
    try {
      const compressed = await compressImage(file);
      setFotoAntes(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => setFotoAntes(ev.target?.result as string);
      reader.readAsDataURL(file);
    } finally {
      setIsCapturing(false);
      e.target.value = "";
    }
  }, [compressImage]);

  // Submit
  const handleSubmit = async () => {
    if (!residenteId) { toast.error("Selecciona un residente"); return; }
    if (!unidadId) { toast.error("Selecciona una unidad"); return; }
    if (!fotoAntes) { toast.error("Se requiere una foto"); return; }
    if (!residenteSeleccionado?.empresaId) { toast.error("Residente sin empresa"); return; }

    setIsSubmitting(true);

    const defectoSeleccionado = defectos?.find((d: any) => d.id.toString() === defectoId);
    const tituloFinal = defectoSeleccionado?.nombre || "Sin título";
    const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const itemData = {
      proyectoId: selectedProjectId || 0,
      empresaId: residenteSeleccionado.empresaId,
      unidadId: parseInt(unidadId),
      especialidadId: residenteSeleccionado.especialidadId || undefined,
      defectoId: defectoId ? parseInt(defectoId) : undefined,
      espacioId: espacioId ? parseInt(espacioId) : undefined,
      titulo: tituloFinal,
      fotoAntesBase64: fotoAntes,
      clientId,
      pinPlanoId: hasPin && planoId ? planoId : undefined,
      pinPosX: hasPin && pinPos ? pinPos.x.toFixed(4) : undefined,
      pinPosY: hasPin && pinPos ? pinPos.y.toFixed(4) : undefined,
    };

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (isOnline()) {
          const result = await createItemMutation.mutateAsync(itemData);
          toast.success(`Ítem ${result.codigo} creado`);
          onItemCreated(result);
          // Reset form para siguiente captura
          setFotoAntes(null);
          setResidenteId("");
          setUnidadId("");
          setEspacioId("");
          setDefectoId("");
          setIsSubmitting(false);
          return;
        } else {
          await savePendingAction({ type: "create_item", data: itemData });
          toast.success("Guardado offline. Se sincronizará.", { icon: "📡" });
          onItemCreated({ codigo: "OFFLINE", titulo: tituloFinal, id: 0 });
          setFotoAntes(null);
          setResidenteId("");
          setUnidadId("");
          setEspacioId("");
          setDefectoId("");
          setIsSubmitting(false);
          return;
        }
      } catch (error: any) {
        if (attempt === maxRetries) {
          try {
            await savePendingAction({ type: "create_item", data: itemData });
            toast.success("Guardado offline como respaldo.", { icon: "📡" });
            onItemCreated({ codigo: "OFFLINE", titulo: tituloFinal, id: 0 });
          } catch {
            toast.error("Error al crear ítem");
          }
        }
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    setIsSubmitting(false);
  };

  // Validación
  const canSubmit = !!residenteId && !!unidadId && !!fotoAntes && !isSubmitting;

  return (
    <div className="fixed inset-0 z-[250] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Force Select portals above this overlay */}
        <style>{`
          [data-radix-popper-content-wrapper] { z-index: 300 !important; }
        `}</style>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b bg-gradient-to-r from-emerald-50 to-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">{headerTitle || "Captura Rápida"}</h3>
              <p className="text-[10px] text-slate-500">
                {headerSubtitle || (hasPin && pinPos ? `Pin en (${pinPos.x.toFixed(0)}%, ${pinPos.y.toFixed(0)}%) — Nivel ${planoNivel ?? 0}` : "Nuevo ítem sin ubicación en plano")}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs: Crear / Vincular */}
        {onLinkExistingItem && existingItems && (
          <div className="flex border-b flex-shrink-0">
            <button
              onClick={() => setActiveTab("crear")}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${activeTab === "crear" ? "text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50" : "text-slate-400 hover:text-slate-600"}`}
            >
              Crear Nuevo Ítem
            </button>
            <button
              onClick={() => setActiveTab("vincular")}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${activeTab === "vincular" ? "text-blue-600 border-b-2 border-blue-500 bg-blue-50/50" : "text-slate-400 hover:text-slate-600"}`}
            >
              <span className="flex items-center justify-center gap-1"><ListChecks className="w-3 h-3" /> Vincular Existente</span>
            </button>
          </div>
        )}

        {/* Vincular tab */}
        {activeTab === "vincular" && onLinkExistingItem && existingItems && (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <div className="relative">
              <Eye className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={linkSearch}
                onChange={e => setLinkSearch(e.target.value)}
                placeholder="Buscar por código, título o #consecutivo..."
                className="w-full pl-8 pr-3 h-9 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div className="border rounded-lg divide-y max-h-[50vh] overflow-y-auto">
              {filteredExistingItems.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => onLinkExistingItem(item.id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2"
                >
                  {item.fotoAntesUrl && <img src={item.fotoAntesUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{item.codigo}</p>
                    <p className="text-[10px] text-slate-500 truncate">{item.titulo}</p>
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-slate-500">#{item.numeroInterno}</span>
                </button>
              ))}
              {filteredExistingItems.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400">No se encontraron ítems</div>
              )}
            </div>
          </div>
        )}

        {/* Scrollable form (crear tab) */}
        <div className={`flex-1 overflow-y-auto px-4 py-3 space-y-3 ${activeTab === "vincular" ? "hidden" : ""}`}>
          {/* Inputs ocultos */}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />

          {/* FOTO */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
              <Camera className="w-3 h-3" /> Foto *
            </label>
            {isCapturing ? (
              <div className="flex items-center justify-center h-16 gap-2 bg-slate-50 rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                <span className="text-xs text-slate-500">Procesando...</span>
              </div>
            ) : fotoAntes ? (
              <div className="relative">
                <img
                  src={getImageUrl(fotoAntes)}
                  alt="Foto"
                  className="w-full h-28 object-cover rounded-lg"
                />
                <button
                  onClick={() => setFotoAntes(null)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="absolute bottom-1 right-1 px-2 py-0.5 bg-black/60 text-white rounded text-[10px]"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-16 border-2 border-dashed border-emerald-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-emerald-50 transition-colors"
                >
                  <Camera className="h-5 w-5 text-emerald-500" />
                  <span className="text-[10px] text-emerald-700 font-medium">Tomar Foto</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-16 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-colors"
                >
                  <Upload className="h-5 w-5 text-slate-400" />
                  <span className="text-[10px] text-slate-500">Subir</span>
                </button>
              </div>
            )}
          </div>

          {/* ASIGNACIÓN - A quién se asigna para corregir */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
              <User className="w-3 h-3" /> Asignación *
            </label>
            <ResidenteSelector
              value={residenteId}
              onValueChange={(v) => { setResidenteId(v); setDefectoId(""); }}
              residentes={residentesConEmpresa}
              placeholder="Seleccionar Responsable"
            />
            {residenteSeleccionado && (
              <div className="flex items-center gap-2 mt-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-800">
                <Building2 className="h-3 w-3 text-amber-500" />
                <span className="font-medium">{residenteSeleccionado.empresaNombre}</span>
                <span className="text-[9px] text-amber-600 ml-auto">Debe corregir</span>
                {especialidadDelResidente && (
                  <Badge variant="outline" className="text-[9px] py-0 border-amber-300 text-amber-700">
                    <Wrench className="h-2 w-2 mr-0.5" />
                    {especialidadDelResidente.nombre}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* UBICACIÓN: Nivel + Unidad */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
              <MapPin className="w-3 h-3" /> Ubicación *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={nivelId} onValueChange={(v) => { setNivelId(v); setUnidadId(""); }}>
                <SelectTrigger className="h-9 text-xs">
                  <Layers className="h-3 w-3 mr-1 text-slate-400" />
                  <SelectValue placeholder="Nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {niveles.map((n: any) => (
                    <SelectItem key={n} value={n?.toString() || ""}>Nivel {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={unidadId} onValueChange={setUnidadId}>
                <SelectTrigger className="h-9 text-xs">
                  <MapPin className="h-3 w-3 mr-1 text-slate-400" />
                  <SelectValue placeholder="Unidad *" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u: any) => (
                    <SelectItem key={u.id} value={u.id.toString()}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ESPACIO + DEFECTO */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
              <AlertTriangle className="w-3 h-3" /> Espacio y Defecto
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={espacioId} onValueChange={setEspacioId}>
                <SelectTrigger className="h-9 text-xs">
                  <Layers className="h-3 w-3 mr-1 text-slate-400" />
                  <SelectValue placeholder={espaciosPlantilla?.length ? "Espacio" : "Sin espacios"} />
                </SelectTrigger>
                <SelectContent>
                  {espaciosPlantilla?.map((e: any) => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={defectoId}
                onValueChange={setDefectoId}
                disabled={!residenteSeleccionado?.especialidadId || !defectos || defectos.length === 0}
              >
                <SelectTrigger className="h-9 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1 text-slate-400" />
                  <SelectValue placeholder="Defecto" />
                </SelectTrigger>
                <SelectContent>
                  {defectos?.map((d: any) => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${
                          d.severidad === "leve" ? "bg-green-500" :
                          d.severidad === "moderado" ? "bg-yellow-500" :
                          d.severidad === "grave" ? "bg-orange-500" : "bg-red-500"
                        }`} />
                        {d.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Footer con botones de acción */}
        {activeTab === "crear" && (
          <div className="flex-shrink-0 border-t bg-slate-50 px-4 py-3 flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Crear Ítem
                </div>
              )}
            </Button>
          </div>
        )}
        {activeTab === "vincular" && (
          <div className="flex-shrink-0 border-t bg-slate-50 px-4 py-3">
            <Button variant="outline" onClick={onClose} className="w-full h-11">Cancelar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
