/**
 * Utilidad para forzar descarga de PDFs en Acrobat Reader
 * ========================================================
 * Fuerza que Chrome descargue el PDF en lugar de abrirlo
 * en el visor integrado, para que se abra en Acrobat Reader
 * o el lector PDF predeterminado del dispositivo.
 */

import jsPDF from 'jspdf';

/**
 * Fuerza la descarga de un PDF generado con jsPDF
 * Usa múltiples técnicas para asegurar que Chrome descargue el archivo
 */
export function forceDownloadPDF(doc: jsPDF, filename: string): void {
  const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  
  // Método 1: Usar output con tipo 'blob' y crear enlace de descarga
  const pdfBlob = doc.output('blob');
  
  // Crear blob con tipo MIME específico para forzar descarga
  const downloadBlob = new Blob([pdfBlob], { 
    type: 'application/octet-stream' // Tipo genérico que fuerza descarga
  });
  
  // Crear URL temporal
  const url = URL.createObjectURL(downloadBlob);
  
  // Crear enlace de descarga con atributo download
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  link.setAttribute('download', finalFilename);
  link.style.display = 'none';
  
  // Agregar al DOM, hacer clic y remover
  document.body.appendChild(link);
  link.click();
  
  // Limpiar después de un momento
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 500);
}

/**
 * Descarga un PDF desde un Blob
 * Fuerza la descarga en lugar de abrir en el navegador
 */
export function downloadPDFFromBlob(blob: Blob, filename: string): void {
  const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  
  // Crear blob con tipo que fuerza descarga
  const downloadBlob = new Blob([blob], { 
    type: 'application/octet-stream'
  });
  
  const url = URL.createObjectURL(downloadBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  link.setAttribute('download', finalFilename);
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 500);
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
 * Método alternativo: Guardar PDF usando FileSaver-like approach
 * Para máxima compatibilidad con dispositivos móviles
 */
export function savePDFToDevice(doc: jsPDF, filename: string): void {
  const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  
  // En móviles, usar el método nativo de jsPDF con save()
  // que tiene mejor compatibilidad
  try {
    // Intentar usar el método save de jsPDF directamente
    doc.save(finalFilename);
  } catch {
    // Fallback al método de blob
    forceDownloadPDF(doc, finalFilename);
  }
}

/**
 * Abre el PDF en vista previa (nueva pestaña) sin descargar automáticamente.
 * El usuario decide si descarga desde el visor del navegador.
 */
export function openPDFPreview(doc: jsPDF, _filename?: string): void {
  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(new Blob([pdfBlob], { type: 'application/pdf' }));
  window.open(blobUrl, '_blank');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
}

/**
 * Descarga PDF con máxima compatibilidad
 * Detecta el dispositivo y usa el mejor método
 */
export function downloadPDFBestMethod(doc: jsPDF, filename: string): void {
  const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  
  // Detectar si es móvil
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // En móviles, usar save() directo de jsPDF que tiene mejor compatibilidad
    // con los manejadores de archivos del sistema
    doc.save(finalFilename);
  } else {
    // En desktop, forzar descarga con blob
    forceDownloadPDF(doc, finalFilename);
  }
}
