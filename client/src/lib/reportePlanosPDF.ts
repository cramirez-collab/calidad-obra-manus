/**
 * Reporte PDF de Pines por Plano - ObjetivaQC
 * =============================================
 * v4.32: Rediseño premium visual
 * - Página portada con resumen ejecutivo y gráfico de barras
 * - 1 plano por página: imagen sin distorsión + pines encima + tabla detallada
 * - Diseño corporativo Objetiva con gradientes, bordes suaves, tipografía elegante
 * - Tabla de desglose por nivel en resumen
 */
import jsPDF from "jspdf";
import { openPDFPreview } from "./pdfDownload";

// ─── Paleta Objetiva ───
const C = {
  AZUL:       [0, 44, 99]    as [number, number, number],
  AZUL_DARK:  [0, 30, 70]    as [number, number, number],
  VERDE:      [2, 179, 129]  as [number, number, number],
  VERDE_LIGHT:[220, 252, 241] as [number, number, number],
  GRIS:       [107, 114, 128] as [number, number, number],
  GRIS_CLARO: [226, 232, 240] as [number, number, number],
  GRIS_MUY_CLARO: [248, 250, 252] as [number, number, number],
  NEGRO:      [15, 23, 42]   as [number, number, number],
  BLANCO:     [255, 255, 255] as [number, number, number],
  BG_CARD:    [241, 245, 249] as [number, number, number],
};

const STATUS_COLORS: Record<string, { rgb: [number, number, number]; label: string; labelShort: string }> = {
  pendiente_foto_despues: { rgb: [245, 158, 11],  label: "Pend. Foto",   labelShort: "P.Foto" },
  pendiente_aprobacion:   { rgb: [59, 130, 246],   label: "Pend. Aprob.", labelShort: "P.Aprob" },
  aprobado:               { rgb: [16, 185, 129],   label: "Aprobado",     labelShort: "Aprob." },
  rechazado:              { rgb: [239, 68, 68],    label: "Rechazado",    labelShort: "Rechaz." },
  sin_item:               { rgb: [107, 114, 128],  label: "Sin Item",     labelShort: "S/Item" },
};

const STATUS_ORDER = ["pendiente_foto_despues", "pendiente_aprobacion", "aprobado", "rechazado", "sin_item"];

function getStatusColorRgb(status?: string | null): [number, number, number] {
  const s = STATUS_COLORS[status || "sin_item"];
  return s ? s.rgb : [107, 114, 128];
}

function getStatusLabel(status?: string | null): string {
  const s = STATUS_COLORS[status || "sin_item"];
  return s ? s.label : "Sin Item";
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

function sinAcentos(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ─── Interfaces ───
export interface PlanoReportData {
  id: number;
  nombre: string;
  nivel: number | null;
  imagenUrl: string | null;
  pines: Array<{
    id: number;
    posX: string;
    posY: string;
    itemId: number | null;
    itemCodigo: string | null;
    itemEstado: string | null;
    itemTitulo: string | null;
    itemConsecutivo: number | null;
    empresaNombre: string | null;
    unidadNombre: string | null;
    especialidadNombre: string | null;
    residenteNombre: string | null;
  }>;
}

export interface PlanoReportConfig {
  proyectoNombre: string;
  planos: PlanoReportData[];
  fechaGeneracion?: string;
  onProgress?: (msg: string) => void;
}

// ─── Image loader ───
interface LoadedImage {
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}

async function loadImageForPDF(url: string): Promise<LoadedImage | null> {
  if (!url) return null;

  const loadViaImg = (src: string): Promise<LoadedImage | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const tid = setTimeout(() => { resolve(null); }, 15000);
      img.onload = () => {
        clearTimeout(tid);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL("image/jpeg", 0.85),
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        });
      };
      img.onerror = () => { clearTimeout(tid); resolve(null); };
      img.src = src;
    });
  };

  try {
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`status ${response.status}`);
    const blob = await response.blob();
    if (blob.size === 0) throw new Error("empty");
    const blobUrl = URL.createObjectURL(blob);
    const result = await loadViaImg(blobUrl);
    URL.revokeObjectURL(blobUrl);
    return result;
  } catch {
    try { return await loadViaImg(url); } catch { return null; }
  }
}

function getImageFormat(dataUrl: string): "JPEG" | "PNG" {
  return dataUrl.includes("image/png") ? "PNG" : "JPEG";
}

// ─── Layout ───
const PW = 210;   // page width
const PH = 297;   // page height
const M = 10;      // margin
const CW = PW - M * 2; // content width
const HEADER_H = 28;
const FOOTER_H = 12;

// ─── Drawing primitives ───

/** Gradient-like header bar: dark blue → blue with green accent line */
function drawHeader(doc: jsPDF, proyectoNombre: string) {
  // Dark blue bar
  doc.setFillColor(...C.AZUL_DARK);
  doc.rect(0, 0, PW, HEADER_H, "F");
  // Lighter blue overlay on right half for depth
  doc.setFillColor(...C.AZUL);
  doc.rect(PW * 0.4, 0, PW * 0.6, HEADER_H, "F");
  // Green accent line
  doc.setFillColor(...C.VERDE);
  doc.rect(0, HEADER_H, PW, 1.5, "F");

  // Logo text
  doc.setTextColor(...C.BLANCO);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("OBJETIVA", M + 1, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 210, 240);
  doc.text("Quality Control", M + 1, 19);

  // Right: report title + project
  doc.setTextColor(...C.BLANCO);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("Reporte de Planos"), PW - M - 1, 12, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(sinAcentos(proyectoNombre), PW - M - 1, 19, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(180, 210, 240);
  const fecha = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(sinAcentos(fecha), PW - M - 1, 25, { align: "right" });
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const y = PH - FOOTER_H;
  doc.setDrawColor(...C.VERDE);
  doc.setLineWidth(0.4);
  doc.line(M, y, PW - M, y);
  doc.setFontSize(8);
  doc.setTextColor(...C.GRIS);
  doc.text(`OQC - Control de Calidad  |  Pagina ${pageNum} de ${totalPages}`, PW / 2, y + 7, { align: "center" });
  doc.setFontSize(7);
  doc.text("objetiva.com", PW - M, y + 7, { align: "right" });
}

/** Teardrop pin marker */
function drawPin(
  doc: jsPDF, cx: number, tipY: number,
  color: [number, number, number], initials: string, size = 3.5,
) {
  const r = size * 0.47;
  const cy = tipY - size * 0.88;

  // White outline
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, r + 0.4, "FD");

  // Colored circle
  doc.setFillColor(...color);
  doc.circle(cx, cy, r, "F");

  // Tail
  const angle = Math.PI * 0.2;
  const lx = cx - r * Math.sin(angle) * 0.6;
  const rx = cx + r * Math.sin(angle) * 0.6;
  const topY = cy + r * 0.5;
  doc.setFillColor(255, 255, 255);
  doc.triangle(lx - 0.2, topY, rx + 0.2, topY, cx, tipY + 0.2, "F");
  doc.setFillColor(...color);
  doc.triangle(lx, topY, rx, topY, cx, tipY, "F");
  // Fill gap
  doc.setFillColor(...color);
  doc.rect(cx - r * 0.55, cy + r * 0.3, r * 1.1, r * 0.4, "F");

  // Inner lighter circle
  doc.setFillColor(
    Math.min(255, color[0] + 35),
    Math.min(255, color[1] + 35),
    Math.min(255, color[2] + 35),
  );
  doc.circle(cx, cy, r * 0.7, "F");

  // Initials
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(size * 1.6);
  doc.setFont("helvetica", "bold");
  doc.text(initials, cx, cy + 0.4, { align: "center", baseline: "middle" });
}

/** Rounded rect with subtle shadow effect */
function drawCardBg(doc: jsPDF, x: number, y: number, w: number, h: number, radius = 2) {
  // Shadow
  doc.setFillColor(200, 200, 210);
  doc.roundedRect(x + 0.4, y + 0.4, w, h, radius, radius, "F");
  // Card
  doc.setFillColor(...C.BLANCO);
  doc.setDrawColor(...C.GRIS_CLARO);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, radius, radius, "FD");
}

// ═══════════════════════════════════════════════════════════════
// PORTADA / RESUMEN
// ═══════════════════════════════════════════════════════════════

function drawCoverPage(doc: jsPDF, proyectoNombre: string, planos: PlanoReportData[]) {
  drawHeader(doc, proyectoNombre);

  let y = HEADER_H + 12;

  // ─── Title ───
  doc.setTextColor(...C.AZUL);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("RESUMEN EJECUTIVO"), PW / 2, y, { align: "center" });
  y += 8;

  // Subtitle line
  doc.setDrawColor(...C.VERDE);
  doc.setLineWidth(1);
  doc.line(PW / 2 - 30, y, PW / 2 + 30, y);
  y += 8;

  // Date
  const now = new Date();
  const fechaStr = now.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const horaStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  doc.setTextColor(...C.GRIS);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(sinAcentos(`${fechaStr} - ${horaStr}`), PW / 2, y, { align: "center" });
  y += 14;

  // ─── Global counts ───
  const globalCounts: Record<string, number> = {};
  let totalPines = 0;
  let nivelesConPines = 0;

  for (const plano of planos) {
    if (plano.pines.length > 0) nivelesConPines++;
    for (const pin of plano.pines) {
      const estado = pin.itemEstado || "sin_item";
      globalCounts[estado] = (globalCounts[estado] || 0) + 1;
      totalPines++;
    }
  }

  // ─── KPI Cards row ───
  const cardW = 32;
  const cardH = 32;
  const cardGap = 4;
  const allCards = STATUS_ORDER.map(k => ({
    key: k,
    count: globalCounts[k] || 0,
    ...STATUS_COLORS[k],
  }));
  const totalCardsW = allCards.length * cardW + (allCards.length - 1) * cardGap;
  let cx = (PW - totalCardsW) / 2;

  for (const card of allCards) {
    drawCardBg(doc, cx, y, cardW, cardH, 3);

    // Color dot
    doc.setFillColor(...card.rgb);
    doc.circle(cx + cardW / 2, y + 8, 3, "F");

    // Number
    doc.setTextColor(...C.NEGRO);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(String(card.count), cx + cardW / 2, y + 19, { align: "center" });

    // Label
    doc.setTextColor(...C.GRIS);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(sinAcentos(card.labelShort), cx + cardW / 2, y + 26, { align: "center" });

    cx += cardW + cardGap;
  }
  y += cardH + 6;

  // ─── Total badge ───
  const badgeW = 50;
  const badgeH = 14;
  const badgeX = (PW - badgeW) / 2;
  doc.setFillColor(...C.AZUL);
  doc.roundedRect(badgeX, y, badgeW, badgeH, 4, 4, "F");
  doc.setTextColor(...C.BLANCO);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL: ${totalPines} pines`, PW / 2, y + 9.5, { align: "center" });
  y += badgeH + 6;

  // ─── Horizontal bar chart ───
  const barChartH = 16;
  const barX = M + 5;
  const barW = CW - 10;
  doc.setFillColor(...C.GRIS_MUY_CLARO);
  doc.roundedRect(barX, y, barW, barChartH, 3, 3, "F");

  if (totalPines > 0) {
    let bx = barX;
    for (const key of STATUS_ORDER) {
      const count = globalCounts[key] || 0;
      if (count === 0) continue;
      const w = (count / totalPines) * barW;
      doc.setFillColor(...STATUS_COLORS[key].rgb);
      if (bx === barX) {
        // First segment: round left corners
        doc.roundedRect(bx, y, w + 1, barChartH, 3, 3, "F");
      } else {
        doc.rect(bx, y, w, barChartH, "F");
      }
      // Percentage text inside bar if wide enough
      if (w > 12) {
        const pct = ((count / totalPines) * 100).toFixed(0);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`${pct}%`, bx + w / 2, y + barChartH / 2 + 1, { align: "center" });
      }
      bx += w;
    }
  }
  y += barChartH + 4;

  // Legend row for bar chart
  const legendW = CW / STATUS_ORDER.length;
  for (let i = 0; i < STATUS_ORDER.length; i++) {
    const key = STATUS_ORDER[i];
    const sc = STATUS_COLORS[key];
    const lx = M + i * legendW + legendW / 2;
    doc.setFillColor(...sc.rgb);
    doc.circle(lx - 12, y + 3, 2, "F");
    doc.setTextColor(...C.NEGRO);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(sinAcentos(sc.label), lx - 8, y + 4.5);
  }
  y += 12;

  // ─── Additional stats ───
  const aprobados = globalCounts["aprobado"] || 0;
  const rechazados = globalCounts["rechazado"] || 0;
  const pendTotal = (globalCounts["pendiente_foto_despues"] || 0) + (globalCounts["pendiente_aprobacion"] || 0);
  const tasaAprob = totalPines > 0 ? ((aprobados / totalPines) * 100).toFixed(1) : "0";
  const tasaRechazo = totalPines > 0 ? ((rechazados / totalPines) * 100).toFixed(1) : "0";
  const tasaResolucion = totalPines > 0 ? (((aprobados + rechazados) / totalPines) * 100).toFixed(1) : "0";

  drawCardBg(doc, M, y, CW, 30, 3);
  const statsY = y + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.AZUL);
  doc.text(sinAcentos("Indicadores Clave"), M + 5, statsY);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.NEGRO);
  const col1 = M + 5;
  const col2 = PW / 2 + 5;
  const sRow = statsY + 8;
  doc.text(sinAcentos(`Tasa de aprobacion: ${tasaAprob}%`), col1, sRow);
  doc.text(sinAcentos(`Tasa de rechazo: ${tasaRechazo}%`), col2, sRow);
  doc.text(sinAcentos(`Pendientes: ${pendTotal} items`), col1, sRow + 6);
  doc.text(sinAcentos(`Tasa de resolucion: ${tasaResolucion}%`), col2, sRow + 6);
  y += 36;

  // ─── Table: Desglose por Nivel ───
  if (y + 16 > PH - FOOTER_H - 10) {
    doc.addPage();
    drawHeader(doc, proyectoNombre);
    y = HEADER_H + 10;
  }

  doc.setTextColor(...C.AZUL);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("Desglose por Nivel"), PW / 2, y, { align: "center" });
  y += 8;

  // Table
  const tX = M;
  const tW = CW;
  const colW = [42, 20, 20, 20, 20, 20, 20, 18];
  const rowH = 8;

  // Header row
  doc.setFillColor(...C.AZUL);
  doc.roundedRect(tX, y, tW, rowH + 1, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const headers = ["Nivel", "P.Foto", "P.Aprob.", "Aprob.", "Rechaz.", "Sin Item", "Total", "%"];
  let hx = tX + 2;
  for (let i = 0; i < headers.length; i++) {
    doc.text(sinAcentos(headers[i]), hx + (i === 0 ? 0 : colW[i] / 2), y + 6, { align: i === 0 ? "left" : "center" });
    hx += colW[i];
  }
  y += rowH + 1;

  const sortedPlanos = [...planos].sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0));
  for (let ri = 0; ri < sortedPlanos.length; ri++) {
    if (y + rowH > PH - FOOTER_H - 5) {
      doc.addPage();
      drawHeader(doc, proyectoNombre);
      y = HEADER_H + 10;
    }

    const plano = sortedPlanos[ri];
    const counts: Record<string, number> = {};
    let planoTotal = 0;
    for (const pin of plano.pines) {
      const e = pin.itemEstado || "sin_item";
      counts[e] = (counts[e] || 0) + 1;
      planoTotal++;
    }

    // Alternating row bg
    doc.setFillColor(ri % 2 === 0 ? 248 : 255, ri % 2 === 0 ? 250 : 255, ri % 2 === 0 ? 252 : 255);
    doc.rect(tX, y, tW, rowH, "F");
    doc.setDrawColor(230, 230, 235);
    doc.setLineWidth(0.1);
    doc.line(tX, y + rowH, tX + tW, y + rowH);

    doc.setFontSize(8);
    let nivelName = sinAcentos(plano.nombre);
    if (nivelName.length > 22) nivelName = nivelName.substring(0, 20) + "..";

    const planoAprob = counts["aprobado"] || 0;
    const pct = planoTotal > 0 ? ((planoAprob / planoTotal) * 100).toFixed(0) : "-";

    const vals = [
      nivelName,
      String(counts["pendiente_foto_despues"] || 0),
      String(counts["pendiente_aprobacion"] || 0),
      String(counts["aprobado"] || 0),
      String(counts["rechazado"] || 0),
      String(counts["sin_item"] || 0),
      String(planoTotal),
      planoTotal > 0 ? `${pct}%` : "-",
    ];

    let vx = tX + 2;
    for (let i = 0; i < vals.length; i++) {
      if (i >= 1 && i <= 5) {
        const sKey = STATUS_ORDER[i - 1];
        const cnt = parseInt(vals[i]);
        if (cnt > 0) {
          doc.setTextColor(...STATUS_COLORS[sKey].rgb);
          doc.setFont("helvetica", "bold");
        } else {
          doc.setTextColor(200, 200, 200);
          doc.setFont("helvetica", "normal");
        }
      } else if (i === 6) {
        doc.setTextColor(...C.AZUL);
        doc.setFont("helvetica", "bold");
      } else if (i === 7) {
        const pctVal = parseInt(pct);
        if (!isNaN(pctVal)) {
          doc.setTextColor(pctVal >= 70 ? 16 : pctVal >= 40 ? 245 : 239, pctVal >= 70 ? 185 : pctVal >= 40 ? 158 : 68, pctVal >= 70 ? 129 : pctVal >= 40 ? 11 : 68);
          doc.setFont("helvetica", "bold");
        } else {
          doc.setTextColor(200, 200, 200);
          doc.setFont("helvetica", "normal");
        }
      } else {
        doc.setTextColor(...C.NEGRO);
        doc.setFont("helvetica", planoTotal > 0 ? "bold" : "normal");
      }
      doc.text(vals[i], vx + (i === 0 ? 0 : colW[i] / 2), y + 5.5, { align: i === 0 ? "left" : "center" });
      vx += colW[i];
    }
    y += rowH;
  }

  // Totals row
  if (y + rowH + 1 > PH - FOOTER_H - 5) {
    doc.addPage();
    drawHeader(doc, proyectoNombre);
    y = HEADER_H + 10;
  }
  doc.setFillColor(...C.AZUL);
  doc.roundedRect(tX, y, tW, rowH, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");

  const totalAprobPct = totalPines > 0 ? ((aprobados / totalPines) * 100).toFixed(0) : "-";
  const totals = [
    "TOTAL",
    String(globalCounts["pendiente_foto_despues"] || 0),
    String(globalCounts["pendiente_aprobacion"] || 0),
    String(aprobados),
    String(rechazados),
    String(globalCounts["sin_item"] || 0),
    String(totalPines),
    totalPines > 0 ? `${totalAprobPct}%` : "-",
  ];
  let ttx = tX + 2;
  for (let i = 0; i < totals.length; i++) {
    doc.text(totals[i], ttx + (i === 0 ? 0 : colW[i] / 2), y + 5.5, { align: i === 0 ? "left" : "center" });
    ttx += colW[i];
  }
}

// ═══════════════════════════════════════════════════════════════
// PLANO PAGE: imagen + pines + tabla detallada
// ═══════════════════════════════════════════════════════════════

function drawPlanoPage(
  doc: jsPDF,
  plano: PlanoReportData,
  planoImg: LoadedImage | null,
  proyectoNombre: string,
) {
  drawHeader(doc, proyectoNombre);

  let y = HEADER_H + 5;

  // ─── Nivel title bar ───
  const titleH = 14;
  doc.setFillColor(...C.AZUL);
  doc.roundedRect(M, y, CW, titleH, 2, 2, "F");
  // Green accent on left
  doc.setFillColor(...C.VERDE);
  doc.roundedRect(M, y, 4, titleH, 2, 0, "F");
  doc.rect(M + 2, y, 2, titleH, "F");

  doc.setTextColor(...C.BLANCO);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const nivelStr = plano.nivel !== null ? `N${plano.nivel}` : "";
  const fullNivel = nivelStr ? `${nivelStr} - ${sinAcentos(plano.nombre)}` : sinAcentos(plano.nombre);
  doc.text(fullNivel, M + 8, y + 10);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${plano.pines.length} pines`, M + CW - 4, y + 10, { align: "right" });
  y += titleH + 3;

  // ─── Image area ───
  const imgAreaH = 110;
  drawCardBg(doc, M, y, CW, imgAreaH, 2);

  if (planoImg) {
    const fmt = getImageFormat(planoImg.dataUrl);
    const pad = 2;
    const cW = CW - pad * 2;
    const cH = imgAreaH - pad * 2;
    const imgAspect = planoImg.naturalWidth / planoImg.naturalHeight;
    const containerAspect = cW / cH;

    let dW: number, dH: number, dX: number, dY: number;
    if (imgAspect > containerAspect) {
      dW = cW;
      dH = cW / imgAspect;
      dX = M + pad;
      dY = y + pad + (cH - dH) / 2;
    } else {
      dH = cH;
      dW = cH * imgAspect;
      dX = M + pad + (cW - dW) / 2;
      dY = y + pad;
    }

    doc.addImage(planoImg.dataUrl, fmt, dX, dY, dW, dH);

    // Draw pins on top
    for (const pin of plano.pines) {
      const px = parseFloat(pin.posX);
      const py = parseFloat(pin.posY);
      if (isNaN(px) || isNaN(py)) continue;
      const pinX = dX + (px / 100) * dW;
      const pinY = dY + (py / 100) * dH;
      const color = getStatusColorRgb(pin.itemEstado);
      const label = getInitials(pin.residenteNombre);
      drawPin(doc, pinX, pinY, color, label, 3.2);
    }
  } else {
    doc.setTextColor(...C.GRIS);
    doc.setFontSize(14);
    doc.text("Sin imagen de plano", M + CW / 2, y + imgAreaH / 2, { align: "center" });
  }
  y += imgAreaH + 3;

  // ─── Legend row ───
  const legendH = 6;
  const legendItemW = CW / STATUS_ORDER.length;
  for (let i = 0; i < STATUS_ORDER.length; i++) {
    const key = STATUS_ORDER[i];
    const sc = STATUS_COLORS[key];
    const lx = M + i * legendItemW;
    doc.setFillColor(...sc.rgb);
    doc.circle(lx + 5, y + legendH / 2, 1.8, "F");
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(sinAcentos(sc.label), lx + 9, y + legendH / 2 + 1);
  }
  y += legendH + 3;

  // ─── Stats pills ───
  const counts: Record<string, number> = {};
  let total = 0;
  for (const pin of plano.pines) {
    const e = pin.itemEstado || "sin_item";
    counts[e] = (counts[e] || 0) + 1;
    total++;
  }

  const pillW = (CW - 8) / STATUS_ORDER.length;
  const pillH = 10;
  for (let i = 0; i < STATUS_ORDER.length; i++) {
    const key = STATUS_ORDER[i];
    const sc = STATUS_COLORS[key];
    const count = counts[key] || 0;
    const px = M + 4 + i * pillW;
    doc.setFillColor(...sc.rgb);
    doc.roundedRect(px + 0.5, y, pillW - 1, pillH, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(String(count), px + pillW / 2, y + 7, { align: "center" });
  }
  y += pillH + 2;

  // Total badge
  doc.setFillColor(...C.AZUL);
  doc.roundedRect(M + CW - 36, y, 36, 7, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${total}`, M + CW - 18, y + 5, { align: "center" });
  y += 10;

  // ─── Detailed table of pins ───
  if (plano.pines.length > 0) {
    const tableStartY = y;
    const tblX = M;
    const tblW = CW;
    // Columns: #, Código, Título, Empresa, Residente, Estado
    const tColW = [10, 22, 52, 36, 32, 28];
    const tRowH = 7;

    // Table header
    doc.setFillColor(...C.AZUL_DARK);
    doc.roundedRect(tblX, y, tblW, tRowH + 0.5, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    const tHeaders = ["#", "Codigo", "Titulo", "Empresa", "Residente", "Estado"];
    let thx = tblX + 1.5;
    for (let i = 0; i < tHeaders.length; i++) {
      doc.text(sinAcentos(tHeaders[i]), thx + 1, y + 5);
      thx += tColW[i];
    }
    y += tRowH + 0.5;

    // Table rows
    const sortedPines = [...plano.pines].sort((a, b) => (a.itemConsecutivo ?? 999) - (b.itemConsecutivo ?? 999));
    for (let pi = 0; pi < sortedPines.length; pi++) {
      // Check page break
      if (y + tRowH > PH - FOOTER_H - 5) {
        doc.addPage();
        drawHeader(doc, proyectoNombre);
        y = HEADER_H + 8;
        // Re-draw table header
        doc.setFillColor(...C.AZUL_DARK);
        doc.roundedRect(tblX, y, tblW, tRowH + 0.5, 1.5, 1.5, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        let rhx = tblX + 1.5;
        for (let i = 0; i < tHeaders.length; i++) {
          doc.text(sinAcentos(tHeaders[i]), rhx + 1, y + 5);
          rhx += tColW[i];
        }
        y += tRowH + 0.5;
      }

      const pin = sortedPines[pi];
      // Row bg
      doc.setFillColor(pi % 2 === 0 ? 248 : 255, pi % 2 === 0 ? 250 : 255, pi % 2 === 0 ? 252 : 255);
      doc.rect(tblX, y, tblW, tRowH, "F");
      doc.setDrawColor(235, 235, 240);
      doc.setLineWidth(0.1);
      doc.line(tblX, y + tRowH, tblX + tblW, y + tRowH);

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");

      // Status color dot at start
      const statusColor = getStatusColorRgb(pin.itemEstado);

      // Row values
      const num = pin.itemConsecutivo ? String(pin.itemConsecutivo) : "-";
      const codigo = sinAcentos(pin.itemCodigo || "-");
      let titulo = sinAcentos(pin.itemTitulo || "-");
      if (titulo.length > 30) titulo = titulo.substring(0, 28) + "..";
      let empresa = sinAcentos(pin.empresaNombre || "-");
      if (empresa.length > 20) empresa = empresa.substring(0, 18) + "..";
      let residente = sinAcentos(pin.residenteNombre || "-");
      if (residente.length > 18) residente = residente.substring(0, 16) + "..";
      const estado = sinAcentos(getStatusLabel(pin.itemEstado));

      const rowVals = [num, codigo, titulo, empresa, residente, estado];
      let rvx = tblX + 1.5;
      for (let i = 0; i < rowVals.length; i++) {
        if (i === 5) {
          // Estado column: colored text
          doc.setTextColor(...statusColor);
          doc.setFont("helvetica", "bold");
        } else {
          doc.setTextColor(...C.NEGRO);
          doc.setFont("helvetica", "normal");
        }
        doc.text(rowVals[i], rvx + 1, y + 5);
        rvx += tColW[i];
      }
      y += tRowH;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════

export async function generarReportePlanosPDF(config: PlanoReportConfig): Promise<void> {
  const { proyectoNombre, planos, onProgress } = config;

  if (planos.length === 0) {
    throw new Error("No hay planos para generar el reporte");
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const progress = onProgress || (() => {});

  const sorted = [...planos].sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0));

  // Pre-load images
  progress("Cargando imagenes...");
  const imageCache: Map<number, LoadedImage | null> = new Map();
  for (let i = 0; i < sorted.length; i++) {
    progress(`Cargando plano ${i + 1}/${sorted.length}...`);
    if (sorted[i].imagenUrl) {
      imageCache.set(sorted[i].id, await loadImageForPDF(sorted[i].imagenUrl!));
    } else {
      imageCache.set(sorted[i].id, null);
    }
  }

  progress("Generando PDF...");

  // Page 1: Cover / Summary
  drawCoverPage(doc, proyectoNombre, sorted);

  // Plano pages: 1 per page with image + table
  for (let i = 0; i < sorted.length; i++) {
    doc.addPage();
    const plano = sorted[i];
    const img = imageCache.get(plano.id) ?? null;
    drawPlanoPage(doc, plano, img, proyectoNombre);
    progress(`Plano ${i + 1}/${sorted.length}...`);
  }

  // Add footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages);
  }

  progress("Abriendo vista previa...");
  openPDFPreview(doc);
}
