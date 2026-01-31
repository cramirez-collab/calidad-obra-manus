import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { Users, Shield, Plus, Pencil, Building2, UserCheck, UserX, Search, FolderKanban, Lock, Trash2, Camera } from "lucide-react";

import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";

const roleLabels: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Administrador",
  supervisor: "Supervisor",
  jefe_residente: "Jefe de Residente",
  residente: "Residente",
  desarrollador: "Desarrollador",
};

const roleColors: Record<string, string> = {
  superadmin: "bg-red-100 text-red-800",
  admin: "bg-purple-100 text-purple-800",
  supervisor: "bg-blue-100 text-blue-800",
  jefe_residente: "bg-emerald-100 text-emerald-800",
  residente: "bg-slate-100 text-slate-800",
  desarrollador: "bg-amber-100 text-amber-800",
};

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  empresaId: number | null;
}

export default function Usuarios() {
  const { selectedProjectId } = useProject();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: allUsuarios, isLoading } = trpc.users.listConEmpresa.useQuery();
  const { data: todosProyectos } = trpc.proyectos.list.useQuery();
  // Obtener empresas filtradas por proyecto desde el backend
  const { data: empresas } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: proyectoUsuarios, refetch: refetchProyectoUsuarios } = trpc.proyectos.usuarios.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  
  // Filtrar usuarios por proyecto seleccionado (solo mostrar usuarios asignados al proyecto)
  const usuariosDelProyecto = selectedProjectId && proyectoUsuarios
    ? proyectoUsuarios.map(pu => pu.usuarioId)
    : null;
  const usuarios = usuariosDelProyecto
    ? allUsuarios?.filter(u => usuariosDelProyecto.includes(u.id))
    : allUsuarios;
  
  // Solo admin y superadmin pueden crear/editar usuarios
  const canManageUsers = user?.role === 'superadmin' || user?.role === 'admin';

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignProjectOpen, setIsAssignProjectOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterEmpresa, setFilterEmpresa] = useState<string>("all");
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
  const [photoEditingUser, setPhotoEditingUser] = useState<any>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    email: "",
    password: "",
    role: "residente",
    empresaId: null,
  });

  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.listConEmpresa.invalidate();
      refetchProyectoUsuarios();
      setIsCreateOpen(false);
      setFormData({ name: "", email: "", password: "", role: "residente", empresaId: null });
      toast.success("Usuario creado correctamente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateUserMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      utils.users.listConEmpresa.invalidate();
      setIsEditOpen(false);
      setEditingUser(null);
      toast.success("Usuario actualizado correctamente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const asignarProyectoMutation = trpc.proyectos.asignarUsuario.useMutation({
    onSuccess: () => {
      utils.users.listConEmpresa.invalidate();
      refetchProyectoUsuarios();
      toast.success("Usuario asignado al proyecto");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removerProyectoMutation = trpc.proyectos.removerUsuario.useMutation({
    onSuccess: () => {
      utils.users.listConEmpresa.invalidate();
      refetchProyectoUsuarios();
      toast.success("Usuario removido del proyecto");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Mutation para eliminar usuario permanentemente (solo superadmin)
  const deleteUserMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      utils.users.listConEmpresa.invalidate();
      refetchProyectoUsuarios();
      toast.success("Usuario eliminado permanentemente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = () => {
    if (!canManageUsers) {
      toast.error("No tienes permisos para crear usuarios");
      return;
    }
    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!formData.password.trim()) {
      toast.error("La contraseña es requerida");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (!selectedProjectId) {
      toast.error("Debes seleccionar un proyecto primero");
      return;
    }
    createUserMutation.mutate({
      name: formData.name,
      email: formData.email || undefined,
      password: formData.password,
      role: formData.role as any,
      empresaId: formData.empresaId,
      proyectoId: selectedProjectId,
    });
  };

  const handleEdit = (usuario: any) => {
    setEditingUser(usuario);
    setFormData({
      name: usuario.name || "",
      email: usuario.email || "",
      password: "",
      role: usuario.role,
      empresaId: usuario.empresaId,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!canManageUsers) {
      toast.error("No tienes permisos para editar usuarios");
      return;
    }
    if (!editingUser) return;
    updateUserMutation.mutate({
      id: editingUser.id,
      name: formData.name,
      email: formData.email || undefined,
      password: formData.password || undefined,
      role: formData.role as any,
      empresaId: formData.empresaId,
    });
  };

  // Solo admin y superadmin pueden desactivar/eliminar usuarios
  const canDeleteUsers = user?.role === 'superadmin' || user?.role === 'admin';
  
  // Solo superadmin puede eliminar usuarios permanentemente
  const canDeletePermanently = user?.role === 'superadmin';

  // Mutación para actualizar foto de usuario (superadmin)
  const updatePhotoMutation = trpc.users.updateFotoAdmin.useMutation({
    onSuccess: () => {
      utils.users.listConEmpresa.invalidate();
      setIsPhotoDialogOpen(false);
      setPhotoEditingUser(null);
      toast.success("Foto actualizada correctamente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoEditingUser) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const dataUrl = `data:${file.type};base64,${base64}`;
      
      updatePhotoMutation.mutate({
        userId: photoEditingUser.id,
        fotoBase64: dataUrl,
      });
    } catch (error) {
      toast.error('Error al subir la imagen');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleEditPhoto = (usuario: any) => {
    setPhotoEditingUser(usuario);
    setIsPhotoDialogOpen(true);
  };

  const handleDeleteUser = (usuario: any) => {
    if (!canDeletePermanently) {
      toast.error("Solo el superadministrador puede eliminar usuarios permanentemente");
      return;
    }
    if (usuario.id === user?.id) {
      toast.error("No puedes eliminarte a ti mismo");
      return;
    }
    if (confirm(`¿Estás seguro de eliminar permanentemente a ${usuario.name}? Esta acción no se puede deshacer.`)) {
      deleteUserMutation.mutate({ id: usuario.id });
    }
  };

  const handleToggleActivo = (usuario: any) => {
    if (!canDeleteUsers) {
      toast.error("Solo los administradores pueden desactivar usuarios");
      return;
    }
    updateUserMutation.mutate({
      id: usuario.id,
      activo: !usuario.activo,
    });
  };

  const handleOpenAssignProject = (usuario: any) => {
    setEditingUser(usuario);
    setIsAssignProjectOpen(true);
  };

  const handleToggleProjectAssignment = (proyectoId: number, isAssigned: boolean, usuarioId: number) => {
    if (!canManageUsers) {
      toast.error("No tienes permisos para asignar proyectos");
      return;
    }
    
    if (isAssigned) {
      // Remover del proyecto
      removerProyectoMutation.mutate({
        proyectoId,
        usuarioId,
      });
    } else {
      // Asignar al proyecto
      const userRole = editingUser?.role || 'residente';
      let rolEnProyecto: 'admin' | 'supervisor' | 'jefe_residente' | 'residente' | 'desarrollador' = 'residente';
      if (userRole === 'superadmin' || userRole === 'admin') {
        rolEnProyecto = 'admin';
      } else if (userRole === 'supervisor') {
        rolEnProyecto = 'supervisor';
      } else if (userRole === 'jefe_residente') {
        rolEnProyecto = 'jefe_residente';
      } else if (userRole === 'desarrollador') {
        rolEnProyecto = 'desarrollador';
      }
      
      asignarProyectoMutation.mutate({
        proyectoId,
        usuarioId,
        rolEnProyecto,
      });
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  // Filtrar usuarios
  const filteredUsuarios = usuarios?.filter(usuario => {
    const matchesSearch = !searchTerm || 
      usuario.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || usuario.role === filterRole;
    const matchesEmpresa = filterEmpresa === "all" || 
      (filterEmpresa === "none" && !usuario.empresaId) ||
      usuario.empresaId?.toString() === filterEmpresa;
    return matchesSearch && matchesRole && matchesEmpresa;
  });

  // Estadísticas
  const stats = {
    total: usuarios?.length || 0,
    activos: usuarios?.filter(u => u.activo).length || 0,
    porRol: {
      superadmin: usuarios?.filter(u => u.role === 'superadmin').length || 0,
      admin: usuarios?.filter(u => u.role === 'admin').length || 0,
      supervisor: usuarios?.filter(u => u.role === 'supervisor').length || 0,
      jefe_residente: usuarios?.filter(u => u.role === 'jefe_residente').length || 0,
      residente: usuarios?.filter(u => u.role === 'residente').length || 0,
    },
    sinEmpresa: usuarios?.filter(u => !u.empresaId).length || 0,
  };

  // Obtener proyectos asignados a un usuario específico
  const { data: userProjects } = trpc.proyectos.misProyectos.useQuery(undefined, {
    enabled: !!editingUser,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
            <p className="text-muted-foreground">
              Alta, edición y asignación de roles, empresas y proyectos
            </p>
          </div>
          {canManageUsers && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#02B381] hover:bg-[#029970]">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription>
                  Ingresa los datos del nuevo usuario y asígnale un rol y empresa.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div className="space-y-2">
<Label htmlFor="password">Contraseña *</Label>
                   <Input
                     id="password"
                     type="text"
                     value={formData.password}
                     onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                     placeholder="Mínimo 6 caracteres"
                     autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">Esta contraseña será usada por el usuario para iniciar sesión</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="superadmin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3 w-3 text-red-600" />
                          Superadministrador
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3 w-3 text-purple-600" />
                          Administrador
                        </div>
                      </SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="jefe_residente">Jefe de Residente</SelectItem>
                      <SelectItem value="residente">Residente</SelectItem>
                      <SelectItem value="desarrollador">Desarrollador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="empresa">Empresa</Label>
                  <Select
                    value={formData.empresaId?.toString() || "none"}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      empresaId: value === "none" ? null : parseInt(value) 
                    })}
                  >
                    <SelectTrigger>
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
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreate}
                  disabled={createUserMutation.isPending}
                  className="bg-[#02B381] hover:bg-[#029970]"
                >
                  {createUserMutation.isPending ? "Creando..." : "Crear Usuario"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {/* Estadísticas */}
        <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100 flex-shrink-0">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-100 flex-shrink-0">
                  <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.activos}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Activos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-purple-100 flex-shrink-0">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.porRol.admin + stats.porRol.superadmin}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Admin</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100 flex-shrink-0">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.porRol.supervisor}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Superv.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-amber-100 flex-shrink-0">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.sinEmpresa}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Sin Emp.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    <SelectItem value="superadmin">Superadmin</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="jefe_residente">Jefe de Residente</SelectItem>
                    <SelectItem value="residente">Residente</SelectItem>
                    <SelectItem value="desarrollador">Desarrollador</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="none">Sin empresa</SelectItem>
                    {empresas?.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id.toString()}>
                        {empresa.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de usuarios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lista de Usuarios ({filteredUsuarios?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : filteredUsuarios?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron usuarios
              </div>
            ) : (
              <>
                {/* Vista móvil - Cards */}
                <div className="sm:hidden divide-y">
                  {filteredUsuarios?.map((usuario) => (
                    <div key={usuario.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {usuario.fotoUrl ? (
                            <img 
                              src={usuario.fotoUrl} 
                              alt={usuario.name || 'Usuario'}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-[#002C63]/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-[#002C63]">
                                {usuario.name?.charAt(0).toUpperCase() || "U"}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{usuario.name || "Sin nombre"}</p>
                            <p className="text-xs text-muted-foreground">{usuario.email || "-"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {canDeletePermanently && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditPhoto(usuario)}
                            title="Cambiar foto"
                          >
                            <Camera className="h-4 w-4 text-blue-500" />
                          </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(usuario)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {canManageUsers && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenAssignProject(usuario)}
                            title="Asignar a proyectos"
                          >
                            <FolderKanban className="h-4 w-4 text-blue-500" />
                          </Button>
                          )}
                          {canDeleteUsers && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleActivo(usuario)}
                            title={usuario.activo ? "Desactivar" : "Activar"}
                          >
                            {usuario.activo ? (
                              <UserX className="h-4 w-4 text-red-500" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-emerald-500" />
                            )}
                          </Button>
                          )}
                          {canDeletePermanently && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeleteUser(usuario)}
                            title="Eliminar permanentemente"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={roleColors[usuario.role] + " text-xs"}>
                          {roleLabels[usuario.role]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={(usuario.activo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200") + " text-xs"}
                        >
                          {usuario.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      {usuario.empresa && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {usuario.empresa.nombre}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Vista desktop - Tabla */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Último Acceso</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsuarios?.map((usuario) => (
                        <TableRow key={usuario.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {usuario.fotoUrl ? (
                                <img 
                                  src={usuario.fotoUrl} 
                                  alt={usuario.name || 'Usuario'}
                                  className="h-9 w-9 rounded-full object-cover"
                                />
                              ) : (
                                <div className="h-9 w-9 rounded-full bg-[#002C63]/10 flex items-center justify-center">
                                  <span className="text-sm font-medium text-[#002C63]">
                                    {usuario.name?.charAt(0).toUpperCase() || "U"}
                                  </span>
                                </div>
                              )}
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
                            <Badge className={roleColors[usuario.role]}>
                              {roleLabels[usuario.role]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {usuario.empresa ? (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{usuario.empresa.nombre}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Sin asignar</span>
                            )}
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
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canDeletePermanently && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditPhoto(usuario)}
                                title="Cambiar foto"
                              >
                                <Camera className="h-4 w-4 text-blue-500" />
                              </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(usuario)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {canManageUsers && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenAssignProject(usuario)}
                                title="Asignar a proyectos"
                              >
                                <FolderKanban className="h-4 w-4 text-blue-500" />
                              </Button>
                              )}
                              {canDeleteUsers && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleActivo(usuario)}
                                title={usuario.activo ? "Desactivar" : "Activar"}
                              >
                                {usuario.activo ? (
                                  <UserX className="h-4 w-4 text-red-500" />
                                ) : (
                                  <UserCheck className="h-4 w-4 text-emerald-500" />
                                )}
                              </Button>
                              )}
                              {canDeletePermanently && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUser(usuario)}
                                title="Eliminar permanentemente"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Leyenda de roles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permisos por Rol</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="p-3 rounded-lg border">
                <Badge className={roleColors.superadmin}>Superadmin</Badge>
                <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                  <li>• Acceso total al sistema</li>
                  <li>• Configuración y metas</li>
                  <li>• Gestión de usuarios</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg border">
                <Badge className={roleColors.admin}>Administrador</Badge>
                <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                  <li>• Gestión de catálogos</li>
                  <li>• Administrar usuarios</li>
                  <li>• Ver estadísticas globales</li>
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

        {/* Dialog de edición */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                Modifica los datos del usuario.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Rol *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-3 w-3 text-red-600" />
                        Superadministrador
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-3 w-3 text-purple-600" />
                        Administrador
                      </div>
                    </SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="jefe_residente">Jefe de Residente</SelectItem>
                    <SelectItem value="residente">Residente</SelectItem>
                    <SelectItem value="desarrollador">Desarrollador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-empresa">Empresa</Label>
                <Select
                  value={formData.empresaId?.toString() || "none"}
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    empresaId: value === "none" ? null : parseInt(value) 
                  })}
                >
                  <SelectTrigger>
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
              </div>
              
              {/* Campo de contraseña */}
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="edit-password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Nueva Contraseña
                </Label>
<Input
                   id="edit-password"
                   type="text"
                   value={formData.password}
                   onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                   placeholder="Dejar vacío para no cambiar"
                   autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo 6 caracteres. Solo llenar si deseas cambiar la contraseña.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdate}
                disabled={updateUserMutation.isPending}
                className="bg-[#02B381] hover:bg-[#029970]"
              >
                {updateUserMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de asignación de proyectos */}
        <Dialog open={isAssignProjectOpen} onOpenChange={setIsAssignProjectOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Asignar a Proyectos</DialogTitle>
              <DialogDescription>
                Selecciona los proyectos a los que deseas asignar a {editingUser?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
              {todosProyectos?.map((proyecto) => {
                const isAssigned = proyectoUsuarios?.some(
                  pu => pu.usuarioId === editingUser?.id && pu.proyectoId === proyecto.id
                ) || false;
                
                return (
                  <div key={proyecto.id} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-slate-50">
                    <Checkbox
                      id={`proyecto-${proyecto.id}`}
                      checked={isAssigned}
                      onCheckedChange={() => handleToggleProjectAssignment(proyecto.id, isAssigned, editingUser?.id)}
                      disabled={asignarProyectoMutation.isPending || removerProyectoMutation.isPending}
                    />
                    <label
                      htmlFor={`proyecto-${proyecto.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{proyecto.nombre}</span>
                      </div>
                      {proyecto.codigo && (
                        <p className="text-xs text-muted-foreground mt-1">{proyecto.codigo}</p>
                      )}
                    </label>
                    {isAssigned && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        Asignado
                      </Badge>
                    )}
                  </div>
                );
              })}
              {(!todosProyectos || todosProyectos.length === 0) && (
                <p className="text-center text-muted-foreground py-4">
                  No hay proyectos disponibles
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignProjectOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de editar foto */}
        <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cambiar Foto de Perfil</DialogTitle>
              <DialogDescription>
                Selecciona una imagen para {photoEditingUser?.name || 'el usuario'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {/* Avatar actual */}
              <div className="relative">
                {photoEditingUser?.fotoUrl ? (
                  <img 
                    src={photoEditingUser.fotoUrl} 
                    alt={photoEditingUser.name || 'Usuario'}
                    className="h-24 w-24 rounded-full object-cover border-4 border-muted"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-[#002C63]/10 flex items-center justify-center border-4 border-muted">
                    <span className="text-2xl font-bold text-[#002C63]">
                      {photoEditingUser?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <label className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
                  <Camera className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto || updatePhotoMutation.isPending}
                  />
                </label>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Haz clic en el ícono de cámara para seleccionar una imagen.<br/>
                Máximo 5MB. Formatos: JPG, PNG, GIF.
              </p>
              {(uploadingPhoto || updatePhotoMutation.isPending) && (
                <p className="text-sm text-primary">Subiendo imagen...</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPhotoDialogOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
