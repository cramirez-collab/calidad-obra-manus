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
  AlertCircle,
  BookOpen,
  FileText,
  Pencil
} from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";

export default function EnlacesExternos() {
  const { selectedProjectId } = useProject();
  
  // Obtener datos del proyecto seleccionado
  const { data: proyectos, refetch: refetchProyecto } = trpc.proyectos.list.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const proyectoActual = proyectos?.find(p => p.id === selectedProjectId);
  
  const [enlaces, setEnlaces] = useState({
    linkCurvas: "",
    linkSecuencias: "",
    linkVisor: "",
    linkPlanos: "",
    linkManuales: "",
    linkEspecificaciones: "",
  });
  
  const [titulos, setTitulos] = useState({
    tituloCurvas: "",
    tituloSecuencias: "",
    tituloVisor: "",
    tituloPlanos: "",
    tituloManuales: "",
    tituloEspecificaciones: "",
  });
  
  const [hasChanges, setHasChanges] = useState(false);

  // Cargar enlaces y títulos del proyecto actual
  useEffect(() => {
    if (proyectoActual) {
      setEnlaces({
        linkCurvas: proyectoActual.linkCurvas || "",
        linkSecuencias: proyectoActual.linkSecuencias || "",
        linkVisor: proyectoActual.linkVisor || "",
        linkPlanos: proyectoActual.linkPlanos || "",
        linkManuales: proyectoActual.linkManuales || "",
        linkEspecificaciones: proyectoActual.linkEspecificaciones || "",
      });
      setTitulos({
        tituloCurvas: (proyectoActual as any).tituloCurvas || "",
        tituloSecuencias: (proyectoActual as any).tituloSecuencias || "",
        tituloVisor: (proyectoActual as any).tituloVisor || "",
        tituloPlanos: (proyectoActual as any).tituloPlanos || "",
        tituloManuales: (proyectoActual as any).tituloManuales || "",
        tituloEspecificaciones: (proyectoActual as any).tituloEspecificaciones || "",
      });
      setHasChanges(false);
    }
  }, [proyectoActual]);

  const updateEnlacesMutation = trpc.proyectos.updateEnlaces.useMutation({
    onSuccess: () => {
      toast.success("Enlaces y títulos actualizados exitosamente");
      setHasChanges(false);
      refetchProyecto();
    },
    onError: (error) => {
      toast.error("Error al actualizar: " + error.message);
    },
  });

  const handleEnlaceChange = (field: keyof typeof enlaces, value: string) => {
    setEnlaces(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleTituloChange = (field: keyof typeof titulos, value: string) => {
    setTitulos(prev => ({ ...prev, [field]: value }));
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
      linkManuales: enlaces.linkManuales || null,
      linkEspecificaciones: enlaces.linkEspecificaciones || null,
      tituloCurvas: titulos.tituloCurvas || null,
      tituloSecuencias: titulos.tituloSecuencias || null,
      tituloVisor: titulos.tituloVisor || null,
      tituloPlanos: titulos.tituloPlanos || null,
      tituloManuales: titulos.tituloManuales || null,
      tituloEspecificaciones: titulos.tituloEspecificaciones || null,
    });
  };

  const enlacesConfig = [
    {
      linkKey: "linkCurvas" as const,
      tituloKey: "tituloCurvas" as const,
      defaultLabel: "Curvas",
      icon: Activity,
      description: "Enlace a la aplicación de curvas S del proyecto",
      placeholder: "https://ejemplo.com/curvas",
    },
    {
      linkKey: "linkSecuencias" as const,
      tituloKey: "tituloSecuencias" as const,
      defaultLabel: "Secuencias",
      icon: ListOrdered,
      description: "Enlace a la aplicación de secuencias (AppSheet, etc.)",
      placeholder: "https://www.appsheet.com/...",
    },
    {
      linkKey: "linkVisor" as const,
      tituloKey: "tituloVisor" as const,
      defaultLabel: "Visor",
      icon: FileSpreadsheet,
      description: "Enlace al visor de datos (Google Sheets, etc.)",
      placeholder: "https://docs.google.com/spreadsheets/...",
    },
    {
      linkKey: "linkPlanos" as const,
      tituloKey: "tituloPlanos" as const,
      defaultLabel: "Planos",
      icon: FolderOpen,
      description: "Enlace a la carpeta de planos (Google Drive, etc.)",
      placeholder: "https://drive.google.com/...",
    },
    {
      linkKey: "linkManuales" as const,
      tituloKey: "tituloManuales" as const,
      defaultLabel: "Manuales",
      icon: BookOpen,
      description: "Enlace a manuales de instalación o procedimientos",
      placeholder: "https://drive.google.com/...",
    },
    {
      linkKey: "linkEspecificaciones" as const,
      tituloKey: "tituloEspecificaciones" as const,
      defaultLabel: "Especificaciones",
      icon: FileText,
      description: "Enlace a especificaciones técnicas del proyecto",
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
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
              Puedes personalizar el título de cada enlace o dejar el valor por defecto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {enlacesConfig.map(({ linkKey, tituloKey, defaultLabel, icon: Icon, description, placeholder }) => (
              <div key={linkKey} className="space-y-3 pb-6 border-b last:border-b-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{titulos[tituloKey] || defaultLabel}</span>
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
                
                {/* Campo de título editable */}
                <div className="space-y-1">
                  <Label htmlFor={`titulo-${linkKey}`} className="text-xs flex items-center gap-1 text-muted-foreground">
                    <Pencil className="h-3 w-3" />
                    Título personalizado (opcional)
                  </Label>
                  <Input
                    id={`titulo-${linkKey}`}
                    type="text"
                    placeholder={defaultLabel}
                    value={titulos[tituloKey]}
                    onChange={(e) => handleTituloChange(tituloKey, e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                
                {/* Campo de URL */}
                <div className="space-y-1">
                  <Label htmlFor={linkKey} className="text-xs text-muted-foreground">
                    URL del enlace
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={linkKey}
                      type="url"
                      placeholder={placeholder}
                      value={enlaces[linkKey]}
                      onChange={(e) => handleEnlaceChange(linkKey, e.target.value)}
                      className="flex-1"
                    />
                    {enlaces[linkKey] && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => window.open(enlaces[linkKey], '_blank')}
                        title="Abrir enlace"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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
              <li>Puedes personalizar el título que aparece en el menú para cada enlace.</li>
              <li>Los enlaces se abren en una nueva pestaña del navegador.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
