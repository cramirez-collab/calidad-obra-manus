/**
 * Reporte PDF de Pines por Plano - ObjetivaQC
 * =============================================
 * - 2 planos por pagina (vertical / portrait)
 * - Contenedores del mismo tamano, reticula alineada
 * - Logo Objetiva en header
 * - Recuadro de estadisticas por plano (por estatus y colores)
 * - Pines dibujados sobre la imagen del plano con numero y color por estatus
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

const STATUS_COLORS: Record<string, { rgb: [number, number, number]; label: string }> = {
  pendiente_foto_despues: { rgb: [245, 158, 11], label: "Pend. Foto" },
  pendiente_aprobacion: { rgb: [59, 130, 246], label: "Pend. Aprob." },
  aprobado: { rgb: [16, 185, 129], label: "Aprobado" },
  rechazado: { rgb: [239, 68, 68], label: "Rechazado" },
  sin_item: { rgb: [107, 114, 128], label: "Sin item" },
};

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
const PAGE_W = 210; // A4 portrait width mm
const PAGE_H = 297; // A4 portrait height mm
const MARGIN = 12;
const HEADER_H = 28;
const FOOTER_H = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PLANO_SLOT_H = 120; // Fixed height for each plano slot
const PLANO_IMG_H = 88;   // Height for the plano image
const STATS_H = 24;       // Height for the stats bar
const GAP = 8;             // Gap between two plano slots

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
  // Pin count in title
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

    // ─── Draw pins on top of image ───
    for (const pin of plano.pines) {
      const px = parseFloat(pin.posX);
      const py = parseFloat(pin.posY);
      if (isNaN(px) || isNaN(py)) continue;

      const pinX = slotX + padding + px * (slotW - padding * 2);
      const pinY = imgY + padding + py * (imgH - padding * 2);

      const estado = pin.itemEstado || "sin_item";
      const color = STATUS_COLORS[estado]?.rgb || STATUS_COLORS.sin_item.rgb;

      // Pin circle with border
      doc.setFillColor(...color);
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.3);
      doc.circle(pinX, pinY, 2, "FD");

      // Pin number
      const num = pin.itemCodigo ? pin.itemCodigo.replace(/\D/g, "").replace(/^0+/, "") : String(pin.id);
      const shortNum = num.length > 3 ? num.slice(-3) : num;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(4);
      doc.setFont("helvetica", "bold");
      doc.text(shortNum, pinX, pinY + 1.2, { align: "center" });
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

    // Pill background
    doc.setFillColor(...sc.rgb);
    doc.roundedRect(px + 0.5, pillY, pillW - 1, pillH, 1.5, 1.5, "F");

    // Pill text - count
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(String(count), px + pillW / 2, pillY + 5, { align: "center" });

    // Label below pill
    doc.setTextColor(...C.GRIS);
    doc.setFontSize(4.5);
    doc.setFont("helvetica", "normal");
    doc.text(sinAcentos(sc.label), px + pillW / 2, pillY + pillH + 4, { align: "center" });
  }

  // Total at the right
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
    const slotIndex = i % 2; // 0 = top, 1 = bottom

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
  const filename = `Pines_${sinAcentos(proyectoNombre).replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
  downloadPDFBestMethod(doc, filename);
}
