import { useState, useEffect } from "react";
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
} from "lucide-react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";

export default function Avisos() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  const [expandedAviso, setExpandedAviso] = useState<number | null>(null);

  const { data: avisosList, isLoading } = trpc.avisos.list.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  const { data: leidosIds, refetch: refetchLeidos } = trpc.avisos.leidosPorUsuario.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  const utils = trpc.useUtils();
  const marcarLeidoMutation = trpc.avisos.marcarLeido.useMutation({
    onSuccess: () => {
      refetchLeidos();
      utils.avisos.noLeidos.invalidate();
    },
  });

  const leidosSet = new Set(leidosIds || []);

  const handleExpandAviso = (avisoId: number) => {
    if (expandedAviso === avisoId) {
      setExpandedAviso(null);
    } else {
      setExpandedAviso(avisoId);
      // Marcar como leído al expandir
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

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto">
        {/* Header */}
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
            <Badge className="bg-red-500 text-white ml-2">
              {noLeidosCount} sin leer
            </Badge>
          )}
        </div>

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
                  className={`cursor-pointer transition-all duration-200 ${
                    !isLeido
                      ? "border-l-4 border-l-red-500 bg-red-50/30 shadow-md"
                      : "border-l-4 border-l-transparent hover:shadow-sm"
                  } ${isUrgente ? "ring-1 ring-orange-300" : ""}`}
                  onClick={() => handleExpandAviso(aviso.id)}
                >
                  <CardContent className="p-4">
                    {/* Cabecera del aviso */}
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

                    {/* Contenido expandido */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {aviso.contenido}
                        </p>
                        {isUrgente && (
                          <Badge className="mt-2 bg-orange-100 text-orange-700 border-orange-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Urgente
                          </Badge>
                        )}
                        {isLeido && (
                          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            Leído
                          </p>
                        )}
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
