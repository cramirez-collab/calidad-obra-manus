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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { 
  Building2, Edit, Plus, Trash2, FileDown, ChevronDown, ChevronRight, 
  AlertTriangle, Wrench, ArrowUpDown, User, UserPlus, Mail, Phone, 
  Lock, Users, Eye, EyeOff, X
} from "lucide-react";
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

type NuevoUsuario = {
  nombre: string;
  email: string;
  telefono: string;
  password: string;
  role: 'residente' | 'jefe_residente' | 'supervisor';
};

type ResidenteAsignado = {
  usuarioId: number;
  tipoResidente: 'residente' | 'jefe_residente';
  nombre?: string;
};

const severidadColors: Record<string, string> = {
  leve: "bg-green-100 text-green-800",
  moderado: "bg-yellow-100 text-yellow-800",
  grave: "bg-orange-100 text-orange-800",
  critico: "bg-red-100 text-red-800",
};

const roleLabels: Record<string, string> = {
  residente: "Residente",
  jefe_residente: "Jefe de Residente",
  supervisor: "Supervisor",
};

export default function Empresas() {
  const { selectedProjectId } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [expandedEmpresas, setExpandedEmpresas] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<'nombre' | 'especialidad' | 'contacto' | 'residente'>('nombre');
  const [activeTab, setActiveTab] = useState("datos");
  const [showPassword, setShowPassword] = useState(false);
  
  // Estado del formulario principal
  const [formData, setFormData] = useState({
    nombre: "",
    rfc: "",
    contacto: "",
    telefono: "",
    email: "",
    proyectoId: "",
    especialidadId: "",
  });

  // Estado para residentes asignados (nueva funcionalidad)
  const [residentesAsignados, setResidentesAsignados] = useState<ResidenteAsignado[]>([]);
  const [nuevoResidenteId, setNuevoResidenteId] = useState("");
  const [nuevoResidenteTipo, setNuevoResidenteTipo] = useState<'residente' | 'jefe_residente'>('residente');

  // Estado para crear nuevo usuario
  const [crearNuevoUsuario, setCrearNuevoUsuario] = useState(false);
  const [nuevoUsuario, setNuevoUsuario] = useState<NuevoUsuario>({
    nombre: "",
    email: "",
    telefono: "",
    password: "",
    role: "residente",
  });

  // Estado para defectos seleccionados
  const [defectosSeleccionados, setDefectosSeleccionados] = useState<Set<number>>(new Set());

  // Estado para agregar defecto personalizado
  const [isAddDefectoOpen, setIsAddDefectoOpen] = useState(false);
  const [addDefectoEmpresaId, setAddDefectoEmpresaId] = useState<number | null>(null);
  const [addDefectoEspecialidadId, setAddDefectoEspecialidadId] = useState<number | null>(null);
  const [nuevoDefecto, setNuevoDefecto] = useState({ nombre: "", severidad: "moderado" });

  // Estado para editar defecto
  const [isEditDefectoOpen, setIsEditDefectoOpen] = useState(false);
  const [editingDefecto, setEditingDefecto] = useState<{ id: number; nombre: string; severidad: string } | null>(null);

  // Estado para confirmar eliminación de defecto
  const [isDeleteDefectoOpen, setIsDeleteDefectoOpen] = useState(false);
  const [defectoToDelete, setDefectoToDelete] = useState<{ id: number; nombre: string } | null>(null);

  const utils = trpc.useUtils();
  
  // Queries
  const { data: empresas, isLoading } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: proyectos } = trpc.proyectos.list.useQuery();
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: usuarios } = trpc.users.list.useQuery();
  const { data: allDefectos } = trpc.defectos.listConEstadisticas.useQuery();

  // Query para obtener residentes de la empresa actual (cuando se está editando)
  const { data: residentesEmpresa, refetch: refetchResidentes } = trpc.empresas.getResidentes.useQuery(
    { empresaId: editingEmpresa?.id || 0 },
    { enabled: !!editingEmpresa?.id }
  );

  // Cargar residentes cuando se abre el modal de edición
  useEffect(() => {
    if (editingEmpresa && residentesEmpresa) {
      const asignados = residentesEmpresa.map((r: any) => ({
        usuarioId: r.usuarioId,
        tipoResidente: r.tipoResidente as 'residente' | 'jefe_residente',
        nombre: r.usuario?.name || 'Sin nombre'
      }));
      setResidentesAsignados(asignados);
    }
  }, [editingEmpresa, residentesEmpresa]);

  // Defectos filtrados por especialidad seleccionada
  const defectosPorEspecialidad = allDefectos?.filter(
    d => d.especialidadId === parseInt(formData.especialidadId || "0")
  ) || [];

  // Mutations
  const createMutation = trpc.empresas.create.useMutation({
    onSuccess: async (data) => {
      // Agregar residentes a la empresa recién creada
      for (const residente of residentesAsignados) {
        await addResidenteMutation.mutateAsync({
          empresaId: data.id,
          usuarioId: residente.usuarioId,
          tipoResidente: residente.tipoResidente,
        });
      }
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

  // Mutations para residentes
  const addResidenteMutation = trpc.empresas.addResidente.useMutation({
    onSuccess: () => {
      refetchResidentes();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeResidenteMutation = trpc.empresas.removeResidente.useMutation({
    onSuccess: () => {
      refetchResidentes();
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
      setIsEditDefectoOpen(false);
      setEditingDefecto(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteDefectoMutation = trpc.defectos.delete.useMutation({
    onSuccess: () => {
      utils.defectos.listConEstadisticas.invalidate();
      toast.success("Defecto eliminado correctamente");
      setIsDeleteDefectoOpen(false);
      setDefectoToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: (data) => {
      utils.users.list.invalidate();
      toast.success("Usuario creado correctamente");
      // Agregar el nuevo usuario a la lista de residentes asignados
      const nuevoResidente: ResidenteAsignado = {
        usuarioId: data.id,
        tipoResidente: nuevoUsuario.role === 'jefe_residente' ? 'jefe_residente' : 'residente',
        nombre: nuevoUsuario.nombre
      };
      setResidentesAsignados(prev => [...prev, nuevoResidente]);
      setCrearNuevoUsuario(false);
      setNuevoUsuario({ nombre: "", email: "", telefono: "", password: "", role: "residente" });
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
      // Los residentes se cargarán por el useEffect cuando residentesEmpresa esté disponible
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
      setResidentesAsignados([]);
    }
    setActiveTab("datos");
    setCrearNuevoUsuario(false);
    setDefectosSeleccionados(new Set());
    setNuevoResidenteId("");
    setNuevoResidenteTipo('residente');
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingEmpresa(null);
    setFormData({ nombre: "", rfc: "", contacto: "", telefono: "", email: "", proyectoId: "", especialidadId: "" });
    setResidentesAsignados([]);
    setActiveTab("datos");
    setCrearNuevoUsuario(false);
    setNuevoUsuario({ nombre: "", email: "", telefono: "", password: "", role: "residente" });
    setDefectosSeleccionados(new Set());
    setNuevoResidenteId("");
    setNuevoResidenteTipo('residente');
  };

  const handleAddResidente = async () => {
    if (!nuevoResidenteId || nuevoResidenteId === 'none') {
      toast.error("Selecciona un usuario");
      return;
    }

    const usuarioId = parseInt(nuevoResidenteId);
    
    // Verificar si ya está asignado
    if (residentesAsignados.some(r => r.usuarioId === usuarioId)) {
      toast.error("Este usuario ya está asignado a la empresa");
      return;
    }

    const usuario = usuarios?.find(u => u.id === usuarioId);
    const nuevoResidente: ResidenteAsignado = {
      usuarioId,
      tipoResidente: nuevoResidenteTipo,
      nombre: usuario?.name || 'Sin nombre'
    };

    // Si estamos editando, guardar en la base de datos
    if (editingEmpresa) {
      await addResidenteMutation.mutateAsync({
        empresaId: editingEmpresa.id,
        usuarioId,
        tipoResidente: nuevoResidenteTipo,
      });
      toast.success("Residente agregado");
    }
    
    setResidentesAsignados(prev => [...prev, nuevoResidente]);
    setNuevoResidenteId("");
  };

  const handleRemoveResidente = async (usuarioId: number) => {
    // Si estamos editando, eliminar de la base de datos
    if (editingEmpresa) {
      await removeResidenteMutation.mutateAsync({
        empresaId: editingEmpresa.id,
        usuarioId,
      });
      toast.success("Residente eliminado");
    }
    
    setResidentesAsignados(prev => prev.filter(r => r.usuarioId !== usuarioId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

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
    };

    if (editingEmpresa) {
      updateMutation.mutate({ id: editingEmpresa.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCreateUser = () => {
    if (!nuevoUsuario.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!nuevoUsuario.password || nuevoUsuario.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    createUserMutation.mutate({
      name: nuevoUsuario.nombre,
      email: nuevoUsuario.email || undefined,
      password: nuevoUsuario.password,
      role: nuevoUsuario.role,
      empresaId: editingEmpresa?.id || null,
      proyectoId: selectedProjectId || undefined,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de eliminar esta empresa?")) {
      deleteMutation.mutate({ id });
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedEmpresas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getDefectosByEspecialidad = (especialidadId: number | null | undefined) => {
    if (!especialidadId) return [];
    return allDefectos?.filter(d => d.especialidadId === especialidadId) || [];
  };

  const handleAddDefecto = (empresaId: number, especialidadId: number | null | undefined) => {
    if (!especialidadId) {
      toast.error("La empresa debe tener una especialidad asignada");
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
    if (!addDefectoEspecialidadId) {
      toast.error("Error: especialidad no definida");
      return;
    }

    createDefectoMutation.mutate({
      nombre: nuevoDefecto.nombre,
      especialidadId: addDefectoEspecialidadId,
      severidad: nuevoDefecto.severidad as any,
      proyectoId: selectedProjectId || undefined,
    });
  };

  const handleUpdateDefecto = () => {
    if (!editingDefecto) return;
    if (!editingDefecto.nombre.trim()) {
      toast.error("El nombre del defecto es requerido");
      return;
    }

    updateDefectoMutation.mutate({
      id: editingDefecto.id,
      nombre: editingDefecto.nombre,
      severidad: editingDefecto.severidad as any,
    });
  };

  const handleDeleteDefecto = () => {
    if (!defectoToDelete) return;
    deleteDefectoMutation.mutate({ id: defectoToDelete.id });
  };

  // Obtener usuarios disponibles para agregar (que no estén ya asignados)
  const usuariosDisponibles = usuarios?.filter(u => 
    (u.role === 'residente' || u.role === 'jefe_residente') &&
    !residentesAsignados.some(r => r.usuarioId === u.id)
  ) || [];

  // Obtener residentes de una empresa para mostrar en la lista
  const getResidentesDisplay = (empresa: Empresa) => {
    // Por ahora mostrar el residente antiguo si existe
    const residente = usuarios?.find(u => u.id === empresa.residenteId);
    const jefeResidente = usuarios?.find(u => u.id === empresa.jefeResidenteId);
    const nombres: string[] = [];
    if (residente) nombres.push(residente.name || 'Residente');
    if (jefeResidente) nombres.push(jefeResidente.name || 'Jefe');
    return nombres.join(', ') || null;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Empresas
            </h1>
            <p className="text-muted-foreground">
              Gestiona las empresas contratistas y sus defectos típicos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button onClick={() => handleOpen()}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Empresa
            </Button>
          </div>
        </div>

        {/* Lista de Empresas */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Lista de Empresas ({empresas?.length || 0})</CardTitle>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[140px]">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nombre">Empresa</SelectItem>
                  <SelectItem value="especialidad">Especialidad</SelectItem>
                  <SelectItem value="contacto">Contacto</SelectItem>
                  <SelectItem value="residente">Residente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : !empresas || empresas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay empresas registradas</p>
                <Button variant="outline" className="mt-4" onClick={() => handleOpen()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primera empresa
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {[...empresas].sort((a, b) => {
                  switch (sortBy) {
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
                      return a.nombre.localeCompare(b.nombre);
                  }
                }).map((empresa) => {
                  const defectos = getDefectosByEspecialidad(empresa.especialidadId);
                  const isExpanded = expandedEmpresas.has(empresa.id);
                  const especialidad = especialidades?.find(e => e.id === empresa.especialidadId);
                  const residentesDisplay = getResidentesDisplay(empresa);
                  
                  return (
                    <Collapsible key={empresa.id} open={isExpanded} onOpenChange={() => toggleExpanded(empresa.id)}>
                      <div className="border rounded-lg overflow-hidden">
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
                              <div className="flex items-center gap-2 flex-wrap">
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
                              <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                                {residentesDisplay && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {residentesDisplay}
                                  </span>
                                )}
                                {empresa.telefono && <span>• {empresa.telefono}</span>}
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
                                    className="flex items-center justify-between p-2 bg-white rounded border text-sm group hover:border-primary/50 transition-colors"
                                  >
                                    <span className="truncate flex-1">{defecto.nombre}</span>
                                    <div className="flex items-center gap-1">
                                      <Badge 
                                        variant="secondary" 
                                        className={`text-xs ${severidadColors[defecto.severidad] || ''}`}
                                      >
                                        {defecto.severidad}
                                      </Badge>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 opacity-50 hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingDefecto({ id: defecto.id, nombre: defecto.nombre, severidad: defecto.severidad });
                                          setIsEditDefectoOpen(true);
                                        }}
                                        title="Editar defecto"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 opacity-50 hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDefectoToDelete({ id: defecto.id, nombre: defecto.nombre });
                                          setIsDeleteDefectoOpen(true);
                                        }}
                                        title="Eliminar defecto"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
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
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {editingEmpresa ? "Editar Empresa" : "Nueva Empresa"}
              </DialogTitle>
              <DialogDescription>
                {editingEmpresa
                  ? "Modifica los datos de la empresa y su equipo"
                  : "Configura la empresa, su especialidad, equipo y defectos típicos"}
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="datos" className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Datos</span>
                </TabsTrigger>
                <TabsTrigger value="equipo" className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Equipo</span>
                </TabsTrigger>
                <TabsTrigger value="defectos" className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="hidden sm:inline">Defectos</span>
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[400px] mt-4 pr-4">
                {/* TAB: Datos de la Empresa */}
                <TabsContent value="datos" className="space-y-4 mt-0">
                  <div className="grid gap-4">
                    {/* Especialidad primero */}
                    <div className="grid gap-2">
                      <Label htmlFor="especialidadId" className="flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        Especialidad *
                      </Label>
                      <Select
                        value={formData.especialidadId}
                        onValueChange={(value) => setFormData({ ...formData, especialidadId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar especialidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin especialidad</SelectItem>
                          {especialidades?.map((esp) => (
                            <SelectItem key={esp.id} value={esp.id.toString()}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: esp.color || '#3B82F6' }}
                                />
                                {esp.nombre}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Nombre */}
                    <div className="grid gap-2">
                      <Label htmlFor="nombre">Nombre de la Empresa *</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Nombre de la empresa"
                      />
                    </div>

                    {/* RFC y Contacto */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="rfc">RFC</Label>
                        <Input
                          id="rfc"
                          value={formData.rfc}
                          onChange={(e) => setFormData({ ...formData, rfc: e.target.value })}
                          placeholder="RFC de la empresa"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="contacto">Contacto</Label>
                        <Input
                          id="contacto"
                          value={formData.contacto}
                          onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                          placeholder="Nombre del contacto"
                        />
                      </div>
                    </div>

                    {/* Teléfono y Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="telefono" className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          Teléfono
                        </Label>
                        <Input
                          id="telefono"
                          value={formData.telefono}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                          placeholder="Teléfono"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email" className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="correo@empresa.com"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB: Equipo - NUEVA FUNCIONALIDAD DE MÚLTIPLES RESIDENTES */}
                <TabsContent value="equipo" className="space-y-4 mt-0">
                  <div className="grid gap-4">
                    {/* Lista de residentes asignados */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Residentes Asignados ({residentesAsignados.length})
                      </h4>
                      
                      {residentesAsignados.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic py-4 text-center">
                          No hay residentes asignados a esta empresa
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {residentesAsignados.map((residente) => {
                            const usuario = usuarios?.find(u => u.id === residente.usuarioId);
                            return (
                              <div 
                                key={residente.usuarioId} 
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <User className="h-4 w-4 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{residente.nombre || usuario?.name || 'Sin nombre'}</p>
                                    <p className="text-xs text-muted-foreground">{usuario?.email || ''}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={residente.tipoResidente === 'jefe_residente' ? 'default' : 'secondary'}>
                                    {residente.tipoResidente === 'jefe_residente' ? 'Jefe de Residente' : 'Residente'}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveResidente(residente.usuarioId)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Agregar nuevo residente */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        Agregar Residente
                      </h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                          <Label className="sr-only">Usuario</Label>
                          <Select
                            value={nuevoResidenteId}
                            onValueChange={setNuevoResidenteId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar usuario" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Seleccionar usuario</SelectItem>
                              {usuariosDisponibles.map((usuario) => (
                                <SelectItem key={usuario.id} value={usuario.id.toString()}>
                                  {usuario.name || usuario.email} ({roleLabels[usuario.role] || usuario.role})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="sr-only">Tipo</Label>
                          <Select
                            value={nuevoResidenteTipo}
                            onValueChange={(v) => setNuevoResidenteTipo(v as any)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="residente">Residente</SelectItem>
                              <SelectItem value="jefe_residente">Jefe de Residente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddResidente}
                        disabled={!nuevoResidenteId || nuevoResidenteId === 'none'}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar a la Empresa
                      </Button>
                    </div>

                    <Separator />

                    {/* Crear nuevo usuario */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <UserPlus className="h-4 w-4" />
                          Crear Nuevo Usuario
                        </h4>
                        <Button
                          type="button"
                          variant={crearNuevoUsuario ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setCrearNuevoUsuario(!crearNuevoUsuario)}
                        >
                          {crearNuevoUsuario ? "Cancelar" : "Crear Usuario"}
                        </Button>
                      </div>

                      {crearNuevoUsuario && (
                        <div className="border rounded-lg p-4 space-y-4 bg-slate-50">
                          <div className="grid gap-2">
                            <Label>Rol del Usuario *</Label>
                            <Select
                              value={nuevoUsuario.role}
                              onValueChange={(value) => setNuevoUsuario({ ...nuevoUsuario, role: value as any })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="residente">Residente</SelectItem>
                                <SelectItem value="jefe_residente">Jefe de Residente</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label>Nombre Completo *</Label>
                            <Input
                              value={nuevoUsuario.nombre}
                              onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })}
                              placeholder="Nombre del usuario"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                Email
                              </Label>
                              <Input
                                type="email"
                                value={nuevoUsuario.email}
                                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
                                placeholder="correo@ejemplo.com"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                Teléfono
                              </Label>
                              <Input
                                value={nuevoUsuario.telefono}
                                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, telefono: e.target.value })}
                                placeholder="Teléfono móvil"
                              />
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <Label className="flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Contraseña *
                            </Label>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                value={nuevoUsuario.password}
                                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
                                placeholder="Mínimo 6 caracteres"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>

                          <Button
                            type="button"
                            onClick={handleCreateUser}
                            disabled={createUserMutation.isPending}
                            className="w-full"
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            {createUserMutation.isPending ? "Creando..." : `Crear ${roleLabels[nuevoUsuario.role]}`}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* TAB: Defectos */}
                <TabsContent value="defectos" className="space-y-4 mt-0">
                  {!formData.especialidadId || formData.especialidadId === 'none' ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Selecciona una especialidad primero</p>
                      <p className="text-sm">Los defectos están asociados a especialidades</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">
                          Defectos de {especialidades?.find(e => e.id === parseInt(formData.especialidadId))?.nombre}
                        </h4>
                        <Badge variant="outline">{defectosPorEspecialidad.length} defectos</Badge>
                      </div>
                      
                      {defectosPorEspecialidad.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic text-center py-4">
                          No hay defectos definidos para esta especialidad
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {defectosPorEspecialidad.map((defecto: any) => (
                            <div 
                              key={defecto.id} 
                              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                            >
                              <span>{defecto.nombre}</span>
                              <Badge 
                                variant="secondary" 
                                className={severidadColors[defecto.severidad] || ''}
                              >
                                {defecto.severidad}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para agregar defecto */}
        <Dialog open={isAddDefectoOpen} onOpenChange={setIsAddDefectoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Defecto</DialogTitle>
              <DialogDescription>
                Agrega un nuevo defecto a la especialidad
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nombre del Defecto *</Label>
                <Input
                  value={nuevoDefecto.nombre}
                  onChange={(e) => setNuevoDefecto({ ...nuevoDefecto, nombre: e.target.value })}
                  placeholder="Ej: Fuga de agua"
                />
              </div>
              <div className="grid gap-2">
                <Label>Severidad</Label>
                <Select
                  value={nuevoDefecto.severidad}
                  onValueChange={(v) => setNuevoDefecto({ ...nuevoDefecto, severidad: v })}
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
              <Button onClick={handleCreateDefecto} disabled={createDefectoMutation.isPending}>
                {createDefectoMutation.isPending ? "Agregando..." : "Agregar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para editar defecto */}
        <Dialog open={isEditDefectoOpen} onOpenChange={setIsEditDefectoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Defecto</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nombre del Defecto *</Label>
                <Input
                  value={editingDefecto?.nombre || ''}
                  onChange={(e) => setEditingDefecto(prev => prev ? { ...prev, nombre: e.target.value } : null)}
                  placeholder="Nombre del defecto"
                />
              </div>
              <div className="grid gap-2">
                <Label>Severidad</Label>
                <Select
                  value={editingDefecto?.severidad || 'moderado'}
                  onValueChange={(v) => setEditingDefecto(prev => prev ? { ...prev, severidad: v } : null)}
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
              <Button variant="outline" onClick={() => setIsEditDefectoOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateDefecto} disabled={updateDefectoMutation.isPending}>
                {updateDefectoMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para confirmar eliminación de defecto */}
        <Dialog open={isDeleteDefectoOpen} onOpenChange={setIsDeleteDefectoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar Defecto</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de eliminar el defecto "{defectoToDelete?.nombre}"?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDefectoOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteDefecto} disabled={deleteDefectoMutation.isPending}>
                {deleteDefectoMutation.isPending ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
