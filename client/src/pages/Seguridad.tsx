import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
  UserCheck,
  User,
  ArrowDownCircle,
  Hammer,
  Scissors,
  Building2,
  FlaskConical,
  ShieldOff,
  Ban,
  TriangleAlert,
  ClipboardList,
  type LucideIcon,
  Upload,
  Image as ImageLucide,
  MapPin,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/UserAvatar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { compressAdaptive } from "@/lib/imageCompression";
import FotoEditor from "@/components/FotoEditor";

// Tipos de incidente con labels, iconos Lucide y colores
const TIPOS_INCIDENTE: readonly { value: string; label: string; Icon: LucideIcon; color: string; iconColor: string }[] = [
  { value: "caida", label: "Caída", Icon: ArrowDownCircle, color: "bg-red-100 text-red-700", iconColor: "text-red-600" },
  { value: "golpe", label: "Golpe", Icon: Hammer, color: "bg-orange-100 text-orange-700", iconColor: "text-orange-600" },
  { value: "corte", label: "Corte", Icon: Scissors, color: "bg-rose-100 text-rose-700", iconColor: "text-rose-600" },
  { value: "electrico", label: "Eléctrico", Icon: Zap, color: "bg-yellow-100 text-yellow-700", iconColor: "text-yellow-600" },
  { value: "derrumbe", label: "Derrumbe", Icon: Building2, color: "bg-stone-100 text-stone-700", iconColor: "text-stone-600" },
  { value: "incendio", label: "Incendio", Icon: Flame, color: "bg-red-100 text-red-700", iconColor: "text-red-600" },
  { value: "quimico", label: "Químico", Icon: FlaskConical, color: "bg-purple-100 text-purple-700", iconColor: "text-purple-600" },
  { value: "epp_faltante", label: "EPP Faltante", Icon: HardHat, color: "bg-amber-100 text-amber-700", iconColor: "text-amber-600" },
  { value: "condicion_insegura", label: "Cond. Insegura", Icon: AlertTriangle, color: "bg-yellow-100 text-yellow-700", iconColor: "text-yellow-600" },
  { value: "acto_inseguro", label: "Acto Inseguro", Icon: Ban, color: "bg-red-100 text-red-700", iconColor: "text-red-600" },
  { value: "casi_accidente", label: "Casi Accidente", Icon: TriangleAlert, color: "bg-blue-100 text-blue-700", iconColor: "text-blue-600" },
  { value: "otro", label: "Otro", Icon: ClipboardList, color: "bg-gray-100 text-gray-700", iconColor: "text-gray-600" },
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
  { value: "prevencion", label: "Prevención", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "cerrado", label: "Cerrado", color: "bg-green-100 text-green-700 border-green-200" },
] as const;

type Tab = "reportar" | "incidentes" | "stats" | "checklist" | "voz";
type IncidenteView = "list" | "chat";
type FiltroEstadoFromKPI = "" | "abierto" | "en_proceso" | "prevencion" | "cerrado";

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
  const [filtroEstadoGlobal, setFiltroEstadoGlobal] = useState<FiltroEstadoFromKPI>("");

  const proyectoActual = userProjects?.find((p: any) => p.id === selectedProjectId);
  const isSegurista = user?.role === 'segurista';

  if (!selectedProjectId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Selecciona un proyecto primero</p>
        </div>
      </DashboardLayout>
    );
  }

  // Seguristas ven tabs simplificados enfocados en su trabajo
  const allTabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: "reportar", label: "Reportar", icon: AlertTriangle },
    { id: "incidentes", label: "Incidentes", icon: Shield },
    { id: "stats", label: "Stats", icon: BarChart3 },
    { id: "checklist", label: "Checklist", icon: ClipboardCheck },
    { id: "voz", label: "Voz", icon: Mic },
  ];
  const tabs = allTabs;

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

        {/* KPIs de seguridad - visibles para todos */}
        <KPIsSeguridad
          proyectoId={selectedProjectId}
          onFilterClick={(estado: FiltroEstadoFromKPI) => {
            setFiltroEstadoGlobal(estado);
            setActiveTab('incidentes');
            setChatIncidenteId(null);
            setChatIncidenteInfo(null);
          }}
          activeFilter={filtroEstadoGlobal}
        />

        {/* Dashboard extendido solo para seguristas */}
        {isSegurista && <DashboardSegurista proyectoId={selectedProjectId} onOpenChat={(id: number, info: any) => { setChatIncidenteId(id); setChatIncidenteInfo(info); setActiveTab('incidentes'); }} />}

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
              filtroEstadoExterno={filtroEstadoGlobal}
              onClearFiltroExterno={() => setFiltroEstadoGlobal("")}
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
// KPIs DE SEGURIDAD - Conteos clickeables como filtros
// ==========================================
function KPIsSeguridad({ proyectoId, onFilterClick, activeFilter }: {
  proyectoId: number;
  onFilterClick: (estado: FiltroEstadoFromKPI) => void;
  activeFilter: FiltroEstadoFromKPI;
}) {
  const { data: stats, isLoading } = trpc.seguridad.estadisticas.useQuery({ proyectoId });

  if (isLoading || !stats) return null;

  const kpis = [
    { key: '' as FiltroEstadoFromKPI, label: 'Total', value: stats.total, color: 'text-foreground', border: 'border-border', bg: '' },
    { key: 'abierto' as FiltroEstadoFromKPI, label: 'Abiertos', value: stats.abiertos, color: 'text-red-600', border: 'border-red-200', bg: 'bg-red-50/50' },
    { key: 'en_proceso' as FiltroEstadoFromKPI, label: 'Proceso', value: stats.enProceso, color: 'text-amber-600', border: 'border-amber-200', bg: 'bg-amber-50/50' },
    { key: 'prevencion' as FiltroEstadoFromKPI, label: 'Prevenci\u00f3n', value: stats.prevencion || 0, color: 'text-blue-600', border: 'border-blue-200', bg: 'bg-blue-50/50' },
    { key: 'cerrado' as FiltroEstadoFromKPI, label: 'Cerrados', value: stats.cerrados, color: 'text-green-600', border: 'border-green-200', bg: 'bg-green-50/50' },
  ];

  return (
    <div className="grid grid-cols-5 gap-1.5 mb-3">
      {kpis.map((k) => (
        <button
          key={k.key}
          onClick={() => onFilterClick(activeFilter === k.key ? '' : k.key)}
          className={`p-2 text-center rounded-lg border transition-all ${
            activeFilter === k.key
              ? `${k.border} ${k.bg} ring-2 ring-red-500/30 shadow-sm`
              : `${k.border} ${k.bg} hover:shadow-sm`
          }`}
        >
          <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
          <p className="text-[8px] text-muted-foreground">{k.label}</p>
        </button>
      ))}
    </div>
  );
}

// ==========================================
// TAB REPORTAR - Reporte ultra r\u00e1pido
// ==========================================
function TabReportar({ proyectoId }: { proyectoId: number }) {
  const [tipo, setTipo] = useState<string>("");
  const [severidad, setSeveridad] = useState<string>("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoOriginal, setFotoOriginal] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Voice recording for description
  const [isRecordingDesc, setIsRecordingDesc] = useState(false);
  const [recordingTimeDesc, setRecordingTimeDesc] = useState(0);
  const descRecorderRef = useRef<MediaRecorder | null>(null);
  const descChunksRef = useRef<Blob[]>([]);
  const descTimerRef = useRef<NodeJS.Timeout | null>(null);
  const descRecTimeRef = useRef(0);

  const vozMut = trpc.seguridad.vozADescripcion.useMutation({
    onSuccess: (data) => {
      setDescripcion(data.resumen);
      toast.success("Voz transcrita");
    },
    onError: (err) => toast.error(err.message),
  });

  const startRecordingDesc = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      descChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) descChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(descChunksRef.current, { type: mimeType });
        if (blob.size < 1000) { toast.error("Audio muy corto"); return; }
        const reader = new FileReader();
        reader.onloadend = () => {
          vozMut.mutate({ audioBase64: reader.result as string, mimeType: mimeType.split(';')[0] });
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      descRecorderRef.current = recorder;
      setIsRecordingDesc(true);
      setRecordingTimeDesc(0);
      descRecTimeRef.current = 0;
      descTimerRef.current = setInterval(() => {
        descRecTimeRef.current += 1;
        setRecordingTimeDesc(descRecTimeRef.current);
      }, 1000);
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopRecordingDesc = () => {
    if (descRecorderRef.current?.state === 'recording') descRecorderRef.current.stop();
    if (descTimerRef.current) clearInterval(descTimerRef.current);
    setIsRecordingDesc(false);
  };

  // Ubicación: niveles y unidades
  const { data: nivelesData } = trpc.seguridad.nivelesYUnidades.useQuery({ proyectoId });
  const [showUbicDropdown, setShowUbicDropdown] = useState(false);
  const [expandedNivel, setExpandedNivel] = useState<string | null>(null);
  const [asignadoA, setAsignadoA] = useState<number | undefined>(undefined);

  // Fetch usuarios del proyecto para asignar segurista
  const { data: usuariosProyecto } = trpc.seguridad.usuariosProyecto.useQuery({ proyectoId });

  // Fetch custom types for this project
  const { data: tiposCustom } = trpc.seguridad.tiposIncidencia.useQuery({ proyectoId });

  // Plantillas rápidas
  const { data: plantillas } = trpc.seguridad.plantillas.useQuery({ proyectoId });
  const aplicarPlantilla = useCallback((p: any) => {
    setTipo(p.tipo);
    setSeveridad(p.severidad);
    setDescripcion(p.descripcion);
    toast.success(`Plantilla "${p.nombre}" aplicada`);
  }, []);
  type TipoItem = { value: string; label: string; Icon: LucideIcon; color: string; iconColor: string };
  const allTipos: TipoItem[] = useMemo(() => {
    const base: TipoItem[] = [...TIPOS_INCIDENTE];
    if (tiposCustom) {
      tiposCustom.filter((tc: any) => tc.activo).forEach((tc: any) => {
        base.push({ value: tc.clave, label: tc.label, Icon: ClipboardList, color: tc.color || 'bg-gray-100 text-gray-700', iconColor: tc.iconColor || 'text-gray-600' });
      });
    }
    return base;
  }, [tiposCustom]);

  const crearMut = trpc.seguridad.crearIncidente.useMutation({
    onSuccess: () => {
      toast.success("Incidente reportado exitosamente");
      setTipo("");
      setSeveridad("");
      setDescripcion("");
      setUbicacion("");
      setFotoBase64(null);
      setFotoPreview(null);
      setAsignadoA(undefined);
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
        setFotoOriginal(result.compressed);
        setShowEditor(true);
      } catch {
        const raw = ev.target?.result as string;
        setFotoOriginal(raw);
        setShowEditor(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleEditorSave = useCallback((markedBase64: string) => {
    setFotoBase64(markedBase64);
    setFotoPreview(markedBase64);
    setShowEditor(false);
  }, []);

  const handleEditorSkip = useCallback(() => {
    // Use original without markup
    if (fotoOriginal) {
      setFotoBase64(fotoOriginal);
      setFotoPreview(fotoOriginal);
    }
    setShowEditor(false);
  }, [fotoOriginal]);

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
      asignadoA: asignadoA || undefined,
    });
  };

  // Show FotoEditor overlay when photo is captured
  if (showEditor && fotoOriginal) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-red-600">Marcar Foto</h3>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleEditorSkip}>
            Omitir marcado
          </Button>
        </div>
        <FotoEditor
          fotoUrl={fotoOriginal}
          onSave={handleEditorSave}
          onCancel={handleEditorSkip}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Plantillas rápidas */}
      {plantillas && plantillas.length > 0 && (
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground mb-1 block flex items-center gap-1">
            <Zap className="w-3 h-3 text-orange-500" /> Reporte rápido
          </label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
            {plantillas.map((p: any) => {
              const sevColors: Record<string, string> = { baja: 'border-green-300 bg-green-50', media: 'border-amber-300 bg-amber-50', alta: 'border-orange-300 bg-orange-50', critica: 'border-red-300 bg-red-50' };
              return (
                <button
                  key={p.id}
                  onClick={() => aplicarPlantilla(p)}
                  className={`shrink-0 snap-start px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all whitespace-nowrap ${sevColors[p.severidad] || 'border-gray-200 bg-gray-50'} hover:shadow-sm active:scale-95`}
                >
                  {p.nombre}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tipo - Grid compacto 4 columnas */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground mb-1.5 block">Tipo de incidente *</label>
        <div className="grid grid-cols-4 gap-1.5">
          {allTipos.map((t) => (
            <button
              key={t.value}
              onClick={() => setTipo(prev => prev === t.value ? "" : t.value)}
              className={`py-1.5 px-1 rounded-lg border-2 text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                tipo === t.value
                  ? "border-red-500 bg-red-50 shadow-sm"
                  : "border-transparent bg-muted/30 hover:bg-muted/60"
              }`}
            >
              {(() => { const TIcon = t.Icon; return <TIcon className={`w-4 h-4 ${tipo === t.value ? t.iconColor : 'text-muted-foreground'}`} />; })()}
              <span className="text-[8px] font-medium leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Severidad - inline compacto */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground mb-1.5 block">Severidad *</label>
        <div className="flex gap-1.5">
          {SEVERIDADES.map((s) => (
            <button
              key={s.value}
              onClick={() => setSeveridad(prev => prev === s.value ? "" : s.value)}
              className={`flex-1 py-1.5 px-1 rounded-lg border-2 text-center transition-all flex items-center justify-center gap-1.5 ${
                severidad === s.value
                  ? `border-current ${s.bgLight} ${s.textColor} shadow-sm`
                  : "border-transparent bg-muted/30 hover:bg-muted/60"
              }`}
            >
              <div className={`h-2 w-2 rounded-full ${s.color} shrink-0`} />
              <span className="text-[10px] font-medium">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Foto - compacto */}
      <div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
        <input ref={galleryRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
        {fotoPreview ? (
          <div className="relative">
            <img src={fotoPreview} alt="Evidencia" className="w-full h-20 object-cover rounded-lg border" />
            <button
              onClick={() => { setFotoBase64(null); setFotoPreview(null); }}
              className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex-1 h-10 border-2 border-dashed border-red-300 rounded-lg flex items-center justify-center gap-1.5 hover:bg-red-50 transition-colors"
            >
              <Camera className="w-4 h-4 text-red-400" />
              <span className="text-[10px] font-medium text-red-500">Tomar Foto</span>
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="flex-1 h-10 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors"
            >
              <ImageIcon className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-medium text-slate-500">Galería</span>
            </button>
          </div>
        )}
      </div>

      {/* Descripción con botón de voz - compacto */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Descripción *</label>
        <div className="relative">
          <Textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Describe brevemente el incidente..."
            rows={2}
            className="resize-none text-sm pl-10"
          />
          <button
            type="button"
            onClick={isRecordingDesc ? stopRecordingDesc : startRecordingDesc}
            disabled={vozMut.isPending}
            className={`absolute left-1.5 top-1.5 h-7 w-7 rounded-full flex items-center justify-center transition-all ${
              isRecordingDesc
                ? 'bg-red-500 text-white animate-pulse'
                : vozMut.isPending
                  ? 'bg-gray-200 text-gray-400'
                  : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
            }`}
          >
            {vozMut.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isRecordingDesc ? (
              <Square className="w-2.5 h-2.5 fill-current" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>
          {isRecordingDesc && (
            <span className="absolute left-10 top-2.5 text-[10px] text-red-500 font-mono">
              {Math.floor(recordingTimeDesc / 60)}:{(recordingTimeDesc % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>
        {vozMut.isPending && (
          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Transcribiendo...
          </p>
        )}
      </div>

      {/* Ubicación + Asignar - en una fila */}
      <div className="grid grid-cols-2 gap-2">
        {/* Ubicación */}
        <div className="relative">
          <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Ubicación</label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setShowUbicDropdown(!showUbicDropdown)}
              className="h-8 w-8 rounded-md border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
            >
              <MapPin className="w-3.5 h-3.5" />
            </button>
            <Input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Nivel, zona..."
              className="text-xs h-8 flex-1"
            />
          </div>
          {showUbicDropdown && nivelesData && (
            <div className="absolute z-[60] top-full mt-1 left-0 w-[calc(200%+0.5rem)] bg-background border rounded-lg shadow-xl max-h-52 overflow-auto">
              {nivelesData.map((n) => (
                <div key={n.nivel}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-muted flex items-center justify-between border-b"
                    onClick={() => {
                      if (expandedNivel === n.nivel) {
                        setExpandedNivel(null);
                      } else {
                        setExpandedNivel(n.nivel);
                      }
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      {n.nivel}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{n.unidades.length} uds</span>
                  </button>
                  {expandedNivel === n.nivel && (
                    <div className="bg-muted/30">
                      <button
                        type="button"
                        className="w-full text-left px-5 py-1.5 text-xs hover:bg-muted/60 text-emerald-600 font-medium"
                        onClick={() => {
                          setUbicacion(n.nivel);
                          setShowUbicDropdown(false);
                          setExpandedNivel(null);
                        }}
                      >
                        {n.nivel} (general)
                      </button>
                      {n.unidades.map((u) => (
                        <button
                          key={u}
                          type="button"
                          className="w-full text-left px-5 py-1.5 text-xs hover:bg-muted/60"
                          onClick={() => {
                            setUbicacion(`${n.nivel} - ${u}`);
                            setShowUbicDropdown(false);
                            setExpandedNivel(null);
                          }}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Asignar segurista */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Asignar a</label>
          <select
            value={asignadoA || ''}
            onChange={(e) => setAsignadoA(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full h-8 rounded-md border bg-background text-xs px-2 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          >
            <option value="">Sin asignar</option>
            {(() => {
              // Solo mostrar seguristas en el dropdown de asignación
              const seguristas = (usuariosProyecto || []).filter((u: any) => u.role === 'segurista');
              const sorted = [...seguristas].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
              return sorted.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ));
            })()}
          </select>
        </div>
      </div>

      {/* Botón enviar - sticky en mobile */}
      <div className="sticky bottom-0 pt-2 pb-1 bg-background">
        <Button
          onClick={handleSubmit}
          disabled={crearMut.isPending || !tipo || !severidad || !descripcion.trim()}
          className="w-full h-11 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold rounded-xl shadow-lg"
        >
          {crearMut.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Reportando...</>
          ) : (
            <><Send className="w-4 h-4 mr-2" /> Reportar Incidente</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ==========================================
// TAB INCIDENTES - Lista con filtros
// ==========================================
function TabIncidentes({ proyectoId, onOpenChat, filtroEstadoExterno, onClearFiltroExterno }: { proyectoId: number; onOpenChat: (id: number, info: any) => void; filtroEstadoExterno?: FiltroEstadoFromKPI; onClearFiltroExterno?: () => void }) {
  const { user } = useAuth();
  const [filtroEstadoLocal, setFiltroEstadoLocal] = useState<string>("");
  const filtroEstado = filtroEstadoExterno || filtroEstadoLocal;
  const setFiltroEstado = (v: string) => {
    setFiltroEstadoLocal(v);
    if (onClearFiltroExterno) onClearFiltroExterno();
  };
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [soloMisAsignados, setSoloMisAsignados] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [accionCorrectiva, setAccionCorrectiva] = useState("");
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [pdfLoading, setPdfLoading] = useState<number | null>(null);
  const [showAsignarId, setShowAsignarId] = useState<number | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // Fetch custom types for filter dropdown
  const { data: tiposCustom } = trpc.seguridad.tiposIncidencia.useQuery({ proyectoId });
  type TipoItemList = { value: string; label: string; Icon: LucideIcon; color: string; iconColor: string };
  const allTiposForFilter: TipoItemList[] = useMemo(() => {
    const base: TipoItemList[] = [...TIPOS_INCIDENTE];
    if (tiposCustom) {
      tiposCustom.filter((tc: any) => tc.activo).forEach((tc: any) => {
        base.push({ value: tc.clave, label: tc.label, Icon: ClipboardList, color: tc.color || 'bg-gray-100 text-gray-700', iconColor: tc.iconColor || 'text-gray-600' });
      });
    }
    return base;
  }, [tiposCustom]);

  const { data: incidentes, isLoading } = trpc.seguridad.listar.useQuery({
    proyectoId,
    estado: filtroEstado || undefined,
    tipo: filtroTipo || undefined,
  });

  const { data: usuarios } = trpc.seguridad.usuariosProyecto.useQuery({ proyectoId });
  const getUsuarioNombre = (userId: number | string | null) => {
    if (!userId || !usuarios) return null;
    const u = usuarios.find((u: any) => u.id === userId);
    return u ? u.name : null;
  };

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

  const eliminarMut = trpc.seguridad.eliminarIncidente.useMutation({
    onSuccess: () => {
      toast.success("Incidente eliminado");
      utils.seguridad.listar.invalidate();
      utils.seguridad.estadisticas.invalidate();
      setShowDeleteConfirm(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const asignarMut = trpc.seguridad.asignarIncidente.useMutation({
    onSuccess: () => {
      toast.success("Incidente asignado");
      utils.seguridad.listar.invalidate();
      setShowAsignarId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const exportarPDFMut = trpc.seguridad.exportarPDF.useMutation({
    onSuccess: (data) => {
      const html = generarFichaIncidencia(data);
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
      setPdfLoading(null);
    },
    onError: (e) => { toast.error(e.message); setPdfLoading(null); },
  });

  const handleCerrar = () => {
    if (!selectedId) return;
    actualizarMut.mutate({ id: selectedId, estado: "cerrado", accionCorrectiva });
  };

  const tipoInfo = (tipo: string) => allTiposForFilter.find(t => t.value === tipo) || TIPOS_INCIDENTE.find(t => t.value === tipo);
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
          {allTiposForFilter.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button
          onClick={() => setSoloMisAsignados(!soloMisAsignados)}
          className={`text-xs border rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors ${
            soloMisAsignados
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-background border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          Mis asignados
        </button>
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
          {incidentes.filter((inc: any) => !soloMisAsignados || inc.asignadoA === user?.id).map((inc: any) => {
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
                      {(() => { const TpIcon = tp?.Icon || ClipboardList; return <TpIcon className={`w-6 h-6 ${tp?.iconColor || 'text-gray-500'}`} />; })()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-xs font-semibold">{tp?.label || inc.tipo}</span>
                      {inc.codigo && (
                        <span className="text-[9px] font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded whitespace-nowrap">{inc.codigo}</span>
                      )}
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${estadoInfo(inc.estado)?.color || ""}`}>
                        {estadoInfo(inc.estado)?.label || inc.estado}
                      </Badge>
                      <div className={`h-2 w-2 rounded-full ${sv?.color || "bg-gray-400"} ml-auto`} title={sv?.label} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{inc.descripcion}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {inc.ubicacion && (
                        <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{inc.ubicacion}</span>
                      )}
                      {inc.asignadoA && getUsuarioNombre(inc.asignadoA) && (
                        <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                          <UserCheck className="w-3 h-3" />
                          {getUsuarioNombre(inc.asignadoA)}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/50 ml-auto">
                        {new Date(inc.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    {/* Acciones rápidas - solo iconos con tooltip */}
                    <div className="flex items-center gap-0.5 mt-2 flex-wrap">
                      {inc.estado !== "cerrado" && inc.estado === "abierto" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6 border-amber-200 text-amber-600 hover:bg-amber-50 p-0"
                              onClick={() => actualizarMut.mutate({ id: inc.id, estado: "en_proceso" })}
                              disabled={actualizarMut.isPending}
                            >
                              <Clock className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>En Proceso</TooltipContent>
                        </Tooltip>
                      )}
                      {inc.estado !== "cerrado" && inc.estado !== "prevencion" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6 border-blue-200 text-blue-600 hover:bg-blue-50 p-0"
                              onClick={() => actualizarMut.mutate({ id: inc.id, estado: "prevencion" })}
                              disabled={actualizarMut.isPending}
                            >
                              <Shield className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Prevención</TooltipContent>
                        </Tooltip>
                      )}
                      {inc.estado !== "cerrado" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6 border-green-200 text-green-600 hover:bg-green-50 p-0"
                              onClick={() => { setSelectedId(inc.id); setShowCerrarModal(true); }}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Cerrar Incidente</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6 border-red-200 text-red-600 hover:bg-red-50 p-0"
                            onClick={() => onOpenChat(inc.id, { tipo: tp?.label || inc.tipo, tipoValue: inc.tipo, severidad: inc.severidad, sevLabel: sv?.label, estado: estadoInfo(inc.estado)?.label, descripcion: inc.descripcion, codigo: inc.codigo })}
                          >
                            <MessageCircle className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Chat</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6 border-gray-200 text-gray-600 hover:bg-gray-50 p-0"
                            onClick={() => { setPdfLoading(inc.id); exportarPDFMut.mutate({ incidenteId: inc.id }); }}
                            disabled={pdfLoading === inc.id}
                          >
                            {pdfLoading === inc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Exportar PDF</TooltipContent>
                      </Tooltip>
                      {inc.estado !== "cerrado" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6 border-purple-200 text-purple-600 hover:bg-purple-50 p-0"
                              onClick={() => setShowAsignarId(showAsignarId === inc.id ? null : inc.id)}
                            >
                              <User className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Asignar</TooltipContent>
                        </Tooltip>
                      )}
                      {isAdmin && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6 border-red-300 text-red-600 hover:bg-red-50 p-0"
                              onClick={() => setShowDeleteConfirm(inc.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {/* Dropdown asignar */}
                    {showAsignarId === inc.id && usuarios && (
                      <div className="mt-1 p-2 bg-purple-50 rounded-lg border border-purple-200 animate-in slide-in-from-top-1">
                        <p className="text-[10px] font-medium text-purple-700 mb-1">Asignar a:</p>
                        <div className="flex flex-wrap gap-1">
                          {usuarios.filter((u: any) => u.role === 'segurista').map((u: any) => (
                            <button
                              key={u.id}
                              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                inc.asignadoA === u.id
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-100'
                              }`}
                              onClick={() => asignarMut.mutate({ incidenteId: inc.id, asignadoA: u.id })}
                              disabled={asignarMut.isPending}
                            >
                              {u.name}
                            </button>
                          ))}
                          {inc.asignadoA && (
                            <button
                              className="text-[10px] px-2 py-0.5 rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100"
                              onClick={() => asignarMut.mutate({ incidenteId: inc.id, asignadoA: null })}
                              disabled={asignarMut.isPending}
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal confirmar eliminación */}
      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm text-red-600">Eliminar Incidente</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Esta acción eliminará el incidente y todos sus mensajes asociados. No se puede deshacer.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(null)}>Cancelar</Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => showDeleteConfirm && eliminarMut.mutate({ incidenteId: showDeleteConfirm })}
              disabled={eliminarMut.isPending}
            >
              {eliminarMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
// DASHBOARD SEGURISTA - Vista rápida para seguristas
// ==========================================
function DashboardSegurista({ proyectoId, onOpenChat }: { proyectoId: number; onOpenChat: (id: number, info: any) => void }) {
  const { data, isLoading } = trpc.seguridad.dashboardSegurista.useQuery({ proyectoId });

  if (isLoading || !data) return null;

  const { stats, incidentes, misAsignados, diasSinAccidentes, tiempoPromedioHoras, rendimientoSeguristas, rendimientoEmpresas, semaforoEmpresas } = data as any;
  const urgentes = incidentes.filter((i: any) => i.estado === 'abierto' && (i.severidad === 'critica' || i.severidad === 'alta'));

  const renderIncidentRow = (inc: any, borderColor: string = 'border-gray-200') => {
    const tp = TIPOS_INCIDENTE.find(t => t.value === inc.tipo);
    const sv = SEVERIDADES.find(s => s.value === inc.severidad);
    const TpIcon = tp?.Icon || AlertTriangle;
    const estadoLabels: Record<string, string> = { abierto: 'Abierto', en_proceso: 'En Proceso', prevencion: 'Prevención', cerrado: 'Cerrado' };
    return (
      <div key={inc.id} className={`flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded p-1.5 -mx-1`}
        onClick={() => onOpenChat(inc.id, { tipo: tp?.label || inc.tipo, tipoValue: inc.tipo, severidad: inc.severidad, sevLabel: sv?.label, estado: estadoLabels[inc.estado] || inc.estado, descripcion: inc.descripcion, codigo: inc.codigo })}
      >
        <TpIcon className={`w-3.5 h-3.5 shrink-0 ${tp?.iconColor || 'text-gray-500'}`} />
        <span className="font-mono text-[9px] text-muted-foreground shrink-0">{inc.codigo}</span>
        <span className="truncate flex-1">{inc.descripcion}</span>
        <div className={`h-2 w-2 rounded-full shrink-0 ${sv?.color || 'bg-gray-400'}`} />
        <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">
          {inc.mensajesCount || 0}
        </Badge>
      </div>
    );
  };

  return (
    <div className="mb-4 space-y-3">
      {/* Contador de días sin accidentes */}
      <Card className={`p-3 text-center ${diasSinAccidentes >= 30 ? 'border-green-400 bg-green-50/50' : diasSinAccidentes >= 7 ? 'border-amber-300 bg-amber-50/50' : 'border-red-300 bg-red-50/50'}`}>
        <div className="flex items-center justify-center gap-2">
          <Shield className={`w-5 h-5 ${diasSinAccidentes >= 30 ? 'text-green-600' : diasSinAccidentes >= 7 ? 'text-amber-600' : 'text-red-600'}`} />
          <span className={`text-3xl font-bold ${diasSinAccidentes >= 30 ? 'text-green-700' : diasSinAccidentes >= 7 ? 'text-amber-700' : 'text-red-700'}`}>{diasSinAccidentes}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Días sin accidentes críticos</p>
        {tiempoPromedioHoras > 0 && (
          <p className="text-[9px] text-muted-foreground mt-0.5">Tiempo promedio resolución: <span className="font-semibold">{tiempoPromedioHoras < 24 ? `${tiempoPromedioHoras}h` : `${Math.round(tiempoPromedioHoras / 24 * 10) / 10}d`}</span></p>
        )}
      </Card>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-5 gap-1.5">
        <Card className="p-2 text-center">
          <p className="text-lg font-bold">{stats.total}</p>
          <p className="text-[8px] text-muted-foreground">Total</p>
        </Card>
        <Card className="p-2 text-center border-red-200">
          <p className="text-lg font-bold text-red-600">{stats.abiertos}</p>
          <p className="text-[8px] text-muted-foreground">Abiertos</p>
        </Card>
        <Card className="p-2 text-center border-amber-200">
          <p className="text-lg font-bold text-amber-600">{stats.enProceso}</p>
          <p className="text-[8px] text-muted-foreground">Proceso</p>
        </Card>
        <Card className="p-2 text-center border-blue-200">
          <p className="text-lg font-bold text-blue-600">{stats.prevencion}</p>
          <p className="text-[8px] text-muted-foreground">Prevención</p>
        </Card>
        <Card className="p-2 text-center border-green-200">
          <p className="text-lg font-bold text-green-600">{stats.cerrados}</p>
          <p className="text-[8px] text-muted-foreground">Cerrados</p>
        </Card>
      </div>

      {/* Semáforo por empresa */}
      {semaforoEmpresas && semaforoEmpresas.length > 0 && (
        <Card className="p-3">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">Semáforo por Empresa</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {semaforoEmpresas.map((e: any) => (
              <div key={e.id} className={`flex items-center gap-1.5 p-1.5 rounded border text-[10px] ${
                e.color === 'verde' ? 'border-green-300 bg-green-50' :
                e.color === 'amarillo' ? 'border-amber-300 bg-amber-50' :
                'border-red-300 bg-red-50'
              }`}>
                <div className={`w-3 h-3 rounded-full shrink-0 ${
                  e.color === 'verde' ? 'bg-green-500' :
                  e.color === 'amarillo' ? 'bg-amber-500' :
                  'bg-red-500'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{e.nombre}</p>
                  <p className="text-[8px] text-muted-foreground">
                    {e.abiertos > 0 && <span className="text-red-600">{e.abiertos} abiertos</span>}
                    {e.abiertos > 0 && e.enProceso > 0 && ' · '}
                    {e.enProceso > 0 && <span className="text-amber-600">{e.enProceso} proceso</span>}
                    {e.abiertos === 0 && e.enProceso === 0 && <span className="text-green-600">Sin pendientes</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* MIS INCIDENTES ASIGNADOS - Sección principal para seguristas */}
      {misAsignados && misAsignados.length > 0 && (
        <Card className="p-3 border-orange-300 bg-orange-50/50">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-orange-600" />
            <span className="text-xs font-semibold text-orange-700">Mis Asignados ({misAsignados.length})</span>
          </div>
          <div className="space-y-0.5 divide-y divide-orange-100">
            {misAsignados.map((inc: any) => renderIncidentRow(inc, 'border-orange-200'))}
          </div>
        </Card>
      )}

      {/* Rendimiento por segurista */}
      {rendimientoSeguristas && rendimientoSeguristas.length > 0 && (
        <Card className="p-3">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">Rendimiento por Segurista</p>
          <div className="space-y-1">
            {rendimientoSeguristas.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-[10px] py-1 border-b border-muted last:border-0">
                <span className="truncate flex-1 font-medium">{s.nombre || 'Sin nombre'}</span>
                <span className="text-muted-foreground mx-1">{s.cerrados}/{s.total}</span>
                <span className={`font-mono text-[9px] px-1 rounded ${s.promedioHoras !== null ? (s.promedioHoras < 24 ? 'bg-green-100 text-green-700' : s.promedioHoras < 72 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-500'}`}>
                  {s.promedioHoras !== null ? (s.promedioHoras < 24 ? `${s.promedioHoras}h` : `${Math.round(s.promedioHoras / 24 * 10) / 10}d`) : '-'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Rendimiento por empresa */}
      {rendimientoEmpresas && rendimientoEmpresas.length > 0 && (
        <Card className="p-3">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">Incidentes por Empresa</p>
          <div className="space-y-1">
            {rendimientoEmpresas.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between text-[10px] py-1 border-b border-muted last:border-0">
                <span className="truncate flex-1 font-medium">{e.nombre}</span>
                <span className="text-muted-foreground mx-1">{e.cerrados}/{e.total}</span>
                <span className={`font-mono text-[9px] px-1 rounded ${e.promedioHoras !== null ? (e.promedioHoras < 24 ? 'bg-green-100 text-green-700' : e.promedioHoras < 72 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-500'}`}>
                  {e.promedioHoras !== null ? (e.promedioHoras < 24 ? `${e.promedioHoras}h` : `${Math.round(e.promedioHoras / 24 * 10) / 10}d`) : '-'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Incidentes urgentes */}
      {urgentes.length > 0 && (
        <Card className="p-3 border-red-300 bg-red-50/50">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-red-500" />
            <span className="text-xs font-semibold text-red-700">Urgentes ({urgentes.length})</span>
          </div>
          <div className="space-y-0.5 divide-y divide-red-100">
            {urgentes.slice(0, 5).map((inc: any) => renderIncidentRow(inc, 'border-red-200'))}
          </div>
        </Card>
      )}
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
          <p className="text-[10px] text-muted-foreground">Prevención</p>
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
                  {(() => { const TIcon = info?.Icon || ClipboardList; return <TIcon className={`w-4 h-4 ${info?.iconColor || 'text-gray-500'}`} />; })()}
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
                    {cl.ubicacion && <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{cl.ubicacion}</p>}
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
function generarFichaIncidencia(data: any): string {
  const sevColors: Record<string, string> = { Baja: '#16a34a', Media: '#ca8a04', Alta: '#ea580c', 'Crítica': '#dc2626', baja: '#16a34a', media: '#ca8a04', alta: '#ea580c', critica: '#dc2626' };
  const sevColor = sevColors[data.severidad] || '#6b7280';
  const sevLabels: Record<string, string> = { baja: 'BAJA', media: 'MEDIA', alta: 'ALTA', critica: 'CRÍTICA' };
  const fecha = new Date(data.fechaCreacion).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  const hora = new Date(data.fechaCreacion).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const estadoLabels: Record<string, string> = { abierto: 'Abierto', en_proceso: 'En Proceso', prevencion: 'Prevención', cerrado: 'Cerrado' };
  const estadoColors: Record<string, string> = { abierto: '#dc2626', en_proceso: '#ca8a04', prevencion: '#2563eb', cerrado: '#16a34a' };
  const tipoLabels: Record<string, string> = { caida: 'Caída', electrico: 'Eléctrico', incendio: 'Incendio', quimico: 'Químico', ergonomico: 'Ergonómico', atrapamiento: 'Atrapamiento', golpe: 'Golpe', corte: 'Corte', otro: 'Otro' };

  let mensajesHtml = '';
  if (data.mensajes?.length > 0) {
    const msgs = data.mensajes.slice(0, 6);
    mensajesHtml = msgs.map((m: any) => {
      const mFecha = new Date(m.fecha).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
      const mHora = new Date(m.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      let content = '';
      if (m.tipo === 'foto' && m.fotoUrl) content = '<span style="color:#2563eb;font-size:7px;font-style:italic">[Foto adjunta]</span>';
      else if (m.tipo === 'voz' && m.bullets?.length) content = m.bullets.slice(0,2).map((b: string) => `<span style="font-size:7px">• ${b}</span>`).join('<br/>');
      else content = `<span style="font-size:7px">${(m.texto || '').substring(0, 60)}${(m.texto || '').length > 60 ? '...' : ''}</span>`;
      return `<tr><td style="font-size:6.5px;color:#888;padding:1px 3px;border-bottom:1px solid #f3f3f3;white-space:nowrap;vertical-align:top;width:60px">${m.usuario}<br/><span style="color:#aaa">${mFecha} ${mHora}</span></td><td style="padding:1px 3px;border-bottom:1px solid #f3f3f3;vertical-align:top">${content}</td></tr>`;
    }).join('');
    if (data.mensajes.length > 6) mensajesHtml += `<tr><td colspan="2" style="font-size:6.5px;color:#aaa;padding:1px 3px;text-align:center">+ ${data.mensajes.length - 6} mensajes más</td></tr>`;
  }

  const fotosHtml = (data.fotoUrl || data.fotoMarcadaUrl) ? `<div class="section">
    <div class="section-title">Evidencia Fotográfica</div>
    <div style="display:flex;gap:6px;align-items:flex-start">
      ${data.fotoUrl ? `<div style="flex:1;text-align:center"><img src="${data.fotoUrl}" style="max-width:100%;max-height:110px;object-fit:contain;border-radius:3px;border:1px solid #e5e7eb" /><div style="font-size:6px;color:#999;margin-top:1px">Original</div></div>` : ''}
      ${data.fotoMarcadaUrl ? `<div style="flex:1;text-align:center"><img src="${data.fotoMarcadaUrl}" style="max-width:100%;max-height:110px;object-fit:contain;border-radius:3px;border:1px solid #e5e7eb" /><div style="font-size:6px;color:#999;margin-top:1px">Marcada</div></div>` : ''}
    </div>
  </div>` : '';

  // Chat photos from messages
  const chatFotos = data.mensajes?.filter((m: any) => m.tipo === 'foto' && m.fotoUrl).slice(0, 4) || [];
  const chatFotosHtml = chatFotos.length > 0 ? `<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
    ${chatFotos.map((m: any) => `<img src="${m.fotoUrl}" style="width:70px;height:50px;object-fit:cover;border-radius:2px;border:1px solid #e5e7eb" />`).join('')}
  </div>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ficha ${data.codigo}</title>
<style>
@page{size:letter;margin:10mm 12mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:8px;line-height:1.3}
.page{width:100%;max-width:190mm}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #0d9488;padding-bottom:6px;margin-bottom:6px}
.logo-area{}
.logo-text{font-size:16px;font-weight:800;color:#0d9488;letter-spacing:-0.3px;line-height:1}
.logo-sub{font-size:7px;color:#888;font-weight:400;letter-spacing:0.2px;margin-top:1px}
.title-area{text-align:right}
.title-area h1{font-size:9px;color:#444;margin:0;text-transform:uppercase;letter-spacing:0.3px;font-weight:700;line-height:1.2}
.title-area .codigo{font-size:14px;font-weight:800;color:${sevColor};margin-top:2px}
.meta-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding:3px 0}
.sev-badge{display:inline-block;padding:1px 8px;border-radius:8px;font-size:7px;font-weight:700;color:white;background:${sevColor};letter-spacing:0.3px}
.estado-badge{display:inline-block;padding:1px 8px;border-radius:8px;font-size:7px;font-weight:600;color:white;background:${estadoColors[data.estado] || '#6b7280'}}
.section{margin:5px 0}
.section-title{font-size:7.5px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:0.4px;border-bottom:1px solid #e5e7eb;padding-bottom:2px;margin-bottom:4px}
.info-table{width:100%;border-collapse:collapse}
.info-table td{padding:2px 4px;font-size:8px;border-bottom:1px solid #f5f5f5}
.info-table .lbl{color:#999;font-size:6.5px;text-transform:uppercase;letter-spacing:0.2px;width:70px;vertical-align:top;font-weight:500}
.info-table .val{font-weight:600;color:#333}
.desc-box{font-size:8px;line-height:1.35;color:#333;padding:4px 6px;background:#f8fafb;border-left:2.5px solid #0d9488;border-radius:0 3px 3px 0;margin:3px 0}
.msg-table{width:100%;border-collapse:collapse}
.footer{margin-top:8px;padding-top:4px;border-top:1.5px solid #0d9488;display:flex;justify-content:space-between;font-size:6.5px;color:#aaa}
@media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{page-break-inside:avoid}}
</style></head><body>
<div class="page">
  <div class="header">
    <div class="logo-area">
      <div class="logo-text">OBJETIVA</div>
      <div class="logo-sub">INNOVACIÓN EN DESARROLLOS INMOBILIARIOS</div>
    </div>
    <div class="title-area">
      <h1>Ficha de Incidencia<br/>Seguridad e Higiene</h1>
      <div class="codigo">${data.codigo}</div>
    </div>
  </div>

  <div class="meta-row">
    <div><span class="sev-badge">SEVERIDAD: ${sevLabels[data.severidad] || data.severidad.toUpperCase()}</span></div>
    <div><span class="estado-badge">${estadoLabels[data.estado] || data.estado}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Información General</div>
    <table class="info-table">
      <tr><td class="lbl">Tipo</td><td class="val">${tipoLabels[data.tipo] || data.tipo}</td><td class="lbl">Fecha</td><td class="val">${fecha} — ${hora}</td></tr>
      <tr><td class="lbl">Reportado por</td><td class="val">${data.reportadoPor}</td><td class="lbl">Ubicación</td><td class="val">${data.ubicacion || '—'}</td></tr>
      ${data.asignadoNombre ? `<tr><td class="lbl">Asignado a</td><td class="val">${data.asignadoNombre}</td><td class="lbl">Fecha cierre</td><td class="val">${data.fechaCierre ? new Date(data.fechaCierre).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td></tr>` : (data.fechaCierre ? `<tr><td class="lbl">Fecha cierre</td><td class="val" colspan="3">${new Date(data.fechaCierre).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}</td></tr>` : '')}
    </table>
  </div>

  <div class="section">
    <div class="section-title">Descripción del Incidente</div>
    <div class="desc-box">${data.descripcion}</div>
  </div>

  ${data.accionCorrectiva ? `<div class="section"><div class="section-title">Acción Correctiva</div><div class="desc-box" style="border-left-color:#ea580c">${data.accionCorrectiva}</div></div>` : ''}

  ${fotosHtml}

  ${mensajesHtml ? `<div class="section">
    <div class="section-title">Seguimiento (${data.mensajes.length} mensajes)</div>
    <table class="msg-table">${mensajesHtml}</table>
    ${chatFotosHtml}
  </div>` : ''}

  <div class="footer">
    <span>Generado por ObjetivaQC — Sistema de Control de Calidad</span>
    <span>${new Date().toLocaleDateString('es-MX', { year:'numeric', month:'short', day:'numeric' })} ${new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })}</span>
  </div>
</div>
<script>window.onload=function(){window.print()}<\/script>
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
  const [pendingFotoBase64, setPendingFotoBase64] = useState<string | null>(null);
  const [showChatFotoEditor, setShowChatFotoEditor] = useState(false);
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

  const exportarPDFChat = trpc.seguridad.exportarPDF.useMutation({
    onSuccess: (data) => {
      const html = generarFichaIncidencia(data);
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const result = await compressAdaptive(base64);
        setPendingFotoBase64(result.compressed);
      } catch {
        setPendingFotoBase64(reader.result as string);
      }
      setShowChatFotoEditor(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleChatFotoEditorSave = (markedBase64: string) => {
    enviarFoto.mutate({ incidenteId, fotoBase64: markedBase64 });
    setShowChatFotoEditor(false);
    setPendingFotoBase64(null);
  };

  const handleChatFotoEditorSkip = () => {
    if (pendingFotoBase64) {
      enviarFoto.mutate({ incidenteId, fotoBase64: pendingFotoBase64 });
    }
    setShowChatFotoEditor(false);
    setPendingFotoBase64(null);
  };

  const handleExportPDF = () => {
    exportarPDFChat.mutate({ incidenteId });
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

  // Asignar state
  const [showBitacora, setShowBitacora] = useState(false);
  const [showAsignar, setShowAsignar] = useState(false);
  const [showEvidencias, setShowEvidencias] = useState(false);
  const evidenciaInputRef = useRef<HTMLInputElement>(null);
  const [evidenciaPending, setEvidenciaPending] = useState<string | null>(null);
  const [showEvidenciaEditor, setShowEvidenciaEditor] = useState(false);
  const [evidenciaTipo, setEvidenciaTipo] = useState<"seguimiento" | "resolucion" | "prevencion">("seguimiento");
  const [evidenciaDesc, setEvidenciaDesc] = useState("");

  const asignarMut = trpc.seguridad.asignarIncidente.useMutation({
    onSuccess: () => {
      toast.success("Responsable asignado");
      setShowAsignar(false);
      utils.seguridad.getById.invalidate({ id: incidenteId });
      bitacoraQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bitacoraQuery = trpc.seguridad.bitacoraByIncidente.useQuery({ incidenteId });
  const evidenciasQuery = trpc.seguridad.evidenciasByIncidente.useQuery({ incidenteId });

  const subirEvidenciaMut = trpc.seguridad.subirEvidencia.useMutation({
    onSuccess: () => {
      toast.success("Evidencia subida");
      evidenciasQuery.refetch();
      bitacoraQuery.refetch();
      setEvidenciaPending(null);
      setShowEvidenciaEditor(false);
      setEvidenciaDesc("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isAsignado = incidenteData?.asignadoA === user?.id;
  const canUploadEvidencia = isAsignado || isAdmin;

  const handleEvidenciaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const result = await compressAdaptive(base64);
        setEvidenciaPending(result.compressed);
      } catch {
        setEvidenciaPending(reader.result as string);
      }
      setShowEvidenciaEditor(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleEvidenciaEditorSave = (markedBase64: string) => {
    subirEvidenciaMut.mutate({
      incidenteId,
      fotoBase64: markedBase64,
      descripcion: evidenciaDesc || undefined,
      tipo: evidenciaTipo,
    });
  };

  const handleEvidenciaEditorSkip = () => {
    if (evidenciaPending) {
      subirEvidenciaMut.mutate({
        incidenteId,
        fotoBase64: evidenciaPending,
        descripcion: evidenciaDesc || undefined,
        tipo: evidenciaTipo,
      });
    }
  };

  // Render @mention highlighted text
  const renderMsgText = (text: string) => {
    const parts = text.split(/(@\w+(?:\s\w+)?)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="font-semibold text-red-600">{part}</span>
      ) : part
    );
  };

  // Show FotoEditor for evidencia before uploading
  if (showEvidenciaEditor && evidenciaPending) {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}>
        <div className="flex items-center justify-between pb-2 border-b mb-2">
          <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Marcar Evidencia
          </h3>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleEvidenciaEditorSkip}>
            Subir sin marcar
          </Button>
        </div>
        <div className="mb-2 space-y-2">
          <div className="flex gap-1">
            {(["seguimiento", "resolucion", "prevencion"] as const).map(t => (
              <button key={t} onClick={() => setEvidenciaTipo(t)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                  evidenciaTipo === t ? 'bg-emerald-500 text-white border-emerald-500' : 'border-muted-foreground/30 text-muted-foreground hover:bg-muted'
                }`}>
                {t === 'seguimiento' ? 'Seguimiento' : t === 'resolucion' ? 'Resolución' : 'Prevención'}
              </button>
            ))}
          </div>
          <input
            type="text" placeholder="Descripción breve (opcional)"
            value={evidenciaDesc} onChange={e => setEvidenciaDesc(e.target.value)}
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-background"
          />
        </div>
        <div className="flex-1 overflow-auto">
          <FotoEditor
            fotoUrl={evidenciaPending}
            onSave={handleEvidenciaEditorSave}
            onCancel={handleEvidenciaEditorSkip}
            saving={subirEvidenciaMut.isPending}
          />
        </div>
      </div>
    );
  }

  // Show FotoEditor for chat photo before sending
  if (showChatFotoEditor && pendingFotoBase64) {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}>
        <div className="flex items-center justify-between pb-2 border-b mb-2">
          <h3 className="text-sm font-semibold text-red-600 flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Marcar Foto
          </h3>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleChatFotoEditorSkip}>
            Enviar sin marcar
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          <FotoEditor
            fotoUrl={pendingFotoBase64}
            onSave={handleChatFotoEditorSave}
            onCancel={handleChatFotoEditorSkip}
            saving={enviarFoto.isPending}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}>
      {/* Header con código SEG */}
      <div className="flex items-center gap-2 pb-2 border-b mb-1">
        <button onClick={onBack} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
          {(() => { const tp = TIPOS_INCIDENTE.find(t => t.value === incidenteInfo?.tipoValue); const TpIcon = tp?.Icon || Shield; return <TpIcon className={`w-4 h-4 ${tp?.iconColor || 'text-red-600'}`} />; })()}
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
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {/* Botón rayar foto */}
          {incidenteData?.fotoUrl && (
            <button
              onClick={() => setShowFotoEditor(true)}
              className="h-6 w-6 rounded-full flex items-center justify-center bg-orange-100 hover:bg-orange-200 text-orange-600" title="Rayar foto"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {/* Botón exportar PDF */}
          <button
            onClick={handleExportPDF}
            className="h-6 w-6 rounded-full flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-600" title="Exportar reporte"
          >
            <FileDown className="h-3 w-3" />
          </button>
          {/* Botón asignar */}
          <button
            onClick={() => setShowAsignar(!showAsignar)}
            className="h-6 w-6 rounded-full flex items-center justify-center bg-purple-100 hover:bg-purple-200 text-purple-600" title="Asignar responsable"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
          </button>
          {/* Botón evidencias */}
          <button
            onClick={() => setShowEvidencias(!showEvidencias)}
            className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
              showEvidencias ? 'bg-emerald-500 text-white' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-600'
            }`} title="Evidencias">
            <ImageLucide className="h-3 w-3" />
          </button>
          {/* Botón bitácora */}
          <button
            onClick={() => setShowBitacora(!showBitacora)}
            className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
              showBitacora ? 'bg-amber-500 text-white' : 'bg-amber-100 hover:bg-amber-200 text-amber-600'
            }`} title="Bitácora"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
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

      {/* Asignar responsable dropdown */}
      {showAsignar && (
        <div className="mb-2 p-2 border rounded-lg bg-purple-50/50">
          <p className="text-[10px] font-medium text-purple-700 mb-1.5">Asignar responsable:</p>
          <div className="flex flex-wrap gap-1">
            {(usuariosProyecto || []).filter((u: any) => u.role === 'segurista' || u.role === 'admin' || u.role === 'superadmin').map((u: any) => (
              <button
                key={u.id}
                onClick={() => asignarMut.mutate({ incidenteId, asignadoA: u.id })}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                  incidenteData?.asignadoA === u.id
                    ? 'bg-purple-500 text-white border-purple-500'
                    : 'bg-white hover:bg-purple-100 border-purple-200 text-purple-700'
                }`}
                disabled={asignarMut.isPending}
              >
                {u.name} ({u.role})
              </button>
            ))}
            {incidenteData?.asignadoA && (
              <button
                onClick={() => asignarMut.mutate({ incidenteId, asignadoA: null })}
                className="text-[10px] px-2 py-1 rounded-full border bg-white hover:bg-red-50 border-red-200 text-red-500"
                disabled={asignarMut.isPending}
              >
                Quitar asignación
              </button>
            )}
          </div>
          {incidenteData?.asignadoA && (
            <p className="text-[9px] text-purple-600 mt-1">Asignado a: {(usuariosProyecto || []).find((u: any) => u.id === incidenteData.asignadoA)?.name || 'Usuario'}</p>
          )}
        </div>
      )}

      {/* Bitácora panel */}
      {showBitacora && (
        <div className="mb-2 p-2 border rounded-lg bg-amber-50/50 max-h-48 overflow-y-auto">
          <p className="text-[10px] font-medium text-amber-700 mb-1.5">Bitácora de Seguridad</p>
          {bitacoraQuery.isLoading ? (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-amber-500" /></div>
          ) : !bitacoraQuery.data?.length ? (
            <p className="text-[10px] text-muted-foreground text-center py-2">Sin entradas en la bitácora</p>
          ) : (
            <div className="space-y-1.5">
              {bitacoraQuery.data.map((entry: any) => (
                <div key={entry.id} className="flex gap-2 items-start">
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    entry.accion === 'creado' ? 'bg-green-100 text-green-600' :
                    entry.accion === 'estado_cambiado' ? 'bg-blue-100 text-blue-600' :
                    entry.accion === 'asignado' ? 'bg-purple-100 text-purple-600' :
                    entry.accion === 'editado' ? 'bg-amber-100 text-amber-600' :
                    entry.accion === 'eliminado' ? 'bg-red-100 text-red-600' :
                    entry.accion === 'foto_marcada' ? 'bg-orange-100 text-orange-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-2.5 w-2.5">
                      {entry.accion === 'creado' ? <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></> :
                       entry.accion === 'estado_cambiado' ? <><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></> :
                       entry.accion === 'asignado' ? <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></> :
                       <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] leading-snug">
                      <span className="font-medium">{entry.usuario?.name || 'Sistema'}</span>{' '}
                      <span className="text-muted-foreground">{entry.detalle}</span>
                    </p>
                    <p className="text-[9px] text-muted-foreground/60">
                      {new Date(entry.createdAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Evidencias panel */}
      {showEvidencias && (
        <div className="mb-2 p-2 border rounded-lg bg-emerald-50/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium text-emerald-700">Evidencias de Seguimiento</p>
            {canUploadEvidencia && (
              <Button size="sm" variant="outline" className="h-6 text-[10px] border-emerald-300 text-emerald-700 hover:bg-emerald-100 gap-1"
                onClick={() => evidenciaInputRef.current?.click()}
                disabled={subirEvidenciaMut.isPending}
              >
                {subirEvidenciaMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Subir evidencia
              </Button>
            )}
          </div>
          <input ref={evidenciaInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleEvidenciaSelect} />
          {evidenciasQuery.isLoading ? (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-emerald-500" /></div>
          ) : !evidenciasQuery.data?.length ? (
            <div className="text-center py-3">
              <ImageLucide className="w-8 h-8 mx-auto text-emerald-300 mb-1" />
              <p className="text-[10px] text-muted-foreground">Sin evidencias aún</p>
              {canUploadEvidencia && <p className="text-[9px] text-emerald-600">Sube fotos de seguimiento o resolución</p>}
              {!canUploadEvidencia && incidenteData?.asignadoA && (
                <p className="text-[9px] text-muted-foreground">Solo el responsable asignado puede subir evidencias</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {evidenciasQuery.data.map((ev: any) => (
                <div key={ev.id} className="relative group">
                  <img
                    src={ev.fotoUrl}
                    alt="Evidencia"
                    className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxUrl(ev.fotoUrl)}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg p-1">
                    <p className="text-[8px] text-white font-medium truncate">{ev.usuario?.name || 'Usuario'}</p>
                    <div className="flex items-center gap-1">
                      <span className={`text-[7px] px-1 py-0.5 rounded-full ${
                        ev.tipo === 'resolucion' ? 'bg-green-500 text-white' :
                        ev.tipo === 'prevencion' ? 'bg-blue-500 text-white' :
                        'bg-amber-500 text-white'
                      }`}>{ev.tipo === 'seguimiento' ? 'Seg' : ev.tipo === 'resolucion' ? 'Res' : 'Prev'}</span>
                      <span className="text-[7px] text-white/80">
                        {new Date(ev.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  {ev.descripcion && (
                    <p className="text-[8px] text-muted-foreground mt-0.5 truncate px-0.5">{ev.descripcion}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
          Enter enviar · @ mencionar · Foto · Voz IA
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
