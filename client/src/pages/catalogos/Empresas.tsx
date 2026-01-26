import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { trpc } from "@/lib/trpc";
import { Building2, Edit, Plus, Trash2, FolderKanban } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";

type Empresa = {
  id: number;
  nombre: string;
  rfc?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  proyectoId?: number | null;
  especialidadId?: number | null;
};

export default function Empresas() {
  const { selectedProjectId } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    rfc: "",
    contacto: "",
    telefono: "",
    email: "",
    proyectoId: "",
    especialidadId: "",
  });

  const utils = trpc.useUtils();
  // Obtener empresas filtradas por proyecto desde el backend
  const { data: empresas, isLoading } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: proyectos } = trpc.proyectos.list.useQuery();
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );

  const createMutation = trpc.empresas.create.useMutation({
    onSuccess: () => {
      utils.empresas.list.invalidate();
      toast.success("Empresa creada correctamente");
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.empresas.update.useMutation({
    onSuccess: () => {
      utils.empresas.list.invalidate();
      toast.success("Empresa actualizada correctamente");
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.empresas.delete.useMutation({
    onSuccess: () => {
      utils.empresas.list.invalidate();
      toast.success("Empresa eliminada correctamente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleOpen = (empresa?: Empresa) => {
    if (empresa) {
      setEditingEmpresa(empresa);
      setFormData({
        nombre: empresa.nombre,
        rfc: empresa.rfc || "",
        contacto: empresa.contacto || "",
        telefono: empresa.telefono || "",
        email: empresa.email || "",
        proyectoId: empresa.proyectoId?.toString() || "",
        especialidadId: empresa.especialidadId?.toString() || "",
      });
    } else {
      setEditingEmpresa(null);
      setFormData({ 
        nombre: "", 
        rfc: "", 
        contacto: "", 
        telefono: "", 
        email: "",
        proyectoId: selectedProjectId?.toString() || "",
        especialidadId: "",
      });
    }
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingEmpresa(null);
    setFormData({ nombre: "", rfc: "", contacto: "", telefono: "", email: "", proyectoId: "", especialidadId: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    // Usar el proyecto seleccionado del contexto si no se especificó uno
    const proyectoIdFinal = formData.proyectoId ? parseInt(formData.proyectoId) : selectedProjectId;
    
    if (!proyectoIdFinal && !editingEmpresa) {
      toast.error("Debes seleccionar un proyecto primero");
      return;
    }

    const data = {
      nombre: formData.nombre,
      rfc: formData.rfc || undefined,
      contacto: formData.contacto || undefined,
      telefono: formData.telefono || undefined,
      email: formData.email || undefined,
      proyectoId: proyectoIdFinal || undefined,
      especialidadId: formData.especialidadId ? parseInt(formData.especialidadId) : undefined,
    };

    if (editingEmpresa) {
      updateMutation.mutate({ id: editingEmpresa.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de eliminar esta empresa?")) {
      deleteMutation.mutate({ id });
    }
  };

  const getProyectoNombre = (proyectoId: number | null | undefined) => {
    if (!proyectoId) return "-";
    const proyecto = proyectos?.find(p => p.id === proyectoId);
    return proyecto?.nombre || "-";
  };

  const getEspecialidadNombre = (especialidadId: number | null | undefined) => {
    if (!especialidadId) return "-";
    const especialidad = especialidades?.find(e => e.id === especialidadId);
    return especialidad?.nombre || "-";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
            <p className="text-muted-foreground">
              Gestiona las empresas contratistas del proyecto
            </p>
          </div>
          <Button onClick={() => handleOpen()}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Empresa
          </Button>
        </div>


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Lista de Empresas ({empresas?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : empresas?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay empresas registradas
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="hidden sm:table-cell">Especialidad</TableHead>
                      <TableHead className="hidden md:table-cell">Proyecto</TableHead>
                      <TableHead className="hidden lg:table-cell">RFC</TableHead>
                      <TableHead className="hidden lg:table-cell">Contacto</TableHead>
                      <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empresas?.map((empresa) => (
                      <TableRow key={empresa.id}>
                        <TableCell className="font-medium">{empresa.nombre}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {getEspecialidadNombre(empresa.especialidadId)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {getProyectoNombre(empresa.proyectoId)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{empresa.rfc || "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell">{empresa.contacto || "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell">{empresa.telefono || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpen(empresa)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(empresa.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingEmpresa ? "Editar Empresa" : "Nueva Empresa"}
              </DialogTitle>
              <DialogDescription>
                {editingEmpresa
                  ? "Modifica los datos de la empresa"
                  : "Ingresa los datos de la nueva empresa"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="proyectoId">Proyecto</Label>
                  <Select
                    value={formData.proyectoId}
                    onValueChange={(value) => setFormData({ ...formData, proyectoId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {proyectos?.map((proyecto) => (
                        <SelectItem key={proyecto.id} value={proyecto.id.toString()}>
                          {proyecto.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="especialidadId">Especialidad</Label>
                  <Select
                    value={formData.especialidadId}
                    onValueChange={(value) => setFormData({ ...formData, especialidadId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar especialidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin especialidad</SelectItem>
                      {especialidades?.map((especialidad) => (
                        <SelectItem key={especialidad.id} value={especialidad.id.toString()}>
                          {especialidad.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    placeholder="Nombre de la empresa"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rfc">RFC</Label>
                  <Input
                    id="rfc"
                    value={formData.rfc}
                    onChange={(e) =>
                      setFormData({ ...formData, rfc: e.target.value })
                    }
                    placeholder="RFC de la empresa"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contacto">Contacto</Label>
                  <Input
                    id="contacto"
                    value={formData.contacto}
                    onChange={(e) =>
                      setFormData({ ...formData, contacto: e.target.value })
                    }
                    placeholder="Nombre del contacto"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) =>
                        setFormData({ ...formData, telefono: e.target.value })
                      }
                      placeholder="Teléfono"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="correo@empresa.com"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingEmpresa ? "Guardar Cambios" : "Crear Empresa"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
