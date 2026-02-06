import { Router } from "express";
import * as XLSX from "xlsx";
import * as db from "./db";
import { storagePut, storageGet } from "./storage";
import multer from "multer";

// Configurar multer para archivos en memoria
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 } // 16MB max
});

const router = Router();

// Función para remover acentos (evitar problemas en Excel)
const removeAccents = (str: string): string => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// Formatear fecha dd-mm-aa
const formatDate = (date: Date | string | null): string => {
  if (!date) return "";
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear().toString().slice(-2);
  return `${day}-${month}-${year}`;
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
    
    const [empresas, unidades, especialidades] = await Promise.all([
      db.getAllEmpresas(),
      db.getAllUnidades(),
      db.getAllEspecialidades(),
    ]);
    
    const empresasMap = new Map(empresas?.map(e => [e.id, e.nombre]) || []);
    const unidadesMap = new Map(unidades?.map(u => [u.id, u.nombre]) || []);
    const especialidadesMap = new Map(especialidades?.map(e => [e.id, e.nombre]) || []);
    
    const statusLabels: Record<string, string> = {
      pendiente_foto_despues: "Pendiente Foto",
      pendiente_aprobacion: "Pendiente Aprobacion",
      aprobado: "Aprobado",
      rechazado: "Rechazado",
    };
    
    const wb = XLSX.utils.book_new();
    
    const headerData = [
      ["ObjetivaQC - Sistema de Control de Calidad de Obra"],
      ["OBJETIVA - Innovacion en Desarrollos Inmobiliarios"],
      [""],
      ["Reporte de Items"],
      [`Fecha: ${formatDate(new Date())} ${new Date().toLocaleTimeString("es-MX")}`],
      [`Total: ${items.length} registros`],
      [""],
    ];
    
    const data = items.map((item: any) => ({
      "No. Interno": item.numeroInterno || "-",
      "Codigo": removeAccents(item.codigo || ""),
      "Titulo": removeAccents(item.titulo || ""),
      "Descripcion": removeAccents(item.descripcion || ""),
      "Empresa": removeAccents(empresasMap.get(item.empresaId) || ""),
      "Unidad": removeAccents(unidadesMap.get(item.unidadId) || ""),
      "Especialidad": removeAccents(especialidadesMap.get(item.especialidadId) || ""),
      "Estado": statusLabels[item.status] || item.status,
      "Ubicacion": removeAccents(item.ubicacionDetalle || ""),
      "Creacion": formatDate(item.fechaCreacion),
      "Foto Despues": formatDate(item.fechaFotoDespues),
      "Aprobacion": formatDate(item.fechaAprobacion),
    }));
    
    const ws = XLSX.utils.aoa_to_sheet(headerData);
    XLSX.utils.sheet_add_json(ws, data, { origin: "A8" });
    
    ws["!cols"] = [
      { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 35 }, { wch: 18 }, { wch: 12 },
      { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, "Items OQC");
    
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=ObjetivaQC_Items_${formatDate(new Date()).replace(/-/g, "")}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting items:", error);
    res.status(500).json({ error: "Error al exportar items" });
  }
});

// Exportar ítems a CSV
router.get("/api/export/items/csv", async (req, res) => {
  try {
    const filters: any = {};
    if (req.query.empresaId) filters.empresaId = parseInt(req.query.empresaId as string);
    if (req.query.unidadId) filters.unidadId = parseInt(req.query.unidadId as string);
    if (req.query.especialidadId) filters.especialidadId = parseInt(req.query.especialidadId as string);
    if (req.query.status) filters.status = req.query.status as string;
    
    const result = await db.getItems(filters, 1, 10000);
    const items = result?.items || [];
    
    const [empresas, unidades, especialidades] = await Promise.all([
      db.getAllEmpresas(),
      db.getAllUnidades(),
      db.getAllEspecialidades(),
    ]);
    
    const empresasMap = new Map(empresas?.map(e => [e.id, e.nombre]) || []);
    const unidadesMap = new Map(unidades?.map(u => [u.id, u.nombre]) || []);
    const especialidadesMap = new Map(especialidades?.map(e => [e.id, e.nombre]) || []);
    
    const statusLabels: Record<string, string> = {
      pendiente_foto_despues: "Pendiente Foto",
      pendiente_aprobacion: "Pendiente Aprobacion",
      aprobado: "Aprobado",
      rechazado: "Rechazado",
    };
    
    // CSV header
    const csvHeader = "No. Interno,Codigo,Titulo,Descripcion,Empresa,Unidad,Especialidad,Estado,Ubicacion,Creacion,Foto Despues,Aprobacion\n";
    
    // CSV rows
    const csvRows = items.map((item: any) => {
      const row = [
        item.numeroInterno || "-",
        removeAccents(item.codigo || ""),
        `"${removeAccents(item.titulo || "").replace(/"/g, '""')}"`,
        `"${removeAccents(item.descripcion || "").replace(/"/g, '""')}"`,
        `"${removeAccents(empresasMap.get(item.empresaId) || "")}"`,
        `"${removeAccents(unidadesMap.get(item.unidadId) || "")}"`,
        `"${removeAccents(especialidadesMap.get(item.especialidadId) || "")}"`,
        statusLabels[item.status] || item.status,
        `"${removeAccents(item.ubicacionDetalle || "").replace(/"/g, '""')}"`,
        formatDate(item.fechaCreacion),
        formatDate(item.fechaFotoDespues),
        formatDate(item.fechaAprobacion),
      ];
      return row.join(",");
    }).join("\n");
    
    const csv = csvHeader + csvRows;
    
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=ObjetivaQC_Items_${formatDate(new Date()).replace(/-/g, "")}.csv`);
    res.send("\uFEFF" + csv); // BOM for Excel UTF-8
  } catch (error) {
    console.error("Error exporting items CSV:", error);
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
      pendiente_foto_despues: "Pendiente Foto",
      pendiente_aprobacion: "Pendiente Aprobacion",
      aprobado: "Aprobado",
      rechazado: "Rechazado",
    };
    
    const wb = XLSX.utils.book_new();
    
    const resumenHeader = [
      ["ObjetivaQC - Sistema de Control de Calidad de Obra"],
      ["OBJETIVA - Innovacion en Desarrollos Inmobiliarios"],
      [""],
      ["Reporte de Estadisticas"],
      [`Fecha: ${formatDate(new Date())} ${new Date().toLocaleTimeString("es-MX")}`],
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
    wsResumen["!cols"] = [{ wch: 30 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
    
    const empresaData = stats.porEmpresa.map((e: any) => ({
      "Empresa": removeAccents(empresasMap.get(e.empresaId) || `ID: ${e.empresaId}`),
      "Cantidad": Number(e.count),
    }));
    if (empresaData.length > 0) {
      const wsEmpresa = XLSX.utils.json_to_sheet(empresaData);
      wsEmpresa["!cols"] = [{ wch: 30 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsEmpresa, "Por Empresa");
    }
    
    const especialidadData = stats.porEspecialidad.map((e: any) => ({
      "Especialidad": removeAccents(especialidadesMap.get(e.especialidadId) || `ID: ${e.especialidadId}`),
      "Cantidad": Number(e.count),
    }));
    if (especialidadData.length > 0) {
      const wsEspecialidad = XLSX.utils.json_to_sheet(especialidadData);
      wsEspecialidad["!cols"] = [{ wch: 30 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsEspecialidad, "Por Especialidad");
    }
    
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=ObjetivaQC_Estadisticas_${formatDate(new Date()).replace(/-/g, "")}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting estadisticas:", error);
    res.status(500).json({ error: "Error al exportar estadisticas" });
  }
});

// Endpoint para subir archivos de audio (para transcripción de voz)
router.post("/api/upload", upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se proporcionó archivo" });
    }
    
    const file = req.file as Express.Multer.File;
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = file.originalname.split('.').pop() || 'webm';
    const fileKey = `audio/${timestamp}-${randomSuffix}.${extension}`;
    
    const { url } = await storagePut(fileKey, file.buffer, file.mimetype);
    
    res.json({ url, key: fileKey });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Error al subir archivo" });
  }
});

// Proxy para imágenes de usuarios (genera URL firmada)
router.get("/api/image/:path(*)", async (req, res) => {
  try {
    const imagePath = req.params.path;
    if (!imagePath) {
      return res.status(400).json({ error: "Path de imagen requerido" });
    }
    
    // Obtener URL firmada de S3
    const { url } = await storageGet(imagePath);
    
    // Redirigir a la URL firmada
    res.redirect(url);
  } catch (error) {
    console.error("Error getting image:", error);
    res.status(404).json({ error: "Imagen no encontrada" });
  }
});

// Exportar estadísticas a CSV
router.get("/api/export/estadisticas/csv", async (req, res) => {
  try {
    const filters: any = {};
    if (req.query.empresaId) filters.empresaId = parseInt(req.query.empresaId as string);
    if (req.query.unidadId) filters.unidadId = parseInt(req.query.unidadId as string);
    if (req.query.especialidadId) filters.especialidadId = parseInt(req.query.especialidadId as string);
    
    const stats = await db.getEstadisticas(filters);
    if (!stats) {
      return res.status(500).json({ error: "Error al obtener estadisticas" });
    }
    
    const statusLabels: Record<string, string> = {
      pendiente_foto_despues: "Pendiente Foto",
      pendiente_aprobacion: "Pendiente Aprobacion",
      aprobado: "Aprobado",
      rechazado: "Rechazado",
    };
    
    let csv = "Metrica,Valor\n";
    csv += `Total de Items,${stats.total}\n`;
    stats.porStatus.forEach((s: any) => {
      csv += `${statusLabels[s.status] || s.status},${Number(s.count)}\n`;
    });
    
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=ObjetivaQC_Estadisticas_${formatDate(new Date()).replace(/-/g, "")}.csv`);
    res.send("\uFEFF" + csv);
  } catch (error) {
    console.error("Error exporting estadisticas CSV:", error);
    res.status(500).json({ error: "Error al exportar estadisticas" });
  }
});

// Endpoint para obtener fotos de un ítem como base64 para PDF
router.get("/api/items/:id/fotos-pdf", async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: "ID de ítem inválido" });
    }

    const dbInstance = await db.getDb();
    if (!dbInstance) {
      return res.status(500).json({ error: "Error de base de datos" });
    }

    // Obtener fotos del ítem - primero intentar base64 de la BD, luego S3
    const { items } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    
    const result = await dbInstance.select({
      fotoAntesBase64: items.fotoAntesBase64,
      fotoAntesMarcadaBase64: items.fotoAntesMarcadaBase64,
      fotoDespuesBase64: items.fotoDespuesBase64,
      fotoAntesUrl: items.fotoAntesUrl,
      fotoAntesKey: items.fotoAntesKey,
      fotoAntesMarcadaUrl: items.fotoAntesMarcadaUrl,
      fotoAntesMarcadaKey: items.fotoAntesMarcadaKey,
      fotoDespuesUrl: items.fotoDespuesUrl,
      fotoDespuesKey: items.fotoDespuesKey,
    }).from(items).where(eq(items.id, itemId)).limit(1);

    if (!result[0]) {
      return res.status(404).json({ error: "Ítem no encontrado" });
    }

    const item = result[0];
    const fotos: { fotoAntes: string | null; fotoAntesMarcada: string | null; fotoDespues: string | null } = {
      fotoAntes: null,
      fotoAntesMarcada: null,
      fotoDespues: null,
    };

    // Helper: descargar imagen de S3 y convertir a base64
    const downloadAsBase64 = async (key: string | null, url: string | null): Promise<string | null> => {
      try {
        // Intentar con key de S3 primero (URL firmada)
        if (key) {
          const { url: signedUrl } = await storageGet(key);
          const response = await fetch(signedUrl);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            return `data:${contentType};base64,${base64}`;
          }
        }
        // Fallback: intentar con URL directa
        if (url) {
          const response = await fetch(url);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            return `data:${contentType};base64,${base64}`;
          }
        }
      } catch (e) {
        console.error('Error descargando imagen:', e);
      }
      return null;
    };

    // Foto ANTES: priorizar base64 de BD
    if (item.fotoAntesBase64 && item.fotoAntesBase64.length > 10) {
      fotos.fotoAntes = item.fotoAntesBase64.startsWith('data:')
        ? item.fotoAntesBase64
        : `data:image/jpeg;base64,${item.fotoAntesBase64}`;
    } else {
      fotos.fotoAntes = await downloadAsBase64(item.fotoAntesKey, item.fotoAntesUrl);
    }

    // Foto ANTES MARCADA: priorizar base64 de BD
    if (item.fotoAntesMarcadaBase64 && item.fotoAntesMarcadaBase64.length > 10) {
      fotos.fotoAntesMarcada = item.fotoAntesMarcadaBase64.startsWith('data:')
        ? item.fotoAntesMarcadaBase64
        : `data:image/jpeg;base64,${item.fotoAntesMarcadaBase64}`;
    } else {
      fotos.fotoAntesMarcada = await downloadAsBase64(item.fotoAntesMarcadaKey, item.fotoAntesMarcadaUrl);
    }

    // Foto DESPUÉS: priorizar base64 de BD
    if (item.fotoDespuesBase64 && item.fotoDespuesBase64.length > 10) {
      fotos.fotoDespues = item.fotoDespuesBase64.startsWith('data:')
        ? item.fotoDespuesBase64
        : `data:image/jpeg;base64,${item.fotoDespuesBase64}`;
    } else {
      fotos.fotoDespues = await downloadAsBase64(item.fotoDespuesKey, item.fotoDespuesUrl);
    }

    res.json(fotos);
  } catch (error) {
    console.error("Error obteniendo fotos para PDF:", error);
    res.status(500).json({ error: "Error al obtener fotos" });
  }
});

export default router;
