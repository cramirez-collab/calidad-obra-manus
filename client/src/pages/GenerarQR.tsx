import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Printer, AlertCircle, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { useProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";

interface QRItem {
  codigo: string;
  url: string;
  qrDataUrl: string;
  itemId?: number;
  titulo?: string;
  unidad?: string;
}

export default function GenerarQR() {
  const { selectedProjectId } = useProject();
  
  const [modo, setModo] = useState<"items" | "rango">("items");
  const [rangoInicio, setRangoInicio] = useState(1);
  const [rangoFin, setRangoFin] = useState(6);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [qrItems, setQrItems] = useState<QRItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Obtener datos del proyecto seleccionado
  const { data: proyectos } = trpc.proyectos.list.useQuery();
  const proyectoActual = proyectos?.find(p => p.id === selectedProjectId);
  
  // Obtener ítems del proyecto
  const { data: itemsData } = trpc.items.list.useQuery(
    { proyectoId: selectedProjectId || undefined, limit: 500 },
    { enabled: !!selectedProjectId }
  );
  const items = itemsData?.items || [];
  
  // Usar el código del proyecto o "OQC" por defecto
  const codigoProyecto = proyectoActual?.codigo || "OQC";
  const baseUrl = window.location.origin;

  const formatCodigo = (num: number) => {
    return `${codigoProyecto}-${String(num).padStart(5, '0')}`;
  };

  const generarQRsItems = async () => {
    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto primero");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Selecciona al menos un ítem");
      return;
    }

    setIsGenerating(true);
    const qrList: QRItem[] = [];

    try {
      for (const itemId of selectedItems) {
        const item = items.find(i => i.id === itemId);
        if (!item) continue;
        
        const codigo = item.codigo;
        const url = `${baseUrl}/seguimiento/${codigo}`;
        
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 200,
          margin: 1,
          color: {
            dark: '#002C63',
            light: '#FFFFFF'
          }
        });

        qrList.push({ 
          codigo, 
          url, 
          qrDataUrl, 
          itemId,
          titulo: item.titulo,
          unidad: ''
        });
      }

      setQrItems(qrList);
      toast.success(`${qrList.length} códigos QR generados`);
    } catch (error) {
      toast.error("Error al generar QR");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generarQRsRango = async () => {
    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto primero");
      return;
    }
    if (rangoInicio > rangoFin) {
      toast.error("El rango inicial debe ser menor al final");
      return;
    }
    if (rangoFin - rangoInicio >= 100) {
      toast.error("Máximo 100 QR por generación");
      return;
    }

    setIsGenerating(true);
    const qrList: QRItem[] = [];

    try {
      for (let i = rangoInicio; i <= rangoFin; i++) {
        const codigo = formatCodigo(i);
        const url = `${baseUrl}/seguimiento/${codigo}`;
        
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 200,
          margin: 1,
          color: {
            dark: '#002C63',
            light: '#FFFFFF'
          }
        });

        qrList.push({ codigo, url, qrDataUrl });
      }

      setQrItems(qrList);
      toast.success(`${qrList.length} códigos QR generados`);
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

    // Diseño optimizado para 6 QR por hoja carta (2 columnas x 3 filas)
    // Hoja carta: 8.5" x 11" = 215.9mm x 279.4mm
    // Con márgenes de 10mm, área útil: 195.9mm x 259.4mm
    // Cada celda: 97.95mm x 86.47mm aprox
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Codes - ${proyectoActual?.nombre || 'Objetiva'}</title>
          <style>
            @page {
              size: letter portrait;
              margin: 10mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page {
              width: 195.9mm;
              height: 259.4mm;
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              grid-template-rows: repeat(3, 1fr);
              gap: 3mm;
              page-break-after: always;
            }
            .page:last-child {
              page-break-after: auto;
            }
            .qr-card {
              border: 2px solid #002C63;
              border-radius: 8px;
              padding: 4mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: white;
              overflow: hidden;
            }
            .qr-card img {
              width: 55mm;
              height: 55mm;
              object-fit: contain;
            }
            .codigo {
              font-size: 14pt;
              font-weight: bold;
              color: #002C63;
              margin-top: 2mm;
              letter-spacing: 0.5px;
              text-align: center;
              word-break: break-all;
            }
            .titulo {
              font-size: 9pt;
              color: #333;
              margin-top: 1mm;
              text-align: center;
              max-height: 10mm;
              overflow: hidden;
              line-height: 1.2;
            }
            .unidad {
              font-size: 8pt;
              color: #666;
              margin-top: 1mm;
            }
            .logo {
              font-size: 10pt;
              color: #02B381;
              font-weight: bold;
              margin-top: 2mm;
            }
            .empty-cell {
              border: 1px dashed #ccc;
              border-radius: 8px;
            }
            @media print {
              .qr-card {
                border: 2px solid #002C63 !important;
              }
            }
          </style>
        </head>
        <body>
          ${generatePrintPages(qrItems, proyectoActual?.nombre || '')}
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

  // Función para generar páginas con 6 QR cada una
  const generatePrintPages = (items: QRItem[], proyectoNombre: string) => {
    const pages: string[] = [];
    const itemsPerPage = 6;
    
    for (let i = 0; i < items.length; i += itemsPerPage) {
      const pageItems = items.slice(i, i + itemsPerPage);
      const cells: string[] = [];
      
      // Agregar los QR de esta página
      for (const item of pageItems) {
        cells.push(`
          <div class="qr-card">
            <img src="${item.qrDataUrl}" alt="${item.codigo}" />
            <div class="codigo">${item.codigo}</div>
            ${item.titulo ? `<div class="titulo">${item.titulo}</div>` : ''}
            ${item.unidad ? `<div class="unidad">${item.unidad}</div>` : ''}
            <div class="logo">OBJETIVA</div>
          </div>
        `);
      }
      
      // Rellenar celdas vacías si es necesario
      while (cells.length < itemsPerPage) {
        cells.push('<div class="empty-cell"></div>');
      }
      
      pages.push(`<div class="page">${cells.join('')}</div>`);
    }
    
    return pages.join('');
  };

  const toggleItemSelection = (itemId: number) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const selectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(i => i.id));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Generar Códigos QR</h1>
          <p className="text-muted-foreground">
            Genera códigos QR para ítems existentes o por rangos
          </p>
          {proyectoActual && (
            <p className="text-sm text-primary font-medium mt-1">
              Proyecto: {proyectoActual.nombre} (Prefijo: {codigoProyecto})
            </p>
          )}
        </div>

        {/* Selector de modo */}
        <div className="flex gap-2">
          <Button 
            variant={modo === "items" ? "default" : "outline"}
            onClick={() => setModo("items")}
            className="flex items-center gap-2"
          >
            <ClipboardList className="h-4 w-4" />
            Por Ítems
          </Button>
          <Button 
            variant={modo === "rango" ? "default" : "outline"}
            onClick={() => setModo("rango")}
            className="flex items-center gap-2"
          >
            <QrCode className="h-4 w-4" />
            Por Rango
          </Button>
        </div>

        {modo === "items" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Seleccionar Ítems
              </CardTitle>
              <CardDescription>
                Selecciona los ítems para los que deseas generar QR
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedProjectId ? (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Selecciona un proyecto del menú lateral</span>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay ítems en este proyecto
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      {selectedItems.length === items.length ? "Deseleccionar todos" : "Seleccionar todos"}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selectedItems.length} de {items.length} seleccionados
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto border rounded-lg p-2">
                    {items.map(item => (
                      <label 
                        key={item.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedItems.includes(item.id) ? 'bg-primary/10 border border-primary' : 'border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                          className="h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.codigo}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.titulo}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <Button 
                    onClick={generarQRsItems} 
                    disabled={isGenerating || selectedItems.length === 0}
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
                        Generar QR ({selectedItems.length} ítems)
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    placeholder="6"
                  />
                  <p className="text-xs text-muted-foreground">{formatCodigo(rangoFin)}</p>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={generarQRsRango} 
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

              {rangoFin - rangoInicio >= 100 && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Máximo 100 códigos por generación</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {qrItems.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Vista Previa ({qrItems.length} códigos)</CardTitle>
                <CardDescription>
                  6 QR por hoja carta - Revisa antes de imprimir
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
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
              >
                {qrItems.map((item, index) => (
                  <div 
                    key={index}
                    className="border-2 border-[#002C63] rounded-lg p-3 text-center bg-white"
                  >
                    <img 
                      src={item.qrDataUrl} 
                      alt={item.codigo}
                      className="w-full max-w-[100px] mx-auto"
                    />
                    <p className="text-xs font-bold text-[#002C63] mt-2 break-all">
                      {item.codigo}
                    </p>
                    {item.titulo && (
                      <p className="text-[10px] text-gray-600 truncate mt-1">
                        {item.titulo}
                      </p>
                    )}
                    {item.unidad && (
                      <p className="text-[9px] text-gray-500">
                        {item.unidad}
                      </p>
                    )}
                    <p className="text-[10px] text-[#02B381] font-bold mt-1">
                      OBJETIVA
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Instrucciones de uso:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Selecciona el proyecto en el menú lateral</li>
              <li>Elige el modo: Por Ítems (para QR de ítems existentes) o Por Rango (para QR nuevos)</li>
              <li>En modo Ítems, selecciona los ítems deseados</li>
              <li>Haz clic en "Generar QR"</li>
              <li>Revisa la vista previa (6 QR por hoja carta)</li>
              <li>Haz clic en "Imprimir" para imprimir o guardar como PDF</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
