import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getImageUrl } from "@/lib/imageUrl";
import DashboardLayout from "@/components/DashboardLayout";
import { UserAvatar } from "@/components/UserAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Clock, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  MapPin,
  BarChart3,
  Plus,
  Loader2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckSquare,
  Square,
  X,
  Check,
  XCircle,
  Megaphone,
  Layers,
  FileText,
  Crosshair,
  CircleCheckBig,
  ShieldCheck
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ZoomablePlano from "@/components/ZoomablePlano";
import type { PlanoPin } from "@/components/ZoomablePlano";
import { toast } from "sonner";
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
import { useLocation, Redirect } from "wouter";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, LineChart, Line, Legend, CartesianGrid } from "recharts";
import { formatDate } from "@/lib/dateFormat";
import { useProject } from "@/contexts/ProjectContext";
import { generarReportePlanosPDF, type PlanoReportData } from "@/lib/reportePlanosPDF";
import { openPDFPreview, forceDownloadPDF } from "@/lib/pdfDownload";
// jsPDF se importa dinámicamente para evitar conflicto con React context
// Heartbeat via tRPC en vez de socket para usuarios en línea

type FilterType = "todos" | "foto" | "aprobar" | "corregir";

const ITEMS_PER_BATCH = 20; // Para scroll infinito

export default function Bienvenida() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedProjectId, isLoadingProjects } = useProject();
  const { data: proyectosList } = trpc.proyectos.list.useQuery(undefined, { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 });
  const proyectoActual = proyectosList?.find((p: any) => p.id === selectedProjectId) || null;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [generandoPDF, setGenerandoPDF] = useState(false);

  // Heartbeat: registra actividad cada 3 min (throttled en servidor a 1/min)
  const heartbeatMut = trpc.avisos.heartbeat.useMutation();
  useEffect(() => {
    if (!selectedProjectId) return;
    // Enviar heartbeat inmediato al entrar
    heartbeatMut.mutate({ proyectoId: selectedProjectId });
    const interval = setInterval(() => {
      // Solo enviar si la tab está visible (ahorra en 3G)
      if (document.visibilityState === 'visible') {
        heartbeatMut.mutate({ proyectoId: selectedProjectId });
      }
    }, 3 * 60 * 1000); // cada 3 min
    return () => clearInterval(interval);
  }, [selectedProjectId]);

  // Usuarios en línea (heartbeat BD, últimos 5 min)
  const enLineaQuery = trpc.avisos.enLinea.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId, refetchInterval: 180_000, staleTime: 180_000, gcTime: 30 * 60 * 1000 }
  );
  const usersCount = enLineaQuery.data?.total ?? 0;
  const connectedUsers = enLineaQuery.data?.usuarios ?? [];

  const handleDownloadEnLineaPDF = async () => {
    if (!connectedUsers.length) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(0, 44, 99);
    doc.text('Usuarios En Linea', 20, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 20, 28);
    doc.text(`Total: ${connectedUsers.length} usuarios conectados ahora`, 20, 34);
    
    let y = 45;
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(0, 44, 99);
    doc.rect(20, y - 5, 170, 8, 'F');
    doc.text('#', 25, y);
    doc.text('Nombre', 35, y);
    doc.text('Rol', 120, y);
    y += 10;
    
    doc.setTextColor(50, 50, 50);
    connectedUsers.forEach((u: any, i: number) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(20, y - 5, 170, 8, 'F');
      }
      doc.text(`${i + 1}`, 25, y);
      doc.text(u.name || '', 35, y);
      doc.text(u.role || '', 120, y);
      y += 8;
    });
    
    openPDFPreview(doc);
  };

  // Generar reporte PDF de planos con pines
  const handleGenerarReportePlanos = async () => {
    if (!selectedProjectId || generandoPDF) return;
    setGenerandoPDF(true);
    try {
      toast.info("Generando reporte de planos...");
      const inputPayload = { "0": { json: { proyectoId: selectedProjectId } } };
      const res = await fetch(`/api/trpc/planos.pines.reportePines?batch=1&input=${encodeURIComponent(JSON.stringify(inputPayload))}`, { credentials: 'include' });
      const json = await res.json();
      const batchResult = Array.isArray(json) ? json[0] : json;
      const planosReport: PlanoReportData[] = batchResult?.result?.data?.json || batchResult?.result?.data || [];
      if (planosReport.length === 0) {
        toast.error("No hay planos con pines");
        return;
      }
      const nombre = proyectoActual?.nombre || "Proyecto";
      await generarReportePlanosPDF({
        proyectoNombre: nombre,
        planos: planosReport,
        onProgress: (msg) => toast.info(msg),
      });
      toast.success("Reporte PDF descargado");
    } catch (err) {
      console.error("Error reporte planos:", err);
      toast.error("Error al generar reporte");
    } finally {
      setGenerandoPDF(false);
    }
  };
  
  // Avisos no leídos
  const { data: avisosNoLeidos } = trpc.avisos.noLeidos.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId, refetchInterval: 300_000, staleTime: 300_000, gcTime: 30 * 60 * 1000 }
  );
  
  // Planos del proyecto para el selector de nivel
  const { data: planosData } = trpc.planos.listar.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 }
  );
  const { data: pendientes, isLoading } = trpc.pendientes.misPendientes.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId, staleTime: 60_000, gcTime: 10 * 60 * 1000 }
  );
  const [activeFilter, setActiveFilter] = useState<FilterType>("todos");
  const [showOnlineList, setShowOnlineList] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_BATCH);
  const listRef = useRef<HTMLDivElement>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Estado para selección múltiple
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showDeleteMultipleDialog, setShowDeleteMultipleDialog] = useState(false);
  const [showPlanoSelector, setShowPlanoSelector] = useState(false);
  const [selectedPlanoId, setSelectedPlanoId] = useState<number | null>(null);
  const [showPlanoViewer, setShowPlanoViewer] = useState(false);

  // Estado para Reporte IA
  const [showReporteIA, setShowReporteIA] = useState(false);
  const [generandoAnalisis, setGenerandoAnalisis] = useState(false);
  const [analisisResultado, setAnalisisResultado] = useState<string | null>(null);
  const [resumenResultado, setResumenResultado] = useState<string | null>(null);
  const [generandoResumen, setGenerandoResumen] = useState(false);
  const [generandoPDFIA, setGenerandoPDFIA] = useState(false);
  const [reporteTab, setReporteTab] = useState<'analisis' | 'resumen' | 'historial'>('analisis');
  const [editandoReporteId, setEditandoReporteId] = useState<number | null>(null);
  const [editTituloTemp, setEditTituloTemp] = useState('');
  const [reporteAEliminar, setReporteAEliminar] = useState<number | null>(null);
  const [mostrarArchivados, setMostrarArchivados] = useState(false);
  const [chartDataIA, setChartDataIA] = useState<any>(null);
  const [fotosEvidenciaIA, setFotosEvidenciaIA] = useState<any[]>([]);
  const [responsablesIA, setResponsablesIA] = useState<any[]>([]);
  const [pendientesAprobacionIA, setPendientesAprobacionIA] = useState<any[]>([]);

  // Estadísticas para mini gráficas del Reporte IA
  const { data: statsData } = trpc.estadisticas.general.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId && showReporteIA, staleTime: 60_000 }
  );

  // Pin count por plano
  const { data: pinCountData } = trpc.planos.pinCount.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId, staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 }
  );
  const pinCountMap = new Map((pinCountData || []).map((p: any) => [p.planoId, Number(p.count)]));

  // Pins del plano seleccionado
  const { data: planosPins } = trpc.items.pinsByPlano.useQuery(
    { planoId: selectedPlanoId! },
    { enabled: !!selectedPlanoId, staleTime: 30_000 }
  );
  
  const utils = trpc.useUtils();
  const deleteItemMutation = trpc.items.delete.useMutation({
    onSuccess: () => {
      toast.success("Ítem eliminado correctamente");
      utils.pendientes.misPendientes.invalidate();
      setItemToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message || "Error al eliminar el ítem");
    },
  });
  
  // Mutación para eliminar múltiples ítems
  const deleteMultipleMutation = trpc.items.deleteMultiple.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.deleted} ítems eliminados correctamente`);
      utils.pendientes.misPendientes.invalidate();
      setSelectedItems(new Set());
      setSelectionMode(false);
      setShowDeleteMultipleDialog(false);
    },
    onError: (error) => {
      toast.error(error.message || "Error al eliminar los ítems");
    },
  });
  
  // Estado para swipe
  const [swipingItemId, setSwipingItemId] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef(false);
  
  // Mutación para aprobar ítem (swipe derecha)
  const aprobarMutation = trpc.items.aprobar.useMutation({
    onSuccess: () => {
      toast.success("✅ Ítem aprobado");
      utils.pendientes.misPendientes.invalidate();
      resetSwipe();
    },
    onError: (error) => {
      toast.error(error.message || "Error al aprobar");
      resetSwipe();
    },
  });
  
  // Mutación para rechazar ítem (swipe izquierda)
  const rechazarMutation = trpc.items.rechazar.useMutation({
    onSuccess: () => {
      toast.success("❌ Ítem rechazado");
      utils.pendientes.misPendientes.invalidate();
      resetSwipe();
    },
    onError: (error) => {
      toast.error(error.message || "Error al rechazar");
      resetSwipe();
    },
  });
  
  // Mutaciones para Reporte IA
  const analisisMut = trpc.analisisIA.generarAnalisis.useMutation({
    onSuccess: (data: any) => {
      setAnalisisResultado(data.contenido);
      if (data.chartData) setChartDataIA(data.chartData);
      if (data.fotosEvidencia) setFotosEvidenciaIA(data.fotosEvidencia);
      if (data.responsables) setResponsablesIA(data.responsables);
      if (data.pendientesAprobacion) setPendientesAprobacionIA(data.pendientesAprobacion);
      setGenerandoAnalisis(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al generar análisis');
      setGenerandoAnalisis(false);
    },
  });
  const resumenMut = trpc.analisisIA.generarResumen.useMutation({
    onSuccess: (data: any) => {
      setResumenResultado(data.resumen);
      if (data.chartData) setChartDataIA(data.chartData);
      if (data.fotosEvidencia) setFotosEvidenciaIA(data.fotosEvidencia);
      if (data.responsables) setResponsablesIA(data.responsables);
      if (data.pendientesAprobacion) setPendientesAprobacionIA(data.pendientesAprobacion);
      setGenerandoResumen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al generar resumen');
      setGenerandoResumen(false);
    },
  });
  const historialQuery = trpc.analisisIA.historial.useQuery(
    { proyectoId: selectedProjectId!, incluirArchivados: mostrarArchivados },
    { enabled: !!selectedProjectId && showReporteIA && reporteTab === 'historial', staleTime: 60_000 }
  );

  // Mutations para gestión de reportes (admin/superadmin)
  const editarTituloMut = trpc.analisisIA.editarTitulo.useMutation({
    onSuccess: () => {
      toast.success('Título actualizado');
      setEditandoReporteId(null);
      historialQuery.refetch();
    },
    onError: () => toast.error('Error al actualizar título'),
  });
  const archivarMut = trpc.analisisIA.archivar.useMutation({
    onSuccess: (_data, vars) => {
      toast.success(vars.archivado ? 'Reporte archivado' : 'Reporte desarchivado');
      historialQuery.refetch();
    },
    onError: () => toast.error('Error al archivar reporte'),
  });
  const eliminarMut = trpc.analisisIA.eliminar.useMutation({
    onSuccess: () => {
      toast.success('Reporte eliminado');
      setReporteAEliminar(null);
      historialQuery.refetch();
    },
    onError: () => toast.error('Error al eliminar reporte'),
  });

  const handleGuardarTitulo = (id: number) => {
    if (!editTituloTemp.trim()) return;
    editarTituloMut.mutate({ id, titulo: editTituloTemp.trim() });
  };
  const handleArchivarReporte = (id: number, archivado: boolean) => {
    archivarMut.mutate({ id, archivado });
  };
  const handleEliminarReporte = (id: number) => {
    eliminarMut.mutate({ id });
  };

  const handleGenerarAnalisis = () => {
    if (!selectedProjectId || generandoAnalisis) return;
    setGenerandoAnalisis(true);
    setAnalisisResultado(null);
    analisisMut.mutate({ proyectoId: selectedProjectId });
  };

  // Auto-generar análisis al abrir el dialog de Reporte IA
  const [autoGenTriggered, setAutoGenTriggered] = useState(false);
  useEffect(() => {
    if (showReporteIA && selectedProjectId && !analisisResultado && !generandoAnalisis && !autoGenTriggered) {
      setAutoGenTriggered(true);
      handleGenerarAnalisis();
    }
    if (!showReporteIA) {
      setAutoGenTriggered(false);
    }
  }, [showReporteIA, selectedProjectId]);

  const handleGenerarResumen = () => {
    if (!selectedProjectId || generandoResumen) return;
    setGenerandoResumen(true);
    setResumenResultado(null);
    resumenMut.mutate({ proyectoId: selectedProjectId });
  };

  const handleDescargarPDFIA = async (contenido: string, titulo: string) => {
    setGenerandoPDFIA(true);
    try {
      const { jsPDF } = await import('jspdf');
      const { drawChartsOnPDF, drawPhotosOnPDF, drawResponsablesOnPDF, drawPendientesAprobacionOnPDF } = await import('@/lib/pdfCharts');
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxW = pageW - margin * 2;
      let y = 20;

      // Limpiar unicode del contenido antes de generar PDF
      const cleanContent = contenido
        .replace(/\\u[0-9a-fA-F]{4}/g, '')
        .replace(/\\u00e1/g, 'á').replace(/\\u00e9/g, 'é').replace(/\\u00ed/g, 'í').replace(/\\u00f3/g, 'ó').replace(/\\u00fa/g, 'ú')
        .replace(/\\u00f1/g, 'ñ').replace(/\\u00c1/g, 'Á').replace(/\\u00c9/g, 'É').replace(/\\u00cd/g, 'Í').replace(/\\u00d3/g, 'Ó')
        .replace(/\\u00da/g, 'Ú').replace(/\\u00d1/g, 'Ñ')
        .replace(/[\u2022\u2023\u25E6\u2043\u2219\u00B7]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      contenido = cleanContent;

      // Header con logo
      doc.setFillColor(0, 44, 99);
      doc.rect(0, 0, pageW, 35, 'F');
      let logoW1 = 0;
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => resolve();
          logoImg.src = '/logo-objetiva.jpg';
        });
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = logoImg.naturalWidth;
          canvas.height = logoImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(logoImg, 0, 0);
          const logoDataUrl = canvas.toDataURL('image/jpeg');
          // Mantener aspect ratio del logo
          const logoMaxH = 25;
          const logoRatio = logoImg.naturalWidth / logoImg.naturalHeight;
          logoW1 = logoMaxH * logoRatio;
          doc.addImage(logoDataUrl, 'JPEG', margin, 5, logoW1, logoMaxH);
        }
      } catch (e) { /* logo fallback */ }
      // Calculate text offset based on actual logo width to avoid overlap
      const textOffsetX1 = logoW1 > 0 ? margin + logoW1 + 3 : margin + 28;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text('OBJETIVA', textOffsetX1, 15);
      doc.setFontSize(9);
      doc.text('Reporte de Análisis de Calidad', textOffsetX1, 23);
      doc.setFontSize(8);
      doc.text(new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), pageW - margin - 50, 15);
      doc.text(proyectoActual?.nombre || 'Proyecto', pageW - margin - 50, 22);
      y = 42;

      // Title
      doc.setTextColor(0, 44, 99);
      doc.setFontSize(14);
      doc.text(titulo, margin, y);
      y += 8;

      // 4 Gráficas en PDF
      if (chartDataIA) {
        y = drawChartsOnPDF(doc, chartDataIA, margin, y, maxW);
      }

      // 5 Fotos evidencia en PDF (siempre) - Pre-cargar fotos como base64 desde el servidor
      let fotosConBase64 = fotosEvidenciaIA;
      if (fotosEvidenciaIA.length > 0) {
        try {
          const itemIds = fotosEvidenciaIA.map((f: any) => f.id).filter(Boolean);
          if (itemIds.length > 0) {
            const resp = await fetch('/api/fotos-evidencia-base64', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ itemIds }),
            });
            if (resp.ok) {
              const { fotos: fotosMap } = await resp.json();
              fotosConBase64 = fotosEvidenciaIA.map((f: any) => ({
                ...f,
                fotoBase64: fotosMap[f.id] || null,
              }));
            }
          }
        } catch (e) {
          console.warn('Error pre-cargando fotos base64 para PDF:', e);
        }
      }
      y = await drawPhotosOnPDF(doc, fotosConBase64, margin, y, maxW, getImageUrl);

      // Responsables e indices de desempeno
      if (responsablesIA.length > 0) {
        y = drawResponsablesOnPDF(doc, responsablesIA, margin, y, maxW);
      }
      // Pendientes de aprobacion
      if (pendientesAprobacionIA.length > 0) {
        y = drawPendientesAprobacionOnPDF(doc, pendientesAprobacionIA, margin, y, maxW);
      }

      // Separador
      doc.setDrawColor(0, 44, 99);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 5;

      // Content - parse markdown lines
      doc.setTextColor(50, 50, 50);
      const lines = contenido.split('\n');
      for (const line of lines) {
        if (y > 270) { doc.addPage(); y = 20; }
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
          y += 4;
          doc.setFontSize(14); doc.setTextColor(0, 44, 99);
          doc.text(trimmed.replace(/^#+\s*/, ''), margin, y);
          y += 8;
        } else if (trimmed.startsWith('## ')) {
          y += 3;
          doc.setFontSize(12); doc.setTextColor(0, 44, 99);
          doc.text(trimmed.replace(/^#+\s*/, ''), margin, y);
          y += 7;
        } else if (trimmed.startsWith('### ')) {
          y += 2;
          doc.setFontSize(11); doc.setTextColor(0, 80, 140);
          doc.text(trimmed.replace(/^#+\s*/, ''), margin, y);
          y += 6;
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          doc.setFontSize(9); doc.setTextColor(50, 50, 50);
          const bulletText = trimmed.replace(/^[-*]\s*/, '').replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(`- ${bulletText}`, maxW - 5);
          for (const wl of wrapped) {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(wl, margin + 5, y);
            y += 5.5;
          }
        } else if (trimmed.match(/^\d+\.\s/)) {
          doc.setFontSize(9); doc.setTextColor(50, 50, 50);
          const numText = trimmed.replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(numText, maxW - 5);
          for (const wl of wrapped) {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(wl, margin + 3, y);
            y += 5.5;
          }
        } else if (trimmed.length > 0) {
          doc.setFontSize(9); doc.setTextColor(50, 50, 50);
          const cleanText = trimmed.replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(cleanText, maxW);
          for (const wl of wrapped) {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(wl, margin, y);
            y += 5.5;
          }
        } else {
          y += 4;
        }
      }

      // Footer on each page
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(0, 44, 99);
        doc.rect(0, 287, pageW, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text('Objetiva - Control de Calidad de Obra', margin, 293);
        doc.text(`Página ${i} de ${totalPages}`, pageW - margin - 25, 293);
      }

      const pdfName = `Analisis_${proyectoActual?.nombre || 'Proyecto'}_${new Date().toISOString().slice(0,10)}.pdf`;
      forceDownloadPDF(doc, pdfName);
      toast.success('PDF descargado');
      // Redirigir al inicio después de la descarga
      setTimeout(() => setLocation('/'), 1500);
    } catch (err) {
      console.error('Error PDF:', err);
      toast.error('Error al generar PDF');
    } finally {
      setGenerandoPDFIA(false);
    }
  };

  // PDF Resumen Ejecutivo compacto (1 cuartilla con gráficas)
  const handleDescargarPDFResumen = async (contenido: string) => {
    setGenerandoPDFIA(true);
    try {
      const { jsPDF } = await import('jspdf');
      const { drawChartsOnPDF, drawPhotosOnPDF, drawResponsablesOnPDF, drawPendientesAprobacionOnPDF } = await import('@/lib/pdfCharts');
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      const maxW = pageW - margin * 2;
      let y = 12;

      // Limpiar unicode
      const clean = contenido
        .replace(/\\u[0-9a-fA-F]{4}/g, '')
        .replace(/[\u2022\u2023\u25E6\u2043\u2219\u00B7]/g, '')
        .replace(/\s{2,}/g, ' ').trim();

      // Header compacto con logo
      doc.setFillColor(0, 44, 99);
      doc.rect(0, 0, pageW, 24, 'F');
      let logoW2 = 0;
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => resolve();
          logoImg.src = '/logo-objetiva.jpg';
        });
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = logoImg.naturalWidth;
          canvas.height = logoImg.naturalHeight;
          const ctx2 = canvas.getContext('2d');
          ctx2?.drawImage(logoImg, 0, 0);
          const logoDataUrl = canvas.toDataURL('image/jpeg');
          // Mantener aspect ratio del logo
          const logoMaxH2 = 18;
          const logoRatio2 = logoImg.naturalWidth / logoImg.naturalHeight;
          logoW2 = logoMaxH2 * logoRatio2; // assigned to outer let
          doc.addImage(logoDataUrl, 'JPEG', margin, 3, logoW2, logoMaxH2);
        }
      } catch (e) { /* logo fallback */ }
      // Calculate text offset based on actual logo width to avoid overlap
      const textOffsetX2 = logoW2 > 0 ? margin + logoW2 + 3 : margin + 21;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.text('OBJETIVA - Resumen Ejecutivo', textOffsetX2, 10);
      doc.setFontSize(7);
      doc.text(`${proyectoActual?.nombre || 'Proyecto'} | ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}`, textOffsetX2, 18);
      y = 28;

      // Mini KPI row si hay stats
      if (statsData) {
        const total = Number(statsData.total || 0);
        const aprobados = (statsData.porStatus || []).find((s: any) => s.status === 'aprobado');
        const rechazados = (statsData.porStatus || []).find((s: any) => s.status === 'rechazado');
        const nAprob = Number(aprobados?.count || 0);
        const nRech = Number(rechazados?.count || 0);
        const pct = total > 0 ? Math.round((nAprob / total) * 100) : 0;

        // KPI boxes
        const kpiW = (maxW - 6) / 4;
        const kpis = [
          { label: 'Total', value: String(total), color: [0, 44, 99] },
          { label: 'Aprobados', value: `${nAprob} (${pct}%)`, color: [2, 179, 129] },
          { label: 'Rechazados', value: String(nRech), color: [239, 68, 68] },
          { label: 'Empresas', value: String((statsData.porEmpresa || []).length), color: [59, 130, 246] },
        ];
        kpis.forEach((kpi, idx) => {
          const kx = margin + idx * (kpiW + 2);
          doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          doc.roundedRect(kx, y, kpiW, 12, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10);
          doc.text(kpi.value, kx + kpiW / 2, y + 5, { align: 'center' });
          doc.setFontSize(6);
          doc.text(kpi.label, kx + kpiW / 2, y + 10, { align: 'center' });
        });
        y += 16;

        // Progress bar
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(margin, y, maxW, 4, 1, 1, 'F');
        if (pct > 0) {
          doc.setFillColor(2, 179, 129);
          doc.roundedRect(margin, y, maxW * (pct / 100), 4, 1, 1, 'F');
        }
        doc.setFontSize(6);
        doc.setTextColor(100, 100, 100);
        doc.text(`Avance: ${pct}%`, margin + maxW / 2, y + 3, { align: 'center' });
        y += 8;
      }

      // 4 Gráficas en PDF Resumen
      if (chartDataIA) {
        y = drawChartsOnPDF(doc, chartDataIA, margin, y, maxW);
      }

      // 5 Fotos evidencia en PDF Resumen (siempre) - Pre-cargar fotos como base64 desde el servidor
      let fotosConBase64R = fotosEvidenciaIA;
      if (fotosEvidenciaIA.length > 0) {
        try {
          const itemIds = fotosEvidenciaIA.map((f: any) => f.id).filter(Boolean);
          if (itemIds.length > 0) {
            const resp = await fetch('/api/fotos-evidencia-base64', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ itemIds }),
            });
            if (resp.ok) {
              const { fotos: fotosMap } = await resp.json();
              fotosConBase64R = fotosEvidenciaIA.map((f: any) => ({
                ...f,
                fotoBase64: fotosMap[f.id] || null,
              }));
            }
          }
        } catch (e) {
          console.warn('Error pre-cargando fotos base64 para PDF resumen:', e);
        }
      }
      y = await drawPhotosOnPDF(doc, fotosConBase64R, margin, y, maxW, getImageUrl);

      // Responsables e indices de desempeno
      if (responsablesIA.length > 0) {
        y = drawResponsablesOnPDF(doc, responsablesIA, margin, y, maxW);
      }
      // Pendientes de aprobacion
      if (pendientesAprobacionIA.length > 0) {
        y = drawPendientesAprobacionOnPDF(doc, pendientesAprobacionIA, margin, y, maxW);
      }

      // Separador
      doc.setDrawColor(0, 44, 99);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 4;

      // Content - parse markdown lines compacto
      const lines = clean.split('\n');
      for (const line of lines) {
        if (y > 275) break; // Forzar 1 página
        const trimmed = line.trim();
        if (trimmed.startsWith('## ')) {
          y += 2;
          doc.setFontSize(9); doc.setTextColor(0, 44, 99);
          doc.setFont('helvetica', 'bold');
          doc.text(trimmed.replace(/^#+\s*/, ''), margin, y);
          doc.setFont('helvetica', 'normal');
          y += 5;
        } else if (trimmed.startsWith('# ')) {
          y += 2;
          doc.setFontSize(10); doc.setTextColor(0, 44, 99);
          doc.setFont('helvetica', 'bold');
          doc.text(trimmed.replace(/^#+\s*/, ''), margin, y);
          doc.setFont('helvetica', 'normal');
          y += 5;
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          doc.setFontSize(7.5); doc.setTextColor(50, 50, 50);
          const bulletText = trimmed.replace(/^[-*]\s*/, '').replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(`\u2022 ${bulletText}`, maxW - 4);
          for (const wl of wrapped) {
            if (y > 275) break;
            doc.text(wl, margin + 3, y);
            y += 4.2;
          }
        } else if (trimmed.length > 0) {
          doc.setFontSize(7.5); doc.setTextColor(50, 50, 50);
          const cleanText = trimmed.replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(cleanText, maxW);
          for (const wl of wrapped) {
            if (y > 275) break;
            doc.text(wl, margin, y);
            y += 4.2;
          }
        } else {
          y += 2.5;
        }
      }

      // Footer
      doc.setFillColor(0, 44, 99);
      doc.rect(0, 287, pageW, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.text('Objetiva - Resumen Ejecutivo de Calidad', margin, 292);
      doc.text('P\u00e1gina 1 de 1', pageW - margin - 20, 292);

      const pdfName = `Resumen_${proyectoActual?.nombre || 'Proyecto'}_${new Date().toISOString().slice(0,10)}.pdf`;
      forceDownloadPDF(doc, pdfName);
      toast.success('PDF resumen descargado');
      // Redirigir al inicio después de la descarga
      setTimeout(() => setLocation('/'), 1500);
    } catch (err) {
      console.error('Error PDF resumen:', err);
      toast.error('Error al generar PDF');
    } finally {
      setGenerandoPDFIA(false);
    }
  };

  const resetSwipe = () => {
    setSwipingItemId(null);
    setSwipeOffset(0);
    setSwipeDirection(null);
    isHorizontalSwipe.current = false;
  };
  
  const handleTouchStart = (e: React.TouchEvent, itemId: number) => {
    if (selectionMode) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwipingItemId(itemId);
    isHorizontalSwipe.current = false;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipingItemId || selectionMode) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    
    // Determinar si es swipe horizontal o vertical
    if (!isHorizontalSwipe.current && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
    
    if (!isHorizontalSwipe.current) {
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
      if (!isHorizontalSwipe.current) {
        resetSwipe();
        return;
      }
    }
    
    // Limitar el swipe
    const maxSwipe = 120;
    const clampedOffset = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));
    setSwipeOffset(clampedOffset);
    setSwipeDirection(clampedOffset > 30 ? 'right' : clampedOffset < -30 ? 'left' : null);
  };
  
  const handleTouchEnd = (itemId: number, itemStatus: string) => {
    if (!swipingItemId || selectionMode) return;
    
    const threshold = 80;
    
    if (swipeOffset > threshold && itemStatus === 'pendiente_aprobacion') {
      // Swipe derecha = Aprobar
      aprobarMutation.mutate({ itemId });
    } else if (swipeOffset < -threshold && itemStatus === 'pendiente_aprobacion') {
      // Swipe izquierda = Rechazar
      rechazarMutation.mutate({ itemId, comentario: 'Rechazado por swipe' });
    } else {
      resetSwipe();
    }
  };
  
  const handleDeleteItem = async (itemId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete(itemId);
  };
  
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await deleteItemMutation.mutateAsync({ id: itemToDelete });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Funciones para selección múltiple
  const toggleItemSelection = (itemId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };
  
  const selectAllVisible = () => {
    const newSelected = new Set(selectedItems);
    visibleItems.forEach((item: any) => newSelected.add(item.id));
    setSelectedItems(newSelected);
  };
  
  const deselectAll = () => {
    setSelectedItems(new Set());
  };
  
  const confirmDeleteMultiple = async () => {
    if (selectedItems.size === 0) return;
    setIsDeleting(true);
    try {
      await deleteMultipleMutation.mutateAsync({ ids: Array.from(selectedItems) });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedItems(new Set());
    }
    setSelectionMode(!selectionMode);
  };
  
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";

  // Actualizar badge del icono de la app con el número de pendientes
  useEffect(() => {
    if (pendientes && typeof (window as any).updateAppBadge === 'function') {
      (window as any).updateAppBadge(pendientes.length);
    }
  }, [pendientes]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pendiente_foto_despues":
        return { icon: Camera, color: "text-[#002C63]", bg: "bg-[#002C63]/10", label: "Foto", tooltip: "Pendiente foto después", filter: "foto" as FilterType };
      case "pendiente_aprobacion":
        return { icon: Check, color: "text-green-600", bg: "bg-green-50", label: "✓", tooltip: "Aprobar", filter: "aprobar" as FilterType };
      case "rechazado":
        return { icon: X, color: "text-red-600", bg: "bg-red-50", label: "✗", tooltip: "Rechazar / Corregir", filter: "corregir" as FilterType };
      case "aprobado":
      case "ok_supervisor":
        return { icon: CircleCheckBig, color: "text-blue-600", bg: "bg-blue-50", label: "OK", tooltip: "Validado", filter: "todos" as FilterType };
      default:
        return { icon: CheckCircle2, color: "text-[#02B381]", bg: "bg-[#02B381]/10", label: "OK", tooltip: "Validado", filter: "todos" as FilterType };
    }
  };

  // Filtrar pendientes según el filtro activo
  const filteredPendientes = pendientes?.filter((item: any) => {
    if (activeFilter === "todos") return true;
    const config = getStatusConfig(item.status);
    return config.filter === activeFilter;
  }) || [];

  // Scroll infinito - mostrar solo los primeros N ítems
  const visibleItems = filteredPendientes.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPendientes.length;

  // Resetear contador cuando cambia el filtro
  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setVisibleCount(ITEMS_PER_BATCH);
  };

  // Cargar más ítems al hacer scroll
  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount(prev => prev + ITEMS_PER_BATCH);
    }
  }, [hasMore]);

  // Detectar scroll cerca del final
  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  // Redirigir a selección de proyecto si no hay proyecto seleccionado
  if (!isLoadingProjects && !selectedProjectId) {
    return <Redirect to="/seleccionar-proyecto" />;
  }

  // Mostrar skeleton instantáneo mientras carga proyectos
  if (isLoadingProjects) {
    return (
      <DashboardLayout>
        <div className="space-y-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-slate-200" />
            <div className="space-y-2"><div className="h-5 w-32 bg-slate-200 rounded" /><div className="h-3 w-20 bg-slate-200 rounded" /></div>
          </div>
          <div className="flex gap-2">{[1,2,3].map(i=><div key={i} className="h-8 w-20 bg-slate-200 rounded-full" />)}</div>
          {[1,2,3,4,5].map(i=><div key={i} className="h-20 bg-slate-200 rounded-xl" />)}
        </div>
      </DashboardLayout>
    );
  }

  // Contar por tipo
  const counts = {
    todos: pendientes?.length || 0,
    foto: pendientes?.filter((i: any) => i.status === "pendiente_foto_despues").length || 0,
    aprobar: pendientes?.filter((i: any) => i.status === "pendiente_aprobacion").length || 0,
    corregir: pendientes?.filter((i: any) => i.status === "rechazado").length || 0,
  };

  // Acciones rápidas: Nuevo, Pines (captura), Stats
  const quickActions = [
    { icon: Plus, label: "Nuevo", path: "/nuevo-item", color: "bg-[#02B381]", roles: ['superadmin', 'admin', 'residente', 'jefe_residente'] },
    { icon: Crosshair, label: "Pines", path: "/planos", color: "bg-[#4A90D9]", roles: ['superadmin', 'admin', 'residente', 'jefe_residente', 'supervisor'] },
    { icon: ShieldCheck, label: "Pruebas", path: "/pruebas", color: "bg-[#E67E22]", roles: ['superadmin', 'admin', 'supervisor', 'residente', 'jefe_residente'] },
    { icon: BarChart3, label: "Stats", path: "/estadisticas", color: "bg-[#002C63]", roles: ['superadmin', 'admin', 'supervisor'] },
  ];

  const visibleActions = quickActions.filter(a => 
    a.roles.includes('all') || a.roles.includes(user?.role || '')
  );

  const filterButtons: { key: FilterType; tooltip: string; icon: any; color: string }[] = [
    { key: "aprobar", tooltip: "Pendiente aprobación", icon: Clock, color: "bg-[#02B381]" },
    { key: "corregir", tooltip: "Rechazado - Corregir", icon: AlertCircle, color: "bg-red-500" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header con iconos de acceso rápido a la derecha */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <UserAvatar 
              name={user?.name} 
              fotoUrl={user?.fotoUrl}
              fotoBase64={(user as any)?.fotoBase64}
              size="lg"
              showName={false}
            />
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-[#002C63]">
                Hola, {user?.name?.split(' ')[0] || 'Usuario'}
              </h1>
              <p className="text-xs text-[#6E6E6E]">
                {filteredPendientes.length} pendientes
              </p>
            </div>
          </div>
          {/* Iconos de acceso rápido - SIEMPRE A LA DERECHA */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 ml-auto justify-end">
            {visibleActions.map(action => (
              <Tooltip key={action.path}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className={`h-8 w-8 sm:h-10 sm:w-10 ${action.color} hover:opacity-90 shadow-md`}
                    onClick={() => setLocation(action.path)}
                  >
                    <action.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{action.label}</TooltipContent>
              </Tooltip>
            ))}
            {/* Botón Ver Planos con Pines */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 sm:h-10 sm:w-10 border-slate-300 hover:bg-slate-50"
                  onClick={() => setShowPlanoSelector(true)}
                >
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-[#002C63]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver Pines</TooltipContent>
            </Tooltip>
            {/* Botón R - Reporte IA Análisis Profundo */}
            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className="h-8 w-8 sm:h-10 sm:w-10 bg-[#002C63] hover:bg-[#001d42] text-white relative"
                    onClick={() => setShowReporteIA(true)}
                    disabled={generandoAnalisis}
                  >
                    {generandoAnalisis ? (
                      <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-white animate-spin" />
                    ) : (
                      <span className="text-sm sm:text-base font-bold text-white">R</span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reporte IA</TooltipContent>
              </Tooltip>
            )}
            {/* Botón PDF Reporte Planos con Pines */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 sm:h-10 sm:w-10 border-slate-300 hover:bg-slate-50"
                  onClick={handleGenerarReportePlanos}
                  disabled={generandoPDF}
                >
                  {generandoPDF ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-[#002C63] animate-spin" /> : <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-[#002C63]" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>PDF Planos</TooltipContent>
            </Tooltip>
            {/* Botón Avisos con badge rojo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 sm:h-10 sm:w-10 relative border-slate-300 hover:bg-slate-50"
                  onClick={() => setLocation('/avisos')}
                >
                  <Megaphone className="h-4 w-4 sm:h-5 sm:w-5 text-[#002C63]" />
                  {(avisosNoLeidos ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 z-50 h-5 min-w-[20px] px-1 flex items-center justify-center text-[11px] font-bold text-white bg-red-600 rounded-full shadow-lg border-2 border-white animate-pulse">
                      {avisosNoLeidos}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Avisos</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Indicador de Usuarios EN LÍNEA - Heartbeat BD */}
        {usersCount > 0 && (
          <div className="relative">
            <button
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 hover:from-emerald-100 hover:to-teal-100 transition-all cursor-pointer shadow-sm"
              onClick={() => setShowOnlineList(prev => !prev)}
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-bold text-emerald-700">{usersCount} en línea</span>
              <svg className={`w-3.5 h-3.5 text-emerald-500 transition-transform ${showOnlineList ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {/* Lista desplegable de usuarios en línea */}
            {showOnlineList && (
              <div className="mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-50 max-h-60 overflow-y-auto">
                <div className="flex items-center justify-between px-2 pb-1.5 border-b border-slate-100 mb-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Usuarios en línea</span>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadEnLineaPDF(); }}
                      className="text-[10px] text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      PDF
                    </button>
                  )}
                </div>
                {connectedUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-slate-700 truncate">
                        {u.name}{u.empresaNombre ? ` — ${u.empresaNombre}` : ''}
                      </span>
                      {u.especialidadNombre && (
                        <span className="text-[10px] text-slate-400 truncate">{u.especialidadNombre}</span>
                      )}
                    </div>
                  </div>
                ))}
                {connectedUsers.length === 0 && (
                  <div className="text-xs text-slate-400 px-2 py-1">Cargando...</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Filtros de estado - Card con botones bien espaciados */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
          <div className="flex gap-4 items-center justify-start overflow-x-auto pb-1">
            {filterButtons.map(filter => (
              <Tooltip key={filter.key}>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-1 min-w-[60px]">
                    <Button
                      variant={activeFilter === filter.key ? "default" : "outline"}
                      size="icon"
                      className={`h-11 w-11 relative ${
                        activeFilter === filter.key 
                          ? `${filter.color} text-white border-0 shadow-md` 
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                      }`}
                      onClick={() => handleFilterChange(filter.key)}
                    >
                      <filter.icon className="h-5 w-5" />
                    </Button>
                    {/* Badge DEBAJO del botón - siempre visible */}
                    <span className={`min-w-[28px] h-[20px] rounded-full text-[11px] font-bold flex items-center justify-center px-2 ${
                      activeFilter === filter.key 
                        ? "bg-[#002C63] text-white" 
                        : counts[filter.key] > 0 
                          ? `${filter.color} text-white`
                          : "bg-slate-200 text-slate-500"
                    }`}>
                      {counts[filter.key]}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">{filter.tooltip}</TooltipContent>
              </Tooltip>
            ))}
          
            {/* Botón de modo selección múltiple - Solo para superadmin */}
            {isSuperadmin && (
              <div className="flex flex-col items-center gap-1 min-w-[60px] ml-auto">
                <Button
                  variant={selectionMode ? "default" : "outline"}
                  size="icon"
                  className={`h-11 w-11 ${
                    selectionMode 
                      ? "bg-red-500 text-white border-0 shadow-md hover:bg-red-600" 
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                  onClick={toggleSelectionMode}
                >
                  {selectionMode ? <X className="h-5 w-5" /> : <CheckSquare className="h-5 w-5" />}
                </Button>
                <span className="text-[9px] text-slate-400 whitespace-nowrap">
                  {selectionMode ? "Cancelar" : "Seleccionar"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Barra de acciones de selección múltiple - REDISEÑADA PARA MÓVIL */}
        {selectionMode && isSuperadmin && (
          <div className="bg-red-50 rounded-lg border border-red-200 p-2 sm:p-3">
            {/* Fila 1: Contador y Botón Eliminar (SIEMPRE VISIBLE) */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-bold text-red-700 whitespace-nowrap">
                {selectedItems.size} seleccionados
              </span>
              {/* BOTÓN ELIMINAR - GRANDE Y VISIBLE EN MÓVIL */}
              {selectedItems.size > 0 && (
                <Button
                  variant="destructive"
                  size="default"
                  onClick={() => setShowDeleteMultipleDialog(true)}
                  className="h-10 px-4 text-sm font-bold shadow-lg"
                >
                  <Trash2 className="h-5 w-5 mr-2" />
                  Eliminar ({selectedItems.size})
                </Button>
              )}
            </div>
            {/* Fila 2: Botones de selección */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllVisible}
                className="text-xs flex-1 min-w-[100px]"
              >
                <CheckSquare className="h-3 w-3 mr-1" />
                Seleccionar página
              </Button>
              {selectedItems.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deselectAll}
                  className="text-xs flex-1 min-w-[100px]"
                >
                  <Square className="h-3 w-3 mr-1" />
                  Deseleccionar todo
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Lista de pendientes - scroll infinito */}
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="rounded-xl bg-white shadow-sm p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
                <div className="h-6 w-16 bg-slate-200 rounded-full" />
              </div>
            ))}
          </div>
        ) : visibleItems.length > 0 ? (
          <div className="space-y-2" ref={listRef}>
            {visibleItems.map((item: any) => {
              const config = getStatusConfig(item.status);
              const Icon = config.icon;
              const isSelected = selectedItems.has(item.id);
              const isSwipeable = item.status === 'pendiente_aprobacion' && !selectionMode;
              const isCurrentlySwipingThis = swipingItemId === item.id;
              
              return (
                <div key={item.id} className="relative overflow-hidden rounded-xl">
                  {/* Fondo de swipe - Aprobar (verde) */}
                  {isSwipeable && isCurrentlySwipingThis && swipeOffset > 0 && (
                    <div 
                      className="absolute inset-y-0 left-0 bg-[#02B381] flex items-center justify-start pl-4 rounded-l-xl"
                      style={{ width: Math.abs(swipeOffset) }}
                    >
                      <Check className="h-6 w-6 text-white" />
                      {swipeOffset > 50 && <span className="text-white text-xs ml-1 font-bold">Aprobar</span>}
                    </div>
                  )}
                  {/* Fondo de swipe - Rechazar (rojo) */}
                  {isSwipeable && isCurrentlySwipingThis && swipeOffset < 0 && (
                    <div 
                      className="absolute inset-y-0 right-0 bg-red-500 flex items-center justify-end pr-4 rounded-r-xl"
                      style={{ width: Math.abs(swipeOffset) }}
                    >
                      {swipeOffset < -50 && <span className="text-white text-xs mr-1 font-bold">Rechazar</span>}
                      <XCircle className="h-6 w-6 text-white" />
                    </div>
                  )}
                  
                  <Card 
                    className={`cursor-pointer hover:shadow-md transition-all border-0 shadow-sm relative ${
                      isSelected ? "ring-2 ring-red-500 bg-red-50" : ""
                    } ${isSwipeable ? 'touch-pan-y' : ''}`}
                    style={{
                      transform: isCurrentlySwipingThis ? `translateX(${swipeOffset}px)` : 'translateX(0)',
                      transition: isCurrentlySwipingThis ? 'none' : 'transform 0.3s ease-out'
                    }}
                    onClick={() => {
                      if (selectionMode) {
                        toggleItemSelection(item.id, { stopPropagation: () => {} } as React.MouseEvent);
                      } else if (!isCurrentlySwipingThis || Math.abs(swipeOffset) < 10) {
                        setLocation(`/items/${item.id}`);
                      }
                    }}
                    onTouchStart={(e) => isSwipeable && handleTouchStart(e, item.id)}
                    onTouchMove={(e) => isSwipeable && handleTouchMove(e)}
                    onTouchEnd={() => isSwipeable && handleTouchEnd(item.id, item.status)}
                  >
                  <CardContent className="p-2 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      {/* Checkbox para selección múltiple */}
                      {selectionMode && isSuperadmin && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {
                            const newSelected = new Set(selectedItems);
                            if (isSelected) {
                              newSelected.delete(item.id);
                            } else {
                              newSelected.add(item.id);
                            }
                            setSelectedItems(newSelected);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-5 w-5 border-2 border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                        />
                      )}
                      
                      {/* Miniatura de foto antes */}
                      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                        {item.fotoAntesUrl ? (
                          <img
                            src={getImageUrl(item.fotoAntesUrl)}
                            alt="Foto antes" 
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                          />
                        ) : (
                          <div className={`h-full w-full ${config.bg} flex items-center justify-center`}>
                            <Camera className={`h-5 w-5 ${config.color}`} />
                          </div>
                        )}
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                          <span className="font-mono text-xs sm:text-sm font-bold text-[#002C63]">
                            {item.codigo} <span className="text-[#02B381]">#{item.numeroInterno || '-'}</span>
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`shrink-0 inline-flex items-center gap-0.5 text-[11px] sm:text-xs px-1.5 py-0.5 rounded font-bold cursor-default ${config.bg} ${config.color}`}>
                                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                                {config.label !== "\u2713" && config.label !== "\u2717" && <span className="whitespace-nowrap">{config.label}</span>}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {config.tooltip}
                            </TooltipContent>
                          </Tooltip>
                          {/* Indicador de completitud de ficha */}
                          {(() => {
                            const hasAntes = !!(item.fotoAntesUrl || (item as any).fotoAntesMarcadaUrl);
                            const hasDespues = !!(item as any).fotoDespuesUrl;
                            const hasPlano = !!item.pinPlanoId;
                            const fichaCompleta = hasAntes && hasDespues && hasPlano;
                            if (fichaCompleta) return null;
                            const faltan: string[] = [];
                            if (!hasAntes) faltan.push('foto antes');
                            if (!hasDespues) faltan.push('foto despu\u00e9s');
                            if (!hasPlano) faltan.push('plano');
                            return (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-700 font-bold" title={`Falta: ${faltan.join(', ')}`}>
                                !
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-xs sm:text-sm truncate mt-0.5 text-[#2E2E2E]">{item.titulo}</p>
                        <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-[#6E6E6E] mt-1 flex-wrap">
                          {/* Residente asignado (prioridad: asignadoA > especialidadResidente > residente) */}
                          {(item.asignadoANombre || item.especialidadResidenteNombre || item.residenteNombre) && (
                            <span className="font-semibold text-[#02B381] bg-[#02B381]/10 px-1.5 py-0.5 rounded" title="Residente asignado">
                              {(item.asignadoANombre || item.especialidadResidenteNombre || item.residenteNombre || '').split(' ').slice(0, 2).join(' ')}
                            </span>
                          )}
                          {item.ubicacion && (
                            <span className="flex items-center gap-1 truncate max-w-[80px] sm:max-w-none">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{item.ubicacion}</span>
                            </span>
                          )}
                          {/* Creado por */}
                          {item.creadoPorNombre && (
                            <span className="shrink-0 text-slate-500" title="Creado por">
                              ✍️ {item.creadoPorNombre.split(' ')[0]} {formatDate(item.fechaCreacion)}
                            </span>
                          )}
                          {!item.creadoPorNombre && (
                            <span className="shrink-0">{formatDate(item.fechaCreacion)}</span>
                          )}
                          {/* Fecha de foto después si existe */}
                          {item.fechaFotoDespues && (
                            <span className="text-blue-600 shrink-0" title="Foto después">
                              📷 {formatDate(item.fechaFotoDespues)}
                            </span>
                          )}
                          {/* Aprobado/Rechazado por */}
                          {item.aprobadoPorNombre && item.fechaAprobacion && (
                            <span className={`shrink-0 ${item.status === 'aprobado' ? 'text-green-600' : 'text-red-600'}`} title={item.status === 'aprobado' ? 'Aprobado por' : 'Rechazado por'}>
                              {item.status === 'aprobado' ? '✓' : '✗'} {item.aprobadoPorNombre.split(' ')[0]} {formatDate(item.fechaAprobacion)}
                            </span>
                          )}
                          {!item.aprobadoPorNombre && item.fechaAprobacion && (
                            <span className="text-green-600 shrink-0" title="Aprobado">
                              ✓ {formatDate(item.fechaAprobacion)}
                            </span>
                          )}
                        </div>
                        {/* Preview de 3 palabras del comentario con indicador de quién comentó */}
                        {(item.comentarioResidente || item.comentarioSupervisor) && (
                          <p className="text-[10px] sm:text-xs text-[#02B381] mt-0.5 truncate italic flex items-center gap-1">
                            <span className="font-bold not-italic text-slate-500">
                              {item.comentarioResidente ? 'R:' : 'S:'}
                            </span>
                            "{(() => {
                              const comentario = item.comentarioResidente || item.comentarioSupervisor || '';
                              const palabras = comentario.split(' ');
                              return palabras.slice(0, 3).join(' ') + (palabras.length > 3 ? '...' : '');
                            })()}"
                          </p>
                        )}
                      </div>

                      {/* Icono plano: si tiene pin, navegar al visor del plano */}
                      {item.pinPlanoId && !selectionMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setLocation(`/planos?planoId=${item.pinPlanoId}`); }}
                          className="h-7 w-7 rounded-full border-2 border-emerald-400 bg-emerald-50 flex items-center justify-center shrink-0 flex-none hover:bg-emerald-100 transition-colors"
                          title="Ver en plano"
                        >
                          <Layers className="h-3 w-3 text-emerald-600" />
                        </button>
                      )}
                      {/* Indicador de pin - si no tiene pin, navegar a planos para asignar */}
                      {!item.pinPlanoId && !selectionMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setLocation(`/planos?assignPin=${item.id}`); }}
                          className="h-7 w-7 rounded-full border-2 border-dashed border-amber-400 flex items-center justify-center shrink-0 flex-none hover:bg-amber-50 transition-colors"
                          title="Sin pin - Toca para asignar ubicación en plano"
                        >
                          <MapPin className="h-3 w-3 text-amber-400" />
                        </button>
                      )}

                      {/* Botón eliminar para superadmin/admin (solo si no está en modo selección) */}
                      {isSuperadmin && !selectionMode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 sm:h-10 sm:w-10 min-w-[36px] sm:min-w-[40px] text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0 flex-none ml-1"
                          onClick={(e) => handleDeleteItem(item.id, e)}
                        >
                          <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                      )}

                      {/* Flecha (solo si no está en modo selección) - oculta en móvil cuando hay botón eliminar */}
                      {!selectionMode && (
                        <ArrowRight className={`h-5 w-5 text-[#6E6E6E] shrink-0 ${isSuperadmin ? 'hidden sm:block' : ''}`} />
                      )}
                    </div>
                  </CardContent>
                </Card>
                </div>
              );
            })}

            {/* Indicador de scroll infinito */}
            {hasMore && (
              <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-2 text-sm text-[#6E6E6E]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Cargando más... ({visibleItems.length} de {filteredPendientes.length})</span>
                </div>
              </div>
            )}
            {!hasMore && filteredPendientes.length > ITEMS_PER_BATCH && (
              <div className="text-center py-4 text-sm text-[#6E6E6E]">
                Mostrando todos los {filteredPendientes.length} ítems
              </div>
            )}
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-[#02B381]/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-[#02B381]" />
              </div>
              <p className="font-semibold text-[#002C63]">
                {activeFilter === "todos" ? "¡Todo al día!" : `Sin ítems de "${activeFilter}"`}
              </p>
              <p className="text-sm text-[#6E6E6E]">
                {activeFilter === "todos" ? "Sin pendientes" : "Prueba otro filtro"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Diálogo de confirmación para eliminar un ítem */}
      <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este ítem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El ítem y todas sus fotos serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación para eliminar múltiples ítems */}
      <AlertDialog open={showDeleteMultipleDialog} onOpenChange={setShowDeleteMultipleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              ¿Eliminar {selectedItems.size} ítems?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los {selectedItems.size} ítems seleccionados y todas sus fotos serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMultiple}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Eliminando {selectedItems.size}...
                </>
              ) : (
                `Eliminar ${selectedItems.size} ítems`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Modal Selector de Plano/Nivel */}
      <Dialog open={showPlanoSelector} onOpenChange={setShowPlanoSelector}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#002C63] flex items-center gap-2">
              <Layers className="h-5 w-5" /> Seleccionar Nivel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {!planosData || planosData.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No hay planos configurados para este proyecto</p>
            ) : (
              planosData.map((plano: any) => (
                <button
                  key={plano.id}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-[#02B381] transition-all text-left"
                  onClick={() => {
                    setSelectedPlanoId(plano.id);
                    setShowPlanoSelector(false);
                    setShowPlanoViewer(true);
                  }}
                >
                  <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    <img src={getImageUrl(plano.imagenUrl)} alt={plano.nombre} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[#002C63] truncate">{plano.nombre}</p>
                    {plano.descripcion && <p className="text-xs text-gray-500 truncate">{plano.descripcion}</p>}
                  </div>
                  {(pinCountMap.get(plano.id) ?? 0) > 0 && (
                    <span className="text-[10px] font-bold text-white bg-[#002C63] rounded-full px-2 py-0.5 shrink-0">
                      {pinCountMap.get(plano.id)} pin{(pinCountMap.get(plano.id) ?? 0) !== 1 ? 'es' : ''}
                    </span>
                  )}
                  <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Visor de Plano con Pines */}
      {showPlanoViewer && selectedPlanoId && (() => {
        const plano = planosData?.find((p: any) => p.id === selectedPlanoId);
        if (!plano) return null;
        const pins: PlanoPin[] = (planosPins || []).map((p: any) => ({
          id: p.id,
          codigo: p.codigo,
          descripcion: p.descripcion,
          status: p.status,
          pinPosX: p.pinPosX,
          pinPosY: p.pinPosY,
          numeroInterno: p.numeroInterno,
          residenteNombre: p.residenteNombre,
        }));
        return (
          <Dialog open={showPlanoViewer} onOpenChange={(open) => { if (!open) setShowPlanoViewer(false); }}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
              <div className="flex flex-col h-[90vh]">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[#002C63]" />
                    <span className="font-semibold text-sm text-[#002C63]">{plano.nombre}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{pins.length} pins</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setShowPlanoViewer(false); setShowPlanoSelector(true); }}>
                    <Layers className="h-4 w-4 mr-1" /> Cambiar nivel
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ZoomablePlano
                    imagenUrl={getImageUrl(plano.imagenUrl)}
                    nombre={plano.nombre}
                    allPins={pins}
                    onPinClick={(itemId) => {
                      setShowPlanoViewer(false);
                      setLocation(`/items/${itemId}`);
                    }}
                    className="h-full"
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Dialog Reporte IA */}
      <Dialog open={showReporteIA} onOpenChange={setShowReporteIA}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-4 pt-3 pb-2 border-b">
            <DialogTitle className="text-[#002C63] flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <div>
                <span className="text-sm font-bold">Reporte IA</span>
                <span className="text-xs text-slate-500 block">{proyectoActual?.nombre || 'Proyecto'}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          {/* Tabs */}
          <div className="flex border-b px-4">
            {(['analisis', 'resumen', 'historial'] as const).map(tab => (
              <button
                key={tab}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  reporteTab === tab
                    ? 'border-[#02B381] text-[#02B381]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setReporteTab(tab)}
              >
                {tab === 'analisis' ? 'Análisis' : tab === 'resumen' ? 'Resumen' : 'Historial'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {/* Tab An\u00e1lisis */}
            {reporteTab === 'analisis' && (
              <div className="space-y-4">
                {!analisisResultado && !generandoAnalisis && (
                  <div className="py-4">
                    <div className="text-center mb-4">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-[#002C63]/10 flex items-center justify-center">
                        <span className="text-lg font-bold text-[#002C63]">IA</span>
                      </div>
                      <h3 className="text-base font-semibold text-[#002C63]">Análisis Profundo</h3>
                    </div>

                    {/* 3 Mini Gráficas */}
                    {statsData && (
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {/* 1. Pie: Status */}
                        {(() => {
                          const STATUS_COLORS: Record<string, string> = { aprobado: '#02B381', rechazado: '#ef4444', pendiente_foto: '#f59e0b', pendiente_aprobacion: '#3b82f6', sin_item: '#94a3b8' };
                          const STATUS_LABELS: Record<string, string> = { aprobado: 'Aprob.', rechazado: 'Rech.', pendiente_foto: 'P.Foto', pendiente_aprobacion: 'P.Apr.', sin_item: 'Sin Ítem' };
                          const pieData = (statsData.porStatus || []).map((s: any) => ({ name: STATUS_LABELS[s.status] || s.status, value: Number(s.count), color: STATUS_COLORS[s.status] || '#94a3b8' }));
                          return (
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-[10px] font-semibold text-gray-500 mb-1">Por Estado</p>
                              <ResponsiveContainer width="100%" height={80}>
                                <PieChart>
                                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={30} innerRadius={15} strokeWidth={1}>
                                    {pieData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                                  </Pie>
                                  <RTooltip formatter={(v: any, n: any) => [v, n]} />
                                </PieChart>
                              </ResponsiveContainer>
                              <p className="text-[10px] text-gray-400">{statsData.total} ítems</p>
                            </div>
                          );
                        })()}

                        {/* 2. Bar: Top 5 Empresas */}
                        {(() => {
                          const COLORS = ['#002C63', '#02B381', '#3b82f6', '#f59e0b', '#ef4444'];
                          const barData = (statsData.porEmpresa || []).slice(0, 5).map((e: any, i: number) => ({ name: `E${i+1}`, value: Number(e.count), fill: COLORS[i % COLORS.length] }));
                          return (
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-[10px] font-semibold text-gray-500 mb-1">Top Empresas</p>
                              <ResponsiveContainer width="100%" height={80}>
                                <BarChart data={barData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                                  <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                                  <YAxis tick={{ fontSize: 8 }} />
                                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                    {barData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                                  </Bar>
                                  <RTooltip formatter={(v: any) => [v, 'Ítems']} />
                                </BarChart>
                              </ResponsiveContainer>
                              <p className="text-[10px] text-gray-400">{(statsData.porEmpresa || []).length} empresas</p>
                            </div>
                          );
                        })()}

                        {/* 3. Bar: Top 5 Especialidades */}
                        {(() => {
                          const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'];
                          const barData = (statsData.porEspecialidad || []).slice(0, 5).map((e: any, i: number) => ({ name: `Esp${i+1}`, value: Number(e.count), fill: COLORS[i % COLORS.length] }));
                          return (
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-[10px] font-semibold text-gray-500 mb-1">Top Especialidades</p>
                              <ResponsiveContainer width="100%" height={80}>
                                <BarChart data={barData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                                  <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                                  <YAxis tick={{ fontSize: 8 }} />
                                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                    {barData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                                  </Bar>
                                  <RTooltip formatter={(v: any) => [v, 'Ítems']} />
                                </BarChart>
                              </ResponsiveContainer>
                              <p className="text-[10px] text-gray-400">{(statsData.porEspecialidad || []).length} espec.</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <div className="text-center">
                      <Button
                        className="bg-[#002C63] hover:bg-[#001d42] text-white px-6"
                        onClick={handleGenerarAnalisis}
                      >
                        Generar Análisis Completo
                      </Button>
                    </div>
                  </div>
                )}
                {generandoAnalisis && (
                  <div className="text-center py-12">
                    <Loader2 className="h-10 w-10 animate-spin text-[#02B381] mx-auto mb-4" />
                    <p className="text-sm text-gray-500">Analizando datos del proyecto...</p>
                    <p className="text-xs text-gray-400 mt-1">Esto puede tomar 30-60 segundos</p>
                  </div>
                )}
                {analisisResultado && (
                  <div>
                    <div className="flex justify-end gap-2 mb-3">
                      <Button size="sm" variant="outline" onClick={() => handleDescargarPDFIA(analisisResultado, 'Análisis Profundo')} disabled={generandoPDFIA}>
                        {generandoPDFIA ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                        Abrir PDF
                      </Button>
                      <Button size="sm" className="bg-[#002C63] hover:bg-[#001d42] text-white" onClick={handleGenerarAnalisis}>Regenerar</Button>
                    </div>

                    {/* 5 Gráficas Relevantes */}
                    {chartDataIA && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                        {/* 1. Pie: Estado */}
                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Estado</p>
                          <ResponsiveContainer width="100%" height={90}>
                            <PieChart>
                              <Pie data={chartDataIA.porStatus} dataKey="value" cx="50%" cy="50%" outerRadius={32} innerRadius={16} strokeWidth={1}>
                                {chartDataIA.porStatus.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                              </Pie>
                              <RTooltip formatter={(v: any, n: any) => [v, n]} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* 2. Bar: Empresas */}
                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Empresas</p>
                          <ResponsiveContainer width="100%" height={90}>
                            <BarChart data={chartDataIA.porEmpresa} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 7 }} />
                              <YAxis tick={{ fontSize: 7 }} />
                              <Bar dataKey="total" fill="#002C63" radius={[2,2,0,0]} />
                              <Bar dataKey="rechazados" fill="#ef4444" radius={[2,2,0,0]} />
                              <RTooltip />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {/* 3. Bar: Especialidades */}
                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Especialidades</p>
                          <ResponsiveContainer width="100%" height={90}>
                            <BarChart data={chartDataIA.porEspecialidad} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 7 }} />
                              <YAxis tick={{ fontSize: 7 }} />
                              <Bar dataKey="total" fill="#6366f1" radius={[2,2,0,0]} />
                              <Bar dataKey="rechazados" fill="#ef4444" radius={[2,2,0,0]} />
                              <RTooltip />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* 5. Bar: Defectos */}
                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Defectos</p>
                          <ResponsiveContainer width="100%" height={90}>
                            <BarChart data={chartDataIA.defectos} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                              <XAxis type="number" tick={{ fontSize: 7 }} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 6 }} width={50} />
                              <Bar dataKey="frecuencia" fill="#f59e0b" radius={[0,2,2,0]} />
                              <RTooltip />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Top Defectos Recurrentes - Evidencia Fotográfica */}
                    <div className="mb-4">
                      <p className="text-xs font-bold text-[#002C63] mb-2">
                        {fotosEvidenciaIA.some((f: any) => f.defectoNombre) ? `Top ${fotosEvidenciaIA.length} Defectos Recurrentes` : `Evidencia Fotográfica (${fotosEvidenciaIA.length} ítems)`}
                      </p>
                      {fotosEvidenciaIA.length > 0 ? (
                        <div className="grid grid-cols-5 gap-1.5">
                          {fotosEvidenciaIA.slice(0, 5).map((foto: any) => (
                            <div key={foto.id} className="rounded-lg overflow-hidden border bg-gray-50">
                              {foto.fotoUrl ? (
                                <img src={getImageUrl(foto.fotoUrl)} alt={foto.defectoNombre || foto.codigo} className="w-full h-20 object-cover" onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <div className="w-full h-20 bg-gray-200 flex items-center justify-center"><span className="text-[8px] text-gray-400">Foto pendiente</span></div>
                              )}
                              <div className="p-1">
                                {foto.defectoNombre ? (
                                  <>
                                    <p className="text-[8px] font-bold text-[#002C63] truncate">{foto.defectoNombre}</p>
                                    <span className="text-[7px] px-1 rounded bg-red-100 text-red-700">{foto.defectoCount} ocurrencias</span>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-[8px] font-bold text-[#002C63] truncate">{foto.codigo}</p>
                                    <span className={`text-[7px] px-1 rounded ${foto.status === 'rechazado' ? 'bg-red-100 text-red-700' : foto.status === 'aprobado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{foto.status}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 border rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-400">Sin evidencia fotográfica disponible</p>
                        </div>
                      )}
                    </div>

                    {/* Contenido del análisis con interlineado mejorado */}
                    <div className="prose prose-sm max-w-none bg-white rounded-lg border p-4" style={{ lineHeight: '1.7' }}>
                      {analisisResultado
                        .replace(/\\u[0-9a-fA-F]{4}/g, '')
                        .replace(/\\u\d{4}/g, '')
                        .replace(/[•·‣◦⁃∙–—―''""]/g, '')
                        .split('\n').map((line, i) => {
                        const t = line.replace(/\\u[0-9a-fA-F]{4}/g, '').replace(/\\u\d{4}/g, '').trim();
                        if (t.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-[#004080] mt-3 mb-1.5">{t.replace(/^#+\s*/, '')}</h3>;
                        if (t.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-[#002C63] mt-4 mb-1.5 border-b pb-1">{t.replace(/^#+\s*/, '')}</h2>;
                        if (t.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-[#002C63] mt-5 mb-2">{t.replace(/^#+\s*/, '')}</h1>;
                        if (t.startsWith('- ') || t.startsWith('* ')) {
                          const bullet = t.replace(/^[-*]\s*/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                          return <div key={i} className="flex gap-2 ml-4 text-sm text-gray-700 mb-1.5 leading-relaxed"><span className="text-[#02B381] font-bold mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html: bullet }} /></div>;
                        }
                        if (t.match(/^\d+\.\d+\.\d+\./)) {
                          const num = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                          return <div key={i} className="ml-8 text-sm text-gray-700 mb-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: num }} />;
                        }
                        if (t.match(/^\d+\.\d+\./)) {
                          const num = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                          return <div key={i} className="ml-4 text-sm font-medium text-gray-800 mb-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: num }} />;
                        }
                        if (t.match(/^\d+\./)) {
                          const num = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                          return <div key={i} className="text-sm font-medium text-gray-800 mb-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: num }} />;
                        }
                        if (t.length === 0) return <div key={i} className="h-3" />;
                        const para = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                        return <p key={i} className="text-sm text-gray-700 mb-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: para }} />;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Tab Resumen */}
            {reporteTab === 'resumen' && (
              <div className="space-y-4">
                {!resumenResultado && !generandoResumen && (
                  <div className="py-4">
                    <div className="text-center mb-3">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-[#02B381]/10 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-[#02B381]" />
                      </div>
                      <h3 className="text-base font-semibold text-[#002C63]">Resumen Ejecutivo</h3>
                      <p className="text-xs text-gray-500">1 cuartilla, estratégico y accionable</p>
                    </div>

                    {/* Mini gráficas en el resumen también */}
                    {statsData && (
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {(() => {
                          const STATUS_COLORS: Record<string, string> = { aprobado: '#02B381', rechazado: '#ef4444', pendiente_foto: '#f59e0b', pendiente_aprobacion: '#3b82f6', sin_item: '#94a3b8' };
                          const STATUS_LABELS: Record<string, string> = { aprobado: 'Aprob.', rechazado: 'Rech.', pendiente_foto: 'P.Foto', pendiente_aprobacion: 'P.Apr.', sin_item: 'Sin Ítem' };
                          const pieData = (statsData.porStatus || []).map((s: any) => ({ name: STATUS_LABELS[s.status] || s.status, value: Number(s.count), color: STATUS_COLORS[s.status] || '#94a3b8' }));
                          return (
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-[10px] font-semibold text-gray-500 mb-1">Por Estado</p>
                              <ResponsiveContainer width="100%" height={80}>
                                <PieChart>
                                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={30} innerRadius={15} strokeWidth={1}>
                                    {pieData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                                  </Pie>
                                  <RTooltip formatter={(v: any, n: any) => [v, n]} />
                                </PieChart>
                              </ResponsiveContainer>
                              <p className="text-[10px] text-gray-400">{statsData.total} ítems</p>
                            </div>
                          );
                        })()}
                        {(() => {
                          const COLORS = ['#002C63', '#02B381', '#3b82f6', '#f59e0b', '#ef4444'];
                          const barData = (statsData.porEmpresa || []).slice(0, 5).map((e: any, i: number) => ({ name: `E${i+1}`, value: Number(e.count), fill: COLORS[i % COLORS.length] }));
                          return (
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-[10px] font-semibold text-gray-500 mb-1">Top Empresas</p>
                              <ResponsiveContainer width="100%" height={80}>
                                <BarChart data={barData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                                  <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                                  <YAxis tick={{ fontSize: 8 }} />
                                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                    {barData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                                  </Bar>
                                  <RTooltip formatter={(v: any) => [v, 'Ítems']} />
                                </BarChart>
                              </ResponsiveContainer>
                              <p className="text-[10px] text-gray-400">{(statsData.porEmpresa || []).length} empresas</p>
                            </div>
                          );
                        })()}
                        {(() => {
                          const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'];
                          const barData = (statsData.porEspecialidad || []).slice(0, 5).map((e: any, i: number) => ({ name: `Esp${i+1}`, value: Number(e.count), fill: COLORS[i % COLORS.length] }));
                          return (
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-[10px] font-semibold text-gray-500 mb-1">Top Especialidades</p>
                              <ResponsiveContainer width="100%" height={80}>
                                <BarChart data={barData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                                  <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                                  <YAxis tick={{ fontSize: 8 }} />
                                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                    {barData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                                  </Bar>
                                  <RTooltip formatter={(v: any) => [v, 'Ítems']} />
                                </BarChart>
                              </ResponsiveContainer>
                              <p className="text-[10px] text-gray-400">{(statsData.porEspecialidad || []).length} espec.</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <div className="text-center">
                      <Button
                        className="bg-[#02B381] hover:bg-[#029a6e] text-white px-6"
                        onClick={handleGenerarResumen}
                      >
                        Generar Resumen
                      </Button>
                    </div>
                  </div>
                )}
                {generandoResumen && (
                  <div className="text-center py-12">
                    <Loader2 className="h-10 w-10 animate-spin text-[#02B381] mx-auto mb-4" />
                    <p className="text-sm text-gray-500">Generando resumen ejecutivo...</p>
                  </div>
                )}
                {resumenResultado && (
                  <div>
                    <div className="flex justify-end gap-2 mb-3">
                      <Button size="sm" variant="outline" onClick={() => handleDescargarPDFResumen(resumenResultado)} disabled={generandoPDFIA}>
                        {generandoPDFIA ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                        Abrir PDF
                      </Button>
                      <Button size="sm" className="bg-[#02B381] hover:bg-[#029a6e] text-white" onClick={handleGenerarResumen}>Regenerar</Button>
                    </div>

                    {/* 5 Gráficas Relevantes en Resumen */}
                    {chartDataIA && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Estado</p>
                          <ResponsiveContainer width="100%" height={80}>
                            <PieChart>
                              <Pie data={chartDataIA.porStatus} dataKey="value" cx="50%" cy="50%" outerRadius={28} innerRadius={14} strokeWidth={1}>
                                {chartDataIA.porStatus.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                              </Pie>
                              <RTooltip formatter={(v: any, n: any) => [v, n]} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Empresas</p>
                          <ResponsiveContainer width="100%" height={80}>
                            <BarChart data={chartDataIA.porEmpresa} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 6 }} />
                              <YAxis tick={{ fontSize: 6 }} />
                              <Bar dataKey="total" fill="#002C63" radius={[2,2,0,0]} />
                              <Bar dataKey="rechazados" fill="#ef4444" radius={[2,2,0,0]} />
                              <RTooltip />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Especialidades</p>
                          <ResponsiveContainer width="100%" height={80}>
                            <BarChart data={chartDataIA.porEspecialidad} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 6 }} />
                              <YAxis tick={{ fontSize: 6 }} />
                              <Bar dataKey="total" fill="#6366f1" radius={[2,2,0,0]} />
                              <Bar dataKey="rechazados" fill="#ef4444" radius={[2,2,0,0]} />
                              <RTooltip />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-2 text-center border">
                          <p className="text-[10px] font-bold text-[#002C63] mb-1">Defectos</p>
                          <ResponsiveContainer width="100%" height={80}>
                            <BarChart data={chartDataIA.defectos} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                              <XAxis type="number" tick={{ fontSize: 6 }} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 5 }} width={45} />
                              <Bar dataKey="frecuencia" fill="#f59e0b" radius={[0,2,2,0]} />
                              <RTooltip />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Top Defectos Recurrentes - Evidencia Fotográfica */}
                    <div className="mb-3">
                      <p className="text-xs font-bold text-[#002C63] mb-1.5">
                        {fotosEvidenciaIA.some((f: any) => f.defectoNombre) ? `Top ${fotosEvidenciaIA.length} Defectos Recurrentes` : `Evidencia Fotográfica (${fotosEvidenciaIA.length} ítems)`}
                      </p>
                      {fotosEvidenciaIA.length > 0 ? (
                        <div className="grid grid-cols-5 gap-1.5">
                          {fotosEvidenciaIA.slice(0, 5).map((foto: any) => (
                            <div key={foto.id} className="rounded-lg overflow-hidden border bg-gray-50">
                              {foto.fotoUrl ? (
                                <img src={getImageUrl(foto.fotoUrl)} alt={foto.defectoNombre || foto.codigo} className="w-full h-16 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <div className="w-full h-16 bg-gray-200 flex items-center justify-center"><span className="text-[7px] text-gray-400">Foto pendiente</span></div>
                              )}
                              <div className="p-1">
                                {foto.defectoNombre ? (
                                  <>
                                    <p className="text-[7px] font-bold text-[#002C63] truncate">{foto.defectoNombre}</p>
                                    <span className="text-[7px] px-1 rounded bg-red-100 text-red-700">{foto.defectoCount} ocurrencias</span>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-[7px] font-bold text-[#002C63] truncate">{foto.codigo}</p>
                                    <span className={`text-[7px] px-1 rounded ${foto.status === 'rechazado' ? 'bg-red-100 text-red-700' : foto.status === 'aprobado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{foto.status}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 border rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-400">Sin evidencia fotográfica disponible</p>
                        </div>
                      )}
                    </div>

                    <div className="prose prose-sm max-w-none bg-white rounded-lg border p-3" style={{ lineHeight: '1.65' }}>
                      {resumenResultado
                        .replace(/\\u[0-9a-fA-F]{4}/g, '')
                        .replace(/\\u\d{4}/g, '')
                        .replace(/[•·‣◦⁃∙–—―''""]/g, '')
                        .split('\n').map((line, i) => {
                        const t = line.replace(/\\u[0-9a-fA-F]{4}/g, '').replace(/\\u\d{4}/g, '').trim();
                        if (t.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-[#004080] mt-2 mb-1">{t.replace(/^#+\s*/, '')}</h3>;
                        if (t.startsWith('## ')) return <h2 key={i} className="text-sm font-bold text-[#002C63] mt-2.5 mb-1 border-b pb-0.5">{t.replace(/^#+\s*/, '')}</h2>;
                        if (t.startsWith('# ')) return <h1 key={i} className="text-base font-bold text-[#002C63] mt-3 mb-1">{t.replace(/^#+\s*/, '')}</h1>;
                        if (t.startsWith('- ') || t.startsWith('* ')) {
                          const bullet = t.replace(/^[-*]\s*/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                          return <div key={i} className="flex gap-1.5 ml-3 text-xs text-gray-700 mb-1 leading-relaxed"><span className="text-[#02B381] font-bold mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html: bullet }} /></div>;
                        }
                        if (t.match(/^\d+\./)) {
                          const num = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                          return <div key={i} className="text-xs font-medium text-gray-800 mb-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: num }} />;
                        }
                        if (t.length === 0) return <div key={i} className="h-1.5" />;
                        const para = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                        return <p key={i} className="text-xs text-gray-700 mb-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: para }} />;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Tab Historial */}
            {reporteTab === 'historial' && (
              <div className="space-y-3">
                {isAdmin && (
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      variant={mostrarArchivados ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setMostrarArchivados(!mostrarArchivados)}
                    >
                      {mostrarArchivados ? 'Ocultar archivados' : 'Ver archivados'}
                    </Button>
                  </div>
                )}
                {historialQuery.isLoading && (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-[#02B381] mx-auto" />
                  </div>
                )}
                {historialQuery.data?.reportes?.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p>No hay reportes generados aún.</p>
                  </div>
                )}
                {historialQuery.data?.reportes?.map((r: any) => {
                  const d = new Date(r.creadoEn || r.createdAt);
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const fechaMx = `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                  const tipoLabel = r.tipo === 'analisis_profundo' ? 'Análisis Profundo' : 'Resumen Ejecutivo';
                  const esArchivado = r.archivado;
                  return (
                    <div key={r.id} className={`border rounded-lg p-3 ${esArchivado ? 'bg-gray-100 opacity-70' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                          setAnalisisResultado(r.contenido);
                          setReporteTab('analisis');
                        }}>
                          {editandoReporteId === r.id ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editTituloTemp}
                                onChange={(e) => setEditTituloTemp(e.target.value)}
                                className="text-sm border rounded px-2 py-0.5 flex-1 min-w-0"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleGuardarTitulo(r.id);
                                  if (e.key === 'Escape') setEditandoReporteId(null);
                                }}
                              />
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleGuardarTitulo(r.id)}>
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditandoReporteId(null)}>
                                <X className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <p className="font-medium text-sm text-[#002C63] truncate">
                                {r.titulo || tipoLabel}
                                {esArchivado && <span className="ml-1 text-xs text-gray-400">(archivado)</span>}
                              </p>
                              <p className="text-xs text-gray-500">{tipoLabel} · {fechaMx}</p>
                            </>
                          )}
                        </div>
                        {isAdmin && editandoReporteId !== r.id && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Editar título" onClick={(e) => {
                              e.stopPropagation();
                              setEditandoReporteId(r.id);
                              setEditTituloTemp(r.titulo || tipoLabel);
                            }}>
                              <FileText className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={esArchivado ? 'Desarchivar' : 'Archivar'} onClick={(e) => {
                              e.stopPropagation();
                              handleArchivarReporte(r.id, !esArchivado);
                            }}>
                              <Layers className={`h-3.5 w-3.5 ${esArchivado ? 'text-green-500' : 'text-amber-500'}`} />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Eliminar" onClick={(e) => {
                              e.stopPropagation();
                              setReporteAEliminar(r.id);
                            }}>
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        )}
                        {!isAdmin && (
                          <ArrowRight className="h-4 w-4 text-gray-400 shrink-0 cursor-pointer" onClick={() => {
                            setAnalisisResultado(r.contenido);
                            setReporteTab('analisis');
                          }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Dialog de confirmación para eliminar reporte */}
            <AlertDialog open={reporteAEliminar !== null} onOpenChange={(open) => !open && setReporteAEliminar(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar reporte</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción es permanente y no se puede deshacer. ¿Deseas eliminar este reporte?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => reporteAEliminar && handleEliminarReporte(reporteAEliminar)}>
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
