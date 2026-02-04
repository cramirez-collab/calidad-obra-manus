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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wrench, Edit, Plus, Trash2, User, ListOrdered } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";

type Especialidad = {
  id: number;
  numero?: number | null;
  nombre: string;
  codigo?: string | null;
  descripcion?: string | null;
  color?: string | null;
  proyectoId?: number | null;
  residenteId?: number | null;
};

const defaultColors = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
];

export default function Especialidades() {
  const { selectedProjectId } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [editingEspecialidad, setEditingEspecialidad] = useState<Especialidad | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    codigo: "",
    descripcion: "",
    color: "#3B82F6",
    residenteId: "" as string,
  });

  // Obtener usuarios del proyecto para asignar como residente
  const { data: usuarios } = trpc.users.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );

  const utils = trpc.useUtils();
  // Obtener especialidades filtradas por proyecto desde el backend
  const { data: especialidades, isLoading } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );

  const createMutation = trpc.especialidades.create.useMutation({
    onSuccess: () => {
      utils.especialidades.list.invalidate();
      toast.success("Especialidad creada correctamente");
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.especialidades.update.useMutation({
    onSuccess: () => {
      utils.especialidades.list.invalidate();
      toast.success("Especialidad actualizada correctamente");
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.especialidades.delete.useMutation({
    onSuccess: () => {
      utils.especialidades.list.invalidate();
      toast.success("Especialidad eliminada correctamente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleOpen = (especialidad?: Especialidad) => {
    if (especialidad) {
      setEditingEspecialidad(especialidad);
      setFormData({
        nombre: especialidad.nombre,
        codigo: especialidad.codigo || "",
        descripcion: especialidad.descripcion || "",
        color: especialidad.color || "#3B82F6",
        residenteId: especialidad.residenteId?.toString() || "",
      });
    } else {
      setEditingEspecialidad(null);
      setFormData({ nombre: "", codigo: "", descripcion: "", color: "#3B82F6", residenteId: "" });
    }
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingEspecialidad(null);
    setFormData({ nombre: "", codigo: "", descripcion: "", color: "#3B82F6", residenteId: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    const data = {
      nombre: formData.nombre,
      codigo: formData.codigo || undefined,
      descripcion: formData.descripcion || undefined,
      color: formData.color || undefined,
      proyectoId: selectedProjectId || undefined,
      residenteId: formData.residenteId && formData.residenteId !== 'none' ? parseInt(formData.residenteId) : undefined,
    };

    if (editingEspecialidad) {
      updateMutation.mutate({ id: editingEspecialidad.id, ...data });
    } else {
      if (!selectedProjectId) {
        toast.error("Debes seleccionar un proyecto primero");
        return;
      }
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de eliminar esta especialidad?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Especialidades</h1>
            <p className="text-muted-foreground">
              Gestiona las especialidades o disciplinas de trabajo
            </p>
          </div>
          <Button onClick={() => handleOpen()}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Especialidad
          </Button>
        </div>

        <Tabs defaultValue="gestion" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="gestion" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Gestión
            </TabsTrigger>
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4" />
              Lista Numerada
            </TabsTrigger>
          </TabsList>
          
          {/* Tab de Gestión */}
          <TabsContent value="gestion">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Gestión de Especialidades
                </CardTitle>
              </CardHeader>
              <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : especialidades?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay especialidades registradas
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] text-center">#</TableHead>
                    <TableHead className="w-[60px]">Color</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Residente</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {especialidades?.map((especialidad) => (
                    <TableRow key={especialidad.id}>
                      <TableCell className="text-center font-bold text-lg text-primary">
                        {especialidad.numero || "-"}
                      </TableCell>
                      <TableCell>
                        <div
                          className="h-6 w-6 rounded-full border"
                          style={{ backgroundColor: especialidad.color || "#3B82F6" }}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {especialidad.codigo || "-"}
                      </TableCell>
                      <TableCell className="font-medium">{especialidad.nombre}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {especialidad.descripcion || "-"}
                      </TableCell>
                      <TableCell>
                        {especialidad.residenteId 
                          ? usuarios?.find(u => u.id === especialidad.residenteId)?.name || "-"
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpen(especialidad)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(especialidad.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Tab de Lista Numerada */}
          <TabsContent value="lista">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="h-5 w-5" />
                  Lista Numerada de Especialidades
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </div>
                ) : especialidades?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay especialidades registradas
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-4">
                      Esta lista muestra el número asignado a cada especialidad. 
                      Los números se asignan automáticamente en orden de creación.
                    </p>
                    <div className="grid gap-2">
                      {especialidades?.map((especialidad) => (
                        <div 
                          key={especialidad.id}
                          className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div 
                            className="flex items-center justify-center h-10 w-10 rounded-full text-white font-bold text-lg"
                            style={{ backgroundColor: especialidad.color || "#3B82F6" }}
                          >
                            {especialidad.numero || "-"}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{especialidad.nombre}</p>
                            {especialidad.codigo && (
                              <p className="text-sm text-muted-foreground">Código: {especialidad.codigo}</p>
                            )}
                          </div>
                          {especialidad.residenteId && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {usuarios?.find(u => u.id === especialidad.residenteId)?.name || "-"}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEspecialidad ? "Editar Especialidad" : "Nueva Especialidad"}
              </DialogTitle>
              <DialogDescription>
                {editingEspecialidad
                  ? "Modifica los datos de la especialidad"
                  : "Ingresa los datos de la nueva especialidad"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) =>
                        setFormData({ ...formData, nombre: e.target.value })
                      }
                      placeholder="Ej: Electricidad"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="codigo">Código</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) =>
                        setFormData({ ...formData, codigo: e.target.value })
                      }
                      placeholder="Ej: ELEC"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {defaultColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`h-8 w-8 rounded-full border-2 transition-all ${
                          formData.color === color
                            ? "border-foreground scale-110"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                    <Input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="h-8 w-8 p-0 border-0 cursor-pointer"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) =>
                      setFormData({ ...formData, descripcion: e.target.value })
                    }
                    placeholder="Descripción de la especialidad"
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Residente Responsable</Label>
                  <Select
                    value={formData.residenteId || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, residenteId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar residente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin residente asignado</SelectItem>
                      {usuarios?.filter(u => u.role === 'residente' || u.role === 'jefe_residente').map((usuario) => (
                        <SelectItem key={usuario.id} value={usuario.id.toString()}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {usuario.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  {editingEspecialidad ? "Guardar Cambios" : "Crear Especialidad"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
