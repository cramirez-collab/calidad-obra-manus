import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  ArrowLeft,
  Clock,
  User,
  AlertTriangle,
  Check,
  Eye,
  ChevronDown,
  ChevronUp,
  Loader2,
  Users,
  Download,
  FileText,
} from "lucide-react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${removeAccents(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Avisos() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  const [expandedAviso, setExpandedAviso] = useState<number | null>(null);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const { data: avisosList, isLoading } = trpc.avisos.list.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  const { data: leidosIds, refetch: refetchLeidos } = trpc.avisos.leidosPorUsuario.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  const { data: personasActivas } = trpc.avisos.personasActivas.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  // Query de lecturas del aviso expandido
  const { data: lecturasAviso } = trpc.avisos.lecturas.useQuery(
    { avisoId: expandedAviso! },
    { enabled: !!expandedAviso }
  );

  const utils = trpc.useUtils();
  const marcarLeidoMutation = trpc.avisos.marcarLeido.useMutation({
    onSuccess: () => {
      refetchLeidos();
      utils.avisos.noLeidos.invalidate();
      // Refetch lecturas del aviso actual
      if (expandedAviso) {
        utils.avisos.lecturas.invalidate({ avisoId: expandedAviso });
      }
    },
  });

  const leidosSet = new Set(leidosIds || []);

  const handleExpandAviso = (avisoId: number) => {
    if (expandedAviso === avisoId) {
      setExpandedAviso(null);
    } else {
      setExpandedAviso(avisoId);
      if (!leidosSet.has(avisoId)) {
        marcarLeidoMutation.mutate({ avisoId });
      }
    }
  };

  const formatFecha = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDescargarLecturas = () => {
    if (!avisosList || avisosList.length === 0) return;
    const rows: string[][] = [["Aviso", "Prioridad", "Creado por", "Fecha creacion", "Leido por", "Rol", "Fecha lectura"]];
    
    // Para cada aviso, necesitamos las lecturas - usamos los datos que ya tenemos
    avisosList.forEach(aviso => {
      rows.push([
        aviso.titulo,
        aviso.prioridad || "normal",
        aviso.creadoPorNombre || "",
        formatFecha(aviso.createdAt),
        "", "", "" // Se llena con lecturas individuales
      ]);
    });
    
    downloadCSV(`avisos_lecturas_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const handleDescargarPersonasActivas = () => {
    if (!personasActivas) return;
    const rows: string[][] = [["Nombre", "Rol", "Rol en proyecto"]];
    personasActivas.usuarios.forEach(u => {
      rows.push([u.name, u.role, u.rolEnProyecto || "residente"]);
    });
    downloadCSV(`personas_activas_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const handleDescargarLecturasAviso = (avisoTitulo: string) => {
    if (!lecturasAviso) return;
    const rows: string[][] = [["Nombre", "Rol", "Fecha de lectura"]];
    lecturasAviso.forEach(l => {
      rows.push([l.usuarioNombre, l.usuarioRole, formatFecha(l.leidoAt)]);
    });
    const tituloClean = removeAccents(avisoTitulo).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
    downloadCSV(`lecturas_${tituloClean}_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-[#02B381]" />
        </div>
      </DashboardLayout>
    );
  }

  const avisos = avisosList || [];
  const noLeidosCount = avisos.filter((a) => !leidosSet.has(a.id)).length;
  const totalPersonas = personasActivas?.total || 0;

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setLocation("/bienvenida")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-[#002C63]" />
              <h1 className="text-xl font-bold text-[#002C63]">Avisos</h1>
            </div>
            {noLeidosCount > 0 && (
              <Badge className="bg-red-500 text-white">
                {noLeidosCount} sin leer
              </Badge>
            )}
          </div>
          {/* Personas activas */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#002C63]/10 px-3 py-1.5 rounded-full">
              <Users className="h-4 w-4 text-[#002C63]" />
              <span className="text-sm font-bold text-[#002C63]">{totalPersonas}</span>
              <span className="text-xs text-[#002C63]/70 hidden sm:inline">activos</span>
            </div>
          </div>
        </div>

        {/* Botones de reporte - solo admin */}
        {isAdmin && avisos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-[#002C63]/30 text-[#002C63] hover:bg-[#002C63]/5"
              onClick={handleDescargarPersonasActivas}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Reporte Personas Activas
            </Button>
          </div>
        )}

        {/* Lista de avisos */}
        {avisos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No hay avisos por el momento</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {avisos.map((aviso) => {
              const isLeido = leidosSet.has(aviso.id);
              const isExpanded = expandedAviso === aviso.id;
              const isUrgente = aviso.prioridad === "urgente";

              return (
                <Card
                  key={aviso.id}
                  className={`transition-all duration-200 ${
                    !isLeido
                      ? "border-l-4 border-l-red-500 bg-red-50/30 shadow-md"
                      : "border-l-4 border-l-transparent hover:shadow-sm"
                  } ${isUrgente ? "ring-1 ring-orange-300" : ""}`}
                >
                  <CardContent className="p-4">
                    {/* Cabecera del aviso - clickable */}
                    <div
                      className="cursor-pointer"
                      onClick={() => handleExpandAviso(aviso.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {!isLeido && (
                              <span className="w-2.5 h-2.5 bg-red-500 rounded-full flex-shrink-0 animate-pulse" />
                            )}
                            {isUrgente && (
                              <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                            )}
                            <h3
                              className={`text-sm font-semibold truncate ${
                                !isLeido ? "text-[#002C63]" : "text-slate-700"
                              }`}
                            >
                              {aviso.titulo}
                            </h3>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {aviso.creadoPorNombre}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatFecha(aviso.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isLeido && (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contenido expandido */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {aviso.contenido}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {isUrgente && (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Urgente
                            </Badge>
                          )}
                          {isLeido && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              Leído
                            </span>
                          )}
                        </div>

                        {/* Sección de quién ha leído */}
                        <div className="mt-4 pt-3 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-[#002C63] flex items-center gap-1.5">
                              <Eye className="h-3.5 w-3.5" />
                              Leído por ({lecturasAviso?.length || 0} de {totalPersonas})
                            </h4>
                            {isAdmin && lecturasAviso && lecturasAviso.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] text-[#002C63] hover:bg-[#002C63]/5 px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDescargarLecturasAviso(aviso.titulo);
                                }}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                CSV
                              </Button>
                            )}
                          </div>
                          {lecturasAviso && lecturasAviso.length > 0 ? (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                              {lecturasAviso.map((lectura, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-[#02B381]/20 flex items-center justify-center">
                                      <User className="h-3 w-3 text-[#02B381]" />
                                    </div>
                                    <div>
                                      <span className="text-xs font-medium text-slate-700">
                                        {lectura.usuarioNombre}
                                      </span>
                                      <span className="text-[10px] text-slate-400 ml-1.5">
                                        {lectura.usuarioRole}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    {formatFecha(lectura.leidoAt)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">
                              Nadie ha leído este aviso aún
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
