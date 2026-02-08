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

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(null);
  const [isChangingProject, setIsChangingProject] = useState(false);
  const utils = trpc.useUtils();
  
  // Ref para evitar que el useEffect de verificación de acceso se ejecute durante el cambio de proyecto
  const isChangingRef = useRef(false);

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
      isChangingRef.current = false;
      // Invalidar todas las queries para refrescar datos del nuevo proyecto
      utils.invalidate();
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
    { enabled: isSuperadmin, staleTime: 5 * 60 * 1000 } // Cache por 5 minutos
  );
  
  const { data: userProjectsData, isLoading: isLoadingUser } = trpc.proyectos.misProyectos.useQuery(
    undefined,
    { enabled: !isSuperadmin && !!user, staleTime: 5 * 60 * 1000 } // Cache por 5 minutos
  );

  const userProjects = isSuperadmin ? (allProjects || []) : (userProjectsData || []);
  const isLoadingProjects = isSuperadmin ? isLoadingAll : isLoadingUser;

  // Función auxiliar para obtener el ID del proyecto
  // Para usuarios normales: p.proyectoId o p.proyecto.id (de la relación proyecto_usuarios)
  // Para superadmin: p.id (del proyecto directamente)
  const getProjectId = (p: any): number | null => {
    // Primero verificar si es una relación proyecto_usuarios (tiene proyectoId)
    if (p.proyectoId) return p.proyectoId;
    // Luego verificar si tiene el proyecto anidado
    if (p.proyecto?.id) return p.proyecto.id;
    // Finalmente, si es un proyecto directo (para superadmin)
    if (p.id && !p.usuarioId) return p.id;
    return null;
  };

  // Prefetch de catálogos al seleccionar/cambiar proyecto
  const prefetchCatalogos = useCallback((proyectoId: number) => {
    // Catálogos que NuevoItem, ItemsList e ItemDetail necesitan
    utils.empresas.list.prefetch({ proyectoId });
    utils.unidades.list.prefetch({ proyectoId });
    utils.especialidades.list.prefetch({ proyectoId });
    utils.empresas.getAllResidentesConEmpresas.prefetch({ proyectoId });
    utils.espacios.plantilla.prefetch({ proyectoId });
    utils.planos.listar.prefetch({ proyectoId });
    utils.users.list.prefetch();
  }, [utils]);

  // Sincronizar proyecto activo desde la base de datos (solo al cargar inicialmente)
  useEffect(() => {
    if (proyectoActivoData?.proyectoId && !isChangingProject && !isChangingRef.current) {
      setSelectedProjectIdState(proyectoActivoData.proyectoId);
      // Precargar catálogos del proyecto activo al iniciar
      prefetchCatalogos(proyectoActivoData.proyectoId);
    }
  }, [proyectoActivoData, isChangingProject, prefetchCatalogos]);

  // Verificar que el proyecto seleccionado esté en la lista de proyectos del usuario
  // SOLO si no estamos en proceso de cambio de proyecto
  useEffect(() => {
    // No ejecutar si estamos cambiando de proyecto
    if (isChangingProject || isChangingRef.current) {
      return;
    }
    
    // No ejecutar si aún estamos cargando
    if (isLoadingProjects) {
      return;
    }
    
    // No verificar para superadmin o admin (tienen acceso a todo)
    if (isSuperadmin || isAdmin) {
      return;
    }
    
    // Solo verificar si hay un proyecto seleccionado y tenemos la lista de proyectos
    if (selectedProjectId && userProjects.length > 0) {
      const hasAccess = userProjects.some(p => getProjectId(p) === selectedProjectId);
      if (!hasAccess) {
        // Si no tiene acceso, limpiar selección para forzar pantalla de selección
        setSelectedProjectIdState(null);
        setProyectoActivoMutation.mutate({ proyectoId: null });
      }
    }
  }, [selectedProjectId, userProjects, isSuperadmin, isAdmin, isLoadingProjects, isChangingProject]);

  // Función para cambiar proyecto (guarda en base de datos)
  const setSelectedProjectId = useCallback((id: number | null) => {
    isChangingRef.current = true;
    setIsChangingProject(true);
    setSelectedProjectIdState(id); // Actualización optimista
    setProyectoActivoMutation.mutate({ proyectoId: id });
    // Precargar catálogos del nuevo proyecto en background
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
