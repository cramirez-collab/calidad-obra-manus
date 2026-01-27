import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Copy, Home, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useSortable } from "@/hooks/useSortable";
import { SortableHeader } from "@/components/SortableHeader";

// Espacios predefinidos sugeridos
const ESPACIOS_SUGERIDOS = [
  "Sala",
  "Comedor", 
  "Cocina",
  "Recámara 1",
  "Recámara 2",
  "Recámara 3",
  "Baño 1",
  "Baño 2",
  "Baño 3",
  "Balcón",
  "Terraza",
  "Vestidor",
  "Estudio",
  "Cuarto de servicio",
  "Área de lavado",
  "Pasillo",
  "Entrada",
  "Closet"
];

type Espacio = {
  id: number;
  proyectoId: number | null;
  unidadId: number | null;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  orden: number | null;
};

export default function Espacios() {
  const { selectedProjectId } = useProject();
  const proyectoId = selectedProjectId;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEspacio, setEditingEspacio] = useState<Espacio | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    codigo: "",
    descripcion: "",
    orden: "0",
    unidadId: "" // vacío = plantilla del proyecto
  });
  const [vistaPlantilla, setVistaPlantilla] = useState(true);

  // Queries
  const { data: espaciosPlantilla, refetch: refetchPlantilla } = trpc.espacios.plantilla.useQuery(
    { proyectoId: proyectoId! },
    { enabled: !!proyectoId }
  );
  
  // Ordenamiento de espacios
  const { sortedItems: sortedEspacios, sortConfig, requestSort } = useSortable<Espacio>(espaciosPlantilla, "orden");
  
  const { data: unidades } = trpc.unidades.list.useQuery(
    { proyectoId: proyectoId || undefined },
    { enabled: !!proyectoId }
  );

  // Mutations
  const createMutation = trpc.espacios.create.useMutation({
    onSuccess: () => {
      toast.success("Espacio creado correctamente");
      refetchPlantilla();
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error(error.message)
  });

  const updateMutation = trpc.espacios.update.useMutation({
    onSuccess: () => {
      toast.success("Espacio actualizado correctamente");
      refetchPlantilla();
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error(error.message)
  });

  const deleteMutation = trpc.espacios.delete.useMutation({
    onSuccess: () => {
      toast.success("Espacio eliminado correctamente");
      refetchPlantilla();
    },
    onError: (error) => toast.error(error.message)
  });

  const copiarPlantillaMutation = trpc.espacios.copiarPlantilla.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} espacios copiados a la unidad`);
    },
    onError: (error) => toast.error(error.message)
  });

  const resetForm = () => {
    setFormData({ nombre: "", codigo: "", descripcion: "", orden: "0", unidadId: "" });
    setEditingEspacio(null);
  };

  const handleSubmit = () => {
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    const data = {
      proyectoId: proyectoId || undefined,
      unidadId: formData.unidadId && formData.unidadId !== 'none' ? parseInt(formData.unidadId) : undefined,
      nombre: formData.nombre.trim(),
      codigo: formData.codigo || undefined,
      descripcion: formData.descripcion || undefined,
      orden: parseInt(formData.orden) || 0
    };

    if (editingEspacio) {
      updateMutation.mutate({ id: editingEspacio.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (espacio: Espacio) => {
    setEditingEspacio(espacio);
    setFormData({
      nombre: espacio.nombre,
      codigo: espacio.codigo || "",
      descripcion: espacio.descripcion || "",
      orden: String(espacio.orden || 0),
      unidadId: espacio.unidadId ? String(espacio.unidadId) : ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de eliminar este espacio?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleAgregarSugerido = (nombre: string) => {
    setFormData(prev => ({ ...prev, nombre }));
  };

  const handleCopiarPlantillaAUnidad = (unidadId: number) => {
    if (!proyectoId) return;
    if (confirm("¿Copiar todos los espacios plantilla a esta unidad?")) {
      copiarPlantillaMutation.mutate({ proyectoId, unidadId });
    }
  };

  if (!proyectoId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Selecciona un proyecto para gestionar los espacios
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Espacios</h1>
          <p className="text-muted-foreground">
            Define los espacios (sala, recámaras, baños, etc.) que tendrán las unidades
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Espacio
        </Button>
      </div>

      {/* Tabs para vista */}
      <div className="flex gap-2">
        <Button 
          variant={vistaPlantilla ? "default" : "outline"}
          onClick={() => setVistaPlantilla(true)}
        >
          <Home className="w-4 h-4 mr-2" />
          Plantilla del Proyecto
        </Button>
        <Button 
          variant={!vistaPlantilla ? "default" : "outline"}
          onClick={() => setVistaPlantilla(false)}
        >
          <Building2 className="w-4 h-4 mr-2" />
          Copiar a Unidades
        </Button>
      </div>

      {vistaPlantilla ? (
        /* Vista de Plantilla */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="w-5 h-5" />
              Espacios Plantilla
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Estos espacios se pueden copiar a cualquier unidad del proyecto
            </p>
          </CardHeader>
          <CardContent>
            {sortedEspacios && sortedEspacios.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortableHeader<Espacio>
                        label="Orden"
                        sortKey="orden"
                        currentSortKey={sortConfig.key}
                        sortDirection={sortConfig.direction}
                        onSort={requestSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader<Espacio>
                        label="Nombre"
                        sortKey="nombre"
                        currentSortKey={sortConfig.key}
                        sortDirection={sortConfig.direction}
                        onSort={requestSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader<Espacio>
                        label="Código"
                        sortKey="codigo"
                        currentSortKey={sortConfig.key}
                        sortDirection={sortConfig.direction}
                        onSort={requestSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader<Espacio>
                        label="Descripción"
                        sortKey="descripcion"
                        currentSortKey={sortConfig.key}
                        sortDirection={sortConfig.direction}
                        onSort={requestSort}
                      />
                    </TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEspacios.map((espacio) => (
                    <TableRow key={espacio.id}>
                      <TableCell>{espacio.orden}</TableCell>
                      <TableCell className="font-medium">{espacio.nombre}</TableCell>
                      <TableCell>{espacio.codigo || "-"}</TableCell>
                      <TableCell>{espacio.descripcion || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(espacio)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(espacio.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay espacios en la plantilla.</p>
                <p className="text-sm mt-2">Agrega espacios usando los sugeridos o crea uno nuevo.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Vista de Copiar a Unidades */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Copiar Plantilla a Unidades
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Selecciona una unidad para copiar todos los espacios de la plantilla
            </p>
          </CardHeader>
          <CardContent>
            {unidades && unidades.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unidades.map((unidad) => (
                  <Card key={unidad.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{unidad.nombre}</p>
                        <p className="text-sm text-muted-foreground">{unidad.codigo}</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleCopiarPlantillaAUnidad(unidad.id)}
                        disabled={copiarPlantillaMutation.isPending}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copiar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No hay unidades en este proyecto
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog para crear/editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEspacio ? "Editar Espacio" : "Nuevo Espacio"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Sugerencias rápidas */}
            {!editingEspacio && (
              <div>
                <label className="text-sm font-medium mb-2 block">Espacios sugeridos:</label>
                <div className="flex flex-wrap gap-2">
                  {ESPACIOS_SUGERIDOS.slice(0, 12).map((nombre) => (
                    <Button
                      key={nombre}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAgregarSugerido(nombre)}
                      className="text-xs"
                    >
                      {nombre}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Sala, Recámara 1, Baño Principal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Código</label>
                <Input
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ej: SAL, REC1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Orden</label>
                <Input
                  type="number"
                  value={formData.orden}
                  onChange={(e) => setFormData({ ...formData, orden: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Input
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Asignar a unidad (opcional)</label>
              <Select
                value={formData.unidadId}
                onValueChange={(value) => setFormData({ ...formData, unidadId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Plantilla del proyecto (sin unidad)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Plantilla del proyecto</SelectItem>
                  {unidades?.map((unidad) => (
                    <SelectItem key={unidad.id} value={String(unidad.id)}>
                      {unidad.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Deja vacío para agregar a la plantilla general del proyecto
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingEspacio ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
