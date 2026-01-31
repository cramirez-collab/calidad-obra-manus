import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ListOrdered, Loader2 } from "lucide-react";

export default function ListaEspecialidades() {
  const { data: especialidades, isLoading } = trpc.especialidades.list.useQuery();

  // Ordenar por número
  const especialidadesOrdenadas = especialidades
    ? [...especialidades].sort((a, b) => (a.numero || 999) - (b.numero || 999))
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-2xl">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <ListOrdered className="h-5 w-5 text-primary" />
            Lista de Especialidades
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Catálogo numerado de especialidades del proyecto
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {especialidadesOrdenadas.map((esp) => (
              <div
                key={esp.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                {/* Número en círculo */}
                <div 
                  className="flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: esp.color || '#6b7280' }}
                >
                  {esp.numero || '-'}
                </div>
                
                {/* Nombre */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{esp.nombre}</p>
                  {esp.codigo && (
                    <p className="text-xs text-muted-foreground">{esp.codigo}</p>
                  )}
                </div>
              </div>
            ))}

            {especialidadesOrdenadas.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay especialidades registradas
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
