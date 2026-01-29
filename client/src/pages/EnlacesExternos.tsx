import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Link2, 
  Activity, 
  ListOrdered, 
  FileSpreadsheet, 
  FolderOpen,
  Save,
  ExternalLink,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";

export default function EnlacesExternos() {
  const { selectedProjectId } = useProject();
  
  // Obtener datos del proyecto seleccionado
  const { data: proyectos, refetch: refetchProyecto } = trpc.proyectos.list.useQuery();
  const proyectoActual = proyectos?.find(p => p.id === selectedProjectId);
  
  const [enlaces, setEnlaces] = useState({
    linkCurvas: "",
    linkSecuencias: "",
    linkVisor: "",
    linkPlanos: "",
  });
  
  const [hasChanges, setHasChanges] = useState(false);

  // Cargar enlaces del proyecto actual
  useEffect(() => {
    if (proyectoActual) {
      setEnlaces({
        linkCurvas: proyectoActual.linkCurvas || "",
        linkSecuencias: proyectoActual.linkSecuencias || "",
        linkVisor: proyectoActual.linkVisor || "",
        linkPlanos: proyectoActual.linkPlanos || "",
      });
      setHasChanges(false);
    }
  }, [proyectoActual]);

  const updateEnlacesMutation = trpc.proyectos.updateEnlaces.useMutation({
    onSuccess: () => {
      toast.success("Enlaces actualizados exitosamente");
      setHasChanges(false);
      refetchProyecto();
    },
    onError: (error) => {
      toast.error("Error al actualizar enlaces: " + error.message);
    },
  });

  const handleChange = (field: keyof typeof enlaces, value: string) => {
    setEnlaces(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!proyectoActual) return;
    
    updateEnlacesMutation.mutate({
      id: proyectoActual.id,
      linkCurvas: enlaces.linkCurvas || null,
      linkSecuencias: enlaces.linkSecuencias || null,
      linkVisor: enlaces.linkVisor || null,
      linkPlanos: enlaces.linkPlanos || null,
    });
  };

  const enlacesConfig = [
    {
      key: "linkCurvas" as const,
      label: "Curvas",
      icon: Activity,
      description: "Enlace a la aplicación de curvas S del proyecto",
      placeholder: "https://ejemplo.com/curvas",
    },
    {
      key: "linkSecuencias" as const,
      label: "Secuencias",
      icon: ListOrdered,
      description: "Enlace a la aplicación de secuencias (AppSheet, etc.)",
      placeholder: "https://www.appsheet.com/...",
    },
    {
      key: "linkVisor" as const,
      label: "Visor",
      icon: FileSpreadsheet,
      description: "Enlace al visor de datos (Google Sheets, etc.)",
      placeholder: "https://docs.google.com/spreadsheets/...",
    },
    {
      key: "linkPlanos" as const,
      label: "Planos",
      icon: FolderOpen,
      description: "Enlace a la carpeta de planos (Google Drive, etc.)",
      placeholder: "https://drive.google.com/...",
    },
  ];

  if (!proyectoActual) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <p>Selecciona un proyecto para configurar sus enlaces externos.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Link2 className="h-6 w-6 text-primary" />
              Enlaces Externos
            </h1>
            <p className="text-muted-foreground mt-1">
              Configura los enlaces externos para el proyecto <strong>{proyectoActual.nombre}</strong>
            </p>
          </div>
          
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || updateEnlacesMutation.isPending}
          >
            {updateEnlacesMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar Cambios
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Enlaces del Menú</CardTitle>
            <CardDescription>
              Estos enlaces aparecerán en el menú lateral cuando estén configurados. 
              Si un enlace está vacío, el icono correspondiente no se mostrará en el menú.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {enlacesConfig.map(({ key, label, icon: Icon, description, placeholder }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </Label>
                <p className="text-sm text-muted-foreground">{description}</p>
                <div className="flex gap-2">
                  <Input
                    id={key}
                    type="url"
                    placeholder={placeholder}
                    value={enlaces[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="flex-1"
                  />
                  {enlaces[key] && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(enlaces[key], '_blank')}
                      title="Abrir enlace"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Información:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Los enlaces configurados aquí son específicos para este proyecto.</li>
              <li>Si un enlace está vacío, el icono no aparecerá en el menú.</li>
              <li>Los enlaces se abren en una nueva pestaña del navegador.</li>
              <li>Puedes usar enlaces de Google Drive, Google Sheets, AppSheet, o cualquier URL válida.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
