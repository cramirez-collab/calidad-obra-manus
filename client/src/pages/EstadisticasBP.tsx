import { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  ArrowLeft,
  ShieldCheck,
  BarChart3,
  Building2,
  Users,
  Award,
  Trophy,
  Star,
  Sparkles,
  TrendingUp,
  FileText,
  Download,
  Loader2,
  Crown,
  Medal,
  Target,
  Zap,
  CheckCircle2,
  Clock,
  Eye,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Categorías de buenas prácticas (mismo que BuenasPracticas.tsx)
const CATEGORIAS_MAP: Record<string, { label: string; color: string; bgChart: string }> = {
  epp: { label: "EPP", color: "text-blue-700", bgChart: "#3B82F6" },
  orden_limpieza: { label: "Orden y Limpieza", color: "text-emerald-700", bgChart: "#10B981" },
  señalizacion: { label: "Señalización", color: "text-amber-700", bgChart: "#F59E0B" },
  procedimiento: { label: "Procedimiento", color: "text-purple-700", bgChart: "#8B5CF6" },
  capacitacion: { label: "Capacitación", color: "text-indigo-700", bgChart: "#6366F1" },
  innovacion: { label: "Innovación", color: "text-yellow-700", bgChart: "#EAB308" },
  mejora_continua: { label: "Mejora Continua", color: "text-teal-700", bgChart: "#14B8A6" },
  proteccion_colectiva: { label: "Protección Colectiva", color: "text-rose-700", bgChart: "#F43F5E" },
  otro: { label: "Otro", color: "text-gray-700", bgChart: "#6B7280" },
};

const BADGE_CONFIG: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  "Experto BP": { icon: Crown, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  "Veterano BP": { icon: Trophy, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  "Contribuidor BP": { icon: Medal, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  "Iniciador BP": { icon: Star, color: "text-green-600", bg: "bg-green-50 border-green-200" },
  "Implementador Estrella": { icon: Zap, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  "Implementador": { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  "Multidisciplinario": { icon: Sparkles, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  "100% Efectividad": { icon: Target, color: "text-rose-600", bg: "bg-rose-50 border-rose-200" },
};

type TabView = "categorias" | "empresas" | "usuarios" | "insignias";

export default function EstadisticasBP() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, userProjects } = useProject();
  const [activeTab, setActiveTab] = useState<TabView>("categorias");
  const reportRef = useRef<HTMLDivElement>(null);

  const proyectoActual = userProjects?.find((p: any) => p.id === selectedProjectId);

  const statsDetalladas = trpc.buenasPracticas.statsDetalladas.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  const bpStats = trpc.buenasPracticas.stats.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );

  const data = statsDetalladas.data;
  const isLoading = statsDetalladas.isLoading || bpStats.isLoading;

  // PDF generation
  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * usableWidth) / canvas.width;
      
      // Header
      pdf.setFillColor(0, 44, 99); // #002C63
      pdf.rect(0, 0, pageWidth, 25, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("ObjetivaQC - Estadisticas Buenas Practicas", margin, 12);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Proyecto: ${removeAccents(proyectoActual?.nombre || "Proyecto")} | Fecha: ${format(new Date(), "dd-MM-yyyy")}`, margin, 20);
      
      let yPos = 30;
      
      if (imgHeight + yPos <= pageHeight - margin) {
        pdf.addImage(imgData, "PNG", margin, yPos, usableWidth, imgHeight);
      } else {
        // Multi-page
        let remainingHeight = imgHeight;
        let sourceY = 0;
        let firstPage = true;
        
        while (remainingHeight > 0) {
          if (!firstPage) {
            pdf.addPage();
            yPos = margin;
          }
          const availableHeight = (firstPage ? pageHeight - yPos - margin : pageHeight - margin * 2);
          const sliceHeight = Math.min(remainingHeight, availableHeight);
          const sourceSliceHeight = (sliceHeight / imgHeight) * canvas.height;
          
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sourceSliceHeight;
          const ctx = sliceCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceSliceHeight, 0, 0, canvas.width, sourceSliceHeight);
            const sliceData = sliceCanvas.toDataURL("image/png");
            pdf.addImage(sliceData, "PNG", margin, yPos, usableWidth, sliceHeight);
          }
          
          sourceY += sourceSliceHeight;
          remainingHeight -= sliceHeight;
          firstPage = false;
        }
      }
      
      pdf.save(`Estadisticas_BP_${removeAccents(proyectoActual?.nombre || "Proyecto")}_${format(new Date(), "dd-MM-yyyy")}.pdf`);
    } catch (err) {
      console.error("Error generando PDF:", err);
    }
  };

  if (!selectedProjectId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Selecciona un proyecto primero</p>
        </div>
      </DashboardLayout>
    );
  }

  const tabs: { key: TabView; label: string; icon: LucideIcon }[] = [
    { key: "categorias", label: "Categorías", icon: BarChart3 },
    { key: "empresas", label: "Empresas", icon: Building2 },
    { key: "usuarios", label: "Usuarios", icon: Users },
    { key: "insignias", label: "Insignias", icon: Award },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-3 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setLocation("/buenas-practicas")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold tracking-tight">Estadísticas BP</h1>
            <p className="text-xs text-muted-foreground truncate">{proyectoActual?.nombre || "Proyecto"}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleExportPDF}
                variant="outline"
                className="gap-1.5 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                disabled={isLoading}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Descargar reporte en PDF</TooltipContent>
          </Tooltip>
        </div>

        {/* KPIs resumen */}
        {bpStats.data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            <MiniKPI label="Total BP" value={Number(bpStats.data.total) || 0} icon={FileText} color="text-slate-600" />
            <MiniKPI label="Implementadas" value={Number(bpStats.data.implementadas) || 0} icon={CheckCircle2} color="text-emerald-600" />
            <MiniKPI label="Activas" value={Number(bpStats.data.activas) || 0} icon={Clock} color="text-blue-600" />
            <MiniKPI label="Empresas" value={Number(bpStats.data.empresasInvolucradas) || 0} icon={Building2} color="text-purple-600" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div ref={reportRef} className="space-y-4">
            {activeTab === "categorias" && <CategoriaView data={data} />}
            {activeTab === "empresas" && <EmpresaView data={data} />}
            {activeTab === "usuarios" && <UsuarioView data={data} />}
            {activeTab === "insignias" && <InsigniasView data={data} />}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ========== Sub-components ==========

function MiniKPI({ label, value, icon: Icon, color }: { label: string; value: number; icon: LucideIcon; color: string }) {
  return (
    <Card className="p-3 flex items-center gap-2.5">
      <div className={`h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      </div>
    </Card>
  );
}

// ========== CATEGORÍAS ==========
function CategoriaView({ data }: { data: any }) {
  if (!data?.porCategoria?.length) {
    return <EmptyStats message="No hay datos de categorías aún" />;
  }

  const maxTotal = Math.max(...data.porCategoria.map((c: any) => Number(c.total) || 0), 1);

  return (
    <div className="space-y-4">
      <SectionTitle icon={BarChart3} title="BP por Categoría" subtitle="Distribución de buenas prácticas registradas" />
      
      {/* Bar chart visual */}
      <Card className="p-4">
        <div className="space-y-3">
          {data.porCategoria.map((cat: any) => {
            const catInfo = CATEGORIAS_MAP[cat.categoria] || { label: cat.categoria, bgChart: "#6B7280" };
            const total = Number(cat.total) || 0;
            const impl = Number(cat.implementadas) || 0;
            const pct = Math.round((total / maxTotal) * 100);
            return (
              <div key={cat.categoria} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate">{catInfo.label}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <span className="font-semibold text-foreground">{total}</span>
                    <span>({impl} impl.)</span>
                  </div>
                </div>
                <div className="h-6 bg-muted/40 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: catInfo.bgChart }}
                  >
                    {pct > 15 && <span className="text-[10px] font-bold text-white">{pct}%</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Desglose tabla */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="text-left p-3 font-semibold">Categoría</th>
                <th className="text-center p-3 font-semibold">Total</th>
                <th className="text-center p-3 font-semibold">Activas</th>
                <th className="text-center p-3 font-semibold">Implementadas</th>
                <th className="text-center p-3 font-semibold">% Impl.</th>
              </tr>
            </thead>
            <tbody>
              {data.porCategoria.map((cat: any) => {
                const catInfo = CATEGORIAS_MAP[cat.categoria] || { label: cat.categoria };
                const total = Number(cat.total) || 0;
                const impl = Number(cat.implementadas) || 0;
                const pctImpl = total > 0 ? Math.round((impl / total) * 100) : 0;
                return (
                  <tr key={cat.categoria} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-medium">{catInfo.label}</td>
                    <td className="p-3 text-center font-bold">{total}</td>
                    <td className="p-3 text-center text-blue-600">{Number(cat.activas) || 0}</td>
                    <td className="p-3 text-center text-emerald-600">{impl}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={pctImpl >= 70 ? "border-emerald-300 text-emerald-700 bg-emerald-50" : pctImpl >= 40 ? "border-amber-300 text-amber-700 bg-amber-50" : "border-red-300 text-red-700 bg-red-50"}>
                        {pctImpl}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ========== EMPRESAS ==========
function EmpresaView({ data }: { data: any }) {
  if (!data?.porEmpresa?.length) {
    return <EmptyStats message="No hay datos de empresas aún. Vincula empresas a las BP al crearlas." />;
  }

  const maxTotal = Math.max(...data.porEmpresa.map((e: any) => Number(e.total) || 0), 1);

  return (
    <div className="space-y-4">
      <SectionTitle icon={Building2} title="BP por Empresa" subtitle="Participación de cada empresa en buenas prácticas" />

      {/* Ranking cards */}
      <div className="space-y-2">
        {data.porEmpresa.map((emp: any, idx: number) => {
          const total = Number(emp.total) || 0;
          const impl = Number(emp.implementadas) || 0;
          const pct = Math.round((total / maxTotal) * 100);
          const pctImpl = total > 0 ? Math.round((impl / total) * 100) : 0;
          const isTop3 = idx < 3;
          const rankColors = ["text-amber-500", "text-slate-400", "text-orange-400"];
          
          return (
            <Card key={emp.empresaId} className={`p-3 transition-all ${isTop3 ? "border-l-4" : ""}`} style={isTop3 ? { borderLeftColor: idx === 0 ? "#F59E0B" : idx === 1 ? "#94A3B8" : "#FB923C" } : {}}>
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isTop3 ? `${rankColors[idx]} bg-muted/50` : "text-muted-foreground bg-muted/30"}`}>
                  {isTop3 ? <Trophy className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm truncate">{emp.empresa || "Sin empresa"}</span>
                    <span className="text-sm font-bold shrink-0 ml-2">{total} BP</span>
                  </div>
                  <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>{impl} implementadas</span>
                    <span>{Number(emp.activas) || 0} activas</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{pctImpl}% efectividad</Badge>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ========== USUARIOS ==========
function UsuarioView({ data }: { data: any }) {
  if (!data?.porUsuario?.length) {
    return <EmptyStats message="No hay datos de usuarios aún" />;
  }

  const maxTotal = Math.max(...data.porUsuario.map((u: any) => Number(u.total) || 0), 1);

  return (
    <div className="space-y-4">
      <SectionTitle icon={Users} title="BP por Usuario" subtitle="Ranking de participación individual en buenas prácticas" />

      <div className="space-y-2">
        {data.porUsuario.map((usr: any, idx: number) => {
          const total = Number(usr.total) || 0;
          const impl = Number(usr.implementadas) || 0;
          const pct = Math.round((total / maxTotal) * 100);
          const isTop3 = idx < 3;
          const badges = data.badges?.find((b: any) => b.userId === usr.userId)?.insignias || [];

          return (
            <Card key={usr.userId || idx} className={`p-3 transition-all ${isTop3 ? "ring-1 ring-emerald-200" : ""}`}>
              <div className="flex items-center gap-3">
                {/* Avatar / Rank */}
                <div className="relative shrink-0">
                  {usr.fotoUrl ? (
                    <img src={usr.fotoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                      {(usr.nombre || "?")[0]?.toUpperCase()}
                    </div>
                  )}
                  {isTop3 && (
                    <div className={`absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : "bg-orange-400"}`}>
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm truncate">{usr.nombre || "Usuario"}</span>
                    <span className="text-sm font-bold shrink-0 ml-2">{total}</span>
                  </div>
                  <div className="h-2 bg-muted/40 rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">{impl} impl. · {Number(usr.activas) || 0} act.</span>
                    {badges.slice(0, 3).map((b: string) => {
                      const cfg = BADGE_CONFIG[b] || { icon: Star, color: "text-gray-500", bg: "bg-gray-50 border-gray-200" };
                      const BIcon = cfg.icon;
                      return (
                        <Tooltip key={b}>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${cfg.bg} ${cfg.color}`}>
                              <BIcon className="h-2.5 w-2.5" />
                              {b}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{b}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ========== INSIGNIAS ==========
function InsigniasView({ data }: { data: any }) {
  if (!data?.badges?.length) {
    return <EmptyStats message="No hay insignias otorgadas aún. Se asignan automáticamente según la participación." />;
  }

  const badgesWithAny = data.badges.filter((b: any) => b.insignias?.length > 0);

  // Group by badge type
  const badgeGroups: Record<string, any[]> = {};
  for (const user of data.badges) {
    for (const badge of user.insignias) {
      if (!badgeGroups[badge]) badgeGroups[badge] = [];
      badgeGroups[badge].push(user);
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle icon={Award} title="Insignias y Reconocimientos" subtitle="Se otorgan automáticamente según participación y efectividad" />

      {/* Badge legend */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Criterios de Insignias</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(BADGE_CONFIG).map(([name, cfg]) => {
            const BIcon = cfg.icon;
            const criterio = getBadgeCriteria(name);
            return (
              <div key={name} className={`flex items-center gap-2 p-2 rounded-lg border ${cfg.bg}`}>
                <BIcon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${cfg.color}`}>{name}</p>
                  <p className="text-[10px] text-muted-foreground">{criterio}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Users with badges */}
      {badgesWithAny.length === 0 ? (
        <EmptyStats message="Aún no hay usuarios con insignias. Se necesita más participación." />
      ) : (
        <div className="space-y-2">
          {badgesWithAny.sort((a: any, b: any) => b.insignias.length - a.insignias.length).map((user: any) => (
            <Card key={user.userId} className="p-4">
              <div className="flex items-start gap-3">
                {user.fotoUrl ? (
                  <img src={user.fotoUrl} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {(user.nombre || "?")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">{user.nombre || "Usuario"}</h4>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 mb-2">
                    <span>{user.total} BP totales</span>
                    <span>{user.implementadas} implementadas</span>
                    <span>{user.tasaImplementacion}% efectividad</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {user.insignias.map((badge: string) => {
                      const cfg = BADGE_CONFIG[badge] || { icon: Star, color: "text-gray-500", bg: "bg-gray-50 border-gray-200" };
                      const BIcon = cfg.icon;
                      return (
                        <span key={badge} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${cfg.bg} ${cfg.color}`}>
                          <BIcon className="h-3 w-3" />
                          {badge}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Badge distribution */}
      {Object.keys(badgeGroups).length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Distribución de Insignias</h3>
          <div className="space-y-2">
            {Object.entries(badgeGroups).sort(([, a], [, b]) => b.length - a.length).map(([badge, users]) => {
              const cfg = BADGE_CONFIG[badge] || { icon: Star, color: "text-gray-500", bg: "bg-gray-50" };
              const BIcon = cfg.icon;
              return (
                <div key={badge} className="flex items-center gap-2">
                  <BIcon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                  <span className="text-xs font-medium flex-1 truncate">{badge}</span>
                  <div className="flex items-center gap-1">
                    <div className="h-2 bg-muted/40 rounded-full w-20 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.round((users.length / data.badges.length) * 100)}%`, backgroundColor: cfg.bg.includes("amber") ? "#F59E0B" : cfg.bg.includes("purple") ? "#8B5CF6" : "#10B981" }} />
                    </div>
                    <span className="text-xs font-bold w-6 text-right">{users.length}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ========== Helpers ==========

function SectionTitle({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon className="h-5 w-5 text-emerald-600 shrink-0" />
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyStats({ message }: { message: string }) {
  return (
    <Card className="p-8 text-center">
      <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </Card>
  );
}

function getBadgeCriteria(name: string): string {
  const map: Record<string, string> = {
    "Experto BP": "20+ buenas prácticas registradas",
    "Veterano BP": "10+ buenas prácticas registradas",
    "Contribuidor BP": "5+ buenas prácticas registradas",
    "Iniciador BP": "Primera buena práctica registrada",
    "Implementador Estrella": "10+ BP implementadas",
    "Implementador": "5+ BP implementadas",
    "Multidisciplinario": "5+ categorías distintas",
    "100% Efectividad": "Todas sus BP fueron implementadas (mín. 3)",
  };
  return map[name] || "";
}

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
