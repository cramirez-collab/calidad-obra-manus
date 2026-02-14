/**
 * Plantilla UNIFICADA de PDF para todos los reportes de ObjetivaOQC
 * Usa jsPDF para generar PDFs reales descargables
 * 
 * Formato estándar:
 * - Header azul con logo OBJETIVA a la izquierda
 * - Nombre del proyecto y fecha a la derecha
 * - Footer con paginación "Página X de Y"
 * - Colores corporativos: Azul #002C63, Verde #02B381
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { openPDFPreview } from "./pdfDownload";

// Colores corporativos Objetiva
export const COLORES = {
  AZUL: [0, 44, 99] as [number, number, number],
  VERDE: [2, 179, 129] as [number, number, number],
  GRIS: [128, 128, 128] as [number, number, number],
  NEGRO: [0, 0, 0] as [number, number, number],
  BLANCO: [255, 255, 255] as [number, number, number],
};

export interface PDFUnificadoOptions {
  titulo: string;
  proyectoNombre: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Crea un documento PDF con el header estándar de Objetiva
 */
export function crearPDFUnificado(options: PDFUnificadoOptions): jsPDF {
  const { titulo, proyectoNombre, orientation = 'portrait' } = options;
  
  const doc = new jsPDF({ 
    orientation, 
    unit: 'mm', 
    format: 'letter' 
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header azul
  doc.setFillColor(...COLORES.AZUL);
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  // Logo OBJETIVA
  doc.setTextColor(...COLORES.BLANCO);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('OBJETIVA', 15, 16);
  
  // Título y proyecto a la derecha
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${titulo} - ${proyectoNombre}`, pageWidth - 15, 12, { align: 'right' });
  
  // Fecha
  const fecha = new Date().toLocaleDateString('es-MX', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });
  doc.text(fecha, pageWidth - 15, 18, { align: 'right' });
  
  return doc;
}

/**
 * Agrega el footer estándar a todas las páginas del PDF
 */
export function agregarFooterUnificado(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORES.GRIS);
    doc.text(
      `OQC - Control de Calidad de Obra | Pagina ${i} de ${pageCount}`, 
      pageWidth / 2, 
      pageHeight - 10, 
      { align: 'center' }
    );
  }
}

/**
 * Descarga el PDF con el nombre estandarizado
 */
export function descargarPDFUnificado(
  doc: jsPDF, 
  tipo: string, 
  proyectoNombre: string
): void {
  agregarFooterUnificado(doc);
  
  const nombreLimpio = proyectoNombre.replace(/[^a-zA-Z0-9]/g, '_');
  const fecha = new Date().toISOString().split('T')[0];
  const nombreArchivo = `${tipo}_${nombreLimpio}_${fecha}.pdf`;
  
  openPDFPreview(doc);
}

/**
 * Agrega una tabla con el estilo estándar de Objetiva
 */
export function agregarTablaUnificada(
  doc: jsPDF,
  headers: string[],
  data: (string | number | null | undefined)[][],
  startY: number,
  options?: {
    columnStyles?: Record<number, { cellWidth?: number | 'auto' }>;
  }
): number {
  autoTable(doc, {
    startY,
    head: [headers],
    body: data.map(row => row.map(cell => cell ?? '-')),
    theme: 'striped',
    headStyles: {
      fillColor: COLORES.AZUL,
      textColor: COLORES.BLANCO,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORES.NEGRO,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    margin: { left: 15, right: 15 },
    columnStyles: options?.columnStyles,
  });
  
  // Retorna la posición Y después de la tabla
  return (doc as any).lastAutoTable?.finalY || startY + 20;
}

/**
 * Agrega un título de sección
 */
export function agregarSeccion(doc: jsPDF, titulo: string, yPos: number): number {
  doc.setTextColor(...COLORES.NEGRO);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 15, yPos);
  return yPos + 10;
}

/**
 * Agrega tarjetas de resumen (métricas)
 */
export function agregarResumen(
  doc: jsPDF,
  metricas: { label: string; value: string | number }[],
  yPos: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = (pageWidth - 30 - (metricas.length - 1) * 5) / metricas.length;
  let xPos = 15;
  
  metricas.forEach((metrica, index) => {
    // Fondo de la tarjeta
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(xPos, yPos, cardWidth, 25, 3, 3, 'F');
    
    // Valor
    doc.setTextColor(...COLORES.AZUL);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(String(metrica.value), xPos + cardWidth / 2, yPos + 12, { align: 'center' });
    
    // Label
    doc.setTextColor(...COLORES.GRIS);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(metrica.label, xPos + cardWidth / 2, yPos + 20, { align: 'center' });
    
    xPos += cardWidth + 5;
  });
  
  return yPos + 35;
}

/**
 * Verifica si necesita nueva página y la agrega si es necesario
 */
export function verificarNuevaPagina(doc: jsPDF, yPos: number, margen: number = 40): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  
  if (yPos > pageHeight - margen) {
    doc.addPage();
    return 35; // Posición inicial después del header
  }
  
  return yPos;
}
