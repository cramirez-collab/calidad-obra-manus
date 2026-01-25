import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  CalendarDays,
  MapPin,
  Building2
} from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function Bienvenida() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: pendientes, isLoading } = trpc.pendientes.misPendientes.useQuery();

  const getRolLabel = (role: string) => {
    const labels: Record<string, string> = {
      superadmin: "Superadministrador",
      admin: "Administrador",
      supervisor: "Supervisor",
      jefe_residente: "Jefe de Residente",
      residente: "Residente",
    };
    return labels[role] || role;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pendiente_foto_despues":
        return <Camera className="h-5 w-5 text-amber-500" />;
      case "pendiente_aprobacion":
        return <Clock className="h-5 w-5 text-blue-500" />;
      case "rechazado":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pendiente_foto_despues":
        return "Pendiente Foto Después";
      case "pendiente_aprobacion":
        return "Pendiente Aprobación";
      case "rechazado":
        return "Rechazado";
      default:
        return status;
    }
  };

  const getActionLabel = (status: string, role: string) => {
    if (role === "jefe_residente" && status === "pendiente_foto_despues") {
      return "Subir foto después";
    }
    if (role === "supervisor" && status === "pendiente_aprobacion") {
      return "Revisar y aprobar";
    }
    if (role === "residente" && status === "rechazado") {
      return "Corregir observaciones";
    }
    return "Ver detalle";
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header de bienvenida */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <img 
              src="/logo-objetiva.jpg" 
              alt="Objetiva" 
              className="h-12 md:h-16 object-contain"
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#002C63]">
                ¡Bienvenido, {user?.name?.split(' ')[0] || 'Usuario'}!
              </h1>
              <p className="text-muted-foreground">
                {getRolLabel(user?.role || '')} · Panel de Control de Calidad
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <CalendarDays className="inline-block h-4 w-4 mr-1" />
            {new Date().toLocaleDateString('es-MX', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>

        {/* Resumen de pendientes */}
        <Card className="border-l-4 border-l-[#02B381]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#02B381]" />
              Tus Pendientes
              {pendientes && pendientes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendientes.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#02B381]" />
              </div>
            ) : pendientes && pendientes.length > 0 ? (
              <div className="space-y-3">
                {pendientes.map((item: any) => (
                  <div 
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors gap-3"
                  >
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                      {getStatusIcon(item.status)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-[#002C63]">
                            {item.codigo}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {getStatusLabel(item.status)}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium truncate">{item.titulo}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                          {item.ubicacion && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {item.ubicacion}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {formatDistanceToNow(new Date(item.fechaCreacion), { 
                              addSuffix: true, 
                              locale: es 
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      className="bg-[#02B381] hover:bg-[#02B381]/90 text-white w-full sm:w-auto min-h-[44px]"
                      onClick={() => setLocation(`/items/${item.id}`)}
                    >
                      {getActionLabel(item.status, user?.role || '')}
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-[#02B381] mx-auto mb-3" />
                <p className="text-lg font-medium text-[#002C63]">¡Todo al día!</p>
                <p className="text-muted-foreground">No tienes pendientes por atender</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acciones rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'residente') && (
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow border-t-4 border-t-[#02B381]"
              onClick={() => setLocation('/nuevo-item')}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 rounded-full bg-[#02B381]/10">
                  <Camera className="h-6 w-6 text-[#02B381]" />
                </div>
                <div>
                  <p className="font-semibold">Nuevo Ítem</p>
                  <p className="text-xs text-muted-foreground">Registrar observación</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-t-4 border-t-[#002C63]"
            onClick={() => setLocation('/items')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-3 rounded-full bg-[#002C63]/10">
                <Building2 className="h-6 w-6 text-[#002C63]" />
              </div>
              <div>
                <p className="font-semibold">Ver Ítems</p>
                <p className="text-xs text-muted-foreground">Lista completa</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-t-4 border-t-amber-500"
            onClick={() => setLocation('/estadisticas')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold">Estadísticas</p>
                <p className="text-xs text-muted-foreground">Reportes y métricas</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-t-4 border-t-purple-500"
            onClick={() => setLocation('/kpis')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-3 rounded-full bg-purple-500/10">
                <CheckCircle2 className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="font-semibold">KPIs</p>
                <p className="text-xs text-muted-foreground">Indicadores clave</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
