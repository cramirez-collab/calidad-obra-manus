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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Camera,
  AlertTriangle
} from "lucide-react";
import { useState, useMemo } from "react";
import { useProject } from "@/contexts/ProjectContext";
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
} from "recharts";

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

export default function Estadisticas() {
  const { selectedProjectId } = useProject();
  const [filters, setFilters] = useState({
    empresaId: "",
    unidadId: "",
    especialidadId: "",
    residenteId: "",
    supervisorId: "",
    fechaInicio: "",
    fechaFin: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data: empresas } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: unidades } = trpc.unidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: usuarios } = trpc.users.list.useQuery();

  const queryFilters = useMemo(() => ({
    empresaId: filters.empresaId ? parseInt(filters.empresaId) : undefined,
    unidadId: filters.unidadId ? parseInt(filters.unidadId) : undefined,
    especialidadId: filters.especialidadId ? parseInt(filters.especialidadId) : undefined,
    residenteId: filters.residenteId ? parseInt(filters.residenteId) : undefined,
    supervisorId: filters.supervisorId ? parseInt(filters.supervisorId) : undefined,
    fechaInicio: filters.fechaInicio ? new Date(filters.fechaInicio) : undefined,
    fechaFin: filters.fechaFin ? new Date(filters.fechaFin) : undefined,
  }), [filters]);

  const { data: stats, isLoading, refetch } = trpc.estadisticas.general.useQuery(queryFilters);
  const { data: defectosStats } = trpc.defectos.estadisticas.useQuery();

  const clearFilters = () => {
    setFilters({
      empresaId: "",
      unidadId: "",
      especialidadId: "",
      residenteId: "",
      supervisorId: "",
      fechaInicio: "",
      fechaFin: "",
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== "");

  const getExportParams = () => {
    const params = new URLSearchParams();
    if (filters.empresaId) params.append("empresaId", filters.empresaId);
    if (filters.unidadId) params.append("unidadId", filters.unidadId);
    if (filters.especialidadId) params.append("especialidadId", filters.especialidadId);
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
    }));
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
    });
  }, [stats, especialidades]);

  // Datos de defectos para gráficos
  const defectosData = useMemo(() => {
    if (!defectosStats?.porDefecto) return [];
    return defectosStats.porDefecto.slice(0, 10).map(item => ({
      name: item.defecto?.nombre || 'Sin nombre',
      total: item.total,
      aprobados: item.aprobados,
      rechazados: item.rechazados,
    }));
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
    }));
  }, [defectosStats]);

  const residentes = usuarios?.filter(u => u.role === 'residente' || u.role === 'jefe_residente') || [];
  const supervisores = usuarios?.filter(u => u.role === 'supervisor' || u.role === 'admin') || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Estadísticas</h1>
            <p className="text-muted-foreground">
              Análisis y métricas del control de calidad
            </p>
          </div>
          <div className="flex gap-2">
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
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Button
              variant={showFilters ? "secondary" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros</CardTitle>
              <CardDescription>
                Filtra las estadísticas por diferentes criterios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select
                    value={filters.empresaId}
                    onValueChange={(value) => setFilters({ ...filters, empresaId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
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
                </div>

                <div className="space-y-2">
                  <Label>Unidad</Label>
                  <Select
                    value={filters.unidadId}
                    onValueChange={(value) => setFilters({ ...filters, unidadId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
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
                </div>

                <div className="space-y-2">
                  <Label>Especialidad</Label>
                  <Select
                    value={filters.especialidadId}
                    onValueChange={(value) => setFilters({ ...filters, especialidadId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las especialidades</SelectItem>
                      {especialidades?.map((esp) => (
                        <SelectItem key={esp.id} value={esp.id.toString()}>
                          {esp.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Residente</Label>
                  <Select
                    value={filters.residenteId}
                    onValueChange={(value) => setFilters({ ...filters, residenteId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los residentes</SelectItem>
                      {residentes.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Supervisor</Label>
                  <Select
                    value={filters.supervisorId}
                    onValueChange={(value) => setFilters({ ...filters, supervisorId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los supervisores</SelectItem>
                      {supervisores.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fecha Inicio</Label>
                  <Input
                    type="date"
                    value={filters.fechaInicio}
                    onChange={(e) => setFilters({ ...filters, fechaInicio: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Fecha Fin</Label>
                  <Input
                    type="date"
                    value={filters.fechaFin}
                    onChange={(e) => setFilters({ ...filters, fechaFin: e.target.value })}
                  />
                </div>

                {hasActiveFilters && (
                  <div className="flex items-end">
                    <Button variant="ghost" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Ítems
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
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
              <div className="text-2xl font-bold text-amber-600">
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
              <div className="text-2xl font-bold text-emerald-600">
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
              <div className="text-2xl font-bold text-red-600">
                {Number(stats?.porStatus?.find(s => s.status === 'rechazado')?.count) || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Distribución por Estado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Distribución por Estado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPie>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No hay datos disponibles
                </div>
              )}
            </CardContent>
          </Card>

          {/* Por Empresa */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Ítems por Empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {empresaData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={empresaData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No hay datos disponibles
                </div>
              )}
            </CardContent>
          </Card>

          {/* Por Especialidad */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Ítems por Especialidad
              </CardTitle>
            </CardHeader>
            <CardContent>
              {especialidadData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={especialidadData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {especialidadData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
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
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <AlertTriangle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{defectosStats?.totalItems || 0}</p>
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
                    <p className="text-2xl font-bold text-emerald-600">
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
                    <p className="text-2xl font-bold text-orange-600">
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
                    <p className="text-2xl font-bold text-red-600">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Top 10 Tipos de Defectos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {defectosData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={defectosData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="aprobados" stackId="a" fill="#10B981" name="Aprobados" />
                      <Bar dataKey="rechazados" stackId="a" fill="#EF4444" name="Rechazados" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No hay datos de defectos disponibles
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Por Severidad */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Distribución por Severidad
                </CardTitle>
              </CardHeader>
              <CardContent>
                {severidadData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPie>
                      <Pie
                        data={severidadData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {severidadData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No hay datos de severidad disponibles
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Estadísticas de Rendimiento por Usuario */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Rendimiento por Usuario
          </h2>
          
          <RendimientoUsuarios />
        </div>
      </div>
    </DashboardLayout>
  );
}

// Componente de Rendimiento de Usuarios
function RendimientoUsuarios() {
  const { data: rendimiento, isLoading } = trpc.estadisticasAvanzadas.rendimientoUsuarios.useQuery();
  const { data: defectosPorUsuario } = trpc.estadisticasAvanzadas.defectosPorUsuario.useQuery();

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
    <div className="space-y-6">
      {/* KPIs de Rendimiento */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rendimiento?.length || 0}</p>
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
                <p className="text-2xl font-bold text-emerald-600">
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
                <p className="text-2xl font-bold text-amber-600">
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
                <p className="text-2xl font-bold text-purple-600">
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
                  <Bar dataKey="aprobados" stackId="a" fill="#10B981" name="Aprobados" />
                  <Bar dataKey="rechazados" stackId="a" fill="#EF4444" name="Rechazados" />
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
                  <Bar dataKey="tiempoPromedio" fill="#3B82F6" name="Tiempo (horas)" />
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Usuario</th>
                  <th className="text-left p-2 font-medium">Rol</th>
                  <th className="text-center p-2 font-medium">Total Ítems</th>
                  <th className="text-center p-2 font-medium">Aprobados</th>
                  <th className="text-center p-2 font-medium">Rechazados</th>
                  <th className="text-center p-2 font-medium">OK Supervisor</th>
                  <th className="text-center p-2 font-medium">Tiempo Prom.</th>
                  <th className="text-center p-2 font-medium">Eficiencia</th>
                </tr>
              </thead>
              <tbody>
                {rendimiento?.map((usuario: any, index: number) => {
                  const eficiencia = usuario.itemsCompletados > 0 
                    ? ((usuario.aprobados / usuario.itemsCompletados) * 100).toFixed(0)
                    : 0;
                  return (
                    <tr key={index} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-medium">{usuario.usuarioNombre}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          usuario.usuarioRol === 'supervisor' ? 'bg-emerald-100 text-emerald-800' :
                          usuario.usuarioRol === 'jefe_residente' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {usuario.usuarioRol}
                        </span>
                      </td>
                      <td className="p-2 text-center">{usuario.itemsCompletados}</td>
                      <td className="p-2 text-center text-emerald-600 font-medium">{usuario.aprobados}</td>
                      <td className="p-2 text-center text-red-600 font-medium">{usuario.rechazados}</td>
                      <td className="p-2 text-center text-blue-600 font-medium">{usuario.okSupervisor}</td>
                      <td className="p-2 text-center">{usuario.tiempoPromedioHoras?.toFixed(1) || 0}h</td>
                      <td className="p-2 text-center">
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
