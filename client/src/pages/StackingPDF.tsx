import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useLocation } from "wouter";
import { 
  ArrowLeft,
  FileDown,
  Printer,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";
import { useMemo, useRef } from "react";

type UnidadPanoramica = {
  id: number;
  nombre: string;
  codigo: string | null;
  nivel: number;
  orden: number;
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
  const printRef = useRef<HTMLDivElement>(null);
  
  const { data: unidades, isLoading } = trpc.unidades.panoramica.useQuery(
    { proyectoId: selectedProjectId || 0 },
    { enabled: !!selectedProjectId }
  );

  const { data: proyectos } = trpc.proyectos.list.useQuery();
  const proyecto = proyectos?.find(p => p.id === selectedProjectId);

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

  const handlePrint = () => {
    window.print();
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
    <div className="min-h-screen bg-white">
      {/* Header con botones - NO se imprime */}
      <div className="bg-gray-50 border-b p-4 print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/panoramica")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold text-[#002C63]">Vista PDF del Stacking</h1>
          </div>
          <Button onClick={handlePrint} className="bg-[#02B381] hover:bg-[#02B381]/90">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir / Descargar PDF
          </Button>
        </div>
      </div>

      {/* Contenido imprimible - SIN DashboardLayout */}
      <div ref={printRef} className="max-w-7xl mx-auto p-6 print:p-4 print:max-w-none">
        {/* Encabezado del reporte - Estilo Objetiva */}
        <div className="flex justify-between items-center border-b-2 border-[#002C63] pb-3 mb-6 print:mb-4">
          <div className="text-xl font-bold text-[#002C63]">
            OBJETIV<span className="text-[#02B381]">A</span>
          </div>
          <div className="text-right">
            <div className="font-bold text-[#002C63]">{proyecto?.nombre || 'Proyecto'}</div>
            <div className="text-sm text-gray-500">
              Generado: {new Date().toLocaleDateString('es-MX', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>
        
        <h1 className="text-xl font-bold text-[#002C63] mb-4 print:text-lg text-center">
          Reporte de Stacking
        </h1>

        {/* Resumen estadístico */}
        <div className="grid grid-cols-5 gap-2 mb-6 print:mb-4 print:gap-1">
          <div className="text-center p-2 bg-gray-50 rounded print:p-1 border">
            <p className="text-xl font-bold text-[#002C63] print:text-lg">{estadisticas.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="text-center p-2 bg-emerald-50 rounded print:p-1 border border-emerald-200">
            <p className="text-xl font-bold text-emerald-600 print:text-lg">{estadisticas.completadas}</p>
            <p className="text-xs text-gray-500">Completadas</p>
          </div>
          <div className="text-center p-2 bg-amber-50 rounded print:p-1 border border-amber-200">
            <p className="text-xl font-bold text-amber-600 print:text-lg">{estadisticas.pendientes}</p>
            <p className="text-xs text-gray-500">Pendientes</p>
          </div>
          <div className="text-center p-2 bg-red-50 rounded print:p-1 border border-red-200">
            <p className="text-xl font-bold text-red-600 print:text-lg">{estadisticas.rechazadas}</p>
            <p className="text-xs text-gray-500">Rechazadas</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded print:p-1 border">
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

        {/* Cuadrícula del stacking - ordenado de menor a mayor (ascendente) */}
        <div className="border rounded-lg p-4 print:p-2 print:border-gray-300">
          <h2 className="font-semibold text-[#002C63] mb-3 print:text-sm print:mb-2">
            Cuadrícula de Unidades por Nivel (Menor a Mayor)
          </h2>
          
          <div className="space-y-4 print:space-y-2">
            {Array.from(celdasPorNivel.entries()).map(([nivel, unidadesNivel]) => (
              <div key={nivel} className="print:break-inside-avoid">
                <div className="flex items-center gap-2 mb-2 print:mb-1">
                  <span className="font-semibold text-sm bg-gray-100 px-2 py-1 rounded print:text-xs">
                    Nivel {nivel}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({unidadesNivel.length} unidades)
                  </span>
                </div>
                
                <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 print:grid-cols-10 print:gap-1">
                  {unidadesNivel.map((unidad) => (
                    <div
                      key={unidad.id}
                      className={`
                        p-2 rounded text-center text-xs
                        ${getEstadoColor(unidad.estado)} text-white
                        print:p-1 print:text-[8px]
                      `}
                    >
                      <div className="font-semibold truncate">
                        {unidad.codigo || unidad.nombre}
                      </div>
                      <div className="text-[10px] opacity-90 print:text-[6px]">
                        {unidad.porcentaje}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabla detallada */}
        <div className="mt-6 print:mt-4 print:break-before-page">
          <h2 className="font-semibold text-[#002C63] mb-3 print:text-sm print:mb-2">
            Detalle por Unidad
          </h2>
          
          <table className="w-full text-xs border-collapse print:text-[8px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left print:p-1">Nivel</th>
                <th className="border p-2 text-left print:p-1">Unidad</th>
                <th className="border p-2 text-center print:p-1">Estado</th>
                <th className="border p-2 text-center print:p-1">Total</th>
                <th className="border p-2 text-center print:p-1">Aprobados</th>
                <th className="border p-2 text-center print:p-1">Pendientes</th>
                <th className="border p-2 text-center print:p-1">Rechazados</th>
                <th className="border p-2 text-center print:p-1">%</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(celdasPorNivel.entries()).flatMap(([nivel, unidadesNivel]) =>
                unidadesNivel.map((unidad) => (
                  <tr key={unidad.id} className="hover:bg-gray-50">
                    <td className="border p-2 print:p-1">{nivel}</td>
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
                    <td className="border p-2 text-center print:p-1 text-emerald-600">{unidad.items.aprobados}</td>
                    <td className="border p-2 text-center print:p-1 text-amber-600">{unidad.items.pendientes}</td>
                    <td className="border p-2 text-center print:p-1 text-red-600">{unidad.items.rechazados}</td>
                    <td className="border p-2 text-center print:p-1 font-semibold">{unidad.porcentaje}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pie de página para impresión */}
        <div className="hidden print:block mt-8 text-center text-xs text-gray-500 border-t pt-2">
          Generado por ObjetivaOQC | {new Date().toLocaleDateString('es-MX')}
        </div>
      </div>

      {/* Estilos de impresión - ocultar TODO excepto el contenido */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 1cm;
          }
          
          /* Ocultar absolutamente todo el layout de la app */
          body > div > div > aside,
          body > div > div > header,
          body > div > div > nav,
          [data-sidebar],
          [class*="sidebar"],
          [class*="Sidebar"],
          .print\\:hidden {
            display: none !important;
          }
          
          /* Asegurar que el contenido ocupe todo el ancho */
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Remover márgenes del contenedor principal */
          main, [role="main"] {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
