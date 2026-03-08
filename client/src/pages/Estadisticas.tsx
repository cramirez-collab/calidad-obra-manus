import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Download,
  FileSpreadsheet,
  FileText,
  FileDown,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  User,
  Layers,
  MapPin,
  Home,
  Wrench,
  X,
  DollarSign,
  Ban,
  ShieldCheck
} from "lucide-react";
import { useState, useMemo } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { 
  crearPDFUnificado, 
  agregarSeccion, 
  agregarTablaUnificada, 
  descargarPDFUnificado,
  COLORES 
} from "@/lib/pdfUnificado";
import KPIsMejoresPeores from "@/components/KPIsMejoresPeores";
import { generarReporteEstadisticasPDF } from "@/lib/reporteEstadisticasPDF";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  LabelList,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { Pen, Send, Mail, Loader2 } from "lucide-react";
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  pendiente_foto_despues: "#F59E0B",
  pendiente_aprobacion: "#3B82F6",
  aprobado: "#10B981",
  rechazado: "#EF4444",
};

const statusLabels: Record<string, string> = {
  pendiente_foto_despues: "Pendiente Foto",
  pendiente_aprobacion: "Pendiente Aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

// Opciones de estatus para filtro
const statusOptions = [
  { value: "rechazado", label: "Rechazado", color: "bg-red-500" },
  { value: "aprobado", label: "Aprobado", color: "bg-emerald-500" },
  { value: "pendiente_foto_despues", label: "Alta (Foto)", color: "bg-amber-500" },
  { value: "pendiente_aprobacion", label: "Tiempo Respuesta", color: "bg-blue-500" },
];

export default function Estadisticas() {
  const { selectedProjectId } = useProject();
  const [filters, setFilters] = useState({
    empresaId: "",
    especialidadId: "",
    usuarioId: "",
    nivel: "",
    unidadId: "",
    espacioId: "",
    defectoId: "",
    status: "",
  });

  const { data: empresas } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: unidades } = trpc.unidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: espacios } = trpc.espacios.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: defectos } = trpc.defectos.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: usuarios } = trpc.users.listForMentions.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined
  );
  const { data: proyectos } = trpc.proyectos.list.useQuery(undefined, { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 });
  const proyectoNombre = proyectos?.find(p => p.id === selectedProjectId)?.nombre || 'Proyecto';

  // Obtener niveles únicos de las unidades
  const niveles = useMemo(() => {
    if (!unidades) return [];
    const uniqueNiveles = Array.from(new Set(unidades.map(u => u.nivel).filter(Boolean)));
    return uniqueNiveles.sort((a, b) => (a || 0) - (b || 0));
  }, [unidades]);

  const queryFilters = useMemo(() => ({
    proyectoId: selectedProjectId || undefined,
    empresaId: filters.empresaId ? parseInt(filters.empresaId) : undefined,
    especialidadId: filters.especialidadId ? parseInt(filters.especialidadId) : undefined,
    unidadId: filters.unidadId ? parseInt(filters.unidadId) : undefined,
    espacioId: filters.espacioId ? parseInt(filters.espacioId) : undefined,
    residenteId: filters.usuarioId ? parseInt(filters.usuarioId) : undefined,
    status: filters.status || undefined,
    nivel: filters.nivel ? parseInt(filters.nivel) : undefined,
    defectoId: filters.defectoId ? parseInt(filters.defectoId) : undefined,
  }), [filters, selectedProjectId]);

  const { data: stats, isLoading, refetch } = trpc.estadisticas.general.useQuery(queryFilters, {
    enabled: !!selectedProjectId,
  });
  const { data: defectosStats } = trpc.defectos.estadisticas.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: penalizaciones } = trpc.estadisticas.penalizaciones.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: kpisData } = trpc.estadisticasAvanzadas.kpisMejoresPeores.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: rendimientoData } = trpc.estadisticasAvanzadas.rendimientoUsuarios.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: defectosPorUsuarioData } = trpc.estadisticasAvanzadas.defectosPorUsuario.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: firmantesData } = trpc.estadisticas.firmantesReporte.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: itemsReporteData } = trpc.estadisticas.itemsParaReporte.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );

  const clearFilter = (key: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [key]: "" }));
  };

  const clearAllFilters = () => {
    setFilters({
      empresaId: "",
      especialidadId: "",
      usuarioId: "",
      nivel: "",
      unidadId: "",
      espacioId: "",
      defectoId: "",
      status: "",
    });
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== "").length;

  const getExportParams = () => {
    const params = new URLSearchParams();
    if (filters.empresaId) params.append("empresaId", filters.empresaId);
    if (filters.unidadId) params.append("unidadId", filters.unidadId);
    if (filters.status) params.append("status", filters.status);
    return params.toString();
  };

  const exportToExcel = () => {
    window.open(`/api/export/estadisticas?${getExportParams()}`, "_blank");
  };

  const exportToCSV = () => {
    window.open(`/api/export/estadisticas/csv?${getExportParams()}`, "_blank");
  };

  // Preparar datos para gráficos
  const statusData = useMemo(() => {
    if (!stats?.porStatus) return [];
    return stats.porStatus.map(item => ({
      name: statusLabels[item.status] || item.status,
      value: Number(item.count),
      color: statusColors[item.status] || "#6B7280",
    }));
  }, [stats]);

  const empresaData = useMemo(() => {
    if (!stats?.porEmpresa) return [];
    return stats.porEmpresa.slice(0, 10).map(item => ({
      name: empresas?.find(e => e.id === item.empresaId)?.nombre || `Empresa ${item.empresaId}`,
      total: Number(item.count),
    })).sort((a, b) => b.total - a.total);
  }, [stats, empresas]);

  const especialidadData = useMemo(() => {
    if (!stats?.porEspecialidad) return [];
    return stats.porEspecialidad.map(item => {
      const esp = especialidades?.find(e => e.id === item.especialidadId);
      return {
        name: esp?.nombre || `Esp ${item.especialidadId}`,
        value: Number(item.count),
        color: esp?.color || "#6B7280",
      };
    }).sort((a, b) => b.value - a.value);
  }, [stats, especialidades]);

  // Datos de defectos para gráficos
  const defectosData = useMemo(() => {
    if (!defectosStats?.porDefecto) return [];
    return defectosStats.porDefecto.slice(0, 10).map(item => ({
      name: item.defecto?.nombre || 'Sin nombre',
      total: item.total,
      aprobados: item.aprobados,
      rechazados: item.rechazados,
    })).sort((a, b) => b.total - a.total);
  }, [defectosStats]);

  // Calcular tasa de aprobación global
  const tasaAprobacionGlobal = useMemo(() => {
    if (!defectosStats?.porDefecto) return 0;
    const totalItems = defectosStats.porDefecto.reduce((acc, d) => acc + d.total, 0);
    const totalAprobados = defectosStats.porDefecto.reduce((acc, d) => acc + d.aprobados, 0);
    return totalItems > 0 ? (totalAprobados / totalItems) * 100 : 0;
  }, [defectosStats]);

  const severidadColors: Record<string, string> = {
    leve: "#10B981",
    moderado: "#F59E0B",
    grave: "#F97316",
    critico: "#EF4444",
  };

  const severidadData = useMemo(() => {
    if (!defectosStats?.porSeveridad) return [];
    return defectosStats.porSeveridad.map(item => ({
      name: item.severidad.charAt(0).toUpperCase() + item.severidad.slice(1),
      value: item.total,
      color: severidadColors[item.severidad] || "#6B7280",
    })).sort((a, b) => b.value - a.value);
  }, [defectosStats]);

  // Obtener nombre del filtro activo
  const getFilterLabel = (key: string, value: string) => {
    switch (key) {
      case 'empresaId':
        return empresas?.find(e => e.id.toString() === value)?.nombre || value;
      case 'especialidadId':
        return especialidades?.find(e => e.id.toString() === value)?.nombre || value;
      case 'usuarioId':
        return usuarios?.find(u => u.id.toString() === value)?.name || value;
      case 'unidadId':
        return unidades?.find(u => u.id.toString() === value)?.nombre || value;
      case 'espacioId':
        return espacios?.find(e => e.id.toString() === value)?.nombre || value;
      case 'defectoId':
        return defectos?.find(d => d.id.toString() === value)?.nombre || value;
      case 'nivel':
        return `Nivel ${value}`;
      case 'status':
        return statusOptions.find(s => s.value === value)?.label || value;
      default:
        return value;
    }
  };

  // Mostrar loading si aún no se resuelve el proyecto
  if (!selectedProjectId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Cargando proyecto...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-full overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Estadísticas</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Análisis y métricas del control de calidad
            </p>
          </div>
          <div className="flex gap-2">
            {/* Botón PDF Pendientes de Aprobación */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                if (!itemsReporteData?.items) {
                  toast.error('No hay datos disponibles');
                  return;
                }
                const pendientes = itemsReporteData.items.filter((i: any) => i.status === 'pendiente_aprobacion');
                if (pendientes.length === 0) {
                  toast.info('No hay ítems pendientes de aprobación');
                  return;
                }
                const win = window.open('', '_blank');
                if (!win) { toast.error('Permite ventanas emergentes'); return; }
                const removeAccents = (str: string) => str?.normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
                const rows = pendientes.map((item: any, idx: number) => {
                  const fecha = item.fechaCreacion ? new Date(item.fechaCreacion).toLocaleDateString('es-MX') : 'N/A';
                  return `<tr style="${idx % 2 === 0 ? '' : 'background:#f8fafc'}">
                    <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px;font-weight:600">${removeAccents(item.codigo || '')}</td>
                    <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${removeAccents(item.titulo || item.descripcion || '').substring(0, 80)}</td>
                    <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${removeAccents(item.empresaNombre || 'N/A')}</td>
                    <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${removeAccents(item.especialidadNombre || 'N/A')}</td>
                    <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${removeAccents(item.unidadNombre || 'N/A')}</td>
                    <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${removeAccents(item.residenteNombre || 'N/A')}</td>
                    <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${removeAccents(item.creadoPorNombre || 'N/A')}</td>
                    <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px;white-space:nowrap">${fecha}</td>
                    <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px;text-align:center">${item.fotoAntesUrl ? '<span style="color:#02B381">Si</span>' : '<span style="color:#ef4444">No</span>'}</td>
                    <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px;text-align:center">${item.fotoDespuesUrl ? '<span style="color:#02B381">Si</span>' : '<span style="color:#ef4444">No</span>'}</td>
                  </tr>`;
                }).join('');
                win.document.write(`<!DOCTYPE html><html><head><title>Pendientes Aprobacion</title>
                  <style>
                    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
                    @media print { body { margin: 10px; } .no-print { display: none; } table { font-size: 10px; } }
                  </style></head><body>
                  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;border-bottom:3px solid #02B381;padding-bottom:12px">
                    <div>
                      <h1 style="margin:0;font-size:20px;color:#002C63">Items Pendientes de Aprobacion</h1>
                      <p style="margin:4px 0 0;font-size:13px;color:#666">Proyecto: ${removeAccents(proyectoNombre)} | Total: ${pendientes.length} items | Fecha: ${new Date().toLocaleDateString('es-MX')}</p>
                    </div>
                  </div>
                  <table style="width:100%;border-collapse:collapse">
                    <thead><tr style="background:#002C63;color:white">
                      <th style="padding:8px;text-align:left;font-size:11px">Codigo</th>
                      <th style="padding:8px;text-align:left;font-size:11px">Descripcion</th>
                      <th style="padding:8px;text-align:left;font-size:11px">Empresa</th>
                      <th style="padding:8px;text-align:left;font-size:11px">Especialidad</th>
                      <th style="padding:8px;text-align:left;font-size:11px">Unidad</th>
                      <th style="padding:8px;text-align:left;font-size:11px">Residente</th>
                      <th style="padding:8px;text-align:left;font-size:11px">Capturado por</th>
                      <th style="padding:8px;text-align:left;font-size:11px">Fecha</th>
                      <th style="padding:8px;text-align:center;font-size:11px">F.Antes</th>
                      <th style="padding:8px;text-align:center;font-size:11px">F.Despues</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                  </table>
                  <div class="no-print" style="margin-top:20px;text-align:center">
                    <button onclick="window.print()" style="padding:10px 24px;background:#02B381;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px">Imprimir / Guardar PDF</button>
                  </div>
                </body></html>`);
                win.document.close();
                toast.success(`PDF generado con ${pendientes.length} pendientes`);
              }}
              className="text-amber-600 border-amber-200 hover:bg-amber-50"
            >
              <ShieldCheck className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Pendientes</span>
            </Button>
            {/* Botón Descargar PDF - Reporte Completo */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => {
                try {
                  console.log('PDF: Iniciando generación...');
                  await generarReporteEstadisticasPDF({
                    proyectoNombre,
                    stats: stats || null,
                    empresas: empresas || null,
                    especialidades: especialidades || null,
                    defectosStats: defectosStats || null,
                    penalizaciones: penalizaciones || null,
                    kpis: kpisData || null,
                    rendimiento: rendimientoData || null,
                    defectosPorUsuario: defectosPorUsuarioData || null,
                    firmantes: firmantesData || null,
                    itemsReporte: itemsReporteData || null,
                  });
                  console.log('PDF: Generación completada');
                } catch (err) {
                  console.error('PDF ERROR:', err);
                }
              }}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <FileDown className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">PDF Completo</span>
            </Button>
            {/* Menú de exportación Excel/CSV */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileText className="h-4 w-4 mr-2 text-blue-600" />
                  CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Barra de Multifiltros */}
        <div className="flex flex-wrap gap-2 items-center p-3 bg-slate-50 rounded-lg border">
          {/* Filtro Empresa */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={filters.empresaId ? "default" : "outline"} 
                size="sm"
                className={filters.empresaId ? "bg-[#002C63]" : ""}
              >
                <Building2 className="h-4 w-4 mr-1" />
                Empresa
                {filters.empresaId && <span className="ml-1 text-xs">✓</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <Select
                value={filters.empresaId}
                onValueChange={(value) => setFilters({ ...filters, empresaId: value === "all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las empresas</SelectItem>
                  {empresas?.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id.toString()}>
                      {empresa.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          {/* Filtro Especialidad */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={filters.especialidadId ? "default" : "outline"} 
                size="sm"
                className={filters.especialidadId ? "bg-[#002C63]" : ""}
              >
                <Wrench className="h-4 w-4 mr-1" />
                Especialidad
                {filters.especialidadId && <span className="ml-1 text-xs">✓</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <Select
                value={filters.especialidadId}
                onValueChange={(value) => setFilters({ ...filters, especialidadId: value === "all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar especialidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las especialidades</SelectItem>
                  {especialidades?.map((esp) => (
                    <SelectItem key={esp.id} value={esp.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: esp.color || '#6B7280' }}
                        />
                        {esp.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          {/* Filtro Usuario */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={filters.usuarioId ? "default" : "outline"} 
                size="sm"
                className={filters.usuarioId ? "bg-[#002C63]" : ""}
              >
                <User className="h-4 w-4 mr-1" />
                Usuario
                {filters.usuarioId && <span className="ml-1 text-xs">✓</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <Select
                value={filters.usuarioId}
                onValueChange={(value) => setFilters({ ...filters, usuarioId: value === "all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {usuarios?.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name || 'Sin nombre'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          {/* Filtro Nivel */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={filters.nivel ? "default" : "outline"} 
                size="sm"
                className={filters.nivel ? "bg-[#002C63]" : ""}
              >
                <Layers className="h-4 w-4 mr-1" />
                Nivel
                {filters.nivel && <span className="ml-1 text-xs">✓</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2">
              <Select
                value={filters.nivel}
                onValueChange={(value) => setFilters({ ...filters, nivel: value === "all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los niveles</SelectItem>
                  {niveles.map((nivel) => (
                    <SelectItem key={nivel} value={nivel?.toString() || ""}>
                      Nivel {nivel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          {/* Filtro Unidad */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={filters.unidadId ? "default" : "outline"} 
                size="sm"
                className={filters.unidadId ? "bg-[#002C63]" : ""}
              >
                <MapPin className="h-4 w-4 mr-1" />
                Unidad
                {filters.unidadId && <span className="ml-1 text-xs">✓</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <Select
                value={filters.unidadId}
                onValueChange={(value) => setFilters({ ...filters, unidadId: value === "all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las unidades</SelectItem>
                  {unidades?.map((unidad) => (
                    <SelectItem key={unidad.id} value={unidad.id.toString()}>
                      {unidad.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          {/* Filtro Espacio */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={filters.espacioId ? "default" : "outline"} 
                size="sm"
                className={filters.espacioId ? "bg-[#002C63]" : ""}
              >
                <Home className="h-4 w-4 mr-1" />
                Espacio
                {filters.espacioId && <span className="ml-1 text-xs">✓</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <Select
                value={filters.espacioId}
                onValueChange={(value) => setFilters({ ...filters, espacioId: value === "all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar espacio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los espacios</SelectItem>
                  {espacios?.map((espacio) => (
                    <SelectItem key={espacio.id} value={espacio.id.toString()}>
                      {espacio.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          {/* Filtro Defecto */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={filters.defectoId ? "default" : "outline"} 
                size="sm"
                className={filters.defectoId ? "bg-[#002C63]" : ""}
              >
                <Wrench className="h-4 w-4 mr-1" />
                Defecto
                {filters.defectoId && <span className="ml-1 text-xs">✓</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <Select
                value={filters.defectoId}
                onValueChange={(value) => setFilters({ ...filters, defectoId: value === "all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar defecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los defectos</SelectItem>
                  {defectos?.map((defecto) => (
                    <SelectItem key={defecto.id} value={defecto.id.toString()}>
                      {defecto.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          {/* Filtro Estatus */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={filters.status ? "default" : "outline"} 
                size="sm"
                className={filters.status ? "bg-[#002C63]" : ""}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Estatus
                {filters.status && <span className="ml-1 text-xs">✓</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2">
              <div className="space-y-1">
                {statusOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={filters.status === option.value ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setFilters({ ...filters, status: filters.status === option.value ? "" : option.value })}
                  >
                    <div className={`h-3 w-3 rounded-full ${option.color} mr-2`} />
                    {option.label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Limpiar filtros */}
          {activeFiltersCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-1" />
              Limpiar ({activeFiltersCount})
            </Button>
          )}
        </div>

        {/* Filtros activos como badges */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => {
              if (!value) return null;
              return (
                <Badge 
                  key={key} 
                  variant="secondary" 
                  className="pl-2 pr-1 py-1 flex items-center gap-1"
                >
                  {getFilterLabel(key, value)}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => clearFilter(key as keyof typeof filters)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        )}

        {/* KPIs */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Ítems
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendientes
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-amber-600">
                {(Number(stats?.porStatus?.find(s => s.status === 'pendiente_foto_despues')?.count) || 0) +
                 (Number(stats?.porStatus?.find(s => s.status === 'pendiente_aprobacion')?.count) || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aprobados
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-emerald-600">
                {Number(stats?.porStatus?.find(s => s.status === 'aprobado')?.count) || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rechazados
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-red-600">
                {Number(stats?.porStatus?.find(s => s.status === 'rechazado')?.count) || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Distribución por Estado - Donut Profesional */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[#002C63]">
                <PieChart className="h-5 w-5" />
                Distribución por Estado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative">
                    <ResponsiveContainer width={220} height={220}>
                      <RechartsPie>
                        <defs>
                          {statusData.map((entry, i) => (
                            <linearGradient key={`grad-status-${i}`} id={`gradStatus${i}`} x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                              <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                            </linearGradient>
                          ))}
                        </defs>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="#fff"
                          strokeWidth={2}
                          animationBegin={0}
                          animationDuration={800}
                        >
                          {statusData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={`url(#gradStatus${index})`} />
                          ))}
                        </Pie>
                        <Tooltip content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          const total = statusData.reduce((s, x) => s + x.value, 0);
                          return (
                            <div className="bg-white rounded-lg shadow-lg border p-3 text-xs">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                                <span className="font-semibold">{d.name}</span>
                              </div>
                              <div className="text-gray-600">{d.value} ítems ({((d.value / total) * 100).toFixed(1)}%)</div>
                            </div>
                          );
                        }} />
                      </RechartsPie>
                    </ResponsiveContainer>
                    {/* Centro del donut */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-bold text-[#002C63]">{stats?.total || 0}</span>
                      <span className="text-[10px] text-muted-foreground">Total</span>
                    </div>
                  </div>
                  {/* Leyenda lateral */}
                  <div className="flex flex-col gap-2 text-sm">
                    {statusData.map((item, i) => {
                      const total = statusData.reduce((s, x) => s + x.value, 0);
                      const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <div className="flex-1">
                            <div className="font-medium text-xs">{item.name}</div>
                            <div className="text-muted-foreground text-[10px]">{item.value} ({pct}%)</div>
                          </div>
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                  No hay datos disponibles
                </div>
              )}
            </CardContent>
          </Card>

          {/* Por Empresa - Barras con gradiente */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[#002C63]">
                <Building2 className="h-5 w-5" />
                Ítems por Empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {empresaData.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(220, empresaData.length * 50)}>
                  <BarChart data={empresaData} layout="vertical" margin={{ left: 10, right: 40 }}>
                    <defs>
                      <linearGradient id="gradEmpresa" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#002C63" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={110} 
                      tick={{ fontSize: 11, fill: '#334155' }} 
                      tickFormatter={(value) => value.length > 14 ? value.substring(0, 14) + '...' : value}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white rounded-lg shadow-lg border p-3 text-xs">
                          <div className="font-semibold mb-1">{payload[0].payload.name}</div>
                          <div className="text-[#002C63] font-bold">{payload[0].value} ítems</div>
                        </div>
                      );
                    }} />
                    <Bar dataKey="total" fill="url(#gradEmpresa)" radius={[0, 6, 6, 0]} barSize={28} animationDuration={800}>
                      <LabelList dataKey="total" position="right" fill="#002C63" fontSize={12} fontWeight="bold" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                  No hay datos disponibles
                </div>
              )}
            </CardContent>
          </Card>

          {/* Por Especialidad - Barras con colores individuales */}
          <Card className="lg:col-span-2 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[#002C63]">
                <Wrench className="h-5 w-5" />
                Ítems por Especialidad
              </CardTitle>
            </CardHeader>
            <CardContent>
              {especialidadData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={especialidadData} margin={{ bottom: 70, top: 20 }}>
                    <defs>
                      {especialidadData.map((entry, i) => (
                        <linearGradient key={`grad-esp-${i}`} id={`gradEsp${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                          <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 10, fill: '#334155' }} 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                      tickFormatter={(value) => value && value.length > 12 ? value.substring(0, 12) + '...' : (value || 'Sin nombre')}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white rounded-lg shadow-lg border p-3 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                            <span className="font-semibold">{d.name}</span>
                          </div>
                          <div className="text-gray-600 font-bold">{d.value} ítems</div>
                        </div>
                      );
                    }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40} animationDuration={800}>
                      {especialidadData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#gradEsp${index})`} />
                      ))}
                      <LabelList dataKey="value" position="top" fill="#002C63" fontSize={12} fontWeight="bold" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No hay datos disponibles
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Estadísticas de Defectos */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Estadísticas de Defectos
          </h2>
          
          {/* KPIs de Defectos */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <AlertTriangle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold">{defectosStats?.totalItems || 0}</p>
                    <p className="text-xs text-muted-foreground">Total con Defecto</p>
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
                    <p className="text-xl sm:text-2xl font-bold text-emerald-600">
                      {tasaAprobacionGlobal.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Tasa Aprobación</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-orange-600">
                      {defectosStats?.porSeveridad?.find(s => s.severidad === 'grave')?.total || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Defectos Graves</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-red-600">
                      {defectosStats?.porSeveridad?.find(s => s.severidad === 'critico')?.total || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Defectos Críticos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Por Tipo de Defecto */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-[#002C63]">
                  <BarChart3 className="h-5 w-5" />
                  Top 10 Tipos de Defectos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {defectosData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(280, defectosData.length * 40)}>
                    <BarChart data={defectosData} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <defs>
                        <linearGradient id="gradAprobados" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#34D399" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="gradRechazados" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#F87171" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: '#334155' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.length > 16 ? v.substring(0, 16) + '...' : v} />
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white rounded-lg shadow-lg border p-3 text-xs">
                            <div className="font-semibold mb-2">{d.name}</div>
                            <div className="flex gap-4">
                              <span className="text-emerald-600">Aprobados: {d.aprobados}</span>
                              <span className="text-red-600">Rechazados: {d.rechazados}</span>
                            </div>
                            <div className="text-gray-500 mt-1">Total: {d.total}</div>
                          </div>
                        );
                      }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="aprobados" stackId="a" fill="url(#gradAprobados)" name="Aprobados" radius={[0, 0, 0, 0]} animationDuration={800}>
                        <LabelList dataKey="aprobados" position="center" fill="#fff" fontSize={10} fontWeight="bold" formatter={(v: number) => v > 0 ? v : ''} />
                      </Bar>
                      <Bar dataKey="rechazados" stackId="a" fill="url(#gradRechazados)" name="Rechazados" radius={[0, 6, 6, 0]} animationDuration={800}>
                        <LabelList dataKey="rechazados" position="center" fill="#fff" fontSize={10} fontWeight="bold" formatter={(v: number) => v > 0 ? v : ''} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                    No hay datos de defectos disponibles
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Por Severidad - Donut profesional */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-[#002C63]">
                  <AlertTriangle className="h-5 w-5" />
                  Distribución por Severidad
                </CardTitle>
              </CardHeader>
              <CardContent>
                {severidadData.length > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative">
                      <ResponsiveContainer width={200} height={200}>
                        <RechartsPie>
                          <defs>
                            {severidadData.map((entry, i) => (
                              <linearGradient key={`grad-sev-${i}`} id={`gradSev${i}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                <stop offset="100%" stopColor={entry.color} stopOpacity={0.65} />
                              </linearGradient>
                            ))}
                          </defs>
                          <Pie
                            data={severidadData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="#fff"
                            strokeWidth={2}
                            animationDuration={800}
                          >
                            {severidadData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={`url(#gradSev${index})`} />
                            ))}
                          </Pie>
                          <Tooltip content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            const total = severidadData.reduce((s, x) => s + x.value, 0);
                            return (
                              <div className="bg-white rounded-lg shadow-lg border p-3 text-xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                                  <span className="font-semibold">{d.name}</span>
                                </div>
                                <div className="text-gray-600">{d.value} defectos ({((d.value / total) * 100).toFixed(1)}%)</div>
                              </div>
                            );
                          }} />
                        </RechartsPie>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-bold text-[#002C63]">{severidadData.reduce((s, x) => s + x.value, 0)}</span>
                        <span className="text-[10px] text-muted-foreground">Defectos</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2.5 text-sm">
                      {severidadData.map((item, i) => {
                        const total = severidadData.reduce((s, x) => s + x.value, 0);
                        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <div className="flex-1">
                              <div className="font-medium text-xs">{item.name}</div>
                              <div className="text-muted-foreground text-[10px]">{item.value} ({pct}%)</div>
                            </div>
                            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    No hay datos de severidad disponibles
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Penalizaciones por Empresa */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-red-500" />
            Penalizaciones por Calidad
          </h2>
          <p className="text-muted-foreground text-sm">
            $2,000 MXN por ítem no aprobado — se libera al aprobar por supervisión
          </p>

          {/* KPIs de Penalizaciones */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-3 sm:pt-4">
                <div className="flex flex-col items-center text-center gap-1 sm:flex-row sm:text-left sm:gap-3">
                  <div className="p-2 rounded-lg bg-red-100 shrink-0">
                    <Ban className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base sm:text-xl md:text-2xl font-bold text-red-600 whitespace-nowrap">
                      ${(penalizaciones?.totalActiva || 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">Penalización Activa</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="p-3 sm:pt-4">
                <div className="flex flex-col items-center text-center gap-1 sm:flex-row sm:text-left sm:gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 shrink-0">
                    <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base sm:text-xl md:text-2xl font-bold text-emerald-600 whitespace-nowrap">
                      ${(penalizaciones?.totalLiberada || 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">Penalización Liberada</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:pt-4">
                <div className="flex flex-col items-center text-center gap-1 sm:flex-row sm:text-left sm:gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 shrink-0">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base sm:text-xl md:text-2xl font-bold whitespace-nowrap">
                      ${(penalizaciones?.totalGeneral || 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">Total Acumulado</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:pt-4">
                <div className="flex flex-col items-center text-center gap-1 sm:flex-row sm:text-left sm:gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 shrink-0">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base sm:text-xl md:text-2xl font-bold text-amber-600 whitespace-nowrap">
                      ${(penalizaciones?.montoPorItem || 2000).toLocaleString()}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">Monto por Ítem</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Penalizaciones por Empresa */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Desglose por Contratista
              </CardTitle>
              <CardDescription>
                Penalización acumulada por empresa — se resta al aprobar ítems
              </CardDescription>
            </CardHeader>
            <CardContent>
              {penalizaciones?.porEmpresa && penalizaciones.porEmpresa.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-xs sm:text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2 font-medium">Empresa</th>
                        <th className="text-center p-2 font-medium">Total</th>
                        <th className="text-center p-2 font-medium">No Aprob.</th>
                        <th className="text-center p-2 font-medium">Aprob.</th>
                        <th className="text-right p-2 font-medium text-red-600">Penalización</th>
                        <th className="text-right p-2 font-medium text-emerald-600">Liberada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {penalizaciones.porEmpresa
                        .sort((a, b) => b.penalizacionActiva - a.penalizacionActiva)
                        .map((emp, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/30">
                          <td className="p-2 font-medium">{emp.empresaNombre}</td>
                          <td className="p-2 text-center">{emp.totalItems}</td>
                          <td className="p-2 text-center text-red-600 font-medium">{emp.noAprobados}</td>
                          <td className="p-2 text-center text-emerald-600 font-medium">{emp.aprobados}</td>
                          <td className="p-2 text-right text-red-600 font-bold">${emp.penalizacionActiva.toLocaleString()}</td>
                          <td className="p-2 text-right text-emerald-600 font-bold">${emp.penalizacionLiberada.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-400 bg-muted/50 font-bold">
                        <td className="p-2">TOTAL</td>
                        <td className="p-2 text-center">{penalizaciones.porEmpresa.reduce((s, e) => s + e.totalItems, 0)}</td>
                        <td className="p-2 text-center text-red-600">{penalizaciones.porEmpresa.reduce((s, e) => s + e.noAprobados, 0)}</td>
                        <td className="p-2 text-center text-emerald-600">{penalizaciones.porEmpresa.reduce((s, e) => s + e.aprobados, 0)}</td>
                        <td className="p-2 text-right text-red-600">${penalizaciones.totalActiva.toLocaleString()}</td>
                        <td className="p-2 text-right text-emerald-600">${penalizaciones.totalLiberada.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No hay datos de penalizaciones disponibles
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de barras de penalizaciones */}
          {penalizaciones?.porEmpresa && penalizaciones.porEmpresa.length > 0 && (
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-[#002C63]">
                  <BarChart3 className="h-5 w-5" />
                  Penalizaciones por Contratista
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(250, penalizaciones.porEmpresa.length * 50)}>
                  <BarChart 
                    data={[...penalizaciones.porEmpresa].sort((a, b) => b.penalizacionActiva - a.penalizacionActiva).map(e => ({
                      name: e.empresaNombre.length > 15 ? e.empresaNombre.substring(0, 15) + '...' : e.empresaNombre,
                      fullName: e.empresaNombre,
                      activa: e.penalizacionActiva,
                      liberada: e.penalizacionLiberada,
                    }))}
                    layout="vertical"
                    margin={{ left: 10, right: 30 }}
                  >
                    <defs>
                      <linearGradient id="gradPenActiva" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#F87171" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="gradPenLiberada" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#34D399" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: '#334155' }} axisLine={false} tickLine={false} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white rounded-lg shadow-lg border p-3 text-xs">
                          <div className="font-semibold mb-2">{d.fullName}</div>
                          <div className="flex flex-col gap-1">
                            <span className="text-red-600">Activa: ${d.activa.toLocaleString()}</span>
                            <span className="text-emerald-600">Liberada: ${d.liberada.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="activa" fill="url(#gradPenActiva)" name="Penalización Activa" stackId="a" radius={[0, 0, 0, 0]} barSize={28} animationDuration={800}>
                      <LabelList dataKey="activa" position="center" fill="#fff" fontSize={10} fontWeight="bold" formatter={(v: number) => v > 0 ? `$${(v/1000).toFixed(0)}k` : ''} />
                    </Bar>
                    <Bar dataKey="liberada" fill="url(#gradPenLiberada)" name="Liberada" stackId="a" radius={[0, 6, 6, 0]} barSize={28} animationDuration={800}>
                      <LabelList dataKey="liberada" position="center" fill="#fff" fontSize={10} fontWeight="bold" formatter={(v: number) => v > 0 ? `$${(v/1000).toFixed(0)}k` : ''} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* KPIs Mejores y Peores */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#002C63]" />
            Ranking de Rendimiento
          </h2>
          <p className="text-muted-foreground text-sm">
            Comparativa de mejores y peores por categoría (barras horizontales)
          </p>
          
          <KPIsMejoresPeores />
        </div>

        {/* Estadísticas de Rendimiento por Usuario */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Rendimiento por Usuario
          </h2>
          
          <RendimientoUsuarios />
        </div>

        {/* Firmas de Especialidades */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Pen className="h-5 w-5 text-[#002C63]" />
                Firmas por Especialidad
              </h2>
              <p className="text-muted-foreground text-sm">
                Responsables de calidad por especialidad y empresa contratista
              </p>
            </div>
            <EnviarParaFirmaButton firmantes={firmantesData} proyectoId={selectedProjectId} />
          </div>
          <FirmasEspecialidades />
        </div>
      </div>
    </DashboardLayout>
  );
}

// Componente de Rendimiento de Usuarios
function RendimientoUsuarios() {
  const { selectedProjectId } = useProject();
  const { data: rendimiento, isLoading } = trpc.estadisticasAvanzadas.rendimientoUsuarios.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: true }
  );
  const { data: defectosPorUsuario } = trpc.estadisticasAvanzadas.defectosPorUsuario.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: true }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Preparar datos de defectos por usuario
  const defectosData = defectosPorUsuario?.slice(0, 10).map((item: any) => ({
    name: item.usuarioNombre || 'Usuario',
    defectos: item.totalDefectos,
    aprobados: item.aprobados,
    rechazados: item.rechazados,
  })) || [];

  // Preparar datos de tiempos de respuesta
  const tiemposData = rendimiento?.slice(0, 10).map((item: any) => ({
    name: item.usuarioNombre || 'Usuario',
    tiempoPromedio: item.tiempoPromedioHoras || 0,
    itemsCompletados: item.itemsCompletados || 0,
  })) || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPIs de Rendimiento */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">{rendimiento?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Usuarios Activos</p>
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
                <p className="text-xl sm:text-2xl font-bold text-emerald-600">
                  {rendimiento?.reduce((acc: number, u: any) => acc + (u.aprobados || 0), 0) || 0}
                </p>
                <p className="text-xs text-muted-foreground">Total Aprobados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">
                  {rendimiento && rendimiento.length > 0 
                    ? (rendimiento.reduce((acc: number, u: any) => acc + (u.tiempoPromedioHoras || 0), 0) / rendimiento.length).toFixed(1)
                    : 0}h
                </p>
                <p className="text-xs text-muted-foreground">Tiempo Promedio</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-purple-600">
                  {rendimiento?.reduce((acc: number, u: any) => acc + (u.okSupervisor || 0), 0) || 0}
                </p>
                <p className="text-xs text-muted-foreground">OK Supervisor</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Defectos por Usuario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Defectos por Usuario (Top 10)
            </CardTitle>
            <CardDescription>
              Ranking de usuarios por número de defectos registrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {defectosData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={defectosData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="aprobados" stackId="a" fill="#10B981" name="Aprobados">
                    <LabelList dataKey="aprobados" position="center" fill="#fff" fontSize={10} fontWeight="bold" />
                  </Bar>
                  <Bar dataKey="rechazados" stackId="a" fill="#EF4444" name="Rechazados">
                    <LabelList dataKey="rechazados" position="center" fill="#fff" fontSize={10} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay datos disponibles
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tiempos de Respuesta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tiempos de Respuesta por Usuario
            </CardTitle>
            <CardDescription>
              Tiempo promedio en horas para completar ítems
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tiemposData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tiemposData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" unit="h" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}h`, 'Tiempo Promedio']} />
                  <Bar dataKey="tiempoPromedio" fill="#3B82F6" name="Tiempo (horas)">
                    <LabelList dataKey="tiempoPromedio" position="right" fill="#333" fontSize={10} fontWeight="bold" formatter={(value: number) => `${value.toFixed(1)}h`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay datos disponibles
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Rendimiento Detallado */}
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento Detallado por Usuario</CardTitle>
          <CardDescription>
            Métricas completas de productividad y calidad
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-xs sm:text-sm min-w-[600px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium whitespace-nowrap min-w-[120px]">Usuario</th>
                  <th className="text-left p-2 font-medium whitespace-nowrap min-w-[80px]">Rol</th>
                  <th className="text-center p-2 font-medium whitespace-nowrap">Total</th>
                  <th className="text-center p-2 font-medium whitespace-nowrap">✅</th>
                  <th className="text-center p-2 font-medium whitespace-nowrap">❌</th>
                  <th className="text-center p-2 font-medium whitespace-nowrap">OK</th>
                  <th className="text-center p-2 font-medium whitespace-nowrap">Tiempo</th>
                  <th className="text-center p-2 font-medium whitespace-nowrap">Efic.</th>
                </tr>
              </thead>
              <tbody>
                {rendimiento?.map((usuario: any, index: number) => {
                  const eficiencia = usuario.itemsCompletados > 0 
                    ? ((usuario.aprobados / usuario.itemsCompletados) * 100).toFixed(0)
                    : 0;
                  // Formatear nombre para móvil
                  const nombreCorto = usuario.usuarioNombre?.length > 15 
                    ? usuario.usuarioNombre.substring(0, 15) + '...' 
                    : usuario.usuarioNombre;
                  // Formatear rol para móvil
                  const rolCorto = usuario.usuarioRol === 'supervisor' ? 'super' :
                    usuario.usuarioRol === 'jefe_residente' ? 'jefe' :
                    usuario.usuarioRol === 'residente' ? 'resi' :
                    usuario.usuarioRol === 'admin' ? 'admin' :
                    usuario.usuarioRol?.substring(0, 5) || '-';
                  return (
                    <tr key={index} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-medium whitespace-nowrap" title={usuario.usuarioNombre}>{nombreCorto}</td>
                      <td className="p-2 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs ${
                          usuario.usuarioRol === 'supervisor' ? 'bg-emerald-100 text-emerald-800' :
                          usuario.usuarioRol === 'jefe_residente' ? 'bg-amber-100 text-amber-800' :
                          usuario.usuarioRol === 'admin' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {rolCorto}
                        </span>
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">{usuario.itemsCompletados}</td>
                      <td className="p-2 text-center text-emerald-600 font-medium whitespace-nowrap">{usuario.aprobados}</td>
                      <td className="p-2 text-center text-red-600 font-medium whitespace-nowrap">{usuario.rechazados}</td>
                      <td className="p-2 text-center text-blue-600 font-medium whitespace-nowrap">{usuario.okSupervisor}</td>
                      <td className="p-2 text-center whitespace-nowrap">{usuario.tiempoPromedioHoras?.toFixed(1) || 0}h</td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <span className={`font-medium ${
                          Number(eficiencia) >= 80 ? 'text-emerald-600' :
                          Number(eficiencia) >= 60 ? 'text-amber-600' :
                          'text-red-600'
                        }`}>
                          {eficiencia}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente de Firmas por Especialidad
function FirmasEspecialidades() {
  const { selectedProjectId } = useProject();
  const { data: firmantes, isLoading } = trpc.estadisticas.firmantesReporte.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!firmantes || firmantes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No hay empresas/especialidades registradas para este proyecto
        </CardContent>
      </Card>
    );
  }

  // Agrupar por especialidad
  const porEspecialidad = firmantes.reduce<Record<string, typeof firmantes>>((acc, f) => {
    const esp = f.especialidadNombre || 'Sin Especialidad';
    if (!acc[esp]) acc[esp] = [];
    acc[esp].push(f);
    return acc;
  }, {});

  const especialidadColors: Record<string, string> = {
    'Tablaroca y Plafón': '#3B82F6',
    'Pasta': '#EC4899',
    'Aluminio y Vidrio': '#06B6D4',
    'Pintura': '#8B5CF6',
    'Herrería': '#F59E0B',
    'Impermeabilización': '#10B981',
    'Eléctrica': '#EF4444',
    'Hidráulica': '#0EA5E9',
    'Acabados': '#F97316',
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(porEspecialidad).map(([especialidad, empresas]) => {
        const color = especialidadColors[especialidad] || '#6B7280';
        return (
          <Card key={especialidad} className="shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            {/* Header con color de especialidad */}
            <div className="h-1.5" style={{ backgroundColor: color }} />
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[#002C63]">{especialidad}</span>
                <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {empresas.length} {empresas.length === 1 ? 'empresa' : 'empresas'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {empresas.map((emp, idx) => (
                  <div key={idx} className="border-b last:border-0 pb-3 last:pb-0">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded-md bg-gray-50">
                        <Building2 className="h-3.5 w-3.5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate" title={emp.empresaNombre}>
                          {emp.empresaNombre}
                        </p>
                        {emp.jefeNombre ? (
                          <div className="flex items-center gap-1 mt-1">
                            <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-[11px] text-muted-foreground truncate" title={emp.jefeNombre}>
                              {emp.jefeNombre}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Sin jefe asignado</span>
                        )}
                      </div>
                    </div>
                    {/* Línea de firma */}
                    <div className="mt-4 pt-2">
                      <div className="border-b border-dashed border-gray-300 mb-1" />
                      <p className="text-[9px] text-center text-muted-foreground">
                        Firma — {emp.jefeNombre || emp.empresaNombre}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}


// Componente para enviar reporte para firma electrónica
function EnviarParaFirmaButton({ firmantes, proyectoId }: { firmantes: any; proyectoId: number | null }) {
  const [sending, setSending] = useState(false);
  const crearFirmas = trpc.firmas.crearParaReporte.useMutation();
  const registrarCorreo = trpc.bitacoraCorreos.registrar.useMutation();

  const handleEnviar = async () => {
    if (!firmantes || firmantes.length === 0 || !proyectoId) {
      toast.error('No hay empresas para enviar');
      return;
    }
    setSending(true);
    try {
      // Generar ID único para este reporte
      const reporteId = `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Crear firmas para cada empresa
      const empresasUnicas = firmantes.reduce((acc: any[], f: any) => {
        if (!acc.find((e: any) => e.empresaId === f.empresaId)) {
          acc.push({
            empresaId: f.empresaId,
            empresaNombre: f.empresaNombre,
            contactoNombre: f.jefeNombre || undefined,
            contactoEmail: f.jefeEmail || undefined,
          });
        }
        return acc;
      }, []);

      const firmasResult = await crearFirmas.mutateAsync({
        proyectoId,
        reporteId,
        empresas: empresasUnicas,
      });

      // Registrar en bitácora de correos por cada empresa
      const leyenda = "Acepto y atiendo en oportunidad los ítems en los que se hace mención a mi empresa.";
      
      for (const emp of empresasUnicas) {
        await registrarCorreo.mutateAsync({
          proyectoId,
          reporteId,
          tipo: 'firma_reporte',
          destinatarioEmail: emp.contactoEmail || 'sin-email@pendiente.com',
          destinatarioNombre: emp.contactoNombre,
          destinatarioEmpresa: emp.empresaNombre,
          asunto: `Firma requerida - Reporte de Calidad ${reporteId}`,
          contenido: `Se requiere su firma electrónica para el reporte de calidad. Enlace de firma disponible en el sistema.`,
          leyenda,
        });
      }

      toast.success(
        `Reporte enviado para firma a ${empresasUnicas.length} empresa(s)`,
        { description: `ID: ${reporteId}. Los enlaces de firma están disponibles.`, duration: 5000 }
      );
    } catch (error: any) {
      console.error('Error enviando para firma:', error);
      toast.error('Error al enviar para firma', { description: error.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      onClick={handleEnviar}
      disabled={sending || !firmantes || firmantes.length === 0}
      className="bg-[#002C63] hover:bg-[#003d8f] text-white"
      size="sm"
    >
      {sending ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Send className="h-4 w-4 mr-1" />
      )}
      <span className="hidden sm:inline">Enviar para Firma</span>
      <span className="sm:hidden">Firmas</span>
    </Button>
  );
}
