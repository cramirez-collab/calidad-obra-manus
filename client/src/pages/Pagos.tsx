import { useState, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, DollarSign, Clock, CheckCircle2, XCircle, Ban, FileText,
  Upload, Camera, Trash2, Edit3, Download, Loader2, Eye, Paperclip, Search,
  MoreVertical, Sparkles, AlertTriangle, CreditCard
} from "lucide-react";

const formatMoney = (v: string | number) => {
  const n = Number(v);
  if (isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
};

const formatDate = (d: Date | string | null) => {
  if (!d) return "-";
  const date = new Date(d);
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  autorizado: { label: "Autorizado", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
  rechazado: { label: "Rechazado", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
  ejecutado: { label: "Ejecutado", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CreditCard },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Ban },
};

export default function Pagos() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  const [showForm, setShowForm] = useState(false);
  const [editingPago, setEditingPago] = useState<any>(null);
  const [detailPago, setDetailPago] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showRechazoDialog, setShowRechazoDialog] = useState<number | null>(null);
  const [showCancelarDialog, setShowCancelarDialog] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [extractingIA, setExtractingIA] = useState(false);

  // Form state
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [noFactura, setNoFactura] = useState("");
  const [notas, setNotas] = useState("");

  // File upload state
  const [pendingFiles, setPendingFiles] = useState<{ name: string; base64: string; mimeType: string; size: number; tipo: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user && ["superadmin", "admin", "supervisor"].includes(user.role);

  const { data: stats, refetch: refetchStats } = trpc.pagos.stats.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  const { data: pagos, refetch: refetchList, isLoading } = trpc.pagos.list.useQuery(
    { proyectoId: selectedProjectId!, status: filterStatus === "all" ? undefined : filterStatus },
    { enabled: !!selectedProjectId }
  );

  const { data: pagoDetail, isLoading: loadingDetail } = trpc.pagos.get.useQuery(
    { id: detailPago! },
    { enabled: !!detailPago }
  );

  const { data: usuarios } = trpc.auth.me.useQuery();

  const createMut = trpc.pagos.create.useMutation({
    onSuccess: () => { refetchList(); refetchStats(); toast.success("Solicitud de pago creada"); resetForm(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.pagos.update.useMutation({
    onSuccess: () => { refetchList(); refetchStats(); toast.success("Solicitud actualizada"); resetForm(); },
    onError: (e) => toast.error(e.message),
  });

  const autorizarMut = trpc.pagos.autorizar.useMutation({
    onSuccess: () => { refetchList(); refetchStats(); toast.success("Pago autorizado"); setDetailPago(null); },
    onError: (e) => toast.error(e.message),
  });

  const rechazarMut = trpc.pagos.rechazar.useMutation({
    onSuccess: () => { refetchList(); refetchStats(); toast.success("Pago rechazado"); setShowRechazoDialog(null); setDetailPago(null); },
    onError: (e) => toast.error(e.message),
  });

  const ejecutarMut = trpc.pagos.ejecutar.useMutation({
    onSuccess: () => { refetchList(); refetchStats(); toast.success("Pago marcado como ejecutado"); setDetailPago(null); },
    onError: (e) => toast.error(e.message),
  });

  const cancelarMut = trpc.pagos.cancelar.useMutation({
    onSuccess: () => { refetchList(); refetchStats(); toast.success("Pago cancelado"); setShowCancelarDialog(null); setDetailPago(null); },
    onError: (e) => toast.error(e.message),
  });

  const eliminarMut = trpc.pagos.eliminar.useMutation({
    onSuccess: () => { refetchList(); refetchStats(); toast.success("Pago eliminado"); setShowDeleteDialog(null); setDetailPago(null); },
    onError: (e) => toast.error(e.message),
  });

  const uploadArchivoMut = trpc.pagos.uploadArchivo.useMutation({
    onError: (e) => toast.error("Error subiendo archivo: " + e.message),
  });

  const deleteArchivoMut = trpc.pagos.deleteArchivo.useMutation({
    onSuccess: () => toast.success("Archivo eliminado"),
  });

  const extraerDatosMut = trpc.pagos.extraerDatosComprobante.useMutation();

  const resetForm = () => {
    setShowForm(false);
    setEditingPago(null);
    setConcepto("");
    setMonto("");
    setProveedor("");
    setNoFactura("");
    setNotas("");
    setPendingFiles([]);
  };

  const handleOpenEdit = (pago: any) => {
    setEditingPago(pago);
    setConcepto(pago.concepto || "");
    setMonto(String(pago.monto || ""));
    setProveedor(pago.proveedor || "");
    setNoFactura(pago.noFactura || "");
    setNotas(pago.notas || "");
    setPendingFiles([]);
    setShowForm(true);
    setDetailPago(null);
  };

  const handleSubmit = async () => {
    if (!concepto.trim() || !monto.trim()) {
      toast.error("Concepto y monto son obligatorios");
      return;
    }
    if (editingPago) {
      await updateMut.mutateAsync({
        id: editingPago.id,
        concepto: concepto.trim(),
        monto: monto.trim(),
        proveedor: proveedor.trim() || undefined,
        noFactura: noFactura.trim() || undefined,
        notas: notas.trim() || undefined,
      });
      // Upload new files
      for (const f of pendingFiles) {
        await uploadArchivoMut.mutateAsync({
          solicitudPagoId: editingPago.id,
          nombre: f.name,
          base64: f.base64,
          mimeType: f.mimeType,
          tamano: f.size,
          tipo: f.tipo,
        });
      }
    } else {
      const result = await createMut.mutateAsync({
        proyectoId: selectedProjectId!,
        concepto: concepto.trim(),
        monto: monto.trim(),
        proveedor: proveedor.trim() || undefined,
        noFactura: noFactura.trim() || undefined,
        notas: notas.trim() || undefined,
      });
      // Upload files after creation
      const pagoId = (result as any).id;
      if (pagoId) {
        for (const f of pendingFiles) {
          await uploadArchivoMut.mutateAsync({
            solicitudPagoId: pagoId,
            nombre: f.name,
            base64: f.base64,
            mimeType: f.mimeType,
            tamano: f.size,
            tipo: f.tipo,
          });
        }
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, tipo: string = "adjunto") => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} excede 10MB`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setPendingFiles((prev) => [...prev, { name: file.name, base64, mimeType: file.type, size: file.size, tipo }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtractingIA(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      // Add as file
      setPendingFiles((prev) => [...prev, { name: file.name, base64, mimeType: file.type, size: file.size, tipo: "comprobante" }]);
      // Extract data with IA
      try {
        const datos = await extraerDatosMut.mutateAsync({ imageBase64: base64, mimeType: file.type });
        if (datos.concepto && !concepto) setConcepto(datos.concepto);
        if (datos.monto && !monto) setMonto(datos.monto);
        if (datos.proveedor && !proveedor) setProveedor(datos.proveedor);
        if (datos.noFactura && !noFactura) setNoFactura(datos.noFactura);
        if (datos.notas) setNotas((prev) => prev ? `${prev}\n${datos.notas}` : datos.notas);
        toast.success("Datos extraídos del comprobante");
      } catch {
        toast.error("No se pudieron extraer datos del comprobante");
      }
      setExtractingIA(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleExportExcel = () => {
    if (!pagos || pagos.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    const headers = ["ID", "Concepto", "Monto", "Moneda", "Proveedor", "No. Factura", "Estado", "Fecha Creación", "Notas"];
    const rows = pagos.map((p: any) => [
      p.id,
      `"${(p.concepto || "").replace(/"/g, '""')}"`,
      p.monto,
      p.moneda,
      `"${(p.proveedor || "").replace(/"/g, '""')}"`,
      `"${(p.noFactura || "").replace(/"/g, '""')}"`,
      p.statusPago,
      formatDate(p.createdAt),
      `"${(p.notas || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pagos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo exportado");
  };

  const filteredPagos = useMemo(() => {
    if (!pagos) return [];
    if (!searchTerm.trim()) return pagos;
    const term = searchTerm.toLowerCase();
    return pagos.filter((p: any) =>
      (p.concepto || "").toLowerCase().includes(term) ||
      (p.proveedor || "").toLowerCase().includes(term) ||
      (p.noFactura || "").toLowerCase().includes(term) ||
      String(p.monto).includes(term)
    );
  }, [pagos, searchTerm]);

  if (!selectedProjectId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Selecciona un proyecto primero</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/bienvenida")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <DollarSign className="h-5 w-5 text-[#002C63]" />
            <h1 className="text-base sm:text-lg font-semibold text-[#002C63]">Pagos</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExportExcel} title="Exportar Excel">
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button size="sm" className="bg-[#02B381] hover:bg-[#029a6e] text-white" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              Solicitar
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-3 py-3 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          <Card className="border-l-4 border-l-[#002C63]">
            <CardContent className="p-3">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Total</p>
              <p className="text-sm sm:text-lg font-bold text-[#002C63]">{formatMoney(stats?.total || 0)}</p>
              <p className="text-[10px] text-gray-400">{stats?.totalCount || 0} pagos</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-400">
            <CardContent className="p-3">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Pendientes</p>
              <p className="text-sm sm:text-lg font-bold text-amber-600">{stats?.pendientesCount || 0}</p>
              <p className="text-[10px] text-gray-400">{formatMoney(stats?.pendientesMonto || 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-400">
            <CardContent className="p-3">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Autorizados</p>
              <p className="text-sm sm:text-lg font-bold text-green-600">{stats?.autorizadosCount || 0}</p>
              <p className="text-[10px] text-gray-400">{formatMoney(stats?.autorizadosMonto || 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-400">
            <CardContent className="p-3">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Ejecutados</p>
              <p className="text-sm sm:text-lg font-bold text-blue-600">{stats?.ejecutadosCount || 0}</p>
              <p className="text-[10px] text-gray-400">{formatMoney(stats?.ejecutadosMonto || 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-400">
            <CardContent className="p-3">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Rechazados</p>
              <p className="text-sm sm:text-lg font-bold text-red-600">{stats?.rechazadosCount || 0}</p>
              <p className="text-[10px] text-gray-400">{formatMoney(stats?.rechazadosMonto || 0)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 sm:px-6 pb-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por concepto, proveedor, factura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-40 h-9">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="autorizado">Autorizados</SelectItem>
              <SelectItem value="ejecutado">Ejecutados</SelectItem>
              <SelectItem value="rechazado">Rechazados</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <div className="px-3 sm:px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#02B381]" />
          </div>
        ) : filteredPagos.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No hay solicitudes de pago</p>
            <Button size="sm" className="mt-3 bg-[#02B381] hover:bg-[#029a6e] text-white" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nueva Solicitud
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPagos.map((p: any) => {
              const sc = statusConfig[p.statusPago] || statusConfig.pendiente;
              const Icon = sc.icon;
              return (
                <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailPago(p.id)}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sc.color}`}>
                            <Icon className="h-3 w-3 mr-0.5" />
                            {sc.label}
                          </Badge>
                          {p.noFactura && (
                            <span className="text-[10px] text-gray-400">#{p.noFactura}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{p.concepto}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {p.proveedor && <span className="text-xs text-gray-500">{p.proveedor}</span>}
                          <span className="text-[10px] text-gray-400">{formatDate(p.createdAt)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm sm:text-base font-bold text-[#002C63]">{formatMoney(p.monto)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#002C63]">
              {editingPago ? "Editar Solicitud de Pago" : "Nueva Solicitud de Pago"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* IA Camera Capture */}
            <div className="border-2 border-dashed border-[#02B381]/30 rounded-lg p-3 bg-[#02B381]/5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-[#02B381]" />
                <span className="text-xs font-medium text-[#02B381]">Captura inteligente</span>
              </div>
              <p className="text-[10px] text-gray-500 mb-2">Toma foto de un comprobante y la IA extraerá los datos automáticamente</p>
              <Button
                size="sm"
                variant="outline"
                className="border-[#02B381] text-[#02B381] hover:bg-[#02B381]/10"
                onClick={() => cameraInputRef.current?.click()}
                disabled={extractingIA}
              >
                {extractingIA ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Extrayendo datos...</>
                ) : (
                  <><Camera className="h-4 w-4 mr-1" /> Capturar Comprobante</>
                )}
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraCapture}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Concepto *</label>
              <Input
                placeholder="Ej: Pago de materiales para cimentación"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700">Monto (MXN) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">No. Factura</label>
                <Input
                  placeholder="Ej: FAC-001"
                  value={noFactura}
                  onChange={(e) => setNoFactura(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Proveedor</label>
              <Input
                placeholder="Nombre del proveedor"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Notas</label>
              <Textarea
                placeholder="Detalles adicionales..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Archivos adjuntos</label>
              <div className="flex gap-2 mb-2">
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Subir archivo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, "adjunto")}
                />
              </div>
              {pendingFiles.length > 0 && (
                <div className="space-y-1">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Paperclip className="h-3 w-3 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-600 truncate">{f.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1">{f.tipo}</Badge>
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button
              className="bg-[#02B381] hover:bg-[#029a6e] text-white"
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending || uploadArchivoMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              {editingPago ? "Guardar Cambios" : "Solicitar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailPago} onOpenChange={(open) => { if (!open) setDetailPago(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#02B381]" />
            </div>
          ) : pagoDetail ? (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-[#002C63]">Detalle de Pago</DialogTitle>
                  {(() => {
                    const sc = statusConfig[pagoDetail.statusPago] || statusConfig.pendiente;
                    const Icon = sc.icon;
                    return (
                      <Badge variant="outline" className={`${sc.color}`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {sc.label}
                      </Badge>
                    );
                  })()}
                </div>
              </DialogHeader>

              <div className="space-y-3">
                <div className="bg-[#002C63]/5 rounded-lg p-3">
                  <p className="text-2xl font-bold text-[#002C63]">{formatMoney(pagoDetail.monto)}</p>
                  <p className="text-sm text-gray-700 mt-1">{pagoDetail.concepto}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase">Proveedor</p>
                    <p className="font-medium">{pagoDetail.proveedor || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase">No. Factura</p>
                    <p className="font-medium">{pagoDetail.noFactura || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase">Fecha Solicitud</p>
                    <p className="font-medium">{formatDate(pagoDetail.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase">Fecha Autorización</p>
                    <p className="font-medium">{formatDate(pagoDetail.fechaAutorizacion)}</p>
                  </div>
                </div>

                {pagoDetail.notas && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase mb-1">Notas</p>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">{pagoDetail.notas}</p>
                  </div>
                )}

                {pagoDetail.motivoRechazo && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      <p className="text-xs font-medium text-red-700">Motivo de rechazo</p>
                    </div>
                    <p className="text-sm text-red-600">{pagoDetail.motivoRechazo}</p>
                  </div>
                )}

                {pagoDetail.motivoCancelacion && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-700 mb-1">Motivo de cancelación</p>
                    <p className="text-sm text-gray-600">{pagoDetail.motivoCancelacion}</p>
                  </div>
                )}

                {/* Archivos */}
                {pagoDetail.archivos && pagoDetail.archivos.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase mb-1">Archivos adjuntos ({pagoDetail.archivos.length})</p>
                    <div className="space-y-1">
                      {pagoDetail.archivos.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Paperclip className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-600 truncate">{a.nombre}</span>
                            <Badge variant="outline" className="text-[9px] px-1">{a.tipo}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <a href={a.url} target="_blank" rel="noopener noreferrer">
                              <Button size="icon" variant="ghost" className="h-6 w-6">
                                <Eye className="h-3 w-3 text-blue-500" />
                              </Button>
                            </a>
                            {(pagoDetail.statusPago === "pendiente" || isAdmin) && (
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteArchivoMut.mutate({ id: a.id })}>
                                <Trash2 className="h-3 w-3 text-red-400" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <DialogFooter>
                <div className="flex flex-wrap gap-2 w-full justify-end">
                  {/* Edit - only if pending/rechazado and is owner or admin */}
                  {["pendiente", "rechazado"].includes(pagoDetail.statusPago) &&
                    (pagoDetail.solicitanteId === user?.id || isAdmin) && (
                    <Button size="sm" variant="outline" onClick={() => handleOpenEdit(pagoDetail)}>
                      <Edit3 className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                  )}
                  {/* Authorize - admin/supervisor only, pendiente */}
                  {pagoDetail.statusPago === "pendiente" && isAdmin && (
                    <Button size="sm" className="bg-[#02B381] hover:bg-[#029a6e] text-white" onClick={() => autorizarMut.mutate({ id: pagoDetail.id })} disabled={autorizarMut.isPending}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Autorizar
                    </Button>
                  )}
                  {/* Reject - admin/supervisor only, pendiente */}
                  {pagoDetail.statusPago === "pendiente" && isAdmin && (
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowRechazoDialog(pagoDetail.id)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Rechazar
                    </Button>
                  )}
                  {/* Execute - admin only, autorizado */}
                  {pagoDetail.statusPago === "autorizado" && isAdmin && (
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => ejecutarMut.mutate({ id: pagoDetail.id })} disabled={ejecutarMut.isPending}>
                      <CreditCard className="h-3.5 w-3.5 mr-1" /> Ejecutar
                    </Button>
                  )}
                  {/* Cancel */}
                  {!["ejecutado", "cancelado"].includes(pagoDetail.statusPago) &&
                    (pagoDetail.solicitanteId === user?.id || isAdmin) && (
                    <Button size="sm" variant="outline" className="text-gray-600" onClick={() => setShowCancelarDialog(pagoDetail.id)}>
                      <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
                    </Button>
                  )}
                  {/* Delete - admin only */}
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowDeleteDialog(pagoDetail.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Rechazo Dialog */}
      <AlertDialog open={!!showRechazoDialog} onOpenChange={(open) => { if (!open) { setShowRechazoDialog(null); setMotivoRechazo(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar Solicitud de Pago</AlertDialogTitle>
            <AlertDialogDescription>
              Indica el motivo del rechazo. El solicitante será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo del rechazo..."
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!motivoRechazo.trim() || rechazarMut.isPending}
              onClick={() => {
                if (showRechazoDialog && motivoRechazo.trim()) {
                  rechazarMut.mutate({ id: showRechazoDialog, motivo: motivoRechazo.trim() });
                }
              }}
            >
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancelar Dialog */}
      <AlertDialog open={!!showCancelarDialog} onOpenChange={(open) => { if (!open) { setShowCancelarDialog(null); setMotivoCancelacion(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Solicitud de Pago</AlertDialogTitle>
            <AlertDialogDescription>
              Indica el motivo de la cancelación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo de cancelación..."
            value={motivoCancelacion}
            onChange={(e) => setMotivoCancelacion(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-gray-600 hover:bg-gray-700 text-white"
              disabled={!motivoCancelacion.trim() || cancelarMut.isPending}
              onClick={() => {
                if (showCancelarDialog && motivoCancelacion.trim()) {
                  cancelarMut.mutate({ id: showCancelarDialog, motivo: motivoCancelacion.trim() });
                }
              }}
            >
              Cancelar Pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={(open) => { if (!open) setShowDeleteDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Solicitud de Pago</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. Se eliminarán la solicitud y todos sus archivos adjuntos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={eliminarMut.isPending}
              onClick={() => {
                if (showDeleteDialog) eliminarMut.mutate({ id: showDeleteDialog });
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
