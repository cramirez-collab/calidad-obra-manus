import { useState, useRef, useCallback, useMemo } from "react";
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
  Download,
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
  const [pdfExporting, setPdfExporting] = useState(false);

  const exportarPDF = useCallback(() => {
    if (!detalle || !unidad) return;
    setPdfExporting(true);
    try {
      // Build data
      const sistemas = detalle.map((s: any) => {
        const total = s.pruebas.length;
        const verdes = s.pruebas.filter((p: any) => p.intentoFinal?.estado === "verde" || (!p.intentoFinal && p.intento1?.estado === "verde")).length;
        const rojos = s.pruebas.filter((p: any) => p.intentoFinal?.estado === "rojo" || (!p.intentoFinal && p.intento1?.estado === "rojo")).length;
        const evaluadas = s.pruebas.filter((p: any) => p.intento1?.estado || p.intentoFinal?.estado).length;
        const todasOk = total > 0 && verdes === total;
        const estado = todasOk ? "TODAS OK" : rojos > 0 ? "CON FALLAS" : evaluadas > 0 ? "EN PROCESO" : "SIN EVALUAR";
        return { nombre: s.sistema, total, verdes, rojos, evaluadas, estado, pruebas: s.pruebas };
      });

      const resumen = sistemas.reduce((acc: any, s: any) => {
        if (s.estado === "TODAS OK") acc.ok++;
        else if (s.estado === "CON FALLAS") acc.fallas++;
        else if (s.estado === "EN PROCESO") acc.proceso++;
        else acc.sinEval++;
        acc.totalPruebas += s.total;
        acc.totalVerdes += s.verdes;
        acc.totalRojos += s.rojos;
        return acc;
      }, { ok: 0, fallas: 0, proceso: 0, sinEval: 0, totalPruebas: 0, totalVerdes: 0, totalRojos: 0 });

      // Generate HTML for print
      const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reporte Pruebas - Depto ${unidad.nombre}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #333; margin: 20px; }
  h1 { color: #002C63; font-size: 18px; margin-bottom: 4px; }
  h2 { color: #002C63; font-size: 14px; margin: 16px 0 8px; border-bottom: 2px solid #002C63; padding-bottom: 4px; }
  .subtitle { color: #666; font-size: 12px; margin-bottom: 16px; }
  .resumen { display: flex; gap: 12px; margin-bottom: 16px; }
  .resumen-card { flex: 1; text-align: center; padding: 8px; border-radius: 8px; border: 1px solid #ddd; }
  .resumen-card.ok { background: #ecfdf5; border-color: #a7f3d0; }
  .resumen-card.proceso { background: #fff7ed; border-color: #fed7aa; }
  .resumen-card.fallas { background: #fef2f2; border-color: #fecaca; }
  .resumen-card.sin { background: #f9fafb; border-color: #e5e7eb; }
  .resumen-num { font-size: 20px; font-weight: bold; }
  .resumen-label { font-size: 9px; text-transform: uppercase; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #002C63; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
  tr:nth-child(even) { background: #f9fafb; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: bold; }
  .badge-ok { background: #d1fae5; color: #065f46; }
  .badge-falla { background: #fee2e2; color: #991b1b; }
  .badge-proceso { background: #ffedd5; color: #9a3412; }
  .badge-sin { background: #f3f4f6; color: #6b7280; }
  .badge-na { background: #f3f4f6; color: #6b7280; }
  .badge-pendiente { background: #f9fafb; color: #9ca3af; }
  .badge-verde { background: #d1fae5; color: #065f46; }
  .badge-rojo { background: #fee2e2; color: #991b1b; }
  .sistema-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .sistema-icon { width: 20px; height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; }
  .footer { margin-top: 24px; text-align: center; color: #999; font-size: 9px; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { margin: 10px; } }
</style></head><body>
<h1>Reporte de Pruebas - Depto ${unidad.nombre}</h1>
<p class="subtitle">Nivel: ${unidad.nivel || "N/A"} | Progreso: ${unidad.progreso}% | ${unidad.liberado ? "LIBERADO" : "No liberado"} | Generado: ${new Date().toLocaleString("es-MX")}</p>

<div class="resumen">
  <div class="resumen-card ok"><div class="resumen-num" style="color:#065f46">${resumen.ok}</div><div class="resumen-label" style="color:#065f46">Todas ok</div></div>
  <div class="resumen-card proceso"><div class="resumen-num" style="color:#9a3412">${resumen.proceso}</div><div class="resumen-label" style="color:#9a3412">En proceso</div></div>
  <div class="resumen-card fallas"><div class="resumen-num" style="color:#991b1b">${resumen.fallas}</div><div class="resumen-label" style="color:#991b1b">Con fallas</div></div>
  <div class="resumen-card sin"><div class="resumen-num" style="color:#6b7280">${resumen.sinEval}</div><div class="resumen-label" style="color:#6b7280">Sin evaluar</div></div>
</div>

${sistemas.map((s: any) => {
  const bgColor = s.estado === "TODAS OK" ? "#059669" : s.estado === "CON FALLAS" ? "#dc2626" : s.estado === "EN PROCESO" ? "#f97316" : "#002C63";
  const badgeClass = s.estado === "TODAS OK" ? "badge-ok" : s.estado === "CON FALLAS" ? "badge-falla" : s.estado === "EN PROCESO" ? "badge-proceso" : "badge-sin";
  return `
<h2><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${bgColor};margin-right:6px;vertical-align:middle;"></span>${s.nombre} <span class="badge ${badgeClass}">${s.estado}</span> <span style="font-weight:normal;font-size:11px;color:#666;">${s.verdes}/${s.total} ok</span></h2>
<table>
  <tr><th>Prueba</th><th style="width:80px;text-align:center">Intento 1</th><th style="width:80px;text-align:center">Final</th></tr>
  ${s.pruebas.map((p: any) => {
    const i1 = p.intento1?.estado || "pendiente";
    const iF = p.intentoFinal?.estado || "pendiente";
    return `<tr><td>${p.nombre}</td><td style="text-align:center"><span class="badge badge-${i1}">${i1 === "verde" ? "Pasa" : i1 === "rojo" ? "No pasa" : i1 === "na" ? "N/A" : "Pendiente"}</span></td><td style="text-align:center"><span class="badge badge-${iF}">${iF === "verde" ? "Pasa" : iF === "rojo" ? "No pasa" : iF === "na" ? "N/A" : "Pendiente"}</span></td></tr>`;
  }).join("")}
</table>`;
}).join("")}

<div class="footer">Objetiva - Control de Calidad de Obra | Reporte generado automaticamente</div>
</body></html>`;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } finally {
      setPdfExporting(false);
    }
  }, [detalle, unidad]);

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
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/pruebas")}
            className="shrink-0 -ml-2 h-8 w-8"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base sm:text-xl font-bold text-[#002C63] truncate">Depto {unidad?.nombre || id}</h1>
          {unidad?.nivel && (
            <Badge variant="outline" className="text-[10px] sm:text-xs border-[#002C63]/20 text-[#002C63]/70 shrink-0">
              N{unidad.nivel}
            </Badge>
          )}
          {unidad?.liberado && (
            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] sm:text-xs border-0 shrink-0">
              <Shield className="w-3 h-3 mr-0.5" /> Liberado
            </Badge>
          )}
        </div>
        {/* Progress + action buttons */}
        <div className="flex items-center gap-2 mb-3">
          {unidad && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
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
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowProtocolo(true)} className="shrink-0 text-[10px] sm:text-xs h-7 px-2">
              <FileText className="w-3 h-3 sm:mr-1" /><span className="hidden sm:inline">Protocolo</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBitacora(!showBitacora)} className="shrink-0 text-[10px] sm:text-xs h-7 px-2">
              <History className="w-3 h-3 sm:mr-1" /><span className="hidden sm:inline">Log</span>
            </Button>
            <Button variant="outline" size="sm" onClick={exportarPDF} disabled={pdfExporting || !detalle} className="shrink-0 text-[10px] sm:text-xs h-7 px-2">
              {pdfExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 sm:mr-1" />}<span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
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
          <>
          {/* Resumen global */}
          {(() => {
            const resumen = detalle.reduce((acc: any, s: any) => {
              const total = s.pruebas.length;
              const v = s.pruebas.filter((p: any) => p.intentoFinal?.estado === "verde" || (!p.intentoFinal && p.intento1?.estado === "verde")).length;
              const r = s.pruebas.filter((p: any) => p.intentoFinal?.estado === "rojo" || (!p.intentoFinal && p.intento1?.estado === "rojo")).length;
              const ev = s.pruebas.filter((p: any) => p.intento1?.estado || p.intentoFinal?.estado).length;
              const allGreen = total > 0 && v === total;
              if (allGreen) acc.ok++;
              else if (r > 0) acc.fallas++;
              else if (ev > 0) acc.proceso++;
              else acc.sinEval++;
              acc.totalPruebas += total;
              acc.totalVerdes += v;
              acc.totalRojos += r;
              return acc;
            }, { ok: 0, fallas: 0, proceso: 0, sinEval: 0, totalPruebas: 0, totalVerdes: 0, totalRojos: 0 });
            return (
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
                  <div className="text-lg font-bold text-emerald-700">{resumen.ok}</div>
                  <div className="text-[10px] text-emerald-600 font-medium">Todas ok</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5 text-center">
                  <div className="text-lg font-bold text-orange-700">{resumen.proceso}</div>
                  <div className="text-[10px] text-orange-600 font-medium">En proceso</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-center">
                  <div className="text-lg font-bold text-red-700">{resumen.fallas}</div>
                  <div className="text-[10px] text-red-600 font-medium">Con fallas</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-center">
                  <div className="text-lg font-bold text-gray-600">{resumen.sinEval}</div>
                  <div className="text-[10px] text-gray-500 font-medium">Sin evaluar</div>
                </div>
              </div>
            );
          })()}
          <div className="space-y-3">
            {[...detalle].sort((a: any, b: any) => {
              const getPriority = (s: any) => {
                const total = s.pruebas.length;
                const v = s.pruebas.filter((p: any) => p.intentoFinal?.estado === "verde" || (!p.intentoFinal && p.intento1?.estado === "verde")).length;
                const r = s.pruebas.filter((p: any) => p.intentoFinal?.estado === "rojo" || (!p.intentoFinal && p.intento1?.estado === "rojo")).length;
                const ev = s.pruebas.filter((p: any) => p.intento1?.estado || p.intentoFinal?.estado).length;
                if (r > 0) return 0; // fallas primero
                if (ev > 0 && !(total > 0 && v === total)) return 1; // en proceso
                if (ev === 0) return 2; // sin evaluar
                return 3; // todas ok al final
              };
              return getPriority(a) - getPriority(b);
            }).map((sistema: any) => {
              const isExpanded = expandedSistemas.has(sistema.sistema);
              const totalPruebas = sistema.pruebas.length;
              const verdes = sistema.pruebas.filter((p: any) =>
                p.intentoFinal?.estado === "verde" || (!p.intentoFinal && p.intento1?.estado === "verde")
              ).length;
              const rojos = sistema.pruebas.filter((p: any) =>
                p.intentoFinal?.estado === "rojo" || (!p.intentoFinal && p.intento1?.estado === "rojo")
              ).length;

              // Determinar color del icono según estado de pruebas - escala gradual
              const evaluadas = sistema.pruebas.filter((p: any) =>
                p.intento1?.estado || p.intentoFinal?.estado
              ).length;
              const todasVerdes = totalPruebas > 0 && verdes === totalPruebas;
              const tieneFallas = rojos > 0;
              const enProceso = evaluadas > 0 && !todasVerdes;
              const sinEvaluar = evaluadas === 0;
              const progressPct = totalPruebas > 0 ? Math.round((verdes / totalPruebas) * 100) : 0;

              // Escala gradual de color del icono:
              // 0% evaluadas = azul Objetiva (#002C63)
              // 1-25% = naranja claro (#FDBA74)
              // 26-49% = naranja fuerte (#F97316)
              // 50-99% = verde intermedio (#10B981) - >50% de criticas/importantes
              // 100% = verde Objetiva (#02B381)
              let iconBgStyle = '';
              if (todasVerdes) {
                iconBgStyle = 'bg-[#02B381]'; // verde Objetiva - todas hechas
              } else if (sinEvaluar) {
                iconBgStyle = 'bg-[#002C63]'; // azul Objetiva - sin pruebas
              } else if (progressPct >= 50) {
                iconBgStyle = 'bg-emerald-500'; // verde - >50%
              } else if (progressPct >= 25) {
                iconBgStyle = 'bg-orange-500'; // naranja fuerte
              } else {
                iconBgStyle = 'bg-orange-300'; // naranja claro
              }
              const progressBarColor = todasVerdes ? 'bg-[#02B381]' : progressPct >= 50 ? 'bg-emerald-500' : progressPct >= 25 ? 'bg-orange-500' : enProceso ? 'bg-orange-300' : 'bg-gray-200';

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
                    <div className={`w-8 h-8 rounded-lg ${iconBgStyle} flex items-center justify-center shrink-0 transition-colors`}>
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
          </>
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
