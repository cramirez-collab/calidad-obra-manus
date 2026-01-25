import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QrCode, Camera, Search, Keyboard } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";

export function QRScannerButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [cameraState, setCameraState] = useState<'loading' | 'scanning' | 'error' | 'manual'>('loading');
  const [manualCode, setManualCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const containerId = "qr-reader-" + useRef(Math.random().toString(36).substr(2, 9)).current;

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

  // Detener el escáner de forma segura
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        // Ignorar errores al detener
      }
      try {
        scannerRef.current.clear();
      } catch (e) {
        // Ignorar errores al limpiar
      }
      scannerRef.current = null;
    }
  }, []);

  // Iniciar el escáner
  const startScanner = useCallback(async () => {
    // Evitar múltiples inicios simultáneos
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    
    setCameraState('loading');
    setErrorMessage("");

    try {
      // Verificar soporte del navegador
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Tu navegador no soporta acceso a la cámara");
      }

      // Limpiar escáner anterior
      await stopScanner();

      // Esperar a que el contenedor esté disponible
      await new Promise(r => setTimeout(r, 300));

      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error("Contenedor no disponible");
      }

      // Crear nueva instancia
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      // Configuración del escáner
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      // Intentar con cámara trasera primero (environment), luego cualquier cámara
      try {
        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            // ¡QR detectado!
            toast.success("¡Código QR detectado!");
            stopScanner();
            setIsOpen(false);
            navigateToItem(decodedText);
          },
          () => {
            // Callback de error de escaneo - ignorar (es normal mientras busca QR)
          }
        );
        setCameraState('scanning');
      } catch (envError) {
        // Si falla con environment, intentar con user (cámara frontal)
        console.log("Cámara trasera no disponible, intentando frontal...");
        try {
          await scanner.start(
            { facingMode: "user" },
            config,
            (decodedText) => {
              toast.success("¡Código QR detectado!");
              stopScanner();
              setIsOpen(false);
              navigateToItem(decodedText);
            },
            () => {}
          );
          setCameraState('scanning');
        } catch (userError) {
          throw userError;
        }
      }

    } catch (err: any) {
      console.error('Error iniciando escáner:', err);
      
      let message = "No se pudo acceder a la cámara";
      
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
        message = "Permiso de cámara denegado. Permite el acceso en la configuración del navegador.";
      } else if (err.name === 'NotFoundError') {
        message = "No se encontró ninguna cámara en el dispositivo.";
      } else if (err.name === 'NotReadableError') {
        message = "La cámara está siendo usada por otra aplicación.";
      } else if (err.message) {
        message = err.message;
      }
      
      setErrorMessage(message);
      setCameraState('error');
    } finally {
      isStartingRef.current = false;
    }
  }, [containerId, stopScanner, navigateToItem]);

  // Manejar envío manual
  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) {
      toast.error('Ingresa un código');
      return;
    }
    setIsOpen(false);
    navigateToItem(code);
  };

  // Cerrar modal
  const handleClose = useCallback(() => {
    stopScanner();
    setIsOpen(false);
    setCameraState('loading');
    setManualCode("");
    setErrorMessage("");
  }, [stopScanner]);

  // Iniciar escáner cuando se abre el modal
  useEffect(() => {
    if (isOpen && cameraState === 'loading') {
      const timer = setTimeout(startScanner, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, cameraState, startScanner]);

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
          setCameraState('loading');
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
              {cameraState === 'manual' ? 'Ingresar Código' : 'Escanear Código QR'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Escanea un código QR o ingresa el código manualmente para navegar al ítem
            </DialogDescription>
          </DialogHeader>

          {cameraState === 'manual' ? (
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
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
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
                  setCameraState('loading');
                  startScanner();
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                Usar cámara
              </Button>
            </div>
          ) : cameraState === 'error' ? (
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
                  onClick={() => setCameraState('manual')}
                >
                  <Keyboard className="h-4 w-4 mr-2" />
                  Ingresar código manual
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setCameraState('loading');
                    startScanner();
                  }}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Reintentar cámara
                </Button>
              </div>
            </div>
          ) : (
            // Vista del escáner
            <div className="space-y-0">
              <div className="relative bg-black" style={{ minHeight: '320px' }}>
                {cameraState === 'loading' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
                    <div className="w-12 h-12 border-4 border-[#02B381] border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium">Iniciando cámara...</p>
                    <p className="text-xs text-gray-400 mt-2">Permite el acceso cuando aparezca el mensaje</p>
                  </div>
                )}
                
                {/* Contenedor del escáner */}
                <div 
                  id={containerId} 
                  className="w-full"
                  style={{ minHeight: '320px' }}
                />
                
                {/* Indicador de escaneo activo */}
                {cameraState === 'scanning' && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                    <div className="bg-black/80 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Apunta al código QR
                    </div>
                  </div>
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
                    setCameraState('manual');
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
