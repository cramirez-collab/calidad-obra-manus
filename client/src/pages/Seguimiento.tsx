import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { getImageUrl } from "@/lib/imageUrl";
import { 
  Camera, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Building2,
  MapPin,
  Wrench,
  Calendar,
  ClipboardCheck,
  Upload,
  Check,
  X
} from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { compressAdaptive } from "@/lib/imageCompression";
import { subirConRetry } from "@/lib/uploadQueue";

const statusLabels: Record<string, string> = {
  pendiente_foto_despues: "En Proceso - Pendiente Corrección",
  pendiente_aprobacion: "Corregido - Pendiente Aprobación",
  aprobado: "Aprobado - Completado",
  rechazado: "Rechazado - Requiere Atención",
};

const statusDescriptions: Record<string, string> = {
  pendiente_foto_despues: "El problema ha sido registrado y está pendiente de corrección por el equipo de obra.",
  pendiente_aprobacion: "La corrección ha sido realizada y está pendiente de aprobación por el supervisor.",
  aprobado: "El problema ha sido corregido y aprobado satisfactoriamente.",
  rechazado: "La corrección no fue aprobada y requiere atención adicional.",
};

const statusColors: Record<string, string> = {
  pendiente_foto_despues: "bg-amber-100 text-amber-800 border-amber-200",
  pendiente_aprobacion: "bg-blue-100 text-blue-800 border-blue-200",
  aprobado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rechazado: "bg-red-100 text-red-800 border-red-200",
};

const statusIcons: Record<string, typeof Clock> = {
  pendiente_foto_despues: Clock,
  pendiente_aprobacion: Camera,
  aprobado: CheckCircle2,
  rechazado: XCircle,
};

export default function Seguimiento() {
  const { codigo } = useParams<{ codigo: string }>();
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Redirigir a login si no está autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      // Redirigir a la página de login
      window.location.href = getLoginUrl();
    }
  }, [user, authLoading]);
  
  const [fotoDespues, setFotoDespues] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUploadSection, setShowUploadSection] = useState(false);

  const utils = trpc.useUtils();
  const { data: item, isLoading, error } = trpc.items.getByCodigo.useQuery(
    { codigo: codigo || "" },
    { enabled: !!codigo }
  );

  const uploadFotoDespuesMutation = trpc.items.uploadFotoDespues.useMutation({
    onSuccess: () => {
      utils.items.getByCodigo.invalidate({ codigo: codigo || "" });
      toast.success("Foto después agregada correctamente");
      setFotoDespues(null);
      setShowUploadSection(false);
    },
    onError: (error) => {
      const msg = error.message?.length > 100 ? 'Error al subir foto. Intenta de nuevo.' : error.message;
      toast.error(msg);
    },
  });

  const aprobarMutation = trpc.items.aprobar.useMutation({
    onSuccess: () => {
      utils.items.getByCodigo.invalidate({ codigo: codigo || "" });
      toast.success("Ítem aprobado correctamente");
    },
    onError: (error) => {
      const msg = error.message?.length > 100 ? 'Error al aprobar. Intenta de nuevo.' : error.message;
      toast.error(msg);
    },
  });

  const rechazarMutation = trpc.items.rechazar.useMutation({
    onSuccess: () => {
      utils.items.getByCodigo.invalidate({ codigo: codigo || "" });
      toast.success("Ítem rechazado");
    },
    onError: (error) => {
      const msg = error.message?.length > 100 ? 'Error al rechazar. Intenta de nuevo.' : error.message;
      toast.error(msg);
    },
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${mins}`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Usar compresión adaptativa según velocidad de conexión
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const result = await compressAdaptive(base64);
        console.log(`[Foto Después] Conexión: ${result.connectionLabel}, ${result.originalSizeKB}KB → ${result.compressedSizeKB}KB`);
        setFotoDespues(result.compressed);
      } catch (error) {
        console.error('Error comprimiendo imagen:', error);
        // Fallback: usar imagen original
        setFotoDespues(event.target?.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadFotoDespues = async () => {
    if (!fotoDespues || !item) {
      toast.error("Selecciona una foto");
      return;
    }
    setIsSubmitting(true);
    try {
      toast.info("Subiendo foto...");
      const { success } = await subirConRetry(
        () => uploadFotoDespuesMutation.mutateAsync({
          itemId: item.id,
          fotoBase64: fotoDespues,
        }),
        {
          itemId: item.id,
          tipo: 'foto_despues',
          foto: fotoDespues,
          comentario: undefined,
        },
        5 // 5 intentos con backoff antes de guardar en cola
      );

      if (success) {
        toast.success("\u00a1Foto subida exitosamente!");
        utils.items.getByCodigo.invalidate({ codigo: codigo || "" });
        setFotoDespues(null);
        setShowUploadSection(false);
      } else {
        toast.warning("Foto guardada localmente. Se subir\u00e1 autom\u00e1ticamente cuando mejore la conexi\u00f3n.", { duration: 6000 });
        setFotoDespues(null);
        setShowUploadSection(false);
      }
    } catch (error: any) {
      toast.error("No se pudo guardar la foto. Verifica tu conexi\u00f3n e intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAprobar = async () => {
    if (!item) return;
    setIsSubmitting(true);
    try {
      await aprobarMutation.mutateAsync({ itemId: item.id });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRechazar = async () => {
    if (!item) return;
    setIsSubmitting(true);
    try {
      await rechazarMutation.mutateAsync({ itemId: item.id, comentario: "Rechazado desde QR" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determinar permisos del usuario
  // Solo superadmin, admin, supervisor y jefe_residente pueden subir foto después
  // Residente NO puede subir foto después
  const canUploadFotoDespues = user && (
    user.role === "superadmin" || 
    user.role === "admin" || 
    user.role === "supervisor" ||
    user.role === "jefe_residente"
  );

  const canValidate = user && (
    user.role === "admin" || 
    user.role === "superadmin" || 
    user.role === "supervisor"
  );

  // Mostrar loading mientras se verifica autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario, mostrar mensaje (el useEffect redirigirá a login)
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
            <p className="text-muted-foreground mb-4">
              Debes iniciar sesión para ver la información de este código QR.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirigiendo al inicio de sesión...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <Camera className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Etiqueta Nueva</h2>
            <p className="text-muted-foreground mb-2">
              Esta etiqueta QR aún no tiene un ítem asignado.
            </p>
            <p className="text-sm text-muted-foreground font-mono mb-4 bg-muted px-3 py-1 rounded inline-block">
              {codigo}
            </p>
            <div className="space-y-3 mt-6">
              <Button 
                className="w-full bg-[#02B381] hover:bg-[#029970] text-white"
                onClick={() => setLocation(`/nuevo-item?qr=${encodeURIComponent(codigo || '')}`)}
              >
                <Camera className="h-4 w-4 mr-2" />
                Crear Ítem con esta Etiqueta
              </Button>
              <p className="text-xs text-muted-foreground">
                Al crear el ítem, se vinculará automáticamente con esta etiqueta QR
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = statusIcons[item.status];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container max-w-3xl py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-6 w-6 text-primary" />
              <div>
                <h1 className="font-semibold">Control de Calidad</h1>
                <p className="text-xs text-muted-foreground">Seguimiento de Ítem</p>
              </div>
            </div>
            <Badge variant="outline" className="font-mono">
              {item.codigo} <span className="text-[#02B381] font-bold">#{item.numeroInterno || '-'}</span>
            </Badge>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-6 space-y-6">
        {/* Status Card */}
        <Card className={`border-2 ${statusColors[item.status].replace('bg-', 'border-').replace('-100', '-300')}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full ${statusColors[item.status]}`}>
                <StatusIcon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{statusLabels[item.status]}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusDescriptions[item.status]}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Acciones rápidas para usuarios autenticados */}
        {user && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Acciones Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Subir foto después */}
              {item.status === "pendiente_foto_despues" && canUploadFotoDespues && (
                <div className="space-y-3">
                  {!showUploadSection ? (
                    <Button 
                      onClick={() => setShowUploadSection(true)}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Subir Foto Después (Corrección)
                    </Button>
                  ) : (
                    <div className="space-y-3 p-4 bg-white rounded-lg border">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                      />
                      <input
                        type="file"
                        ref={galleryInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        className="hidden"
                      />
                      
                      {fotoDespues ? (
                        <div className="space-y-3">
                          <img 
                            src={getImageUrl(fotoDespues)} 
                            alt="Preview" 
                            className="w-full max-h-48 object-contain rounded-lg border"
                          />
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              className="flex-1"
                              onClick={() => {
                                setFotoDespues(null);
                                setShowUploadSection(false);
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              className="flex-1"
                              onClick={handleUploadFotoDespues}
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? "Subiendo..." : "Confirmar"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            variant="outline" 
                            className="h-24 border-dashed border-emerald-300 hover:bg-emerald-50"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <div className="text-center">
                              <Camera className="h-7 w-7 mx-auto mb-1.5 text-emerald-500" />
                              <span className="text-xs font-medium text-emerald-700">Tomar Foto</span>
                            </div>
                          </Button>
                          <Button 
                            variant="outline" 
                            className="h-24 border-dashed border-slate-300 hover:bg-slate-50"
                            onClick={() => galleryInputRef.current?.click()}
                          >
                            <div className="text-center">
                              <Upload className="h-7 w-7 mx-auto mb-1.5 text-slate-400" />
                              <span className="text-xs font-medium text-slate-500">Subir de Galería</span>
                            </div>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Validar (aprobar/rechazar) */}
              {item.status === "pendiente_aprobacion" && canValidate && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={handleRechazar}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Rechazar
                  </Button>
                  <Button 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleAprobar}
                    disabled={isSubmitting}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Aprobar
                  </Button>
                </div>
              )}

              {/* Mensaje si ya está aprobado o rechazado */}
              {(item.status === "aprobado" || item.status === "rechazado") && (
                <p className="text-sm text-muted-foreground text-center">
                  Este ítem ya ha sido {item.status === "aprobado" ? "aprobado" : "rechazado"}.
                </p>
              )}

              {/* Mensaje si no tiene permisos */}
              {!canUploadFotoDespues && !canValidate && (
                <p className="text-sm text-muted-foreground text-center">
                  Inicia sesión para realizar acciones en este ítem.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Item Info */}
        <Card>
          <CardHeader>
            <CardTitle>{item.titulo}</CardTitle>
            {item.descripcion && (
              <CardDescription>{item.descripcion}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground flex-shrink-0">Empresa:</span>
                <span className="font-medium truncate">{item.empresa?.nombre || "-"}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground flex-shrink-0">Unidad:</span>
                <span className="font-medium truncate">{item.unidad?.nombre || "-"}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Wrench className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground flex-shrink-0">Especialidad:</span>
                <span className="font-medium truncate">{item.especialidad?.nombre || "-"}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground flex-shrink-0">Fecha:</span>
                <span className="font-medium truncate">{formatDate(item.fechaCreacion)}</span>
              </div>
            </div>

            {item.ubicacionDetalle && (
              <div className="pt-2 border-t">
                <p className="text-sm">
                  <span className="text-muted-foreground">Ubicación específica: </span>
                  {item.ubicacionDetalle}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader>
            <CardTitle>Evidencia Fotográfica</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Foto Antes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <h4 className="font-medium text-sm">Antes (Problema detectado)</h4>
                </div>
                <div className="aspect-[4/3] rounded-lg overflow-hidden border bg-slate-100">
                  {item.fotoAntesMarcadaUrl || item.fotoAntesUrl ? (
                    <img
                      src={getImageUrl(item.fotoAntesMarcadaUrl || item.fotoAntesUrl || "")}
                      alt="Foto antes"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Camera className="h-12 w-12" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Registrado: {formatDate(item.fechaCreacion)}
                </p>
              </div>

              {/* Foto Después */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <h4 className="font-medium text-sm">Después (Corrección)</h4>
                </div>
                <div className="aspect-[4/3] rounded-lg overflow-hidden border bg-slate-100">
                  {/* Mostrar foto subida (preview) o foto guardada */}
                  {fotoDespues ? (
                    <img
                      src={getImageUrl(fotoDespues)}
                      alt="Foto después (preview)"
                      className="w-full h-full object-contain"
                    />
                  ) : item.fotoDespuesUrl ? (
                    <img
                      src={getImageUrl(item.fotoDespuesUrl)}
                      alt="Foto después"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground flex-col gap-2">
                      <Clock className="h-12 w-12" />
                      <span className="text-sm">Pendiente</span>
                    </div>
                  )}
                </div>
                {fotoDespues && (
                  <p className="text-xs text-emerald-600 font-medium">
                    Vista previa - Confirma para guardar
                  </p>
                )}
                {!fotoDespues && item.fechaFotoDespues && (
                  <p className="text-xs text-muted-foreground">
                    Corregido: {formatDate(item.fechaFotoDespues)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Línea de Tiempo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Creación */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <div className="w-0.5 flex-1 bg-border mt-2" />
                </div>
                <div className="flex-1 pb-4">
                  <p className="font-medium text-sm">Problema Registrado</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(item.fechaCreacion)}
                  </p>
                </div>
              </div>

              {/* Foto después */}
              {item.fechaFotoDespues && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <div className="w-0.5 flex-1 bg-border mt-2" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium text-sm">Corrección Realizada</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.fechaFotoDespues)}
                    </p>
                  </div>
                </div>
              )}

              {/* Aprobación */}
              {item.fechaAprobacion && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`h-3 w-3 rounded-full ${
                      item.status === "aprobado" ? "bg-emerald-500" : "bg-red-500"
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {item.status === "aprobado" ? "Aprobado" : "Rechazado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.fechaAprobacion)}
                    </p>
                  </div>
                </div>
              )}

              {/* Pendiente */}
              {!item.fechaAprobacion && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-slate-300 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-muted-foreground">
                      {item.status === "pendiente_foto_despues" 
                        ? "Pendiente corrección..." 
                        : "Pendiente aprobación..."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>Sistema de Control de Calidad de Obra</p>
          <p className="mt-1">Código de seguimiento: {item.codigo} <span className="text-[#02B381] font-semibold">#{item.numeroInterno || '-'}</span></p>
        </div>
      </main>
    </div>
  );
}
