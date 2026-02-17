import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  Download,
  Share2,
  Sparkles,
  Copy,
  CheckCircle2,
  X,
} from "lucide-react";

interface ProtocoloReportProps {
  open: boolean;
  onClose: () => void;
  unidadId?: number;
  unidadNombre?: string;
  nivelFiltro?: string;
}

export default function ProtocoloReport({
  open,
  onClose,
  unidadId,
  unidadNombre,
  nivelFiltro,
}: ProtocoloReportProps) {
  const { selectedProjectId } = useProject();
  const [contenido, setContenido] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [generadoPor, setGeneradoPor] = useState("");
  const [fecha, setFecha] = useState("");
  const [copied, setCopied] = useState(false);

  const generarMut = trpc.pruebas.generarProtocolo.useMutation({
    onSuccess: (data) => {
      setContenido(typeof data.contenido === 'string' ? data.contenido : String(data.contenido));
      setStats(data.stats);
      setGeneradoPor(data.generadoPor);
      setFecha(data.fecha);
    },
    onError: (err) => {
      toast.error(err.message || "Error generando protocolo");
    },
  });

  const handleGenerar = () => {
    if (!selectedProjectId) return;
    setContenido(null);
    generarMut.mutate({
      proyectoId: selectedProjectId,
      unidadId,
      nivelFiltro,
    });
  };

  const handleCopy = async () => {
    if (!contenido) return;
    try {
      await navigator.clipboard.writeText(contenido);
      setCopied(true);
      toast.success("Copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const handleShare = async () => {
    if (!contenido) return;
    const title = unidadId
      ? `Protocolo de Pruebas - Depto ${unidadNombre}`
      : "Protocolo de Pruebas - Resumen General";

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: contenido,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  const handleDownloadTxt = () => {
    if (!contenido) return;
    const blob = new Blob([contenido], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = unidadId
      ? `protocolo-depto-${unidadNombre}-${new Date().toISOString().split("T")[0]}.md`
      : `protocolo-general-${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Archivo descargado");
  };

  const handleClose = () => {
    setContenido(null);
    setStats(null);
    setCopied(false);
    onClose();
  };

  // Simple markdown to HTML renderer
  const renderMarkdown = (md: string) => {
    let html = md
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-[#002C63] mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-[#002C63] mt-5 mb-2 border-b border-gray-200 pb-1">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-[#002C63] mt-6 mb-3">$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Tables
      .replace(/^\|(.+)\|$/gm, (match) => {
        const cells = match.split("|").filter(Boolean).map(c => c.trim());
        const isHeader = cells.every(c => /^[-:]+$/.test(c));
        if (isHeader) return "";
        return `<tr>${cells.map(c => `<td class="border border-gray-200 px-2 py-1 text-xs">${c}</td>`).join("")}</tr>`;
      })
      // Bullet points
      .replace(/^- (.+)$/gm, '<li class="text-sm text-gray-700 ml-4 list-disc">$1</li>')
      // Numbered lists
      .replace(/^\d+\. (.+)$/gm, '<li class="text-sm text-gray-700 ml-4 list-decimal">$1</li>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p class="text-sm text-gray-700 mb-2">')
      // Line breaks
      .replace(/\n/g, "<br/>");

    // Wrap tables
    html = html.replace(/<tr>/g, (match, offset) => {
      const before = html.substring(0, offset);
      if (!before.includes("<table") || before.lastIndexOf("</table>") > before.lastIndexOf("<table")) {
        return `<table class="w-full border-collapse border border-gray-200 my-2 text-xs"><tbody><tr>`;
      }
      return match;
    });
    html = html.replace(/<\/tr>(?![\s\S]*?<tr>)/g, "</tr></tbody></table>");

    return `<div class="prose-sm"><p class="text-sm text-gray-700 mb-2">${html}</p></div>`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#002C63]" />
            {unidadId ? `Protocolo - Depto ${unidadNombre}` : "Protocolo General de Pruebas"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {!contenido && !generarMut.isPending ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#002C63] to-[#02B381] flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-[#002C63] mb-2">Generar Protocolo con IA</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                {unidadId
                  ? `Se generará un protocolo detallado de pruebas para el Departamento ${unidadNombre}.`
                  : "Se generará un resumen ejecutivo del estado de todas las pruebas del proyecto."}
              </p>
              <Button
                onClick={handleGenerar}
                className="bg-gradient-to-r from-[#002C63] to-[#02B381] hover:opacity-90 text-white px-6"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generar Protocolo
              </Button>
            </div>
          ) : generarMut.isPending ? (
            <div className="text-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-[#02B381] mx-auto mb-4" />
              <p className="text-sm font-medium text-[#002C63]">Generando protocolo con IA...</p>
              <p className="text-xs text-muted-foreground mt-1">Esto puede tomar unos segundos</p>
            </div>
          ) : contenido ? (
            <div className="space-y-3">
              {/* Stats summary */}
              {stats && (
                <div className="grid grid-cols-4 gap-2 p-3 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-bold text-[#002C63]">{stats.totalDeptos}</div>
                    <div className="text-[10px] text-muted-foreground">Deptos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-600">{stats.liberados}</div>
                    <div className="text-[10px] text-muted-foreground">Liberados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-600">{stats.conRechazos}</div>
                    <div className="text-[10px] text-muted-foreground">Con fallas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-500">{stats.sinIniciar}</div>
                    <div className="text-[10px] text-muted-foreground">Sin iniciar</div>
                  </div>
                </div>
              )}

              {/* Rendered content */}
              <div
                className="bg-white border border-gray-100 rounded-lg p-4 text-sm"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(contenido) }}
              />

              {/* Meta */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                <span>Generado por: {generadoPor}</span>
                <span>{new Date(fecha).toLocaleString("es-MX")}</span>
              </div>
            </div>
          ) : null}
        </div>

        {contenido && (
          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="flex-1"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTxt}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-1" />
              Descargar
            </Button>
            <Button
              size="sm"
              onClick={handleShare}
              className="flex-1 bg-[#02B381] hover:bg-[#02B381]/90 text-white"
            >
              <Share2 className="w-4 h-4 mr-1" />
              Compartir
            </Button>
          </DialogFooter>
        )}

        {!contenido && !generarMut.isPending && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cerrar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
