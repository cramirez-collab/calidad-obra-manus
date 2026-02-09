import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  BarChart3,
  PieChart,
  Activity,
  Target,
  Users,
  Building2,
  Loader2,
  RefreshCw,
  FileDown
} from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { 
  crearPDFUnificado, 
  agregarSeccion, 
  agregarTablaUnificada, 
  agregarResumen,
  descargarPDFUnificado 
} from "@/lib/pdfUnificado";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6'];

export default function KPIs() {
  const { selectedProjectId } = useProject();
  const [filtros, setFiltros] = useState<{
    empresaId?: number;
    unidadId?: number;
    especialidadId?: number;
  }>({});

  const { data: kpis, isLoading, refetch } = trpc.estadisticas.kpis.useQuery(filtros);
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
  const { data: users } = trpc.users.listForMentions.useQuery();
  const { data: proyectos } = trpc.proyectos.list.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const proyectoNombre = proyectos?.find(p => p.id === selectedProjectId)?.nombre || 'Proyecto';

  const getSupervisorName = (id: number | null) => {
    if (!id) return "Sin asignar";
    const user = users?.find(u => u.id === id);
    return user?.name || `Usuario ${id}`;
  };

  const getEmpresaName = (id: number | null) => {
    if (!id) return "Sin empresa";
    const empresa = empresas?.find(e => e.id === id);
    return empresa?.nombre || `Empresa ${id}`;
  };

  const getUnidadName = (id: number | null) => {
    if (!id) return "Sin unidad";
    const unidad = unidades?.find(u => u.id === id);
    return unidad?.nombre || `Unidad ${id}`;
  };

  // Datos para gráfico de pie
  const pieData = kpis?.resumen ? [
    { name: 'Aprobados', value: kpis.resumen.aprobados, color: '#10B981' },
    { name: 'Rechazados', value: kpis.resumen.rechazados, color: '#EF4444' },
    { name: 'Pendientes', value: kpis.resumen.pendientes, color: '#F59E0B' },
  ].filter(d => d.value > 0) : [];

  // Formatear tendencia mensual para gráfico
  const tendenciaData = kpis?.tendenciaMensual?.map(t => ({
    mes: t.mes,
    Total: t.total,
    Aprobados: t.aprobados,
    Rechazados: t.rechazados,
    Pendientes: t.pendientes,
  })) || [];

  // Datos de rendimiento de supervisores
  const supervisoresData = kpis?.rendimientoSupervisores?.map(s => ({
    nombre: getSupervisorName(s.supervisorId),
    aprobados: s.aprobados,
    rechazados: s.rechazados,
    total: s.total,
    tasa: s.total > 0 ? ((s.aprobados / s.total) * 100).toFixed(1) : '0',
  })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Dashboard de KPIs</h1>
            <p className="text-muted-foreground">Métricas de rendimiento y tendencias</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => {
                const doc = crearPDFUnificado({
                  titulo: 'KPIs',
                  proyectoNombre,
                  orientation: 'portrait'
                });
                
                let yPos = agregarSeccion(doc, 'Metricas de Rendimiento', 35);
                
                const kpiData = [
                  ['Total Items', String(kpis?.resumen?.total || 0)],
                  ['Tasa Aprobacion', `${kpis?.resumen?.tasaAprobacion?.toFixed(1) || 0}%`],
                  ['Tasa Rechazo', `${kpis?.resumen?.tasaRechazo?.toFixed(1) || 0}%`],
                  ['Tiempo Promedio Resolucion', `${kpis?.resumen?.tiempoPromedioHoras?.toFixed(1) || 0}h`]
                ];
                
                agregarTablaUnificada(doc, ['Metrica', 'Valor'], kpiData, yPos);
                descargarPDFUnificado(doc, 'kpis', proyectoNombre);
              }} 
              title="Exportar PDF"
            >
              <FileDown className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select
                  value={filtros.empresaId?.toString() || "all"}
                  onValueChange={(v) => setFiltros(prev => ({ 
                    ...prev, 
                    empresaId: v === "all" ? undefined : parseInt(v) 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las empresas</SelectItem>
                    {empresas?.map(e => (
                      <SelectItem key={e.id} value={e.id.toString()}>{e.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Select
                  value={filtros.unidadId?.toString() || "all"}
                  onValueChange={(v) => setFiltros(prev => ({ 
                    ...prev, 
                    unidadId: v === "all" ? undefined : parseInt(v) 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las unidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las unidades</SelectItem>
                    {unidades?.map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>{u.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Especialidad</Label>
                <Select
                  value={filtros.especialidadId?.toString() || "all"}
                  onValueChange={(v) => setFiltros(prev => ({ 
                    ...prev, 
                    especialidadId: v === "all" ? undefined : parseInt(v) 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las especialidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las especialidades</SelectItem>
                    {especialidades?.map(e => (
                      <SelectItem key={e.id} value={e.id.toString()}>{e.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPIs principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Ítems</p>
                      <p className="text-xl sm:text-2xl font-bold">{kpis?.resumen?.total || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Target className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tasa Aprobación</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xl sm:text-2xl font-bold text-emerald-600">
                          {kpis?.resumen?.tasaAprobacion || 0}%
                        </p>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tasa Rechazo</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xl sm:text-2xl font-bold text-red-600">
                          {kpis?.resumen?.tasaRechazo || 0}%
                        </p>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tiempo Promedio</p>
                      <p className="text-xl sm:text-2xl font-bold">
                        {kpis?.resumen?.tiempoPromedioHoras || 0}h
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos principales */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribución de estados */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Distribución de Estados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tendencia mensual */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Tendencia Mensual
                  </CardTitle>
                  <CardDescription>Últimos 6 meses</CardDescription>
                </CardHeader>
                <CardContent>
                  {tendenciaData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={tendenciaData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="Total" stroke="#3B82F6" strokeWidth={2} />
                        <Line type="monotone" dataKey="Aprobados" stroke="#10B981" strokeWidth={2} />
                        <Line type="monotone" dataKey="Rechazados" stroke="#EF4444" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No hay datos para mostrar
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Rendimiento por supervisor */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Rendimiento por Supervisor
                </CardTitle>
                <CardDescription>Comparativa de aprobaciones y rechazos</CardDescription>
              </CardHeader>
              <CardContent>
                {supervisoresData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={supervisoresData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="nombre" type="category" width={120} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="aprobados" name="Aprobados" fill="#10B981" />
                      <Bar dataKey="rechazados" name="Rechazados" fill="#EF4444" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No hay datos de supervisores
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comparativas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Por empresa */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Comparativa por Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {kpis?.comparativaEmpresas?.map((emp: any) => (
                      <div key={emp.empresaId} className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="font-medium">{getEmpresaName(emp.empresaId)}</span>
                          <span className="text-sm text-muted-foreground">
                            {emp.total} ítems • {emp.tasaAprobacion}% aprobación
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${emp.tasaAprobacion}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {(!kpis?.comparativaEmpresas || kpis.comparativaEmpresas.length === 0) && (
                      <p className="text-center text-muted-foreground py-4">Sin datos</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Por unidad */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Comparativa por Unidad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {kpis?.comparativaUnidades?.map((uni: any) => (
                      <div key={uni.unidadId} className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="font-medium">{getUnidadName(uni.unidadId)}</span>
                          <span className="text-sm text-muted-foreground">
                            {uni.total} ítems • {uni.tasaAprobacion}% aprobación
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${uni.tasaAprobacion}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {(!kpis?.comparativaUnidades || kpis.comparativaUnidades.length === 0) && (
                      <p className="text-center text-muted-foreground py-4">Sin datos</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Resumen numérico */}
            <Card>
              <CardHeader>
                <CardTitle>Resumen Detallado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div className="text-center p-4 bg-emerald-50 rounded-lg">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                    <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{kpis?.resumen?.aprobados || 0}</p>
                    <p className="text-sm text-muted-foreground">Aprobados</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                    <p className="text-2xl sm:text-3xl font-bold text-red-600">{kpis?.resumen?.rechazados || 0}</p>
                    <p className="text-sm text-muted-foreground">Rechazados</p>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <Clock className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                    <p className="text-2xl sm:text-3xl font-bold text-amber-600">{kpis?.resumen?.pendientes || 0}</p>
                    <p className="text-sm text-muted-foreground">Pendientes</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <BarChart3 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-2xl sm:text-3xl font-bold text-blue-600">{kpis?.resumen?.total || 0}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
