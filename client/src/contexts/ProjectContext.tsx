import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const PROJECT_KEY = "selected-project-id";

interface ProjectContextType {
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
  userProjects: any[];
  isLoadingProjects: boolean;
  canAccessProject: (projectId: number) => boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem(PROJECT_KEY);
    return saved ? parseInt(saved, 10) : null;
  });

  // Obtener proyectos según el rol del usuario
  const isSuperadmin = user?.role === "superadmin";
  
  // Superadmin ve todos los proyectos, otros usuarios solo los asignados
  const { data: allProjects, isLoading: isLoadingAll } = trpc.proyectos.list.useQuery(
    undefined,
    { enabled: isSuperadmin }
  );
  
  const { data: userProjectsData, isLoading: isLoadingUser } = trpc.proyectos.misProyectos.useQuery(
    undefined,
    { enabled: !isSuperadmin && !!user }
  );

  const userProjects = isSuperadmin ? (allProjects || []) : (userProjectsData || []);
  const isLoadingProjects = isSuperadmin ? isLoadingAll : isLoadingUser;

  // Función auxiliar para obtener el ID del proyecto
  const getProjectId = (p: any): number | null => {
    if (p.id) return p.id;
    if (p.proyecto?.id) return p.proyecto.id;
    return null;
  };

  // Auto-seleccionar el primer proyecto si no hay ninguno seleccionado
  useEffect(() => {
    if (!selectedProjectId && userProjects.length > 0) {
      const firstProject = userProjects[0];
      const projectId = getProjectId(firstProject);
      if (projectId) {
        setSelectedProjectIdState(projectId);
        localStorage.setItem(PROJECT_KEY, projectId.toString());
      }
    }
  }, [userProjects, selectedProjectId]);

  // Verificar que el proyecto seleccionado esté en la lista de proyectos del usuario
  useEffect(() => {
    if (selectedProjectId && userProjects.length > 0) {
      const hasAccess = userProjects.some(p => getProjectId(p) === selectedProjectId);
      if (!hasAccess && !isSuperadmin) {
        // Si no tiene acceso, seleccionar el primero disponible
        const firstProject = userProjects[0];
        const projectId = getProjectId(firstProject);
        if (projectId) {
          setSelectedProjectIdState(projectId);
          localStorage.setItem(PROJECT_KEY, projectId.toString());
        }
      }
    }
  }, [selectedProjectId, userProjects, isSuperadmin]);

  const setSelectedProjectId = (id: number | null) => {
    setSelectedProjectIdState(id);
    if (id) {
      localStorage.setItem(PROJECT_KEY, id.toString());
    } else {
      localStorage.removeItem(PROJECT_KEY);
    }
  };

  const canAccessProject = (projectId: number): boolean => {
    if (isSuperadmin) return true;
    return userProjects.some(p => getProjectId(p) === projectId);
  };

  return (
    <ProjectContext.Provider
      value={{
        selectedProjectId,
        setSelectedProjectId,
        userProjects,
        isLoadingProjects,
        canAccessProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

export default ProjectContext;
