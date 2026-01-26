import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  ArrowLeft,
  Building2, 
  MapPin, 
  FileText,
  ImagePlus,
  Upload,
  Loader2,
  Save
} from "lucide-react";

export default function NuevoProyecto() {
  const [, navigate] = useLocation();
  const [formData, setFormData] = useState({
    nombre: "",
    nombreReporte: "",
    codigo: "",
    descripcion: "",
    direccion: "",
    cliente: "",
    imagenPortadaUrl: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  const createMutation = trpc.proyectos.create.useMutation({
    onSuccess: () => {
      toast.success("Proyecto creado exitosamente");
      navigate("/seleccionar-proyecto");
    },
    onError: (error) => {
      toast.error("Error al crear proyecto: " + error.message);
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5MB');
      return;
    }
    
    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setFormData(prev => ({ ...prev, imagenPortadaUrl: base64 }));
        toast.success('Imagen cargada correctamente');
        setUploadingImage(false);
      };
      reader.onerror = () => {
        toast.error('Error al leer la imagen');
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Error al cargar la imagen');
      console.error(error);
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      toast.error("El nombre del proyecto es requerido");
      return;
    }
    
    createMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/seleccionar-proyecto")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <img src="/logo-objetiva.jpg" alt="Objetiva" className="h-10" />
            <span className="text-xl font-bold text-slate-800">ObjetivaOQC</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Crear Nuevo Proyecto
              </CardTitle>
              <CardDescription>
                Configura los datos básicos del nuevo proyecto de obra
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Imagen de Portada */}
                <div className="space-y-2">
                  <Label>Imagen de Portada</Label>
                  <div className="flex items-center gap-4">
                    {formData.imagenPortadaUrl ? (
                      <div className="relative w-32 h-20 rounded-lg overflow-hidden border">
                        <img 
                          src={formData.imagenPortadaUrl} 
                          alt="Portada" 
                          className="w-full h-full object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => setFormData(prev => ({ ...prev, imagenPortadaUrl: "" }))}
                        >
                          ×
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-32 h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                        />
                        {uploadingImage ? (
                          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        ) : (
                          <>
                            <ImagePlus className="h-6 w-6 text-slate-400" />
                            <span className="text-xs text-slate-500 mt-1">Subir imagen</span>
                          </>
                        )}
                      </label>
                    )}
                    <p className="text-xs text-slate-500">
                      Imagen opcional para identificar el proyecto. Máximo 5MB.
                    </p>
                  </div>
                </div>

                {/* Nombre y Código */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre del Proyecto *</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Ej: Torre Residencial Norte"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                      placeholder="Ej: TRN-001"
                    />
                  </div>
                </div>

                {/* Nombre para Reportes */}
                <div className="space-y-2">
                  <Label htmlFor="nombreReporte">Nombre para Reportes</Label>
                  <Input
                    id="nombreReporte"
                    value={formData.nombreReporte}
                    onChange={(e) => setFormData({ ...formData, nombreReporte: e.target.value })}
                    placeholder="Nombre que aparecerá en los reportes PDF"
                  />
                  <p className="text-xs text-slate-500">
                    Si se deja vacío, se usará el nombre del proyecto
                  </p>
                </div>

                {/* Cliente */}
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente / Desarrollador</Label>
                  <Input
                    id="cliente"
                    value={formData.cliente}
                    onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                    placeholder="Nombre del cliente o desarrollador"
                  />
                </div>

                {/* Dirección */}
                <div className="space-y-2">
                  <Label htmlFor="direccion" className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Dirección
                  </Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    placeholder="Dirección del proyecto"
                  />
                </div>

                {/* Descripción */}
                <div className="space-y-2">
                  <Label htmlFor="descripcion" className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    Descripción
                  </Label>
                  <Textarea
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Descripción general del proyecto..."
                    rows={3}
                  />
                </div>

                {/* Botones */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/seleccionar-proyecto")}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || !formData.nombre.trim()}
                    className="flex-1 gap-2"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Crear Proyecto
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
