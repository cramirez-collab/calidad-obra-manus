import { Button } from "@/components/ui/button";
import { Plus, MapPin, Crosshair } from "lucide-react";
import { useLocation } from "wouter";

/**
 * Floating action buttons stack (bottom-right):
 * 1. "+" verde → Nuevo ítem (/nuevo-item)
 * 2. "Pin" naranja → Planos para elegir nivel (/planos)
 * 3. "Crosshair" azul → Captura por plano (/planos)
 * 
 * Tamaño: 20% menos que original (40px → 32px), iconos (18px → 15px)
 * Todos en un solo flex container con gap-4 (16px) para separación clara
 * QR se posiciona debajo por separado en QRScanner.tsx
 */
export function FloatingCaptureButton() {
  const [, setLocation] = useLocation();

  return (
    <div className="fixed bottom-16 right-4 z-50 flex flex-col items-center gap-4">
      {/* Plus - Nuevo Ítem */}
      <Button
        onClick={() => setLocation("/nuevo-item")}
        size="icon"
        className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-full shadow-lg bg-[#02B381] hover:bg-[#029970] p-0 transition-transform active:scale-90"
        title="Nuevo Ítem"
      >
        <Plus className="h-[15px] w-[15px] text-white" strokeWidth={3} />
      </Button>

      {/* Pin - Ver Planos / Pins */}
      <Button
        onClick={() => setLocation("/planos")}
        size="icon"
        className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-full shadow-lg bg-[#E67E22] hover:bg-[#D35400] p-0 transition-transform active:scale-90"
        title="Ver Planos / Pins"
      >
        <MapPin className="h-[15px] w-[15px] text-white" />
      </Button>

      {/* Crosshair - Captura por plano */}
      <Button
        onClick={() => setLocation("/planos")}
        size="icon"
        className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-full shadow-lg bg-[#002C63] hover:bg-[#001d42] p-0 transition-transform active:scale-90"
        title="Captura por Plano"
      >
        <Crosshair className="h-[15px] w-[15px] text-white" />
      </Button>
    </div>
  );
}
