import { useProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const WHATSAPP_SEGURIDAD_URL = "https://chat.whatsapp.com/BV52XnzehB6GK3XfACTFTh";
const WHATSAPP_CONTRATISTAS_URL = "https://chat.whatsapp.com/CBYjOPZU6z21FGKh6R49K5";

// SVG del logo de WhatsApp
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function useIsHidalma() {
  const { selectedProjectId } = useProject();
  const { data: proyectos } = trpc.proyectos.list.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const proyectoActual = proyectos?.find((p: any) => p.id === selectedProjectId);
  return proyectoActual?.nombre?.toLowerCase().includes("hidalma") ?? false;
}

/**
 * Botones flotantes WhatsApp que se renderizan DENTRO del contenedor
 * unificado de FloatingCaptureButton. Retorna fragmento con los botones
 * o null si no es Hidalma.
 */
export function WhatsAppFloatingButtons() {
  const isHidalma = useIsHidalma();
  if (!isHidalma) return null;

  return (
    <>
      {/* Contratistas - Verde */}
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={WHATSAPP_CONTRATISTAS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-10 h-10 rounded-full shadow-lg bg-[#02B381] hover:bg-[#029970] transition-all hover:scale-110 active:scale-95"
            style={{ boxShadow: "0 2px 8px rgba(2, 179, 129, 0.35)" }}
          >
            <WhatsAppIcon className="w-5 h-5 text-white" />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left" className="bg-[#02B381] text-white border-[#029970]">
          Contratistas
        </TooltipContent>
      </Tooltip>

      {/* Seguridad - Rojo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={WHATSAPP_SEGURIDAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-10 h-10 rounded-full shadow-lg bg-red-600 hover:bg-red-700 transition-all hover:scale-110 active:scale-95"
            style={{ boxShadow: "0 2px 8px rgba(220, 38, 38, 0.35)" }}
          >
            <WhatsAppIcon className="w-5 h-5 text-white" />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left" className="bg-red-600 text-white border-red-700">
          Seguridad
        </TooltipContent>
      </Tooltip>
    </>
  );
}

// Keep backward compat export name
export const WhatsAppFloatingButton = WhatsAppFloatingButtons;

/**
 * Botones inline para la barra de iconos de Bienvenida.
 * Solo visibles en proyecto Hidalma.
 */
export function WhatsAppIconButton() {
  const isHidalma = useIsHidalma();
  if (!isHidalma) return null;

  return (
    <>
      {/* Contratistas - Verde */}
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={WHATSAPP_CONTRATISTAS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-[#02B381] hover:bg-[#029970] shadow-md transition-all active:scale-95"
          >
            <WhatsAppIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </a>
        </TooltipTrigger>
        <TooltipContent>Contratistas</TooltipContent>
      </Tooltip>

      {/* Seguridad - Rojo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={WHATSAPP_SEGURIDAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-red-600 hover:bg-red-700 shadow-md transition-all active:scale-95"
          >
            <WhatsAppIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </a>
        </TooltipTrigger>
        <TooltipContent>Seguridad</TooltipContent>
      </Tooltip>
    </>
  );
}
