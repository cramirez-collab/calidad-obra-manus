import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { useProject } from "@/contexts/ProjectContext";
import { 
  History, 
  User, 
  Calendar,
  FileText,
  Camera,
  CheckCircle2,
  XCircle,
  LogIn,
  LogOut,
  Edit,
  Plus,
  Trash2,
  Download,
  FileSpreadsheet,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Shield,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MapPin,
  Layers,
  AlertTriangle,
  Clock,
  Users,
  Activity,
  BarChart3,
  TrendingUp
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { 
  crearPDFUnificado, 
  agregarSeccion, 
  agregarTablaUnificada, 
  descargarPDFUnificado,
  COLORES 
} from "@/lib/pdfUnificado";

const ITEMS_PER_PAGE = 50;

// Tipos de ordenamiento
type SortField = 'fecha' | 'usuario' | 'rol' | 'accion' | 'categoria' | 'entidad' | 'detalles';
type SortDirection = 'asc' | 'desc';

export default function Bitacora() {
  const { selectedProjectId } = useProject();
  const { user } = useAuth();
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  
  // Filtros
  const [filtroUsuario, setFiltroUsuario] = useState<string>("all");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("all");
  const [filtroAccion, setFiltroAccion] = useState<string>("all");
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");
  const [busqueda, setBusqueda] = useState<string>("");
  const [pagina, setPagina] = useState(1);
  
  // Estado de ordenamiento
  const [sortField, setSortField] = useState<SortField>('fecha');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Estado para selección múltiple (solo superadmin)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const isSuperadmin = user?.role === 'superadmin';

  // Estado de tabs
  const [activeTab, setActiveTab] = useState<string>("bitacora");
  
  // Queries
  const { data: usuarios } = trpc.users.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined
  );
  const { data: proyectos } = trpc.proyectos.list.useQuery(undefined, { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 });
  // Bitacora es global, no tiene proyecto específico, pero mostramos el contexto
  const proyectoNombre = 'Sistema OQC';
  
  // Queries para sección Tiempos
  const { data: estadisticasTiempos, isLoading: loadingTiempos } = trpc.bitacora.estadisticasTiempos.useQuery(
    undefined,
    { enabled: activeTab === "tiempos" }
  );
  const { data: resumenSemanal, isLoading: loadingResumen } = trpc.bitacora.resumenSemanal.useQuery(
    undefined,
    { enabled: activeTab === "tiempos" }
  );
  
  const filtros = useMemo(() => ({
    usuarioId: filtroUsuario && filtroUsuario !== 'all' ? parseInt(filtroUsuario) : undefined,
    categoria: filtroCategoria && filtroCategoria !== 'all' ? filtroCategoria : undefined,
    fechaDesde: fechaDesde ? new Date(fechaDesde) : undefined,
    fechaHasta: fechaHasta ? new Date(fechaHasta + "T23:59:59") : undefined,
    limit: ITEMS_PER_PAGE,
    offset: (pagina - 1) * ITEMS_PER_PAGE,
  }), [filtroUsuario, filtroCategoria, fechaDesde, fechaHasta, pagina]);

  const { data: auditoria, isLoading, refetch } = isAdmin 
    ? trpc.bitacora.list.useQuery({
        usuarioId: filtros.usuarioId,
        accion: filtros.categoria,
        fechaDesde: filtros.fechaDesde,
        fechaHasta: filtros.fechaHasta,
        proyectoId: selectedProjectId || undefined,
        limit: 500,
      })
    : trpc.bitacora.miActividad.useQuery({ proyectoId: selectedProjectId || undefined });
  
  // Mutación para eliminar entradas (solo superadmin)
  const deleteMutation = trpc.bitacora.delete.useMutation({
    onSuccess: () => {
      toast.success('Entrada eliminada correctamente');
      refetch();
    },
    onError: (error) => {
      toast.error('Error al eliminar: ' + error.message);
    },
  });
  
  const deleteManyMutation = trpc.bitacora.deleteMany.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} entradas eliminadas correctamente`);
      setSelectedIds([]);
      refetch();
    },
    onError: (error) => {
      toast.error('Error al eliminar: ' + error.message);
    },
  });
  
  // Función para eliminar una entrada
  const handleDelete = (id: number) => {
    if (confirm('¿Estás seguro de eliminar esta entrada de bitácora?')) {
      deleteMutation.mutate({ id });
    }
  };
  
  // Función para eliminar múltiples entradas
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`¿Estás seguro de eliminar ${selectedIds.length} entradas de bitácora?`)) {
      deleteManyMutation.mutate({ ids: selectedIds });
    }
  };
  
  // Función para seleccionar/deseleccionar una entrada
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };
  
  // Función para seleccionar/deseleccionar todas las entradas visibles
  const toggleSelectAll = () => {
    if (selectedIds.length === actividadesFiltradas.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(actividadesFiltradas.map((a: any) => a.id));
    }
  };

  // Contar total para paginación (aproximado basado en datos cargados)
  const totalCount = auditoria?.length || 0;

  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  // Función para manejar el ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Si ya está ordenado por este campo, cambiar dirección
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Si es un nuevo campo, ordenar descendente por defecto
      setSortField(field);
      setSortDirection('desc');
    }
    setPagina(1); // Resetear a primera página al cambiar orden
  };

  // Icono de ordenamiento para cada columna
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 text-[#02B381]" />
      : <ArrowDown className="h-3 w-3 text-[#02B381]" />;
  };

  // Filtrar y ordenar actividades
  const actividadesFiltradas = useMemo(() => {
    if (!auditoria) return [];
    
    // Primero filtrar
    let filtered = auditoria;
    if (busqueda || filtroAccion) {
      filtered = auditoria.filter((a: any) => {
        const matchBusqueda = !busqueda || 
          a.detalles?.toLowerCase().includes(busqueda.toLowerCase()) ||
          a.usuario?.name?.toLowerCase().includes(busqueda.toLowerCase()) ||
          a.accion?.toLowerCase().includes(busqueda.toLowerCase());
        
        const matchAccion = !filtroAccion || filtroAccion === 'all' || a.accion === filtroAccion;
        
        return matchBusqueda && matchAccion;
      });
    }
    
    // Luego ordenar
    const sorted = [...filtered].sort((a: any, b: any) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'fecha':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'usuario':
          comparison = (a.usuario?.name || '').localeCompare(b.usuario?.name || '');
          break;
        case 'rol':
          comparison = (a.usuario?.role || '').localeCompare(b.usuario?.role || '');
          break;
        case 'accion':
          comparison = (a.accion || '').localeCompare(b.accion || '');
          break;
        case 'categoria':
          comparison = (a.entidad || '').localeCompare(b.entidad || '');
          break;
        case 'entidad':
          comparison = (a.entidadId || 0) - (b.entidadId || 0);
          break;
        case 'detalles':
          comparison = (a.detalles || '').localeCompare(b.detalles || '');
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Paginar
    const start = (pagina - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return sorted.slice(start, end);
  }, [auditoria, busqueda, filtroAccion, sortField, sortDirection, pagina]);

  const getAccionIcon = (accion: string) => {
    switch (accion) {
      case 'login':
        return <LogIn className="h-4 w-4 text-green-500" />;
      case 'logout':
        return <LogOut className="h-4 w-4 text-gray-500" />;
      case 'crear_item':
        return <Plus className="h-4 w-4 text-blue-500" />;
      case 'aprobar_item':
        return <CheckCircle2 className="h-4 w-4 text-[#02B381]" />;
      case 'rechazar_item':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'subir_foto':
        return <Camera className="h-4 w-4 text-purple-500" />;
      case 'editar':
      case 'actualizar':
        return <Edit className="h-4 w-4 text-amber-500" />;
      case 'eliminar':
      case 'eliminar_mensaje':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'crear_mensaje':
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'aprobar_supervisor':
        return <Shield className="h-4 w-4 text-blue-600" />;
      case 'crear_empresa':
        return <Building2 className="h-4 w-4 text-indigo-500" />;
      case 'crear_unidad':
        return <MapPin className="h-4 w-4 text-teal-500" />;
      case 'crear_nivel':
        return <Layers className="h-4 w-4 text-orange-500" />;
      case 'crear_defecto':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAccionLabel = (accion: string) => {
    const labels: Record<string, string> = {
      login: 'Inicio de sesión',
      logout: 'Cierre de sesión',
      crear_item: 'Creó ítem',
      aprobar_item: 'Aprobó ítem',
      rechazar_item: 'Rechazó ítem',
      subir_foto: 'Subió foto',
      editar: 'Editó registro',
      actualizar: 'Actualizó registro',
      eliminar: 'Eliminó registro',
      crear_empresa: 'Creó empresa',
      editar_empresa: 'Editó empresa',
      eliminar_empresa: 'Eliminó empresa',
      crear_unidad: 'Creó unidad',
      editar_unidad: 'Editó unidad',
      eliminar_unidad: 'Eliminó unidad',
      crear_nivel: 'Creó nivel',
      editar_nivel: 'Editó nivel',
      eliminar_nivel: 'Eliminó nivel',
      crear_espacio: 'Creó espacio',
      editar_espacio: 'Editó espacio',
      eliminar_espacio: 'Eliminó espacio',
      crear_defecto: 'Creó defecto',
      editar_defecto: 'Editó defecto',
      eliminar_defecto: 'Eliminó defecto',
      crear_especialidad: 'Creó especialidad',
      editar_especialidad: 'Editó especialidad',
      eliminar_especialidad: 'Eliminó especialidad',
      crear_atributo: 'Creó atributo',
      cambiar_rol: 'Cambió rol de usuario',
      crear_mensaje: 'Envió mensaje',
      eliminar_mensaje: 'Eliminó mensaje',
      aprobar_supervisor: 'Aprobación de supervisor',
      revocar_aprobacion: 'Revocó aprobación',
      crear_usuario: 'Creó usuario',
      editar_usuario: 'Editó usuario',
      desactivar_usuario: 'Desactivó usuario',
      activar_usuario: 'Activó usuario',
      ordenar_unidades: 'Reordenó unidades',
      importar_excel: 'Importó desde Excel',
      exportar_pdf: 'Exportó a PDF',
    };
    return labels[accion] || accion;
  };

  const getCategoriaLabel = (categoria: string | null) => {
    if (!categoria) return '';
    const labels: Record<string, string> = {
      item: 'Ítem',
      empresa: 'Empresa',
      unidad: 'Unidad',
      nivel: 'Nivel',
      espacio: 'Espacio',
      defecto: 'Defecto',
      especialidad: 'Especialidad',
      atributo: 'Atributo',
      usuario: 'Usuario',
      mensaje: 'Mensaje',
      proyecto: 'Proyecto',
      auth: 'Autenticación',
      stacking: 'Stacking',
      reporte: 'Reporte',
    };
    return labels[categoria] || categoria;
  };

  const getRolColor = (rol: string) => {
    switch (rol) {
      case 'superadmin': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'supervisor': return 'bg-emerald-100 text-emerald-800';
      case 'jefe_residente': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Exportar a CSV
  const exportarCSV = () => {
    if (!auditoria || auditoria.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = ["Fecha", "Hora", "Usuario", "Rol", "Acción", "Categoría", "Entidad ID", "Detalles"];
    const rows = auditoria.map((a: any) => [
      format(new Date(a.createdAt), "dd/MM/yyyy"),
      format(new Date(a.createdAt), "HH:mm:ss"),
      a.usuario?.name || "-",
      a.usuario?.role || "-",
      getAccionLabel(a.accion),
      getCategoriaLabel(a.entidad),
      a.entidadId || "-",
      a.detalles || "-",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bitacora_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success("Archivo CSV exportado correctamente");
  };

  // Exportar a PDF
  const exportarPDF = () => {
    if (!auditoria || auditoria.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const doc = crearPDFUnificado({
      titulo: 'Bitacora de Auditoria',
      proyectoNombre,
      orientation: 'landscape'
    });
    
    let yPos = 35;
    doc.setFontSize(9);
    doc.setTextColor(...COLORES.GRIS);
    doc.text(`Total de registros: ${auditoria.length}`, 15, yPos);
    yPos += 8;

    const tableData = auditoria.map((a: any) => [
      format(new Date(a.createdAt), "dd/MM/yyyy HH:mm"),
      a.usuario?.name || "-",
      a.usuario?.role || "-",
      getAccionLabel(a.accion),
      getCategoriaLabel(a.entidad),
      a.detalles?.substring(0, 50) || "-",
    ]);

    agregarTablaUnificada(doc, ["Fecha/Hora", "Usuario", "Rol", "Accion", "Categoria", "Detalles"], tableData, yPos, {
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 35 },
        5: { cellWidth: 'auto' },
      }
    });

    descargarPDFUnificado(doc, 'bitacora', proyectoNombre);
    toast.success("PDF descargado - abrelo con Acrobat Reader");
  };

  // Exportar Tiempos a PDF
  const exportarTiemposPDF = () => {
    if (!estadisticasTiempos || estadisticasTiempos.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const doc = crearPDFUnificado({
      titulo: 'Tiempos y Actividad',
      proyectoNombre,
      orientation: 'landscape'
    });
    
    let yPos = 35;
    
    // Resumen semanal
    if (resumenSemanal?.resumen) {
      yPos = agregarSeccion(doc, 'Resumen Semanal', yPos);
      doc.setFontSize(9);
      doc.setTextColor(...COLORES.GRIS);
      const resumen = resumenSemanal.resumen;
      doc.text(`Acciones: ${resumen.totalAcciones || 0} | Items: ${resumen.itemsCreados || 0} | Mensajes: ${resumen.mensajesEnviados || 0} | Usuarios Activos: ${resumen.usuariosActivos || 0}`, 15, yPos);
      yPos += 10;
    }

    const tableData = estadisticasTiempos.map((est: any) => [
      est.usuarioNombre || "-",
      est.usuarioRol || "-",
      est.totalCapturas?.toString() || "0",
      est.totalMensajesEnviados?.toString() || "0",
      est.totalAcciones?.toString() || "0",
      `${est.capturasSemana || 0}/${est.lecturasSemana || 0}`,
      est.fechaRegistro ? format(new Date(est.fechaRegistro), "dd/MM/yy") : "-",
      est.ultimaActividad ? format(new Date(est.ultimaActividad), "dd/MM/yy HH:mm") : "-",
      est.haCapturado ? "Si" : "No",
    ]);

    agregarTablaUnificada(doc, ["Usuario", "Rol", "Capturas", "Mensajes", "Acciones", "Semana", "Registro", "Ultima Act.", "Capturo"], tableData, yPos, {
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 24 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 28 },
        6: { cellWidth: 24 },
        7: { cellWidth: 34 },
        8: { cellWidth: 16 },
      }
    });

    descargarPDFUnificado(doc, 'tiempos_actividad', proyectoNombre);
    toast.success("PDF descargado - abrelo con Acrobat Reader");
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltroUsuario("all");
    setFiltroCategoria("all");
    setFiltroAccion("all");
    setFechaDesde("");
    setFechaHasta("");
    setBusqueda("");
    setPagina(1);
    setSortField('fecha');
    setSortDirection('desc');
  };

  // Acciones únicas para el filtro
  const accionesUnicas = useMemo(() => {
    if (!auditoria) return [];
    const acciones = new Set(auditoria.map((a: any) => a.accion));
    return Array.from(acciones).sort();
  }, [auditoria]);

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Shield className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acceso Restringido</h2>
          <p className="text-muted-foreground text-center max-w-md">
            La bitácora de auditoría solo está disponible para Administradores y Superadministradores.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#002C63]/10">
              <History className="h-6 w-6 text-[#002C63]" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#002C63]">
                Bitácora de Auditoría
              </h1>
              <p className="text-sm text-muted-foreground">
                Registro completo de todas las acciones del sistema
              </p>
            </div>
          </div>
          
          {/* Tabs de navegación */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-2 md:w-auto">
              <TabsTrigger value="bitacora" className="gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Bitácora</span>
              </TabsTrigger>
              <TabsTrigger value="tiempos" className="gap-2">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Tiempos</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* Botones de exportación y eliminación */}
          <div className="flex gap-2">
            {isSuperadmin && selectedIds.length > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDeleteSelected}
                disabled={deleteManyMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar ({selectedIds.length})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Exportar</span> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportarPDF}>
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Exportar</span> PDF
            </Button>
          </div>
        </div>

        {/* Tab: Bitácora */}
        {activeTab === "bitacora" && (
        <>
        {/* Filtros - Diseño compacto y ordenado */}
        <Card className="border-[#002C63]/10">
          <CardContent className="pt-4 pb-3">
            {/* Fila 1: Búsqueda y botón limpiar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar en bitácora..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-9 h-10 bg-slate-50 border-slate-200"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={limpiarFiltros} 
                className="h-10 px-4 text-muted-foreground hover:text-foreground"
              >
                <Filter className="h-4 w-4 mr-2" />
                Limpiar filtros
              </Button>
            </div>
            
            {/* Fila 2: Filtros en grid compacto */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {/* Usuario */}
              <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
                <SelectTrigger className="h-9 text-xs bg-white">
                  <User className="h-3 w-3 mr-1.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {usuarios?.map((u: any) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Categoría */}
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="h-9 text-xs bg-white">
                  <Layers className="h-3 w-3 mr-1.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  <SelectItem value="item">Ítems</SelectItem>
                  <SelectItem value="empresa">Empresas</SelectItem>
                  <SelectItem value="unidad">Unidades</SelectItem>
                  <SelectItem value="nivel">Niveles</SelectItem>
                  <SelectItem value="espacio">Espacios</SelectItem>
                  <SelectItem value="defecto">Defectos</SelectItem>
                  <SelectItem value="especialidad">Especialidades</SelectItem>
                  <SelectItem value="usuario">Usuarios</SelectItem>
                  <SelectItem value="mensaje">Mensajes</SelectItem>
                  <SelectItem value="proyecto">Proyectos</SelectItem>
                  <SelectItem value="auth">Autenticación</SelectItem>
                  <SelectItem value="stacking">Stacking</SelectItem>
                  <SelectItem value="reporte">Reportes</SelectItem>
                </SelectContent>
              </Select>

              {/* Acción */}
              <Select value={filtroAccion} onValueChange={setFiltroAccion}>
                <SelectTrigger className="h-9 text-xs bg-white">
                  <Activity className="h-3 w-3 mr-1.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  {accionesUnicas.map((accion: string) => (
                    <SelectItem key={accion} value={accion}>
                      {getAccionLabel(accion)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Fecha desde */}
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="h-9 pl-8 text-xs bg-white"
                  title="Desde"
                />
              </div>

              {/* Fecha hasta */}
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="h-9 pl-8 text-xs bg-white"
                  title="Hasta"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-3">
            <div className="text-xl sm:text-2xl font-bold text-[#002C63]">{totalCount || 0}</div>
            <div className="text-xs text-muted-foreground">Total registros</div>
          </Card>
          <Card className="p-3">
            <div className="text-xl sm:text-2xl font-bold text-emerald-600">
              {auditoria?.filter((a: any) => a.accion === 'aprobar_item').length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Aprobaciones</div>
          </Card>
          <Card className="p-3">
            <div className="text-xl sm:text-2xl font-bold text-red-600">
              {auditoria?.filter((a: any) => a.accion === 'rechazar_item').length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Rechazos</div>
          </Card>
          <Card className="p-3">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">
              {auditoria?.filter((a: any) => a.accion?.startsWith('crear_')).length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Creaciones</div>
          </Card>
          <Card className="p-3">
            <div className="text-xl sm:text-2xl font-bold text-amber-600">
              {auditoria?.filter((a: any) => a.accion?.startsWith('editar_') || a.accion === 'actualizar').length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Ediciones</div>
          </Card>
        </div>

        {/* Lista de actividades */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base">
                Registros de Auditoría
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Mostrando {actividadesFiltradas?.length || 0} de {totalCount || 0}
                </span>
                <Badge variant="outline" className="text-xs">
                  Ordenado por: {sortField === 'fecha' ? 'Fecha' : sortField === 'usuario' ? 'Usuario' : sortField === 'rol' ? 'Rol' : sortField === 'accion' ? 'Acción' : sortField === 'categoria' ? 'Categoría' : sortField === 'entidad' ? 'Entidad' : 'Detalles'}
                  {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#02B381]" />
              </div>
            ) : actividadesFiltradas && actividadesFiltradas.length > 0 ? (
              <>
                {/* Vista de tabla en desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {isSuperadmin && (
                          <th className="p-2 w-10">
                            <input
                              type="checkbox"
                              checked={selectedIds.length === actividadesFiltradas.length && actividadesFiltradas.length > 0}
                              onChange={toggleSelectAll}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </th>
                        )}
                        <th 
                          className="text-left p-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => handleSort('fecha')}
                        >
                          <div className="flex items-center gap-1">
                            Fecha/Hora
                            {getSortIcon('fecha')}
                          </div>
                        </th>
                        <th 
                          className="text-left p-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => handleSort('usuario')}
                        >
                          <div className="flex items-center gap-1">
                            Usuario
                            {getSortIcon('usuario')}
                          </div>
                        </th>
                        <th 
                          className="text-left p-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => handleSort('rol')}
                        >
                          <div className="flex items-center gap-1">
                            Rol
                            {getSortIcon('rol')}
                          </div>
                        </th>
                        <th 
                          className="text-left p-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => handleSort('accion')}
                        >
                          <div className="flex items-center gap-1">
                            Acción
                            {getSortIcon('accion')}
                          </div>
                        </th>
                        <th 
                          className="text-left p-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => handleSort('categoria')}
                        >
                          <div className="flex items-center gap-1">
                            Categoría
                            {getSortIcon('categoria')}
                          </div>
                        </th>
                        <th 
                          className="text-left p-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => handleSort('detalles')}
                        >
                          <div className="flex items-center gap-1">
                            Detalles
                            {getSortIcon('detalles')}
                          </div>
                        </th>
                        {isSuperadmin && (
                          <th className="text-left p-2 font-medium">IP</th>
                        )}
                        {isSuperadmin && (
                          <th className="p-2 w-16 text-center font-medium">Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {actividadesFiltradas.map((actividad: any) => (
                        <tr key={actividad.id} className={`border-b hover:bg-muted/30 ${selectedIds.includes(actividad.id) ? 'bg-primary/5' : ''}`}>
                          {isSuperadmin && (
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(actividad.id)}
                                onChange={() => toggleSelect(actividad.id)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </td>
                          )}
                          <td className="p-2 whitespace-nowrap">
                            <div className="flex items-center gap-1 text-xs">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(actividad.createdAt), "dd/MM/yy HH:mm")}
                            </div>
                          </td>
<td className="p-2">
                                            <UserAvatar 
                                              name={actividad.usuario?.name} 
                                              fotoUrl={actividad.usuario?.fotoUrl}
                                              fotoBase64={(actividad.usuario as any)?.fotoBase64}
                                              size="sm"
                                              showName={true}
                                              nameClassName="truncate max-w-[120px]"
                                            />
                                          </td>
                          <td className="p-2">
                            <Badge className={`text-xs ${getRolColor(actividad.usuario?.role)}`}>
                              {actividad.usuario?.role || "-"}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {getAccionIcon(actividad.accion)}
                              <span>{getAccionLabel(actividad.accion)}</span>
                            </div>
                          </td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-xs">
                              {getCategoriaLabel(actividad.entidad)}
                              {actividad.entidadId && ` #${actividad.entidadId}`}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <div className="max-w-[250px]">
                              <span className="text-muted-foreground truncate block" title={actividad.detalles || ""}>
                                {actividad.detalles || "-"}
                              </span>
                              {/* Mostrar trazabilidad si es acción de ítem */}
                              {actividad.entidad === 'item' && actividad.detalles && (
                                <div className="text-xs text-slate-500 mt-1">
                                  {actividad.accion === 'crear_item' && (
                                    <span className="text-blue-600">✍️ Creado por: {actividad.usuario?.name?.split(' ')[0]}</span>
                                  )}
                                  {actividad.accion === 'aprobar_item' && (
                                    <span className="text-green-600">✓ Aprobado por: {actividad.usuario?.name?.split(' ')[0]}</span>
                                  )}
                                  {actividad.accion === 'rechazar_item' && (
                                    <span className="text-red-600">✗ Rechazado por: {actividad.usuario?.name?.split(' ')[0]}</span>
                                  )}
                                  {actividad.accion === 'subir_foto' && (
                                    <span className="text-purple-600">📷 Foto por: {actividad.usuario?.name?.split(' ')[0]}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          {isSuperadmin && (
                            <td className="p-2">
                              <span className="text-xs text-muted-foreground font-mono">
                                {actividad.ip || "-"}
                              </span>
                            </td>
                          )}
                          {isSuperadmin && (
                            <td className="p-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(actividad.id)}
                                disabled={deleteMutation.isPending}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vista de cards en móvil */}
                <div className="md:hidden space-y-2">
                  {actividadesFiltradas.map((actividad: any) => (
                    <div 
                      key={actividad.id}
                      className="p-3 border rounded-lg hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <UserAvatar 
                            name={actividad.usuario?.name} 
                            fotoUrl={actividad.usuario?.fotoUrl}
                            fotoBase64={(actividad.usuario as any)?.fotoBase64}
                            size="md"
                            showName={false}
                          />
                          <div>
                            <p className="font-medium text-sm">
                              {getAccionLabel(actividad.accion)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {actividad.usuario?.name || "-"}
                            </p>
                          </div>
                        </div>
                        <Badge className={`text-xs ${getRolColor(actividad.usuario?.role)}`}>
                          {actividad.usuario?.role}
                        </Badge>
                      </div>
                      {actividad.detalles && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {actividad.detalles}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <Badge variant="outline" className="text-xs">
                          {getCategoriaLabel(actividad.entidad)}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(actividad.createdAt), "dd/MM/yy HH:mm")}
                          </span>
                          {isSuperadmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(actividad.id)}
                              disabled={deleteMutation.isPending}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Página {pagina} de {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPagina(p => Math.max(1, p - 1))}
                        disabled={pagina === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPagina(p => Math.min(totalPages, p + 1))}
                        disabled={pagina === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No hay registros que coincidan con los filtros</p>
              </div>
            )}
          </CardContent>
        </Card>
        </>
        )}
        
        {/* Tab: Tiempos */}
        {activeTab === "tiempos" && (
          <div className="space-y-4">
            {/* Botón de exportar PDF */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={exportarTiemposPDF} disabled={loadingTiempos || !estadisticasTiempos}>
                <Download className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
            </div>
            {/* Resumen Semanal */}
            {loadingResumen ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : resumenSemanal && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Resumen Semanal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xl sm:text-2xl font-bold text-primary">{resumenSemanal.resumen?.totalAcciones || 0}</p>
                      <p className="text-xs text-muted-foreground">Acciones Totales</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xl sm:text-2xl font-bold text-emerald-600">{resumenSemanal.resumen?.itemsCreados || 0}</p>
                      <p className="text-xs text-muted-foreground">Ítems Creados</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xl sm:text-2xl font-bold text-blue-600">{resumenSemanal.resumen?.mensajesEnviados || 0}</p>
                      <p className="text-xs text-muted-foreground">Mensajes</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xl sm:text-2xl font-bold text-amber-600">{resumenSemanal.resumen?.usuariosActivos || 0}</p>
                      <p className="text-xs text-muted-foreground">Usuarios Activos</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xl sm:text-2xl font-bold text-green-600">{resumenSemanal.resumen?.usuariosQueCapturaron || 0}</p>
                      <p className="text-xs text-muted-foreground">Capturaron</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xl sm:text-2xl font-bold text-purple-600">{resumenSemanal.resumen?.usuariosQueEnviaronMensajes || 0}</p>
                      <p className="text-xs text-muted-foreground">Enviaron Mensajes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabla de Actividad por Usuario */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Actividad por Usuario
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTiempos ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : estadisticasTiempos && estadisticasTiempos.length > 0 ? (
                  <>
                    {/* Vista desktop */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-2 font-medium">Usuario</th>
                            <th className="text-center p-2 font-medium">Capturas</th>
                            <th className="text-center p-2 font-medium">Mensajes</th>
                            <th className="text-center p-2 font-medium">Acciones</th>
                            <th className="text-center p-2 font-medium">Semana</th>
                            <th className="text-left p-2 font-medium">Registro</th>
                            <th className="text-left p-2 font-medium">Última Actividad</th>
                            <th className="text-center p-2 font-medium">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {estadisticasTiempos.map((est: any) => (
                            <tr key={est.usuarioId} className="border-b hover:bg-muted/30">
                              <td className="p-2">
                                <UserAvatar 
                                  name={est.usuarioNombre} 
                                  fotoUrl={est.usuarioFotoUrl}
                                  fotoBase64={est.usuarioFotoBase64}
                                  size="sm"
                                  showName={true}
                                  nameClassName="truncate max-w-[150px]"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <span className={`font-medium ${est.totalCapturas > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                  {est.totalCapturas}
                                </span>
                              </td>
                              <td className="p-2 text-center">
                                <span className={`font-medium ${est.totalMensajesEnviados > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                                  {est.totalMensajesEnviados}
                                </span>
                              </td>
                              <td className="p-2 text-center">
                                <span className="font-medium">{est.totalAcciones}</span>
                              </td>
                              <td className="p-2 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-xs text-emerald-600">{est.capturasSemana} cap</span>
                                  <span className="text-xs text-blue-600">{est.lecturasSemana} lec</span>
                                </div>
                              </td>
                              <td className="p-2">
                                <span className="text-xs text-muted-foreground">
                                  {est.fechaRegistro ? format(new Date(est.fechaRegistro), "dd/MM/yy") : "-"}
                                </span>
                              </td>
                              <td className="p-2">
                                <span className="text-xs text-muted-foreground">
                                  {est.ultimaActividad ? format(new Date(est.ultimaActividad), "dd/MM/yy HH:mm") : "-"}
                                </span>
                              </td>
                              <td className="p-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {est.haCapturado ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 text-xs">Capturó</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">Sin capturas</Badge>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Vista móvil */}
                    <div className="md:hidden space-y-2">
                      {estadisticasTiempos.map((est: any) => (
                        <div key={est.usuarioId} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <UserAvatar 
                              name={est.usuarioNombre} 
                              fotoUrl={est.usuarioFotoUrl}
                              fotoBase64={est.usuarioFotoBase64}
                              size="md"
                              showName={true}
                              nameClassName="truncate max-w-[120px] font-medium"
                            />
                            {est.haCapturado ? (
                              <Badge className="bg-emerald-100 text-emerald-800 text-xs">Capturó</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Sin capturas</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 bg-muted/50 rounded">
                              <p className="text-lg font-bold text-emerald-600">{est.totalCapturas}</p>
                              <p className="text-xs text-muted-foreground">Capturas</p>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <p className="text-lg font-bold text-blue-600">{est.totalMensajesEnviados}</p>
                              <p className="text-xs text-muted-foreground">Mensajes</p>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <p className="text-lg font-bold">{est.totalAcciones}</p>
                              <p className="text-xs text-muted-foreground">Acciones</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs text-muted-foreground">
                            <span>Registro: {est.fechaRegistro ? format(new Date(est.fechaRegistro), "dd/MM/yy") : "-"}</span>
                            <span>Último: {est.ultimaActividad ? format(new Date(est.ultimaActividad), "dd/MM/yy HH:mm") : "-"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No hay datos de actividad disponibles</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
