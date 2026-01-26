import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface RequireProjectProps {
  children: ReactNode;
}

/**
 * Componente que protege rutas que requieren un proyecto seleccionado.
 * Si no hay proyecto seleccionado, redirige a la pantalla de selección.
 */
export function RequireProject({ children }: RequireProjectProps) {
  const { selectedProjectId, isLoadingProjects, userProjects } = useProject();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    // Esperar a que termine de cargar
    if (isLoadingProjects) return;
    
    // Si no hay usuario, no hacer nada (el auth se encarga)
    if (!user) return;
    
    // Si no hay proyecto seleccionado y hay proyectos disponibles, redirigir
    if (!selectedProjectId && userProjects.length > 0) {
      navigate("/seleccionar-proyecto");
    }
    
    // Si no hay proyectos asignados, también redirigir para mostrar mensaje
    if (!selectedProjectId && userProjects.length === 0) {
      navigate("/seleccionar-proyecto");
    }
  }, [selectedProjectId, isLoadingProjects, user, userProjects, navigate]);

  // Mostrar loading mientras carga
  if (isLoadingProjects) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#02B381]" />
      </div>
    );
  }

  // Si no hay proyecto seleccionado, no renderizar nada (se está redirigiendo)
  if (!selectedProjectId) {
    return null;
  }

  return <>{children}</>;
}

export default RequireProject;
