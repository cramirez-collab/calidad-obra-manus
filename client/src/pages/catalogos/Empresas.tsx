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
import { Badge } from "@/components/ui/badge";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import { Building2, Edit, Plus, Trash2, FileDown, ChevronDown, ChevronRight, AlertTriangle, Wrench, ArrowUpDown } from "lucide-react";
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
  residenteId?: number | null;
  jefeResidenteId?: number | null;
};

const severidadColors: Record<string, string> = {
  leve: "bg-green-100 text-green-800",
  moderado: "bg-yellow-100 text-yellow-800",
  grave: "bg-orange-100 text-orange-800",
  critico: "bg-red-100 text-red-800",
};

export default function Empresas() {
  const { selectedProjectId } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [expandedEmpresas, setExpandedEmpresas] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<'nombre' | 'especialidad' | 'contacto' | 'residente'>('nombre');
  const [formData, setFormData] = useState({
    nombre: "",
    rfc: "",
    contacto: "",
    telefono: "",
    email: "",
    proyectoId: "",
    especialidadId: "",
    residenteId: "",
    jefeResidenteId: "",
  });

  // Estado para agregar defecto personalizado
  const [isAddDefectoOpen, setIsAddDefectoOpen] = useState(false);
  const [addDefectoEmpresaId, setAddDefectoEmpresaId] = useState<number | null>(null);
  const [addDefectoEspecialidadId, setAddDefectoEspecialidadId] = useState<number | null>(null);
  const [nuevoDefecto, setNuevoDefecto] = useState({ nombre: "", severidad: "moderado" });

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
  // Obtener usuarios para asignar residente y jefe de residente
  const { data: usuarios } = trpc.users.list.useQuery();
  // Obtener todos los defectos para mostrar por especialidad
  const { data: allDefectos } = trpc.defectos.listConEstadisticas.useQuery();

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

  const createDefectoMutation = trpc.defectos.create.useMutation({
    onSuccess: () => {
      utils.defectos.listConEstadisticas.invalidate();
      toast.success("Defecto agregado correctamente");
      setIsAddDefectoOpen(false);
      setNuevoDefecto({ nombre: "", severidad: "moderado" });
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
        residenteId: empresa.residenteId?.toString() || "",
        jefeResidenteId: empresa.jefeResidenteId?.toString() || "",
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
        residenteId: "",
        jefeResidenteId: "",
      });
    }
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingEmpresa(null);
    setFormData({ nombre: "", rfc: "", contacto: "", telefono: "", email: "", proyectoId: "", especialidadId: "", residenteId: "", jefeResidenteId: "" });
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
      especialidadId: formData.especialidadId && formData.especialidadId !== 'none' ? parseInt(formData.especialidadId) : undefined,
      residenteId: formData.residenteId && formData.residenteId !== 'none' ? parseInt(formData.residenteId) : null,
      jefeResidenteId: formData.jefeResidenteId && formData.jefeResidenteId !== 'none' ? parseInt(formData.jefeResidenteId) : null,
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

  const toggleExpanded = (empresaId: number) => {
    const newExpanded = new Set(expandedEmpresas);
    if (newExpanded.has(empresaId)) {
      newExpanded.delete(empresaId);
    } else {
      newExpanded.add(empresaId);
    }
    setExpandedEmpresas(newExpanded);
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

  const getDefectosByEspecialidad = (especialidadId: number | null | undefined) => {
    if (!especialidadId || !allDefectos) return [];
    return allDefectos.filter(d => d.especialidadId === especialidadId);
  };

  const handleAddDefecto = (empresaId: number, especialidadId: number | null | undefined) => {
    if (!especialidadId) {
      toast.error("La empresa debe tener una especialidad asignada para agregar defectos");
      return;
    }
    setAddDefectoEmpresaId(empresaId);
    setAddDefectoEspecialidadId(especialidadId);
    setIsAddDefectoOpen(true);
  };

  const handleCreateDefecto = () => {
    if (!nuevoDefecto.nombre.trim()) {
      toast.error("El nombre del defecto es requerido");
      return;
    }
    if (!addDefectoEspecialidadId || !selectedProjectId) {
      toast.error("Error: especialidad o proyecto no definido");
      return;
    }
    createDefectoMutation.mutate({
      nombre: nuevoDefecto.nombre,
      especialidadId: addDefectoEspecialidadId,
      severidad: nuevoDefecto.severidad as any,
      proyectoId: selectedProjectId,
    });
  };

  const handleExportPDF = () => {
    if (!empresas || empresas.length === 0) {
      toast.error("No hay empresas para exportar");
      return;
    }

    const proyectoNombre = proyectos?.find(p => p.id === selectedProjectId)?.nombre || "Proyecto";
    
    import('@/lib/pdfTemplate').then(({ openPrintWindow, generateTable }) => {
      const headers = ['Nombre', 'Especialidad', 'Contacto', 'Teléfono', 'Email'];
      const rows = empresas.map(empresa => [
        empresa.nombre,
        getEspecialidadNombre(empresa.especialidadId),
        empresa.contacto || '-',
        empresa.telefono || '-',
        empresa.email || '-'
      ]);

      const content = `
        <h1>Lista de Empresas</h1>
        ${generateTable(headers, rows)}
      `;

      const result = openPrintWindow({
        title: 'Empresas',
        proyectoNombre,
        content,
        totalPages: 1,
        currentPage: 1
      });

      if (!result) {
        toast.error("No se pudo abrir ventana de impresión");
      }
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
            <p className="text-muted-foreground">
              Gestiona las empresas contratistas y sus defectos típicos
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button onClick={() => handleOpen()}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Empresa
            </Button>
          </div>
        </div>


        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Lista de Empresas ({empresas?.length || 0})
              </CardTitle>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nombre">Empresa</SelectItem>
                    <SelectItem value="especialidad">Especialidad</SelectItem>
                    <SelectItem value="contacto">Contacto</SelectItem>
                    <SelectItem value="residente">Residente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
              <div className="space-y-2">
                {[...(empresas || [])].sort((a, b) => {
                  switch (sortBy) {
                    case 'nombre':
                      return (a.nombre || '').localeCompare(b.nombre || '');
                    case 'especialidad':
                      const espA = especialidades?.find(e => e.id === a.especialidadId)?.nombre || '';
                      const espB = especialidades?.find(e => e.id === b.especialidadId)?.nombre || '';
                      return espA.localeCompare(espB);
                    case 'contacto':
                      return (a.contacto || '').localeCompare(b.contacto || '');
                    case 'residente':
                      const resA = usuarios?.find(u => u.id === a.residenteId)?.name || '';
                      const resB = usuarios?.find(u => u.id === b.residenteId)?.name || '';
                      return resA.localeCompare(resB);
                    default:
                      return 0;
                  }
                }).map((empresa) => {
                  const defectos = getDefectosByEspecialidad(empresa.especialidadId);
                  const isExpanded = expandedEmpresas.has(empresa.id);
                  const especialidad = especialidades?.find(e => e.id === empresa.especialidadId);
                  
                  return (
                    <Collapsible key={empresa.id} open={isExpanded} onOpenChange={() => toggleExpanded(empresa.id)}>
                      <div className="border rounded-lg overflow-hidden">
                        {/* Fila principal de la empresa */}
                        <div className="flex items-center justify-between p-4 bg-white hover:bg-slate-50">
                          <div className="flex items-center gap-3 flex-1">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{empresa.nombre}</span>
                                {especialidad && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs"
                                    style={{ 
                                      borderColor: especialidad.color || '#3B82F6',
                                      color: especialidad.color || '#3B82F6'
                                    }}
                                  >
                                    <Wrench className="h-3 w-3 mr-1" />
                                    {especialidad.nombre}
                                  </Badge>
                                )}
                                {defectos.length > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {defectos.length} defectos
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {empresa.contacto && <span>{empresa.contacto}</span>}
                                {empresa.telefono && <span className="ml-2">• {empresa.telefono}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); handleOpen(empresa); }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); handleDelete(empresa.id); }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Panel expandible con defectos */}
                        <CollapsibleContent>
                          <div className="border-t bg-slate-50 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-sm flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                Defectos de {especialidad?.nombre || 'la especialidad'}
                              </h4>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleAddDefecto(empresa.id, empresa.especialidadId)}
                                disabled={!empresa.especialidadId}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Agregar Defecto
                              </Button>
                            </div>
                            
                            {!empresa.especialidadId ? (
                              <p className="text-sm text-muted-foreground italic">
                                Asigna una especialidad a esta empresa para ver y agregar defectos
                              </p>
                            ) : defectos.length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">
                                No hay defectos definidos para esta especialidad
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {defectos.map((defecto: any) => (
                                  <div 
                                    key={defecto.id} 
                                    className="flex items-center justify-between p-2 bg-white rounded border text-sm"
                                  >
                                    <span className="truncate flex-1">{defecto.nombre}</span>
                                    <Badge 
                                      variant="secondary" 
                                      className={`ml-2 text-xs ${severidadColors[defecto.severidad] || ''}`}
                                    >
                                      {defecto.severidad}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog para crear/editar empresa */}
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
                  <Label htmlFor="especialidadId">Especialidad</Label>
                  <Select
                    value={formData.especialidadId}
                    onValueChange={(value) => setFormData({ ...formData, especialidadId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar especialidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin especialidad</SelectItem>
                      {especialidades?.map((especialidad) => (
                        <SelectItem key={especialidad.id} value={especialidad.id.toString()}>
                          {especialidad.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Al asignar una especialidad, se mostrarán los defectos típicos asociados
                  </p>
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

                {/* Asignación de Residente y Jefe de Residente */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="residenteId">Residente</Label>
                    <Select
                      value={formData.residenteId}
                      onValueChange={(value) => setFormData({ ...formData, residenteId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar residente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {usuarios?.filter(u => u.role === 'residente' || u.role === 'jefe_residente').map((usuario) => (
                          <SelectItem key={usuario.id} value={usuario.id.toString()}>
                            {usuario.name || usuario.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="jefeResidenteId">Jefe de Residente</Label>
                    <Select
                      value={formData.jefeResidenteId}
                      onValueChange={(value) => setFormData({ ...formData, jefeResidenteId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar jefe de residente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {usuarios?.filter(u => u.role === 'jefe_residente' || u.role === 'supervisor').map((usuario) => (
                          <SelectItem key={usuario.id} value={usuario.id.toString()}>
                            {usuario.name || usuario.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

        {/* Dialog para agregar defecto personalizado */}
        <Dialog open={isAddDefectoOpen} onOpenChange={setIsAddDefectoOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Agregar Defecto Personalizado</DialogTitle>
              <DialogDescription>
                Este defecto se agregará a la especialidad y estará disponible para todas las empresas con esta especialidad
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="defectoNombre">Nombre del Defecto *</Label>
                <Input
                  id="defectoNombre"
                  value={nuevoDefecto.nombre}
                  onChange={(e) => setNuevoDefecto({ ...nuevoDefecto, nombre: e.target.value })}
                  placeholder="Ej: Grieta en muro"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="defectoSeveridad">Severidad</Label>
                <Select
                  value={nuevoDefecto.severidad}
                  onValueChange={(value) => setNuevoDefecto({ ...nuevoDefecto, severidad: value })}
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDefectoOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateDefecto}
                disabled={createDefectoMutation.isPending}
              >
                Agregar Defecto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
