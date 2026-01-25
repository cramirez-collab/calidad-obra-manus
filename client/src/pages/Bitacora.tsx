import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  History, 
  User, 
  Calendar,
  FileText,
  Camera,
  CheckCircle2,
  XCircle,
  LogIn,
  LogOut,
  Edit,
  Plus,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Bitacora() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  
  const { data: actividades, isLoading } = isAdmin 
    ? trpc.bitacora.list.useQuery({})
    : trpc.bitacora.miActividad.useQuery({});

  const getAccionIcon = (accion: string) => {
    switch (accion) {
      case 'login':
        return <LogIn className="h-4 w-4 text-green-500" />;
      case 'logout':
        return <LogOut className="h-4 w-4 text-gray-500" />;
      case 'crear_item':
        return <Plus className="h-4 w-4 text-blue-500" />;
      case 'aprobar_item':
        return <CheckCircle2 className="h-4 w-4 text-[#02B381]" />;
      case 'rechazar_item':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'subir_foto':
        return <Camera className="h-4 w-4 text-purple-500" />;
      case 'editar':
        return <Edit className="h-4 w-4 text-amber-500" />;
      case 'eliminar':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAccionLabel = (accion: string) => {
    const labels: Record<string, string> = {
      login: 'Inicio de sesión',
      logout: 'Cierre de sesión',
      crear_item: 'Creó ítem',
      aprobar_item: 'Aprobó ítem',
      rechazar_item: 'Rechazó ítem',
      subir_foto: 'Subió foto',
      editar: 'Editó registro',
      eliminar: 'Eliminó registro',
      crear_empresa: 'Creó empresa',
      crear_unidad: 'Creó unidad',
      crear_especialidad: 'Creó especialidad',
      crear_atributo: 'Creó atributo',
      cambiar_rol: 'Cambió rol de usuario',
    };
    return labels[accion] || accion;
  };

  const getEntidadLabel = (entidad: string | null) => {
    if (!entidad) return '';
    const labels: Record<string, string> = {
      item: 'Ítem',
      empresa: 'Empresa',
      unidad: 'Unidad',
      especialidad: 'Especialidad',
      atributo: 'Atributo',
      usuario: 'Usuario',
    };
    return labels[entidad] || entidad;
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#002C63]/10">
              <History className="h-6 w-6 text-[#002C63]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#002C63]">
                {isAdmin ? 'Bitácora General' : 'Mi Actividad'}
              </h1>
              <p className="text-muted-foreground">
                {isAdmin ? 'Registro de todas las actividades del sistema' : 'Historial de tus acciones'}
              </p>
            </div>
          </div>
        </div>

        {/* Lista de actividades */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actividades Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#02B381]" />
              </div>
            ) : actividades && actividades.length > 0 ? (
              <div className="space-y-2">
                {actividades.map((actividad: any) => (
                  <div 
                    key={actividad.id}
                    className="flex items-start gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors"
                  >
                    <div className="p-2 rounded-full bg-muted">
                      {getAccionIcon(actividad.accion)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {getAccionLabel(actividad.accion)}
                        </span>
                        {actividad.entidad && (
                          <Badge variant="outline" className="text-xs">
                            {getEntidadLabel(actividad.entidad)}
                            {actividad.entidadId && ` #${actividad.entidadId}`}
                          </Badge>
                        )}
                      </div>
                      {isAdmin && actividad.usuario && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <User className="h-3 w-3" />
                          {actividad.usuario.name || 'Usuario'}
                        </p>
                      )}
                      {actividad.detalles && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {actividad.detalles}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(actividad.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No hay actividades registradas</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
