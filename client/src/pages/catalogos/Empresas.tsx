import DashboardLayout from "@/components/DashboardLayout";
import EmpresaFormIntegrado from "@/components/EmpresaFormIntegrado";
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
import { Building2, Edit, Plus, Trash2, FileDown, ChevronDown, ChevronRight, AlertTriangle, Wrench, ArrowUpDown, X, Pencil, Check, Sparkles } from "lucide-react";
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

  // Estado para agregar/editar defecto personalizado
  const [isAddDefectoOpen, setIsAddDefectoOpen] = useState(false);
  const [addDefectoEmpresaId, setAddDefectoEmpresaId] = useState<number | null>(null);
  const [addDefectoEspecialidadId, setAddDefectoEspecialidadId] = useState<number | null>(null);
  const [nuevoDefecto, setNuevoDefecto] = useState({ nombre: "", severidad: "moderado" });
  const [editingDefectoId, setEditingDefectoId] = useState<number | null>(null);
  const [editingDefectoData, setEditingDefectoData] = useState({ nombre: "", severidad: "moderado" });

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

  const updateDefectoMutation = trpc.defectos.update.useMutation({
    onSuccess: () => {
      utils.defectos.listConEstadisticas.invalidate();
      toast.success("Defecto actualizado correctamente");
      setEditingDefectoId(null);
      setEditingDefectoData({ nombre: "", severidad: "moderado" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteDefectoMutation = trpc.defectos.delete.useMutation({
    onSuccess: () => {
      utils.defectos.listConEstadisticas.invalidate();
      toast.success("Defecto eliminado correctamente");
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

  const handleEditDefecto = (defecto: any) => {
    setEditingDefectoId(defecto.id);
    setEditingDefectoData({ nombre: defecto.nombre, severidad: defecto.severidad });
  };

  const handleSaveDefecto = (defectoId: number) => {
    if (!editingDefectoData.nombre.trim()) {
      toast.error("El nombre del defecto es requerido");
      return;
    }
    updateDefectoMutation.mutate({
      id: defectoId,
      nombre: editingDefectoData.nombre,
      severidad: editingDefectoData.severidad as any,
    });
  };

  const handleDeleteDefecto = (defectoId: number, defectoNombre: string) => {
    if (confirm(`¿Eliminar el defecto "${defectoNombre}"?`)) {
      deleteDefectoMutation.mutate({ id: defectoId });
    }
  };

  const handleCancelEditDefecto = () => {
    setEditingDefectoId(null);
    setEditingDefectoData({ nombre: "", severidad: "moderado" });
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
                  const residente = usuarios?.find(u => u.id === empresa.residenteId);
                  const jefeResidente = usuarios?.find(u => u.id === empresa.jefeResidenteId);
                  
                  return (
                    <Collapsible key={empresa.id} open={isExpanded} onOpenChange={() => toggleExpanded(empresa.id)}>
                      <div className="border rounded-lg overflow-hidden">
                        {/* Fila principal de la empresa */}
                        <div className="p-3 sm:p-4 bg-white hover:bg-slate-50">
                          {/* Layout móvil: vertical, Desktop: horizontal */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            {/* Fila superior: botón expandir + nombre + acciones */}
                            <div className="flex items-center gap-2 w-full">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                              <span className="font-medium text-sm sm:text-base truncate flex-1">{empresa.nombre}</span>
                              {/* Acciones - siempre visibles a la derecha */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 sm:h-8 sm:w-8"
                                  onClick={(e) => { e.stopPropagation(); handleOpen(empresa); }}
                                >
                                  <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 sm:h-8 sm:w-8"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(empresa.id); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Fila de badges - debajo en móvil, inline en desktop */}
                            <div className="flex flex-wrap items-center gap-1.5 pl-10 sm:pl-0">
                              {especialidad && (
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] sm:text-xs px-1.5 py-0.5"
                                  style={{ 
                                    borderColor: especialidad.color || '#3B82F6',
                                    color: especialidad.color || '#3B82F6'
                                  }}
                                >
                                  <Wrench className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                                  {especialidad.nombre}
                                </Badge>
                              )}
                              {defectos.length > 0 && (
                                <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0.5">
                                  <AlertTriangle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                                  {defectos.length}
                                </Badge>
                              )}
                            </div>
                            
                          </div>
                          
                          {/* Sección de Equipo - Usuarios asignados */}
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-10 sm:pl-0">
                              {/* Residente */}
                              <div className="flex items-center gap-2 text-xs sm:text-sm">
                                <span className="text-muted-foreground font-medium w-20">Residente:</span>
                                {residente ? (
                                  <span className="text-[#002C63] font-medium">{residente.name}</span>
                                ) : (
                                  <span className="text-gray-400 italic">Sin asignar</span>
                                )}
                              </div>
                              {/* Jefe de Residente */}
                              <div className="flex items-center gap-2 text-xs sm:text-sm">
                                <span className="text-muted-foreground font-medium w-20">Jefe:</span>
                                {jefeResidente ? (
                                  <span className="text-[#002C63] font-medium">{jefeResidente.name}</span>
                                ) : (
                                  <span className="text-gray-400 italic">Sin asignar</span>
                                )}
                              </div>
                              {/* Contacto */}
                              {(empresa.contacto || empresa.telefono) && (
                                <div className="flex items-center gap-2 text-xs sm:text-sm sm:col-span-2">
                                  <span className="text-muted-foreground font-medium w-20">Contacto:</span>
                                  <span className="text-gray-600">
                                    {empresa.contacto}
                                    {empresa.telefono && ` • ${empresa.telefono}`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Panel expandible con defectos */}
                        <CollapsibleContent>
                          <div className="border-t bg-slate-50 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-sm flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                Defectos de {especialidad?.nombre || 'la especialidad'}
                                <Badge variant="outline" className="text-xs font-normal">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Sugeridos
                                </Badge>
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
                                    className="group flex items-center gap-2 p-2 bg-white rounded border text-sm hover:border-gray-300 transition-colors"
                                  >
                                    {editingDefectoId === defecto.id ? (
                                      /* Modo edición */
                                      <>
                                        <Input
                                          value={editingDefectoData.nombre}
                                          onChange={(e) => setEditingDefectoData({ ...editingDefectoData, nombre: e.target.value })}
                                          className="h-7 text-xs flex-1"
                                          autoFocus
                                        />
                                        <Select
                                          value={editingDefectoData.severidad}
                                          onValueChange={(value) => setEditingDefectoData({ ...editingDefectoData, severidad: value })}
                                        >
                                          <SelectTrigger className="h-7 w-24 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="leve">Leve</SelectItem>
                                            <SelectItem value="moderado">Moderado</SelectItem>
                                            <SelectItem value="grave">Grave</SelectItem>
                                            <SelectItem value="critico">Crítico</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6"
                                          onClick={() => handleSaveDefecto(defecto.id)}
                                        >
                                          <Check className="h-3 w-3 text-green-600" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6"
                                          onClick={handleCancelEditDefecto}
                                        >
                                          <X className="h-3 w-3 text-gray-500" />
                                        </Button>
                                      </>
                                    ) : (
                                      /* Modo visualización */
                                      <>
                                        <span className="truncate flex-1">{defecto.nombre}</span>
                                        <Badge 
                                          variant="secondary" 
                                          className={`text-xs ${severidadColors[defecto.severidad] || ''}`}
                                        >
                                          {defecto.severidad}
                                        </Badge>
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6"
                                            onClick={() => handleEditDefecto(defecto)}
                                            title="Editar defecto"
                                          >
                                            <Pencil className="h-3 w-3 text-gray-500" />
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6"
                                            onClick={() => handleDeleteDefecto(defecto.id, defecto.nombre)}
                                            title="Eliminar defecto"
                                          >
                                            <X className="h-3 w-3 text-red-500" />
                                          </Button>
                                        </div>
                                      </>
                                    )}
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

        {/* Formulario integrado de empresa */}
        <EmpresaFormIntegrado
          isOpen={isOpen}
          onClose={handleClose}
          empresa={editingEmpresa}
          proyectoId={selectedProjectId || 0}
        />

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
