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
  consecutivo?: number; // Consecutivo interno del ítem
}

export default function GenerarQR() {
  const { selectedProjectId } = useProject();
  
  const [modo, setModo] = useState<"items" | "rango">("items");
  const [rangoInicio, setRangoInicio] = useState<string>("");
  const [rangoFin, setRangoFin] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [qrItems, setQrItems] = useState<QRItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Obtener datos del proyecto seleccionado
  const { data: proyectos } = trpc.proyectos.list.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const proyectoActual = proyectos?.find(p => p.id === selectedProjectId);
  
  // Obtener último consecutivo QR impreso del proyecto
  const { data: ultimoConsecutivoData } = trpc.proyectos.getUltimoConsecutivoQR.useQuery(
    { proyectoId: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  const ultimoConsecutivoQR = ultimoConsecutivoData?.ultimoConsecutivoQR ?? 0;
  
  // Mutación para actualizar último consecutivo
  const updateUltimoConsecutivo = trpc.proyectos.updateUltimoConsecutivoQR.useMutation({
    onSuccess: () => {
      trpc.useUtils().proyectos.getUltimoConsecutivoQR.invalidate();
    },
  });
  
  // Obtener ítems del proyecto
  const { data: itemsData } = trpc.items.list.useQuery(
    { proyectoId: selectedProjectId || undefined, limit: 500 },
    { enabled: !!selectedProjectId }
  );
  const items = itemsData?.items || [];
  
  // Usar el código del proyecto o "OQC" por defecto
  const codigoProyecto = proyectoActual?.codigo || "OQC";
  const baseUrl = window.location.origin;

  // Generar código aleatorio de 6 caracteres alfanuméricos
  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${codigoProyecto}-${code}`;
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
          unidad: '',
          consecutivo: item.numeroInterno // Usar numeroInterno como consecutivo
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
    const inicio = parseInt(rangoInicio) || 0;
    const fin = parseInt(rangoFin) || 0;
    if (!inicio || !fin) {
      toast.error("Ingresa el rango de consecutivos");
      return;
    }
    if (inicio > fin) {
      toast.error("El rango inicial debe ser menor al final");
      return;
    }
    if (fin - inicio >= 100) {
      toast.error("Máximo 100 QR por generación");
      return;
    }

    setIsGenerating(true);
    const qrList: QRItem[] = [];

    try {
      for (let i = inicio; i <= fin; i++) {
        const codigo = generateRandomCode();
        const url = `${baseUrl}/seguimiento/${codigo}`;
        
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 200,
          margin: 1,
          color: {
            dark: '#002C63',
            light: '#FFFFFF'
          }
        });

        qrList.push({ codigo, url, qrDataUrl, consecutivo: i });
      }

      setQrItems(qrList);
      
      // Persistir el último consecutivo impreso
      if (fin > ultimoConsecutivoQR) {
        updateUltimoConsecutivo.mutate({
          proyectoId: selectedProjectId,
          ultimoConsecutivoQR: fin,
        });
      }
      
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

    // ============================================
    // AVERY 5160 / OFFICE DEPOT 64413 - AUTO-AJUSTE AGRESIVO
    // ============================================
    // Todas las medidas en pulgadas convertidas a mm con !important
    // para forzar que SIEMPRE se respete la plantilla sin importar
    // la configuración del navegador o la impresora.
    //
    // Hoja:     8.5" x 11" (Letter) = 215.9mm x 279.4mm
    // Etiqueta: 2-5/8" x 1" = 66.675mm x 25.4mm
    // Layout:   3 columnas x 10 filas = 30 etiquetas/hoja
    // Margen superior:  0.5"   = 12.7mm
    // Margen inferior:  0.5"   = 12.7mm
    // Margen izquierdo: 3/16"  = 4.7625mm
    // Margen derecho:   3/16"  = 4.7625mm
    // Gap horizontal:   1/8"   = 3.175mm
    // Gap vertical:     0"     = 0mm (se tocan)
    // ============================================
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Codes - ${proyectoActual?.nombre || 'Objetiva'}</title>
          <style>
            /* ========================================== */
            /* FORZAR TAMAÑO DE PÁGINA - AGRESIVO       */
            /* ========================================== */
            @page {
              size: 215.9mm 279.4mm !important;
              margin: 0mm !important;
              padding: 0mm !important;
            }
            
            /* Reset total - nada puede agregar espacio */
            *, *::before, *::after {
              box-sizing: border-box !important;
              margin: 0 !important;
              padding: 0 !important;
              border: 0 !important;
            }
            
            html {
              width: 215.9mm !important;
              height: 279.4mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            body {
              width: 215.9mm !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: Arial, Helvetica, sans-serif !important;
              font-size: 0 !important;
              line-height: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            /* ========================================== */
            /* PÁGINA - CONTENEDOR EXACTO                */
            /* ========================================== */
            .page {
              width: 215.9mm !important;
              height: 279.4mm !important;
              min-height: 279.4mm !important;
              max-height: 279.4mm !important;
              position: relative !important;
              overflow: hidden !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
            }
            .page:last-child {
              page-break-after: auto !important;
            }
            
            /* ========================================== */
            /* GRID - POSICIONAMIENTO ABSOLUTO EXACTO     */
            /* No depende de margin/padding del body      */
            /* ========================================== */
            .label-grid {
              position: absolute !important;
              top: 12.7mm !important;
              left: 4.7625mm !important;
              right: 4.7625mm !important;
              width: 206.375mm !important;
              display: grid !important;
              grid-template-columns: 66.675mm 66.675mm 66.675mm !important;
              grid-template-rows: repeat(10, 25.4mm) !important;
              column-gap: 3.175mm !important;
              row-gap: 0mm !important;
              /* Seguro anti-desborde */
              max-width: 206.375mm !important;
              max-height: 254mm !important;
            }
            
            /* ========================================== */
            /* CELDA DE ETIQUETA - TAMAÑO FIJO ABSOLUTO   */
            /* ========================================== */
            /* ========================================== */
            /* ETIQUETA: QR izquierda + info derecha       */
            /* Altura total: 25.4mm, ancho: 66.675mm       */
            /* ========================================== */
            .qr-card {
              width: 66.675mm !important;
              height: 25.4mm !important;
              min-width: 66.675mm !important;
              max-width: 66.675mm !important;
              min-height: 25.4mm !important;
              max-height: 25.4mm !important;
              display: flex !important;
              flex-direction: row !important;
              align-items: center !important;
              justify-content: flex-start !important;
              overflow: hidden !important;
              padding: 0.5mm 1mm !important;
              gap: 1.5mm !important;
              background: transparent !important;
            }
            
            .qr-card img {
              width: 22mm !important;
              height: 22mm !important;
              min-width: 22mm !important;
              max-width: 22mm !important;
              min-height: 22mm !important;
              max-height: 22mm !important;
              object-fit: contain !important;
              flex-shrink: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            /* Columna derecha: distribuye verticalmente */
            .qr-info {
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              align-items: flex-start !important;
              overflow: hidden !important;
              flex: 1 !important;
              min-width: 0 !important;
              height: 22mm !important;
              padding: 0.3mm 0 !important;
              margin: 0 !important;
            }
            
            /* Código aleatorio - arriba */
            .codigo {
              font-size: 7pt !important;
              font-weight: bold !important;
              color: #002C63 !important;
              letter-spacing: 0.2px !important;
              word-break: break-all !important;
              line-height: 1.15 !important;
            }
            
            /* Título del ítem (opcional) */
            .titulo {
              font-size: 5pt !important;
              color: #555 !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              white-space: nowrap !important;
              line-height: 1.1 !important;
              max-width: 100% !important;
            }
            
            /* OBJETIVA - estilo logo corporativo */
            .logo {
              font-size: 9.5pt !important;
              font-weight: 900 !important;
              letter-spacing: 1px !important;
              text-transform: uppercase !important;
              line-height: 1.0 !important;
            }
            .logo .objeti {
              color: #002C63 !important;
            }
            .logo .logo-va {
              color: #02B381 !important;
            }
            
            /* Consecutivo - abajo, grande y destacado */
            .consecutivo {
              font-size: 13pt !important;
              font-weight: 900 !important;
              color: #02B381 !important;
              line-height: 1.0 !important;
            }
            
            .empty-cell {
              width: 66.675mm !important;
              height: 25.4mm !important;
            }
            
            /* ========================================== */
            /* @MEDIA PRINT - DOBLE FORZADO              */
            /* ========================================== */
            @media print {
              @page {
                size: 215.9mm 279.4mm !important;
                margin: 0mm !important;
              }
              html, body {
                width: 215.9mm !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .page {
                width: 215.9mm !important;
                height: 279.4mm !important;
                page-break-after: always !important;
                page-break-inside: avoid !important;
              }
              .page:last-child {
                page-break-after: auto !important;
              }
              /* Eliminar headers/footers del navegador */
              header, footer, nav {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          ${generatePrintPages(qrItems, proyectoActual?.nombre || '')}
          <script>
            // Auto-imprimir al cargar
            window.onload = function() {
              // Pequeño delay para asegurar renderizado completo
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Función para generar páginas con 30 QR cada una (3 columnas x 10 filas)
  const generatePrintPages = (items: QRItem[], proyectoNombre: string) => {
    const pages: string[] = [];
    const itemsPerPage = 30;
    
    for (let i = 0; i < items.length; i += itemsPerPage) {
      const pageItems = items.slice(i, i + itemsPerPage);
      const cells: string[] = [];
      
      // Agregar los QR de esta página
      for (const item of pageItems) {
        cells.push(`
          <div class="qr-card">
            <img src="${item.qrDataUrl}" alt="${item.codigo}" />
            <div class="qr-info">
              <div class="codigo">${item.codigo}</div>
              ${item.titulo ? `<div class="titulo">${item.titulo}</div>` : ''}
              <div class="logo"><span class="objeti">OBJETI</span><span class="logo-va">VA</span></div>
              <div class="consecutivo">#${item.consecutivo || 0}</div>
            </div>
          </div>
        `);
      }
      
      // Rellenar celdas vacías si es necesario
      while (cells.length < itemsPerPage) {
        cells.push('<div class="empty-cell"></div>');
      }
      
      pages.push(`<div class="page"><div class="label-grid">${cells.join('')}</div></div>`);
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
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Generar Códigos QR</h1>
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
              {/* Badge informativo del último consecutivo impreso */}
              {selectedProjectId && ultimoConsecutivoQR > 0 && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-lg">
                  <QrCode className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium">
                    Último consecutivo impreso: <span className="text-blue-900 font-bold text-base">#{ultimoConsecutivoQR}</span>
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inicio">Desde (número)</Label>
                  <Input
                    id="inicio"
                    type="number"
                    min={1}
                    value={rangoInicio}
                    onChange={(e) => setRangoInicio(e.target.value)}
                    placeholder={ultimoConsecutivoQR > 0 ? `${ultimoConsecutivoQR + 1}` : "1"}
                  />
                  <p className="text-xs text-muted-foreground">Ej: {codigoProyecto}-XXXXXX (aleatorio)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fin">Hasta (número)</Label>
                  <Input
                    id="fin"
                    type="number"
                    min={1}
                    value={rangoFin}
                    onChange={(e) => setRangoFin(e.target.value)}
                    placeholder=""
                  />
                  <p className="text-xs text-muted-foreground">
                    {(parseInt(rangoInicio) || 0) > 0 && (parseInt(rangoFin) || 0) > 0
                      ? `Se generarán ${(parseInt(rangoFin) || 0) - (parseInt(rangoInicio) || 0) + 1} códigos`
                      : "Ingresa el rango"}
                  </p>
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

              {(parseInt(rangoFin) || 0) - (parseInt(rangoInicio) || 0) >= 100 && (
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
                  Etiquetas Office Depot 64413 (6.7x2.5cm) - 30 por hoja
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
                    {/* CONSECUTIVO INTERNO - OBLIGATORIO SIEMPRE DEBAJO DE OBJETIVA */}
                    <p className="text-sm font-bold text-[#02B381] mt-1">
                      #{item.consecutivo || 0}
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
              <li>Revisa la vista previa</li>
              <li>Usa etiquetas Office Depot 64413 (6.7x2.5cm, 30 por hoja)</li>
              <li>Haz clic en "Imprimir" para imprimir</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
