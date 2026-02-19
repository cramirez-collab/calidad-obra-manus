import { useState, useRef, useCallback, useEffect } from "react";
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
  Mic,
  MicOff,
  Play,
  Square,
  Volume2,
  ArrowLeft,
  Trash2,
  MoreVertical,
  Edit3,
  AtSign,
  ChevronUp,
  ChevronRight,
  FileDown,
  ZoomIn,
  Pencil,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/UserAvatar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { compressAdaptive } from "@/lib/imageCompression";
import FotoEditor from "@/components/FotoEditor";

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
  { value: "prevencion", label: "Prevenci\u00f3n", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "cerrado", label: "Cerrado", color: "bg-green-100 text-green-700 border-green-200" },
] as const;

type Tab = "reportar" | "incidentes" | "stats" | "checklist" | "voz";
type IncidenteView = "list" | "chat";

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
  const [chatIncidenteId, setChatIncidenteId] = useState<number | null>(null);
  const [chatIncidenteInfo, setChatIncidenteInfo] = useState<any>(null);

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
    { id: "voz", label: "Voz", icon: Mic },
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
        {activeTab === "incidentes" && (
          chatIncidenteId ? (
            <IncidenteChat
              incidenteId={chatIncidenteId}
              incidenteInfo={chatIncidenteInfo}
              onBack={() => { setChatIncidenteId(null); setChatIncidenteInfo(null); }}
            />
          ) : (
            <TabIncidentes
              proyectoId={selectedProjectId}
              onOpenChat={(id: number, info: any) => { setChatIncidenteId(id); setChatIncidenteInfo(info); }}
            />
          )
        )}
        {activeTab === "stats" && <TabStats proyectoId={selectedProjectId} />}
        {activeTab === "checklist" && <TabChecklist proyectoId={selectedProjectId} />}
        {activeTab === "voz" && <TabNotasVoz proyectoId={selectedProjectId} />}
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
function TabIncidentes({ proyectoId, onOpenChat }: { proyectoId: number; onOpenChat: (id: number, info: any) => void }) {
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
                      {inc.codigo && (
                        <span className="text-[9px] font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{inc.codigo}</span>
                      )}
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${estadoInfo(inc.estado)?.color || ""}`}>
                        {estadoInfo(inc.estado)?.label || inc.estado}
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
                    <div className="flex gap-1.5 mt-2">
                      {inc.estado !== "cerrado" && inc.estado === "abierto" && (
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
                      {inc.estado !== "cerrado" && inc.estado !== "prevencion" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] px-2 border-blue-200 text-blue-600"
                          onClick={() => actualizarMut.mutate({ id: inc.id, estado: "prevencion" })}
                          disabled={actualizarMut.isPending}
                        >
                          <Shield className="w-3 h-3 mr-1" /> Prevenci\u00f3n
                        </Button>
                      )}
                      {inc.estado !== "cerrado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] px-2 border-green-200 text-green-600"
                          onClick={() => { setSelectedId(inc.id); setShowCerrarModal(true); }}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Cerrar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] px-2 border-red-200 text-red-600 ml-auto"
                        onClick={() => onOpenChat(inc.id, { tipo: tp?.label || inc.tipo, icon: tp?.icon, severidad: inc.severidad, sevLabel: sv?.label, estado: estadoInfo(inc.estado)?.label, descripcion: inc.descripcion, codigo: inc.codigo })}
                      >
                        <MessageCircle className="w-3 h-3 mr-1 text-red-500" /> Chat
                      </Button>
                    </div>
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
        <Card className="p-3 text-center border-blue-200">
          <p className="text-2xl font-bold text-blue-600">{stats.prevencion || 0}</p>
          <p className="text-[10px] text-muted-foreground">Prevenci\u00f3n</p>
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


// ==========================================
// CHAT POR INCIDENTE
// ==========================================
// Generar HTML para reporte PDF de incidente
function generatePDFHtml(data: any): string {
  const sevColors: Record<string, string> = { Baja: '#22c55e', Media: '#eab308', Alta: '#f97316', 'Cr\u00edtica': '#ef4444' };
  const sevColor = sevColors[data.severidad] || '#6b7280';
  const fecha = new Date(data.fechaCreacion).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  
  let mensajesHtml = '';
  if (data.mensajes?.length > 0) {
    mensajesHtml = data.mensajes.map((m: any) => {
      const mFecha = new Date(m.fecha).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      let content = '';
      if (m.tipo === 'foto' && m.fotoUrl) {
        content = `<img src="${m.fotoUrl}" style="max-width:300px;border-radius:8px;margin:4px 0" />`;
      } else if (m.tipo === 'voz' && m.bullets?.length) {
        content = '<ul style="margin:4px 0;padding-left:20px">' + m.bullets.map((b: string) => `<li style="font-size:13px;margin:2px 0">${b}</li>`).join('') + '</ul>';
        if (m.transcripcion) content += `<p style="font-size:11px;color:#888;margin-top:4px"><em>Transcripci\u00f3n: ${m.transcripcion}</em></p>`;
      } else {
        content = `<p style="font-size:13px;margin:4px 0">${m.texto}</p>`;
      }
      return `<div style="padding:8px 0;border-bottom:1px solid #eee"><strong style="font-size:12px">${m.usuario}</strong> <span style="font-size:11px;color:#888">${mFecha}</span>${content}</div>`;
    }).join('');
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte ${data.codigo}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${sevColor};padding-bottom:12px;margin-bottom:20px}
.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:white;background:${sevColor}}
.section{margin:16px 0}.section h3{font-size:14px;color:#555;border-bottom:1px solid #ddd;padding-bottom:4px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px}
.grid dt{color:#888;font-size:12px}.grid dd{margin:0;font-weight:500}
.fotos{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0}
.fotos img{max-width:300px;border-radius:8px;border:1px solid #ddd}
@media print{body{padding:10px}}
</style></head><body>
<div class="header"><div><h1 style="margin:0;font-size:22px">${data.codigo}</h1><p style="margin:4px 0 0;color:#888;font-size:13px">Reporte de Incidente de Seguridad</p></div><span class="badge">${data.severidad}</span></div>
<div class="section"><h3>Informaci\u00f3n General</h3><dl class="grid">
<dt>Tipo</dt><dd>${data.tipo}</dd>
<dt>Estado</dt><dd>${data.estado}</dd>
<dt>Reportado por</dt><dd>${data.reportadoPor}</dd>
<dt>Fecha</dt><dd>${fecha}</dd>
<dt>Ubicaci\u00f3n</dt><dd>${data.ubicacion || 'No especificada'}</dd>
${data.fechaCierre ? `<dt>Fecha cierre</dt><dd>${new Date(data.fechaCierre).toLocaleDateString('es-MX')}</dd>` : ''}
</dl></div>
<div class="section"><h3>Descripci\u00f3n</h3><p style="font-size:13px">${data.descripcion}</p></div>
${data.accionCorrectiva ? `<div class="section"><h3>Acci\u00f3n Correctiva</h3><p style="font-size:13px">${data.accionCorrectiva}</p></div>` : ''}
${data.fotoUrl || data.fotoMarcadaUrl ? `<div class="section"><h3>Evidencia Fotogr\u00e1fica</h3><div class="fotos">${data.fotoUrl ? `<div><p style="font-size:11px;color:#888">Original</p><img src="${data.fotoUrl}" /></div>` : ''}${data.fotoMarcadaUrl ? `<div><p style="font-size:11px;color:#888">Marcada</p><img src="${data.fotoMarcadaUrl}" /></div>` : ''}</div></div>` : ''}
${mensajesHtml ? `<div class="section"><h3>Historial de Mensajes (${data.mensajes.length})</h3>${mensajesHtml}</div>` : ''}
<footer style="margin-top:30px;padding-top:10px;border-top:1px solid #ddd;font-size:11px;color:#aaa;text-align:center">Generado por ObjetivaQC &mdash; ${new Date().toLocaleDateString('es-MX')}</footer>
</body></html>`;
}

function IncidenteChat({ incidenteId, incidenteInfo, onBack }: { incidenteId: number; incidenteInfo: any; onBack: () => void }) {
  const { user } = useAuth();
  const [mensaje, setMensaje] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeRef = useRef(0);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  // Photo state
  const [showFotoEditor, setShowFotoEditor] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // @mentions state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: incidenteData } = trpc.seguridad.getById.useQuery({ id: incidenteId });
  const { data: mensajes, isLoading } = trpc.seguridad.mensajesByIncidente.useQuery({ incidenteId });
  const { data: usuariosProyecto } = trpc.seguridad.usuariosProyecto.useQuery(
    { proyectoId: incidenteData?.proyectoId || 0 },
    { enabled: !!incidenteData?.proyectoId }
  );

  const enviarTexto = trpc.seguridad.enviarMensaje.useMutation({
    onSuccess: () => {
      setMensaje("");
      utils.seguridad.mensajesByIncidente.invalidate({ incidenteId });
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    },
    onError: (e) => toast.error(e.message),
  });

  const enviarVoz = trpc.seguridad.enviarMensajeVoz.useMutation({
    onSuccess: () => {
      utils.seguridad.mensajesByIncidente.invalidate({ incidenteId });
      toast.success("Nota de voz procesada");
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    },
    onError: (e) => toast.error(e.message),
  });

  const eliminarMut = trpc.seguridad.eliminarMensaje.useMutation({
    onSuccess: () => {
      toast.success("Mensaje eliminado");
      utils.seguridad.mensajesByIncidente.invalidate({ incidenteId });
    },
    onError: (e) => toast.error(e.message),
  });

  const editarMut = trpc.seguridad.editarMensaje.useMutation({
    onSuccess: () => {
      toast.success("Mensaje editado");
      setEditingId(null);
      setEditText("");
      utils.seguridad.mensajesByIncidente.invalidate({ incidenteId });
    },
    onError: (e) => toast.error(e.message),
  });

  const enviarFoto = trpc.seguridad.enviarMensajeFoto.useMutation({
    onSuccess: () => {
      utils.seguridad.mensajesByIncidente.invalidate({ incidenteId });
      toast.success("Foto enviada");
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    },
    onError: (e) => toast.error(e.message),
  });

  const guardarMarcas = trpc.seguridad.guardarFotoMarcada.useMutation({
    onSuccess: () => {
      toast.success("Foto marcada guardada");
      setShowFotoEditor(false);
      utils.seguridad.getById.invalidate({ id: incidenteId });
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: pdfData } = trpc.seguridad.exportarPDF.useQuery(
    { incidenteId },
    { enabled: false }
  );

  const handleFotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      enviarFoto.mutate({ incidenteId, fotoBase64: base64 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleExportPDF = async () => {
    try {
      const result = await utils.seguridad.exportarPDF.fetch({ incidenteId });
      if (!result) return;
      // Generate HTML-based PDF
      const html = generatePDFHtml(result);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.codigo}_reporte.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Reporte exportado');
    } catch (e: any) {
      toast.error(e.message || 'Error al exportar');
    }
  };

  // Scroll al final cuando cargan mensajes
  useEffect(() => {
    if (mensajes && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [mensajes]);

  // @mentions handler
  const handleMensajeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMensaje(val);
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || textBeforeCursor[lastAt - 1] === ' ')) {
      const filter = textBeforeCursor.slice(lastAt + 1);
      if (!filter.includes(' ')) {
        setShowMentions(true);
        setMentionFilter(filter.toLowerCase());
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (name: string) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = mensaje.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    const newText = mensaje.slice(0, lastAt) + `@${name} ` + mensaje.slice(cursorPos);
    setMensaje(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const filteredUsers = (usuariosProyecto || []).filter((u: any) =>
    u.name?.toLowerCase().includes(mentionFilter)
  ).slice(0, 5);

  const handleSend = () => {
    if (!mensaje.trim()) return;
    enviarTexto.mutate({ incidenteId, texto: mensaje });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Grabar audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 1000) {
          toast.error("Audio muy corto");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          enviarVoz.mutate({
            incidenteId,
            audioBase64: reader.result as string,
            mimeType: mimeType.split(';')[0],
            duracionSegundos: recordingTimeRef.current,
          });
        };
        reader.readAsDataURL(blob);
        setRecordingTime(0);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      timerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const playAudio = (url: string, id: number) => {
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(url);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(id);
  };

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingId(null);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const isAdmin = user && ['superadmin', 'admin'].includes(user.role);
  const isCritica = incidenteInfo?.severidad === 'critica';

  // Render @mention highlighted text
  const renderMsgText = (text: string) => {
    const parts = text.split(/(@\w+(?:\s\w+)?)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="font-semibold text-red-600">{part}</span>
      ) : part
    );
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}>
      {/* Header con código SEG */}
      <div className="flex items-center gap-2 pb-3 border-b mb-2">
        <button onClick={onBack} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center text-sm">
          {incidenteInfo?.icon || "📝"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{incidenteInfo?.tipo || "Incidente"}</p>
            {incidenteInfo?.codigo && (
              <span className="text-[9px] font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded shrink-0">{incidenteInfo.codigo}</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground truncate">{incidenteInfo?.descripcion?.slice(0, 60)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Botón rayar foto */}
          {incidenteData?.fotoUrl && (
            <button
              onClick={() => setShowFotoEditor(true)}
              className="h-7 w-7 rounded-full flex items-center justify-center bg-orange-100 hover:bg-orange-200 text-orange-600" title="Rayar foto"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Botón exportar PDF */}
          <button
            onClick={handleExportPDF}
            className="h-7 w-7 rounded-full flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-600" title="Exportar reporte"
          >
            <FileDown className="h-3.5 w-3.5" />
          </button>
          {incidenteInfo?.sevLabel && (
            <Badge variant="outline" className={`text-[9px] ${
              incidenteInfo.severidad === 'critica' ? 'bg-red-100 text-red-700 border-red-200' :
              incidenteInfo.severidad === 'alta' ? 'bg-orange-100 text-orange-700 border-orange-200' :
              incidenteInfo.severidad === 'media' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
              'bg-green-100 text-green-700 border-green-200'
            }`}>{incidenteInfo.sevLabel}</Badge>
          )}
          <Badge variant="outline" className="text-[9px]">{incidenteInfo?.estado}</Badge>
        </div>
      </div>

      {/* Foto Editor overlay */}
      {showFotoEditor && incidenteData?.fotoUrl && (
        <div className="mb-3 p-2 border rounded-lg bg-background">
          <FotoEditor
            fotoUrl={incidenteData.fotoUrl}
            onSave={(base64) => guardarMarcas.mutate({ id: incidenteId, fotoMarcadaBase64: base64 })}
            onCancel={() => setShowFotoEditor(false)}
            saving={guardarMarcas.isPending}
          />
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 text-white flex items-center justify-center" onClick={() => setLightboxUrl(null)}>
            <X className="h-5 w-5" />
          </button>
          <img src={lightboxUrl} className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Hidden file input for photos */}
      <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoSelect} />

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-1 space-y-3" ref={scrollRef}>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !mensajes?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">Sin mensajes aún</p>
            <p className="text-xs opacity-70">Escribe o graba una nota de voz</p>
          </div>
        ) : (
          mensajes.map((msg: any) => {
            const isOwn = msg.usuarioId === user?.id;
            const isVoz = msg.tipo === 'voz';
            const isFoto = msg.tipo === 'foto';
            return (
              <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <UserAvatar
                  name={msg.usuario?.name}
                  fotoUrl={msg.usuario?.fotoUrl}
                  fotoBase64={(msg.usuario as any)?.fotoBase64}
                  size="lg"
                  showName={false}
                />
                <div className={`flex flex-col max-w-[80%] ${isOwn ? 'items-end' : ''}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-medium">{msg.usuario?.name || 'Usuario'}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(msg.createdAt), "d MMM HH:mm", { locale: es })}
                    </span>
                    {msg.editado && <span className="text-[8px] text-muted-foreground italic">(editado)</span>}
                  </div>
                  {/* Burbuja: fondo rojo SOLO si es crítica, sino fondo suave */}
                  <div className={`group relative rounded-xl px-3 py-2 ${
                    isCritica
                      ? (isOwn ? 'bg-red-500 text-white' : 'bg-red-50 text-foreground border border-red-200')
                      : (isOwn ? 'bg-slate-200 text-foreground' : 'bg-muted text-foreground')
                  }`}>
                    {isVoz && (
                      <div className="mb-1.5">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            onClick={() => msg.audioUrl && (playingId === msg.id ? stopAudio() : playAudio(msg.audioUrl, msg.id))}
                            className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${
                              playingId === msg.id
                                ? 'bg-red-500 text-white'
                                : 'bg-muted-foreground/10 hover:bg-muted-foreground/20'
                            }`}
                          >
                            {playingId === msg.id ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current ml-0.5" />}
                          </button>
                          <div className="flex-1">
                            <div className="h-1 rounded-full bg-muted-foreground/20">
                              <div className="h-full rounded-full bg-red-500" style={{ width: playingId === msg.id ? '60%' : '100%' }} />
                            </div>
                          </div>
                          {msg.duracionSegundos > 0 && (
                            <span className="text-[9px] text-muted-foreground">
                              {formatTime(msg.duracionSegundos)}
                            </span>
                          )}
                        </div>
                        {/* 5 Bullets */}
                        {msg.bullets && Array.isArray(msg.bullets) && msg.bullets.length > 0 && (
                          <div className="space-y-1 mt-1.5">
                            {msg.bullets.map((bullet: string, i: number) => (
                              <div key={i} className="flex gap-1.5 items-start">
                                <div className="h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">
                                  {i + 1}
                                </div>
                                <p className="text-xs leading-snug font-normal">{bullet}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Transcripción colapsable */}
                        {msg.transcripcion && (
                          <details className="mt-1.5">
                            <summary className="text-[10px] cursor-pointer text-muted-foreground hover:text-foreground">
                              Ver transcripción
                            </summary>
                            <p className="text-[10px] mt-1 rounded p-1.5 leading-relaxed bg-background/50 text-muted-foreground">
                              {msg.transcripcion}
                            </p>
                          </details>
                        )}
                      </div>
                    )}
                    {/* Foto message */}
                    {isFoto && msg.fotoUrl && (
                      <div className="mb-1">
                        <img
                          src={msg.fotoUrl}
                          className="rounded-lg max-w-[200px] max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setLightboxUrl(msg.fotoUrl)}
                        />
                        {msg.texto && msg.texto !== '[Foto]' && (
                          <p className="text-sm font-normal mt-1">{renderMsgText(msg.texto)}</p>
                        )}
                      </div>
                    )}
                    {!isVoz && !isFoto && editingId === msg.id ? (
                      <div className="space-y-1.5">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-[36px] text-sm resize-none bg-background text-foreground"
                          rows={2}
                        />
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setEditingId(null)}>Cancelar</Button>
                          <Button size="sm" className="h-6 text-[10px] px-2 bg-red-500 text-white" onClick={() => editarMut.mutate({ id: msg.id, texto: editText })} disabled={editarMut.isPending}>Guardar</Button>
                        </div>
                      </div>
                    ) : !isVoz && !isFoto ? (
                      <p className="text-sm font-normal whitespace-pre-wrap break-words">{renderMsgText(msg.texto)}</p>
                    ) : null}
                    {/* Acciones admin: editar/eliminar */}
                    {isAdmin && editingId !== msg.id && (
                      <div className={`absolute -top-1 ${isOwn ? '-left-12' : '-right-12'} flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity`}>
                        {!isVoz && (
                          <button
                            onClick={() => { setEditingId(msg.id); setEditText(msg.texto); }}
                            className="h-5 w-5 rounded-full flex items-center justify-center bg-blue-500 text-white"
                            title="Editar"
                          >
                            <Edit3 className="h-2.5 w-2.5" />
                          </button>
                        )}
                        <button
                          onClick={() => eliminarMut.mutate({ id: msg.id })}
                          className="h-5 w-5 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground"
                          title="Eliminar"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input area */}
      <div className="pt-3 border-t mt-2">
        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-mono font-bold text-red-600">{formatTime(recordingTime)}</span>
          </div>
        )}
        {enviarVoz.isPending && (
          <div className="flex items-center justify-center gap-2 mb-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs">Transcribiendo y generando resumen...</span>
          </div>
        )}
        {/* @Mentions dropdown */}
        {showMentions && filteredUsers.length > 0 && (
          <div className="mb-2 bg-background border rounded-lg shadow-lg max-h-32 overflow-y-auto">
            {filteredUsers.map((u: any) => (
              <button
                key={u.id}
                onClick={() => insertMention(u.name)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
              >
                <AtSign className="h-3 w-3 text-red-500" />
                <span>{u.name}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{u.role}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <Textarea
            ref={textareaRef}
            value={mensaje}
            onChange={handleMensajeChange}
            onKeyDown={handleKeyDown}
            placeholder="Escribe... @ mencionar"
            className="min-h-[44px] max-h-24 resize-none text-sm flex-1"
            rows={1}
          />
          {/* Botón cámara/foto */}
          <button
            onClick={() => fotoInputRef.current?.click()}
            disabled={enviarFoto.isPending}
            className={`h-[44px] w-[44px] rounded-xl flex items-center justify-center transition-all shrink-0 ${
              enviarFoto.isPending
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            }`}
            title="Enviar foto"
          >
            {enviarFoto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          {/* Botón micrófono */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={enviarVoz.isPending}
            className={`h-[44px] w-[44px] rounded-xl flex items-center justify-center transition-all shrink-0 ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse'
                : enviarVoz.isPending
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
            }`}
          >
            {isRecording ? <Square className="h-4 w-4 fill-current" /> : enviarVoz.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          </button>
          {/* Botón enviar */}
          <button
            onClick={handleSend}
            disabled={!mensaje.trim() || enviarTexto.isPending}
            className={`h-[44px] w-[44px] rounded-xl flex items-center justify-center transition-all shrink-0 ${
              mensaje.trim()
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-center">
          Enter enviar · @ mencionar · 📷 foto · 🎙 voz IA
        </p>
      </div>
    </div>
  );
}

// ==========================================
// TAB: NOTAS DE VOZ
// ==========================================
function TabNotasVoz({ proyectoId }: { proyectoId: number }) {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeRef = useRef(0);

  const notasQuery = trpc.seguridad.listarNotasVoz.useQuery({ proyectoId });
  const transcribirMut = trpc.seguridad.transcribirYResumir.useMutation({
    onSuccess: () => {
      notasQuery.refetch();
      toast.success("Nota de voz procesada");
    },
    onError: (err) => toast.error(err.message),
  });

  // Iniciar grabación
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        setAudioChunks(chunks);
        
        // Convertir a base64 y enviar
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          transcribirMut.mutate({
            proyectoId,
            audioBase64: base64,
            mimeType: mimeType.split(';')[0],
            duracionSegundos: recordingTimeRef.current,
          });
        };
        reader.readAsDataURL(blob);
        setRecordingTime(0);
      };

      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimeRef.current = 0;
      timerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (err) {
      toast.error("No se pudo acceder al micrófono. Verifica los permisos.");
    }
  };

  // Detener grabación
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Reproducir audio
  const playAudio = (url: string, id: number) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(id);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Botón de grabación */}
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          Graba un reporte de voz. Se transcribirá y generará 5 puntos clave automáticamente.
        </p>

        {/* Indicador de grabación */}
        {isRecording && (
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-2xl font-mono font-bold text-red-600">{formatTime(recordingTime)}</span>
          </div>
        )}

        {/* Procesando */}
        {transcribirMut.isPending && (
          <div className="mb-4 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Transcribiendo y generando resumen...</span>
          </div>
        )}

        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={transcribirMut.isPending}
          className={`h-20 w-20 rounded-full flex items-center justify-center mx-auto transition-all shadow-lg ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 scale-110 animate-pulse"
              : transcribirMut.isPending
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-red-500 hover:bg-red-600 hover:scale-105"
          }`}
        >
          {isRecording ? (
            <Square className="h-8 w-8 text-white fill-white" />
          ) : transcribirMut.isPending ? (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          ) : (
            <Mic className="h-8 w-8 text-white" />
          )}
        </button>

        <p className="text-xs text-muted-foreground mt-3">
          {isRecording ? "Toca para detener" : transcribirMut.isPending ? "Procesando..." : "Toca para grabar"}
        </p>
      </Card>

      {/* Lista de notas de voz */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          Notas de Voz ({notasQuery.data?.length || 0})
        </h3>

        {notasQuery.isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {notasQuery.data?.length === 0 && !notasQuery.isLoading && (
          <Card className="p-8 text-center">
            <MicOff className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No hay notas de voz aún</p>
            <p className="text-xs text-muted-foreground/70">Graba tu primer reporte de seguridad</p>
          </Card>
        )}

        {notasQuery.data?.map((nota: any) => (
          <Card key={nota.id} className="p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                <Mic className="h-4 w-4 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{nota.creadoPorNombre || "Usuario"}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(nota.fechaCreacion).toLocaleString("es-MX", { 
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" 
                  })}
                  {nota.duracionSegundos > 0 && ` · ${formatTime(nota.duracionSegundos)}`}
                </p>
              </div>
              {nota.audioUrl && (
                <button
                  onClick={() => playingId === nota.id ? stopAudio() : playAudio(nota.audioUrl, nota.id)}
                  className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                    playingId === nota.id ? "bg-red-500 text-white" : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {playingId === nota.id ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current ml-0.5" />}
                </button>
              )}
            </div>

            {/* 5 Bullets */}
            <div className="space-y-1.5 mb-2">
              {(nota.bullets as string[])?.map((bullet: string, i: number) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-sm leading-snug">{bullet}</p>
                </div>
              ))}
            </div>

            {/* Transcripción colapsable */}
            {nota.transcripcion && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Ver transcripción completa
                </summary>
                <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded-lg p-2 leading-relaxed">
                  {nota.transcripcion}
                </p>
              </details>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
