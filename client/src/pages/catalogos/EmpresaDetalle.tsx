import { useParams, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Building2, 
  Users, 
  MapPin, 
  ClipboardCheck, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ArrowLeft,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from "recharts";

export default function EmpresaDetalle() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  
  const { data: empresa, isLoading } = trpc.empresas.getCompleta.useQuery<any>(
    { id: parseInt(id || "0") },
    { enabled: !!id }
  );

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!empresa) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Empresa no encontrada</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/empresas")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Empresas
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const pieData = [
    { name: "Aprobados", value: empresa.items.aprobados, color: "#02B381" },
    { name: "Rechazados", value: empresa.items.rechazados, color: "#ef4444" },
    { name: "Pendientes", value: empresa.items.pendientes, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/empresas")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              {empresa.nombre}
            </h1>
            <p className="text-muted-foreground">
              Detalle completo de la empresa y sus estadísticas
            </p>
          </div>
          <Badge variant={empresa.activo ? "default" : "secondary"}>
            {empresa.activo ? "Activa" : "Inactiva"}
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{empresa.usuarios?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Usuarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <MapPin className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{empresa.unidades?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Unidades</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <ClipboardCheck className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{empresa.items.total}</p>
                  <p className="text-xs text-muted-foreground">Total Ítems</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${(empresa.tasaAprobacion || 0) >= 70 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {(empresa.tasaAprobacion || 0) >= 70 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="text-2xl font-bold">{(empresa.tasaAprobacion || 0).toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">Tasa Aprobación</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Ítems */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribución de Ítems</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Sin ítems registrados
                </div>
              )}
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#02B381]" />
                  <span className="text-sm">Aprobados ({empresa.items.aprobados})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm">Rechazados ({empresa.items.rechazados})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-sm">Pendientes ({empresa.items.pendientes})</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usuarios */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuarios ({empresa.usuarios?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {empresa.usuarios && empresa.usuarios.length > 0 ? (
                  empresa.usuarios.map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{user.name || "Sin nombre"}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <Badge variant="outline">{user.role}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Sin usuarios asignados
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unidades */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Unidades Relacionadas ({empresa.unidades?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {empresa.unidades && empresa.unidades.length > 0 ? (
                empresa.unidades.map((unidad: any) => (
                  <div key={unidad.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <p className="font-medium">{unidad.nombre}</p>
                    {unidad.descripcion && (
                      <p className="text-sm text-muted-foreground mt-1">{unidad.descripcion}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="col-span-full text-center text-muted-foreground py-8">
                  Sin unidades relacionadas
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info adicional */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Fecha de Creación</p>
                <p className="font-medium">{formatDate(empresa.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Última Actualización</p>
                <p className="font-medium">{formatDate(empresa.updatedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Contacto</p>
                <p className="font-medium">{empresa.contacto || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Teléfono</p>
                <p className="font-medium">{empresa.telefono || "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
