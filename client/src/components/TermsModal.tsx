import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileText, Shield, Lock } from "lucide-react";

interface TermsModalProps {
  open: boolean;
  onAccept: () => void;
}

export function TermsModal({ open, onAccept }: TermsModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  
  const aceptarTerminosMutation = trpc.auth.aceptarTerminos.useMutation({
    onSuccess: () => {
      toast.success("Términos aceptados correctamente");
      onAccept();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAccept = () => {
    if (!accepted || !privacyAccepted) {
      toast.error("Debes aceptar los términos y el aviso de privacidad para continuar");
      return;
    }
    aceptarTerminosMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-6 w-6 text-primary" />
            Términos y Condiciones de Uso
          </DialogTitle>
          <DialogDescription>
            Por favor lee y acepta los siguientes términos para continuar usando OQC
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6 text-sm">
            {/* Términos y Condiciones */}
            <section>
              <h3 className="font-semibold text-base flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-primary" />
                Términos y Condiciones de Servicio
              </h3>
              <div className="space-y-3 text-muted-foreground">
                <p>
                  <strong>1. Aceptación de los Términos.</strong> Al acceder y utilizar la plataforma OQC (Objetiva Quality Control), 
                  usted acepta estar sujeto a estos términos y condiciones de uso. Si no está de acuerdo con alguno de estos términos, 
                  no debe utilizar este servicio.
                </p>
                <p>
                  <strong>2. Descripción del Servicio.</strong> OQC es una plataforma de control de calidad para obras de construcción 
                  que permite la gestión de ítems de calidad, seguimiento de defectos, aprobaciones y generación de reportes.
                </p>
                <p>
                  <strong>3. Uso Autorizado.</strong> El usuario se compromete a utilizar la plataforma únicamente para los fines 
                  autorizados por su empleador o contratante, y de acuerdo con las políticas de la empresa Objetiva.
                </p>
                <p>
                  <strong>4. Responsabilidad del Usuario.</strong> El usuario es responsable de mantener la confidencialidad de sus 
                  credenciales de acceso y de todas las actividades realizadas bajo su cuenta.
                </p>
                <p>
                  <strong>5. Propiedad Intelectual.</strong> Todo el contenido, diseño, código y funcionalidades de OQC son propiedad 
                  de Objetiva y están protegidos por las leyes de propiedad intelectual aplicables en México.
                </p>
                <p>
                  <strong>6. Limitación de Responsabilidad.</strong> Objetiva no será responsable por daños indirectos, incidentales 
                  o consecuentes derivados del uso o imposibilidad de uso de la plataforma.
                </p>
                <p>
                  <strong>7. Modificaciones.</strong> Objetiva se reserva el derecho de modificar estos términos en cualquier momento. 
                  Las modificaciones entrarán en vigor al ser publicadas en la plataforma.
                </p>
                <p>
                  <strong>8. Ley Aplicable.</strong> Estos términos se regirán e interpretarán de acuerdo con las leyes de los 
                  Estados Unidos Mexicanos.
                </p>
              </div>
            </section>

            {/* Aviso de Privacidad */}
            <section>
              <h3 className="font-semibold text-base flex items-center gap-2 mb-3">
                <Lock className="h-5 w-5 text-primary" />
                Aviso de Privacidad (LFPDPPP)
              </h3>
              <div className="space-y-3 text-muted-foreground">
                <p>
                  De conformidad con lo dispuesto en la Ley Federal de Protección de Datos Personales en Posesión de los 
                  Particulares (LFPDPPP) y su Reglamento, Objetiva, con domicilio en Guadalajara, Jalisco, México, es 
                  responsable del tratamiento de sus datos personales.
                </p>
                <p>
                  <strong>Datos Personales Recabados.</strong> Para los fines señalados en el presente aviso de privacidad, 
                  podemos recabar los siguientes datos personales:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Nombre completo</li>
                  <li>Correo electrónico</li>
                  <li>Fotografía de perfil</li>
                  <li>Información de actividad laboral en la plataforma</li>
                  <li>Fotografías de obra capturadas en el ejercicio de sus funciones</li>
                </ul>
                <p>
                  <strong>Finalidades del Tratamiento.</strong> Los datos personales recabados serán utilizados para:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Identificación y autenticación en la plataforma</li>
                  <li>Gestión de permisos y roles de usuario</li>
                  <li>Seguimiento de actividades de control de calidad</li>
                  <li>Generación de reportes y estadísticas</li>
                  <li>Comunicación relacionada con el servicio</li>
                </ul>
                <p>
                  <strong>Derechos ARCO.</strong> Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento 
                  de sus datos personales (derechos ARCO). Para ejercer estos derechos, puede contactar al responsable de 
                  protección de datos a través del administrador del sistema.
                </p>
                <p>
                  <strong>Transferencia de Datos.</strong> Sus datos personales no serán transferidos a terceros sin su 
                  consentimiento, salvo las excepciones previstas en la LFPDPPP.
                </p>
                <p>
                  <strong>Medidas de Seguridad.</strong> Objetiva implementa medidas de seguridad administrativas, técnicas 
                  y físicas para proteger sus datos personales contra daño, pérdida, alteración, destrucción o uso no autorizado.
                </p>
                <p>
                  <strong>Cambios al Aviso de Privacidad.</strong> Cualquier modificación a este aviso de privacidad será 
                  notificada a través de la plataforma.
                </p>
                <p className="text-xs italic">
                  Última actualización: Enero 2026
                </p>
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-start space-x-3">
            <Checkbox 
              id="terms" 
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked === true)}
            />
            <label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
              He leído y acepto los <strong>Términos y Condiciones de Uso</strong> de la plataforma OQC
            </label>
          </div>
          
          <div className="flex items-start space-x-3">
            <Checkbox 
              id="privacy" 
              checked={privacyAccepted}
              onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
            />
            <label htmlFor="privacy" className="text-sm leading-tight cursor-pointer">
              He leído y acepto el <strong>Aviso de Privacidad</strong> conforme a la LFPDPPP
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleAccept}
            disabled={!accepted || !privacyAccepted || aceptarTerminosMutation.isPending}
            className="w-full sm:w-auto"
          >
            {aceptarTerminosMutation.isPending ? "Guardando..." : "Aceptar y Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Componente para mostrar los términos en cualquier momento
export function TermsContent() {
  return (
    <div className="space-y-6 text-sm">
      <section>
        <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
          <FileText className="h-5 w-5 text-primary" />
          Términos y Condiciones de Servicio
        </h3>
        <div className="space-y-3 text-muted-foreground">
          <p>
            <strong>1. Aceptación de los Términos.</strong> Al acceder y utilizar la plataforma OQC (Objetiva Quality Control), 
            usted acepta estar sujeto a estos términos y condiciones de uso.
          </p>
          <p>
            <strong>2. Descripción del Servicio.</strong> OQC es una plataforma de control de calidad para obras de construcción.
          </p>
          <p>
            <strong>3. Uso Autorizado.</strong> El usuario se compromete a utilizar la plataforma únicamente para los fines autorizados.
          </p>
          <p>
            <strong>4. Responsabilidad del Usuario.</strong> El usuario es responsable de mantener la confidencialidad de sus credenciales.
          </p>
          <p>
            <strong>5. Propiedad Intelectual.</strong> Todo el contenido de OQC es propiedad de Objetiva.
          </p>
          <p>
            <strong>6. Ley Aplicable.</strong> Estos términos se rigen por las leyes de México.
          </p>
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
          <Lock className="h-5 w-5 text-primary" />
          Aviso de Privacidad (LFPDPPP)
        </h3>
        <div className="space-y-3 text-muted-foreground">
          <p>
            De conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), 
            Objetiva es responsable del tratamiento de sus datos personales.
          </p>
          <p>
            <strong>Datos Recabados:</strong> Nombre, correo electrónico, fotografía de perfil, información de actividad laboral.
          </p>
          <p>
            <strong>Derechos ARCO:</strong> Puede ejercer sus derechos de Acceso, Rectificación, Cancelación u Oposición 
            contactando al administrador del sistema.
          </p>
        </div>
      </section>
    </div>
  );
}
