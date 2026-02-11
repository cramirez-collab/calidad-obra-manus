/**
 * Reporte PDF completo de Estadisticas - ObjetivaOQC v4.04
 * Genera un PDF profesional con graficas visuales renderizadas en canvas
 * e insertadas como imagenes PNG en el documento.
 *
 * Graficas incluidas:
 * - Donut chart de distribucion por status
 * - Barras horizontales de items por empresa
 * - Barras verticales de items por especialidad
 * - Barras stacked de defectos (aprobados vs rechazados)
 * - Pie chart de severidad
 * - Barras stacked de penalizaciones por contratista
 * - Barras horizontales de defectos por usuario
 * - Barras de tiempos promedio por usuario
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadPDFBestMethod } from "./pdfDownload";

// ─── Colores corporativos Objetiva ───
const C = {
  AZUL: [0, 44, 99] as [number, number, number],
  VERDE: [2, 179, 129] as [number, number, number],
  GRIS: [128, 128, 128] as [number, number, number],
  GRIS_CLARO: [200, 200, 200] as [number, number, number],
  NEGRO: [0, 0, 0] as [number, number, number],
  BLANCO: [255, 255, 255] as [number, number, number],
  ROJO: [239, 68, 68] as [number, number, number],
  AMARILLO: [245, 158, 11] as [number, number, number],
  ESMERALDA: [16, 185, 129] as [number, number, number],
  AZUL_CLARO: [59, 130, 246] as [number, number, number],
  BG_LIGHT: [248, 250, 252] as [number, number, number],
  BG_CARD: [241, 245, 249] as [number, number, number],
};

const STATUS_COLORS: Record<string, string> = {
  pendiente_foto_despues: "#F59E0B",
  pendiente_aprobacion: "#3B82F6",
  aprobado: "#10B981",
  rechazado: "#EF4444",
};

const SEVERITY_COLORS: Record<string, string> = {
  leve: "#3B82F6",
  moderado: "#F59E0B",
  grave: "#F97316",
  critico: "#EF4444",
};

const CHART_PALETTE = [
  "#002C63", "#02B381", "#3B82F6", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1",
  "#84CC16", "#06B6D4", "#D946EF", "#0EA5E9", "#A855F7",
];

function sinAcentos(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ─── Interfaces ───
interface ReporteData {
  proyectoNombre: string;
  stats: {
    total: number;
    porStatus: Array<{ status: string; count: number }>;
    porEmpresa: Array<{ empresaId: number; count: number }>;
    porEspecialidad: Array<{ especialidadId: number | null; count: number }>;
  } | null;
  empresas: Array<{ id: number; nombre: string }> | null;
  especialidades: Array<{ id: number; nombre: string; color?: string | null }> | null;
  defectosStats: {
    totalItems: number;
    porDefecto: Array<{ defecto: { nombre: string } | null; total: number; aprobados: number; rechazados: number }>;
    porSeveridad: Array<{ severidad: string; total: number }>;
  } | null;
  penalizaciones: {
    totalActiva: number;
    totalLiberada: number;
    totalGeneral: number;
    montoPorItem: number;
    porEmpresa: Array<{
      empresaNombre: string;
      totalItems: number;
      noAprobados: number;
      aprobados: number;
      penalizacionActiva: number;
      penalizacionLiberada: number;
    }>;
  } | null;
  kpis: {
    empresas: { mejores: RankItem[]; peores: RankItem[] };
    especialidades: { mejores: RankItem[]; peores: RankItem[] };
    residentes: { mejores: RankItem[]; peores: RankItem[] };
    jefesResidentes: { mejores: RankItem[]; peores: RankItem[] };
    unidades: { mejores: RankItem[]; peores: RankItem[] };
    espacios: { mejores: RankItem[]; peores: RankItem[] };
    defectos: { masFrecuentes: RankItem[]; menosFrecuentes: RankItem[] };
    niveles: { mejores: RankItem[]; peores: RankItem[] };
  } | null;
  rendimiento: Array<{
    usuarioNombre: string | null;
    usuarioRol: string;
    itemsCompletados: number;
    aprobados: number;
    rechazados: number;
    okSupervisor: number;
    tiempoPromedioHoras: number;
  }> | null;
  defectosPorUsuario: Array<{
    usuarioNombre: string | null;
    totalDefectos: number;
    aprobados: number;
    rechazados: number;
  }> | null;
}

interface RankItem {
  nombre: string | null;
  score?: number;
  total?: number;
  tasaAprobacion?: number;
  tasaResolucion?: number;
}

const statusLabels: Record<string, string> = {
  pendiente_foto_despues: "Pendiente Foto",
  pendiente_aprobacion: "Pendiente Aprobacion",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

// ─── Canvas Chart Renderers ───

function createCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  const dpr = 2;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

function canvasToDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

function truncLabel(str: string, max: number): string {
  const s = sinAcentos(str);
  return s.length > max ? s.substring(0, max - 2) + ".." : s;
}

/** Donut chart */
function drawDonut(
  data: Array<{ label: string; value: number; color: string }>,
  w: number, h: number, title?: string
): string {
  const { canvas, ctx } = createCanvas(w, h);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return canvasToDataURL(canvas);

  const cx = w * 0.38;
  const cy = h * 0.52;
  const outerR = Math.min(cx, cy) - 20;
  const innerR = outerR * 0.55;

  if (title) {
    ctx.fillStyle = "#002C63";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sinAcentos(title), w / 2, 16);
  }

  let startAngle = -Math.PI / 2;
  data.forEach((d) => {
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    startAngle += sliceAngle;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  ctx.fillStyle = "#002C63";
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(total), cx, cy - 6);
  ctx.font = "11px Arial, sans-serif";
  ctx.fillStyle = "#64748B";
  ctx.fillText("Total", cx, cy + 12);

  const legendX = w * 0.68;
  let legendY = h * 0.2;
  data.forEach((d) => {
    const pct = ((d.value / total) * 100).toFixed(1);
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(legendX, legendY + 4, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.font = "11px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${sinAcentos(d.label)}`, legendX + 12, legendY + 4);
    ctx.fillStyle = "#64748B";
    ctx.font = "bold 11px Arial, sans-serif";
    ctx.fillText(`${d.value} (${pct}%)`, legendX + 12, legendY + 18);
    legendY += 32;
  });

  return canvasToDataURL(canvas);
}

/** Horizontal bar chart */
function drawHorizontalBars(
  data: Array<{ label: string; value: number; color?: string }>,
  w: number, h: number, title?: string, defaultColor?: string
): string {
  const { canvas, ctx } = createCanvas(w, h);
  if (data.length === 0) return canvasToDataURL(canvas);

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const marginLeft = 110;
  const marginRight = 55;
  const marginTop = title ? 30 : 12;
  const barH = Math.min(22, (h - marginTop - 10) / data.length - 4);
  const gap = 4;

  if (title) {
    ctx.fillStyle = "#002C63";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sinAcentos(title), w / 2, 16);
  }

  data.forEach((d, i) => {
    const y = marginTop + i * (barH + gap);
    const barW = (d.value / maxVal) * (w - marginLeft - marginRight);

    ctx.fillStyle = "#334155";
    ctx.font = "11px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(truncLabel(d.label, 18), marginLeft - 6, y + barH / 2);

    const radius = 3;
    ctx.fillStyle = d.color || defaultColor || "#3B82F6";
    ctx.beginPath();
    ctx.moveTo(marginLeft, y);
    ctx.lineTo(marginLeft + barW - radius, y);
    ctx.quadraticCurveTo(marginLeft + barW, y, marginLeft + barW, y + radius);
    ctx.lineTo(marginLeft + barW, y + barH - radius);
    ctx.quadraticCurveTo(marginLeft + barW, y + barH, marginLeft + barW - radius, y + barH);
    ctx.lineTo(marginLeft, y + barH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#334155";
    ctx.font = "bold 11px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(d.value), marginLeft + barW + 6, y + barH / 2);
  });

  return canvasToDataURL(canvas);
}

/** Stacked horizontal bar chart */
function drawStackedHBars(
  data: Array<{ label: string; values: number[]; colors: string[] }>,
  w: number, h: number, title?: string, legendLabels?: string[]
): string {
  const { canvas, ctx } = createCanvas(w, h);
  if (data.length === 0) return canvasToDataURL(canvas);

  const maxVal = Math.max(...data.map((d) => d.values.reduce((s, v) => s + v, 0)), 1);
  const marginLeft = 110;
  const marginRight = 15;
  const marginTop = title ? 44 : 26;
  const barH = Math.min(22, (h - marginTop - 10) / data.length - 4);
  const gap = 4;

  if (title) {
    ctx.fillStyle = "#002C63";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sinAcentos(title), w / 2, 16);
  }

  const labels = legendLabels || [];
  const colors = data[0]?.colors || [];
  if (labels.length > 0) {
    let lx = marginLeft;
    const ly = title ? 28 : 10;
    labels.forEach((lbl, i) => {
      ctx.fillStyle = colors[i] || "#999";
      ctx.fillRect(lx, ly - 4, 10, 10);
      ctx.fillStyle = "#334155";
      ctx.font = "10px Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(sinAcentos(lbl), lx + 14, ly + 4);
      lx += ctx.measureText(sinAcentos(lbl)).width + 30;
    });
  }

  data.forEach((d, i) => {
    const y = marginTop + i * (barH + gap);
    ctx.fillStyle = "#334155";
    ctx.font = "11px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(truncLabel(d.label, 18), marginLeft - 6, y + barH / 2);

    let xOff = marginLeft;
    const barAreaW = w - marginLeft - marginRight;
    d.values.forEach((val, vi) => {
      if (val <= 0) return;
      const segW = (val / maxVal) * barAreaW;
      ctx.fillStyle = d.colors[vi] || "#999";
      ctx.fillRect(xOff, y, segW, barH);
      if (segW > 28) {
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 9px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(val), xOff + segW / 2, y + barH / 2 + 1);
      }
      xOff += segW;
    });
  });

  return canvasToDataURL(canvas);
}

/** Penalty stacked bars */
function drawPenaltyBars(
  data: Array<{ label: string; activa: number; liberada: number }>,
  w: number, h: number, title?: string
): string {
  const { canvas, ctx } = createCanvas(w, h);
  if (data.length === 0) return canvasToDataURL(canvas);

  const maxVal = Math.max(...data.map((d) => d.activa + d.liberada), 1);
  const marginLeft = 110;
  const marginRight = 15;
  const marginTop = title ? 44 : 26;
  const barH = Math.min(24, (h - marginTop - 10) / data.length - 4);
  const gap = 4;

  if (title) {
    ctx.fillStyle = "#002C63";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sinAcentos(title), w / 2, 16);
  }

  const ly = title ? 28 : 10;
  let lx = marginLeft;
  [
    { label: "Penalizacion Activa", color: "#EF4444" },
    { label: "Liberada", color: "#10B981" },
  ].forEach((item) => {
    ctx.fillStyle = item.color;
    ctx.fillRect(lx, ly - 4, 10, 10);
    ctx.fillStyle = "#334155";
    ctx.font = "10px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(sinAcentos(item.label), lx + 14, ly + 4);
    lx += ctx.measureText(sinAcentos(item.label)).width + 30;
  });

  const barAreaW = w - marginLeft - marginRight;
  data.forEach((d, i) => {
    const y = marginTop + i * (barH + gap);
    ctx.fillStyle = "#334155";
    ctx.font = "11px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(truncLabel(d.label, 18), marginLeft - 6, y + barH / 2);

    let xOff = marginLeft;
    if (d.activa > 0) {
      const segW = (d.activa / maxVal) * barAreaW;
      ctx.fillStyle = "#EF4444";
      ctx.fillRect(xOff, y, segW, barH);
      if (segW > 40) {
        ctx.fillStyle = "#FFF";
        ctx.font = "bold 9px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`$${(d.activa / 1000).toFixed(0)}k`, xOff + segW / 2, y + barH / 2 + 1);
      }
      xOff += segW;
    }
    if (d.liberada > 0) {
      const segW = (d.liberada / maxVal) * barAreaW;
      ctx.fillStyle = "#10B981";
      ctx.fillRect(xOff, y, segW, barH);
      if (segW > 40) {
        ctx.fillStyle = "#FFF";
        ctx.font = "bold 9px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`$${(d.liberada / 1000).toFixed(0)}k`, xOff + segW / 2, y + barH / 2 + 1);
      }
      xOff += segW;
    }
    const totalVal = d.activa + d.liberada;
    if (totalVal > 0) {
      ctx.fillStyle = "#64748B";
      ctx.font = "bold 10px Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`$${totalVal.toLocaleString()}`, xOff + 4, y + barH / 2 + 1);
    }
  });

  return canvasToDataURL(canvas);
}

/** Vertical bar chart */
function drawVerticalBars(
  data: Array<{ label: string; value: number; color: string }>,
  w: number, h: number, title?: string
): string {
  const { canvas, ctx } = createCanvas(w, h);
  if (data.length === 0) return canvasToDataURL(canvas);

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const marginLeft = 40;
  const marginRight = 15;
  const marginTop = title ? 30 : 12;
  const marginBottom = 50;
  const barAreaW = w - marginLeft - marginRight;
  const barAreaH = h - marginTop - marginBottom;
  const barW = Math.min(36, barAreaW / data.length - 6);
  const gap = (barAreaW - barW * data.length) / (data.length + 1);

  if (title) {
    ctx.fillStyle = "#002C63";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sinAcentos(title), w / 2, 16);
  }

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const yLine = marginTop + barAreaH - (i / 4) * barAreaH;
    ctx.beginPath();
    ctx.moveTo(marginLeft, yLine);
    ctx.lineTo(w - marginRight, yLine);
    ctx.stroke();
    ctx.fillStyle = "#94A3B8";
    ctx.font = "9px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(Math.round((maxVal * i) / 4)), marginLeft - 4, yLine + 3);
  }

  data.forEach((d, i) => {
    const x = marginLeft + gap + i * (barW + gap);
    const bH = (d.value / maxVal) * barAreaH;
    const y = marginTop + barAreaH - bH;

    const radius = 3;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.lineTo(x + barW - radius, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
    ctx.lineTo(x + barW, marginTop + barAreaH);
    ctx.lineTo(x, marginTop + barAreaH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#334155";
    ctx.font = "bold 10px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(d.value), x + barW / 2, y - 4);

    ctx.save();
    ctx.translate(x + barW / 2, marginTop + barAreaH + 6);
    ctx.rotate(Math.PI / 5);
    ctx.fillStyle = "#475569";
    ctx.font = "9px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(truncLabel(d.label, 14), 0, 0);
    ctx.restore();
  });

  return canvasToDataURL(canvas);
}

/** Pie chart */
function drawPie(
  data: Array<{ label: string; value: number; color: string }>,
  w: number, h: number, title?: string
): string {
  const { canvas, ctx } = createCanvas(w, h);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return canvasToDataURL(canvas);

  const cx = w * 0.35;
  const cy = h * 0.55;
  const radius = Math.min(cx, cy) - 24;

  if (title) {
    ctx.fillStyle = "#002C63";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sinAcentos(title), w / 2, 16);
  }

  let startAngle = -Math.PI / 2;
  data.forEach((d) => {
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    if (sliceAngle > 0.3) {
      const midAngle = startAngle + sliceAngle / 2;
      const labelR = radius * 0.65;
      const lx = cx + Math.cos(midAngle) * labelR;
      const ly = cy + Math.sin(midAngle) * labelR;
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 11px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${((d.value / total) * 100).toFixed(0)}%`, lx, ly);
    }
    startAngle += sliceAngle;
  });

  const legendX = w * 0.68;
  let legendY = h * 0.22;
  data.forEach((d) => {
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(legendX, legendY + 4, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.font = "11px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${sinAcentos(d.label)} (${d.value})`, legendX + 12, legendY + 7);
    legendY += 22;
  });

  return canvasToDataURL(canvas);
}

// ─── PDF Layout Helpers ───

function addHeader(doc: jsPDF, titulo: string, proyectoNombre: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.AZUL);
  doc.rect(0, 0, pw, 26, "F");
  doc.setFillColor(...C.VERDE);
  doc.rect(0, 26, pw, 2, "F");

  doc.setTextColor(...C.BLANCO);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("OBJETIVA", 15, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Quality Control", 15, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos(titulo), pw - 15, 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(sinAcentos(proyectoNombre), pw - 15, 16, { align: "right" });
  const fecha = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(sinAcentos(fecha), pw - 15, 22, { align: "right" });
}

function addFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.VERDE);
    doc.setLineWidth(0.5);
    doc.line(15, ph - 15, pw - 15, ph - 15);
    doc.setFontSize(7);
    doc.setTextColor(...C.GRIS);
    doc.text(`OQC - Control de Calidad de Obra  |  Pagina ${i} de ${pageCount}`, pw / 2, ph - 10, { align: "center" });
    doc.text("www.objetiva.com", pw - 15, ph - 10, { align: "right" });
  }
}

function seccion(doc: jsPDF, titulo: string, yPos: number): number {
  const ph = doc.internal.pageSize.getHeight();
  if (yPos > ph - 55) {
    doc.addPage();
    yPos = 38;
  }
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.AZUL);
  doc.roundedRect(15, yPos - 5, pw - 30, 14, 2, 2, "F");
  doc.setTextColor(...C.BLANCO);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos(titulo), 20, yPos + 4);
  return yPos + 16;
}

function subSeccion(doc: jsPDF, titulo: string, yPos: number): number {
  const ph = doc.internal.pageSize.getHeight();
  if (yPos > ph - 40) {
    doc.addPage();
    yPos = 38;
  }
  doc.setTextColor(...C.AZUL);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos(titulo), 15, yPos);
  doc.setDrawColor(...C.VERDE);
  doc.setLineWidth(0.3);
  doc.line(15, yPos + 1.5, 15 + doc.getTextWidth(sinAcentos(titulo)), yPos + 1.5);
  return yPos + 7;
}

function tabla(doc: jsPDF, headers: string[], data: string[][], startY: number, opts?: { columnStyles?: any }): number {
  const ph = doc.internal.pageSize.getHeight();
  if (startY > ph - 40) {
    doc.addPage();
    startY = 38;
  }
  autoTable(doc, {
    startY,
    head: [headers.map((h) => sinAcentos(h))],
    body: data.map((row) => row.map((cell) => sinAcentos(cell ?? "-"))),
    theme: "striped",
    headStyles: { fillColor: C.AZUL, textColor: C.BLANCO, fontStyle: "bold", fontSize: 7.5, cellPadding: 2 },
    bodyStyles: { fontSize: 7.5, textColor: C.NEGRO, cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    margin: { left: 15, right: 15 },
    columnStyles: opts?.columnStyles,
  });
  return (doc as any).lastAutoTable?.finalY || startY + 20;
}

function kpiCards(doc: jsPDF, metricas: Array<{ label: string; value: string; accent?: boolean }>, yPos: number): number {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  if (yPos > ph - 50) {
    doc.addPage();
    yPos = 38;
  }
  const count = metricas.length;
  const cardW = (pw - 30 - (count - 1) * 3) / count;
  let xPos = 15;
  metricas.forEach((m) => {
    doc.setFillColor(...C.BG_CARD);
    doc.roundedRect(xPos, yPos, cardW, 20, 2, 2, "F");
    const accentColor = m.accent ? C.ROJO : C.VERDE;
    doc.setFillColor(...accentColor);
    doc.rect(xPos, yPos, 2, 20, "F");
    doc.setTextColor(...C.AZUL);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(sinAcentos(m.value), xPos + cardW / 2 + 1, yPos + 9, { align: "center" });
    doc.setTextColor(...C.GRIS);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(sinAcentos(m.label), xPos + cardW / 2 + 1, yPos + 15, { align: "center" });
    xPos += cardW + 3;
  });
  return yPos + 26;
}

function addChartImage(doc: jsPDF, dataURL: string, yPos: number, imgW: number, imgH: number): number {
  const ph = doc.internal.pageSize.getHeight();
  const pw = doc.internal.pageSize.getWidth();
  const mmW = Math.min(imgW * 0.26, pw - 30);
  const mmH = imgH * 0.26 * (mmW / (imgW * 0.26));
  if (yPos + mmH > ph - 20) {
    doc.addPage();
    yPos = 38;
  }
  const xPos = (pw - mmW) / 2;
  doc.addImage(dataURL, "PNG", xPos, yPos, mmW, mmH);
  return yPos + mmH + 4;
}

function rankingTable(doc: jsPDF, titulo: string, mejores: RankItem[], peores: RankItem[], dataKey: string, yPos: number, unit: string = "%"): number {
  yPos = subSeccion(doc, titulo, yPos);
  const headers = ["#", "Mejores", unit === "%" ? "Aprob." : "Total", "#", "Peores", unit === "%" ? "Aprob." : "Total"];
  const maxLen = Math.max(mejores.length, peores.length, 1);
  const rows: string[][] = [];
  for (let i = 0; i < maxLen; i++) {
    const m = mejores[i];
    const p = peores[i];
    const mVal = m ? (m[dataKey as keyof RankItem] as number) : 0;
    const pVal = p ? (p[dataKey as keyof RankItem] as number) : 0;
    rows.push([
      m ? String(i + 1) : "",
      m ? (m.nombre || "Sin nombre") : "",
      m ? `${mVal}${unit}` : "",
      p ? String(i + 1) : "",
      p ? (p.nombre || "Sin nombre") : "",
      p ? `${pVal}${unit}` : "",
    ]);
  }
  yPos = tabla(doc, headers, rows, yPos, {
    columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 8 } },
  });
  return yPos + 3;
}

// ─── Main Export ───

export function generarReporteEstadisticasPDF(data: ReporteData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const { proyectoNombre, stats, empresas, especialidades, defectosStats, penalizaciones, kpis, rendimiento, defectosPorUsuario } = data;

  addHeader(doc, "Reporte de Estadisticas", proyectoNombre);
  let y = 38;

  // ═══════════ 1. RESUMEN GENERAL ═══════════
  y = seccion(doc, "1. Resumen General", y);

  const totalItems = stats?.total || 0;
  const pendFoto = Number(stats?.porStatus?.find((s) => s.status === "pendiente_foto_despues")?.count) || 0;
  const pendAprob = Number(stats?.porStatus?.find((s) => s.status === "pendiente_aprobacion")?.count) || 0;
  const aprobados = Number(stats?.porStatus?.find((s) => s.status === "aprobado")?.count) || 0;
  const rechazados = Number(stats?.porStatus?.find((s) => s.status === "rechazado")?.count) || 0;
  const pendientes = pendFoto + pendAprob;

  y = kpiCards(doc, [
    { label: "Total Items", value: String(totalItems) },
    { label: "Pendientes", value: String(pendientes) },
    { label: "Aprobados", value: String(aprobados) },
    { label: "Rechazados", value: String(rechazados), accent: true },
  ], y);

  // Donut chart - distribucion por status
  const statusData = (stats?.porStatus || []).map((s) => ({
    label: statusLabels[s.status] || s.status,
    value: Number(s.count),
    color: STATUS_COLORS[s.status] || "#94A3B8",
  }));
  if (statusData.length > 0) {
    const donutImg = drawDonut(statusData, 520, 200, "Distribucion por Estado");
    y = addChartImage(doc, donutImg, y, 520, 200);
  }

  const statusRows = (stats?.porStatus || []).map((s) => [
    statusLabels[s.status] || s.status,
    String(s.count),
    totalItems > 0 ? `${((Number(s.count) / totalItems) * 100).toFixed(1)}%` : "0%",
  ]);
  y = tabla(doc, ["Estado", "Cantidad", "Porcentaje"], statusRows, y);
  y += 4;

  // ═══════════ 2. ITEMS POR EMPRESA ═══════════
  if (stats?.porEmpresa && stats.porEmpresa.length > 0) {
    y = seccion(doc, "2. Items por Empresa", y);
    const empSorted = [...stats.porEmpresa].sort((a, b) => b.count - a.count);
    const empChartData = empSorted.slice(0, 12).map((e, i) => ({
      label: empresas?.find((emp) => emp.id === e.empresaId)?.nombre || `Empresa ${e.empresaId}`,
      value: e.count,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }));
    const chartH = Math.max(160, empChartData.length * 28);
    const empImg = drawHorizontalBars(empChartData, 520, chartH, "Items por Empresa");
    y = addChartImage(doc, empImg, y, 520, chartH);

    const empRows = empSorted.map((e, i) => {
      const nombre = empresas?.find((emp) => emp.id === e.empresaId)?.nombre || `Empresa ${e.empresaId}`;
      return [String(i + 1), nombre, String(e.count), totalItems > 0 ? `${((e.count / totalItems) * 100).toFixed(1)}%` : "0%"];
    });
    y = tabla(doc, ["#", "Empresa", "Items", "%"], empRows, y);
    y += 4;
  }

  // ═══════════ 3. ITEMS POR ESPECIALIDAD ═══════════
  if (stats?.porEspecialidad && stats.porEspecialidad.length > 0) {
    y = seccion(doc, "3. Items por Especialidad", y);
    const espSorted = [...stats.porEspecialidad].sort((a, b) => b.count - a.count);
    const espChartData = espSorted.slice(0, 10).map((e, i) => {
      const esp = especialidades?.find((esp) => esp.id === e.especialidadId);
      return {
        label: esp?.nombre || `Esp ${e.especialidadId}`,
        value: e.count,
        color: esp?.color || CHART_PALETTE[i % CHART_PALETTE.length],
      };
    });
    const espImg = drawVerticalBars(espChartData, 520, 220, "Items por Especialidad");
    y = addChartImage(doc, espImg, y, 520, 220);

    const espRows = espSorted.map((e, i) => {
      const nombre = especialidades?.find((esp) => esp.id === e.especialidadId)?.nombre || `Esp ${e.especialidadId}`;
      return [String(i + 1), nombre, String(e.count), totalItems > 0 ? `${((e.count / totalItems) * 100).toFixed(1)}%` : "0%"];
    });
    y = tabla(doc, ["#", "Especialidad", "Items", "%"], espRows, y);
    y += 4;
  }

  // ═══════════ 4. ESTADISTICAS DE DEFECTOS ═══════════
  if (defectosStats) {
    y = seccion(doc, "4. Estadisticas de Defectos", y);
    const totalDef = defectosStats.totalItems || 0;
    const totalAprob = defectosStats.porDefecto.reduce((a, d) => a + d.aprobados, 0);
    const tasaAprob = totalDef > 0 ? ((totalAprob / totalDef) * 100).toFixed(1) : "0";
    const graves = defectosStats.porSeveridad?.find((s) => s.severidad === "grave")?.total || 0;
    const criticos = defectosStats.porSeveridad?.find((s) => s.severidad === "critico")?.total || 0;

    y = kpiCards(doc, [
      { label: "Total con Defecto", value: String(totalDef) },
      { label: "Tasa Aprobacion", value: `${tasaAprob}%` },
      { label: "Graves", value: String(graves), accent: graves > 0 },
      { label: "Criticos", value: String(criticos), accent: criticos > 0 },
    ], y);

    const defSorted = [...defectosStats.porDefecto].sort((a, b) => b.total - a.total).slice(0, 10);
    if (defSorted.length > 0) {
      const defChartData = defSorted.map((d) => ({
        label: d.defecto?.nombre || "Sin nombre",
        values: [d.aprobados, d.rechazados],
        colors: ["#10B981", "#EF4444"],
      }));
      const defChartH = Math.max(160, defChartData.length * 28);
      const defImg = drawStackedHBars(defChartData, 520, defChartH, "Top Defectos (Aprobados vs Rechazados)", ["Aprobados", "Rechazados"]);
      y = addChartImage(doc, defImg, y, 520, defChartH);
    }

    y = subSeccion(doc, "Detalle de Defectos", y);
    const defRows = defectosStats.porDefecto
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
      .map((d, i) => [
        String(i + 1),
        d.defecto?.nombre || "Sin nombre",
        String(d.total),
        String(d.aprobados),
        String(d.rechazados),
        d.total > 0 ? `${((d.aprobados / d.total) * 100).toFixed(0)}%` : "0%",
      ]);
    y = tabla(doc, ["#", "Defecto", "Total", "Aprob.", "Rech.", "% Aprob."], defRows, y);
    y += 3;

    if (defectosStats.porSeveridad && defectosStats.porSeveridad.length > 0) {
      const sevData = defectosStats.porSeveridad.map((s) => ({
        label: s.severidad.charAt(0).toUpperCase() + s.severidad.slice(1),
        value: s.total,
        color: SEVERITY_COLORS[s.severidad] || "#94A3B8",
      }));
      const sevImg = drawPie(sevData, 420, 180, "Distribucion por Severidad");
      y = addChartImage(doc, sevImg, y, 420, 180);

      const sevRows = defectosStats.porSeveridad.map((s) => [
        s.severidad.charAt(0).toUpperCase() + s.severidad.slice(1),
        String(s.total),
        totalDef > 0 ? `${((s.total / totalDef) * 100).toFixed(1)}%` : "0%",
      ]);
      y = tabla(doc, ["Severidad", "Total", "%"], sevRows, y);
      y += 4;
    }
  }

  // ═══════════ 5. PENALIZACIONES ═══════════
  if (penalizaciones) {
    y = seccion(doc, "5. Penalizaciones ($2,000 MXN/item)", y);
    y = kpiCards(doc, [
      { label: "Penalizacion Activa", value: `$${penalizaciones.totalActiva.toLocaleString()}`, accent: penalizaciones.totalActiva > 0 },
      { label: "Liberada", value: `$${penalizaciones.totalLiberada.toLocaleString()}` },
      { label: "Total Acumulado", value: `$${penalizaciones.totalGeneral.toLocaleString()}` },
      { label: "Monto/Item", value: `$${penalizaciones.montoPorItem.toLocaleString()}` },
    ], y);

    if (penalizaciones.porEmpresa.length > 0) {
      const penSorted = [...penalizaciones.porEmpresa].sort((a, b) => b.penalizacionActiva - a.penalizacionActiva);
      const penChartH = Math.max(160, penSorted.length * 30);
      const penImg = drawPenaltyBars(
        penSorted.map((e) => ({ label: e.empresaNombre, activa: e.penalizacionActiva, liberada: e.penalizacionLiberada })),
        520, penChartH, "Penalizaciones por Contratista"
      );
      y = addChartImage(doc, penImg, y, 520, penChartH);

      y = subSeccion(doc, "Desglose por Contratista", y);
      const penRows = penSorted.map((e) => [
        e.empresaNombre,
        String(e.totalItems),
        String(e.noAprobados),
        String(e.aprobados),
        `$${e.penalizacionActiva.toLocaleString()}`,
        `$${e.penalizacionLiberada.toLocaleString()}`,
      ]);
      penRows.push([
        "TOTAL",
        String(penalizaciones.porEmpresa.reduce((s, e) => s + e.totalItems, 0)),
        String(penalizaciones.porEmpresa.reduce((s, e) => s + e.noAprobados, 0)),
        String(penalizaciones.porEmpresa.reduce((s, e) => s + e.aprobados, 0)),
        `$${penalizaciones.totalActiva.toLocaleString()}`,
        `$${penalizaciones.totalLiberada.toLocaleString()}`,
      ]);
      y = tabla(doc, ["Empresa", "Total", "No Aprob.", "Aprob.", "Penalizacion", "Liberada"], penRows, y);
      y += 4;
    }
  }

  // ═══════════ 6. RANKING MEJORES Y PEORES ═══════════
  if (kpis) {
    y = seccion(doc, "6. Ranking de Rendimiento", y);
    doc.setTextColor(...C.GRIS);
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text(sinAcentos("Tasa de aprobacion = items aprobados / total items."), 15, y);
    y += 6;

    y = rankingTable(doc, "Empresas", kpis.empresas.mejores, kpis.empresas.peores, "tasaAprobacion", y);
    y = rankingTable(doc, "Especialidades", kpis.especialidades.mejores, kpis.especialidades.peores, "tasaAprobacion", y);
    y = rankingTable(doc, "Residentes", kpis.residentes.mejores, kpis.residentes.peores, "tasaAprobacion", y);
    y = rankingTable(doc, "Jefes de Residentes", kpis.jefesResidentes.mejores, kpis.jefesResidentes.peores, "tasaAprobacion", y);
    y = rankingTable(doc, "Unidades", kpis.unidades.mejores, kpis.unidades.peores, "tasaAprobacion", y);
    y = rankingTable(doc, "Espacios", kpis.espacios.mejores, kpis.espacios.peores, "tasaAprobacion", y);
    y = rankingTable(doc, "Defectos (por frecuencia)", kpis.defectos.menosFrecuentes, kpis.defectos.masFrecuentes, "total", y, "");
    y = rankingTable(doc, "Niveles", kpis.niveles.mejores, kpis.niveles.peores, "tasaAprobacion", y);
  }

  // ═══════════ 7. RENDIMIENTO POR USUARIO ═══════════
  if (rendimiento && rendimiento.length > 0) {
    y = seccion(doc, "7. Rendimiento por Usuario", y);
    const totalUsuarios = rendimiento.length;
    const totalAprobUsuarios = rendimiento.reduce((a, u) => a + (u.aprobados || 0), 0);
    const tiempoPromGlobal = rendimiento.length > 0
      ? (rendimiento.reduce((a, u) => a + (u.tiempoPromedioHoras || 0), 0) / rendimiento.length).toFixed(1)
      : "0";
    const totalOK = rendimiento.reduce((a, u) => a + (u.okSupervisor || 0), 0);

    y = kpiCards(doc, [
      { label: "Usuarios Activos", value: String(totalUsuarios) },
      { label: "Total Aprobados", value: String(totalAprobUsuarios) },
      { label: "Tiempo Promedio", value: `${tiempoPromGlobal}h` },
      { label: "OK Supervisor", value: String(totalOK) },
    ], y);

    const rendSorted = [...rendimiento].sort((a, b) => b.itemsCompletados - a.itemsCompletados).slice(0, 10);
    if (rendSorted.length > 0) {
      const rendChartData = rendSorted.map((u) => ({
        label: u.usuarioNombre || "Usuario",
        values: [u.aprobados, u.rechazados],
        colors: ["#10B981", "#EF4444"],
      }));
      const rendChartH = Math.max(160, rendChartData.length * 28);
      const rendImg = drawStackedHBars(rendChartData, 520, rendChartH, "Rendimiento por Usuario (Top 10)", ["Aprobados", "Rechazados"]);
      y = addChartImage(doc, rendImg, y, 520, rendChartH);
    }

    const tiemposSorted = [...rendimiento]
      .filter((u) => u.tiempoPromedioHoras > 0)
      .sort((a, b) => b.tiempoPromedioHoras - a.tiempoPromedioHoras)
      .slice(0, 10);
    if (tiemposSorted.length > 0) {
      const tiemposChartData = tiemposSorted.map((u) => ({
        label: u.usuarioNombre || "Usuario",
        value: Math.round(u.tiempoPromedioHoras * 10) / 10,
        color: "#3B82F6",
      }));
      const tiemposH = Math.max(160, tiemposChartData.length * 28);
      const tiemposImg = drawHorizontalBars(tiemposChartData, 520, tiemposH, "Tiempo Promedio de Respuesta (horas)");
      y = addChartImage(doc, tiemposImg, y, 520, tiemposH);
    }

    y = subSeccion(doc, "Detalle por Usuario", y);
    const userRows = rendimiento
      .sort((a, b) => b.itemsCompletados - a.itemsCompletados)
      .map((u) => {
        const efic = u.itemsCompletados > 0 ? ((u.aprobados / u.itemsCompletados) * 100).toFixed(0) : "0";
        const rolLabel =
          u.usuarioRol === "supervisor" ? "Supervisor" :
          u.usuarioRol === "jefe_residente" ? "Jefe Residente" :
          u.usuarioRol === "residente" ? "Residente" :
          u.usuarioRol === "admin" ? "Admin" : u.usuarioRol || "-";
        return [
          u.usuarioNombre || "Usuario",
          rolLabel,
          String(u.itemsCompletados),
          String(u.aprobados),
          String(u.rechazados),
          String(u.okSupervisor),
          `${(u.tiempoPromedioHoras || 0).toFixed(1)}h`,
          `${efic}%`,
        ];
      });
    y = tabla(doc, ["Usuario", "Rol", "Total", "Aprob.", "Rech.", "OK", "Tiempo", "Efic."], userRows, y);
    y += 4;
  }

  // ═══════════ 8. DEFECTOS POR USUARIO ═══════════
  if (defectosPorUsuario && defectosPorUsuario.length > 0) {
    y = seccion(doc, "8. Defectos por Usuario", y);
    const defUserSorted = [...defectosPorUsuario].sort((a, b) => b.totalDefectos - a.totalDefectos).slice(0, 10);
    if (defUserSorted.length > 0) {
      const defUserChartData = defUserSorted.map((u) => ({
        label: u.usuarioNombre || "Usuario",
        values: [u.aprobados, u.rechazados],
        colors: ["#10B981", "#EF4444"],
      }));
      const defUserH = Math.max(160, defUserChartData.length * 28);
      const defUserImg = drawStackedHBars(defUserChartData, 520, defUserH, "Defectos por Usuario (Top 10)", ["Aprobados", "Rechazados"]);
      y = addChartImage(doc, defUserImg, y, 520, defUserH);
    }

    const defUserRows = defectosPorUsuario
      .sort((a, b) => b.totalDefectos - a.totalDefectos)
      .slice(0, 20)
      .map((u, i) => [
        String(i + 1),
        u.usuarioNombre || "Usuario",
        String(u.totalDefectos),
        String(u.aprobados),
        String(u.rechazados),
        u.totalDefectos > 0 ? `${((u.aprobados / u.totalDefectos) * 100).toFixed(0)}%` : "0%",
      ]);
    y = tabla(doc, ["#", "Usuario", "Defectos", "Aprob.", "Rech.", "% Aprob."], defUserRows, y);
  }

  // ═══════════ FOOTER ═══════════
  addFooters(doc);

  const nombreLimpio = proyectoNombre.replace(/[^a-zA-Z0-9]/g, "_");
  const fecha = new Date().toISOString().split("T")[0];
  downloadPDFBestMethod(doc, `Reporte_Estadisticas_${nombreLimpio}_${fecha}.pdf`);
}
