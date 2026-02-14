import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import html2canvas from "html2canvas";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, PlusCircle, Trash2, Edit2, ZoomIn, ZoomOut, RotateCcw, Layers,
  Image as ImageIcon, X, Upload, ChevronLeft, ChevronRight, MapPin, MapPinOff,
  Eye, Search, Filter, Download, Maximize, Minimize, ExternalLink, Users,
  ListChecks, QrCode, Keyboard, Camera, RefreshCw, FileText, Check
} from "lucide-react";
import { generarReportePlanosPDF, type PlanoReportData } from "@/lib/reportePlanosPDF";
import CapturaRapida from "@/components/CapturaRapida";
import DashboardLayout from "@/components/DashboardLayout";
import { useLocation, useSearch } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { BrowserMultiFormatReader } from "@zxing/browser";

// ─── Colores de pin según estado del ítem ───
const PIN_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pendiente_foto_despues: { bg: "#f59e0b", border: "#d97706", text: "#fff" },
  pendiente_aprobacion: { bg: "#3b82f6", border: "#2563eb", text: "#fff" },
  aprobado: { bg: "#10b981", border: "#059669", text: "#fff" },
  rechazado: { bg: "#ef4444", border: "#dc2626", text: "#fff" },
  sin_item: { bg: "#6b7280", border: "#4b5563", text: "#fff" },
};

const STATUS_LABELS: Record<string, string> = {
  pendiente_foto_despues: "Pend. Foto",
  pendiente_aprobacion: "Pend. Aprob.",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  sin_item: "Sin ítem",
};

// ─── Tipos ───
type CaptureMode = "pin" | "nuevo" | "qr";

export default function Planos() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const isAdmin = user?.role === "superadmin" || user?.role === "admin";
  const { selectedProjectId } = useProject();

  // ─── Queries ───
  const { data: planosData, isLoading, refetch } = trpc.planos.listar.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  const { data: proyectoData } = trpc.proyectos.get.useQuery(
    { id: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  const diasCorreccion = proyectoData?.diasCorreccion || 8;
  const { data: itemsData } = trpc.items.list.useQuery(
    { proyectoId: selectedProjectId!, limit: 500, offset: 0 },
    { enabled: !!selectedProjectId }
  );

  // ─── Mutations planos ───
  const crearPlano = trpc.planos.crear.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano subido correctamente"); setShowAddDialog(false); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });
  const actualizarPlano = trpc.planos.actualizar.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano actualizado"); setShowEditDialog(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const eliminarPlano = trpc.planos.eliminar.useMutation({
    onSuccess: () => { refetch(); toast.success("Plano eliminado"); },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── State general ───
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<any>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [nombre, setNombre] = useState("");
  const [nivel, setNivel] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagenBase64, setImagenBase64] = useState("");
  const [imagenNombre, setImagenNombre] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [editNombre, setEditNombre] = useState("");
  const [editNivel, setEditNivel] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const planoContainerRef = useRef<HTMLDivElement>(null);

  // ─── State pines ───
  const [showPins, setShowPins] = useState(true);
  const [selectedPin, setSelectedPin] = useState<any>(null);
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [pendingPinPos, setPendingPinPos] = useState<{ x: number; y: number } | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [pinNota, setPinNota] = useState("");

  // State para interacción de taps en pines existentes
  const [tappedPin, setTappedPin] = useState<any>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const pinModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  // State para filtro de pines
  const [pinFilter, setPinFilter] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [residenteFilter, setResidenteFilter] = useState<string | null>(null);
  const [showResidenteMenu, setShowResidenteMenu] = useState(false);
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);

  // State para captura rápida inline
  const [showCapturaRapida, setShowCapturaRapida] = useState(false);
  const [capturaRapidaPinPos, setCapturaRapidaPinPos] = useState<{ x: number; y: number } | null>(null);
  const [itemsCreadosSesion, setItemsCreadosSesion] = useState<any[]>([]);
  const [showSeguimiento, setShowSeguimiento] = useState(false);

  // ═══ 3 MODOS DE CAPTURA ═══
  const [captureMode, setCaptureMode] = useState<CaptureMode>("pin");
  // +Nuevo Ítem mode
  const [showNuevoItemModal, setShowNuevoItemModal] = useState(false);
  // QR mode
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrManualInput, setQrManualInput] = useState("");
  const [qrScannerStatus, setQrScannerStatus] = useState<"idle" | "scanning" | "error" | "manual">("idle");
  const [qrErrorMessage, setQrErrorMessage] = useState("");
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrCodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrControlsRef = useRef<{ stop: () => void } | null>(null);

  // PDF Report
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [showPdfFilterDialog, setShowPdfFilterDialog] = useState(false);
  const [pdfFilterType, setPdfFilterType] = useState<"total" | "nivel" | "especialidad">("total");
  const [pdfFilterNivel, setPdfFilterNivel] = useState<number | null>(null);
  const [pdfFilterEspecialidad, setPdfFilterEspecialidad] = useState<string | null>(null);
  const [planosDataCache, setPlanosDataCache] = useState<PlanoReportData[] | null>(null);

  // Pin temporal rojo antes de confirmar (tap inmediato + draggable)
  const [tempPin, setTempPin] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingTempPin, setIsDraggingTempPin] = useState(false);
  const tempPinDragStart = useRef<{ x: number; y: number; pinX: number; pinY: number } | null>(null);

  // State para fullscreen del plano
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pendingImageBase64, setPendingImageBase64] = useState("");
  const [pendingImageNombre, setPendingImageNombre] = useState("");
  const viewerFileInputRef = useRef<HTMLInputElement>(null);

  // State para filtro por nivel
  const [filterNivel, setFilterNivel] = useState<number | null>(null);
  // URL param handling: planoId (open viewer on that plano) / assignPin (assign pin mode for item)
  const urlParamsProcessed = useRef(false);

  // ─── Query pines del plano actual ───
  const planos = planosData || [];
  const currentPlano = planos[viewerIndex];
  const { data: pinesData, refetch: refetchPines } = trpc.planos.pines.listar.useQuery(
    { planoId: currentPlano?.id! },
    { enabled: !!currentPlano?.id && showViewer }
  );

  // ─── Mutations pines ───
  const crearPin = trpc.planos.pines.crear.useMutation({
    onSuccess: () => { refetchPines(); toast.success("Pin agregado"); setShowItemSelector(false); setPendingPinPos(null); setPinNota(""); setTempPin(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const eliminarPin = trpc.planos.pines.eliminar.useMutation({
    onSuccess: () => { refetchPines(); toast.success("Pin eliminado"); setSelectedPin(null); setTappedPin(null); setShowPinModal(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const pines = pinesData || [];

  // ─── Filtrar pines ───
  const filteredPines = useMemo(() => {
    let result = pines;
    if (pinFilter) result = result.filter((p: any) => (p.itemEstado || "sin_item") === pinFilter);
    if (residenteFilter) result = result.filter((p: any) => p.residenteNombre === residenteFilter);
    return result;
  }, [pines, pinFilter, residenteFilter]);

  const residentesUnicos = useMemo(() => {
    const names = new Set<string>();
    pines.forEach((p: any) => { if (p.residenteNombre) names.add(p.residenteNombre); });
    return Array.from(names).sort();
  }, [pines]);

  const nivelesUnicos = useMemo(() => {
    const niveles = new Set<number>();
    planos.forEach((p: any) => niveles.add(p.nivel ?? 0));
    return Array.from(niveles).sort((a, b) => a - b);
  }, [planos]);

  const planosFiltrados = useMemo(() => {
    if (filterNivel === null) return planos;
    return planos.filter((p: any) => (p.nivel ?? 0) === filterNivel);
  }, [planos, filterNivel]);

  const pinCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pines.forEach((p: any) => {
      const estado = p.itemEstado || "sin_item";
      counts[estado] = (counts[estado] || 0) + 1;
    });
    return counts;
  }, [pines]);

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
      String(it.numeroInterno || "").includes(q)
    ).slice(0, 30);
  }, [allItems, itemSearch]);

  // ─── Helpers ───
  const resetForm = () => {
    setNombre(""); setNivel(""); setDescripcion(""); setImagenBase64(""); setImagenNombre(""); setPreviewUrl("");
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Solo se permiten imágenes"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("Máximo 15MB por imagen"); return; }
    setImagenNombre(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setImagenBase64(base64);
      setPreviewUrl(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = () => {
    if (!nombre.trim()) { toast.error("Ingresa un nombre para el plano"); return; }
    if (!imagenBase64) { toast.error("Selecciona una imagen del plano"); return; }
    if (!selectedProjectId) return;
    crearPlano.mutate({
      proyectoId: selectedProjectId,
      nombre: nombre.trim(),
      nivel: nivel ? parseInt(nivel) : 0,
      descripcion: descripcion.trim() || undefined,
      imagenBase64,
      imagenNombre,
    });
  };

  const handleEdit = () => {
    if (!selectedPlano || !editNombre.trim()) return;
    actualizarPlano.mutate({
      id: selectedPlano.id,
      nombre: editNombre.trim(),
      nivel: editNivel ? parseInt(editNivel) : 0,
      descripcion: editDescripcion.trim() || undefined,
    });
  };

  const openEditDialog = (plano: any) => {
    setSelectedPlano(plano);
    setEditNombre(plano.nombre);
    setEditNivel(plano.nivel?.toString() || "");
    setEditDescripcion(plano.descripcion || "");
    setShowEditDialog(true);
  };

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedPin(null);
    setTappedPin(null);
    setShowPinModal(false);
    setPinFilter(null);
    setTempPin(null);
    setShowViewer(true);
    // Default to pin mode for admin
    if (isAdmin) setCaptureMode("pin");
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // ─── Auto-open visor ───
  const [autoOpened, setAutoOpened] = useState(false);

  // Reset al cambiar de proyecto
  useEffect(() => {
    setShowViewer(false);
    setSelectedPin(null);
    setTappedPin(null);
    setShowPinModal(false);
    setViewerIndex(0);
    setFilterNivel(null);
    setAutoOpened(false);
    setTempPin(null);
    setCaptureMode("pin");
  }, [selectedProjectId]);

  useEffect(() => {
    if (currentPlano?.id) {
      refetchPines();
      setSelectedPin(null);
      setTappedPin(null);
      setShowPinModal(false);
    }
  }, [viewerIndex, currentPlano?.id]);

  useEffect(() => {
    if (!autoOpened && planos.length > 0 && !showViewer && !isLoading) {
      setAutoOpened(true);
      // Check URL params before auto-opening
      const params = new URLSearchParams(searchString);
      const planoIdParam = params.get('planoId');
      if (planoIdParam) {
        const idx = planos.findIndex((p: any) => p.id === parseInt(planoIdParam));
        if (idx >= 0) {
          openViewer(idx);
          urlParamsProcessed.current = true;
          return;
        }
      }
      openViewer(0);
    }
  }, [planos.length, isLoading, autoOpened, showViewer, searchString]);

  // Limpiar timers al desmontar
  useEffect(() => {
    return () => {
      if (pinModalTimerRef.current) clearTimeout(pinModalTimerRef.current);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // PIN EXISTENTE: click → ir al ítem, long press → modal info
  // ═══════════════════════════════════════════════════════════
  const handlePinPointerDown = useCallback((pin: any, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setTappedPin(pin);
      setShowPinModal(true);
    }, 800);
  }, []);

  const handlePinPointerUp = useCallback((pin: any, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!longPressTriggeredRef.current) {
      // Click normal → ir al ítem directamente
      if (pin.itemId) {
        setShowViewer(false);
        navigate(`/item/${pin.itemId}`);
      } else {
        toast.info(pin.nota || "Pin sin ítem vinculado");
      }
    }
  }, [navigate]);

  const handlePinPointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const goToItem = useCallback((itemId: number) => {
    if (pinModalTimerRef.current) clearTimeout(pinModalTimerRef.current);
    setShowPinModal(false);
    setShowViewer(false);
    navigate(`/item/${itemId}`);
  }, [navigate]);

  const closePinModal = useCallback(() => {
    if (pinModalTimerRef.current) clearTimeout(pinModalTimerRef.current);
    setShowPinModal(false);
    setTappedPin(null);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // MODO PIN EN PLANO: Tap inmediato → coloca pin rojo draggable → confirmar → CapturaRapida
  // ═══════════════════════════════════════════════════════════
  const isPinMode = captureMode === "pin" && isAdmin;

  const placePinAtPosition = useCallback((clientX: number, clientY: number) => {
    if (!isPinMode) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    // Vibrate for feedback
    if ("vibrate" in navigator) {
      (navigator as any).vibrate(50);
    }

    const pos = { x, y };
    setTempPin(pos);
    setPendingPinPos(pos);
  }, [isPinMode]);

  const confirmTempPin = useCallback(() => {
    if (!tempPin) return;
    setCapturaRapidaPinPos(tempPin);
    setShowCapturaRapida(true);
  }, [tempPin]);

  const cancelTempPin = useCallback(() => {
    setTempPin(null);
    setPendingPinPos(null);
    setIsDraggingTempPin(false);
    tempPinDragStart.current = null;
  }, []);

  // Drag handlers for temp pin
  const handleTempPinDragStart = useCallback((clientX: number, clientY: number) => {
    if (!tempPin) return;
    setIsDraggingTempPin(true);
    tempPinDragStart.current = { x: clientX, y: clientY, pinX: tempPin.x, pinY: tempPin.y };
  }, [tempPin]);

  const handleTempPinDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingTempPin || !tempPinDragStart.current) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const dx = ((clientX - tempPinDragStart.current.x) / rect.width) * 100;
    const dy = ((clientY - tempPinDragStart.current.y) / rect.height) * 100;
    const newX = Math.max(0, Math.min(100, tempPinDragStart.current.pinX + dx));
    const newY = Math.max(0, Math.min(100, tempPinDragStart.current.pinY + dy));
    setTempPin({ x: newX, y: newY });
    setPendingPinPos({ x: newX, y: newY });
  }, [isDraggingTempPin]);

  const handleTempPinDragEnd = useCallback(() => {
    setIsDraggingTempPin(false);
    tempPinDragStart.current = null;
  }, []);

  // Desktop: mousedown on plano container
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  const handlePlanoMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPinMode) {
      // Track mouse start for tap detection
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    } else {
      // Pan mode
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [isPinMode, pan]);

  const handlePlanoMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPinMode) {
      // If dragging temp pin, handle that
      if (isDraggingTempPin) {
        handleTempPinDragMove(e.clientX, e.clientY);
        return;
      }
      // If moved too far from click start, it's not a tap
      if (mouseDownPosRef.current) {
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        if (dx > 10 || dy > 10) {
          mouseDownPosRef.current = null; // cancel tap
        }
      }
    } else if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isPinMode, isDragging, dragStart, isDraggingTempPin, handleTempPinDragMove]);

  const handlePlanoMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPinMode) {
      if (isDraggingTempPin) {
        handleTempPinDragEnd();
        return;
      }
      // If it was a tap (didn't move far), place pin
      if (mouseDownPosRef.current && !tempPin) {
        placePinAtPosition(e.clientX, e.clientY);
      }
      mouseDownPosRef.current = null;
    }
    setIsDragging(false);
  }, [isPinMode, isDraggingTempPin, handleTempPinDragEnd, tempPin, placePinAtPosition]);

  // Touch handlers (with pinch zoom support)
  const touchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastPinchDistRef = useRef<number | null>(null);
  const lastPinchZoomRef = useRef<number>(1);
  const isPinchingRef = useRef(false);

  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Start pinch zoom
      setIsDragging(false);
      isPinchingRef.current = true;
      lastPinchDistRef.current = getTouchDistance(e.touches[0], e.touches[1]);
      lastPinchZoomRef.current = zoom;
      return;
    }
    if (e.touches.length === 1 && !isPinchingRef.current) {
      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      if (isPinMode) {
        // In pin mode: if dragging temp pin, start drag; otherwise just track for tap
        // (tap detection happens in touchEnd)
      } else {
        setIsDragging(true);
        setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
      }
    }
  }, [isPinMode, pan, zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      if (lastPinchDistRef.current !== null) {
        const scale = dist / lastPinchDistRef.current;
        const newZoom = Math.max(0.2, Math.min(5, lastPinchZoomRef.current * scale));
        setZoom(newZoom);
      }
      return;
    }
    if (e.touches.length !== 1 || isPinchingRef.current) return;
    const touch = e.touches[0];
    if (isPinMode) {
      // If dragging temp pin
      if (isDraggingTempPin) {
        handleTempPinDragMove(touch.clientX, touch.clientY);
        return;
      }
      // Mark as moved (not a tap) if moved too far
      if (touchStartPosRef.current) {
        const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
        if (dx > 10 || dy > 10) {
          touchStartPosRef.current = null; // cancel tap
        }
      }
    } else if (isDragging) {
      setPan({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
    }
  }, [isPinMode, isDragging, dragStart, isDraggingTempPin, handleTempPinDragMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      // All fingers lifted
      isPinchingRef.current = false;
      lastPinchDistRef.current = null;
    }

    if (isPinMode) {
      if (isDraggingTempPin) {
        handleTempPinDragEnd();
      } else if (touchStartPosRef.current && !tempPin) {
        // It was a tap (didn't move far) → place pin
        const touch = e.changedTouches?.[0];
        if (touch) {
          placePinAtPosition(touch.clientX, touch.clientY);
        }
      }
    }

    setIsDragging(false);
    // Swipe detection for plano navigation (only when not in pin mode and zoom <= 1)
    if (!isPinMode && touchStartPosRef.current && planos.length > 1 && zoom <= 1.05) {
      const endX = e.changedTouches?.[0]?.clientX;
      const startX = touchStartPosRef.current.x;
      const elapsed = Date.now() - touchStartPosRef.current.time;
      if (endX !== undefined && elapsed < 400) {
        const dx = endX - startX;
        if (Math.abs(dx) > 60) {
          if (dx < 0) {
            // Swipe left → next plano
            setViewerIndex(i => (i + 1) % planos.length);
          } else {
            // Swipe right → prev plano
            setViewerIndex(i => (i - 1 + planos.length) % planos.length);
          }
          resetView(); setSelectedPin(null); setTappedPin(null); setShowPinModal(false); setTempPin(null);
        }
      }
    }
    touchStartPosRef.current = null;
  }, [isPinMode, isDraggingTempPin, handleTempPinDragEnd, tempPin, placePinAtPosition, planos.length, zoom]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.2, Math.min(5, prev + delta)));
  };

  // Confirmar pin con ítem seleccionado (vincular)
  const confirmPin = (itemId?: number) => {
    if (!pendingPinPos || !currentPlano) return;
    crearPin.mutate({
      planoId: currentPlano.id,
      itemId: itemId,
      posX: pendingPinPos.x.toFixed(4),
      posY: pendingPinPos.y.toFixed(4),
      nota: pinNota.trim() || undefined,
    });
  };

  // Crear nuevo ítem desde pin: navegar a NuevoItem con datos del pin
  const handleCreateItemFromPin = () => {
    if (!pendingPinPos || !currentPlano) return;
    const params = new URLSearchParams();
    params.set("pinPlanoId", currentPlano.id.toString());
    params.set("pinPosX", pendingPinPos.x.toFixed(4));
    params.set("pinPosY", pendingPinPos.y.toFixed(4));
    if (currentPlano.nivel) params.set("nivel", currentPlano.nivel.toString());
    if (pinNota.trim()) params.set("pinNota", pinNota.trim());
    setShowItemSelector(false);
    setPendingPinPos(null);
    setPinNota("");
    setShowViewer(false);
    setTempPin(null);
    navigate(`/nuevo-item?${params.toString()}`);
  };

  // ═══════════════════════════════════════════════════════════
  // MODO QR: Scanner + Manual Input
  // ═══════════════════════════════════════════════════════════
  const stopQrScanner = useCallback(() => {
    if (qrControlsRef.current) {
      try { qrControlsRef.current.stop(); } catch {}
      qrControlsRef.current = null;
    }
    qrCodeReaderRef.current = null;
    if (qrStreamRef.current) {
      try { qrStreamRef.current.getTracks().forEach(track => track.stop()); } catch {}
      qrStreamRef.current = null;
    }
    if (qrVideoRef.current) {
      try { qrVideoRef.current.srcObject = null; } catch {}
    }
  }, []);

  const handleQrResult = useCallback((result: string) => {
    let codigo = result.trim();
    // Extract code from URLs
    if (codigo.includes("/seguimiento/")) {
      codigo = codigo.split("/seguimiento/").pop() || codigo;
    } else if (codigo.includes("/items/")) {
      codigo = codigo.split("/items/").pop() || codigo;
    }
    codigo = codigo.split("?")[0].split("#")[0];

    if ("vibrate" in navigator) {
      (navigator as any).vibrate(100);
    }
    toast.success(`QR detectado: ${codigo}`);
    stopQrScanner();
    setShowQrScanner(false);
    setQrScannerStatus("idle");

    // Navigate to item
    if (/^\d+$/.test(codigo)) {
      setShowViewer(false);
      navigate(`/items/${codigo}`);
    } else {
      setShowViewer(false);
      navigate(`/seguimiento/${codigo}`);
    }
  }, [navigate, stopQrScanner]);

  const startQrScanner = useCallback(async () => {
    setQrScannerStatus("scanning");
    setQrErrorMessage("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setQrScannerStatus("error");
      setQrErrorMessage("La cámara no está disponible. Asegúrate de estar en HTTPS.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      qrStreamRef.current = stream;
      const video = qrVideoRef.current;
      if (!video) { stream.getTracks().forEach(t => t.stop()); setQrScannerStatus("error"); setQrErrorMessage("No se pudo inicializar el video."); return; }
      video.srcObject = stream;
      await video.play();

      const codeReader = new BrowserMultiFormatReader();
      qrCodeReaderRef.current = codeReader;
      const controls = await codeReader.decodeFromVideoElement(video, (result) => {
        if (result) {
          const text = result.getText().trim();
          if (text) handleQrResult(text);
        }
      });
      qrControlsRef.current = controls;
    } catch (err: any) {
      console.error("Error QR camera:", err);
      setQrScannerStatus("error");
      const name = err?.name || "Error";
      if (name === "NotAllowedError") {
        setQrErrorMessage("Permiso de cámara denegado. Permite el acceso en la configuración del navegador.");
      } else if (name === "NotFoundError") {
        setQrErrorMessage("No se detectó ninguna cámara.");
      } else {
        setQrErrorMessage(`Error al acceder a la cámara: ${name}`);
      }
    }
  }, [handleQrResult]);

  const handleQrManualSubmit = useCallback(() => {
    const code = qrManualInput.trim();
    if (!code) { toast.error("Ingresa un código"); return; }
    handleQrResult(code);
  }, [qrManualInput, handleQrResult]);

  const closeQrScanner = useCallback(() => {
    stopQrScanner();
    setShowQrScanner(false);
    setQrScannerStatus("idle");
    setQrManualInput("");
    setQrErrorMessage("");
  }, [stopQrScanner]);

  // Start QR scanner when dialog opens
  useEffect(() => {
    if (showQrScanner && qrScannerStatus === "idle") {
      const timer = setTimeout(startQrScanner, 200);
      return () => clearTimeout(timer);
    }
  }, [showQrScanner, qrScannerStatus, startQrScanner]);

  // Cleanup QR on unmount
  useEffect(() => {
    return () => { stopQrScanner(); };
  }, [stopQrScanner]);

  // ═══════════════════════════════════════════════════════════
  // Descargar plano con pines
  // ═══════════════════════════════════════════════════════════
  const handleDownloadPlano = useCallback(async () => {
    if (!currentPlano?.imagenUrl) return;
    const container = planoContainerRef.current;
    const img = imgRef.current;
    if (!container || !img) {
      try {
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(currentPlano.imagenUrl)}`;
        const resp = await fetch(proxyUrl);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `Plano_${currentPlano.nombre || "plano"}.png`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      } catch { toast.error("Error al descargar plano"); }
      return;
    }
    toast.info("Capturando plano con pines...");
    try {
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(currentPlano.imagenUrl)}`;
      const imgResp = await fetch(proxyUrl);
      const imgBlob = await imgResp.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imgBlob);
      });
      const originalSrc = img.src;
      img.src = base64;
      await new Promise<void>((resolve) => {
        if (img.complete) { resolve(); return; }
        img.onload = () => resolve();
        setTimeout(resolve, 2000);
      });
      const canvas = await html2canvas(container, { useCORS: true, allowTaint: true, backgroundColor: "#ffffff", scale: 2, logging: false });
      img.src = originalSrc;
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) { toast.error("Error al generar imagen"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const nombreArchivo = `Plano_${currentPlano.nombre || "plano"}_N${currentPlano.nivel ?? 0}_con_pines.png`;
      a.download = nombreArchivo; a.setAttribute("download", nombreArchivo); a.style.display = "none";
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      toast.success("Plano descargado con pines");
    } catch (err) {
      console.error("Error capturando plano:", err);
      try {
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(currentPlano.imagenUrl)}`;
        const resp = await fetch(proxyUrl);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `Plano_${currentPlano.nombre || "plano"}.png`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
        toast.success("Plano descargado (sin pines)");
      } catch { toast.error("Error al descargar plano"); }
    }
  }, [currentPlano]);

  // ─── Generar Reporte PDF: abrir dialog de filtros ───
  const handleOpenPdfFilter = useCallback(async () => {
    if (!selectedProjectId || generandoPDF) return;
    setGenerandoPDF(true);
    setPdfProgress("Obteniendo datos...");
    try {
      const inputPayload = { "0": { json: { proyectoId: selectedProjectId } } };
      const reportData = await fetch(`/api/trpc/planos.pines.reportePines?batch=1&input=${encodeURIComponent(JSON.stringify(inputPayload))}`, {
        credentials: 'include',
      }).then(r => r.json());
      const batchResult = Array.isArray(reportData) ? reportData[0] : reportData;
      const planosData: PlanoReportData[] = batchResult?.result?.data?.json || batchResult?.result?.data || [];
      if (planosData.length === 0) {
        toast.error("No hay planos con pines para generar el reporte");
        return;
      }
      setPlanosDataCache(planosData);
      setPdfFilterType("total");
      setPdfFilterNivel(null);
      setPdfFilterEspecialidad(null);
      setShowPdfFilterDialog(true);
    } catch (err) {
      console.error("Error obteniendo datos PDF:", err);
      toast.error("Error al obtener datos para el reporte");
    } finally {
      setGenerandoPDF(false);
      setPdfProgress("");
    }
  }, [selectedProjectId, generandoPDF]);

  const handleGenerarReportePDF = useCallback(async () => {
    if (!planosDataCache) return;
    setShowPdfFilterDialog(false);
    setGenerandoPDF(true);
    setPdfProgress("Generando PDF...");
    try {
      const proyectoNombre = proyectoData?.nombre || "Proyecto";
      let filterLabel: string | null = null;
      if (pdfFilterType === "nivel" && pdfFilterNivel !== null) {
        const p = planosDataCache.find(pl => pl.nivel === pdfFilterNivel);
        filterLabel = `Nivel: N${pdfFilterNivel}${p ? " - " + p.nombre : ""}`;
      } else if (pdfFilterType === "especialidad" && pdfFilterEspecialidad) {
        filterLabel = `Especialidad: ${pdfFilterEspecialidad}`;
      }
      await generarReportePlanosPDF({
        proyectoNombre,
        planos: planosDataCache,
        filterNivel: pdfFilterType === "nivel" ? pdfFilterNivel : null,
        filterEspecialidad: pdfFilterType === "especialidad" ? pdfFilterEspecialidad : null,
        filterLabel,
        onProgress: (msg) => setPdfProgress(msg),
      });
      toast.success("Reporte PDF generado");
    } catch (err) {
      console.error("Error generando PDF:", err);
      toast.error("Error al generar el reporte PDF");
    } finally {
      setGenerandoPDF(false);
      setPdfProgress("");
    }
  }, [planosDataCache, proyectoData, pdfFilterType, pdfFilterNivel, pdfFilterEspecialidad]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      viewerRef.current?.parentElement?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  if (!selectedProjectId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-slate-400">
          Selecciona un proyecto primero
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="space-y-4">
      {/* ═══ STICKY HEADER: 3 MODOS DE CAPTURA ═══ */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 -mx-4 px-4 pb-3 pt-2 sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              Planos y Pines
            </h2>
            <p className="text-xs text-slate-500">
              {planos.length} plano{planos.length !== 1 ? "s" : ""} — Modo de captura:
            </p>
          </div>
          <div className="flex items-center gap-2">
            {nivelesUnicos.length > 1 && (
              <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                <button onClick={() => setFilterNivel(null)} className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${filterNivel === null ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  Todos
                </button>
                {nivelesUnicos.map(n => (
                  <button key={n} onClick={() => setFilterNivel(n)} className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${filterNivel === n ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    N{n}
                  </button>
                ))}
              </div>
            )}
            <Button onClick={handleOpenPdfFilter} disabled={generandoPDF || !planos?.length} size="sm" variant="outline" className="gap-1 text-xs border-slate-300 text-slate-700 hover:bg-slate-100">
              {generandoPDF ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{generandoPDF ? pdfProgress || "Generando..." : "Reporte PDF"}</span>
            </Button>
            {isAdmin && (
              <Button onClick={() => { resetForm(); setShowAddDialog(true); }} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Subir Plano</span>
              </Button>
            )}
          </div>
        </div>

        {/* ═══ 3 BOTONES DE MODO ═══ */}
        {isAdmin && (
          <div className="flex gap-2">
            {/* Pin en Plano */}
            <button
              onClick={() => { setCaptureMode("pin"); if (!showViewer && planos.length > 0) openViewer(0); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border-2 ${
                captureMode === "pin"
                  ? "bg-emerald-50 border-emerald-600 text-emerald-700 shadow-md shadow-emerald-100"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <MapPin className={`w-4 h-4 ${captureMode === "pin" ? "text-emerald-600" : ""}`} />
              <span className="hidden xs:inline">Pin en Plano</span>
              <span className="xs:hidden">Pin</span>
            </button>

            {/* +Nuevo Ítem */}
            <button
              onClick={() => { setCaptureMode("nuevo"); setShowNuevoItemModal(true); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border-2 ${
                captureMode === "nuevo"
                  ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-md shadow-emerald-100"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <PlusCircle className={`w-4 h-4 ${captureMode === "nuevo" ? "text-emerald-500" : ""}`} />
              <span className="hidden xs:inline">+ Nuevo Ítem</span>
              <span className="xs:hidden">+ Ítem</span>
            </button>

            {/* QR */}
            <button
              onClick={() => { setCaptureMode("qr"); setShowQrScanner(true); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border-2 ${
                captureMode === "qr"
                  ? "bg-blue-50 border-blue-500 text-blue-700 shadow-md shadow-blue-100"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <QrCode className={`w-4 h-4 ${captureMode === "qr" ? "text-blue-500" : ""}`} />
              QR
            </button>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && planos.length === 0 && (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">Sin planos</h3>
            <p className="text-sm text-slate-500 mb-4 max-w-sm">
              Sube imágenes de los planos arquitectónicos de cada nivel del proyecto
            </p>
            {isAdmin && (
              <Button onClick={() => { resetForm(); setShowAddDialog(true); }} variant="outline" className="gap-1.5">
                <Upload className="w-4 h-4" /> Subir primer plano
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grid de planos */}
      {!isLoading && planosFiltrados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {planosFiltrados.map((plano: any) => {
            const originalIndex = planos.findIndex((p: any) => p.id === plano.id);
            return (
              <Card key={plano.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                <div className="relative h-44 bg-slate-50 overflow-hidden" onClick={() => openViewer(originalIndex)}>
                  <img src={plano.imagenUrl} alt={plano.nombre} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs font-bold text-slate-700 shadow-sm">
                    Nivel {plano.nivel ?? 0}
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
                  </div>
                </div>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate text-sm">{plano.nombre}</h3>
                      {plano.descripcion && <p className="text-xs text-slate-500 truncate mt-0.5">{plano.descripcion}</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button onClick={(e) => { e.stopPropagation(); openEditDialog(plano); }} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar plano "${plano.nombre}"?`)) eliminarPlano.mutate({ id: plano.id }); }} className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* VISOR FULLSCREEN CON PINES                                 */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showViewer && currentPlano && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col">
          {/* === BARRA SUPERIOR FIJA === */}
          <div className="flex-shrink-0 bg-[#002C63] text-white border-b border-[#002C63] z-50">
            <div className="flex items-center justify-between px-2 sm:px-3 py-2 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => { setShowViewer(false); setSelectedPin(null); setTappedPin(null); setShowPinModal(false); cancelTempPin(); if (pinModalTimerRef.current) clearTimeout(pinModalTimerRef.current); }} className="p-2 hover:bg-white/10 rounded-lg flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <span className="font-semibold text-xs sm:text-sm truncate block">{currentPlano.nombre}</span>
                  <span className="text-[10px] text-white/60">N{currentPlano.nivel ?? 0} — {filteredPines.length} pin{filteredPines.length !== 1 ? "es" : ""}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap justify-end">
                {isAdmin && (
                  <>
                    <input ref={viewerFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 15 * 1024 * 1024) { toast.error("Imagen demasiado grande (máx 15MB)"); return; }
                      const reader = new FileReader();
                      reader.onload = () => { setPendingImageBase64(reader.result as string); setPendingImageNombre(file.name); };
                      reader.readAsDataURL(file);
                    }} />
                    <button onClick={() => viewerFileInputRef.current?.click()} className="px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition-colors" title="Subir/cambiar imagen del plano">
                      <Upload className="w-4 h-4" />
                      <span className="hidden sm:inline">Subir</span>
                    </button>
                    {pendingImageBase64 && (
                      <button onClick={() => {
                        if (!currentPlano) return;
                        actualizarPlano.mutate({ id: currentPlano.id, nombre: currentPlano.nombre, nivel: currentPlano.nivel ?? 0, descripcion: currentPlano.descripcion || undefined, imagenBase64: pendingImageBase64, imagenNombre: pendingImageNombre }, {
                          onSuccess: () => { setPendingImageBase64(""); setPendingImageNombre(""); toast.success("Imagen del plano actualizada"); }
                        });
                      }} disabled={actualizarPlano.isPending} className="px-3 sm:px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 animate-pulse shadow-lg shadow-emerald-500/30" title="Guardar imagen del plano">
                        {actualizarPlano.isPending ? <RotateCcw className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" /><span>Guardar</span></>}
                      </button>
                    )}
                  </>
                )}
                {isAdmin && (
                  <button onClick={handleDownloadPlano} className="px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition-colors" title="Descargar plano con pines">
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Descargar</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* === BARRA DE HERRAMIENTAS === */}
          <div className="flex-shrink-0 flex items-center justify-between px-2 py-1 bg-slate-100 text-slate-800 gap-1">
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* Filtro por estado */}
              <div className="relative">
                <button onClick={() => setShowFilterMenu(f => !f)} className={`p-1.5 rounded-lg transition-colors ${pinFilter ? "bg-emerald-600 text-white" : "hover:bg-slate-200"}`} title="Filtrar pines">
                  <Filter className="w-4 h-4" />
                </button>
                {showFilterMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[160px] z-50">
                    <button onClick={() => { setPinFilter(null); setShowFilterMenu(false); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 ${!pinFilter ? "text-emerald-600 font-bold" : "text-slate-700"}`}>
                      Todos ({pines.length})
                    </button>
                    {Object.entries(PIN_COLORS).map(([key, colors]) => (
                      <button key={key} onClick={() => { setPinFilter(key); setShowFilterMenu(false); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 flex items-center gap-2 text-slate-700 ${pinFilter === key ? "font-bold" : ""}`}>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors.bg }} />
                        <span>{STATUS_LABELS[key]} ({pinCounts[key] || 0})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Filtro por residente */}
              <div className="relative">
                <button onClick={() => { setShowResidenteMenu(f => !f); setShowFilterMenu(false); }} className={`p-1.5 rounded-lg transition-colors ${residenteFilter ? "bg-blue-600 text-white" : "hover:bg-slate-200"}`} title="Filtrar por residente">
                  <Users className="w-4 h-4" />
                </button>
                {showResidenteMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[180px] z-50 max-h-[250px] overflow-y-auto">
                    <button onClick={() => { setResidenteFilter(null); setShowResidenteMenu(false); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 ${!residenteFilter ? "text-blue-600 font-bold" : "text-slate-700"}`}>
                      Todos los residentes
                    </button>
                    {residentesUnicos.map((nombre) => {
                      const count = pines.filter((p: any) => p.residenteNombre === nombre).length;
                      const getInit = (n: string) => { const p = n.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : p[0].substring(0,2).toUpperCase(); };
                      return (
                        <button key={nombre} onClick={() => { setResidenteFilter(nombre); setShowResidenteMenu(false); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 flex items-center gap-2 ${residenteFilter === nombre ? "text-blue-600 font-bold" : "text-slate-700"}`}>
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">{getInit(nombre)}</span>
                          <span className="truncate">{nombre} ({count})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Toggle pines */}
              <button onClick={() => setShowPins(p => !p)} className={`p-1.5 rounded-lg transition-colors ${showPins ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "hover:bg-slate-200"}`} title={showPins ? "Ocultar pines" : "Mostrar pines"}>
                {showPins ? <MapPin className="w-4 h-4" /> : <MapPinOff className="w-4 h-4" />}
              </button>
              {/* Indicador de modo pin activo - solo contorno, fondo blanco */}
              {isPinMode && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-emerald-500 bg-white rounded-lg text-xs font-bold text-emerald-600">
                  <MapPin className="w-4 h-4" />
                  <span className="hidden sm:inline">Toca para colocar pin</span>
                  <span className="sm:hidden">Toca</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} className="p-1.5 hover:bg-slate-200 rounded-lg"><ZoomOut className="w-4 h-4" /></button>
              <span className="text-[10px] text-slate-500 w-8 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(5, z + 0.2))} className="p-1.5 hover:bg-slate-200 rounded-lg"><ZoomIn className="w-4 h-4" /></button>
              <button onClick={toggleFullscreen} className="p-1.5 hover:bg-slate-200 rounded-lg" title="Pantalla completa">
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
              <button onClick={resetView} className="p-1.5 hover:bg-slate-200 rounded-lg" title="Restablecer vista"><RotateCcw className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Green banner removed - pin mode indicator is in the toolbar */}

          {/* === ÁREA DEL PLANO === */}
          <div
            ref={viewerRef}
            className={`flex-1 min-h-0 overflow-hidden select-none ${isPinMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
            onMouseDown={handlePlanoMouseDown}
            onMouseMove={handlePlanoMouseMove}
            onMouseUp={handlePlanoMouseUp}
            onMouseLeave={handlePlanoMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="w-full h-full flex items-center justify-center relative" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: isDragging ? "none" : "transform 0.1s" }}>
              <div ref={planoContainerRef} className="relative">
                <img
                  ref={imgRef}
                  src={currentPlano.imagenUrl}
                  alt={currentPlano.nombre}
                  className="max-w-none"
                  draggable={false}
                  style={{ maxHeight: "calc(100vh - 140px)", maxWidth: "100vw", objectFit: "contain", WebkitTouchCallout: "none", WebkitUserSelect: "none" } as React.CSSProperties}
                />



                {/* Pin temporal rojo draggable (antes de confirmar) */}
                {tempPin && (
                  <div
                    className="absolute z-40"
                    style={{
                      left: `${tempPin.x}%`,
                      top: `${tempPin.y}%`,
                      transform: "translate(-50%, -100%)",
                      cursor: "grab",
                      touchAction: "none",
                    }}
                    onMouseDown={(e) => { e.stopPropagation(); handleTempPinDragStart(e.clientX, e.clientY); }}
                    onTouchStart={(e) => { e.stopPropagation(); const t = e.touches[0]; if (t) handleTempPinDragStart(t.clientX, t.clientY); }}
                    onTouchMove={(e) => { e.stopPropagation(); const t = e.touches[0]; if (t) handleTempPinDragMove(t.clientX, t.clientY); }}
                    onTouchEnd={(e) => { e.stopPropagation(); handleTempPinDragEnd(); }}
                  >
                    {/* Animated bounce pin */}
                    <div className={isDraggingTempPin ? "" : "animate-bounce"} style={{ animationDuration: "1.5s" }}>
                      <svg width={40} height={52} viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 3px 6px rgba(239,68,68,0.6))" }}>
                        <path d="M15 38C15 38 28 22 28 14C28 6.82 22.18 1 15 1C7.82 1 2 6.82 2 14C2 22 15 38 15 38Z" fill="#ef4444" stroke="#dc2626" strokeWidth="1.5" />
                        <circle cx="15" cy="14" r="9" fill="white" fillOpacity="0.3" />
                        <text x="15" y="14" textAnchor="middle" dominantBaseline="central" fill="white" fontWeight="700" fontSize="12" fontFamily="system-ui">+</text>
                      </svg>
                    </div>
                    {/* Drag hint label */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded-full pointer-events-none">
                      Arrastra para ajustar
                    </div>
                  </div>
                )}

                {/* Pines existentes */}
                {showPins && filteredPines.map((pin: any) => {
                  const estado = pin.itemEstado || "sin_item";
                  const colors = PIN_COLORS[estado] || PIN_COLORS.sin_item;
                  const isTapped = tappedPin?.id === pin.id;
                  const getInitials = (name: string | null | undefined) => {
                    if (!name) return "?";
                    const parts = name.trim().split(/\s+/);
                    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                    return parts[0].substring(0, 2).toUpperCase();
                  };
                  const initials = getInitials(pin.residenteNombre);
                  const pinSize = isTapped ? 38 : 30;
                  const isHovered = hoveredPin === pin.id;

                  return (
                    <div
                      key={pin.id}
                      className="absolute"
                      style={{
                        left: `${parseFloat(pin.posX)}%`,
                        top: `${parseFloat(pin.posY)}%`,
                        transform: "translate(-50%, -100%)",
                        zIndex: isTapped || isHovered ? 50 : 10,
                        cursor: "pointer",
                        transition: "transform 0.15s ease",
                      }}
                      onMouseDown={(e) => handlePinPointerDown(pin, e)}
                      onMouseUp={(e) => handlePinPointerUp(pin, e)}
                      onMouseEnter={() => setHoveredPin(pin.id)}
                      onMouseLeave={() => { setHoveredPin(null); handlePinPointerLeave(); }}
                      onTouchStart={(e) => handlePinPointerDown(pin, e)}
                      onTouchEnd={(e) => handlePinPointerUp(pin, e)}
                    >
                      {isHovered && !showPinModal && pin.residenteNombre && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-[10px] rounded-md whitespace-nowrap shadow-lg pointer-events-none z-50" style={{ minWidth: "max-content" }}>
                          <span className="font-semibold">{pin.residenteNombre}</span>
                          {pin.itemCodigo && <span className="text-white/60 ml-1.5">{pin.itemCodigo}</span>}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-slate-900" />
                        </div>
                      )}
                      <svg width={pinSize} height={pinSize * 1.35} viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))" }}>
                        <path d="M15 38C15 38 28 22 28 14C28 6.82 22.18 1 15 1C7.82 1 2 6.82 2 14C2 22 15 38 15 38Z" fill={colors.bg} stroke={colors.border} strokeWidth="1.5" />
                        <circle cx="15" cy="14" r="9" fill="white" fillOpacity="0.25" />
                        <text x="15" y="14" textAnchor="middle" dominantBaseline="central" fill="white" fontWeight="700" fontSize={initials.length > 2 ? "8" : "10"} fontFamily="system-ui, -apple-system, sans-serif">
                          {initials}
                        </text>
                      </svg>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Leyenda de estados */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 bg-slate-100 text-slate-700 text-[10px] gap-2 overflow-x-auto border-t border-slate-200">
            <div className="flex items-center gap-3">
              {Object.entries(PIN_COLORS).map(([key, colors]) => {
                const count = pinCounts[key] || 0;
                if (count === 0 && key === "sin_item") return null;
                return (
                  <button key={key} onClick={() => setPinFilter(pinFilter === key ? null : key)} className={`flex items-center gap-1 whitespace-nowrap transition-opacity ${pinFilter && pinFilter !== key ? "opacity-40" : "opacity-100"}`}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.bg }} />
                    <span>{STATUS_LABELS[key]} ({count})</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-slate-500 flex-shrink-0">
              <span>{filteredPines.length} pin{filteredPines.length !== 1 ? "es" : ""}</span>
            </div>
          </div>

          {/* Floating confirm/cancel buttons for temp pin */}
          {tempPin && isPinMode && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200">
              <button
                onClick={cancelTempPin}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-red-50 border-2 border-red-300 text-red-600 rounded-full shadow-lg text-sm font-bold transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                onClick={confirmTempPin}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg text-sm font-bold transition-all active:scale-95"
              >
                <Check className="w-4 h-4" />
                Confirmar
              </button>
            </div>
          )}

          {/* Carousel arrows removed - users swipe left/right natively */}

          {/* Bottom plano grid selector */}
          {planos.length > 1 && (
            <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5 bg-slate-100 overflow-x-auto border-t border-slate-200">
              {planos.map((p: any, i: number) => {
                const pinCount = pinesData?.filter((pin: any) => pin.planoId === p.id).length || 0;
                return (
                  <button key={p.id} onClick={() => { setViewerIndex(i); resetView(); setSelectedPin(null); setTappedPin(null); setShowPinModal(false); setTempPin(null); }} className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 whitespace-nowrap ${i === viewerIndex ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
                    <span className="block font-bold">{p.nombre}</span>
                    {pinCount > 0 && <span className={`block text-[10px] ${i === viewerIndex ? "text-emerald-500" : "text-slate-400"}`}>{pinCount} pin{pinCount !== 1 ? "es" : ""}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODAL: Info completa del pin (click en pin existente)      */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showPinModal && tappedPin && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" onClick={closePinModal}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md mx-auto overflow-hidden animate-in slide-in-from-bottom-4 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIN_COLORS[tappedPin.itemEstado || "sin_item"]?.bg || "#6b7280" }} />
                <span className="text-xs font-semibold uppercase" style={{ color: PIN_COLORS[tappedPin.itemEstado || "sin_item"]?.bg || "#6b7280" }}>
                  {STATUS_LABELS[tappedPin.itemEstado || "sin_item"] || "Sin estado"}
                </span>
                {tappedPin.itemCodigo && <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{tappedPin.itemCodigo}</span>}
              </div>
              <button onClick={closePinModal} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            {(tappedPin.itemFotoAntes || tappedPin.itemFotoDespues) && (
              <div className="flex gap-1 px-4 pt-3">
                {tappedPin.itemFotoAntes && <div className="flex-1"><p className="text-[10px] text-slate-400 mb-1">Antes</p><img src={tappedPin.itemFotoAntes} alt="Antes" className="w-full h-20 rounded-lg object-cover" /></div>}
                {tappedPin.itemFotoDespues && <div className="flex-1"><p className="text-[10px] text-slate-400 mb-1">Después</p><img src={tappedPin.itemFotoDespues} alt="Después" className="w-full h-20 rounded-lg object-cover" /></div>}
              </div>
            )}
            <div className="px-4 py-3 space-y-1.5">
              {tappedPin.itemTitulo && <div className="flex items-start gap-2"><span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Defecto</span><span className="text-xs font-medium text-slate-700">{tappedPin.itemTitulo}</span></div>}
              {tappedPin.itemDescripcion && <div className="flex items-start gap-2"><span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Descripción</span><span className="text-xs text-slate-600 line-clamp-2">{tappedPin.itemDescripcion}</span></div>}
              {tappedPin.residenteNombre && <div className="flex items-start gap-2"><span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Residente</span><span className="text-xs font-medium text-slate-700">{tappedPin.residenteNombre}</span></div>}
              {tappedPin.empresaNombre && <div className="flex items-start gap-2"><span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Empresa</span><span className="text-xs text-slate-600">{tappedPin.empresaNombre}</span></div>}
              {tappedPin.unidadNombre && <div className="flex items-start gap-2"><span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Unidad</span><span className="text-xs text-slate-600">{tappedPin.unidadNombre}</span></div>}
              {tappedPin.especialidadNombre && <div className="flex items-start gap-2"><span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Especialidad</span><span className="text-xs text-slate-600">{tappedPin.especialidadNombre}</span></div>}
              {tappedPin.defectoNombre && <div className="flex items-start gap-2"><span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Tipo defecto</span><span className="text-xs text-slate-600">{tappedPin.defectoNombre}</span></div>}
              {tappedPin.itemConsecutivo && <div className="flex items-start gap-2"><span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Consecutivo</span><span className="text-xs font-mono text-slate-600">#{tappedPin.itemConsecutivo}</span></div>}
              {tappedPin.itemCreatedAt && (() => {
                const fechaAlta = new Date(tappedPin.itemCreatedAt);
                const fechaTerminacion = new Date(fechaAlta.getTime() + diasCorreccion * 24 * 60 * 60 * 1000);
                const hoy = new Date();
                const vencido = hoy > fechaTerminacion;
                return (
                  <>
                    <div className="flex items-start gap-2"><span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Fecha Alta</span><span className="text-xs text-slate-600">{fechaAlta.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span></div>
                    <div className="flex items-start gap-2"><span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Límite ({diasCorreccion}d)</span><span className={`text-xs font-semibold ${vencido ? "text-red-600" : "text-emerald-600"}`}>{fechaTerminacion.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" })}{vencido && " (Vencido)"}</span></div>
                  </>
                );
              })()}
              {tappedPin.nota && !tappedPin.itemId && <div className="flex items-start gap-2"><span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">Nota</span><span className="text-xs text-slate-500 italic">{tappedPin.nota}</span></div>}
            </div>
            <div className="px-4 pb-4 flex gap-2">
              {tappedPin.itemId && (
                <button onClick={() => goToItem(tappedPin.itemId)} className="flex-1 flex items-center justify-center gap-1.5 bg-[#002C63] hover:bg-[#001d42] text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
                  <ExternalLink className="w-4 h-4" /> Ver Ítem Completo
                </button>
              )}
              {isAdmin && (
                <button onClick={() => { if (confirm("¿Eliminar este pin?")) eliminarPin.mutate({ id: tappedPin.id }); }} className="px-3 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 rounded-lg py-2.5 text-sm font-medium transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* DIALOG: Pin colocado - Vincular a ítem existente           */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Dialog open={showItemSelector} onOpenChange={(open) => { if (!open) { setShowItemSelector(false); setPendingPinPos(null); setTempPin(null); } }}>
        <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col p-0 gap-0">
          <div className="px-4 pt-4 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-5 h-5 text-emerald-600" />
              Pin colocado
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">Elige qué hacer con este pin</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-4 pb-3">
              <button onClick={() => { if (!pendingPinPos) return; setCapturaRapidaPinPos(pendingPinPos); setShowItemSelector(false); setShowCapturaRapida(true); }} className="w-full flex items-center gap-4 p-4 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-300 hover:border-emerald-500 rounded-xl transition-all group">
                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"><PlusCircle className="w-6 h-6 text-white" /></div>
                <div className="text-left flex-1"><p className="font-bold text-emerald-800 text-sm">Captura Rápida</p><p className="text-xs text-emerald-600 mt-0.5">Crear ítem aquí mismo sin salir del plano</p></div>
                <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:text-emerald-600 flex-shrink-0" />
              </button>
            </div>
            <div className="flex items-center gap-3 px-4 py-1"><div className="flex-1 border-t border-slate-200" /><span className="text-[10px] text-slate-400 font-medium uppercase">otras opciones</span><div className="flex-1 border-t border-slate-200" /></div>
            <div className="px-4 pt-2 pb-2">
              <button onClick={handleCreateItemFromPin} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                <ExternalLink className="w-5 h-5 text-slate-400" />
                <div className="text-left flex-1"><p className="text-sm font-medium text-slate-700">Formulario completo</p><p className="text-[10px] text-slate-500">Abrir formulario de nuevo ítem con más opciones</p></div>
              </button>
            </div>
            <div className="px-4 pt-1 pb-3 space-y-2">
              <div>
                <label className="text-xs font-medium text-slate-500">Vincular a ítem existente</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Código, título o #consecutivo..." className="pl-8 h-8 text-sm" />
                </div>
              </div>
              {itemSearch.trim() && (
                <div className="border rounded-lg divide-y max-h-[150px] overflow-y-auto">
                  {filteredItems.map((item: any) => {
                    const estado = item.status || "pendiente_foto_despues";
                    const colors = PIN_COLORS[estado] || PIN_COLORS.sin_item;
                    return (
                      <button key={item.id} onClick={() => confirmPin(item.id)} className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex items-center gap-2">
                        {item.fotoAntesUrl && <img src={item.fotoAntesUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                        <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800 truncate">{item.codigo}</p><p className="text-[10px] text-slate-500 truncate">{item.titulo}</p></div>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors.bg + "20", color: colors.bg }}>#{item.numeroInterno}</span>
                      </button>
                    );
                  })}
                  {filteredItems.length === 0 && <div className="text-center py-3 text-xs text-slate-400">No se encontraron ítems</div>}
                </div>
              )}
            </div>
          </div>
          <div className="px-4 py-3 border-t bg-slate-50 flex gap-2">
            <Button variant="outline" onClick={() => { setShowItemSelector(false); setPendingPinPos(null); setTempPin(null); }} className="flex-1">Cancelar</Button>
            <Button onClick={() => confirmPin()} className="flex-1 bg-slate-600 hover:bg-slate-700 text-white">Pin sin ítem</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CAPTURA RÁPIDA INLINE (Pin en Plano + Nuevo Ítem modes)    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showCapturaRapida && currentPlano && (
        <CapturaRapida
          pinPos={capturaRapidaPinPos}
          planoId={currentPlano.id}
          planoNivel={currentPlano.nivel}
          existingItems={allItems}
          onLinkExistingItem={(itemId) => {
            // Vincular item existente al pin
            if (capturaRapidaPinPos && currentPlano) {
              crearPin.mutate({
                planoId: currentPlano.id,
                itemId: itemId,
                posX: capturaRapidaPinPos.x.toFixed(4),
                posY: capturaRapidaPinPos.y.toFixed(4),
              });
            }
            setShowCapturaRapida(false);
            setCapturaRapidaPinPos(null);
            setPendingPinPos(null);
            setTempPin(null);
          }}
          onClose={() => {
            setShowCapturaRapida(false);
            setCapturaRapidaPinPos(null);
            setPendingPinPos(null);
            setTempPin(null);
          }}
          onItemCreated={(item) => {
            setItemsCreadosSesion(prev => [item, ...prev]);
            // Crear el pin vinculado al ítem
            if (capturaRapidaPinPos && currentPlano && item.id) {
              crearPin.mutate({
                planoId: currentPlano.id,
                itemId: item.id,
                posX: capturaRapidaPinPos.x.toFixed(4),
                posY: capturaRapidaPinPos.y.toFixed(4),
              });
            }
            setShowCapturaRapida(false);
            setCapturaRapidaPinPos(null);
            setPendingPinPos(null);
            setTempPin(null);
          }}
          onContinuePin={() => {
            setShowCapturaRapida(false);
            setCapturaRapidaPinPos(null);
            setPendingPinPos(null);
            setTempPin(null);
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODO +NUEVO ÍTEM: Modal sin pin                            */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showNuevoItemModal && (
        <CapturaRapida
          pinPos={null}
          planoId={undefined}
          planoNivel={null}
          headerTitle="+ Nuevo Ítem"
          headerSubtitle="Crear ítem sin ubicación en plano"
          onClose={() => {
            setShowNuevoItemModal(false);
            setCaptureMode("pin");
          }}
          onItemCreated={(item) => {
            setItemsCreadosSesion(prev => [item, ...prev]);
            setShowNuevoItemModal(false);
            setCaptureMode("pin");
            toast.success(`Ítem creado. Puedes asignarle ubicación en el plano después.`);
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODO QR: Scanner Dialog                                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Dialog open={showQrScanner} onOpenChange={(open) => { if (!open) closeQrScanner(); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-blue-600" />
              {qrScannerStatus === "manual" ? "Ingresar Código" : "Escanear Código QR"}
            </DialogTitle>
            <DialogDescription>
              {qrScannerStatus === "manual" ? "Ingresa el código del ítem manualmente" : "Apunta la cámara al código QR del ítem"}
            </DialogDescription>
          </DialogHeader>

          {qrScannerStatus === "manual" ? (
            <div className="p-4 pt-0 space-y-4">
              <p className="text-sm text-muted-foreground">Ingresa el código del ítem (ej: OQC-00001)</p>
              <div className="flex gap-2">
                <Input placeholder="OQC-00001" value={qrManualInput} onChange={(e) => setQrManualInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && handleQrManualSubmit()} className="flex-1" autoFocus />
                <Button onClick={handleQrManualSubmit} className="bg-blue-600 hover:bg-blue-700"><Search className="h-4 w-4 mr-2" />Buscar</Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setQrScannerStatus("idle"); startQrScanner(); }}>
                <Camera className="h-4 w-4 mr-2" />Volver a cámara
              </Button>
            </div>
          ) : qrScannerStatus === "error" ? (
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <Camera className="h-8 w-8 text-red-500" />
              </div>
              <div><p className="font-medium text-lg">Cámara no disponible</p><p className="text-sm text-muted-foreground mt-1">{qrErrorMessage}</p></div>
              <div className="space-y-2">
                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setQrScannerStatus("manual")}>
                  <Keyboard className="h-4 w-4 mr-2" />Ingresar código manual
                </Button>
                <Button variant="outline" className="w-full" onClick={() => { stopQrScanner(); setQrScannerStatus("idle"); startQrScanner(); }}>
                  <RefreshCw className="h-4 w-4 mr-2" />Reintentar cámara
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              <div className="relative bg-black" style={{ minHeight: "320px" }}>
                {(qrScannerStatus === "idle") && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium">Iniciando cámara...</p>
                    <p className="text-xs text-gray-400 mt-2">Permite el acceso cuando aparezca el mensaje</p>
                  </div>
                )}
                <video ref={qrVideoRef} className="w-full h-full object-cover" style={{ minHeight: "320px" }} muted playsInline autoPlay />
                {qrScannerStatus === "scanning" && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-56 h-56 border-2 border-blue-500 rounded-lg relative">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
                        <div className="absolute left-1 right-1 h-0.5 bg-blue-500 animate-pulse" style={{ top: "50%" }} />
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                      <div className="bg-black/80 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />Buscando código QR...
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 space-y-3 bg-white">
                <p className="text-sm text-muted-foreground text-center">Centra el código QR dentro del recuadro</p>
                <Button variant="outline" className="w-full" onClick={() => { stopQrScanner(); setQrScannerStatus("manual"); }}>
                  <Keyboard className="h-4 w-4 mr-2" />Ingresar código manualmente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PANEL DE SEGUIMIENTO: Ítems creados en la sesión           */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showViewer && itemsCreadosSesion.length > 0 && (
        <div className="fixed bottom-16 right-3 z-[150]">
          <button onClick={() => setShowSeguimiento(s => !s)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg text-xs font-bold transition-all">
            <ListChecks className="w-4 h-4" />
            {itemsCreadosSesion.length} creado{itemsCreadosSesion.length !== 1 ? "s" : ""}
          </button>
          {showSeguimiento && (
            <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-xl shadow-2xl border overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
              <div className="px-3 py-2 bg-emerald-50 border-b flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">Ítems creados esta sesión</span>
                <button onClick={() => setShowSeguimiento(false)} className="p-0.5 hover:bg-emerald-100 rounded"><X className="w-3.5 h-3.5 text-emerald-600" /></button>
              </div>
              <div className="max-h-[200px] overflow-y-auto divide-y">
                {itemsCreadosSesion.map((item, i) => (
                  <button key={i} onClick={() => { if (item.id) { setShowViewer(false); navigate(`/item/${item.id}`); } }} className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><MapPin className="w-3 h-3 text-emerald-600" /></div>
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800 truncate">{item.codigo || "OFFLINE"}</p><p className="text-[10px] text-slate-500 truncate">{item.titulo}</p></div>
                    <Eye className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog: Agregar plano */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[95vh] flex flex-col p-0 gap-0">
          <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2"><Upload className="w-5 h-5 text-emerald-600" /><span className="font-semibold text-sm sm:text-base">Subir Plano</span></div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSubmit} disabled={crearPlano.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">{crearPlano.isPending ? "Subiendo..." : "Subir Plano"}</Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-slate-600">Nombre del plano *</label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Planta Baja, Nivel 1, Azotea" /></div>
              <div><label className="text-xs font-medium text-slate-600">Número de nivel</label><Input type="number" value={nivel} onChange={e => setNivel(e.target.value)} placeholder="0" /></div>
            </div>
            <div><label className="text-xs font-medium text-slate-600">Descripción (opcional)</label><Input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción del plano" /></div>
            <div>
              <label className="text-xs font-medium text-slate-600">Imagen del plano *</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              {previewUrl ? (
                <div className="relative mt-1">
                  <div className="w-full bg-slate-50 rounded-lg border overflow-auto" style={{ maxHeight: "50vh" }}><img src={previewUrl} alt="Preview" className="max-w-none" style={{ minWidth: "100%" }} /></div>
                  <button onClick={() => { setPreviewUrl(""); setImagenBase64(""); setImagenNombre(""); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 z-10"><X className="w-3 h-3" /></button>
                  <p className="text-xs text-slate-400 mt-1 text-center">Pellizca o usa scroll para hacer zoom en el plano</p>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} className="mt-1 w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors">
                  <ImageIcon className="w-8 h-8 text-slate-400" /><span className="text-sm text-slate-500">Toca para seleccionar imagen</span><span className="text-xs text-slate-400">JPG, PNG, WebP — máx 15MB</span>
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar plano */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg max-h-[95vh] flex flex-col p-0 gap-0">
          <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2"><Edit2 className="w-5 h-5 text-blue-600" /><span className="font-semibold text-sm sm:text-base">Editar Plano</span></div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleEdit} disabled={actualizarPlano.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">{actualizarPlano.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div><label className="text-xs font-medium text-slate-600">Nombre del plano *</label><Input value={editNombre} onChange={e => setEditNombre(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-slate-600">Número de nivel</label><Input type="number" value={editNivel} onChange={e => setEditNivel(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-slate-600">Descripción</label><Input value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)} /></div>
          </div>
        </DialogContent>
      </Dialog>
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PDF FILTER DIALOG                                           */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Dialog open={showPdfFilterDialog} onOpenChange={setShowPdfFilterDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Generar Reporte PDF
            </DialogTitle>
            <DialogDescription>
              Selecciona el alcance del reporte
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Filter type selector */}
            <div className="grid grid-cols-3 gap-2">
              {(["total", "nivel", "especialidad"] as const).map(ft => (
                <button
                  key={ft}
                  onClick={() => { setPdfFilterType(ft); setPdfFilterNivel(null); setPdfFilterEspecialidad(null); }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                    pdfFilterType === ft
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {ft === "total" ? "Todos" : ft === "nivel" ? "Por Piso" : "Especialidad"}
                </button>
              ))}
            </div>

            {/* Nivel selector */}
            {pdfFilterType === "nivel" && planosDataCache && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-xs text-slate-500 font-medium">Selecciona un piso:</p>
                {Array.from(new Set(planosDataCache.map(p => p.nivel))).sort((a, b) => (a ?? 0) - (b ?? 0)).map(niv => {
                  const p = planosDataCache.find(pl => pl.nivel === niv);
                  const pinCount = p?.pines?.length || 0;
                  return (
                    <button
                      key={niv}
                      onClick={() => setPdfFilterNivel(niv)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-all ${
                        pdfFilterNivel === niv
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span>N{niv} - {p?.nombre || ""}</span>
                      <span className="text-xs text-slate-400">{pinCount} pines</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Especialidad selector */}
            {pdfFilterType === "especialidad" && planosDataCache && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-xs text-slate-500 font-medium">Selecciona una especialidad:</p>
                {(() => {
                  const espMap = new Map<string, number>();
                  for (const p of planosDataCache) {
                    for (const pin of p.pines) {
                      if (pin.especialidadNombre) {
                        espMap.set(pin.especialidadNombre, (espMap.get(pin.especialidadNombre) || 0) + 1);
                      }
                    }
                  }
                  return Array.from(espMap.entries()).sort((a, b) => b[1] - a[1]).map(([esp, count]) => (
                    <button
                      key={esp}
                      onClick={() => setPdfFilterEspecialidad(esp)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-all ${
                        pdfFilterEspecialidad === esp
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span>{esp}</span>
                      <span className="text-xs text-slate-400">{count} pines</span>
                    </button>
                  ));
                })()}
              </div>
            )}

            {/* Summary */}
            {planosDataCache && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                {pdfFilterType === "total" && (
                  <span>Se generará el reporte completo: {planosDataCache.length} planos, {planosDataCache.reduce((s, p) => s + p.pines.length, 0)} pines</span>
                )}
                {pdfFilterType === "nivel" && pdfFilterNivel !== null && (
                  <span>Reporte del piso N{pdfFilterNivel}: {planosDataCache.find(p => p.nivel === pdfFilterNivel)?.pines?.length || 0} pines</span>
                )}
                {pdfFilterType === "especialidad" && pdfFilterEspecialidad && (
                  <span>Reporte de {pdfFilterEspecialidad}: {planosDataCache.reduce((s, p) => s + p.pines.filter(pin => pin.especialidadNombre === pdfFilterEspecialidad).length, 0)} pines</span>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPdfFilterDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleGenerarReportePDF}
              disabled={
                (pdfFilterType === "nivel" && pdfFilterNivel === null) ||
                (pdfFilterType === "especialidad" && !pdfFilterEspecialidad)
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <FileText className="w-4 h-4" />
              Generar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
