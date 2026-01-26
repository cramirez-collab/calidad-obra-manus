import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  Target, 
  Plus, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  Trash2,
  Edit,
  Building2,
  MapPin,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";

const tipoMetas = [
  { value: 'aprobacion', label: 'Tasa de Aprobación', icon: CheckCircle2, unidad: '%' },
  { value: 'tiempo_resolucion', label: 'Tiempo de Resolución', icon: Clock, unidad: 'días' },
  { value: 'items_mes', label: 'Ítems por Mes', icon: TrendingUp, unidad: 'ítems' },
];

export default function Metas() {
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const isSuperadmin = user?.role === 'superadmin';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<any>(null);

  const { data: metas, isLoading, refetch } = trpc.metas.listConProgreso.useQuery();
  const { data: empresas } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: unidades } = trpc.unidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );

  const createMutation = trpc.metas.create.useMutation({
    onSuccess: () => {
      toast.success("Meta creada");
      setDialogOpen(false);
      refetch();
    },
    onError: () => toast.error("Error al crear meta"),
  });

  const updateMutation = trpc.metas.update.useMutation({
    onSuccess: () => {
      toast.success("Meta actualizada");
      setDialogOpen(false);
      setEditingMeta(null);
      refetch();
    },
    onError: () => toast.error("Error al actualizar"),
  });

  const deleteMutation = trpc.metas.delete.useMutation({
    onSuccess: () => {
      toast.success("Meta eliminada");
      refetch();
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'aprobacion',
    valorObjetivo: 80,
    empresaId: '',
    unidadId: '',
  });

  const handleSubmit = () => {
    if (!form.nombre || !form.valorObjetivo) {
      toast.error("Completa los campos requeridos");
      return;
    }

    const data = {
      nombre: form.nombre,
      descripcion: form.descripcion || undefined,
      tipo: form.tipo,
      valorObjetivo: Number(form.valorObjetivo),
      unidadMedida: tipoMetas.find(t => t.value === form.tipo)?.unidad,
      empresaId: form.empresaId ? Number(form.empresaId) : undefined,
      unidadId: form.unidadId ? Number(form.unidadId) : undefined,
    };

    if (editingMeta) {
      updateMutation.mutate({ id: editingMeta.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (meta: any) => {
    setEditingMeta(meta);
    setForm({
      nombre: meta.nombre,
      descripcion: meta.descripcion || '',
      tipo: meta.tipo,
      valorObjetivo: meta.valorObjetivo,
      empresaId: meta.empresaId?.toString() || '',
      unidadId: meta.unidadId?.toString() || '',
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingMeta(null);
    setForm({
      nombre: '',
      descripcion: '',
      tipo: 'aprobacion',
      valorObjetivo: 80,
      empresaId: '',
      unidadId: '',
    });
    setDialogOpen(true);
  };

  const getProgressColor = (progreso: number) => {
    if (progreso >= 100) return 'bg-green-500';
    if (progreso >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">Metas</h1>
              <p className="text-xs text-muted-foreground">Objetivos de calidad</p>
            </div>
          </div>
          
          {isSuperadmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openNew} className="h-9">
                  <Plus className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Nueva</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingMeta ? 'Editar Meta' : 'Nueva Meta'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nombre *</Label>
                    <Input
                      value={form.nombre}
                      onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Ej: Tasa de aprobación Q1"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select value={form.tipo} onValueChange={(v) => setForm(f => ({ ...f, tipo: v }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tipoMetas.map(t => (
                            <SelectItem key={t.value} value={t.value}>
                              <div className="flex items-center gap-2">
                                <t.icon className="h-4 w-4" />
                                {t.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Objetivo *</Label>
                      <Input
                        type="number"
                        value={form.valorObjetivo}
                        onChange={(e) => setForm(f => ({ ...f, valorObjetivo: Number(e.target.value) }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Empresa (opcional)</Label>
                      <Select value={form.empresaId} onValueChange={(v) => setForm(f => ({ ...f, empresaId: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Todas</SelectItem>
                          {empresas?.map(e => (
                            <SelectItem key={e.id} value={e.id.toString()}>{e.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Unidad (opcional)</Label>
                      <Select value={form.unidadId} onValueChange={(v) => setForm(f => ({ ...f, unidadId: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Todas</SelectItem>
                          {unidades?.map(u => (
                            <SelectItem key={u.id} value={u.id.toString()}>{u.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Input
                      value={form.descripcion}
                      onChange={(e) => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Descripción opcional"
                    />
                  </div>

                  <Button onClick={handleSubmit} className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingMeta ? 'Guardar Cambios' : 'Crear Meta'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Lista de metas */}
        {!metas || metas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No hay metas configuradas</p>
              {isSuperadmin && (
                <Button variant="outline" size="sm" className="mt-4" onClick={openNew}>
                  <Plus className="h-4 w-4 mr-1" />
                  Crear primera meta
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {metas.map((meta: any) => {
              const tipoInfo = tipoMetas.find(t => t.value === meta.tipo);
              const Icon = tipoInfo?.icon || Target;
              const empresa = empresas?.find(e => e.id === meta.empresaId);
              const unidad = unidades?.find(u => u.id === meta.unidadId);

              return (
                <Card key={meta.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Icono */}
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                        meta.progreso >= 100 ? 'bg-green-100 text-green-600' :
                        meta.progreso >= 70 ? 'bg-yellow-100 text-yellow-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        <Icon className="h-6 w-6" />
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-medium truncate">{meta.nombre}</h3>
                          {isSuperadmin && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(meta)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => deleteMutation.mutate({ id: meta.id })}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Eliminar</TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        </div>

                        {/* Tags de filtro */}
                        {(empresa || unidad) && (
                          <div className="flex items-center gap-2 mt-1">
                            {empresa && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-accent rounded px-2 py-0.5">
                                <Building2 className="h-3 w-3" />
                                {empresa.nombre}
                              </span>
                            )}
                            {unidad && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-accent rounded px-2 py-0.5">
                                <MapPin className="h-3 w-3" />
                                {unidad.nombre}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Progreso */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">
                              {meta.valorActual} / {meta.valorObjetivo} {tipoInfo?.unidad}
                            </span>
                            <span className={`font-medium ${
                              meta.progreso >= 100 ? 'text-green-600' :
                              meta.progreso >= 70 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {meta.progreso}%
                            </span>
                          </div>
                          <div className="h-2 bg-accent rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${getProgressColor(meta.progreso)}`}
                              style={{ width: `${Math.min(100, meta.progreso)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
