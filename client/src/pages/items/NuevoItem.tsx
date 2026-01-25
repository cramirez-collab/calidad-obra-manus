import DashboardLayout from "@/components/DashboardLayout";
import ImageMarker from "@/components/ImageMarker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowRight, 
  Check,
  Pencil,
  Image as ImageIcon
} from "lucide-react";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Step = "info" | "foto" | "marcado" | "confirmar";

export default function NuevoItem() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("info");
  const [formData, setFormData] = useState({
    empresaId: "",
    unidadId: "",
    especialidadId: "",
    atributoId: "",
    titulo: "",
    descripcion: "",
    ubicacionDetalle: "",
    comentarioResidente: "",
  });
  const [fotoAntes, setFotoAntes] = useState<string | null>(null);
  const [fotoAntesMarcada, setFotoAntesMarcada] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { data: empresas } = trpc.empresas.list.useQuery();
  const { data: unidades } = trpc.unidades.list.useQuery();
  const { data: especialidades } = trpc.especialidades.list.useQuery();
  const { data: atributos } = trpc.atributos.list.useQuery();

  const createItemMutation = trpc.items.create.useMutation();
  const uploadFotoMutation = trpc.items.uploadFotoAntes.useMutation();

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
      setStep("marcado");
    };
    reader.readAsDataURL(file);
  };

  const handleMarkedImage = (markedImageBase64: string) => {
    setFotoAntesMarcada(markedImageBase64);
    setStep("confirmar");
  };

  const skipMarking = () => {
    setFotoAntesMarcada(null);
    setStep("confirmar");
  };

  const validateStep = (currentStep: Step): boolean => {
    if (currentStep === "info") {
      if (!formData.empresaId || !formData.unidadId || !formData.especialidadId || !formData.titulo) {
        toast.error("Por favor completa todos los campos requeridos");
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep(step)) return;

    const steps: Step[] = ["info", "foto", "marcado", "confirmar"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: Step[] = ["info", "foto", "marcado", "confirmar"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    if (!fotoAntes) {
      toast.error("Se requiere una foto");
      return;
    }

    setIsSubmitting(true);
    try {
      // Crear el ítem
      const result = await createItemMutation.mutateAsync({
        empresaId: parseInt(formData.empresaId),
        unidadId: parseInt(formData.unidadId),
        especialidadId: parseInt(formData.especialidadId),
        atributoId: formData.atributoId ? parseInt(formData.atributoId) : undefined,
        titulo: formData.titulo,
        descripcion: formData.descripcion || undefined,
        ubicacionDetalle: formData.ubicacionDetalle || undefined,
        comentarioResidente: formData.comentarioResidente || undefined,
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

  const getStepNumber = () => {
    const steps: Step[] = ["info", "foto", "marcado", "confirmar"];
    return steps.indexOf(step) + 1;
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header con progreso */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nuevo Ítem de Calidad</h1>
            <p className="text-muted-foreground">
              Paso {getStepNumber()} de 4
            </p>
          </div>
          <Button variant="ghost" onClick={() => setLocation("/items")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2">
          {["info", "foto", "marcado", "confirmar"].map((s, i) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i < getStepNumber() ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step: Información */}
        {step === "info" && (
          <Card>
            <CardHeader>
              <CardTitle>Información del Ítem</CardTitle>
              <CardDescription>
                Ingresa los datos básicos del problema detectado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="titulo">Título del problema *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ej: Fisura en muro de baño"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                    onValueChange={(value) => setFormData({ ...formData, unidadId: value })}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Especialidad *</Label>
                  <Select
                    value={formData.especialidadId}
                    onValueChange={(value) => setFormData({ ...formData, especialidadId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar especialidad" />
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
                </div>

                <div className="grid gap-2">
                  <Label>Atributo/Tipo</Label>
                  <Select
                    value={formData.atributoId}
                    onValueChange={(value) => setFormData({ ...formData, atributoId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {atributos?.map((attr) => (
                        <SelectItem key={attr.id} value={attr.id.toString()}>
                          {attr.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ubicacion">Ubicación específica</Label>
                <Input
                  id="ubicacion"
                  value={formData.ubicacionDetalle}
                  onChange={(e) => setFormData({ ...formData, ubicacionDetalle: e.target.value })}
                  placeholder="Ej: Muro norte, junto a la ventana"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Describe el problema con más detalle..."
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="comentario">Comentario adicional</Label>
                <Textarea
                  id="comentario"
                  value={formData.comentarioResidente}
                  onChange={(e) => setFormData({ ...formData, comentarioResidente: e.target.value })}
                  placeholder="Notas o comentarios adicionales..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={nextStep}>
                  Siguiente
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Foto */}
        {step === "foto" && (
          <Card>
            <CardHeader>
              <CardTitle>Captura de Foto "Antes"</CardTitle>
              <CardDescription>
                Toma o selecciona una foto del problema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              {fotoAntes ? (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden border">
                    <img
                      src={fotoAntes}
                      alt="Foto antes"
                      className="w-full h-auto max-h-[400px] object-contain bg-slate-100"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFotoAntes(null);
                        setFotoAntesMarcada(null);
                      }}
                    >
                      Cambiar foto
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-32 flex-col gap-2"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-8 w-8" />
                    <span>Tomar Foto</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-32 flex-col gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8" />
                    <span>Subir Imagen</span>
                  </Button>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>
                {fotoAntes && (
                  <Button onClick={nextStep}>
                    Siguiente
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Marcado */}
        {step === "marcado" && fotoAntes && (
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
                  onCancel={() => setStep("foto")}
                />
              </div>
              <div className="p-4 border-t flex justify-between">
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>
                <Button variant="ghost" onClick={skipMarking}>
                  Omitir marcado
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Confirmar */}
        {step === "confirmar" && (
          <Card>
            <CardHeader>
              <CardTitle>Confirmar y Crear</CardTitle>
              <CardDescription>
                Revisa la información antes de crear el ítem
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resumen */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="font-semibold">Información</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Título:</span>
                      <span className="font-medium">{formData.titulo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Empresa:</span>
                      <span>{empresas?.find(e => e.id.toString() === formData.empresaId)?.nombre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unidad:</span>
                      <span>{unidades?.find(u => u.id.toString() === formData.unidadId)?.nombre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Especialidad:</span>
                      <span>{especialidades?.find(e => e.id.toString() === formData.especialidadId)?.nombre}</span>
                    </div>
                    {formData.ubicacionDetalle && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ubicación:</span>
                        <span>{formData.ubicacionDetalle}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">Foto</h3>
                  <div className="rounded-lg overflow-hidden border bg-slate-100">
                    <img
                      src={fotoAntesMarcada || fotoAntes || ""}
                      alt="Foto del problema"
                      className="w-full h-48 object-contain"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fotoAntesMarcada ? "Con marcado" : "Sin marcado"}
                  </p>
                </div>
              </div>

              {formData.descripcion && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Descripción</h3>
                  <p className="text-sm text-muted-foreground">{formData.descripcion}</p>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting}
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
        )}
      </div>
    </DashboardLayout>
  );
}
