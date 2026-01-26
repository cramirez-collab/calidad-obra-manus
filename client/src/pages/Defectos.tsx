import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Plus, Pencil, Trash2, Search, Clock, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";

const severidadLabels: Record<string, string> = {
  leve: "Leve",
  moderado: "Moderado",
  grave: "Grave",
  critico: "Crítico",
};

const severidadColors: Record<string, string> = {
  leve: "bg-green-100 text-green-800",
  moderado: "bg-yellow-100 text-yellow-800",
  grave: "bg-orange-100 text-orange-800",
  critico: "bg-red-100 text-red-800",
};

interface DefectoFormData {
  nombre: string;
  codigo: string;
  descripcion: string;
  especialidadId: number | null;
  severidad: string;
  tiempoEstimadoResolucion: number | null;
}

export default function Defectos() {
  const { selectedProjectId } = useProject();
  const utils = trpc.useUtils();
  const { data: allDefectos, isLoading } = trpc.defectos.listConEstadisticas.useQuery();
  // Obtener especialidades filtradas por proyecto desde el backend
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  
  // Filtrar defectos por proyecto seleccionado
  const defectos = selectedProjectId
    ? allDefectos?.filter(d => d.proyectoId === selectedProjectId)
    : allDefectos;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingDefecto, setEditingDefecto] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEspecialidad, setFilterEspecialidad] = useState<string>("all");
  const [filterSeveridad, setFilterSeveridad] = useState<string>("all");

  const [formData, setFormData] = useState<DefectoFormData>({
    nombre: "",
    codigo: "",
    descripcion: "",
    especialidadId: null,
    severidad: "moderado",
    tiempoEstimadoResolucion: null,
  });

  const createMutation = trpc.defectos.create.useMutation({
    onSuccess: () => {
      utils.defectos.listConEstadisticas.invalidate();
      setIsCreateOpen(false);
      resetForm();
      toast.success("Defecto creado correctamente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.defectos.update.useMutation({
    onSuccess: () => {
      utils.defectos.listConEstadisticas.invalidate();
      setIsEditOpen(false);
      setEditingDefecto(null);
      toast.success("Defecto actualizado correctamente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.defectos.delete.useMutation({
    onSuccess: () => {
      utils.defectos.listConEstadisticas.invalidate();
      toast.success("Defecto eliminado correctamente");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      nombre: "",
      codigo: "",
      descripcion: "",
      especialidadId: null,
      severidad: "moderado",
      tiempoEstimadoResolucion: null,
    });
  };

  const handleCreate = () => {
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!selectedProjectId) {
      toast.error("Debes seleccionar un proyecto primero");
      return;
    }
    createMutation.mutate({
      nombre: formData.nombre,
      codigo: formData.codigo || undefined,
      descripcion: formData.descripcion || undefined,
      especialidadId: formData.especialidadId || undefined,
      severidad: formData.severidad as any,
      tiempoEstimadoResolucion: formData.tiempoEstimadoResolucion || undefined,
      proyectoId: selectedProjectId,
    });
  };

  const handleEdit = (defecto: any) => {
    setEditingDefecto(defecto);
    setFormData({
      nombre: defecto.nombre,
      codigo: defecto.codigo || "",
      descripcion: defecto.descripcion || "",
      especialidadId: defecto.especialidadId,
      severidad: defecto.severidad,
      tiempoEstimadoResolucion: defecto.tiempoEstimadoResolucion,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editingDefecto) return;
    updateMutation.mutate({
      id: editingDefecto.id,
      nombre: formData.nombre,
      codigo: formData.codigo || undefined,
      descripcion: formData.descripcion || undefined,
      especialidadId: formData.especialidadId || undefined,
      severidad: formData.severidad as any,
      tiempoEstimadoResolucion: formData.tiempoEstimadoResolucion || undefined,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de eliminar este defecto?")) {
      deleteMutation.mutate({ id });
    }
  };

  // Filtrar defectos
  const filteredDefectos = defectos?.filter(defecto => {
    const matchesSearch = !searchTerm || 
      defecto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      defecto.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEspecialidad = filterEspecialidad === "all" || 
      defecto.especialidadId?.toString() === filterEspecialidad;
    const matchesSeveridad = filterSeveridad === "all" || defecto.severidad === filterSeveridad;
    return matchesSearch && matchesEspecialidad && matchesSeveridad;
  });

  // Estadísticas
  const stats = {
    total: defectos?.length || 0,
    porSeveridad: {
      leve: defectos?.filter(d => d.severidad === 'leve').length || 0,
      moderado: defectos?.filter(d => d.severidad === 'moderado').length || 0,
      grave: defectos?.filter(d => d.severidad === 'grave').length || 0,
      critico: defectos?.filter(d => d.severidad === 'critico').length || 0,
    },
    totalItems: defectos?.reduce((acc, d) => acc + (d.estadisticas?.total || 0), 0) || 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Catálogo de Defectos</h1>
            <p className="text-muted-foreground">
              Tipos estandarizados de defectos para estadísticas consistentes
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#02B381] hover:bg-[#029970]">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Defecto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Defecto</DialogTitle>
                <DialogDescription>
                  Define un tipo de defecto para el catálogo.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Ej: Fisura en muro"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                      placeholder="Ej: DEF-001"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Descripción detallada del defecto"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="especialidad">Especialidad</Label>
                    <Select
                      value={formData.especialidadId?.toString() || "none"}
                      onValueChange={(value) => setFormData({ 
                        ...formData, 
                        especialidadId: value === "none" ? null : parseInt(value) 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">General</SelectItem>
                        {especialidades?.map((esp) => (
                          <SelectItem key={esp.id} value={esp.id.toString()}>
                            {esp.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="severidad">Severidad *</Label>
                    <Select
                      value={formData.severidad}
                      onValueChange={(value) => setFormData({ ...formData, severidad: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leve">Leve</SelectItem>
                        <SelectItem value="moderado">Moderado</SelectItem>
                        <SelectItem value="grave">Grave</SelectItem>
                        <SelectItem value="critico">Crítico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiempo">Tiempo estimado de resolución (horas)</Label>
                  <Input
                    id="tiempo"
                    type="number"
                    min="1"
                    value={formData.tiempoEstimadoResolucion || ""}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      tiempoEstimadoResolucion: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    placeholder="Ej: 24"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="bg-[#02B381] hover:bg-[#029970]"
                >
                  {createMutation.isPending ? "Creando..." : "Crear Defecto"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Estadísticas */}
        <div className="grid gap-2 sm:gap-4 grid-cols-3 sm:grid-cols-5">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <AlertTriangle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Defectos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <AlertTriangle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.porSeveridad.leve}</p>
                  <p className="text-xs text-muted-foreground">Leves</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.porSeveridad.moderado}</p>
                  <p className="text-xs text-muted-foreground">Moderados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.porSeveridad.grave}</p>
                  <p className="text-xs text-muted-foreground">Graves</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.porSeveridad.critico}</p>
                  <p className="text-xs text-muted-foreground">Críticos</p>
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
                <Select value={filterEspecialidad} onValueChange={setFilterEspecialidad}>
                  <SelectTrigger>
                    <SelectValue placeholder="Especialidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {especialidades?.map((esp) => (
                      <SelectItem key={esp.id} value={esp.id.toString()}>
                        {esp.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterSeveridad} onValueChange={setFilterSeveridad}>
                  <SelectTrigger>
                    <SelectValue placeholder="Severidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="leve">Leve</SelectItem>
                    <SelectItem value="moderado">Moderado</SelectItem>
                    <SelectItem value="grave">Grave</SelectItem>
                    <SelectItem value="critico">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de defectos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Catálogo ({filteredDefectos?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : filteredDefectos?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron defectos
              </div>
            ) : (
              <>
                {/* Vista móvil - Cards */}
                <div className="sm:hidden divide-y">
                  {filteredDefectos?.map((defecto) => (
                    <div key={defecto.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{defecto.nombre}</p>
                          {defecto.codigo && (
                            <p className="text-xs font-mono text-muted-foreground">{defecto.codigo}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(defecto)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(defecto.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={severidadColors[defecto.severidad] + " text-xs"}>
                          {severidadLabels[defecto.severidad]}
                        </Badge>
                        {defecto.especialidad && (
                          <Badge variant="outline" className="text-xs">
                            {defecto.especialidad.nombre}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          {defecto.estadisticas?.total || 0} ítems
                        </span>
                        {defecto.tiempoEstimadoResolucion && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {defecto.tiempoEstimadoResolucion}h
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vista desktop - Tabla */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Especialidad</TableHead>
                        <TableHead>Severidad</TableHead>
                        <TableHead>Tiempo Est.</TableHead>
                        <TableHead>Ítems</TableHead>
                        <TableHead>Tasa Aprob.</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDefectos?.map((defecto) => (
                        <TableRow key={defecto.id}>
                          <TableCell className="font-mono text-sm">
                            {defecto.codigo || "-"}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{defecto.nombre}</p>
                              {defecto.descripcion && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {defecto.descripcion}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {defecto.especialidad ? (
                              <Badge variant="outline">
                                {defecto.especialidad.nombre}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">General</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={severidadColors[defecto.severidad]}>
                              {severidadLabels[defecto.severidad]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {defecto.tiempoEstimadoResolucion ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3" />
                                {defecto.tiempoEstimadoResolucion}h
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <BarChart3 className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">{defecto.estadisticas?.total || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {defecto.estadisticas?.total > 0 ? (
                              <span className={`font-medium ${
                                defecto.estadisticas.tasaAprobacion >= 80 ? 'text-emerald-600' :
                                defecto.estadisticas.tasaAprobacion >= 50 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {defecto.estadisticas.tasaAprobacion}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(defecto)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(defecto.id)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
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

        {/* Dialog de edición */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Defecto</DialogTitle>
              <DialogDescription>
                Modifica los datos del defecto.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nombre">Nombre *</Label>
                  <Input
                    id="edit-nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-codigo">Código</Label>
                  <Input
                    id="edit-codigo"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-descripcion">Descripción</Label>
                <Textarea
                  id="edit-descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-especialidad">Especialidad</Label>
                  <Select
                    value={formData.especialidadId?.toString() || "none"}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      especialidadId: value === "none" ? null : parseInt(value) 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">General</SelectItem>
                      {especialidades?.map((esp) => (
                        <SelectItem key={esp.id} value={esp.id.toString()}>
                          {esp.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-severidad">Severidad *</Label>
                  <Select
                    value={formData.severidad}
                    onValueChange={(value) => setFormData({ ...formData, severidad: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leve">Leve</SelectItem>
                      <SelectItem value="moderado">Moderado</SelectItem>
                      <SelectItem value="grave">Grave</SelectItem>
                      <SelectItem value="critico">Crítico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tiempo">Tiempo estimado (horas)</Label>
                <Input
                  id="edit-tiempo"
                  type="number"
                  min="1"
                  value={formData.tiempoEstimadoResolucion || ""}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    tiempoEstimadoResolucion: e.target.value ? parseInt(e.target.value) : null 
                  })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
                className="bg-[#02B381] hover:bg-[#029970]"
              >
                {updateMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
