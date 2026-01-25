import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Users, Shield } from "lucide-react";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  jefe_residente: "Jefe de Residente",
  residente: "Residente",
};

const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800",
  supervisor: "bg-blue-100 text-blue-800",
  jefe_residente: "bg-emerald-100 text-emerald-800",
  residente: "bg-slate-100 text-slate-800",
};

export default function Usuarios() {
  const utils = trpc.useUtils();
  const { data: usuarios, isLoading } = trpc.users.list.useQuery();
  const { data: empresas } = trpc.empresas.list.useQuery();

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("Rol actualizado correctamente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateEmpresaMutation = trpc.users.updateEmpresa.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("Empresa asignada correctamente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleRoleChange = (userId: number, role: string) => {
    updateRoleMutation.mutate({ userId, role: role as any });
  };

  const handleEmpresaChange = (userId: number, empresaId: string) => {
    const id = empresaId === "none" ? null : parseInt(empresaId);
    updateEmpresaMutation.mutate({ userId, empresaId: id });
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
            <p className="text-muted-foreground">
              Gestiona los usuarios y sus roles en el sistema
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lista de Usuarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : usuarios?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay usuarios registrados
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Último Acceso</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuarios?.map((usuario) => (
                      <TableRow key={usuario.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {usuario.name?.charAt(0).toUpperCase() || "U"}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{usuario.name || "Sin nombre"}</p>
                              <p className="text-xs text-muted-foreground">
                                ID: {usuario.id}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {usuario.email || "-"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={usuario.role}
                            onValueChange={(value) => handleRoleChange(usuario.id, value)}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-3 w-3" />
                                  Administrador
                                </div>
                              </SelectItem>
                              <SelectItem value="supervisor">Supervisor</SelectItem>
                              <SelectItem value="jefe_residente">Jefe de Residente</SelectItem>
                              <SelectItem value="residente">Residente</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={usuario.empresaId?.toString() || "none"}
                            onValueChange={(value) => handleEmpresaChange(usuario.id, value)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Sin asignar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin asignar</SelectItem>
                              {empresas?.map((empresa) => (
                                <SelectItem key={empresa.id} value={empresa.id.toString()}>
                                  {empresa.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(usuario.lastSignedIn)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={usuario.activo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}
                          >
                            {usuario.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leyenda de roles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permisos por Rol</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-3 rounded-lg border">
                <Badge className={roleColors.admin}>Administrador</Badge>
                <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                  <li>• Gestión completa del sistema</li>
                  <li>• Administrar usuarios y catálogos</li>
                  <li>• Ver estadísticas globales</li>
                  <li>• Aprobar/rechazar ítems</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg border">
                <Badge className={roleColors.supervisor}>Supervisor</Badge>
                <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                  <li>• Aprobar/rechazar ítems</li>
                  <li>• Ver todos los ítems</li>
                  <li>• Ver estadísticas</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg border">
                <Badge className={roleColors.jefe_residente}>Jefe de Residente</Badge>
                <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                  <li>• Agregar foto "después"</li>
                  <li>• Revisar ítems pendientes</li>
                  <li>• Crear nuevos ítems</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg border">
                <Badge className={roleColors.residente}>Residente</Badge>
                <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                  <li>• Crear nuevos ítems</li>
                  <li>• Capturar foto "antes"</li>
                  <li>• Ver sus propios ítems</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
