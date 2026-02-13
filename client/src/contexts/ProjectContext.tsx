import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, startTransition } from "react";
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

const CACHE_OPTS = { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 } as const;

/** Limpieza TOTAL y AGRESIVA de todo el caché — aislamiento 100% entre proyectos */
async function purgeAllProjectCache(utils: ReturnType<typeof trpc.useUtils>) {
  // 1. Invalidar ABSOLUTAMENTE TODOS los queries de tRPC
  await utils.invalidate();
  
  // 2. Limpiar TODAS las caches del Service Worker (en background, no bloquear)
  if ('caches' in window) {
    caches.keys().then(names => names.forEach(n => caches.delete(n))).catch(() => {});
  }
  
  // 3. Limpiar sessionStorage (no bloquear)
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && !key.startsWith('auth') && key !== 'theme') keysToRemove.push(key);
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  } catch (e) {}
  
  // 4. Notificar al Service Worker (fire & forget)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(null);
  const [isChangingProject, setIsChangingProject] = useState(false);
  const utils = trpc.useUtils();
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

  /** Cambiar proyecto — INSTANTÁNEO: primero UI, luego limpieza en background */
  const setSelectedProjectId = useCallback(async (id: number | null) => {
    const previousId = previousProjectRef.current;
    
    if (id === previousId && id !== null) return;
    
    isChangingRef.current = true;
    setIsChangingProject(true);
    hasPrefetched.current = false;
    previousProjectRef.current = id;
    
    // 1. PRIMERO: Actualizar UI inmediatamente — el usuario ve el cambio al instante
    startTransition(() => {
      setSelectedProjectIdState(id);
    });
    
    // 2. Limpiar caché en background (no bloquear la UI)
    purgeAllProjectCache(utils);
    
    // 3. Persistir en servidor (fire & forget)
    setProyectoActivoMutation.mutate({ proyectoId: id });
    
    // 4. Prefetch del nuevo proyecto inmediatamente
    if (id) prefetchCatalogos(id);
    
    // 5. Terminar cambio rápido
    setTimeout(() => {
      setIsChangingProject(false);
      isChangingRef.current = false;
    }, 100);
  }, [setProyectoActivoMutation, prefetchCatalogos, utils]);

  const canAccessProject = (projectId: number): boolean => {
    if (isSuperadmin || isAdmin) return true;
    return userProjects.some(p => getProjectId(p) === projectId);
  };

  useEffect(() => {
    const handleProyectoChanged = (event: CustomEvent<{ proyectoId: number | null }>) => {
      if (event.detail.proyectoId !== selectedProjectId && !isChangingRef.current) {
        setSelectedProjectIdState(event.detail.proyectoId);
        purgeAllProjectCache(utils);
      }
    };

    window.addEventListener('proyecto-activo-changed' as any, handleProyectoChanged);
    return () => {
      window.removeEventListener('proyecto-activo-changed' as any, handleProyectoChanged);
    };
  }, [selectedProjectId, utils]);

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
