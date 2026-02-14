/**
 * Reporte PDF de Pines por Plano - ObjetivaQC
 * =============================================
 * - Pagina resumen al inicio con estadisticas globales
 * - 2 planos por pagina (vertical / portrait)
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
  pendiente_foto_despues: { rgb: [245, 158, 11], label: "Pend. Foto" },   // Naranja (matches app)
  pendiente_aprobacion: { rgb: [59, 130, 246], label: "Pend. Aprob." },   // Azul (matches app)
  aprobado: { rgb: [16, 185, 129], label: "Aprobado" },                   // Verde (matches app #10b981)
  rechazado: { rgb: [239, 68, 68], label: "Rechazado" },                  // Rojo (matches app)
  sin_item: { rgb: [107, 114, 128], label: "Sin item" },                  // Gris (matches app)
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
    case "pendiente_foto_despues": return hexToRgb("#f59e0b"); // Naranja (matches app)
    case "pendiente_aprobacion": return hexToRgb("#3b82f6");   // Azul (matches app)
    case "aprobado": return hexToRgb("#10b981");               // Verde (matches app)
    case "rechazado": return hexToRgb("#ef4444");              // Rojo (matches app)
    default: return hexToRgb("#6b7280");                       // Gris (matches app)
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

// ─── Layout constants ───
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const HEADER_H = 28;
const FOOTER_H = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PLANO_SLOT_H = 124; // 12(title) + 88(img) + 24(stats)
const PLANO_IMG_H = 88;
const STATS_H = 24;
const GAP = 8;

// ─── Draw teardrop pin on jsPDF ───
function drawTeardropPin(
  doc: jsPDF,
  cx: number,
  tipY: number,
  color: [number, number, number],
  initials: string,
  pinSize: number = 3.5,
) {
  const circleR = pinSize * 0.47;
  const circleY = tipY - pinSize * 0.88;

  // White border (slightly larger)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.circle(cx, circleY, circleR + 0.5, "FD");

  // Main colored circle
  doc.setFillColor(...color);
  doc.circle(cx, circleY, circleR, "F");

  // Draw the pointed tip using triangles
  const startAngle = Math.PI * 0.2;
  const tipLeftX = cx - circleR * Math.sin(startAngle) * 0.6;
  const tipRightX = cx + circleR * Math.sin(startAngle) * 0.6;
  const tipTopY = circleY + circleR * 0.5;

  // White border for tip
  doc.setFillColor(255, 255, 255);
  doc.triangle(tipLeftX - 0.3, tipTopY, tipRightX + 0.3, tipTopY, cx, tipY + 0.3, "F");

  // Colored tip
  doc.setFillColor(...color);
  doc.triangle(tipLeftX, tipTopY, tipRightX, tipTopY, cx, tipY, "F");

  // Fill gap between circle and tip
  doc.setFillColor(...color);
  doc.rect(cx - circleR * 0.55, circleY + circleR * 0.3, circleR * 1.1, circleR * 0.4, "F");

  // Inner circle (subtle highlight)
  const innerR = circleR * 0.72;
  doc.setFillColor(
    Math.min(255, color[0] + 30),
    Math.min(255, color[1] + 30),
    Math.min(255, color[2] + 30),
  );
  doc.circle(cx, circleY, innerR, "F");

  // Initials text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(pinSize * 1.8);
  doc.setFont("helvetica", "bold");
  doc.text(initials, cx, circleY + 0.5, { align: "center", baseline: "middle" });
}

// ─── Draw functions ───
function drawHeader(doc: jsPDF, proyectoNombre: string) {
  doc.setFillColor(...C.AZUL);
  doc.rect(0, 0, PAGE_W, HEADER_H - 2, "F");
  doc.setFillColor(...C.VERDE);
  doc.rect(0, HEADER_H - 2, PAGE_W, 2, "F");

  doc.setTextColor(...C.BLANCO);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("OBJETIVA", MARGIN + 2, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Quality Control", MARGIN + 2, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("Reporte de Pines por Plano"), PAGE_W - MARGIN - 2, 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(sinAcentos(proyectoNombre), PAGE_W - MARGIN - 2, 16, { align: "right" });
  const fecha = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(sinAcentos(fecha), PAGE_W - MARGIN - 2, 22, { align: "right" });
}

function drawFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.VERDE);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, PAGE_H - FOOTER_H, PAGE_W - MARGIN, PAGE_H - FOOTER_H);
    doc.setFontSize(6.5);
    doc.setTextColor(...C.GRIS);
    doc.text(
      `OQC - Control de Calidad de Obra  |  Pagina ${i} de ${pageCount}`,
      PAGE_W / 2,
      PAGE_H - 7,
      { align: "center" }
    );
    doc.text("www.objetiva.com", PAGE_W - MARGIN, PAGE_H - 7, { align: "right" });
  }
}

// ─── Summary page ───
function drawSummaryPage(doc: jsPDF, proyectoNombre: string, planos: PlanoReportData[]) {
  drawHeader(doc, proyectoNombre);

  let y = HEADER_H + 6;

  // Title
  doc.setTextColor(...C.AZUL);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("RESUMEN GENERAL"), PAGE_W / 2, y, { align: "center" });
  y += 8;

  // Date/time
  const now = new Date();
  const fechaStr = now.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const horaStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  doc.setTextColor(...C.GRIS);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(sinAcentos(`Generado: ${fechaStr}, ${horaStr}`), PAGE_W / 2, y, { align: "center" });
  y += 10;

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

  // ─── Big number cards ───
  const cardW = 34;
  const cardH = 32;
  const cardGap = 3;
  const totalCardsW = STATUS_ORDER.length * cardW + (STATUS_ORDER.length - 1) * cardGap;
  let cardX = (PAGE_W - totalCardsW) / 2;

  for (const key of STATUS_ORDER) {
    const sc = STATUS_COLORS[key];
    const count = globalCounts[key] || 0;
    const pct = totalPines > 0 ? ((count / totalPines) * 100).toFixed(1) : "0.0";

    // Card background
    doc.setFillColor(...sc.rgb);
    doc.roundedRect(cardX, y, cardW, cardH, 2, 2, "F");

    // Count number
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(String(count), cardX + cardW / 2, y + 13, { align: "center" });

    // Percentage
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`${pct}%`, cardX + cardW / 2, y + 20, { align: "center" });

    // Label
    doc.setFontSize(6);
    doc.text(sinAcentos(sc.label), cardX + cardW / 2, y + 27, { align: "center" });

    cardX += cardW + cardGap;
  }

  y += cardH + 8;

  // ─── Total bar ───
  doc.setFillColor(...C.AZUL);
  doc.roundedRect(MARGIN + 20, y, CONTENT_W - 40, 10, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL: ${totalPines} pines en ${planos.length} niveles`, PAGE_W / 2, y + 6.5, { align: "center" });
  y += 16;

  // ─── Progress bar (stacked horizontal) ───
  const barX = MARGIN + 10;
  const barW = CONTENT_W - 20;
  const barH = 8;

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
        // First segment - round left corners
        doc.roundedRect(offsetX, y, segW, barH, 2, 2, "F");
      } else {
        doc.rect(offsetX, y, segW, barH, "F");
      }
      offsetX += segW;
    }
  }
  y += barH + 4;

  // Legend for progress bar
  const legendW = 28;
  const legendGap = 2;
  const totalLegendW = STATUS_ORDER.length * legendW + (STATUS_ORDER.length - 1) * legendGap;
  let legendX = (PAGE_W - totalLegendW) / 2;
  for (const key of STATUS_ORDER) {
    const sc = STATUS_COLORS[key];
    const count = globalCounts[key] || 0;
    doc.setFillColor(...sc.rgb);
    doc.circle(legendX + 2, y + 2, 1.5, "F");
    doc.setTextColor(...C.NEGRO);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.text(`${sinAcentos(sc.label)} (${count})`, legendX + 5, y + 3);
    legendX += legendW + legendGap;
  }
  y += 12;

  // ─── Additional stats ───
  doc.setFillColor(...C.BG_CARD);
  doc.setDrawColor(...C.GRIS_CLARO);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN + 10, y, CONTENT_W - 20, 28, 2, 2, "FD");

  const statsInnerY = y + 4;
  const col1X = MARGIN + 16;
  const col2X = PAGE_W / 2 + 5;

  doc.setTextColor(...C.AZUL);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("Estadisticas Adicionales"), MARGIN + 15, y + 2, { baseline: "top" });

  doc.setTextColor(...C.NEGRO);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

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

  const sY = statsInnerY + 6;
  doc.text(sinAcentos(`Tasa de aprobacion: ${tasaAprobacion}%`), col1X, sY);
  doc.text(sinAcentos(`Tasa de rechazo: ${tasaRechazo}%`), col2X, sY);
  doc.text(sinAcentos(`Pendientes totales: ${pendientesTotal} (${tasaPendientes}%)`), col1X, sY + 6);
  doc.text(sinAcentos(`Tasa de resolucion: ${tasaResolucion}%`), col2X, sY + 6);
  doc.text(sinAcentos(`Niveles con pines: ${nivelesConPines} de ${planos.length}`), col1X, sY + 12);
  doc.text(sinAcentos(`Items sin vincular: ${sinItem}`), col2X, sY + 12);

  y += 34;

  // ─── Table: breakdown by level ───
  doc.setTextColor(...C.AZUL);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("Desglose por Nivel"), PAGE_W / 2, y, { align: "center" });
  y += 6;

  // Table header
  const tableX = MARGIN + 5;
  const tableW = CONTENT_W - 10;
  const colWidths = [35, 22, 22, 22, 22, 22, 22, 19]; // nivel, pend.foto, pend.aprob, aprobado, rechazado, sin_item, total, %aprob
  const rowH = 6.5;

  doc.setFillColor(...C.AZUL);
  doc.rect(tableX, y, tableW, rowH + 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");

  const headers = ["Nivel", "Pend. Foto", "Pend. Aprob.", "Aprobado", "Rechazado", "Sin Item", "Total", "% Aprob."];
  let hx = tableX + 2;
  for (let i = 0; i < headers.length; i++) {
    doc.text(sinAcentos(headers[i]), hx + (i === 0 ? 0 : colWidths[i] / 2 - 2), y + 4.5, { align: i === 0 ? "left" : "center" });
    hx += colWidths[i];
  }
  y += rowH + 1;

  // Table rows
  const sortedPlanos = [...planos].sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0));
  for (let ri = 0; ri < sortedPlanos.length; ri++) {
    const plano = sortedPlanos[ri];

    // Check if we need a new page
    if (y + rowH > PAGE_H - FOOTER_H - 5) {
      doc.addPage();
      drawHeader(doc, proyectoNombre);
      y = HEADER_H + 6;
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

    // Light grid lines
    doc.setDrawColor(...C.GRIS_CLARO);
    doc.setLineWidth(0.15);
    doc.line(tableX, y + rowH, tableX + tableW, y + rowH);

    doc.setTextColor(...C.NEGRO);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");

    const planoAprobados = counts["aprobado"] || 0;
    const pctAprob = planoTotal > 0 ? ((planoAprobados / planoTotal) * 100).toFixed(0) : "-";

    const vals = [
      sinAcentos(plano.nombre),
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
      // Color the count cells
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
        // Total column
        doc.setTextColor(...C.AZUL);
        doc.setFont("helvetica", "bold");
      } else if (i === 7) {
        // % approval
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
      doc.text(vals[i], vx + (i === 0 ? 0 : colWidths[i] / 2 - 2), y + 4.5, { align: i === 0 ? "left" : "center" });
      vx += colWidths[i];
    }
    y += rowH;
  }

  // Table totals row
  if (y + rowH + 2 > PAGE_H - FOOTER_H - 5) {
    doc.addPage();
    drawHeader(doc, proyectoNombre);
    y = HEADER_H + 6;
  }

  doc.setFillColor(...C.AZUL);
  doc.rect(tableX, y, tableW, rowH + 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(5.5);
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
    doc.text(totals[i], tx + (i === 0 ? 0 : colWidths[i] / 2 - 2), y + 4.5, { align: i === 0 ? "left" : "center" });
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
  // ─── Title bar (taller for bigger nivel text) ───
  const titleBarH = 12;
  doc.setFillColor(...C.AZUL);
  doc.roundedRect(slotX, slotY, slotW, titleBarH, 1.5, 1.5, "F");
  doc.setTextColor(...C.BLANCO);
  // Nivel number - LARGE (14pt bold) for quick identification
  if (nivelStr) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(nivelStr, slotX + 4, slotY + 8.5);
  }
  // Plano name - medium
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(nombre, slotX + (nivelStr ? 22 : 3), slotY + 5.5);
  // Pin count
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`${plano.pines.length} pines`, slotX + slotW / 2, slotY + 8.5, { align: "center" });
  // Nivel label right side - also large
  if (plano.nivel !== null) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Nivel ${plano.nivel}`, slotX + slotW - 4, slotY + 8.5, { align: "right" });
  };

  const imgY = slotY + titleBarH + 1;
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

      // posX/posY are 0-100 percentages
      const pinX = slotX + padding + (px / 100) * (slotW - padding * 2);
      const pinY = imgY + padding + (py / 100) * (imgH - padding * 2);

       const color = getStatusColorRgb(pin.itemEstado);
      // Show initials like the app (ES, JE, OP)
      const label = getInitials(pin.residenteNombre);
      drawTeardropPin(doc, pinX, pinY, color, label, 3.2);
    }
  } else {
    doc.setTextColor(...C.GRIS);
    doc.setFontSize(9);
    doc.text("Sin imagen", slotX + slotW / 2, imgY + imgH / 2, { align: "center" });
  }

  // ─── Stats bar below image ───
  const statsY = imgY + imgH + 2;
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

  // Draw stats as colored pills
  const statuses = Object.keys(STATUS_COLORS);
  const pillW = (slotW - 6) / statuses.length;
  const pillH = 8;
  const pillY = statsY + 3;

  for (let i = 0; i < statuses.length; i++) {
    const key = statuses[i];
    const sc = STATUS_COLORS[key];
    const count = counts[key] || 0;
    const px = slotX + 3 + i * pillW;

    doc.setFillColor(...sc.rgb);
    doc.roundedRect(px + 0.5, pillY, pillW - 1, pillH, 1.5, 1.5, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(String(count), px + pillW / 2, pillY + 5, { align: "center" });

    doc.setTextColor(...C.GRIS);
    doc.setFontSize(4.5);
    doc.setFont("helvetica", "normal");
    doc.text(sinAcentos(sc.label), px + pillW / 2, pillY + pillH + 4, { align: "center" });
  }

  doc.setTextColor(...C.AZUL);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${total}`, slotX + slotW - 3, statsY + statsBarH - 2, { align: "right" });
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

  // ─── Plano pages: 2 planos per page ───
  const startY = HEADER_H + 4;

  for (let i = 0; i < sorted.length; i++) {
    const slotIndex = i % 2;

    if (slotIndex === 0) {
      doc.addPage();
      drawHeader(doc, proyectoNombre);
    }

    const slotY = startY + slotIndex * (PLANO_SLOT_H + GAP);
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
