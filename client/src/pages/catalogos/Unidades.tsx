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
import { MapPin, Edit, Plus, Trash2, FileDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";

type Unidad = {
  id: number;
  nombre: string;
  codigo?: string | null;
  descripcion?: string | null;
  ubicacion?: string | null;
  proyectoId?: number | null;
  nivel?: number | null;
  orden?: number | null;
};

export default function Unidades() {
  const { selectedProjectId } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [editingUnidad, setEditingUnidad] = useState<Unidad | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    codigo: "",
    descripcion: "",
    ubicacion: "",
    nivel: "",
    orden: "",
  });

  const utils = trpc.useUtils();
  // Obtener unidades filtradas por proyecto desde el backend
  const { data: unidades, isLoading } = trpc.unidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );

  const createMutation = trpc.unidades.create.useMutation({
    onSuccess: () => {
      utils.unidades.list.invalidate();
      toast.success("Unidad creada correctamente");
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.unidades.update.useMutation({
    onSuccess: () => {
      utils.unidades.list.invalidate();
      toast.success("Unidad actualizada correctamente");
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.unidades.delete.useMutation({
    onSuccess: () => {
      utils.unidades.list.invalidate();
      toast.success("Unidad eliminada correctamente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleOpen = (unidad?: Unidad) => {
    if (unidad) {
      setEditingUnidad(unidad);
      setFormData({
        nombre: unidad.nombre,
        codigo: unidad.codigo || "",
        descripcion: unidad.descripcion || "",
        ubicacion: unidad.ubicacion || "",
        nivel: unidad.nivel?.toString() || "",
        orden: unidad.orden?.toString() || "",
      });
    } else {
      setEditingUnidad(null);
      setFormData({ nombre: "", codigo: "", descripcion: "", ubicacion: "", nivel: "", orden: "" });
    }
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingUnidad(null);
    setFormData({ nombre: "", codigo: "", descripcion: "", ubicacion: "", nivel: "", orden: "" });
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
      ubicacion: formData.ubicacion || undefined,
      proyectoId: selectedProjectId || undefined,
      nivel: formData.nivel ? parseInt(formData.nivel) : undefined,
      orden: formData.orden ? parseInt(formData.orden) : undefined,
    };

    if (editingUnidad) {
      updateMutation.mutate({ id: editingUnidad.id, ...data });
    } else {
      if (!selectedProjectId) {
        toast.error("Debes seleccionar un proyecto primero");
        return;
      }
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de eliminar esta unidad?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Unidades</h1>
            <p className="text-muted-foreground">
              Gestiona las unidades o áreas del proyecto
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => window.print()} title="Exportar PDF">
              <FileDown className="h-4 w-4" />
            </Button>
            <Button onClick={() => handleOpen()}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Unidad
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Lista de Unidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : unidades?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay unidades registradas
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unidades?.map((unidad) => (
                    <TableRow key={unidad.id}>
                      <TableCell className="font-mono text-sm">
                        {unidad.codigo || "-"}
                      </TableCell>
                      <TableCell className="font-medium">{unidad.nombre}</TableCell>
                      <TableCell>{unidad.ubicacion || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {unidad.descripcion || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpen(unidad)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(unidad.id)}
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

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUnidad ? "Editar Unidad" : "Nueva Unidad"}
              </DialogTitle>
              <DialogDescription>
                {editingUnidad
                  ? "Modifica los datos de la unidad"
                  : "Ingresa los datos de la nueva unidad"}
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
                      placeholder="Ej: Departamento 101"
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
                      placeholder="Ej: D-101"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="nivel">Nivel/Piso *</Label>
                    <Input
                      id="nivel"
                      type="number"
                      value={formData.nivel}
                      onChange={(e) =>
                        setFormData({ ...formData, nivel: e.target.value })
                      }
                      placeholder="Ej: 1, 2, 3..."
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="orden">Orden en nivel</Label>
                    <Input
                      id="orden"
                      type="number"
                      value={formData.orden}
                      onChange={(e) =>
                        setFormData({ ...formData, orden: e.target.value })
                      }
                      placeholder="Ej: 1, 2, 3..."
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ubicacion">Ubicación</Label>
                  <Input
                    id="ubicacion"
                    value={formData.ubicacion}
                    onChange={(e) =>
                      setFormData({ ...formData, ubicacion: e.target.value })
                    }
                    placeholder="Ej: Torre A, Piso 1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) =>
                      setFormData({ ...formData, descripcion: e.target.value })
                    }
                    placeholder="Descripción adicional de la unidad"
                    rows={3}
                  />
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
                  {editingUnidad ? "Guardar Cambios" : "Crear Unidad"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
