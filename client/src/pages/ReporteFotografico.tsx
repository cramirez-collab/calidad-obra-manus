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

  // Generar PDF
  const generatePDF = async () => {
    if (!items || items.length === 0) {
      toast.error("No hay ítems para generar el reporte");
      return;
    }

    setIsGenerating(true);
    
    try {
      // Crear contenido HTML para el PDF
      const logoUrl = "https://objetiva.mx/wp-content/uploads/2023/03/logo-objetiva.png";
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reporte Fotográfico - ObjetivaQC</title>
  <style>
    @page { margin: 1cm; size: A4; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #333; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #002C63; padding-bottom: 10px; margin-bottom: 20px; }
    .logo { height: 40px; }
    .title { color: #002C63; font-size: 18pt; font-weight: bold; }
    .subtitle { color: #666; font-size: 10pt; }
    .stats { display: flex; gap: 20px; margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
    .stat { text-align: center; }
    .stat-value { font-size: 18pt; font-weight: bold; color: #002C63; }
    .stat-label { font-size: 8pt; color: #666; }
    .item { page-break-inside: avoid; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 15px; padding: 10px; }
    .item-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; }
    .item-code { font-weight: bold; color: #002C63; font-size: 12pt; }
    .item-status { padding: 2px 8px; border-radius: 10px; font-size: 8pt; }
    .status-aprobado { background: #d1fae5; color: #065f46; }
    .status-rechazado { background: #fee2e2; color: #991b1b; }
    .status-pendiente { background: #fef3c7; color: #92400e; }
    .item-info { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 9pt; margin-bottom: 10px; }
    .info-label { color: #666; }
    .photos { display: flex; gap: 10px; }
    .photo-container { flex: 1; text-align: center; }
    .photo-label { font-size: 8pt; color: #666; margin-bottom: 5px; }
    .photo { max-width: 100%; max-height: 200px; border: 1px solid #ddd; border-radius: 3px; }
    .no-photo { width: 100%; height: 150px; background: #f5f5f5; display: flex; align-items: center; justify-content: center; color: #999; border-radius: 3px; }
    .footer { margin-top: 20px; text-align: center; font-size: 8pt; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
    .green { color: #02B381; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Reporte Fotográfico${proyectoSeleccionado ? ` - ${proyectoSeleccionado.nombreReporte || proyectoSeleccionado.nombre}` : ''}</div>
      <div class="subtitle">ObjetivaQC - Control de Calidad de Obra</div>
      <div class="subtitle">Generado: ${formatDate(new Date())} | Total: ${items.length} ítems</div>
    </div>
    <img src="${logoUrl}" alt="Objetiva" class="logo" crossorigin="anonymous" />
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${stats.total}</div>
      <div class="stat-label">Total</div>
    </div>
    <div class="stat">
      <div class="stat-value green">${stats.aprobados}</div>
      <div class="stat-label">Aprobados</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: #dc2626;">${stats.rechazados}</div>
      <div class="stat-label">Rechazados</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: #d97706;">${stats.pendientes}</div>
      <div class="stat-label">Pendientes</div>
    </div>
    <div class="stat">
      <div class="stat-value">${stats.conFotos}</div>
      <div class="stat-label">Con Fotos</div>
    </div>
  </div>

  ${items.map(item => `
    <div class="item">
      <div class="item-header">
        <span class="item-code">${item.codigo}</span>
        <span class="item-status ${
          item.status === 'aprobado' ? 'status-aprobado' : 
          item.status === 'rechazado' ? 'status-rechazado' : 'status-pendiente'
        }">${statusLabels[item.status]}</span>
      </div>
      <div class="item-info">
        <div><span class="info-label">Título:</span> ${item.titulo}</div>
        <div><span class="info-label">Fecha Alta:</span> ${formatDate(item.fechaCreacion)}</div>
        <div><span class="info-label">Fecha Aprobación:</span> ${formatDate(item.fechaAprobacion)}</div>
        <div><span class="info-label">Empresa:</span> ${item.empresa?.nombre || '-'}</div>
        <div><span class="info-label">Unidad:</span> ${item.unidad?.nombre || '-'}</div>
        <div><span class="info-label">Especialidad:</span> ${item.especialidad?.nombre || '-'}</div>
        <div><span class="info-label">Residente:</span> ${item.residente?.name || '-'}</div>
        <div><span class="info-label">Aprobado por:</span> ${item.aprobadoPor?.name || '-'}</div>
      </div>
      <div class="photos">
        <div class="photo-container">
          <div class="photo-label">ANTES</div>
          ${item.fotoAntesMarcadaUrl || item.fotoAntesUrl 
            ? `<img src="${item.fotoAntesMarcadaUrl || item.fotoAntesUrl}" class="photo" crossorigin="anonymous" />`
            : '<div class="no-photo">Sin foto</div>'
          }
        </div>
        <div class="photo-container">
          <div class="photo-label">DESPUÉS</div>
          ${item.fotoDespuesUrl 
            ? `<img src="${item.fotoDespuesUrl}" class="photo" crossorigin="anonymous" />`
            : '<div class="no-photo">Sin foto</div>'
          }
        </div>
      </div>
    </div>
  `).join('')}

  <div class="footer">
    <p>ObjetivaQC - Sistema de Control de Calidad de Obra</p>
    <p>© ${new Date().getFullYear()} Objetiva. Todos los derechos reservados.</p>
  </div>
</body>
</html>
      `;

      // Crear blob y descargar
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      // Abrir en nueva ventana para imprimir como PDF
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      }
      
      toast.success("Reporte generado. Use Ctrl+P o Cmd+P para guardar como PDF");
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
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getFullYear()).slice(-2)}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    a.download = `ReporteFotografico-${dateStr}-${timeStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado correctamente");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reporte Fotográfico</h1>
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
                  <p className="text-2xl font-bold">{stats.total}</p>
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
                  <p className="text-2xl font-bold">{stats.aprobados}</p>
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
                  <p className="text-2xl font-bold">{stats.rechazados}</p>
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
                  <p className="text-2xl font-bold">{stats.pendientes}</p>
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
                  <p className="text-2xl font-bold">{stats.conFotos}</p>
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
                    <div className="flex items-center justify-between">
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
                            src={item.fotoAntesMarcadaUrl || item.fotoAntesUrl || ""} 
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
                            src={item.fotoDespuesUrl} 
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
