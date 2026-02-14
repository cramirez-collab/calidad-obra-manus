import { useState, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BrainCircuit,
  FileText,
  Download,
  Loader2,
  Clock,
  ChevronRight,
  Sparkles,
  History,
  Mail,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";
import { formatDate } from "@/lib/dateFormat";
import { Redirect } from "wouter";

// Markdown renderer simple
function MarkdownContent({ content }: { content: string }) {
  // Convertir markdown básico a HTML
  const html = content
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mt-6 mb-2 text-[#002C63]">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-8 mb-3 text-[#002C63] border-b pb-2">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-[#002C63]">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#002C63]">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 mb-1 list-disc">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 mb-1 list-decimal">$1. $2</li>')
    .replace(/\n\n/g, '</p><p class="mb-3 leading-relaxed text-slate-700">')
    .replace(/\n/g, '<br/>');

  return (
    <div
      className="prose prose-slate max-w-none text-sm sm:text-base"
      dangerouslySetInnerHTML={{ __html: `<p class="mb-3 leading-relaxed text-slate-700">${html}</p>` }}
    />
  );
}

export default function AnalisisIA() {
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const [activeTab, setActiveTab] = useState("generar");
  const [showAnalisis, setShowAnalisis] = useState(false);
  const [currentAnalisis, setCurrentAnalisis] = useState<string>("");
  const [currentTitulo, setCurrentTitulo] = useState<string>("");
  const [showResumen, setShowResumen] = useState(false);
  const [currentResumen, setCurrentResumen] = useState<string>("");
  const [currentResumenTitulo, setCurrentResumenTitulo] = useState<string>("");
  const [selectedReporte, setSelectedReporte] = useState<any>(null);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Historial de reportes
  const { data: historialData, refetch: refetchHistorial } = trpc.analisisIA.historial.useQuery(
    { proyectoId: selectedProjectId!, limit: 50 },
    { enabled: !!selectedProjectId }
  );

  // Mutación: Análisis Profundo
  const generarAnalisis = trpc.analisisIA.generarAnalisis.useMutation({
    onSuccess: (data) => {
      setCurrentAnalisis(data.contenido);
      setCurrentTitulo(`Análisis Profundo v${data.version}`);
      setShowAnalisis(true);
      refetchHistorial();
      toast.success("Análisis profundo generado correctamente");
    },
    onError: (err) => {
      toast.error(`Error al generar análisis: ${err.message}`);
    },
  });

  // Mutación: Resumen Ejecutivo
  const generarResumen = trpc.analisisIA.generarResumen.useMutation({
    onSuccess: (data) => {
      setCurrentResumen(data.resumen);
      setCurrentResumenTitulo(`Resumen Ejecutivo v${data.version}`);
      setShowResumen(true);
      refetchHistorial();
      toast.success("Resumen ejecutivo generado correctamente");
    },
    onError: (err) => {
      toast.error(`Error al generar resumen: ${err.message}`);
    },
  });

  const handleGenerarAnalisis = useCallback(() => {
    if (!selectedProjectId) return;
    generarAnalisis.mutate({ proyectoId: selectedProjectId });
  }, [selectedProjectId, generarAnalisis]);

  const handleGenerarResumen = useCallback(() => {
    if (!selectedProjectId) return;
    generarResumen.mutate({ proyectoId: selectedProjectId });
  }, [selectedProjectId, generarResumen]);

  const handleVerReporte = useCallback((reporte: any) => {
    setSelectedReporte(reporte);
    if (reporte.tipo === "analisis_profundo") {
      setCurrentAnalisis(reporte.contenido);
      setCurrentTitulo(reporte.titulo);
      setShowAnalisis(true);
    } else {
      setCurrentResumen(reporte.resumenEjecutivo || reporte.contenido);
      setCurrentResumenTitulo(reporte.titulo);
      setShowResumen(true);
    }
  }, []);

  const handleDescargarPDF = useCallback(async (reporte: any) => {
    if (reporte.pdfUrl) {
      window.open(reporte.pdfUrl, "_blank");
      return;
    }
    toast.info("Generando PDF... esto puede tomar unos segundos");
    // Generar PDF en el cliente
    try {
      const contenido = reporte.resumenEjecutivo || reporte.contenido;
      const blob = await generarPDFDesdeMarkdown(contenido, reporte.titulo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reporte.titulo.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado");
    } catch (err) {
      toast.error("Error al generar PDF");
    }
  }, []);

  if (!selectedProjectId) {
    return <Redirect to="/seleccionar-proyecto" />;
  }

  const reportes = historialData?.reportes || [];
  const analisisProfundos = reportes.filter((r: any) => r.tipo === "analisis_profundo");
  const resumenesEjecutivos = reportes.filter((r: any) => r.tipo === "resumen_ejecutivo");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#002C63] to-[#4A90D9] flex items-center justify-center shadow-lg">
              <BrainCircuit className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#002C63]">Análisis IA</h1>
              <p className="text-sm text-slate-500">Análisis profundo y resúmenes ejecutivos con inteligencia artificial</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="generar" className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              Generar
            </TabsTrigger>
            <TabsTrigger value="historial" className="gap-1.5">
              <History className="h-4 w-4" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="automatico" className="gap-1.5">
              <Mail className="h-4 w-4" />
              Automático
            </TabsTrigger>
          </TabsList>

          {/* Tab: Generar */}
          <TabsContent value="generar" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card: Análisis Profundo */}
              <Card className="border-2 border-[#002C63]/10 hover:border-[#002C63]/30 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-[#002C63]">
                    <BrainCircuit className="h-5 w-5" />
                    Análisis Profundo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Análisis exhaustivo de todas las bases de datos del proyecto: estadísticas, defectos, empresas, niveles, espacios, participación de usuarios y tendencias.
                  </p>
                  <ul className="text-xs text-slate-500 space-y-1">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#02B381]" />
                      Hallazgos sustentados con datos
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#02B381]" />
                      Análisis por empresa y especialidad
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#02B381]" />
                      Problemas críticos y recomendaciones
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#02B381]" />
                      Evaluación de participación de usuarios
                    </li>
                  </ul>
                  <Button
                    onClick={handleGenerarAnalisis}
                    disabled={generarAnalisis.isPending || !isAdmin}
                    className="w-full bg-[#002C63] hover:bg-[#002C63]/90 text-white"
                  >
                    {generarAnalisis.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analizando datos...
                      </>
                    ) : (
                      <>
                        <BrainCircuit className="h-4 w-4 mr-2" />
                        Generar Análisis Profundo
                      </>
                    )}
                  </Button>
                  {!isAdmin && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Solo administradores pueden generar análisis
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Card: Resumen Ejecutivo */}
              <Card className="border-2 border-[#02B381]/10 hover:border-[#02B381]/30 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-[#02B381]">
                    <FileText className="h-5 w-5" />
                    Resumen Ejecutivo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Resumen conciso de máximo 1 cuartilla con enfoque estratégico y accionable. Ideal para distribución semanal al equipo del proyecto.
                  </p>
                  <ul className="text-xs text-slate-500 space-y-1">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#02B381]" />
                      Máximo 1 cuartilla (500 palabras)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#02B381]" />
                      Hallazgos críticos priorizados
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#02B381]" />
                      Acciones inmediatas para el equipo
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#02B381]" />
                      Descarga en PDF
                    </li>
                  </ul>
                  <Button
                    onClick={handleGenerarResumen}
                    disabled={generarResumen.isPending || !isAdmin}
                    className="w-full bg-[#02B381] hover:bg-[#02B381]/90 text-white"
                  >
                    {generarResumen.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generando resumen...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Generar Resumen Ejecutivo
                      </>
                    )}
                  </Button>
                  {!isAdmin && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Solo administradores pueden generar resúmenes
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Historial */}
          <TabsContent value="historial" className="space-y-4 mt-4">
            {reportes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No hay reportes generados aún</p>
                  <p className="text-xs text-slate-400 mt-1">Genera tu primer análisis o resumen ejecutivo</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {reportes.map((reporte: any) => (
                  <Card key={reporte.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleVerReporte(reporte)}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                            reporte.tipo === "analisis_profundo" 
                              ? "bg-[#002C63]/10" 
                              : "bg-[#02B381]/10"
                          }`}>
                            {reporte.tipo === "analisis_profundo" 
                              ? <BrainCircuit className="h-5 w-5 text-[#002C63]" />
                              : <FileText className="h-5 w-5 text-[#02B381]" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-[#002C63] truncate">{reporte.titulo}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(reporte.createdAt)}
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                v{reporte.version}
                              </Badge>
                              {reporte.enviado && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-[#02B381]">
                                  <Mail className="h-2.5 w-2.5 mr-0.5" />
                                  Enviado
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {reporte.pdfUrl && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDescargarPDF(reporte);
                              }}
                            >
                              <Download className="h-4 w-4 text-slate-500" />
                            </Button>
                          )}
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Automático */}
          <TabsContent value="automatico" className="space-y-4 mt-4">
            <Card className="border-2 border-amber-200 bg-amber-50/50">
              <CardContent className="py-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Mail className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-800">Envío Automático Semanal</h3>
                    <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                      Cada <strong>miércoles a las 6:00 PM</strong> se genera automáticamente un resumen ejecutivo 
                      y se envía por correo electrónico a todos los usuarios del proyecto.
                    </p>
                    <Separator className="my-3 bg-amber-200" />
                    <div className="space-y-2 text-xs text-amber-600">
                      <p className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resumen ejecutivo generado con IA cada semana
                      </p>
                      <p className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Enviado a todos los usuarios activos del proyecto
                      </p>
                      <p className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Incluye PDF adjunto descargable
                      </p>
                      <p className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Historial completo de reportes por fecha y versión
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Últimos envíos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-600">
                  <History className="h-4 w-4" />
                  Últimos Envíos Automáticos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {resumenesEjecutivos.filter((r: any) => r.enviado).length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No hay envíos automáticos registrados aún
                  </p>
                ) : (
                  <div className="space-y-2">
                    {resumenesEjecutivos.filter((r: any) => r.enviado).map((reporte: any) => (
                      <div key={reporte.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium text-[#002C63]">{reporte.titulo}</p>
                          <p className="text-xs text-slate-400">
                            Enviado: {reporte.fechaEnvio ? formatDate(reporte.fechaEnvio) : 'N/A'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleVerReporte(reporte)}
                        >
                          Ver
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal: Análisis Profundo */}
        <Dialog open={showAnalisis} onOpenChange={setShowAnalisis}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#002C63]">
                <BrainCircuit className="h-5 w-5" />
                {currentTitulo}
              </DialogTitle>
            </DialogHeader>
            <Separator />
            <div className="py-4">
              <MarkdownContent content={currentAnalisis} />
            </div>
            <Separator />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(currentAnalisis);
                  toast.success("Copiado al portapapeles");
                }}
              >
                Copiar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const blob = await generarPDFDesdeMarkdown(currentAnalisis, currentTitulo);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${currentTitulo.replace(/\s+/g, "_")}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("PDF descargado");
                  } catch {
                    toast.error("Error al generar PDF");
                  }
                }}
                className="bg-[#002C63]"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal: Resumen Ejecutivo */}
        <Dialog open={showResumen} onOpenChange={setShowResumen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#02B381]">
                <FileText className="h-5 w-5" />
                {currentResumenTitulo}
              </DialogTitle>
            </DialogHeader>
            <Separator />
            <div className="py-4">
              <MarkdownContent content={currentResumen} />
            </div>
            <Separator />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(currentResumen);
                  toast.success("Copiado al portapapeles");
                }}
              >
                Copiar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const blob = await generarPDFDesdeMarkdown(currentResumen, currentResumenTitulo);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${currentResumenTitulo.replace(/\s+/g, "_")}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("PDF descargado");
                  } catch {
                    toast.error("Error al generar PDF");
                  }
                }}
                className="bg-[#02B381]"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

/**
 * Genera un PDF desde contenido markdown usando jsPDF
 */
async function generarPDFDesdeMarkdown(markdown: string, titulo: string): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // Header con branding
  doc.setFillColor(0, 44, 99); // #002C63
  doc.rect(0, 0, pageWidth, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("OBJETIVA QUALITY CONTROL", margin, 10);
  doc.setFontSize(14);
  doc.text(titulo, margin, 19);
  y = 35;

  // Fecha
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`, margin, y);
  y += 8;

  // Línea separadora
  doc.setDrawColor(0, 44, 99);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Procesar contenido markdown línea por línea
  const lines = markdown.split("\n");
  doc.setTextColor(30, 30, 30);

  for (const line of lines) {
    // Check page overflow
    if (y > pageHeight - 25) {
      doc.addPage();
      y = margin;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      y += 3;
      continue;
    }

    // Headers
    if (trimmed.startsWith("### ")) {
      y += 3;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 44, 99);
      const text = trimmed.replace(/^### /, "").replace(/\*\*/g, "");
      const splitText = doc.splitTextToSize(text, maxWidth);
      doc.text(splitText, margin, y);
      y += splitText.length * 5 + 2;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      y += 5;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 44, 99);
      const text = trimmed.replace(/^## /, "").replace(/\*\*/g, "");
      const splitText = doc.splitTextToSize(text, maxWidth);
      doc.text(splitText, margin, y);
      y += splitText.length * 5.5 + 2;
      doc.setDrawColor(2, 179, 129);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 3;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      y += 6;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 44, 99);
      const text = trimmed.replace(/^# /, "").replace(/\*\*/g, "");
      const splitText = doc.splitTextToSize(text, maxWidth);
      doc.text(splitText, margin, y);
      y += splitText.length * 6 + 3;
      continue;
    }

    // Bullet points
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      const text = trimmed.replace(/^[-*] /, "").replace(/\*\*(.*?)\*\*/g, "$1");
      const splitText = doc.splitTextToSize(text, maxWidth - 8);
      // Bullet dot
      doc.setFillColor(2, 179, 129);
      doc.circle(margin + 2, y - 1, 0.8, "F");
      doc.text(splitText, margin + 6, y);
      y += splitText.length * 4 + 1.5;
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s/);
    if (numMatch) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      const text = trimmed.replace(/^\d+\.\s/, "").replace(/\*\*(.*?)\*\*/g, "$1");
      const splitText = doc.splitTextToSize(text, maxWidth - 10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 44, 99);
      doc.text(`${numMatch[1]}.`, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(splitText, margin + 8, y);
      y += splitText.length * 4 + 1.5;
      continue;
    }

    // Regular paragraph
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    const cleanText = trimmed.replace(/\*\*(.*?)\*\*/g, "$1");
    const splitText = doc.splitTextToSize(cleanText, maxWidth);
    doc.text(splitText, margin, y);
    y += splitText.length * 4 + 2;
  }

  // Footer en cada página
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Objetiva Quality Control — ${titulo}`, margin, pageHeight - 8);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 20, pageHeight - 8);
  }

  return doc.output("blob");
}
