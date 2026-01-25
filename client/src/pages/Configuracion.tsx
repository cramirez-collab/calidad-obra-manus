import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  Settings, 
  Save, 
  Shield, 
  Clock, 
  Bell, 
  Palette,
  Building2,
  Lock,
  Info
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface ConfigItem {
  clave: string;
  valor: string | null;
  descripcion: string | null;
  soloSuperadmin: boolean;
  icon: React.ElementType;
  tipo: 'text' | 'number' | 'boolean';
}

const configDefaults: Omit<ConfigItem, 'valor' | 'descripcion'>[] = [
  { clave: 'nombre_empresa', icon: Building2, tipo: 'text', soloSuperadmin: false },
  { clave: 'dias_alerta_pendiente', icon: Clock, tipo: 'number', soloSuperadmin: false },
  { clave: 'notificaciones_email', icon: Bell, tipo: 'boolean', soloSuperadmin: false },
  { clave: 'tema_color', icon: Palette, tipo: 'text', soloSuperadmin: false },
  { clave: 'requiere_comentario_rechazo', icon: Shield, tipo: 'boolean', soloSuperadmin: false },
  { clave: 'max_items_por_pagina', icon: Settings, tipo: 'number', soloSuperadmin: true },
];

const configLabels: Record<string, string> = {
  nombre_empresa: 'Nombre de Empresa',
  dias_alerta_pendiente: 'Días para Alerta',
  notificaciones_email: 'Notificaciones Email',
  tema_color: 'Color del Tema',
  requiere_comentario_rechazo: 'Comentario al Rechazar',
  max_items_por_pagina: 'Ítems por Página',
};

const configDescriptions: Record<string, string> = {
  nombre_empresa: 'Nombre que aparece en reportes',
  dias_alerta_pendiente: 'Días antes de alertar ítems pendientes',
  notificaciones_email: 'Enviar notificaciones por correo',
  tema_color: 'Color principal de la interfaz',
  requiere_comentario_rechazo: 'Obligar comentario al rechazar',
  max_items_por_pagina: 'Cantidad máxima de ítems en listas',
};

export default function Configuracion() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';
  const { data: configData, isLoading, refetch } = trpc.configuracion.list.useQuery();
  const setConfigMutation = trpc.configuracion.set.useMutation({
    onSuccess: () => {
      toast.success("Configuración guardada");
      refetch();
    },
    onError: () => {
      toast.error("Error al guardar");
    }
  });

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (configData) {
      const newValues: Record<string, string> = {};
      configData.forEach(c => {
        newValues[c.clave] = c.valor || '';
      });
      setValues(newValues);
    }
  }, [configData]);

  const handleSave = (clave: string, soloSuperadmin: boolean) => {
    setConfigMutation.mutate({
      clave,
      valor: values[clave] || '',
      descripcion: configDescriptions[clave],
      soloSuperadmin,
    });
  };

  const handleToggle = (clave: string, soloSuperadmin: boolean) => {
    const newValue = values[clave] === 'true' ? 'false' : 'true';
    setValues(prev => ({ ...prev, [clave]: newValue }));
    setConfigMutation.mutate({
      clave,
      valor: newValue,
      descripcion: configDescriptions[clave],
      soloSuperadmin,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const visibleConfigs = configDefaults.filter(c => isSuperadmin || !c.soloSuperadmin);

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
        {/* Header compacto */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">Configuración</h1>
            <p className="text-xs text-muted-foreground">Ajustes del sistema</p>
          </div>
        </div>

        {/* Grid de configuraciones */}
        <div className="grid gap-3 sm:gap-4">
          {visibleConfigs.map(config => {
            const Icon = config.icon;
            const value = values[config.clave] || '';
            const isLocked = config.soloSuperadmin && !isSuperadmin;

            return (
              <Card key={config.clave} className={`transition-all ${isLocked ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Icono */}
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{configLabels[config.clave]}</span>
                        {config.soloSuperadmin && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>Solo Superadmin</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {configDescriptions[config.clave]}
                      </p>
                    </div>

                    {/* Control */}
                    <div className="flex items-center gap-2 shrink-0">
                      {config.tipo === 'boolean' ? (
                        <Switch
                          checked={value === 'true'}
                          onCheckedChange={() => handleToggle(config.clave, config.soloSuperadmin)}
                          disabled={isLocked}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type={config.tipo === 'number' ? 'number' : 'text'}
                            value={value}
                            onChange={(e) => setValues(prev => ({ ...prev, [config.clave]: e.target.value }))}
                            className="w-24 sm:w-32 h-9 text-sm"
                            disabled={isLocked}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSave(config.clave, config.soloSuperadmin)}
                            disabled={isLocked || setConfigMutation.isPending}
                            className="h-9 w-9"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/50 rounded-lg p-3">
          <Info className="h-4 w-4 shrink-0" />
          <span>Los cambios se aplican inmediatamente</span>
        </div>
      </div>
    </DashboardLayout>
  );
}
