/**
 * Servicio de generación de PDF server-side con PDFKit.
 * Genera PDFs reales que se abren en cualquier visor (Acrobat, Chrome, Safari).
 * 
 * Ventajas sobre html2pdf.js:
 * - Funciona en server → no depende del navegador
 * - Genera PDF nativo → se abre en Acrobat/visor sin problemas
 * - Compatible con iOS Safari, Android Chrome, Desktop
 * - No hay canvas en blanco, no hay popups bloqueados
 */
import PDFDocument from 'pdfkit';

// Colores corporativos
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
  blueBg: '#f0f4ff',
};

function getEficienciaColor(pct: number): string {
  if (pct >= 80) return COLORS.green;
  if (pct >= 50) return COLORS.amber;
  return COLORS.red;
}

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr || 'N/A';
  }
}

function formatWeekRange(inicio: string, fin: string): string {
  try {
    const i = new Date(inicio);
    const f = new Date(fin);
    const mi = i.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    const mf = f.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${mi} - ${mf}`;
  } catch {
    return `${inicio} - ${fin}`;
  }
}

interface Actividad {
  actividad: string;
  especialidad: string;
  nivel?: string;
  area?: string;
  referenciaEje?: string;
  unidad: string;
  material?: string;
  cantidadProgramada: string;
  cantidadRealizada?: string;
  porcentajeAvance?: string;
}

interface Analisis8Ms {
  resumenGeneral: string;
  categorias: { nombre: string; estado: string; recomendacion: string }[];
}

interface ProgramaData {
  semanaInicio: string;
  semanaFin: string;
  fechaEntrega?: string;
  fechaCorte?: string;
  status: string;
  actividades: Actividad[];
  planos?: any[];
}

/**
 * Genera PDF de corte por empresa/especialidad
 * Retorna un Buffer con el PDF listo para enviar como response
 */
export async function generarPDFCorteEmpresa(
  data: ProgramaData,
  especialidad: string,
  analisis8Ms?: Analisis8Ms | null
): Promise<Buffer> {
  const actividades = (data.actividades || []).filter(a => a.especialidad === especialidad);

  const totalProg = actividades.reduce((s, a) => s + (parseFloat(a.cantidadProgramada) || 0), 0);
  const totalReal = actividades.reduce((s, a) => s + (parseFloat(a.cantidadRealizada || '0') || 0), 0);
  const eficiencia = totalProg > 0 ? (totalReal / totalProg) * 100 : 0;
  const efColor = getEficienciaColor(eficiencia);

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 30, bottom: 30, left: 40, right: 40 },
        bufferPages: true,
        info: {
          Title: `Corte - ${especialidad}`,
          Author: 'ObjetivaQC',
          Subject: `Programa Semanal - ${especialidad}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // ===== HEADER =====
      doc.fontSize(18).fillColor(COLORS.primary).text('CORTE DE PROGRAMA SEMANAL', { align: 'left' });
      doc.moveDown(0.2);
      doc.fontSize(14).fillColor(COLORS.primary).text(especialidad);
      doc.moveDown(0.1);
      doc.fontSize(11).fillColor(COLORS.gray).text(`Semana: ${formatWeekRange(data.semanaInicio, data.semanaFin)}`);
      doc.moveDown(0.5);

      // ===== META INFO (4 boxes) =====
      const boxW = (pageW - 30) / 4;
      const boxH = 40;
      const startX = doc.page.margins.left;
      const metaY = doc.y;

      const metaItems = [
        { label: 'ENTREGA', value: data.fechaEntrega ? formatDateShort(data.fechaEntrega) : 'Pendiente' },
        { label: 'CORTE', value: data.fechaCorte ? formatDateShort(data.fechaCorte) : 'Pendiente' },
        { label: 'ACTIVIDADES', value: String(actividades.length) },
        { label: 'ESTADO', value: 'Corte Realizado' },
      ];

      metaItems.forEach((item, i) => {
        const x = startX + i * (boxW + 10);
        // Box background
        doc.save();
        doc.roundedRect(x, metaY, boxW, boxH, 4).fill('#f1f5f9');
        doc.restore();
        // Left accent
        doc.save();
        doc.rect(x, metaY, 3, boxH).fill(COLORS.primary);
        doc.restore();
        // Label
        doc.fontSize(8).fillColor(COLORS.gray).text(item.label, x + 10, metaY + 6, { width: boxW - 15 });
        // Value
        doc.fontSize(11).fillColor(COLORS.darkGray).text(item.value, x + 10, metaY + 20, { width: boxW - 15 });
      });

      doc.y = metaY + boxH + 15;

      // ===== EFICIENCIA BOX =====
      const efBoxW = 200;
      const efBoxH = 60;
      const efBoxX = startX + (pageW - efBoxW) / 2;
      const efBoxY = doc.y;

      const efBgColor = eficiencia >= 80 ? '#f0fdf4' : eficiencia >= 50 ? '#fffbeb' : '#fef2f2';
      doc.save();
      doc.roundedRect(efBoxX, efBoxY, efBoxW, efBoxH, 6).fill(efBgColor);
      doc.roundedRect(efBoxX, efBoxY, efBoxW, efBoxH, 6).strokeColor(efColor).lineWidth(1.5).stroke();
      doc.restore();

      doc.fontSize(9).fillColor(COLORS.gray).text(`EFICIENCIA DE ${especialidad.toUpperCase()}`, efBoxX, efBoxY + 6, { width: efBoxW, align: 'center' });
      doc.fontSize(24).fillColor(efColor).text(`${eficiencia.toFixed(1)}%`, efBoxX, efBoxY + 18, { width: efBoxW, align: 'center' });
      doc.fontSize(8).fillColor(COLORS.gray).text(`Programado: ${totalProg.toFixed(2)} | Realizado: ${totalReal.toFixed(2)}`, efBoxX, efBoxY + 44, { width: efBoxW, align: 'center' });

      doc.y = efBoxY + efBoxH + 15;

      // ===== TABLE: Detalle de Actividades =====
      doc.fontSize(12).fillColor(COLORS.primary).text('Detalle de Actividades', { underline: false });
      doc.moveDown(0.3);

      // Table columns
      const cols = [
        { label: 'Actividad', width: pageW * 0.22 },
        { label: 'Nivel', width: pageW * 0.08 },
        { label: 'Area', width: pageW * 0.10 },
        { label: 'Ref. Eje', width: pageW * 0.08 },
        { label: 'Unidad', width: pageW * 0.07 },
        { label: 'Material', width: pageW * 0.15 },
        { label: 'Prog.', width: pageW * 0.10 },
        { label: 'Real.', width: pageW * 0.10 },
        { label: '%', width: pageW * 0.10 },
      ];

      const tableX = startX;
      let tableY = doc.y;
      const rowH = 18;
      const headerH = 20;

      // Header row
      doc.save();
      doc.rect(tableX, tableY, pageW, headerH).fill(COLORS.primary);
      doc.restore();

      let colX = tableX;
      cols.forEach(col => {
        doc.fontSize(8).fillColor(COLORS.white).text(col.label, colX + 4, tableY + 5, { width: col.width - 8 });
        colX += col.width;
      });

      tableY += headerH;

      // Data rows
      const drawRow = (row: string[], y: number, isEven: boolean, isTotals: boolean = false) => {
        // Check if we need a new page
        if (y + rowH > doc.page.height - doc.page.margins.bottom - 30) {
          doc.addPage();
          y = doc.page.margins.top;
          // Redraw header
          doc.save();
          doc.rect(tableX, y, pageW, headerH).fill(COLORS.primary);
          doc.restore();
          let hx = tableX;
          cols.forEach(col => {
            doc.fontSize(8).fillColor(COLORS.white).text(col.label, hx + 4, y + 5, { width: col.width - 8 });
            hx += col.width;
          });
          y += headerH;
        }

        const bgColor = isTotals ? '#e2e8f0' : isEven ? '#f9fafb' : COLORS.white;
        doc.save();
        doc.rect(tableX, y, pageW, rowH).fill(bgColor);
        doc.restore();

        // Bottom border
        doc.save();
        doc.moveTo(tableX, y + rowH).lineTo(tableX + pageW, y + rowH).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        doc.restore();

        let rx = tableX;
        row.forEach((cell, ci) => {
          const isLast = ci === row.length - 1;
          const isNumeric = ci >= 6;
          const color = isLast ? getEficienciaColor(parseFloat(cell) || 0) : (isTotals ? COLORS.primary : COLORS.darkGray);
          const fontWeight = (isTotals || isLast) ? 'bold' : 'normal';
          
          doc.fontSize(isTotals ? 8.5 : 8)
            .fillColor(color)
            .text(cell, rx + 4, y + 4, { 
              width: cols[ci].width - 8, 
              align: isNumeric ? 'right' : 'left',
              lineBreak: false,
            });
          rx += cols[ci].width;
        });

        return y + rowH;
      };

      actividades.forEach((a, i) => {
        const pct = parseFloat(a.porcentajeAvance || '0') || 0;
        const row = [
          a.actividad || '',
          a.nivel || '—',
          a.area || '—',
          a.referenciaEje || '—',
          a.unidad || '',
          a.material || '—',
          a.cantidadProgramada || '0',
          a.cantidadRealizada || '0',
          `${pct.toFixed(1)}%`,
        ];
        tableY = drawRow(row, tableY, i % 2 === 0);
      });

      // Totals row
      const totalsRow = [
        '', '', '', '', '', 'TOTALES',
        totalProg.toFixed(2),
        totalReal.toFixed(2),
        `${eficiencia.toFixed(1)}%`,
      ];
      tableY = drawRow(totalsRow, tableY, false, true);

      // ===== ANALISIS 8Ms =====
      if (analisis8Ms) {
        doc.y = tableY + 15;

        // Check if we need a new page for analysis
        if (doc.y > doc.page.height - doc.page.margins.bottom - 150) {
          doc.addPage();
        }

        doc.fontSize(13).fillColor(COLORS.primary).text('ANALISIS IA - METODOLOGIA 8Ms');
        doc.moveDown(0.3);

        // Resumen general
        const resY = doc.y;
        doc.save();
        doc.roundedRect(startX, resY, pageW, 40, 4).fill('#f0f4ff');
        doc.rect(startX, resY, 3, 40).fill(COLORS.primary);
        doc.restore();
        doc.fontSize(9).fillColor(COLORS.darkGray).text(analisis8Ms.resumenGeneral, startX + 10, resY + 8, { width: pageW - 20, lineGap: 2 });
        doc.y = resY + 45;

        // Categorias table
        const catCols = [
          { label: 'Categoria', width: pageW * 0.25 },
          { label: 'Estado', width: pageW * 0.15 },
          { label: 'Recomendacion', width: pageW * 0.60 },
        ];

        let catY = doc.y;

        // Header
        doc.save();
        doc.rect(startX, catY, pageW, headerH).fill(COLORS.primary);
        doc.restore();
        let cx = startX;
        catCols.forEach(col => {
          doc.fontSize(8).fillColor(COLORS.white).text(col.label, cx + 4, catY + 5, { width: col.width - 8 });
          cx += col.width;
        });
        catY += headerH;

        analisis8Ms.categorias.forEach((cat, i) => {
          if (catY + 22 > doc.page.height - doc.page.margins.bottom - 20) {
            doc.addPage();
            catY = doc.page.margins.top;
            // Redraw header
            doc.save();
            doc.rect(startX, catY, pageW, headerH).fill(COLORS.primary);
            doc.restore();
            let hcx = startX;
            catCols.forEach(col => {
              doc.fontSize(8).fillColor(COLORS.white).text(col.label, hcx + 4, catY + 5, { width: col.width - 8 });
              hcx += col.width;
            });
            catY += headerH;
          }

          const bg = i % 2 === 0 ? '#f9fafb' : COLORS.white;
          doc.save();
          doc.rect(startX, catY, pageW, 20).fill(bg);
          doc.restore();
          doc.save();
          doc.moveTo(startX, catY + 20).lineTo(startX + pageW, catY + 20).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
          doc.restore();

          const estadoColor = cat.estado === 'critico' ? COLORS.red : cat.estado === 'atencion' ? COLORS.amber : COLORS.green;
          const estadoLabel = cat.estado === 'critico' ? 'CRITICO' : cat.estado === 'atencion' ? 'ATENCION' : 'ACEPTABLE';

          let ccx = startX;
          doc.fontSize(8).fillColor(COLORS.primary).text(cat.nombre, ccx + 4, catY + 5, { width: catCols[0].width - 8 });
          ccx += catCols[0].width;
          doc.fontSize(7).fillColor(estadoColor).text(estadoLabel, ccx + 4, catY + 5, { width: catCols[1].width - 8, align: 'center' });
          ccx += catCols[1].width;
          doc.fontSize(8).fillColor(COLORS.darkGray).text(cat.recomendacion, ccx + 4, catY + 3, { width: catCols[2].width - 8, lineGap: 1 });

          catY += 20;
        });
      }

      // ===== FOOTER =====
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        const footerY = doc.page.height - 25;
        doc.fontSize(7).fillColor(COLORS.gray)
          .text(
            `ObjetivaQC — Control de Calidad de Obra — Generado ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} — Pagina ${i + 1} de ${totalPages}`,
            doc.page.margins.left,
            footerY,
            { width: pageW, align: 'center' }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Genera PDF consolidado de programa semanal completo
 */
export async function generarPDFProgramaCompleto(
  data: ProgramaData,
  analisis8MsMap?: Map<string, Analisis8Ms>
): Promise<Buffer> {
  const actividades = data.actividades || [];
  const especialidades = Array.from(new Set(actividades.map(a => a.especialidad)));
  
  const totalProg = actividades.reduce((s, a) => s + (parseFloat(a.cantidadProgramada) || 0), 0);
  const totalReal = actividades.reduce((s, a) => s + (parseFloat(a.cantidadRealizada || '0') || 0), 0);
  const eficiencia = totalProg > 0 ? (totalReal / totalProg) * 100 : 0;

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 30, bottom: 30, left: 40, right: 40 },
        bufferPages: true,
        info: {
          Title: `Programa Semanal - ${formatWeekRange(data.semanaInicio, data.semanaFin)}`,
          Author: 'ObjetivaQC',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const startX = doc.page.margins.left;

      // Header
      doc.fontSize(18).fillColor(COLORS.primary).text('PROGRAMA SEMANAL', { align: 'left' });
      doc.moveDown(0.1);
      doc.fontSize(11).fillColor(COLORS.gray).text(`Semana: ${formatWeekRange(data.semanaInicio, data.semanaFin)}`);
      doc.moveDown(0.3);

      // Resumen por especialidad
      doc.fontSize(12).fillColor(COLORS.primary).text('Resumen por Especialidad');
      doc.moveDown(0.3);

      especialidades.forEach(esp => {
        const espActs = actividades.filter(a => a.especialidad === esp);
        const espProg = espActs.reduce((s, a) => s + (parseFloat(a.cantidadProgramada) || 0), 0);
        const espReal = espActs.reduce((s, a) => s + (parseFloat(a.cantidadRealizada || '0') || 0), 0);
        const espEf = espProg > 0 ? (espReal / espProg) * 100 : 0;
        const color = getEficienciaColor(espEf);
        
        doc.fontSize(9).fillColor(COLORS.darkGray).text(`• ${esp}: `, { continued: true });
        doc.fillColor(color).text(`${espEf.toFixed(1)}%`, { continued: true });
        doc.fillColor(COLORS.gray).text(` (${espActs.length} actividades)`);
      });

      doc.moveDown(0.5);
      doc.fontSize(10).fillColor(COLORS.primary).text(`Eficiencia Global: ${eficiencia.toFixed(1)}%`);
      doc.moveDown(0.5);

      // All activities table
      doc.fontSize(12).fillColor(COLORS.primary).text('Todas las Actividades');
      doc.moveDown(0.3);

      const cols = [
        { label: 'Especialidad', width: pageW * 0.15 },
        { label: 'Actividad', width: pageW * 0.20 },
        { label: 'Nivel', width: pageW * 0.08 },
        { label: 'Area', width: pageW * 0.10 },
        { label: 'Unidad', width: pageW * 0.07 },
        { label: 'Material', width: pageW * 0.12 },
        { label: 'Prog.', width: pageW * 0.09 },
        { label: 'Real.', width: pageW * 0.09 },
        { label: '%', width: pageW * 0.10 },
      ];

      let tableY = doc.y;
      const headerH = 20;
      const rowH = 18;

      // Header
      doc.save();
      doc.rect(startX, tableY, pageW, headerH).fill(COLORS.primary);
      doc.restore();
      let colX = startX;
      cols.forEach(col => {
        doc.fontSize(8).fillColor(COLORS.white).text(col.label, colX + 3, tableY + 5, { width: col.width - 6 });
        colX += col.width;
      });
      tableY += headerH;

      actividades.forEach((a, i) => {
        if (tableY + rowH > doc.page.height - doc.page.margins.bottom - 30) {
          doc.addPage();
          tableY = doc.page.margins.top;
          doc.save();
          doc.rect(startX, tableY, pageW, headerH).fill(COLORS.primary);
          doc.restore();
          let hx = startX;
          cols.forEach(col => {
            doc.fontSize(8).fillColor(COLORS.white).text(col.label, hx + 3, tableY + 5, { width: col.width - 6 });
            hx += col.width;
          });
          tableY += headerH;
        }

        const bg = i % 2 === 0 ? '#f9fafb' : COLORS.white;
        doc.save();
        doc.rect(startX, tableY, pageW, rowH).fill(bg);
        doc.moveTo(startX, tableY + rowH).lineTo(startX + pageW, tableY + rowH).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        doc.restore();

        const pct = parseFloat(a.porcentajeAvance || '0') || 0;
        const vals = [
          a.especialidad, a.actividad, a.nivel || '—', a.area || '—',
          a.unidad, a.material || '—', a.cantidadProgramada, a.cantidadRealizada || '0', `${pct.toFixed(1)}%`
        ];

        let rx = startX;
        vals.forEach((v, ci) => {
          const isLast = ci === vals.length - 1;
          const isNum = ci >= 6;
          const color = isLast ? getEficienciaColor(parseFloat(v) || 0) : COLORS.darkGray;
          doc.fontSize(7.5).fillColor(color).text(v, rx + 3, tableY + 4, {
            width: cols[ci].width - 6,
            align: isNum ? 'right' : 'left',
            lineBreak: false,
          });
          rx += cols[ci].width;
        });

        tableY += rowH;
      });

      // Footer on all pages
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).fillColor(COLORS.gray)
          .text(
            `ObjetivaQC — Programa Semanal — ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} — Pag ${i + 1}/${totalPages}`,
            doc.page.margins.left,
            doc.page.height - 25,
            { width: pageW, align: 'center' }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
