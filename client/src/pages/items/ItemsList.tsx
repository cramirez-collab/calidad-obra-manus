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
import { trpc } from "@/lib/trpc";
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
import { useState, useMemo } from "react";
import { useLocation } from "wouter";

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
  const [filters, setFilters] = useState({
    empresaId: "",
    unidadId: "",
    especialidadId: "",
    atributoId: "",
    status: "",
    busqueda: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data: empresas } = trpc.empresas.list.useQuery();
  const { data: unidades } = trpc.unidades.list.useQuery();
  const { data: especialidades } = trpc.especialidades.listConAtributos.useQuery();
  
  // Filtrar atributos según especialidad seleccionada
  const atributosFiltrados = useMemo(() => {
    if (!filters.especialidadId || filters.especialidadId === "all") {
      return especialidades?.flatMap((e: any) => e.atributos || []) || [];
    }
    const esp = especialidades?.find((e: any) => e.id === parseInt(filters.especialidadId));
    return (esp as any)?.atributos || [];
  }, [filters.especialidadId, especialidades]);

  const queryFilters = useMemo(() => ({
    empresaId: filters.empresaId ? parseInt(filters.empresaId) : undefined,
    unidadId: filters.unidadId ? parseInt(filters.unidadId) : undefined,
    especialidadId: filters.especialidadId ? parseInt(filters.especialidadId) : undefined,
    status: filters.status || undefined,
    busqueda: filters.busqueda || undefined,
    limit: 100,
    offset: 0,
  }), [filters]);

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
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== "");

  const exportToExcel = () => {
    const params = new URLSearchParams();
    if (filters.empresaId) params.append("empresaId", filters.empresaId);
    if (filters.unidadId) params.append("unidadId", filters.unidadId);
    if (filters.especialidadId) params.append("especialidadId", filters.especialidadId);
    if (filters.status) params.append("status", filters.status);
    window.open(`/api/export/items?${params.toString()}`, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ítems de Calidad</h1>
            <p className="text-muted-foreground">
              {data?.total || 0} ítems encontrados
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={() => setLocation("/items/nuevo")}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Ítem
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-2 border-t">
                  <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters({ ...filters, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="pendiente_foto_despues">Pendiente Foto</SelectItem>
                      <SelectItem value="pendiente_aprobacion">Pendiente Aprobación</SelectItem>
                      <SelectItem value="aprobado">Aprobado</SelectItem>
                      <SelectItem value="rechazado">Rechazado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.empresaId}
                    onValueChange={(value) => setFilters({ ...filters, empresaId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las empresas</SelectItem>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las unidades</SelectItem>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Especialidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las especialidades</SelectItem>
                      {especialidades?.map((esp) => (
                        <SelectItem key={esp.id} value={esp.id.toString()}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: esp.color || "#3B82F6" }}
                            />
                            {esp.nombre}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.atributoId}
                    onValueChange={(value) => setFilters({ ...filters, atributoId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Atributo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los atributos</SelectItem>
                      {atributosFiltrados.map((attr: any) => (
                        <SelectItem key={attr.id} value={attr.id.toString()}>
                          {attr.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasActiveFilters && (
                    <Button variant="ghost" onClick={clearFilters} className="col-span-full md:col-span-1">
                      Limpiar filtros
                    </Button>
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
              const especialidad = getEspecialidadInfo(item.especialidadId);
              
              return (
                <Card 
                  key={item.id} 
                  className="card-hover cursor-pointer"
                  onClick={() => setLocation(`/items/${item.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Thumbnail de foto */}
                      <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {item.fotoAntesMarcadaUrl || item.fotoAntesUrl ? (
                          <img
                            src={item.fotoAntesMarcadaUrl || item.fotoAntesUrl || ""}
                            alt="Foto antes"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Camera className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>

                      {/* Información principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold truncate">{item.titulo}</h3>
                              <Badge className={statusColors[item.status]}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusLabels[item.status]}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground font-mono">
                              {item.codigo}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/seguimiento/${item.codigo}`);
                          }}>
                            <QrCode className="h-4 w-4" />
                          </Button>
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
    </DashboardLayout>
  );
}
