import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import {
  Building2,
  Wrench,
  User,
  Users,
  MapPin,
  Home,
  AlertTriangle,
  Layers,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";

// Colores para mejores (verde) y peores (rojo)
const COLORS_MEJORES = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'];
const COLORS_PEORES = ['#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2'];

// Componente de gráfica de barras horizontales
interface HorizontalBarChartProps {
  data: Array<{ nombre: string | null; score?: number; total?: number; tasaAprobacion?: number; tasaResolucion?: number }>;
  dataKey: string;
  colors: string[];
  title: string;
  icon: React.ReactNode;
  isBest: boolean;
  unit?: string;
}

function HorizontalBarChart({ data, dataKey, colors, title, icon, isBest, unit = '%' }: HorizontalBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {icon}
            <span className={isBest ? 'text-emerald-600' : 'text-red-600'}>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Sin datos disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  // Preparar datos para el gráfico
  const chartData = data.map((item, index) => ({
    name: (item.nombre || 'Sin nombre').length > 15 ? (item.nombre || 'Sin nombre').substring(0, 15) + '...' : (item.nombre || 'Sin nombre'),
    fullName: item.nombre || 'Sin nombre',
    value: item[dataKey as keyof typeof item] as number || 0,
    fill: colors[index % colors.length],
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          <span className={isBest ? 'text-emerald-600' : 'text-red-600'}>{title}</span>
          {isBest ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis 
              type="number" 
              domain={[0, 'auto']}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => `${value}${unit}`}
            />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={80} 
              tick={{ fontSize: 10 }}
              tickLine={false}
            />
            <Tooltip 
              formatter={(value: number) => [`${value}${unit}`, dataKey === 'total' ? 'Total' : 'Rendimiento']}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={25}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Componente principal de KPIs
export default function KPIsMejoresPeores() {
  const { selectedProjectId } = useProject();
  
  const { data: kpis, isLoading } = trpc.estadisticasAvanzadas.kpisMejoresPeores.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: true }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#02B381]" />
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No hay datos de KPIs disponibles
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Empresas */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[#002C63]" />
          Empresas
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <HorizontalBarChart
            data={kpis.empresas.mejores}
            dataKey="tasaAprobacion"
            colors={COLORS_MEJORES}
            title="Top 5 Mejores"
            icon={<Building2 className="h-4 w-4" />}
            isBest={true}
          />
          <HorizontalBarChart
            data={kpis.empresas.peores}
            dataKey="tasaAprobacion"
            colors={COLORS_PEORES}
            title="Top 5 Peores"
            icon={<Building2 className="h-4 w-4" />}
            isBest={false}
          />
        </div>
      </div>

      {/* Especialidades */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Wrench className="h-5 w-5 text-[#002C63]" />
          Especialidades
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <HorizontalBarChart
            data={kpis.especialidades.mejores}
            dataKey="tasaAprobacion"
            colors={COLORS_MEJORES}
            title="Top 5 Mejores"
            icon={<Wrench className="h-4 w-4" />}
            isBest={true}
          />
          <HorizontalBarChart
            data={kpis.especialidades.peores}
            dataKey="tasaAprobacion"
            colors={COLORS_PEORES}
            title="Top 5 Peores"
            icon={<Wrench className="h-4 w-4" />}
            isBest={false}
          />
        </div>
      </div>

      {/* Residentes */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <User className="h-5 w-5 text-[#002C63]" />
          Residentes
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <HorizontalBarChart
            data={kpis.residentes.mejores}
            dataKey="tasaAprobacion"
            colors={COLORS_MEJORES}
            title="Top 5 Mejores"
            icon={<User className="h-4 w-4" />}
            isBest={true}
          />
          <HorizontalBarChart
            data={kpis.residentes.peores}
            dataKey="tasaAprobacion"
            colors={COLORS_PEORES}
            title="Top 5 Peores"
            icon={<User className="h-4 w-4" />}
            isBest={false}
          />
        </div>
      </div>

      {/* Jefes de Residentes */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-[#002C63]" />
          Jefes de Residentes
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <HorizontalBarChart
            data={kpis.jefesResidentes.mejores}
            dataKey="tasaAprobacion"
            colors={COLORS_MEJORES}
            title="Top 5 Mejores"
            icon={<Users className="h-4 w-4" />}
            isBest={true}
          />
          <HorizontalBarChart
            data={kpis.jefesResidentes.peores}
            dataKey="tasaAprobacion"
            colors={COLORS_PEORES}
            title="Top 5 Peores"
            icon={<Users className="h-4 w-4" />}
            isBest={false}
          />
        </div>
      </div>

      {/* Unidades */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-[#002C63]" />
          Unidades
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <HorizontalBarChart
            data={kpis.unidades.mejores}
            dataKey="tasaAprobacion"
            colors={COLORS_MEJORES}
            title="Top 5 Mejores"
            icon={<MapPin className="h-4 w-4" />}
            isBest={true}
          />
          <HorizontalBarChart
            data={kpis.unidades.peores}
            dataKey="tasaAprobacion"
            colors={COLORS_PEORES}
            title="Top 5 Peores"
            icon={<MapPin className="h-4 w-4" />}
            isBest={false}
          />
        </div>
      </div>

      {/* Espacios */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Home className="h-5 w-5 text-[#002C63]" />
          Espacios
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <HorizontalBarChart
            data={kpis.espacios.mejores}
            dataKey="tasaAprobacion"
            colors={COLORS_MEJORES}
            title="Top 5 Mejores"
            icon={<Home className="h-4 w-4" />}
            isBest={true}
          />
          <HorizontalBarChart
            data={kpis.espacios.peores}
            dataKey="tasaAprobacion"
            colors={COLORS_PEORES}
            title="Top 5 Peores"
            icon={<Home className="h-4 w-4" />}
            isBest={false}
          />
        </div>
      </div>

      {/* Defectos */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-[#002C63]" />
          Defectos
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <HorizontalBarChart
            data={kpis.defectos.masFrecuentes}
            dataKey="total"
            colors={COLORS_PEORES}
            title="Top 5 Más Frecuentes"
            icon={<AlertTriangle className="h-4 w-4" />}
            isBest={false}
            unit=""
          />
          <HorizontalBarChart
            data={kpis.defectos.menosFrecuentes}
            dataKey="total"
            colors={COLORS_MEJORES}
            title="Top 5 Menos Frecuentes"
            icon={<AlertTriangle className="h-4 w-4" />}
            isBest={true}
            unit=""
          />
        </div>
      </div>

      {/* Niveles */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Layers className="h-5 w-5 text-[#002C63]" />
          Niveles
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <HorizontalBarChart
            data={kpis.niveles.mejores}
            dataKey="tasaAprobacion"
            colors={COLORS_MEJORES}
            title="Top 5 Mejores"
            icon={<Layers className="h-4 w-4" />}
            isBest={true}
          />
          <HorizontalBarChart
            data={kpis.niveles.peores}
            dataKey="tasaAprobacion"
            colors={COLORS_PEORES}
            title="Top 5 Peores"
            icon={<Layers className="h-4 w-4" />}
            isBest={false}
          />
        </div>
      </div>
    </div>
  );
}
