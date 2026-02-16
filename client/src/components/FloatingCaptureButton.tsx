import { useState, useRef, useEffect, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, MapPin, Crosshair, QrCode, Camera, Search, Keyboard, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type ScannerStatus = "idle" | "checking" | "ready" | "scanning" | "error" | "manual";

/**
 * Unified floating action buttons (bottom-right).
 * ALL 4 buttons in ONE flex container to prevent overlap.
 * Size: 20% smaller than original (40px → 32px), icons 15px.
 * Gap: 12px between each button (gap-3).
 */
export function FloatingCaptureButton() {
  const [, setLocation] = useLocation();

  // QR Scanner state
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [manualCode, setManualCode] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const navigateToItem = useCallback((result: string) => {
    let codigo = result.trim();
    if (codigo.includes('/seguimiento/')) {
      codigo = codigo.split('/seguimiento/').pop() || codigo;
    } else if (codigo.includes('/items/')) {
      codigo = codigo.split('/items/').pop() || codigo;
    }
    codigo = codigo.split('?')[0].split('#')[0];
    toast.success(`Navegando a: ${codigo}`);
    if (/^\d+$/.test(codigo)) {
      setLocation(`/items/${codigo}`);
    } else {
      setLocation(`/seguimiento/${codigo}`);
    }
  }, [setLocation]);

  const stopScanner = useCallback(() => {
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch (_) {}
      controlsRef.current = null;
    }
    codeReaderRef.current = null;
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach(track => track.stop()); } catch (_) {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch (_) {}
    }
  }, []);

  const startScanner = useCallback(async () => {
    setStatus("checking");
    setErrorMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorMessage("La cámara no está disponible. Asegúrate de estar en HTTPS o localhost.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(t => t.stop());
        setStatus("error");
        setErrorMessage("No se pudo inicializar el video.");
        return;
      }
      video.srcObject = stream;
      await video.play();
      setStatus("ready");
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
      setStatus("scanning");
      const controls = await codeReader.decodeFromVideoElement(video, (result) => {
        if (result) {
          const text = result.getText().trim();
          if (text) {
            if ('vibrate' in navigator) { (navigator as any).vibrate(100); }
            toast.success("✅ ¡QR DETECTADO!");
            stopScanner();
            setIsOpen(false);
            navigateToItem(text);
          }
        }
      });
      controlsRef.current = controls;
    } catch (err: any) {
      console.error("Error iniciando cámara:", err);
      setStatus("error");
      const name = err?.name || "Error";
      const message = err?.message || "";
      if (message.includes("Timeout") || message.includes("timeout")) {
        setErrorMessage("La cámara tardó demasiado en responder. Usa el ingreso manual o reintenta.");
        return;
      }
      if (name === "NotAllowedError") {
        setErrorMessage("Permiso de cámara DENEGADO. Ve a la configuración del navegador y permite el acceso a la cámara.");
      } else if (name === "NotFoundError") {
        setErrorMessage("No se detectó ninguna cámara en el dispositivo.");
      } else if (name === "NotReadableError" || name === "AbortError") {
        setErrorMessage("La cámara está ocupada o no responde. Cierra otras apps y reintenta.");
      } else if (name === "OverconstrainedError") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
            audio: false,
          });
          streamRef.current = stream;
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            await video.play();
            const codeReader = new BrowserMultiFormatReader();
            codeReaderRef.current = codeReader;
            setStatus("scanning");
            const controls = await codeReader.decodeFromVideoElement(video, (result) => {
              if (result) {
                const text = result.getText().trim();
                if (text) {
                  if ('vibrate' in navigator) { (navigator as any).vibrate(100); }
                  toast.success("✅ ¡QR DETECTADO!");
                  stopScanner();
                  setIsOpen(false);
                  navigateToItem(text);
                }
              }
            });
            controlsRef.current = controls;
            return;
          }
        } catch (_) {
          setErrorMessage("No se pudo acceder a ninguna cámara.");
        }
      } else {
        setErrorMessage(`Error al acceder a la cámara: ${name}`);
      }
    }
  }, [stopScanner, navigateToItem]);

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) { toast.error("Ingresa un código"); return; }
    setIsOpen(false);
    navigateToItem(code);
  };

  const handleClose = useCallback(() => {
    stopScanner();
    setIsOpen(false);
    setStatus("idle");
    setManualCode("");
    setErrorMessage("");
  }, [stopScanner]);

  useEffect(() => {
    if (isOpen && status === "idle") {
      const timer = setTimeout(startScanner, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, status, startScanner]);

  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  return (
    <>
      {/* SINGLE flex container for ALL 4 floating buttons */}
      <div className="fixed bottom-6 right-4 z-50 flex flex-col items-center gap-3">
        {/* 1. Plus - Nuevo Ítem */}
        <Button
          onClick={() => setLocation("/nuevo-item")}
          size="icon"
          className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-full shadow-lg bg-[#02B381] hover:bg-[#029970] p-0 transition-transform active:scale-90"
          title="Nuevo Ítem"
        >
          <Plus className="h-[15px] w-[15px] text-white" strokeWidth={3} />
        </Button>

        {/* 2. Pin - Ver Planos / Pins */}
        <Button
          onClick={() => setLocation("/planos")}
          size="icon"
          className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-full shadow-lg bg-[#E67E22] hover:bg-[#D35400] p-0 transition-transform active:scale-90"
          title="Ver Planos / Pins"
        >
          <MapPin className="h-[15px] w-[15px] text-white" />
        </Button>

        {/* 3. Crosshair - Captura por plano */}
        <Button
          onClick={() => setLocation("/planos")}
          size="icon"
          className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-full shadow-lg bg-[#002C63] hover:bg-[#001d42] p-0 transition-transform active:scale-90"
          title="Captura por Plano"
        >
          <Crosshair className="h-[15px] w-[15px] text-white" />
        </Button>

        {/* 4. QR - Escanear QR */}
        <Button
          onClick={() => { setStatus("idle"); setIsOpen(true); }}
          size="icon"
          className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-full shadow-lg bg-[#02B381] hover:bg-[#029970] p-0 transition-transform active:scale-90"
          title="Escanear QR"
        >
          <QrCode className="h-[15px] w-[15px] text-white" />
        </Button>
      </div>

      {/* QR Scanner Modal */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-[#02B381]" />
              {status === "manual" ? "Ingresar Código" : "Escanear Código QR"}
            </DialogTitle>
            <DialogDescription>
              {status === "manual"
                ? "Ingresa el código del ítem manualmente"
                : "Apunta la cámara al código QR del ítem"
              }
            </DialogDescription>
          </DialogHeader>

          {status === "manual" ? (
            <div className="p-4 pt-0 space-y-4">
              <p className="text-sm text-muted-foreground">
                Ingresa el código del ítem (ej: OQC-00001)
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="OQC-00001"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                  className="flex-1"
                  autoFocus
                />
                <Button onClick={handleManualSubmit} className="bg-[#02B381] hover:bg-[#029970]">
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setStatus("idle"); startScanner(); }}
              >
                <Camera className="h-4 w-4 mr-2" />
                Volver a cámara
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                {status === "scanning" && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-[#02B381] rounded-lg relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#02B381] rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#02B381] rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#02B381] rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#02B381] rounded-br-lg" />
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#02B381] animate-pulse" style={{ animation: "scan 2s ease-in-out infinite" }} />
                    </div>
                  </div>
                )}
                {(status === "checking" || status === "ready") && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center text-white">
                      <Camera className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                      <p className="text-sm">Iniciando cámara...</p>
                    </div>
                  </div>
                )}
                {status === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className="text-center text-white p-4 max-w-xs">
                      <Camera className="h-8 w-8 mx-auto mb-2 text-red-400" />
                      <p className="text-sm mb-3">{errorMessage}</p>
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" variant="outline" className="text-white border-white" onClick={() => { setStatus("idle"); startScanner(); }}>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Reintentar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { stopScanner(); setStatus("manual"); }}>
                  <Keyboard className="h-3 w-3 mr-1" />
                  Código manual
                </Button>
                {status === "scanning" && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { stopScanner(); setStatus("idle"); startScanner(); }}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reiniciar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(190px); }
        }
      `}</style>
    </>
  );
}

// Keep the old export name for backward compatibility
export { FloatingCaptureButton as QRScannerButton };
