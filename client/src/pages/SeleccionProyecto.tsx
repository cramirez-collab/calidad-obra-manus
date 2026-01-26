import { useState } from 'react';
import { useLocation } from 'wouter';
import { Building2, Users, Calendar, MapPin, Plus, Settings, LogOut, LogIn, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useProject } from '@/contexts/ProjectContext';
import { getLoginUrl } from '@/const';

export default function SeleccionProyecto() {
  const { user, loading: authLoading, logout } = useAuth();
  const { setSelectedProjectId } = useProject();
  const [, navigate] = useLocation();
  
  const { data: proyectos, isLoading } = trpc.proyectos.misProyectos.useQuery(undefined, {
    enabled: !!user, // Solo consultar si hay usuario autenticado
  });
  
  const canCreateProject = user?.role === 'superadmin' || user?.role === 'admin';
  
  const handleSelectProject = (proyecto: { id: number; nombre: string }) => {
    setSelectedProjectId(proyecto.id);
    navigate('/bienvenida');
  };
  
  const handleCreateProject = () => {
    navigate('/proyectos/nuevo');
  };
  
  const handleLogin = () => {
    window.location.href = getLoginUrl();
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

  // Mostrar loading mientras se verifica autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#02B381] mx-auto mb-4" />
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Mostrar página de login si no hay usuario autenticado
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b shadow-sm">
          <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src="/logo-objetiva.jpg" alt="Objetiva" className="h-8 sm:h-10" />
              <span className="text-lg sm:text-xl font-bold text-slate-800">ObjetivaOQC</span>
            </div>
          </div>
        </header>
        
        {/* Login Content */}
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md mx-auto shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#02B381]/10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-[#02B381]" />
              </div>
              <CardTitle className="text-xl sm:text-2xl text-slate-800">
                Control de Calidad de Obra
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Inicia sesión para acceder a tus proyectos
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button 
                onClick={handleLogin}
                className="w-full h-12 sm:h-14 text-base sm:text-lg bg-[#02B381] hover:bg-[#02B381]/90"
              >
                <LogIn className="h-5 w-5 mr-2" />
                Iniciar Sesión
              </Button>
              <p className="text-xs sm:text-sm text-center text-slate-500 mt-4">
                Usa tu cuenta de Manus para acceder
              </p>
            </CardContent>
          </Card>
        </main>
        
        {/* Footer */}
        <footer className="py-4 sm:py-6 text-center text-xs sm:text-sm text-slate-500">
          <p>© 2026 Objetiva - Control de Calidad de Obra</p>
        </footer>
      </div>
    );
  }

  // Usuario autenticado - Mostrar selección de proyectos
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header - Responsive */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/logo-objetiva.jpg" alt="Objetiva" className="h-8 sm:h-10" />
            <span className="text-base sm:text-xl font-bold text-slate-800 hidden xs:inline">ObjetivaOQC</span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                  {user?.name ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-medium truncate max-w-[120px]">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout} 
              title="Cerrar sesión"
              className="h-9 w-9"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-5xl mx-auto">
          {/* Title Section */}
          <div className="text-center mb-4 sm:mb-8">
            <h1 className="text-xl sm:text-3xl font-bold text-slate-800 mb-1 sm:mb-2">
              Selecciona un Proyecto
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              Elige el proyecto en el que deseas trabajar
            </p>
          </div>
          
          {/* Projects Grid - Responsive */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="h-20 sm:h-24 bg-gradient-to-r from-slate-200 to-slate-300" />
                  <CardContent className="p-3 sm:p-4">
                    <Skeleton className="h-5 sm:h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-3 sm:mb-4" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : proyectos && proyectos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {proyectos.map((proyectoData, index: number) => {
                const proyecto = proyectoData.proyecto;
                if (!proyecto) return null;
                return (
                <Card 
                  key={proyecto.id} 
                  className="overflow-hidden cursor-pointer transition-all hover:shadow-lg active:scale-[0.98] group"
                  onClick={() => handleSelectProject(proyecto)}
                >
                  {/* Imagen de Portada o Color Header */}
                  <div className={`h-24 sm:h-32 relative ${!proyecto.imagenPortadaUrl ? `bg-gradient-to-r ${getProjectColor(index)}` : ''}`}>
                    {proyecto.imagenPortadaUrl ? (
                      <img 
                        src={proyecto.imagenPortadaUrl} 
                        alt={proyecto.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute bottom-2 sm:bottom-3 left-3 sm:left-4 right-3 sm:right-4">
                      <Badge variant="secondary" className="bg-white/90 text-slate-800 text-xs">
                        {proyecto.codigo}
                      </Badge>
                    </div>
                  </div>
                  
                  <CardContent className="p-3 sm:p-4">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-1 group-hover:text-primary transition-colors">
                      {proyecto.nombre}
                    </h3>
                    
                    {proyectoData.empresaNombre && (
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 mb-2 sm:mb-3">
                        <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                        <span className="truncate">{proyectoData.empresaNombre}</span>
                      </div>
                    )}
                    
                    {proyecto.direccion && (
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 mb-2 sm:mb-3">
                        <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                        <span className="truncate">{proyecto.direccion}</span>
                      </div>
                    )}
                    
                    {/* Stats - Responsive */}
                    <div className="flex items-center gap-3 sm:gap-4 pt-2 sm:pt-3 border-t">
                      {proyectoData.totalUnidades !== undefined && (
                        <div className="text-center">
                          <p className="text-base sm:text-lg font-bold text-slate-800">{proyectoData.totalUnidades}</p>
                          <p className="text-[10px] sm:text-xs text-slate-500">Unidades</p>
                        </div>
                      )}
                      {proyectoData.totalItems !== undefined && (
                        <div className="text-center">
                          <p className="text-base sm:text-lg font-bold text-slate-800">{proyectoData.totalItems}</p>
                          <p className="text-[10px] sm:text-xs text-slate-500">Ítems</p>
                        </div>
                      )}
                      {proyectoData.itemsPendientes !== undefined && proyectoData.itemsPendientes > 0 && (
                        <div className="text-center">
                          <p className="text-base sm:text-lg font-bold text-amber-600">{proyectoData.itemsPendientes}</p>
                          <p className="text-[10px] sm:text-xs text-slate-500">Pendientes</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
              })}
              
              {/* Create Project Card - Only for admins */}
              {canCreateProject && (
                <Card 
                  className="overflow-hidden cursor-pointer transition-all hover:shadow-lg active:scale-[0.98] border-dashed border-2 bg-slate-50/50"
                  onClick={handleCreateProject}
                >
                  <div className="h-full min-h-[160px] sm:min-h-[200px] flex flex-col items-center justify-center p-4 sm:p-6 text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                      <Plus className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-slate-700 mb-1">
                      Crear Nuevo Proyecto
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Configura un nuevo proyecto de obra
                    </p>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <Card className="p-6 sm:p-12 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-slate-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-700 mb-2">
                No tienes proyectos asignados
              </h3>
              <p className="text-sm sm:text-base text-slate-500 mb-4 sm:mb-6">
                Contacta a un administrador para que te asigne a un proyecto
              </p>
              {canCreateProject && (
                <Button onClick={handleCreateProject} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primer Proyecto
                </Button>
              )}
            </Card>
          )}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="py-4 sm:py-6 text-center text-xs sm:text-sm text-slate-500">
        <p>© 2026 Objetiva - Control de Calidad de Obra</p>
      </footer>
    </div>
  );
}
