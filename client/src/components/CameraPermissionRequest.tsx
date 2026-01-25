import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, QrCode, Check, X } from "lucide-react";
import { toast } from "sonner";

const CAMERA_PERMISSION_KEY = "oqc-camera-permission-requested";

export function CameraPermissionRequest() {
  const { user, isAuthenticated } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<"pending" | "granted" | "denied" | "checking">("checking");

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Verificar si ya solicitamos permiso antes
    const alreadyRequested = localStorage.getItem(CAMERA_PERMISSION_KEY);
    if (alreadyRequested === "true") return;

    // Verificar el estado actual del permiso de cámara
    checkCameraPermission();
  }, [isAuthenticated, user]);

  const checkCameraPermission = async () => {
    try {
      // Verificar si el navegador soporta la API de permisos
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: "camera" as PermissionName });
        
        if (result.state === "granted") {
          // Ya tiene permiso, no mostrar diálogo
          localStorage.setItem(CAMERA_PERMISSION_KEY, "true");
          setPermissionStatus("granted");
          return;
        } else if (result.state === "denied") {
          // Permiso denegado permanentemente
          localStorage.setItem(CAMERA_PERMISSION_KEY, "true");
          setPermissionStatus("denied");
          return;
        }
      }
      
      // Si no podemos verificar o está en "prompt", mostrar diálogo
      setPermissionStatus("pending");
      setShowDialog(true);
    } catch {
      // Si hay error al verificar, mostrar diálogo de todas formas
      setPermissionStatus("pending");
      setShowDialog(true);
    }
  };

  const requestCameraPermission = async () => {
    try {
      // Solicitar acceso a la cámara
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      
      // Detener el stream inmediatamente (solo queríamos el permiso)
      stream.getTracks().forEach(track => track.stop());
      
      // Guardar que ya solicitamos permiso
      localStorage.setItem(CAMERA_PERMISSION_KEY, "true");
      setPermissionStatus("granted");
      setShowDialog(false);
      
      toast.success("Permiso de cámara concedido. Podrás escanear códigos QR sin problemas.");
    } catch (err: any) {
      console.error("Error al solicitar permiso de cámara:", err);
      
      // Guardar que ya solicitamos permiso (aunque fue denegado)
      localStorage.setItem(CAMERA_PERMISSION_KEY, "true");
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionStatus("denied");
        toast.error("Permiso de cámara denegado. Podrás ingresar códigos manualmente.");
      } else {
        setPermissionStatus("denied");
        toast.error("No se pudo acceder a la cámara. Podrás ingresar códigos manualmente.");
      }
      
      setShowDialog(false);
    }
  };

  const skipPermission = () => {
    localStorage.setItem(CAMERA_PERMISSION_KEY, "true");
    setShowDialog(false);
    toast.info("Podrás dar permiso de cámara más tarde desde el escáner QR.");
  };

  if (!showDialog) return null;

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md" aria-describedby="camera-permission-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Permiso de Cámara
          </DialogTitle>
          <DialogDescription id="camera-permission-description">
            Para escanear códigos QR en obra, necesitamos acceso a tu cámara.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <QrCode className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
            <div>
              <p className="font-medium">Escaneo rápido de QR</p>
              <p className="text-sm text-muted-foreground">
                Escanea los códigos QR pegados en obra para acceder directamente a cada ítem y dar seguimiento.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={requestCameraPermission} className="w-full">
              <Check className="h-4 w-4 mr-2" />
              Permitir acceso a cámara
            </Button>
            <Button variant="outline" onClick={skipPermission} className="w-full">
              <X className="h-4 w-4 mr-2" />
              Ahora no
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Si no das permiso ahora, podrás hacerlo después desde el botón de escanear QR.
            También puedes ingresar códigos manualmente.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
