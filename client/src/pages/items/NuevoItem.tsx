import DashboardLayout from "@/components/DashboardLayout";
import ImageMarker from "@/components/ImageMarker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  X
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useProject } from "@/contexts/ProjectContext";

export default function NuevoItem() {
  const [, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  const [formData, setFormData] = useState({
    empresaId: "",
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Obtener datos filtrados por proyecto desde el backend
  const { data: empresas } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: unidades } = trpc.unidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
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

  const handleSubmit = async () => {
    // Validación mínima
    if (!formData.empresaId || !formData.unidadId || !formData.titulo) {
      toast.error("Por favor completa: Empresa, Unidad y Título");
      return;
    }

    if (!fotoAntes) {
      toast.error("Se requiere una foto");
      return;
    }

    setIsSubmitting(true);
    try {
      // Crear el ítem
      const result = await createItemMutation.mutateAsync({
        proyectoId: selectedProjectId || 0,
        empresaId: parseInt(formData.empresaId),
        unidadId: parseInt(formData.unidadId),
        especialidadId: formData.especialidadId ? parseInt(formData.especialidadId) : undefined,
        defectoId: formData.defectoId ? parseInt(formData.defectoId) : undefined,
        espacioId: formData.espacioId ? parseInt(formData.espacioId) : undefined,
        titulo: formData.titulo,
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
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-red-500" />
                Marcar Problema
              </CardTitle>
              <CardDescription>
                Usa el lápiz rojo para señalar el área del problema
              </CardDescription>
            </CardHeader>
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
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nuevo Ítem de Calidad</h1>
            <p className="text-muted-foreground">
              Registra un problema detectado
            </p>
          </div>
          <Button variant="ghost" onClick={() => setLocation("/items")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
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

            {/* Título */}
            <div className="grid gap-2">
              <Label htmlFor="titulo">Título del problema *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ej: Fisura en muro de baño"
              />
            </div>

            {/* Empresa y Unidad */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Empresa *</Label>
                <Select
                  value={formData.empresaId}
                  onValueChange={(value) => setFormData({ ...formData, empresaId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas?.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id.toString()}>
                        {empresa.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Unidad *</Label>
                <Select
                  value={formData.unidadId}
                  onValueChange={(value) => setFormData({ ...formData, unidadId: value, espacioId: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades?.map((unidad) => (
                      <SelectItem key={unidad.id} value={unidad.id.toString()}>
                        {unidad.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Especialidad y Defecto (cascada) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Especialidad</Label>
                <Select
                  value={formData.especialidadId}
                  onValueChange={(value) => setFormData({ ...formData, especialidadId: value, defectoId: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auto o seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {especialidades?.map((esp) => (
                      <SelectItem key={esp.id} value={esp.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: esp.color || "#3B82F6" }}
                          />
                          {esp.nombre}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Se selecciona automáticamente según la empresa
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Tipo de Defecto</Label>
                <Select
                  value={formData.defectoId}
                  onValueChange={(value) => setFormData({ ...formData, defectoId: value })}
                  disabled={!formData.especialidadId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.especialidadId ? "Seleccionar defecto" : "Selecciona especialidad"} />
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
            </div>

            {/* Espacio */}
            <div className="grid gap-2">
              <Label>Espacio</Label>
              <Select
                value={formData.espacioId}
                onValueChange={(value) => setFormData({ ...formData, espacioId: value })}
                disabled={!formData.unidadId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.unidadId ? "Seleccionar espacio" : "Selecciona unidad primero"} />
                </SelectTrigger>
                <SelectContent>
                  {espacios?.map((espacio) => (
                    <SelectItem key={espacio.id} value={espacio.id.toString()}>
                      {espacio.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sala, Cocina, Recámara, Baño, etc.
              </p>
            </div>

            {/* Foto */}
            <div className="grid gap-2">
              <Label>Foto del problema *</Label>
              {fotoAntes ? (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden border bg-slate-100">
                    <img
                      src={fotoAntesMarcada || fotoAntes}
                      alt="Foto del problema"
                      className="w-full h-auto max-h-[300px] object-contain"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={() => {
                        setFotoAntes(null);
                        setFotoAntesMarcada(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMarker(true)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      {fotoAntesMarcada ? "Editar marcado" : "Marcar problema"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Cambiar foto
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-24 flex-col gap-2"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-6 w-6" />
                    <span className="text-sm">Tomar Foto</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 flex-col gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-6 w-6" />
                    <span className="text-sm">Subir Imagen</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Botón de crear */}
            <div className="flex justify-end pt-4 border-t">
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !fotoAntes || !formData.titulo || !formData.empresaId || !formData.unidadId}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isSubmitting ? (
                  "Creando..."
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Crear Ítem
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
