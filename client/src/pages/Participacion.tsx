import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Users,
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Download,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

type SortField = "empresaNombre" | "totalItems" | "diasCumplimiento" | "diasIncumplimiento" | "penalizacion" | "ultimaParticipacion" | "porcentajeCumplimiento";
type SortDir = "asc" | "desc";

function formatDate(dateStr: string): string {
  if (!dateStr) return "Nunca";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(amount);
}

function getDefaultDateRange() {
  const hoy = new Date();
  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);
  return {
    desde: hace30.toISOString().split("T")[0],
    hasta: hoy.toISOString().split("T")[0],
  };
}

export default function Participacion() {
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const defaults = useMemo(() => getDefaultDateRange(), []);
  const [fechaDesde, setFechaDesde] = useState(defaults.desde);
  const [fechaHasta, setFechaHasta] = useState(defaults.hasta);
  const [sortField, setSortField] = useState<SortField>("penalizacion");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { data, isLoading, error } = trpc.participacion.stats.useQuery(
    { proyectoId: selectedProjectId!, fechaDesde, fechaHasta },
    { enabled: !!selectedProjectId }
  );

  const allRows = useMemo(() => {
    if (!data) return [];
    return [...data.empresasActivas, ...data.empresasSinParticipacion];
  }, [data]);

  const sortedRows = useMemo(() => {
    const rows = [...allRows];
    rows.sort((a, b) => {
      let va: any = a[sortField];
      let vb: any = b[sortField];
      if (typeof va === "string") {
        va = va.toLowerCase();
        vb = (vb || "").toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [allRows, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />;
  };

  // PDF generation
  const handleDownloadPdf = async () => {
    if (!data) return;
    setIsGeneratingPdf(true);
    try {
      const res = await fetch("/api/participacion/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyectoId: selectedProjectId,
          fechaDesde,
          fechaHasta,
        }),
      });
      if (!res.ok) throw new Error("Error generando PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `participacion_${fechaDesde}_${fechaHasta}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado");
    } catch (err) {
      toast.error("Error al generar PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const isAdmin = user?.role === "superadmin" || user?.role === "admin" || user?.role === "supervisor";
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Sin permisos para ver esta sección</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#002C63]/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-[#002C63]" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">Participación</h1>
              <p className="text-xs text-muted-foreground">Control de actividad por empresa y residente</p>
            </div>
          </div>
          <Button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf || !data}
            className="gap-2 bg-[#002C63] hover:bg-[#002C63]/90 text-white"
          >
            {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar PDF
          </Button>
        </div>

        {/* Filtros de fecha */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Desde</span>
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="h-8 text-sm w-full sm:w-40"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Hasta</span>
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="h-8 text-sm w-full sm:w-40"
                />
              </div>
              {data && (
                <div className="text-xs text-muted-foreground ml-auto">
                  {data.resumen.diasHabiles} días hábiles en rango
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-l-4 border-l-[#02B381]">
              <CardContent className="p-3 sm:p-4">
                <div className="text-xs text-muted-foreground">Empresas Activas</div>
                <div className="text-xl sm:text-2xl font-bold text-[#02B381]">{data.resumen.empresasActivas}</div>
                <div className="text-[10px] text-muted-foreground">de {data.resumen.totalEmpresas} total</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-3 sm:p-4">
                <div className="text-xs text-muted-foreground">Sin Participación</div>
                <div className="text-xl sm:text-2xl font-bold text-red-600">{data.resumen.empresasInactivas}</div>
                <div className="text-[10px] text-muted-foreground">empresas inactivas</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-3 sm:p-4">
                <div className="text-xs text-muted-foreground">Penalización Total</div>
                <div className="text-xl sm:text-2xl font-bold text-amber-600">{formatMoney(data.resumen.penalizacionTotal)}</div>
                <div className="text-[10px] text-muted-foreground">{formatMoney(data.resumen.penalizacionPorDia)}/día incumplido</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-[#002C63]">
              <CardContent className="p-3 sm:p-4">
                <div className="text-xs text-muted-foreground">Mínimo Requerido</div>
                <div className="text-xl sm:text-2xl font-bold text-[#002C63]">{data.resumen.minimoItemsDia}</div>
                <div className="text-[10px] text-muted-foreground">ítems/día por empresa</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              Error: {error.message}
            </CardContent>
          </Card>
        )}

        {/* Tabla principal - Desktop */}
        {data && sortedRows.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#002C63]" />
                Ranking de Participación
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-xs">#</th>
                      <th className="text-left p-3 font-medium text-xs cursor-pointer select-none" onClick={() => handleSort("empresaNombre")}>
                        <span className="flex items-center gap-1">Empresa / Residente <SortIcon field="empresaNombre" /></span>
                      </th>
                      <th className="text-center p-3 font-medium text-xs cursor-pointer select-none" onClick={() => handleSort("totalItems")}>
                        <span className="flex items-center justify-center gap-1">Ítems <SortIcon field="totalItems" /></span>
                      </th>
                      <th className="text-center p-3 font-medium text-xs cursor-pointer select-none" onClick={() => handleSort("porcentajeCumplimiento")}>
                        <span className="flex items-center justify-center gap-1">Cumplimiento <SortIcon field="porcentajeCumplimiento" /></span>
                      </th>
                      <th className="text-center p-3 font-medium text-xs cursor-pointer select-none" onClick={() => handleSort("diasCumplimiento")}>
                        <span className="flex items-center justify-center gap-1">Días OK <SortIcon field="diasCumplimiento" /></span>
                      </th>
                      <th className="text-center p-3 font-medium text-xs cursor-pointer select-none" onClick={() => handleSort("diasIncumplimiento")}>
                        <span className="flex items-center justify-center gap-1">Días Falta <SortIcon field="diasIncumplimiento" /></span>
                      </th>
                      <th className="text-center p-3 font-medium text-xs cursor-pointer select-none" onClick={() => handleSort("ultimaParticipacion")}>
                        <span className="flex items-center justify-center gap-1">Última <SortIcon field="ultimaParticipacion" /></span>
                      </th>
                      <th className="text-right p-3 font-medium text-xs cursor-pointer select-none" onClick={() => handleSort("penalizacion")}>
                        <span className="flex items-center justify-end gap-1">Penalización <SortIcon field="penalizacion" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, idx) => {
                      const isZero = row.totalItems === 0;
                      const isCritical = row.porcentajeCumplimiento < 30;
                      const isWarning = row.porcentajeCumplimiento >= 30 && row.porcentajeCumplimiento < 70;
                      return (
                        <tr
                          key={`${row.empresaId}-${row.residenteId}`}
                          className={`border-b transition-colors ${isZero ? "bg-red-50/50" : isCritical ? "bg-amber-50/30" : "hover:bg-muted/30"}`}
                        >
                          <td className="p-3 text-muted-foreground text-xs">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-medium text-sm">{row.empresaNombre}</div>
                            <div className="text-xs text-muted-foreground">{row.residenteNombre}</div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-semibold">{row.totalItems}</span>
                            <div className="text-[10px] text-muted-foreground">{row.promedioDiario}/día</div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    row.porcentajeCumplimiento >= 70 ? "bg-[#02B381]" :
                                    row.porcentajeCumplimiento >= 30 ? "bg-amber-500" : "bg-red-500"
                                  }`}
                                  style={{ width: `${row.porcentajeCumplimiento}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium ${
                                row.porcentajeCumplimiento >= 70 ? "text-[#02B381]" :
                                row.porcentajeCumplimiento >= 30 ? "text-amber-600" : "text-red-600"
                              }`}>
                                {row.porcentajeCumplimiento}%
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                              {row.diasCumplimiento}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={`text-xs ${
                              row.diasIncumplimiento > 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-500"
                            }`}>
                              {row.diasIncumplimiento}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-xs ${row.diasSinParticipar > 7 ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                              {formatDate(row.ultimaParticipacion)}
                            </span>
                            {row.diasSinParticipar > 0 && (
                              <div className={`text-[10px] ${row.diasSinParticipar > 7 ? "text-red-500" : "text-muted-foreground"}`}>
                                hace {row.diasSinParticipar}d
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`font-semibold text-sm ${row.penalizacion > 0 ? "text-red-600" : "text-green-600"}`}>
                              {row.penalizacion > 0 ? formatMoney(row.penalizacion) : "$0"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 border-t-2">
                      <td colSpan={2} className="p-3 font-semibold text-sm">TOTAL</td>
                      <td className="p-3 text-center font-semibold">{allRows.reduce((s, r) => s + r.totalItems, 0)}</td>
                      <td className="p-3 text-center">
                        <span className="text-xs font-medium text-muted-foreground">
                          {allRows.length > 0 ? Math.round(allRows.reduce((s, r) => s + r.porcentajeCumplimiento, 0) / allRows.length) : 0}% prom
                        </span>
                      </td>
                      <td className="p-3 text-center font-semibold text-green-700">{allRows.reduce((s, r) => s + r.diasCumplimiento, 0)}</td>
                      <td className="p-3 text-center font-semibold text-red-700">{allRows.reduce((s, r) => s + r.diasIncumplimiento, 0)}</td>
                      <td className="p-3"></td>
                      <td className="p-3 text-right font-bold text-red-700 text-base">
                        {formatMoney(data.resumen.penalizacionTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {sortedRows.map((row, idx) => {
                  const key = `${row.empresaId}-${row.residenteId}`;
                  const isExpanded = expandedRow === key;
                  return (
                    <div
                      key={key}
                      className={`p-3 ${row.totalItems === 0 ? "bg-red-50/50" : ""}`}
                      onClick={() => setExpandedRow(isExpanded ? null : key)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-5">{idx + 1}</span>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{row.empresaNombre}</div>
                              <div className="text-xs text-muted-foreground truncate">{row.residenteNombre}</div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className={`font-semibold text-sm ${row.penalizacion > 0 ? "text-red-600" : "text-green-600"}`}>
                            {row.penalizacion > 0 ? formatMoney(row.penalizacion) : "$0"}
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  row.porcentajeCumplimiento >= 70 ? "bg-[#02B381]" :
                                  row.porcentajeCumplimiento >= 30 ? "bg-amber-500" : "bg-red-500"
                                }`}
                                style={{ width: `${row.porcentajeCumplimiento}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{row.porcentajeCumplimiento}%</span>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Ítems:</span>{" "}
                            <span className="font-medium">{row.totalItems}</span>
                            <span className="text-muted-foreground ml-1">({row.promedioDiario}/día)</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Última:</span>{" "}
                            <span className={row.diasSinParticipar > 7 ? "text-red-600 font-medium" : ""}>
                              {formatDate(row.ultimaParticipacion)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Días OK:</span>{" "}
                            <span className="text-green-700 font-medium">{row.diasCumplimiento}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Días Falta:</span>{" "}
                            <span className="text-red-700 font-medium">{row.diasIncumplimiento}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Mobile total */}
                <div className="p-3 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">TOTAL PENALIZACIÓN</span>
                    <span className="font-bold text-red-700 text-base">{data ? formatMoney(data.resumen.penalizacionTotal) : "$0"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reglas */}
        {data && (
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Regla de participación:</strong> Cada empresa-residente debe registrar mínimo <strong>{data.resumen.minimoItemsDia} ítems por día hábil</strong> (lunes a viernes).</p>
                  <p><strong>Penalización:</strong> {formatMoney(data.resumen.penalizacionPorDia)} por cada día hábil que no se cumpla el mínimo.</p>
                  <p><strong>Período evaluado:</strong> {formatDate(data.resumen.fechaDesde)} al {formatDate(data.resumen.fechaHasta)} ({data.resumen.diasHabiles} días hábiles).</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {data && sortedRows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No hay datos de participación en el rango seleccionado</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
