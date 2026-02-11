/**
 * Reporte PDF completo de Estadisticas - ObjetivaOQC
 * Genera un PDF profesional con TODA la informacion del modulo de estadisticas:
 * - KPIs generales
 * - Distribucion por status
 * - Items por empresa, especialidad
 * - Estadisticas de defectos y severidad
 * - Penalizaciones por empresa
 * - Ranking mejores/peores (empresas, residentes, especialidades, unidades, espacios, defectos, niveles)
 * - Rendimiento por usuario
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadPDFBestMethod } from "./pdfDownload";

const COLORES = {
  AZUL: [0, 44, 99] as [number, number, number],
  VERDE: [2, 179, 129] as [number, number, number],
  GRIS: [128, 128, 128] as [number, number, number],
  NEGRO: [0, 0, 0] as [number, number, number],
  BLANCO: [255, 255, 255] as [number, number, number],
  ROJO: [239, 68, 68] as [number, number, number],
  AMARILLO: [245, 158, 11] as [number, number, number],
  ESMERALDA: [16, 185, 129] as [number, number, number],
};

// Quitar acentos para exportacion
function sinAcentos(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

interface ReporteData {
  proyectoNombre: string;
  // KPIs generales
  stats: {
    total: number;
    porStatus: Array<{ status: string; count: number }>;
    porEmpresa: Array<{ empresaId: number; count: number }>;
    porEspecialidad: Array<{ especialidadId: number | null; count: number }>;
  } | null;
  // Catálogos
  empresas: Array<{ id: number; nombre: string }> | null;
  especialidades: Array<{ id: number; nombre: string; color?: string | null }> | null;
  // Defectos
  defectosStats: {
    totalItems: number;
    porDefecto: Array<{ defecto: { nombre: string } | null; total: number; aprobados: number; rechazados: number }>;
    porSeveridad: Array<{ severidad: string; total: number }>;
  } | null;
  // Penalizaciones
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
  // KPIs mejores/peores
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
  // Rendimiento usuarios
  rendimiento: Array<{
    usuarioNombre: string | null;
    usuarioRol: string;
    itemsCompletados: number;
    aprobados: number;
    rechazados: number;
    okSupervisor: number;
    tiempoPromedioHoras: number;
  }> | null;
  // Defectos por usuario
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

function addHeader(doc: jsPDF, titulo: string, proyectoNombre: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORES.AZUL);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setTextColor(...COLORES.BLANCO);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('OBJETIVA', 15, 16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(sinAcentos(`${titulo} - ${proyectoNombre}`), pageWidth - 15, 12, { align: 'right' });
  const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text(sinAcentos(fecha), pageWidth - 15, 18, { align: 'right' });
}

function addFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORES.GRIS);
    doc.text(
      `OQC - Control de Calidad de Obra | Pagina ${i} de ${pageCount}`,
      pageWidth / 2, pageHeight - 10, { align: 'center' }
    );
  }
}

function seccion(doc: jsPDF, titulo: string, yPos: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPos > pageHeight - 50) {
    doc.addPage();
    yPos = 35;
  }
  doc.setTextColor(...COLORES.AZUL);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(sinAcentos(titulo), 15, yPos);
  doc.setDrawColor(...COLORES.VERDE);
  doc.setLineWidth(0.5);
  doc.line(15, yPos + 2, doc.internal.pageSize.getWidth() - 15, yPos + 2);
  return yPos + 10;
}

function subSeccion(doc: jsPDF, titulo: string, yPos: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 35;
  }
  doc.setTextColor(...COLORES.NEGRO);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(sinAcentos(titulo), 15, yPos);
  return yPos + 7;
}

function tabla(doc: jsPDF, headers: string[], data: string[][], startY: number, opts?: { columnStyles?: any }): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (startY > pageHeight - 40) {
    doc.addPage();
    startY = 35;
  }
  autoTable(doc, {
    startY,
    head: [headers.map(h => sinAcentos(h))],
    body: data.map(row => row.map(cell => sinAcentos(cell ?? '-'))),
    theme: 'striped',
    headStyles: { fillColor: COLORES.AZUL, textColor: COLORES.BLANCO, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: COLORES.NEGRO },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 15, right: 15 },
    columnStyles: opts?.columnStyles,
  });
  return (doc as any).lastAutoTable?.finalY || startY + 20;
}

function kpiCards(doc: jsPDF, metricas: { label: string; value: string }[], yPos: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPos > pageHeight - 50) {
    doc.addPage();
    yPos = 35;
  }
  const cardWidth = (pageWidth - 30 - (metricas.length - 1) * 4) / metricas.length;
  let xPos = 15;
  metricas.forEach((m) => {
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(xPos, yPos, cardWidth, 22, 2, 2, 'F');
    doc.setTextColor(...COLORES.AZUL);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(sinAcentos(m.value), xPos + cardWidth / 2, yPos + 10, { align: 'center' });
    doc.setTextColor(...COLORES.GRIS);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(sinAcentos(m.label), xPos + cardWidth / 2, yPos + 17, { align: 'center' });
    xPos += cardWidth + 4;
  });
  return yPos + 30;
}

function rankingTable(doc: jsPDF, titulo: string, mejores: RankItem[], peores: RankItem[], dataKey: string, yPos: number, unit: string = '%'): number {
  yPos = subSeccion(doc, titulo, yPos);

  // Tabla lado a lado: Mejores | Peores
  const headers = ['#', 'Mejores', unit === '%' ? 'Aprob.' : 'Total', '#', 'Peores', unit === '%' ? 'Aprob.' : 'Total'];
  const maxLen = Math.max(mejores.length, peores.length, 1);
  const rows: string[][] = [];
  for (let i = 0; i < maxLen; i++) {
    const m = mejores[i];
    const p = peores[i];
    const mVal = m ? (m[dataKey as keyof RankItem] as number) : 0;
    const pVal = p ? (p[dataKey as keyof RankItem] as number) : 0;
    rows.push([
      m ? String(i + 1) : '',
      m ? (m.nombre || 'Sin nombre') : '',
      m ? `${mVal}${unit}` : '',
      p ? String(i + 1) : '',
      p ? (p.nombre || 'Sin nombre') : '',
      p ? `${pVal}${unit}` : '',
    ]);
  }
  yPos = tabla(doc, headers, rows, yPos);
  return yPos + 5;
}

export function generarReporteEstadisticasPDF(data: ReporteData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const { proyectoNombre, stats, empresas, especialidades, defectosStats, penalizaciones, kpis, rendimiento, defectosPorUsuario } = data;

  addHeader(doc, 'Reporte Completo de Estadisticas', proyectoNombre);

  let y = 35;

  // ========== 1. RESUMEN GENERAL ==========
  y = seccion(doc, '1. Resumen General', y);

  const totalItems = stats?.total || 0;
  const pendFoto = Number(stats?.porStatus?.find(s => s.status === 'pendiente_foto_despues')?.count) || 0;
  const pendAprob = Number(stats?.porStatus?.find(s => s.status === 'pendiente_aprobacion')?.count) || 0;
  const aprobados = Number(stats?.porStatus?.find(s => s.status === 'aprobado')?.count) || 0;
  const rechazados = Number(stats?.porStatus?.find(s => s.status === 'rechazado')?.count) || 0;
  const pendientes = pendFoto + pendAprob;

  y = kpiCards(doc, [
    { label: 'Total Items', value: String(totalItems) },
    { label: 'Pendientes', value: String(pendientes) },
    { label: 'Aprobados', value: String(aprobados) },
    { label: 'Rechazados', value: String(rechazados) },
  ], y);

  // Tabla distribución por status
  y = subSeccion(doc, 'Distribucion por Estado', y);
  const statusRows = (stats?.porStatus || []).map(s => [
    statusLabels[s.status] || s.status,
    String(s.count),
    totalItems > 0 ? `${((s.count / totalItems) * 100).toFixed(1)}%` : '0%',
  ]);
  y = tabla(doc, ['Estado', 'Cantidad', 'Porcentaje'], statusRows, y);
  y += 5;

  // ========== 2. ITEMS POR EMPRESA ==========
  if (stats?.porEmpresa && stats.porEmpresa.length > 0) {
    y = seccion(doc, '2. Items por Empresa', y);
    const empRows = stats.porEmpresa
      .sort((a, b) => b.count - a.count)
      .map((e, i) => {
        const nombre = empresas?.find(emp => emp.id === e.empresaId)?.nombre || `Empresa ${e.empresaId}`;
        return [String(i + 1), nombre, String(e.count), totalItems > 0 ? `${((e.count / totalItems) * 100).toFixed(1)}%` : '0%'];
      });
    y = tabla(doc, ['#', 'Empresa', 'Items', '%'], empRows, y);
    y += 5;
  }

  // ========== 3. ITEMS POR ESPECIALIDAD ==========
  if (stats?.porEspecialidad && stats.porEspecialidad.length > 0) {
    y = seccion(doc, '3. Items por Especialidad', y);
    const espRows = stats.porEspecialidad
      .sort((a, b) => b.count - a.count)
      .map((e, i) => {
        const nombre = especialidades?.find(esp => esp.id === e.especialidadId)?.nombre || `Esp ${e.especialidadId}`;
        return [String(i + 1), nombre, String(e.count), totalItems > 0 ? `${((e.count / totalItems) * 100).toFixed(1)}%` : '0%'];
      });
    y = tabla(doc, ['#', 'Especialidad', 'Items', '%'], espRows, y);
    y += 5;
  }

  // ========== 4. ESTADISTICAS DE DEFECTOS ==========
  if (defectosStats) {
    y = seccion(doc, '4. Estadisticas de Defectos', y);

    const totalDef = defectosStats.totalItems || 0;
    const totalAprob = defectosStats.porDefecto.reduce((a, d) => a + d.aprobados, 0);
    const totalRech = defectosStats.porDefecto.reduce((a, d) => a + d.rechazados, 0);
    const tasaAprob = totalDef > 0 ? ((totalAprob / totalDef) * 100).toFixed(1) : '0';
    const graves = defectosStats.porSeveridad?.find(s => s.severidad === 'grave')?.total || 0;
    const criticos = defectosStats.porSeveridad?.find(s => s.severidad === 'critico')?.total || 0;

    y = kpiCards(doc, [
      { label: 'Total con Defecto', value: String(totalDef) },
      { label: 'Tasa Aprobacion', value: `${tasaAprob}%` },
      { label: 'Graves', value: String(graves) },
      { label: 'Criticos', value: String(criticos) },
    ], y);

    // Top defectos
    y = subSeccion(doc, 'Top Tipos de Defectos', y);
    const defRows = defectosStats.porDefecto
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
      .map((d, i) => [
        String(i + 1),
        d.defecto?.nombre || 'Sin nombre',
        String(d.total),
        String(d.aprobados),
        String(d.rechazados),
        d.total > 0 ? `${((d.aprobados / d.total) * 100).toFixed(0)}%` : '0%',
      ]);
    y = tabla(doc, ['#', 'Defecto', 'Total', 'Aprob.', 'Rech.', '% Aprob.'], defRows, y);
    y += 5;

    // Severidad
    if (defectosStats.porSeveridad && defectosStats.porSeveridad.length > 0) {
      y = subSeccion(doc, 'Distribucion por Severidad', y);
      const sevRows = defectosStats.porSeveridad.map(s => [
        s.severidad.charAt(0).toUpperCase() + s.severidad.slice(1),
        String(s.total),
        totalDef > 0 ? `${((s.total / totalDef) * 100).toFixed(1)}%` : '0%',
      ]);
      y = tabla(doc, ['Severidad', 'Total', '%'], sevRows, y);
      y += 5;
    }
  }

  // ========== 5. PENALIZACIONES ==========
  if (penalizaciones) {
    y = seccion(doc, '5. Penalizaciones por Calidad ($2,000 MXN/item)', y);

    y = kpiCards(doc, [
      { label: 'Penalizacion Activa', value: `$${penalizaciones.totalActiva.toLocaleString()}` },
      { label: 'Liberada', value: `$${penalizaciones.totalLiberada.toLocaleString()}` },
      { label: 'Total Acumulado', value: `$${penalizaciones.totalGeneral.toLocaleString()}` },
      { label: 'Monto/Item', value: `$${penalizaciones.montoPorItem.toLocaleString()}` },
    ], y);

    if (penalizaciones.porEmpresa.length > 0) {
      y = subSeccion(doc, 'Desglose por Contratista', y);
      const penRows = penalizaciones.porEmpresa
        .sort((a, b) => b.penalizacionActiva - a.penalizacionActiva)
        .map(e => [
          e.empresaNombre,
          String(e.totalItems),
          String(e.noAprobados),
          String(e.aprobados),
          `$${e.penalizacionActiva.toLocaleString()}`,
          `$${e.penalizacionLiberada.toLocaleString()}`,
        ]);
      // Fila total
      penRows.push([
        'TOTAL',
        String(penalizaciones.porEmpresa.reduce((s, e) => s + e.totalItems, 0)),
        String(penalizaciones.porEmpresa.reduce((s, e) => s + e.noAprobados, 0)),
        String(penalizaciones.porEmpresa.reduce((s, e) => s + e.aprobados, 0)),
        `$${penalizaciones.totalActiva.toLocaleString()}`,
        `$${penalizaciones.totalLiberada.toLocaleString()}`,
      ]);
      y = tabla(doc, ['Empresa', 'Total', 'No Aprob.', 'Aprob.', 'Penalizacion', 'Liberada'], penRows, y);
      y += 5;
    }
  }

  // ========== 6. RANKING MEJORES Y PEORES ==========
  if (kpis) {
    y = seccion(doc, '6. Ranking de Rendimiento - Mejores y Peores', y);

    // Nota explicativa
    doc.setTextColor(...COLORES.GRIS);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(sinAcentos('Tasa de aprobacion = items aprobados / total items. Antes de aprobacion = items pendientes + rechazados. Despues = aprobados.'), 15, y);
    y += 8;

    // Empresas
    y = rankingTable(doc, 'Empresas', kpis.empresas.mejores, kpis.empresas.peores, 'tasaAprobacion', y);

    // Especialidades
    y = rankingTable(doc, 'Especialidades', kpis.especialidades.mejores, kpis.especialidades.peores, 'tasaAprobacion', y);

    // Residentes
    y = rankingTable(doc, 'Residentes', kpis.residentes.mejores, kpis.residentes.peores, 'tasaAprobacion', y);

    // Jefes de Residentes
    y = rankingTable(doc, 'Jefes de Residentes', kpis.jefesResidentes.mejores, kpis.jefesResidentes.peores, 'tasaAprobacion', y);

    // Unidades
    y = rankingTable(doc, 'Unidades', kpis.unidades.mejores, kpis.unidades.peores, 'tasaAprobacion', y);

    // Espacios
    y = rankingTable(doc, 'Espacios', kpis.espacios.mejores, kpis.espacios.peores, 'tasaAprobacion', y);

    // Defectos (frecuencia)
    y = rankingTable(doc, 'Defectos (por frecuencia)', kpis.defectos.menosFrecuentes, kpis.defectos.masFrecuentes, 'total', y, '');

    // Niveles
    y = rankingTable(doc, 'Niveles', kpis.niveles.mejores, kpis.niveles.peores, 'tasaAprobacion', y);
  }

  // ========== 7. RENDIMIENTO POR USUARIO ==========
  if (rendimiento && rendimiento.length > 0) {
    y = seccion(doc, '7. Rendimiento por Usuario', y);

    const totalUsuarios = rendimiento.length;
    const totalAprobUsuarios = rendimiento.reduce((a, u) => a + (u.aprobados || 0), 0);
    const tiempoPromGlobal = rendimiento.length > 0
      ? (rendimiento.reduce((a, u) => a + (u.tiempoPromedioHoras || 0), 0) / rendimiento.length).toFixed(1)
      : '0';
    const totalOK = rendimiento.reduce((a, u) => a + (u.okSupervisor || 0), 0);

    y = kpiCards(doc, [
      { label: 'Usuarios Activos', value: String(totalUsuarios) },
      { label: 'Total Aprobados', value: String(totalAprobUsuarios) },
      { label: 'Tiempo Promedio', value: `${tiempoPromGlobal}h` },
      { label: 'OK Supervisor', value: String(totalOK) },
    ], y);

    // Tabla detallada
    y = subSeccion(doc, 'Detalle por Usuario', y);
    const userRows = rendimiento
      .sort((a, b) => b.itemsCompletados - a.itemsCompletados)
      .map(u => {
        const efic = u.itemsCompletados > 0 ? ((u.aprobados / u.itemsCompletados) * 100).toFixed(0) : '0';
        const rolLabel = u.usuarioRol === 'supervisor' ? 'Supervisor' :
          u.usuarioRol === 'jefe_residente' ? 'Jefe Residente' :
          u.usuarioRol === 'residente' ? 'Residente' :
          u.usuarioRol === 'admin' ? 'Admin' : u.usuarioRol || '-';
        return [
          u.usuarioNombre || 'Usuario',
          rolLabel,
          String(u.itemsCompletados),
          String(u.aprobados),
          String(u.rechazados),
          String(u.okSupervisor),
          `${(u.tiempoPromedioHoras || 0).toFixed(1)}h`,
          `${efic}%`,
        ];
      });
    y = tabla(doc, ['Usuario', 'Rol', 'Total', 'Aprob.', 'Rech.', 'OK', 'Tiempo', 'Efic.'], userRows, y);
    y += 5;
  }

  // ========== 8. DEFECTOS POR USUARIO ==========
  if (defectosPorUsuario && defectosPorUsuario.length > 0) {
    y = seccion(doc, '8. Defectos por Usuario', y);
    const defUserRows = defectosPorUsuario
      .sort((a, b) => b.totalDefectos - a.totalDefectos)
      .slice(0, 20)
      .map((u, i) => [
        String(i + 1),
        u.usuarioNombre || 'Usuario',
        String(u.totalDefectos),
        String(u.aprobados),
        String(u.rechazados),
        u.totalDefectos > 0 ? `${((u.aprobados / u.totalDefectos) * 100).toFixed(0)}%` : '0%',
      ]);
    y = tabla(doc, ['#', 'Usuario', 'Defectos', 'Aprob.', 'Rech.', '% Aprob.'], defUserRows, y);
  }

  // ========== FOOTER ==========
  addFooters(doc);

  // Descargar
  const nombreLimpio = proyectoNombre.replace(/[^a-zA-Z0-9]/g, '_');
  const fecha = new Date().toISOString().split('T')[0];
  downloadPDFBestMethod(doc, `Reporte_Estadisticas_${nombreLimpio}_${fecha}.pdf`);
}
