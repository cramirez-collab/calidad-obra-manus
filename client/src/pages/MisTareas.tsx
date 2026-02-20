import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { 
  ClipboardList,
  Clock, 
  CheckCircle2, 
  Eye,
  ChevronRight,
  Image,
  Filter,
  AlertCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { useState, useMemo } from "react";

type Filtro = 'todos' | 'creados' | 'pendientes_aprobacion';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pendiente_foto_despues: { label: "Foto Pend.", color: "text-orange-700", bg: "bg-orange-100" },
  pendiente_aprobacion: { label: "Por Aprobar", color: "text-blue-700", bg: "bg-blue-100" },
  aprobado: { label: "Aprobado", color: "text-green-700", bg: "bg-green-100" },
  rechazado: { label: "Rechazado", color: "text-red-700", bg: "bg-red-100" },
};

export default function MisTareas() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const { data, isLoading } = trpc.items.misTareas.useQuery(
    { proyectoId: selectedProjectId || undefined, filtro },
    { enabled: !!selectedProjectId }
  );

  const { data: proyectos } = trpc.proyectos.list.useQuery(undefined, { 
    staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 
  });
  const proyectoNombre = proyectos?.find((p: any) => p.id === selectedProjectId)?.nombre || 'Proyecto';

  const formatFecha = (fecha: Date | string | null) => {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  };

  const items = data?.items || [];
  const conteos = data?.conteos || { total: 0, creados: 0, pendientesAprobacion: 0 };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#02B381]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        {/* Header */}
        <div>
          <h1 className="text-lg font-bold text-[#002C63] flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#02B381]" />
            Mis Tareas
          </h1>
          <p className="text-xs text-gray-500">{user?.name} • {proyectoNombre}</p>
        </div>

        {/* Filtros como tabs compactos */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setFiltro('todos')}
            className={`p-2 rounded-lg text-center transition-all ${
              filtro === 'todos' 
                ? 'bg-[#002C63] text-white shadow-md' 
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            <span className="text-lg font-bold block">{conteos.total}</span>
            <span className="text-[9px]">Todos</span>
          </button>
          <button
            onClick={() => setFiltro('creados')}
            className={`p-2 rounded-lg text-center transition-all ${
              filtro === 'creados' 
                ? 'bg-[#02B381] text-white shadow-md' 
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            <span className="text-lg font-bold block">{conteos.creados}</span>
            <span className="text-[9px]">Mis Creados</span>
          </button>
          <button
            onClick={() => setFiltro('pendientes_aprobacion')}
            className={`p-2 rounded-lg text-center transition-all ${
              filtro === 'pendientes_aprobacion' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            <span className="text-lg font-bold block">{conteos.pendientesAprobacion}</span>
            <span className="text-[9px]">Por Aprobar</span>
          </button>
        </div>

        {/* Lista de ítems */}
        {items.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto text-[#02B381] mb-2" />
              <p className="text-sm font-medium text-[#002C63]">
                {filtro === 'todos' ? 'Sin tareas' : 
                 filtro === 'creados' ? 'No has creado ítems aún' : 
                 'Sin pendientes de aprobación'}
              </p>
              <p className="text-xs text-gray-500 mt-1">¡Todo al día!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((item: any) => {
              const sc = statusConfig[item.status] || statusConfig.pendiente_foto_despues;
              const esMio = item.creadoPorId === user?.id;
              
              return (
                <Card 
                  key={item.id}
                  className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                  onClick={() => setLocation(`/items/${item.id}`)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Thumbnail */}
                      {item.fotoAntesMarcadaUrl || item.fotoAntesUrl ? (
                        <img 
                          src={item.fotoAntesMarcadaUrl || item.fotoAntesUrl}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Image className="h-5 w-5 text-gray-400" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-gray-500">{item.codigo}</span>
                          <Badge className={`text-[8px] px-1.5 py-0 ${sc.bg} ${sc.color} border-0`}>
                            {sc.label}
                          </Badge>
                          {esMio && (
                            <Badge className="text-[8px] px-1.5 py-0 bg-purple-100 text-purple-700 border-0">
                              Mío
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500">
                          {item.empresaNombre && <span className="truncate max-w-[100px]">{item.empresaNombre}</span>}
                          {item.unidadNombre && <><span>•</span><span>{item.unidadNombre}</span></>}
                          {item.nivelNombre && <><span>•</span><span>{item.nivelNombre}</span></>}
                        </div>
                        {item.especialidadNombre && (
                          <p className="text-[10px] text-gray-400 truncate">{item.especialidadNombre}</p>
                        )}
                      </div>

                      {/* Fecha + flecha */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[9px] text-gray-400">{formatFecha(item.fechaCreacion)}</span>
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {items.length >= 200 && (
              <p className="text-center text-xs text-gray-400 py-2">
                Mostrando los últimos 200 ítems
              </p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
