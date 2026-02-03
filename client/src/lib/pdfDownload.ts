/**
 * Utilidad para forzar descarga de PDFs
 * Hace que el PDF se descargue y se abra en Acrobat Reader
 * en lugar de mostrarse en el navegador
 */

import jsPDF from 'jspdf';

/**
 * Fuerza la descarga de un PDF generado con jsPDF
 * El archivo se descargará y se abrirá en el lector PDF predeterminado
 * (Acrobat Reader, Preview, etc.)
 */
export function forceDownloadPDF(doc: jsPDF, filename: string): void {
  // Obtener el blob del PDF
  const pdfBlob = doc.output('blob');
  
  // Crear URL temporal
  const url = URL.createObjectURL(pdfBlob);
  
  // Crear enlace de descarga
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  
  // Forzar descarga
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Limpiar URL temporal después de un momento
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Descarga un PDF desde una URL o blob
 * Fuerza la descarga en lugar de abrir en el navegador
 */
export function downloadPDFFromBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Descarga un PDF desde una URL remota
 */
export async function downloadPDFFromURL(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    downloadPDFFromBlob(blob, filename);
  } catch (error) {
    console.error('Error descargando PDF:', error);
    throw error;
  }
}

/**
 * Convierte HTML a PDF y fuerza descarga
 * Útil para reportes generados dinámicamente
 */
export function downloadHTMLAsPDF(htmlContent: string, filename: string): void {
  // Crear iframe oculto para renderizar el HTML
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  document.body.appendChild(iframe);
  
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }
  
  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();
  
  // Esperar a que cargue y luego imprimir como PDF
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 500);
}
