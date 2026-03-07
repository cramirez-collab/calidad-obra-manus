import html2pdf from 'html2pdf.js';

/**
 * Genera un PDF real (.pdf) a partir de contenido HTML y lo abre/comparte.
 * @param htmlContent - El HTML completo del reporte (sin scripts)
 * @param fileName - Nombre del archivo PDF (sin extensión)
 * @param action - 'open' para abrir, 'share' para compartir, 'both' para abrir con opción de compartir
 */
export async function generarYCompartirPDF(
  htmlContent: string,
  fileName: string,
  action: 'open' | 'share' | 'both' = 'both'
): Promise<void> {
  // Crear un contenedor temporal invisible para renderizar el HTML
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1100px';
  container.style.background = 'white';
  container.style.zIndex = '-1';

  // Extraer solo el body content del HTML
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);

  if (styleMatch) {
    const styleEl = document.createElement('style');
    styleEl.textContent = styleMatch[1];
    container.appendChild(styleEl);
  }

  const contentDiv = document.createElement('div');
  contentDiv.innerHTML = bodyMatch ? bodyMatch[1] : htmlContent;
  // Remover scripts del contenido
  contentDiv.querySelectorAll('script').forEach(s => s.remove());
  container.appendChild(contentDiv);

  document.body.appendChild(container);

  try {
    // Esperar a que las imágenes carguen
    const images = container.querySelectorAll('img');
    if (images.length > 0) {
      await Promise.allSettled(
        Array.from(images).map(img =>
          new Promise<void>((resolve) => {
            if (img.complete) { resolve(); return; }
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 3000);
          })
        )
      );
    }

    // Generar PDF con html2pdf.js
    const opt = {
      margin: [8, 8, 8, 8] as [number, number, number, number],
      filename: `${fileName}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        width: 1100,
      },
      jsPDF: {
        unit: 'mm' as const,
        format: 'a4',
        orientation: 'landscape' as const,
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    const pdfBlob: Blob = await html2pdf()
      .set(opt)
      .from(contentDiv)
      .outputPdf('blob');

    const safeName = fileName.replace(/[^a-zA-Z0-9_\-\s]/g, '_');
    const pdfFile = new File([pdfBlob], `${safeName}.pdf`, { type: 'application/pdf' });

    if (action === 'share' || action === 'both') {
      // Intentar compartir como PDF
      if (navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
        try {
          await navigator.share({
            title: fileName,
            files: [pdfFile],
          });
          return;
        } catch (e: any) {
          if (e.name === 'AbortError') return;
          // Si falla compartir, abrir el PDF
        }
      }
    }

    // Abrir el PDF en nueva pestaña
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 30000);

  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Genera un PDF blob desde HTML (para uso programático)
 */
export async function htmlToPDFBlob(
  htmlContent: string,
  orientation: 'landscape' | 'portrait' = 'landscape'
): Promise<Blob> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1100px';
  container.style.background = 'white';
  container.style.zIndex = '-1';

  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);

  if (styleMatch) {
    const styleEl = document.createElement('style');
    styleEl.textContent = styleMatch[1];
    container.appendChild(styleEl);
  }

  const contentDiv = document.createElement('div');
  contentDiv.innerHTML = bodyMatch ? bodyMatch[1] : htmlContent;
  contentDiv.querySelectorAll('script').forEach(s => s.remove());
  container.appendChild(contentDiv);

  document.body.appendChild(container);

  try {
    const images = container.querySelectorAll('img');
    if (images.length > 0) {
      await Promise.allSettled(
        Array.from(images).map(img =>
          new Promise<void>((resolve) => {
            if (img.complete) { resolve(); return; }
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 3000);
          })
        )
      );
    }

    const opt = {
      margin: [8, 8, 8, 8] as [number, number, number, number],
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        width: 1100,
      },
      jsPDF: {
        unit: 'mm' as const,
        format: 'a4',
        orientation,
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    const pdfBlob: Blob = await html2pdf()
      .set(opt)
      .from(contentDiv)
      .outputPdf('blob');

    return pdfBlob;
  } finally {
    document.body.removeChild(container);
  }
}
