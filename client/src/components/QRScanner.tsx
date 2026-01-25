import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrCode, Camera, Search, Keyboard, X } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

export function QRScannerButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-scanner-container";

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.log("Error stopping scanner:", err);
      }
      try {
        scannerRef.current.clear();
      } catch (err) {
        console.log("Error clearing scanner:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const navigateToItem = useCallback((result: string) => {
    // Intentar extraer el código del ítem del QR
    let codigo = result.trim();
    
    // Si es una URL, extraer el código
    if (codigo.includes('/seguimiento/')) {
      const parts = codigo.split('/seguimiento/');
      codigo = parts[parts.length - 1];
    } else if (codigo.includes('/items/')) {
      const parts = codigo.split('/items/');
      codigo = parts[parts.length - 1];
    }
    
    // Limpiar el código de cualquier parámetro de URL
    codigo = codigo.split('?')[0].split('#')[0];

    toast.success(`Navegando a: ${codigo}`);
    
    // Navegar al ítem - primero intentar por código, si es número ir directo
    if (/^\d+$/.test(codigo)) {
      setLocation(`/items/${codigo}`);
    } else {
      // Buscar por código en la página de seguimiento
      setLocation(`/seguimiento/${codigo}`);
    }
  }, [setLocation]);

  const handleScanSuccess = useCallback((decodedText: string) => {
    console.log("QR Code detected:", decodedText);
    toast.success("¡Código QR detectado!");
    stopScanner();
    setIsOpen(false);
    navigateToItem(decodedText);
  }, [stopScanner, navigateToItem]);

  const startScanner = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // Verificar si el navegador soporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasPermission(false);
        setErrorMessage("Tu navegador no soporta el acceso a la cámara");
        setShowManualInput(true);
        setIsLoading(false);
        return;
      }

      // Limpiar scanner anterior si existe
      await stopScanner();

      // Esperar a que el contenedor esté en el DOM
      await new Promise(resolve => setTimeout(resolve, 100));

      const container = document.getElementById(scannerContainerId);
      if (!container) {
        setErrorMessage("Error interno: contenedor no encontrado");
        setIsLoading(false);
        return;
      }

      // Crear instancia del scanner
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      // Obtener cámaras disponibles
      const cameras = await Html5Qrcode.getCameras();
      
      if (!cameras || cameras.length === 0) {
        setHasPermission(false);
        setErrorMessage("No se encontraron cámaras disponibles");
        setShowManualInput(true);
        setIsLoading(false);
        return;
      }

      // Preferir cámara trasera
      let cameraId = cameras[0].id;
      const backCamera = cameras.find(cam => 
        cam.label.toLowerCase().includes('back') || 
        cam.label.toLowerCase().includes('rear') ||
        cam.label.toLowerCase().includes('trasera') ||
        cam.label.toLowerCase().includes('environment')
      );
      if (backCamera) {
        cameraId = backCamera.id;
      }

      setHasPermission(true);
      setIsScanning(true);

      // Iniciar escaneo
      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        handleScanSuccess,
        (errorMessage) => {
          // Ignorar errores de "no QR found" - son normales durante el escaneo
          if (!errorMessage.includes("No MultiFormat Readers") && 
              !errorMessage.includes("NotFoundException")) {
            console.log("QR scan error:", errorMessage);
          }
        }
      );

      setIsLoading(false);
    } catch (err: any) {
      console.error('Error al iniciar escáner:', err);
      setIsLoading(false);
      setHasPermission(false);
      
      // Mostrar mensaje específico según el error
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
        setErrorMessage("Permiso de cámara denegado. Por favor, permite el acceso a la cámara en la configuración de tu navegador.");
      } else if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
        setErrorMessage("No se encontró cámara disponible.");
      } else if (err.name === 'NotReadableError' || err.message?.includes('in use')) {
        setErrorMessage("La cámara está siendo usada por otra aplicación.");
      } else {
        setErrorMessage(`Error: ${err.message || 'No se pudo acceder a la cámara'}`);
      }
      
      setShowManualInput(true);
    }
  }, [stopScanner, handleScanSuccess]);

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

  const handleClose = useCallback(() => {
    stopScanner();
    setIsOpen(false);
    setShowManualInput(false);
    setManualCode("");
    setHasPermission(null);
    setErrorMessage(null);
  }, [stopScanner]);

  const handleRetryCamera = useCallback(() => {
    setShowManualInput(false);
    setHasPermission(null);
    setErrorMessage(null);
    startScanner();
  }, [startScanner]);

  useEffect(() => {
    if (isOpen && !showManualInput) {
      // Pequeño delay para asegurar que el DOM esté listo
      const timer = setTimeout(() => {
        startScanner();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, showManualInput, startScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

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
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {errorMessage}
                </div>
              )}
              
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
                onClick={handleRetryCamera}
              >
                <Camera className="h-4 w-4 mr-2" />
                Intentar con cámara
              </Button>
            </div>
          ) : (
            // Vista del escáner
            <>
              <div className="relative bg-black" style={{ minHeight: '350px' }}>
                {isLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-sm">Iniciando cámara...</p>
                    <p className="text-xs text-gray-400 mt-2">Permite el acceso cuando el navegador lo solicite</p>
                  </div>
                ) : hasPermission === false ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
                    <Camera className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Cámara no disponible</p>
                    <p className="text-sm text-gray-400 mb-4">
                      {errorMessage || "No se pudo acceder a la cámara. Puedes ingresar el código manualmente."}
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
                        onClick={handleRetryCamera}
                        className="w-full"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Reintentar cámara
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Contenedor del scanner - html5-qrcode lo llenará */}
                    <div 
                      id={scannerContainerId} 
                      className="w-full"
                      style={{ minHeight: '350px' }}
                    />
                    
                    {/* Indicador de escaneo activo */}
                    {isScanning && (
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                        <div className="bg-black/70 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          Escaneando...
                        </div>
                      </div>
                    )}
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
                  onClick={() => {
                    stopScanner();
                    setShowManualInput(true);
                  }}
                >
                  <Keyboard className="h-4 w-4 mr-2" />
                  Ingresar código manualmente
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
