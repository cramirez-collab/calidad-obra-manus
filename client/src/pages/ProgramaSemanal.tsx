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
import {
  CalendarDays, Plus, Send, Scissors, Trash2, ChevronLeft, ChevronRight,
  Download, Upload, Image as ImageIcon, BarChart3, TrendingUp, Eye, Edit,
  X, Check, AlertTriangle, Clock, FileSpreadsheet, BookTemplate, GitCompare,
  Save, FolderOpen, Copy, FileDown
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
type ViewMode = "list" | "create" | "detail" | "corte" | "eficiencia" | "plantillas" | "comparativa";

export default function ProgramaSemanal() {
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  // toast importado de sonner
  const utils = trpc.useUtils();

  const [view, setView] = useState<ViewMode>("list");
  const [selectedProgramaId, setSelectedProgramaId] = useState<number | null>(null);
  const [filterUsuarioId, setFilterUsuarioId] = useState<string>("todos");
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

  // Filtrar usuarios que son residentes/especialistas
  const usuariosEspecialidad = useMemo(() => {
    if (!usuarios) return [];
    return usuarios.filter((u: any) => ['residente', 'jefe_residente', 'supervisor', 'admin', 'superadmin'].includes(u.role));
  }, [usuarios]);

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

  // Datos lista
  const programas = programasData?.programas || [];
  const total = programasData?.total || 0;

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
          <Button size="sm" onClick={() => { setPlantillaActividades(null); setView("create"); }}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo Programa
          </Button>
        </div>
      </div>

      {/* Filtro por usuario */}
      <div className="flex gap-2 items-center">
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
      ) : programas.length === 0 ? (
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
          {programas.map((p: any) => {
            const usuario = usuariosEspecialidad.find((u: any) => u.id === p.usuarioId);
            return (
              <Card key={p.id} className="cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => { setSelectedProgramaId(p.id); setView("detail"); }}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {formatWeekRange(p.semanaInicio, p.semanaFin)}
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {usuario?.name || `Usuario #${p.usuarioId}`}
                        {(usuario as any)?.especialidad ? ` — ${(usuario as any).especialidad}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
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
  const [monday] = useState(() => getMonday(new Date()));
  const [sunday] = useState(() => getSunday(getMonday(new Date())));
  const [notas, setNotas] = useState("");
  const [actividades, setActividades] = useState<ActividadRow[]>(
    initialActividades && initialActividades.length > 0
      ? initialActividades.map((a, i) => ({ ...a, orden: i }))
      : [{ especialidad: "", actividad: "", nivel: "", area: "", referenciaEje: "", unidad: "m2", cantidadProgramada: "", orden: 0 }]
  );
  const [planos, setPlanos] = useState<PlanoRow[]>([]);
  const [uploading, setUploading] = useState(false);

  const addRow = () => {
    setActividades(prev => [...prev, {
      especialidad: prev.length > 0 ? prev[prev.length - 1].especialidad : "",
      actividad: "", nivel: "", area: "", referenciaEje: "",
      unidad: "m2", cantidadProgramada: "", orden: prev.length,
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
          nivel: "", tipo: "planta", titulo: file.name.replace(/\.[^.]+$/, ""),
          imagenUrl: reader.result as string, // temp local preview
          orden: prev.length,
          _base64: base64, _mimeType: file.type,
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

  const handleSubmit = () => {
    const validActividades = actividades.filter(a => a.actividad.trim() && a.cantidadProgramada.trim());
    if (validActividades.length === 0) {
      return;
    }
    onCreate({
      proyectoId,
      semanaInicio: monday.toISOString(),
      semanaFin: sunday.toISOString(),
      notas: notas || undefined,
      actividades: validActividades.map((a, i) => ({ ...a, orden: i })),
      planos: planos.map((p, i) => ({
        nivel: p.nivel, tipo: p.tipo, titulo: p.titulo,
        imagenUrl: p.imagenUrl, imagenKey: p.imagenKey, orden: i,
      })).filter(p => p.imagenUrl && !p.imagenUrl.startsWith("data:")),
    });
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
          <Textarea placeholder="Notas generales (opcional)" value={notas} onChange={e => setNotas(e.target.value)} rows={2} />
        </CardContent>
      </Card>

      {/* Tabla de actividades */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Actividades Programadas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Especialidad</th>
                  <th className="text-left p-2 font-medium">Actividad</th>
                  <th className="text-left p-2 font-medium w-20">Nivel</th>
                  <th className="text-left p-2 font-medium">Área</th>
                  <th className="text-left p-2 font-medium w-20">Ref. Eje</th>
                  <th className="text-left p-2 font-medium w-20">Unidad</th>
                  <th className="text-left p-2 font-medium w-24">Cant. Prog.</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {actividades.map((a, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/20">
                    <td className="p-1">
                      <Input value={a.especialidad} onChange={e => updateRow(idx, "especialidad", e.target.value)}
                        placeholder="Ej: Albañilería" className="h-8 text-xs" />
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
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleUploadPlano} />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onBack}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={isLoading || actividades.filter(a => a.actividad.trim()).length === 0}>
          {isLoading ? "Creando..." : "Crear Programa"}
        </Button>
      </div>
    </div>
  );
}

// ===== GENERAR PDF =====
function generarPDFProgramaSemanal(data: any) {
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

  const planosHtml = planos.length > 0 ? `
    <h3 style="margin-top:20px;font-size:14px;color:#002C63;">Planos / Croquis</h3>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:8px;">
      ${planos.map((p: any) => `
        <div style="text-align:center;">
          <img src="${p.imagenUrl}" style="max-width:100%;max-height:250px;border:1px solid #ddd;border-radius:4px;" crossorigin="anonymous" />
          ${p.titulo ? `<p style="font-size:10px;color:#666;margin-top:4px;">${p.titulo}</p>` : ''}
        </div>
      `).join('')}
    </div>` : '';

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
function DetallePrograma({ programaId, onBack, onCorte, onEntregar, onDelete, userId, userRole }: {
  programaId: number;
  onBack: () => void;
  onCorte: () => void;
  onEntregar: (id: number) => void;
  onDelete: (id: number) => void;
  userId: number;
  userRole: string;
}) {
  const { data, isLoading } = trpc.programaSemanal.getById.useQuery({ id: programaId });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

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
  const canDelete = (isOwner || isAdmin) && data.status === 'borrador';

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
                <div key={p.id || idx} className="cursor-pointer" onClick={() => { setLightboxIdx(idx); setLightboxOpen(true); }}>
                  <img src={p.imagenUrl} alt={p.titulo || `Plano ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
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

      {/* Acciones */}
      <div className="flex gap-2 justify-end flex-wrap">
        <Button variant="outline" size="sm" onClick={() => generarPDFProgramaSemanal(data)}>
          <Download className="w-4 h-4 mr-1" /> PDF
        </Button>
        <GuardarComoPlantillaBtn programaId={programaId} />
        {canDelete && (
          <Button variant="destructive" size="sm" onClick={() => onDelete(programaId)}>
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

  if (!data) return null;

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
