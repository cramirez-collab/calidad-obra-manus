import DashboardLayout from "@/components/DashboardLayout";
import ImageMarker from "@/components/ImageMarker";
import ResidenteSelector from "@/components/ResidenteSelector";
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
  Loader2,
  Trash
} from "lucide-react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";
import { savePendingAction, isOnline } from "@/lib/offlineStorage";
import { compressAdaptive, getConnectionInfo } from "@/lib/imageCompression";
import ZoomablePlano from "@/components/ZoomablePlano";

export default function NuevoItem() {
  const [location, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  
  // Obtener código QR preasignado de la URL (si viene de escanear etiqueta nueva)
  const qrPreasignado = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('qr') || null;
  }, [location]);
  
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
  // Pin sobre plano
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinPos, setPinPos] = useState<{ x: number; y: number } | null>(null);
  const pinImgRef = useRef<HTMLImageElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Catálogos con staleTime alto (5min) - no refetch innecesarios
  const catStale = { staleTime: 5 * 60 * 1000 };
  const { data: todasEmpresas } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId, ...catStale }
  );
  const { data: residentesConEmpresasNuevo } = trpc.empresas.getAllResidentesConEmpresas.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId, ...catStale }
  );
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId, ...catStale }
  );
  
  // Crear lista de residentes únicos que tienen empresa asignada
  const residentesConEmpresa = useMemo(() => {
    if (!residentesConEmpresasNuevo) return [];
    
    const residentesMap = new Map<number, { id: number; name: string; empresaId: number; empresaNombre: string; especialidadId: number | null; especialidadNombre?: string | null; tipoResidente?: string }>();
    
    // Fuente: getAllResidentesConEmpresas (protectedProcedure, accesible por todos los roles)
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
            especialidadNombre: emp.especialidadNombre || null,
            tipoResidente: emp.tipoResidente
          });
        }
      });
    });
    
    return Array.from(residentesMap.values());
  }, [residentesConEmpresasNuevo]);
  
  // Obtener datos del residente seleccionado
  const residenteSeleccionado = useMemo(() => {
    if (!formData.residenteId) return null;
    return residentesConEmpresa.find(r => r.id.toString() === formData.residenteId);
  }, [formData.residenteId, residentesConEmpresa]);
  
  // Obtener especialidad del residente seleccionado
  const especialidadDelResidente = useMemo(() => {
    if (!residenteSeleccionado?.especialidadId || !especialidades) return null;
    return especialidades.find(e => e.id === residenteSeleccionado.especialidadId);
  }, [residenteSeleccionado, especialidades]);
  
  // Obtener unidades del proyecto
  const { data: todasUnidades } = trpc.unidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId, staleTime: 5 * 60 * 1000 }
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
    { enabled: !!selectedProjectId, staleTime: 5 * 60 * 1000 }
  );
  
  // Defectos filtrados por especialidad
  const especialidadIdParaDefectos = residenteSeleccionado?.especialidadId || (formData.especialidadId ? parseInt(formData.especialidadId) : 0);
  const { data: defectos } = trpc.defectos.byEspecialidad.useQuery(
    { especialidadId: especialidadIdParaDefectos },
    { enabled: !!especialidadIdParaDefectos, staleTime: 5 * 60 * 1000 }
  );

  const createItemMutation = trpc.items.create.useMutation();

  // Planos del proyecto para mostrar thumbnail al seleccionar nivel
  const { data: planosData } = trpc.planos.listar.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId, staleTime: 5 * 60 * 1000 }
  );

  // Plano que corresponde al nivel seleccionado
  const planoDelNivel = useMemo(() => {
    if (!planosData || !formData.nivelId) return null;
    const nivelNum = parseInt(formData.nivelId);
    return (planosData as any[]).find((p: any) => p.nivel === nivelNum) || null;
  }, [planosData, formData.nivelId]);

  // Función para guardar ítem offline
  const saveItemOffline = useCallback(async (itemData: any) => {
    try {
      console.log('[NuevoItem] Guardando ítem offline...');
      await savePendingAction({
        type: 'create_item',
        data: itemData,
      });
      toast.success("Ítem guardado localmente. Se sincronizará cuando haya conexión.", {
        duration: 5000,
        icon: '📡',
      });
      // Limpiar formulario y volver a la lista
      setFotoAntes(null);
      setFotoAntesMarcada(null);
      setFormData({
        residenteId: "",
        empresaId: "",
        nivelId: "",
        unidadId: "",
        especialidadId: "",
        defectoId: "",
        espacioId: "",
      });
      setLocation("/items");
    } catch (offlineError) {
      console.error('[NuevoItem] Error guardando offline:', offlineError);
      toast.error("Error al guardar localmente. Intenta de nuevo.");
    }
  }, [setLocation]);

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

  // Estado para mostrar información de conexión
  const [connectionInfo, setConnectionInfo] = useState<{ label: string; maxSizeKB: number } | null>(null);

  // Función para comprimir imagen ADAPTATIVAMENTE según velocidad de conexión
  // 3G: 150KB, 4G: 250KB, WiFi: 400KB
  const compressImage = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          
          // Usar compresión adaptativa según velocidad de conexión
          const result = await compressAdaptive(base64);
          
          // Actualizar info de conexión para mostrar al usuario
          setConnectionInfo({
            label: result.connectionLabel,
            maxSizeKB: result.targetSizeKB
          });
          
          console.log(`[Compresión Adaptativa] Conexión: ${result.connectionLabel}, Original: ${result.originalSizeKB}KB → Final: ${result.compressedSizeKB}KB (objetivo: ${result.targetSizeKB}KB)`);
          resolve(result.compressed);
        } catch (err) {
          reject(err);
        }
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
      // Código QR preasignado (si viene de escanear etiqueta nueva)
      codigoQrPreasignado: qrPreasignado || undefined,
      // Pin de ubicación en plano
      pinPlanoId: planoDelNivel?.id || undefined,
      pinPosX: pinPos?.x?.toFixed(4) || undefined,
      pinPosY: pinPos?.y?.toFixed(4) || undefined,
    };
    
    console.log('[NuevoItem] Iniciando creación de ítem...', {
      proyectoId: itemData.proyectoId,
      empresaId: itemData.empresaId,
      unidadId: itemData.unidadId,
      titulo: itemData.titulo,
      tieneFoto: !!itemData.fotoAntesBase64,
      tieneFotoMarcada: !!itemData.fotoAntesMarcadaBase64,
      clientId: itemData.clientId,
      online: isOnline(),
    });
    
    // ESTRATEGIA: Siempre intentar guardar, con reintentos automáticos
    const maxRetries = 3;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (isOnline()) {
          // CON INTERNET: Crear directo en servidor
          // Intento silencioso
          const result = await createItemMutation.mutateAsync(itemData);
          console.log('[NuevoItem] Ítem creado exitosamente:', result);
          toast.success("Ítem creado correctamente");
          setLocation(`/items/${result.id}`);
          return;
        } else {
          // SIN INTERNET: Guardar offline directamente
          await savePendingAction({
            type: 'create_item',
            data: itemData,
          });
          console.log('[NuevoItem] Ítem guardado offline');
          toast.success("Ítem guardado. Se sincronizará automáticamente.", {
            duration: 4000,
            icon: '📡',
          });
          setLocation("/items");
          return;
        }
      } catch (error: any) {
        lastError = error;
        // Error silencioso, reintentando...
        
        // Si es el último intento, guardar offline como respaldo
        if (attempt === maxRetries) {
          try {
            await savePendingAction({
              type: 'create_item',
              data: itemData,
            });
            toast.success("Ítem guardado localmente. Se sincronizará cuando mejore la conexión.", {
              duration: 5000,
              icon: '📡',
            });
            setLocation("/items");
            return;
          } catch (offlineError) {
            console.error('[NuevoItem] Error guardando offline:', offlineError);
          }
        } else {
          // Esperar antes del siguiente intento (backoff exponencial)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    console.error('[NuevoItem] Todos los intentos fallaron:', lastError);
    toast.error("Error de conexión. El ítem se guardó localmente y se sincronizará después.");
    setIsSubmitting(false);
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
          {/* Indicador de conexión */}
          {connectionInfo && (
            <Badge variant="outline" className="text-xs">
              📶 {connectionInfo.label} ({connectionInfo.maxSizeKB}KB)
            </Badge>
          )}
        </div>
        
        {/* Indicador de QR preasignado */}
        {qrPreasignado && (
          <Card className="border-[#02B381] bg-[#02B381]/5">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#02B381]/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-[#02B381]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#02B381]">Etiqueta QR Preasignada</p>
                <p className="text-xs text-muted-foreground font-mono">{qrPreasignado}</p>
              </div>
            </CardContent>
          </Card>
        )}

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
                        {/* Selector de Residente (obligatorio) - Usa Drawer para móvil/tablet */}
            <ResidenteSelector
              value={formData.residenteId}
              onValueChange={(value) => setFormData({ ...formData, residenteId: value, defectoId: "" })}
              residentes={residentesConEmpresa}
              placeholder="Seleccionar Residente *"
            />
            
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

            {/* Thumbnail de plano del nivel seleccionado */}
            {planoDelNivel && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <MapPin className="h-3 w-3" />
                  Ubicar en plano
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(true)}
                    className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-100 border-2 border-dashed border-slate-300 hover:border-emerald-500 transition-colors flex-shrink-0 group"
                  >
                    <img src={planoDelNivel.imagenUrl} alt={planoDelNivel.nombre} className="w-full h-full object-cover" />
                    {pinPos && (
                      <div className="absolute" style={{ left: `${pinPos.x}%`, top: `${pinPos.y}%`, transform: 'translate(-50%, -100%)' }}>
                        <svg width="12" height="16" viewBox="0 0 28 36" fill="none">
                          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="#ef4444" stroke="#dc2626" strokeWidth="2"/>
                          <circle cx="14" cy="13" r="5" fill="white" fillOpacity="0.9"/>
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow-lg transition-opacity" />
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700">{planoDelNivel.nombre}</p>
                    <p className="text-[10px] text-slate-500">Nivel {planoDelNivel.nivel}</p>
                    {pinPos ? (
                      <div className="flex items-center gap-1 mt-1">
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">Pin colocado</Badge>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setPinPos(null); }} className="text-[10px] text-red-500 hover:text-red-700 underline">Quitar</button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-emerald-600 mt-1 font-medium">Toca para marcar ubicación</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal para colocar pin sobre plano */}
        {showPinModal && planoDelNivel && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-black/80 text-white">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPinModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <span className="font-semibold text-sm">{planoDelNivel.nombre}</span>
                  <span className="text-xs text-white/60 block">Toca para colocar el pin de ubicación</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {pinPos && (
                  <button
                    onClick={() => setPinPos(null)}
                    className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors group relative"
                    title="Quitar pin"
                  >
                    <Trash className="w-4 h-4" />
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Quitar</span>
                  </button>
                )}
                <button
                  onClick={() => setShowPinModal(false)}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors group relative"
                  title={pinPos ? 'Confirmar' : 'Cerrar'}
                >
                  {pinPos ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{pinPos ? 'Confirmar' : 'Cerrar'}</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex items-center justify-center p-2">
              <ZoomablePlano
                imagenUrl={planoDelNivel.imagenUrl}
                nombre={planoDelNivel.nombre}
                editingPin={true}
                pinX={pinPos?.x}
                pinY={pinPos?.y}
                pinColor="red"
                onPinPlace={(x: number, y: number) => setPinPos({ x, y })}
                imgRef={pinImgRef}
                className="w-full h-full flex items-center justify-center"
              />
            </div>
          </div>
        )}

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
