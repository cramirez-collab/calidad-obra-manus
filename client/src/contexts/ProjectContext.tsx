import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, startTransition } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

interface ProjectContextType {
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
  userProjects: any[];
  isLoadingProjects: boolean;
  canAccessProject: (projectId: number) => boolean;
  isChangingProject: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const CACHE_OPTS = { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 } as const;

/**
 * NUCLEAR PURGE: Elimina TODOS los datos en caché del queryClient.
 * Esto es AGRESIVO a propósito: al cambiar de proyecto NO debe quedar
 * NINGÚN dato del proyecto anterior visible ni por un milisegundo.
 */
function nuclearPurge(queryClient: any, utils: ReturnType<typeof trpc.useUtils>) {
  // 1. ELIMINAR todos los queries del cache (no solo invalidar, ELIMINAR)
  // Esto hace que los componentes muestren loading en vez de datos viejos
  queryClient.removeQueries({
    predicate: (query: any) => {
      const key = query.queryKey;
      // Preservar SOLO auth y proyectos (necesarios para la sesión)
      if (Array.isArray(key) && key.length > 0) {
        const root = Array.isArray(key[0]) ? key[0][0] : key[0];
        if (root === 'auth' || root === 'users.getProyectoActivo') return false;
        // Preservar lista de proyectos
        if (root === 'proyectos' || (Array.isArray(key[0]) && key[0].includes('proyectos') && key[0].includes('list'))) return false;
        if (Array.isArray(key[0]) && key[0].includes('proyectos') && key[0].includes('misProyectos')) return false;
      }
      return true; // ELIMINAR todo lo demás
    }
  });

  // 2. Limpiar caches del Service Worker
  if ('caches' in window) {
    caches.keys().then(names => names.forEach(n => caches.delete(n))).catch(() => {});
  }

  // 3. Limpiar sessionStorage
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && !key.startsWith('auth') && key !== 'theme') keysToRemove.push(key);
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  } catch (e) {}

  // 4. Notificar al Service Worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(null);
  const [isChangingProject, setIsChangingProject] = useState(false);
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const isChangingRef = useRef(false);
  const hasPrefetched = useRef(false);
  const previousProjectRef = useRef<number | null>(null);

  const { data: proyectoActivoData, isLoading: isLoadingProyectoActivo } = trpc.users.getProyectoActivo.useQuery(
    undefined,
    { enabled: !!user, ...CACHE_OPTS }
  );

  const setProyectoActivoMutation = trpc.users.setProyectoActivo.useMutation({
    onSuccess: async (data) => {
      setSelectedProjectIdState(data.proyectoId);
      setIsChangingProject(false);
      isChangingRef.current = false;
    },
    onError: () => {
      setIsChangingProject(false);
      isChangingRef.current = false;
    }
  });

  const isSuperadmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin";
  
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

  /** PREFETCH AGRESIVO E INMEDIATO — sin delays, todo en paralelo */
  const prefetchCatalogos = useCallback((proyectoId: number) => {
    if (hasPrefetched.current) return;
    hasPrefetched.current = true;
    
    // ONDA 1: Inmediato — datos que TODAS las páginas necesitan
    utils.empresas.list.prefetch({ proyectoId });
    utils.unidades.list.prefetch({ proyectoId });
    utils.especialidades.list.prefetch({ proyectoId });
    utils.users.list.prefetch({ proyectoId });
    utils.users.listForMentions.prefetch({ proyectoId });
    utils.items.list.prefetch({ proyectoId, limit: 100, offset: 0 });
    
    // ONDA 2: 200ms — datos secundarios
    setTimeout(() => {
      utils.empresas.getAllResidentesConEmpresas.prefetch({ proyectoId });
      utils.espacios.plantilla.prefetch({ proyectoId });
      utils.planos.listar.prefetch({ proyectoId });
      utils.defectos.list.prefetch({ proyectoId });
      utils.badges.me.prefetch();
    }, 200);
  }, [utils]);

  useEffect(() => {
    if (proyectoActivoData?.proyectoId && !isChangingProject && !isChangingRef.current) {
      setSelectedProjectIdState(proyectoActivoData.proyectoId);
      prefetchCatalogos(proyectoActivoData.proyectoId);
    }
  }, [proyectoActivoData, isChangingProject, prefetchCatalogos]);

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

  /** Cambiar proyecto — NUCLEAR: eliminar datos viejos ANTES de mostrar nuevos */
  const setSelectedProjectId = useCallback(async (id: number | null) => {
    const previousId = previousProjectRef.current;
    
    if (id === previousId && id !== null) return;
    
    isChangingRef.current = true;
    setIsChangingProject(true);
    hasPrefetched.current = false;
    previousProjectRef.current = id;
    
    // 1. NUCLEAR PURGE: Eliminar TODOS los datos del proyecto anterior
    // Esto es ANTES de actualizar el ID para que los componentes no muestren datos viejos
    nuclearPurge(queryClient, utils);
    
    // 2. Actualizar UI
    startTransition(() => {
      setSelectedProjectIdState(id);
    });
    
    // 3. Persistir en servidor (fire & forget)
    setProyectoActivoMutation.mutate({ proyectoId: id });
    
    // 4. Prefetch del nuevo proyecto inmediatamente
    if (id) prefetchCatalogos(id);
    
    // 5. Terminar cambio rápido
    setTimeout(() => {
      setIsChangingProject(false);
      isChangingRef.current = false;
    }, 150);
  }, [setProyectoActivoMutation, prefetchCatalogos, utils, queryClient]);

  const canAccessProject = (projectId: number): boolean => {
    if (isSuperadmin || isAdmin) return true;
    return userProjects.some(p => getProjectId(p) === projectId);
  };

  useEffect(() => {
    const handleProyectoChanged = (event: CustomEvent<{ proyectoId: number | null }>) => {
      if (event.detail.proyectoId !== selectedProjectId && !isChangingRef.current) {
        nuclearPurge(queryClient, utils);
        setSelectedProjectIdState(event.detail.proyectoId);
      }
    };

    window.addEventListener('proyecto-activo-changed' as any, handleProyectoChanged);
    return () => {
      window.removeEventListener('proyecto-activo-changed' as any, handleProyectoChanged);
    };
  }, [selectedProjectId, utils, queryClient]);

  useEffect(() => {
    if (selectedProjectId !== null) {
      previousProjectRef.current = selectedProjectId;
    }
  }, [selectedProjectId]);

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
