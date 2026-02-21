import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Camera,
  Shield,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  History,
  Zap,
  ImageIcon,
  FileText,
  Filter,
} from "lucide-react";
import ProtocoloReport from "@/components/ProtocoloReport";

type Estado = "verde" | "rojo" | "na" | "pendiente";
type Intento = "intento_1" | "intento_final";

interface EvaluarData {
  pruebaId: number;
  pruebaNombre: string;
  intento: Intento;
  estadoActual: Estado;
}

export default function PruebasDetalle() {
  const { id } = useParams<{ id: string }>();
  const unidadId = Number(id);
  const { selectedProjectId } = useProject();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [expandedSistemas, setExpandedSistemas] = useState<Set<string>>(new Set());
  const [evaluarModal, setEvaluarModal] = useState<EvaluarData | null>(null);
  const [evaluarEstado, setEvaluarEstado] = useState<"verde" | "rojo" | "na">("verde");
  const [observacion, setObservacion] = useState("");
  const [evidenciaBase64, setEvidenciaBase64] = useState<string | null>(null);
  const [evidenciaPreview, setEvidenciaPreview] = useState<string | null>(null);
  const [showBitacora, setShowBitacora] = useState(false);
  const [showEvidencia, setShowEvidencia] = useState<string | null>(null);
  const [showProtocolo, setShowProtocolo] = useState(false);
  const [filtroEspecialidad, setFiltroEspecialidad] = useState<"todos" | "en_proceso" | "con_fallas" | "todas_ok" | "sin_evaluar">("todos");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const { data: detalle, isLoading, refetch } = trpc.pruebas.detalleDepartamento.useQuery(
    { proyectoId: selectedProjectId!, unidadId },
    { enabled: !!selectedProjectId && !!unidadId }
  );

  const { data: bitacora } = trpc.pruebas.bitacora.useQuery(
    { proyectoId: selectedProjectId!, unidadId, limit: 50 },
    { enabled: !!selectedProjectId && !!unidadId && showBitacora }
  );

  // Get unidad info from departamentos query
  const { data: departamentos } = trpc.pruebas.departamentos.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  const unidad = departamentos?.find((d: any) => d.id === unidadId);

  const subirEvidenciaMut = trpc.pruebas.subirEvidencia.useMutation();
  const evaluarMut = trpc.pruebas.evaluar.useMutation({
    onSuccess: () => {
      toast.success("Prueba evaluada correctamente");
      setEvaluarModal(null);
      resetEvaluarForm();
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const resetEvaluarForm = () => {
    setEvaluarEstado("verde");
    setObservacion("");
    setEvidenciaBase64(null);
    setEvidenciaPreview(null);
  };

  const toggleSistema = (sistema: string) => {
    setExpandedSistemas(prev => {
      const next = new Set(prev);
      if (next.has(sistema)) next.delete(sistema);
      else next.add(sistema);
      return next;
    });
  };

  const expandAll = () => {
    if (detalle) {
      setExpandedSistemas(new Set(detalle.map((s: any) => s.sistema)));
    }
  };

  const collapseAll = () => setExpandedSistemas(new Set());

  const handlePhoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  const handleGallery = useCallback(() => {
    galleryInputRef.current?.click();
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen no puede superar 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setEvidenciaPreview(result);
      // Extract base64 without prefix
      setEvidenciaBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleEvaluar = async () => {
    if (!evaluarModal || !selectedProjectId) return;
    if (evaluarEstado === "rojo" && !observacion.trim()) {
      toast.error("La observación es obligatoria cuando la prueba no pasa.");
      return;
    }

    let evidenciaUrl: string | undefined;
    let evidenciaKey: string | undefined;

    // Upload evidence if provided
    if (evidenciaBase64) {
      try {
        const result = await subirEvidenciaMut.mutateAsync({
          proyectoId: selectedProjectId,
          unidadId,
          pruebaId: evaluarModal.pruebaId,
          base64: evidenciaBase64,
        });
        evidenciaUrl = result.url;
        evidenciaKey = result.key;
      } catch {
        toast.error("Error al subir la evidencia");
        return;
      }
    }

    evaluarMut.mutate({
      proyectoId: selectedProjectId,
      unidadId,
      pruebaId: evaluarModal.pruebaId,
      intento: evaluarModal.intento,
      estado: evaluarEstado,
      observacion: observacion.trim() || undefined,
      evidenciaUrl,
      evidenciaKey,
    });
  };

  const openEvaluar = (pruebaId: number, pruebaNombre: string, intento: Intento, estadoActual: Estado) => {
    setEvaluarModal({ pruebaId, pruebaNombre, intento, estadoActual });
    setEvaluarEstado(estadoActual === "pendiente" ? "verde" : estadoActual as "verde" | "rojo" | "na");
    setObservacion("");
    setEvidenciaBase64(null);
    setEvidenciaPreview(null);
  };

  const getEstadoBadge = (estado: Estado | undefined, size: "sm" | "lg" = "sm") => {
    const cls = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[10px]";
    switch (estado) {
      case "verde":
        return (
          <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold ${cls}`}>
            <CheckCircle2 className={size === "lg" ? "w-4 h-4" : "w-3 h-3"} /> Pasa
          </span>
        );
      case "rojo":
        return (
          <span className={`inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 font-semibold ${cls}`}>
            <XCircle className={size === "lg" ? "w-4 h-4" : "w-3 h-3"} /> No pasa
          </span>
        );
      case "na":
        return (
          <span className={`inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-600 font-semibold ${cls}`}>
            <MinusCircle className={size === "lg" ? "w-4 h-4" : "w-3 h-3"} /> N/A
          </span>
        );
      default:
        return (
          <span className={`inline-flex items-center gap-1 rounded-full bg-gray-50 text-gray-400 font-semibold ${cls}`}>
            — Pendiente
          </span>
        );
    }
  };

  const isSupervisor = user?.role === "admin" || user?.role === "superadmin" || user?.role === "supervisor" || user?.role === "jefe_residente";

  if (!selectedProjectId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Selecciona un proyecto.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/pruebas")}
            className="shrink-0 -ml-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#002C63]">Depto {unidad?.nombre || id}</h1>
              {unidad?.nivel && (
                <Badge variant="outline" className="text-xs border-[#002C63]/20 text-[#002C63]/70">
                  N{unidad.nivel}
                </Badge>
              )}
              {unidad?.liberado && (
                <Badge className="bg-emerald-100 text-emerald-700 text-xs border-0">
                  <Shield className="w-3 h-3 mr-0.5" /> Liberado
                </Badge>
              )}
            </div>
            {unidad && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-48">
                  <div
                    className={`h-full rounded-full transition-all ${
                      unidad.liberado ? "bg-emerald-500" : unidad.progreso >= 50 ? "bg-amber-400" : "bg-orange-400"
                    }`}
                    style={{ width: `${unidad.progreso}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">{unidad.progreso}%</span>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProtocolo(true)}
            className="shrink-0 text-xs"
          >
            <FileText className="w-3.5 h-3.5 mr-1" /> Protocolo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBitacora(!showBitacora)}
            className="shrink-0 text-xs"
          >
            <History className="w-3.5 h-3.5 mr-1" /> Log
          </Button>
        </div>

        {/* Quick actions + filter */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs">
            <ChevronDown className="w-3.5 h-3.5 mr-1" /> Expandir todo
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs">
            <ChevronUp className="w-3.5 h-3.5 mr-1" /> Colapsar todo
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            {(["todos", "en_proceso", "con_fallas", "todas_ok", "sin_evaluar"] as const).map((f) => {
              const labels: Record<string, string> = { todos: "Todos", en_proceso: "En proceso", con_fallas: "Con fallas", todas_ok: "Todas ok", sin_evaluar: "Sin evaluar" };
              const colors: Record<string, string> = { todos: "bg-gray-100 text-gray-700", en_proceso: "bg-orange-100 text-orange-700", con_fallas: "bg-red-100 text-red-700", todas_ok: "bg-emerald-100 text-emerald-700", sin_evaluar: "bg-gray-50 text-gray-500" };
              return (
                <button
                  key={f}
                  onClick={() => setFiltroEspecialidad(f)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                    filtroEspecialidad === f ? colors[f] + " ring-1 ring-current" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bitacora panel */}
        {showBitacora && (
          <div className="bg-gray-50 border rounded-xl p-3 mb-4 max-h-60 overflow-y-auto">
            <h3 className="font-semibold text-sm text-[#002C63] mb-2 flex items-center gap-1">
              <History className="w-4 h-4" /> Bitácora de cambios
            </h3>
            {bitacora && bitacora.length > 0 ? (
              <div className="space-y-1.5">
                {bitacora.map((b: any) => (
                  <div key={b.id} className="text-xs bg-white rounded-lg p-2 border border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#002C63]">{b.usuarioNombre}</span>
                      <span className="text-muted-foreground">
                        {new Date(b.creadoAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      {b.accion}: {b.estadoAnterior} → {b.estadoNuevo}
                      {b.observacion && <span className="italic"> — {b.observacion}</span>}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/50 font-mono truncate">
                      #{b.hashActual?.slice(0, 12)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin registros aún.</p>
            )}
          </div>
        )}

        {/* Systems and tests */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-[#02B381]" />
          </div>
        ) : detalle && detalle.length > 0 ? (
          <div className="space-y-3">
            {detalle.map((sistema: any) => {
              const isExpanded = expandedSistemas.has(sistema.sistema);
              const totalPruebas = sistema.pruebas.length;
              const verdes = sistema.pruebas.filter((p: any) =>
                p.intentoFinal?.estado === "verde" || (!p.intentoFinal && p.intento1?.estado === "verde")
              ).length;
              const rojos = sistema.pruebas.filter((p: any) =>
                p.intentoFinal?.estado === "rojo" || (!p.intentoFinal && p.intento1?.estado === "rojo")
              ).length;

              // Determinar color del icono según estado de pruebas
              const evaluadas = sistema.pruebas.filter((p: any) =>
                p.intento1?.estado || p.intentoFinal?.estado
              ).length;
              const todasVerdes = totalPruebas > 0 && verdes === totalPruebas;
              const tieneFallas = rojos > 0;
              const enProceso = evaluadas > 0 && !todasVerdes;
              const sinEvaluar = evaluadas === 0;
              const iconBg = todasVerdes ? 'bg-emerald-500' : tieneFallas ? 'bg-red-500' : enProceso ? 'bg-orange-500' : 'bg-[#002C63]';
              const progressPct = totalPruebas > 0 ? Math.round((verdes / totalPruebas) * 100) : 0;
              const progressBarColor = todasVerdes ? 'bg-emerald-500' : tieneFallas ? 'bg-red-400' : enProceso ? 'bg-orange-400' : 'bg-gray-200';

              // Filtro
              if (filtroEspecialidad === "en_proceso" && !enProceso) return null;
              if (filtroEspecialidad === "con_fallas" && !tieneFallas) return null;
              if (filtroEspecialidad === "todas_ok" && !todasVerdes) return null;
              if (filtroEspecialidad === "sin_evaluar" && !sinEvaluar) return null;

              return (
                <div key={sistema.sistema} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                  {/* System header */}
                  <button
                    onClick={() => toggleSistema(sistema.sistema)}
                    className="w-full flex items-center gap-3 p-3 sm:p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0 transition-colors`}>
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#002C63] text-sm">{sistema.sistema}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          todasVerdes ? 'bg-emerald-100 text-emerald-700' : tieneFallas ? 'bg-red-100 text-red-700' : enProceso ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {verdes}/{totalPruebas} ok
                        </span>
                      </div>
                      {/* Mini progress bar */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`} style={{ width: `${progressPct}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground w-8 text-right">{progressPct}%</span>
                      </div>
                      <div className="flex gap-2 mt-0.5 text-[11px]">
                        <span className="text-muted-foreground">{totalPruebas} pruebas</span>
                        {verdes > 0 && <span className="text-emerald-600">{verdes} ok</span>}
                        {rojos > 0 && <span className="text-red-600">{rojos} fallas</span>}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground/50" />
                    )}
                  </button>

                  {/* Tests list */}
                  {isExpanded && (
                    <div className="border-t border-gray-50">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_80px_80px] sm:grid-cols-[1fr_100px_100px] gap-1 px-3 sm:px-4 py-2 bg-gray-50/50 text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>Prueba</span>
                        <span className="text-center">Intento 1</span>
                        <span className="text-center">Final</span>
                      </div>

                      {sistema.pruebas.map((prueba: any) => {
                        const i1Estado: Estado = prueba.intento1?.estado || "pendiente";
                        const ifEstado: Estado = prueba.intentoFinal?.estado || "pendiente";

                        return (
                          <div
                            key={prueba.id}
                            className="grid grid-cols-[1fr_80px_80px] sm:grid-cols-[1fr_100px_100px] gap-1 px-3 sm:px-4 py-2.5 border-t border-gray-50 items-center"
                          >
                            {/* Test name */}
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-gray-800 leading-tight block truncate">
                                {prueba.nombre}
                              </span>
                              {/* Show evidence and observation icons */}
                              <div className="flex gap-1.5 mt-0.5">
                                {prueba.intento1?.evidenciaUrl && (
                                  <button
                                    onClick={() => setShowEvidencia(prueba.intento1.evidenciaUrl)}
                                    className="text-[10px] text-blue-500 flex items-center gap-0.5"
                                  >
                                    <ImageIcon className="w-3 h-3" /> I1
                                  </button>
                                )}
                                {prueba.intentoFinal?.evidenciaUrl && (
                                  <button
                                    onClick={() => setShowEvidencia(prueba.intentoFinal.evidenciaUrl)}
                                    className="text-[10px] text-blue-500 flex items-center gap-0.5"
                                  >
                                    <ImageIcon className="w-3 h-3" /> IF
                                  </button>
                                )}
                                {(prueba.intento1?.observacion || prueba.intentoFinal?.observacion) && (
                                  <span className="text-[10px] text-muted-foreground italic truncate max-w-32">
                                    {prueba.intentoFinal?.observacion || prueba.intento1?.observacion}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Intento 1 */}
                            <button
                              onClick={() => isSupervisor && openEvaluar(prueba.id, prueba.nombre, "intento_1", i1Estado)}
                              className={`flex justify-center ${isSupervisor ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                              disabled={!isSupervisor}
                            >
                              {getEstadoBadge(i1Estado)}
                            </button>

                            {/* Intento Final */}
                            <button
                              onClick={() => isSupervisor && openEvaluar(prueba.id, prueba.nombre, "intento_final", ifEstado)}
                              className={`flex justify-center ${isSupervisor ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                              disabled={!isSupervisor}
                            >
                              {getEstadoBadge(ifEstado)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No hay pruebas configuradas.</p>
          </div>
        )}
      </div>

      {/* Evaluar Modal */}
      <Dialog open={!!evaluarModal} onOpenChange={(open) => !open && setEvaluarModal(null)}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-[#002C63]">Evaluar Prueba</DialogTitle>
          </DialogHeader>
          {evaluarModal && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-sm">{evaluarModal.pruebaNombre}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {evaluarModal.intento === "intento_1" ? "Intento 1" : "Intento Final"}
                  {evaluarModal.estadoActual !== "pendiente" && (
                    <> · Estado actual: {getEstadoBadge(evaluarModal.estadoActual)}</>
                  )}
                </p>
              </div>

              {/* Estado selection */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Resultado</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setEvaluarEstado("verde")}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                      evaluarEstado === "verde"
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-100 hover:border-emerald-200"
                    }`}
                  >
                    <CheckCircle2 className={`w-6 h-6 ${evaluarEstado === "verde" ? "text-emerald-600" : "text-gray-400"}`} />
                    <span className={`text-xs font-semibold ${evaluarEstado === "verde" ? "text-emerald-700" : "text-gray-500"}`}>
                      Pasa
                    </span>
                  </button>
                  <button
                    onClick={() => setEvaluarEstado("rojo")}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                      evaluarEstado === "rojo"
                        ? "border-red-500 bg-red-50"
                        : "border-gray-100 hover:border-red-200"
                    }`}
                  >
                    <XCircle className={`w-6 h-6 ${evaluarEstado === "rojo" ? "text-red-600" : "text-gray-400"}`} />
                    <span className={`text-xs font-semibold ${evaluarEstado === "rojo" ? "text-red-700" : "text-gray-500"}`}>
                      No pasa
                    </span>
                  </button>
                  <button
                    onClick={() => setEvaluarEstado("na")}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                      evaluarEstado === "na"
                        ? "border-gray-500 bg-gray-50"
                        : "border-gray-100 hover:border-gray-300"
                    }`}
                  >
                    <MinusCircle className={`w-6 h-6 ${evaluarEstado === "na" ? "text-gray-600" : "text-gray-400"}`} />
                    <span className={`text-xs font-semibold ${evaluarEstado === "na" ? "text-gray-700" : "text-gray-500"}`}>
                      N/A
                    </span>
                  </button>
                </div>
              </div>

              {/* Observación */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Observación {evaluarEstado === "rojo" && <span className="text-red-500">*</span>}
                </label>
                <Textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder={evaluarEstado === "rojo" ? "Describe el problema encontrado..." : "Opcional..."}
                  className="h-20 text-sm"
                />
              </div>

              {/* Evidence photo */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Evidencia fotográfica</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onFileChange}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="hidden"
                />
                {evidenciaPreview ? (
                  <div className="relative">
                    <img
                      src={evidenciaPreview}
                      alt="Evidencia"
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      onClick={() => { setEvidenciaBase64(null); setEvidenciaPreview(null); }}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handlePhoto}
                      className="h-20 border-2 border-dashed border-emerald-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-emerald-50 transition-colors"
                    >
                      <Camera className="w-6 h-6 text-emerald-500" />
                      <span className="text-[10px] font-medium text-emerald-700">Tomar Foto</span>
                    </button>
                    <button
                      onClick={handleGallery}
                      className="h-20 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-colors"
                    >
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                      <span className="text-[10px] font-medium text-slate-500">Subir de Galería</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEvaluarModal(null)} size="sm">
              Cancelar
            </Button>
            <Button
              onClick={handleEvaluar}
              disabled={evaluarMut.isPending || subirEvidenciaMut.isPending}
              className="bg-[#02B381] hover:bg-[#029a6e] text-white"
              size="sm"
            >
              {(evaluarMut.isPending || subirEvidenciaMut.isPending) ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Guardando...</>
              ) : (
                "Guardar evaluación"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evidence viewer */}
      <Dialog open={!!showEvidencia} onOpenChange={() => setShowEvidencia(null)}>
        <DialogContent className="max-w-lg p-2">
          {showEvidencia && (
            <img
              src={showEvidencia}
              alt="Evidencia"
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Protocolo Report */}
      <ProtocoloReport
        open={showProtocolo}
        onClose={() => setShowProtocolo(false)}
        unidadId={unidadId}
        unidadNombre={unidad?.nombre || id}
      />
    </DashboardLayout>
  );
}
