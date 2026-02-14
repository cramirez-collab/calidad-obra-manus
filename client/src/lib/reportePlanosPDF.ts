/**
 * Reporte PDF de Pines por Plano - ObjetivaQC
 * =============================================
 * - 2 planos por pagina (vertical / portrait)
 * - Pines tipo gota (teardrop) con iniciales del residente, color por estatus
 * - Estadisticas por estatus debajo de cada plano
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
  pendiente_foto_despues: { rgb: [59, 130, 246], label: "Pend. Foto" },
  pendiente_aprobacion: { rgb: [245, 158, 11], label: "Pend. Aprob." },
  aprobado: { rgb: [34, 197, 94], label: "Aprobado" },
  rechazado: { rgb: [239, 68, 68], label: "Rechazado" },
  sin_item: { rgb: [107, 114, 128], label: "Sin item" },
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function getStatusColorRgb(status?: string | null): [number, number, number] {
  switch (status) {
    case "aprobado": return hexToRgb("#22c55e");
    case "rechazado": return hexToRgb("#ef4444");
    case "pendiente_aprobacion": return hexToRgb("#f59e0b");
    case "pendiente_foto_despues": return hexToRgb("#3b82f6");
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
const PLANO_SLOT_H = 120;
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
  // Teardrop: circle on top, pointed tip at bottom
  const circleR = pinSize * 0.47;
  const circleY = tipY - pinSize * 0.88;

  // Draw teardrop shape using bezier curves
  // Start from left side of circle, go down to tip, then back up right side
  const startAngle = Math.PI * 0.2;
  const endAngle = Math.PI * 0.8;

  // White border (slightly larger)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.circle(cx, circleY, circleR + 0.5, "FD");

  // Main colored circle
  doc.setFillColor(...color);
  doc.circle(cx, circleY, circleR, "F");

  // Draw the pointed tip using triangles
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

function drawPlanoSlot(
  doc: jsPDF,
  plano: PlanoReportData,
  planoImg: string | null,
  slotX: number,
  slotY: number,
  slotW: number,
) {
  const nombre = sinAcentos(plano.nombre);
  const nivelStr = plano.nivel !== null ? `Nivel ${plano.nivel}` : "";

  // ─── Title bar ───
  doc.setFillColor(...C.AZUL);
  doc.roundedRect(slotX, slotY, slotW, 8, 1.5, 1.5, "F");
  doc.setTextColor(...C.BLANCO);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(nombre, slotX + 3, slotY + 5.5);
  if (nivelStr) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(nivelStr, slotX + slotW - 3, slotY + 5.5, { align: "right" });
  }
  doc.setFontSize(6.5);
  doc.text(`${plano.pines.length} pines`, slotX + slotW / 2, slotY + 5.5, { align: "center" });

  const imgY = slotY + 9;
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
      const initials = getInitials(pin.residenteNombre);

      drawTeardropPin(doc, pinX, pinY, color, initials, 3.2);
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

  // Layout: 2 planos per page
  let pageStarted = false;
  const startY = HEADER_H + 4;

  for (let i = 0; i < sorted.length; i++) {
    const slotIndex = i % 2;

    if (slotIndex === 0) {
      if (pageStarted) {
        doc.addPage();
      }
      pageStarted = true;
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
