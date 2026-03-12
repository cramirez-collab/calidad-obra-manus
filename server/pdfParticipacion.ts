/**
 * PDF de Participación - Generado server-side con PDFKit
 * Reporte de actividad por empresa-residente con penalizaciones
 */
import PDFDocument from 'pdfkit';

const COLORS = {
  primary: '#002C63',
  accent: '#02B381',
  white: '#FFFFFF',
  lightGray: '#f8f9fa',
  gray: '#666666',
  darkGray: '#333333',
  border: '#e5e7eb',
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
  greenBg: '#f0fdf4',
  redBg: '#fef2f2',
};

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return 'Nunca';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return dateStr;
  }
}

function formatMoney(amount: number): string {
  return '$' + amount.toLocaleString('es-MX', { minimumFractionDigits: 0 });
}

// Remove accents for PDF compatibility
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

interface ParticipacionRow {
  empresaNombre: string;
  residenteNombre: string;
  totalItems: number;
  diasConActividad: number;
  diasCumplimiento: number;
  diasIncumplimiento: number;
  diasSinParticipar: number;
  ultimaParticipacion: string;
  penalizacion: number;
  porcentajeCumplimiento: number;
  promedioDiario: number;
}

interface ParticipacionResumen {
  diasHabiles: number;
  fechaDesde: string;
  fechaHasta: string;
  totalEmpresas: number;
  empresasActivas: number;
  empresasInactivas: number;
  penalizacionTotal: number;
  minimoItemsDia: number;
  penalizacionPorDia: number;
}

export async function generarPDFParticipacion(
  empresasActivas: ParticipacionRow[],
  empresasSinParticipacion: ParticipacionRow[],
  resumen: ParticipacionResumen,
): Promise<Buffer> {
  const allRows = [...empresasActivas, ...empresasSinParticipacion];
  // Sort by penalizacion desc
  allRows.sort((a, b) => b.penalizacion - a.penalizacion);

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        bufferPages: true,
        info: {
          Title: 'Reporte de Participacion',
          Author: 'ObjetivaQC',
          Subject: `Participacion ${resumen.fechaDesde} a ${resumen.fechaHasta}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const marginL = 30;
      const marginR = 30;
      const contentW = pageW - marginL - marginR;

      // ===== HEADER =====
      doc.rect(0, 0, pageW, 60).fill(hexToRGB(COLORS.primary));
      doc.fillColor(COLORS.white).fontSize(16).font('Helvetica-Bold')
        .text('REPORTE DE PARTICIPACION', marginL, 15, { width: contentW * 0.6 });
      doc.fontSize(9).font('Helvetica')
        .text(`Periodo: ${formatDateShort(resumen.fechaDesde)} al ${formatDateShort(resumen.fechaHasta)} | ${resumen.diasHabiles} dias habiles`, marginL, 37, { width: contentW * 0.6 });

      // Right side header
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.white)
        .text(`Penalizacion Total: ${formatMoney(resumen.penalizacionTotal)}`, pageW - marginR - 200, 15, { width: 200, align: 'right' });
      doc.fontSize(8).font('Helvetica')
        .text(`Minimo: ${resumen.minimoItemsDia} items/dia | ${formatMoney(resumen.penalizacionPorDia)}/dia`, pageW - marginR - 200, 30, { width: 200, align: 'right' });
      doc.fontSize(8)
        .text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, pageW - marginR - 200, 42, { width: 200, align: 'right' });

      // ===== KPIs =====
      let y = 70;
      const kpiW = contentW / 4;
      const kpis = [
        { label: 'Empresas Activas', value: String(resumen.empresasActivas), sub: `de ${resumen.totalEmpresas} total`, color: COLORS.accent },
        { label: 'Sin Participacion', value: String(resumen.empresasInactivas), sub: 'empresas inactivas', color: COLORS.red },
        { label: 'Penalizacion Total', value: formatMoney(resumen.penalizacionTotal), sub: `${formatMoney(resumen.penalizacionPorDia)}/dia incumplido`, color: COLORS.amber },
        { label: 'Dias Habiles', value: String(resumen.diasHabiles), sub: 'en periodo evaluado', color: COLORS.primary },
      ];

      kpis.forEach((kpi, i) => {
        const x = marginL + i * kpiW + 4;
        const w = kpiW - 8;
        doc.roundedRect(x, y, w, 45, 4).lineWidth(0.5).strokeColor(COLORS.border).stroke();
        doc.rect(x, y, 3, 45).fill(hexToRGB(kpi.color));
        doc.fillColor(COLORS.gray).fontSize(7).font('Helvetica').text(removeAccents(kpi.label), x + 10, y + 6, { width: w - 15 });
        doc.fillColor(kpi.color).fontSize(14).font('Helvetica-Bold').text(kpi.value, x + 10, y + 16, { width: w - 15 });
        doc.fillColor(COLORS.gray).fontSize(6).font('Helvetica').text(removeAccents(kpi.sub), x + 10, y + 33, { width: w - 15 });
      });

      // ===== TABLE =====
      y = 125;
      const cols = [
        { label: '#', w: 20, align: 'center' as const },
        { label: 'Empresa', w: contentW * 0.18, align: 'left' as const },
        { label: 'Residente', w: contentW * 0.15, align: 'left' as const },
        { label: 'Items', w: 40, align: 'center' as const },
        { label: 'Prom/dia', w: 45, align: 'center' as const },
        { label: 'Cumpl.%', w: 50, align: 'center' as const },
        { label: 'Dias OK', w: 45, align: 'center' as const },
        { label: 'Dias Falta', w: 55, align: 'center' as const },
        { label: 'Ultima', w: 55, align: 'center' as const },
        { label: 'Penalizacion', w: 70, align: 'right' as const },
      ];

      // Table header
      const rowH = 16;
      doc.rect(marginL, y, contentW, rowH).fill(hexToRGB(COLORS.primary));
      let colX = marginL;
      cols.forEach(col => {
        doc.fillColor(COLORS.white).fontSize(7).font('Helvetica-Bold')
          .text(col.label, colX + 3, y + 4, { width: col.w - 6, align: col.align });
        colX += col.w;
      });
      y += rowH;

      // Table rows
      const maxRowsPerPage = 22;
      let rowCount = 0;

      const drawRow = (row: ParticipacionRow, idx: number) => {
        if (rowCount >= maxRowsPerPage) {
          doc.addPage();
          y = 30;
          rowCount = 0;
          // Redraw header
          doc.rect(marginL, y, contentW, rowH).fill(hexToRGB(COLORS.primary));
          let hx = marginL;
          cols.forEach(col => {
            doc.fillColor(COLORS.white).fontSize(7).font('Helvetica-Bold')
              .text(col.label, hx + 3, y + 4, { width: col.w - 6, align: col.align });
            hx += col.w;
          });
          y += rowH;
        }

        const isEven = idx % 2 === 0;
        const isZero = row.totalItems === 0;
        const bgColor = isZero ? COLORS.redBg : (isEven ? COLORS.lightGray : COLORS.white);
        doc.rect(marginL, y, contentW, rowH).fill(hexToRGB(bgColor));

        let cx = marginL;
        const textY = y + 4;

        // #
        doc.fillColor(COLORS.gray).fontSize(7).font('Helvetica')
          .text(String(idx + 1), cx + 3, textY, { width: cols[0].w - 6, align: 'center' });
        cx += cols[0].w;

        // Empresa
        doc.fillColor(COLORS.darkGray).fontSize(7).font('Helvetica-Bold')
          .text(removeAccents(row.empresaNombre).substring(0, 22), cx + 3, textY, { width: cols[1].w - 6 });
        cx += cols[1].w;

        // Residente
        doc.fillColor(COLORS.gray).fontSize(7).font('Helvetica')
          .text(removeAccents(row.residenteNombre).substring(0, 20), cx + 3, textY, { width: cols[2].w - 6 });
        cx += cols[2].w;

        // Items
        doc.fillColor(COLORS.darkGray).fontSize(7).font('Helvetica-Bold')
          .text(String(row.totalItems), cx + 3, textY, { width: cols[3].w - 6, align: 'center' });
        cx += cols[3].w;

        // Prom/dia
        doc.fillColor(COLORS.gray).fontSize(7).font('Helvetica')
          .text(String(row.promedioDiario), cx + 3, textY, { width: cols[4].w - 6, align: 'center' });
        cx += cols[4].w;

        // Cumpl.%
        const pctColor = row.porcentajeCumplimiento >= 70 ? COLORS.green : row.porcentajeCumplimiento >= 30 ? COLORS.amber : COLORS.red;
        doc.fillColor(pctColor).fontSize(7).font('Helvetica-Bold')
          .text(`${row.porcentajeCumplimiento}%`, cx + 3, textY, { width: cols[5].w - 6, align: 'center' });
        cx += cols[5].w;

        // Dias OK
        doc.fillColor(COLORS.green).fontSize(7).font('Helvetica')
          .text(String(row.diasCumplimiento), cx + 3, textY, { width: cols[6].w - 6, align: 'center' });
        cx += cols[6].w;

        // Dias Falta
        const faltaColor = row.diasIncumplimiento > 0 ? COLORS.red : COLORS.gray;
        doc.fillColor(faltaColor).fontSize(7).font('Helvetica-Bold')
          .text(String(row.diasIncumplimiento), cx + 3, textY, { width: cols[7].w - 6, align: 'center' });
        cx += cols[7].w;

        // Ultima
        const ultColor = row.diasSinParticipar > 7 ? COLORS.red : COLORS.gray;
        doc.fillColor(ultColor).fontSize(7).font('Helvetica')
          .text(formatDateShort(row.ultimaParticipacion), cx + 3, textY, { width: cols[8].w - 6, align: 'center' });
        cx += cols[8].w;

        // Penalizacion
        const penColor = row.penalizacion > 0 ? COLORS.red : COLORS.green;
        doc.fillColor(penColor).fontSize(7).font('Helvetica-Bold')
          .text(row.penalizacion > 0 ? formatMoney(row.penalizacion) : '$0', cx + 3, textY, { width: cols[9].w - 6, align: 'right' });

        y += rowH;
        rowCount++;
      };

      allRows.forEach((row, idx) => drawRow(row, idx));

      // Total row
      if (rowCount >= maxRowsPerPage) {
        doc.addPage();
        y = 30;
      }
      doc.rect(marginL, y, contentW, rowH + 2).fill(hexToRGB(COLORS.primary));
      doc.fillColor(COLORS.white).fontSize(8).font('Helvetica-Bold')
        .text('TOTAL', marginL + 3, y + 4, { width: 200 });
      
      const totalItems = allRows.reduce((s, r) => s + r.totalItems, 0);
      const totalCumpl = allRows.reduce((s, r) => s + r.diasCumplimiento, 0);
      const totalFalta = allRows.reduce((s, r) => s + r.diasIncumplimiento, 0);
      
      // Position total values
      let tx = marginL + cols[0].w + cols[1].w + cols[2].w;
      doc.text(String(totalItems), tx + 3, y + 4, { width: cols[3].w - 6, align: 'center' });
      tx += cols[3].w + cols[4].w + cols[5].w;
      doc.text(String(totalCumpl), tx + 3, y + 4, { width: cols[6].w - 6, align: 'center' });
      tx += cols[6].w;
      doc.text(String(totalFalta), tx + 3, y + 4, { width: cols[7].w - 6, align: 'center' });
      tx += cols[7].w + cols[8].w;
      doc.fontSize(9).text(formatMoney(resumen.penalizacionTotal), tx + 3, y + 3, { width: cols[9].w - 6, align: 'right' });

      y += rowH + 8;

      // ===== FOOTER NOTE =====
      if (y < pageH - 60) {
        doc.fillColor(COLORS.gray).fontSize(6).font('Helvetica')
          .text(
            removeAccents(`Regla: Cada empresa-residente debe registrar minimo ${resumen.minimoItemsDia} items por dia habil (lun-vie). Penalizacion: ${formatMoney(resumen.penalizacionPorDia)} por dia incumplido.`),
            marginL, y + 5, { width: contentW }
          );
      }

      // Page numbers
      const pages = doc.bufferedPageRange();
      for (let i = pages.start; i < pages.start + pages.count; i++) {
        doc.switchToPage(i);
        doc.fillColor(COLORS.gray).fontSize(6).font('Helvetica')
          .text(`ObjetivaQC | Pagina ${i + 1} de ${pages.count}`, marginL, pageH - 20, { width: contentW, align: 'center' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
