import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useLocation } from "wouter";
import { 
  ArrowLeft,
  Download,
  Building2,
  Image as ImageIcon
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadPDFBestMethod } from "@/lib/pdfDownload";
import { toast } from "sonner";

type UnidadPanoramica = {
  id: number;
  nombre: string;
  codigo: string | null;
  nivel: number;
  orden: number;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  estado: 'completado' | 'rechazado' | 'pendiente' | 'sin_items';
  items: {
    total: number;
    aprobados: number;
    rechazados: number;
    pendientes: number;
  };
  porcentaje: number;
};

export default function StackingPDF() {
  const [, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  const diagramRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  
  const { data: unidades, isLoading } = trpc.unidades.panoramica.useQuery(
    { proyectoId: selectedProjectId || 0 },
    { enabled: !!selectedProjectId }
  );

  const { data: proyectos } = trpc.proyectos.list.useQuery(undefined, { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 });
  const proyecto = proyectos?.find(p => p.id === selectedProjectId);
  const proyectoNombre = proyecto?.nombre || 'Proyecto';

  // Agrupar unidades por nivel - ordenado de MAYOR a MENOR (edificio visual)
  const celdasPorNivel = useMemo(() => {
    if (!unidades) return new Map<number, UnidadPanoramica[]>();
    
    const grouped = new Map<number, UnidadPanoramica[]>();
    
    (unidades as UnidadPanoramica[]).forEach((unidad: UnidadPanoramica) => {
      const nivel = unidad.nivel || 1;
      if (!grouped.has(nivel)) {
        grouped.set(nivel, []);
      }
      grouped.get(nivel)!.push(unidad);
    });
    
    grouped.forEach((celdas, nivel) => {
      celdas.sort((a, b) => (a.orden || 0) - (b.orden || 0));
      grouped.set(nivel, celdas);
    });
    
    // Ordenar niveles DESCENDENTE (mayor arriba) para visual de edificio
    return new Map(Array.from(grouped.entries()).sort((a, b) => b[0] - a[0]));
  }, [unidades]);

  // Estadísticas generales
  const estadisticas = useMemo(() => {
    if (!unidades) return { total: 0, completadas: 0, pendientes: 0, rechazadas: 0, sinItems: 0 };
    
    return {
      total: unidades.length,
      completadas: unidades.filter((u: UnidadPanoramica) => u.estado === 'completado').length,
      pendientes: unidades.filter((u: UnidadPanoramica) => u.estado === 'pendiente').length,
      rechazadas: unidades.filter((u: UnidadPanoramica) => u.estado === 'rechazado').length,
      sinItems: unidades.filter((u: UnidadPanoramica) => u.estado === 'sin_items').length,
    };
  }, [unidades]);

  const maxUnidadesPorNivel = useMemo(() => {
    let max = 0;
    celdasPorNivel.forEach((celdas) => {
      if (celdas.length > max) max = celdas.length;
    });
    return max;
  }, [celdasPorNivel]);

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'completado': return '#10b981';
      case 'rechazado': return '#ef4444';
      case 'pendiente': return '#f59e0b';
      default: return '#d1d5db';
    }
  };

  const getEstadoTextColor = (estado: string) => {
    return estado === 'sin_items' ? '#374151' : '#ffffff';
  };

  const fechaActual = new Date().toLocaleDateString('es-MX', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric',
  });

  // Descargar diagrama visual como imagen PNG
  const handleDownloadImage = async () => {
    if (!diagramRef.current) return;
    setDownloading(true);
    toast.info("Capturando diagrama...");
    try {
      const canvas = await html2canvas(diagramRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) { toast.error("Error al generar imagen"); setDownloading(false); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const nombreArchivo = `Stacking_${proyectoNombre.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;
      a.download = nombreArchivo;
      a.setAttribute("download", nombreArchivo);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      toast.success("Stacking descargado como imagen");
    } catch (err) {
      console.error("Error capturando stacking:", err);
      toast.error("Error al capturar diagrama");
    }
    setDownloading(false);
  };

  // Descargar PDF con diagrama visual + tabla de datos
  const handleDownloadPDF = async () => {
    setDownloading(true);
    toast.info("Generando PDF...");
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const VERDE_OBJETIVA: [number, number, number] = [2, 179, 129];
      const AZUL_OBJETIVA: [number, number, number] = [0, 44, 99];
      
      // Página 1: Diagrama visual capturado con html2canvas
      if (diagramRef.current) {
        const canvas = await html2canvas(diagramRef.current, {
          backgroundColor: "#ffffff",
          scale: 2,
          logging: false,
          useCORS: true,
        });
        const imgData = canvas.toDataURL("image/png");
        
        // Header
        doc.setFillColor(...AZUL_OBJETIVA);
        doc.rect(0, 0, pageWidth, 16, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('OBJETIVA', 10, 11);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Stacking Visual - ${proyectoNombre}`, pageWidth - 10, 8, { align: 'right' });
        doc.text(fechaActual, pageWidth - 10, 13, { align: 'right' });
        
        // Insertar imagen del diagrama
        const imgWidth = pageWidth - 20;
        const imgHeight = (canvas.height / canvas.width) * imgWidth;
        const maxImgHeight = pageHeight - 30;
        const finalHeight = Math.min(imgHeight, maxImgHeight);
        const finalWidth = imgHeight > maxImgHeight ? (canvas.width / canvas.height) * finalHeight : imgWidth;
        
        doc.addImage(imgData, 'PNG', 10, 20, finalWidth, finalHeight);
        
        // Footer
        doc.setFontSize(7);
        doc.setTextColor(128, 128, 128);
        doc.text(`OQC - ${proyectoNombre} | Página 1`, pageWidth / 2, pageHeight - 5, { align: 'center' });
      }
      
      // Página 2: Tabla de datos
      if (unidades && unidades.length > 0) {
        doc.addPage();
        
        // Header
        doc.setFillColor(...AZUL_OBJETIVA);
        doc.rect(0, 0, pageWidth, 16, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('OBJETIVA', 10, 11);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Detalle de Unidades - ${proyectoNombre}`, pageWidth - 10, 8, { align: 'right' });
        doc.text(fechaActual, pageWidth - 10, 13, { align: 'right' });
        
        let yPos = 24;
        
        // Resumen
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumen', 10, yPos);
        yPos += 6;
        
        autoTable(doc, {
          startY: yPos,
          head: [['Total', 'Completadas', 'Pendientes', 'Rechazadas', 'Sin Ítems']],
          body: [[
            String(estadisticas.total),
            String(estadisticas.completadas),
            String(estadisticas.pendientes),
            String(estadisticas.rechazadas),
            String(estadisticas.sinItems)
          ]],
          theme: 'grid',
          headStyles: { fillColor: VERDE_OBJETIVA, textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 9, halign: 'center', fontStyle: 'bold' },
          margin: { left: 10, right: pageWidth / 2 + 10 },
          tableWidth: pageWidth / 2 - 20,
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 8;
        
        // Tabla detallada
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalle por Unidad', 10, yPos);
        yPos += 6;
        
        const unidadesData = (unidades as UnidadPanoramica[]).map(u => [
          String(u.nivel),
          u.codigo || u.nombre,
          u.estado === 'completado' ? '100%' : u.estado === 'rechazado' ? 'Rechazado' : u.estado === 'pendiente' ? 'Pendiente' : 'Sin ítems',
          String(u.items.total),
          String(u.items.aprobados),
          String(u.items.pendientes),
          String(u.items.rechazados),
          `${u.porcentaje}%`
        ]);
        
        autoTable(doc, {
          startY: yPos,
          head: [['Nivel', 'Unidad', 'Estado', 'Total', 'Aprob.', 'Pend.', 'Rech.', '%']],
          body: unidadesData,
          theme: 'striped',
          headStyles: { fillColor: AZUL_OBJETIVA, textColor: [255, 255, 255], fontSize: 7 },
          bodyStyles: { fontSize: 7 },
          margin: { left: 10, right: 10 },
        });
      }
      
      // Footer en todas las páginas
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(128, 128, 128);
        doc.text(`OQC - ${proyectoNombre} | Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
      }
      
      downloadPDFBestMethod(doc, `Stacking_${proyectoNombre.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF descargado");
    } catch (err) {
      console.error("Error generando PDF:", err);
      toast.error("Error al generar PDF");
    }
    setDownloading(false);
  };

  if (!selectedProjectId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Selecciona un Proyecto</h2>
          <p className="text-muted-foreground">
            Usa el selector de proyecto en el menú lateral para ver el stacking.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#02B381]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con botones */}
      <div className="bg-white border-b p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/panoramica")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold text-[#002C63]">Stacking Visual</h1>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleDownloadImage} 
              disabled={downloading}
              variant="outline"
              className="gap-2"
            >
              <ImageIcon className="h-4 w-4" />
              {downloading ? "Capturando..." : "Descargar Imagen"}
            </Button>
            <Button 
              onClick={handleDownloadPDF} 
              disabled={downloading}
              className="bg-[#02B381] hover:bg-[#02B381]/90 gap-2"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Generando..." : "Descargar PDF"}
            </Button>
          </div>
        </div>
      </div>

      {/* Diagrama visual capturado por html2canvas */}
      <div className="max-w-7xl mx-auto p-6">
        <div 
          ref={diagramRef} 
          className="bg-white rounded-xl shadow-lg p-8"
          style={{ minWidth: '800px' }}
        >
          {/* Encabezado del diagrama */}
          <div className="flex justify-between items-start border-b-2 border-[#002C63] pb-4 mb-6">
            <div>
              <div className="text-2xl font-bold text-[#002C63] tracking-tight">
                OBJETIV<span className="text-[#02B381]">A</span>
              </div>
              <div className="text-sm text-gray-500 mt-1">Control de Calidad</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-[#002C63] text-xl">{proyectoNombre}</div>
              <div className="text-sm text-gray-500">{fechaActual}</div>
            </div>
          </div>

          <h2 className="text-xl font-bold text-[#002C63] text-center mb-4">
            Stacking de Unidades
          </h2>

          {/* Resumen estadístico */}
          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center px-4 py-2 bg-gray-50 rounded-lg border">
              <div className="text-2xl font-bold text-[#002C63]">{estadisticas.total}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="text-center px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-600">{estadisticas.completadas}</div>
              <div className="text-xs text-gray-500">Completadas</div>
            </div>
            <div className="text-center px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
              <div className="text-2xl font-bold text-amber-600">{estadisticas.pendientes}</div>
              <div className="text-xs text-gray-500">Pendientes</div>
            </div>
            <div className="text-center px-4 py-2 bg-red-50 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-600">{estadisticas.rechazadas}</div>
              <div className="text-xs text-gray-500">Rechazadas</div>
            </div>
            <div className="text-center px-4 py-2 bg-gray-50 rounded-lg border">
              <div className="text-2xl font-bold text-gray-600">{estadisticas.sinItems}</div>
              <div className="text-xs text-gray-500">Sin Ítems</div>
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex justify-center gap-6 mb-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
              <span>Completado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
              <span>Pendiente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
              <span>Rechazado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: '#d1d5db' }}></div>
              <span>Sin Ítems</span>
            </div>
          </div>

          {/* Cuadrícula visual del stacking (edificio) */}
          <div className="border-2 border-[#002C63] rounded-lg overflow-hidden">
            {Array.from(celdasPorNivel.entries()).map(([nivel, unidadesNivel]) => (
              <div key={nivel} className="flex border-b border-gray-200 last:border-b-0">
                {/* Label del nivel */}
                <div 
                  className="flex items-center justify-center font-bold text-white text-sm px-3 min-w-[60px]"
                  style={{ backgroundColor: '#002C63' }}
                >
                  N{nivel}
                </div>
                {/* Celdas de unidades */}
                <div 
                  className="flex-1 grid gap-[2px] p-[3px]"
                  style={{ 
                    gridTemplateColumns: `repeat(${Math.max(maxUnidadesPorNivel, unidadesNivel.length)}, minmax(0, 1fr))` 
                  }}
                >
                  {unidadesNivel.map((unidad) => {
                    const isEmptySpace = unidad.codigo === "-" || unidad.nombre === "-";
                    if (isEmptySpace) {
                      return (
                        <div 
                          key={unidad.id} 
                          className="h-14 rounded-sm border border-dashed border-gray-300 bg-gray-50"
                        />
                      );
                    }
                    return (
                      <div
                        key={unidad.id}
                        className="h-14 rounded-sm flex flex-col items-center justify-center px-1"
                        style={{ 
                          backgroundColor: getEstadoColor(unidad.estado),
                          color: getEstadoTextColor(unidad.estado),
                        }}
                      >
                        <span className="font-bold text-xs truncate w-full text-center leading-tight">
                          {unidad.codigo || unidad.nombre}
                        </span>
                        <span className="text-[10px] opacity-90">{unidad.porcentaje}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer del diagrama */}
          <div className="flex justify-between items-center mt-4 pt-3 border-t text-xs text-gray-400">
            <span>OQC - {proyectoNombre}</span>
            <span>{fechaActual}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
