import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, ChevronDown } from "lucide-react";

const PROJECT_KEY = "selected-project-id";

export function useSelectedProject() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem(PROJECT_KEY);
    return saved ? parseInt(saved, 10) : null;
  });

  const setProject = (id: number | null) => {
    setSelectedProjectId(id);
    if (id) {
      localStorage.setItem(PROJECT_KEY, id.toString());
    } else {
      localStorage.removeItem(PROJECT_KEY);
    }
  };

  return { selectedProjectId, setProject };
}

export function ProjectSelector({ collapsed = false }: { collapsed?: boolean }) {
  const { selectedProjectId, setProject } = useSelectedProject();
  const { data: proyectos, isLoading } = trpc.proyectos.list.useQuery();

  // Auto-seleccionar el primer proyecto si no hay ninguno seleccionado
  useEffect(() => {
    if (!selectedProjectId && proyectos && proyectos.length > 0) {
      setProject(proyectos[0].id);
    }
  }, [proyectos, selectedProjectId]);

  const selectedProject = proyectos?.find(p => p.id === selectedProjectId);

  if (isLoading) {
    return (
      <div className="px-2 py-2">
        <div className="h-9 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (!proyectos || proyectos.length === 0) {
    return null;
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
        onValueChange={(value) => setProject(parseInt(value, 10))}
      >
        <SelectTrigger className="h-9 text-xs bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <SelectValue placeholder="Seleccionar proyecto">
              <span className="truncate">{selectedProject?.nombre || "Proyecto"}</span>
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent>
          {proyectos.map((proyecto) => (
            <SelectItem key={proyecto.id} value={proyecto.id.toString()}>
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{proyecto.nombre}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default ProjectSelector;
