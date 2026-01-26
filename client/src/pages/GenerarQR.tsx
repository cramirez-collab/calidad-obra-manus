import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Printer, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { useProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";

interface QRItem {
  codigo: string;
  url: string;
  qrDataUrl: string;
}

export default function GenerarQR() {
  const { selectedProjectId } = useProject();
  
  // Obtener unidadId de la URL si existe
  const urlParams = new URLSearchParams(window.location.search);
  const unidadIdParam = urlParams.get('unidadId');
  
  const [rangoInicio, setRangoInicio] = useState(1);
  const [rangoFin, setRangoFin] = useState(10);
  const [selectedUnidadId, setSelectedUnidadId] = useState<string>(unidadIdParam || '');
  const [tamano, setTamano] = useState<"small" | "medium" | "large">("medium");
  const [qrItems, setQrItems] = useState<QRItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Obtener datos del proyecto seleccionado
  const { data: proyectos } = trpc.proyectos.list.useQuery();
  const proyectoActual = proyectos?.find(p => p.id === selectedProjectId);
  
  // Obtener unidades del proyecto
  const { data: unidades } = trpc.unidades.list.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined,
    { enabled: !!selectedProjectId }
  );
  const unidadSeleccionada = unidades?.find(u => u.id === parseInt(selectedUnidadId));
  
  // Usar el código del proyecto o "OQC" por defecto
  const codigoProyecto = proyectoActual?.codigo || "OQC";

  const baseUrl = window.location.origin;

  const formatCodigo = (num: number) => {
    const unidadCodigo = unidadSeleccionada?.codigo || unidadSeleccionada?.nombre || '';
    if (unidadCodigo) {
      return `${codigoProyecto}-${unidadCodigo}-${String(num).padStart(3, '0')}`;
    }
    return `${codigoProyecto}-${String(num).padStart(5, '0')}`;
  };

  const getSizeConfig = () => {
    switch (tamano) {
      case "small":
        return { qrSize: 80, fontSize: "text-xs", cardClass: "w-28 h-36" };
      case "large":
        return { qrSize: 160, fontSize: "text-lg", cardClass: "w-52 h-64" };
      default:
        return { qrSize: 120, fontSize: "text-sm", cardClass: "w-40 h-48" };
    }
  };

  const generarQRs = async () => {
    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto primero");
      return;
    }
    if (rangoInicio > rangoFin) {
      toast.error("El rango inicial debe ser menor al final");
      return;
    }
    if (rangoFin - rangoInicio > 100) {
      toast.error("Máximo 100 QR por generación");
      return;
    }

    setIsGenerating(true);
    const items: QRItem[] = [];
    const { qrSize } = getSizeConfig();

    try {
      for (let i = rangoInicio; i <= rangoFin; i++) {
        const codigo = formatCodigo(i);
        const url = `${baseUrl}/seguimiento/${codigo}`;
        
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: qrSize,
          margin: 1,
          color: {
            dark: '#002C63',
            light: '#FFFFFF'
          }
        });

        items.push({ codigo, url, qrDataUrl });
      }

      setQrItems(items);
      toast.success(`${items.length} códigos QR generados para ${proyectoActual?.nombre || 'el proyecto'}`);
    } catch (error) {
      toast.error("Error al generar QR");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("No se pudo abrir ventana de impresión");
      return;
    }

    const { qrSize } = getSizeConfig();
    const cardWidth = tamano === "small" ? "7rem" : tamano === "large" ? "13rem" : "10rem";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Codes - ${proyectoActual?.nombre || 'Objetiva'}</title>
          <style>
            @page {
              size: letter;
              margin: 0.5cm;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 10px;
            }
            .container {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              justify-content: flex-start;
            }
            .qr-card {
              width: ${cardWidth};
              border: 2px solid #002C63;
              border-radius: 8px;
              padding: 8px;
              text-align: center;
              page-break-inside: avoid;
              background: white;
            }
            .qr-card img {
              width: ${qrSize}px;
              height: ${qrSize}px;
            }
            .codigo {
              font-size: ${tamano === "small" ? "10px" : tamano === "large" ? "16px" : "12px"};
              font-weight: bold;
              color: #002C63;
              margin-top: 4px;
              letter-spacing: 1px;
            }
            .proyecto {
              font-size: ${tamano === "small" ? "7px" : tamano === "large" ? "10px" : "8px"};
              color: #666;
              margin-top: 2px;
            }
            .logo {
              font-size: ${tamano === "small" ? "8px" : tamano === "large" ? "12px" : "10px"};
              color: #02B381;
              margin-top: 2px;
            }
            @media print {
              .qr-card {
                border: 2px solid #002C63 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            ${qrItems.map(item => `
              <div class="qr-card">
                <img src="${item.qrDataUrl}" alt="${item.codigo}" />
                <div class="codigo">${item.codigo}</div>
                <div class="proyecto">${proyectoActual?.nombre || ''}</div>
                <div class="logo">OBJETIVA</div>
              </div>
            `).join('')}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const { qrSize, fontSize, cardClass } = getSizeConfig();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Generar Códigos QR</h1>
          <p className="text-muted-foreground">
            Genera códigos QR por rangos para imprimir y pegar en obra
          </p>
          {proyectoActual && (
            <p className="text-sm text-primary font-medium mt-1">
              Proyecto: {proyectoActual.nombre} (Prefijo: {codigoProyecto})
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Configuración de Rango
            </CardTitle>
            <CardDescription>
              Define el rango de códigos {codigoProyecto} a generar (máximo 100 por vez)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selector de Unidad (opcional) */}
            {unidades && unidades.length > 0 && (
              <div className="mb-4">
                <Label>Unidad (opcional - para QR específico de unidad)</Label>
                <Select value={selectedUnidadId} onValueChange={setSelectedUnidadId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccionar unidad (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin unidad específica</SelectItem>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.codigo || u.nombre} - {u.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {unidadSeleccionada && (
                  <p className="text-xs text-primary mt-1">
                    QR para: {unidadSeleccionada.nombre}
                  </p>
                )}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inicio">Desde (número)</Label>
                <Input
                  id="inicio"
                  type="number"
                  min={1}
                  value={rangoInicio}
                  onChange={(e) => setRangoInicio(parseInt(e.target.value) || 1)}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">{formatCodigo(rangoInicio)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fin">Hasta (número)</Label>
                <Input
                  id="fin"
                  type="number"
                  min={1}
                  value={rangoFin}
                  onChange={(e) => setRangoFin(parseInt(e.target.value) || 1)}
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">{formatCodigo(rangoFin)}</p>
              </div>
              <div className="space-y-2">
                <Label>Tamaño</Label>
                <Select value={tamano} onValueChange={(v) => setTamano(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Pequeño (para etiquetas)</SelectItem>
                    <SelectItem value="medium">Mediano (estándar)</SelectItem>
                    <SelectItem value="large">Grande (para paredes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={generarQRs} 
                  disabled={isGenerating || !selectedProjectId}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 mr-2" />
                      Generar QR
                    </>
                  )}
                </Button>
              </div>
            </div>

            {!selectedProjectId && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Selecciona un proyecto del menú lateral para generar QR</span>
              </div>
            )}

            {rangoFin - rangoInicio > 100 && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Máximo 100 códigos por generación</span>
              </div>
            )}
          </CardContent>
        </Card>

        {qrItems.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Vista Previa ({qrItems.length} códigos)</CardTitle>
                <CardDescription>
                  Revisa los códigos antes de imprimir
                </CardDescription>
              </div>
              <Button onClick={handlePrint} variant="default">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </CardHeader>
            <CardContent>
              <div 
                ref={printRef}
                className="flex flex-wrap gap-3 justify-start"
              >
                {qrItems.map((item) => (
                  <div
                    key={item.codigo}
                    className={`${cardClass} border-2 border-[#002C63] rounded-lg p-2 flex flex-col items-center justify-center bg-white shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <img 
                      src={item.qrDataUrl} 
                      alt={item.codigo}
                      className="mb-1"
                      style={{ width: qrSize, height: qrSize }}
                    />
                    <div className={`font-bold text-[#002C63] ${fontSize} tracking-wider`}>
                      {item.codigo}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {proyectoActual?.nombre}
                    </div>
                    <div className="text-[#02B381] text-[10px] font-medium">
                      OBJETIVA
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-slate-50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Instrucciones de uso:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Selecciona el proyecto en el menú lateral (cada proyecto tiene su propia numeración)</li>
              <li>Define el rango de códigos que necesitas (ej: 1 a 50 para las primeras 50 unidades)</li>
              <li>Selecciona el tamaño según donde los pegarás</li>
              <li>Genera los QR y revisa la vista previa</li>
              <li>Imprime en papel adhesivo o normal</li>
              <li>Pega cada QR en la unidad correspondiente</li>
              <li>Al escanear, el usuario irá directo al ítem de esa unidad</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
