import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Building2, 
  Users, 
  MapPin, 
  Calendar,
  FolderKanban,
  BarChart3,
  UserPlus,
  X,
  ImagePlus,
  Upload
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { getImageUrl } from "@/lib/imageUrl";

export default function Proyectos() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [usuariosDialogOpen, setUsuariosDialogOpen] = useState(false);
  const [editingProyecto, setEditingProyecto] = useState<any>(null);
  const [selectedProyecto, setSelectedProyecto] = useState<any>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    nombreReporte: "",
    codigo: "",
    descripcion: "",
    direccion: "",
    cliente: "",
    imagenPortadaUrl: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [asignarUsuarioData, setAsignarUsuarioData] = useState({
    usuarioId: "",
    rolEnProyecto: "residente" as "admin" | "supervisor" | "jefe_residente" | "residente",
  });

  const { data: proyectos, refetch } = trpc.proyectos.listConEstadisticas.useQuery();
  const { data: usuarios } = trpc.users.list.useQuery();
  const { data: usuariosProyecto, refetch: refetchUsuarios } = trpc.proyectos.usuarios.useQuery(
    { proyectoId: selectedProyecto?.id || 0 },
    { enabled: !!selectedProyecto }
  );

  const createMutation = trpc.proyectos.create.useMutation({
    onSuccess: () => {
      toast.success("Proyecto creado exitosamente");
      refetch();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Error al crear proyecto: " + error.message);
    },
  });

  const updateMutation = trpc.proyectos.update.useMutation({
    onSuccess: () => {
      toast.success("Proyecto actualizado exitosamente");
      refetch();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Error al actualizar proyecto: " + error.message);
    },
  });

  const deleteMutation = trpc.proyectos.delete.useMutation({
    onSuccess: () => {
      toast.success("Proyecto eliminado exitosamente");
      refetch();
    },
    onError: (error) => {
      toast.error("Error al eliminar proyecto: " + error.message);
    },
  });

  const asignarUsuarioMutation = trpc.proyectos.asignarUsuario.useMutation({
    onSuccess: () => {
      toast.success("Usuario asignado exitosamente");
      refetchUsuarios();
      setAsignarUsuarioData({ usuarioId: "", rolEnProyecto: "residente" });
    },
    onError: (error) => {
      toast.error("Error al asignar usuario: " + error.message);
    },
  });

  const removerUsuarioMutation = trpc.proyectos.removerUsuario.useMutation({
    onSuccess: () => {
      toast.success("Usuario removido del proyecto");
      refetchUsuarios();
    },
    onError: (error) => {
      toast.error("Error al remover usuario: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      nombre: "",
      nombreReporte: "",
      codigo: "",
      descripcion: "",
      direccion: "",
      cliente: "",
      imagenPortadaUrl: "",
    });
    setEditingProyecto(null);
  };

  const handleEdit = (proyecto: any) => {
    setEditingProyecto(proyecto);
    setFormData({
      nombre: proyecto.nombre || "",
      nombreReporte: proyecto.nombreReporte || "",
      codigo: proyecto.codigo || "",
      descripcion: proyecto.descripcion || "",
      direccion: proyecto.direccion || "",
      cliente: proyecto.cliente || "",
      imagenPortadaUrl: proyecto.imagenPortadaUrl || "",
    });
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5MB');
      return;
    }
    
    setUploadingImage(true);
    try {
      // Convertir archivo a base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setFormData(prev => ({ ...prev, imagenPortadaUrl: base64 }));
        toast.success('Imagen cargada correctamente');
        setUploadingImage(false);
      };
      reader.onerror = () => {
        toast.error('Error al leer la imagen');
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Error al cargar la imagen');
      console.error(error);
      setUploadingImage(false);
    }
  };

  const uploadImageMutation = trpc.proyectos.uploadImagenPortada.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enviar directamente el base64 al backend - el servidor lo guardará en la BD
    // Esto evita problemas con URLs de S3/CloudFront que expiran
    const dataToSend = { ...formData };
    
    if (editingProyecto) {
      updateMutation.mutate({ id: editingProyecto.id, ...dataToSend });
    } else {
      createMutation.mutate(dataToSend);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de eliminar este proyecto?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleAsignarUsuario = () => {
    if (!selectedProyecto || !asignarUsuarioData.usuarioId) return;
    asignarUsuarioMutation.mutate({
      proyectoId: selectedProyecto.id,
      usuarioId: parseInt(asignarUsuarioData.usuarioId),
      rolEnProyecto: asignarUsuarioData.rolEnProyecto,
    });
  };

  const handleRemoverUsuario = (usuarioId: number) => {
    if (!selectedProyecto) return;
    if (confirm("¿Estás seguro de remover este usuario del proyecto?")) {
      removerUsuarioMutation.mutate({
        proyectoId: selectedProyecto.id,
        usuarioId,
      });
    }
  };

  const getRolBadgeColor = (rol: string) => {
    switch (rol) {
      case "admin": return "bg-purple-100 text-purple-800";
      case "supervisor": return "bg-blue-100 text-blue-800";
      case "jefe_residente": return "bg-green-100 text-green-800";
      case "residente": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getRolLabel = (rol: string) => {
    switch (rol) {
      case "admin": return "Admin";
      case "supervisor": return "Supervisor";
      case "jefe_residente": return "Jefe Residente";
      case "residente": return "Residente";
      default: return rol;
    }
  };

  // Usuarios disponibles para asignar (no están en el proyecto)
  const usuariosDisponibles = usuarios?.filter(
    (u) => !usuariosProyecto?.some((up) => up.usuarioId === u.id)
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            Proyectos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona los proyectos de obra y asigna usuarios
          </p>
        </div>
        {isSuperadmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nuevo Proyecto</span>
                <span className="sm:hidden">Nuevo</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProyecto ? "Editar Proyecto" : "Nuevo Proyecto"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre del Proyecto *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Torre Residencial Norte"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código</Label>
                  <Input
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    placeholder="Ej: TRN-001"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombreReporte">Nombre para Reportes</Label>
                <Input
                  id="nombreReporte"
                  value={formData.nombreReporte}
                  onChange={(e) => setFormData({ ...formData, nombreReporte: e.target.value })}
                  placeholder="Nombre que aparecerá en los reportes PDF"
                />
                <p className="text-xs text-muted-foreground">
                  Si se deja vacío, se usará el nombre del proyecto
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente</Label>
                <Input
                  id="cliente"
                  value={formData.cliente}
                  onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                  placeholder="Nombre del cliente o desarrollador"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Ubicación del proyecto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción del proyecto..."
                  rows={3}
                />
              </div>
              
              {/* Imagen de Portada */}
              <div className="space-y-2">
                <Label>Imagen de Portada</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  {formData.imagenPortadaUrl ? (
                    <div className="relative">
                      <img 
                        src={formData.imagenPortadaUrl.startsWith('data:') ? formData.imagenPortadaUrl : getImageUrl(formData.imagenPortadaUrl)} 
                        alt="Portada" 
                        className="w-full h-32 object-cover rounded-md"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => setFormData(prev => ({ ...prev, imagenPortadaUrl: "" }))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2 py-4">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                      {uploadingImage ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                          <span>Subiendo...</span>
                        </div>
                      ) : (
                        <>
                          <ImagePlus className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Haz clic para subir una imagen de portada
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Esta imagen se mostrará en la tarjeta del proyecto
                          </span>
                        </>
                      )}
                    </label>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingProyecto ? "Guardar Cambios" : "Crear Proyecto"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{proyectos?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Proyectos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {proyectos?.reduce((acc, p) => acc + (p.conteo?.empresas || 0), 0) || 0}
                </p>
                <p className="text-xs text-muted-foreground">Empresas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {proyectos?.reduce((acc, p) => acc + (p.conteo?.usuarios || 0), 0) || 0}
                </p>
                <p className="text-xs text-muted-foreground">Usuarios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {proyectos?.reduce((acc, p) => acc + (p.conteo?.items || 0), 0) || 0}
                </p>
                <p className="text-xs text-muted-foreground">Ítems</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de proyectos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proyectos?.map((proyecto) => (
          <Card key={proyecto.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{proyecto.nombre}</CardTitle>
                  {proyecto.codigo && (
                    <Badge variant="outline" className="mt-1">{proyecto.codigo}</Badge>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => { setSelectedProyecto(proyecto); setUsuariosDialogOpen(true); }}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  {isSuperadmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(proyecto)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(proyecto.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {proyecto.cliente && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span className="truncate">{proyecto.cliente}</span>
                </div>
              )}
              {proyecto.direccion && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">{proyecto.direccion}</span>
                </div>
              )}
              
              {/* Contadores */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t">
                <div className="text-center">
                  <p className="text-lg font-semibold">{proyecto.conteo?.empresas || 0}</p>
                  <p className="text-xs text-muted-foreground">Empresas</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">{proyecto.conteo?.unidades || 0}</p>
                  <p className="text-xs text-muted-foreground">Unidades</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">{proyecto.conteo?.usuarios || 0}</p>
                  <p className="text-xs text-muted-foreground">Usuarios</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">{proyecto.conteo?.items || 0}</p>
                  <p className="text-xs text-muted-foreground">Ítems</p>
                </div>
              </div>

              {/* Tasa de aprobación */}
              {proyecto.items?.total > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tasa de aprobación</span>
                    <span className="font-medium">{proyecto.tasaAprobacion}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${proyecto.tasaAprobacion}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Estado vacío */}
      {proyectos?.length === 0 && (
        <Card className="p-8 text-center">
          <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay proyectos</h3>
          <p className="text-muted-foreground mb-4">
            Crea tu primer proyecto para comenzar a gestionar el control de calidad
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Proyecto
          </Button>
        </Card>
      )}

      {/* Dialog de usuarios del proyecto */}
      <Dialog open={usuariosDialogOpen} onOpenChange={setUsuariosDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuarios de {selectedProyecto?.nombre}
            </DialogTitle>
          </DialogHeader>
          
          {/* Formulario para asignar usuario */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h4 className="font-medium mb-3">Asignar Usuario</h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={asignarUsuarioData.usuarioId}
                onValueChange={(value) => setAsignarUsuarioData({ ...asignarUsuarioData, usuarioId: value })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  {usuariosDisponibles.map((usuario) => (
                    <SelectItem key={usuario.id} value={usuario.id.toString()}>
                      {usuario.name || usuario.email || `Usuario ${usuario.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={asignarUsuarioData.rolEnProyecto}
                onValueChange={(value: any) => setAsignarUsuarioData({ ...asignarUsuarioData, rolEnProyecto: value })}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="jefe_residente">Jefe Residente</SelectItem>
                  <SelectItem value="residente">Residente</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleAsignarUsuario}
                disabled={!asignarUsuarioData.usuarioId || asignarUsuarioMutation.isPending}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Asignar
              </Button>
            </div>
          </div>

          {/* Lista de usuarios asignados */}
          <div className="space-y-2">
            <h4 className="font-medium">Usuarios Asignados ({usuariosProyecto?.length || 0})</h4>
            {usuariosProyecto?.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No hay usuarios asignados a este proyecto
              </p>
            ) : (
              <div className="space-y-2">
                {usuariosProyecto?.map((pu) => (
                  <div
                    key={pu.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar 
                        name={pu.usuario?.name} 
                        fotoUrl={pu.usuario?.fotoUrl}
                        fotoBase64={(pu.usuario as any)?.fotoBase64}
                        size="lg"
                        showName={false}
                      />
                      <div>
                        <p className="font-medium">{pu.usuario?.name || "Usuario"}</p>
                        <p className="text-sm text-muted-foreground">{pu.usuario?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getRolBadgeColor(pu.rolEnProyecto)}>
                        {getRolLabel(pu.rolEnProyecto)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoverUsuario(pu.usuarioId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
