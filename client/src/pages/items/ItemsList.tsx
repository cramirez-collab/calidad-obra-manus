import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileSpreadsheet, FileText, Trash2, FileDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getImageUrl } from "@/lib/imageUrl";
import { 
  ClipboardCheck, 
  Search, 
  Filter, 
  Eye, 
  Camera,
  Clock,
  CheckCircle2,
  XCircle,
  QrCode,
  Plus,
  Download
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
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
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";

const statusLabels: Record<string, string> = {
  pendiente_foto_despues: "Pendiente Foto",
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

const statusIcons: Record<string, typeof Clock> = {
  pendiente_foto_despues: Camera,
  pendiente_aprobacion: Clock,
  aprobado: CheckCircle2,
  rechazado: XCircle,
};

export default function ItemsList() {
  const [, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  const { user } = useAuth();
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const utils = trpc.useUtils();
  
  // Solo superadmin puede eliminar permanentemente
  const canDelete = user?.role === 'superadmin';
  
  const deleteMutation = trpc.items.delete.useMutation({
    onSuccess: () => {
      toast.success('Ítem eliminado permanentemente de la base de datos');
      // Invalidar caché para refrescar la lista
      utils.items.list.invalidate();
      utils.estadisticas.general.invalidate();
      setItemToDelete(null);
    },
    onError: (error) => {
      const msg = error.message?.length > 100 ? 'Error al eliminar. Intenta de nuevo.' : ('Error al eliminar: ' + error.message);
      toast.error(msg);
    }
  });
  
  const handleDelete = (itemId: number) => {
    deleteMutation.mutate({ id: itemId });
  };
  
  const [filters, setFilters] = useState({
    empresaId: "",
    unidadId: "",
    especialidadId: "",
    atributoId: "",
    status: "",
    busqueda: "",
    numeroInterno: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Leer parámetros de URL para aplicar filtros (desde Stacking u otras páginas)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get('status');
    const unidadParam = urlParams.get('unidad');
    const empresaParam = urlParams.get('empresa');
    
    if (statusParam || unidadParam || empresaParam) {
      setFilters(prev => ({
        ...prev,
        status: statusParam || prev.status,
        unidadId: unidadParam || prev.unidadId,
        empresaId: empresaParam || prev.empresaId,
      }));
      setShowFilters(true);
      // Limpiar URL después de aplicar filtros
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const { data: empresas } = trpc.empresas.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: unidades } = trpc.unidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const { data: especialidades } = trpc.especialidades.listConAtributos.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  
  // Filtrar atributos según especialidad seleccionada
  const atributosFiltrados = useMemo(() => {
    if (!filters.especialidadId || filters.especialidadId === "all") {
      return especialidades?.flatMap((e: any) => e.atributos || []) || [];
    }
    const esp = especialidades?.find((e: any) => e.id === parseInt(filters.especialidadId));
    return (esp as any)?.atributos || [];
  }, [filters.especialidadId, especialidades]);

  const queryFilters = useMemo(() => ({
    proyectoId: selectedProjectId || undefined,
    empresaId: filters.empresaId ? parseInt(filters.empresaId) : undefined,
    unidadId: filters.unidadId ? parseInt(filters.unidadId) : undefined,
    especialidadId: filters.especialidadId ? parseInt(filters.especialidadId) : undefined,
    status: filters.status || undefined,
    busqueda: filters.busqueda || undefined,
    numeroInterno: filters.numeroInterno ? parseInt(filters.numeroInterno) : undefined,
    limit: 100,
    offset: 0,
  }), [filters, selectedProjectId]);

  const { data, isLoading } = trpc.items.list.useQuery(queryFilters);

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
  const getEspecialidadInfo = (id: number) => especialidades?.find(e => e.id === id);

  const clearFilters = () => {
    setFilters({
      empresaId: "",
      unidadId: "",
      especialidadId: "",
      atributoId: "",
      status: "",
      busqueda: "",
      numeroInterno: "",
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== "");

  const getExportParams = () => {
    const params = new URLSearchParams();
    if (filters.empresaId) params.append("empresaId", filters.empresaId);
    if (filters.unidadId) params.append("unidadId", filters.unidadId);
    if (filters.especialidadId) params.append("especialidadId", filters.especialidadId);
    if (filters.status) params.append("status", filters.status);
    return params.toString();
  };

  const exportToExcel = () => {
    window.open(`/api/export/items?${getExportParams()}`, "_blank");
  };

  const exportToCSV = () => {
    window.open(`/api/export/items/csv?${getExportParams()}`, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Ítems de Calidad</h1>
            <p className="text-sm text-muted-foreground">
              {data?.total || 0} ítems encontrados
            </p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => window.print()}>
                  <FileDown className="h-4 w-4 mr-2 text-red-600" />
                  PDF (Imprimir)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileText className="h-4 w-4 mr-2 text-blue-600" />
                  CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => setLocation("/items/nuevo")}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Nuevo</span>
            </Button>
          </div>
        </div>

        {/* Barra de búsqueda y filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por título o código..."
                    value={filters.busqueda}
                    onChange={(e) => setFilters({ ...filters, busqueda: e.target.value })}
                    className="pl-9"
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    placeholder="# Int."
                    value={filters.numeroInterno}
                    onChange={(e) => setFilters({ ...filters, numeroInterno: e.target.value })}
                    className="text-center"
                    min={1}
                  />
                </div>
                <Button
                  variant={showFilters ? "secondary" : "outline"}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  {hasActiveFilters && (
                    <Badge className="ml-2 h-5 w-5 p-0 justify-center" variant="destructive">
                      !
                    </Badge>
                  )}
                </Button>
              </div>

              {showFilters && (
                <div className="pt-3 border-t space-y-3">
                  {/* Grid de filtros en cajas - 2 columnas en móvil, 3 en tablet, 5 en desktop */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    <Select
                      value={filters.status}
                      onValueChange={(value) => setFilters({ ...filters, status: value })}
                    >
                      <SelectTrigger className="h-9 text-xs sm:text-sm">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pendiente_foto_despues">Pend. Foto</SelectItem>
                        <SelectItem value="pendiente_aprobacion">Pend. Aprob.</SelectItem>
                        <SelectItem value="aprobado">Aprobado</SelectItem>
                        <SelectItem value="rechazado">Rechazado</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={filters.empresaId}
                      onValueChange={(value) => setFilters({ ...filters, empresaId: value })}
                    >
                      <SelectTrigger className="h-9 text-xs sm:text-sm truncate">
                        <SelectValue placeholder="Empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {empresas?.map((empresa) => (
                          <SelectItem key={empresa.id} value={empresa.id.toString()}>
                            {empresa.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filters.unidadId}
                      onValueChange={(value) => setFilters({ ...filters, unidadId: value })}
                    >
                      <SelectTrigger className="h-9 text-xs sm:text-sm truncate">
                        <SelectValue placeholder="Unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {unidades?.map((unidad) => (
                          <SelectItem key={unidad.id} value={unidad.id.toString()}>
                            {unidad.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filters.especialidadId}
                      onValueChange={(value) => setFilters({ ...filters, especialidadId: value, atributoId: "" })}
                    >
                      <SelectTrigger className="h-9 text-xs sm:text-sm truncate">
                        <SelectValue placeholder="Especialidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {especialidades?.map((esp) => (
                          <SelectItem key={esp.id} value={esp.id.toString()}>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: esp.color || "#3B82F6" }}
                              />
                              <span className="truncate">{esp.nombre}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filters.atributoId}
                      onValueChange={(value) => setFilters({ ...filters, atributoId: value })}
                    >
                      <SelectTrigger className="h-9 text-xs sm:text-sm truncate">
                        <SelectValue placeholder="Atributo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {atributosFiltrados.map((attr: any) => (
                          <SelectItem key={attr.id} value={attr.id.toString()}>
                            {attr.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Botón limpiar filtros centrado */}
                  {hasActiveFilters && (
                    <div className="flex justify-center">
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                        Limpiar filtros
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de ítems */}
        <div className="grid gap-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Cargando ítems...
              </CardContent>
            </Card>
          ) : data?.items.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No se encontraron ítems
              </CardContent>
            </Card>
          ) : (
            data?.items.map((item) => {
              const StatusIcon = statusIcons[item.status];
              const especialidad = item.especialidadId ? getEspecialidadInfo(item.especialidadId) : null;
              
              return (
                <Card 
                  key={item.id} 
                  className="card-hover cursor-pointer"
                  onClick={() => setLocation(`/items/${item.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Thumbnail de foto */}
                      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {item.fotoAntesMarcadaUrl || item.fotoAntesUrl ? (
                          <img
                            src={getImageUrl(item.fotoAntesMarcadaUrl || item.fotoAntesUrl || "")}
                            alt="Foto antes"
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Camera className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>

                      {/* Información principal */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold truncate">{item.titulo}</h3>
                            <p className="text-sm text-muted-foreground font-mono">
                              {item.codigo} <span className="text-xs text-[#02B381] font-bold">#{item.numeroInterno || '-'}</span>
                            </p>
                            <Badge className={`${statusColors[item.status]} mt-1 text-xs`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusLabels[item.status]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/seguimiento/${item.codigo}`);
                            }}>
                              <QrCode className="h-4 w-4" />
                            </Button>
                            {canDelete && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-muted-foreground hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemToDelete(item.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>{getEmpresaNombre(item.empresaId)}</span>
                          <span>•</span>
                          <span>{getUnidadNombre(item.unidadId)}</span>
                          {especialidad && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <div
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: especialidad.color || "#3B82F6" }}
                                />
                                {especialidad.nombre}
                              </span>
                            </>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          Creado: {formatDate(item.fechaCreacion)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
      
      {/* AlertDialog de confirmación para eliminar */}
      <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Ítem</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este ítem? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => itemToDelete && handleDelete(itemToDelete)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
