import { Router } from "express";
import * as XLSX from "xlsx";
import * as db from "./db";

const router = Router();

// Función para remover acentos (evitar problemas en Excel)
const removeAccents = (str: string): string => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// Exportar ítems a Excel
router.get("/api/export/items", async (req, res) => {
  try {
    const filters: any = {};
    if (req.query.empresaId) filters.empresaId = parseInt(req.query.empresaId as string);
    if (req.query.unidadId) filters.unidadId = parseInt(req.query.unidadId as string);
    if (req.query.especialidadId) filters.especialidadId = parseInt(req.query.especialidadId as string);
    if (req.query.status) filters.status = req.query.status as string;
    
    const result = await db.getItems(filters, 1, 10000);
    const items = result?.items || [];
    
    // Obtener catálogos para mapear IDs a nombres
    const [empresas, unidades, especialidades] = await Promise.all([
      db.getAllEmpresas(),
      db.getAllUnidades(),
      db.getAllEspecialidades(),
    ]);
    
    const empresasMap = new Map(empresas?.map(e => [e.id, e.nombre]) || []);
    const unidadesMap = new Map(unidades?.map(u => [u.id, u.nombre]) || []);
    const especialidadesMap = new Map(especialidades?.map(e => [e.id, e.nombre]) || []);
    
    const statusLabels: Record<string, string> = {
      pendiente_foto_despues: "Pendiente Foto Despues",
      pendiente_aprobacion: "Pendiente Aprobacion",
      aprobado: "Aprobado",
      rechazado: "Rechazado",
    };
    
    const wb = XLSX.utils.book_new();
    
    // Hoja de encabezado con información de Objetiva
    const headerData = [
      ["OBJETIVA - Innovacion en Desarrollos Inmobiliarios"],
      ["Sistema de Control de Calidad de Obra (OQC)"],
      [""],
      ["Reporte de Items"],
      [`Fecha de generacion: ${new Date().toLocaleDateString("es-MX")} ${new Date().toLocaleTimeString("es-MX")}`],
      [`Total de registros: ${items.length}`],
      [""],
    ];
    
    // Transformar datos para Excel (sin acentos)
    const data = items.map((item: any) => ({
      "Codigo": removeAccents(item.codigo || ""),
      "Titulo": removeAccents(item.titulo || ""),
      "Descripcion": removeAccents(item.descripcion || ""),
      "Empresa": removeAccents(empresasMap.get(item.empresaId) || ""),
      "Unidad": removeAccents(unidadesMap.get(item.unidadId) || ""),
      "Especialidad": removeAccents(especialidadesMap.get(item.especialidadId) || ""),
      "Estado": statusLabels[item.status] || item.status,
      "Ubicacion": removeAccents(item.ubicacionDetalle || ""),
      "Fecha Creacion": item.fechaCreacion ? new Date(item.fechaCreacion).toLocaleDateString("es-MX") : "",
      "Fecha Foto Despues": item.fechaFotoDespues ? new Date(item.fechaFotoDespues).toLocaleDateString("es-MX") : "",
      "Fecha Aprobacion": item.fechaAprobacion ? new Date(item.fechaAprobacion).toLocaleDateString("es-MX") : "",
    }));
    
    // Crear hoja con encabezado
    const ws = XLSX.utils.aoa_to_sheet(headerData);
    XLSX.utils.sheet_add_json(ws, data, { origin: "A8" });
    
    // Ajustar anchos de columna
    ws["!cols"] = [
      { wch: 15 }, // Código
      { wch: 30 }, // Título
      { wch: 40 }, // Descripción
      { wch: 20 }, // Empresa
      { wch: 15 }, // Unidad
      { wch: 20 }, // Especialidad
      { wch: 20 }, // Estado
      { wch: 25 }, // Ubicación
      { wch: 15 }, // Fecha Creación
      { wch: 18 }, // Fecha Foto Después
      { wch: 18 }, // Fecha Aprobación
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, "Items OQC");
    
    // Generar buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=OQC_Items_${new Date().toISOString().split("T")[0]}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting items:", error);
    res.status(500).json({ error: "Error al exportar items" });
  }
});

// Exportar estadísticas a Excel
router.get("/api/export/estadisticas", async (req, res) => {
  try {
    const filters: any = {};
    if (req.query.empresaId) filters.empresaId = parseInt(req.query.empresaId as string);
    if (req.query.unidadId) filters.unidadId = parseInt(req.query.unidadId as string);
    if (req.query.especialidadId) filters.especialidadId = parseInt(req.query.especialidadId as string);
    
    const stats = await db.getEstadisticas(filters);
    if (!stats) {
      return res.status(500).json({ error: "Error al obtener estadisticas" });
    }
    
    const [empresas, especialidades] = await Promise.all([
      db.getAllEmpresas(),
      db.getAllEspecialidades(),
    ]);
    
    const empresasMap = new Map(empresas?.map(e => [e.id, e.nombre]) || []);
    const especialidadesMap = new Map(especialidades?.map(e => [e.id, e.nombre]) || []);
    
    const statusLabels: Record<string, string> = {
      pendiente_foto_despues: "Pendiente Foto Despues",
      pendiente_aprobacion: "Pendiente Aprobacion",
      aprobado: "Aprobado",
      rechazado: "Rechazado",
    };
    
    const wb = XLSX.utils.book_new();
    
    // Hoja de resumen con encabezado Objetiva
    const resumenHeader = [
      ["OBJETIVA - Innovacion en Desarrollos Inmobiliarios"],
      ["Sistema de Control de Calidad de Obra (OQC)"],
      [""],
      ["Reporte de Estadisticas"],
      [`Fecha de generacion: ${new Date().toLocaleDateString("es-MX")} ${new Date().toLocaleTimeString("es-MX")}`],
      [""],
      ["RESUMEN GENERAL"],
      [""],
    ];
    
    const resumenData = [
      { "Metrica": "Total de Items", "Valor": stats.total },
    ];
    stats.porStatus.forEach((s: any) => {
      resumenData.push({ "Metrica": statusLabels[s.status] || s.status, "Valor": Number(s.count) });
    });
    
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenHeader);
    XLSX.utils.sheet_add_json(wsResumen, resumenData, { origin: "A9" });
    wsResumen["!cols"] = [{ wch: 35 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen OQC");
    
    // Hoja por empresa
    const empresaData = stats.porEmpresa.map((e: any) => ({
      "Empresa": removeAccents(empresasMap.get(e.empresaId) || `ID: ${e.empresaId}`),
      "Cantidad": Number(e.count),
    }));
    if (empresaData.length > 0) {
      const wsEmpresa = XLSX.utils.json_to_sheet(empresaData);
      wsEmpresa["!cols"] = [{ wch: 35 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsEmpresa, "Por Empresa");
    }
    
    // Hoja por especialidad
    const especialidadData = stats.porEspecialidad.map((e: any) => ({
      "Especialidad": removeAccents(especialidadesMap.get(e.especialidadId) || `ID: ${e.especialidadId}`),
      "Cantidad": Number(e.count),
    }));
    if (especialidadData.length > 0) {
      const wsEspecialidad = XLSX.utils.json_to_sheet(especialidadData);
      wsEspecialidad["!cols"] = [{ wch: 35 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsEspecialidad, "Por Especialidad");
    }
    
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=OQC_Estadisticas_${new Date().toISOString().split("T")[0]}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting estadisticas:", error);
    res.status(500).json({ error: "Error al exportar estadisticas" });
  }
});

export default router;
