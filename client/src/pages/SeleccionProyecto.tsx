import { useState } from 'react';
import { useLocation } from 'wouter';
import { Building2, Users, Calendar, MapPin, Plus, Settings, LogOut, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/UserAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getImageUrl } from '@/lib/imageUrl';
import { useProject } from '@/contexts/ProjectContext';
import { useCallback } from 'react';

export default function SeleccionProyecto() {
  const { user, logout, loading: authLoading } = useAuth();
  const { setSelectedProjectId } = useProject();
  const [, navigate] = useLocation();
  
  if (!authLoading && !user) {
    window.location.href = '/login';
    return null;
  }
  
  const { data: proyectos, isLoading } = trpc.proyectos.misProyectos.useQuery(undefined, {
    staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  
  const canCreateProject = user?.role === 'superadmin' || user?.role === 'admin';
  const utils = trpc.useUtils();

  /** Prefetch datos del proyecto al hover — carga instantánea al entrar */
  const handlePrefetch = useCallback((proyectoId: number) => {
    utils.pendientes.misPendientes.prefetch({ proyectoId });
    utils.planos.listar.prefetch({ proyectoId });
    utils.avisos.noLeidos.prefetch({ proyectoId });
    utils.planos.pinCount.prefetch({ proyectoId });
  }, [utils]);
  
  /** CAMBIO INSTANTÁNEO — navegar primero, limpieza en background (ProjectContext se encarga) */
  const handleSelectProject = (proyecto: { id: number; nombre: string }) => {
    navigate('/bienvenida');
    setSelectedProjectId(proyecto.id);
  };
  
  const handleCreateProject = () => navigate('/proyectos/nuevo');
  
  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };
  
  const getProjectColor = (index: number) => {
    const colors = [
      'from-emerald-500 to-teal-600',
      'from-blue-500 to-indigo-600',
      'from-purple-500 to-pink-600',
      'from-orange-500 to-red-600',
      'from-cyan-500 to-blue-600',
      'from-green-500 to-emerald-600',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header compacto — logo pequeño */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2">
            <img src="/logo-objetiva.jpg" alt="Objetiva" style={{ maxHeight: '24px', height: '24px', width: 'auto' }} className="object-contain" />
            <span className="text-sm font-bold text-slate-700">OQC</span>
          </div>
          <div className="flex items-center gap-3">
            <UserAvatar 
              name={user?.name} 
              fotoUrl={user?.fotoUrl}
              fotoBase64={(user as any)?.fotoBase64}
              size="md"
              showName={true}
              nameClassName="hidden sm:block text-sm font-medium"
            />
            <div className="hidden sm:block">
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">Selecciona un Proyecto</h1>
          <p className="text-sm text-slate-500">Elige el proyecto en el que deseas trabajar</p>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <div className="h-40 bg-gradient-to-r from-slate-200 to-slate-300" />
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : proyectos && proyectos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {proyectos.map((proyectoData, index: number) => {
              const proyecto = proyectoData.proyecto;
              if (!proyecto) return null;
              return (
              <button
                key={proyecto.id}
                type="button"
                className="w-full text-left h-full"
                onClick={() => handleSelectProject(proyecto)}
                onMouseEnter={() => handlePrefetch(proyecto.id)}
                onTouchStart={() => handlePrefetch(proyecto.id)}
              >
              <Card 
                className="overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 group border-0 shadow-md h-full flex flex-col"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Imagen — altura fija uniforme */}
                <div className={`h-40 relative overflow-hidden flex-shrink-0 ${!(proyecto.imagenPortadaBase64 || proyecto.imagenPortadaUrl) ? `bg-gradient-to-r ${getProjectColor(index)}` : ''}`}>
                  {(proyecto.imagenPortadaBase64 || proyecto.imagenPortadaUrl) ? (
                    <img 
                      src={getImageUrl(proyecto.imagenPortadaBase64 || proyecto.imagenPortadaUrl)} 
                      alt={proyecto.nombre}
                      className="w-full h-full object-cover"
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
                    <Badge variant="secondary" className="bg-white/95 text-slate-800 font-semibold shadow-sm text-xs">
                      {proyecto.codigo}
                    </Badge>
                    <div className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1">
                      <span>Entrar</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
                
                {/* Contenido — flex-1 para altura uniforme */}
                <CardContent className="p-3 sm:p-4 flex flex-col flex-1">
                  <h3 className="text-base font-semibold text-slate-800 mb-1 group-hover:text-primary transition-colors truncate">
                    {proyecto.nombre}
                  </h3>
                  
                  {proyectoData.empresaNombre && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1.5">
                      <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{proyectoData.empresaNombre}</span>
                    </div>
                  )}
                  
                  {proyecto.direccion && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-2">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{proyecto.direccion}</span>
                    </div>
                  )}
                  
                  {/* Spacer — empuja stats al fondo */}
                  <div className="flex-1" />
                  
                  {/* Stats — siempre al fondo */}
                  <div className="flex items-center gap-3 pt-2.5 border-t mt-2">
                    {proyectoData.totalUnidades !== undefined && (
                      <div className="text-center flex-1">
                        <p className="text-lg font-bold text-slate-800">{proyectoData.totalUnidades}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Unidades</p>
                      </div>
                    )}
                    {proyectoData.totalItems !== undefined && (
                      <div className="text-center flex-1">
                        <p className="text-lg font-bold text-slate-800">{proyectoData.totalItems}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Ítems</p>
                      </div>
                    )}
                    {proyectoData.itemsPendientes !== undefined && (
                      <div className="text-center flex-1">
                        <p className={`text-lg font-bold ${proyectoData.itemsPendientes > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{proyectoData.itemsPendientes}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Pendientes</p>
                      </div>
                    )}
                  </div>
                  {proyectoData.totalItems !== undefined && proyectoData.totalItems > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Progreso</span>
                        <span className="font-semibold text-emerald-600">
                          {Math.round(((proyectoData.totalItems - (proyectoData.itemsPendientes || 0)) / proyectoData.totalItems) * 100)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700"
                          style={{ width: `${Math.round(((proyectoData.totalItems - (proyectoData.itemsPendientes || 0)) / proyectoData.totalItems) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              </button>
            );
            })}
            
            {/* Create Project Card — misma altura */}
            {canCreateProject && (
              <button type="button" className="w-full text-left h-full" onClick={handleCreateProject}>
              <Card className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 border-dashed border-2 bg-slate-50/50 h-full flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-[280px]">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Plus className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-700 mb-1">Crear Nuevo Proyecto</h3>
                  <p className="text-sm text-slate-500">Configura un nuevo proyecto de obra</p>
                </div>
              </Card>
              </button>
            )}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No tienes proyectos asignados</h3>
            <p className="text-slate-500 mb-6">Contacta a un administrador para que te asigne a un proyecto</p>
            {canCreateProject && (
              <Button onClick={handleCreateProject}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primer Proyecto
              </Button>
            )}
          </Card>
        )}
      </main>
      
      {/* Footer compacto — logo muy pequeño */}
      <footer className="py-3 border-t border-slate-200 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <img src="/logo-objetiva.jpg" alt="Objetiva" style={{ maxHeight: '14px', height: '14px', width: 'auto' }} className="opacity-40" />
              <span className="text-[11px] text-slate-400">© 2026 Objetiva. Derechos Reservados.</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <a href="/terminos" className="hover:text-slate-600 transition-colors">Términos y Condiciones</a>
              <span className="text-slate-300">|</span>
              <a href="/privacidad" className="hover:text-slate-600 transition-colors">Aviso de Privacidad</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
