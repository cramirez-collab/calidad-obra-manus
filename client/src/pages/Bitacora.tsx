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
  Building2
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ITEMS_PER_PAGE = 50;

export default function Bitacora() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  
  // Filtros
  const [filtroUsuario, setFiltroUsuario] = useState<string>("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
  const [filtroAccion, setFiltroAccion] = useState<string>("");
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");
  const [busqueda, setBusqueda] = useState<string>("");
  const [pagina, setPagina] = useState(1);

  // Queries
  const { data: usuarios } = trpc.users.list.useQuery();
  const { data: unidades } = trpc.unidades.list.useQuery();
  const [filtroUnidad, setFiltroUnidad] = useState<string>("");
  
  const filtros = useMemo(() => ({
    usuarioId: filtroUsuario ? parseInt(filtroUsuario) : undefined,
    categoria: filtroCategoria || undefined,
    fechaDesde: fechaDesde ? new Date(fechaDesde) : undefined,
    fechaHasta: fechaHasta ? new Date(fechaHasta + "T23:59:59") : undefined,
    limit: ITEMS_PER_PAGE,
    offset: (pagina - 1) * ITEMS_PER_PAGE,
  }), [filtroUsuario, filtroCategoria, fechaDesde, fechaHasta, pagina]);

  // Agrupar usuarios por rol para mejor visualización
  const usuariosAgrupados = useMemo(() => {
    if (!usuarios) return { supervisores: [], residentes: [], otros: [] };
    const supervisores = usuarios.filter((u: any) => u.role === 'supervisor' || u.role === 'superadmin' || u.role === 'admin');
    const residentes = usuarios.filter((u: any) => u.role === 'residente' || u.role === 'jefe_residente');
    const otros = usuarios.filter((u: any) => !['supervisor', 'superadmin', 'admin', 'residente', 'jefe_residente'].includes(u.role));
    return { supervisores, residentes, otros };
  }, [usuarios]);

  const { data: auditoria, isLoading } = isAdmin 
    ? trpc.bitacora.list.useQuery({
        usuarioId: filtros.usuarioId,
        accion: filtros.categoria,
        fechaDesde: filtros.fechaDesde,
        fechaHasta: filtros.fechaHasta,
        limit: filtros.limit,
      })
    : trpc.bitacora.miActividad.useQuery({});

  // Contar total para paginación (aproximado basado en datos cargados)
  const totalCount = auditoria?.length || 0;

  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  // Filtrar por búsqueda local
  const actividadesFiltradas = useMemo(() => {
    if (!auditoria) return [];
    if (!busqueda && !filtroAccion) return auditoria;
    
    return auditoria.filter((a: any) => {
      const matchBusqueda = !busqueda || 
        a.detalles?.toLowerCase().includes(busqueda.toLowerCase()) ||
        a.usuarioNombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        a.accion?.toLowerCase().includes(busqueda.toLowerCase());
      
      const matchAccion = !filtroAccion || a.accion === filtroAccion;
      
      // Filtro por unidad - buscar en detalles si contiene la unidad
      const matchUnidad = !filtroUnidad || 
        a.detalles?.toLowerCase().includes(filtroUnidad.toLowerCase());
      
      return matchBusqueda && matchAccion && matchUnidad;
    });
  }, [auditoria, busqueda, filtroAccion, filtroUnidad]);

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
      crear_unidad: 'Creó unidad',
      crear_especialidad: 'Creó especialidad',
      crear_atributo: 'Creó atributo',
      cambiar_rol: 'Cambió rol de usuario',
      crear_mensaje: 'Envió mensaje',
      eliminar_mensaje: 'Eliminó mensaje',
      aprobar_supervisor: 'Aprobación de supervisor',
      revocar_aprobacion: 'Revocó aprobación',
    };
    return labels[accion] || accion;
  };

  const getCategoriaLabel = (categoria: string | null) => {
    if (!categoria) return '';
    const labels: Record<string, string> = {
      item: 'Ítem',
      empresa: 'Empresa',
      unidad: 'Unidad',
      especialidad: 'Especialidad',
      atributo: 'Atributo',
      usuario: 'Usuario',
      mensaje: 'Mensaje',
      proyecto: 'Proyecto',
      auth: 'Autenticación',
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
    if (!actividadesFiltradas || actividadesFiltradas.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = ["Fecha", "Hora", "Usuario", "Rol", "Acción", "Categoría", "Entidad ID", "Detalles"];
    const rows = actividadesFiltradas.map((a: any) => [
      format(new Date(a.createdAt), "dd/MM/yyyy"),
      format(new Date(a.createdAt), "HH:mm:ss"),
      a.usuarioNombre || "-",
      a.usuarioRol || "-",
      getAccionLabel(a.accion),
      getCategoriaLabel(a.categoria),
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
    if (!actividadesFiltradas || actividadesFiltradas.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(0, 44, 99); // #002C63
    doc.text("Bitácora de Auditoría", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
    doc.text(`Total de registros: ${actividadesFiltradas.length}`, 14, 34);

    // Filtros aplicados
    let filtrosTexto = "Filtros: ";
    if (filtroUsuario) {
      const usuario = usuarios?.find((u: any) => u.id === parseInt(filtroUsuario));
      filtrosTexto += `Usuario: ${usuario?.name || filtroUsuario}, `;
    }
    if (filtroCategoria) filtrosTexto += `Categoría: ${getCategoriaLabel(filtroCategoria)}, `;
    if (fechaDesde) filtrosTexto += `Desde: ${fechaDesde}, `;
    if (fechaHasta) filtrosTexto += `Hasta: ${fechaHasta}, `;
    if (filtrosTexto !== "Filtros: ") {
      doc.text(filtrosTexto.slice(0, -2), 14, 40);
    }

    // Tabla
    const tableData = actividadesFiltradas.map((a: any) => [
      format(new Date(a.createdAt), "dd/MM/yyyy HH:mm"),
      a.usuarioNombre || "-",
      a.usuarioRol || "-",
      getAccionLabel(a.accion),
      getCategoriaLabel(a.categoria),
      a.detalles?.substring(0, 50) || "-",
    ]);

    autoTable(doc, {
      head: [["Fecha/Hora", "Usuario", "Rol", "Acción", "Categoría", "Detalles"]],
      body: tableData,
      startY: 45,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 44, 99], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`bitacora_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`);
    toast.success("Archivo PDF exportado correctamente");
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltroUsuario("");
    setFiltroCategoria("");
    setFiltroAccion("");
    setFiltroUnidad("");
    setFechaDesde("");
    setFechaHasta("");
    setBusqueda("");
    setPagina(1);
  };

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
          
          {/* Botones de exportación */}
          <div className="flex gap-2">
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

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {/* Búsqueda */}
              <div className="sm:col-span-2 lg:col-span-1">
                <Label className="text-xs">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>

              {/* Usuario */}
              <div>
                <Label className="text-xs">Usuario</Label>
                <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {usuariosAgrupados.supervisores.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">Supervisores</div>
                        {usuariosAgrupados.supervisores.map((u: any) => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {usuariosAgrupados.residentes.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">Residentes</div>
                        {usuariosAgrupados.residentes.map((u: any) => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {usuariosAgrupados.otros.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">Otros</div>
                        {usuariosAgrupados.otros.map((u: any) => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Unidad */}
              <div>
                <Label className="text-xs">Unidad</Label>
                <Select value={filtroUnidad} onValueChange={setFiltroUnidad}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {unidades?.map((u: any) => (
                      <SelectItem key={u.id} value={u.nombre}>
                        {u.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categoría */}
              <div>
                <Label className="text-xs">Categoría</Label>
                <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    <SelectItem value="item">Ítems</SelectItem>
                    <SelectItem value="usuario">Usuarios</SelectItem>
                    <SelectItem value="mensaje">Mensajes</SelectItem>
                    <SelectItem value="proyecto">Proyectos</SelectItem>
                    <SelectItem value="auth">Autenticación</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha desde */}
              <div>
                <Label className="text-xs">Desde</Label>
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Fecha hasta */}
              <div>
                <Label className="text-xs">Hasta</Label>
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Limpiar */}
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="h-9 w-full">
                  Limpiar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-2xl font-bold text-[#002C63]">{totalCount || 0}</div>
            <div className="text-xs text-muted-foreground">Total registros</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold text-emerald-600">
              {actividadesFiltradas?.filter((a: any) => a.accion === 'aprobar_item').length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Aprobaciones</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold text-red-600">
              {actividadesFiltradas?.filter((a: any) => a.accion === 'rechazar_item').length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Rechazos</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold text-blue-600">
              {actividadesFiltradas?.filter((a: any) => a.accion === 'crear_mensaje').length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Mensajes</div>
          </Card>
        </div>

        {/* Lista de actividades */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Registros de Auditoría
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                Mostrando {actividadesFiltradas?.length || 0} de {totalCount || 0}
              </span>
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
                        <th className="text-left p-2 font-medium">Fecha/Hora</th>
                        <th className="text-left p-2 font-medium">Usuario</th>
                        <th className="text-left p-2 font-medium">Rol</th>
                        <th className="text-left p-2 font-medium">Acción</th>
                        <th className="text-left p-2 font-medium">Categoría</th>
                        <th className="text-left p-2 font-medium">Detalles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actividadesFiltradas.map((actividad: any) => (
                        <tr key={actividad.id} className="border-b hover:bg-muted/30">
                          <td className="p-2 whitespace-nowrap">
                            <div className="flex items-center gap-1 text-xs">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(actividad.createdAt), "dd/MM/yy HH:mm")}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[120px]">
                                {actividad.usuarioNombre || "-"}
                              </span>
                            </div>
                          </td>
                          <td className="p-2">
                            <Badge className={`text-xs ${getRolColor(actividad.usuarioRol)}`}>
                              {actividad.usuarioRol || "-"}
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
                              {getCategoriaLabel(actividad.categoria)}
                              {actividad.entidadId && ` #${actividad.entidadId}`}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <span className="text-muted-foreground truncate block max-w-[200px]">
                              {actividad.detalles || "-"}
                            </span>
                          </td>
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
                          <div className="p-1.5 rounded-full bg-muted">
                            {getAccionIcon(actividad.accion)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {getAccionLabel(actividad.accion)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {actividad.usuarioNombre || "-"}
                            </p>
                          </div>
                        </div>
                        <Badge className={`text-xs ${getRolColor(actividad.usuarioRol)}`}>
                          {actividad.usuarioRol}
                        </Badge>
                      </div>
                      {actividad.detalles && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {actividad.detalles}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <Badge variant="outline" className="text-xs">
                          {getCategoriaLabel(actividad.categoria)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(actividad.createdAt), "dd/MM/yy HH:mm")}
                        </span>
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
      </div>
    </DashboardLayout>
  );
}
