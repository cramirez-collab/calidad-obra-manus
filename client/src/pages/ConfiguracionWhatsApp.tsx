import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { 
  MessageCircle, 
  Clock, 
  Save, 
  Send, 
  RefreshCw, 
  ExternalLink,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
  Info
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function ConfiguracionWhatsApp() {
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const isAdmin = ['superadmin', 'admin'].includes(user?.role || '');
  
  // Estados para configuración de WhatsApp
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  const [whatsappNumero, setWhatsappNumero] = useState('');
  const [showReportePreview, setShowReportePreview] = useState(false);
  
  // Estados para días y horarios de envío
  const [diasEnvio, setDiasEnvio] = useState<number[]>([1, 2, 3, 4, 5, 6]); // L-S por defecto
  const [horariosEnvio, setHorariosEnvio] = useState<string[]>(['09:00', '12:00', '17:00']);
  
  // Queries y Mutations
  const { data: whatsappConfig, refetch: refetchWhatsapp } = trpc.whatsapp.getConfig.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId && isAdmin }
  );
  
  const { data: reportePreview, refetch: refetchReporte, isLoading: isLoadingReporte } = trpc.whatsapp.generarReporte.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: false }
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

  // Cargar configuración existente
  useEffect(() => {
    if (whatsappConfig) {
      setWhatsappUrl(whatsappConfig.grupoUrl || '');
      setWhatsappApiKey(whatsappConfig.apiKey || '');
      setWhatsappNumero(whatsappConfig.numeroDestino || '');
      if (whatsappConfig.diasEnvio && whatsappConfig.diasEnvio.length > 0) {
        // Parse JSON string to array if needed
        const dias = typeof whatsappConfig.diasEnvio === 'string' 
          ? JSON.parse(whatsappConfig.diasEnvio) 
          : whatsappConfig.diasEnvio;
        setDiasEnvio(dias);
      }
      if (whatsappConfig.horariosEnvio && whatsappConfig.horariosEnvio.length > 0) {
        // Parse JSON string to array if needed
        const horarios = typeof whatsappConfig.horariosEnvio === 'string' 
          ? JSON.parse(whatsappConfig.horariosEnvio) 
          : whatsappConfig.horariosEnvio;
        setHorariosEnvio(horarios);
      }
    }
  }, [whatsappConfig]);

  const handleSaveWhatsapp = () => {
    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto primero");
      return;
    }
    if (!whatsappUrl) {
      toast.error("Ingresa el enlace del grupo de WhatsApp");
      return;
    }
    saveWhatsappMutation.mutate({
      proyectoId: selectedProjectId,
      grupoUrl: whatsappUrl,
      apiKey: whatsappApiKey || undefined,
      numeroDestino: whatsappNumero || undefined,
      diasEnvio: diasEnvio,
      horariosEnvio: horariosEnvio,
    });
  };

  const toggleDia = (dia: number) => {
    setDiasEnvio(prev => 
      prev.includes(dia) 
        ? prev.filter(d => d !== dia) 
        : [...prev, dia].sort((a, b) => a - b)
    );
  };

  const addHorario = () => {
    if (horariosEnvio.length >= 5) {
      toast.error("Máximo 5 horarios permitidos");
      return;
    }
    const nuevoHorario = '12:00';
    if (!horariosEnvio.includes(nuevoHorario)) {
      setHorariosEnvio(prev => [...prev, nuevoHorario].sort());
    }
  };

  const removeHorario = (horario: string) => {
    if (horariosEnvio.length > 1) {
      setHorariosEnvio(prev => prev.filter(h => h !== horario));
    }
  };

  const updateHorario = (index: number, nuevoHorario: string) => {
    setHorariosEnvio(prev => {
      const nuevos = [...prev];
      nuevos[index] = nuevoHorario;
      return nuevos.sort();
    });
  };

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

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
        {/* Header con botón de regreso */}
        <div className="flex items-center gap-3">
          <Link href="/configuracion">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">Configuración Recordatorio</h1>
            <p className="text-xs text-muted-foreground">Reportes automáticos de actividad vía WhatsApp</p>
          </div>
        </div>

        {!selectedProjectId ? (
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Selecciona un proyecto para configurar los reportes de WhatsApp.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Configuración del Grupo */}
            <Card className="border-green-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  Grupo de WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsappUrl" className="text-sm font-medium">Enlace del Grupo</Label>
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
                        className="h-10 w-10 shrink-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pega el enlace de invitación del grupo donde quieres recibir los reportes.
                  </p>
                </div>

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

                <div className="space-y-2">
                  <Label htmlFor="whatsappNumero" className="text-sm font-medium">Número de Teléfono para Reportes</Label>
                  <Input
                    id="whatsappNumero"
                    type="tel"
                    value={whatsappNumero}
                    onChange={(e) => setWhatsappNumero(e.target.value)}
                    placeholder="+52 33 1234 5678"
                  />
                  <p className="text-xs text-muted-foreground">
                    Número de WhatsApp donde se enviarán los reportes automáticos (incluye código de país, ej: +523331283677).
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Configuración de Horarios */}
            <Card className="border-green-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  Días y Horarios de Envío
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Días de envío */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Días de Envío</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { dia: 0, nombre: 'Dom', corto: 'D' },
                      { dia: 1, nombre: 'Lun', corto: 'L' },
                      { dia: 2, nombre: 'Mar', corto: 'M' },
                      { dia: 3, nombre: 'Mié', corto: 'X' },
                      { dia: 4, nombre: 'Jue', corto: 'J' },
                      { dia: 5, nombre: 'Vie', corto: 'V' },
                      { dia: 6, nombre: 'Sáb', corto: 'S' },
                    ].map(({ dia, nombre, corto }) => (
                      <Button
                        key={dia}
                        type="button"
                        variant={diasEnvio.includes(dia) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDia(dia)}
                        className={`w-12 h-10 ${diasEnvio.includes(dia) ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      >
                        <span className="hidden sm:inline">{nombre}</span>
                        <span className="sm:hidden">{corto}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Horarios de envío */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Horarios de Envío</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addHorario}
                      disabled={horariosEnvio.length >= 5}
                      className="h-8 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {horariosEnvio.map((horario, index) => (
                      <div key={index} className="flex items-center gap-1 bg-green-50 dark:bg-green-950/30 rounded-lg p-1">
                        <Input
                          type="time"
                          value={horario}
                          onChange={(e) => updateHorario(index, e.target.value)}
                          className="w-28 h-8 text-sm bg-transparent border-0 focus-visible:ring-0"
                        />
                        {horariosEnvio.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeHorario(horario)}
                            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Los reportes se enviarán automáticamente en estos horarios (máximo 5).
                  </p>
                </div>

                {/* Resumen de configuración */}
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-xs text-green-700 dark:text-green-300">
                  <strong>Configuración actual:</strong>{' '}
                  <span>
                    {diasEnvio.length === 0 ? 'Sin días seleccionados' : 
                      diasEnvio.map(d => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d]).join(', ')}
                  </span>
                  {' | '}
                  <span>
                    {horariosEnvio.length === 0 ? 'Sin horarios' : 
                      horariosEnvio.map(h => {
                        const [hora, min] = h.split(':');
                        const horaNum = parseInt(hora);
                        return `${horaNum > 12 ? horaNum - 12 : horaNum}:${min} ${horaNum >= 12 ? 'PM' : 'AM'}`;
                      }).join(', ')}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Acciones */}
            <Card className="border-green-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="h-4 w-4 text-green-600" />
                  Acciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
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

                {/* Vista previa del reporte */}
                {showReportePreview && reportePreview && (
                  <div className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-lg border">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-sm">Vista Previa del Reporte</span>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap font-mono bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
                      {reportePreview.mensaje}
                    </pre>
                    
                    {/* Resumen de estadísticas */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded text-xs">
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        <span>{reportePreview.reporte.sinCapturarCalidad.length} sin calidad</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950/30 rounded text-xs">
                        <XCircle className="h-4 w-4 text-orange-500 shrink-0" />
                        <span>{reportePreview.reporte.sinCapturarSecuencias.length} sin secuencias</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded text-xs">
                        <Clock className="h-4 w-4 text-yellow-600 shrink-0" />
                        <span>{reportePreview.reporte.conPendientesMas3Dias.length} pendientes +3d</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded text-xs">
                        <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                        <span>{reportePreview.reporte.conRechazadosMas3Dias.length} rechazados +3d</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
