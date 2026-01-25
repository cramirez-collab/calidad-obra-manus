import { Router } from "express";
import * as XLSX from "xlsx";
import * as db from "./db";

const router = Router();

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
      pendiente_foto_despues: "Pendiente Foto Después",
      pendiente_aprobacion: "Pendiente Aprobación",
      aprobado: "Aprobado",
      rechazado: "Rechazado",
    };
    
    // Transformar datos para Excel
    const data = items.map((item: any) => ({
      "Código": item.codigo,
      "Título": item.titulo,
      "Descripción": item.descripcion || "",
      "Empresa": empresasMap.get(item.empresaId) || "",
      "Unidad": unidadesMap.get(item.unidadId) || "",
      "Especialidad": especialidadesMap.get(item.especialidadId) || "",
      "Estado": statusLabels[item.status] || item.status,
      "Ubicación": item.ubicacionDetalle || "",
      "Fecha Creación": item.fechaCreacion ? new Date(item.fechaCreacion).toLocaleDateString("es-MX") : "",
      "Fecha Foto Después": item.fechaFotoDespues ? new Date(item.fechaFotoDespues).toLocaleDateString("es-MX") : "",
      "Fecha Aprobación": item.fechaAprobacion ? new Date(item.fechaAprobacion).toLocaleDateString("es-MX") : "",
    }));
    
    // Crear workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Ajustar anchos de columna
    const colWidths = [
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
    ws["!cols"] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "Ítems");
    
    // Generar buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=items_${new Date().toISOString().split("T")[0]}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting items:", error);
    res.status(500).json({ error: "Error al exportar ítems" });
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
      return res.status(500).json({ error: "Error al obtener estadísticas" });
    }
    
    const [empresas, especialidades] = await Promise.all([
      db.getAllEmpresas(),
      db.getAllEspecialidades(),
    ]);
    
    const empresasMap = new Map(empresas?.map(e => [e.id, e.nombre]) || []);
    const especialidadesMap = new Map(especialidades?.map(e => [e.id, e.nombre]) || []);
    
    const statusLabels: Record<string, string> = {
      pendiente_foto_despues: "Pendiente Foto Después",
      pendiente_aprobacion: "Pendiente Aprobación",
      aprobado: "Aprobado",
      rechazado: "Rechazado",
    };
    
    const wb = XLSX.utils.book_new();
    
    // Hoja de resumen
    const resumenData = [
      { "Métrica": "Total de Ítems", "Valor": stats.total },
    ];
    stats.porStatus.forEach((s: any) => {
      resumenData.push({ "Métrica": statusLabels[s.status] || s.status, "Valor": Number(s.count) });
    });
    const wsResumen = XLSX.utils.json_to_sheet(resumenData);
    wsResumen["!cols"] = [{ wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
    
    // Hoja por empresa
    const empresaData = stats.porEmpresa.map((e: any) => ({
      "Empresa": empresasMap.get(e.empresaId) || `ID: ${e.empresaId}`,
      "Cantidad": Number(e.count),
    }));
    if (empresaData.length > 0) {
      const wsEmpresa = XLSX.utils.json_to_sheet(empresaData);
      wsEmpresa["!cols"] = [{ wch: 30 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsEmpresa, "Por Empresa");
    }
    
    // Hoja por especialidad
    const especialidadData = stats.porEspecialidad.map((e: any) => ({
      "Especialidad": especialidadesMap.get(e.especialidadId) || `ID: ${e.especialidadId}`,
      "Cantidad": Number(e.count),
    }));
    if (especialidadData.length > 0) {
      const wsEspecialidad = XLSX.utils.json_to_sheet(especialidadData);
      wsEspecialidad["!cols"] = [{ wch: 30 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsEspecialidad, "Por Especialidad");
    }
    
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=estadisticas_${new Date().toISOString().split("T")[0]}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting estadisticas:", error);
    res.status(500).json({ error: "Error al exportar estadísticas" });
  }
});

export default router;
