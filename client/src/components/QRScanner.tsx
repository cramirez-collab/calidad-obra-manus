import { useState, useRef, useEffect, useCallback } from "react";
import { BrowserMultiFormatReader, BrowserCodeReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QrCode, Camera, Search, Keyboard, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type ScannerStatus = "idle" | "checking" | "ready" | "scanning" | "error" | "manual";

export function QRScannerButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [manualCode, setManualCode] = useState("");
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  // Navegar al ítem detectado
  const navigateToItem = useCallback((result: string) => {
    let codigo = result.trim();
    
    // Extraer código de URLs
    if (codigo.includes('/seguimiento/')) {
      codigo = codigo.split('/seguimiento/').pop() || codigo;
    } else if (codigo.includes('/items/')) {
      codigo = codigo.split('/items/').pop() || codigo;
    }
    
    // Limpiar parámetros de URL
    codigo = codigo.split('?')[0].split('#')[0];

    toast.success(`Navegando a: ${codigo}`);
    
    if (/^\d+$/.test(codigo)) {
      setLocation(`/items/${codigo}`);
    } else {
      setLocation(`/seguimiento/${codigo}`);
    }
  }, [setLocation]);

  // Detener escáner y cámara completamente
  const stopScanner = useCallback(() => {
    // Detener controles de escaneo
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (e) {
        // Ignorar
      }
      controlsRef.current = null;
    }

    // Limpiar referencia del lector
    codeReaderRef.current = null;

    // Detener stream de video
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {
        // Ignorar
      }
      streamRef.current = null;
    }

    // Limpiar video element
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch (e) {
        // Ignorar
      }
    }
  }, []);

  // Preparar cámara y comenzar escaneo continuo
  const startScanner = useCallback(async () => {
    setStatus("checking");
    setErrorMessage("");

    // Verificar soporte de getUserMedia
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorMessage(
        "La cámara no está disponible. Asegúrate de estar en HTTPS o localhost."
      );
      return;
    }

    try {
      // Solicitar acceso a la cámara - configuración compatible con todos los navegadores
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
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

      // Iniciar escaneo continuo con ZXing - configuración rápida
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      setStatus("scanning");

      // Escaneo continuo ULTRA RÁPIDO
      const controls = await codeReader.decodeFromVideoElement(
        video,
        (result, error) => {
          if (result) {
            const text = result.getText().trim();
            if (text) {
              // Vibración de confirmación
              if ('vibrate' in navigator) {
                (navigator as any).vibrate(100);
              }
              toast.success("✅ ¡QR DETECTADO!");
              stopScanner();
              setIsOpen(false);
              navigateToItem(text);
            }
          }
          // Ignorar errores de escaneo (es normal mientras busca QR)
        }
      );

      controlsRef.current = controls;

    } catch (err: any) {
      console.error("Error iniciando cámara:", err);
      setStatus("error");

      const name = err?.name || "Error";
      const message = err?.message || "";
      
      // Manejar timeout de video source (común en algunos dispositivos)
      if (message.includes("Timeout") || message.includes("timeout")) {
        setErrorMessage(
          "La cámara tardó demasiado en responder. Usa el ingreso manual o reintenta."
        );
        return;
      }
      
      if (name === "NotAllowedError") {
        setErrorMessage(
          "Permiso de cámara DENEGADO. Ve a la configuración del navegador y permite el acceso a la cámara."
        );
      } else if (name === "NotFoundError") {
        setErrorMessage("No se detectó ninguna cámara en el dispositivo.");
      } else if (name === "NotReadableError" || name === "AbortError") {
        setErrorMessage(
          "La cámara está ocupada o no responde. Cierra otras apps y reintenta."
        );
      } else if (name === "OverconstrainedError") {
        // Intentar con cámara frontal si la trasera no está disponible
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            },
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
            
            const controls = await codeReader.decodeFromVideoElement(
              video,
              (result) => {
                if (result) {
                  const text = result.getText().trim();
                  if (text) {
                    if ('vibrate' in navigator) {
                      (navigator as any).vibrate(100);
                    }
                    toast.success("✅ ¡QR DETECTADO!");
                    stopScanner();
                    setIsOpen(false);
                    navigateToItem(text);
                  }
                }
              }
            );
            
            controlsRef.current = controls;
            return;
          }
        } catch (e) {
          setErrorMessage("No se pudo acceder a ninguna cámara.");
        }
      } else {
        setErrorMessage(`Error al acceder a la cámara: ${name}`);
      }
    }
  }, [stopScanner, navigateToItem]);

  // Enviar código manual
  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) {
      toast.error("Ingresa un código");
      return;
    }
    setIsOpen(false);
    navigateToItem(code);
  };

  // Cerrar modal
  const handleClose = useCallback(() => {
    stopScanner();
    setIsOpen(false);
    setStatus("idle");
    setManualCode("");
    setErrorMessage("");
  }, [stopScanner]);

  // Iniciar escáner cuando se abre el modal
  useEffect(() => {
    if (isOpen && status === "idle") {
      const timer = setTimeout(startScanner, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, status, startScanner]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <>
      {/* Botón flotante verde */}
      <Button
        onClick={() => {
          setStatus("idle");
          setIsOpen(true);
        }}
        size="icon"
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-50 bg-[#02B381] hover:bg-[#029970]"
        title="Escanear QR"
      >
        <QrCode className="h-6 w-6 text-white" />
      </Button>

      {/* Modal del escáner */}
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
            // Vista de ingreso manual
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
                onClick={() => {
                  setStatus("idle");
                  startScanner();
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                Usar cámara
              </Button>
            </div>
          ) : status === "error" ? (
            // Vista de error
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <Camera className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <p className="font-medium text-lg">Cámara no disponible</p>
                <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
              </div>
              <div className="space-y-2">
                <Button 
                  className="w-full bg-[#02B381] hover:bg-[#029970]"
                  onClick={() => setStatus("manual")}
                >
                  <Keyboard className="h-4 w-4 mr-2" />
                  Ingresar código manual
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    stopScanner();
                    setStatus("idle");
                    startScanner();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reintentar cámara
                </Button>
              </div>
            </div>
          ) : (
            // Vista del escáner
            <div className="space-y-0">
              <div className="relative bg-black" style={{ minHeight: "320px" }}>
                {(status === "idle" || status === "checking" || status === "ready") && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
                    <div className="w-12 h-12 border-4 border-[#02B381] border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium">
                      {status === "checking" ? "Verificando cámara..." : "Iniciando cámara..."}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Permite el acceso cuando aparezca el mensaje
                    </p>
                  </div>
                )}
                
                {/* Video de la cámara */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  style={{ minHeight: "320px" }}
                  muted
                  playsInline
                  autoPlay
                />
                
                {/* Marco de escaneo */}
                {status === "scanning" && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-56 h-56 border-2 border-[#02B381] rounded-lg relative">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#02B381] rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#02B381] rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#02B381] rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#02B381] rounded-br-lg" />
                        {/* Línea de escaneo animada */}
                        <div className="absolute left-1 right-1 h-0.5 bg-[#02B381] animate-pulse" style={{ top: "50%" }} />
                      </div>
                    </div>
                    
                    {/* Indicador de escaneo activo */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                      <div className="bg-black/80 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Buscando código QR...
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 space-y-3 bg-white">
                <p className="text-sm text-muted-foreground text-center">
                  Centra el código QR dentro del recuadro
                </p>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    stopScanner();
                    setStatus("manual");
                  }}
                >
                  <Keyboard className="h-4 w-4 mr-2" />
                  Ingresar código manualmente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
