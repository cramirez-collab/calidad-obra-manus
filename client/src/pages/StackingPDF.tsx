import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useLocation } from "wouter";
import { 
  ArrowLeft,
  Printer,
  Building2
} from "lucide-react";
import { useMemo, useRef, useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadPDFBestMethod } from "@/lib/pdfDownload";

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

// Componente de encabezado reutilizable
function EncabezadoPDF({ proyectoNombre, fecha }: { proyectoNombre: string; fecha: string }) {
  return (
    <div className="flex justify-between items-start border-b-2 border-[#002C63] pb-3 mb-4">
      <div>
        <div className="text-xl sm:text-2xl font-bold text-[#002C63] tracking-tight">
          OBJETIV<span className="text-[#02B381]">A</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">Control de Calidad</div>
      </div>
      <div className="text-right">
        <div className="font-bold text-[#002C63] text-lg">{proyectoNombre}</div>
        <div className="text-xs text-gray-500">{fecha}</div>
      </div>
    </div>
  );
}

// Componente de pie de página reutilizable
function PiePaginaPDF({ proyectoNombre, pagina, totalPaginas }: { proyectoNombre: string; pagina: number; totalPaginas: number }) {
  return (
    <div className="flex justify-between items-center mt-auto pt-2 border-t text-xs text-gray-500">
      <span>OQC - {proyectoNombre}</span>
      <span>Página {pagina} de {totalPaginas}</span>
    </div>
  );
}

export default function StackingPDF() {
  const [, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  const printRef = useRef<HTMLDivElement>(null);
  
  const { data: unidades, isLoading } = trpc.unidades.panoramica.useQuery(
    { proyectoId: selectedProjectId || 0 },
    { enabled: !!selectedProjectId }
  );

  const { data: proyectos } = trpc.proyectos.list.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const proyecto = proyectos?.find(p => p.id === selectedProjectId);
  const proyectoNombre = proyecto?.nombre || 'Proyecto';

  // Agrupar unidades por nivel - ordenado de MENOR a MAYOR para el PDF (ascendente)
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
    
    // Ordenar por posición dentro de cada nivel
    grouped.forEach((celdas, nivel) => {
      celdas.sort((a, b) => (a.orden || 0) - (b.orden || 0));
      grouped.set(nivel, celdas);
    });
    
    // Ordenar niveles ASCENDENTE (menor a mayor) para el PDF
    return new Map(Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]));
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

  // Dividir unidades en páginas para la tabla (30 por página)
  const unidadesParaTabla = useMemo(() => {
    const todas: UnidadPanoramica[] = [];
    Array.from(celdasPorNivel.entries()).forEach(([_, unidadesNivel]) => {
      todas.push(...unidadesNivel);
    });
    
    const paginas: UnidadPanoramica[][] = [];
    const ITEMS_POR_PAGINA = 30;
    
    for (let i = 0; i < todas.length; i += ITEMS_POR_PAGINA) {
      paginas.push(todas.slice(i, i + ITEMS_POR_PAGINA));
    }
    
    return paginas;
  }, [celdasPorNivel]);

  // Total de páginas: 1 (cuadrícula) + páginas de tabla
  const totalPaginas = 1 + unidadesParaTabla.length;

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'completado': return 'bg-emerald-500';
      case 'rechazado': return 'bg-red-500';
      case 'pendiente': return 'bg-amber-500';
      default: return 'bg-gray-300';
    }
  };

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'completado': return '100%';
      case 'rechazado': return 'Rechazado';
      case 'pendiente': return 'Pendiente';
      default: return 'Sin ítems';
    }
  };

  const fechaActual = new Date().toLocaleDateString('es-MX', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handlePrint = () => {
    // Generar PDF real con jsPDF
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const VERDE_OBJETIVA: [number, number, number] = [2, 179, 129];
    const AZUL_OBJETIVA: [number, number, number] = [0, 44, 99];
    
    // Header
    doc.setFillColor(...AZUL_OBJETIVA);
    doc.rect(0, 0, pageWidth, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('OBJETIVA', 10, 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Stacking - ${proyectoNombre}`, pageWidth - 10, 10, { align: 'right' });
    doc.text(fechaActual, pageWidth - 10, 16, { align: 'right' });
    
    let yPos = 30;
    
    // Resumen estadistico
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen de Unidades', 10, yPos);
    yPos += 8;
    
    const resumenData = [
      ['Total', String(estadisticas.total)],
      ['Completadas', String(estadisticas.completadas)],
      ['Pendientes', String(estadisticas.pendientes)],
      ['Rechazadas', String(estadisticas.rechazadas)],
      ['Sin Items', String(estadisticas.sinItems)]
    ];
    
    autoTable(doc, {
      startY: yPos,
      head: [['Estado', 'Cantidad']],
      body: resumenData,
      theme: 'striped',
      headStyles: { fillColor: VERDE_OBJETIVA, textColor: [255, 255, 255] },
      margin: { left: 10, right: pageWidth - 100 },
      tableWidth: 80
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
    
    // Tabla de unidades
    if (unidades && unidades.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalle por Unidad', 10, yPos);
      yPos += 8;
      
      const unidadesData = (unidades as UnidadPanoramica[]).map(u => [
        String(u.nivel),
        u.codigo || u.nombre,
        u.estado,
        String(u.items.total),
        String(u.items.aprobados),
        String(u.items.pendientes),
        String(u.items.rechazados),
        `${u.porcentaje}%`
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Nivel', 'Unidad', 'Estado', 'Total', 'Aprobados', 'Pendientes', 'Rechazados', '%']],
        body: unidadesData,
        theme: 'striped',
        headStyles: { fillColor: AZUL_OBJETIVA, textColor: [255, 255, 255] },
        margin: { left: 10, right: 10 },
        styles: { fontSize: 8 }
      });
    }
    
    // Footer en todas las paginas
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`OQC - ${proyectoNombre} | Pagina ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }
    
    downloadPDFBestMethod(doc, `stacking_${proyectoNombre.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
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
    <div className="min-h-screen bg-white print:bg-white">
      {/* Header con botones - NO se imprime */}
      <div className="bg-gray-50 border-b p-4 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/panoramica")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold text-[#002C63]">Vista PDF del Stacking</h1>
          </div>
          <Button onClick={handlePrint} className="bg-[#02B381] hover:bg-[#02B381]/90">
            <Printer className="h-4 w-4 mr-2" />
            Descargar PDF
          </Button>
        </div>
      </div>

      {/* Contenido imprimible */}
      <div ref={printRef} className="print:p-0 print:max-w-none">
        
        {/* ========== PÁGINA 1: CUADRÍCULA ========== */}
        <div className="pdf-page max-w-7xl mx-auto p-6 print:p-4 print:max-w-none print:h-[100vh] print:flex print:flex-col">
          {/* Encabezado */}
          <EncabezadoPDF proyectoNombre={proyectoNombre} fecha={fechaActual} />
          
          <h1 className="text-xl font-bold text-[#002C63] mb-4 text-center print:text-lg">
            Reporte de Stacking - Cuadrícula
          </h1>

          {/* Resumen estadístico */}
          <div className="grid grid-cols-5 gap-2 mb-4 print:gap-1">
            <div className="text-center p-2 bg-gray-50 rounded border print:p-1">
              <p className="text-xl font-bold text-[#002C63] print:text-lg">{estadisticas.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="text-center p-2 bg-emerald-50 rounded border border-emerald-200 print:p-1">
              <p className="text-xl font-bold text-emerald-600 print:text-lg">{estadisticas.completadas}</p>
              <p className="text-xs text-gray-500">Completadas</p>
            </div>
            <div className="text-center p-2 bg-amber-50 rounded border border-amber-200 print:p-1">
              <p className="text-xl font-bold text-amber-600 print:text-lg">{estadisticas.pendientes}</p>
              <p className="text-xs text-gray-500">Pendientes</p>
            </div>
            <div className="text-center p-2 bg-red-50 rounded border border-red-200 print:p-1">
              <p className="text-xl font-bold text-red-600 print:text-lg">{estadisticas.rechazadas}</p>
              <p className="text-xs text-gray-500">Rechazadas</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded border print:p-1">
              <p className="text-xl font-bold text-gray-600 print:text-lg">{estadisticas.sinItems}</p>
              <p className="text-xs text-gray-500">Sin ítems</p>
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex justify-center gap-4 mb-4 text-xs print:mb-2">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-emerald-500"></div>
              <span>Completado</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-amber-500"></div>
              <span>Pendiente</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-red-500"></div>
              <span>Rechazado</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-gray-300"></div>
              <span>Sin ítems</span>
            </div>
          </div>

          {/* Cuadrícula del stacking */}
          <div className="border rounded-lg p-4 print:p-2 print:border-gray-300 flex-1">
            <h2 className="font-semibold text-[#002C63] mb-3 print:text-sm print:mb-2">
              Cuadrícula de Unidades por Nivel (Menor a Mayor)
            </h2>
            
            <div className="space-y-3 print:space-y-2">
              {Array.from(celdasPorNivel.entries()).map(([nivel, unidadesNivel]) => (
                <div key={nivel} className="print:break-inside-avoid">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm bg-gray-100 px-2 py-0.5 rounded print:text-xs">
                      Nivel {nivel}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({unidadesNivel.length} unidades)
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1 print:grid-cols-12 print:gap-0.5">
                    {unidadesNivel.map((unidad) => (
                      <div
                        key={unidad.id}
                        className={`
                          p-1 rounded text-center text-xs
                          ${getEstadoColor(unidad.estado)} text-white
                          print:p-0.5 print:text-[7px]
                        `}
                      >
                        <div className="font-semibold truncate">
                          {unidad.codigo || unidad.nombre}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pie de página - Página 1 */}
          <PiePaginaPDF proyectoNombre={proyectoNombre} pagina={1} totalPaginas={totalPaginas} />
        </div>

        {/* ========== PÁGINAS DE TABLA DETALLADA ========== */}
        {unidadesParaTabla.map((paginaUnidades, indexPagina) => (
          <div 
            key={indexPagina} 
            className="pdf-page max-w-7xl mx-auto p-6 print:p-4 print:max-w-none print:h-[100vh] print:flex print:flex-col print:page-break-before"
          >
            {/* Encabezado repetido */}
            <EncabezadoPDF proyectoNombre={proyectoNombre} fecha={fechaActual} />

            <h2 className="font-semibold text-[#002C63] mb-3 print:text-sm print:mb-2">
              Detalle por Unidad {indexPagina > 0 ? `(continuación ${indexPagina + 1})` : ''}
            </h2>
            
            <div className="flex-1">
              <table className="w-full text-xs border-collapse print:text-[8px]">
                <thead>
                  <tr className="bg-[#002C63] text-white">
                    <th className="border border-[#002C63] p-2 text-left print:p-1">Nivel</th>
                    <th className="border border-[#002C63] p-2 text-left print:p-1">Unidad</th>
                    <th className="border border-[#002C63] p-2 text-center print:p-1">Estado</th>
                    <th className="border border-[#002C63] p-2 text-center print:p-1">Total</th>
                    <th className="border border-[#002C63] p-2 text-center print:p-1">Aprobados</th>
                    <th className="border border-[#002C63] p-2 text-center print:p-1">Pendientes</th>
                    <th className="border border-[#002C63] p-2 text-center print:p-1">Rechazados</th>
                    <th className="border border-[#002C63] p-2 text-center print:p-1">%</th>
                  </tr>
                </thead>
                <tbody>
                  {paginaUnidades.map((unidad, idx) => (
                    <tr key={unidad.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border p-2 print:p-1">{unidad.nivel}</td>
                      <td className="border p-2 print:p-1 font-medium">
                        {unidad.codigo || unidad.nombre}
                      </td>
                      <td className="border p-2 text-center print:p-1">
                        <span className={`
                          inline-block px-2 py-0.5 rounded text-white text-[10px]
                          ${getEstadoColor(unidad.estado)}
                        `}>
                          {getEstadoLabel(unidad.estado)}
                        </span>
                      </td>
                      <td className="border p-2 text-center print:p-1">{unidad.items.total}</td>
                      <td className="border p-2 text-center print:p-1 text-emerald-600 font-medium">{unidad.items.aprobados}</td>
                      <td className="border p-2 text-center print:p-1 text-amber-600 font-medium">{unidad.items.pendientes}</td>
                      <td className="border p-2 text-center print:p-1 text-red-600 font-medium">{unidad.items.rechazados}</td>
                      <td className="border p-2 text-center print:p-1 font-bold">{unidad.porcentaje}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pie de página */}
            <PiePaginaPDF proyectoNombre={proyectoNombre} pagina={indexPagina + 2} totalPaginas={totalPaginas} />
          </div>
        ))}
      </div>

      {/* Estilos de impresión profesionales */}
      <style>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 0.5cm;
          }
          
          html, body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          /* Ocultar ABSOLUTAMENTE todo lo que no sea el contenido */
          body > div > div > aside,
          body > div > div > header,
          body > div > div > nav,
          [data-sidebar],
          [class*="sidebar"],
          [class*="Sidebar"],
          .print\\:hidden {
            display: none !important;
          }
          
          /* Asegurar que el contenido ocupe todo */
          main, [role="main"] {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          
          /* Cada página PDF */
          .pdf-page {
            page-break-after: always;
            min-height: 100vh;
            box-sizing: border-box;
          }
          
          .pdf-page:last-child {
            page-break-after: auto;
          }
          
          .print\\:page-break-before {
            page-break-before: always;
          }
        }
        
        /* Vista previa en pantalla */
        @media screen {
          .pdf-page {
            margin-bottom: 2rem;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          }
        }
      `}</style>
    </div>
  );
}
