import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { getImageUrl } from "@/lib/imageUrl";
import { 
  FileImage, 
  Download, 
  Filter, 
  Camera, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Building2,
  MapPin,
  Wrench,
  Calendar,
  FileText,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadPDFBestMethod } from "@/lib/pdfDownload";

const statusLabels: Record<string, string> = {
  pendiente_foto_despues: "Pendiente Foto",
  pendiente_aprobacion: "Pendiente Aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

const statusColors: Record<string, string> = {
  pendiente_foto_despues: "bg-yellow-100 text-yellow-800",
  pendiente_aprobacion: "bg-blue-100 text-blue-800",
  aprobado: "bg-emerald-100 text-emerald-800",
  rechazado: "bg-red-100 text-red-800",
};

export default function ReporteFotografico() {
  const { selectedProjectId } = useProject();
  const { data: proyectos } = trpc.proyectos.list.useQuery();
  
  const [filters, setFilters] = useState({
    proyectoId: "",
    empresaId: "",
    unidadId: "",
    especialidadId: "",
    status: "",
    fechaDesde: "",
    fechaHasta: "",
  });

  // Obtener el proyecto activo para filtrar
  const proyectoIdFiltro = filters.proyectoId && filters.proyectoId !== "all" 
    ? parseInt(filters.proyectoId) 
    : selectedProjectId;
  
  // Obtener datos filtrados por proyecto desde el backend
  const { data: empresas } = trpc.empresas.list.useQuery(
    proyectoIdFiltro ? { proyectoId: proyectoIdFiltro } : undefined
  );
  const { data: unidades } = trpc.unidades.list.useQuery(
    proyectoIdFiltro ? { proyectoId: proyectoIdFiltro } : undefined
  );
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    proyectoIdFiltro ? { proyectoId: proyectoIdFiltro } : undefined
  );
  
  // Obtener nombre del proyecto para el reporte
  const proyectoSeleccionado = proyectos?.find(p => p.id.toString() === filters.proyectoId);

  const [isGenerating, setIsGenerating] = useState(false);

  // Construir filtros para la query
  const queryFilters = useMemo(() => {
    const f: any = {};
    if (filters.proyectoId && filters.proyectoId !== "all") f.proyectoId = parseInt(filters.proyectoId);
    if (filters.empresaId && filters.empresaId !== "all") f.empresaId = parseInt(filters.empresaId);
    if (filters.unidadId && filters.unidadId !== "all") f.unidadId = parseInt(filters.unidadId);
    if (filters.especialidadId && filters.especialidadId !== "all") f.especialidadId = parseInt(filters.especialidadId);
    if (filters.status && filters.status !== "all") f.status = filters.status;
    if (filters.fechaDesde) f.fechaDesde = new Date(filters.fechaDesde);
    if (filters.fechaHasta) f.fechaHasta = new Date(filters.fechaHasta);
    return f;
  }, [filters]);

  const { data: items, isLoading } = trpc.reportes.itemsParaReporte.useQuery(queryFilters);

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  // Estadísticas de los items filtrados
  const stats = useMemo(() => {
    if (!items) return { total: 0, aprobados: 0, rechazados: 0, pendientes: 0, conFotos: 0 };
    return {
      total: items.length,
      aprobados: items.filter(i => i.status === 'aprobado').length,
      rechazados: items.filter(i => i.status === 'rechazado').length,
      pendientes: items.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length,
      conFotos: items.filter(i => i.fotoAntesUrl || i.fotoDespuesUrl).length,
    };
  }, [items]);

  // Generar PDF nativo con jsPDF - se abre en Acrobat Reader
  const generatePDF = async () => {
    if (!items || items.length === 0) {
      toast.error("No hay items para generar el reporte");
      return;
    }

    setIsGenerating(true);
    
    try {
      // Colores corporativos Objetiva
      const AZUL_OBJETIVA: [number, number, number] = [0, 44, 99]; // #002C63
      const VERDE_OBJETIVA: [number, number, number] = [2, 179, 129]; // #02B381
      
      // Crear PDF en orientacion vertical
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;
      
      // Funcion para agregar header en cada pagina
      const addHeader = () => {
        // Linea superior azul
        doc.setFillColor(...AZUL_OBJETIVA);
        doc.rect(0, 0, pageWidth, 3, 'F');
        
        // Titulo
        doc.setFontSize(18);
        doc.setTextColor(...AZUL_OBJETIVA);
        const titulo = proyectoSeleccionado 
          ? `Reporte Fotografico - ${proyectoSeleccionado.nombreReporte || proyectoSeleccionado.nombre}`
          : 'Reporte Fotografico';
        doc.text(titulo, margin, 15);
        
        // Subtitulo
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('ObjetivaQC - Control de Calidad de Obra', margin, 22);
        doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Total: ${items.length} items`, margin, 28);
        
        // Linea separadora
        doc.setDrawColor(...AZUL_OBJETIVA);
        doc.setLineWidth(0.5);
        doc.line(margin, 32, pageWidth - margin, 32);
        
        return 38;
      };
      
      // Funcion para agregar footer en cada pagina
      const addFooter = (pageNum: number, totalPages: number) => {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`ObjetivaQC - objetivaqc.com`, margin, pageHeight - 10);
        doc.text(`Pagina ${pageNum} de ${totalPages}`, pageWidth - margin - 25, pageHeight - 10);
        
        // Linea verde inferior
        doc.setFillColor(...VERDE_OBJETIVA);
        doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');
      };
      
      // Primera pagina - Header
      yPos = addHeader();
      
      // Estadisticas
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 20, 3, 3, 'F');
      
      const statWidth = (pageWidth - 2 * margin) / 5;
      const statsData = [
        { value: stats.total.toString(), label: 'Total', color: AZUL_OBJETIVA },
        { value: stats.aprobados.toString(), label: 'Aprobados', color: VERDE_OBJETIVA },
        { value: stats.rechazados.toString(), label: 'Rechazados', color: [220, 38, 38] },
        { value: stats.pendientes.toString(), label: 'Pendientes', color: [217, 119, 6] },
        { value: stats.conFotos.toString(), label: 'Con Fotos', color: AZUL_OBJETIVA },
      ];
      
      statsData.forEach((stat, i) => {
        const x = margin + i * statWidth + statWidth / 2;
        doc.setFontSize(16);
        doc.setTextColor(...(stat.color as [number, number, number]));
        doc.text(stat.value, x, yPos + 10, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(stat.label, x, yPos + 16, { align: 'center' });
      });
      
      yPos += 28;
      
      // Tabla de items
      const tableData = items.map(item => [
        item.codigo,
        item.titulo?.substring(0, 30) || '-',
        statusLabels[item.status] || item.status,
        item.empresa?.nombre?.substring(0, 15) || '-',
        item.unidad?.nombre?.substring(0, 15) || '-',
        formatDate(item.fechaCreacion),
      ]);
      
      autoTable(doc, {
        head: [['Codigo', 'Titulo', 'Estado', 'Empresa', 'Unidad', 'Fecha']],
        body: tableData,
        startY: yPos,
        margin: { left: margin, right: margin },
        styles: { 
          fontSize: 8, 
          cellPadding: 2,
          overflow: 'linebreak',
        },
        headStyles: { 
          fillColor: AZUL_OBJETIVA as [number, number, number], 
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 45 },
          2: { cellWidth: 28 },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 },
          5: { cellWidth: 20 },
        },
      });
      
      // Agregar footers a todas las paginas
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i, totalPages);
      }
      
      // Descargar PDF nativo - se abre en Acrobat Reader
      const nombreProyecto = proyectoSeleccionado?.nombre?.replace(/[^a-zA-Z0-9]/g, '_') || 'reporte';
      downloadPDFBestMethod(doc, `reporte_fotografico_${nombreProyecto}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
      
      toast.success("PDF descargado - se abrira en Acrobat Reader");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar el reporte");
    } finally {
      setIsGenerating(false);
    }
  };

  // Exportar a CSV
  const exportCSV = () => {
    if (!items || items.length === 0) {
      toast.error("No hay ítems para exportar");
      return;
    }

    const headers = ["Código", "Título", "Estado", "Empresa", "Unidad", "Especialidad", "Residente", "Fecha Creación", "Fecha Aprobación", "Foto Antes", "Foto Después"];
    const rows = items.map(item => [
      item.codigo,
      item.titulo,
      statusLabels[item.status],
      item.empresa?.nombre || "",
      item.unidad?.nombre || "",
      item.especialidad?.nombre || "",
      item.residente?.name || "",
      formatDate(item.fechaCreacion),
      formatDate(item.fechaAprobacion),
      item.fotoAntesUrl ? "Sí" : "No",
      item.fotoDespuesUrl ? "Sí" : "No",
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-fotografico-${formatDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado correctamente");
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Reporte Fotográfico</h1>
            <p className="text-muted-foreground">
              Genera reportes PDF con fotos antes/después y logo Objetiva
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={exportCSV}
              disabled={!items || items.length === 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button 
              onClick={generatePDF}
              disabled={isGenerating || !items || items.length === 0}
              className="bg-[#02B381] hover:bg-[#029970]"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Generar PDF
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros del Reporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Selector de Proyecto */}
            <div className="mb-4 pb-4 border-b">
              <Label className="flex items-center gap-1 mb-2">
                <FileImage className="h-3 w-3" /> Proyecto *
              </Label>
              <Select
                value={filters.proyectoId}
                onValueChange={(value) => setFilters({ 
                  ...filters, 
                  proyectoId: value,
                  empresaId: "",
                  unidadId: "",
                  especialidadId: ""
                })}
              >
                <SelectTrigger className="w-full sm:w-[300px]">
                  <SelectValue placeholder="Seleccionar proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {proyectos?.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {proyectoSeleccionado?.nombreReporte && (
                <p className="text-xs text-muted-foreground mt-1">
                  Nombre en reporte: {proyectoSeleccionado.nombreReporte}
                </p>
              )}
            </div>

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Empresa
                </Label>
                <Select
                  value={filters.empresaId}
                  onValueChange={(value) => setFilters({ ...filters, empresaId: value })}
                  disabled={!filters.proyectoId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {empresas?.map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        {e.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Unidad
                </Label>
                <Select
                  value={filters.unidadId}
                  onValueChange={(value) => setFilters({ ...filters, unidadId: value })}
                  disabled={!filters.proyectoId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {unidades?.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Wrench className="h-3 w-3" /> Especialidad
                </Label>
                <Select
                  value={filters.especialidadId}
                  onValueChange={(value) => setFilters({ ...filters, especialidadId: value })}
                  disabled={!filters.proyectoId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {especialidades?.map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        {e.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters({ ...filters, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendiente_foto_despues">Pendiente Foto</SelectItem>
                    <SelectItem value="pendiente_aprobacion">Pendiente Aprobación</SelectItem>
                    <SelectItem value="aprobado">Aprobado</SelectItem>
                    <SelectItem value="rechazado">Rechazado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Desde
                </Label>
                <input
                  type="date"
                  value={filters.fechaDesde}
                  onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Hasta
                </Label>
                <input
                  type="date"
                  value={filters.fechaHasta}
                  onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas */}
        <div className="grid gap-2 sm:gap-4 grid-cols-3 sm:grid-cols-5">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <FileImage className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Ítems</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold">{stats.aprobados}</p>
                  <p className="text-xs text-muted-foreground">Aprobados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold">{stats.rechazados}</p>
                  <p className="text-xs text-muted-foreground">Rechazados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold">{stats.pendientes}</p>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Camera className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold">{stats.conFotos}</p>
                  <p className="text-xs text-muted-foreground">Con Fotos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vista previa de ítems */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              Vista Previa ({items?.length || 0} ítems)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando ítems...
              </div>
            ) : !items || items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay ítems con los filtros seleccionados
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.slice(0, 9).map((item) => (
                  <div key={item.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-[#002C63]">
                        {item.codigo}
                      </span>
                      <Badge className={statusColors[item.status]}>
                        {statusLabels[item.status]}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium line-clamp-1">{item.titulo}</p>
                    <div className="text-xs text-muted-foreground">
                      {item.empresa?.nombre} | {item.unidad?.nombre}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="aspect-video bg-slate-100 rounded overflow-hidden">
                        {item.fotoAntesMarcadaUrl || item.fotoAntesUrl ? (
                          <img 
                            src={getImageUrl(item.fotoAntesMarcadaUrl || item.fotoAntesUrl || "")} 
                            alt="Antes"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            Sin foto
                          </div>
                        )}
                      </div>
                      <div className="aspect-video bg-slate-100 rounded overflow-hidden">
                        {item.fotoDespuesUrl ? (
                          <img 
                            src={getImageUrl(item.fotoDespuesUrl)} 
                            alt="Después"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            Sin foto
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {items.length > 9 && (
                  <div className="border rounded-lg p-3 flex items-center justify-center bg-slate-50">
                    <p className="text-muted-foreground">
                      +{items.length - 9} ítems más en el reporte
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
