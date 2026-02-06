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
import { getImageUrl } from "@/lib/imageUrl";
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
  Trash2,
  Download,
  FileText,
  Pencil
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
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
import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { toast } from "sonner";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { downloadPDFBestMethod } from "@/lib/pdfDownload";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<{
    empresaId: string;
    unidadId: string;
    especialidadId: string;
    defectoId: string;
    espacioId: string;
    asignadoAId: string;
    titulo: string;
    descripcion: string;
    ubicacionDetalle: string;
    status: string;
  }>({
    empresaId: "",
    unidadId: "",
    especialidadId: "",
    defectoId: "",
    espacioId: "",
    asignadoAId: "",
    titulo: "",
    descripcion: "",
    ubicacionDetalle: "",
    status: "",
  });
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
  const { data: espacios } = trpc.espacios.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined
  );
  const { data: editResidentes } = trpc.empresas.getAllResidentesConEmpresas.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined
  );

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
      const msg = error.message?.length > 100 ? 'Error al subir foto. Intenta de nuevo.' : error.message;
      toast.error(msg);
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
      const msg = error.message?.length > 100 ? 'Error al aprobar. Intenta de nuevo.' : error.message;
      toast.error(msg);
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
      const msg = error.message?.length > 100 ? 'Error al rechazar. Intenta de nuevo.' : error.message;
      toast.error(msg);
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

  // Función para comprimir imagen - ULTRA AGRESIVA para móvil
  const compressImage = (file: File, maxWidth = 600, quality = 0.5): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Error cargando imagen'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          // Compresión agresiva: máximo 600px
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          // También limitar altura
          const maxHeight = 600;
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info("Procesando imagen...");
    try {
      // Compresión ULTRA AGRESIVA para móvil (600px max, 50% calidad)
      const compressedImage = await compressImage(file, 600, 0.5);
      setFotoDespues(compressedImage);
      toast.success("Imagen lista");
    } catch (error) {
      console.error('Error comprimiendo imagen:', error);
      // Fallback: comprimir con parámetros más agresivos
      try {
        const compressedImage = await compressImage(file, 400, 0.4);
        setFotoDespues(compressedImage);
        toast.success("Imagen lista (comprimida)");
      } catch {
        // Último recurso: usar imagen original pero advertir
        const reader = new FileReader();
        reader.onload = (event) => {
          setFotoDespues(event.target?.result as string);
          toast.warning("Imagen sin comprimir - puede tardar más");
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleUploadFotoDespues = async () => {
    if (!fotoDespues) {
      toast.error("Selecciona una foto");
      return;
    }
    setIsSubmitting(true);
    
    // Función con reintentos ILIMITADOS y backoff exponencial
    const intentarSubir = async (maxIntentos = 10) => {
      for (let i = 0; i < maxIntentos; i++) {
        try {
          if (i > 0) {
            toast.info(`Reintentando... (${i + 1}/${maxIntentos})`);
          }
          return await uploadFotoDespuesMutation.mutateAsync({
            itemId,
            fotoBase64: fotoDespues,
            comentario: comentario || undefined,
          });
        } catch (error: any) {
          console.error(`Intento ${i + 1} falló:`, error.message);
          if (i === maxIntentos - 1) throw error;
          // Backoff exponencial: 1s, 2s, 4s, 8s, 16s...
          const waitTime = Math.min(Math.pow(2, i) * 1000, 30000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    };
    
    try {
      toast.info("Subiendo foto...");
      await intentarSubir(10);
      toast.success("¡Foto subida exitosamente!");
    } catch (error: any) {
      console.error('Error subiendo foto después:', error);
      // Guardar en IndexedDB para sincronizar después
      try {
        await guardarFotoOffline(itemId, fotoDespues, comentario);
        toast.warning("Foto guardada localmente. Se subirá cuando haya mejor conexión.");
      } catch {
        toast.error("Error al subir la foto. Intenta de nuevo más tarde.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guardar foto en IndexedDB para sincronización posterior
  const guardarFotoOffline = async (itemId: number, foto: string, comentario: string) => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('oqc_offline', 1);
      request.onerror = () => reject(new Error('Error abriendo IndexedDB'));
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('fotos_pendientes')) {
          db.createObjectStore('fotos_pendientes', { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['fotos_pendientes'], 'readwrite');
        const store = transaction.objectStore('fotos_pendientes');
        store.add({
          itemId,
          foto,
          comentario,
          timestamp: Date.now(),
          tipo: 'foto_despues'
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error('Error guardando en IndexedDB'));
      };
    });
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
  
  const getUserInfo = (id: number | null) => {
    if (!id) return null;
    return users?.find(u => u.id === id) || null;
  };

  // Solo superadmin, admin, supervisor y jefe_residente pueden subir foto después
  // Residente NO puede subir foto después
  const canAddFotoDespues = item?.status === "pendiente_foto_despues" && 
    ["superadmin", "admin", "supervisor", "jefe_residente"].includes(user?.role || "");
  
  // RESTRICCIÓN DE APROBACIÓN:
  // Solo pueden aprobar: superadmin, admin, supervisor, o el residente asignado (misma especialidad)
  const canApprove = item?.status === "pendiente_aprobacion" && (
    ["superadmin", "admin", "supervisor"].includes(user?.role || "") ||
    (user?.role === "residente" && item?.asignadoAId === user?.id)
  );
  
  // Admin y superadmin pueden eliminar permanentemente
  const canDelete = ['superadmin', 'admin'].includes(user?.role || '');
  
  // Admin y superadmin pueden editar ítems
  const canEdit = ['superadmin', 'admin'].includes(user?.role || '');
  
  const editItemMutation = trpc.items.editItem.useMutation({
    onSuccess: () => {
      utils.items.get.invalidate({ id: itemId });
      utils.items.list.invalidate();
      utils.items.historial.invalidate({ itemId });
      utils.estadisticas.general.invalidate();
      toast.success('Ítem actualizado correctamente');
      setShowEditDialog(false);
    },
    onError: (error) => {
      const msg = error.message?.length > 100 ? 'Error al editar. Intenta de nuevo.' : error.message;
      toast.error(msg);
    },
  });
  
  const handleOpenEditDialog = () => {
    if (!item) return;
    setEditForm({
      empresaId: item.empresaId?.toString() || "",
      unidadId: item.unidadId?.toString() || "",
      especialidadId: item.especialidadId?.toString() || "",
      defectoId: item.defectoId?.toString() || "",
      espacioId: item.espacioId?.toString() || "",
      asignadoAId: item.asignadoAId?.toString() || "",
      titulo: item.titulo || "",
      descripcion: item.descripcion || "",
      ubicacionDetalle: item.ubicacionDetalle || "",
      status: item.status || "",
    });
    setShowEditDialog(true);
  };
  
  const handleSaveEdit = () => {
    if (!item) return;
    const updates: Record<string, any> = { id: itemId };
    
    if (editForm.empresaId && editForm.empresaId !== item.empresaId?.toString()) {
      updates.empresaId = parseInt(editForm.empresaId);
    }
    if (editForm.unidadId && editForm.unidadId !== item.unidadId?.toString()) {
      updates.unidadId = parseInt(editForm.unidadId);
    }
    if (editForm.especialidadId !== (item.especialidadId?.toString() || "")) {
      updates.especialidadId = editForm.especialidadId ? parseInt(editForm.especialidadId) : null;
    }
    if (editForm.defectoId !== (item.defectoId?.toString() || "")) {
      updates.defectoId = editForm.defectoId ? parseInt(editForm.defectoId) : null;
    }
    if (editForm.espacioId !== (item.espacioId?.toString() || "")) {
      updates.espacioId = editForm.espacioId ? parseInt(editForm.espacioId) : null;
    }
    if (editForm.titulo && editForm.titulo !== item.titulo) {
      updates.titulo = editForm.titulo;
    }
    if (editForm.descripcion !== (item.descripcion || "")) {
      updates.descripcion = editForm.descripcion || null;
    }
    if (editForm.ubicacionDetalle !== (item.ubicacionDetalle || "")) {
      updates.ubicacionDetalle = editForm.ubicacionDetalle || null;
    }
    if (editForm.asignadoAId !== (item.asignadoAId?.toString() || "")) {
      updates.asignadoAId = editForm.asignadoAId ? parseInt(editForm.asignadoAId) : null;
    }
    if (editForm.status && editForm.status !== item.status) {
      updates.status = editForm.status;
    }
    
    if (Object.keys(updates).length <= 1) {
      toast.info('No hay cambios para guardar');
      return;
    }
    
    editItemMutation.mutate(updates as any);
  };
  
  const deleteMutation = trpc.items.delete.useMutation({
    onSuccess: () => {
      toast.success('Ítem eliminado permanentemente de la base de datos');
      // Invalidar caché para refrescar la lista
      utils.items.list.invalidate();
      utils.estadisticas.general.invalidate();
      setLocation('/items');
    },
    onError: (error) => {
      const msg = error.message?.length > 100 ? 'Error al eliminar. Intenta de nuevo.' : ('Error al eliminar: ' + error.message);
      toast.error(msg);
    }
  });
  
  const handleDelete = () => {
    deleteMutation.mutate({ id: itemId });
  };

  // Función para cargar imagen como base64 desde URL
  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    if (!url) return null;
    
    try {
      // Si ya es base64, devolverlo directamente
      if (url.startsWith('data:image')) {
        return url;
      }
      
      // Si es un blob URL, cargarlo directamente
      if (url.startsWith('blob:')) {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
      
      // Para URLs externas, usar el proxy de imágenes para evitar CORS
      let fetchUrl = url;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // Usar el proxy de imágenes del servidor
        const encodedUrl = encodeURIComponent(url);
        fetchUrl = `/api/image-proxy?url=${encodedUrl}`;
      }
      
      const response = await fetch(fetchUrl, {
        mode: 'cors',
        credentials: 'same-origin',
      });
      
      if (!response.ok) {
        console.error('Error cargando imagen:', response.status, response.statusText);
        return null;
      }
      
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error cargando imagen para PDF:', error);
      return null;
    }
  };

  // Generar y descargar PDF del ítem
  const handleDownloadPDF = async () => {
    if (!item) return;
    
    toast.info("Generando PDF...");
    
    try {
      const doc = new jsPDF('p', 'mm', 'letter');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = 20;
      
      // Colores corporativos
      const VERDE_OBJETIVA: [number, number, number] = [2, 179, 129];
      const AZUL_OBJETIVA: [number, number, number] = [0, 44, 99];
      
      // Header
      doc.setFillColor(...AZUL_OBJETIVA);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('FICHA DE ITEM DE CALIDAD', pageWidth / 2, 12, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, 20, { align: 'center' });
      
      yPos = 35;
      
      // Código y estado prominentes
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 20, 3, 3, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(...AZUL_OBJETIVA);
      doc.setFont('helvetica', 'bold');
      doc.text(`${item.codigo} #${item.numeroInterno || '-'}`, margin + 5, yPos + 8);
      
      // Estado con color
      const statusColor = item.status === 'aprobado' ? VERDE_OBJETIVA 
        : item.status === 'rechazado' ? [220, 38, 38] as [number, number, number]
        : AZUL_OBJETIVA;
      doc.setFillColor(...statusColor);
      doc.roundedRect(pageWidth - margin - 45, yPos + 3, 40, 8, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(statusLabels[item.status] || item.status, pageWidth - margin - 25, yPos + 8, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(item.titulo || 'Sin descripción', margin + 5, yPos + 16);
      
      yPos += 28;
      
      // Información del ítem en tabla
      doc.setFontSize(11);
      doc.setTextColor(...AZUL_OBJETIVA);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMACIÓN DEL ÍTEM', margin, yPos);
      yPos += 6;
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      
      const infoItems = [
        ['Empresa:', getEmpresaNombre(item.empresaId)],
        ['Unidad:', getUnidadNombre(item.unidadId)],
        ['Especialidad:', especialidad?.nombre || '-'],
        ['Defecto:', defectos?.find(d => d.id === item.defectoId)?.nombre || '-'],
        ['Ubicación:', item.ubicacionDetalle || '-'],
        ['Fecha Creación:', formatDate(item.fechaCreacion)],
      ];
      
      infoItems.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(value, margin + 35, yPos);
        yPos += 5;
      });
      
      yPos += 5;
      
      // Trazabilidad
      doc.setFontSize(11);
      doc.setTextColor(...VERDE_OBJETIVA);
      doc.setFont('helvetica', 'bold');
      doc.text('TRAZABILIDAD', margin, yPos);
      yPos += 6;
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      
      const trazabilidadItems = [
        ['1. Creado por:', getUserName(item.creadoPorId), formatDate(item.fechaCreacion)],
        ['2. Asignado a:', getUserName(item.asignadoAId || item.residenteId), '-'],
        ['3. Aprobado por:', getUserName(item.aprobadoPorId), item.fechaAprobacion ? formatDate(item.fechaAprobacion) : '-'],
        ['4. Cerrado por:', getUserName(item.cerradoPorId), item.fechaCierre ? formatDate(item.fechaCierre) : '-'],
      ];
      
      trazabilidadItems.forEach(([step, name, fecha]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(step, margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(`${name} - ${fecha}`, margin + 35, yPos);
        yPos += 5;
      });
      
      yPos += 10;
      
      // Fotos
      doc.setFontSize(11);
      doc.setTextColor(...AZUL_OBJETIVA);
      doc.setFont('helvetica', 'bold');
      doc.text('EVIDENCIA FOTOGRÁFICA', margin, yPos);
      yPos += 8;
      
      const fotoWidth = (pageWidth - 2 * margin - 10) / 2;
      const fotoHeight = 70;
      
      // Cargar fotos desde el servidor (BD base64 o S3 firmado)
      let fotoAntesData: string | null = null;
      let fotoDespuesData: string | null = null;
      
      try {
        toast.info('Cargando fotografias...');
        const fotosResponse = await fetch(`/api/items/${item.id}/fotos-pdf`);
        if (fotosResponse.ok) {
          const fotosData = await fotosResponse.json();
          // Usar foto marcada si existe, sino la original
          fotoAntesData = fotosData.fotoAntesMarcada || fotosData.fotoAntes;
          fotoDespuesData = fotosData.fotoDespues;
        } else {
          console.warn('Endpoint fotos-pdf fallo, intentando metodo alternativo...');
          // Fallback: intentar cargar desde URLs del item
          if (item.fotoAntesUrl) {
            fotoAntesData = await loadImageAsBase64(getImageUrl(item.fotoAntesUrl));
          }
          if (item.fotoDespuesUrl) {
            fotoDespuesData = await loadImageAsBase64(getImageUrl(item.fotoDespuesUrl));
          }
        }
      } catch (e) {
        console.warn('Error cargando fotos del servidor, intentando alternativo...', e);
        // Fallback: intentar cargar desde URLs del item
        if (item.fotoAntesUrl) {
          fotoAntesData = await loadImageAsBase64(getImageUrl(item.fotoAntesUrl));
        }
        if (item.fotoDespuesUrl) {
          fotoDespuesData = await loadImageAsBase64(getImageUrl(item.fotoDespuesUrl));
        }
      }
      
      // Foto ANTES
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, fotoWidth, fotoHeight + 12, 3, 3, 'S');
      
      doc.setFillColor(255, 193, 7); // Amarillo
      doc.roundedRect(margin, yPos, fotoWidth, 8, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text('FOTO ANTES', margin + fotoWidth / 2, yPos + 5.5, { align: 'center' });
      
      if (fotoAntesData) {
        try {
          doc.addImage(fotoAntesData, 'JPEG', margin + 2, yPos + 10, fotoWidth - 4, fotoHeight - 2, undefined, 'MEDIUM');
        } catch {
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text('Error al cargar imagen', margin + fotoWidth / 2, yPos + fotoHeight / 2 + 8, { align: 'center' });
        }
      } else {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Sin foto', margin + fotoWidth / 2, yPos + fotoHeight / 2 + 8, { align: 'center' });
      }
      
      // Foto DESPUÉS
      const fotoDespuesX = margin + fotoWidth + 10;
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(fotoDespuesX, yPos, fotoWidth, fotoHeight + 12, 3, 3, 'S');
      
      doc.setFillColor(...VERDE_OBJETIVA);
      doc.roundedRect(fotoDespuesX, yPos, fotoWidth, 8, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('FOTO DESPUÉS', fotoDespuesX + fotoWidth / 2, yPos + 5.5, { align: 'center' });
      
      if (fotoDespuesData) {
        try {
          doc.addImage(fotoDespuesData, 'JPEG', fotoDespuesX + 2, yPos + 10, fotoWidth - 4, fotoHeight - 2, undefined, 'MEDIUM');
        } catch {
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text('Error al cargar imagen', fotoDespuesX + fotoWidth / 2, yPos + fotoHeight / 2 + 8, { align: 'center' });
        }
      } else {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Sin foto', fotoDespuesX + fotoWidth / 2, yPos + fotoHeight / 2 + 8, { align: 'center' });
      }
      
      yPos += fotoHeight + 20;
      
      // QR Code si está disponible
      if (qrCodeUrl) {
        doc.setFontSize(11);
        doc.setTextColor(...AZUL_OBJETIVA);
        doc.setFont('helvetica', 'bold');
        doc.text('CÓDIGO QR', margin, yPos);
        yPos += 5;
        
        try {
          doc.addImage(qrCodeUrl, 'PNG', margin, yPos, 30, 30);
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.setFont('helvetica', 'normal');
          doc.text('Escanear para ver seguimiento en línea', margin + 35, yPos + 15);
        } catch {
          // Ignorar error de QR
        }
      }
      
      // Footer
      const footerY = doc.internal.pageSize.getHeight() - 10;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('ObjetivaQC - Control de Calidad de Obra', pageWidth / 2, footerY, { align: 'center' });
      
      // Descargar
      const filename = `Ficha_${item.codigo}_${item.numeroInterno || 'item'}.pdf`;
      downloadPDFBestMethod(doc, filename);
      
      toast.success('PDF descargado correctamente');
    } catch (error) {
      console.error('Error generando PDF:', error);
      toast.error('Error al generar el PDF');
    }
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
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/items")} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            
            {/* Clave OQC prominente con consecutivo */}
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-1.5 bg-white border border-[#002C63]/20 text-[#002C63] px-2 py-1 rounded-md shadow-sm">
                <QrCode className="h-3 w-3" />
                <span className="font-mono font-semibold text-sm">
                  {item.codigo} <span className="text-[#02B381] font-bold">#{item.numeroInterno || '-'}</span>
                </span>
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

          {/* Botones de acción - responsivos */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {canAddFotoDespues && (
              <Button 
                onClick={() => setShowFotoDespuesDialog(true)}
                className="flex-1 md:flex-none min-w-0"
                size="sm"
              >
                <Camera className="h-4 w-4 mr-1 md:mr-2 shrink-0" />
                <span className="truncate">Foto Después</span>
              </Button>
            )}
            {canApprove && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50 flex-1 md:flex-none min-w-0"
                  onClick={() => {
                    setApprovalAction("rechazar");
                    setShowApprovalDialog(true);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1 md:mr-2 shrink-0" />
                  <span className="truncate">Rechazar</span>
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 flex-1 md:flex-none min-w-0"
                  onClick={() => {
                    setApprovalAction("aprobar");
                    setShowApprovalDialog(true);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1 md:mr-2 shrink-0" />
                  <span className="truncate">Aprobar</span>
                </Button>
              </>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50 flex-1 md:flex-none min-w-0"
                onClick={handleOpenEditDialog}
                title="Editar ítem"
              >
                <Pencil className="h-4 w-4 mr-1 md:mr-2 shrink-0" />
                <span className="truncate">Editar</span>
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 flex-1 md:flex-none min-w-0"
                onClick={() => setShowDeleteDialog(true)}
                title="Eliminar ítem"
              >
                <Trash2 className="h-4 w-4 mr-1 md:mr-2 shrink-0" />
                <span className="truncate">Eliminar</span>
              </Button>
            )}
            {/* Botón de descarga PDF - siempre visible */}
            <Button
              variant="outline"
              size="sm"
              className="text-[#002C63] border-[#002C63]/30 hover:bg-[#002C63]/10 flex-1 md:flex-none min-w-0"
              onClick={handleDownloadPDF}
              title="Descargar ficha PDF"
            >
              <Download className="h-4 w-4 mr-1 md:mr-2 shrink-0" />
              <span className="truncate">PDF</span>
            </Button>
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
                          src={getImageUrl(item.fotoAntesMarcadaUrl || item.fotoAntesUrl || "")}
                          alt="Foto antes"
                          className="w-full h-full object-contain"
                          loading="lazy"
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
                          src={getImageUrl(item.fotoDespuesUrl || "")}
                          alt="Foto después"
                          className="w-full h-full object-contain"
                          loading="lazy"
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
                    {getUserInfo(item.residenteId) ? (
                      <UserAvatar 
                        name={getUserInfo(item.residenteId)?.name} 
                        fotoUrl={getUserInfo(item.residenteId)?.fotoUrl}
                        fotoBase64={(getUserInfo(item.residenteId) as any)?.fotoBase64}
                        size="sm"
                        showName={true}
                        nameClassName="font-medium"
                      />
                    ) : (
                      <p className="font-medium">-</p>
                    )}
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

                {/* Sección de Trazabilidad Completa */}
                <div className="pt-3 border-t space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trazabilidad</p>
                  
                  {/* Creado por */}
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 text-xs font-bold">1</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Creado por</p>
                      <p className="font-medium text-sm">
                        {item.creadoPorId ? getUserName(item.creadoPorId) : getUserName(item.residenteId)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.fechaCreacion)}</p>
                    </div>
                  </div>
                  
                  {/* Asignado a */}
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <span className="text-amber-600 text-xs font-bold">2</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Asignado a</p>
                      <p className="font-medium text-sm">
                        {item.asignadoAId ? getUserName(item.asignadoAId) : (especialidad?.residenteId ? getUserName(especialidad.residenteId) : '-')}
                      </p>
                      <p className="text-xs text-muted-foreground">Residente de especialidad</p>
                    </div>
                  </div>
                  
                  {/* Aprobado/Rechazado por */}
                  {(item.status === 'aprobado' || item.status === 'rechazado') && (
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${item.status === 'aprobado' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        <span className={`text-xs font-bold ${item.status === 'aprobado' ? 'text-emerald-600' : 'text-red-600'}`}>3</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">{item.status === 'aprobado' ? 'Aprobado por' : 'Rechazado por'}</p>
                        <p className="font-medium text-sm">
                          {item.aprobadoPorId ? getUserName(item.aprobadoPorId) : (item.supervisorId ? getUserName(item.supervisorId) : '-')}
                        </p>
                        {item.fechaAprobacion && (
                          <p className="text-xs text-muted-foreground">{formatDate(item.fechaAprobacion)}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Cerrado por */}
                  {item.status === 'aprobado' && item.fechaCierre && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                        <span className="text-slate-600 text-xs font-bold">4</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Cerrado por</p>
                        <p className="font-medium text-sm">
                          {item.cerradoPorId ? getUserName(item.cerradoPorId) : (item.aprobadoPorId ? getUserName(item.aprobadoPorId) : '-')}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(item.fechaCierre)}</p>
                      </div>
                    </div>
                  )}
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
                <p className="text-sm text-muted-foreground mt-2 font-mono font-semibold">
                  {item.codigo} <span className="text-[#02B381]">#{item.numeroInterno || '-'}</span>
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
                    src={getImageUrl(fotoDespues)}
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

      {/* Dialog: Editar Ítem */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Ítem
            </DialogTitle>
            <DialogDescription>
              Modifica los campos del ítem. Solo superadmin y admin pueden editar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Título / Defecto */}
            <div className="space-y-2">
              <Label>Título / Defecto</Label>
              <Input
                value={editForm.titulo}
                onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })}
                placeholder="Título del ítem"
              />
            </div>
            
            {/* Empresa */}
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select
                value={editForm.empresaId}
                onValueChange={(value) => setEditForm({ ...editForm, empresaId: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas?.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Unidad */}
            <div className="space-y-2">
              <Label>Unidad</Label>
              <Select
                value={editForm.unidadId}
                onValueChange={(value) => setEditForm({ ...editForm, unidadId: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar unidad" />
                </SelectTrigger>
                <SelectContent>
                  {unidades?.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Especialidad */}
            <div className="space-y-2">
              <Label>Especialidad</Label>
              <Select
                value={editForm.especialidadId || "none"}
                onValueChange={(value) => setEditForm({ ...editForm, especialidadId: value === "none" ? "" : value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar especialidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especialidad</SelectItem>
                  {especialidades?.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color || '#3B82F6' }} />
                        {e.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Defecto (catálogo) */}
            <div className="space-y-2">
              <Label>Defecto (catálogo)</Label>
              <Select
                value={editForm.defectoId || "none"}
                onValueChange={(value) => setEditForm({ ...editForm, defectoId: value === "none" ? "" : value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar defecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin defecto</SelectItem>
                  {defectos?.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Espacio */}
            <div className="space-y-2">
              <Label>Espacio</Label>
              <Select
                value={editForm.espacioId || "none"}
                onValueChange={(value) => setEditForm({ ...editForm, espacioId: value === "none" ? "" : value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar espacio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin espacio</SelectItem>
                  {espacios?.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Ubicación detalle */}
            <div className="space-y-2">
              <Label>Ubicación (detalle)</Label>
              <Input
                value={editForm.ubicacionDetalle}
                onChange={(e) => setEditForm({ ...editForm, ubicacionDetalle: e.target.value })}
                placeholder="Ej: Pared norte, segundo piso"
              />
            </div>
            
            {/* Descripción */}
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={editForm.descripcion}
                onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
                placeholder="Descripción del problema"
                rows={3}
              />
            </div>
            
            {/* Asignado a */}
            <div className="space-y-2">
              <Label>Asignado a (Residente)</Label>
              <Select
                value={editForm.asignadoAId || "none"}
                onValueChange={(value) => setEditForm({ ...editForm, asignadoAId: value === "none" ? "" : value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar residente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {editResidentes?.flatMap((r: any) => 
                    r.empresas?.map((emp: any, idx: number) => (
                      <SelectItem key={`${r.id}-${emp.empresaId}-${idx}`} value={r.id.toString()}>
                        {r.name}{emp.especialidadNombre ? ` - ${emp.especialidadNombre}` : ''} ({emp.empresaNombre})
                      </SelectItem>
                    )) || [
                      <SelectItem key={r.id} value={r.id.toString()}>
                        {r.name}
                      </SelectItem>
                    ]
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {/* Estado */}
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) => setEditForm({ ...editForm, status: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente_foto_despues">Pendiente Foto Después</SelectItem>
                  <SelectItem value="pendiente_aprobacion">Pendiente Aprobación</SelectItem>
                  <SelectItem value="aprobado">Aprobado</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={editItemMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editItemMutation.isPending ? "Guardando..." : "Guardar Cambios"}
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
