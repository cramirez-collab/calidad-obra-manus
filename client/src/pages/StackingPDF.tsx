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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
// PDF download uses jsPDF.save() directly for reliability
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

// Dibujar el diagrama del stacking directamente en un Canvas 2D
function drawStackingOnCanvas(
  canvas: HTMLCanvasElement,
  celdasPorNivel: Map<number, UnidadPanoramica[]>,
  maxUnidadesPorNivel: number,
  estadisticas: { total: number; completadas: number; pendientes: number; rechazadas: number; sinItems: number },
  proyectoNombre: string,
  fechaActual: string,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const SCALE = 1; // keep at 1x for PDF compatibility (smaller file)
  const PADDING = 40;
  const HEADER_H = 90;
  const STATS_H = 70;
  const LEGEND_H = 40;
  const ROW_H = 56;
  const LEVEL_COL_W = 60;
  const CELL_GAP = 3;
  const FOOTER_H = 40;

  const nivelesArr = Array.from(celdasPorNivel.entries());
  const numRows = nivelesArr.length;
  const cellW = Math.max(70, Math.min(110, (900 - LEVEL_COL_W) / maxUnidadesPorNivel));
  const gridW = LEVEL_COL_W + maxUnidadesPorNivel * (cellW + CELL_GAP) + CELL_GAP;
  const totalW = Math.max(gridW + PADDING * 2, 900);
  const totalH = HEADER_H + STATS_H + LEGEND_H + numRows * (ROW_H + CELL_GAP) + CELL_GAP + FOOTER_H + PADDING * 2;

  canvas.width = totalW * SCALE;
  canvas.height = totalH * SCALE;
  canvas.style.width = `${totalW}px`;
  canvas.style.height = `${totalH}px`;
  ctx.scale(SCALE, SCALE);

  // Fondo blanco
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, totalW, totalH);

  let y = PADDING;

  // === HEADER ===
  ctx.fillStyle = "#002C63";
  ctx.font = "bold 24px Helvetica, Arial, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("OBJETIV", PADDING, y);
  const objW = ctx.measureText("OBJETIV").width;
  ctx.fillStyle = "#02B381";
  ctx.fillText("A", PADDING + objW, y);
  ctx.fillStyle = "#6b7280";
  ctx.font = "13px Helvetica, Arial, sans-serif";
  ctx.fillText("Control de Calidad", PADDING, y + 30);

  ctx.fillStyle = "#002C63";
  ctx.font = "bold 20px Helvetica, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(proyectoNombre, totalW - PADDING, y);
  ctx.fillStyle = "#6b7280";
  ctx.font = "13px Helvetica, Arial, sans-serif";
  ctx.fillText(fechaActual, totalW - PADDING, y + 28);
  ctx.textAlign = "left";

  // Línea separadora
  y += 55;
  ctx.strokeStyle = "#002C63";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(totalW - PADDING, y);
  ctx.stroke();
  y += 10;

  // === TÍTULO ===
  ctx.fillStyle = "#002C63";
  ctx.font = "bold 18px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Stacking de Unidades", totalW / 2, y);
  ctx.textAlign = "left";
  y += 30;

  // === ESTADÍSTICAS ===
  const statsData = [
    { label: "Total", value: estadisticas.total, bg: "#f3f4f6", border: "#d1d5db", color: "#002C63" },
    { label: "Completadas", value: estadisticas.completadas, bg: "#ecfdf5", border: "#a7f3d0", color: "#059669" },
    { label: "Pendientes", value: estadisticas.pendientes, bg: "#fffbeb", border: "#fde68a", color: "#d97706" },
    { label: "Rechazadas", value: estadisticas.rechazadas, bg: "#fef2f2", border: "#fecaca", color: "#dc2626" },
    { label: "Sin Ítems", value: estadisticas.sinItems, bg: "#f3f4f6", border: "#d1d5db", color: "#4b5563" },
  ];
  const statBoxW = 100;
  const statGap = 16;
  const statsStartX = (totalW - (statsData.length * statBoxW + (statsData.length - 1) * statGap)) / 2;
  statsData.forEach((s, i) => {
    const sx = statsStartX + i * (statBoxW + statGap);
    ctx.fillStyle = s.bg;
    roundRect(ctx, sx, y, statBoxW, 50, 8);
    ctx.fill();
    ctx.strokeStyle = s.border;
    ctx.lineWidth = 1;
    roundRect(ctx, sx, y, statBoxW, 50, 8);
    ctx.stroke();
    ctx.fillStyle = s.color;
    ctx.font = "bold 22px Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(s.value), sx + statBoxW / 2, y + 10);
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px Helvetica, Arial, sans-serif";
    ctx.fillText(s.label, sx + statBoxW / 2, y + 36);
  });
  ctx.textAlign = "left";
  y += 60;

  // === LEYENDA ===
  const legendData = [
    { label: "Completado", color: "#10b981" },
    { label: "Pendiente", color: "#f59e0b" },
    { label: "Rechazado", color: "#ef4444" },
    { label: "Sin Ítems", color: "#d1d5db" },
  ];
  const legendStartX = (totalW - (legendData.length * 120)) / 2;
  legendData.forEach((l, i) => {
    const lx = legendStartX + i * 120;
    ctx.fillStyle = l.color;
    roundRect(ctx, lx, y, 16, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#374151";
    ctx.font = "12px Helvetica, Arial, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(l.label, lx + 22, y + 2);
  });
  y += 30;

  // === CUADRÍCULA DEL STACKING ===
  const gridStartX = (totalW - gridW) / 2;

  // Borde exterior
  ctx.strokeStyle = "#002C63";
  ctx.lineWidth = 2;
  const gridTotalH = numRows * (ROW_H + CELL_GAP) + CELL_GAP;
  roundRect(ctx, gridStartX, y, gridW, gridTotalH, 8);
  ctx.stroke();

  nivelesArr.forEach(([nivel, unidadesNivel], rowIdx) => {
    const rowY = y + CELL_GAP + rowIdx * (ROW_H + CELL_GAP);

    // Label del nivel
    ctx.fillStyle = "#002C63";
    roundRect(ctx, gridStartX, rowY, LEVEL_COL_W, ROW_H, 0);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`N${nivel}`, gridStartX + LEVEL_COL_W / 2, rowY + ROW_H / 2);

    // Celdas de unidades
    unidadesNivel.forEach((unidad, colIdx) => {
      const cx = gridStartX + LEVEL_COL_W + CELL_GAP + colIdx * (cellW + CELL_GAP);
      const isEmptySpace = unidad.codigo === "-" || unidad.nombre === "-";

      if (isEmptySpace) {
        ctx.strokeStyle = "#d1d5db";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        roundRect(ctx, cx, rowY, cellW, ROW_H, 4);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const bgColor = getEstadoColorHex(unidad.estado);
        ctx.fillStyle = bgColor;
        roundRect(ctx, cx, rowY, cellW, ROW_H, 4);
        ctx.fill();

        const textColor = unidad.estado === "sin_items" ? "#374151" : "#ffffff";
        ctx.fillStyle = textColor;
        ctx.font = "bold 11px Helvetica, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = unidad.codigo || unidad.nombre;
        // Truncar si es muy largo
        const maxChars = Math.floor(cellW / 7);
        const displayLabel = label.length > maxChars ? label.slice(0, maxChars - 1) + "…" : label;
        ctx.fillText(displayLabel, cx + cellW / 2, rowY + ROW_H / 2 - 8);
        ctx.font = "10px Helvetica, Arial, sans-serif";
        ctx.globalAlpha = 0.9;
        ctx.fillText(`${unidad.porcentaje}%`, cx + cellW / 2, rowY + ROW_H / 2 + 10);
        ctx.globalAlpha = 1;
      }
    });

    // Línea separadora entre filas
    if (rowIdx < nivelesArr.length - 1) {
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gridStartX + LEVEL_COL_W, rowY + ROW_H + CELL_GAP / 2);
      ctx.lineTo(gridStartX + gridW, rowY + ROW_H + CELL_GAP / 2);
      ctx.stroke();
    }
  });

  ctx.textAlign = "left";
  y += gridTotalH + 15;

  // === FOOTER ===
  ctx.fillStyle = "#9ca3af";
  ctx.font = "11px Helvetica, Arial, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(`OQC - ${proyectoNombre}`, PADDING, y);
  ctx.textAlign = "right";
  ctx.fillText(fechaActual, totalW - PADDING, y);
  ctx.textAlign = "left";
}

function getEstadoColorHex(estado: string): string {
  switch (estado) {
    case "completado": return "#10b981";
    case "rechazado": return "#ef4444";
    case "pendiente": return "#f59e0b";
    default: return "#d1d5db";
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

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

  // Crear canvas off-screen y dibujar diagrama
  const createDiagramCanvas = (): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    drawStackingOnCanvas(canvas, celdasPorNivel, maxUnidadesPorNivel, estadisticas, proyectoNombre, fechaActual);
    return canvas;
  };

  // Descargar diagrama visual como imagen PNG
  const handleDownloadImage = async () => {
    setDownloading(true);
    toast.info("Generando imagen del stacking...");
    try {
      const canvas = createDiagramCanvas();
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
      console.error("Error generando imagen stacking:", err);
      toast.error("Error al generar imagen");
    }
    setDownloading(false);
  };

  // Descargar PDF con diagrama visual + tabla de datos
  const handleDownloadPDF = async () => {
    setDownloading(true);
    toast.info("Generando PDF del stacking...");
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const VERDE_OBJETIVA: [number, number, number] = [2, 179, 129];
      const AZUL_OBJETIVA: [number, number, number] = [0, 44, 99];
      
      // Página 1: Diagrama visual dibujado en Canvas
      const canvas = createDiagramCanvas();
      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      
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
      const imgX = (pageWidth - finalWidth) / 2;
      
      doc.addImage(imgData, 'JPEG', imgX, 20, finalWidth, finalHeight);
      
      // Footer
      doc.setFontSize(7);
      doc.setTextColor(128, 128, 128);
      doc.text(`OQC - ${proyectoNombre} | Página 1`, pageWidth / 2, pageHeight - 5, { align: 'center' });
      
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
      
      const pdfFilename = `Stacking_${proyectoNombre.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      const pdfBlob = doc.output('blob');
      
      // Descargar manualmente con blob
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = pdfFilename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(pdfUrl);
      }, 1000);
      toast.success("PDF del stacking descargado");
    } catch (err) {
      console.error("Error generando PDF stacking:", err);
      toast.error("Error al generar PDF del stacking");
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

      {/* Diagrama visual del stacking (HTML preview) */}
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
