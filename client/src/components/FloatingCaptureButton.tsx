import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Crosshair } from "lucide-react";
import { useLocation } from "wouter";

export function FloatingCaptureButton() {
  const [, setLocation] = useLocation();

  return (
    <Button
      onClick={() => setLocation("/planos")}
      size="icon"
      className="fixed bottom-[5.5rem] right-4 h-10 w-10 rounded-full shadow-lg z-50 bg-[#002C63] hover:bg-[#001d42]"
      title="Captura por Plano"
    >
      <Crosshair className="h-[18px] w-[18px] text-white" />
    </Button>
  );
}
