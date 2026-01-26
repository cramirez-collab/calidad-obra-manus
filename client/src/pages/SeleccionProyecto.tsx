import { useState } from 'react';
import { useLocation } from 'wouter';
import { Building2, Users, Calendar, MapPin, Plus, Settings, LogOut } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useProject } from '@/contexts/ProjectContext';

// Usamos el tipo inferido de la respuesta del servidor

export default function SeleccionProyecto() {
  const { user, logout } = useAuth();
  const { setSelectedProjectId } = useProject();
  const [, navigate] = useLocation();
  
  const { data: proyectos, isLoading } = trpc.proyectos.misProyectos.useQuery();
  
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Objetiva" className="h-8" />
            <span className="text-xl font-bold text-slate-800">ObjetivaOQC</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {user?.name ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">{user?.name}</p>
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
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Title Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Selecciona un Proyecto
            </h1>
            <p className="text-slate-600">
              Elige el proyecto en el que deseas trabajar
            </p>
          </div>
          
          {/* Projects Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="h-24 bg-gradient-to-r from-slate-200 to-slate-300" />
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-4" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : proyectos && proyectos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {proyectos.map((proyectoData, index: number) => {
                const proyecto = proyectoData.proyecto;
                if (!proyecto) return null;
                return (
                <Card 
                  key={proyecto.id} 
                  className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 group"
                  onClick={() => handleSelectProject(proyecto)}
                >
                  {/* Color Header */}
                  <div className={`h-24 bg-gradient-to-r ${getProjectColor(index)} relative`}>
                    <div className="absolute inset-0 bg-black/10" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <Badge variant="secondary" className="bg-white/90 text-slate-800">
                        {proyecto.codigo}
                      </Badge>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold text-slate-800 mb-1 group-hover:text-primary transition-colors">
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
                    <div className="flex items-center gap-4 pt-3 border-t">
                      {proyectoData.totalUnidades !== undefined && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-slate-800">{proyectoData.totalUnidades}</p>
                          <p className="text-xs text-slate-500">Unidades</p>
                        </div>
                      )}
                      {proyectoData.totalItems !== undefined && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-slate-800">{proyectoData.totalItems}</p>
                          <p className="text-xs text-slate-500">Ítems</p>
                        </div>
                      )}
                      {proyectoData.itemsPendientes !== undefined && proyectoData.itemsPendientes > 0 && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-amber-600">{proyectoData.itemsPendientes}</p>
                          <p className="text-xs text-slate-500">Pendientes</p>
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
                  className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 border-dashed border-2 bg-slate-50/50"
                  onClick={handleCreateProject}
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
      
      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-sm text-slate-500">
        <p>© 2026 Objetiva - Control de Calidad de Obra</p>
      </footer>
    </div>
  );
}
