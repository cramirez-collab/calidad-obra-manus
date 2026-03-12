/**
 * PDF Masivo de Reporte de Pruebas
 * Ordenado por unidad, con estatus pasa/no pasa por prueba
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
  red: '#dc2626',
  amber: '#d97706',
  greenBg: '#f0fdf4',
  redBg: '#fef2f2',
  amberBg: '#fffbeb',
  grayBg: '#f3f4f6',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface PruebaResultado {
  pruebaId: number;
  pruebaNombre: string;
  pruebaSistema: string;
  intento: string;
  estado: string; // verde, rojo, na, pendiente
  observacion: string | null;
  evaluadoPorNombre: string | null;
  evaluadoAt: Date | string | null;
}

interface UnidadPruebas {
  unidadId: number;
  unidadNombre: string;
  unidadNivel: number | null;
  resultados: PruebaResultado[];
}

interface PruebasReporteConfig {
  proyectoNombre: string;
  totalUnidades: number;
  totalPruebas: number;
  fechaGeneracion: string;
}

function getEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    verde: 'PASA',
    rojo: 'NO PASA',
    na: 'N/A',
    pendiente: 'PENDIENTE',
  };
  return labels[estado] || estado;
}

function getEstadoColor(estado: string): string {
  if (estado === 'verde') return COLORS.green;
  if (estado === 'rojo') return COLORS.red;
  if (estado === 'na') return COLORS.gray;
  return COLORS.amber;
}

function getEstadoBg(estado: string): string {
  if (estado === 'verde') return COLORS.greenBg;
  if (estado === 'rojo') return COLORS.redBg;
  if (estado === 'na') return COLORS.grayBg;
  return COLORS.amberBg;
}

export async function generarPDFPruebasReporte(
  unidadesPruebas: UnidadPruebas[],
  config: PruebasReporteConfig
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 30, bottom: 30, left: 35, right: 35 },
        bufferPages: true,
        info: {
          Title: `Reporte de Pruebas - ${config.proyectoNombre}`,
          Author: 'ObjetivaQC',
          Subject: 'Reporte masivo de pruebas por unidad',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const startX = doc.page.margins.left;

      // === COVER PAGE ===
      let y = doc.page.margins.top + 80;

      doc.fontSize(24).fillColor(COLORS.primary).text('REPORTE DE PRUEBAS', startX, y, { width: pageW, align: 'center' });
      y += 36;
      doc.fontSize(16).fillColor(COLORS.gray).text(config.proyectoNombre, startX, y, { width: pageW, align: 'center' });
      y += 30;
      doc.fontSize(11).fillColor(COLORS.gray).text(`Generado: ${config.fechaGeneracion}`, startX, y, { width: pageW, align: 'center' });
      y += 40;

      // Summary boxes
      const boxW = 160;
      const boxH = 60;
      const gap = 20;
      const totalBoxW = boxW * 3 + gap * 2;
      const boxStartX = startX + (pageW - totalBoxW) / 2;

      const summaryItems = [
        { label: 'UNIDADES EVALUADAS', value: String(config.totalUnidades), color: COLORS.primary },
        { label: 'PRUEBAS EN CATALOGO', value: String(config.totalPruebas), color: COLORS.primary },
        {
          label: 'TASA DE APROBACION',
          value: (() => {
            let total = 0, pasa = 0;
            unidadesPruebas.forEach(u => u.resultados.forEach(r => {
              if (r.estado !== 'na' && r.estado !== 'pendiente') { total++; if (r.estado === 'verde') pasa++; }
            }));
            return total > 0 ? `${Math.round((pasa / total) * 100)}%` : '—';
          })(),
          color: COLORS.green,
        },
      ];

      summaryItems.forEach((item, i) => {
        const bx = boxStartX + i * (boxW + gap);
        doc.save();
        doc.roundedRect(bx, y, boxW, boxH, 6).fill('#f1f5f9');
        doc.roundedRect(bx, y, boxW, boxH, 6).strokeColor(item.color).lineWidth(1).stroke();
        doc.restore();
        doc.fontSize(8).fillColor(COLORS.gray).text(item.label, bx, y + 10, { width: boxW, align: 'center' });
        doc.fontSize(22).fillColor(item.color).text(item.value, bx, y + 26, { width: boxW, align: 'center' });
      });

      // === UNIT PAGES ===
      unidadesPruebas.forEach((unidad) => {
        doc.addPage();
        y = doc.page.margins.top;

        // Unit header
        doc.save();
        doc.rect(startX, y, pageW, 32).fill(COLORS.primary);
        doc.restore();

        doc.fontSize(13).fillColor(COLORS.white)
          .text(`UNIDAD: ${unidad.unidadNombre}`, startX + 10, y + 4, { width: pageW * 0.7 });
        if (unidad.unidadNivel != null) {
          doc.fontSize(9).fillColor(COLORS.white)
            .text(`Nivel ${unidad.unidadNivel}`, startX + 10, y + 20, { width: pageW * 0.5 });
        }

        // Unit summary
        const totalEval = unidad.resultados.filter(r => r.estado !== 'na' && r.estado !== 'pendiente').length;
        const totalPasa = unidad.resultados.filter(r => r.estado === 'verde').length;
        const totalNoPasa = unidad.resultados.filter(r => r.estado === 'rojo').length;
        const totalPendiente = unidad.resultados.filter(r => r.estado === 'pendiente').length;
        const tasa = totalEval > 0 ? Math.round((totalPasa / totalEval) * 100) : 0;

        const summaryText = `Pasa: ${totalPasa}  |  No Pasa: ${totalNoPasa}  |  Pendiente: ${totalPendiente}  |  Tasa: ${tasa}%`;
        const tasaColor = tasa >= 80 ? COLORS.green : tasa >= 50 ? COLORS.amber : COLORS.red;
        doc.fontSize(9).fillColor(COLORS.white)
          .text(summaryText, startX + pageW * 0.5, y + 10, { width: pageW * 0.5 - 10, align: 'right' });

        y += 40;

        // Group results by sistema
        const bySistema = new Map<string, PruebaResultado[]>();
        unidad.resultados.forEach(r => {
          const arr = bySistema.get(r.pruebaSistema) || [];
          arr.push(r);
          bySistema.set(r.pruebaSistema, arr);
        });

        // Table
        const cols = [
          { label: 'Sistema', width: pageW * 0.12 },
          { label: 'Prueba', width: pageW * 0.28 },
          { label: 'Intento', width: pageW * 0.10 },
          { label: 'Estado', width: pageW * 0.10 },
          { label: 'Observacion', width: pageW * 0.25 },
          { label: 'Evaluador', width: pageW * 0.15 },
        ];

        const headerH = 20;
        const rowH = 18;

        const drawTableHeader = (yPos: number): number => {
          doc.save();
          doc.rect(startX, yPos, pageW, headerH).fill(COLORS.primary);
          doc.restore();
          let cx = startX;
          cols.forEach(col => {
            doc.fontSize(8).fillColor(COLORS.white).text(col.label, cx + 4, yPos + 5, { width: col.width - 8 });
            cx += col.width;
          });
          return yPos + headerH;
        };

        y = drawTableHeader(y);

        const allResults: (PruebaResultado & { pruebaSistema: string })[] = [];
        bySistema.forEach((results, sistema) => {
          results.forEach(r => allResults.push({ ...r, pruebaSistema: sistema }));
        });

        allResults.forEach((r, i) => {
          // Check page break
          if (y + rowH > doc.page.height - doc.page.margins.bottom - 30) {
            doc.addPage();
            y = doc.page.margins.top;
            // Repeat unit header (compact)
            doc.save();
            doc.rect(startX, y, pageW, 22).fill('#f1f5f9');
            doc.restore();
            doc.fontSize(9).fillColor(COLORS.primary)
              .text(`${unidad.unidadNombre} (cont.)`, startX + 8, y + 5, { width: pageW });
            y += 28;
            y = drawTableHeader(y);
          }

          const bg = i % 2 === 0 ? '#f9fafb' : COLORS.white;
          doc.save();
          doc.rect(startX, y, pageW, rowH).fill(bg);
          doc.moveTo(startX, y + rowH).lineTo(startX + pageW, y + rowH).strokeColor(COLORS.border).lineWidth(0.3).stroke();
          doc.restore();

          const estadoLabel = getEstadoLabel(r.estado);
          const estadoColor = getEstadoColor(r.estado);
          const estadoBg = getEstadoBg(r.estado);
          const intentoLabel = r.intento === 'intento_1' ? '1er Intento' : 'Final';

          const vals = [
            r.pruebaSistema,
            r.pruebaNombre,
            intentoLabel,
            '', // Estado drawn as badge
            r.observacion || '—',
            r.evaluadoPorNombre || '—',
          ];

          let cx = startX;
          vals.forEach((v, ci) => {
            if (ci === 3) {
              // Estado badge
              const badgeW = cols[ci].width - 12;
              const badgeX = cx + 6;
              const badgeY = y + 3;
              doc.save();
              doc.roundedRect(badgeX, badgeY, badgeW, 12, 3).fill(estadoBg);
              doc.restore();
              doc.fontSize(7).fillColor(estadoColor)
                .text(estadoLabel, badgeX, badgeY + 2, { width: badgeW, align: 'center' });
            } else {
              doc.fontSize(7.5).fillColor(COLORS.darkGray)
                .text(v, cx + 4, y + 4, { width: cols[ci].width - 8, lineBreak: false });
            }
            cx += cols[ci].width;
          });

          y += rowH;
        });

        // If no results
        if (allResults.length === 0) {
          doc.save();
          doc.rect(startX, y, pageW, 30).fill('#f9fafb');
          doc.restore();
          doc.fontSize(9).fillColor(COLORS.gray)
            .text('Sin pruebas registradas para esta unidad', startX, y + 8, { width: pageW, align: 'center' });
        }
      });

      // Footer on all pages
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).fillColor(COLORS.gray)
          .text(
            `ObjetivaQC — Reporte de Pruebas — ${config.proyectoNombre} — ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} — Pag ${i + 1}/${totalPages}`,
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
