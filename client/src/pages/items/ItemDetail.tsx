import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { ItemChat } from "@/components/ItemChat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, 
  Camera, 
  CheckCircle2, 
  XCircle, 
  Clock,
  QrCode,
  Building2,
  MapPin,
  Wrench,
  User,
  Calendar,
  MessageSquare,
  Upload,
  Trash2
} from "lucide-react";
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
import { useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { toast } from "sonner";
import QRCode from "qrcode";
import { useEffect } from "react";

const statusLabels: Record<string, string> = {
  pendiente_foto_despues: "Pendiente Foto Después",
  pendiente_aprobacion: "Pendiente Aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

const statusColors: Record<string, string> = {
  pendiente_foto_despues: "bg-amber-100 text-amber-800",
  pendiente_aprobacion: "bg-blue-100 text-blue-800",
  aprobado: "bg-emerald-100 text-emerald-800",
  rechazado: "bg-red-100 text-red-800",
};

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const itemId = parseInt(id || "0");

  const [showFotoDespuesDialog, setShowFotoDespuesDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"aprobar" | "rechazar">("aprobar");
  const [comentario, setComentario] = useState("");
  const [fotoDespues, setFotoDespues] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: item, isLoading } = trpc.items.get.useQuery({ id: itemId });
  const { data: historial } = trpc.items.historial.useQuery({ itemId });
  const { data: comentarios, refetch: refetchComentarios } = trpc.comentarios.byItem.useQuery({ itemId });
  const { data: empresas } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined
  );
  const { data: unidades } = trpc.unidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined
  );
  const { data: especialidades } = trpc.especialidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined
  );
  const { data: users } = trpc.users.list.useQuery();
  const { data: defectos } = trpc.defectos.list.useQuery();

  const [nuevoComentario, setNuevoComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  const createComentarioMutation = trpc.comentarios.create.useMutation({
    onSuccess: () => {
      refetchComentarios();
      setNuevoComentario("");
      toast.success("Comentario agregado");
    },
    onError: () => {
      toast.error("Error al agregar comentario");
    },
  });

  const handleAddComentario = async () => {
    if (!nuevoComentario.trim()) return;
    setEnviandoComentario(true);
    try {
      await createComentarioMutation.mutateAsync({
        itemId,
        etapa: item?.status || "general",
        texto: nuevoComentario,
      });
    } finally {
      setEnviandoComentario(false);
    }
  };

  const uploadFotoDespuesMutation = trpc.items.uploadFotoDespues.useMutation({
    onSuccess: () => {
      utils.items.get.invalidate({ id: itemId });
      utils.items.historial.invalidate({ itemId });
      toast.success("Foto después agregada correctamente");
      setShowFotoDespuesDialog(false);
      setFotoDespues(null);
      setComentario("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const aprobarMutation = trpc.items.aprobar.useMutation({
    onSuccess: () => {
      utils.items.get.invalidate({ id: itemId });
      utils.items.historial.invalidate({ itemId });
      toast.success("Ítem aprobado correctamente");
      setShowApprovalDialog(false);
      setComentario("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rechazarMutation = trpc.items.rechazar.useMutation({
    onSuccess: () => {
      utils.items.get.invalidate({ id: itemId });
      utils.items.historial.invalidate({ itemId });
      toast.success("Ítem rechazado");
      setShowApprovalDialog(false);
      setComentario("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Generar QR Code
  useEffect(() => {
    if (item?.codigo) {
      const url = `${window.location.origin}/seguimiento/${item.codigo}`;
      QRCode.toDataURL(url, { width: 200, margin: 2 })
        .then(setQrCodeUrl)
        .catch(console.error);
    }
  }, [item?.codigo]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setFotoDespues(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadFotoDespues = async () => {
    if (!fotoDespues) {
      toast.error("Selecciona una foto");
      return;
    }
    setIsSubmitting(true);
    try {
      await uploadFotoDespuesMutation.mutateAsync({
        itemId,
        fotoBase64: fotoDespues,
        comentario: comentario || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproval = async () => {
    setIsSubmitting(true);
    try {
      if (approvalAction === "aprobar") {
        await aprobarMutation.mutateAsync({
          itemId,
          comentario: comentario || undefined,
        });
      } else {
        if (!comentario.trim()) {
          toast.error("Se requiere un comentario para rechazar");
          setIsSubmitting(false);
          return;
        }
        await rechazarMutation.mutateAsync({
          itemId,
          comentario,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const getEmpresaNombre = (id: number) => empresas?.find(e => e.id === id)?.nombre || "-";
  const getUnidadNombre = (id: number) => unidades?.find(u => u.id === id)?.nombre || "-";
  const getUnidadFechaFin = (id: number) => {
    const unidad = unidades?.find(u => u.id === id);
    return unidad?.fechaFin || null;
  };
  const getEspecialidadInfo = (id: number) => especialidades?.find(e => e.id === id);
  const getUserName = (id: number | null) => {
    if (!id) return "-";
    return users?.find(u => u.id === id)?.name || "-";
  };

  // Solo superadmin, admin, supervisor y jefe_residente pueden subir foto después
  // Residente NO puede subir foto después
  const canAddFotoDespues = item?.status === "pendiente_foto_despues" && 
    ["superadmin", "admin", "supervisor", "jefe_residente"].includes(user?.role || "");
  
  const canApprove = item?.status === "pendiente_aprobacion" && 
    ["admin", "supervisor"].includes(user?.role || "");
  
  // Solo admin, superadmin y supervisor pueden eliminar
  const canDelete = ["admin", "superadmin", "supervisor"].includes(user?.role || "");
  
  const deleteMutation = trpc.items.delete.useMutation({
    onSuccess: () => {
      toast.success('Ítem eliminado correctamente');
      setLocation('/items');
    },
    onError: (error) => {
      toast.error('Error al eliminar: ' + error.message);
    }
  });
  
  const handleDelete = () => {
    deleteMutation.mutate({ id: itemId });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!item) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Ítem no encontrado</p>
          <Button onClick={() => setLocation("/items")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a la lista
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const especialidad = item.especialidadId ? getEspecialidadInfo(item.especialidadId) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/items")} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            
            {/* Clave OQC prominente */}
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-1.5 bg-white border border-[#002C63]/20 text-[#002C63] px-2 py-1 rounded-md shadow-sm">
                <QrCode className="h-3 w-3" />
                <span className="font-mono font-semibold text-sm">{item.codigo}</span>
              </div>
              <Badge className={statusColors[item.status] + " text-sm py-1 px-3"}>
                {statusLabels[item.status]}
              </Badge>
            </div>
            
            {/* Título y badges de información */}
            <h1 className="text-xl font-bold tracking-tight">{item.titulo || 'Sin descripción'}</h1>
            
            {/* Badges informativos */}
            <div className="flex flex-wrap gap-2">
              {item.empresaId && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Building2 className="h-3 w-3 mr-1" />
                  {getEmpresaNombre(item.empresaId)}
                </Badge>
              )}
              {item.unidadId && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <MapPin className="h-3 w-3 mr-1" />
                  {getUnidadNombre(item.unidadId)}
                </Badge>
              )}
              {especialidad && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  <Wrench className="h-3 w-3 mr-1" />
                  {especialidad.nombre}
                </Badge>
              )}
              {item.defectoId && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  {defectos?.find(d => d.id === item.defectoId)?.nombre || `Defecto #${item.defectoId}`}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {canAddFotoDespues && (
              <Button onClick={() => setShowFotoDespuesDialog(true)}>
                <Camera className="h-4 w-4 mr-2" />
                Agregar Foto Después
              </Button>
            )}
            {canApprove && (
              <>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    setApprovalAction("rechazar");
                    setShowApprovalDialog(true);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    setApprovalAction("aprobar");
                    setShowApprovalDialog(true);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Aprobar
                </Button>
              </>
            )}
            {canDelete && (
              <Button
                variant="outline"
                size="icon"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowDeleteDialog(true)}
                title="Eliminar ítem"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Columna principal - Fotos */}
          <div className="lg:col-span-2 space-y-6">
            {/* Comparación Antes/Después */}
            <Card>
              <CardHeader>
                <CardTitle>Fotos del Ítem</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Foto Antes */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Antes
                    </h4>
                    <div className="aspect-[4/3] rounded-lg overflow-hidden border bg-slate-100">
                      {item.fotoAntesMarcadaUrl || item.fotoAntesUrl ? (
                        <img
                          src={item.fotoAntesMarcadaUrl || item.fotoAntesUrl || ""}
                          alt="Foto antes"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Camera className="h-12 w-12" />
                        </div>
                      )}
                    </div>
                    {item.fotoAntesMarcadaUrl && (
                      <p className="text-xs text-muted-foreground">Con marcado en rojo</p>
                    )}
                  </div>

                  {/* Foto Después */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Después
                    </h4>
                    <div className="aspect-[4/3] rounded-lg overflow-hidden border bg-slate-100">
                      {item.fotoDespuesUrl ? (
                        <img
                          src={item.fotoDespuesUrl}
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
                    {item.fechaFotoDespues && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.fechaFotoDespues)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline / Historial */}
            <Card>
              <CardHeader>
                <CardTitle>Historial</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {historial?.map((h, i) => (
                    <div key={h.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`h-3 w-3 rounded-full ${
                          h.statusNuevo === "aprobado" ? "bg-emerald-500" :
                          h.statusNuevo === "rechazado" ? "bg-red-500" :
                          "bg-blue-500"
                        }`} />
                        {i < (historial?.length || 0) - 1 && (
                          <div className="w-0.5 flex-1 bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">
                            {statusLabels[h.statusNuevo] || h.statusNuevo}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(h.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Por: {getUserName(h.usuarioId)}
                        </p>
                        {h.comentario && (
                          <p className="text-sm mt-1 bg-muted p-2 rounded">
                            {h.comentario}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Comentarios */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comentarios y Observaciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Lista de comentarios */}
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {comentarios && comentarios.length > 0 ? (
                    comentarios.map((c: any) => (
                      <div key={c.id} className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {c.usuario?.name || "Usuario"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm">{c.texto}</p>
                        <Badge variant="outline" className="text-xs">
                          {statusLabels[c.etapa] || c.etapa}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay comentarios aún
                    </p>
                  )}
                </div>

                {/* Agregar comentario */}
                <div className="border-t pt-4 space-y-2">
                  <Textarea
                    value={nuevoComentario}
                    onChange={(e) => setNuevoComentario(e.target.value)}
                    placeholder="Escribe un comentario u observación..."
                    rows={2}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddComentario}
                    disabled={!nuevoComentario.trim() || enviandoComentario}
                  >
                    {enviandoComentario ? "Enviando..." : "Agregar Comentario"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Columna lateral - Info y QR */}
          <div className="space-y-6">
            {/* Información */}
            <Card>
              <CardHeader>
                <CardTitle>Información</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Empresa</p>
                    <p className="font-medium">{getEmpresaNombre(item.empresaId)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Unidad</p>
                    <p className="font-medium">{getUnidadNombre(item.unidadId)}</p>
                    {item.ubicacionDetalle && (
                      <p className="text-sm text-muted-foreground">{item.ubicacionDetalle}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Especialidad</p>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: especialidad?.color || "#3B82F6" }}
                      />
                      <p className="font-medium">{especialidad?.nombre || "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Residente</p>
                    <p className="font-medium">{getUserName(item.residenteId)}</p>
                  </div>
                </div>

                {item.unidadId && getUnidadFechaFin(item.unidadId) && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-emerald-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha terminación unidad</p>
                      <p className="font-medium text-emerald-600">{formatDate(getUnidadFechaFin(item.unidadId))}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha de creación</p>
                    <p className="font-medium">{formatDate(item.fechaCreacion)}</p>
                  </div>
                </div>

                {item.descripcion && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                    <p className="text-sm">{item.descripcion}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chat del Ítem */}
            <Card className="lg:col-span-1">
              <CardContent className="p-0 h-[400px]">
                <ItemChat itemId={itemId} itemCodigo={item.codigo} />
              </CardContent>
            </Card>

            {/* QR Code */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Código QR
                </CardTitle>
                <CardDescription>
                  Escanea para ver el seguimiento público
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                {qrCodeUrl && (
                  <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40" />
                )}
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  {item.codigo}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setLocation(`/seguimiento/${item.codigo}`)}
                >
                  Ver página de seguimiento
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialog: Foto Después */}
      <Dialog open={showFotoDespuesDialog} onOpenChange={setShowFotoDespuesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Foto Después</DialogTitle>
            <DialogDescription>
              Sube la foto que muestra el problema corregido
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {fotoDespues ? (
              <div className="space-y-2">
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src={fotoDespues}
                    alt="Foto después"
                    className="w-full h-auto max-h-[300px] object-contain bg-slate-100"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFotoDespues(null)}
                >
                  Cambiar foto
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-32 flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8" />
                <span>Seleccionar o tomar foto</span>
              </Button>
            )}

            <div className="space-y-2">
              <Label>Comentario (opcional)</Label>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Describe las acciones realizadas..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFotoDespuesDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUploadFotoDespues} disabled={!fotoDespues || isSubmitting}>
              {isSubmitting ? "Subiendo..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Aprobación */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "aprobar" ? "Aprobar Ítem" : "Rechazar Ítem"}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === "aprobar"
                ? "Confirma que el problema ha sido corregido satisfactoriamente"
                : "Indica el motivo del rechazo"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Comentario {approvalAction === "rechazar" && "*"}
              </Label>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder={
                  approvalAction === "aprobar"
                    ? "Comentario opcional..."
                    : "Describe el motivo del rechazo..."
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleApproval}
              disabled={isSubmitting}
              className={approvalAction === "aprobar" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
            >
              {isSubmitting ? "Procesando..." : approvalAction === "aprobar" ? "Aprobar" : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmar Eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Ítem</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar el ítem "{item?.titulo}"?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
