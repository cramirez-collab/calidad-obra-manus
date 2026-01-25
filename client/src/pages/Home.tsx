import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { 
  Camera, 
  ClipboardCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Building2,
  MapPin,
  Wrench,
  Users
} from "lucide-react";
import { useLocation } from "wouter";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  jefe_residente: "Jefe de Residente",
  residente: "Residente",
};

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const { data: stats } = trpc.estadisticas.general.useQuery({});
  const { data: empresas } = trpc.empresas.list.useQuery();
  const { data: unidades } = trpc.unidades.list.useQuery();
  const { data: especialidades } = trpc.especialidades.list.useQuery();

  const statusCounts = stats?.porStatus?.reduce((acc, item) => {
    acc[item.status] = Number(item.count);
    return acc;
  }, {} as Record<string, number>) || {};

  const quickActions = [
    { 
      icon: Camera, 
      label: "Registrar Nuevo Ítem", 
      description: "Capturar foto y crear registro",
      path: "/items/nuevo",
      color: "bg-blue-500",
      roles: ['admin', 'supervisor', 'jefe_residente', 'residente']
    },
    { 
      icon: ClipboardCheck, 
      label: "Revisar Pendientes", 
      description: "Ítems pendientes de foto después",
      path: "/items/revision",
      color: "bg-amber-500",
      roles: ['admin', 'supervisor', 'jefe_residente']
    },
    { 
      icon: CheckCircle2, 
      label: "Aprobar Ítems", 
      description: "Ítems pendientes de aprobación",
      path: "/items/aprobacion",
      color: "bg-emerald-500",
      roles: ['admin', 'supervisor']
    },
  ];

  const filteredActions = quickActions.filter(action => 
    action.roles.includes(user?.role || 'residente')
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenido, {user?.name?.split(' ')[0] || 'Usuario'}
          </h1>
          <p className="text-muted-foreground">
            {roleLabels[user?.role || 'residente']} · Panel de Control de Calidad
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Ítems
              </CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendiente Foto
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {statusCounts['pendiente_foto_despues'] || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendiente Aprobación
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {statusCounts['pendiente_aprobacion'] || 0}
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
                {statusCounts['aprobado'] || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredActions.map((action) => (
            <Card 
              key={action.path} 
              className="card-hover cursor-pointer"
              onClick={() => setLocation(action.path)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${action.color} flex items-center justify-center`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{action.label}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {action.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  Ir ahora
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Admin Stats */}
        {user?.role === 'admin' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setLocation('/catalogos/empresas')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Empresas</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{empresas?.length || 0}</div>
                <p className="text-xs text-muted-foreground">registradas</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setLocation('/catalogos/unidades')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Unidades</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unidades?.length || 0}</div>
                <p className="text-xs text-muted-foreground">registradas</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setLocation('/catalogos/especialidades')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Especialidades</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{especialidades?.length || 0}</div>
                <p className="text-xs text-muted-foreground">registradas</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setLocation('/usuarios')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Usuarios</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">gestionar</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
