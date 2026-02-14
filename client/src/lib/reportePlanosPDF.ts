/**
 * Reporte PDF de Pines por Plano - ObjetivaQC
 * =============================================
 * v4.25: TODAS las fuentes x2 (doble tamaño), layout ajustado
 * - Pagina resumen al inicio con estadisticas globales
 * - 1 plano por pagina (para acomodar fuentes x2 sin cortar)
 * - Pines tipo gota (teardrop) con iniciales del residente, color por estatus
 * - Estadisticas por estatus debajo de cada plano
 * - TODOS los pines se mantienen (historicos + actuales), solo cambia color por estatus
 */
import jsPDF from "jspdf";
import { downloadPDFBestMethod } from "./pdfDownload";

// ─── Colores corporativos ───
const C = {
  AZUL: [0, 44, 99] as [number, number, number],
  VERDE: [2, 179, 129] as [number, number, number],
  GRIS: [128, 128, 128] as [number, number, number],
  GRIS_CLARO: [220, 220, 220] as [number, number, number],
  NEGRO: [30, 30, 30] as [number, number, number],
  BLANCO: [255, 255, 255] as [number, number, number],
  BG_LIGHT: [248, 250, 252] as [number, number, number],
  BG_CARD: [241, 245, 249] as [number, number, number],
};

// Colores por estatus (matching ZoomablePlano)
const STATUS_COLORS: Record<string, { rgb: [number, number, number]; label: string }> = {
  pendiente_foto_despues: { rgb: [245, 158, 11], label: "Pend. Foto" },
  pendiente_aprobacion: { rgb: [59, 130, 246], label: "Pend. Aprob." },
  aprobado: { rgb: [16, 185, 129], label: "Aprobado" },
  rechazado: { rgb: [239, 68, 68], label: "Rechazado" },
  sin_item: { rgb: [107, 114, 128], label: "Sin item" },
};

const STATUS_ORDER = ["pendiente_foto_despues", "pendiente_aprobacion", "aprobado", "rechazado", "sin_item"];

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function getStatusColorRgb(status?: string | null): [number, number, number] {
  switch (status) {
    case "pendiente_foto_despues": return hexToRgb("#f59e0b");
    case "pendiente_aprobacion": return hexToRgb("#3b82f6");
    case "aprobado": return hexToRgb("#10b981");
    case "rechazado": return hexToRgb("#ef4444");
    default: return hexToRgb("#6b7280");
  }
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
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

// ─── Utilidades ───
function sinAcentos(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function loadImageForPDF(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`status ${response.status}`);
    const blob = await response.blob();
    if (blob.size === 0) throw new Error("empty");
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    try {
      return await new Promise<string | null>((resolve) => {
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
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => { clearTimeout(tid); resolve(null); };
        img.src = url;
      });
    } catch {
      return null;
    }
  }
}

function getImageFormat(dataUrl: string): "JPEG" | "PNG" {
  if (dataUrl.includes("image/png")) return "PNG";
  return "JPEG";
}

// ─── Layout constants (adjusted for x2 fonts) ───
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const HEADER_H = 34;  // Increased for larger header text
const FOOTER_H = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
// 1 plano per page to accommodate x2 fonts
const PLANO_IMG_H = 140; // Larger image area since 1 per page
const STATS_H = 40;      // Taller stats area for x2 fonts
const GAP = 6;

// ─── Draw teardrop pin on jsPDF ───
function drawTeardropPin(
  doc: jsPDF,
  cx: number,
  tipY: number,
  color: [number, number, number],
  initials: string,
  pinSize: number = 4.0,
) {
  const circleR = pinSize * 0.47;
  const circleY = tipY - pinSize * 0.88;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.circle(cx, circleY, circleR + 0.5, "FD");

  doc.setFillColor(...color);
  doc.circle(cx, circleY, circleR, "F");

  const startAngle = Math.PI * 0.2;
  const tipLeftX = cx - circleR * Math.sin(startAngle) * 0.6;
  const tipRightX = cx + circleR * Math.sin(startAngle) * 0.6;
  const tipTopY = circleY + circleR * 0.5;

  doc.setFillColor(255, 255, 255);
  doc.triangle(tipLeftX - 0.3, tipTopY, tipRightX + 0.3, tipTopY, cx, tipY + 0.3, "F");

  doc.setFillColor(...color);
  doc.triangle(tipLeftX, tipTopY, tipRightX, tipTopY, cx, tipY, "F");

  doc.setFillColor(...color);
  doc.rect(cx - circleR * 0.55, circleY + circleR * 0.3, circleR * 1.1, circleR * 0.4, "F");

  const innerR = circleR * 0.72;
  doc.setFillColor(
    Math.min(255, color[0] + 30),
    Math.min(255, color[1] + 30),
    Math.min(255, color[2] + 30),
  );
  doc.circle(cx, circleY, innerR, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(pinSize * 1.8);
  doc.setFont("helvetica", "bold");
  doc.text(initials, cx, circleY + 0.5, { align: "center", baseline: "middle" });
}

// ─── Draw functions ───
function drawHeader(doc: jsPDF, proyectoNombre: string) {
  doc.setFillColor(...C.AZUL);
  doc.rect(0, 0, PAGE_W, HEADER_H - 3, "F");
  doc.setFillColor(...C.VERDE);
  doc.rect(0, HEADER_H - 3, PAGE_W, 3, "F");

  doc.setTextColor(...C.BLANCO);
  // OBJETIVA: 16→32
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.text("OBJETIVA", MARGIN + 2, 16);
  // Quality Control: 8→16
  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text("Quality Control", MARGIN + 2, 25);

  // Right side: title 10→20
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("Reporte de Pines"), PAGE_W - MARGIN - 2, 14, { align: "right" });
  // Project name: 8→16
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.text(sinAcentos(proyectoNombre), PAGE_W - MARGIN - 2, 22, { align: "right" });
  // Date: 8→14 (slightly less than x2 to fit)
  doc.setFontSize(14);
  const fecha = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(sinAcentos(fecha), PAGE_W - MARGIN - 2, 29, { align: "right" });
}

function drawFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.VERDE);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - FOOTER_H, PAGE_W - MARGIN, PAGE_H - FOOTER_H);
    // Footer: 6.5→13
    doc.setFontSize(13);
    doc.setTextColor(...C.GRIS);
    doc.text(
      `OQC - Control de Calidad  |  Pagina ${i} de ${pageCount}`,
      PAGE_W / 2,
      PAGE_H - 5,
      { align: "center" }
    );
    doc.text("objetiva.com", PAGE_W - MARGIN, PAGE_H - 5, { align: "right" });
  }
}

// ─── Summary page ───
function drawSummaryPage(doc: jsPDF, proyectoNombre: string, planos: PlanoReportData[]) {
  drawHeader(doc, proyectoNombre);

  let y = HEADER_H + 8;

  // Title: 14→28
  doc.setTextColor(...C.AZUL);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("RESUMEN GENERAL"), PAGE_W / 2, y, { align: "center" });
  y += 12;

  // Date/time: 8→16
  const now = new Date();
  const fechaStr = now.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const horaStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  doc.setTextColor(...C.GRIS);
  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text(sinAcentos(`Generado: ${fechaStr}, ${horaStr}`), PAGE_W / 2, y, { align: "center" });
  y += 14;

  // ─── Global statistics ───
  const globalCounts: Record<string, number> = {};
  let totalPines = 0;
  let nivelesConPines = 0;
  let nivelesSinPines = 0;

  for (const plano of planos) {
    if (plano.pines.length > 0) nivelesConPines++;
    else nivelesSinPines++;
    for (const pin of plano.pines) {
      const estado = pin.itemEstado || "sin_item";
      globalCounts[estado] = (globalCounts[estado] || 0) + 1;
      totalPines++;
    }
  }

  // ─── Big number cards (x2 fonts) ───
  const cardW = 34;
  const cardH = 38; // Taller for x2 fonts
  const cardGap = 3;
  const totalCardsW = STATUS_ORDER.length * cardW + (STATUS_ORDER.length - 1) * cardGap;
  let cardX = (PAGE_W - totalCardsW) / 2;

  for (const key of STATUS_ORDER) {
    const sc = STATUS_COLORS[key];
    const count = globalCounts[key] || 0;
    const pct = totalPines > 0 ? ((count / totalPines) * 100).toFixed(1) : "0.0";

    doc.setFillColor(...sc.rgb);
    doc.roundedRect(cardX, y, cardW, cardH, 2, 2, "F");

    // Count: 18→36
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(36);
    doc.setFont("helvetica", "bold");
    doc.text(String(count), cardX + cardW / 2, y + 16, { align: "center" });

    // Percentage: 8→16
    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text(`${pct}%`, cardX + cardW / 2, y + 26, { align: "center" });

    // Label: 6→12
    doc.setFontSize(12);
    doc.text(sinAcentos(sc.label), cardX + cardW / 2, y + 34, { align: "center" });

    cardX += cardW + cardGap;
  }

  y += cardH + 10;

  // ─── Total bar ───
  doc.setFillColor(...C.AZUL);
  doc.roundedRect(MARGIN + 10, y, CONTENT_W - 20, 14, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  // 10→20
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL: ${totalPines} pines en ${planos.length} niveles`, PAGE_W / 2, y + 10, { align: "center" });
  y += 20;

  // ─── Progress bar (stacked horizontal) ───
  const barX = MARGIN + 10;
  const barW = CONTENT_W - 20;
  const barH = 10;

  doc.setFillColor(230, 230, 230);
  doc.roundedRect(barX, y, barW, barH, 2, 2, "F");

  if (totalPines > 0) {
    let offsetX = barX;
    for (const key of STATUS_ORDER) {
      const count = globalCounts[key] || 0;
      if (count === 0) continue;
      const segW = (count / totalPines) * barW;
      const sc = STATUS_COLORS[key];
      doc.setFillColor(...sc.rgb);
      if (offsetX === barX) {
        doc.roundedRect(offsetX, y, segW, barH, 2, 2, "F");
      } else {
        doc.rect(offsetX, y, segW, barH, "F");
      }
      offsetX += segW;
    }
  }
  y += barH + 6;

  // Legend for progress bar: 5.5→11
  const legendW = 34;
  const legendGap = 2;
  const totalLegendW = STATUS_ORDER.length * legendW + (STATUS_ORDER.length - 1) * legendGap;
  let legendX = (PAGE_W - totalLegendW) / 2;
  for (const key of STATUS_ORDER) {
    const sc = STATUS_COLORS[key];
    const count = globalCounts[key] || 0;
    doc.setFillColor(...sc.rgb);
    doc.circle(legendX + 2, y + 3, 2, "F");
    doc.setTextColor(...C.NEGRO);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`${sinAcentos(sc.label)} (${count})`, legendX + 6, y + 5);
    legendX += legendW + legendGap;
  }
  y += 14;

  // ─── Additional stats ───
  const aprobados = globalCounts["aprobado"] || 0;
  const rechazados = globalCounts["rechazado"] || 0;
  const pendFoto = globalCounts["pendiente_foto_despues"] || 0;
  const pendAprob = globalCounts["pendiente_aprobacion"] || 0;
  const sinItem = globalCounts["sin_item"] || 0;
  const tasaAprobacion = totalPines > 0 ? ((aprobados / totalPines) * 100).toFixed(1) : "0.0";
  const tasaRechazo = totalPines > 0 ? ((rechazados / totalPines) * 100).toFixed(1) : "0.0";
  const pendientesTotal = pendFoto + pendAprob;
  const tasaPendientes = totalPines > 0 ? ((pendientesTotal / totalPines) * 100).toFixed(1) : "0.0";
  const resueltos = aprobados + rechazados;
  const tasaResolucion = totalPines > 0 ? ((resueltos / totalPines) * 100).toFixed(1) : "0.0";

  doc.setFillColor(...C.BG_CARD);
  doc.setDrawColor(...C.GRIS_CLARO);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN + 5, y, CONTENT_W - 10, 42, 2, 2, "FD");

  const statsInnerY = y + 5;
  const col1X = MARGIN + 12;
  const col2X = PAGE_W / 2 + 5;

  // Stats title: 8→16
  doc.setTextColor(...C.AZUL);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("Estadisticas Adicionales"), MARGIN + 12, statsInnerY, { baseline: "top" });

  // Stats values: 7→14
  doc.setTextColor(...C.NEGRO);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");

  const sY = statsInnerY + 10;
  doc.text(sinAcentos(`Tasa de aprobacion: ${tasaAprobacion}%`), col1X, sY);
  doc.text(sinAcentos(`Tasa de rechazo: ${tasaRechazo}%`), col2X, sY);
  doc.text(sinAcentos(`Pendientes totales: ${pendientesTotal} (${tasaPendientes}%)`), col1X, sY + 8);
  doc.text(sinAcentos(`Tasa de resolucion: ${tasaResolucion}%`), col2X, sY + 8);
  doc.text(sinAcentos(`Niveles con pines: ${nivelesConPines} de ${planos.length}`), col1X, sY + 16);
  doc.text(sinAcentos(`Items sin vincular: ${sinItem}`), col2X, sY + 16);

  y += 50;

  // ─── Table: breakdown by level ───
  // Check if table fits on this page
  if (y + 20 > PAGE_H - FOOTER_H - 10) {
    doc.addPage();
    drawHeader(doc, proyectoNombre);
    y = HEADER_H + 8;
  }

  doc.setTextColor(...C.AZUL);
  // 10→20
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("Desglose por Nivel"), PAGE_W / 2, y, { align: "center" });
  y += 10;

  // Table header
  const tableX = MARGIN + 2;
  const tableW = CONTENT_W - 4;
  const colWidths = [38, 22, 22, 22, 22, 22, 22, 16];
  // Row height: ~6.5→10
  const rowH = 10;

  doc.setFillColor(...C.AZUL);
  doc.rect(tableX, y, tableW, rowH + 2, "F");
  doc.setTextColor(255, 255, 255);
  // 5.5→11
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");

  const headers = ["Nivel", "P.Foto", "P.Aprob.", "Aprob.", "Rechaz.", "Sin Item", "Total", "%"];
  let hx = tableX + 2;
  for (let i = 0; i < headers.length; i++) {
    doc.text(sinAcentos(headers[i]), hx + (i === 0 ? 0 : colWidths[i] / 2 - 2), y + 7, { align: i === 0 ? "left" : "center" });
    hx += colWidths[i];
  }
  y += rowH + 2;

  // Table rows
  const sortedPlanos = [...planos].sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0));
  for (let ri = 0; ri < sortedPlanos.length; ri++) {
    const plano = sortedPlanos[ri];

    if (y + rowH > PAGE_H - FOOTER_H - 5) {
      doc.addPage();
      drawHeader(doc, proyectoNombre);
      y = HEADER_H + 8;
    }

    const counts: Record<string, number> = {};
    let planoTotal = 0;
    for (const pin of plano.pines) {
      const estado = pin.itemEstado || "sin_item";
      counts[estado] = (counts[estado] || 0) + 1;
      planoTotal++;
    }

    const rowBg = ri % 2 === 0 ? C.BG_LIGHT : C.BLANCO;
    doc.setFillColor(...rowBg);
    doc.rect(tableX, y, tableW, rowH, "F");

    doc.setDrawColor(...C.GRIS_CLARO);
    doc.setLineWidth(0.15);
    doc.line(tableX, y + rowH, tableX + tableW, y + rowH);

    doc.setTextColor(...C.NEGRO);
    // 5.5→11
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const planoAprobados = counts["aprobado"] || 0;
    const pctAprob = planoTotal > 0 ? ((planoAprobados / planoTotal) * 100).toFixed(0) : "-";

    // Truncate long names
    let nivelName = sinAcentos(plano.nombre);
    if (nivelName.length > 18) nivelName = nivelName.substring(0, 16) + "..";

    const vals = [
      nivelName,
      String(counts["pendiente_foto_despues"] || 0),
      String(counts["pendiente_aprobacion"] || 0),
      String(counts["aprobado"] || 0),
      String(counts["rechazado"] || 0),
      String(counts["sin_item"] || 0),
      String(planoTotal),
      planoTotal > 0 ? `${pctAprob}%` : "-",
    ];

    let vx = tableX + 2;
    for (let i = 0; i < vals.length; i++) {
      if (i >= 1 && i <= 5) {
        const statusKey = STATUS_ORDER[i - 1];
        const count = parseInt(vals[i]);
        if (count > 0) {
          doc.setTextColor(...STATUS_COLORS[statusKey].rgb);
          doc.setFont("helvetica", "bold");
        } else {
          doc.setTextColor(180, 180, 180);
          doc.setFont("helvetica", "normal");
        }
      } else if (i === 6) {
        doc.setTextColor(...C.AZUL);
        doc.setFont("helvetica", "bold");
      } else if (i === 7) {
        const pctVal = parseInt(pctAprob);
        if (!isNaN(pctVal)) {
          if (pctVal >= 70) doc.setTextColor(34, 197, 94);
          else if (pctVal >= 40) doc.setTextColor(245, 158, 11);
          else doc.setTextColor(239, 68, 68);
          doc.setFont("helvetica", "bold");
        } else {
          doc.setTextColor(180, 180, 180);
          doc.setFont("helvetica", "normal");
        }
      } else {
        doc.setTextColor(...C.NEGRO);
        doc.setFont("helvetica", planoTotal > 0 ? "bold" : "normal");
      }
      doc.text(vals[i], vx + (i === 0 ? 0 : colWidths[i] / 2 - 2), y + 7, { align: i === 0 ? "left" : "center" });
      vx += colWidths[i];
    }
    y += rowH;
  }

  // Table totals row
  if (y + rowH + 2 > PAGE_H - FOOTER_H - 5) {
    doc.addPage();
    drawHeader(doc, proyectoNombre);
    y = HEADER_H + 8;
  }

  doc.setFillColor(...C.AZUL);
  doc.rect(tableX, y, tableW, rowH + 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");

  const totalAprobPct = totalPines > 0 ? ((aprobados / totalPines) * 100).toFixed(0) : "-";
  const totals = [
    "TOTAL",
    String(pendFoto),
    String(pendAprob),
    String(aprobados),
    String(rechazados),
    String(sinItem),
    String(totalPines),
    totalPines > 0 ? `${totalAprobPct}%` : "-",
  ];

  let tx = tableX + 2;
  for (let i = 0; i < totals.length; i++) {
    doc.text(totals[i], tx + (i === 0 ? 0 : colWidths[i] / 2 - 2), y + 7, { align: i === 0 ? "left" : "center" });
    tx += colWidths[i];
  }
}

function drawPlanoSlot(
  doc: jsPDF,
  plano: PlanoReportData,
  planoImg: string | null,
  slotX: number,
  slotY: number,
  slotW: number,
) {
  const nombre = sinAcentos(plano.nombre);
  const nivelStr = plano.nivel !== null ? `N${plano.nivel}` : "";

  // ─── Title bar ───
  const titleBarH = 20;
  doc.setFillColor(...C.AZUL);
  doc.roundedRect(slotX, slotY, slotW, titleBarH, 2, 2, "F");
  doc.setTextColor(...C.BLANCO);

  // Nivel name: 24pt (user-requested)
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  const fullNivel = nivelStr ? `${nivelStr} - ${nombre}` : nombre;
  doc.text(sinAcentos(fullNivel), slotX + 5, slotY + 14);

  // Pin count right side: 14pt
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(`${plano.pines.length} pines`, slotX + slotW - 5, slotY + 14, { align: "right" });

  const imgY = slotY + titleBarH + 2;
  const imgH = PLANO_IMG_H;

  // ─── Image container ───
  doc.setFillColor(...C.BG_CARD);
  doc.setDrawColor(...C.GRIS_CLARO);
  doc.setLineWidth(0.3);
  doc.roundedRect(slotX, imgY, slotW, imgH, 1, 1, "FD");

  if (planoImg) {
    const fmt = getImageFormat(planoImg);
    const padding = 1;
    doc.addImage(planoImg, fmt, slotX + padding, imgY + padding, slotW - padding * 2, imgH - padding * 2);

    // ─── Draw teardrop pins on top of image ───
    for (const pin of plano.pines) {
      const px = parseFloat(pin.posX);
      const py = parseFloat(pin.posY);
      if (isNaN(px) || isNaN(py)) continue;

      const pinX = slotX + padding + (px / 100) * (slotW - padding * 2);
      const pinY = imgY + padding + (py / 100) * (imgH - padding * 2);

      const color = getStatusColorRgb(pin.itemEstado);
      const label = getInitials(pin.residenteNombre);
      drawTeardropPin(doc, pinX, pinY, color, label, 4.0);
    }
  } else {
    doc.setTextColor(...C.GRIS);
    // 9→18
    doc.setFontSize(18);
    doc.text("Sin imagen", slotX + slotW / 2, imgY + imgH / 2, { align: "center" });
  }

  // ─── Color legend row (x2 fonts) ───
  const legendY = imgY + imgH + 2;
  const legendH = 7;
  const legendItems = STATUS_ORDER.map(k => ({ key: k, ...STATUS_COLORS[k] }));
  const legendItemW = (slotW - 4) / legendItems.length;
  for (let i = 0; i < legendItems.length; i++) {
    const li = legendItems[i];
    const lx = slotX + 2 + i * legendItemW;
    doc.setFillColor(...li.rgb);
    doc.circle(lx + 3, legendY + legendH / 2, 2, "F");
    doc.setTextColor(80, 80, 80);
    // Legend text under colors: 12pt (user-requested)
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(sinAcentos(li.label), lx + 7, legendY + legendH / 2 + 1.5);
  }

  // ─── Stats bar below legend ───
  const statsY = legendY + legendH + 2;
  const statsBarH = STATS_H;

  doc.setFillColor(...C.BG_LIGHT);
  doc.setDrawColor(...C.GRIS_CLARO);
  doc.setLineWidth(0.2);
  doc.roundedRect(slotX, statsY, slotW, statsBarH, 1, 1, "FD");

  // Count by status
  const counts: Record<string, number> = {};
  let total = 0;
  for (const pin of plano.pines) {
    const estado = pin.itemEstado || "sin_item";
    counts[estado] = (counts[estado] || 0) + 1;
    total++;
  }

  // Draw stats as colored pills (x2 fonts)
  const statuses = Object.keys(STATUS_COLORS);
  const pillW = (slotW - 6) / statuses.length;
  const pillH = 14;
  const pillY = statsY + 4;

  for (let i = 0; i < statuses.length; i++) {
    const key = statuses[i];
    const sc = STATUS_COLORS[key];
    const count = counts[key] || 0;
    const px = slotX + 3 + i * pillW;

    doc.setFillColor(...sc.rgb);
    doc.roundedRect(px + 0.5, pillY, pillW - 1, pillH, 2, 2, "F");

    doc.setTextColor(255, 255, 255);
    // 7→14
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(String(count), px + pillW / 2, pillY + 9, { align: "center" });

    doc.setTextColor(...C.GRIS);
    // Stats pill labels: 12pt (user-requested)
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(sinAcentos(sc.label), px + pillW / 2, pillY + pillH + 6, { align: "center" });
  }

  doc.setTextColor(...C.AZUL);
  // 6→12
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${total}`, slotX + slotW - 4, statsY + statsBarH - 3, { align: "right" });
}

// ─── Main export ───
export async function generarReportePlanosPDF(config: PlanoReportConfig): Promise<void> {
  const { proyectoNombre, planos, onProgress } = config;

  if (planos.length === 0) {
    throw new Error("No hay planos para generar el reporte");
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const progress = onProgress || (() => {});

  // Sort planos by nivel
  const sorted = [...planos].sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0));

  // Pre-load all images
  progress("Cargando imagenes...");
  const imageCache: Map<number, string | null> = new Map();
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    progress(`Cargando plano ${i + 1}/${sorted.length}...`);
    if (p.imagenUrl) {
      const img = await loadImageForPDF(p.imagenUrl);
      imageCache.set(p.id, img);
    } else {
      imageCache.set(p.id, null);
    }
  }

  progress("Generando PDF...");

  // ─── Page 1: Summary ───
  drawSummaryPage(doc, proyectoNombre, sorted);

  // ─── Plano pages: 1 plano per page (x2 fonts need more space) ───
  for (let i = 0; i < sorted.length; i++) {
    doc.addPage();
    drawHeader(doc, proyectoNombre);

    const slotY = HEADER_H + 6;
    const plano = sorted[i];
    const img = imageCache.get(plano.id) ?? null;

    drawPlanoSlot(doc, plano, img, MARGIN, slotY, CONTENT_W);

    progress(`Dibujando plano ${i + 1}/${sorted.length}...`);
  }

  // Add footers to all pages
  drawFooters(doc);

  // Download
  progress("Descargando...");
  const safeName = sinAcentos(proyectoNombre).replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const filename = `Planos_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  downloadPDFBestMethod(doc, filename);
}
