import { useProject } from "@/contexts/ProjectContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

export function ProjectSelector({ collapsed = false }: { collapsed?: boolean }) {
  const { selectedProjectId, setSelectedProjectId, userProjects, isLoadingProjects } = useProject();

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
    <div className="px-2 py-2">
      <Select
        value={selectedProjectId?.toString() || ""}
        onValueChange={(value) => setSelectedProjectId(parseInt(value, 10))}
      >
        <SelectTrigger className="h-9 text-xs bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <SelectValue placeholder="Seleccionar proyecto">
              <span className="truncate">
                {selectedProject ? getProjectName(selectedProject) : "Proyecto"}
              </span>
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent>
          {userProjects.map((proyecto) => {
            const projectId = getProjectId(proyecto);
            if (!projectId) return null;
            return (
              <SelectItem key={projectId} value={projectId.toString()}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{getProjectName(proyecto)}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

// Hook para usar el proyecto seleccionado (re-exportado para compatibilidad)
export { useProject as useSelectedProject } from "@/contexts/ProjectContext";

export default ProjectSelector;
