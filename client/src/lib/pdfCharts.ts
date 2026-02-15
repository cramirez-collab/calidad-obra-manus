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
};

/**
 * Draw a mini pie chart at (x, y) with given radius
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
    
    startAngle = endAngle;
  }
  
  // Inner circle (donut)
  const innerR = radius * 0.45;
  doc.setFillColor(255, 255, 255);
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const x1 = x + innerR * Math.cos(a);
    const y1 = y + innerR * Math.sin(a);
    const x2 = x + innerR * Math.cos(a + 0.06);
    const y2 = y + innerR * Math.sin(a + 0.06);
    doc.triangle(x, y, x1, y1, x2, y2, 'F');
  }
  
  // Legend below
  let ly = y + radius + 3;
  doc.setFontSize(5);
  for (const item of data) {
    const hex = item.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    doc.setFillColor(r, g, b);
    doc.circle(x - radius + 2, ly - 0.8, 1, 'F');
    doc.setTextColor(...COLORS.text);
    doc.text(`${item.name}: ${item.value}`, x - radius + 5, ly);
    ly += 3;
  }
}

/**
 * Draw a vertical bar chart at (x, y) with given width and height
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
  
  for (let i = 0; i < data.length; i++) {
    const bx = x + i * barGroupW + gap;
    
    // Total bar
    const h1 = (data[i].total / maxVal) * h;
    doc.setFillColor(...color1);
    if (h1 > 0) doc.rect(bx, y + h - h1, barW, h1, 'F');
    
    // Rechazados bar
    const h2 = (data[i].rechazados / maxVal) * h;
    doc.setFillColor(...color2);
    if (h2 > 0) doc.rect(bx + barW + 0.5, y + h - h2, barW, h2, 'F');
    
    // Label
    doc.setFontSize(4.5);
    doc.setTextColor(...COLORS.text);
    const label = data[i].name.length > 6 ? data[i].name.substring(0, 6) + '..' : data[i].name;
    doc.text(label, bx + barW, y + h + 3, { align: 'center' });
  }
}

/**
 * Draw horizontal bar chart for defects
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
    doc.setTextColor(...COLORS.text);
    const label = data[i].name.length > 12 ? data[i].name.substring(0, 12) + '..' : data[i].name;
    doc.text(label, x, by + barH * 0.7);
    
    // Bar
    const bw = (data[i].frecuencia / maxVal) * chartW;
    doc.setFillColor(...COLORS.amber);
    if (bw > 0) doc.rect(x + labelW, by, bw, barH, 'F');
    
    // Value
    doc.setFontSize(4);
    doc.text(String(data[i].frecuencia), x + labelW + bw + 1.5, by + barH * 0.7);
  }
}

/**
 * Draw all 4 charts in a row on the PDF
 */
export function drawChartsOnPDF(doc: jsPDF, chartData: ChartData, startX: number, startY: number, totalWidth: number): number {
  const chartW = (totalWidth - 9) / 4; // 4 charts with 3mm gaps
  const chartH = 28;
  
  // Title
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.navy);
  doc.text('Indicadores del Proyecto', startX, startY);
  doc.setFont('helvetica', 'normal');
  const cy = startY + 4;
  
  // Chart backgrounds
  for (let i = 0; i < 4; i++) {
    const cx = startX + i * (chartW + 3);
    doc.setFillColor(248, 248, 250);
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.15);
    doc.roundedRect(cx, cy, chartW, chartH + 10, 1.5, 1.5, 'FD');
  }
  
  // 1. Pie: Estado
  const cx1 = startX;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.navy);
  doc.text('Estado', cx1 + chartW / 2, cy + 4, { align: 'center' });
  drawPieChart(doc, chartData.porStatus, cx1 + chartW / 2, cy + 14, 7);
  
  // 2. Bar: Empresas
  const cx2 = startX + chartW + 3;
  doc.setFontSize(6);
  doc.text('Empresas', cx2 + chartW / 2, cy + 4, { align: 'center' });
  drawBarChart(doc, chartData.porEmpresa.slice(0, 5), cx2 + 2, cy + 6, chartW - 4, chartH - 4, COLORS.navy, COLORS.red);
  
  // 3. Bar: Especialidades
  const cx3 = startX + 2 * (chartW + 3);
  doc.setFontSize(6);
  doc.text('Especialidades', cx3 + chartW / 2, cy + 4, { align: 'center' });
  drawBarChart(doc, chartData.porEspecialidad.slice(0, 5), cx3 + 2, cy + 6, chartW - 4, chartH - 4, COLORS.indigo, COLORS.red);
  
  // 4. Horizontal Bar: Defectos
  const cx4 = startX + 3 * (chartW + 3);
  doc.setFontSize(6);
  doc.text('Defectos', cx4 + chartW / 2, cy + 4, { align: 'center' });
  drawHorizontalBarChart(doc, chartData.defectos.slice(0, 5), cx4 + 2, cy + 7, chartW - 4, chartH - 3);
  
  return cy + chartH + 12; // Return new Y position after charts
}

/**
 * Draw 3 evidence photos in a row on the PDF
 */
export async function drawPhotosOnPDF(doc: jsPDF, fotos: FotoEvidencia[], startX: number, startY: number, totalWidth: number, getImageUrl: (url: string) => string): Promise<number> {
  if (!fotos.length) return startY;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.navy);
  doc.text('Evidencia Fotográfica', startX, startY);
  doc.setFont('helvetica', 'normal');
  
  const py = startY + 3;
  const photoW = (totalWidth - 6) / 3;
  const photoH = 22;
  
  for (let i = 0; i < Math.min(fotos.length, 3); i++) {
    const px = startX + i * (photoW + 3);
    
    // Photo frame
    doc.setFillColor(248, 248, 250);
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.15);
    doc.roundedRect(px, py, photoW, photoH + 8, 1.5, 1.5, 'FD');
    
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
    doc.setFontSize(5);
    doc.setTextColor(...COLORS.navy);
    doc.setFont('helvetica', 'bold');
    const code = fotos[i].codigo.length > 15 ? fotos[i].codigo.substring(0, 15) + '..' : fotos[i].codigo;
    doc.text(code, px + 2, py + photoH + 2);
    doc.setFont('helvetica', 'normal');
    
    // Status badge
    const isRejected = fotos[i].status === 'rechazado';
    doc.setFillColor(isRejected ? 254 : 220, isRejected ? 226 : 252, isRejected ? 226 : 231);
    doc.roundedRect(px + 2, py + photoH + 3.5, 12, 3, 0.5, 0.5, 'F');
    doc.setFontSize(4);
    doc.setTextColor(isRejected ? 185 : 21, isRejected ? 28 : 128, isRejected ? 28 : 61);
    doc.text(fotos[i].status, px + 8, py + photoH + 5.5, { align: 'center' });
  }
  
  return py + photoH + 10;
}
