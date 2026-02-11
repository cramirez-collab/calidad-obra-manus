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
  firmantes: Array<{
    empresaNombre: string;
    especialidadNombre: string;
    jefeNombre: string;
  }> | null;
  itemsReporte: {
    items: Array<{
      id: number;
      codigo: string;
      titulo: string;
      descripcion: string | null;
      status: string;
      fotoAntesUrl: string | null;
      fotoDespuesUrl: string | null;
      fotoAntesMarcadaUrl: string | null;
      fechaCreacion: any;
      fechaAprobacion: any;
      pinPlanoId: number | null;
      pinPosX: number | null;
      pinPosY: number | null;
      creadoPorNombre: string | null;
      residenteNombre: string | null;
      empresaNombre: string | null;
      especialidadNombre: string | null;
      defectoNombre: string | null;
      unidadNombre: string | null;
      historial: Array<{
        statusAnterior: string | null;
        statusNuevo: string;
        comentario: string | null;
        fecha: any;
        usuarioNombre: string;
      }>;
    }>;
    planos: Array<{
      id: number;
      nombre: string;
      nivel: string | null;
      imagenUrl: string | null;
    }>;
  } | null;
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
  const dpr = 1.5;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

function canvasToDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.85);
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
  doc.addImage(dataURL, "JPEG", xPos, yPos, mmW, mmH);
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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

async function loadImageForPDF(url: string): Promise<string | null> {
  try {
    // Usar proxy del servidor para evitar CORS con CloudFront
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generarReporteEstadisticasPDF(data: ReporteData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const { proyectoNombre, stats, empresas, especialidades, defectosStats, penalizaciones, kpis, rendimiento, defectosPorUsuario, firmantes } = data;

  addHeader(doc, "Reporte de Estadisticas", proyectoNombre);
  const pw = doc.internal.pageSize.getWidth();
  let y = 38;

  // ═══════════ LEYENDA DE COMPROMISO ═══════════
  const fechaEmision = new Date();
  const fechaFin = new Date(fechaEmision.getTime() + 8 * 24 * 60 * 60 * 1000);
  const fmtFecha = (d: Date) => {
    const dia = d.getDate().toString().padStart(2, "0");
    const mes = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"][d.getMonth()];
    return `${dia} de ${mes} de ${d.getFullYear()}`;
  };
  // Recuadro rojo
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.8);
  doc.roundedRect(15, y, pw - 30, 32, 2, 2, "S");
  // Título
  doc.setTextColor(220, 38, 38);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("COMPROMISO DE CORRECCION DE DEFECTOS"), 20, y + 6);
  // Texto
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(sinAcentos("Las personas y empresas que firman el presente documento se comprometen a tener arreglados los defectos"), 20, y + 12);
  doc.text(sinAcentos("detectados en un periodo de una semana a partir de la fecha de emision de este reporte."), 20, y + 16);
  // Fechas
  doc.setTextColor(220, 38, 38);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos(`Fecha de emision: ${fmtFecha(fechaEmision)}`), 20, y + 24);
  doc.text(sinAcentos(`Fecha limite de correccion: ${fmtFecha(fechaFin)}`), pw / 2, y + 24);
  y += 40;

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
      label: empresas?.find((emp) => emp.id === e.empresaId)?.nombre || (e.empresaId === null ? "Sin Empresa" : `Empresa ${e.empresaId}`),
      value: e.count,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }));
    const chartH = Math.max(160, empChartData.length * 28);
    const empImg = drawHorizontalBars(empChartData, 520, chartH, "Items por Empresa");
    y = addChartImage(doc, empImg, y, 520, chartH);

    const empRows = empSorted.map((e, i) => {
      const nombre = empresas?.find((emp) => emp.id === e.empresaId)?.nombre || (e.empresaId === null ? "Sin Empresa" : `Empresa ${e.empresaId}`);
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
        label: esp?.nombre || (e.especialidadId === null ? "Sin Especialidad" : `Esp ${e.especialidadId}`),
        value: e.count,
        color: esp?.color || CHART_PALETTE[i % CHART_PALETTE.length],
      };
    });
    const espImg = drawVerticalBars(espChartData, 520, 220, "Items por Especialidad");
    y = addChartImage(doc, espImg, y, 520, 220);

    const espRows = espSorted.map((e, i) => {
      const nombre = especialidades?.find((esp) => esp.id === e.especialidadId)?.nombre || (e.especialidadId === null ? "Sin Especialidad" : `Esp ${e.especialidadId}`);
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

  // ═══════════ 9. FICHAS DE ITEMS ═══════════
  const itemsData = data.itemsReporte;
  if (itemsData && itemsData.items.length > 0) {
    y = seccion(doc, "9. Fichas de Items", y);
    doc.setTextColor(...C.GRIS);
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text(sinAcentos(`Total: ${itemsData.items.length} items registrados`), 15, y);
    y += 6;

    // Tabla resumen de todos los ítems
    const itemResumenRows = itemsData.items.map((it, i) => {
      const fecha = it.fechaCreacion ? new Date(it.fechaCreacion).toLocaleDateString("es-MX") : "-";
      const statusLabel = statusLabels[it.status] || it.status;
      return [
        String(i + 1),
        it.codigo || "-",
        it.defectoNombre || "-",
        it.empresaNombre || "-",
        it.especialidadNombre || "-",
        statusLabel,
        it.creadoPorNombre || "-",
        fecha,
      ];
    });
    y = tabla(doc, ["#", "Codigo", "Defecto", "Empresa", "Especialidad", "Status", "Capturo", "Fecha"], itemResumenRows, y, {
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 22 }, 5: { cellWidth: 20 }, 7: { cellWidth: 18 } },
    });
    y += 4;

    // Fichas individuales con fotos e historial
    for (const item of itemsData.items) {
      doc.addPage();
      addHeader(doc, "Ficha de Item", proyectoNombre);
      let fy = 36;

      // Encabezado de ficha
      doc.setFillColor(...C.AZUL);
      doc.roundedRect(15, fy, pw - 30, 12, 2, 2, "F");
      doc.setTextColor(...C.BLANCO);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(sinAcentos(`${item.codigo} - ${item.defectoNombre || item.titulo || 'Sin defecto'}`), 20, fy + 8);
      const statusLabel = statusLabels[item.status] || item.status;
      doc.setFontSize(8);
      doc.text(sinAcentos(statusLabel), pw - 20, fy + 8, { align: "right" });
      fy += 18;

      // Info del ítem en 2 columnas
      const infoLeft = [
        ["Empresa", item.empresaNombre || "-"],
        ["Especialidad", item.especialidadNombre || "-"],
        ["Defecto", item.defectoNombre || "-"],
        ["Unidad", item.unidadNombre || "-"],
      ];
      const infoRight = [
        ["Capturo", item.creadoPorNombre || "-"],
        ["Residente", item.residenteNombre || "-"],
        ["Fecha Creacion", item.fechaCreacion ? new Date(item.fechaCreacion).toLocaleDateString("es-MX") : "-"],
        ["Fecha Aprobacion", item.fechaAprobacion ? new Date(item.fechaAprobacion).toLocaleDateString("es-MX") : "-"],
      ];

      const colW = (pw - 30) / 2 - 2;
      doc.setFontSize(7);
      infoLeft.forEach(([label, val], i) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.AZUL);
        doc.text(sinAcentos(label + ":"), 17, fy + i * 6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.NEGRO);
        doc.text(sinAcentos(val), 50, fy + i * 6);
      });
      infoRight.forEach(([label, val], i) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.AZUL);
        doc.text(sinAcentos(label + ":"), pw / 2 + 5, fy + i * 6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.NEGRO);
        doc.text(sinAcentos(val), pw / 2 + 40, fy + i * 6);
      });
      fy += 28;

      if (item.descripcion) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.AZUL);
        doc.setFontSize(7);
        doc.text("Descripcion:", 17, fy);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.NEGRO);
        const descLines = doc.splitTextToSize(sinAcentos(item.descripcion), pw - 55);
        doc.text(descLines, 50, fy);
        fy += descLines.length * 4 + 4;
      }

      // Fotos antes/después
      const fotoAntes = item.fotoAntesMarcadaUrl || item.fotoAntesUrl;
      const fotoDespues = item.fotoDespuesUrl;
      if (fotoAntes || fotoDespues) {
        doc.setFillColor(...C.BG_CARD);
        doc.roundedRect(15, fy - 2, pw - 30, 8, 1, 1, "F");
        doc.setTextColor(...C.AZUL);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Evidencia Fotografica", 20, fy + 3);
        fy += 10;

        const imgW = (pw - 40) / 2;
        const imgH = imgW * 0.75;

        // Labels
        doc.setFontSize(7);
        doc.setTextColor(...C.AZUL);
        doc.setFont("helvetica", "bold");
        if (fotoAntes) doc.text("ANTES", 15 + imgW / 2, fy, { align: "center" });
        if (fotoDespues) doc.text("DESPUES", pw - 15 - imgW / 2, fy, { align: "center" });
        fy += 3;

        // Intentar cargar imágenes
        try {
          if (fotoAntes) {
            const imgData = await loadImageForPDF(fotoAntes);
            if (imgData) doc.addImage(imgData, "JPEG", 15, fy, imgW, imgH);
          }
        } catch { /* skip */ }
        try {
          if (fotoDespues) {
            const imgData = await loadImageForPDF(fotoDespues);
            if (imgData) doc.addImage(imgData, "JPEG", pw - 15 - imgW, fy, imgW, imgH);
          }
        } catch { /* skip */ }

        // Placeholder rectangles si no hay imagen
        doc.setDrawColor(...C.GRIS_CLARO);
        doc.setLineWidth(0.3);
        if (fotoAntes) doc.roundedRect(15, fy, imgW, imgH, 1, 1, "S");
        if (fotoDespues) doc.roundedRect(pw - 15 - imgW, fy, imgW, imgH, 1, 1, "S");
        fy += imgH + 6;
      }

      // Historial del ítem
      if (item.historial && item.historial.length > 0) {
        if (fy > doc.internal.pageSize.getHeight() - 50) {
          doc.addPage();
          fy = 38;
        }
        doc.setFillColor(...C.BG_CARD);
        doc.roundedRect(15, fy - 2, pw - 30, 8, 1, 1, "F");
        doc.setTextColor(...C.AZUL);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Historial de Cambios", 20, fy + 3);
        fy += 10;

        const histRows = item.historial.map((h) => {
          const fecha = h.fecha ? new Date(h.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
          const statusAnt = h.statusAnterior ? (statusLabels[h.statusAnterior] || h.statusAnterior) : "Nuevo";
          const statusNuevo = statusLabels[h.statusNuevo] || h.statusNuevo;
          return [
            fecha,
            `${statusAnt} -> ${statusNuevo}`,
            h.usuarioNombre || "-",
            h.comentario || "-",
          ];
        });
        fy = tabla(doc, ["Fecha", "Cambio", "Usuario", "Comentario"], histRows, fy, {
          columnStyles: { 0: { cellWidth: 35 }, 3: { cellWidth: 50 } },
        });
      }
    }

    // Planos con pines
    if (itemsData.planos.length > 0) {
      for (const plano of itemsData.planos) {
        const itemsEnPlano = itemsData.items.filter((it) => it.pinPlanoId === plano.id);
        if (itemsEnPlano.length === 0) continue;

        doc.addPage();
        addHeader(doc, "Plano con Items", proyectoNombre);
        let py = 36;

        doc.setFillColor(...C.AZUL);
        doc.roundedRect(15, py, pw - 30, 12, 2, 2, "F");
        doc.setTextColor(...C.BLANCO);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(sinAcentos(`Plano: ${plano.nombre} ${plano.nivel ? '('+plano.nivel+')' : ''}`), 20, py + 8);
        doc.setFontSize(8);
        doc.text(`${itemsEnPlano.length} items`, pw - 20, py + 8, { align: "right" });
        py += 18;

        // Intentar cargar imagen del plano
        if (plano.imagenUrl) {
          try {
            const planoImg = await loadImageForPDF(plano.imagenUrl);
            if (planoImg) {
              const planoW = pw - 30;
              const planoH = planoW * 0.6;
              doc.addImage(planoImg, "JPEG", 15, py, planoW, planoH);
              // Dibujar pines sobre el plano
              itemsEnPlano.forEach((it, idx) => {
                if (it.pinPosX != null && it.pinPosY != null) {
                  const px = 15 + (it.pinPosX / 100) * planoW;
                  const ppY = py + (it.pinPosY / 100) * planoH;
                  const color = STATUS_COLORS[it.status] || "#3B82F6";
                  const rgb = hexToRgb(color);
                  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
                  doc.circle(px, ppY, 2.5, "F");
                  doc.setFillColor(255, 255, 255);
                  doc.setFontSize(5);
                  doc.setFont("helvetica", "bold");
                  doc.setTextColor(255, 255, 255);
                  doc.text(String(idx + 1), px, ppY + 0.8, { align: "center" });
                }
              });
              py += planoH + 6;
            }
          } catch { /* skip plano image */ }
        }

        // Leyenda de pines
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.AZUL);
        doc.text("Leyenda de pines:", 15, py);
        py += 4;
        itemsEnPlano.forEach((it, idx) => {
          if (py > doc.internal.pageSize.getHeight() - 15) {
            doc.addPage();
            py = 38;
          }
          const color = STATUS_COLORS[it.status] || "#3B82F6";
          const rgb = hexToRgb(color);
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.circle(17, py, 1.5, "F");
          doc.setFontSize(6.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...C.NEGRO);
          doc.text(sinAcentos(`${idx + 1}. ${it.codigo} - ${it.defectoNombre || it.titulo || '-'} (${it.empresaNombre || '-'})`), 21, py + 0.5);
          py += 4.5;
        });
      }
    }
  }

  // ═══════════ SECCION DE FIRMAS ═══════════
  const firmantesList = firmantes && firmantes.length > 0 ? firmantes : [];
  if (firmantesList.length > 0) {
    const ph = doc.internal.pageSize.getHeight();
    doc.addPage();
    y = 25;

    y = seccion(doc, "Firmas de Compromiso", y);

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text(sinAcentos(`Fecha de emision: ${fmtFecha(fechaEmision)}  |  Fecha limite: ${fmtFecha(fechaFin)}`), 15, y);
    y += 8;

    const colW = (pw - 30 - 10) / 2;
    const firmaH = 38;
    let currentY = y;

    for (let i = 0; i < firmantesList.length; i += 2) {
      if (currentY + firmaH > ph - 25) {
        doc.addPage();
        currentY = 25;
      }
      drawFirmaBox(doc, firmantesList[i], 15, currentY, colW, firmaH);
      if (i + 1 < firmantesList.length) {
        drawFirmaBox(doc, firmantesList[i + 1], 15 + colW + 10, currentY, colW, firmaH);
      }
      currentY += firmaH;
    }
  }

  function drawFirmaBox(d: jsPDF, f: { empresaNombre: string; especialidadNombre: string; jefeNombre: string }, xB: number, yB: number, cW: number, fH: number) {
    d.setFillColor(252, 252, 253);
    d.roundedRect(xB, yB, cW, fH - 3, 1.5, 1.5, "F");
    d.setDrawColor(...C.GRIS_CLARO);
    d.setLineWidth(0.3);
    d.roundedRect(xB, yB, cW, fH - 3, 1.5, 1.5, "S");
    d.setFillColor(...C.VERDE);
    d.rect(xB, yB, cW, 2.5, "F");
    d.setTextColor(...C.AZUL);
    d.setFontSize(6.5);
    d.setFont("helvetica", "bold");
    d.text(sinAcentos(f.especialidadNombre.toUpperCase()), xB + 4, yB + 7);
    d.setTextColor(80, 80, 80);
    d.setFontSize(6);
    d.setFont("helvetica", "normal");
    d.text(sinAcentos(f.empresaNombre), xB + 4, yB + 11);
    d.setDrawColor(...C.AZUL);
    d.setLineWidth(0.4);
    d.line(xB + 8, yB + 24, xB + cW - 8, yB + 24);
    const nombre = f.jefeNombre || "";
    d.setTextColor(...C.AZUL);
    d.setFontSize(6.5);
    d.setFont("helvetica", "bold");
    d.text(sinAcentos(nombre), xB + cW / 2, yB + 28, { align: "center" });
    d.setTextColor(...C.GRIS);
    d.setFontSize(5.5);
    d.setFont("helvetica", "normal");
    d.text("Responsable de Especialidad", xB + cW / 2, yB + 31.5, { align: "center" });
  }

  // ═══════════ FOOTER ═══════════
  addFooters(doc);

  const nombreLimpio = proyectoNombre.replace(/[^a-zA-Z0-9]/g, "_");
  const fecha = new Date().toISOString().split("T")[0];
  downloadPDFBestMethod(doc, `Reporte_Estadisticas_${nombreLimpio}_${fecha}.pdf`);
}
