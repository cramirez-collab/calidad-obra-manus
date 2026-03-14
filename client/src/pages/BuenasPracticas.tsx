import { useState, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  ShieldCheck,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  Archive,
  Eye,
  X,
  Upload,
  Camera,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Award,
  TrendingUp,
  Users,
  ArrowLeft,
  Building2,
  FileText,
  Star,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { compressAdaptive } from "@/lib/imageCompression";

// Categorías de buenas prácticas
const CATEGORIAS: { value: string; label: string; Icon: LucideIcon; color: string }[] = [
  { value: "epp", label: "EPP", Icon: ShieldCheck, color: "bg-blue-100 text-blue-700" },
  { value: "orden_limpieza", label: "Orden y Limpieza", Icon: Sparkles, color: "bg-emerald-100 text-emerald-700" },
  { value: "señalizacion", label: "Señalización", Icon: Eye, color: "bg-amber-100 text-amber-700" },
  { value: "procedimiento", label: "Procedimiento", Icon: FileText, color: "bg-purple-100 text-purple-700" },
  { value: "capacitacion", label: "Capacitación", Icon: Award, color: "bg-indigo-100 text-indigo-700" },
  { value: "innovacion", label: "Innovación", Icon: Lightbulb, color: "bg-yellow-100 text-yellow-700" },
  { value: "mejora_continua", label: "Mejora Continua", Icon: TrendingUp, color: "bg-teal-100 text-teal-700" },
  { value: "otro", label: "Otro", Icon: Star, color: "bg-gray-100 text-gray-700" },
];

const PRIORIDADES = [
  { value: "baja", label: "Baja", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "media", label: "Media", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "alta", label: "Alta", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "critica", label: "Crítica", color: "bg-red-100 text-red-700 border-red-200" },
];

const ESTADOS_BP = [
  { value: "activa", label: "Activa", color: "bg-blue-100 text-blue-700 border-blue-200", Icon: Clock },
  { value: "implementada", label: "Implementada", color: "bg-green-100 text-green-700 border-green-200", Icon: CheckCircle2 },
  { value: "archivada", label: "Archivada", color: "bg-gray-100 text-gray-700 border-gray-200", Icon: Archive },
];

type ViewMode = "grid" | "detail";

export default function BuenasPracticas() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, userProjects } = useProject();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBP, setSelectedBP] = useState<any>(null);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const proyectoActual = userProjects?.find((p: any) => p.id === selectedProjectId);

  const bpList = trpc.buenasPracticas.list.useQuery(
    { proyectoId: selectedProjectId!, categoria: filtroCategoria || undefined, estado: filtroEstado || undefined },
    { enabled: !!selectedProjectId }
  );

  const bpStats = trpc.buenasPracticas.stats.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  if (!selectedProjectId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Selecciona un proyecto primero</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-3 py-4">
        {/* Header con botón mejorado */}
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setLocation('/bienvenida')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold tracking-tight">Buenas Prácticas (BP)</h1>
            <p className="text-xs text-muted-foreground truncate">{proyectoActual?.nombre || "Proyecto"}</p>
          </div>

          {/* BOTÓN PRINCIPAL — con hover, tooltip, accesibilidad, estados */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setShowCreate(true)}
                className="
                  relative group
                  bg-gradient-to-r from-emerald-500 to-teal-600
                  hover:from-emerald-600 hover:to-teal-700
                  active:from-emerald-700 active:to-teal-800
                  text-white font-semibold
                  shadow-md hover:shadow-xl hover:shadow-emerald-500/25
                  transition-all duration-300 ease-out
                  hover:-translate-y-0.5 active:translate-y-0
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:hover:translate-y-0
                  rounded-xl px-4 py-2.5 h-auto
                "
                aria-label="Registrar nueva Buena Práctica de Seguridad"
              >
                <Plus className="h-4 w-4 mr-1.5 transition-transform duration-200 group-hover:rotate-90" />
                <span className="hidden sm:inline">Nueva BP</span>
                <span className="sm:hidden">BP</span>
                {/* Efecto de brillo en hover */}
                <span className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-center p-3">
              <p className="font-medium text-sm">Registrar Buena Práctica</p>
              <p className="text-xs text-muted-foreground mt-1">
                Documenta prácticas seguras, adjunta evidencias y comparte mejoras de seguridad con el equipo.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* KPIs */}
        {bpStats.data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            <KPICard
              label="Total"
              value={Number(bpStats.data.total) || 0}
              icon={FileText}
              color="text-slate-600"
              bgColor="bg-slate-50"
              onClick={() => setFiltroEstado("")}
              active={!filtroEstado}
            />
            <KPICard
              label="Activas"
              value={Number(bpStats.data.activas) || 0}
              icon={Clock}
              color="text-blue-600"
              bgColor="bg-blue-50"
              onClick={() => setFiltroEstado(filtroEstado === "activa" ? "" : "activa")}
              active={filtroEstado === "activa"}
            />
            <KPICard
              label="Implementadas"
              value={Number(bpStats.data.implementadas) || 0}
              icon={CheckCircle2}
              color="text-emerald-600"
              bgColor="bg-emerald-50"
              onClick={() => setFiltroEstado(filtroEstado === "implementada" ? "" : "implementada")}
              active={filtroEstado === "implementada"}
            />
            <KPICard
              label="Categorías"
              value={Number(bpStats.data.categorias) || 0}
              icon={Sparkles}
              color="text-purple-600"
              bgColor="bg-purple-50"
            />
          </div>
        )}

        {/* Filtros de categoría */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button
            onClick={() => setFiltroCategoria("")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              !filtroCategoria
                ? "bg-foreground text-background shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Todas
          </button>
          {CATEGORIAS.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFiltroCategoria(filtroCategoria === cat.value ? "" : cat.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                filtroCategoria === cat.value
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              <cat.Icon className="h-3 w-3" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Lista de BPs */}
        {bpList.isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        ) : !bpList.data?.length ? (
          <EmptyState onCreateClick={() => setShowCreate(true)} />
        ) : (
          <div className="space-y-3">
            {bpList.data.map((bp: any) => (
              <BPCard key={bp.id} bp={bp} onClick={() => setSelectedBP(bp)} />
            ))}
          </div>
        )}

        {/* Dialog crear BP */}
        {showCreate && (
          <CrearBPDialog
            proyectoId={selectedProjectId}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              bpList.refetch();
              bpStats.refetch();
            }}
          />
        )}

        {/* Dialog detalle BP */}
        {selectedBP && (
          <DetalleBPDialog
            bpId={selectedBP.id}
            onClose={() => setSelectedBP(null)}
            onUpdated={() => {
              bpList.refetch();
              bpStats.refetch();
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

// ============ KPI Card ============
function KPICard({ label, value, icon: Icon, color, bgColor, onClick, active }: {
  label: string; value: number; icon: LucideIcon; color: string; bgColor: string;
  onClick?: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-xl border transition-all text-left w-full ${
        active ? "ring-2 ring-emerald-500 border-emerald-300 shadow-sm" : "border-border/50 hover:border-border"
      } ${bgColor}`}
      disabled={!onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </button>
  );
}

// ============ Empty State ============
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-4">
        <ShieldCheck className="h-8 w-8 text-emerald-500" />
      </div>
      <h3 className="font-semibold text-lg mb-1">Sin buenas prácticas registradas</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Documenta prácticas seguras, adjunta evidencias y comparte mejoras de seguridad con el equipo.
      </p>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onCreateClick}
            className="
              group bg-gradient-to-r from-emerald-500 to-teal-600
              hover:from-emerald-600 hover:to-teal-700
              active:from-emerald-700 active:to-teal-800
              text-white font-semibold rounded-xl px-6 py-3 h-auto
              shadow-md hover:shadow-xl hover:shadow-emerald-500/25
              transition-all duration-300 ease-out
              hover:-translate-y-0.5 active:translate-y-0
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2
            "
            aria-label="Registrar primera Buena Práctica de Seguridad"
          >
            <Plus className="h-4 w-4 mr-2 transition-transform duration-200 group-hover:rotate-90" />
            Registrar primera BP
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-center p-3">
          <p className="text-xs">Registrar o consultar Buenas Prácticas de Seguridad. Permite documentar prácticas seguras, adjuntar evidencias y compartir mejoras de seguridad.</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ============ BP Card ============
function BPCard({ bp, onClick }: { bp: any; onClick: () => void }) {
  const cat = CATEGORIAS.find(c => c.value === bp.categoria);
  const estado = ESTADOS_BP.find(e => e.value === bp.estado);
  const prioridad = PRIORIDADES.find(p => p.value === bp.prioridad);
  const CatIcon = cat?.Icon || Star;
  const EstadoIcon = estado?.Icon || Clock;

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all duration-200 active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${cat?.color || "bg-gray-100 text-gray-700"}`}>
          <CatIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] font-mono shrink-0">{bp.codigo}</Badge>
            <Badge className={`text-[10px] ${estado?.color || ""}`}>
              <EstadoIcon className="h-3 w-3 mr-0.5" />
              {estado?.label || bp.estado}
            </Badge>
            {prioridad && bp.prioridad !== "media" && (
              <Badge className={`text-[10px] ${prioridad.color}`}>{prioridad.label}</Badge>
            )}
          </div>
          <h3 className="font-medium text-sm leading-tight line-clamp-2">{bp.titulo}</h3>
          {bp.descripcion && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{bp.descripcion}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            {bp.empresaNombre && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {bp.empresaNombre}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {bp.creadoPorNombre}
            </span>
            <span>{bp.createdAt ? format(new Date(bp.createdAt), "dd MMM", { locale: es }) : ""}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============ Crear BP Dialog ============
function CrearBPDialog({ proyectoId, onClose, onCreated }: { proyectoId: number; onClose: () => void; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [prioridad, setPrioridad] = useState("media");
  const [ubicacion, setUbicacion] = useState("");
  const [beneficio, setBeneficio] = useState("");
  const [evidencias, setEvidencias] = useState<{ url: string; fileKey: string; descripcion: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createMutation = trpc.buenasPracticas.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Buena Práctica ${data.codigo} registrada`);
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleUploadPhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // Read file as base64 for compression
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const result = await compressAdaptive(base64);
        // Convert base64 back to blob for FormData upload
        const fetchRes = await fetch(result.compressed);
        const blob = await fetchRes.blob();
        const formData = new FormData();
        formData.append("file", blob, `bp-evidencia-${Date.now()}.jpg`);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Error al subir imagen");
        const data = await res.json();
        setEvidencias(prev => [...prev, { url: data.url, fileKey: data.key, descripcion: "" }]);
      }
      toast.success("Evidencia(s) adjuntada(s)");
    } catch (err) {
      toast.error("Error al subir imagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, []);

  const handleSubmit = () => {
    if (!titulo.trim() || !categoria) {
      toast.error("Título y categoría son obligatorios");
      return;
    }
    createMutation.mutate({
      proyectoId,
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || undefined,
      categoria,
      prioridad,
      ubicacion: ubicacion.trim() || undefined,
      beneficio: beneficio.trim() || undefined,
      evidencias: evidencias.length ? evidencias : undefined,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Nueva Buena Práctica
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Título */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
            <Input
              placeholder="Ej: Uso correcto de arnés en trabajos en altura"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Categoría *</label>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategoria(cat.value)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-all ${
                    categoria === cat.value
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                      : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <cat.Icon className="h-3.5 w-3.5" />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción</label>
            <Textarea
              placeholder="Describe la buena práctica..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Prioridad */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Prioridad</label>
            <div className="flex gap-1.5">
              {PRIORIDADES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPrioridad(p.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    prioridad === p.value
                      ? p.color + " shadow-sm"
                      : "border-border/50 text-muted-foreground hover:border-border"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ubicación */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Ubicación</label>
            <Input
              placeholder="Ej: Torre A, Nivel 5"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Beneficio */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Beneficio</label>
            <Textarea
              placeholder="¿Qué beneficio aporta esta práctica?"
              value={beneficio}
              onChange={(e) => setBeneficio(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Evidencias */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Evidencias fotográficas</label>
            <div className="flex flex-wrap gap-2">
              {evidencias.map((ev, i) => (
                <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border">
                  <img src={ev.url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setEvidencias(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X className="h-2.5 w-2.5 text-white" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="h-16 w-16 rounded-lg border-2 border-dashed border-border/60 flex items-center justify-center hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Camera className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUploadPhoto}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !titulo.trim() || !categoria}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
            Registrar BP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Detalle BP Dialog ============
function DetalleBPDialog({ bpId, onClose, onUpdated }: { bpId: number; onClose: () => void; onUpdated: () => void }) {
  const { user } = useAuth();
  const bpDetail = trpc.buenasPracticas.getById.useQuery({ id: bpId });
  const updateEstado = trpc.buenasPracticas.updateEstado.useMutation({
    onSuccess: () => {
      toast.success("Estado actualizado");
      bpDetail.refetch();
      onUpdated();
    },
    onError: (err) => toast.error(err.message),
  });

  const addEvidencia = trpc.buenasPracticas.addEvidencia.useMutation({
    onSuccess: () => {
      toast.success("Evidencia agregada");
      bpDetail.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const result = await compressAdaptive(base64);
        const fetchRes = await fetch(result.compressed);
        const blob = await fetchRes.blob();
        const formData = new FormData();
        formData.append("file", blob, `bp-evidencia-${Date.now()}.jpg`);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Error al subir imagen");
        const data = await res.json();
        addEvidencia.mutate({ buenaPracticaId: bpId, url: data.url, fileKey: data.key });
      }
    } catch (err) {
      toast.error("Error al subir imagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [bpId, addEvidencia]);

  const bp = bpDetail.data;
  if (!bp) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const cat = CATEGORIAS.find(c => c.value === bp.categoria);
  const estado = ESTADOS_BP.find(e => e.value === bp.estado);
  const prioridad = PRIORIDADES.find(p => p.value === bp.prioridad);
  const CatIcon = cat?.Icon || Star;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CatIcon className={`h-5 w-5 ${cat?.color?.split(" ")[1] || "text-gray-500"}`} />
            {bp.codigo} — {bp.titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Estado y prioridad */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={estado?.color || ""}>{estado?.label || bp.estado}</Badge>
            {prioridad && <Badge className={prioridad.color}>{prioridad.label}</Badge>}
            {cat && <Badge className={cat.color}>{cat.label}</Badge>}
          </div>

          {/* Descripción */}
          {bp.descripcion && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descripción</label>
              <p className="text-sm mt-1">{bp.descripcion}</p>
            </div>
          )}

          {/* Beneficio */}
          {bp.beneficio && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Beneficio</label>
              <p className="text-sm mt-1">{bp.beneficio}</p>
            </div>
          )}

          {/* Ubicación */}
          {bp.ubicacion && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Ubicación</label>
              <p className="text-sm mt-1">{bp.ubicacion}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Creado por</span>
              <p className="font-medium">{bp.creadoPorNombre}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Fecha</span>
              <p className="font-medium">{bp.createdAt ? format(new Date(bp.createdAt), "dd MMM yyyy", { locale: es }) : "—"}</p>
            </div>
            {bp.empresaNombre && (
              <div>
                <span className="text-muted-foreground">Empresa</span>
                <p className="font-medium">{bp.empresaNombre}</p>
              </div>
            )}
            {bp.aprobadoPorNombre && (
              <div>
                <span className="text-muted-foreground">Aprobado por</span>
                <p className="font-medium">{bp.aprobadoPorNombre}</p>
              </div>
            )}
          </div>

          {/* Evidencias */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Evidencias ({bp.evidencias?.length || 0})</label>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Agregar
              </button>
            </div>
            {bp.evidencias?.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {bp.evidencias.map((ev: any) => (
                  <div key={ev.id} className="aspect-square rounded-lg overflow-hidden border">
                    <img src={ev.url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sin evidencias adjuntas</p>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          </div>

          {/* Acciones de estado */}
          {bp.estado !== "archivada" && (
            <div className="flex gap-2 pt-2 border-t">
              {bp.estado === "activa" && (
                <Button
                  size="sm"
                  onClick={() => updateEstado.mutate({ id: bpId, estado: "implementada" })}
                  disabled={updateEstado.isPending}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white flex-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Marcar Implementada
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateEstado.mutate({ id: bpId, estado: "archivada" })}
                disabled={updateEstado.isPending}
                className="flex-1"
              >
                <Archive className="h-3.5 w-3.5 mr-1" />
                Archivar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
