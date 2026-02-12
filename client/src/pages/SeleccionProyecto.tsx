import { useState } from 'react';
import { useLocation } from 'wouter';
import { Building2, Users, Calendar, MapPin, Plus, Settings, LogOut, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserAvatar } from '@/components/UserAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getImageUrl } from '@/lib/imageUrl';
import { useProject } from '@/contexts/ProjectContext';

// Usamos el tipo inferido de la respuesta del servidor

export default function SeleccionProyecto() {
  const { user, logout, loading: authLoading } = useAuth();
  const { setSelectedProjectId } = useProject();
  const [, navigate] = useLocation();
  
  // Si no hay usuario autenticado, redirigir a login
  if (!authLoading && !user) {
    window.location.href = '/login';
    return null;
  }
  
  const { data: proyectos, isLoading } = trpc.proyectos.misProyectos.useQuery(undefined, {
    staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000, // Cache 5 minutos
  });
  
  const canCreateProject = user?.role === 'superadmin' || user?.role === 'admin';
  
  const handleSelectProject = (proyecto: { id: number; nombre: string }) => {
    setSelectedProjectId(proyecto.id);
    navigate('/bienvenida');
  };
  
  const handleCreateProject = () => {
    navigate('/proyectos/nuevo');
  };
  
  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };
  
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4 flex items-center justify-between max-w-full overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <img src="/logo-objetiva.jpg" alt="Objetiva" style={{ maxHeight: '40px', width: 'auto' }} className="h-8 sm:h-10 object-contain" />
            <span className="text-base sm:text-lg md:text-xl font-bold text-slate-800">OQC</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
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
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-full overflow-hidden">
        <div className="max-w-5xl mx-auto">
          {/* Title Section */}
          <div className="text-center mb-4 sm:mb-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 mb-2">
              Selecciona un Proyecto
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              Elige el proyecto en el que deseas trabajar
            </p>
          </div>
          
          {/* Projects Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="h-48 sm:h-56 md:h-64 bg-gradient-to-r from-slate-200 to-slate-300" />
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-4" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : proyectos && proyectos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              {proyectos.map((proyectoData, index: number) => {
                const proyecto = proyectoData.proyecto;
                if (!proyecto) return null;
                return (
                <button
                  key={proyecto.id}
                  type="button"
                  className="w-full text-left"
                  onClick={() => handleSelectProject(proyecto)}
                >
                <Card 
                  className="overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 group border-0 shadow-md"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Imagen de Portada o Color Header */}
                  <div className={`h-48 sm:h-56 md:h-64 relative overflow-hidden ${!(proyecto.imagenPortadaBase64 || proyecto.imagenPortadaUrl) ? `bg-gradient-to-r ${getProjectColor(index)}` : ''}`}>
                    {(proyecto.imagenPortadaBase64 || proyecto.imagenPortadaUrl) ? (
                      <img 
                        src={getImageUrl(proyecto.imagenPortadaBase64 || proyecto.imagenPortadaUrl)} 
                        alt={proyecto.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <Badge variant="secondary" className="bg-white/95 text-slate-800 font-semibold shadow-sm">
                        {proyecto.codigo}
                      </Badge>
                      <div className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1">
                        <span>Entrar</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                  
                  <CardContent className="p-3 sm:p-4">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-1 group-hover:text-primary transition-colors truncate">
                      {proyecto.nombre}
                    </h3>
                    
                    {proyectoData.empresaNombre && (
                      <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-3">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{proyectoData.empresaNombre}</span>
                      </div>
                    )}
                    
                    {proyecto.direccion && (
                      <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{proyecto.direccion}</span>
                      </div>
                    )}
                    
                    {/* Stats */}
                    <div className="flex items-center gap-3 pt-3 border-t">
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
                    {/* Progress bar */}
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
              
              {/* Create Project Card - Only for admins */}
              {canCreateProject && (
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={handleCreateProject}
                >
                <Card 
                  className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 border-dashed border-2 bg-slate-50/50"
                >
                  <div className="h-full min-h-[200px] flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <Plus className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-1">
                      Crear Nuevo Proyecto
                    </h3>
                    <p className="text-sm text-slate-500">
                      Configura un nuevo proyecto de obra
                    </p>
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
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No tienes proyectos asignados
              </h3>
              <p className="text-slate-500 mb-6">
                Contacta a un administrador para que te asigne a un proyecto
              </p>
              {canCreateProject && (
                <Button onClick={handleCreateProject}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primer Proyecto
                </Button>
              )}
            </Card>
          )}
        </div>
      </main>
      
      {/* Footer Corporativo */}
      <footer className="mt-auto py-6 border-t border-slate-200 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src="/logo-objetiva.jpg" alt="Objetiva" className="h-6 opacity-60" />
              <span className="text-xs text-slate-400">© 2026 Objetiva. Derechos Reservados.</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
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
