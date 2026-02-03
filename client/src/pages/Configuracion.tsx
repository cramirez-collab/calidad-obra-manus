import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { 
  Settings, 
  Save, 
  Shield, 
  Clock, 
  Bell, 
  Palette,
  Building2,
  Lock,
  Info,
  Key,
  Eye,
  EyeOff,
  Zap,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  Loader2
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface ConfigItem {
  clave: string;
  valor: string | null;
  descripcion: string | null;
  soloSuperadmin: boolean;
  icon: React.ElementType;
  tipo: 'text' | 'number' | 'boolean';
}

// Ordenados alfabéticamente por label
const configDefaults: Omit<ConfigItem, 'valor' | 'descripcion'>[] = [
  { clave: 'tema_color', icon: Palette, tipo: 'text', soloSuperadmin: false },
  { clave: 'requiere_comentario_rechazo', icon: Shield, tipo: 'boolean', soloSuperadmin: false },
  { clave: 'dias_alerta_pendiente', icon: Clock, tipo: 'number', soloSuperadmin: false },
  { clave: 'max_items_por_pagina', icon: Settings, tipo: 'number', soloSuperadmin: true },
  { clave: 'nombre_empresa', icon: Building2, tipo: 'text', soloSuperadmin: false },
  { clave: 'notificaciones_email', icon: Bell, tipo: 'boolean', soloSuperadmin: false },
];

const configLabels: Record<string, string> = {
  tema_color: 'Color del Tema',
  requiere_comentario_rechazo: 'Comentario al Rechazar',
  dias_alerta_pendiente: 'Días para Alerta',
  max_items_por_pagina: 'Ítems por Página',
  nombre_empresa: 'Nombre de Empresa',
  notificaciones_email: 'Notificaciones Email',
};

const configDescriptions: Record<string, string> = {
  tema_color: 'Color principal de la interfaz',
  requiere_comentario_rechazo: 'Obligar comentario al rechazar',
  dias_alerta_pendiente: 'Días antes de alertar ítems pendientes',
  max_items_por_pagina: 'Cantidad máxima de ítems en listas',
  nombre_empresa: 'Nombre que aparece en reportes',
  notificaciones_email: 'Enviar notificaciones por correo',
};

// Componente para limpiar caché
function ClearCacheButton() {
  const [isClearing, setIsClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      // 1. Limpiar todos los caches del navegador
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[ClearCache] Todos los caches eliminados:', cacheNames);
      }

      // 2. Limpiar localStorage excepto datos críticos
      const keysToKeep = ['selectedProjectId'];
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToKeep.includes(key)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('[ClearCache] localStorage limpiado');

      // 3. Limpiar sessionStorage
      sessionStorage.clear();
      console.log('[ClearCache] sessionStorage limpiado');

      // 4. Forzar actualización del Service Worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.update();
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            registration.waiting.postMessage({ type: 'CLEAR_CACHE' });
          }
        }
        console.log('[ClearCache] Service Worker actualizado');
      }

      setCleared(true);
      toast.success("Caché limpiada correctamente");
      
      // Recargar la página después de 1.5 segundos
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('[ClearCache] Error:', error);
      toast.error("Error al limpiar caché");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Button
      onClick={handleClearCache}
      disabled={isClearing || cleared}
      variant="outline"
      className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-100"
    >
      {isClearing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Limpiando...
        </>
      ) : cleared ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Caché Limpiada - Recargando...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          Limpiar Caché y Recargar
        </>
      )}
    </Button>
  );
}

export default function Configuracion() {
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const isSuperadmin = user?.role === 'superadmin';
  const isAdmin = ['superadmin', 'admin'].includes(user?.role || '');
  
  const { data: configData, isLoading, refetch } = trpc.configuracion.list.useQuery();
  const setConfigMutation = trpc.configuracion.set.useMutation({
    onSuccess: () => {
      toast.success("Configuración guardada");
      refetch();
    },
    onError: () => {
      toast.error("Error al guardar");
    }
  });


  const [values, setValues] = useState<Record<string, string>>({});

  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState(false);
  
  const changePasswordMutation = trpc.users.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Contraseña actualizada correctamente");
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (error) => {
      toast.error(error.message || "Error al cambiar contraseña");
    }
  });
  
  const handleChangePassword = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  useEffect(() => {
    if (configData) {
      const newValues: Record<string, string> = {};
      configData.forEach(c => {
        newValues[c.clave] = c.valor || '';
      });
      setValues(newValues);
    }
  }, [configData]);


  const handleSave = (clave: string, soloSuperadmin: boolean) => {
    setConfigMutation.mutate({
      clave,
      valor: values[clave] || '',
      descripcion: configDescriptions[clave],
      soloSuperadmin,
    });
  };

  const handleToggle = (clave: string, soloSuperadmin: boolean) => {
    const newValue = values[clave] === 'true' ? 'false' : 'true';
    setValues(prev => ({ ...prev, [clave]: newValue }));
    setConfigMutation.mutate({
      clave,
      valor: newValue,
      descripcion: configDescriptions[clave],
      soloSuperadmin,
    });
  };


  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const visibleConfigs = configDefaults.filter(c => isSuperadmin || !c.soloSuperadmin);

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
        {/* Header compacto */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">Configuración</h1>
            <p className="text-xs text-muted-foreground">Ajustes del sistema</p>
          </div>
        </div>

        {/* Grid de configuraciones */}
        <div className="grid gap-3 sm:gap-4">
          {visibleConfigs.map(config => {
            const Icon = config.icon;
            const value = values[config.clave] || '';
            const isLocked = config.soloSuperadmin && !isSuperadmin;

            return (
              <Card key={config.clave} className={`transition-all ${isLocked ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Icono */}
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{configLabels[config.clave]}</span>
                        {config.soloSuperadmin && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>Solo Superadmin</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {configDescriptions[config.clave]}
                      </p>
                    </div>

                    {/* Control */}
                    <div className="flex items-center gap-2 shrink-0">
                      {config.tipo === 'boolean' ? (
                        <Switch
                          checked={value === 'true'}
                          onCheckedChange={() => handleToggle(config.clave, config.soloSuperadmin)}
                          disabled={isLocked}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type={config.tipo === 'number' ? 'number' : 'text'}
                            value={value}
                            onChange={(e) => setValues(prev => ({ ...prev, [config.clave]: e.target.value }))}
                            className="w-24 sm:w-32 h-9 text-sm"
                            disabled={isLocked}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSave(config.clave, config.soloSuperadmin)}
                            disabled={isLocked || setConfigMutation.isPending}
                            className="h-9 w-9"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Sección Limpiar Caché - ARRIBA para fácil acceso */}
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <span className="font-medium text-sm">Limpiar Caché</span>
                  <p className="text-xs text-muted-foreground">
                    Resuelve problemas de datos desactualizados
                  </p>
                </div>
              </div>
              <ClearCacheButton />
            </div>
          </CardContent>
        </Card>

        {/* Info y Versión */}
        <div className="flex items-center justify-between text-xs text-muted-foreground bg-accent/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            <span>Los cambios se aplican inmediatamente</span>
          </div>
          <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">v16</span>
        </div>

        {/* Sección Alta Rápida de Empresa */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-5 w-5 text-primary" />
              Alta Rápida de Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configura una nueva empresa con especialidad, usuarios y defectos en un solo flujo simple de 4 pasos.
            </p>
            <Link href="/configuracion/alta-rapida">
              <Button className="gap-2">
                <Building2 className="h-4 w-4" />
                Iniciar Alta Rápida
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Sección Cambiar Contraseña */}
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-5 w-5 text-primary" />
              Cambiar Contraseña
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-sm">Contraseña Actual</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPasswords ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="••••••"
                    className="pr-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm">Nueva Contraseña</Label>
                <Input
                  id="newPassword"
                  type={showPasswords ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm">Confirmar Contraseña</Label>
                <Input
                  id="confirmPassword"
                  type={showPasswords ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Repetir contraseña"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPasswords ? "Ocultar" : "Mostrar"} contraseñas
              </button>
              <Button
                onClick={handleChangePassword}
                disabled={changePasswordMutation.isPending || !passwordData.currentPassword || !passwordData.newPassword}
                className="gap-2"
              >
                <Key className="h-4 w-4" />
                {changePasswordMutation.isPending ? "Guardando..." : "Cambiar Contraseña"}
              </Button>
            </div>
          </CardContent>
        </Card>



      </div>
    </DashboardLayout>
  );
}
