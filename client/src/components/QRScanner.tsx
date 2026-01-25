import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrCode, Camera, X, Flashlight } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

export function QRScannerButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startScanner = async () => {
    try {
      // Solicitar permiso de cámara
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      setHasPermission(true);
      setIsScanning(true);

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
          try {
            const result = await reader.decodeFromVideoElement(videoRef.current!);
            if (result) {
              const text = result.getText();
              handleScanResult(text);
            }
          } catch (err) {
            // Continuar escaneando si no se encontró QR
            if (isScanning) {
              requestAnimationFrame(scanLoop);
            }
          }
        };
        scanLoop();
      }
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setHasPermission(false);
      toast.error('No se pudo acceder a la cámara');
    }
  };

  const stopScanner = () => {
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

    // Intentar extraer el código del ítem del QR
    // El QR puede contener una URL como /seguimiento/CODIGO o solo el código
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

    toast.success(`Código escaneado: ${codigo}`);
    
    // Navegar al ítem - primero intentar por código, si es número ir directo
    if (/^\d+$/.test(codigo)) {
      setLocation(`/items/${codigo}`);
    } else {
      // Buscar por código en la página de seguimiento
      setLocation(`/seguimiento/${codigo}`);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

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
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Escanear Código QR
            </DialogTitle>
          </DialogHeader>

          <div className="relative aspect-square bg-black">
            {hasPermission === false ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
                <Camera className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Cámara no disponible</p>
                <p className="text-sm text-gray-400">
                  Por favor, permite el acceso a la cámara para escanear códigos QR
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={startScanner}
                >
                  Reintentar
                </Button>
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

          <div className="p-4 pt-2 text-center">
            <p className="text-sm text-muted-foreground">
              Apunta la cámara al código QR del ítem
            </p>
          </div>
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
