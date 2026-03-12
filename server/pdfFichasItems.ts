/**
 * PDF Masivo de Fichas de Items — Version completa
 * Una ficha por hoja con: fotos reales, chat, comentarios, trazabilidad, fechas
 */
import PDFDocument from 'pdfkit';
import https from 'https';
import http from 'http';

const COLORS = {
  primary: '#002C63',
  white: '#FFFFFF',
  lightGray: '#f8f9fa',
  gray: '#666666',
  darkGray: '#333333',
  border: '#e5e7eb',
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
  blueBg: '#eff6ff',
  greenBg: '#f0fdf4',
  amberBg: '#fffbeb',
  redBg: '#fef2f2',
  chatBg: '#f1f5f9',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(d: Date | string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pendiente_foto_despues: 'Pendiente Foto',
    pendiente_aprobacion: 'Pendiente Aprobacion',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado',
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  if (status === 'aprobado') return COLORS.green;
  if (status === 'rechazado') return COLORS.red;
  if (status === 'pendiente_aprobacion') return COLORS.amber;
  return COLORS.gray;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 8000);
    const protocol = url.startsWith('https') ? https : http;
    try {
      protocol.get(url, { timeout: 7000 }, (res) => {
        if (res.statusCode !== 200) { clearTimeout(timeout); resolve(null); return; }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => { clearTimeout(timeout); resolve(Buffer.concat(chunks)); });
        res.on('error', () => { clearTimeout(timeout); resolve(null); });
      }).on('error', () => { clearTimeout(timeout); resolve(null); });
    } catch { clearTimeout(timeout); resolve(null); }
  });
}

export interface ItemFichaCompleta {
  id: number;
  codigo: string;
  numeroInterno: number;
  titulo: string;
  descripcion: string | null;
  ubicacionDetalle: string | null;
  status: string;
  empresaNombre: string;
  unidadNombre: string;
  unidadNivel: number | null;
  especialidadNombre: string;
  atributoNombre: string;
  defectoNombre: string;
  espacioNombre: string;
  residenteNombre: string;
  creadoPorNombre: string;
  asignadoANombre: string;
  aprobadoPorNombre: string;
  fechaCreacion: Date | string | null;
  fechaFotoDespues: Date | string | null;
  fechaAprobacion: Date | string | null;
  fechaCierre: Date | string | null;
  fotoAntesUrl: string | null;
  fotoAntesMarcadaUrl: string | null;
  fotoDespuesUrl: string | null;
  comentarioResidente: string | null;
  comentarioSupervisor: string | null;
  comentarioJefeResidente: string | null;
  // Chat messages
  mensajes: Array<{
    texto: string;
    usuarioNombre: string;
    tipo: string;
    createdAt: Date | string;
  }>;
  // History/traceability
  historial: Array<{
    accion: string;
    descripcion: string;
    usuarioNombre: string;
    createdAt: Date | string;
  }>;
}

export async function generarPDFFichasItems(items: ItemFichaCompleta[], proyectoNombre: string): Promise<Buffer> {
  // Pre-fetch all images in parallel (batch of 5 at a time to avoid overwhelming)
  const imageCache = new Map<string, Buffer | null>();
  const allUrls = items.flatMap(item => [item.fotoAntesUrl, item.fotoAntesMarcadaUrl, item.fotoDespuesUrl].filter(Boolean)) as string[];
  const uniqueUrls = Array.from(new Set(allUrls));
  
  for (let i = 0; i < uniqueUrls.length; i += 5) {
    const batch = uniqueUrls.slice(i, i + 5);
    const results = await Promise.all(batch.map(url => fetchImageBuffer(url)));
    batch.forEach((url, idx) => imageCache.set(url, results[idx]));
  }

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'portrait',
        margins: { top: 28, bottom: 28, left: 32, right: 32 },
        bufferPages: true,
        info: {
          Title: `Fichas de Items - ${proyectoNombre}`,
          Author: 'ObjetivaQC',
          Subject: 'Reporte masivo de fichas de items con evidencia',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const startX = doc.page.margins.left;
      const pageBottom = doc.page.height - doc.page.margins.bottom - 20;

      const ensureSpace = (needed: number) => {
        if (doc.y + needed > pageBottom) {
          doc.addPage();
          return doc.page.margins.top;
        }
        return doc.y;
      };

      const drawSectionTitle = (title: string) => {
        const y = ensureSpace(20);
        doc.save();
        doc.moveTo(startX, y).lineTo(startX + pageW, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
        doc.restore();
        doc.fontSize(9).fillColor(COLORS.primary).text(title, startX + 4, y + 4, { width: pageW - 8 });
        doc.y = y + 18;
      };

      const drawField = (label: string, value: string, x: number, yPos: number, w: number): number => {
        doc.fontSize(6.5).fillColor(COLORS.gray).text(label, x, yPos, { width: w });
        doc.fontSize(8.5).fillColor(COLORS.darkGray).text(value || '—', x, yPos + 9, { width: w });
        return yPos + 24;
      };

      const drawPhoto = (buffer: Buffer | null, label: string, x: number, y: number, w: number, h: number, hasUrl: boolean) => {
        doc.save();
        doc.roundedRect(x, y, w, h, 3).strokeColor(COLORS.border).lineWidth(0.5).stroke();
        doc.restore();

        if (buffer) {
          try {
            doc.save();
            doc.roundedRect(x + 1, y + 1, w - 2, h - 2, 3).clip();
            doc.image(buffer, x + 1, y + 1, { width: w - 2, height: h - 2, fit: [w - 2, h - 2], align: 'center', valign: 'center' });
            doc.restore();
          } catch {
            doc.fontSize(7).fillColor(COLORS.gray).text('Error cargando imagen', x, y + h / 2 - 5, { width: w, align: 'center' });
          }
        } else {
          doc.fontSize(7).fillColor(COLORS.gray).text(hasUrl ? 'Imagen no disponible' : 'Sin foto', x, y + h / 2 - 5, { width: w, align: 'center' });
        }

        // Label below photo
        doc.fontSize(6.5).fillColor(COLORS.primary).text(label, x, y + h + 2, { width: w, align: 'center' });
      };

      items.forEach((item, idx) => {
        if (idx > 0) doc.addPage();

        let y = doc.page.margins.top;

        // === HEADER BAR ===
        doc.save();
        doc.rect(startX, y, pageW, 32).fill(COLORS.primary);
        doc.restore();

        doc.fontSize(13).fillColor(COLORS.white)
          .text(`FICHA #${item.numeroInterno || item.id}`, startX + 8, y + 4, { width: pageW * 0.55 });
        doc.fontSize(8).fillColor(COLORS.white)
          .text(item.codigo, startX + 8, y + 20, { width: pageW * 0.55 });

        // Status badge
        const statusLabel = getStatusLabel(item.status);
        const statusColor = getStatusColor(item.status);
        const badgeW = 110;
        const badgeX = startX + pageW - badgeW - 8;
        doc.save();
        doc.roundedRect(badgeX, y + 6, badgeW, 20, 10).fill(statusColor);
        doc.restore();
        doc.fontSize(8).fillColor(COLORS.white)
          .text(statusLabel, badgeX, y + 10, { width: badgeW, align: 'center' });

        y += 38;

        // === PROYECTO & UNIDAD BAR ===
        doc.save();
        doc.rect(startX, y, pageW, 18).fill('#f1f5f9');
        doc.restore();
        doc.fontSize(8).fillColor(COLORS.primary)
          .text(`Proyecto: ${proyectoNombre}`, startX + 6, y + 4, { width: pageW * 0.5 });
        doc.fontSize(8).fillColor(COLORS.primary)
          .text(`Unidad: ${item.unidadNombre}${item.unidadNivel != null ? ` (Nivel ${item.unidadNivel})` : ''}`, startX + pageW * 0.5, y + 4, { width: pageW * 0.5 });
        y += 22;

        // === TITULO ===
        doc.fontSize(11).fillColor(COLORS.darkGray).text(item.titulo, startX + 4, y, { width: pageW - 8 });
        y = doc.y + 3;

        // === DESCRIPCION ===
        if (item.descripcion) {
          doc.fontSize(8).fillColor(COLORS.gray).text(item.descripcion, startX + 4, y, { width: pageW - 8 });
          y = doc.y + 4;
        }

        doc.y = y;

        // === DATOS DEL ITEM ===
        drawSectionTitle('DATOS DEL ITEM');
        const colW = (pageW - 12) / 2;
        const col1X = startX + 4;
        const col2X = startX + colW + 8;

        let y1 = doc.y, y2 = doc.y;
        y1 = drawField('EMPRESA', item.empresaNombre, col1X, y1, colW);
        y2 = drawField('ESPECIALIDAD', item.especialidadNombre, col2X, y2, colW);
        y1 = drawField('ATRIBUTO', item.atributoNombre, col1X, y1, colW);
        y2 = drawField('DEFECTO', item.defectoNombre, col2X, y2, colW);
        y1 = drawField('ESPACIO', item.espacioNombre, col1X, y1, colW);
        y2 = drawField('UBICACION', item.ubicacionDetalle || '—', col2X, y2, colW);
        doc.y = Math.max(y1, y2);

        // === TRAZABILIDAD ===
        drawSectionTitle('TRAZABILIDAD');
        y1 = doc.y; y2 = doc.y;
        y1 = drawField('CREADO POR', item.creadoPorNombre, col1X, y1, colW);
        y2 = drawField('ASIGNADO A (CORRIGE)', item.asignadoANombre, col2X, y2, colW);
        y1 = drawField('RESIDENTE', item.residenteNombre, col1X, y1, colW);
        y2 = drawField('APROBADO POR', item.aprobadoPorNombre, col2X, y2, colW);
        doc.y = Math.max(y1, y2);

        // === FECHAS ===
        drawSectionTitle('FECHAS');
        y1 = doc.y; y2 = doc.y;
        y1 = drawField('CREACION', formatDateShort(item.fechaCreacion), col1X, y1, colW);
        y2 = drawField('FOTO DESPUES', formatDateShort(item.fechaFotoDespues), col2X, y2, colW);
        y1 = drawField('APROBACION', formatDateShort(item.fechaAprobacion), col1X, y1, colW);
        y2 = drawField('CIERRE', formatDateShort(item.fechaCierre), col2X, y2, colW);
        doc.y = Math.max(y1, y2);

        // === COMENTARIOS ===
        if (item.comentarioResidente || item.comentarioSupervisor || item.comentarioJefeResidente) {
          drawSectionTitle('COMENTARIOS');
          if (item.comentarioResidente) {
            doc.fontSize(6.5).fillColor(COLORS.gray).text('RESIDENTE:', startX + 4, doc.y, { continued: true });
            doc.fontSize(8).fillColor(COLORS.darkGray).text(` ${item.comentarioResidente}`, { width: pageW - 8 });
            doc.y += 3;
          }
          if (item.comentarioSupervisor) {
            doc.fontSize(6.5).fillColor(COLORS.gray).text('SUPERVISOR:', startX + 4, doc.y, { continued: true });
            doc.fontSize(8).fillColor(COLORS.darkGray).text(` ${item.comentarioSupervisor}`, { width: pageW - 8 });
            doc.y += 3;
          }
          if (item.comentarioJefeResidente) {
            doc.fontSize(6.5).fillColor(COLORS.gray).text('JEFE RESIDENTE:', startX + 4, doc.y, { continued: true });
            doc.fontSize(8).fillColor(COLORS.darkGray).text(` ${item.comentarioJefeResidente}`, { width: pageW - 8 });
            doc.y += 3;
          }
        }

        // === EVIDENCIA FOTOGRAFICA ===
        const photoH = 160;
        ensureSpace(photoH + 30);
        drawSectionTitle('EVIDENCIA FOTOGRAFICA');

        const photoW = (pageW - 16) / 2;
        const photoY = doc.y;

        // Use marcada if available, otherwise original
        const fotoAntesKey = item.fotoAntesMarcadaUrl || item.fotoAntesUrl;
        const fotoAntesBuffer = fotoAntesKey ? (imageCache.get(fotoAntesKey) || null) : null;
        const fotoDespuesBuffer = item.fotoDespuesUrl ? (imageCache.get(item.fotoDespuesUrl) || null) : null;

        drawPhoto(fotoAntesBuffer, 'ANTES', startX + 4, photoY, photoW, photoH, !!item.fotoAntesUrl);
        drawPhoto(fotoDespuesBuffer, 'DESPUES', startX + photoW + 12, photoY, photoW, photoH, !!item.fotoDespuesUrl);

        doc.y = photoY + photoH + 16;

        // === CHAT / MENSAJES ===
        if (item.mensajes && item.mensajes.length > 0) {
          const textMsgs = item.mensajes.filter(m => m.tipo === 'texto' || m.tipo === 'audio');
          if (textMsgs.length > 0) {
            ensureSpace(40);
            drawSectionTitle(`CHAT (${textMsgs.length} mensajes)`);

            textMsgs.slice(0, 15).forEach((msg) => {
              ensureSpace(20);
              doc.save();
              const msgY = doc.y;
              doc.roundedRect(startX + 4, msgY, pageW - 8, 1, 0).fill(COLORS.chatBg);
              doc.restore();

              doc.fontSize(6.5).fillColor(COLORS.primary).text(msg.usuarioNombre, startX + 6, doc.y, { continued: true });
              doc.fontSize(6).fillColor(COLORS.gray).text(`  ${formatDate(msg.createdAt)}`);
              doc.fontSize(7.5).fillColor(COLORS.darkGray).text(msg.texto || (msg.tipo === 'audio' ? '[Nota de voz]' : '[Foto]'), startX + 6, doc.y, { width: pageW - 16 });
              doc.y += 4;
            });

            if (textMsgs.length > 15) {
              doc.fontSize(7).fillColor(COLORS.gray).text(`... y ${textMsgs.length - 15} mensajes mas`, startX + 6, doc.y);
              doc.y += 4;
            }
          }
        }

        // === HISTORIAL DE TRAZABILIDAD ===
        if (item.historial && item.historial.length > 0) {
          ensureSpace(40);
          drawSectionTitle(`HISTORIAL (${item.historial.length} eventos)`);

          item.historial.slice(0, 10).forEach((h) => {
            ensureSpace(16);
            doc.fontSize(6.5).fillColor(COLORS.primary).text(`${formatDate(h.createdAt)}`, startX + 6, doc.y, { continued: true });
            doc.fontSize(7).fillColor(COLORS.darkGray).text(`  ${h.usuarioNombre}: ${h.descripcion || h.accion}`, { width: pageW - 16 });
            doc.y += 2;
          });

          if (item.historial.length > 10) {
            doc.fontSize(7).fillColor(COLORS.gray).text(`... y ${item.historial.length - 10} eventos mas`, startX + 6, doc.y);
          }
        }
      });

      // Footer on all pages
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(6.5).fillColor(COLORS.gray)
          .text(
            `ObjetivaQC — Fichas de Items — ${proyectoNombre} — ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} — Pag ${i + 1}/${totalPages}`,
            doc.page.margins.left,
            doc.page.height - 20,
            { width: pageW, align: 'center' }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
