/**
 * Reporte PDF de CALIDAD - ObjetivaQC
 * Documento separado con datos exclusivos de items OQC (calidad).
 * No mezcla datos de eficiencia/programas semanales.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { openPDFPreview } from "./pdfDownload";

const C = {
  AZUL: [0, 44, 99] as [number, number, number],
  VERDE: [2, 179, 129] as [number, number, number],
  BLANCO: [255, 255, 255] as [number, number, number],
  GRIS_CLARO: [241, 245, 249] as [number, number, number],
  ROJO: [220, 38, 38] as [number, number, number],
};

function sinAcentos(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function fmtFecha(d: Date): string {
  const dia = d.getDate().toString().padStart(2, "0");
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${dia} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

const STATUS_LABELS: Record<string, string> = {
  pendiente_foto_despues: "Pendiente Foto",
  pendiente_aprobacion: "Pendiente Aprobacion",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

const STATUS_COLORS: Record<string, [number, number, number]> = {
  pendiente_foto_despues: [245, 158, 11],
  pendiente_aprobacion: [59, 130, 246],
  aprobado: [16, 185, 129],
  rechazado: [239, 68, 68],
};

export interface ReporteCalidadData {
  proyectoNombre: string;
  stats: {
    total: number;
    porStatus: Array<{ status: string; count: number }>;
    porEmpresa: Array<{ empresaId: number; count: number }>;
    porEspecialidad: Array<{ especialidadId: number | null; count: number }>;
  } | null;
  empresas: Array<{ id: number; nombre: string }> | null;
  especialidades: Array<{ id: number; nombre: string }> | null;
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
    defectos: { masFrecuentes: RankItem[]; menosFrecuentes: RankItem[] };
  } | null;
  firmantes: Array<{
    empresaNombre: string;
    especialidadNombre: string;
    jefeNombre: string;
  }> | null;
}

interface RankItem {
  nombre: string | null;
  score?: number;
  total?: number;
  tasaAprobacion?: number;
}

function addHeader(doc: jsPDF, titulo: string, proyecto: string) {
  const pw = doc.internal.pageSize.getWidth();
  // Barra azul superior
  doc.setFillColor(...C.AZUL);
  doc.rect(0, 0, pw, 14, "F");
  // Línea verde
  doc.setFillColor(...C.VERDE);
  doc.rect(0, 14, pw, 2, "F");
  // Título
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos(titulo), 15, 10);
  // Proyecto
  doc.setTextColor(...C.AZUL);
  doc.setFontSize(9);
  doc.text(sinAcentos(proyecto), 15, 22);
  // Fecha
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.text(sinAcentos(`Generado: ${fmtFecha(new Date())}`), pw - 15, 22, { align: "right" });
}

function addFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(...C.AZUL);
    doc.rect(0, ph - 8, pw, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(sinAcentos("ObjetivaQC - Reporte de Calidad"), 15, ph - 3);
    doc.text(`Pagina ${i} de ${pages}`, pw - 15, ph - 3, { align: "right" });
  }
}

function seccion(doc: jsPDF, titulo: string, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFillColor(...C.AZUL);
  doc.rect(15, y, pw - 30, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos(titulo), 18, y + 5);
  return y + 12;
}

function tabla(doc: jsPDF, headers: string[], rows: string[][], y: number, opts?: { colWidths?: number[] }): number {
  if (y > 240) { doc.addPage(); y = 20; }
  autoTable(doc, {
    startY: y,
    head: [headers.map(h => sinAcentos(h))],
    body: rows.map(r => r.map(c => sinAcentos(c))),
    theme: "grid",
    headStyles: { fillColor: C.AZUL, textColor: C.BLANCO, fontSize: 7, fontStyle: "bold", halign: "center" },
    bodyStyles: { fontSize: 7, textColor: [30, 30, 30], halign: "center" },
    alternateRowStyles: { fillColor: C.GRIS_CLARO },
    margin: { left: 15, right: 15 },
    columnStyles: opts?.colWidths ? Object.fromEntries(opts.colWidths.map((w, i) => [i, { cellWidth: w }])) : {},
  });
  return (doc as any).lastAutoTable.finalY + 6;
}

function kpiCards(doc: jsPDF, cards: Array<{ label: string; value: string; accent?: boolean }>, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  if (y > 240) { doc.addPage(); y = 20; }
  const cardW = (pw - 30 - (cards.length - 1) * 4) / cards.length;
  cards.forEach((card, i) => {
    const x = 15 + i * (cardW + 4);
    doc.setFillColor(card.accent ? 254 : 241, card.accent ? 226 : 245, card.accent ? 226 : 249);
    doc.roundedRect(x, y, cardW, 16, 2, 2, "F");
    doc.setTextColor(card.accent ? 220 : 0, card.accent ? 38 : 44, card.accent ? 38 : 99);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(card.value, x + cardW / 2, y + 8, { align: "center" });
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(sinAcentos(card.label), x + cardW / 2, y + 14, { align: "center" });
  });
  return y + 22;
}

export async function generarReporteCalidadPDF(data: ReporteCalidadData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const { proyectoNombre, stats, empresas, especialidades, defectosStats, penalizaciones, kpis, firmantes } = data;
  const pw = doc.internal.pageSize.getWidth();

  addHeader(doc, "REPORTE DE CALIDAD", proyectoNombre);
  let y = 30;

  // Compromiso
  doc.setDrawColor(...C.ROJO);
  doc.setLineWidth(0.8);
  doc.roundedRect(15, y, pw - 30, 24, 2, 2, "S");
  doc.setTextColor(...C.ROJO);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("COMPROMISO DE CORRECCION DE DEFECTOS"), 20, y + 6);
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const fechaEmision = new Date();
  const fechaFin = new Date(fechaEmision.getTime() + 8 * 24 * 60 * 60 * 1000);
  doc.text(sinAcentos("Las empresas firmantes se comprometen a corregir los defectos detectados en un plazo de una semana."), 20, y + 12);
  doc.setTextColor(...C.ROJO);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos(`Emision: ${fmtFecha(fechaEmision)}`), 20, y + 20);
  doc.text(sinAcentos(`Limite: ${fmtFecha(fechaFin)}`), pw / 2, y + 20);
  y += 30;

  // 1. RESUMEN GENERAL
  y = seccion(doc, "1. RESUMEN GENERAL DE CALIDAD", y);
  const totalItems = stats?.total || 0;
  const pendFoto = Number(stats?.porStatus?.find(s => s.status === "pendiente_foto_despues")?.count) || 0;
  const pendAprob = Number(stats?.porStatus?.find(s => s.status === "pendiente_aprobacion")?.count) || 0;
  const aprobados = Number(stats?.porStatus?.find(s => s.status === "aprobado")?.count) || 0;
  const rechazados = Number(stats?.porStatus?.find(s => s.status === "rechazado")?.count) || 0;

  y = kpiCards(doc, [
    { label: "Total Items", value: String(totalItems) },
    { label: "Pendientes", value: String(pendFoto + pendAprob) },
    { label: "Aprobados", value: String(aprobados) },
    { label: "Rechazados", value: String(rechazados), accent: true },
  ], y);

  // Tabla por status
  const statusRows = (stats?.porStatus || []).map(s => [
    STATUS_LABELS[s.status] || s.status,
    String(s.count),
    totalItems > 0 ? `${((Number(s.count) / totalItems) * 100).toFixed(1)}%` : "0%",
  ]);
  y = tabla(doc, ["Estado", "Cantidad", "Porcentaje"], statusRows, y);

  // 2. ITEMS POR EMPRESA
  if (stats?.porEmpresa && stats.porEmpresa.length > 0) {
    y = seccion(doc, "2. ITEMS DE CALIDAD POR EMPRESA", y);
    const empRows = stats.porEmpresa
      .sort((a, b) => b.count - a.count)
      .map(e => {
        const nombre = empresas?.find(emp => emp.id === e.empresaId)?.nombre || "Sin Empresa";
        return [nombre, String(e.count), totalItems > 0 ? `${((e.count / totalItems) * 100).toFixed(1)}%` : "0%"];
      });
    y = tabla(doc, ["Empresa", "Items", "% del Total"], empRows, y);
  }

  // 3. ITEMS POR ESPECIALIDAD
  if (stats?.porEspecialidad && stats.porEspecialidad.length > 0) {
    y = seccion(doc, "3. ITEMS DE CALIDAD POR ESPECIALIDAD", y);
    const espRows = stats.porEspecialidad
      .sort((a, b) => b.count - a.count)
      .map(e => {
        const nombre = e.especialidadId ? (especialidades?.find(esp => esp.id === e.especialidadId)?.nombre || "Sin Esp.") : "Sin Especialidad";
        return [nombre, String(e.count), totalItems > 0 ? `${((e.count / totalItems) * 100).toFixed(1)}%` : "0%"];
      });
    y = tabla(doc, ["Especialidad", "Items", "% del Total"], espRows, y);
  }

  // 4. DEFECTOS
  if (defectosStats && defectosStats.porDefecto.length > 0) {
    y = seccion(doc, "4. ANALISIS DE DEFECTOS", y);
    const defRows = defectosStats.porDefecto
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
      .map(d => [
        d.defecto?.nombre || "Sin defecto",
        String(d.total),
        String(d.aprobados),
        String(d.rechazados),
        d.total > 0 ? `${((d.aprobados / d.total) * 100).toFixed(0)}%` : "0%",
      ]);
    y = tabla(doc, ["Defecto", "Total", "Aprobados", "Rechazados", "% Aprob."], defRows, y);

    // Severidad
    if (defectosStats.porSeveridad.length > 0) {
      const sevRows = defectosStats.porSeveridad.map(s => [
        s.severidad.charAt(0).toUpperCase() + s.severidad.slice(1),
        String(s.total),
        defectosStats.totalItems > 0 ? `${((s.total / defectosStats.totalItems) * 100).toFixed(1)}%` : "0%",
      ]);
      y = tabla(doc, ["Severidad", "Cantidad", "Porcentaje"], sevRows, y);
    }
  }

  // 5. PENALIZACIONES
  if (penalizaciones && penalizaciones.porEmpresa.length > 0) {
    y = seccion(doc, "5. PENALIZACIONES POR EMPRESA", y);
    y = kpiCards(doc, [
      { label: "Penalizacion Activa", value: `$${penalizaciones.totalActiva.toLocaleString()}`, accent: true },
      { label: "Penalizacion Liberada", value: `$${penalizaciones.totalLiberada.toLocaleString()}` },
      { label: "Total General", value: `$${penalizaciones.totalGeneral.toLocaleString()}` },
      { label: "Monto por Item", value: `$${penalizaciones.montoPorItem.toLocaleString()}` },
    ], y);

    const penRows = penalizaciones.porEmpresa.map(e => [
      e.empresaNombre,
      String(e.totalItems),
      String(e.noAprobados),
      `$${e.penalizacionActiva.toLocaleString()}`,
      `$${e.penalizacionLiberada.toLocaleString()}`,
    ]);
    y = tabla(doc, ["Empresa", "Total Items", "No Aprobados", "Penalizacion Activa", "Liberada"], penRows, y);
  }

  // 6. RANKING KPIs
  if (kpis) {
    y = seccion(doc, "6. RANKING DE CALIDAD", y);
    // Mejores empresas
    if (kpis.empresas.mejores.length > 0) {
      doc.setTextColor(...C.AZUL);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(sinAcentos("Mejores Empresas"), 15, y);
      y += 4;
      const mejEmpRows = kpis.empresas.mejores.slice(0, 5).map((e, i) => [
        `${i + 1}`, e.nombre || "N/A", e.tasaAprobacion != null ? `${e.tasaAprobacion.toFixed(1)}%` : "N/A",
      ]);
      y = tabla(doc, ["#", "Empresa", "Tasa Aprobacion"], mejEmpRows, y);
    }
    // Peores empresas
    if (kpis.empresas.peores.length > 0) {
      doc.setTextColor(...C.ROJO);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(sinAcentos("Empresas con Mayor Area de Oportunidad"), 15, y);
      y += 4;
      const peorEmpRows = kpis.empresas.peores.slice(0, 5).map((e, i) => [
        `${i + 1}`, e.nombre || "N/A", e.tasaAprobacion != null ? `${e.tasaAprobacion.toFixed(1)}%` : "N/A",
      ]);
      y = tabla(doc, ["#", "Empresa", "Tasa Aprobacion"], peorEmpRows, y);
    }
    // Defectos más frecuentes
    if (kpis.defectos.masFrecuentes.length > 0) {
      doc.setTextColor(...C.AZUL);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(sinAcentos("Defectos Mas Frecuentes"), 15, y);
      y += 4;
      const defFrecRows = kpis.defectos.masFrecuentes.slice(0, 5).map((d, i) => [
        `${i + 1}`, d.nombre || "N/A", String(d.total || 0),
      ]);
      y = tabla(doc, ["#", "Defecto", "Ocurrencias"], defFrecRows, y);
    }
  }

  // 7. FIRMAS
  if (firmantes && firmantes.length > 0) {
    doc.addPage();
    y = 20;
    y = seccion(doc, "7. FIRMAS DE COMPROMISO", y);
    const firmaRows = firmantes.map(f => [f.empresaNombre, f.especialidadNombre, f.jefeNombre, "________________"]);
    y = tabla(doc, ["Empresa", "Especialidad", "Responsable", "Firma"], firmaRows, y);
  }

  addFooter(doc);
  openPDFPreview(doc);
}
