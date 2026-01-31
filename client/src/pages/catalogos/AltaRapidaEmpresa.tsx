import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { 
  Building2, ChevronRight, ChevronLeft, Check, Plus, User, 
  Mail, Phone, Lock, Eye, EyeOff, Trash2, AlertTriangle,
  ArrowRight, CheckCircle2, Circle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";
import { useLocation } from "wouter";

type NuevoUsuario = {
  nombre: string;
  email: string;
  telefono: string;
  password: string;
  role: 'residente' | 'jefe_residente' | 'supervisor' | 'desarrollador';
};

const roleLabels: Record<string, string> = {
  residente: "Residente",
  jefe_residente: "Jefe de Residente",
  supervisor: "Supervisor",
  desarrollador: "Desarrollador",
};

const severidadColors: Record<string, string> = {
  leve: "bg-green-100 text-green-800",
  moderado: "bg-yellow-100 text-yellow-800",
  grave: "bg-orange-100 text-orange-800",
  critico: "bg-red-100 text-red-800",
};

export default function AltaRapidaEmpresa() {
  const { selectedProjectId } = useProject();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  
  // Paso actual del wizard
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
  // Datos del formulario
  const [empresaData, setEmpresaData] = useState({
    nombre: "",
    rfc: "",
    contacto: "",
    telefono: "",
    email: "",
  });
  
  const [especialidadId, setEspecialidadId] = useState<string>("");
  const [nuevaEspecialidad, setNuevaEspecialidad] = useState("");
  const [crearNuevaEspecialidad, setCrearNuevaEspecialidad] = useState(false);
  
  const [usuarios, setUsuarios] = useState<NuevoUsuario[]>([]);
  const [nuevoUsuario, setNuevoUsuario] = useState<NuevoUsuario>({
    nombre: "",
    email: "",
    telefono: "",
    password: "",
    role: "residente",
  });
  const [showPassword, setShowPassword] = useState(false);
  
  const [defectosSeleccionados, setDefectosSeleccionados] = useState<number[]>([]);
  
  // ID de la empresa creada (para pasos siguientes)
  const [empresaCreada, setEmpresaCreada] = useState<number | null>(null);
  const [especialidadCreada, setEspecialidadCreada] = useState<number | null>(null);
  
  // Queries
  const { data: especialidades } = trpc.especialidades.list.useQuery();
  const { data: defectos } = trpc.defectos.list.useQuery();
  
  // Mutations
  const createEmpresa = trpc.empresas.create.useMutation({
    onSuccess: (data) => {
      setEmpresaCreada(data.id);
      toast.success("Empresa creada");
    },
    onError: (error) => {
      toast.error("Error al crear empresa: " + error.message);
    }
  });
  
  const createEspecialidad = trpc.especialidades.create.useMutation({
    onSuccess: (data) => {
      setEspecialidadCreada(data.id);
      setEspecialidadId(data.id.toString());
      utils.especialidades.list.invalidate();
      toast.success("Especialidad creada");
    },
    onError: (error) => {
      toast.error("Error al crear especialidad: " + error.message);
    }
  });
  
  const updateEmpresa = trpc.empresas.update.useMutation({
    onSuccess: () => {
      toast.success("Empresa actualizada con especialidad");
    },
    onError: (error) => {
      toast.error("Error al actualizar empresa: " + error.message);
    }
  });
  
  const createUsuario = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Usuario creado");
    },
    onError: (error) => {
      toast.error("Error al crear usuario: " + error.message);
    }
  });
  
  const asignarResidente = trpc.empresas.addResidente.useMutation({
    onError: (error: any) => {
      toast.error("Error al asignar residente: " + error.message);
    }
  });
  
  // Filtrar defectos por especialidad seleccionada
  const defectosFiltrados = defectos?.filter(d => {
    const espId = especialidadCreada || (especialidadId ? parseInt(especialidadId) : null);
    return !espId || d.especialidadId === espId;
  }) || [];
  
  // Validación de cada paso
  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return empresaData.nombre.trim() !== "";
      case 2:
        return especialidadId !== "" || (crearNuevaEspecialidad && nuevaEspecialidad.trim() !== "");
      case 3:
        return true; // Usuarios son opcionales
      case 4:
        return true; // Defectos son opcionales
      default:
        return false;
    }
  };
  
  // Agregar usuario a la lista
  const agregarUsuario = () => {
    if (!nuevoUsuario.nombre || !nuevoUsuario.email || !nuevoUsuario.password) {
      toast.error("Nombre, email y contraseña son requeridos");
      return;
    }
    setUsuarios([...usuarios, { ...nuevoUsuario }]);
    setNuevoUsuario({
      nombre: "",
      email: "",
      telefono: "",
      password: "",
      role: "residente",
    });
    toast.success("Usuario agregado a la lista");
  };
  
  // Eliminar usuario de la lista
  const eliminarUsuario = (index: number) => {
    setUsuarios(usuarios.filter((_, i) => i !== index));
  };
  
  // Toggle defecto
  const toggleDefecto = (defectoId: number) => {
    if (defectosSeleccionados.includes(defectoId)) {
      setDefectosSeleccionados(defectosSeleccionados.filter(id => id !== defectoId));
    } else {
      setDefectosSeleccionados([...defectosSeleccionados, defectoId]);
    }
  };
  
  // Avanzar al siguiente paso
  const handleNext = async () => {
    if (currentStep === 1) {
      // Crear empresa
      if (!empresaCreada) {
        await createEmpresa.mutateAsync({
          nombre: empresaData.nombre,
          rfc: empresaData.rfc || undefined,
          contacto: empresaData.contacto || undefined,
          telefono: empresaData.telefono || undefined,
          email: empresaData.email || undefined,
          proyectoId: selectedProjectId || undefined,
        });
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Crear o asignar especialidad
      if (crearNuevaEspecialidad && nuevaEspecialidad.trim()) {
        await createEspecialidad.mutateAsync({ nombre: nuevaEspecialidad });
      }
      
      // Actualizar empresa con especialidad
      const espId = especialidadCreada || (especialidadId ? parseInt(especialidadId) : null);
      if (empresaCreada && espId) {
        await updateEmpresa.mutateAsync({
          id: empresaCreada,
          especialidadId: espId,
        });
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Crear usuarios y asignarlos
      for (const usuario of usuarios) {
        try {
          const newUser = await createUsuario.mutateAsync({
            name: usuario.nombre,
            email: usuario.email,
            password: usuario.password,
            role: usuario.role,
            empresaId: empresaCreada || undefined,
          });
          
          // Asignar como residente si aplica
          if (empresaCreada && (usuario.role === 'residente' || usuario.role === 'jefe_residente')) {
            await asignarResidente.mutateAsync({
              empresaId: empresaCreada,
              usuarioId: newUser.id,
              tipoResidente: usuario.role === 'jefe_residente' ? 'jefe_residente' : 'residente',
            });
          }
        } catch (error) {
          console.error("Error creando usuario:", error);
        }
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      // Los defectos se asignan a la especialidad, no a la empresa
      // Solo mostramos los defectos disponibles para referencia
      
      // Finalizar
      toast.success("¡Empresa configurada exitosamente!");
      utils.empresas.list.invalidate();
      setLocation("/configuracion/empresas");
    }
  };
  
  // Retroceder al paso anterior
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const steps = [
    { number: 1, title: "Empresa", description: "Datos básicos" },
    { number: 2, title: "Especialidad", description: "Tipo de trabajo" },
    { number: 3, title: "Usuarios", description: "Equipo de trabajo" },
    { number: 4, title: "Defectos", description: "Catálogo de defectos" },
  ];
  
  return (
    <div className="container py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          Alta Rápida de Empresa
        </h1>
        <p className="text-muted-foreground mt-1">
          Configura una nueva empresa en 4 pasos simples
        </p>
      </div>
      
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  currentStep > step.number 
                    ? 'bg-primary border-primary text-primary-foreground' 
                    : currentStep === step.number 
                      ? 'border-primary text-primary bg-primary/10' 
                      : 'border-muted-foreground/30 text-muted-foreground'
                }`}>
                  {currentStep > step.number ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="font-semibold">{step.number}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-sm font-medium ${currentStep >= step.number ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 sm:w-20 h-0.5 mx-2 ${currentStep > step.number ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep - 1].title}</CardTitle>
          <CardDescription>{steps[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Paso 1: Datos de Empresa */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre de la Empresa *</Label>
                <Input
                  id="nombre"
                  value={empresaData.nombre}
                  onChange={(e) => setEmpresaData({ ...empresaData, nombre: e.target.value })}
                  placeholder="Ej: Constructora ABC"
                  className="mt-1"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rfc">RFC</Label>
                  <Input
                    id="rfc"
                    value={empresaData.rfc}
                    onChange={(e) => setEmpresaData({ ...empresaData, rfc: e.target.value })}
                    placeholder="ABC123456XYZ"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={empresaData.telefono}
                    onChange={(e) => setEmpresaData({ ...empresaData, telefono: e.target.value })}
                    placeholder="33 1234 5678"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="contacto">Nombre del Contacto</Label>
                <Input
                  id="contacto"
                  value={empresaData.contacto}
                  onChange={(e) => setEmpresaData({ ...empresaData, contacto: e.target.value })}
                  placeholder="Nombre del representante"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={empresaData.email}
                  onChange={(e) => setEmpresaData({ ...empresaData, email: e.target.value })}
                  placeholder="contacto@empresa.com"
                  className="mt-1"
                />
              </div>
            </div>
          )}
          
          {/* Paso 2: Especialidad */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Checkbox
                  id="crearNueva"
                  checked={crearNuevaEspecialidad}
                  onCheckedChange={(checked) => {
                    setCrearNuevaEspecialidad(checked === true);
                    if (checked) setEspecialidadId("");
                  }}
                />
                <Label htmlFor="crearNueva" className="cursor-pointer">
                  Crear nueva especialidad
                </Label>
              </div>
              
              {crearNuevaEspecialidad ? (
                <div>
                  <Label htmlFor="nuevaEspecialidad">Nombre de la Nueva Especialidad *</Label>
                  <Input
                    id="nuevaEspecialidad"
                    value={nuevaEspecialidad}
                    onChange={(e) => setNuevaEspecialidad(e.target.value)}
                    placeholder="Ej: Electricidad, Plomería, Acabados..."
                    className="mt-1"
                  />
                </div>
              ) : (
                <div>
                  <Label>Seleccionar Especialidad Existente *</Label>
                  <Select value={especialidadId} onValueChange={setEspecialidadId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecciona una especialidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {especialidades?.map((esp) => (
                        <SelectItem key={esp.id} value={esp.id.toString()}>
                          {esp.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {especialidades && especialidades.length === 0 && !crearNuevaEspecialidad && (
                <p className="text-sm text-muted-foreground">
                  No hay especialidades registradas. Marca "Crear nueva especialidad" para agregar una.
                </p>
              )}
            </div>
          )}
          
          {/* Paso 3: Usuarios */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Agrega los usuarios que trabajarán con esta empresa. Puedes omitir este paso y agregarlos después.
              </p>
              
              {/* Lista de usuarios agregados */}
              {usuarios.length > 0 && (
                <div className="mb-4">
                  <Label className="mb-2 block">Usuarios a crear ({usuarios.length})</Label>
                  <div className="space-y-2">
                    {usuarios.map((u, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{u.nombre}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{roleLabels[u.role]}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => eliminarUsuario(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Formulario para agregar usuario */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <Label className="mb-3 block font-medium">Agregar Usuario</Label>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label htmlFor="usuarioNombre" className="text-xs">Nombre *</Label>
                    <Input
                      id="usuarioNombre"
                      value={nuevoUsuario.nombre}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })}
                      placeholder="Nombre completo"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="usuarioEmail" className="text-xs">Email *</Label>
                    <Input
                      id="usuarioEmail"
                      type="email"
                      value={nuevoUsuario.email}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
                      placeholder="email@ejemplo.com"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label htmlFor="usuarioTelefono" className="text-xs">Teléfono</Label>
                    <Input
                      id="usuarioTelefono"
                      value={nuevoUsuario.telefono}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, telefono: e.target.value })}
                      placeholder="33 1234 5678"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="usuarioRole" className="text-xs">Rol *</Label>
                    <Select 
                      value={nuevoUsuario.role} 
                      onValueChange={(v) => setNuevoUsuario({ ...nuevoUsuario, role: v as any })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residente">Residente</SelectItem>
                        <SelectItem value="jefe_residente">Jefe de Residente</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="desarrollador">Desarrollador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="mb-3">
                  <Label htmlFor="usuarioPassword" className="text-xs">Contraseña *</Label>
                  <div className="relative mt-1">
                    <Input
                      id="usuarioPassword"
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
                  onClick={agregarUsuario} 
                  variant="outline" 
                  className="w-full"
                  disabled={!nuevoUsuario.nombre || !nuevoUsuario.email || !nuevoUsuario.password}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar a la Lista
                </Button>
              </div>
            </div>
          )}
          
          {/* Paso 4: Defectos */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Selecciona los defectos que aplican a esta empresa. Puedes omitir este paso y configurarlos después.
              </p>
              
              {defectosFiltrados.length > 0 ? (
                <ScrollArea className="h-64 border rounded-lg p-3">
                  <div className="space-y-2">
                    {defectosFiltrados.map((defecto) => (
                      <div
                        key={defecto.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          defectosSeleccionados.includes(defecto.id)
                            ? 'bg-primary/10 border border-primary'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                        onClick={() => toggleDefecto(defecto.id)}
                      >
                        <Checkbox
                          checked={defectosSeleccionados.includes(defecto.id)}
                          onCheckedChange={() => toggleDefecto(defecto.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{defecto.nombre}</span>
                          </div>
                          {defecto.descripcion && (
                            <p className="text-xs text-muted-foreground mt-1">{defecto.descripcion}</p>
                          )}
                        </div>
                        {defecto.severidad && (
                          <Badge className={severidadColors[defecto.severidad] || ''}>
                            {defecto.severidad}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay defectos disponibles para esta especialidad.</p>
                  <p className="text-sm">Puedes agregarlos después desde el catálogo de defectos.</p>
                </div>
              )}
              
              {defectosSeleccionados.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {defectosSeleccionados.length} defecto(s) seleccionado(s)
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Anterior
        </Button>
        
        <Button
          onClick={handleNext}
          disabled={!canProceed() || createEmpresa.isPending || createEspecialidad.isPending}
        >
          {currentStep === totalSteps ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Finalizar
            </>
          ) : (
            <>
              Siguiente
              <ChevronRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
