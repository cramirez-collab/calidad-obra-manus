import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ZoomableLightbox } from "@/components/ZoomableLightbox";
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
  Loader2,
  Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { openPDFPreview } from "@/lib/pdfDownload";
import { Switch } from "@/components/ui/switch";

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
  const { data: proyectos } = trpc.proyectos.list.useQuery(undefined, { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 });
  
  const [filters, setFilters] = useState({
    proyectoId: "",
    empresaId: "",
    unidadId: "",
    especialidadId: "",
    status: "",
    fechaDesde: "",
    fechaHasta: "",
  });

  // Opción para incluir fotos en el PDF
  const [incluirFotos, setIncluirFotos] = useState(true);

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
  const [generationProgress, setGenerationProgress] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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

  // Función para cargar imagen como base64 para jsPDF
  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      // Obtener la URL correcta
      const imageUrl = getImageUrl(url);
      if (!imageUrl) return null;
      
      // Si ya es base64, devolverlo directamente
      if (imageUrl.startsWith('data:image')) {
        return imageUrl;
      }
      
      // Cargar la imagen
      const response = await fetch(imageUrl, { 
        credentials: 'include',
        cache: 'no-cache'
      });
      
      if (!response.ok) return null;
      
      const blob = await response.blob();
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading image:', error);
      return null;
    }
  };

  // Generar PDF con fotos
  const generatePDFWithPhotos = async () => {
    if (!items || items.length === 0) {
      toast.error("No hay items para generar el reporte");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    
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
      
      // Función para agregar header en cada página
      const addHeader = () => {
        // Línea superior azul
        doc.setFillColor(...AZUL_OBJETIVA);
        doc.rect(0, 0, pageWidth, 3, 'F');
        
        // Título
        doc.setFontSize(18);
        doc.setTextColor(...AZUL_OBJETIVA);
        const titulo = proyectoSeleccionado 
          ? `Reporte Fotografico - ${proyectoSeleccionado.nombreReporte || proyectoSeleccionado.nombre}`
          : 'Reporte Fotografico';
        doc.text(titulo, margin, 15);
        
        // Subtítulo
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('ObjetivaQC - Control de Calidad de Obra', margin, 22);
        doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Total: ${items.length} items`, margin, 28);
        
        // Línea separadora
        doc.setDrawColor(...AZUL_OBJETIVA);
        doc.setLineWidth(0.5);
        doc.line(margin, 32, pageWidth - margin, 32);
        
        return 38;
      };
      
      // Función para agregar footer en cada página
      const addFooter = (pageNum: number, totalPages: number) => {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`ObjetivaQC - objetivaqc.com`, margin, pageHeight - 10);
        doc.text(`Pagina ${pageNum} de ${totalPages}`, pageWidth - margin - 25, pageHeight - 10);
        
        // Línea verde inferior
        doc.setFillColor(...VERDE_OBJETIVA);
        doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');
      };
      
      // Primera página - Header
      yPos = addHeader();
      
      // Estadísticas
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 20, 3, 3, 'F');
      
      const statWidth = (pageWidth - 2 * margin) / 5;
      const statsData = [
        { value: stats.total.toString(), label: 'Total', color: AZUL_OBJETIVA },
        { value: stats.aprobados.toString(), label: 'Aprobados', color: VERDE_OBJETIVA },
        { value: stats.rechazados.toString(), label: 'Rechazados', color: [220, 38, 38] as [number, number, number] },
        { value: stats.pendientes.toString(), label: 'Pendientes', color: [217, 119, 6] as [number, number, number] },
        { value: stats.conFotos.toString(), label: 'Con Fotos', color: AZUL_OBJETIVA },
      ];
      
      statsData.forEach((stat, i) => {
        const x = margin + i * statWidth + statWidth / 2;
        doc.setFontSize(16);
        doc.setTextColor(...stat.color);
        doc.text(stat.value, x, yPos + 10, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(stat.label, x, yPos + 16, { align: 'center' });
      });
      
      yPos += 28;

      if (incluirFotos) {
        // ========== MODO CON FOTOS ==========
        // Generar páginas con fotos para cada ítem
        const itemsConFotos = items.filter(item => item.fotoAntesUrl || item.fotoDespuesUrl);
        
        if (itemsConFotos.length === 0) {
          // Si no hay fotos, mostrar tabla simple
          toast.info("No hay ítems con fotos, generando tabla simple");
        } else {
          // Agregar página de índice primero
          doc.setFontSize(12);
          doc.setTextColor(...AZUL_OBJETIVA);
          doc.text('Indice de Items con Fotos', margin, yPos);
          yPos += 8;
          
          // Tabla de índice
          const indexData = itemsConFotos.map((item, idx) => [
            (idx + 1).toString(),
            item.codigo,
            item.titulo?.substring(0, 35) || '-',
            statusLabels[item.status] || item.status,
            item.fotoAntesUrl ? 'Si' : 'No',
            item.fotoDespuesUrl ? 'Si' : 'No',
          ]);
          
          autoTable(doc, {
            head: [['#', 'Codigo', 'Titulo', 'Estado', 'Antes', 'Despues']],
            body: indexData,
            startY: yPos,
            margin: { left: margin, right: margin },
            styles: { 
              fontSize: 7, 
              cellPadding: 2,
              overflow: 'linebreak',
              lineWidth: 0.1,
              minCellHeight: 6,
            },
            headStyles: { 
              fillColor: AZUL_OBJETIVA, 
              textColor: 255,
              fontStyle: 'bold',
              minCellHeight: 8,
            },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            columnStyles: {
              0: { cellWidth: 10 },
              1: { cellWidth: 22 },
              2: { cellWidth: 60 },
              3: { cellWidth: 28 },
              4: { cellWidth: 15 },
              5: { cellWidth: 15 },
            },
          });
          
          // Generar páginas individuales con fotos
          for (let i = 0; i < itemsConFotos.length; i++) {
            const item = itemsConFotos[i];
            setGenerationProgress(Math.round(((i + 1) / itemsConFotos.length) * 100));
            
            // Nueva página para cada ítem
            doc.addPage();
            yPos = addHeader();
            
            // Información del ítem
            doc.setFillColor(245, 245, 245);
            doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 35, 3, 3, 'F');
            
            // Código y título
            doc.setFontSize(14);
            doc.setTextColor(...AZUL_OBJETIVA);
            doc.text(`${item.codigo} - #${item.numeroInterno || '-'}`, margin + 5, yPos + 8);
            
            doc.setFontSize(10);
            doc.setTextColor(50, 50, 50);
            const tituloTruncado = item.titulo && item.titulo.length > 60 
              ? item.titulo.substring(0, 60) + '...' 
              : (item.titulo || '-');
            doc.text(tituloTruncado, margin + 5, yPos + 15);
            
            // Estado con color
            const statusColor = item.status === 'aprobado' ? VERDE_OBJETIVA 
              : item.status === 'rechazado' ? [220, 38, 38] as [number, number, number]
              : AZUL_OBJETIVA;
            doc.setFillColor(...statusColor);
            doc.roundedRect(pageWidth - margin - 35, yPos + 3, 30, 8, 2, 2, 'F');
            doc.setFontSize(7);
            doc.setTextColor(255, 255, 255);
            doc.text(statusLabels[item.status] || item.status, pageWidth - margin - 20, yPos + 8, { align: 'center' });
            
            // Detalles
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            const detalles = [
              `Empresa: ${item.empresa?.nombre || '-'}`,
              `Unidad: ${item.unidad?.nombre || '-'}`,
              `Especialidad: ${item.especialidad?.nombre || '-'}`,
              `Fecha: ${formatDate(item.fechaCreacion)}`,
            ];
            doc.text(detalles.join('  |  '), margin + 5, yPos + 23);
            
            // Trazabilidad completa
            const trazabilidad = [];
            if (item.creadoPorNombre) trazabilidad.push(`Creado: ${item.creadoPorNombre.split(' ')[0]}`);
            if (item.asignadoANombre) trazabilidad.push(`Asignado: ${item.asignadoANombre.split(' ')[0]}`);
            if (item.aprobadoPorNombre && (item.status === 'aprobado' || item.status === 'rechazado')) {
              trazabilidad.push(`${item.status === 'aprobado' ? 'Aprobado' : 'Rechazado'}: ${item.aprobadoPorNombre.split(' ')[0]}`);
            }
            if (item.cerradoPorNombre && item.fechaCierre) trazabilidad.push(`Cerrado: ${item.cerradoPorNombre.split(' ')[0]}`);
            
            if (trazabilidad.length > 0) {
              doc.setTextColor(2, 179, 129); // Verde Objetiva
              doc.text(`Trazabilidad: ${trazabilidad.join(' > ')}`, margin + 5, yPos + 30);
            } else if (item.ubicacionDetalle) {
              doc.text(`Ubicacion: ${item.ubicacionDetalle}`, margin + 5, yPos + 30);
            }
            
            yPos += 42;
            
            // Área de fotos
            const fotoWidth = (pageWidth - 2 * margin - 10) / 2; // Dos fotos lado a lado
            const fotoHeight = 90; // Altura fija para las fotos
            
            // Cargar fotos desde el servidor (BD base64 o S3 firmado)
            let fotoAntesBase64: string | null = null;
            let fotoDespuesBase64: string | null = null;
            
            try {
              const fotosResponse = await fetch(`/api/items/${item.id}/fotos-pdf`);
              if (fotosResponse.ok) {
                const fotosData = await fotosResponse.json();
                fotoAntesBase64 = fotosData.fotoAntesMarcada || fotosData.fotoAntes;
                fotoDespuesBase64 = fotosData.fotoDespues;
              } else {
                // Fallback
                if (item.fotoAntesUrl) fotoAntesBase64 = await loadImageAsBase64(item.fotoAntesUrl);
                if (item.fotoDespuesUrl) fotoDespuesBase64 = await loadImageAsBase64(item.fotoDespuesUrl);
              }
            } catch {
              if (item.fotoAntesUrl) fotoAntesBase64 = await loadImageAsBase64(item.fotoAntesUrl);
              if (item.fotoDespuesUrl) fotoDespuesBase64 = await loadImageAsBase64(item.fotoDespuesUrl);
            }
            
            // Dibujar contenedores de fotos
            // Foto ANTES
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.5);
            doc.roundedRect(margin, yPos, fotoWidth, fotoHeight + 15, 3, 3, 'S');
            
            // Etiqueta ANTES
            doc.setFillColor(...AZUL_OBJETIVA);
            doc.roundedRect(margin, yPos, fotoWidth, 10, 3, 3, 'F');
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);
            doc.text('FOTO ANTES', margin + fotoWidth / 2, yPos + 7, { align: 'center' });
            
            if (fotoAntesBase64) {
              try {
                doc.addImage(fotoAntesBase64, 'JPEG', margin + 2, yPos + 12, fotoWidth - 4, fotoHeight - 2, undefined, 'MEDIUM');
              } catch (e) {
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text('Error al cargar imagen', margin + fotoWidth / 2, yPos + fotoHeight / 2 + 10, { align: 'center' });
              }
            } else {
              doc.setFontSize(8);
              doc.setTextColor(150, 150, 150);
              doc.text('Sin foto', margin + fotoWidth / 2, yPos + fotoHeight / 2 + 10, { align: 'center' });
            }
            
            // Foto DESPUÉS
            const fotoDespuesX = margin + fotoWidth + 10;
            doc.setDrawColor(200, 200, 200);
            doc.roundedRect(fotoDespuesX, yPos, fotoWidth, fotoHeight + 15, 3, 3, 'S');
            
            // Etiqueta DESPUÉS
            doc.setFillColor(...VERDE_OBJETIVA);
            doc.roundedRect(fotoDespuesX, yPos, fotoWidth, 10, 3, 3, 'F');
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);
            doc.text('FOTO DESPUES', fotoDespuesX + fotoWidth / 2, yPos + 7, { align: 'center' });
            
            if (fotoDespuesBase64) {
              try {
                doc.addImage(fotoDespuesBase64, 'JPEG', fotoDespuesX + 2, yPos + 12, fotoWidth - 4, fotoHeight - 2, undefined, 'MEDIUM');
              } catch (e) {
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text('Error al cargar imagen', fotoDespuesX + fotoWidth / 2, yPos + fotoHeight / 2 + 10, { align: 'center' });
              }
            } else {
              doc.setFontSize(8);
              doc.setTextColor(150, 150, 150);
              doc.text('Sin foto', fotoDespuesX + fotoWidth / 2, yPos + fotoHeight / 2 + 10, { align: 'center' });
            }
            
            yPos += fotoHeight + 20;
            
            // Comentarios si existen
            if (item.comentarioResidente || item.comentarioSupervisor) {
              doc.setFillColor(250, 250, 250);
              doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 30, 3, 3, 'F');
              
              doc.setFontSize(8);
              doc.setTextColor(...AZUL_OBJETIVA);
              doc.text('Comentarios:', margin + 5, yPos + 7);
              
              doc.setTextColor(80, 80, 80);
              if (item.comentarioResidente) {
                const comentario = item.comentarioResidente.length > 100 
                  ? item.comentarioResidente.substring(0, 100) + '...'
                  : item.comentarioResidente;
                doc.text(`Residente: ${comentario}`, margin + 5, yPos + 14);
              }
              if (item.comentarioSupervisor) {
                const comentario = item.comentarioSupervisor.length > 100 
                  ? item.comentarioSupervisor.substring(0, 100) + '...'
                  : item.comentarioSupervisor;
                doc.text(`Supervisor: ${comentario}`, margin + 5, yPos + 21);
              }
            }
          }
        }
      } else {
        // ========== MODO SIN FOTOS (TABLA SIMPLE) ==========
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
            cellPadding: 3,
            overflow: 'linebreak',
            lineWidth: 0.1,
            minCellHeight: 8,
          },
          headStyles: { 
            fillColor: AZUL_OBJETIVA, 
            textColor: 255,
            fontStyle: 'bold',
            minCellHeight: 10,
          },
          alternateRowStyles: { fillColor: [250, 250, 250] },
          columnStyles: {
            0: { cellWidth: 24 },
            1: { cellWidth: 42 },
            2: { cellWidth: 28 },
            3: { cellWidth: 28 },
            4: { cellWidth: 28 },
            5: { cellWidth: 22 },
          },
        });
      }
      
      // Agregar footers a todas las páginas
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i, totalPages);
      }
      
      // Descargar PDF
      const nombreProyecto = proyectoSeleccionado?.nombre?.replace(/[^a-zA-Z0-9]/g, '_') || 'reporte';
      const suffix = incluirFotos ? '_con_fotos' : '';
      openPDFPreview(doc);
      
      toast.success(`PDF generado con ${totalPages} paginas`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar el reporte");
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
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
              Genera reportes PDF con fotos antes/después
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {/* Toggle para incluir fotos */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
              <ImageIcon className="h-4 w-4 text-slate-600" />
              <Label htmlFor="incluir-fotos" className="text-sm cursor-pointer">
                Incluir fotos
              </Label>
              <Switch
                id="incluir-fotos"
                checked={incluirFotos}
                onCheckedChange={setIncluirFotos}
              />
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
                onClick={generatePDFWithPhotos}
                disabled={isGenerating || !items || items.length === 0}
                className="bg-[#02B381] hover:bg-[#029970]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {generationProgress > 0 ? `${generationProgress}%` : 'Generando...'}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Generar PDF
                  </>
                )}
              </Button>
            </div>
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
                <Label className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Estado
                </Label>
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

              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Fecha Desde
                </Label>
                <input
                  type="date"
                  value={filters.fechaDesde}
                  onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-[#002C63]">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-[#02B381]">{stats.aprobados}</div>
              <div className="text-xs text-muted-foreground">Aprobados</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.rechazados}</div>
              <div className="text-xs text-muted-foreground">Rechazados</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.pendientes}</div>
              <div className="text-xs text-muted-foreground">Pendientes</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm col-span-2 sm:col-span-1">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-[#002C63]">{stats.conFotos}</div>
              <div className="text-xs text-muted-foreground">Con Fotos</div>
            </CardContent>
          </Card>
        </div>

        {/* Vista previa de ítems */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4" />
              Vista Previa ({items?.length || 0} ítems)
              {incluirFotos && (
                <Badge variant="secondary" className="ml-2">
                  <ImageIcon className="h-3 w-3 mr-1" />
                  Con fotos
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#02B381]" />
              </div>
            ) : !items || items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileImage className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecciona un proyecto y aplica filtros para ver los ítems</p>
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
                    <p className="text-sm truncate">{item.titulo}</p>
                    <div className="flex gap-2">
                      {item.fotoAntesUrl ? (
                        <div 
                          className="h-16 w-16 rounded overflow-hidden bg-slate-100 cursor-pointer ring-1 ring-transparent hover:ring-[#02B381] transition-all"
                          onClick={() => setLightboxUrl(getImageUrl(item.fotoAntesUrl))}
                        >
                          <img 
                            src={getImageUrl(item.fotoAntesUrl)} 
                            alt="Antes" 
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded bg-slate-100 flex items-center justify-center">
                          <Camera className="h-6 w-6 text-slate-400" />
                        </div>
                      )}
                      {item.fotoDespuesUrl ? (
                        <div 
                          className="h-16 w-16 rounded overflow-hidden bg-slate-100 cursor-pointer ring-1 ring-transparent hover:ring-[#02B381] transition-all"
                          onClick={() => setLightboxUrl(getImageUrl(item.fotoDespuesUrl))}
                        >
                          <img 
                            src={getImageUrl(item.fotoDespuesUrl)} 
                            alt="Después" 
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded bg-slate-100 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.empresa?.nombre} • {item.unidad?.nombre}
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
      {/* Lightbox */}
      {lightboxUrl && (
        <ZoomableLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </DashboardLayout>
  );
}
