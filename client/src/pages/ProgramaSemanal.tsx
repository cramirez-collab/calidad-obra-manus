import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ZoomableLightbox } from "@/components/ZoomableLightbox";
import { DrawableCanvas } from "@/components/DrawableCanvas";
import {
  CalendarDays, Plus, Send, Scissors, Trash2, ChevronLeft, ChevronRight,
  Download, Upload, Image as ImageIcon, BarChart3, TrendingUp, Eye, Edit,
  X, Check, AlertTriangle, Clock, FileSpreadsheet, BookTemplate, GitCompare,
  Save, FolderOpen, Copy, FileDown, Target, Sparkles, Wand2, Loader2, Camera, UserCircle,
  Pencil, Eraser, Undo2, Palette
} from "lucide-react";

// Helpers de fecha
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getSunday(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDateShort(d: Date | string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function formatWeekRange(inicio: Date | string, fin: Date | string): string {
  const i = new Date(inicio);
  const f = new Date(fin);
  return `${i.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} – ${f.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}`;
}

const UNIDADES = ["m", "m2", "m3", "ml", "pza", "kg", "lt", "jgo", "lote", "otro"] as const;
type Unidad = typeof UNIDADES[number];

type ActividadRow = {
  especialidad: string;
  actividad: string;
  nivel: string;
  area: string;
  referenciaEje: string;
  unidad: Unidad;
  cantidadProgramada: string;
  cantidadRealizada?: string;
  porcentajeAvance?: string;
  material?: string;
  orden: number;
  id?: number;
};

type PlanoRow = {
  id?: number;
  nivel: string;
  tipo: "planta" | "fachada" | "corte" | "otro";
  titulo: string;
  imagenUrl: string;
  imagenKey?: string;
  orden: number;
};

// Vista principal
type ViewMode = "list" | "create" | "detail" | "corte" | "eficiencia" | "plantillas" | "comparativa" | "resumen" | "ranking" | "metas";

export default function ProgramaSemanal() {
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  // toast importado de sonner
  const utils = trpc.useUtils();

  const [view, setView] = useState<ViewMode>("list");
  const [selectedProgramaId, setSelectedProgramaId] = useState<number | null>(null);
  const [filterUsuarioId, setFilterUsuarioId] = useState<string>("todos");
  const [filterEspecialidad, setFilterEspecialidad] = useState<string>("todas");
  const [plantillaActividades, setPlantillaActividades] = useState<ActividadRow[] | null>(null);

  // Queries
  const { data: programasData, isLoading } = trpc.programaSemanal.list.useQuery(
    { proyectoId: selectedProjectId!, usuarioId: filterUsuarioId !== "todos" ? parseInt(filterUsuarioId) : undefined },
    { enabled: !!selectedProjectId }
  );

  const { data: usuarios } = trpc.users.list.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  const { data: eficienciaData } = trpc.programaSemanal.eficiencia.useQuery(
    { proyectoId: selectedProjectId!, usuarioId: filterUsuarioId !== "todos" ? parseInt(filterUsuarioId) : undefined },
    { enabled: !!selectedProjectId && view === "eficiencia" }
  );

  // Mutations
  const createMut = trpc.programaSemanal.create.useMutation({
    onSuccess: () => {
      utils.programaSemanal.list.invalidate();
      toast.success("Programa creado");
      setView("list");
    },
    onError: (e) => toast.error(e.message),
  });

  const entregarMut = trpc.programaSemanal.entregar.useMutation({
    onSuccess: () => {
      utils.programaSemanal.list.invalidate();
      utils.programaSemanal.getById.invalidate();
      toast.success("Programa entregado");
    },
    onError: (e) => toast.error(e.message),
  });

  const corteMut = trpc.programaSemanal.realizarCorte.useMutation({
    onSuccess: (data) => {
      utils.programaSemanal.list.invalidate();
      utils.programaSemanal.getById.invalidate();
      utils.programaSemanal.eficiencia.invalidate();
      toast.success(`Corte realizado — Eficiencia: ${data.eficiencia}%`);
      setView("list");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.programaSemanal.delete.useMutation({
    onSuccess: () => {
      utils.programaSemanal.list.invalidate();
      toast.success("Programa eliminado");
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadPlanoMut = trpc.programaSemanal.uploadPlano.useMutation();

  // Datos lista (movido arriba para useMemo)
  const programas = programasData?.programas || [];
  const total = programasData?.total || 0;

  // Obtener especialidades del proyecto
  const { data: especialidadesData } = trpc.especialidades.list.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  // Filtrar usuarios que son residentes/especialistas
  const usuariosEspecialidad = useMemo(() => {
    if (!usuarios) return [];
    return usuarios.filter((u: any) => ['residente', 'jefe_residente', 'supervisor', 'admin', 'superadmin'].includes(u.role));
  }, [usuarios]);

  // Especialidades únicas de los programas existentes + catálogo
  const especialidadesDisponibles = useMemo(() => {
    const fromCatalogo = (especialidadesData || []).map((e: any) => e.nombre);
    const fromProgramas = programas.flatMap((p: any) =>
      (p.actividades || []).map((a: any) => a.especialidad).filter(Boolean)
    );
    return Array.from(new Set([...fromCatalogo, ...fromProgramas])).sort();
  }, [especialidadesData, programas]);

  // Filtrar programas por especialidad
  const programasFiltrados = useMemo(() => {
    if (filterEspecialidad === "todas") return programas;
    return programas.filter((p: any) =>
      (p.actividades || []).some((a: any) => a.especialidad === filterEspecialidad)
    );
  }, [programas, filterEspecialidad]);

  if (view === "create") {
    return <CrearPrograma
      proyectoId={selectedProjectId!}
      userId={user!.id}
      usuarios={usuariosEspecialidad}
      onBack={() => setView("list")}
      onCreate={(data) => createMut.mutate(data)}
      isLoading={createMut.isPending}
      uploadPlano={uploadPlanoMut}
      initialActividades={plantillaActividades}
    />;
  }

  if (view === "detail" && selectedProgramaId) {
    return <DetallePrograma
      programaId={selectedProgramaId}
      onBack={() => { setView("list"); setSelectedProgramaId(null); }}
      onCorte={() => setView("corte")}
      onEntregar={(id) => entregarMut.mutate({ id })}
      onDelete={(id) => { deleteMut.mutate({ id }); setView("list"); setSelectedProgramaId(null); }}
      userId={user!.id}
      userRole={user!.role || "residente"}
      usuarios={usuariosEspecialidad}
    />;
  }

  if (view === "corte" && selectedProgramaId) {
    return <CortePrograma
      programaId={selectedProgramaId}
      onBack={() => setView("detail")}
      onCorte={(data) => corteMut.mutate(data)}
      isLoading={corteMut.isPending}
    />;
  }

  if (view === "eficiencia") {
    return <EficienciaView
      data={eficienciaData || []}
      usuarios={usuariosEspecialidad}
      onBack={() => setView("list")}
    />;
  }

  if (view === "plantillas") {
    return <PlantillasView
      proyectoId={selectedProjectId!}
      onBack={() => setView("list")}
      onCargar={(actividades: ActividadRow[]) => {
        setPlantillaActividades(actividades);
        setView("create");
      }}
    />;
  }

  if (view === "comparativa") {
    return <ComparativaView
      proyectoId={selectedProjectId!}
      programas={programas}
      usuarios={usuariosEspecialidad}
      onBack={() => setView("list")}
    />;
  }

  if (view === "resumen") {
    return <ResumenMensualView
      proyectoId={selectedProjectId!}
      usuarios={usuariosEspecialidad}
      onBack={() => setView("list")}
    />;
  }

  if (view === "ranking") {
    return <RankingCumplimientoView
      proyectoId={selectedProjectId!}
      usuarios={usuariosEspecialidad}
      onBack={() => setView("list")}
    />;
  }

  if (view === "metas") {
    return <MetasEficienciaView
      proyectoId={selectedProjectId!}
      usuarios={usuariosEspecialidad}
      onBack={() => setView("list")}
    />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            Programa Semanal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} programa{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setView("plantillas")}>
            <BookTemplate className="w-4 h-4 mr-1" /> Plantillas
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView("comparativa")}>
            <GitCompare className="w-4 h-4 mr-1" /> Comparar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView("eficiencia")}>
            <BarChart3 className="w-4 h-4 mr-1" /> Eficiencia
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView("resumen")}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Resumen
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView("ranking")}>
            <TrendingUp className="w-4 h-4 mr-1" /> Ranking
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView("metas")}>
            <Target className="w-4 h-4 mr-1" /> Metas
          </Button>
          <Button size="sm" onClick={() => { setPlantillaActividades(null); setView("create"); }}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo Programa
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 items-center flex-wrap">
        <Select value={filterUsuarioId} onValueChange={setFilterUsuarioId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filtrar por usuario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los usuarios</SelectItem>
            {usuariosEspecialidad.map((u: any) => (
              <SelectItem key={u.id} value={String(u.id)}>{u.name} — {(u as any).especialidad || u.role}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEspecialidad} onValueChange={setFilterEspecialidad}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filtrar por especialidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las especialidades</SelectItem>
            {especialidadesDisponibles.map((esp: string) => (
              <SelectItem key={esp} value={esp}>{esp}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterUsuarioId !== "todos" || filterEspecialidad !== "todas") && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterUsuarioId("todos"); setFilterEspecialidad("todas"); }}>
            <X className="w-3 h-3 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {/* Lista de programas */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
      ) : programasFiltrados.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No hay programas semanales aún.</p>
            <Button size="sm" className="mt-3" onClick={() => setView("create")}>
              <Plus className="w-4 h-4 mr-1" /> Crear primer programa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {programasFiltrados.map((p: any) => {
            const usuario = usuariosEspecialidad.find((u: any) => u.id === p.usuarioId);
            return (
              <Card key={p.id} className="cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => { setSelectedProgramaId(p.id); setView("detail"); }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {formatWeekRange(p.semanaInicio, p.semanaFin)}
                        </span>
                        <StatusBadge status={p.status} />
                        <EntregaBadge semanaFin={p.semanaFin} fechaEntrega={p.fechaEntrega} status={p.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {usuario?.name || `Usuario #${p.usuarioId}`}
                        {(usuario as any)?.especialidad ? ` — ${(usuario as any).especialidad}` : ""}
                      </p>
                      <div className="flex items-center gap-3 text-sm mt-1">
                        {p.eficienciaGlobal != null && (
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                            <span className={`font-bold ${parseFloat(p.eficienciaGlobal) >= 80 ? "text-emerald-600" : parseFloat(p.eficienciaGlobal) >= 50 ? "text-amber-600" : "text-red-600"}`}>
                              {parseFloat(p.eficienciaGlobal).toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {p.fechaEntrega && (
                          <span className="text-xs text-muted-foreground">
                            Entregado: {formatDateShort(p.fechaEntrega)}
                          </span>
                        )}
                      </div>
                    </div>
                    {['admin', 'superadmin'].includes(user?.role || '') && (
                      <button
                        type="button"
                        className="flex items-center justify-center h-10 w-10 min-w-[40px] min-h-[40px] shrink-0 rounded-lg bg-red-50 border border-red-200 text-red-600 active:bg-red-200 hover:bg-red-100 touch-manipulation transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (confirm(`¿Eliminar programa de ${formatWeekRange(p.semanaInicio, p.semanaFin)}? Esta acción no se puede deshacer.`)) {
                            deleteMut.mutate({ id: p.id });
                          }
                        }}>
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Helper: determinar cumplimiento de entrega
function getEntregaCumplimiento(semanaFin: string | Date, fechaEntrega: string | Date | null, status: string): { label: string; color: string; icon: "check" | "clock" | "alert" } | null {
  if (status === "borrador" || !fechaEntrega) return null;
  const entrega = new Date(fechaEntrega);
  const fin = new Date(semanaFin);
  // Viernes de la semana = domingo - 2 días
  const viernes = new Date(fin);
  viernes.setDate(viernes.getDate() - 2);
  viernes.setHours(23, 59, 59, 999);
  if (entrega <= viernes) {
    return { label: "A tiempo", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "check" };
  }
  // Sábado = 1 día tarde
  const sabado = new Date(viernes);
  sabado.setDate(sabado.getDate() + 1);
  sabado.setHours(23, 59, 59, 999);
  if (entrega <= sabado) {
    return { label: "1 día tarde", color: "bg-amber-100 text-amber-800 border-amber-300", icon: "clock" };
  }
  return { label: "Tardío", color: "bg-red-100 text-red-800 border-red-300", icon: "alert" };
}

function EntregaBadge({ semanaFin, fechaEntrega, status }: { semanaFin: string | Date; fechaEntrega: string | Date | null; status: string }) {
  const cumplimiento = getEntregaCumplimiento(semanaFin, fechaEntrega, status);
  if (!cumplimiento) return null;
  const Icon = cumplimiento.icon === "check" ? Check : cumplimiento.icon === "clock" ? Clock : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cumplimiento.color}`}>
      <Icon className="w-3 h-3" />
      {cumplimiento.label}
    </span>
  );
}

// Badge de status
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    borrador: { label: "Borrador", variant: "outline" },
    entregado: { label: "Entregado", variant: "secondary" },
    corte_realizado: { label: "Corte realizado", variant: "default" },
  };
  const c = config[status] || config.borrador;
  return <Badge variant={c.variant} className="text-xs">{c.label}</Badge>;
}

// ===== ASISTENTE IA =====
function AIAssistantPanel({ actividades, onAddActividades }: {
  actividades: ActividadRow[];
  onAddActividades: (acts: ActividadRow[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'texto' | 'imagen'>('texto');
  const [descripcion, setDescripcion] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [imagenBase64, setImagenBase64] = useState<string | null>(null);
  const [imagenMime, setImagenMime] = useState<string>('');
  const [resultado, setResultado] = useState<ActividadRow[] | null>(null);
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set());

  const aiMutation = trpc.programaSemanal.aiGenerarActividades.useMutation({
    onSuccess: (data) => {
      const acts: ActividadRow[] = data.actividades.map((a: any, i: number) => ({
        especialidad: a.especialidad,
        actividad: a.actividad,
        nivel: a.nivel,
        area: a.area,
        referenciaEje: a.referenciaEje,
        unidad: a.unidad as any,
        cantidadProgramada: a.cantidadProgramada,
        material: a.material || '',
        orden: i,
      }));
      setResultado(acts);
      setSeleccionadas(new Set(acts.map((_, i) => i)));
      toast.success(`${acts.length} actividades generadas por IA`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagenPreview(dataUrl);
      setImagenBase64(dataUrl.split(',')[1]);
      setImagenMime(file.type);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerar = () => {
    const contexto = actividades.filter(a => a.actividad.trim()).length > 0
      ? actividades.filter(a => a.actividad.trim()).map(a => `${a.especialidad}: ${a.actividad} (${a.nivel}, ${a.cantidadProgramada} ${a.unidad})`).join('\n')
      : undefined;

    if (mode === 'imagen' && imagenPreview) {
      aiMutation.mutate({
        imagenUrl: imagenPreview,
        especialidad: especialidad || undefined,
        contexto,
      });
    } else if (mode === 'texto' && descripcion.trim()) {
      aiMutation.mutate({
        descripcion: descripcion.trim(),
        especialidad: especialidad || undefined,
        contexto,
      });
    } else {
      toast.error(mode === 'imagen' ? 'Sube una imagen primero' : 'Escribe una descripción');
    }
  };

  const handleAgregar = () => {
    if (!resultado) return;
    const selected = resultado.filter((_, i) => seleccionadas.has(i));
    if (selected.length === 0) {
      toast.error('Selecciona al menos una actividad');
      return;
    }
    onAddActividades(selected);
    toast.success(`${selected.length} actividades agregadas al programa`);
    setResultado(null);
    setDescripcion('');
    setImagenPreview(null);
    setOpen(false);
  };

  const toggleSeleccion = (idx: number) => {
    setSeleccionadas(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  if (!open) {
    return (
      <Card className="border-dashed border-2 border-purple-300 bg-purple-50/30 dark:bg-purple-950/10">
        <CardContent className="p-4">
          <button
            onClick={() => setOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-purple-700 dark:text-purple-300 hover:text-purple-900 transition-colors"
          >
            <Sparkles className="w-5 h-5" />
            Asistente IA — Generar actividades desde texto o imagen
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-300 bg-purple-50/20 dark:bg-purple-950/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-purple-700 dark:text-purple-300">
            <Sparkles className="w-4 h-4" /> Asistente IA
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setOpen(false); setResultado(null); }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            variant={mode === 'texto' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setMode('texto'); setResultado(null); }}
            className={mode === 'texto' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            <Wand2 className="w-3 h-3 mr-1" /> Desde texto
          </Button>
          <Button
            variant={mode === 'imagen' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setMode('imagen'); setResultado(null); }}
            className={mode === 'imagen' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            <Camera className="w-3 h-3 mr-1" /> Desde imagen
          </Button>
        </div>

        {/* Especialidad filter */}
        <Input
          value={especialidad}
          onChange={e => setEspecialidad(e.target.value)}
          placeholder="Especialidad (opcional, ej: Albañilería, Inst. Eléctrica)"
          className="h-8 text-sm"
        />

        {mode === 'texto' ? (
          <div className="space-y-2">
            <Textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder={`Describe las actividades que necesitas programar, por ejemplo:\n\n"Pegado de block en niveles N10 y N11, departamentos A-C ejes 1-4. También necesito cimbrado de losa en N12 y colocación de piso cerámico en N10."`}
              rows={4}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">Describe las actividades en lenguaje natural. La IA generará la tabla con especialidad, nivel, área, ejes, unidad, cantidad y material.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {imagenPreview ? (
              <div className="relative">
                <img src={imagenPreview} alt="Programa" className="w-full max-h-64 object-contain rounded-lg border" />
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => { setImagenPreview(null); setImagenBase64(null); }}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-purple-300 rounded-lg cursor-pointer hover:bg-purple-50/50 transition-colors">
                <Camera className="w-8 h-8 text-purple-400 mb-2" />
                <span className="text-sm text-purple-600 font-medium">Subir foto de programa</span>
                <span className="text-xs text-muted-foreground mt-1">Toma foto a un programa impreso o en pantalla</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
            <p className="text-xs text-muted-foreground">Sube una foto de un programa semanal existente. La IA extraerá las actividades automáticamente.</p>
          </div>
        )}

        {/* Generar button */}
        <Button
          onClick={handleGenerar}
          disabled={aiMutation.isPending || (mode === 'texto' ? !descripcion.trim() : !imagenPreview)}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
        >
          {aiMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando actividades...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Generar actividades con IA</>
          )}
        </Button>

        {/* Resultados */}
        {resultado && resultado.length > 0 && (
          <div className="space-y-2 mt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                {resultado.length} actividades generadas
              </p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="text-xs h-7"
                  onClick={() => setSeleccionadas(new Set(resultado.map((_, i) => i)))}>
                  Todas
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-7"
                  onClick={() => setSeleccionadas(new Set())}>
                  Ninguna
                </Button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-purple-100 dark:bg-purple-900/30">
                  <tr>
                    <th className="p-1.5 w-8"></th>
                    <th className="text-left p-1.5">Especialidad</th>
                    <th className="text-left p-1.5">Actividad</th>
                    <th className="text-left p-1.5">Nivel</th>
                    <th className="text-left p-1.5">Unidad</th>
                    <th className="text-right p-1.5">Cant.</th>
                    <th className="text-left p-1.5">Material</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.map((a, idx) => (
                    <tr key={idx}
                      className={`border-t cursor-pointer transition-colors ${seleccionadas.has(idx) ? 'bg-purple-50 dark:bg-purple-900/20' : 'opacity-50'}`}
                      onClick={() => toggleSeleccion(idx)}
                    >
                      <td className="p-1.5 text-center">
                        <input type="checkbox" checked={seleccionadas.has(idx)} onChange={() => toggleSeleccion(idx)}
                          className="rounded border-purple-400" />
                      </td>
                      <td className="p-1.5 font-medium">{a.especialidad}</td>
                      <td className="p-1.5">{a.actividad}</td>
                      <td className="p-1.5">{a.nivel}</td>
                      <td className="p-1.5">{a.unidad}</td>
                      <td className="p-1.5 text-right font-mono">{a.cantidadProgramada}</td>
                      <td className="p-1.5 text-muted-foreground">{a.material}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={handleAgregar} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Agregar {seleccionadas.size} actividades al programa
            </Button>
          </div>
        )}

        {resultado && resultado.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">No se pudieron generar actividades. Intenta con una descripción más detallada.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ===== CREAR PROGRAMA =====
function CrearPrograma({ proyectoId, userId, usuarios, onBack, onCreate, isLoading, uploadPlano, initialActividades }: {
  proyectoId: number;
  userId: number;
  usuarios: any[];
  onBack: () => void;
  onCreate: (data: any) => void;
  isLoading: boolean;
  uploadPlano: any;
  initialActividades?: ActividadRow[] | null;
}) {
  const { user } = useAuth();
  const isAdminRole = ['admin', 'superadmin', 'supervisor'].includes(user?.role || '');
  const [selectedUserId, setSelectedUserId] = useState<number>(userId);
  const [monday] = useState(() => getMonday(new Date()));
  const [sunday] = useState(() => getSunday(getMonday(new Date())));
  const [notas, setNotas] = useState("");
  const [actividades, setActividades] = useState<ActividadRow[]>(
    initialActividades && initialActividades.length > 0
      ? initialActividades.map((a, i) => ({ ...a, orden: i }))
      : [{ especialidad: "", actividad: "", nivel: "", area: "", referenciaEje: "", unidad: "m2", cantidadProgramada: "", material: "", orden: 0 }]
  );
  const [planos, setPlanos] = useState<PlanoRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  // Mutations para Excel
  const descargarPlantillaMut = trpc.programaSemanal.generarPlantillaExcel.useMutation({
    onSuccess: (data) => {
      const byteArray = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Plantilla descargada');
    },
    onError: (e) => toast.error(e.message),
  });

  const parsearExcelMut = trpc.programaSemanal.parsearExcel.useMutation({
    onSuccess: (data) => {
      const newActs = data.actividades.map((a: any, i: number) => ({
        especialidad: a.especialidad,
        actividad: a.actividad,
        nivel: a.nivel,
        area: a.area,
        referenciaEje: a.referenciaEje,
        unidad: a.unidad as any,
        cantidadProgramada: a.cantidadProgramada,
        material: a.material || '',
        orden: i,
      }));
      setActividades(newActs);
      toast.success(`${data.total} actividades cargadas desde Excel`);
      setExcelLoading(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setExcelLoading(false);
    },
  });

  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      parsearExcelMut.mutate({ base64 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const addRow = () => {
    setActividades(prev => [...prev, {
      especialidad: prev.length > 0 ? prev[prev.length - 1].especialidad : "",
      actividad: "", nivel: "", area: "", referenciaEje: "",
      unidad: "m2", cantidadProgramada: "", material: "", orden: prev.length,
    }]);
  };

  const removeRow = (idx: number) => {
    setActividades(prev => prev.filter((_, i) => i !== idx).map((a, i) => ({ ...a, orden: i })));
  };

  const updateRow = (idx: number, field: keyof ActividadRow, value: string) => {
    setActividades(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const handleUploadPlano = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setPlanos(prev => [...prev, {
          nivel: "", tipo: "planta" as const, titulo: file.name.replace(/\.[^.]+$/, ""),
          imagenUrl: reader.result as string, // temp local preview
          orden: prev.length,
          _base64: base64, _mimeType: file.type,
          _uploaded: false,
        } as any]);
      };
      reader.readAsDataURL(file);
    }
    setUploading(false);
    e.target.value = "";
  };

  const removePlano = (idx: number) => {
    setPlanos(prev => prev.filter((_, i) => i !== idx));
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const validActividades = actividades.filter(a => a.actividad.trim() && a.cantidadProgramada.trim());
    if (validActividades.length === 0) {
      toast.error("Agrega al menos una actividad con nombre y cantidad.");
      return;
    }
    setSubmitting(true);
    try {
      // Subir planos pendientes a S3 primero
      const uploadedPlanos: PlanoRow[] = [];
      for (const p of planos) {
        const planoAny = p as any;
        if (planoAny._base64 && !planoAny._uploaded) {
          // Subir a S3 vía uploadPlano mutation
          const result = await uploadPlano.mutateAsync({
            programaId: 0, // se reasigna en backend al crear
            nivel: p.nivel || "",
            tipo: p.tipo || "otro",
            titulo: p.titulo || "",
            base64: planoAny._base64,
            mimeType: planoAny._mimeType || "image/jpeg",
            orden: uploadedPlanos.length,
          });
          uploadedPlanos.push({
            ...p,
            imagenUrl: result.url,
            imagenKey: result.key,
            orden: uploadedPlanos.length,
          });
        } else if (p.imagenUrl && !p.imagenUrl.startsWith("data:")) {
          uploadedPlanos.push({ ...p, orden: uploadedPlanos.length });
        }
      }
      onCreate({
        proyectoId,
        usuarioId: selectedUserId !== userId ? selectedUserId : undefined,
        semanaInicio: monday.toISOString(),
        semanaFin: sunday.toISOString(),
        notas: notas || undefined,
        actividades: validActividades.map((a, i) => ({ ...a, orden: i })),
        planos: uploadedPlanos.map((p, i) => ({
          nivel: p.nivel, tipo: p.tipo, titulo: p.titulo,
          imagenUrl: p.imagenUrl, imagenKey: p.imagenKey, orden: i,
        })),
      });
    } catch (err: any) {
      toast.error("Error subiendo planos: " + (err?.message || "Intenta de nuevo"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold">Nuevo Programa Semanal</h2>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">Semana: {formatWeekRange(monday, sunday)}</span>
          </div>

          {/* Selector de usuario que realiza el programa */}
          <div className="space-y-1">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <UserCircle className="w-4 h-4 text-emerald-600" />
              Realizado por *
            </label>
            {isAdminRole ? (
              <Select value={String(selectedUserId)} onValueChange={(v) => setSelectedUserId(Number(v))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecciona usuario" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}{u.especialidad ? ` — ${u.especialidad}` : ''}{u.empresa ? ` (${u.empresa})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                {user?.name || 'Usuario actual'}
              </div>
            )}
          </div>

          <Textarea placeholder="Notas generales (opcional)" value={notas} onChange={e => setNotas(e.target.value)} rows={2} />
        </CardContent>
      </Card>

      {/* Paso 1: Subir Plantilla Excel */}
      <Card className="border-emerald-200 bg-emerald-50/20 dark:bg-emerald-950/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Paso 1: Cargar Actividades
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Descargar plantilla */}
            <div className="flex-1 border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 hover:bg-muted/20 transition-colors">
              <Download className="w-8 h-8 text-emerald-600" />
              <p className="text-sm font-medium text-center">Descargar Plantilla</p>
              <p className="text-xs text-muted-foreground text-center">Descarga el Excel, llena tus actividades y subelo</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => descargarPlantillaMut.mutate({ proyectoId })}
                disabled={descargarPlantillaMut.isPending}
              >
                {descargarPlantillaMut.isPending ? (
                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generando...</>
                ) : (
                  <><Download className="w-3 h-3 mr-1" /> Descargar Excel</>
                )}
              </Button>
            </div>

            {/* Subir Excel llenado */}
            <div className="flex-1 border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 hover:bg-muted/20 transition-colors">
              <Upload className="w-8 h-8 text-blue-600" />
              <p className="text-sm font-medium text-center">Subir Excel Llenado</p>
              <p className="text-xs text-muted-foreground text-center">Sube tu plantilla con las actividades llenas</p>
              <label>
                <Button size="sm" variant="outline" asChild disabled={excelLoading}>
                  <span className="cursor-pointer">
                    {excelLoading ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Procesando...</>
                    ) : (
                      <><Upload className="w-3 h-3 mr-1" /> Subir Excel</>
                    )}
                  </span>
                </Button>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUploadExcel} disabled={excelLoading} />
              </label>
            </div>
          </div>

          {/* Indicador de actividades cargadas */}
          {actividades.filter(a => a.actividad.trim()).length > 0 && (
            <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg px-3 py-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {actividades.filter(a => a.actividad.trim()).length} actividades cargadas
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Asistente IA (alternativa) */}
      <AIAssistantPanel
        actividades={actividades}
        onAddActividades={(newActs) => {
          setActividades(prev => [
            ...prev.filter(a => a.actividad.trim()),
            ...newActs.map((a, i) => ({ ...a, orden: prev.length + i })),
          ]);
        }}
      />

      {/* Tabla de actividades (editable) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Actividades Programadas
            </CardTitle>
            <Badge variant="secondary">{actividades.filter(a => a.actividad.trim()).length} actividades</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Especialidad</th>
                  <th className="text-left p-2 font-medium">Actividad</th>
                  <th className="text-left p-2 font-medium w-20">Nivel</th>
                  <th className="text-left p-2 font-medium">{"Area"}</th>
                  <th className="text-left p-2 font-medium w-20">Ref. Eje</th>
                  <th className="text-left p-2 font-medium w-20">Unidad</th>
                  <th className="text-left p-2 font-medium w-24">Cant. Prog.</th>
                  <th className="text-left p-2 font-medium">Material</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {actividades.map((a, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/20">
                    <td className="p-1">
                      <Input value={a.especialidad} onChange={e => updateRow(idx, "especialidad", e.target.value)}
                        placeholder="Ej: Albanileria" className="h-8 text-xs" />
                    </td>
                    <td className="p-1">
                      <Input value={a.actividad} onChange={e => updateRow(idx, "actividad", e.target.value)}
                        placeholder="Ej: Cimbrado para colado" className="h-8 text-xs" />
                    </td>
                    <td className="p-1">
                      <Input value={a.nivel} onChange={e => updateRow(idx, "nivel", e.target.value)}
                        placeholder="N10" className="h-8 text-xs" />
                    </td>
                    <td className="p-1">
                      <Input value={a.area} onChange={e => updateRow(idx, "area", e.target.value)}
                        placeholder="Dptos y pasillo" className="h-8 text-xs" />
                    </td>
                    <td className="p-1">
                      <Input value={a.referenciaEje} onChange={e => updateRow(idx, "referenciaEje", e.target.value)}
                        placeholder="B-D" className="h-8 text-xs" />
                    </td>
                    <td className="p-1">
                      <Select value={a.unidad} onValueChange={v => updateRow(idx, "unidad", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-1">
                      <Input type="number" value={a.cantidadProgramada}
                        onChange={e => updateRow(idx, "cantidadProgramada", e.target.value)}
                        placeholder="0" className="h-8 text-xs" />
                    </td>
                    <td className="p-1">
                      <Input value={a.material || ""} onChange={e => updateRow(idx, "material", e.target.value)}
                        placeholder="Ej: Block 15cm" className="h-8 text-xs" />
                    </td>
                    <td className="p-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(idx)}>
                        <X className="w-3 h-3 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" className="mt-2" onClick={addRow}>
            <Plus className="w-3 h-3 mr-1" /> Agregar fila
          </Button>
        </CardContent>
      </Card>

      {/* Planos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> Planos / Croquis de Localización
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {planos.map((p, idx) => (
              <div key={idx} className="relative group">
                <img src={p.imagenUrl} alt={p.titulo || `Plano ${idx + 1}`}
                  className="w-full h-32 object-cover rounded-lg border" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 rounded-b-lg">
                  <Input value={p.titulo} onChange={e => {
                    setPlanos(prev => prev.map((pl, i) => i === idx ? { ...pl, titulo: e.target.value } : pl));
                  }} placeholder="Título del plano" className="h-6 text-xs bg-transparent border-none text-white placeholder:text-white/50" />
                </div>
                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removePlano(idx)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
              <Upload className="w-6 h-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Subir plano</span>
              <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleUploadPlano} />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onBack}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={isLoading || submitting || actividades.filter(a => a.actividad.trim()).length === 0}>
          {submitting ? "Subiendo planos..." : isLoading ? "Creando..." : "Crear Programa"}
        </Button>
      </div>
    </div>
  );
}

// ===== HELPER: Convertir imagen URL a base64 =====
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url); // fallback a URL original
      reader.readAsDataURL(blob);
    });
  } catch {
    return url; // fallback a URL original si falla
  }
}

// ===== GENERAR PDF =====
async function generarPDFProgramaSemanal(data: any) {
  const statusLabels: Record<string, string> = { borrador: 'Borrador', entregado: 'Entregado', corte_realizado: 'Corte Realizado' };
  const actividades = data.actividades || [];
  const planos = data.planos || [];
  const hasCorte = data.status === 'corte_realizado';

  // Calcular eficiencia por especialidad
  const porEsp = new Map<string, { prog: number; real: number }>();
  for (const a of actividades) {
    if (!porEsp.has(a.especialidad)) porEsp.set(a.especialidad, { prog: 0, real: 0 });
    const e = porEsp.get(a.especialidad)!;
    e.prog += parseFloat(a.cantidadProgramada) || 0;
    e.real += parseFloat(a.cantidadRealizada) || 0;
  }

  const totalProg = actividades.reduce((s: number, a: any) => s + (parseFloat(a.cantidadProgramada) || 0), 0);
  const totalReal = actividades.reduce((s: number, a: any) => s + (parseFloat(a.cantidadRealizada) || 0), 0);
  const efGlobal = totalProg > 0 ? ((totalReal / totalProg) * 100).toFixed(1) : '—';

  // Convertir imágenes de planos a base64 para que funcionen en blob HTML
  let planosHtml = '';
  if (planos.length > 0) {
    const planosBase64 = await Promise.all(
      planos.map(async (p: any) => {
        const base64 = p.imagenUrl ? await imageUrlToBase64(p.imagenUrl) : '';
        return { ...p, base64Src: base64 };
      })
    );
    planosHtml = `
      <div style="page-break-before:always;"></div>
      <h3 style="font-size:16px;color:#002C63;margin-bottom:12px;">Planos / Croquis de Referencia</h3>
      ${planosBase64.map((p: any) => `
        <div style="text-align:center;margin-bottom:20px;page-break-inside:avoid;">
          ${p.titulo ? `<p style="font-size:12px;font-weight:600;color:#002C63;margin-bottom:6px;">${p.titulo} ${p.nivel ? '— ' + p.nivel : ''} ${p.tipo ? '(' + p.tipo + ')' : ''}</p>` : ''}
          <img src="${p.base64Src}" style="max-width:100%;max-height:700px;border:1px solid #ccc;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" />
        </div>
      `).join('')}`;
  }

  const efPorEspHtml = hasCorte && porEsp.size > 0 ? `
    <h3 style="margin-top:20px;font-size:14px;color:#002C63;">Eficiencia por Especialidad</h3>
    <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:11px;">
      <thead>
        <tr style="background:#002C63;color:white;">
          <th style="padding:6px 8px;text-align:left;">Especialidad</th>
          <th style="padding:6px 8px;text-align:right;">Programada</th>
          <th style="padding:6px 8px;text-align:right;">Realizada</th>
          <th style="padding:6px 8px;text-align:right;">Eficiencia</th>
        </tr>
      </thead>
      <tbody>
        ${Array.from(porEsp.entries()).map(([esp, v]) => {
          const pct = v.prog > 0 ? ((v.real / v.prog) * 100).toFixed(1) : '0.0';
          const color = parseFloat(pct) >= 80 ? '#16a34a' : parseFloat(pct) >= 50 ? '#d97706' : '#dc2626';
          return `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:5px 8px;font-weight:600;">${esp}</td>
            <td style="padding:5px 8px;text-align:right;">${v.prog.toFixed(2)}</td>
            <td style="padding:5px 8px;text-align:right;">${v.real.toFixed(2)}</td>
            <td style="padding:5px 8px;text-align:right;font-weight:700;color:${color};">${pct}%</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>` : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Programa Semanal - ${formatWeekRange(data.semanaInicio, data.semanaFin)}</title>
      <style>
        @media print { body { margin: 0; } @page { size: landscape; margin: 10mm; } }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; max-width: 1100px; margin: 0 auto; padding: 20px; }
        h1 { color: #002C63; font-size: 18px; margin-bottom: 4px; }
        .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; }
        .meta-item { background: #f8f9fa; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #002C63; }
        .meta-item label { font-size: 10px; color: #666; text-transform: uppercase; }
        .meta-item p { font-size: 14px; font-weight: 600; margin: 2px 0 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #002C63; color: white; padding: 6px 8px; font-size: 11px; text-align: left; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
        tr:nth-child(even) { background: #f9fafb; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
      </style>
    </head>
    <body>
      <h1>PROGRAMA DE ACTIVIDADES</h1>
      <p style="color:#666;font-size:13px;margin-top:0;">Semana: ${formatWeekRange(data.semanaInicio, data.semanaFin)}</p>

      <div class="meta">
        <div class="meta-item"><label>Estado</label><p>${statusLabels[data.status] || data.status}</p></div>
        <div class="meta-item"><label>Entrega</label><p>${data.fechaEntrega ? formatDateShort(data.fechaEntrega) : 'Pendiente'}</p></div>
        <div class="meta-item"><label>Corte</label><p>${data.fechaCorte ? formatDateShort(data.fechaCorte) : 'Pendiente'}</p></div>
        <div class="meta-item"><label>Eficiencia Global</label><p style="color:${parseFloat(efGlobal) >= 80 ? '#16a34a' : parseFloat(efGlobal) >= 50 ? '#d97706' : '#dc2626'};font-size:18px;">${hasCorte ? efGlobal + '%' : '—'}</p></div>
      </div>

      ${data.notas ? `<p style="font-size:11px;color:#666;margin:8px 0;padding:8px;background:#fffbeb;border-radius:4px;"><strong>Notas:</strong> ${data.notas}</p>` : ''}

      <h3 style="font-size:14px;color:#002C63;margin-top:16px;">Actividades Programadas</h3>
      <table>
        <thead>
          <tr>
            <th>Especialidad</th>
            <th>Actividad</th>
            <th>Nivel</th>
            <th>Área</th>
            <th>Ref. Eje</th>
            <th>Unidad</th>
            <th>Material</th>
            <th style="text-align:right;">Programada</th>
            ${hasCorte ? '<th style="text-align:right;">Realizada</th><th style="text-align:right;">%</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${actividades.map((a: any) => {
            const pct = parseFloat(a.porcentajeAvance) || 0;
            const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
            return `<tr>
              <td style="font-weight:600;">${a.especialidad}</td>
              <td>${a.actividad}</td>
              <td>${a.nivel || '—'}</td>
              <td>${a.area || '—'}</td>
              <td>${a.referenciaEje || '—'}</td>
              <td>${a.unidad}</td>
              <td style="color:#666;font-size:10px;">${a.material || '—'}</td>
              <td style="text-align:right;font-family:monospace;">${a.cantidadProgramada}</td>
              ${hasCorte ? `<td style="text-align:right;font-family:monospace;">${a.cantidadRealizada || '0'}</td><td style="text-align:right;font-weight:700;color:${color};">${pct.toFixed(1)}%</td>` : ''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>

      ${efPorEspHtml}
      ${planosHtml}

      <div class="footer">
        <p>ObjetivaQC — Control de Calidad de Obra — Generado ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      </div>

      <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
    </body>
    </html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ===== DETALLE PROGRAMA =====
function DetallePrograma({ programaId, onBack, onCorte, onEntregar, onDelete, userId, userRole, usuarios }: {
  programaId: number;
  onBack: () => void;
  onCorte: () => void;
  onEntregar: (id: number) => void;
  onDelete: (id: number) => void;
  userId: number;
  userRole: string;
  usuarios: any[];
}) {
  const { data, isLoading } = trpc.programaSemanal.getById.useQuery({ id: programaId });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [drawCanvasOpen, setDrawCanvasOpen] = useState(false);
  const [drawCanvasIdx, setDrawCanvasIdx] = useState(0);

  if (isLoading || !data) {
    return <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4" /> Volver</Button>
      <Card className="animate-pulse"><CardContent className="p-8 h-48" /></Card>
    </div>;
  }

  const isOwner = data.usuarioId === userId;
  const isAdmin = ['admin', 'superadmin', 'supervisor'].includes(userRole);
  const canEdit = (isOwner || isAdmin) && data.status !== 'corte_realizado';
  const canCorte = (isOwner || isAdmin) && data.status === 'entregado';
  const isAdminOrSuper = ['admin', 'superadmin'].includes(userRole);
  const canDelete = isAdminOrSuper || (isOwner && data.status === 'borrador');

  const planoUrls = (data.planos || []).map((p: any) => p.imagenUrl);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold flex-1">
          Programa: {formatWeekRange(data.semanaInicio, data.semanaFin)}
        </h2>
        <StatusBadge status={data.status} />
        <EntregaBadge semanaFin={data.semanaFin} fechaEntrega={data.fechaEntrega} status={data.status} />
      </div>

      {/* Info */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Entrega:</span>
              <p className="font-medium">{data.fechaEntrega ? formatDateShort(data.fechaEntrega) : "Pendiente"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Corte:</span>
              <p className="font-medium">{data.fechaCorte ? formatDateShort(data.fechaCorte) : "Pendiente"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Eficiencia:</span>
              <p className="font-bold text-lg">
                {data.eficienciaGlobal != null ? `${parseFloat(data.eficienciaGlobal).toFixed(1)}%` : "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Actividades:</span>
              <p className="font-medium">{data.actividades?.length || 0}</p>
            </div>
          </div>
          {data.notas && <p className="text-sm text-muted-foreground border-t pt-2 mt-2">{data.notas}</p>}

          {/* Auditoría: Creado por vs Asignado a */}
          <div className="border-t pt-2 mt-2 space-y-1">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex items-center gap-1.5">
                <UserCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-muted-foreground">Asignado a:</span>
                <span className="font-medium">
                  {usuarios.find((u: any) => u.id === data.usuarioId)?.name || `Usuario #${data.usuarioId}`}
                </span>
              </div>
              {data.creadoPorId && data.creadoPorId !== data.usuarioId && (
                <div className="flex items-center gap-1.5">
                  <Edit className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-muted-foreground">Creado por:</span>
                  <span className="font-medium text-blue-600">
                    {usuarios.find((u: any) => u.id === data.creadoPorId)?.name || `Usuario #${data.creadoPorId}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de actividades */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Actividades</CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Especialidad</th>
                  <th className="text-left p-2 font-medium">Actividad</th>
                  <th className="text-left p-2 font-medium">Nivel</th>
                  <th className="text-left p-2 font-medium">Área</th>
                  <th className="text-left p-2 font-medium">Ref. Eje</th>
                  <th className="text-left p-2 font-medium">Unidad</th>
                  <th className="text-left p-2 font-medium">Material</th>
                  <th className="text-right p-2 font-medium">Programada</th>
                  {data.status === 'corte_realizado' && (
                    <>
                      <th className="text-right p-2 font-medium">Realizada</th>
                      <th className="text-right p-2 font-medium">%</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {(data.actividades || []).map((a: any, idx: number) => {
                  const pct = parseFloat(a.porcentajeAvance) || 0;
                  return (
                    <tr key={a.id || idx} className="border-b">
                      <td className="p-2 font-medium">{a.especialidad}</td>
                      <td className="p-2">{a.actividad}</td>
                      <td className="p-2">{a.nivel || "—"}</td>
                      <td className="p-2">{a.area || "—"}</td>
                      <td className="p-2">{a.referenciaEje || "—"}</td>
                      <td className="p-2">{a.unidad}</td>
                      <td className="p-2 text-muted-foreground text-xs">{a.material || "—"}</td>
                      <td className="p-2 text-right font-mono">{a.cantidadProgramada}</td>
                      {data.status === 'corte_realizado' && (
                        <>
                          <td className="p-2 text-right font-mono">{a.cantidadRealizada || "0"}</td>
                          <td className="p-2 text-right">
                            <span className={`font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                              {pct.toFixed(1)}%
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Planos */}
      {data.planos && data.planos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Planos / Croquis</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {data.planos.map((p: any, idx: number) => (
                <div key={p.id || idx} className="relative group">
                  <img
                    src={p.imagenUrl}
                    alt={p.titulo || `Plano ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-lg border hover:opacity-80 transition-opacity cursor-pointer"
                    onClick={() => { setLightboxIdx(idx); setLightboxOpen(true); }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setDrawCanvasIdx(idx); setDrawCanvasOpen(true); }}
                    className="absolute top-1 right-1 flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white shadow-lg active:bg-red-600 touch-manipulation"
                    title="Rayar / Anotar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {p.titulo && <p className="text-xs text-muted-foreground mt-1 truncate">{p.titulo}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {lightboxOpen && planoUrls.length > 0 && (
        <ZoomableLightbox
          url={planoUrls[lightboxIdx]}
          onClose={() => setLightboxOpen(false)}
          gallery={planoUrls}
          initialIndex={lightboxIdx}
        />
      )}

      {drawCanvasOpen && planoUrls.length > 0 && (
        <DrawableCanvas
          imageUrl={planoUrls[drawCanvasIdx]}
          onClose={() => setDrawCanvasOpen(false)}
          title={data.planos[drawCanvasIdx]?.titulo || `Plano ${drawCanvasIdx + 1}`}
        />
      )}

      {/* Acciones */}
      <div className="flex gap-2 justify-end flex-wrap">
        <Button variant="outline" size="sm" onClick={async () => {
          const btn = document.activeElement as HTMLButtonElement;
          if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }
          try { await generarPDFProgramaSemanal(data); } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = ''; }
          }
        }}>
          <Download className="w-4 h-4 mr-1" /> PDF
        </Button>
        <GuardarComoPlantillaBtn programaId={programaId} />
        {canDelete && (
          <Button variant="destructive" size="sm" onClick={() => {
            if (confirm(`¿Eliminar este programa semanal${data.status !== 'borrador' ? ' (estado: ' + data.status + ')' : ''}? Esta acción no se puede deshacer.`)) {
              onDelete(programaId);
            }
          }}>
            <Trash2 className="w-4 h-4 mr-1" /> Eliminar
          </Button>
        )}
        {canEdit && data.status === 'borrador' && (
          <Button size="sm" onClick={() => onEntregar(programaId)}>
            <Send className="w-4 h-4 mr-1" /> Entregar
          </Button>
        )}
        {canCorte && (
          <Button size="sm" variant="default" onClick={onCorte}>
            <Scissors className="w-4 h-4 mr-1" /> Realizar Corte
          </Button>
        )}
      </div>
    </div>
  );
}

// ===== CORTE =====
function CortePrograma({ programaId, onBack, onCorte, isLoading }: {
  programaId: number;
  onBack: () => void;
  onCorte: (data: any) => void;
  isLoading: boolean;
}) {
  const { data } = trpc.programaSemanal.getById.useQuery({ id: programaId });
  const [realizadas, setRealizadas] = useState<Record<number, string>>({});
  const [drawCanvasOpen, setDrawCanvasOpen] = useState(false);
  const [drawCanvasIdx, setDrawCanvasIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  if (!data) return null;

  const planoUrls = (data.planos || []).map((p: any) => p.imagenUrl);

  const handleCorte = () => {
    const actividadesCorte = (data.actividades || []).map((a: any) => ({
      id: a.id,
      cantidadRealizada: realizadas[a.id] || "0",
    }));
    onCorte({ id: programaId, actividades: actividadesCorte });
  };

  // Calcular eficiencia en tiempo real
  const eficienciaPreview = useMemo(() => {
    let totalProg = 0, totalReal = 0;
    (data.actividades || []).forEach((a: any) => {
      const prog = parseFloat(a.cantidadProgramada) || 0;
      const real = parseFloat(realizadas[a.id] || "0") || 0;
      totalProg += prog;
      totalReal += real;
    });
    return totalProg > 0 ? (totalReal / totalProg) * 100 : 0;
  }, [data.actividades, realizadas]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold flex-1">Corte Semanal</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Eficiencia:</span>
          <span className={`text-xl font-bold ${eficienciaPreview >= 80 ? "text-emerald-600" : eficienciaPreview >= 50 ? "text-amber-600" : "text-red-600"}`}>
            {eficienciaPreview.toFixed(1)}%
          </span>
        </div>
      </div>

      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Especialidad</th>
                  <th className="text-left p-2 font-medium">Actividad</th>
                  <th className="text-left p-2 font-medium">Nivel</th>
                  <th className="text-left p-2 font-medium">Unidad</th>
                  <th className="text-right p-2 font-medium">Programada</th>
                  <th className="text-right p-2 font-medium w-28">Realizada</th>
                  <th className="text-right p-2 font-medium w-16">%</th>
                </tr>
              </thead>
              <tbody>
                {(data.actividades || []).map((a: any) => {
                  const prog = parseFloat(a.cantidadProgramada) || 0;
                  const real = parseFloat(realizadas[a.id] || "0") || 0;
                  const pct = prog > 0 ? (real / prog) * 100 : 0;
                  return (
                    <tr key={a.id} className="border-b">
                      <td className="p-2 font-medium">{a.especialidad}</td>
                      <td className="p-2">{a.actividad}</td>
                      <td className="p-2">{a.nivel || "—"}</td>
                      <td className="p-2">{a.unidad}</td>
                      <td className="p-2 text-right font-mono">{a.cantidadProgramada}</td>
                      <td className="p-2">
                        <Input type="number" className="h-8 text-xs text-right"
                          value={realizadas[a.id] || ""}
                          onChange={e => setRealizadas(prev => ({ ...prev, [a.id]: e.target.value }))}
                          placeholder="0" />
                      </td>
                      <td className="p-2 text-right">
                        <span className={`font-bold text-xs ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                          {pct.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Planos de referencia para el corte */}
      {data.planos && data.planos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Planos de Referencia
              <span className="text-xs text-muted-foreground font-normal">(toca el lápiz para rayar)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.planos.map((p: any, idx: number) => (
                <div key={p.id || idx} className="relative">
                  <img
                    src={p.imagenUrl}
                    alt={p.titulo || `Plano ${idx + 1}`}
                    className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => { setLightboxIdx(idx); setLightboxOpen(true); }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setDrawCanvasIdx(idx); setDrawCanvasOpen(true); }}
                    className="absolute top-1 right-1 flex items-center justify-center w-7 h-7 rounded-full bg-red-500 text-white shadow-lg active:bg-red-600 touch-manipulation"
                    title="Rayar / Anotar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {p.titulo && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{p.titulo}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {lightboxOpen && planoUrls.length > 0 && (
        <ZoomableLightbox
          url={planoUrls[lightboxIdx]}
          onClose={() => setLightboxOpen(false)}
          gallery={planoUrls}
          initialIndex={lightboxIdx}
        />
      )}

      {drawCanvasOpen && planoUrls.length > 0 && (
        <DrawableCanvas
          imageUrl={planoUrls[drawCanvasIdx]}
          onClose={() => setDrawCanvasOpen(false)}
          title={data.planos[drawCanvasIdx]?.titulo || `Plano ${drawCanvasIdx + 1}`}
        />
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onBack}>Cancelar</Button>
        <Button onClick={handleCorte} disabled={isLoading}>
          {isLoading ? "Procesando..." : "Confirmar Corte"}
        </Button>
      </div>
    </div>
  );
}

// ===== EFICIENCIA =====
function EficienciaView({ data, usuarios, onBack }: {
  data: any[];
  usuarios: any[];
  onBack: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState<string>("todos");

  // Agrupar datos por usuario
  const dataByUser = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const d of data) {
      if (!map.has(d.usuarioId)) map.set(d.usuarioId, []);
      map.get(d.usuarioId)!.push(d);
    }
    return map;
  }, [data]);

  // Datos filtrados
  const filteredData = useMemo(() => {
    if (selectedUserId === "todos") return data;
    return data.filter((d: any) => d.usuarioId === parseInt(selectedUserId));
  }, [data, selectedUserId]);

  // Datos ordenados cronológicamente (más antiguo primero)
  const sortedData = useMemo(() => [...filteredData].reverse(), [filteredData]);

  // Calcular tendencia (pendiente de regresión lineal)
  const tendencia = useMemo(() => {
    if (sortedData.length < 2) return { slope: 0, direction: "estable" as const };
    const n = sortedData.length;
    const xs = sortedData.map((_: any, i: number) => i);
    const ys = sortedData.map((d: any) => parseFloat(d.eficienciaGlobal) || 0);
    const sumX = xs.reduce((a: number, b: number) => a + b, 0);
    const sumY = ys.reduce((a: number, b: number) => a + b, 0);
    const sumXY = xs.reduce((a: number, x: number, i: number) => a + x * ys[i], 0);
    const sumX2 = xs.reduce((a: number, x: number) => a + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return {
      slope,
      direction: slope > 1 ? "mejorando" as const : slope < -1 ? "empeorando" as const : "estable" as const,
    };
  }, [sortedData]);

  // Ranking de usuarios por eficiencia promedio
  const ranking = useMemo(() => {
    const entries: { userId: number; name: string; avg: number; count: number }[] = [];
    dataByUser.forEach((items, userId) => {
      const avg = items.reduce((s: number, d: any) => s + (parseFloat(d.eficienciaGlobal) || 0), 0) / items.length;
      const usuario = usuarios.find((u: any) => u.id === userId);
      entries.push({ userId, name: usuario?.name || `#${userId}`, avg, count: items.length });
    });
    return entries.sort((a, b) => b.avg - a.avg);
  }, [dataByUser, usuarios]);

  // SVG Line chart
  const svgChart = useMemo(() => {
    if (sortedData.length === 0) return null;
    const W = 600, H = 200, PAD = 40;
    const maxPct = 100;
    const points = sortedData.map((d: any, i: number) => {
      const x = PAD + (i / Math.max(sortedData.length - 1, 1)) * (W - PAD * 2);
      const y = H - PAD - ((parseFloat(d.eficienciaGlobal) || 0) / maxPct) * (H - PAD * 2);
      return { x, y, pct: parseFloat(d.eficienciaGlobal) || 0, date: d.semanaInicio };
    });
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    // Línea de tendencia
    const trendY1 = H - PAD - ((tendencia.slope * 0 + (sortedData.reduce((s: number, d: any) => s + (parseFloat(d.eficienciaGlobal) || 0), 0) / sortedData.length - tendencia.slope * (sortedData.length - 1) / 2)) / maxPct) * (H - PAD * 2);
    const trendY2 = H - PAD - ((tendencia.slope * (sortedData.length - 1) + (sortedData.reduce((s: number, d: any) => s + (parseFloat(d.eficienciaGlobal) || 0), 0) / sortedData.length - tendencia.slope * (sortedData.length - 1) / 2)) / maxPct) * (H - PAD * 2);
    return { W, H, PAD, points, linePath, trendY1, trendY2, maxPct };
  }, [sortedData, tendencia]);

  const avg = filteredData.length > 0
    ? (filteredData.reduce((s: number, d: any) => s + (parseFloat(d.eficienciaGlobal) || 0), 0) / filteredData.length)
    : 0;
  const best = filteredData.length > 0 ? Math.max(...filteredData.map((d: any) => parseFloat(d.eficienciaGlobal) || 0)) : 0;
  const worst = filteredData.length > 0 ? Math.min(...filteredData.map((d: any) => parseFloat(d.eficienciaGlobal) || 0)) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold">Eficiencia Histórica</h2>
        <div className="ml-auto">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por usuario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los usuarios</SelectItem>
              {usuarios.map((u: any) => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No hay datos de eficiencia aún. Realiza cortes semanales para ver el historial.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Semanas</p>
                <p className="text-2xl font-bold">{filteredData.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Promedio</p>
                <p className={`text-2xl font-bold ${avg >= 80 ? "text-emerald-600" : avg >= 50 ? "text-amber-600" : "text-red-600"}`}>
                  {avg.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Mejor</p>
                <p className="text-2xl font-bold text-emerald-600">{best.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Peor</p>
                <p className="text-2xl font-bold text-red-600">{worst.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Tendencia</p>
                <p className={`text-lg font-bold ${tendencia.direction === "mejorando" ? "text-emerald-600" : tendencia.direction === "empeorando" ? "text-red-600" : "text-amber-600"}`}>
                  {tendencia.direction === "mejorando" ? "↑ Mejorando" : tendencia.direction === "empeorando" ? "↓ Empeorando" : "→ Estable"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico SVG de línea con tendencia */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Tendencia Semanal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {svgChart && (
                <svg viewBox={`0 0 ${svgChart.W} ${svgChart.H}`} className="w-full h-auto" style={{ maxHeight: 250 }}>
                  {/* Grid horizontal */}
                  {[0, 25, 50, 75, 100].map(pct => {
                    const y = svgChart.H - svgChart.PAD - (pct / svgChart.maxPct) * (svgChart.H - svgChart.PAD * 2);
                    return (
                      <g key={pct}>
                        <line x1={svgChart.PAD} y1={y} x2={svgChart.W - svgChart.PAD} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                        <text x={svgChart.PAD - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{pct}%</text>
                      </g>
                    );
                  })}
                  {/* Línea de tendencia (dashed) */}
                  <line
                    x1={svgChart.PAD} y1={svgChart.trendY1}
                    x2={svgChart.W - svgChart.PAD} y2={svgChart.trendY2}
                    stroke={tendencia.direction === "mejorando" ? "#10b981" : tendencia.direction === "empeorando" ? "#ef4444" : "#f59e0b"}
                    strokeWidth="2" strokeDasharray="6 4" opacity="0.6"
                  />
                  {/* Línea principal */}
                  <path d={svgChart.linePath} fill="none" stroke="#002C63" strokeWidth="2.5" strokeLinejoin="round" />
                  {/* Puntos */}
                  {svgChart.points.map((p: any, i: number) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="5" fill={p.pct >= 80 ? "#10b981" : p.pct >= 50 ? "#f59e0b" : "#ef4444"} stroke="white" strokeWidth="2" />
                      <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#374151">{p.pct.toFixed(0)}%</text>
                    </g>
                  ))}
                  {/* Etiquetas de fecha en eje X */}
                  {svgChart.points.filter((_: any, i: number) => i % Math.max(1, Math.floor(svgChart.points.length / 8)) === 0 || i === svgChart.points.length - 1).map((p: any, i: number) => (
                    <text key={i} x={p.x} y={svgChart.H - 8} textAnchor="middle" fontSize="9" fill="#9ca3af">
                      {formatDateShort(p.date)}
                    </text>
                  ))}
                </svg>
              )}
            </CardContent>
          </Card>

          {/* Ranking de usuarios (solo si hay más de 1 usuario) */}
          {ranking.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ranking por Eficiencia Promedio</CardTitle>
              </CardHeader>
              <CardContent className="p-2 sm:p-4">
                <div className="space-y-2">
                  {ranking.map((r, idx) => (
                    <div key={r.userId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : idx === 2 ? "bg-amber-700" : "bg-slate-300"
                      }`}>{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.count} semanas</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${r.avg >= 80 ? "bg-emerald-500" : r.avg >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, r.avg)}%` }} />
                        </div>
                        <span className={`text-sm font-bold min-w-[3rem] text-right ${r.avg >= 80 ? "text-emerald-600" : r.avg >= 50 ? "text-amber-600" : "text-red-600"}`}>
                          {r.avg.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gráfico de barras */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Eficiencia por Semana</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-end gap-1 h-48">
                {sortedData.map((d: any, idx: number) => {
                  const pct = parseFloat(d.eficienciaGlobal) || 0;
                  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
                  const usuario = usuarios.find((u: any) => u.id === d.usuarioId);
                  return (
                    <div key={d.id || idx} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${formatDateShort(d.semanaInicio)} — ${pct.toFixed(1)}% — ${usuario?.name || ""}`}>
                      <span className="text-[10px] font-mono">{pct.toFixed(0)}%</span>
                      <div className={`w-full ${color} rounded-t transition-all`} style={{ height: `${Math.max(4, pct * 1.6)}px` }} />
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                        {formatDateShort(d.semanaInicio)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tabla detallada */}
          <Card>
            <CardContent className="p-2 sm:p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2">Semana</th>
                    <th className="text-left p-2">Usuario</th>
                    <th className="text-right p-2">Eficiencia</th>
                    <th className="text-right p-2 hidden sm:table-cell">Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((d: any, idx: number) => {
                    const usuario = usuarios.find((u: any) => u.id === d.usuarioId);
                    const pct = parseFloat(d.eficienciaGlobal) || 0;
                    const prevPct = idx > 0 ? (parseFloat(sortedData[idx - 1].eficienciaGlobal) || 0) : pct;
                    const diff = pct - prevPct;
                    return (
                      <tr key={d.id} className="border-b">
                        <td className="p-2">{formatDateShort(d.semanaInicio)}</td>
                        <td className="p-2">{usuario?.name || `#${d.usuarioId}`}</td>
                        <td className="p-2 text-right">
                          <span className={`font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-2 text-right hidden sm:table-cell">
                          {idx > 0 && (
                            <span className={`text-xs font-medium ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ===== GUARDAR COMO PLANTILLA =====
function GuardarComoPlantillaBtn({ programaId }: { programaId: number }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [desc, setDesc] = useState("");
  const utils = trpc.useUtils();
  const mut = trpc.programaSemanal.guardarComoPlantilla.useMutation({
    onSuccess: () => {
      toast.success("Plantilla guardada");
      utils.programaSemanal.listarPlantillas.invalidate();
      setOpen(false);
      setNombre("");
      setDesc("");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Save className="w-4 h-4 mr-1" /> Guardar Plantilla
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre de plantilla" className="h-8 w-48 text-xs" />
      <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (opcional)" className="h-8 w-48 text-xs" />
      <Button size="sm" disabled={!nombre.trim() || mut.isPending}
        onClick={() => mut.mutate({ programaId, nombre: nombre.trim(), descripcion: desc || undefined })}>
        {mut.isPending ? "Guardando..." : "Guardar"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ===== PLANTILLAS VIEW =====
function PlantillasView({ proyectoId, onBack, onCargar }: {
  proyectoId: number;
  onBack: () => void;
  onCargar: (actividades: ActividadRow[]) => void;
}) {
  const { data: plantillas, isLoading } = trpc.programaSemanal.listarPlantillas.useQuery({ proyectoId });
  const utils = trpc.useUtils();
  const deleteMut = trpc.programaSemanal.eliminarPlantilla.useMutation({
    onSuccess: () => {
      utils.programaSemanal.listarPlantillas.invalidate();
      toast.success("Plantilla eliminada");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCargar = (plantilla: any) => {
    const acts = (plantilla.actividades as any[]).map((a: any, i: number) => ({
      especialidad: a.especialidad || "",
      actividad: a.actividad || "",
      nivel: a.nivel || "",
      area: a.area || "",
      referenciaEje: a.referenciaEje || "",
      unidad: (a.unidad || "m2") as Unidad,
      cantidadProgramada: String(a.cantidadProgramada || ""),
      material: a.material || "",
      orden: i,
    }));
    onCargar(acts);
    toast.success(`Plantilla "${plantilla.nombre}" cargada`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BookTemplate className="w-5 h-5 text-emerald-600" /> Plantillas de Actividades
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>)}
        </div>
      ) : !plantillas || plantillas.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BookTemplate className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No hay plantillas guardadas.</p>
            <p className="text-xs text-muted-foreground mt-1">Crea un programa y usa "Guardar Plantilla" para reutilizar actividades.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {plantillas.map((p: any) => {
            const acts = (p.actividades as any[]) || [];
            const especialidades = Array.from(new Set(acts.map((a: any) => a.especialidad).filter(Boolean)));
            return (
              <Card key={p.id} className="hover:bg-accent/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{p.nombre}</h3>
                      {p.descripcion && <p className="text-xs text-muted-foreground mt-0.5">{p.descripcion}</p>}
                      <div className="flex gap-1 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{acts.length} actividades</Badge>
                        {especialidades.slice(0, 3).map((e: string) => (
                          <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                        ))}
                        {especialidades.length > 3 && <Badge variant="outline" className="text-xs">+{especialidades.length - 3}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleCargar(p)}>
                        <Copy className="w-4 h-4 mr-1" /> Usar
                      </Button>
                      <Button variant="destructive" size="icon" className="h-8 w-8"
                        onClick={() => deleteMut.mutate({ id: p.id })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== EXPORTAR COMPARATIVA PDF =====
function exportarComparativaPDF(comparativa: any, usuarios: any[]) {
  const getUsuarioName = (userId: number) => {
    const u = usuarios.find((u: any) => u.id === userId);
    return u?.name || `#${userId}`;
  };

  const fmtWeek = (inicio: any, fin: any) => {
    const d1 = new Date(Number(inicio));
    const d2 = new Date(Number(fin));
    return `${d1.getDate().toString().padStart(2,'0')}/${(d1.getMonth()+1).toString().padStart(2,'0')}/${d1.getFullYear()} - ${d2.getDate().toString().padStart(2,'0')}/${(d2.getMonth()+1).toString().padStart(2,'0')}/${d2.getFullYear()}`;
  };

  const s1 = comparativa.semana1;
  const s2 = comparativa.semana2;
  const diff = s2.eficienciaCalculada - s1.eficienciaCalculada;

  const allEsp = Array.from(new Set([
    ...s1.porEspecialidad.map((e: any) => e.especialidad),
    ...s2.porEspecialidad.map((e: any) => e.especialidad),
  ])) as string[];

  const espRows = allEsp.map(esp => {
    const e1 = s1.porEspecialidad.find((e: any) => e.especialidad === esp);
    const e2 = s2.porEspecialidad.find((e: any) => e.especialidad === esp);
    const pct1 = e1?.eficiencia || 0;
    const pct2 = e2?.eficiencia || 0;
    const d = pct2 - pct1;
    return `<tr>
      <td style="padding:6px 10px;border:1px solid #ddd;font-weight:500">${esp}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;color:${pct1>=80?'#059669':pct1>=50?'#d97706':'#dc2626'}">${pct1.toFixed(1)}%</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;color:${pct2>=80?'#059669':pct2>=50?'#d97706':'#dc2626'}">${pct2.toFixed(1)}%</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;font-weight:700;color:${d>0?'#059669':d<0?'#dc2626':'#666'}">${d>0?'+':''}${d.toFixed(1)}%</td>
    </tr>`;
  }).join('');

  // Actividades detalladas por semana
  const actTable = (sem: any, label: string) => {
    const rows = sem.actividades.map((a: any) => {
      const pct = a.cantidadProgramada > 0 ? ((a.cantidadRealizada || 0) / a.cantidadProgramada * 100) : 0;
      return `<tr>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px">${a.especialidad || '-'}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px">${a.actividad || '-'}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center">${a.nivel || '-'}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:center">${a.unidad || '-'}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:right">${a.cantidadProgramada}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:right">${a.cantidadRealizada ?? '-'}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;text-align:right;color:${pct>=80?'#059669':pct>=50?'#d97706':'#dc2626'}">${pct.toFixed(1)}%</td>
      </tr>`;
    }).join('');
    return `<h3 style="margin:20px 0 8px;color:#002C63">${label}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Especialidad</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Actividad</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:center">Nivel</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:center">Unidad</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:right">Programada</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:right">Realizada</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:right">Eficiencia</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  };

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comparativa Semanal</title>
  <style>
    @page { size: landscape; margin: 15mm; }
    body { font-family: Arial, sans-serif; color: #333; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #02B381; padding-bottom: 10px; margin-bottom: 20px; }
    .logo { font-size: 22px; font-weight: bold; color: #002C63; }
    .logo span { color: #02B381; }
    .summary { display: flex; gap: 20px; margin-bottom: 20px; }
    .summary-card { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 16px; text-align: center; }
    .big-num { font-size: 36px; font-weight: 700; }
    .green { color: #059669; } .amber { color: #d97706; } .red { color: #dc2626; }
    .diff-card { border: 2px solid ${diff>0?'#059669':diff<0?'#dc2626':'#999'}; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 20px; background: ${diff>0?'#f0fdf4':diff<0?'#fef2f2':'#f9fafb'}; }
  </style></head><body>
  <div class="header">
    <div class="logo">Objetiva <span>QC</span></div>
    <div style="text-align:right;font-size:12px;color:#666">
      Comparativa Semanal<br>
      Generado: ${new Date().toLocaleDateString('es-MX')}
    </div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div style="font-size:13px;color:#666;margin-bottom:4px">Semana 1: ${fmtWeek(s1.semanaInicio, s1.semanaFin)}</div>
      <div style="font-size:12px;margin-bottom:8px">Usuario: ${getUsuarioName(s1.usuarioId)}</div>
      <div class="big-num ${s1.eficienciaCalculada>=80?'green':s1.eficienciaCalculada>=50?'amber':'red'}">${s1.eficienciaCalculada.toFixed(1)}%</div>
      <div style="font-size:11px;color:#666">${s1.actividades.length} actividades</div>
    </div>
    <div class="summary-card">
      <div style="font-size:13px;color:#666;margin-bottom:4px">Semana 2: ${fmtWeek(s2.semanaInicio, s2.semanaFin)}</div>
      <div style="font-size:12px;margin-bottom:8px">Usuario: ${getUsuarioName(s2.usuarioId)}</div>
      <div class="big-num ${s2.eficienciaCalculada>=80?'green':s2.eficienciaCalculada>=50?'amber':'red'}">${s2.eficienciaCalculada.toFixed(1)}%</div>
      <div style="font-size:11px;color:#666">${s2.actividades.length} actividades</div>
    </div>
  </div>

  <div class="diff-card">
    <span style="font-size:18px;font-weight:700;color:${diff>0?'#059669':diff<0?'#dc2626':'#666'}">
      ${diff>0?'Mejora de +':'Variación de '}${diff.toFixed(1)}% en eficiencia
    </span>
  </div>

  <h3 style="color:#002C63;margin:16px 0 8px">Eficiencia por Especialidad</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#f3f4f6">
      <th style="padding:8px 10px;border:1px solid #ddd;text-align:left">Especialidad</th>
      <th style="padding:8px 10px;border:1px solid #ddd;text-align:right">Semana 1</th>
      <th style="padding:8px 10px;border:1px solid #ddd;text-align:right">Semana 2</th>
      <th style="padding:8px 10px;border:1px solid #ddd;text-align:right">Diferencia</th>
    </tr></thead>
    <tbody>${espRows}</tbody>
  </table>

  ${actTable(s1, `Detalle Semana 1: ${fmtWeek(s1.semanaInicio, s1.semanaFin)}`)}
  ${actTable(s2, `Detalle Semana 2: ${fmtWeek(s2.semanaInicio, s2.semanaFin)}`)}

  <div style="margin-top:30px;text-align:center;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px">
    ObjetivaQC &mdash; Control de Calidad de Obra &mdash; &copy; ${new Date().getFullYear()} Objetiva. Derechos Reservados.
  </div>
  </body></html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }
}

// ===== COMPARATIVA VIEW =====
function ComparativaView({ proyectoId, programas, usuarios, onBack }: {
  proyectoId: number;
  programas: any[];
  usuarios: any[];
  onBack: () => void;
}) {
  const [id1, setId1] = useState<string>("");
  const [id2, setId2] = useState<string>("");

  const { data: comparativa, isLoading } = trpc.programaSemanal.comparativa.useQuery(
    { programaId1: parseInt(id1), programaId2: parseInt(id2) },
    { enabled: !!id1 && !!id2 && id1 !== id2 }
  );

  // Solo programas con corte realizado
  const programasConCorte = useMemo(() =>
    programas.filter((p: any) => p.status === "corte_realizado"),
    [programas]
  );

  const getUsuarioName = (userId: number) => {
    const u = usuarios.find((u: any) => u.id === userId);
    return u?.name || `#${userId}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-emerald-600" /> Comparativa Semanal
        </h2>
      </div>

      {/* Selectores */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Semana 1</label>
              <Select value={id1} onValueChange={setId1}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar semana" />
                </SelectTrigger>
                <SelectContent>
                  {programasConCorte.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {formatWeekRange(p.semanaInicio, p.semanaFin)} — {getUsuarioName(p.usuarioId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Semana 2</label>
              <Select value={id2} onValueChange={setId2}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar semana" />
                </SelectTrigger>
                <SelectContent>
                  {programasConCorte.filter((p: any) => String(p.id) !== id1).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {formatWeekRange(p.semanaInicio, p.semanaFin)} — {getUsuarioName(p.usuarioId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botón exportar PDF */}
      {comparativa && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => exportarComparativaPDF(comparativa, usuarios)}>
            <FileDown className="w-4 h-4 mr-1" /> Exportar PDF
          </Button>
        </div>
      )}

      {!id1 || !id2 || id1 === id2 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <GitCompare className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Selecciona dos semanas diferentes con corte realizado para comparar.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card className="animate-pulse"><CardContent className="p-8 h-48" /></Card>
      ) : comparativa ? (
        <>
          {/* Resumen lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            {[comparativa.semana1, comparativa.semana2].map((sem: any, idx: number) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {formatWeekRange(sem.semanaInicio, sem.semanaFin)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-center">
                    <p className={`text-3xl font-bold ${
                      sem.eficienciaCalculada >= 80 ? "text-emerald-600" :
                      sem.eficienciaCalculada >= 50 ? "text-amber-600" : "text-red-600"
                    }`}>
                      {sem.eficienciaCalculada.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Eficiencia Global</p>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-xs"><span className="text-muted-foreground">Actividades:</span> {sem.actividades.length}</p>
                    <p className="text-xs"><span className="text-muted-foreground">Usuario:</span> {getUsuarioName(sem.usuarioId)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Diferencia */}
          {(() => {
            const diff = comparativa.semana2.eficienciaCalculada - comparativa.semana1.eficienciaCalculada;
            return (
              <Card className={diff > 0 ? "border-emerald-300 bg-emerald-50/50" : diff < 0 ? "border-red-300 bg-red-50/50" : ""}>
                <CardContent className="p-4 text-center">
                  <p className="text-sm font-medium">
                    {diff > 0 ? (
                      <span className="text-emerald-600">Mejora de +{diff.toFixed(1)}% en eficiencia</span>
                    ) : diff < 0 ? (
                      <span className="text-red-600">Descenso de {diff.toFixed(1)}% en eficiencia</span>
                    ) : (
                      <span className="text-muted-foreground">Sin cambio en eficiencia</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            );
          })()}

          {/* Comparativa por especialidad */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Eficiencia por Especialidad</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Especialidad</th>
                      <th className="text-right p-2 font-medium">Sem 1 (%)</th>
                      <th className="text-right p-2 font-medium">Sem 2 (%)</th>
                      <th className="text-right p-2 font-medium">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const allEspArr = Array.from(new Set([
                        ...comparativa.semana1.porEspecialidad.map((e: any) => e.especialidad),
                        ...comparativa.semana2.porEspecialidad.map((e: any) => e.especialidad),
                      ]));
                      return allEspArr.map(esp => {
                        const e1 = comparativa.semana1.porEspecialidad.find((e: any) => e.especialidad === esp);
                        const e2 = comparativa.semana2.porEspecialidad.find((e: any) => e.especialidad === esp);
                        const pct1 = e1?.eficiencia || 0;
                        const pct2 = e2?.eficiencia || 0;
                        const diff = pct2 - pct1;
                        return (
                          <tr key={esp} className="border-b">
                            <td className="p-2 font-medium">{esp}</td>
                            <td className="p-2 text-right font-mono">
                              <span className={pct1 >= 80 ? "text-emerald-600" : pct1 >= 50 ? "text-amber-600" : "text-red-600"}>
                                {pct1.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-2 text-right font-mono">
                              <span className={pct2 >= 80 ? "text-emerald-600" : pct2 >= 50 ? "text-amber-600" : "text-red-600"}>
                                {pct2.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-2 text-right font-bold">
                              <span className={diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-muted-foreground"}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de barras comparativo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Gráfico Comparativo</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {(() => {
                const allEsp = Array.from(new Set([
                  ...comparativa.semana1.porEspecialidad.map((e: any) => e.especialidad),
                  ...comparativa.semana2.porEspecialidad.map((e: any) => e.especialidad),
                ]));
                const barW = Math.min(60, 500 / Math.max(allEsp.length, 1));
                const chartW = allEsp.length * (barW * 2 + 20) + 60;
                const H = 200;
                return (
                  <div className="overflow-x-auto">
                    <svg viewBox={`0 0 ${chartW} ${H + 40}`} className="w-full max-w-[700px] mx-auto" style={{ minWidth: 300 }}>
                      {/* Grid lines */}
                      {[0, 25, 50, 75, 100].map(v => (
                        <g key={v}>
                          <line x1="40" y1={H - (v / 100) * H} x2={chartW} y2={H - (v / 100) * H} stroke="#e5e7eb" strokeDasharray="4" />
                          <text x="35" y={H - (v / 100) * H + 4} textAnchor="end" className="text-[10px] fill-muted-foreground">{v}%</text>
                        </g>
                      ))}
                      {/* Bars */}
                      {allEsp.map((esp, i) => {
                        const e1 = comparativa.semana1.porEspecialidad.find((e: any) => e.especialidad === esp);
                        const e2 = comparativa.semana2.porEspecialidad.find((e: any) => e.especialidad === esp);
                        const pct1 = e1?.eficiencia || 0;
                        const pct2 = e2?.eficiencia || 0;
                        const x = 50 + i * (barW * 2 + 20);
                        return (
                          <g key={esp}>
                            <rect x={x} y={H - (pct1 / 100) * H} width={barW - 2} height={(pct1 / 100) * H}
                              fill="#93c5fd" rx="2" />
                            <rect x={x + barW} y={H - (pct2 / 100) * H} width={barW - 2} height={(pct2 / 100) * H}
                              fill="#02B381" rx="2" />
                            <text x={x + barW} y={H + 15} textAnchor="middle" className="text-[9px] fill-muted-foreground">
                              {esp.length > 10 ? esp.slice(0, 10) + "..." : esp}
                            </text>
                          </g>
                        );
                      })}
                      {/* Legend */}
                      <rect x={chartW - 160} y={5} width={12} height={12} fill="#93c5fd" rx="2" />
                      <text x={chartW - 144} y={15} className="text-[10px] fill-muted-foreground">Semana 1</text>
                      <rect x={chartW - 80} y={5} width={12} height={12} fill="#02B381" rx="2" />
                      <text x={chartW - 64} y={15} className="text-[10px] fill-muted-foreground">Semana 2</text>
                    </svg>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}


// ===== RESUMEN EJECUTIVO MENSUAL =====
function ResumenMensualView({ proyectoId, usuarios, onBack }: {
  proyectoId: number;
  usuarios: any[];
  onBack: () => void;
}) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [filterUsuario, setFilterUsuario] = useState<string>("todos");

  const { data, isLoading } = trpc.programaSemanal.resumenMensual.useQuery(
    { proyectoId, mes, anio, usuarioId: filterUsuario !== "todos" ? Number(filterUsuario) : undefined },
    { enabled: !!proyectoId }
  );

  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold flex-1 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          Resumen Ejecutivo Mensual
        </h2>
      </div>

      {/* Selectores */}
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {meses.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterUsuario} onValueChange={setFilterUsuario}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Todos los usuarios" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los usuarios</SelectItem>
            {usuarios.map((u: any) => (
              <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-24" /></Card>)}
        </div>
      ) : !data || data.totalProgramas === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin programas en {meses[mes - 1]} {anio}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{data.totalProgramas}</p>
                <p className="text-xs text-muted-foreground">Programas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${data.eficienciaPromedio != null && data.eficienciaPromedio >= 80 ? "text-emerald-600" : data.eficienciaPromedio != null && data.eficienciaPromedio >= 50 ? "text-amber-600" : "text-red-600"}`}>
                  {data.eficienciaPromedio != null ? `${data.eficienciaPromedio.toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Eficiencia Promedio</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${data.tendencia >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {data.tendencia >= 0 ? "+" : ""}{data.tendencia.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Tendencia</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{data.cumplimiento.aTiempo}</p>
                <p className="text-xs text-muted-foreground">A Tiempo / {data.cumplimiento.totalEntregados + data.cumplimiento.pendientes}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de cumplimiento */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cumplimiento de Entregas</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm">A tiempo ({data.cumplimiento.aTiempo})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm">Tardío ({data.cumplimiento.tarde})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                  <span className="text-sm">Pendiente ({data.cumplimiento.pendientes})</span>
                </div>
              </div>
              {/* Barra de progreso */}
              <div className="w-full h-8 rounded-full overflow-hidden flex bg-gray-100">
                {data.cumplimiento.aTiempo > 0 && (
                  <div className="bg-emerald-500 h-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${(data.cumplimiento.aTiempo / data.totalProgramas) * 100}%` }}>
                    {Math.round((data.cumplimiento.aTiempo / data.totalProgramas) * 100)}%
                  </div>
                )}
                {data.cumplimiento.tarde > 0 && (
                  <div className="bg-red-500 h-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${(data.cumplimiento.tarde / data.totalProgramas) * 100}%` }}>
                    {Math.round((data.cumplimiento.tarde / data.totalProgramas) * 100)}%
                  </div>
                )}
                {data.cumplimiento.pendientes > 0 && (
                  <div className="bg-gray-300 h-full flex items-center justify-center text-xs font-bold"
                    style={{ width: `${(data.cumplimiento.pendientes / data.totalProgramas) * 100}%` }}>
                    {Math.round((data.cumplimiento.pendientes / data.totalProgramas) * 100)}%
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de eficiencia semanal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Eficiencia por Semana</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {data.semanas.map((s: any, idx: number) => {
                  const ef = s.eficiencia;
                  const usuario = usuarios.find((u: any) => u.id === s.usuarioId);
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-24 shrink-0">
                        S{idx + 1}: {formatDateShort(s.semanaInicio)}
                      </span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                        {ef != null && (
                          <div
                            className={`h-full rounded-full transition-all ${ef >= 80 ? "bg-emerald-500" : ef >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(ef, 100)}%` }}
                          />
                        )}
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                          {ef != null ? `${ef.toFixed(1)}%` : "Sin corte"}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${s.cumplimiento === "a_tiempo" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : s.cumplimiento === "tarde" ? "bg-red-100 text-red-800 border-red-300" : "bg-gray-100 text-gray-600 border-gray-300"}`}>
                        {s.cumplimiento === "a_tiempo" ? "✓" : s.cumplimiento === "tarde" ? "✗" : "—"}
                      </span>
                      {usuario && <span className="text-xs text-muted-foreground hidden sm:block">{usuario.name}</span>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tendencia visual */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tendencia del Mes</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 justify-center">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">1ª mitad</p>
                  {(() => {
                    const conCorte = data.semanas.filter((s: any) => s.eficiencia != null);
                    const mitad = Math.ceil(conCorte.length / 2);
                    const primera = conCorte.slice(0, mitad);
                    const ef1 = primera.length > 0 ? primera.reduce((s: number, x: any) => s + x.eficiencia, 0) / primera.length : 0;
                    return <p className="text-xl font-bold">{ef1.toFixed(1)}%</p>;
                  })()}
                </div>
                <div className={`text-3xl ${data.tendencia >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {data.tendencia >= 0 ? "→ ↑" : "→ ↓"}
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">2ª mitad</p>
                  {(() => {
                    const conCorte = data.semanas.filter((s: any) => s.eficiencia != null);
                    const mitad = Math.ceil(conCorte.length / 2);
                    const segunda = conCorte.slice(mitad);
                    const ef2 = segunda.length > 0 ? segunda.reduce((s: number, x: any) => s + x.eficiencia, 0) / segunda.length : 0;
                    return <p className="text-xl font-bold">{ef2.toFixed(1)}%</p>;
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ===== RANKING DE CUMPLIMIENTO =====
function RankingCumplimientoView({ proyectoId, usuarios, onBack }: {
  proyectoId: number;
  usuarios: any[];
  onBack: () => void;
}) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [filtroTodo, setFiltroTodo] = useState(false);

  const { data, isLoading } = trpc.programaSemanal.rankingCumplimiento.useQuery(
    { proyectoId, mes: filtroTodo ? undefined : mes, anio: filtroTodo ? undefined : anio },
    { enabled: !!proyectoId }
  );

  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const getMedal = (idx: number) => {
    if (idx === 0) return "🥇";
    if (idx === 1) return "🥈";
    if (idx === 2) return "🥉";
    return `${idx + 1}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold flex-1 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-600" />
          Ranking de Cumplimiento
        </h2>
      </div>

      {/* Selectores */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button size="sm" variant={filtroTodo ? "default" : "outline"} onClick={() => setFiltroTodo(!filtroTodo)}>
          {filtroTodo ? "Todo el historial" : "Por mes"}
        </Button>
        {!filtroTodo && (
          <>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        {data?.ranking && data.ranking.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => exportarRankingPDF(data.ranking, filtroTodo ? undefined : mes, filtroTodo ? undefined : anio)}>
            <FileDown className="w-4 h-4 mr-1" /> Exportar PDF
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-16" /></Card>)}
        </div>
      ) : !data || data.ranking.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin datos de cumplimiento</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Podio top 3 */}
          {data.ranking.length >= 3 && (
            <div className="grid grid-cols-3 gap-3">
              {data.ranking.slice(0, 3).map((r: any, idx: number) => (
                <Card key={r.userId} className={`${idx === 0 ? "border-amber-400 bg-amber-50/50" : idx === 1 ? "border-gray-300 bg-gray-50/50" : "border-orange-300 bg-orange-50/30"}`}>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl mb-1">{getMedal(idx)}</p>
                    {r.fotoUrl ? (
                      <img src={r.fotoUrl} alt={r.nombre} className="w-10 h-10 rounded-full mx-auto mb-1 object-cover border-2 border-white shadow-sm" />
                    ) : (
                      <div className="w-10 h-10 rounded-full mx-auto mb-1 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-sm font-bold text-slate-600 border-2 border-white shadow-sm">
                        {(r.nombre || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <p className="font-semibold text-sm truncate">{r.nombre}</p>
                    <p className="text-xs text-muted-foreground">{r.especialidad || r.role}</p>
                    <p className={`text-lg font-bold mt-1 ${r.pctATiempo >= 80 ? "text-emerald-600" : r.pctATiempo >= 50 ? "text-amber-600" : "text-red-600"}`}>
                      {r.pctATiempo.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">a tiempo</p>
                    {r.eficienciaPromedio != null && (
                      <p className="text-xs mt-1">Ef: {r.eficienciaPromedio.toFixed(1)}%</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Tabla completa */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalle por Usuario</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">#</th>
                      <th className="text-left p-2 font-medium">Usuario</th>
                      <th className="text-left p-2 font-medium">Especialidad</th>
                      <th className="text-center p-2 font-medium">Total</th>
                      <th className="text-center p-2 font-medium">A Tiempo</th>
                      <th className="text-center p-2 font-medium">Tarde</th>
                      <th className="text-center p-2 font-medium">Pendiente</th>
                      <th className="text-center p-2 font-medium">% Cumpl.</th>
                      <th className="text-center p-2 font-medium">Eficiencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ranking.map((r: any, idx: number) => (
                      <tr key={r.userId} className={`border-b ${idx < 3 ? "bg-amber-50/30" : ""}`}>
                        <td className="p-2 font-medium">{getMedal(idx)}</td>
                        <td className="p-2 font-medium">
                          <div className="flex items-center gap-2">
                            {r.fotoUrl ? (
                              <img src={r.fotoUrl} alt={r.nombre} className="w-7 h-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                {(r.nombre || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="truncate">{r.nombre}</span>
                          </div>
                        </td>
                        <td className="p-2 text-muted-foreground">{r.especialidad || r.role}</td>
                        <td className="p-2 text-center">{r.total}</td>
                        <td className="p-2 text-center">
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <Check className="w-3 h-3" /> {r.aTiempo}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <AlertTriangle className="w-3 h-3" /> {r.tarde}
                          </span>
                        </td>
                        <td className="p-2 text-center text-muted-foreground">{r.pendiente}</td>
                        <td className="p-2 text-center">
                          <span className={`font-bold ${r.pctATiempo >= 80 ? "text-emerald-600" : r.pctATiempo >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {r.pctATiempo.toFixed(0)}%
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          {r.eficienciaPromedio != null ? (
                            <span className={`font-bold ${r.eficienciaPromedio >= 80 ? "text-emerald-600" : r.eficienciaPromedio >= 50 ? "text-amber-600" : "text-red-600"}`}>
                              {r.eficienciaPromedio.toFixed(1)}%
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Barra visual de cumplimiento por usuario */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cumplimiento Visual</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {data.ranking.map((r: any) => (
                <div key={r.userId} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-40 shrink-0">
                    {r.fotoUrl ? (
                      <img src={r.fotoUrl} alt={r.nombre} className="w-6 h-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                        {(r.nombre || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium truncate">{r.nombre}</span>
                  </div>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden flex">
                    {r.aTiempo > 0 && (
                      <div className="bg-emerald-500 h-full" style={{ width: `${(r.aTiempo / r.total) * 100}%` }} />
                    )}
                    {r.tarde > 0 && (
                      <div className="bg-red-500 h-full" style={{ width: `${(r.tarde / r.total) * 100}%` }} />
                    )}
                    {r.pendiente > 0 && (
                      <div className="bg-gray-300 h-full" style={{ width: `${(r.pendiente / r.total) * 100}%` }} />
                    )}
                  </div>
                  <span className="text-xs font-bold w-12 text-right">{r.pctATiempo.toFixed(0)}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}


// ===== EXPORTAR RANKING A PDF =====
function exportarRankingPDF(ranking: any[], mes?: number, anio?: number) {
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const periodo = mes && anio ? `${meses[mes - 1]} ${anio}` : "Historial Completo";
  
  const rows = ranking.map((r: any, i: number) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:bold">${i + 1}</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb">${r.nombre}</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb">${r.especialidad || r.role || '-'}</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center">${r.total}</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;color:#16a34a">${r.aTiempo}</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;color:#dc2626">${r.tarde}</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;color:#6b7280">${r.pendiente}</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:bold;color:${r.pctATiempo >= 80 ? '#16a34a' : r.pctATiempo >= 50 ? '#ca8a04' : '#dc2626'}">${r.pctATiempo.toFixed(1)}%</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:bold">${r.eficienciaPromedio != null ? r.eficienciaPromedio.toFixed(1) + '%' : '-'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ranking de Cumplimiento</title>
    <style>@page{size:landscape;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:11px}
    h1{text-align:center;color:#111;font-size:18px;margin-bottom:4px}
    h2{text-align:center;color:#666;font-size:13px;margin-top:0;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th{background:#1e293b;color:white;padding:8px 10px;border:1px solid #334155;font-size:10px;text-transform:uppercase}
    .footer{text-align:center;margin-top:20px;color:#999;font-size:9px}
    .podium{display:flex;justify-content:center;gap:30px;margin:15px 0}
    .podium-item{text-align:center;padding:10px 20px;border-radius:8px}
    .gold{background:#fef3c7;border:2px solid #f59e0b}.silver{background:#f1f5f9;border:2px solid #94a3b8}.bronze{background:#fed7aa;border:2px solid #f97316}
    </style></head><body>
    <h1>Ranking de Cumplimiento — Programa Semanal</h1>
    <h2>${periodo}</h2>
    ${ranking.length >= 3 ? `<div class="podium">
      <div class="podium-item silver"><div style="font-size:20px">🥈</div><div style="font-weight:bold">${ranking[1]?.nombre}</div><div>${ranking[1]?.pctATiempo.toFixed(1)}%</div></div>
      <div class="podium-item gold"><div style="font-size:24px">🥇</div><div style="font-weight:bold">${ranking[0]?.nombre}</div><div>${ranking[0]?.pctATiempo.toFixed(1)}%</div></div>
      <div class="podium-item bronze"><div style="font-size:20px">🥉</div><div style="font-weight:bold">${ranking[2]?.nombre}</div><div>${ranking[2]?.pctATiempo.toFixed(1)}%</div></div>
    </div>` : ''}
    <table><thead><tr>
      <th>#</th><th>Nombre</th><th>Especialidad</th><th>Total</th><th>A Tiempo</th><th>Tarde</th><th>Pendiente</th><th>% Cumplimiento</th><th>Eficiencia Prom.</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="footer">Generado el ${new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
    </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
}

// ===== METAS DE EFICIENCIA VIEW =====
function MetasEficienciaView({ proyectoId, usuarios, onBack }: {
  proyectoId: number;
  usuarios: any[];
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [metaEf, setMetaEf] = useState(80);
  const [metaCumpl, setMetaCumpl] = useState(80);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserId, setNewUserId] = useState<string>("");

  const { data: metas, isLoading } = trpc.programaSemanal.getMetasEficiencia.useQuery(
    { proyectoId },
    { enabled: !!proyectoId }
  );

  const { data: alertasData } = trpc.programaSemanal.verificarAlertasMetas.useQuery(
    { proyectoId },
    { enabled: !!proyectoId }
  );

  const upsertMut = trpc.programaSemanal.upsertMetaEficiencia.useMutation({
    onSuccess: () => {
      utils.programaSemanal.getMetasEficiencia.invalidate();
      utils.programaSemanal.verificarAlertasMetas.invalidate();
      toast.success("Meta guardada");
      setEditingUserId(null);
      setShowAddForm(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.programaSemanal.deleteMetaEficiencia.useMutation({
    onSuccess: () => {
      utils.programaSemanal.getMetasEficiencia.invalidate();
      utils.programaSemanal.verificarAlertasMetas.invalidate();
      toast.success("Meta eliminada");
    },
    onError: (e) => toast.error(e.message),
  });

  const alertas = alertasData?.alertas || [];
  const metasList = metas || [];

  // Usuarios sin meta configurada
  const usuariosSinMeta = usuarios.filter(u => !metasList.some((m: any) => m.usuarioId === u.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Volver
        </Button>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-600" />
          Metas de Eficiencia por Usuario
        </h2>
      </div>

      {/* Alertas activas */}
      {alertas.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alertas — Metas no alcanzadas (últimas 4 semanas)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={`inline-block w-2 h-2 rounded-full ${a.tipo === 'eficiencia' ? 'bg-orange-500' : 'bg-red-500'}`} />
                <span className="font-medium">{a.nombre}</span>
                <span className="text-muted-foreground">—</span>
                <span className="text-muted-foreground">
                  {a.tipo === 'eficiencia' ? 'Eficiencia' : 'Cumplimiento'}: 
                  <span className="font-bold text-red-600 ml-1">{a.actual}%</span>
                  <span className="text-muted-foreground mx-1">/ meta:</span>
                  <span className="font-bold">{a.meta}%</span>
                  <span className="text-red-600 ml-1">(-{a.diferencia}%)</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabla de metas configuradas */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Metas Configuradas</CardTitle>
            {!showAddForm && usuariosSinMeta.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => { setShowAddForm(true); setMetaEf(80); setMetaCumpl(80); setNewUserId(""); }}>
                <Plus className="w-4 h-4 mr-1" /> Agregar Meta
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Formulario agregar */}
          {showAddForm && (
            <div className="bg-accent/30 rounded-lg p-3 mb-3 space-y-2">
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-muted-foreground">Usuario</label>
                  <Select value={newUserId} onValueChange={setNewUserId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Seleccionar usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      {usuariosSinMeta.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name} — {(u as any).especialidad || u.role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28">
                  <label className="text-xs text-muted-foreground">Meta Eficiencia %</label>
                  <Input type="number" min={0} max={100} value={metaEf} onChange={e => setMetaEf(Number(e.target.value))} className="h-8 text-xs" />
                </div>
                <div className="w-28">
                  <label className="text-xs text-muted-foreground">Meta Cumplimiento %</label>
                  <Input type="number" min={0} max={100} value={metaCumpl} onChange={e => setMetaCumpl(Number(e.target.value))} className="h-8 text-xs" />
                </div>
                <Button size="sm" disabled={!newUserId || upsertMut.isPending}
                  onClick={() => upsertMut.mutate({ proyectoId, usuarioId: parseInt(newUserId), metaEficiencia: metaEf, metaCumplimiento: metaCumpl })}>
                  <Check className="w-3 h-3 mr-1" /> Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded" />)}
            </div>
          ) : metasList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay metas configuradas. Agrega una para empezar a monitorear.</p>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2 py-1 border-b">
                <div className="col-span-4">Usuario</div>
                <div className="col-span-2 text-center">Meta Eficiencia</div>
                <div className="col-span-2 text-center">Meta Cumplimiento</div>
                <div className="col-span-2 text-center">Estado</div>
                <div className="col-span-2 text-right">Acciones</div>
              </div>
              {metasList.map((meta: any) => {
                const user = usuarios.find(u => u.id === meta.usuarioId);
                const alerta = alertas.filter((a: any) => a.usuarioId === meta.usuarioId);
                const isEditing = editingUserId === meta.usuarioId;

                return (
                  <div key={meta.id} className="grid grid-cols-12 gap-2 items-center px-2 py-2 rounded hover:bg-accent/20 text-sm">
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{user?.name || `Usuario #${meta.usuarioId}`}</span>
                      <span className="text-xs text-muted-foreground truncate">{(user as any)?.especialidad || ''}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      {isEditing ? (
                        <Input type="number" min={0} max={100} value={metaEf} onChange={e => setMetaEf(Number(e.target.value))} className="h-7 text-xs w-20 mx-auto" />
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{meta.metaEficiencia}%</Badge>
                      )}
                    </div>
                    <div className="col-span-2 text-center">
                      {isEditing ? (
                        <Input type="number" min={0} max={100} value={metaCumpl} onChange={e => setMetaCumpl(Number(e.target.value))} className="h-7 text-xs w-20 mx-auto" />
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{meta.metaCumplimiento}%</Badge>
                      )}
                    </div>
                    <div className="col-span-2 text-center">
                      {alerta.length > 0 ? (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {alerta.length} alerta{alerta.length > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                          <Check className="w-3 h-3 mr-1" /> OK
                        </Badge>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                            onClick={() => upsertMut.mutate({ proyectoId, usuarioId: meta.usuarioId, metaEficiencia: metaEf, metaCumplimiento: metaCumpl })}>
                            <Check className="w-3 h-3 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingUserId(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                            onClick={() => { setEditingUserId(meta.usuarioId); setMetaEf(meta.metaEficiencia); setMetaCumpl(meta.metaCumplimiento); }}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500"
                            onClick={() => { if (confirm("¿Eliminar esta meta?")) deleteMut.mutate({ id: meta.id }); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen visual */}
      {metasList.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumen de Cumplimiento de Metas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-700">
                  {metasList.filter((m: any) => !alertas.some((a: any) => a.usuarioId === m.usuarioId)).length}
                </div>
                <div className="text-xs text-green-600">En meta</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-red-700">
                  {new Set(alertas.map((a: any) => a.usuarioId)).size}
                </div>
                <div className="text-xs text-red-600">Bajo meta</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-700">{metasList.length}</div>
                <div className="text-xs text-gray-600">Total configurados</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
