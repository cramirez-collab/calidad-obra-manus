import DashboardLayout from "@/components/DashboardLayout";
import ImageMarker from "@/components/ImageMarker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { 
  Camera, 
  Upload, 
  ArrowLeft, 
  Check,
  Pencil,
  X,
  Zap,
  Building2,
  MapPin,
  Wrench,
  AlertTriangle,
  Layers,
  User
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";

export default function NuevoItem() {
  const [, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  const [formData, setFormData] = useState({
    residenteId: "",
    empresaId: "",
    nivelId: "",
    unidadId: "",
    especialidadId: "",
    defectoId: "",
    espacioId: "",
    titulo: "",
  });
  const [fotoAntes, setFotoAntes] = useState<string | null>(null);
  const [fotoAntesMarcada, setFotoAntesMarcada] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMarker, setShowMarker] = useState(false);
  const [modoRapido, setModoRapido] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Datos de prellenado del usuario
  const { data: datosPrellena } = trpc.flujoRapido.datosPrellena.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : {},
    { enabled: !!selectedProjectId }
  );

  // Obtener usuarios (residentes) - usar el router correcto
  const { data: usuarios } = trpc.users.list.useQuery();
  
  // Filtrar solo residentes y jefes de residente
  const residentes = useMemo(() => {
    if (!usuarios) return [];
    return usuarios.filter((u: { role: string }) => u.role === 'user' || u.role === 'supervisor');
  }, [usuarios]);

  // Obtener datos filtrados por proyecto desde el backend
  const { data: todasEmpresas } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  
  // Filtrar empresas por residente seleccionado
  const empresas = useMemo(() => {
    if (!todasEmpresas) return [];
    if (!formData.residenteId || formData.residenteId === "all") return todasEmpresas;
    return todasEmpresas.filter(e => 
      e.residenteId?.toString() === formData.residenteId || 
      e.jefeResidenteId?.toString() === formData.residenteId
    );
  }, [todasEmpresas, formData.residenteId]);
  
  const { data: todasUnidades } = trpc.unidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  
  // Obtener niveles únicos de las unidades
  const niveles = useMemo(() => {
    if (!todasUnidades) return [];
    const nivelesSet = new Set(todasUnidades.map(u => u.nivel).filter(Boolean));
    return Array.from(nivelesSet).sort((a, b) => (a || 0) - (b || 0));
  }, [todasUnidades]);
  
  // Filtrar unidades por nivel seleccionado
  const unidades = useMemo(() => {
    if (!todasUnidades) return [];
    if (!formData.nivelId) return todasUnidades;
    return todasUnidades.filter(u => u.nivel?.toString() === formData.nivelId);
  }, [todasUnidades, formData.nivelId]);
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  
  // Espacios filtrados por unidad seleccionada
  const { data: espacios } = trpc.espacios.byUnidad.useQuery(
    { unidadId: parseInt(formData.unidadId) },
    { enabled: !!formData.unidadId }
  );
  
  // Defectos filtrados por especialidad seleccionada
  const { data: defectos } = trpc.defectos.byEspecialidad.useQuery(
    { especialidadId: parseInt(formData.especialidadId) },
    { enabled: !!formData.especialidadId }
  );

  const createItemMutation = trpc.items.create.useMutation();
  const uploadFotoMutation = trpc.items.uploadFotoAntes.useMutation();

  // Prellenar empresa del usuario si tiene una asignada
  useEffect(() => {
    if (datosPrellena?.empresa && !formData.empresaId) {
      setFormData(prev => ({ 
        ...prev, 
        empresaId: datosPrellena.empresa!.id.toString() 
      }));
    }
  }, [datosPrellena]);

  // Auto-seleccionar especialidad cuando se selecciona empresa
  useEffect(() => {
    if (formData.empresaId && empresas) {
      const empresa = empresas.find(e => e.id.toString() === formData.empresaId);
      if (empresa?.especialidadId) {
        setFormData(prev => ({ 
          ...prev, 
          especialidadId: empresa.especialidadId!.toString(),
          defectoId: "" // Reset defecto al cambiar especialidad
        }));
      }
    }
  }, [formData.empresaId, empresas]);

  // Defectos frecuentes para acceso rápido
  const defectosFrecuentes = useMemo(() => {
    if (!datosPrellena?.defectosFrecuentes) return [];
    return datosPrellena.defectosFrecuentes;
  }, [datosPrellena]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona una imagen");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFotoAntes(event.target?.result as string);
      setFotoAntesMarcada(null);
    };
    reader.readAsDataURL(file);
  };

  const handleMarkedImage = (markedImageBase64: string) => {
    setFotoAntesMarcada(markedImageBase64);
    setShowMarker(false);
  };

  const handleDefectoRapido = (defecto: any) => {
    // Auto-completar título con el nombre del defecto
    setFormData(prev => ({
      ...prev,
      defectoId: defecto.id.toString(),
      titulo: prev.titulo || defecto.nombre,
      especialidadId: defecto.especialidadId?.toString() || prev.especialidadId
    }));
  };

  const handleSubmit = async () => {
    // Validación - residente es obligatorio
    if (!formData.residenteId || formData.residenteId === "all") {
      toast.error("Por favor selecciona un residente");
      return;
    }
    
    // Validación mínima - título es opcional
    if (!formData.empresaId || !formData.unidadId) {
      toast.error("Por favor completa: Empresa y Unidad");
      return;
    }

    if (!fotoAntes) {
      toast.error("Se requiere una foto");
      return;
    }

    setIsSubmitting(true);
    try {
      // Usar nombre del defecto como título si no hay título
      const defectoSeleccionado = defectos?.find(d => d.id.toString() === formData.defectoId);
      const tituloFinal = formData.titulo || defectoSeleccionado?.nombre || 'Sin título';
      
      // Crear el ítem
      const result = await createItemMutation.mutateAsync({
        proyectoId: selectedProjectId || 0,
        empresaId: parseInt(formData.empresaId),
        unidadId: parseInt(formData.unidadId),
        especialidadId: formData.especialidadId ? parseInt(formData.especialidadId) : undefined,
        defectoId: formData.defectoId ? parseInt(formData.defectoId) : undefined,
        espacioId: formData.espacioId ? parseInt(formData.espacioId) : undefined,
        titulo: tituloFinal,
      });

      // Subir las fotos
      await uploadFotoMutation.mutateAsync({
        itemId: result.id,
        fotoBase64: fotoAntes,
        fotoMarcadaBase64: fotoAntesMarcada || undefined,
      });

      toast.success("Ítem creado correctamente");
      setLocation(`/items/${result.id}`);
    } catch (error: any) {
      toast.error(error.message || "Error al crear el ítem");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modal de marcado
  if (showMarker && fotoAntes) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardContent className="p-0">
              <div className="h-[500px]">
                <ImageMarker
                  imageUrl={fotoAntes}
                  onSave={handleMarkedImage}
                  onCancel={() => setShowMarker(false)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header compacto */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/items")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold text-[#002C63]">Nuevo Ítem</h1>
          </div>

        </div>

        {/* Inputs ocultos para cámara/archivo */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* PASO 1: Foto primero (más importante) */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            {fotoAntes ? (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-slate-100">
                  <img
                    src={fotoAntesMarcada || fotoAntes}
                    alt="Foto del problema"
                    className="w-full h-auto max-h-[200px] object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => {
                      setFotoAntes(null);
                      setFotoAntesMarcada(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowMarker(true)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    {fotoAntesMarcada ? "Editar" : "Marcar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-3 w-3 mr-1" />
                    Cambiar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-1 border-2 border-dashed hover:border-[#02B381] hover:bg-[#02B381]/5"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-6 w-6 text-[#02B381]" />
                  <span className="text-xs">Tomar Foto</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-1 border-2 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-6 w-6 text-gray-400" />
                  <span className="text-xs">Subir</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PASO 2: Título y Defecto rápido */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <Input
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Descripción breve (opcional)"
              className="text-base border-0 border-b rounded-none px-0 focus-visible:ring-0"
            />
            
            {/* Defectos frecuentes (acceso rápido) */}
            {modoRapido && defectosFrecuentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Defectos frecuentes</p>
                <div className="flex flex-wrap gap-1">
                  {defectosFrecuentes.map((defecto: any) => (
                    <Badge
                      key={defecto.id}
                      variant={formData.defectoId === defecto.id.toString() ? "default" : "outline"}
                      className={`cursor-pointer text-[10px] ${
                        formData.defectoId === defecto.id.toString() 
                          ? "bg-[#02B381] hover:bg-[#02B381]/90" 
                          : "hover:bg-gray-100"
                      }`}
                      onClick={() => handleDefectoRapido(defecto)}
                    >
                      {defecto.nombre}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PASO 3: Usuario y Empresa */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <User className="h-3 w-3" />
              Asignación
            </div>
            
            {/* Usuario/Residente (opcional, filtra empresas) */}
            <Select
              value={formData.residenteId}
              onValueChange={(value) => setFormData({ ...formData, residenteId: value, empresaId: "", especialidadId: "", defectoId: "" })}
            >
              <SelectTrigger className="h-9 text-xs">
                <User className="h-3 w-3 mr-1 text-gray-400" />
                <SelectValue placeholder="Seleccionar Residente *" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {residentes?.map((user: { id: number; name: string | null }) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name || 'Sin nombre'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Empresa */}
            <Select
              value={formData.empresaId}
              onValueChange={(value) => setFormData({ ...formData, empresaId: value })}
            >
              <SelectTrigger className="h-9 text-xs">
                <Building2 className="h-3 w-3 mr-1 text-gray-400" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas?.map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id.toString()}>
                    {empresa.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Especialidad (de la empresa seleccionada) */}
            <Select
              value={formData.especialidadId}
              onValueChange={(value) => setFormData({ ...formData, especialidadId: value, defectoId: "" })}
            >
              <SelectTrigger className="h-9 text-xs">
                <Wrench className="h-3 w-3 mr-1 text-gray-400" />
                <SelectValue placeholder="Especialidad" />
              </SelectTrigger>
              <SelectContent>
                {especialidades?.map((esp) => (
                  <SelectItem key={esp.id} value={esp.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: esp.color || "#3B82F6" }}
                      />
                      {esp.nombre}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* PASO 4: Ubicación (nivel, unidad, espacio) */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <MapPin className="h-3 w-3" />
              Ubicación
            </div>
            
            {/* Nivel */}
            <Select
              value={formData.nivelId}
              onValueChange={(value) => setFormData({ ...formData, nivelId: value, unidadId: "", espacioId: "" })}
            >
              <SelectTrigger className="h-9 text-xs">
                <Layers className="h-3 w-3 mr-1 text-gray-400" />
                <SelectValue placeholder="Nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los niveles</SelectItem>
                {niveles.map((nivel) => (
                  <SelectItem key={nivel} value={nivel!.toString()}>
                    Nivel {nivel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Unidad (filtrada por nivel) */}
            <Select
              value={formData.unidadId}
              onValueChange={(value) => setFormData({ ...formData, unidadId: value, espacioId: "" })}
            >
              <SelectTrigger className="h-9 text-xs">
                <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                <SelectValue placeholder="Unidad" />
              </SelectTrigger>
              <SelectContent>
                {unidades?.map((unidad) => (
                  <SelectItem key={unidad.id} value={unidad.id.toString()}>
                    {unidad.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Espacio (solo si hay unidad) */}
            {formData.unidadId && espacios && espacios.length > 0 && (
              <Select
                value={formData.espacioId}
                onValueChange={(value) => setFormData({ ...formData, espacioId: value })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <Layers className="h-3 w-3 mr-1 text-gray-400" />
                  <SelectValue placeholder="Espacio (Sala, Cocina, Baño...)" />
                </SelectTrigger>
                <SelectContent>
                  {espacios.map((espacio) => (
                    <SelectItem key={espacio.id} value={espacio.id.toString()}>
                      {espacio.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* PASO 5: Defecto (de la especialidad seleccionada) */}
        {!modoRapido && formData.especialidadId && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <AlertTriangle className="h-3 w-3" />
                Defecto
              </div>
              
              <Select
                value={formData.defectoId}
                onValueChange={(value) => setFormData({ ...formData, defectoId: value })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1 text-gray-400" />
                  <SelectValue placeholder="Seleccionar defecto" />
                </SelectTrigger>
                <SelectContent>
                  {defectos?.map((def) => (
                    <SelectItem key={def.id} value={def.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${
                          def.severidad === 'leve' ? 'bg-green-500' :
                          def.severidad === 'moderado' ? 'bg-yellow-500' :
                          def.severidad === 'grave' ? 'bg-orange-500' : 'bg-red-500'
                        }`} />
                        {def.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Botón de crear - Siempre visible */}
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting || !fotoAntes || !formData.empresaId || !formData.unidadId}
          className="w-full h-12 bg-[#02B381] hover:bg-[#02B381]/90 text-white font-semibold"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creando...
            </div>
          ) : (
            <>
              <Check className="h-5 w-5 mr-2" />
              Crear Ítem
            </>
          )}
        </Button>
      </div>
    </DashboardLayout>
  );
}
