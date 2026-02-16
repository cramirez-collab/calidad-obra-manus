import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Crosshair } from "lucide-react";
import { useLocation } from "wouter";

/**
 * Floating action buttons stack (bottom-right):
 * 1. "+" → Captura rápida de nuevo ítem (/nuevo-item)
 * 2. "Pin" → Ir a Planos para elegir nivel y revisar pin (/planos)
 * 3. "Crosshair" → Captura por plano (ya existente, /planos)
 * 
 * Tamaño reducido 20% respecto al original (h-10 w-10 → h-8 w-8)
 * Iconos reducidos proporcionalmente (18px → 14px)
 */
export function FloatingCaptureButton() {
  const [, setLocation] = useLocation();

  // Tamaño unificado: 20% menos que el original (40px → 32px)
  const btnClass = "h-8 w-8 rounded-full shadow-lg z-50";
  const iconClass = "h-[14px] w-[14px] text-white";

  return (
    <>
      {/* Botón "+" - Captura rápida de nuevo ítem (más arriba) */}
      <Button
        onClick={() => setLocation("/nuevo-item")}
        size="icon"
        className={`fixed bottom-[8.5rem] right-4 ${btnClass} bg-[#02B381] hover:bg-[#029970]`}
        title="Nuevo Ítem"
      >
        <Plus className={iconClass} strokeWidth={3} />
      </Button>

      {/* Botón "Pin" - Ir a Planos para elegir nivel y revisar pins */}
      <Button
        onClick={() => setLocation("/planos")}
        size="icon"
        className={`fixed bottom-[6.5rem] right-4 ${btnClass} bg-[#E67E22] hover:bg-[#D35400]`}
        title="Ver Planos / Pins"
      >
        <MapPin className={iconClass} />
      </Button>

      {/* Botón "Crosshair" - Captura por plano (existente) */}
      <Button
        onClick={() => setLocation("/planos")}
        size="icon"
        className={`fixed bottom-[4.5rem] right-4 ${btnClass} bg-[#002C63] hover:bg-[#001d42]`}
        title="Captura por Plano"
      >
        <Crosshair className={iconClass} />
      </Button>
    </>
  );
}
