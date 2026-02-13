import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useState, useMemo } from "react";
import {
  Mail,
  MailOpen,
  Clock,
  Send,
  FileText,
  Building2,
  User,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const ITEMS_PER_PAGE = 20;

const tipoLabels: Record<string, string> = {
  firma_reporte: "Firma de Reporte",
  notificacion: "Notificación",
  reporte_pdf: "Reporte PDF",
  recordatorio: "Recordatorio",
};

const tipoColors: Record<string, string> = {
  firma_reporte: "bg-blue-100 text-blue-800",
  notificacion: "bg-amber-100 text-amber-800",
  reporte_pdf: "bg-emerald-100 text-emerald-800",
  recordatorio: "bg-purple-100 text-purple-800",
};

export default function BitacoraCorreos() {
  const { selectedProjectId } = useProject();
  const [tipoFiltro, setTipoFiltro] = useState<string>("");
  const [page, setPage] = useState(0);

  const { data, isLoading, refetch } = trpc.bitacoraCorreos.listar.useQuery(
    {
      proyectoId: selectedProjectId!,
      tipo: tipoFiltro || undefined,
      limit: ITEMS_PER_PAGE,
      offset: page * ITEMS_PER_PAGE,
    },
    { enabled: !!selectedProjectId }
  );

  const correos = data?.correos || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Estadísticas rápidas
  const stats = useMemo(() => {
    if (!correos.length) return { enviados: 0, abiertos: 0, sinAbrir: 0 };
    const abiertos = correos.filter((c: any) => c.abierto).length;
    return {
      enviados: total,
      abiertos,
      sinAbrir: total - abiertos,
    };
  }, [correos, total]);

  const formatDate = (date: any) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!selectedProjectId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Seleccione un proyecto</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-full overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Mail className="h-6 w-6 text-[#002C63]" />
              Bitácora de Correos
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Registro de correos enviados con fecha y hora de apertura
            </p>
          </div>
          <div className="flex gap-2">
            <Select
              value={tipoFiltro}
              onValueChange={(v) => { setTipoFiltro(v === "all" ? "" : v); setPage(0); }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="firma_reporte">Firma de Reporte</SelectItem>
                <SelectItem value="notificacion">Notificación</SelectItem>
                <SelectItem value="reporte_pdf">Reporte PDF</SelectItem>
                <SelectItem value="recordatorio">Recordatorio</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-sm">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Send className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold">{stats.enviados}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Enviados</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <MailOpen className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold">{stats.abiertos}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Abiertos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <EyeOff className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold">{stats.sinAbrir}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Sin abrir</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de correos */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : correos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No hay correos registrados</p>
              <p className="text-xs text-muted-foreground mt-1">
                Los correos aparecerán aquí cuando se envíen reportes para firma
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {correos.map((correo: any) => (
              <Card key={correo.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                    {/* Icono de estado */}
                    <div className={`p-2 rounded-lg flex-shrink-0 ${correo.abierto ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                      {correo.abierto ? (
                        <MailOpen className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Mail className="h-5 w-5 text-gray-400" />
                      )}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold truncate">{correo.asunto}</h3>
                        <Badge className={`text-[10px] ${tipoColors[correo.tipo] || 'bg-gray-100 text-gray-800'}`}>
                          {tipoLabels[correo.tipo] || correo.tipo}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {correo.destinatarioNombre || correo.destinatarioEmail}
                        </span>
                        {correo.destinatarioEmpresa && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {correo.destinatarioEmpresa}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          Enviado: {formatDate(correo.fechaEnvio)}
                        </span>
                      </div>

                      {/* Fecha de apertura */}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {correo.abierto ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            <Eye className="h-3 w-3 mr-1" />
                            Abierto: {formatDate(correo.fechaApertura)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendiente de apertura
                          </Badge>
                        )}
                        {correo.ipApertura && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            IP: {correo.ipApertura}
                          </Badge>
                        )}
                      </div>

                      {/* Leyenda */}
                      {correo.leyenda && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 italic">
                          <FileText className="h-3 w-3 inline mr-1" />
                          {correo.leyenda}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Mostrando {page * ITEMS_PER_PAGE + 1}-{Math.min((page + 1) * ITEMS_PER_PAGE, total)} de {total}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
