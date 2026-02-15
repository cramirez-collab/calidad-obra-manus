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
  Loader2,
  Megaphone,
  Plus,
  Pencil,
  Users,
  AlertTriangle,
  Layers,
  Upload,
  Image as ImageIcon,
  X as XIcon,
  GripVertical,
  MapPin,
  MapPinOff,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
        {/* Header - Avisos como acceso principal */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#002C63]/10 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-[#002C63]" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">Configuración</h1>
              <p className="text-xs text-muted-foreground">Ajustes del sistema</p>
            </div>
          </div>
          {isAdmin && (
            <Button
              className="bg-[#002C63] hover:bg-[#002C63]/90 text-white font-medium"
              onClick={() => {
                document.getElementById('gestion-avisos')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Megaphone className="h-4 w-4 mr-2" />
              Avisos
            </Button>
          )}
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

        {/* === SECCIONES ORDENADAS ALFABÉTICAMENTE === */}

        {/* A - Alta Rápida de Empresa */}
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

        {/* A - Avisos */}
        {isAdmin && (
          <div id="gestion-avisos">
            <AvisosManager proyectoId={selectedProjectId} />
          </div>
        )}

        {/* C - Cambiar Contraseña */}
        <Card>
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

        {/* L - Limpiar Caché */}
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

        {/* P - Plazo de Corrección */}
        {isAdmin && selectedProjectId && (
          <DiasCorreccionManager proyectoId={selectedProjectId} />
        )}

        {/* P - Pines (antes Planos por Nivel) */}
        {isAdmin && selectedProjectId && (
          <div id="gestion-pines">
            <PinesManager proyectoId={selectedProjectId} />
          </div>
        )}

        {/* Info y Versión */}
        <div className="flex items-center justify-between text-xs text-muted-foreground bg-accent/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            <span>Los cambios se aplican inmediatamente</span>
          </div>
          <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">v18</span>
        </div>

      </div>
    </DashboardLayout>
  );
}

// ==================== COMPONENTE AVISOS MANAGER ====================
function AvisosManager({ proyectoId }: { proyectoId: number | null }) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAviso, setEditingAviso] = useState<any>(null);
  const [deleteAvisoId, setDeleteAvisoId] = useState<number | null>(null);
  const [viewLecturasId, setViewLecturasId] = useState<number | null>(null);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [prioridad, setPrioridad] = useState<'normal' | 'urgente'>('normal');

  const { data: avisosList, refetch } = trpc.avisos.list.useQuery(
    { proyectoId: proyectoId! },
    { enabled: !!proyectoId }
  );
  const utils = trpc.useUtils();

  const createMutation = trpc.avisos.create.useMutation({
    onSuccess: () => {
      toast.success('Aviso creado');
      refetch();
      utils.avisos.noLeidos.invalidate();
      resetForm();
      setShowCreateDialog(false);
    },
    onError: (e) => toast.error(e.message || 'Error al crear aviso'),
  });

  const updateMutation = trpc.avisos.update.useMutation({
    onSuccess: () => {
      toast.success('Aviso actualizado');
      refetch();
      setEditingAviso(null);
      resetForm();
    },
    onError: (e) => toast.error(e.message || 'Error al actualizar'),
  });

  const deleteMutation = trpc.avisos.delete.useMutation({
    onSuccess: () => {
      toast.success('Aviso eliminado');
      refetch();
      utils.avisos.noLeidos.invalidate();
      setDeleteAvisoId(null);
    },
    onError: (e) => toast.error(e.message || 'Error al eliminar'),
  });

  const { data: lecturas } = trpc.avisos.lecturas.useQuery(
    { avisoId: viewLecturasId! },
    { enabled: !!viewLecturasId }
  );

  const resetForm = () => {
    setTitulo('');
    setContenido('');
    setPrioridad('normal');
  };

  const handleCreate = () => {
    createMutation.mutate({
      proyectoId: proyectoId!,
      titulo,
      contenido,
      prioridad,
    });
  };

  const handleUpdate = () => {
    if (!editingAviso) return;
    updateMutation.mutate({
      id: editingAviso.id,
      titulo,
      contenido,
      prioridad,
    });
  };

  const openEdit = (aviso: any) => {
    setEditingAviso(aviso);
    setTitulo(aviso.titulo);
    setContenido(aviso.contenido);
    setPrioridad(aviso.prioridad);
  };

  const formatFecha = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const avisos = avisosList || [];

  return (
    <>
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-5 w-5 text-[#002C63]" />
              Gestión de Avisos
            </CardTitle>
            <Button
              size="sm"
              className="gap-1 bg-[#02B381] hover:bg-[#02B381]/90"
              onClick={() => { resetForm(); setShowCreateDialog(true); }}
            >
              <Plus className="h-4 w-4" />
              Nuevo Aviso
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {avisos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hay avisos creados</p>
          ) : (
            <div className="space-y-3">
              {avisos.map((aviso) => (
                <div
                  key={aviso.id}
                  className={`p-3 rounded-lg border ${
                    aviso.prioridad === 'urgente' ? 'border-orange-200 bg-orange-50/50' : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {aviso.prioridad === 'urgente' && (
                          <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        )}
                        <span className="font-semibold text-sm text-[#002C63] truncate">
                          {aviso.titulo}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{aviso.contenido}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>{aviso.creadoPorNombre}</span>
                        <span>{formatFecha(aviso.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewLecturasId(aviso.id)}
                          >
                            <Users className="h-4 w-4 text-blue-600" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver quién lo leyó</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(aviso)}
                          >
                            <Pencil className="h-4 w-4 text-slate-600" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeleteAvisoId(aviso.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Eliminar</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo Crear Aviso */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-[#002C63]" />
              Nuevo Aviso
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título del aviso"
              />
            </div>
            <div className="space-y-2">
              <Label>Contenido</Label>
              <Textarea
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                placeholder="Escribe el contenido del aviso..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={(v: 'normal' | 'urgente') => setPrioridad(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={!titulo.trim() || !contenido.trim() || createMutation.isPending}
              className="bg-[#02B381] hover:bg-[#02B381]/90"
            >
              {createMutation.isPending ? 'Creando...' : 'Crear Aviso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Editar Aviso */}
      <Dialog open={!!editingAviso} onOpenChange={(open) => { if (!open) setEditingAviso(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-[#002C63]" />
              Editar Aviso
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título del aviso"
              />
            </div>
            <div className="space-y-2">
              <Label>Contenido</Label>
              <Textarea
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                placeholder="Escribe el contenido del aviso..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={(v: 'normal' | 'urgente') => setPrioridad(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAviso(null)}>Cancelar</Button>
            <Button
              onClick={handleUpdate}
              disabled={!titulo.trim() || !contenido.trim() || updateMutation.isPending}
              className="bg-[#002C63] hover:bg-[#002C63]/90"
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Confirmar Eliminar */}
      <AlertDialog open={!!deleteAvisoId} onOpenChange={(open) => { if (!open) setDeleteAvisoId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar aviso?</AlertDialogTitle>
            <AlertDialogDescription>
              El aviso será desactivado y ya no será visible para los usuarios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deleteAvisoId && deleteMutation.mutate({ id: deleteAvisoId })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo Ver Lecturas (Bitácora) */}
      <Dialog open={!!viewLecturasId} onOpenChange={(open) => { if (!open) setViewLecturasId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Bitácora de Lecturas
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {!lecturas || lecturas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nadie ha leído este aviso aún</p>
            ) : (
              <div className="space-y-2">
                {lecturas.map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-medium text-[#002C63]">{l.usuarioNombre}</p>
                      <p className="text-xs text-slate-500 capitalize">{l.usuarioRole?.replace('_', ' ')}</p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatFecha(l.leidoAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== COMPONENTE PINES MANAGER ====================
const PIN_COLORS: Record<string, { bg: string; border: string }> = {
  pendiente_foto_despues: { bg: "#f59e0b", border: "#d97706" },
  pendiente_aprobacion: { bg: "#3b82f6", border: "#2563eb" },
  aprobado: { bg: "#10b981", border: "#059669" },
  rechazado: { bg: "#ef4444", border: "#dc2626" },
  sin_item: { bg: "#6b7280", border: "#4b5563" },
};

// ==================== COMPONENTE DIAS CORRECCION ====================
function DiasCorreccionManager({ proyectoId }: { proyectoId: number }) {
  const { data: proyecto, refetch } = trpc.proyectos.get.useQuery({ id: proyectoId });
  const updateMutation = trpc.proyectos.update.useMutation({
    onSuccess: () => { toast.success("Plazo de corrección actualizado"); refetch(); },
    onError: () => toast.error("Error al actualizar"),
  });
  const [dias, setDias] = useState<number>(8);

  useEffect(() => {
    if (proyecto?.diasCorreccion) setDias(proyecto.diasCorreccion);
  }, [proyecto?.diasCorreccion]);

  const handleSave = () => {
    if (dias < 1 || dias > 365) { toast.error("El plazo debe ser entre 1 y 365 días"); return; }
    updateMutation.mutate({ id: proyectoId, diasCorreccion: dias });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5 text-[#002C63]" />
          Plazo de Corrección
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Días que tiene el residente para corregir un ítem desde su fecha de alta. Se muestra en los pines del plano.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={365}
              value={dias}
              onChange={(e) => setDias(parseInt(e.target.value) || 8)}
              className="w-20 text-center font-semibold"
            />
            <span className="text-sm text-muted-foreground">días</span>
          </div>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || dias === proyecto?.diasCorreccion}
            size="sm"
            className="bg-[#002C63] hover:bg-[#002C63]/90"
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Guardar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Actual: <strong>{proyecto?.diasCorreccion || 8} días</strong></p>
      </CardContent>
    </Card>
  );
}

// ==================== COMPONENTE PINES MANAGER ====================
function PinesManager({ proyectoId }: { proyectoId: number }) {
  const [, navigate] = useLocation();
  // Form state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPlano, setEditingPlano] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [nivel, setNivel] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [imagenBase64, setImagenBase64] = useState('');
  const [imagenNombre, setImagenNombre] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [deletePlanoId, setDeletePlanoId] = useState<number | null>(null);

  // CERRAR VISOR al cambiar de proyecto — aislamiento agresivo
  useEffect(() => {
    setViewerPlano(null);
    setPinMode(false);
    setSelectedPin(null);
    setShowAddDialog(false);
    setEditingPlano(null);
  }, [proyectoId]);

  // Viewer/pin state
  const [viewerPlano, setViewerPlano] = useState<any>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pinMode, setPinMode] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [selectedPin, setSelectedPin] = useState<any>(null);
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [pendingPinPos, setPendingPinPos] = useState<{ x: number; y: number } | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [pinNota, setPinNota] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);

  // Queries
  const { data: planos, isLoading, refetch } = trpc.planos.listar.useQuery(
    { proyectoId },
    { enabled: !!proyectoId }
  );
  const { data: pinesData, refetch: refetchPines } = trpc.planos.pines.listar.useQuery(
    { planoId: viewerPlano?.id! },
    { enabled: !!viewerPlano?.id }
  );
  const { data: itemsData } = trpc.items.list.useQuery(
    { proyectoId, limit: 500, offset: 0 },
    { enabled: !!proyectoId && !!viewerPlano }
  );

  // Mutations planos
  const crearPlano = trpc.planos.crear.useMutation({
    onSuccess: () => { toast.success('Nivel añadido'); refetch(); resetForm(); setShowAddDialog(false); },
    onError: (e: any) => toast.error(e.message || 'Error'),
  });
  const actualizarPlano = trpc.planos.actualizar.useMutation({
    onSuccess: () => { toast.success('Nivel actualizado'); refetch(); setEditingPlano(null); resetForm(); },
    onError: (e: any) => toast.error(e.message || 'Error'),
  });
  const eliminarPlano = trpc.planos.eliminar.useMutation({
    onSuccess: () => { toast.success('Nivel eliminado'); refetch(); setDeletePlanoId(null); },
    onError: (e: any) => toast.error(e.message || 'Error'),
  });

  // Mutations pines
  const crearPin = trpc.planos.pines.crear.useMutation({
    onSuccess: () => { refetchPines(); toast.success('Pin agregado'); setShowItemSelector(false); setPendingPinPos(null); setPinNota(''); },
    onError: (e: any) => toast.error(e.message),
  });
  const eliminarPin = trpc.planos.pines.eliminar.useMutation({
    onSuccess: () => { refetchPines(); toast.success('Pin eliminado'); setSelectedPin(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const pines = pinesData || [];
  const planosList = planos || [];

  const allItems = useMemo(() => {
    const list = (itemsData as any)?.items || itemsData || [];
    return Array.isArray(list) ? list : [];
  }, [itemsData]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return allItems.slice(0, 30);
    const q = itemSearch.toLowerCase();
    return allItems.filter((it: any) =>
      it.codigo?.toLowerCase().includes(q) ||
      it.titulo?.toLowerCase().includes(q) ||
      String(it.numeroInterno || '').includes(q)
    ).slice(0, 30);
  }, [allItems, itemSearch]);

  const resetForm = () => {
    setNombre(''); setNivel(''); setDescripcion(''); setImagenBase64(''); setImagenNombre(''); setPreviewUrl('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Solo imágenes'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('Máximo 15MB'); return; }
    setImagenNombre(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => { const b = ev.target?.result as string; setImagenBase64(b); setPreviewUrl(b); };
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    if (!nombre.trim()) { toast.error('Ingresa nombre del nivel'); return; }
    if (!imagenBase64) { toast.error('Selecciona imagen del plano'); return; }
    crearPlano.mutate({ proyectoId, nombre: nombre.trim(), nivel: nivel ? parseInt(nivel) : 0, descripcion: descripcion.trim() || undefined, imagenBase64, imagenNombre });
  };

  const handleUpdate = () => {
    if (!editingPlano || !nombre.trim()) return;
    actualizarPlano.mutate({ id: editingPlano.id, nombre: nombre.trim(), nivel: nivel ? parseInt(nivel) : 0, descripcion: descripcion.trim() || undefined });
  };

  const openEdit = (plano: any) => {
    setEditingPlano(plano); setNombre(plano.nombre); setNivel(plano.nivel?.toString() || ''); setDescripcion(plano.descripcion || ''); setPreviewUrl(plano.imagenUrl || '');
  };

  const openViewer = (plano: any) => {
    setViewerPlano(plano); setZoom(1); setPan({ x: 0, y: 0 }); setPinMode(false); setSelectedPin(null); setShowPins(true);
  };

  const closeViewer = () => { setViewerPlano(null); setPinMode(false); setSelectedPin(null); };

  // Pin click on plano
  const handlePlanoClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode || isDragging) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    setPendingPinPos({ x, y }); setItemSearch(''); setPinNota(''); setShowItemSelector(true);
  }, [pinMode, isDragging]);

  const confirmPin = (itemId?: number) => {
    if (!pendingPinPos || !viewerPlano) return;
    crearPin.mutate({ planoId: viewerPlano.id, itemId, posX: pendingPinPos.x.toFixed(4), posY: pendingPinPos.y.toFixed(4), nota: pinNota.trim() || undefined });
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => { if (pinMode) return; setIsDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); };
  const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging || pinMode) return; setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
  const handleMouseUp = () => setIsDragging(false);
  const handleTouchStart = (e: React.TouchEvent) => { if (pinMode || e.touches.length !== 1) return; setIsDragging(true); setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y }); };
  const handleTouchMove = (e: React.TouchEvent) => { if (!isDragging || e.touches.length !== 1 || pinMode) return; setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y }); };
  const handleTouchEnd = () => setIsDragging(false);
  const handleWheel = (e: React.WheelEvent) => { e.preventDefault(); setZoom(prev => Math.max(0.2, Math.min(5, prev + (e.deltaY > 0 ? -0.1 : 0.1)))); };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-5 w-5 text-emerald-600" />
              Pines
            </CardTitle>
            <Button
              size="sm"
              onClick={() => { resetForm(); setShowAddDialog(true); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
            >
              <Plus className="h-4 w-4" /> Añadir Nivel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sube la imagen del plano de cada nivel. Toca la miniatura para abrir el plano y colocar pines sobre él.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          )}

          {!isLoading && planosList.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
              <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">Sin niveles cargados</p>
              <p className="text-xs text-slate-400 mt-1">Añade el primer nivel con su plano para comenzar a marcar ubicaciones</p>
            </div>
          )}

          {!isLoading && planosList.length > 0 && (
            <div className="space-y-3">
              {planosList.map((plano: any) => (
                <div
                  key={plano.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
                >
                  {/* Thumbnail - tamaño foto de ítem, clickeable para abrir modal */}
                  <button
                    onClick={() => openViewer(plano)}
                    className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border-2 border-slate-200 hover:border-emerald-500 transition-colors relative group"
                  >
                    <img src={plano.imagenUrl} alt={plano.nombre} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow-lg transition-opacity" />
                    </div>
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800 truncate">{plano.nombre}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700">
                        Nivel {plano.nivel ?? 0}
                      </Badge>
                    </div>
                    {plano.descripcion && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{plano.descripcion}</p>
                    )}
                    <button
                      onClick={() => openViewer(plano)}
                      className="mt-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3" /> Abrir plano y colocar pines
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(plano)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeletePlanoId(plano.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== MODAL VISOR DE PLANO CON PINES ========== */}
      {viewerPlano && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 bg-black/80 text-white gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={closeViewer} className="p-2 hover:bg-white/10 rounded-lg flex-shrink-0">
                <XIcon className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <span className="font-semibold text-sm truncate block">{viewerPlano.nombre}</span>
                <span className="text-xs text-white/60">Nivel {viewerPlano.nivel ?? 0} — {pines.length} pin{pines.length !== 1 ? 'es' : ''}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => setShowPins(p => !p)} className={`p-2 rounded-lg transition-colors ${showPins ? 'bg-emerald-600' : 'hover:bg-white/10'}`} title={showPins ? 'Ocultar pines' : 'Mostrar pines'}>
                {showPins ? <MapPin className="w-4 h-4" /> : <MapPinOff className="w-4 h-4" />}
              </button>
              <button onClick={() => { setPinMode(p => !p); setSelectedPin(null); }} className={`p-2 rounded-lg transition-colors ${pinMode ? 'bg-red-500 animate-pulse' : 'hover:bg-white/10'}`} title={pinMode ? 'Cancelar' : 'Agregar pin'}>
                <Plus className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-white/20 mx-1" />
              <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} className="p-2 hover:bg-white/10 rounded-lg"><ZoomOut className="w-4 h-4" /></button>
              <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(5, z + 0.2))} className="p-2 hover:bg-white/10 rounded-lg"><ZoomIn className="w-4 h-4" /></button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-2 hover:bg-white/10 rounded-lg"><RotateCcw className="w-4 h-4" /></button>
            </div>
          </div>

          {pinMode && (
            <div className="bg-red-500 text-white text-center py-1.5 text-sm font-medium animate-pulse">
              Toca sobre el plano para colocar un pin
            </div>
          )}

          {/* Image area con pines */}
          <div
            className={`flex-1 overflow-hidden select-none ${pinMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            <div className="w-full h-full flex items-center justify-center relative" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: isDragging ? 'none' : 'transform 0.1s' }}>
              <div className="relative" onClick={handlePlanoClick}>
                <img ref={imgRef} src={viewerPlano.imagenUrl} alt={viewerPlano.nombre} className="max-w-none" style={{ maxHeight: '85vh', maxWidth: '95vw', objectFit: 'contain' }} draggable={false} />

                {/* Pines pequeños proporcionales */}
                {showPins && pines.map((pin: any) => {
                  const estado = pin.itemEstado || 'sin_item';
                  const colors = PIN_COLORS[estado] || PIN_COLORS.sin_item;
                  const isSelected = selectedPin?.id === pin.id;
                  return (
                    <div
                      key={pin.id}
                      className="absolute"
                      style={{ left: `${parseFloat(pin.posX)}%`, top: `${parseFloat(pin.posY)}%`, transform: 'translate(-50%, -100%)', zIndex: isSelected ? 50 : 10 }}
                      onClick={(e) => { e.stopPropagation(); setSelectedPin(isSelected ? null : pin); }}
                    >
                      <div style={{ filter: isSelected ? 'drop-shadow(0 0 6px rgba(255,255,255,0.8))' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
                        <svg width="18" height="24" viewBox="0 0 28 36" fill="none">
                          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill={colors.bg} stroke={colors.border} strokeWidth="2"/>
                          <circle cx="14" cy="13" r="5" fill="white" fillOpacity="0.9"/>
                          <text x="14" y="16" textAnchor="middle" fontSize="8" fontWeight="bold" fill={colors.bg}>
                            {pin.itemConsecutivo || '#'}
                          </text>
                        </svg>
                      </div>

                      {/* Tooltip */}
                      {isSelected && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white rounded-lg shadow-xl border border-slate-200 p-2.5 min-w-[200px] max-w-[280px] z-50" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-start gap-2">
                            {pin.itemFotoAntes && <img src={pin.itemFotoAntes} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />}
                            <div className="min-w-0 flex-1">
                              {pin.itemCodigo && <p className="text-xs font-bold text-slate-800 truncate">{pin.itemCodigo}</p>}
                              {pin.itemConsecutivo && <p className="text-xs text-slate-500">#{pin.itemConsecutivo}</p>}
                              {pin.itemDescripcion && <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{pin.itemDescripcion}</p>}
                              {pin.nota && !pin.itemId && <p className="text-xs text-slate-600 mt-0.5 italic">{pin.nota}</p>}
                              {pin.itemEstado && (
                                <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.bg + '20', color: colors.bg }}>
                                  {pin.itemEstado.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
                            {pin.itemId && (
                              <button onClick={() => navigate(`/items/${pin.itemId}`)} className="flex-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded px-2 py-1 font-medium flex items-center justify-center gap-1">
                                <Eye className="w-3 h-3" /> Ver ítem
                              </button>
                            )}
                            <button onClick={() => { if (confirm('¿Eliminar este pin?')) eliminarPin.mutate({ id: pin.id }); }} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded px-2 py-1 font-medium flex items-center justify-center gap-1">
                              <Trash2 className="w-3 h-3" /> Quitar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom: thumbnails de niveles */}
          {planosList.length > 1 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-black/80 overflow-x-auto">
              {planosList.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => { openViewer(p); }}
                  className={`flex-shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-all ${
                    p.id === viewerPlano.id ? 'border-emerald-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog: Seleccionar ítem para pin */}
      <Dialog open={showItemSelector} onOpenChange={(open) => { if (!open) { setShowItemSelector(false); setPendingPinPos(null); } }}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              Vincular Pin a Ítem
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div>
              <label className="text-xs font-medium text-slate-600">Nota (opcional)</label>
              <Input value={pinNota} onChange={e => setPinNota(e.target.value)} placeholder="Nota del pin..." />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Buscar ítem para vincular</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Código, título o #consecutivo..." className="pl-8" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto border rounded-lg divide-y max-h-[300px]">
              {filteredItems.map((item: any) => {
                const estado = item.status || 'pendiente_foto_despues';
                const colors = PIN_COLORS[estado] || PIN_COLORS.sin_item;
                return (
                  <button key={item.id} onClick={() => confirmPin(item.id)} className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex items-center gap-2">
                    {item.fotoAntesUrl && <img src={item.fotoAntesUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{item.codigo}</p>
                      <p className="text-[10px] text-slate-500 truncate">{item.titulo}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors.bg + '20', color: colors.bg }}>#{item.numeroInterno}</span>
                  </button>
                );
              })}
              {filteredItems.length === 0 && <div className="text-center py-6 text-sm text-slate-400">No se encontraron ítems</div>}
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" onClick={() => { setShowItemSelector(false); setPendingPinPos(null); }} className="flex-1">Cancelar</Button>
            <Button onClick={() => confirmPin()} className="flex-1 bg-slate-600 hover:bg-slate-700 text-white">Pin sin ítem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Añadir Nivel */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-emerald-600" />
              Añadir Nivel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nombre del nivel *</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Planta Baja, Nivel 1, Azotea" />
            </div>
            <div>
              <Label className="text-xs">Número de nivel</Label>
              <Input type="number" value={nivel} onChange={e => setNivel(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">Descripción (opcional)</Label>
              <Input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción del nivel" />
            </div>
            <div>
              <Label className="text-xs">Imagen del plano *</Label>
              <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="pines-file-input" />
              {previewUrl ? (
                <div className="relative mt-1">
                  <img src={previewUrl} alt="Preview" className="w-full h-40 object-contain bg-slate-50 rounded-lg border" />
                  <button onClick={() => { setPreviewUrl(''); setImagenBase64(''); setImagenNombre(''); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button onClick={() => document.getElementById('pines-file-input')?.click()} className="mt-1 w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors">
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                  <span className="text-sm text-slate-500">Toca para seleccionar imagen</span>
                  <span className="text-xs text-slate-400">JPG, PNG, WebP — máx 15MB</span>
                </button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={crearPlano.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {crearPlano.isPending ? 'Subiendo...' : 'Añadir Nivel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Nivel */}
      <Dialog open={!!editingPlano} onOpenChange={(open) => { if (!open) setEditingPlano(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              Editar Nivel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {previewUrl && (
              <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-50 border">
                <img src={previewUrl} alt="Plano" className="w-full h-full object-contain" />
              </div>
            )}
            <div>
              <Label className="text-xs">Nombre del nivel *</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Número de nivel</Label>
              <Input type="number" value={nivel} onChange={e => setNivel(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Descripción</Label>
              <Input value={descripcion} onChange={e => setDescripcion(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlano(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={actualizarPlano.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {actualizarPlano.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <AlertDialog open={!!deletePlanoId} onOpenChange={(open) => { if (!open) setDeletePlanoId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este nivel?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el plano y todos los pines asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deletePlanoId) eliminarPlano.mutate({ id: deletePlanoId }); }} className="bg-red-600 hover:bg-red-700 text-white">
              {eliminarPlano.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
