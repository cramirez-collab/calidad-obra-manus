import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { 
  AlertTriangle,
  Building2,
  Users,
  Wrench,
  ChevronRight,
  Clock,
  TrendingDown,
  Target
} from "lucide-react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";

export default function Prioridades() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  
  // Ítems críticos priorizados
  const { data: itemsCriticos, isLoading: loadingItems } = trpc.flujoRapido.itemsCriticos.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId, limit: 15 } : { limit: 15 },
    { enabled: true }
  );
  
  // Top 5 peores
  const { data: top5, isLoading: loadingTop5 } = trpc.flujoRapido.top5Peores.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : {},
    { enabled: true }
  );

  const getSeveridadColor = (severidad: string) => {
    switch (severidad) {
      case 'critico': return 'bg-red-500 text-white';
      case 'grave': return 'bg-orange-500 text-white';
      case 'moderado': return 'bg-yellow-500 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  const getSeveridadBorder = (severidad: string) => {
    switch (severidad) {
      case 'critico': return 'border-l-4 border-l-red-500';
      case 'grave': return 'border-l-4 border-l-orange-500';
      case 'moderado': return 'border-l-4 border-l-yellow-500';
      default: return 'border-l-4 border-l-blue-500';
    }
  };

  const isLoading = loadingItems || loadingTop5;

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
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-[#002C63]" />
          <h1 className="text-lg font-bold text-[#002C63]">Prioridades</h1>
          <Badge variant="secondary" className="text-[10px]">De peor a mejor</Badge>
        </div>

        <Tabs defaultValue="items" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="items" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Ítems Críticos
            </TabsTrigger>
            <TabsTrigger value="ranking" className="text-xs">
              <TrendingDown className="h-3 w-3 mr-1" />
              Ranking
            </TabsTrigger>
          </TabsList>

          {/* Tab: Ítems Críticos */}
          <TabsContent value="items" className="mt-3 space-y-2">
            {itemsCriticos?.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6 text-center">
                  <Target className="h-12 w-12 mx-auto text-[#02B381] mb-2" />
                  <p className="text-sm font-medium text-[#002C63]">¡Sin ítems críticos!</p>
                  <p className="text-xs text-gray-500">Todos los pendientes están bajo control</p>
                </CardContent>
              </Card>
            ) : (
              itemsCriticos?.map((item: any, index: number) => (
                <Card 
                  key={item.id} 
                  className={`border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${getSeveridadBorder(item.severidad)}`}
                  onClick={() => setLocation(`/items/${item.id}`)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Número de prioridad */}
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        index < 3 ? 'bg-red-500 text-white' : 
                        index < 6 ? 'bg-orange-500 text-white' : 
                        'bg-gray-200 text-gray-600'
                      }`}>
                        #{index + 1}
                      </div>
                      
                      {/* Info del ítem */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-gray-500">{item.codigo}</span>
                          <Badge className={`text-[9px] ${getSeveridadColor(item.severidad)}`}>
                            {item.severidad}
                          </Badge>
                          <Badge variant="outline" className="text-[9px]">
                            <Clock className="h-2 w-2 mr-1" />
                            {item.diasPendiente}d
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-[#002C63] truncate mt-1">{item.titulo}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
                          <span className="truncate">{item.empresa?.nombre}</span>
                          <span>•</span>
                          <span className="truncate">{item.unidad?.nombre}</span>
                          {item.residente && (
                            <>
                              <span>•</span>
                              <span className="truncate">{item.residente.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Tab: Ranking */}
          <TabsContent value="ranking" className="mt-3 space-y-4">
            {/* Top 5 Empresas */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-red-500" />
                  Empresas con más problemas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {top5?.empresas?.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">Sin datos</p>
                ) : (
                  <div className="space-y-2">
                    {top5?.empresas?.map((empresa: any, i: number) => (
                      <div 
                        key={empresa.id} 
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100"
                        onClick={() => setLocation(`/empresas/${empresa.id}`)}
                      >
                        <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700'
                        }`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#002C63] truncate">{empresa.nombre}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="destructive" className="text-[9px]">{empresa.pendientes} pend</Badge>
                          {empresa.rechazados > 0 && (
                            <Badge variant="outline" className="text-[9px] text-red-500">{empresa.rechazados} rech</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top 5 Residentes */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-500" />
                  Residentes con más pendientes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {top5?.residentes?.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">Sin datos</p>
                ) : (
                  <div className="space-y-2">
                    {top5?.residentes?.map((residente: any, i: number) => (
                      <div 
                        key={residente.id} 
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100"
                        onClick={() => setLocation(`/usuarios/${residente.id}`)}
                      >
                        <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'
                        }`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#002C63] truncate">{residente.nombre}</p>
                          {residente.empresa && (
                            <p className="text-[10px] text-gray-500 truncate">{residente.empresa}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-[9px]">{residente.pendientes} pend</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top 5 Especialidades */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-yellow-500" />
                  Especialidades más problemáticas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {top5?.especialidades?.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">Sin datos</p>
                ) : (
                  <div className="space-y-2">
                    {top5?.especialidades?.map((esp: any, i: number) => (
                      <div 
                        key={esp.id} 
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100"
                        onClick={() => setLocation(`/especialidades/${esp.id}`)}
                      >
                        <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? 'bg-yellow-500 text-white' : 'bg-gray-300 text-gray-700'
                        }`}>
                          {i + 1}
                        </span>
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: esp.color || '#3B82F6' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#002C63] truncate">{esp.nombre}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-[9px]">{esp.pendientes} pend</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
