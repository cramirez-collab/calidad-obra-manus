import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface ProjectContextType {
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
  userProjects: any[];
  isLoadingProjects: boolean;
  canAccessProject: (projectId: number) => boolean;
  isChangingProject: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(null);
  const [isChangingProject, setIsChangingProject] = useState(false);
  const utils = trpc.useUtils();

  // Obtener proyecto activo desde la base de datos
  const { data: proyectoActivoData, isLoading: isLoadingProyectoActivo } = trpc.users.getProyectoActivo.useQuery(
    undefined,
    { enabled: !!user, staleTime: 5 * 60 * 1000 } // Cache por 5 minutos
  );

  // Mutation para cambiar proyecto activo
  const setProyectoActivoMutation = trpc.users.setProyectoActivo.useMutation({
    onSuccess: (data) => {
      setSelectedProjectIdState(data.proyectoId);
      setIsChangingProject(false);
      // Invalidar todas las queries para refrescar datos del nuevo proyecto
      utils.invalidate();
    },
    onError: () => {
      setIsChangingProject(false);
    }
  });

  // Obtener proyectos según el rol del usuario
  const isSuperadmin = user?.role === "superadmin";
  
  // Superadmin ve todos los proyectos, otros usuarios solo los asignados
  const { data: allProjects, isLoading: isLoadingAll } = trpc.proyectos.list.useQuery(
    undefined,
    { enabled: isSuperadmin, staleTime: 5 * 60 * 1000 } // Cache por 5 minutos
  );
  
  const { data: userProjectsData, isLoading: isLoadingUser } = trpc.proyectos.misProyectos.useQuery(
    undefined,
    { enabled: !isSuperadmin && !!user, staleTime: 5 * 60 * 1000 } // Cache por 5 minutos
  );

  const userProjects = isSuperadmin ? (allProjects || []) : (userProjectsData || []);
  const isLoadingProjects = isSuperadmin ? isLoadingAll : isLoadingUser;

  // Función auxiliar para obtener el ID del proyecto
  const getProjectId = (p: any): number | null => {
    if (p.id) return p.id;
    if (p.proyecto?.id) return p.proyecto.id;
    return null;
  };

  // Sincronizar proyecto activo desde la base de datos
  useEffect(() => {
    if (proyectoActivoData?.proyectoId && !isChangingProject) {
      setSelectedProjectIdState(proyectoActivoData.proyectoId);
    }
  }, [proyectoActivoData, isChangingProject]);

  // Verificar que el proyecto seleccionado esté en la lista de proyectos del usuario
  useEffect(() => {
    if (selectedProjectId && userProjects.length > 0 && !isLoadingProjects) {
      const hasAccess = userProjects.some(p => getProjectId(p) === selectedProjectId);
      if (!hasAccess && !isSuperadmin) {
        // Si no tiene acceso, limpiar selección para forzar pantalla de selección
        setSelectedProjectIdState(null);
        setProyectoActivoMutation.mutate({ proyectoId: null });
      }
    }
  }, [selectedProjectId, userProjects, isSuperadmin, isLoadingProjects]);

  // Función para cambiar proyecto (guarda en base de datos)
  const setSelectedProjectId = useCallback((id: number | null) => {
    setIsChangingProject(true);
    setSelectedProjectIdState(id); // Actualización optimista
    setProyectoActivoMutation.mutate({ proyectoId: id });
  }, [setProyectoActivoMutation]);

  const canAccessProject = (projectId: number): boolean => {
    if (isSuperadmin) return true;
    return userProjects.some(p => getProjectId(p) === projectId);
  };

  // Escuchar cambios de proyecto via WebSocket
  useEffect(() => {
    const handleProyectoChanged = (event: CustomEvent<{ proyectoId: number | null }>) => {
      if (event.detail.proyectoId !== selectedProjectId) {
        setSelectedProjectIdState(event.detail.proyectoId);
        utils.invalidate();
      }
    };

    window.addEventListener('proyecto-activo-changed' as any, handleProyectoChanged);
    return () => {
      window.removeEventListener('proyecto-activo-changed' as any, handleProyectoChanged);
    };
  }, [selectedProjectId, utils]);

  return (
    <ProjectContext.Provider
      value={{
        selectedProjectId,
        setSelectedProjectId,
        userProjects,
        isLoadingProjects: isLoadingProjects || isLoadingProyectoActivo,
        canAccessProject,
        isChangingProject,
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
