import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  ChevronRight,
  Filter,
  Loader2,
  ClipboardCheck,
  AlertTriangle,
  Sparkles,
  FileText,
  Download,
} from "lucide-react";
import ProtocoloReport from "@/components/ProtocoloReport";

type FilterStatus = "todos" | "liberado" | "en_proceso" | "sin_evaluar" | "con_rojos";

export default function Pruebas() {
  const { selectedProjectId } = useProject();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filterNivel, setFilterNivel] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("todos");
  const [showProtocolo, setShowProtocolo] = useState(false);

  const { data: departamentos, isLoading } = trpc.pruebas.departamentos.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  // Seed mutation for admin
  const seedMutation = trpc.pruebas.seedCatalogo.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
  });

  // Extract unique levels
  const niveles = useMemo(() => {
    if (!departamentos) return [];
    const set = new Set(departamentos.map((d: any) => d.nivel).filter(Boolean));
    return Array.from(set).sort((a: any, b: any) => a - b);
  }, [departamentos]);

  // Filter departments
  const filtered = useMemo(() => {
    if (!departamentos) return [];
    return departamentos.filter((d: any) => {
      // Search
      if (search && !d.nombre.toLowerCase().includes(search.toLowerCase())) return false;
      // Level
      if (filterNivel !== "todos" && String(d.nivel) !== filterNivel) return false;
      // Status
      if (filterStatus === "liberado" && !d.liberado) return false;
      if (filterStatus === "en_proceso" && (d.liberado || d.evaluados === 0)) return false;
      if (filterStatus === "sin_evaluar" && d.evaluados > 0) return false;
      if (filterStatus === "con_rojos" && d.rojos === 0) return false;
      return true;
    });
  }, [departamentos, search, filterNivel, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    if (!departamentos) return { total: 0, liberados: 0, enProceso: 0, sinEvaluar: 0, conRojos: 0 };
    return {
      total: departamentos.length,
      liberados: departamentos.filter((d: any) => d.liberado).length,
      enProceso: departamentos.filter((d: any) => !d.liberado && d.evaluados > 0).length,
      sinEvaluar: departamentos.filter((d: any) => d.evaluados === 0).length,
      conRojos: departamentos.filter((d: any) => d.rojos > 0).length,
    };
  }, [departamentos]);

  const getSemaphoreColor = (d: any) => {
    if (d.liberado) return "bg-emerald-500";
    if (d.rojos > 0) return "bg-red-500";
    if (d.evaluados > 0) return "bg-amber-500";
    return "bg-gray-300";
  };

  const getSemaphoreIcon = (d: any) => {
    if (d.liberado) return <CheckCircle2 className="w-4 h-4 text-white" />;
    if (d.rojos > 0) return <XCircle className="w-4 h-4 text-white" />;
    if (d.evaluados > 0) return <Clock className="w-4 h-4 text-white" />;
    return <Clock className="w-4 h-4 text-gray-500" />;
  };

  const getProgressColor = (d: any) => {
    if (d.liberado) return "bg-emerald-500";
    if (d.progreso >= 70) return "bg-emerald-400";
    if (d.progreso >= 40) return "bg-amber-400";
    if (d.progreso > 0) return "bg-orange-400";
    return "bg-gray-200";
  };

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  if (!selectedProjectId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Selecciona un proyecto para ver las pruebas.</p>
        </div>
      </DashboardLayout>
    );
  }

  // If no catalogo exists, show seed button for admin
  const hasCatalogo = departamentos && departamentos.length > 0 && departamentos[0]?.totalPruebas > 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#002C63] flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#002C63] truncate">Pruebas por Departamento</h1>
            <p className="text-sm text-muted-foreground">
              {stats.total} departamentos · {stats.liberados} liberados
            </p>
          </div>
          {hasCatalogo && (
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/api/export/pruebas/pdf?proyectoId=${selectedProjectId}`, '_blank')}
                className="border-[#002C63]/30 hover:bg-[#002C63]/10 text-[#002C63]"
              >
                <Download className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">PDF Masivo</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setShowProtocolo(true)}
                className="bg-gradient-to-r from-[#002C63] to-[#02B381] hover:opacity-90 text-white"
              >
                <FileText className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Protocolos</span>
              </Button>
            </div>
          )}
        </div>

        {/* Seed catalogo if empty */}
        {!isLoading && !hasCatalogo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-800">Catálogo de pruebas vacío</h3>
                <p className="text-sm text-amber-700 mt-1">
                  No hay pruebas configuradas para este proyecto. 
                  {isAdmin ? " Presiona el botón para cargar el catálogo estándar de pruebas." : " Contacta al administrador."}
                </p>
                {isAdmin && (
                  <Button
                    className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                    size="sm"
                    onClick={() => seedMutation.mutate({ proyectoId: selectedProjectId })}
                    disabled={seedMutation.isPending}
                  >
                    {seedMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Cargar Catálogo Estándar</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {hasCatalogo && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            <button
              onClick={() => setFilterStatus("liberado")}
              className={`rounded-xl p-3 text-center transition-all border ${
                filterStatus === "liberado" ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500" : "border-gray-100 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="text-lg sm:text-2xl font-bold text-emerald-600">{stats.liberados}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">Liberados</div>
            </button>
            <button
              onClick={() => setFilterStatus("en_proceso")}
              className={`rounded-xl p-3 text-center transition-all border ${
                filterStatus === "en_proceso" ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500" : "border-gray-100 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="text-lg sm:text-2xl font-bold text-amber-600">{stats.enProceso}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">En proceso</div>
            </button>
            <button
              onClick={() => setFilterStatus("sin_evaluar")}
              className={`rounded-xl p-3 text-center transition-all border ${
                filterStatus === "sin_evaluar" ? "border-gray-500 bg-gray-50 ring-1 ring-gray-500" : "border-gray-100 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="text-lg sm:text-2xl font-bold text-gray-500">{stats.sinEvaluar}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">Pendientes</div>
            </button>
            <button
              onClick={() => setFilterStatus("con_rojos")}
              className={`rounded-xl p-3 text-center transition-all border ${
                filterStatus === "con_rojos" ? "border-red-500 bg-red-50 ring-1 ring-red-500" : "border-gray-100 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="text-lg sm:text-2xl font-bold text-red-600">{stats.conRojos}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">Con fallas</div>
            </button>
          </div>
        )}

        {/* Filters */}
        {hasCatalogo && (
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar depto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-lg"
              />
            </div>
            <Select value={filterNivel} onValueChange={setFilterNivel}>
              <SelectTrigger className="w-28 h-10 rounded-lg">
                <SelectValue placeholder="Nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {niveles.map((n: any) => (
                  <SelectItem key={n} value={String(n)}>N{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filterStatus !== "todos" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterStatus("todos")}
                className="h-10 px-3 text-xs"
              >
                <Filter className="w-3.5 h-3.5 mr-1" /> Limpiar
              </Button>
            )}
          </div>
        )}

        {/* Department List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-[#02B381]" />
          </div>
        ) : hasCatalogo ? (
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sin resultados</p>
                <p className="text-sm">Ajusta los filtros para ver departamentos.</p>
              </div>
            ) : (
              filtered.map((d: any) => (
                <button
                  key={d.id}
                  onClick={() => setLocation(`/pruebas/${d.id}`)}
                  className="w-full bg-white border border-gray-100 rounded-xl p-3 sm:p-4 flex items-center gap-3 hover:shadow-md hover:border-[#02B381]/30 transition-all active:scale-[0.98] text-left"
                >
                  {/* Semaphore */}
                  <div className={`w-9 h-9 rounded-full ${getSemaphoreColor(d)} flex items-center justify-center shrink-0 shadow-sm`}>
                    {getSemaphoreIcon(d)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#002C63] text-base">Depto {d.nombre}</span>
                      {d.nivel && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#002C63]/20 text-[#002C63]/70">
                          N{d.nivel}
                        </Badge>
                      )}
                      {d.liberado && (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 border-0">
                          <Shield className="w-3 h-3 mr-0.5" /> Liberado
                        </Badge>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getProgressColor(d)}`}
                          style={{ width: `${d.progreso}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground w-10 text-right">
                        {d.progreso}%
                      </span>
                    </div>

                    {/* Counts */}
                    <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                      {d.verdes > 0 && (
                        <span className="flex items-center gap-0.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                          {d.verdes}
                        </span>
                      )}
                      {d.rojos > 0 && (
                        <span className="flex items-center gap-0.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                          {d.rojos}
                        </span>
                      )}
                      {d.na > 0 && (
                        <span className="flex items-center gap-0.5">
                          <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                          {d.na} N/A
                        </span>
                      )}
                      <span className="text-muted-foreground/60">
                        {d.evaluados}/{d.totalPruebas * 2} evaluaciones
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {/* Protocolo Report Modal */}
      <ProtocoloReport
        open={showProtocolo}
        onClose={() => setShowProtocolo(false)}
        nivelFiltro={filterNivel}
      />
    </DashboardLayout>
  );
}
