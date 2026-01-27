import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { 
  Building2, 
  Wrench, 
  Users, 
  AlertTriangle, 
  Plus, 
  X, 
  Pencil, 
  Check,
  Sparkles,
  UserCircle,
  UserCog,
  Phone,
  Mail,
  Lock
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

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

type Props = {
  isOpen: boolean;
  onClose: () => void;
  empresa?: Empresa | null;
  proyectoId: number;
};

const severidadColors: Record<string, string> = {
  leve: "bg-green-100 text-green-800",
  moderado: "bg-yellow-100 text-yellow-800",
  grave: "bg-orange-100 text-orange-800",
  critico: "bg-red-100 text-red-800",
};

// Catálogo de defectos sugeridos por especialidad
const defectosSugeridosPorEspecialidad: Record<string, { nombre: string; severidad: string }[]> = {
  // Estructura
  estructura: [
    { nombre: "Grieta estructural", severidad: "grave" },
    { nombre: "Fisura en muro", severidad: "moderado" },
    { nombre: "Desplome de muro", severidad: "critico" },
    { nombre: "Falta de nivel", severidad: "moderado" },
    { nombre: "Acero expuesto", severidad: "grave" },
  ],
  // Tablaroca / Acabados secos
  tablaroca: [
    { nombre: "Junta visible", severidad: "leve" },
    { nombre: "Abultamiento en superficie", severidad: "moderado" },
    { nombre: "Tornillo expuesto", severidad: "leve" },
    { nombre: "Fisura en esquina", severidad: "moderado" },
    { nombre: "Falta de cinta", severidad: "moderado" },
  ],
  // Hidráulica
  hidraulica: [
    { nombre: "Fuga de agua", severidad: "grave" },
    { nombre: "Baja presión", severidad: "moderado" },
    { nombre: "Tubería mal sellada", severidad: "moderado" },
    { nombre: "Goteo en llave", severidad: "leve" },
    { nombre: "Drenaje lento", severidad: "moderado" },
  ],
  // Eléctrica
  electrica: [
    { nombre: "Corto circuito", severidad: "critico" },
    { nombre: "Contacto suelto", severidad: "moderado" },
    { nombre: "Falta de tierra física", severidad: "grave" },
    { nombre: "Cableado expuesto", severidad: "grave" },
    { nombre: "Apagador sin función", severidad: "leve" },
  ],
  // Gas
  gas: [
    { nombre: "Fuga de gas", severidad: "critico" },
    { nombre: "Conexión floja", severidad: "grave" },
    { nombre: "Falta de ventilación", severidad: "grave" },
    { nombre: "Válvula defectuosa", severidad: "moderado" },
    { nombre: "Tubería sin pintar", severidad: "leve" },
  ],
  // HVAC / Clima
  hvac: [
    { nombre: "Falta de enfriamiento", severidad: "moderado" },
    { nombre: "Ruido excesivo", severidad: "leve" },
    { nombre: "Fuga de refrigerante", severidad: "grave" },
    { nombre: "Ducto desconectado", severidad: "moderado" },
    { nombre: "Filtro sucio", severidad: "leve" },
  ],
  // Pintura / Acabados
  pintura: [
    { nombre: "Burbuja en pintura", severidad: "leve" },
    { nombre: "Color desigual", severidad: "leve" },
    { nombre: "Manchas visibles", severidad: "moderado" },
    { nombre: "Falta de retoque", severidad: "leve" },
    { nombre: "Descascarado", severidad: "moderado" },
  ],
  // Carpintería
  carpinteria: [
    { nombre: "Puerta desalineada", severidad: "moderado" },
    { nombre: "Bisagra floja", severidad: "leve" },
    { nombre: "Rayón en madera", severidad: "leve" },
    { nombre: "Cierre defectuoso", severidad: "moderado" },
    { nombre: "Falta de barniz", severidad: "leve" },
  ],
  // Aluminio / Cancelería
  aluminio: [
    { nombre: "Ventana no cierra", severidad: "moderado" },
    { nombre: "Vidrio rayado", severidad: "leve" },
    { nombre: "Falta de sellador", severidad: "moderado" },
    { nombre: "Mosquitero roto", severidad: "leve" },
    { nombre: "Herraje oxidado", severidad: "moderado" },
  ],
  // Supervisión / General
  supervision: [
    { nombre: "Limpieza deficiente", severidad: "leve" },
    { nombre: "Material fuera de lugar", severidad: "leve" },
    { nombre: "Falta de señalización", severidad: "moderado" },
    { nombre: "Área sin proteger", severidad: "moderado" },
    { nombre: "Documentación incompleta", severidad: "leve" },
  ],
  // Default
  default: [
    { nombre: "Defecto de acabado", severidad: "leve" },
    { nombre: "Instalación incorrecta", severidad: "moderado" },
    { nombre: "Material dañado", severidad: "moderado" },
    { nombre: "Falta de elemento", severidad: "moderado" },
    { nombre: "Funcionamiento incorrecto", severidad: "grave" },
  ],
};

// Función para obtener defectos sugeridos según nombre de especialidad
function getDefectosSugeridos(nombreEspecialidad: string): { nombre: string; severidad: string }[] {
  const nombreLower = nombreEspecialidad.toLowerCase();
  
  if (nombreLower.includes('estructura') || nombreLower.includes('concreto')) {
    return defectosSugeridosPorEspecialidad.estructura;
  }
  if (nombreLower.includes('tablaroca') || nombreLower.includes('yeso') || nombreLower.includes('drywall')) {
    return defectosSugeridosPorEspecialidad.tablaroca;
  }
  if (nombreLower.includes('hidra') || nombreLower.includes('plomeria') || nombreLower.includes('agua')) {
    return defectosSugeridosPorEspecialidad.hidraulica;
  }
  if (nombreLower.includes('electr') || nombreLower.includes('electric')) {
    return defectosSugeridosPorEspecialidad.electrica;
  }
  if (nombreLower.includes('gas')) {
    return defectosSugeridosPorEspecialidad.gas;
  }
  if (nombreLower.includes('hvac') || nombreLower.includes('clima') || nombreLower.includes('aire')) {
    return defectosSugeridosPorEspecialidad.hvac;
  }
  if (nombreLower.includes('pintura') || nombreLower.includes('acabado')) {
    return defectosSugeridosPorEspecialidad.pintura;
  }
  if (nombreLower.includes('carpint') || nombreLower.includes('madera') || nombreLower.includes('puerta')) {
    return defectosSugeridosPorEspecialidad.carpinteria;
  }
  if (nombreLower.includes('aluminio') || nombreLower.includes('cancel') || nombreLower.includes('ventana')) {
    return defectosSugeridosPorEspecialidad.aluminio;
  }
  if (nombreLower.includes('superv') || nombreLower.includes('general')) {
    return defectosSugeridosPorEspecialidad.supervision;
  }
  
  return defectosSugeridosPorEspecialidad.default;
}

export default function EmpresaFormIntegrado({ isOpen, onClose, empresa, proyectoId }: Props) {
  const [formData, setFormData] = useState({
    nombre: "",
    rfc: "",
    contacto: "",
    telefono: "",
    email: "",
    especialidadId: "",
    residenteId: "",
    jefeResidenteId: "",
  });

  // Estados para crear nueva especialidad inline
  const [showNuevaEspecialidad, setShowNuevaEspecialidad] = useState(false);
  const [nuevaEspecialidad, setNuevaEspecialidad] = useState({ nombre: "", codigo: "", color: "#02B381" });

  // Estados para crear nuevo usuario inline
  const [showNuevoResidente, setShowNuevoResidente] = useState(false);
  const [showNuevoJefe, setShowNuevoJefe] = useState(false);
  const [nuevoUsuario, setNuevoUsuario] = useState({ 
    nombre: "", 
    email: "", 
    telefono: "", 
    password: "" 
  });

  // Estados para defectos
  const [editingDefectoId, setEditingDefectoId] = useState<number | null>(null);
  const [editingDefectoData, setEditingDefectoData] = useState({ nombre: "", severidad: "moderado" });
  const [showNuevoDefecto, setShowNuevoDefecto] = useState(false);
  const [nuevoDefecto, setNuevoDefecto] = useState({ nombre: "", severidad: "moderado" });
  
  // Estados para defectos sugeridos seleccionados
  const [defectosSugeridosSeleccionados, setDefectosSugeridosSeleccionados] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  // Queries
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    { proyectoId },
    { enabled: !!proyectoId }
  );
  const { data: usuarios } = trpc.users.list.useQuery();
  const { data: allDefectos } = trpc.defectos.listConEstadisticas.useQuery();

  // Mutations para empresa
  const createEmpresaMutation = trpc.empresas.create.useMutation({
    onSuccess: () => {
      utils.empresas.list.invalidate();
      toast.success("Empresa creada correctamente");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateEmpresaMutation = trpc.empresas.update.useMutation({
    onSuccess: () => {
      utils.empresas.list.invalidate();
      toast.success("Empresa actualizada correctamente");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  // Mutations para especialidad
  const createEspecialidadMutation = trpc.especialidades.create.useMutation({
    onSuccess: (data) => {
      utils.especialidades.list.invalidate();
      toast.success("Especialidad creada");
      setFormData(prev => ({ ...prev, especialidadId: data.id.toString() }));
      setShowNuevaEspecialidad(false);
      setNuevaEspecialidad({ nombre: "", codigo: "", color: "#02B381" });
    },
    onError: (error) => toast.error(error.message),
  });

  // Mutation para crear usuario
  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: (data, variables) => {
      utils.users.list.invalidate();
      toast.success("Usuario creado correctamente");
      
      // Asignar el nuevo usuario al campo correspondiente
      if (showNuevoResidente) {
        setFormData(prev => ({ ...prev, residenteId: data.id.toString() }));
        setShowNuevoResidente(false);
      } else if (showNuevoJefe) {
        setFormData(prev => ({ ...prev, jefeResidenteId: data.id.toString() }));
        setShowNuevoJefe(false);
      }
      
      setNuevoUsuario({ nombre: "", email: "", telefono: "", password: "" });
    },
    onError: (error) => toast.error(error.message),
  });

  // Mutations para defectos
  const createDefectoMutation = trpc.defectos.create.useMutation({
    onSuccess: () => {
      utils.defectos.listConEstadisticas.invalidate();
      toast.success("Defecto agregado");
      setShowNuevoDefecto(false);
      setNuevoDefecto({ nombre: "", severidad: "moderado" });
    },
    onError: (error) => toast.error(error.message),
  });

  const updateDefectoMutation = trpc.defectos.update.useMutation({
    onSuccess: () => {
      utils.defectos.listConEstadisticas.invalidate();
      toast.success("Defecto actualizado");
      setEditingDefectoId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteDefectoMutation = trpc.defectos.delete.useMutation({
    onSuccess: () => {
      utils.defectos.listConEstadisticas.invalidate();
      toast.success("Defecto eliminado");
    },
    onError: (error) => toast.error(error.message),
  });

  // Cargar datos de empresa existente
  useEffect(() => {
    if (empresa) {
      setFormData({
        nombre: empresa.nombre,
        rfc: empresa.rfc || "",
        contacto: empresa.contacto || "",
        telefono: empresa.telefono || "",
        email: empresa.email || "",
        especialidadId: empresa.especialidadId?.toString() || "",
        residenteId: empresa.residenteId?.toString() || "",
        jefeResidenteId: empresa.jefeResidenteId?.toString() || "",
      });
    } else {
      setFormData({
        nombre: "",
        rfc: "",
        contacto: "",
        telefono: "",
        email: "",
        especialidadId: "",
        residenteId: "",
        jefeResidenteId: "",
      });
    }
    setDefectosSugeridosSeleccionados(new Set());
  }, [empresa, isOpen]);

  // Filtrar usuarios por rol
  const residentes = usuarios?.filter(u => 
    u.role === 'supervisor' || u.role === 'residente' || u.role === 'jefe_residente'
  ) || [];

  const jefesResidente = usuarios?.filter(u => 
    u.role === 'supervisor' || u.role === 'jefe_residente' || u.role === 'admin'
  ) || [];

  // Defectos de la especialidad seleccionada
  const defectosEspecialidad = formData.especialidadId 
    ? allDefectos?.filter(d => d.especialidadId === parseInt(formData.especialidadId)) || []
    : [];

  // Obtener especialidad seleccionada para sugerencias
  const especialidadSeleccionada = especialidades?.find(e => e.id.toString() === formData.especialidadId);
  const defectosSugeridos = especialidadSeleccionada 
    ? getDefectosSugeridos(especialidadSeleccionada.nombre)
    : [];

  // Filtrar sugeridos que ya existen
  const defectosSugeridosDisponibles = defectosSugeridos.filter(
    sugerido => !defectosEspecialidad.some(
      existente => existente.nombre.toLowerCase() === sugerido.nombre.toLowerCase()
    )
  );

  const handleSubmit = async () => {
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    // Primero crear los defectos sugeridos seleccionados
    if (formData.especialidadId && defectosSugeridosSeleccionados.size > 0) {
      for (const nombreDefecto of Array.from(defectosSugeridosSeleccionados)) {
        const defectoSugerido = defectosSugeridos.find(d => d.nombre === nombreDefecto);
        if (defectoSugerido) {
          try {
            await createDefectoMutation.mutateAsync({
              nombre: defectoSugerido.nombre,
              especialidadId: parseInt(formData.especialidadId),
              severidad: defectoSugerido.severidad as any,
              proyectoId,
            });
          } catch (e) {
            // Ignorar si ya existe
          }
        }
      }
    }

    const data = {
      nombre: formData.nombre,
      rfc: formData.rfc || undefined,
      contacto: formData.contacto || undefined,
      telefono: formData.telefono || undefined,
      email: formData.email || undefined,
      proyectoId,
      especialidadId: formData.especialidadId && formData.especialidadId !== 'none' 
        ? parseInt(formData.especialidadId) : undefined,
      residenteId: formData.residenteId && formData.residenteId !== 'none' 
        ? parseInt(formData.residenteId) : null,
      jefeResidenteId: formData.jefeResidenteId && formData.jefeResidenteId !== 'none' 
        ? parseInt(formData.jefeResidenteId) : null,
    };

    if (empresa) {
      updateEmpresaMutation.mutate({ id: empresa.id, ...data });
    } else {
      createEmpresaMutation.mutate(data);
    }
  };

  const handleCreateEspecialidad = () => {
    if (!nuevaEspecialidad.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    createEspecialidadMutation.mutate({
      nombre: nuevaEspecialidad.nombre,
      codigo: nuevaEspecialidad.codigo || nuevaEspecialidad.nombre.substring(0, 3).toUpperCase(),
      color: nuevaEspecialidad.color,
      proyectoId,
    });
  };

  const handleCreateUsuario = (tipo: 'residente' | 'jefe') => {
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
      role: tipo === 'jefe' ? 'jefe_residente' : 'residente',
      proyectoId,
    });
  };

  const handleCreateDefecto = () => {
    if (!nuevoDefecto.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!formData.especialidadId) {
      toast.error("Primero selecciona una especialidad");
      return;
    }
    createDefectoMutation.mutate({
      nombre: nuevoDefecto.nombre,
      especialidadId: parseInt(formData.especialidadId),
      severidad: nuevoDefecto.severidad as any,
      proyectoId,
    });
  };

  const handleSaveDefecto = (id: number) => {
    updateDefectoMutation.mutate({
      id,
      nombre: editingDefectoData.nombre,
      severidad: editingDefectoData.severidad as any,
    });
  };

  const handleDeleteDefecto = (id: number) => {
    if (confirm("¿Eliminar este defecto?")) {
      deleteDefectoMutation.mutate({ id });
    }
  };

  const toggleDefectoSugerido = (nombre: string) => {
    const newSet = new Set(defectosSugeridosSeleccionados);
    if (newSet.has(nombre)) {
      newSet.delete(nombre);
    } else {
      newSet.add(nombre);
    }
    setDefectosSugeridosSeleccionados(newSet);
  };

  // Componente para formulario de nuevo usuario
  const NuevoUsuarioForm = ({ tipo, onCancel }: { tipo: 'residente' | 'jefe'; onCancel: () => void }) => (
    <Card className="border-dashed border-blue-400 mt-2">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-blue-600 font-medium">
            {tipo === 'jefe' ? 'Nuevo Jefe de Residente' : 'Nuevo Residente'}
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Nombre completo *"
              value={nuevoUsuario.nombre}
              onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })}
              className="flex-1"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Teléfono"
                value={nuevoUsuario.telefono}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, telefono: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Correo"
                type="email"
                value={nuevoUsuario.email}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Contraseña (mín. 6 caracteres) *"
              type="password"
              value={nuevoUsuario.password}
              onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleCreateUsuario(tipo)}
            disabled={createUserMutation.isPending}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Check className="h-4 w-4 mr-1" />
            Crear {tipo === 'jefe' ? 'Jefe' : 'Residente'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#02B381]" />
            {empresa ? "Editar Empresa" : "Nueva Empresa"}
          </DialogTitle>
          <DialogDescription>
            Configura todos los datos de la empresa en un solo lugar
          </DialogDescription>
        </DialogHeader>

        <Accordion type="multiple" defaultValue={["datos", "especialidad", "equipo", "defectos"]} className="w-full">
          {/* Sección 1: Datos Generales */}
          <AccordionItem value="datos">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#002C63]" />
                <span className="font-medium">Datos Generales</span>
                {formData.nombre && (
                  <Badge variant="secondary" className="ml-2 text-xs">{formData.nombre}</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre de la Empresa *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Constructora ABC"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="contacto">Contacto</Label>
                    <Input
                      id="contacto"
                      value={formData.contacto}
                      onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                      placeholder="Nombre del contacto"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="33 1234 5678"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contacto@empresa.com"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Sección 2: Especialidad */}
          <AccordionItem value="especialidad">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-[#02B381]" />
                <span className="font-medium">Especialidad</span>
                {formData.especialidadId && formData.especialidadId !== 'none' && (
                  <Badge className="ml-2 bg-[#02B381]">
                    {especialidades?.find(e => e.id.toString() === formData.especialidadId)?.nombre}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="grid gap-2">
                  <Label>Seleccionar Especialidad</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.especialidadId}
                      onValueChange={(value) => {
                        setFormData({ ...formData, especialidadId: value });
                        setDefectosSugeridosSeleccionados(new Set());
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar especialidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin especialidad</SelectItem>
                        {especialidades?.map((esp) => (
                          <SelectItem key={esp.id} value={esp.id.toString()}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: esp.color || '#02B381' }}
                              />
                              {esp.nombre}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowNuevaEspecialidad(true)}
                      title="Crear nueva especialidad"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    La especialidad determina los defectos típicos disponibles
                  </p>
                </div>

                {/* Form inline para nueva especialidad */}
                {showNuevaEspecialidad && (
                  <Card className="border-dashed border-[#02B381]">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[#02B381] font-medium">Nueva Especialidad</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setShowNuevaEspecialidad(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Nombre *"
                          value={nuevaEspecialidad.nombre}
                          onChange={(e) => setNuevaEspecialidad({ ...nuevaEspecialidad, nombre: e.target.value })}
                          className="col-span-2"
                        />
                        <Input
                          placeholder="Código"
                          value={nuevaEspecialidad.codigo}
                          onChange={(e) => setNuevaEspecialidad({ ...nuevaEspecialidad, codigo: e.target.value })}
                          maxLength={5}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Color:</Label>
                        <input
                          type="color"
                          value={nuevaEspecialidad.color}
                          onChange={(e) => setNuevaEspecialidad({ ...nuevaEspecialidad, color: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCreateEspecialidad}
                          disabled={createEspecialidadMutation.isPending}
                          className="ml-auto bg-[#02B381] hover:bg-[#02B381]/90"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Crear
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Sección 3: Equipo */}
          <AccordionItem value="equipo">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#002C63]" />
                <span className="font-medium">Equipo</span>
                {(formData.residenteId || formData.jefeResidenteId) && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {[formData.residenteId, formData.jefeResidenteId].filter(v => v && v !== 'none').length} asignados
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 pt-2">
                {/* Residente */}
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-blue-500" />
                    Residente
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.residenteId}
                      onValueChange={(value) => setFormData({ ...formData, residenteId: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar residente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {residentes.map((usuario) => (
                          <SelectItem key={usuario.id} value={usuario.id.toString()}>
                            {usuario.name || usuario.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setShowNuevoResidente(true);
                        setShowNuevoJefe(false);
                        setNuevoUsuario({ nombre: "", email: "", telefono: "", password: "" });
                      }}
                      title="Crear nuevo residente"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {showNuevoResidente && (
                    <NuevoUsuarioForm 
                      tipo="residente" 
                      onCancel={() => setShowNuevoResidente(false)} 
                    />
                  )}
                </div>

                {/* Jefe de Residente */}
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-purple-500" />
                    Jefe de Residente
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.jefeResidenteId}
                      onValueChange={(value) => setFormData({ ...formData, jefeResidenteId: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar jefe de residente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {jefesResidente.map((usuario) => (
                          <SelectItem key={usuario.id} value={usuario.id.toString()}>
                            {usuario.name || usuario.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setShowNuevoJefe(true);
                        setShowNuevoResidente(false);
                        setNuevoUsuario({ nombre: "", email: "", telefono: "", password: "" });
                      }}
                      title="Crear nuevo jefe de residente"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {showNuevoJefe && (
                    <NuevoUsuarioForm 
                      tipo="jefe" 
                      onCancel={() => setShowNuevoJefe(false)} 
                    />
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Sección 4: Defectos Típicos */}
          <AccordionItem value="defectos">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Defectos Típicos</span>
                {defectosEspecialidad.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {defectosEspecialidad.length} defectos
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {!formData.especialidadId || formData.especialidadId === 'none' ? (
                  <p className="text-sm text-muted-foreground italic text-center py-4">
                    Selecciona una especialidad para ver y gestionar los defectos típicos
                  </p>
                ) : (
                  <>
                    {/* Defectos sugeridos */}
                    {defectosSugeridosDisponibles.length > 0 && (
                      <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium text-amber-700">
                              Defectos Sugeridos para {especialidadSeleccionada?.nombre}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {defectosSugeridosDisponibles.map((defecto) => (
                              <label
                                key={defecto.nombre}
                                className="flex items-center gap-2 p-2 bg-white rounded border cursor-pointer hover:border-amber-400 transition-colors"
                              >
                                <Checkbox
                                  checked={defectosSugeridosSeleccionados.has(defecto.nombre)}
                                  onCheckedChange={() => toggleDefectoSugerido(defecto.nombre)}
                                />
                                <span className="text-sm flex-1">{defecto.nombre}</span>
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${severidadColors[defecto.severidad] || ''}`}
                                >
                                  {defecto.severidad}
                                </Badge>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-amber-600 mt-2">
                            Selecciona los defectos que aplican a esta empresa
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Defectos existentes de {especialidadSeleccionada?.nombre}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNuevoDefecto(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar
                      </Button>
                    </div>

                    {/* Form inline para nuevo defecto */}
                    {showNuevoDefecto && (
                      <Card className="border-dashed border-amber-400">
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-amber-600 font-medium">Nuevo Defecto</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setShowNuevoDefecto(false)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nombre del defecto *"
                              value={nuevoDefecto.nombre}
                              onChange={(e) => setNuevoDefecto({ ...nuevoDefecto, nombre: e.target.value })}
                              className="flex-1"
                            />
                            <Select
                              value={nuevoDefecto.severidad}
                              onValueChange={(value) => setNuevoDefecto({ ...nuevoDefecto, severidad: value })}
                            >
                              <SelectTrigger className="w-32">
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
                              type="button"
                              size="icon"
                              onClick={handleCreateDefecto}
                              disabled={createDefectoMutation.isPending}
                              className="bg-amber-500 hover:bg-amber-600"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Lista de defectos existentes */}
                    {defectosEspecialidad.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic text-center py-4">
                        No hay defectos definidos. Selecciona de los sugeridos o agrega uno nuevo.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {defectosEspecialidad.map((defecto: any) => (
                          <div 
                            key={defecto.id} 
                            className="group flex items-center gap-2 p-2 bg-slate-50 rounded border text-sm hover:border-gray-300 transition-colors"
                          >
                            {editingDefectoId === defecto.id ? (
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
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => handleSaveDefecto(defecto.id)}
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setEditingDefectoId(null)}
                                >
                                  <X className="h-3 w-3 text-gray-500" />
                                </Button>
                              </>
                            ) : (
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
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      setEditingDefectoId(defecto.id);
                                      setEditingDefectoData({ nombre: defecto.nombre, severidad: defecto.severidad });
                                    }}
                                  >
                                    <Pencil className="h-3 w-3 text-gray-500" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => handleDeleteDefecto(defecto.id)}
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
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createEmpresaMutation.isPending || updateEmpresaMutation.isPending}
            className="bg-[#02B381] hover:bg-[#02B381]/90"
          >
            {empresa ? "Guardar Cambios" : "Crear Empresa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
