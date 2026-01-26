import React from 'react';
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

  const handleProjectChange = (value: string) => {
    const projectId = parseInt(value, 10);
    if (!isNaN(projectId)) {
      setSelectedProjectId(projectId);
    }
  };

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
        onValueChange={handleProjectChange}
      >
        <SelectTrigger className="h-9 text-xs bg-primary/5 border-primary/20 hover:bg-primary/10">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <SelectValue placeholder="Seleccionar proyecto" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {userProjects.map((project) => {
            const id = getProjectId(project);
            const name = getProjectName(project);
            if (id === null) return null;
            return (
              <SelectItem key={id} value={id.toString()}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span>{name}</span>
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
