import React from 'react';
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Clock, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  MapPin,
  BarChart3,
  Plus,
  Loader2
} from "lucide-react";
import { useLocation, Redirect } from "wouter";
import { formatDate } from "@/lib/dateFormat";
import { useProject } from "@/contexts/ProjectContext";
import { CalendarDays } from "lucide-react";

// Frases motivadoras relacionadas con construcción y calidad
const frasesMotivadoras = [
  "La calidad no es un acto, es un hábito. - Aristóteles",
  "Construir con calidad es construir con orgullo.",
  "Cada detalle cuenta en la excelencia.",
  "La precisión de hoy es la seguridad del mañana.",
  "Un trabajo bien hecho habla por sí mismo.",
  "La calidad nunca es un accidente, es el resultado de un esfuerzo inteligente.",
  "Mide dos veces, corta una vez.",
  "La excelencia es hacer lo ordinario de manera extraordinaria.",
  "Cada ladrillo bien puesto es un paso hacia el éxito.",
  "La calidad es la mejor estrategia de negocio.",
  "Construimos sueños con cimientos de calidad.",
  "El profesionalismo se demuestra en los detalles.",
  "La perfección no es alcanzable, pero si la perseguimos, podemos alcanzar la excelencia.",
  "Un buen trabajo de hoy evita problemas mañana.",
  "La calidad es responsabilidad de todos."
];

// Fecha de término de la obra
const FECHA_TERMINO = new Date('2027-01-17');

function getDiasFaltantes(): number {
  const hoy = new Date();
  const diffTime = FECHA_TERMINO.getTime() - hoy.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function getFraseDelDia(): string {
  const hoy = new Date();
  const diaDelAnio = Math.floor((hoy.getTime() - new Date(hoy.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  return frasesMotivadoras[diaDelAnio % frasesMotivadoras.length];
}

function getFechaFormateada(): string {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default function Bienvenida() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedProjectId, isLoadingProjects } = useProject();
  const { data: pendientes, isLoading } = trpc.pendientes.misPendientes.useQuery();

  // Redirigir a selección de proyecto si no hay proyecto seleccionado
  if (!isLoadingProjects && !selectedProjectId) {
    return <Redirect to="/seleccionar-proyecto" />;
  }

  // Mostrar loading mientras carga proyectos
  if (isLoadingProjects) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#02B381]" />
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pendiente_foto_despues":
        return { icon: Camera, color: "text-[#002C63]", bg: "bg-[#002C63]/10", label: "Foto" };
      case "pendiente_aprobacion":
        return { icon: Clock, color: "text-[#002C63]", bg: "bg-[#002C63]/10", label: "Aprobar" };
      case "rechazado":
        return { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", label: "Corregir" };
      default:
        return { icon: CheckCircle2, color: "text-[#02B381]", bg: "bg-[#02B381]/10", label: "OK" };
    }
  };

  // Solo dos acciones: Nuevo y Stats
  const quickActions = [
    { icon: Plus, label: "Nuevo", path: "/nuevo-item", color: "bg-[#02B381]", roles: ['superadmin', 'admin', 'residente', 'jefe_residente'] },
    { icon: BarChart3, label: "Stats", path: "/estadisticas", color: "bg-[#002C63]", roles: ['superadmin', 'admin', 'supervisor'] },
  ];

  const visibleActions = quickActions.filter(a => 
    a.roles.includes('all') || a.roles.includes(user?.role || '')
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header con iconos de acceso rápido a la derecha */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-semibold text-[#002C63]">
              Hola, {user?.name?.split(' ')[0] || 'Usuario'}
            </h1>
            <p className="text-xs text-[#02B381] italic mt-0.5">
              "{getFraseDelDia()}"
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-[#6E6E6E]">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {getFechaFormateada()}
              </span>
              <span className="font-semibold text-[#002C63]">
                {getDiasFaltantes()} días para entrega
              </span>
              <span>| {pendientes?.length || 0} pendientes</span>
            </div>
          </div>
          {/* Iconos de acceso rápido - siempre visibles arriba */}
          <div className="flex gap-2">
            {visibleActions.map(action => (
              <Tooltip key={action.path}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className={`h-10 w-10 ${action.color} hover:opacity-90 shadow-md`}
                    onClick={() => setLocation(action.path)}
                  >
                    <action.icon className="h-5 w-5 text-white" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{action.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Lista de pendientes - compacta */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#02B381]" />
          </div>
        ) : pendientes && pendientes.length > 0 ? (
          <div className="space-y-2">
            {pendientes.map((item: any) => {
              const config = getStatusConfig(item.status);
              const Icon = config.icon;
              return (
                <Card 
                  key={item.id}
                  className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99] border-0 shadow-sm"
                  onClick={() => setLocation(`/items/${item.id}`)}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      {/* Miniaturas de fotos A/B */}
                      <div className="flex gap-1 shrink-0">
                        {/* Foto A - Antes */}
                        <div className="relative">
                          {item.fotoAntes ? (
                            <img 
                              src={item.fotoAntes} 
                              alt="Antes" 
                              className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover border-2 border-amber-400"
                            />
                          ) : (
                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                              <Camera className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          <span className="absolute -top-1 -left-1 bg-amber-400 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">A</span>
                        </div>
                        {/* Foto B - Después */}
                        <div className="relative">
                          {item.fotoDespues ? (
                            <img 
                              src={item.fotoDespues} 
                              alt="Después" 
                              className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover border-2 border-[#02B381]"
                            />
                          ) : (
                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                              <Clock className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          <span className="absolute -top-1 -left-1 bg-[#02B381] text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">B</span>
                        </div>
                      </div>

                      {/* Icono de estado */}
                      <div className={`h-8 w-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#002C63]">
                            {item.codigo}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                        <p className="text-sm truncate mt-0.5 text-[#2E2E2E]">{item.titulo}</p>
                        <div className="flex items-center gap-2 text-xs text-[#6E6E6E] mt-1">
                          {item.ubicacion && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{item.ubicacion}</span>
                            </span>
                          )}
                          <span className="shrink-0">{formatDate(item.fechaCreacion)}</span>
                        </div>
                      </div>

                      {/* Flecha */}
                      <ArrowRight className="h-5 w-5 text-[#6E6E6E] shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-[#02B381]/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-[#02B381]" />
              </div>
              <p className="font-semibold text-[#002C63]">¡Todo al día!</p>
              <p className="text-sm text-[#6E6E6E]">Sin pendientes</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
