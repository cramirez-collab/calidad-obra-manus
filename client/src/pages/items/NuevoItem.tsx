import DashboardLayout from "@/components/DashboardLayout";
import ImageMarker from "@/components/ImageMarker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getImageUrl } from "@/lib/imageUrl";
import { 
  Camera, 
  Upload, 
  ArrowLeft, 
  Check,
  Pencil,
  X,
  Building2,
  MapPin,
  Wrench,
  AlertTriangle,
  Layers,
  User,
  Loader2
} from "lucide-react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
  });
  const [fotoAntes, setFotoAntes] = useState<string | null>(null);
  const [fotoAntesMarcada, setFotoAntesMarcada] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMarker, setShowMarker] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Obtener empresas con sus residentes
  const { data: todasEmpresas } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  
  // Obtener usuarios para mapear nombres
  const { data: usuarios } = trpc.users.list.useQuery();
  
  // Obtener todos los residentes con sus empresas (nueva estructura)
  const { data: residentesConEmpresasNuevo } = trpc.empresas.getAllResidentesConEmpresas.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  
  // Crear lista de residentes únicos que tienen empresa asignada
  const residentesConEmpresa = useMemo(() => {
    if (!todasEmpresas || !usuarios) return [];
    
    const residentesMap = new Map<number, { id: number; name: string; empresaId: number; empresaNombre: string; especialidadId: number | null; tipoResidente?: string }>();
    
    // Primero agregar residentes de la nueva estructura (empresa_residentes)
    if (residentesConEmpresasNuevo && residentesConEmpresasNuevo.length > 0) {
      residentesConEmpresasNuevo.forEach((residente: any) => {
        residente.empresas?.forEach((emp: any) => {
          const key = residente.id * 10000 + emp.empresaId;
          if (!residentesMap.has(key)) {
            residentesMap.set(key, {
              id: residente.id,
              name: residente.name || 'Sin nombre',
              empresaId: emp.empresaId,
              empresaNombre: emp.empresaNombre,
              especialidadId: emp.especialidadId || null,
              tipoResidente: emp.tipoResidente
            });
          }
        });
      });
    }
    
    // Luego agregar residentes de la estructura antigua (compatibilidad)
    todasEmpresas.forEach(empresa => {
      // Residente principal
      if (empresa.residenteId) {
        const user = usuarios.find(u => u.id === empresa.residenteId);
        if (user) {
          const key = user.id * 10000 + empresa.id;
          if (!residentesMap.has(key)) {
            residentesMap.set(key, {
              id: user.id,
              name: user.name || 'Sin nombre',
              empresaId: empresa.id,
              empresaNombre: empresa.nombre,
              especialidadId: empresa.especialidadId || null,
              tipoResidente: 'residente'
            });
          }
        }
      }
      // Jefe de residente
      if (empresa.jefeResidenteId) {
        const user = usuarios.find(u => u.id === empresa.jefeResidenteId);
        if (user) {
          const key = user.id * 10000 + empresa.id;
          if (!residentesMap.has(key)) {
            residentesMap.set(key, {
              id: user.id,
              name: user.name || 'Sin nombre',
              empresaId: empresa.id,
              empresaNombre: empresa.nombre,
              especialidadId: empresa.especialidadId || null,
              tipoResidente: 'jefe_residente'
            });
          }
        }
      }
    });
    
    // También incluir usuarios con rol residente/jefe_residente que tengan empresaId
    usuarios.forEach(user => {
      if (['residente', 'jefe_residente'].includes(user.role) && user.empresaId) {
        const empresa = todasEmpresas.find(e => e.id === user.empresaId);
        if (empresa) {
          const key = user.id * 10000 + empresa.id;
          if (!residentesMap.has(key)) {
            residentesMap.set(key, {
              id: user.id,
              name: user.name || 'Sin nombre',
              empresaId: empresa.id,
              empresaNombre: empresa.nombre,
              especialidadId: empresa.especialidadId || null,
              tipoResidente: user.role
            });
          }
        }
      }
    });
    
    return Array.from(residentesMap.values());
  }, [todasEmpresas, usuarios, residentesConEmpresasNuevo]);
  
  // Obtener datos del residente seleccionado
  const residenteSeleccionado = useMemo(() => {
    if (!formData.residenteId) return null;
    return residentesConEmpresa.find(r => r.id.toString() === formData.residenteId);
  }, [formData.residenteId, residentesConEmpresa]);
  
  // Obtener especialidad del residente
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  
  const especialidadDelResidente = useMemo(() => {
    if (!residenteSeleccionado?.especialidadId || !especialidades) return null;
    return especialidades.find(e => e.id === residenteSeleccionado.especialidadId);
  }, [residenteSeleccionado, especialidades]);
  
  // Obtener unidades del proyecto
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
  
  // Espacios de la plantilla del proyecto (no por unidad)
  const { data: espaciosPlantilla } = trpc.espacios.plantilla.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  
  // Defectos filtrados por especialidad
  const especialidadIdParaDefectos = residenteSeleccionado?.especialidadId || (formData.especialidadId ? parseInt(formData.especialidadId) : 0);
  const { data: defectos } = trpc.defectos.byEspecialidad.useQuery(
    { especialidadId: especialidadIdParaDefectos },
    { enabled: !!especialidadIdParaDefectos }
  );

  const createItemMutation = trpc.items.create.useMutation();

  // Auto-completar empresa y especialidad cuando se selecciona residente
  useEffect(() => {
    if (residenteSeleccionado) {
      setFormData(prev => ({
        ...prev,
        empresaId: residenteSeleccionado.empresaId.toString(),
        especialidadId: residenteSeleccionado.especialidadId?.toString() || "",
        defectoId: "" // Reset defecto al cambiar residente
      }));
    }
  }, [residenteSeleccionado]);

  // Función para comprimir imagen RÁPIDA (sin bloquear UI)
  const compressImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxWidth = 800;
            let { width, height } = img;
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('No canvas context'));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const result = canvas.toDataURL('image/jpeg', 0.6);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }, []);

  // Handler de captura de foto INMEDIATO
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona una imagen");
      return;
    }

    setIsCapturing(true);
    
    try {
      // Comprimir imagen rápidamente
      const compressedImage = await compressImage(file);
      setFotoAntes(compressedImage);
      setFotoAntesMarcada(null);
      // Abrir automáticamente el editor de marcado
      setShowMarker(true);
    } catch (error) {
      console.error('Error procesando imagen:', error);
      // Fallback: usar imagen original
      const reader = new FileReader();
      reader.onload = (event) => {
        setFotoAntes(event.target?.result as string);
        setFotoAntesMarcada(null);
        setShowMarker(true);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCapturing(false);
      // Limpiar el input para permitir seleccionar la misma imagen
      e.target.value = '';
    }
  }, [compressImage]);

  const handleMarkedImage = useCallback((markedImageBase64: string) => {
    setFotoAntesMarcada(markedImageBase64);
    setShowMarker(false);
  }, []);

  const handleSubmit = async () => {
    // Validación - residente es obligatorio
    if (!formData.residenteId) {
      toast.error("Por favor selecciona un residente");
      return;
    }
    
    // Validación - unidad es obligatoria
    if (!formData.unidadId) {
      toast.error("Por favor selecciona una unidad");
      return;
    }

    if (!fotoAntes) {
      toast.error("Se requiere una foto");
      return;
    }

    // Empresa viene automáticamente del residente
    if (!residenteSeleccionado?.empresaId) {
      toast.error("Error: El residente no tiene empresa asignada");
      return;
    }

    setIsSubmitting(true);
    
    // Usar nombre del defecto como título si hay defecto seleccionado
    const defectoSeleccionado = defectos?.find(d => d.id.toString() === formData.defectoId);
    const tituloFinal = defectoSeleccionado?.nombre || 'Sin título';
    
    // Generar ID de cliente único para evitar duplicados
    const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const itemData = {
      proyectoId: selectedProjectId || 0,
      empresaId: residenteSeleccionado.empresaId,
      unidadId: parseInt(formData.unidadId),
      especialidadId: residenteSeleccionado.especialidadId || undefined,
      defectoId: formData.defectoId ? parseInt(formData.defectoId) : undefined,
      espacioId: formData.espacioId ? parseInt(formData.espacioId) : undefined,
      titulo: tituloFinal,
      fotoAntesBase64: fotoAntes,
      fotoAntesMarcadaBase64: fotoAntesMarcada || undefined,
      clientId,
    };
    
    try {
      // Crear item directamente sin reintentos complejos
      const result = await createItemMutation.mutateAsync(itemData);
      toast.success("Ítem creado correctamente");
      setLocation(`/items/${result.id}`);
    } catch (error: any) {
      console.error('Error creando item:', error);
      const errorMsg = error.message || "Error al crear el ítem";
      // Sanitizar mensaje de error
      const sanitizedMsg = errorMsg.length > 100 || errorMsg.includes('base64') || errorMsg.includes('data:image') 
        ? "Error al crear el ítem. Intenta de nuevo." 
        : errorMsg;
      toast.error(sanitizedMsg);
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
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-4 overflow-hidden max-h-[400px]">
            {isCapturing ? (
              <div className="flex items-center justify-center h-20 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-[#02B381]" />
                <span className="text-sm text-gray-500">Procesando foto...</span>
              </div>
            ) : fotoAntes ? (
              <div className="space-y-3 overflow-hidden">
                <div className="relative rounded-lg overflow-hidden bg-slate-100">
                  <img
                    src={getImageUrl(fotoAntesMarcada || fotoAntes)}
                    alt="Foto del problema"
                    className="w-full h-auto max-h-[200px] object-contain max-w-full"
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

        {/* PASO 2: Asignación (Residente obligatorio) */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <User className="h-3 w-3" />
              Asignación *
            </div>
            
            {/* Selector de Residente (obligatorio) */}
            <Select
              value={formData.residenteId}
              onValueChange={(value) => setFormData({ ...formData, residenteId: value, defectoId: "" })}
            >
              <SelectTrigger className="h-9 text-xs">
                <User className="h-3 w-3 mr-1 text-gray-400" />
                <SelectValue placeholder="Seleccionar Residente *" />
              </SelectTrigger>
              <SelectContent>
                {residentesConEmpresa.map((residente) => (
                  <SelectItem key={`${residente.id}-${residente.empresaId}`} value={residente.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{residente.name}</span>
                      <span className="text-gray-400 text-[10px]">({residente.empresaNombre})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Mostrar Empresa (solo lectura, auto-completado) */}
            {residenteSeleccionado && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                <Building2 className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-600">{residenteSeleccionado.empresaNombre}</span>
                {especialidadDelResidente && (
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    <Wrench className="h-2 w-2 mr-1" />
                    {especialidadDelResidente.nombre}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PASO 3: Ubicación y Defecto */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <MapPin className="h-3 w-3" />
              Ubicación y Defecto
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {/* Nivel */}
              <Select
                value={formData.nivelId}
                onValueChange={(value) => setFormData({ ...formData, nivelId: value, unidadId: "" })}
              >
                <SelectTrigger className="h-10 text-sm">
                  <Layers className="h-4 w-4 mr-1 text-gray-400" />
                  <SelectValue placeholder="Nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los niveles</SelectItem>
                  {niveles.map((nivel) => (
                    <SelectItem key={nivel} value={nivel?.toString() || ''}>
                      Nivel {nivel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Unidad (obligatorio) */}
              <Select
                value={formData.unidadId}
                onValueChange={(value) => setFormData({ ...formData, unidadId: value })}
              >
                <SelectTrigger className="h-10 text-sm">
                  <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                  <SelectValue placeholder="Unidad *" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((unidad) => (
                    <SelectItem key={unidad.id} value={unidad.id.toString()}>
                      {unidad.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Espacio (opcional) */}
              <Select
                value={formData.espacioId}
                onValueChange={(value) => setFormData({ ...formData, espacioId: value })}
              >
                <SelectTrigger className="h-10 text-sm">
                  <Layers className="h-4 w-4 mr-1 text-gray-400" />
                  <SelectValue placeholder={espaciosPlantilla && espaciosPlantilla.length > 0 ? "Espacio" : "Sin espacios"} />
                </SelectTrigger>
                <SelectContent>
                  {espaciosPlantilla?.map((espacio) => (
                    <SelectItem key={espacio.id} value={espacio.id.toString()}>
                      {espacio.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Defecto (de la especialidad del residente) */}
              <Select
                value={formData.defectoId}
                onValueChange={(value) => setFormData({ ...formData, defectoId: value })}
                disabled={!residenteSeleccionado?.especialidadId || !defectos || defectos.length === 0}
              >
                <SelectTrigger className="h-10 text-sm">
                  <AlertTriangle className="h-4 w-4 mr-1 text-gray-400" />
                  <SelectValue placeholder="Defecto" />
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
            </div>
          </CardContent>
        </Card>

        {/* Botón de crear - Siempre visible */}
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting || !fotoAntes || !formData.residenteId || !formData.unidadId}
          className="w-full h-12 bg-[#02B381] hover:bg-[#02B381]/90 text-white font-semibold"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
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
