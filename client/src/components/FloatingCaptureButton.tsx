import { Button } from "@/components/ui/button";
import { Plus, MapPin, Crosshair } from "lucide-react";
import { useLocation } from "wouter";

/**
 * Floating action buttons stack (bottom-right):
 * 1. "+" → Captura rápida de nuevo ítem (/nuevo-item)
 * 2. "Pin" → Ir a Planos para elegir nivel y revisar pin (/planos)
 * 3. "Crosshair" → Captura por plano (/planos)
 * 
 * Tamaño al 60% del original (40px → 24px), iconos (18px → 11px)
 * Separación vertical: 8px gap entre cada botón
 */
export function FloatingCaptureButton() {
  const [, setLocation] = useLocation();

  return (
    <div className="fixed bottom-14 right-3 z-50 flex flex-col-reverse items-center gap-2">
      {/* Crosshair - Captura por plano */}
      <Button
        onClick={() => setLocation("/planos")}
        size="icon"
        className="h-6 w-6 min-h-0 min-w-0 rounded-full shadow-md bg-[#002C63] hover:bg-[#001d42] p-0"
        title="Captura por Plano"
      >
        <Crosshair className="h-[11px] w-[11px] text-white" />
      </Button>

      {/* Pin - Ver Planos / Pins */}
      <Button
        onClick={() => setLocation("/planos")}
        size="icon"
        className="h-6 w-6 min-h-0 min-w-0 rounded-full shadow-md bg-[#E67E22] hover:bg-[#D35400] p-0"
        title="Ver Planos / Pins"
      >
        <MapPin className="h-[11px] w-[11px] text-white" />
      </Button>

      {/* Plus - Nuevo Ítem */}
      <Button
        onClick={() => setLocation("/nuevo-item")}
        size="icon"
        className="h-6 w-6 min-h-0 min-w-0 rounded-full shadow-md bg-[#02B381] hover:bg-[#029970] p-0"
        title="Nuevo Ítem"
      >
        <Plus className="h-[11px] w-[11px] text-white" strokeWidth={3} />
      </Button>
    </div>
  );
}
