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
import { Tags, Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";

type Atributo = {
  id: number;
  nombre: string;
  categoria?: string | null;
  descripcion?: string | null;
  proyectoId?: number | null;
};

export default function Atributos() {
  const { selectedProjectId } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [editingAtributo, setEditingAtributo] = useState<Atributo | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    categoria: "",
    descripcion: "",
  });

  const utils = trpc.useUtils();
  const { data: allAtributos, isLoading } = trpc.atributos.list.useQuery();
  
  // Filtrar atributos por proyecto seleccionado (aislamiento por proyecto)
  const atributos = selectedProjectId
    ? allAtributos?.filter(a => a.proyectoId === selectedProjectId)
    : allAtributos;

  const createMutation = trpc.atributos.create.useMutation({
    onSuccess: () => {
      utils.atributos.list.invalidate();
      toast.success("Atributo creado correctamente");
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.atributos.update.useMutation({
    onSuccess: () => {
      utils.atributos.list.invalidate();
      toast.success("Atributo actualizado correctamente");
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.atributos.delete.useMutation({
    onSuccess: () => {
      utils.atributos.list.invalidate();
      toast.success("Atributo eliminado correctamente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleOpen = (atributo?: Atributo) => {
    if (atributo) {
      setEditingAtributo(atributo);
      setFormData({
        nombre: atributo.nombre,
        categoria: atributo.categoria || "",
        descripcion: atributo.descripcion || "",
      });
    } else {
      setEditingAtributo(null);
      setFormData({ nombre: "", categoria: "", descripcion: "" });
    }
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingAtributo(null);
    setFormData({ nombre: "", categoria: "", descripcion: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    const data = {
      nombre: formData.nombre,
      categoria: formData.categoria || undefined,
      descripcion: formData.descripcion || undefined,
      proyectoId: selectedProjectId || undefined,
    };

    if (editingAtributo) {
      updateMutation.mutate({ id: editingAtributo.id, ...data });
    } else {
      if (!selectedProjectId) {
        toast.error("Debes seleccionar un proyecto primero");
        return;
      }
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de eliminar este atributo?")) {
      deleteMutation.mutate({ id });
    }
  };

  // Agrupar atributos por categoría
  const groupedAtributos = atributos?.reduce((acc, attr) => {
    const cat = attr.categoria || "Sin categoría";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(attr);
    return acc;
  }, {} as Record<string, typeof atributos>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Atributos</h1>
            <p className="text-muted-foreground">
              Gestiona los atributos o tipos de defectos
            </p>
          </div>
          <Button onClick={() => handleOpen()}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Atributo
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              Lista de Atributos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : atributos?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay atributos registrados
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atributos?.map((atributo) => (
                    <TableRow key={atributo.id}>
                      <TableCell className="font-medium">{atributo.nombre}</TableCell>
                      <TableCell>
                        {atributo.categoria ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary">
                            {atributo.categoria}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {atributo.descripcion || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpen(atributo)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(atributo.id)}
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
                {editingAtributo ? "Editar Atributo" : "Nuevo Atributo"}
              </DialogTitle>
              <DialogDescription>
                {editingAtributo
                  ? "Modifica los datos del atributo"
                  : "Ingresa los datos del nuevo atributo"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    placeholder="Ej: Fisura, Humedad, Acabado deficiente"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="categoria">Categoría</Label>
                  <Input
                    id="categoria"
                    value={formData.categoria}
                    onChange={(e) =>
                      setFormData({ ...formData, categoria: e.target.value })
                    }
                    placeholder="Ej: Estructural, Acabados, Instalaciones"
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
                    placeholder="Descripción del tipo de defecto o atributo"
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
                  {editingAtributo ? "Guardar Cambios" : "Crear Atributo"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
