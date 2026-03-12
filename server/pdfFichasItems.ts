/**
 * PDF Masivo de Fichas de Items
 * Una ficha por hoja, ordenadas por numero de unidad
 */
import PDFDocument from 'pdfkit';

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
  greenBg: '#f0fdf4',
  amberBg: '#fffbeb',
  redBg: '#fef2f2',
};

function formatDate(d: Date | string | null): string {
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

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

interface ItemFicha {
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
  fotoAntesUrl: string | null;
  fotoDespuesUrl: string | null;
  comentarioResidente: string | null;
  comentarioSupervisor: string | null;
}

export async function generarPDFFichasItems(items: ItemFicha[], proyectoNombre: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'portrait',
        margins: { top: 30, bottom: 30, left: 35, right: 35 },
        bufferPages: true,
        info: {
          Title: `Fichas de Items - ${proyectoNombre}`,
          Author: 'ObjetivaQC',
          Subject: 'Reporte masivo de fichas de items',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const startX = doc.page.margins.left;

      items.forEach((item, idx) => {
        if (idx > 0) doc.addPage();

        let y = doc.page.margins.top;

        // === HEADER BAR ===
        doc.save();
        doc.rect(startX, y, pageW, 36).fill(COLORS.primary);
        doc.restore();

        doc.fontSize(14).fillColor(COLORS.white)
          .text(`FICHA #${item.numeroInterno || item.id}`, startX + 10, y + 5, { width: pageW * 0.5 });
        doc.fontSize(9).fillColor(COLORS.white)
          .text(item.codigo, startX + 10, y + 22, { width: pageW * 0.5 });

        // Status badge
        const statusLabel = getStatusLabel(item.status);
        const statusColor = getStatusColor(item.status);
        const badgeW = 120;
        const badgeX = startX + pageW - badgeW - 10;
        doc.save();
        doc.roundedRect(badgeX, y + 8, badgeW, 20, 10).fill(statusColor);
        doc.restore();
        doc.fontSize(9).fillColor(COLORS.white)
          .text(statusLabel, badgeX, y + 12, { width: badgeW, align: 'center' });

        y += 44;

        // === PROYECTO & UNIDAD ===
        doc.save();
        doc.rect(startX, y, pageW, 22).fill('#f1f5f9');
        doc.restore();
        doc.fontSize(9).fillColor(COLORS.primary)
          .text(`Proyecto: ${proyectoNombre}`, startX + 8, y + 5, { width: pageW * 0.5 });
        doc.fontSize(9).fillColor(COLORS.primary)
          .text(`Unidad: ${item.unidadNombre}${item.unidadNivel != null ? ` (Nivel ${item.unidadNivel})` : ''}`, startX + pageW * 0.5, y + 5, { width: pageW * 0.5 });
        y += 28;

        // === TITULO ===
        doc.fontSize(12).fillColor(COLORS.darkGray).text(item.titulo, startX + 4, y, { width: pageW - 8 });
        y = doc.y + 6;

        // === DESCRIPCION ===
        if (item.descripcion) {
          doc.fontSize(9).fillColor(COLORS.gray).text(item.descripcion, startX + 4, y, { width: pageW - 8 });
          y = doc.y + 8;
        }

        // === INFO GRID (2 columns) ===
        const drawField = (label: string, value: string, x: number, yPos: number, w: number): number => {
          doc.fontSize(7).fillColor(COLORS.gray).text(label, x, yPos, { width: w });
          doc.fontSize(9).fillColor(COLORS.darkGray).text(value || '—', x, yPos + 10, { width: w });
          return yPos + 26;
        };

        const colW = (pageW - 16) / 2;
        const col1X = startX + 4;
        const col2X = startX + colW + 12;

        // Separator
        doc.save();
        doc.moveTo(startX, y).lineTo(startX + pageW, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
        doc.restore();
        y += 6;

        doc.fontSize(10).fillColor(COLORS.primary).text('DATOS DEL ITEM', startX + 4, y);
        y += 16;

        let y1 = y, y2 = y;
        y1 = drawField('EMPRESA', item.empresaNombre, col1X, y1, colW);
        y2 = drawField('ESPECIALIDAD', item.especialidadNombre, col2X, y2, colW);
        y1 = drawField('ATRIBUTO', item.atributoNombre, col1X, y1, colW);
        y2 = drawField('DEFECTO', item.defectoNombre, col2X, y2, colW);
        y1 = drawField('ESPACIO', item.espacioNombre, col1X, y1, colW);
        y2 = drawField('UBICACION', item.ubicacionDetalle || '—', col2X, y2, colW);
        y = Math.max(y1, y2) + 4;

        // Separator
        doc.save();
        doc.moveTo(startX, y).lineTo(startX + pageW, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
        doc.restore();
        y += 6;

        doc.fontSize(10).fillColor(COLORS.primary).text('TRAZABILIDAD', startX + 4, y);
        y += 16;

        y1 = y; y2 = y;
        y1 = drawField('CREADO POR', item.creadoPorNombre, col1X, y1, colW);
        y2 = drawField('ASIGNADO A', item.asignadoANombre, col2X, y2, colW);
        y1 = drawField('RESIDENTE', item.residenteNombre, col1X, y1, colW);
        y2 = drawField('APROBADO POR', item.aprobadoPorNombre, col2X, y2, colW);
        y = Math.max(y1, y2) + 4;

        // Separator
        doc.save();
        doc.moveTo(startX, y).lineTo(startX + pageW, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
        doc.restore();
        y += 6;

        doc.fontSize(10).fillColor(COLORS.primary).text('FECHAS', startX + 4, y);
        y += 16;

        y1 = y; y2 = y;
        y1 = drawField('FECHA CREACION', formatDate(item.fechaCreacion), col1X, y1, colW);
        y2 = drawField('FECHA FOTO DESPUES', formatDate(item.fechaFotoDespues), col2X, y2, colW);
        y1 = drawField('FECHA APROBACION', formatDate(item.fechaAprobacion), col1X, y1, colW);
        y = Math.max(y1, y2) + 4;

        // === COMENTARIOS ===
        if (item.comentarioResidente || item.comentarioSupervisor) {
          doc.save();
          doc.moveTo(startX, y).lineTo(startX + pageW, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
          doc.restore();
          y += 6;

          doc.fontSize(10).fillColor(COLORS.primary).text('COMENTARIOS', startX + 4, y);
          y += 16;

          if (item.comentarioResidente) {
            doc.fontSize(7).fillColor(COLORS.gray).text('COMENTARIO RESIDENTE', startX + 4, y);
            y += 10;
            doc.fontSize(8.5).fillColor(COLORS.darkGray).text(item.comentarioResidente, startX + 4, y, { width: pageW - 8 });
            y = doc.y + 8;
          }
          if (item.comentarioSupervisor) {
            doc.fontSize(7).fillColor(COLORS.gray).text('COMENTARIO SUPERVISOR', startX + 4, y);
            y += 10;
            doc.fontSize(8.5).fillColor(COLORS.darkGray).text(item.comentarioSupervisor, startX + 4, y, { width: pageW - 8 });
            y = doc.y + 8;
          }
        }

        // === FOTOS SECTION ===
        const fotoY = Math.max(y + 8, doc.page.height - doc.page.margins.bottom - 200);
        if (fotoY < doc.page.height - doc.page.margins.bottom - 40) {
          doc.save();
          doc.moveTo(startX, fotoY - 4).lineTo(startX + pageW, fotoY - 4).strokeColor(COLORS.border).lineWidth(0.5).stroke();
          doc.restore();

          doc.fontSize(10).fillColor(COLORS.primary).text('EVIDENCIA FOTOGRAFICA', startX + 4, fotoY);
          const photoBoxW = (pageW - 20) / 2;
          const photoBoxH = 150;
          const photoY = fotoY + 16;

          // Foto antes placeholder
          doc.save();
          doc.roundedRect(startX + 4, photoY, photoBoxW, photoBoxH, 4).strokeColor(COLORS.border).lineWidth(1).stroke();
          doc.restore();
          doc.fontSize(8).fillColor(COLORS.gray)
            .text('FOTO ANTES', startX + 4, photoY + photoBoxH / 2 - 10, { width: photoBoxW, align: 'center' });
          if (item.fotoAntesUrl) {
            doc.fontSize(7).fillColor(COLORS.primary)
              .text('(Ver en app)', startX + 4, photoY + photoBoxH / 2 + 4, { width: photoBoxW, align: 'center' });
          } else {
            doc.fontSize(7).fillColor(COLORS.gray)
              .text('Sin foto', startX + 4, photoY + photoBoxH / 2 + 4, { width: photoBoxW, align: 'center' });
          }

          // Foto despues placeholder
          const foto2X = startX + photoBoxW + 16;
          doc.save();
          doc.roundedRect(foto2X, photoY, photoBoxW, photoBoxH, 4).strokeColor(COLORS.border).lineWidth(1).stroke();
          doc.restore();
          doc.fontSize(8).fillColor(COLORS.gray)
            .text('FOTO DESPUES', foto2X, photoY + photoBoxH / 2 - 10, { width: photoBoxW, align: 'center' });
          if (item.fotoDespuesUrl) {
            doc.fontSize(7).fillColor(COLORS.green)
              .text('(Ver en app)', foto2X, photoY + photoBoxH / 2 + 4, { width: photoBoxW, align: 'center' });
          } else {
            doc.fontSize(7).fillColor(COLORS.gray)
              .text('Sin foto', foto2X, photoY + photoBoxH / 2 + 4, { width: photoBoxW, align: 'center' });
          }
        }
      });

      // Footer on all pages
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).fillColor(COLORS.gray)
          .text(
            `ObjetivaQC — Fichas de Items — ${proyectoNombre} — ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} — Pag ${i + 1}/${totalPages}`,
            doc.page.margins.left,
            doc.page.height - 22,
            { width: pageW, align: 'center' }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
