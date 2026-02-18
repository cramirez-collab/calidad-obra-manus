import { useState, useRef, useCallback } from "react";
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
import {
  Shield,
  AlertTriangle,
  Camera,
  ImageIcon,
  Send,
  BarChart3,
  ClipboardCheck,
  Plus,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  Zap,
  HardHat,
  Eye,
  X,
  MessageCircle,
} from "lucide-react";
import { compressAdaptive } from "@/lib/imageCompression";

// Tipos de incidente con labels y colores
const TIPOS_INCIDENTE = [
  { value: "caida", label: "Caída", icon: "🧗", color: "bg-red-100 text-red-700" },
  { value: "golpe", label: "Golpe", icon: "💥", color: "bg-orange-100 text-orange-700" },
  { value: "corte", label: "Corte", icon: "🔪", color: "bg-rose-100 text-rose-700" },
  { value: "electrico", label: "Eléctrico", icon: "⚡", color: "bg-yellow-100 text-yellow-700" },
  { value: "derrumbe", label: "Derrumbe", icon: "🏚️", color: "bg-stone-100 text-stone-700" },
  { value: "incendio", label: "Incendio", icon: "🔥", color: "bg-red-100 text-red-700" },
  { value: "quimico", label: "Químico", icon: "☣️", color: "bg-purple-100 text-purple-700" },
  { value: "epp_faltante", label: "EPP Faltante", icon: "🦺", color: "bg-amber-100 text-amber-700" },
  { value: "condicion_insegura", label: "Condición Insegura", icon: "⚠️", color: "bg-yellow-100 text-yellow-700" },
  { value: "acto_inseguro", label: "Acto Inseguro", icon: "🚫", color: "bg-red-100 text-red-700" },
  { value: "casi_accidente", label: "Casi Accidente", icon: "😰", color: "bg-blue-100 text-blue-700" },
  { value: "otro", label: "Otro", icon: "📋", color: "bg-gray-100 text-gray-700" },
] as const;

const SEVERIDADES = [
  { value: "baja", label: "Baja", color: "bg-green-500", textColor: "text-green-700", bgLight: "bg-green-100" },
  { value: "media", label: "Media", color: "bg-yellow-500", textColor: "text-yellow-700", bgLight: "bg-yellow-100" },
  { value: "alta", label: "Alta", color: "bg-orange-500", textColor: "text-orange-700", bgLight: "bg-orange-100" },
  { value: "critica", label: "Crítica", color: "bg-red-500", textColor: "text-red-700", bgLight: "bg-red-100" },
] as const;

const ESTADOS = [
  { value: "abierto", label: "Abierto", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "en_proceso", label: "En Proceso", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "cerrado", label: "Cerrado", color: "bg-green-100 text-green-700 border-green-200" },
] as const;

type Tab = "reportar" | "incidentes" | "stats" | "checklist";

// Checklist predefinido de seguridad
const CHECKLIST_TEMPLATE = [
  { categoria: "EPP", pregunta: "Todo el personal usa casco de seguridad" },
  { categoria: "EPP", pregunta: "Uso de chaleco reflectante" },
  { categoria: "EPP", pregunta: "Calzado de seguridad adecuado" },
  { categoria: "EPP", pregunta: "Uso de guantes cuando aplica" },
  { categoria: "EPP", pregunta: "Uso de arnés en alturas >1.8m" },
  { categoria: "EPP", pregunta: "Protección auditiva en zonas ruidosas" },
  { categoria: "EPP", pregunta: "Lentes de seguridad cuando aplica" },
  { categoria: "Señalización", pregunta: "Señalización de riesgos visible" },
  { categoria: "Señalización", pregunta: "Cintas de precaución en zonas peligrosas" },
  { categoria: "Señalización", pregunta: "Rutas de evacuación señalizadas" },
  { categoria: "Orden", pregunta: "Área de trabajo limpia y ordenada" },
  { categoria: "Orden", pregunta: "Materiales almacenados correctamente" },
  { categoria: "Orden", pregunta: "Residuos clasificados y en contenedores" },
  { categoria: "Instalaciones", pregunta: "Andamios en buen estado" },
  { categoria: "Instalaciones", pregunta: "Escaleras aseguradas" },
  { categoria: "Instalaciones", pregunta: "Barandales de protección instalados" },
  { categoria: "Instalaciones", pregunta: "Instalaciones eléctricas protegidas" },
  { categoria: "Emergencias", pregunta: "Extintores accesibles y vigentes" },
  { categoria: "Emergencias", pregunta: "Botiquín de primeros auxilios disponible" },
  { categoria: "Emergencias", pregunta: "Personal capacitado en emergencias" },
];

export default function Seguridad() {
  const { selectedProjectId, userProjects } = useProject();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("reportar");

  const proyectoActual = userProjects?.find((p: any) => p.id === selectedProjectId);

  if (!selectedProjectId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Selecciona un proyecto primero</p>
        </div>
      </DashboardLayout>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: "reportar", label: "Reportar", icon: AlertTriangle },
    { id: "incidentes", label: "Incidentes", icon: Shield },
    { id: "stats", label: "Stats", icon: BarChart3 },
    { id: "checklist", label: "Checklist", icon: ClipboardCheck },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-3 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-red-500 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Seguridad</h1>
            <p className="text-xs text-muted-foreground">{proyectoActual?.nombre || "Proyecto"}</p>
          </div>
          {/* WhatsApp rápido */}
          <a
            href="https://chat.whatsapp.com/BV52XnzehB6GK3XfACTFTh"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto h-10 w-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
            title="Grupo WhatsApp Seguridad"
          >
            <MessageCircle className="h-5 w-5 text-white" />
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-red-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === "reportar" && <TabReportar proyectoId={selectedProjectId} />}
        {activeTab === "incidentes" && <TabIncidentes proyectoId={selectedProjectId} />}
        {activeTab === "stats" && <TabStats proyectoId={selectedProjectId} />}
        {activeTab === "checklist" && <TabChecklist proyectoId={selectedProjectId} />}
      </div>
    </DashboardLayout>
  );
}

// ==========================================
// TAB REPORTAR - Reporte ultra rápido
// ==========================================
function TabReportar({ proyectoId }: { proyectoId: number }) {
  const [tipo, setTipo] = useState<string>("");
  const [severidad, setSeveridad] = useState<string>("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const crearMut = trpc.seguridad.crearIncidente.useMutation({
    onSuccess: () => {
      toast.success("Incidente reportado exitosamente");
      setTipo("");
      setSeveridad("");
      setDescripcion("");
      setUbicacion("");
      setFotoBase64(null);
      setFotoPreview(null);
      utils.seguridad.listar.invalidate();
      utils.seguridad.estadisticas.invalidate();
    },
    onError: (e) => toast.error(e.message?.length > 100 ? "Error al reportar" : e.message),
  });

  const handlePhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const base64 = ev.target?.result as string;
        const result = await compressAdaptive(base64);
        setFotoBase64(result.compressed);
        setFotoPreview(result.compressed);
      } catch {
        const raw = ev.target?.result as string;
        setFotoBase64(raw);
        setFotoPreview(raw);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleSubmit = () => {
    if (!tipo) { toast.error("Selecciona el tipo de incidente"); return; }
    if (!severidad) { toast.error("Selecciona la severidad"); return; }
    if (!descripcion.trim()) { toast.error("Describe el incidente"); return; }
    crearMut.mutate({
      proyectoId,
      tipo: tipo as any,
      severidad: severidad as any,
      descripcion: descripcion.trim(),
      ubicacion: ubicacion.trim() || undefined,
      fotoBase64: fotoBase64 || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Tipo - Grid de selección rápida */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-2 block">Tipo de incidente *</label>
        <div className="grid grid-cols-3 gap-2">
          {TIPOS_INCIDENTE.map((t) => (
            <button
              key={t.value}
              onClick={() => setTipo(t.value)}
              className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                tipo === t.value
                  ? "border-red-500 bg-red-50 shadow-sm"
                  : "border-transparent bg-muted/30 hover:bg-muted/60"
              }`}
            >
              <span className="text-lg block">{t.icon}</span>
              <span className="text-[10px] font-medium leading-tight block mt-0.5">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Severidad */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-2 block">Severidad *</label>
        <div className="grid grid-cols-4 gap-2">
          {SEVERIDADES.map((s) => (
            <button
              key={s.value}
              onClick={() => setSeveridad(s.value)}
              className={`py-2.5 px-2 rounded-xl border-2 text-center transition-all ${
                severidad === s.value
                  ? `border-current ${s.bgLight} ${s.textColor} shadow-sm`
                  : "border-transparent bg-muted/30 hover:bg-muted/60"
              }`}
            >
              <div className={`h-2.5 w-2.5 rounded-full ${s.color} mx-auto mb-1`} />
              <span className="text-[10px] font-medium">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Foto */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-2 block">Evidencia fotográfica</label>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
        <input ref={galleryRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
        {fotoPreview ? (
          <div className="relative">
            <img src={fotoPreview} alt="Evidencia" className="w-full h-40 object-cover rounded-xl border" />
            <button
              onClick={() => { setFotoBase64(null); setFotoPreview(null); }}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => cameraRef.current?.click()}
              className="h-20 border-2 border-dashed border-red-300 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-red-50 transition-colors"
            >
              <Camera className="w-6 h-6 text-red-400" />
              <span className="text-[10px] font-medium text-red-500">Tomar Foto</span>
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="h-20 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-colors"
            >
              <ImageIcon className="w-6 h-6 text-slate-400" />
              <span className="text-[10px] font-medium text-slate-500">Subir de Galería</span>
            </button>
          </div>
        )}
      </div>

      {/* Descripción */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Descripción *</label>
        <Textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Describe brevemente el incidente..."
          rows={3}
          className="resize-none text-sm"
        />
      </div>

      {/* Ubicación */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Ubicación (zona/nivel)</label>
        <Input
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          placeholder="Ej: Nivel 3, Zona A"
          className="text-sm"
        />
      </div>

      {/* Botón enviar */}
      <Button
        onClick={handleSubmit}
        disabled={crearMut.isPending || !tipo || !severidad || !descripcion.trim()}
        className="w-full h-12 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl"
      >
        {crearMut.isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Reportando...</>
        ) : (
          <><Send className="w-4 h-4 mr-2" /> Reportar Incidente</>
        )}
      </Button>
    </div>
  );
}

// ==========================================
// TAB INCIDENTES - Lista con filtros
// ==========================================
function TabIncidentes({ proyectoId }: { proyectoId: number }) {
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [accionCorrectiva, setAccionCorrectiva] = useState("");
  const [showCerrarModal, setShowCerrarModal] = useState(false);

  const { data: incidentes, isLoading } = trpc.seguridad.listar.useQuery({
    proyectoId,
    estado: filtroEstado || undefined,
    tipo: filtroTipo || undefined,
  });

  const utils = trpc.useUtils();
  const actualizarMut = trpc.seguridad.actualizarEstado.useMutation({
    onSuccess: () => {
      toast.success("Estado actualizado");
      utils.seguridad.listar.invalidate();
      utils.seguridad.estadisticas.invalidate();
      setShowCerrarModal(false);
      setAccionCorrectiva("");
      setSelectedId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCerrar = () => {
    if (!selectedId) return;
    actualizarMut.mutate({ id: selectedId, estado: "cerrado", accionCorrectiva });
  };

  const tipoInfo = (tipo: string) => TIPOS_INCIDENTE.find(t => t.value === tipo);
  const sevInfo = (sev: string) => SEVERIDADES.find(s => s.value === sev);
  const estadoInfo = (est: string) => ESTADOS.find(e => e.value === est);

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="text-xs border rounded-lg px-2 py-1.5 bg-background min-w-[100px]"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="text-xs border rounded-lg px-2 py-1.5 bg-background min-w-[100px]"
        >
          <option value="">Todos los tipos</option>
          {TIPOS_INCIDENTE.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : !incidentes?.length ? (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Sin incidentes reportados</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Los reportes aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-2">
          {incidentes.map((inc: any) => {
            const tp = tipoInfo(inc.tipo);
            const sv = sevInfo(inc.severidad);
            const es = estadoInfo(inc.estado);
            return (
              <Card key={inc.id} className="p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  {/* Foto thumbnail */}
                  {inc.fotoUrl ? (
                    <img src={inc.fotoUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">{tp?.icon || "📋"}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold">{tp?.label || inc.tipo}</span>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${es?.color || ""}`}>
                        {es?.label || inc.estado}
                      </Badge>
                      <div className={`h-2 w-2 rounded-full ${sv?.color || "bg-gray-400"} ml-auto`} title={sv?.label} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{inc.descripcion}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {inc.ubicacion && (
                        <span className="text-[10px] text-muted-foreground/70">📍 {inc.ubicacion}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground/50 ml-auto">
                        {new Date(inc.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    {/* Acciones rápidas */}
                    {inc.estado !== "cerrado" && (
                      <div className="flex gap-1.5 mt-2">
                        {inc.estado === "abierto" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] px-2 border-amber-200 text-amber-600"
                            onClick={() => actualizarMut.mutate({ id: inc.id, estado: "en_proceso" })}
                            disabled={actualizarMut.isPending}
                          >
                            <Clock className="w-3 h-3 mr-1" /> En Proceso
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] px-2 border-green-200 text-green-600"
                          onClick={() => { setSelectedId(inc.id); setShowCerrarModal(true); }}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Cerrar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal cerrar incidente */}
      <Dialog open={showCerrarModal} onOpenChange={setShowCerrarModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Cerrar Incidente</DialogTitle>
          </DialogHeader>
          <Textarea
            value={accionCorrectiva}
            onChange={(e) => setAccionCorrectiva(e.target.value)}
            placeholder="Describe la acción correctiva tomada..."
            rows={3}
            className="text-sm"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCerrarModal(false)}>Cancelar</Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleCerrar}
              disabled={actualizarMut.isPending}
            >
              {actualizarMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmar Cierre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// TAB STATS - Estadísticas
// ==========================================
function TabStats({ proyectoId }: { proyectoId: number }) {
  const { data: stats, isLoading } = trpc.seguridad.estadisticas.useQuery({ proyectoId });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!stats) return null;

  const maxTipo = Math.max(...(stats.porTipo?.map((t: any) => t.count) || [1]), 1);
  const maxSev = Math.max(...(stats.porSeveridad?.map((s: any) => s.count) || [1]), 1);

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </Card>
        <Card className="p-3 text-center border-red-200">
          <p className="text-2xl font-bold text-red-600">{stats.abiertos}</p>
          <p className="text-[10px] text-muted-foreground">Abiertos</p>
        </Card>
        <Card className="p-3 text-center border-amber-200">
          <p className="text-2xl font-bold text-amber-600">{stats.enProceso}</p>
          <p className="text-[10px] text-muted-foreground">En Proceso</p>
        </Card>
        <Card className="p-3 text-center border-green-200">
          <p className="text-2xl font-bold text-green-600">{stats.cerrados}</p>
          <p className="text-[10px] text-muted-foreground">Cerrados</p>
        </Card>
      </div>

      {/* Tiempo promedio resolución */}
      {(stats.tiempoPromedio ?? 0) > 0 && (
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Tiempo promedio de resolución:</span>
            <span className="text-sm font-bold ml-auto">{stats.tiempoPromedio}h</span>
          </div>
        </Card>
      )}

      {/* Por tipo */}
      {stats.porTipo && stats.porTipo.length > 0 && (
        <Card className="p-3">
          <h3 className="text-xs font-semibold mb-3">Por Tipo</h3>
          <div className="space-y-2">
            {stats.porTipo.map((t: any) => {
              const info = TIPOS_INCIDENTE.find(ti => ti.value === t.tipo);
              return (
                <div key={t.tipo} className="flex items-center gap-2">
                  <span className="text-sm w-5">{info?.icon || "📋"}</span>
                  <span className="text-[10px] w-24 truncate">{info?.label || t.tipo}</span>
                  <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full transition-all"
                      style={{ width: `${(t.count / maxTipo) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-6 text-right">{t.count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Por severidad */}
      {stats.porSeveridad && stats.porSeveridad.length > 0 && (
        <Card className="p-3">
          <h3 className="text-xs font-semibold mb-3">Por Severidad</h3>
          <div className="space-y-2">
            {stats.porSeveridad.map((s: any) => {
              const info = SEVERIDADES.find(sv => sv.value === s.severidad);
              return (
                <div key={s.severidad} className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${info?.color || "bg-gray-400"}`} />
                  <span className="text-[10px] w-16">{info?.label || s.severidad}</span>
                  <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${info?.color || "bg-gray-400"}`}
                      style={{ width: `${(s.count / maxSev) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-6 text-right">{s.count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Tendencia */}
      {stats.tendencia && stats.tendencia.length > 0 && (
        <Card className="p-3">
          <h3 className="text-xs font-semibold mb-3">Tendencia (últimos 30 días)</h3>
          <div className="flex items-end gap-1 h-20">
            {stats.tendencia.map((d: any, i: number) => {
              const maxD = Math.max(...stats.tendencia.map((t: any) => t.count), 1);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full bg-red-400 rounded-t-sm min-h-[2px] transition-all"
                    style={{ height: `${(d.count / maxD) * 100}%` }}
                  />
                  <span className="text-[7px] text-muted-foreground/50 rotate-[-45deg]">
                    {d.fecha.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Empty state */}
      {stats.total === 0 && (
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Sin datos de seguridad aún</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Reporta incidentes para ver estadísticas</p>
        </div>
      )}
    </div>
  );
}

// ==========================================
// TAB CHECKLIST - Checklists de seguridad
// ==========================================
function TabChecklist({ proyectoId }: { proyectoId: number }) {
  const [showNew, setShowNew] = useState(false);
  const [titulo, setTitulo] = useState("Inspección de Seguridad");
  const [ubicacion, setUbicacion] = useState("");
  const [selectedChecklist, setSelectedChecklist] = useState<number | null>(null);

  const { data: checklists, isLoading } = trpc.seguridad.listarChecklists.useQuery({ proyectoId });
  const { data: checklistDetalle } = trpc.seguridad.getChecklist.useQuery(
    { id: selectedChecklist! },
    { enabled: !!selectedChecklist }
  );

  const utils = trpc.useUtils();
  const crearMut = trpc.seguridad.crearChecklist.useMutation({
    onSuccess: (data) => {
      toast.success("Checklist creado");
      setShowNew(false);
      setSelectedChecklist(data.id);
      utils.seguridad.listarChecklists.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const actualizarItemMut = trpc.seguridad.actualizarChecklistItem.useMutation({
    onSuccess: () => {
      utils.seguridad.getChecklist.invalidate({ id: selectedChecklist! });
    },
  });

  const completarMut = trpc.seguridad.completarChecklist.useMutation({
    onSuccess: () => {
      toast.success("Checklist completado");
      utils.seguridad.listarChecklists.invalidate();
      utils.seguridad.getChecklist.invalidate({ id: selectedChecklist! });
    },
  });

  const handleCrear = () => {
    crearMut.mutate({
      proyectoId,
      titulo: titulo.trim(),
      ubicacion: ubicacion.trim() || undefined,
      items: CHECKLIST_TEMPLATE.map(item => ({
        categoria: item.categoria,
        pregunta: item.pregunta,
        cumple: "na" as const,
      })),
    });
  };

  // Vista detalle de checklist
  if (selectedChecklist && checklistDetalle) {
    const categorias = Array.from(new Set(checklistDetalle.items.map((i: any) => i.categoria)));
    const totalItems = checklistDetalle.items.filter((i: any) => i.cumple !== "na").length;
    const cumplidos = checklistDetalle.items.filter((i: any) => i.cumple === "si").length;
    const pct = totalItems > 0 ? Math.round((cumplidos / totalItems) * 100) : 0;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedChecklist(null)} className="h-8 px-2">
            ← Volver
          </Button>
          <h3 className="text-sm font-semibold flex-1">{checklistDetalle.titulo}</h3>
          {!checklistDetalle.completado && (
            <Button
              size="sm"
              className="h-8 bg-green-600 hover:bg-green-700 text-white text-xs"
              onClick={() => completarMut.mutate({ id: selectedChecklist })}
              disabled={completarMut.isPending}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> Finalizar
            </Button>
          )}
        </div>

        {/* Progress */}
        <Card className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className="text-xs font-bold">{pct}%</span>
            <span className="text-[10px] text-muted-foreground">{cumplidos}/{totalItems}</span>
          </div>
        </Card>

        {/* Items por categoría */}
        {categorias.map((cat: any) => (
          <Card key={cat} className="p-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">{cat}</h4>
            <div className="space-y-2">
              {checklistDetalle.items
                .filter((i: any) => i.categoria === cat)
                .map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => actualizarItemMut.mutate({ itemId: item.id, cumple: "si" })}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all ${
                          item.cumple === "si"
                            ? "bg-green-500 text-white"
                            : "bg-muted/50 text-muted-foreground hover:bg-green-100"
                        }`}
                        disabled={checklistDetalle.completado}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => actualizarItemMut.mutate({ itemId: item.id, cumple: "no" })}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all ${
                          item.cumple === "no"
                            ? "bg-red-500 text-white"
                            : "bg-muted/50 text-muted-foreground hover:bg-red-100"
                        }`}
                        disabled={checklistDetalle.completado}
                      >
                        ✕
                      </button>
                    </div>
                    <span className={`text-xs flex-1 ${item.cumple === "no" ? "text-red-600 font-medium" : ""}`}>
                      {item.pregunta}
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Botón nuevo */}
      <Button
        onClick={() => setShowNew(true)}
        className="w-full h-12 bg-red-500 hover:bg-red-600 text-white rounded-xl"
      >
        <Plus className="w-4 h-4 mr-2" /> Nueva Inspección de Seguridad
      </Button>

      {/* Lista de checklists */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : !checklists?.length ? (
        <div className="text-center py-12">
          <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Sin inspecciones realizadas</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Crea una nueva inspección de seguridad</p>
        </div>
      ) : (
        <div className="space-y-2">
          {checklists.map((cl: any) => {
            const pct = cl.puntajeTotal > 0 ? Math.round((cl.puntajeObtenido / cl.puntajeTotal) * 100) : 0;
            return (
              <Card
                key={cl.id}
                className="p-3 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setSelectedChecklist(cl.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    cl.completado ? "bg-green-100" : "bg-amber-100"
                  }`}>
                    {cl.completado ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <ClipboardCheck className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold">{cl.titulo}</p>
                    {cl.ubicacion && <p className="text-[10px] text-muted-foreground">📍 {cl.ubicacion}</p>}
                    <p className="text-[10px] text-muted-foreground/50">
                      {new Date(cl.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {cl.completado && (
                    <Badge variant="outline" className="text-[9px] bg-green-100 text-green-700 border-green-200">
                      {pct}%
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal nueva inspección */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Nueva Inspección de Seguridad</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Título</label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Ubicación (opcional)</label>
              <Input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Ej: Nivel 5, Torre A" className="text-sm" />
            </div>
            <p className="text-[10px] text-muted-foreground">Se creará con {CHECKLIST_TEMPLATE.length} puntos de verificación predefinidos.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleCrear}
              disabled={crearMut.isPending || !titulo.trim()}
            >
              {crearMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Crear Inspección"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
