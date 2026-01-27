import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  UserCog
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
  const [showNuevoUsuario, setShowNuevoUsuario] = useState(false);
  const [nuevoUsuarioTipo, setNuevoUsuarioTipo] = useState<'residente' | 'jefe'>('residente');
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: "", email: "", telefono: "" });

  // Estados para defectos
  const [editingDefectoId, setEditingDefectoId] = useState<number | null>(null);
  const [editingDefectoData, setEditingDefectoData] = useState({ nombre: "", severidad: "moderado" });
  const [showNuevoDefecto, setShowNuevoDefecto] = useState(false);
  const [nuevoDefecto, setNuevoDefecto] = useState({ nombre: "", severidad: "moderado" });

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

  const handleSubmit = () => {
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
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
                    className={!formData.nombre ? 'border-red-300' : ''}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contacto">Persona de Contacto</Label>
                  <Input
                    id="contacto"
                    value={formData.contacto}
                    onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    placeholder="Nombre del contacto principal"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="33 1234 5678"
                    />
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
                      onValueChange={(value) => setFormData({ ...formData, especialidadId: value })}
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
                    {[formData.residenteId, formData.jefeResidenteId].filter(Boolean).length} asignados
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
                  <Select
                    value={formData.residenteId}
                    onValueChange={(value) => setFormData({ ...formData, residenteId: value })}
                  >
                    <SelectTrigger>
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
                </div>

                {/* Jefe de Residente */}
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-purple-500" />
                    Jefe de Residente
                  </Label>
                  <Select
                    value={formData.jefeResidenteId}
                    onValueChange={(value) => setFormData({ ...formData, jefeResidenteId: value })}
                  >
                    <SelectTrigger>
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
                </div>

                <p className="text-xs text-muted-foreground">
                  Los usuarios deben estar registrados en el sistema. Puedes agregarlos desde Configuración → Usuarios.
                </p>
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span className="text-sm text-muted-foreground">
                          Defectos de {especialidades?.find(e => e.id.toString() === formData.especialidadId)?.nombre}
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

                    {/* Lista de defectos */}
                    {defectosEspecialidad.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic text-center py-4">
                        No hay defectos definidos. Agrega el primero.
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
