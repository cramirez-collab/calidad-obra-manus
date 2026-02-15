/**
 * Helper functions to draw mini charts and photos directly in jsPDF
 * Uses native jsPDF drawing primitives (no html2canvas dependency)
 */
import type { jsPDF } from 'jspdf';

interface ChartData {
  porStatus: Array<{ name: string; value: number; color: string }>;
  porEmpresa: Array<{ name: string; total: number; rechazados: number }>;
  porEspecialidad: Array<{ name: string; total: number; rechazados: number }>;
  defectos: Array<{ name: string; frecuencia: number }>;
}

interface FotoEvidencia {
  id: number;
  codigo: string;
  fotoUrl: string;
  status: string;
}

const COLORS = {
  navy: [0, 44, 99] as [number, number, number],
  green: [2, 179, 129] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  indigo: [99, 102, 241] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  gray: [200, 200, 200] as [number, number, number],
  text: [80, 80, 80] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

/**
 * Draw a mini pie chart at (x, y) with given radius
 * Includes percentage labels on each slice
 */
function drawPieChart(doc: jsPDF, data: ChartData['porStatus'], x: number, y: number, radius: number) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return;
  
  let startAngle = -Math.PI / 2; // Start from top
  
  for (const item of data) {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    
    // Parse hex color
    const hex = item.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    doc.setFillColor(r, g, b);
    
    // Draw pie slice using small triangles
    const steps = Math.max(Math.ceil(sliceAngle / 0.05), 2);
    const angleStep = sliceAngle / steps;
    
    for (let i = 0; i < steps; i++) {
      const a1 = startAngle + i * angleStep;
      const a2 = startAngle + (i + 1) * angleStep;
      const x1 = x + radius * Math.cos(a1);
      const y1 = y + radius * Math.sin(a1);
      const x2 = x + radius * Math.cos(a2);
      const y2 = y + radius * Math.sin(a2);
      
      doc.triangle(x, y, x1, y1, x2, y2, 'F');
    }
    
    // Draw percentage label on slice (only if > 8%)
    const pct = Math.round((item.value / total) * 100);
    if (pct >= 8) {
      const midAngle = startAngle + sliceAngle / 2;
      const labelR = radius * 0.7;
      const lx = x + labelR * Math.cos(midAngle);
      const ly2 = y + labelR * Math.sin(midAngle);
      doc.setFontSize(4.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`${pct}%`, lx, ly2 + 0.5, { align: 'center' });
    }
    
    startAngle = endAngle;
  }
  
  // Inner circle (donut)
  const innerR = radius * 0.35;
  doc.setFillColor(255, 255, 255);
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const x1 = x + innerR * Math.cos(a);
    const y1 = y + innerR * Math.sin(a);
    const x2 = x + innerR * Math.cos(a + 0.06);
    const y2 = y + innerR * Math.sin(a + 0.06);
    doc.triangle(x, y, x1, y1, x2, y2, 'F');
  }
  
  // Total in center
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.navy);
  doc.text(String(total), x, y + 1, { align: 'center' });
  doc.setFontSize(3.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Total', x, y + 3.5, { align: 'center' });
  
  // Legend below with values
  let ly = y + radius + 3;
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  for (const item of data) {
    const hex = item.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    doc.setFillColor(r, g, b);
    doc.circle(x - radius + 2, ly - 0.8, 1, 'F');
    doc.setTextColor(...COLORS.text);
    const pct = Math.round((item.value / total) * 100);
    doc.text(`${item.name}: ${item.value} (${pct}%)`, x - radius + 5, ly);
    ly += 3;
  }
}

/**
 * Draw a vertical bar chart with value labels on top of each bar
 */
function drawBarChart(doc: jsPDF, data: Array<{ name: string; total: number; rechazados: number }>, 
  x: number, y: number, w: number, h: number, color1: [number, number, number], color2: [number, number, number]) {
  if (!data.length) return;
  
  const maxVal = Math.max(...data.map(d => Math.max(d.total, d.rechazados)), 1);
  const barGroupW = w / data.length;
  const barW = barGroupW * 0.35;
  const gap = barGroupW * 0.1;
  
  // Y axis line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(x, y, x, y + h);
  doc.line(x, y + h, x + w, y + h);
  
  // Y axis scale labels
  doc.setFontSize(3.5);
  doc.setTextColor(150, 150, 150);
  doc.text(String(maxVal), x - 1, y + 1, { align: 'right' });
  doc.text(String(Math.round(maxVal / 2)), x - 1, y + h / 2, { align: 'right' });
  doc.text('0', x - 1, y + h, { align: 'right' });
  
  // Grid lines
  doc.setDrawColor(235, 235, 235);
  doc.setLineWidth(0.1);
  doc.line(x, y + h / 2, x + w, y + h / 2);
  
  for (let i = 0; i < data.length; i++) {
    const bx = x + i * barGroupW + gap;
    
    // Total bar
    const h1 = (data[i].total / maxVal) * h;
    doc.setFillColor(...color1);
    if (h1 > 0) doc.rect(bx, y + h - h1, barW, h1, 'F');
    
    // Value label on total bar
    if (data[i].total > 0) {
      doc.setFontSize(3.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color1);
      doc.text(String(data[i].total), bx + barW / 2, y + h - h1 - 1, { align: 'center' });
    }
    
    // Rechazados bar
    const h2 = (data[i].rechazados / maxVal) * h;
    doc.setFillColor(...color2);
    if (h2 > 0) doc.rect(bx + barW + 0.5, y + h - h2, barW, h2, 'F');
    
    // Value label on rechazados bar
    if (data[i].rechazados > 0) {
      doc.setFontSize(3.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color2);
      doc.text(String(data[i].rechazados), bx + barW + 0.5 + barW / 2, y + h - h2 - 1, { align: 'center' });
    }
    
    // X axis label
    doc.setFontSize(4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
    const label = data[i].name.length > 7 ? data[i].name.substring(0, 7) + '..' : data[i].name;
    doc.text(label, bx + barW, y + h + 3, { align: 'center' });
  }
  
  // Legend
  const legendY = y + h + 6;
  doc.setFontSize(4);
  doc.setFont('helvetica', 'normal');
  doc.setFillColor(...color1);
  doc.rect(x, legendY - 1.2, 2, 1.5, 'F');
  doc.setTextColor(...COLORS.text);
  doc.text('Total', x + 3, legendY);
  doc.setFillColor(...color2);
  doc.rect(x + 12, legendY - 1.2, 2, 1.5, 'F');
  doc.text('Rechazados', x + 15, legendY);
}

/**
 * Draw horizontal bar chart for defects with value labels
 */
function drawHorizontalBarChart(doc: jsPDF, data: Array<{ name: string; frecuencia: number }>,
  x: number, y: number, w: number, h: number) {
  if (!data.length) return;
  
  const maxVal = Math.max(...data.map(d => d.frecuencia), 1);
  const barH = Math.min(h / data.length - 1, 5);
  const labelW = w * 0.35;
  const chartW = w - labelW;
  
  for (let i = 0; i < data.length; i++) {
    const by = y + i * (barH + 1.5);
    
    // Label
    doc.setFontSize(4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
    const label = data[i].name.length > 12 ? data[i].name.substring(0, 12) + '..' : data[i].name;
    doc.text(label, x, by + barH * 0.7);
    
    // Bar with gradient effect
    const bw = (data[i].frecuencia / maxVal) * chartW;
    // Background track
    doc.setFillColor(240, 240, 242);
    doc.roundedRect(x + labelW, by, chartW, barH, 1, 1, 'F');
    // Actual bar
    doc.setFillColor(...COLORS.amber);
    if (bw > 0) doc.roundedRect(x + labelW, by, bw, barH, 1, 1, 'F');
    
    // Value label inside or outside bar
    doc.setFontSize(4);
    doc.setFont('helvetica', 'bold');
    if (bw > 10) {
      doc.setTextColor(255, 255, 255);
      doc.text(String(data[i].frecuencia), x + labelW + bw - 2, by + barH * 0.7, { align: 'right' });
    } else {
      doc.setTextColor(...COLORS.amber);
      doc.text(String(data[i].frecuencia), x + labelW + bw + 1.5, by + barH * 0.7);
    }
  }
}

/**
 * Draw all 4 charts in a 2x2 grid on the PDF for better readability
 */
export function drawChartsOnPDF(doc: jsPDF, chartData: ChartData, startX: number, startY: number, totalWidth: number): number {
  const chartW = (totalWidth - 4) / 2; // 2 charts per row
  const chartH = 32;
  
  // Section title
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.navy);
  doc.text('Indicadores del Proyecto', startX, startY);
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.3);
  doc.line(startX, startY + 1, startX + 40, startY + 1);
  doc.setFont('helvetica', 'normal');
  const cy = startY + 5;
  
  // Row 1: Pie + Empresas
  // Chart backgrounds
  for (let col = 0; col < 2; col++) {
    const cx = startX + col * (chartW + 4);
    doc.setFillColor(248, 248, 250);
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.15);
    doc.roundedRect(cx, cy, chartW, chartH + 12, 1.5, 1.5, 'FD');
  }
  
  // 1. Pie: Estado
  const cx1 = startX;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.navy);
  doc.text('Estado de Ítems', cx1 + chartW / 2, cy + 4, { align: 'center' });
  drawPieChart(doc, chartData.porStatus, cx1 + chartW / 2, cy + 16, 8);
  
  // 2. Bar: Empresas
  const cx2 = startX + chartW + 4;
  doc.setFontSize(7);
  doc.text('Ítems por Empresa', cx2 + chartW / 2, cy + 4, { align: 'center' });
  drawBarChart(doc, chartData.porEmpresa.slice(0, 5), cx2 + 5, cy + 7, chartW - 8, chartH - 2, COLORS.navy, COLORS.red);
  
  const row2Y = cy + chartH + 15;
  
  // Row 2: Especialidades + Defectos
  for (let col = 0; col < 2; col++) {
    const cx = startX + col * (chartW + 4);
    doc.setFillColor(248, 248, 250);
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.15);
    doc.roundedRect(cx, row2Y, chartW, chartH + 12, 1.5, 1.5, 'FD');
  }
  
  // 3. Bar: Especialidades
  const cx3 = startX;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.navy);
  doc.text('Ítems por Especialidad', cx3 + chartW / 2, row2Y + 4, { align: 'center' });
  drawBarChart(doc, chartData.porEspecialidad.slice(0, 5), cx3 + 5, row2Y + 7, chartW - 8, chartH - 2, COLORS.indigo, COLORS.red);
  
  // 4. Horizontal Bar: Defectos
  const cx4 = startX + chartW + 4;
  doc.setFontSize(7);
  doc.text('Top 5 Defectos', cx4 + chartW / 2, row2Y + 4, { align: 'center' });
  drawHorizontalBarChart(doc, chartData.defectos.slice(0, 5), cx4 + 2, row2Y + 7, chartW - 4, chartH - 2);
  
  return row2Y + chartH + 14; // Return new Y position after charts
}

/**
 * Draw 3 evidence photos in a row on the PDF
 */
export async function drawPhotosOnPDF(doc: jsPDF, fotos: FotoEvidencia[], startX: number, startY: number, totalWidth: number, getImageUrl: (url: string) => string): Promise<number> {
  if (!fotos.length) return startY;
  
  // Check if we need a new page
  if (startY > 240) {
    doc.addPage();
    startY = 15;
  }
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.navy);
  doc.text('Evidencia Fotográfica', startX, startY);
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.3);
  doc.line(startX, startY + 1, startX + 40, startY + 1);
  doc.setFont('helvetica', 'normal');
  
  const py = startY + 4;
  const photoW = (totalWidth - 6) / 3;
  const photoH = 25;
  
  for (let i = 0; i < Math.min(fotos.length, 3); i++) {
    const px = startX + i * (photoW + 3);
    
    // Photo frame
    doc.setFillColor(248, 248, 250);
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.15);
    doc.roundedRect(px, py, photoW, photoH + 10, 1.5, 1.5, 'FD');
    
    // Try to load and add image
    try {
      const imgUrl = getImageUrl(fotos[i].fotoUrl);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = imgUrl;
      });
      
      if (img.complete && img.naturalWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(img.naturalWidth, 400);
        canvas.height = Math.min(img.naturalHeight, 300);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          doc.addImage(dataUrl, 'JPEG', px + 1, py + 1, photoW - 2, photoH - 2);
        }
      }
    } catch (e) {
      // Fallback: gray placeholder
      doc.setFillColor(230, 230, 235);
      doc.rect(px + 1, py + 1, photoW - 2, photoH - 2, 'F');
      doc.setFontSize(5);
      doc.setTextColor(150, 150, 150);
      doc.text('Sin imagen', px + photoW / 2, py + photoH / 2, { align: 'center' });
    }
    
    // Caption
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.navy);
    doc.setFont('helvetica', 'bold');
    const code = fotos[i].codigo.length > 18 ? fotos[i].codigo.substring(0, 18) + '..' : fotos[i].codigo;
    doc.text(code, px + 2, py + photoH + 2);
    doc.setFont('helvetica', 'normal');
    
    // Status badge
    const isRejected = fotos[i].status === 'rechazado';
    const isPending = fotos[i].status.includes('pendiente');
    const badgeColor = isRejected ? COLORS.red : isPending ? COLORS.amber : COLORS.green;
    const badgeLabel = isRejected ? 'Rechazado' : isPending ? 'Pendiente' : 'Aprobado';
    doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.roundedRect(px + 2, py + photoH + 4, 14, 3.5, 0.8, 0.8, 'F');
    doc.setFontSize(4.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(badgeLabel, px + 9, py + photoH + 6.3, { align: 'center' });
  }
  
  return py + photoH + 10;
}

interface Responsable {
  nombre: string;
  role: string;
  empresa: string | null;
  total: number;
  aprobados: number;
  rechazados: number;
  pendientes: number;
  tasaAprobacion: number;
  tiempoPromedio: number;
  score: number;
}

interface PendienteAprobacion {
  nombre: string;
  rol: string;
  itemsCreados: number;
  activo: boolean;
  diasSinActividad: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  superadmin: 'Superadmin',
  supervisor: 'Supervisor',
  jefe_residente: 'Jefe Residente',
  residente: 'Residente',
  contratista: 'Contratista',
  user: 'Usuario',
};

/**
 * Draw responsables table with performance indices on the PDF
 */
export function drawResponsablesOnPDF(doc: jsPDF, responsables: Responsable[], startX: number, startY: number, totalWidth: number): number {
  if (!responsables.length) return startY;

  // Check if we need a new page
  if (startY > 220) {
    doc.addPage();
    startY = 15;
  }

  // Section title
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.navy);
  doc.text('Responsables e Indices de Desempeno', startX, startY);
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.3);
  doc.line(startX, startY + 1, startX + 55, startY + 1);

  const ty = startY + 5;
  const rowH = 5.5;
  const cols = [
    { label: 'Nombre', w: totalWidth * 0.22, align: 'left' as const },
    { label: 'Rol', w: totalWidth * 0.12, align: 'left' as const },
    { label: 'Empresa', w: totalWidth * 0.14, align: 'left' as const },
    { label: 'Total', w: totalWidth * 0.07, align: 'center' as const },
    { label: 'Aprob.', w: totalWidth * 0.07, align: 'center' as const },
    { label: 'Rech.', w: totalWidth * 0.07, align: 'center' as const },
    { label: 'Pend.', w: totalWidth * 0.07, align: 'center' as const },
    { label: '% Aprob.', w: totalWidth * 0.08, align: 'center' as const },
    { label: 'T.Prom(d)', w: totalWidth * 0.08, align: 'center' as const },
    { label: 'Score', w: totalWidth * 0.08, align: 'center' as const },
  ];

  // Header row
  doc.setFillColor(0, 44, 99);
  doc.rect(startX, ty, totalWidth, rowH + 1, 'F');
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  let hx = startX + 1;
  for (const col of cols) {
    if (col.align === 'center') {
      doc.text(col.label, hx + col.w / 2, ty + 3.8, { align: 'center' });
    } else {
      doc.text(col.label, hx, ty + 3.8);
    }
    hx += col.w;
  }

  // Data rows
  let ry = ty + rowH + 1;
  const maxRows = Math.min(responsables.length, 8);
  for (let i = 0; i < maxRows; i++) {
    const r = responsables[i];
    const isEven = i % 2 === 0;
    doc.setFillColor(isEven ? 248 : 255, isEven ? 248 : 255, isEven ? 252 : 255);
    doc.rect(startX, ry, totalWidth, rowH, 'F');

    doc.setFontSize(4.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);

    let rx = startX + 1;
    // Nombre
    const nombre = r.nombre.length > 18 ? r.nombre.substring(0, 18) + '..' : r.nombre;
    doc.text(nombre, rx, ry + 3.5);
    rx += cols[0].w;
    // Rol
    doc.text((ROLE_LABELS[r.role] || r.role).substring(0, 12), rx, ry + 3.5);
    rx += cols[1].w;
    // Empresa
    doc.text((r.empresa || '-').substring(0, 12), rx, ry + 3.5);
    rx += cols[2].w;
    // Total
    doc.text(String(r.total), rx + cols[3].w / 2, ry + 3.5, { align: 'center' });
    rx += cols[3].w;
    // Aprobados
    doc.setTextColor(...COLORS.green);
    doc.text(String(r.aprobados), rx + cols[4].w / 2, ry + 3.5, { align: 'center' });
    rx += cols[4].w;
    // Rechazados
    doc.setTextColor(...COLORS.red);
    doc.text(String(r.rechazados), rx + cols[5].w / 2, ry + 3.5, { align: 'center' });
    rx += cols[5].w;
    // Pendientes
    doc.setTextColor(...COLORS.amber);
    doc.text(String(r.pendientes), rx + cols[6].w / 2, ry + 3.5, { align: 'center' });
    rx += cols[6].w;
    // Tasa aprobación
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.text(`${r.tasaAprobacion}%`, rx + cols[7].w / 2, ry + 3.5, { align: 'center' });
    rx += cols[7].w;
    // Tiempo promedio
    doc.setFont('helvetica', 'normal');
    doc.text(`${r.tiempoPromedio}d`, rx + cols[8].w / 2, ry + 3.5, { align: 'center' });
    rx += cols[8].w;
    // Score
    const scoreColor = r.score >= 50 ? COLORS.green : r.score >= 0 ? COLORS.amber : COLORS.red;
    doc.setTextColor(...scoreColor);
    doc.setFont('helvetica', 'bold');
    doc.text(String(r.score), rx + cols[9].w / 2, ry + 3.5, { align: 'center' });

    ry += rowH;
  }

  // Bottom border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(startX, ry, startX + totalWidth, ry);

  return ry + 4;
}

/**
 * Draw pendientes de aprobación section on PDF
 */
export function drawPendientesAprobacionOnPDF(doc: jsPDF, pendientes: PendienteAprobacion[], startX: number, startY: number, totalWidth: number): number {
  const activos = pendientes.filter(p => p.activo);
  const inactivos = pendientes.filter(p => !p.activo);
  if (!pendientes.length) return startY;

  // Check if we need a new page
  if (startY > 245) {
    doc.addPage();
    startY = 15;
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.navy);
  doc.text('Supervisores / Jefes de Residente', startX, startY);
  doc.setFont('helvetica', 'normal');

  let y = startY + 4;
  const colW = (totalWidth - 4) / 2;

  // Activos
  if (activos.length > 0) {
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(startX, y, colW, 4 + activos.length * 4, 1, 1, 'F');
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.green);
    doc.text('Activos', startX + 2, y + 3);
    let ay = y + 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
    for (const p of activos.slice(0, 5)) {
      const name = p.nombre.length > 16 ? p.nombre.substring(0, 16) + '..' : p.nombre;
      doc.setFontSize(5);
      doc.text(`${name} (${ROLE_LABELS[p.rol] || p.rol}) - ${p.itemsCreados} items`, startX + 2, ay);
      ay += 4;
    }
  }

  // Inactivos
  if (inactivos.length > 0) {
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(startX + colW + 4, y, colW, 4 + inactivos.length * 4, 1, 1, 'F');
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.red);
    doc.text('Inactivos (requieren atencion)', startX + colW + 6, y + 3);
    let iy = y + 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
    for (const p of inactivos.slice(0, 5)) {
      const name = p.nombre.length > 14 ? p.nombre.substring(0, 14) + '..' : p.nombre;
      doc.setFontSize(5);
      doc.text(`${name} - ${p.diasSinActividad} dias sin actividad`, startX + colW + 6, iy);
      iy += 4;
    }
  }

  const maxItems = Math.max(activos.length, inactivos.length);
  return y + 6 + Math.min(maxItems, 5) * 4;
}
