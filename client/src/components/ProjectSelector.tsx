import { useProject } from "@/contexts/ProjectContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeftRight } from "lucide-react";
import { useLocation } from "wouter";

export function ProjectSelector({ collapsed = false }: { collapsed?: boolean }) {
  const { selectedProjectId, setSelectedProjectId, userProjects, isLoadingProjects } = useProject();
  const [, navigate] = useLocation();

  const handleChangeProject = () => {
    navigate("/seleccionar-proyecto");
  };

  // Obtener el nombre del proyecto seleccionado
  const getProjectName = (p: any): string => {
    if (p.nombre) return p.nombre;
    if (p.proyecto?.nombre) return p.proyecto.nombre;
    return "Proyecto";
  };

  const getProjectId = (p: any): number | null => {
    if (p.id) return p.id;
    if (p.proyecto?.id) return p.proyecto.id;
    return null;
  };

  const selectedProject = userProjects.find(p => getProjectId(p) === selectedProjectId);

  if (isLoadingProjects) {
    return (
      <div className="px-2 py-2">
        <div className="h-9 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (!userProjects || userProjects.length === 0) {
    return (
      <div className="px-2 py-2">
        <div className="h-9 flex items-center justify-center text-xs text-muted-foreground">
          Sin proyectos asignados
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="px-2 py-2 flex justify-center">
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 py-2 space-y-2">
      {/* Proyecto actual */}
      <div 
        className="h-9 px-3 text-xs bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors rounded-md flex items-center gap-2 cursor-pointer"
        onClick={handleChangeProject}
        title="Click para cambiar de proyecto"
      >
        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="truncate flex-1 font-medium">
          {selectedProject ? getProjectName(selectedProject) : "Proyecto"}
        </span>
        <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  );
}

// Hook para usar el proyecto seleccionado (re-exportado para compatibilidad)
export { useProject as useSelectedProject } from "@/contexts/ProjectContext";

export default ProjectSelector;
