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
  Lock, Users, Eye, EyeOff
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
    residenteId: "",
    jefeResidenteId: "",
  });

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

  // Defectos filtrados por especialidad seleccionada
  const defectosPorEspecialidad = allDefectos?.filter(
    d => d.especialidadId === parseInt(formData.especialidadId || "0")
  ) || [];

  // Mutations
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

  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: (data) => {
      utils.users.list.invalidate();
      toast.success("Usuario creado correctamente");
      // Asignar el nuevo usuario como residente
      setFormData(prev => ({ ...prev, residenteId: data.id.toString() }));
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
    setActiveTab("datos");
    setCrearNuevoUsuario(false);
    setDefectosSeleccionados(new Set());
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingEmpresa(null);
    setFormData({ nombre: "", rfc: "", contacto: "", telefono: "", email: "", proyectoId: "", especialidadId: "", residenteId: "", jefeResidenteId: "" });
    setActiveTab("datos");
    setCrearNuevoUsuario(false);
    setNuevoUsuario({ nombre: "", email: "", telefono: "", password: "", role: "residente" });
    setDefectosSeleccionados(new Set());
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
      residenteId: formData.residenteId && formData.residenteId !== 'none' ? parseInt(formData.residenteId) : null,
      jefeResidenteId: formData.jefeResidenteId && formData.jefeResidenteId !== 'none' ? parseInt(formData.jefeResidenteId) : null,
    };

    if (editingEmpresa) {
      updateMutation.mutate({ id: editingEmpresa.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCreateUser = () => {
    if (!nuevoUsuario.nombre.trim()) {
      toast.error("El nombre del usuario es requerido");
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
      proyectoId: selectedProjectId || undefined,
    });
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

  const toggleDefectoSeleccionado = (defectoId: number) => {
    const newSet = new Set(defectosSeleccionados);
    if (newSet.has(defectoId)) {
      newSet.delete(defectoId);
    } else {
      newSet.add(defectoId);
    }
    setDefectosSeleccionados(newSet);
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

  // Obtener la especialidad seleccionada para mostrar su color
  const especialidadSeleccionada = especialidades?.find(
    e => e.id === parseInt(formData.especialidadId || "0")
  );

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
                                {residente && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {residente.name}
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

        {/* Dialog para crear/editar empresa - MEJORADO */}
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
                          {especialidades?.map((especialidad) => (
                            <SelectItem key={especialidad.id} value={especialidad.id.toString()}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: especialidad.color || '#3B82F6' }}
                                />
                                {especialidad.nombre}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {especialidadSeleccionada && (
                        <p className="text-xs text-muted-foreground">
                          Se mostrarán los defectos típicos de {especialidadSeleccionada.nombre} en la pestaña "Defectos"
                        </p>
                      )}
                    </div>

                    <Separator />

                    {/* Nombre de empresa */}
                    <div className="grid gap-2">
                      <Label htmlFor="nombre">Nombre de la Empresa *</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Nombre de la empresa"
                      />
                    </div>

                    {/* Contacto */}
                    <div className="grid gap-2">
                      <Label htmlFor="contacto">Persona de Contacto</Label>
                      <Input
                        id="contacto"
                        value={formData.contacto}
                        onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                        placeholder="Nombre del contacto principal"
                      />
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

                {/* TAB: Equipo */}
                <TabsContent value="equipo" className="space-y-4 mt-0">
                  <div className="grid gap-4">
                    {/* Asignar usuarios existentes */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Asignar Usuarios Existentes
                      </h4>
                      
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
                              <SelectValue placeholder="Seleccionar jefe" />
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
                          {crearNuevoUsuario ? "Cancelar" : "Agregar Usuario"}
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
                      <p>Selecciona una especialidad en la pestaña "Datos" para ver los defectos típicos</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Defectos de {especialidadSeleccionada?.nombre}
                        </h4>
                        <Badge variant="secondary">
                          {defectosPorEspecialidad.length} defectos
                        </Badge>
                      </div>

                      {defectosPorEspecialidad.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border rounded-lg">
                          <p>No hay defectos definidos para esta especialidad</p>
                          <p className="text-sm mt-2">Puedes agregar defectos después de crear la empresa</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Estos son los defectos típicos asociados a la especialidad seleccionada:
                          </p>
                          <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto">
                            {defectosPorEspecialidad.map((defecto: any) => (
                              <div 
                                key={defecto.id} 
                                className="flex items-center justify-between p-3 bg-white rounded border"
                              >
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    id={`defecto-${defecto.id}`}
                                    checked={defectosSeleccionados.has(defecto.id)}
                                    onCheckedChange={() => toggleDefectoSeleccionado(defecto.id)}
                                  />
                                  <label 
                                    htmlFor={`defecto-${defecto.id}`}
                                    className="text-sm cursor-pointer"
                                  >
                                    {defecto.nombre}
                                  </label>
                                </div>
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${severidadColors[defecto.severidad] || ''}`}
                                >
                                  {defecto.severidad}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Separator />

                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          ¿Necesitas agregar un defecto personalizado?
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAddDefectoEspecialidadId(parseInt(formData.especialidadId));
                            setIsAddDefectoOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Agregar Defecto
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingEmpresa ? "Guardar Cambios" : "Crear Empresa"}
              </Button>
            </DialogFooter>
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
