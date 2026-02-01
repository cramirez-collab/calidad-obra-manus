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
  MessageCircle,
  ExternalLink,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Users
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

const configDefaults: Omit<ConfigItem, 'valor' | 'descripcion'>[] = [
  { clave: 'nombre_empresa', icon: Building2, tipo: 'text', soloSuperadmin: false },
  { clave: 'dias_alerta_pendiente', icon: Clock, tipo: 'number', soloSuperadmin: false },
  { clave: 'notificaciones_email', icon: Bell, tipo: 'boolean', soloSuperadmin: false },
  { clave: 'tema_color', icon: Palette, tipo: 'text', soloSuperadmin: false },
  { clave: 'requiere_comentario_rechazo', icon: Shield, tipo: 'boolean', soloSuperadmin: false },
  { clave: 'max_items_por_pagina', icon: Settings, tipo: 'number', soloSuperadmin: true },
];

const configLabels: Record<string, string> = {
  nombre_empresa: 'Nombre de Empresa',
  dias_alerta_pendiente: 'Días para Alerta',
  notificaciones_email: 'Notificaciones Email',
  tema_color: 'Color del Tema',
  requiere_comentario_rechazo: 'Comentario al Rechazar',
  max_items_por_pagina: 'Ítems por Página',
};

const configDescriptions: Record<string, string> = {
  nombre_empresa: 'Nombre que aparece en reportes',
  dias_alerta_pendiente: 'Días antes de alertar ítems pendientes',
  notificaciones_email: 'Enviar notificaciones por correo',
  tema_color: 'Color principal de la interfaz',
  requiere_comentario_rechazo: 'Obligar comentario al rechazar',
  max_items_por_pagina: 'Cantidad máxima de ítems en listas',
};

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

  // WhatsApp config
  const { data: whatsappConfig, refetch: refetchWhatsapp } = trpc.whatsapp.getConfig.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId && isAdmin }
  );
  
  const { data: reportePreview, refetch: refetchReporte, isLoading: isLoadingReporte } = trpc.whatsapp.generarReporte.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: false } // Solo se ejecuta manualmente
  );

  const saveWhatsappMutation = trpc.whatsapp.saveConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuración de WhatsApp guardada");
      refetchWhatsapp();
    },
    onError: (error) => {
      toast.error(error.message || "Error al guardar configuración de WhatsApp");
    }
  });

  const enviarReporteMutation = trpc.whatsapp.enviarReporte.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        if (result.enlace) {
          // Abrir enlace de WhatsApp
          window.open(result.enlace, '_blank');
          toast.success("Enlace de WhatsApp generado. Se abrirá en una nueva pestaña.");
        } else {
          toast.success("Reporte enviado exitosamente");
        }
      } else {
        toast.error(result.mensaje);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Error al enviar reporte");
    }
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  const [whatsappNumero, setWhatsappNumero] = useState('');
  const [showReportePreview, setShowReportePreview] = useState(false);
  
  // Días y horarios para reportes automáticos
  const [diasReporte, setDiasReporte] = useState<string[]>(['lunes', 'martes', 'miercoles', 'jueves', 'viernes']);
  const [horaReporte, setHoraReporte] = useState('18:00');
  
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

  useEffect(() => {
    if (whatsappConfig) {
      setWhatsappUrl(whatsappConfig.grupoUrl || '');
      setWhatsappApiKey(whatsappConfig.apiKey || '');
      setWhatsappNumero(whatsappConfig.numeroDestino || '');
      // Parsear días de reporte desde JSON
      if (whatsappConfig.diasReporte) {
        try {
          const dias = JSON.parse(whatsappConfig.diasReporte);
          if (Array.isArray(dias) && dias.length > 0) {
            setDiasReporte(dias);
          }
        } catch {
          // Si no es JSON válido, usar default
        }
      }
      if (whatsappConfig.horaReporte) {
        setHoraReporte(whatsappConfig.horaReporte);
      }
    }
  }, [whatsappConfig]);

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

  const handleSaveWhatsapp = () => {
    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto primero");
      return;
    }
    if (!whatsappUrl) {
      toast.error("Ingresa el enlace del grupo de WhatsApp");
      return;
    }
    if (diasReporte.length === 0) {
      toast.error("Selecciona al menos un día para enviar reportes");
      return;
    }
    saveWhatsappMutation.mutate({
      proyectoId: selectedProjectId,
      grupoUrl: whatsappUrl,
      apiKey: whatsappApiKey || undefined,
      numeroDestino: whatsappNumero || undefined,
      diasReporte: diasReporte,
      horaReporte: horaReporte,
    });
  };

  const toggleDia = (dia: string) => {
    setDiasReporte(prev => 
      prev.includes(dia) 
        ? prev.filter(d => d !== dia)
        : [...prev, dia]
    );
  };

  const diasSemana = [
    { id: 'lunes', label: 'Lun' },
    { id: 'martes', label: 'Mar' },
    { id: 'miercoles', label: 'Mié' },
    { id: 'jueves', label: 'Jue' },
    { id: 'viernes', label: 'Vie' },
    { id: 'sabado', label: 'Sáb' },
    { id: 'domingo', label: 'Dom' },
  ];

  const handlePreviewReporte = () => {
    setShowReportePreview(true);
    refetchReporte();
  };

  const handleEnviarReporte = () => {
    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto primero");
      return;
    }
    enviarReporteMutation.mutate({ proyectoId: selectedProjectId });
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

        {/* Sección Alta Rápida */}
        <Card className="mt-6 border-primary/20 bg-primary/5">
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

        {/* Sección WhatsApp - Reportes Automáticos (Solo Admin) */}
        {isAdmin && selectedProjectId && (
          <Card className="mt-6 border-green-500/20 bg-green-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-5 w-5 text-green-600" />
                WhatsApp - Reportes Automáticos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configura el enlace del grupo de WhatsApp para recibir reportes automáticos de actividad de residentes.
              </p>
              
              <div className="space-y-3">
                {/* Enlace del grupo */}
                <div className="space-y-2">
                  <Label htmlFor="whatsappUrl" className="text-sm font-medium">Enlace del Grupo de WhatsApp</Label>
                  <div className="flex gap-2">
                    <Input
                      id="whatsappUrl"
                      type="url"
                      value={whatsappUrl}
                      onChange={(e) => setWhatsappUrl(e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className="flex-1"
                    />
                    {whatsappUrl && (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => window.open(whatsappUrl, '_blank')}
                        className="h-10 w-10"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pega el enlace de invitación del grupo donde quieres recibir los reportes.
                  </p>
                </div>

                {/* API Key (opcional) */}
                <div className="space-y-2">
                  <Label htmlFor="whatsappApiKey" className="text-sm font-medium">API Key de TextMeBot (Opcional)</Label>
                  <Input
                    id="whatsappApiKey"
                    type="password"
                    value={whatsappApiKey}
                    onChange={(e) => setWhatsappApiKey(e.target.value)}
                    placeholder="Tu API Key de TextMeBot"
                  />
                  <p className="text-xs text-muted-foreground">
                    Obtén tu API Key en <a href="https://textmebot.com" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">textmebot.com</a> para enviar reportes automáticos.
                  </p>
                </div>

                {/* Número de teléfono destino (requerido si hay API Key) */}
                {whatsappApiKey && (
                  <div className="space-y-2">
                    <Label htmlFor="whatsappNumero" className="text-sm font-medium">Número de Teléfono Destino</Label>
                    <Input
                      id="whatsappNumero"
                      type="tel"
                      value={whatsappNumero}
                      onChange={(e) => setWhatsappNumero(e.target.value)}
                      placeholder="+52 1 33 1234 5678"
                    />
                    <p className="text-xs text-muted-foreground">
                      Número de WhatsApp donde se enviarán los reportes automáticos (incluye código de país).
                    </p>
                  </div>
                )}

                {/* Días de envío */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Días de Envío
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {diasSemana.map((dia) => (
                      <button
                        key={dia.id}
                        type="button"
                        onClick={() => toggleDia(dia.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          diasReporte.includes(dia.id)
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {dia.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecciona los días en que deseas recibir el reporte automático.
                  </p>
                </div>

                {/* Hora de envío */}
                <div className="space-y-2">
                  <Label htmlFor="horaReporte" className="text-sm font-medium">Hora de Envío</Label>
                  <Input
                    id="horaReporte"
                    type="time"
                    value={horaReporte}
                    onChange={(e) => setHoraReporte(e.target.value)}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Hora local (Ciudad de México) en que se enviará el reporte.
                  </p>
                </div>

                {/* Botones de acción */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={handleSaveWhatsapp}
                    disabled={saveWhatsappMutation.isPending || !whatsappUrl}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4" />
                    {saveWhatsappMutation.isPending ? "Guardando..." : "Guardar Configuración"}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handlePreviewReporte}
                    disabled={isLoadingReporte}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingReporte ? 'animate-spin' : ''}`} />
                    Vista Previa
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleEnviarReporte}
                    disabled={enviarReporteMutation.isPending || !whatsappUrl}
                    className="gap-2 border-green-500 text-green-600 hover:bg-green-50"
                  >
                    <Send className="h-4 w-4" />
                    {enviarReporteMutation.isPending ? "Enviando..." : "Enviar Ahora"}
                  </Button>
                </div>
              </div>

              {/* Vista previa del reporte */}
              {showReportePreview && reportePreview && (
                <div className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm">Vista Previa del Reporte</span>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-x-auto">
                    {reportePreview.mensaje}
                  </pre>
                  
                  {/* Resumen de estadísticas */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
                    <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded text-xs">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>{reportePreview.reporte.sinCapturarCalidad.length} sin calidad</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950/30 rounded text-xs">
                      <XCircle className="h-4 w-4 text-orange-500" />
                      <span>{reportePreview.reporte.sinCapturarSecuencias.length} sin secuencias</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded text-xs">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span>{reportePreview.reporte.conPendientesMas3Dias.length} pendientes +3d</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded text-xs">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span>{reportePreview.reporte.conRechazadosMas3Dias.length} rechazados +3d</span>
                    </div>
                    {reportePreview.reporte.tiempoPromedioGlobal && (
                      <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span>⏱️ {reportePreview.reporte.tiempoPromedioGlobal < 24 
                          ? `${Math.round(reportePreview.reporte.tiempoPromedioGlobal)} hrs` 
                          : `${Math.round(reportePreview.reporte.tiempoPromedioGlobal / 24 * 10) / 10} días`} prom.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Horarios */}
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-xs text-green-700 dark:text-green-300">
                <strong>Horarios de reportes:</strong> L-V: 9am, 12pm, 5pm | Sábados: 9am, 12pm | Domingos: No se envían
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mensaje si no hay proyecto seleccionado */}
        {isAdmin && !selectedProjectId && (
          <Card className="mt-6 border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Selecciona un proyecto para configurar los reportes de WhatsApp.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/50 rounded-lg p-3">
          <Info className="h-4 w-4 shrink-0" />
          <span>Los cambios se aplican inmediatamente</span>
        </div>
      </div>
    </DashboardLayout>
  );
}
