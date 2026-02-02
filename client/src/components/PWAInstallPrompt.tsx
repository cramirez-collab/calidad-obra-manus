import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Smartphone, Monitor, Tablet } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Verificar si ya está instalado
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Verificar si es iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Verificar si ya se mostró el prompt recientemente (últimas 24 horas)
    const lastPromptTime = localStorage.getItem('pwa-install-prompt-time');
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    if (lastPromptTime && (now - parseInt(lastPromptTime)) < ONE_DAY) {
      return;
    }

    // Escuchar el evento beforeinstallprompt (Chrome, Edge, etc.)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Mostrar después de 3 segundos para no interrumpir inmediatamente
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Para iOS, mostrar instrucciones después de un delay
    if (isIOSDevice) {
      setTimeout(() => {
        setShowIOSInstructions(true);
        setShowPrompt(true);
      }, 3000);
    }

    // Detectar cuando se instala
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      console.log('[PWA] App instalada exitosamente');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('[PWA] Usuario aceptó la instalación');
        setIsInstalled(true);
      } else {
        console.log('[PWA] Usuario rechazó la instalación');
        // Guardar tiempo para no molestar en 24h
        localStorage.setItem('pwa-install-prompt-time', Date.now().toString());
      }
    } catch (error) {
      console.error('[PWA] Error al instalar:', error);
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSInstructions(false);
    // Guardar tiempo para no molestar en 24h
    localStorage.setItem('pwa-install-prompt-time', Date.now().toString());
  };

  // No mostrar si ya está instalado o no hay prompt
  if (isInstalled || !showPrompt) {
    return null;
  }

  // Instrucciones para iOS
  if (isIOS && showIOSInstructions) {
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-black/50 animate-in fade-in duration-300">
        <Card className="w-full max-w-md shadow-2xl animate-in slide-in-from-bottom duration-300">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-[#02B381] flex items-center justify-center">
                  <Download className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#002C63]">Instalar OQC</h3>
                  <p className="text-xs text-muted-foreground">Acceso rápido desde tu pantalla</p>
                </div>
              </div>
              <button 
                onClick={handleDismiss}
                className="p-1 rounded-full hover:bg-accent"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Para instalar en tu iPhone/iPad:
              </p>
              <ol className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-[#02B381]/10 text-[#02B381] text-xs font-bold flex items-center justify-center">1</span>
                  Toca el botón <strong className="text-foreground">Compartir</strong> (cuadrado con flecha)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-[#02B381]/10 text-[#02B381] text-xs font-bold flex items-center justify-center">2</span>
                  Desplázate y toca <strong className="text-foreground">"Agregar a Inicio"</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-[#02B381]/10 text-[#02B381] text-xs font-bold flex items-center justify-center">3</span>
                  Toca <strong className="text-foreground">"Agregar"</strong> para confirmar
                </li>
              </ol>
            </div>

            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={handleDismiss}
            >
              Entendido
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prompt para Android/Desktop
  if (deferredPrompt) {
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-black/50 animate-in fade-in duration-300">
        <Card className="w-full max-w-md shadow-2xl animate-in slide-in-from-bottom duration-300">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-[#02B381] flex items-center justify-center">
                  <Download className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#002C63]">Instalar OQC</h3>
                  <p className="text-xs text-muted-foreground">Acceso rápido sin abrir el navegador</p>
                </div>
              </div>
              <button 
                onClick={handleDismiss}
                className="p-1 rounded-full hover:bg-accent"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Smartphone className="h-4 w-4" />
                <span>Móvil</span>
              </div>
              <div className="flex items-center gap-1">
                <Tablet className="h-4 w-4" />
                <span>Tablet</span>
              </div>
              <div className="flex items-center gap-1">
                <Monitor className="h-4 w-4" />
                <span>PC</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleDismiss}
              >
                Ahora no
              </Button>
              <Button 
                className="flex-1 bg-[#02B381] hover:bg-[#02B381]/90"
                onClick={handleInstall}
              >
                <Download className="h-4 w-4 mr-2" />
                Instalar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
