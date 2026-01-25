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
  Camera
} from "lucide-react";
import { useState, useMemo } from "react";
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

  const { data: empresas } = trpc.empresas.list.useQuery();
  const { data: unidades } = trpc.unidades.list.useQuery();
  const { data: especialidades } = trpc.especialidades.list.useQuery();
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
      </div>
    </DashboardLayout>
  );
}
