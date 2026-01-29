import { useState, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Plus, Trash2, Search, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";

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
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: allDefectos, isLoading } = trpc.defectos.listConEstadisticas.useQuery();
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  
  // Filtrar defectos por proyecto seleccionado
  const defectos = selectedProjectId
    ? allDefectos?.filter(d => d.proyectoId === selectedProjectId)
    : allDefectos;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedEspecialidades, setExpandedEspecialidades] = useState<Set<number | string>>(new Set());
  const [selectedEspecialidadForCreate, setSelectedEspecialidadForCreate] = useState<number | null>(null);

  const [formData, setFormData] = useState<DefectoFormData>({
    nombre: "",
    codigo: "",
    descripcion: "",
    especialidadId: null,
    severidad: "moderado",
    tiempoEstimadoResolucion: null,
  });

  // Verificar si el usuario puede gestionar defectos (supervisor o superior)
  const canManageDefectos = user && ['superadmin', 'admin', 'supervisor'].includes(user.role);

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

  const handleDelete = (id: number, nombre: string) => {
    if (confirm(`¿Estás seguro de eliminar el defecto "${nombre}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const openCreateForEspecialidad = (especialidadId: number | null) => {
    setFormData({
      ...formData,
      especialidadId: especialidadId,
    });
    setSelectedEspecialidadForCreate(especialidadId);
    setIsCreateOpen(true);
  };

  const toggleEspecialidad = (id: number | string) => {
    const newExpanded = new Set(expandedEspecialidades);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEspecialidades(newExpanded);
  };

  // Agrupar defectos por especialidad
  const defectosAgrupados = useMemo(() => {
    if (!defectos || !especialidades) return [];

    const grupos: { especialidad: any; defectos: any[] }[] = [];
    
    // Agrupar por cada especialidad
    especialidades.forEach(esp => {
      const defectosDeEsp = defectos.filter(d => d.especialidadId === esp.id);
      if (defectosDeEsp.length > 0 || canManageDefectos) {
        grupos.push({
          especialidad: esp,
          defectos: defectosDeEsp.filter(d => 
            !searchTerm || d.nombre.toLowerCase().includes(searchTerm.toLowerCase())
          ),
        });
      }
    });

    // Defectos sin especialidad (generales)
    const defectosGenerales = defectos.filter(d => !d.especialidadId);
    if (defectosGenerales.length > 0 || canManageDefectos) {
      grupos.push({
        especialidad: { id: 'general', nombre: 'General', color: '#6B7280' },
        defectos: defectosGenerales.filter(d =>
          !searchTerm || d.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        ),
      });
    }

    return grupos;
  }, [defectos, especialidades, searchTerm, canManageDefectos]);

  // Estadísticas
  const stats = {
    total: defectos?.length || 0,
    especialidades: especialidades?.length || 0,
    totalItems: defectos?.reduce((acc, d) => acc + (d.estadisticas?.total || 0), 0) || 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header compacto */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Catálogo de Defectos</h1>
            <p className="text-sm text-muted-foreground">
              Defectos agrupados por especialidad
            </p>
          </div>
        </div>

        {/* Estadísticas compactas */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#02B381]">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Defectos</p>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.especialidades}</p>
              <p className="text-xs text-muted-foreground">Especialidades</p>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.totalItems}</p>
              <p className="text-xs text-muted-foreground">Ítems</p>
            </div>
          </Card>
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar defecto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Lista agrupada por especialidad */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando...
          </div>
        ) : defectosAgrupados.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay especialidades configuradas
          </div>
        ) : (
          <div className="space-y-2">
            {defectosAgrupados.map((grupo) => (
              <Card key={grupo.especialidad.id} className="overflow-hidden">
                <Collapsible
                  open={expandedEspecialidades.has(grupo.especialidad.id)}
                  onOpenChange={() => toggleEspecialidad(grupo.especialidad.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div 
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      style={{ borderLeft: `4px solid ${grupo.especialidad.color || '#02B381'}` }}
                    >
                      <div className="flex items-center gap-3">
                        {expandedEspecialidades.has(grupo.especialidad.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Layers className="h-4 w-4" style={{ color: grupo.especialidad.color || '#02B381' }} />
                        <span className="font-medium">{grupo.especialidad.nombre}</span>
                        <Badge variant="secondary" className="text-xs">
                          {grupo.defectos.length} defectos
                        </Badge>
                      </div>
                      {canManageDefectos && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-[#02B381] hover:text-[#029970] hover:bg-[#02B381]/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreateForEspecialidad(
                              grupo.especialidad.id === 'general' ? null : grupo.especialidad.id
                            );
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Agregar</span>
                        </Button>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t">
                      {grupo.defectos.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No hay defectos en esta especialidad
                        </div>
                      ) : (
                        <div className="divide-y">
                          {grupo.defectos.map((defecto) => (
                            <div 
                              key={defecto.id} 
                              className="flex items-center justify-between p-3 hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: grupo.especialidad.color || '#02B381' }}
                                />
                                <div>
                                  <p className="text-sm font-medium">{defecto.nombre}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Badge className={`${severidadColors[defecto.severidad]} text-xs`}>
                                      {severidadLabels[defecto.severidad]}
                                    </Badge>
                                    {defecto.estadisticas?.total > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        {defecto.estadisticas.total} ítems
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {canManageDefectos && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDelete(defecto.id, defecto.nombre)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog para crear defecto */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Agregar Defecto</DialogTitle>
              <DialogDescription>
                {selectedEspecialidadForCreate
                  ? `Agregar defecto a: ${especialidades?.find(e => e.id === selectedEspecialidadForCreate)?.nombre || 'General'}`
                  : 'Agregar defecto general'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del defecto *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Fisura en muro"
                />
              </div>
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
                <Label htmlFor="severidad">Severidad</Label>
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
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción (opcional)</Label>
                <Textarea
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción detallada del defecto"
                  rows={2}
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
                {createMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
