import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle, ThumbsUp, ThumbsDown, Lightbulb, BarChart3, CheckCircle, XCircle, Clock } from "lucide-react";
import { useLocation } from "wouter";

export default function AsistenteAdmin() {
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const [, navigate] = useLocation();

  const { data: analytics } = trpc.asistente.analytics.useQuery(
    { proyectoId: selectedProjectId || undefined },
    { enabled: !!user }
  );
  const { data: sugerencias, isLoading: loadingSugerencias, refetch: refetchSugerencias } = trpc.asistente.sugerencias.useQuery(
    undefined,
    { enabled: !!user }
  );

  const updateSugerencia = trpc.asistente.updateSugerencia.useMutation({
    onSuccess: () => {
      refetchSugerencias();
      toast.success("Sugerencia actualizada");
    },
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No tienes permisos para ver esta página.</p>
      </div>
    );
  }

  const estadoColor = (estado: string) => {
    switch (estado) {
      case 'aplicada': return 'bg-emerald-100 text-emerald-700';
      case 'descartada': return 'bg-red-100 text-red-700';
      default: return 'bg-amber-100 text-amber-700';
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/bienvenida")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Panel del Asistente IA</h1>
          <p className="text-sm text-gray-500">Analytics de conversaciones y sugerencias de mejora</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <MessageCircle className="h-6 w-6 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{analytics?.totalConversaciones || 0}</p>
            <p className="text-xs text-gray-500">Conversaciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-6 w-6 text-purple-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{analytics?.porCategoria?.length || 0}</p>
            <p className="text-xs text-gray-500">Categorías</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Lightbulb className="h-6 w-6 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{sugerencias?.filter((s: any) => s.estado === 'pendiente').length || 0}</p>
            <p className="text-xs text-gray-500">Sugerencias Pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ThumbsDown className="h-6 w-6 text-red-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{analytics?.preguntasNoUtiles?.length || 0}</p>
            <p className="text-xs text-gray-500">No Útiles</p>
          </CardContent>
        </Card>
      </div>

      {analytics?.porCategoria && analytics.porCategoria.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Preguntas por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.porCategoria.map((cat: any, i: number) => {
                const max = Math.max(...analytics.porCategoria.map((c: any) => Number(c.total)));
                const pct = max > 0 ? (Number(cat.total) / max) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-32 shrink-0 capitalize">{(cat.categoria || 'general').replace('_', ' ')}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-medium w-10 text-right">{cat.total}</span>
                    <div className="flex gap-1 w-20">
                      <span className="text-xs text-emerald-600"><ThumbsUp className="h-3 w-3 inline" /> {cat.utiles || 0}</span>
                      <span className="text-xs text-red-500"><ThumbsDown className="h-3 w-3 inline" /> {cat.noUtiles || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" /> Sugerencias de Mejora Detectadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSugerencias ? (
            <p className="text-sm text-gray-400">Cargando...</p>
          ) : !sugerencias?.length ? (
            <p className="text-sm text-gray-400">Aún no hay sugerencias. Se generan automáticamente de las conversaciones.</p>
          ) : (
            <div className="space-y-3">
              {sugerencias.map((s: any) => (
                <div key={s.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.titulo}</span>
                      <Badge variant="outline" className={`text-[10px] ${estadoColor(s.estado)}`}>
                        {s.estado === 'pendiente' && <Clock className="h-3 w-3 mr-0.5" />}
                        {s.estado === 'aplicada' && <CheckCircle className="h-3 w-3 mr-0.5" />}
                        {s.estado === 'descartada' && <XCircle className="h-3 w-3 mr-0.5" />}
                        {s.estado}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{s.categoria}</Badge>
                      {s.frecuencia > 1 && <Badge variant="secondary" className="text-[10px]">x{s.frecuencia}</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{s.descripcion}</p>
                  </div>
                  {s.estado === 'pendiente' && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="text-emerald-600 hover:bg-emerald-50 h-7 text-xs"
                        onClick={() => updateSugerencia.mutate({ id: s.id, estado: 'aplicada' })}>
                        <CheckCircle className="h-3 w-3 mr-1" /> Aplicar
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 h-7 text-xs"
                        onClick={() => updateSugerencia.mutate({ id: s.id, estado: 'descartada' })}>
                        <XCircle className="h-3 w-3 mr-1" /> Descartar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {analytics?.preguntasNoUtiles && analytics.preguntasNoUtiles.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-red-500" /> Respuestas No Útiles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.preguntasNoUtiles.map((q: any, i: number) => (
                <div key={i} className="border rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-800">Pregunta: {q.pregunta}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">Respuesta: {q.respuesta}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">{q.categoria}</Badge>
                    <span className="text-[10px] text-gray-400">{new Date(q.createdAt).toLocaleDateString('es-MX')}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
