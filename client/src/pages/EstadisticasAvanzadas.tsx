import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { 
  Users, 
  AlertTriangle,
  MessageSquare,
  Activity,
  QrCode,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  MapPin,
  Award
} from "lucide-react";
import { useState } from "react";
import { useProject } from "@/contexts/ProjectContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

export default function EstadisticasAvanzadas() {
  const { selectedProjectId } = useProject();
  const [selectedUsuario, setSelectedUsuario] = useState<string>("");
  const [selectedDefecto, setSelectedDefecto] = useState<string>("");

  // Datos base
  const { data: usuarios } = trpc.users.listForMentions.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined
  );
  const { data: defectos } = trpc.defectos.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );

  // Estadísticas
  const { data: rankingUsuarios, isLoading: loadingRanking } = trpc.estadisticas.rankingUsuarios.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : {}
  );
  
  const { data: estadsMensajeria, isLoading: loadingMensajeria } = trpc.estadisticas.mensajeria.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : {}
  );
  
  const { data: estadsSeguimiento, isLoading: loadingSeguimiento } = trpc.estadisticas.seguimiento.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId, dias: 30 } : {}
  );
  
  const { data: estadsQR, isLoading: loadingQR } = trpc.estadisticas.qrTrazabilidad.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : {}
  );

  const { data: estadsUsuario } = trpc.estadisticas.porUsuario.useQuery(
    { usuarioId: parseInt(selectedUsuario), proyectoId: selectedProjectId || undefined },
    { enabled: !!selectedUsuario }
  );

  const { data: estadsDefecto } = trpc.estadisticas.porDefecto.useQuery(
    { defectoId: parseInt(selectedDefecto), proyectoId: selectedProjectId || undefined },
    { enabled: !!selectedDefecto }
  );

  const roleLabels: Record<string, string> = {
    superadmin: "Super Admin",
    admin: "Admin",
    supervisor: "Supervisor",
    jefe_residente: "Jefe Residente",
    residente: "Residente",
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#002C63]">Estadísticas Avanzadas</h1>
          <p className="text-muted-foreground">
            Análisis completo por usuario, defecto, mensajería y seguimiento
          </p>
        </div>

        <Tabs defaultValue="usuarios" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-5">
            <TabsTrigger value="usuarios" className="gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="defectos" className="gap-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Defectos</span>
            </TabsTrigger>
            <TabsTrigger value="mensajeria" className="gap-1">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Mensajería</span>
            </TabsTrigger>
            <TabsTrigger value="seguimiento" className="gap-1">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Seguimiento</span>
            </TabsTrigger>
            <TabsTrigger value="qr" className="gap-1">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">QR</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Usuarios */}
          <TabsContent value="usuarios" className="space-y-4">
            {/* Ranking de rendimiento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-[#02B381]" />
                  Ranking de Rendimiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingRanking ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-[#02B381] border-t-transparent rounded-full" />
                  </div>
                ) : rankingUsuarios && rankingUsuarios.length > 0 ? (
                  <div className="space-y-2">
                    {rankingUsuarios.slice(0, 10).map((usuario, index) => (
                      <div 
                        key={usuario.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          index === 0 ? 'bg-yellow-50 border border-yellow-200' :
                          index === 1 ? 'bg-gray-50 border border-gray-200' :
                          index === 2 ? 'bg-orange-50 border border-orange-200' :
                          'bg-white border'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-500 text-white' :
                            index === 1 ? 'bg-gray-400 text-white' :
                            index === 2 ? 'bg-orange-500 text-white' :
                            'bg-gray-200 text-gray-600'
                          }`}>
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium">{usuario.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {roleLabels[usuario.role] || usuario.role}
                              {usuario.empresa && ` • ${usuario.empresa}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <p className="font-semibold text-green-600">{usuario.estadisticas.aprobados}</p>
                            <p className="text-[10px] text-muted-foreground">Aprobados</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-red-600">{usuario.estadisticas.rechazados}</p>
                            <p className="text-[10px] text-muted-foreground">Rechazados</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-blue-600">{usuario.estadisticas.tasaAprobacion}%</p>
                            <p className="text-[10px] text-muted-foreground">Tasa</p>
                          </div>
                          <Badge variant={usuario.scoreRendimiento > 0 ? "default" : "destructive"} className="min-w-[60px] justify-center">
                            {usuario.scoreRendimiento > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                            {usuario.scoreRendimiento}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No hay datos de rendimiento</p>
                )}
              </CardContent>
            </Card>

            {/* Detalle por usuario */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Detalle por Usuario
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedUsuario} onValueChange={setSelectedUsuario}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuarios?.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.name} ({roleLabels[u.role] || u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {estadsUsuario && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-blue-50">
                      <CardContent className="pt-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-blue-600">{estadsUsuario.estadisticas.total}</p>
                        <p className="text-xs text-muted-foreground">Total Ítems</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50">
                      <CardContent className="pt-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-green-600">{estadsUsuario.estadisticas.aprobados}</p>
                        <p className="text-xs text-muted-foreground">Aprobados</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50">
                      <CardContent className="pt-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-red-600">{estadsUsuario.estadisticas.rechazados}</p>
                        <p className="text-xs text-muted-foreground">Rechazados</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50">
                      <CardContent className="pt-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-purple-600">{estadsUsuario.estadisticas.tiempoPromedioResolucion}d</p>
                        <p className="text-xs text-muted-foreground">Tiempo Promedio</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {estadsUsuario?.defectosFrecuentes && estadsUsuario.defectosFrecuentes.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Defectos Frecuentes</h4>
                    <div className="flex flex-wrap gap-2">
                      {estadsUsuario.defectosFrecuentes.map((d: { defecto?: { id?: number; nombre?: string }; count: number }) => (
                        <Badge key={d.defecto?.id} variant="outline">
                          {d.defecto?.nombre} ({d.count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Defectos */}
          <TabsContent value="defectos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Análisis por Tipo de Defecto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedDefecto} onValueChange={setSelectedDefecto}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar defecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {defectos?.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${
                            d.severidad === 'leve' ? 'bg-green-500' :
                            d.severidad === 'moderado' ? 'bg-yellow-500' :
                            d.severidad === 'grave' ? 'bg-orange-500' : 'bg-red-500'
                          }`} />
                          {d.nombre}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {estadsDefecto && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="bg-blue-50">
                        <CardContent className="pt-4 text-center">
                          <p className="text-xl sm:text-2xl font-bold text-blue-600">{estadsDefecto.estadisticas.total}</p>
                          <p className="text-xs text-muted-foreground">Ocurrencias</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-yellow-50">
                        <CardContent className="pt-4 text-center">
                          <p className="text-xl sm:text-2xl font-bold text-yellow-600">{estadsDefecto.estadisticas.pendientes}</p>
                          <p className="text-xs text-muted-foreground">Pendientes</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-green-50">
                        <CardContent className="pt-4 text-center">
                          <p className="text-xl sm:text-2xl font-bold text-green-600">{estadsDefecto.estadisticas.tasaAprobacion}%</p>
                          <p className="text-xs text-muted-foreground">Tasa Corrección</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-purple-50">
                        <CardContent className="pt-4 text-center">
                          <p className="text-xl sm:text-2xl font-bold text-purple-600">{estadsDefecto.estadisticas.tiempoPromedioCorreccion}d</p>
                          <p className="text-xs text-muted-foreground">Tiempo Corrección</p>
                        </CardContent>
                      </Card>
                    </div>

                    {estadsDefecto.empresasAfectadas && estadsDefecto.empresasAfectadas.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Empresas Más Afectadas
                        </h4>
                        <div className="space-y-2">
                          {estadsDefecto.empresasAfectadas.map((e: any) => (
                            <div key={e.empresa?.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span>{e.empresa?.nombre}</span>
                              <Badge variant="outline">{e.count} casos</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {estadsDefecto.unidadesAfectadas && estadsDefecto.unidadesAfectadas.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Unidades Más Afectadas
                        </h4>
                        <div className="space-y-2">
                          {estadsDefecto.unidadesAfectadas.map((u: any) => (
                            <div key={u.unidad?.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span>{u.unidad?.nombre}</span>
                              <Badge variant="outline">{u.count} casos</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Mensajería */}
          <TabsContent value="mensajeria" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-blue-50">
                <CardContent className="pt-6 text-center">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600">{estadsMensajeria?.totalMensajes || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Mensajes</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50">
                <CardContent className="pt-6 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl sm:text-3xl font-bold text-green-600">{estadsMensajeria?.usuariosActivos?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Usuarios Activos</p>
                </CardContent>
              </Card>
              <Card className="bg-purple-50">
                <CardContent className="pt-6 text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <p className="text-2xl sm:text-3xl font-bold text-purple-600">{estadsMensajeria?.itemsConMasMensajes?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Ítems con Actividad</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Usuarios Más Activos</CardTitle>
                </CardHeader>
                <CardContent>
                  {estadsMensajeria?.usuariosActivos && estadsMensajeria.usuariosActivos.length > 0 ? (
                    <div className="space-y-2">
                      {estadsMensajeria.usuariosActivos.slice(0, 5).map((u: any, i: number) => (
                        <div key={u.usuario?.id || i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{u.usuario?.name}</span>
                          <Badge>{u.mensajes} msgs</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">Sin datos</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Usuarios Más Mencionados</CardTitle>
                </CardHeader>
                <CardContent>
                  {estadsMensajeria?.usuariosMasMencionados && estadsMensajeria.usuariosMasMencionados.length > 0 ? (
                    <div className="space-y-2">
                      {estadsMensajeria.usuariosMasMencionados.slice(0, 5).map((u: any, i: number) => (
                        <div key={u.usuario?.id || i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{u.usuario?.name}</span>
                          <Badge variant="outline">@{u.menciones}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">Sin datos</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Seguimiento */}
          <TabsContent value="seguimiento" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-blue-50">
                <CardContent className="pt-6 text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600">{estadsSeguimiento?.totalAcciones || 0}</p>
                  <p className="text-sm text-muted-foreground">Acciones (últimos 30 días)</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50">
                <CardContent className="pt-6 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl sm:text-3xl font-bold text-green-600">{estadsSeguimiento?.usuariosMasActivos?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Usuarios Activos</p>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de actividad por día */}
            {estadsSeguimiento?.actividadPorDia && estadsSeguimiento.actividadPorDia.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Actividad por Día</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={estadsSeguimiento.actividadPorDia}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="fecha" 
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getDate()}/${date.getMonth() + 1}`;
                          }}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#02B381" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Usuarios más activos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Usuarios Más Activos (Bitácora)</CardTitle>
              </CardHeader>
              <CardContent>
                {estadsSeguimiento?.usuariosMasActivos && estadsSeguimiento.usuariosMasActivos.length > 0 ? (
                  <div className="space-y-2">
                    {estadsSeguimiento.usuariosMasActivos.slice(0, 10).map((u: any, i: number) => (
                      <div key={u.usuario?.id || i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{u.usuario?.name}</span>
                        <Badge>{u.acciones} acciones</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">Sin datos de actividad</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: QR */}
          <TabsContent value="qr" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-blue-50">
                <CardContent className="pt-6 text-center">
                  <QrCode className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600">{estadsQR?.totalItems || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Ítems</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50">
                <CardContent className="pt-6 text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl sm:text-3xl font-bold text-green-600">{estadsQR?.itemsConCodigo || 0}</p>
                  <p className="text-sm text-muted-foreground">Con Código QR</p>
                </CardContent>
              </Card>
            </div>

            {/* Distribución por unidad */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Distribución por Unidad (Stacking)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {estadsQR?.distribucionUnidades && estadsQR.distribucionUnidades.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {estadsQR.distribucionUnidades.map((u: any) => (
                      <div key={u.unidad?.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">{u.unidad?.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            Nivel {u.unidad?.nivel || '-'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-50">{u.items} total</Badge>
                          <Badge variant="outline" className="bg-yellow-50">{u.pendientes} pend</Badge>
                          <Badge variant="outline" className="bg-green-50">{u.aprobados} ok</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">Sin datos de distribución</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
