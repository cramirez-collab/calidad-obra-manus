import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrCode, Camera, Search, Keyboard } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

export function QRScannerButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  const startScanner = async () => {
    setIsLoading(true);
    try {
      // Verificar si el navegador soporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasPermission(false);
        setShowManualInput(true);
        toast.error('Tu navegador no soporta el acceso a la cámara');
        return;
      }

      // Solicitar permiso de cámara
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = stream;
      setHasPermission(true);
      setIsScanning(true);
      scanningRef.current = true;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Configurar el lector de QR
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
        
        const reader = new BrowserMultiFormatReader(hints);
        readerRef.current = reader;

        // Escanear continuamente
        const scanLoop = async () => {
          if (!scanningRef.current || !videoRef.current) return;
          
          try {
            const result = await reader.decodeFromVideoElement(videoRef.current);
            if (result) {
              const text = result.getText();
              handleScanResult(text);
              return;
            }
          } catch {
            // Continuar escaneando si no se encontró QR
          }
          
          if (scanningRef.current) {
            requestAnimationFrame(scanLoop);
          }
        };
        
        // Pequeño delay para asegurar que el video esté listo
        setTimeout(scanLoop, 500);
      }
    } catch (err: any) {
      console.error('Error al acceder a la cámara:', err);
      setHasPermission(false);
      
      // Mostrar mensaje específico según el error
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error('Permiso de cámara denegado. Usa el ingreso manual.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        toast.error('No se encontró cámara. Usa el ingreso manual.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        toast.error('La cámara está en uso por otra aplicación.');
      } else {
        toast.error('No se pudo acceder a la cámara');
      }
      
      setShowManualInput(true);
    } finally {
      setIsLoading(false);
    }
  };

  const stopScanner = () => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleScanResult = (result: string) => {
    stopScanner();
    setIsOpen(false);
    navigateToItem(result);
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      toast.error('Ingresa un código');
      return;
    }
    setIsOpen(false);
    navigateToItem(manualCode.trim());
    setManualCode("");
    setShowManualInput(false);
  };

  const navigateToItem = (result: string) => {
    // Intentar extraer el código del ítem del QR
    let codigo = result;
    
    // Si es una URL, extraer el código
    if (result.includes('/seguimiento/')) {
      const parts = result.split('/seguimiento/');
      codigo = parts[parts.length - 1];
    } else if (result.includes('/items/')) {
      const parts = result.split('/items/');
      codigo = parts[parts.length - 1];
    }
    
    // Limpiar el código de cualquier parámetro de URL
    codigo = codigo.split('?')[0].split('#')[0];

    toast.success(`Buscando: ${codigo}`);
    
    // Navegar al ítem - primero intentar por código, si es número ir directo
    if (/^\d+$/.test(codigo)) {
      setLocation(`/items/${codigo}`);
    } else {
      // Buscar por código en la página de seguimiento
      setLocation(`/seguimiento/${codigo}`);
    }
  };

  const handleClose = () => {
    stopScanner();
    setIsOpen(false);
    setShowManualInput(false);
    setManualCode("");
    setHasPermission(null);
  };

  useEffect(() => {
    if (isOpen && !showManualInput) {
      startScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, showManualInput]);

  return (
    <>
      {/* Botón flotante */}
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
        title="Escanear QR"
      >
        <QrCode className="h-6 w-6" />
      </Button>

      {/* Modal del escáner */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              {showManualInput ? 'Ingresar Código' : 'Escanear Código QR'}
            </DialogTitle>
          </DialogHeader>

          {showManualInput ? (
            // Vista de ingreso manual
            <div className="p-4 pt-0 space-y-4">
              <p className="text-sm text-muted-foreground">
                Ingresa el código del ítem manualmente (ej: OQC-00001)
              </p>
              
              <div className="flex gap-2">
                <Input
                  placeholder="OQC-00001"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                  className="flex-1"
                  autoFocus
                />
                <Button onClick={handleManualSubmit}>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setShowManualInput(false);
                  setHasPermission(null);
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                Intentar con cámara
              </Button>
            </div>
          ) : (
            // Vista del escáner
            <>
              <div className="relative aspect-square bg-black">
                {isLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-sm">Iniciando cámara...</p>
                  </div>
                ) : hasPermission === false ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
                    <Camera className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Cámara no disponible</p>
                    <p className="text-sm text-gray-400 mb-4">
                      No se pudo acceder a la cámara. Puedes ingresar el código manualmente.
                    </p>
                    <div className="flex flex-col gap-2 w-full max-w-xs">
                      <Button 
                        variant="default"
                        onClick={() => setShowManualInput(true)}
                        className="w-full"
                      >
                        <Keyboard className="h-4 w-4 mr-2" />
                        Ingresar código manual
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setHasPermission(null);
                          startScanner();
                        }}
                        className="w-full"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Reintentar cámara
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    
                    {/* Overlay con guías */}
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Marco de escaneo */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-64 h-64 relative">
                          {/* Esquinas del marco */}
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                          
                          {/* Línea de escaneo animada */}
                          {isScanning && (
                            <div className="absolute left-2 right-2 h-0.5 bg-primary animate-scan" />
                          )}
                        </div>
                      </div>
                      
                      {/* Sombra exterior */}
                      <div className="absolute inset-0 bg-black/50" style={{
                        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, calc(50% - 128px) calc(50% - 128px), calc(50% - 128px) calc(50% + 128px), calc(50% + 128px) calc(50% + 128px), calc(50% + 128px) calc(50% - 128px), calc(50% - 128px) calc(50% - 128px))'
                      }} />
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 pt-2 space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Apunta la cámara al código QR del ítem
                </p>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setShowManualInput(true)}
                >
                  <Keyboard className="h-4 w-4 mr-2" />
                  Ingresar código manualmente
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Estilos para la animación */}
      <style>{`
        @keyframes scan {
          0%, 100% { top: 8px; }
          50% { top: calc(100% - 8px); }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
