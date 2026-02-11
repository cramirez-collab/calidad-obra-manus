import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
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

// Cache agresivo: 10 min stale, 30 min gc
const CACHE_OPTS = { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 } as const;

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(null);
  const [isChangingProject, setIsChangingProject] = useState(false);
  const utils = trpc.useUtils();
  const isChangingRef = useRef(false);
  const hasPrefetched = useRef(false);

  // Obtener proyecto activo desde la base de datos
  const { data: proyectoActivoData, isLoading: isLoadingProyectoActivo } = trpc.users.getProyectoActivo.useQuery(
    undefined,
    { enabled: !!user, ...CACHE_OPTS }
  );

  // Mutation para cambiar proyecto activo
  const setProyectoActivoMutation = trpc.users.setProyectoActivo.useMutation({
    onSuccess: (data) => {
      setSelectedProjectIdState(data.proyectoId);
      setIsChangingProject(false);
      isChangingRef.current = false;
      // Invalidar solo queries que dependen del proyecto, no todo
      utils.empresas.invalidate();
      utils.unidades.invalidate();
      utils.especialidades.invalidate();
      utils.items.invalidate();
      utils.estadisticas.invalidate();
      utils.pendientes.invalidate();
      utils.espacios.invalidate();
      utils.planos.invalidate();
    },
    onError: () => {
      setIsChangingProject(false);
      isChangingRef.current = false;
    }
  });

  // Obtener proyectos según el rol del usuario
  const isSuperadmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin";
  
  // Superadmin ve todos los proyectos, otros usuarios solo los asignados
  const { data: allProjects, isLoading: isLoadingAll } = trpc.proyectos.list.useQuery(
    undefined,
    { enabled: isSuperadmin, ...CACHE_OPTS }
  );
  
  const { data: userProjectsData, isLoading: isLoadingUser } = trpc.proyectos.misProyectos.useQuery(
    undefined,
    { enabled: !isSuperadmin && !!user, ...CACHE_OPTS }
  );

  const userProjects = isSuperadmin ? (allProjects || []) : (userProjectsData || []);
  const isLoadingProjects = isSuperadmin ? isLoadingAll : isLoadingUser;

  const getProjectId = (p: any): number | null => {
    if (p.proyectoId) return p.proyectoId;
    if (p.proyecto?.id) return p.proyecto.id;
    if (p.id && !p.usuarioId) return p.id;
    return null;
  };

  // Prefetch DIFERIDO de catálogos — solo los esenciales, con delay
  const prefetchCatalogos = useCallback((proyectoId: number) => {
    if (hasPrefetched.current) return; // Solo prefetch una vez
    hasPrefetched.current = true;
    
    // Diferir prefetch 500ms para no bloquear la navegación inicial
    setTimeout(() => {
      utils.empresas.list.prefetch({ proyectoId });
      utils.unidades.list.prefetch({ proyectoId });
      utils.especialidades.list.prefetch({ proyectoId });
    }, 500);
    
    // Los demás catálogos se cargan aún más tarde (solo cuando se necesiten)
    setTimeout(() => {
      utils.empresas.getAllResidentesConEmpresas.prefetch({ proyectoId });
      utils.espacios.plantilla.prefetch({ proyectoId });
      utils.planos.listar.prefetch({ proyectoId });
      utils.users.list.prefetch();
    }, 2000);
  }, [utils]);

  // Sincronizar proyecto activo desde la base de datos
  useEffect(() => {
    if (proyectoActivoData?.proyectoId && !isChangingProject && !isChangingRef.current) {
      setSelectedProjectIdState(proyectoActivoData.proyectoId);
      prefetchCatalogos(proyectoActivoData.proyectoId);
    }
  }, [proyectoActivoData, isChangingProject, prefetchCatalogos]);

  // Verificar acceso al proyecto seleccionado
  useEffect(() => {
    if (isChangingProject || isChangingRef.current || isLoadingProjects || isSuperadmin || isAdmin) return;
    
    if (selectedProjectId && userProjects.length > 0) {
      const hasAccess = userProjects.some(p => getProjectId(p) === selectedProjectId);
      if (!hasAccess) {
        setSelectedProjectIdState(null);
        setProyectoActivoMutation.mutate({ proyectoId: null });
      }
    }
  }, [selectedProjectId, userProjects, isSuperadmin, isAdmin, isLoadingProjects, isChangingProject]);

  // Función para cambiar proyecto
  const setSelectedProjectId = useCallback((id: number | null) => {
    isChangingRef.current = true;
    setIsChangingProject(true);
    setSelectedProjectIdState(id);
    hasPrefetched.current = false; // Reset prefetch flag para nuevo proyecto
    setProyectoActivoMutation.mutate({ proyectoId: id });
    if (id) prefetchCatalogos(id);
  }, [setProyectoActivoMutation, prefetchCatalogos]);

  const canAccessProject = (projectId: number): boolean => {
    if (isSuperadmin || isAdmin) return true;
    return userProjects.some(p => getProjectId(p) === projectId);
  };

  // Escuchar cambios de proyecto via WebSocket
  useEffect(() => {
    const handleProyectoChanged = (event: CustomEvent<{ proyectoId: number | null }>) => {
      if (event.detail.proyectoId !== selectedProjectId && !isChangingRef.current) {
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
