/**
 * Reporte PDF de EFICIENCIA POR EMPRESA - ObjetivaQC
 * Documento separado con datos exclusivos de programas semanales.
 * Agrupado por empresa. No mezcla datos de calidad/items OQC.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { openPDFPreview } from "./pdfDownload";

const C = {
  AZUL: [0, 44, 99] as [number, number, number],
  VERDE: [2, 179, 129] as [number, number, number],
  BLANCO: [255, 255, 255] as [number, number, number],
  GRIS_CLARO: [241, 245, 249] as [number, number, number],
  NARANJA: [245, 158, 11] as [number, number, number],
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

export interface ReporteEficienciaData {
  proyectoNombre: string;
  porEmpresa: Array<{
    empresaNombre: string;
    totalProgramas: number;
    totalCortes: number;
    eficienciaPromedio: number | null;
    aTiempo: number;
    tarde: number;
    pendiente: number;
    totalUsuarios: number;
  }>;
  porUsuario: Array<{
    nombre: string;
    empresaNombre: string;
    totalProgramas: number;
    totalCortes: number;
    eficienciaPromedio: number | null;
    aTiempo: number;
    tarde: number;
  }>;
  totalProgramas: number;
  totalCortes: number;
}

function addHeader(doc: jsPDF, titulo: string, proyecto: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.AZUL);
  doc.rect(0, 0, pw, 14, "F");
  doc.setFillColor(...C.VERDE);
  doc.rect(0, 14, pw, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos(titulo), 15, 10);
  doc.setTextColor(...C.AZUL);
  doc.setFontSize(9);
  doc.text(sinAcentos(proyecto), 15, 22);
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
    doc.text(sinAcentos("ObjetivaQC - Reporte de Eficiencia por Empresa"), 15, ph - 3);
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

function tabla(doc: jsPDF, headers: string[], rows: string[][], y: number): number {
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
  });
  return (doc as any).lastAutoTable.finalY + 6;
}

function kpiCards(doc: jsPDF, cards: Array<{ label: string; value: string; accent?: boolean }>, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  if (y > 240) { doc.addPage(); y = 20; }
  const cardW = (pw - 30 - (cards.length - 1) * 4) / cards.length;
  cards.forEach((card, i) => {
    const x = 15 + i * (cardW + 4);
    doc.setFillColor(card.accent ? 220 : 241, card.accent ? 252 : 245, card.accent ? 231 : 249);
    doc.roundedRect(x, y, cardW, 16, 2, 2, "F");
    doc.setTextColor(card.accent ? 2 : 0, card.accent ? 179 : 44, card.accent ? 129 : 99);
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

function eficienciaColor(ef: number | null): string {
  if (ef == null) return "N/A";
  return `${ef.toFixed(1)}%`;
}

function barraEficiencia(doc: jsPDF, x: number, y: number, w: number, ef: number | null) {
  if (ef == null) return;
  doc.setFillColor(230, 230, 230);
  doc.roundedRect(x, y, w, 4, 1, 1, "F");
  const fillW = Math.min(w, (ef / 100) * w);
  if (ef >= 80) doc.setFillColor(...C.VERDE);
  else if (ef >= 60) doc.setFillColor(...C.NARANJA);
  else doc.setFillColor(...C.ROJO);
  doc.roundedRect(x, y, fillW, 4, 1, 1, "F");
}

export async function generarReporteEficienciaPDF(data: ReporteEficienciaData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const { proyectoNombre, porEmpresa, porUsuario, totalProgramas, totalCortes } = data;
  const pw = doc.internal.pageSize.getWidth();

  addHeader(doc, "REPORTE DE EFICIENCIA POR EMPRESA", proyectoNombre);
  let y = 30;

  // Resumen general
  const efGlobal = porEmpresa.filter(e => e.eficienciaPromedio != null);
  const efPromGlobal = efGlobal.length > 0 ? efGlobal.reduce((s, e) => s + (e.eficienciaPromedio || 0), 0) / efGlobal.length : 0;
  const totalATiempo = porEmpresa.reduce((s, e) => s + e.aTiempo, 0);
  const totalTarde = porEmpresa.reduce((s, e) => s + e.tarde, 0);

  y = seccion(doc, "1. RESUMEN GENERAL DE EFICIENCIA", y);
  y = kpiCards(doc, [
    { label: "Total Programas", value: String(totalProgramas) },
    { label: "Cortes Realizados", value: String(totalCortes) },
    { label: "Eficiencia Promedio", value: `${efPromGlobal.toFixed(1)}%`, accent: true },
    { label: "Empresas", value: String(porEmpresa.length) },
  ], y);

  // Cumplimiento general
  doc.setTextColor(...C.AZUL);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(sinAcentos("Cumplimiento de Entrega"), 15, y);
  y += 4;
  y = tabla(doc, ["Indicador", "Cantidad", "Porcentaje"], [
    ["A tiempo", String(totalATiempo), totalProgramas > 0 ? `${((totalATiempo / totalProgramas) * 100).toFixed(1)}%` : "0%"],
    ["Tarde", String(totalTarde), totalProgramas > 0 ? `${((totalTarde / totalProgramas) * 100).toFixed(1)}%` : "0%"],
  ], y);

  // 2. EFICIENCIA POR EMPRESA
  y = seccion(doc, "2. EFICIENCIA POR EMPRESA", y);

  // Tabla resumen
  const empRows = porEmpresa.map(e => [
    e.empresaNombre,
    String(e.totalUsuarios),
    String(e.totalProgramas),
    String(e.totalCortes),
    eficienciaColor(e.eficienciaPromedio),
    String(e.aTiempo),
    String(e.tarde),
    String(e.pendiente),
  ]);
  y = tabla(doc, ["Empresa", "Usuarios", "Programas", "Cortes", "Eficiencia %", "A Tiempo", "Tarde", "Pendiente"], empRows, y);

  // Barras de eficiencia por empresa
  if (porEmpresa.some(e => e.eficienciaPromedio != null)) {
    doc.setTextColor(...C.AZUL);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(sinAcentos("Grafico de Eficiencia por Empresa"), 15, y);
    y += 6;
    const barW = pw - 100;
    for (const emp of porEmpresa.filter(e => e.eficienciaPromedio != null).sort((a, b) => (b.eficienciaPromedio || 0) - (a.eficienciaPromedio || 0))) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const nameW = 50;
      doc.text(sinAcentos(emp.empresaNombre.substring(0, 30)), 15, y + 3);
      barraEficiencia(doc, 15 + nameW, y, barW - nameW, emp.eficienciaPromedio);
      doc.setTextColor(...C.AZUL);
      doc.setFont("helvetica", "bold");
      doc.text(`${(emp.eficienciaPromedio || 0).toFixed(1)}%`, pw - 20, y + 3, { align: "right" });
      y += 8;
    }
    y += 4;
  }

  // 3. DETALLE POR EMPRESA (cada empresa en su sección)
  for (const emp of porEmpresa) {
    y = seccion(doc, `EMPRESA: ${emp.empresaNombre.toUpperCase()}`, y);
    
    // KPIs de la empresa
    y = kpiCards(doc, [
      { label: "Programas", value: String(emp.totalProgramas) },
      { label: "Cortes", value: String(emp.totalCortes) },
      { label: "Eficiencia", value: eficienciaColor(emp.eficienciaPromedio), accent: true },
      { label: "A Tiempo", value: String(emp.aTiempo) },
    ], y);

    // Usuarios de esta empresa
    const usrsEmp = porUsuario.filter(u => u.empresaNombre === emp.empresaNombre);
    if (usrsEmp.length > 0) {
      const usrRows = usrsEmp.map(u => [
        u.nombre,
        String(u.totalProgramas),
        String(u.totalCortes),
        eficienciaColor(u.eficienciaPromedio),
        String(u.aTiempo),
        String(u.tarde),
      ]);
      y = tabla(doc, ["Residente", "Programas", "Cortes", "Eficiencia %", "A Tiempo", "Tarde"], usrRows, y);
    }
  }

  // 4. RANKING GENERAL DE RESIDENTES
  y = seccion(doc, "RANKING GENERAL DE RESIDENTES", y);
  const rankRows = porUsuario
    .filter(u => u.eficienciaPromedio != null)
    .sort((a, b) => (b.eficienciaPromedio || 0) - (a.eficienciaPromedio || 0))
    .map((u, i) => [
      `${i + 1}`,
      u.nombre,
      u.empresaNombre,
      String(u.totalProgramas),
      eficienciaColor(u.eficienciaPromedio),
      String(u.aTiempo),
      String(u.tarde),
    ]);
  y = tabla(doc, ["#", "Residente", "Empresa", "Programas", "Eficiencia %", "A Tiempo", "Tarde"], rankRows, y);

  addFooter(doc);
  openPDFPreview(doc);
}
