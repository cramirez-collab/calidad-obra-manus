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
    
    const result = await db.getItems(filters, 10000, 0);
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
    
    const result = await db.getItems(filters, 10000, 0);
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

    // Foto ANTES: priorizar S3 (alta resolución) sobre base64 de BD (thumbnail)
    fotos.fotoAntes = await downloadAsBase64(item.fotoAntesKey, item.fotoAntesUrl);
    if (!fotos.fotoAntes && item.fotoAntesBase64 && item.fotoAntesBase64.length > 10) {
      fotos.fotoAntes = item.fotoAntesBase64.startsWith('data:')
        ? item.fotoAntesBase64
        : `data:image/jpeg;base64,${item.fotoAntesBase64}`;
    }

    // Foto ANTES MARCADA: priorizar S3 sobre base64
    fotos.fotoAntesMarcada = await downloadAsBase64(item.fotoAntesMarcadaKey, item.fotoAntesMarcadaUrl);
    if (!fotos.fotoAntesMarcada && item.fotoAntesMarcadaBase64 && item.fotoAntesMarcadaBase64.length > 10) {
      fotos.fotoAntesMarcada = item.fotoAntesMarcadaBase64.startsWith('data:')
        ? item.fotoAntesMarcadaBase64
        : `data:image/jpeg;base64,${item.fotoAntesMarcadaBase64}`;
    }

    // Foto DESPUÉS: priorizar S3 sobre base64
    fotos.fotoDespues = await downloadAsBase64(item.fotoDespuesKey, item.fotoDespuesUrl);
    if (!fotos.fotoDespues && item.fotoDespuesBase64 && item.fotoDespuesBase64.length > 10) {
      fotos.fotoDespues = item.fotoDespuesBase64.startsWith('data:')
        ? item.fotoDespuesBase64
        : `data:image/jpeg;base64,${item.fotoDespuesBase64}`;
    }

    res.json(fotos);
  } catch (error) {
    console.error("Error obteniendo fotos para PDF:", error);
    res.status(500).json({ error: "Error al obtener fotos" });
  }
});

// ==================== FOTOS EVIDENCIA BASE64 PARA PDF ====================

/**
 * Endpoint que recibe IDs de ítems y devuelve sus fotos como data URIs base64.
 * Esto evita problemas de CORS al generar PDFs en el frontend.
 * Las fotos se descargan server-side desde S3 y se convierten a base64.
 */
router.post("/api/fotos-evidencia-base64", async (req, res) => {
  try {
    const { itemIds } = req.body as { itemIds: number[] };
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.json({ fotos: {} });
    }

    const dbInstance = await db.getDb();
    if (!dbInstance) {
      return res.status(500).json({ error: "Error de base de datos" });
    }

    const { items } = await import("../drizzle/schema");
    const { inArray } = await import("drizzle-orm");

    // Obtener datos de fotos de todos los ítems solicitados
    const rows = await dbInstance.select({
      id: items.id,
      fotoAntesUrl: items.fotoAntesUrl,
      fotoAntesKey: items.fotoAntesKey,
      fotoAntesBase64: items.fotoAntesBase64,
      fotoAntesMarcadaUrl: items.fotoAntesMarcadaUrl,
      fotoAntesMarcadaKey: items.fotoAntesMarcadaKey,
      fotoAntesMarcadaBase64: items.fotoAntesMarcadaBase64,
      fotoDespuesUrl: items.fotoDespuesUrl,
      fotoDespuesKey: items.fotoDespuesKey,
      fotoDespuesBase64: items.fotoDespuesBase64,
    }).from(items).where(inArray(items.id, itemIds));

    // Helper: descargar imagen de S3 y convertir a base64 data URI
    const downloadAsBase64 = async (key: string | null, url: string | null): Promise<string | null> => {
      try {
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
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          const response = await fetch(url);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            return `data:${contentType};base64,${base64}`;
          }
        }
      } catch (e) {
        console.error('Error descargando imagen para PDF:', e);
      }
      return null;
    };

    // Procesar cada ítem en paralelo
    const fotosMap: Record<number, string | null> = {};
    await Promise.all(rows.map(async (row) => {
      // Prioridad: marcada > antes > después
      // Intentar S3 primero (alta resolución)
      let dataUri = await downloadAsBase64(row.fotoAntesMarcadaKey, row.fotoAntesMarcadaUrl);
      if (!dataUri) {
        dataUri = await downloadAsBase64(row.fotoAntesKey, row.fotoAntesUrl);
      }
      if (!dataUri) {
        dataUri = await downloadAsBase64(row.fotoDespuesKey, row.fotoDespuesUrl);
      }
      // Fallback: base64 de BD (thumbnail)
      if (!dataUri && row.fotoAntesMarcadaBase64 && row.fotoAntesMarcadaBase64.length > 100) {
        dataUri = row.fotoAntesMarcadaBase64.startsWith('data:') ? row.fotoAntesMarcadaBase64 : `data:image/jpeg;base64,${row.fotoAntesMarcadaBase64}`;
      }
      if (!dataUri && row.fotoAntesBase64 && row.fotoAntesBase64.length > 100) {
        dataUri = row.fotoAntesBase64.startsWith('data:') ? row.fotoAntesBase64 : `data:image/jpeg;base64,${row.fotoAntesBase64}`;
      }
      if (!dataUri && row.fotoDespuesBase64 && row.fotoDespuesBase64.length > 100) {
        dataUri = row.fotoDespuesBase64.startsWith('data:') ? row.fotoDespuesBase64 : `data:image/jpeg;base64,${row.fotoDespuesBase64}`;
      }
      fotosMap[row.id] = dataUri;
    }));

    res.json({ fotos: fotosMap });
  } catch (error) {
    console.error("Error obteniendo fotos evidencia base64:", error);
    res.status(500).json({ error: "Error al obtener fotos" });
  }
});

// ==================== TRACKING DE APERTURA DE CORREOS ====================

// Pixel de tracking 1x1 transparente - se incrusta en emails como <img src="/api/track/open?t=TOKEN">
router.get("/api/track/open", async (req, res) => {
  try {
    const token = req.query.t as string;
    if (token) {
      const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
      await db.marcarCorreoAbierto(token, ip);
    }
  } catch (error) {
    console.error("[Track] Error registrando apertura:", error);
  }
  // Siempre devolver pixel transparente 1x1
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  res.set({
    "Content-Type": "image/gif",
    "Content-Length": pixel.length.toString(),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  res.end(pixel);
});

// ==================== PÁGINA DE FIRMA ELECTRÓNICA ====================

// Página pública donde el representante de la empresa firma el reporte
router.get("/api/firma/:token", async (req, res) => {
  try {
    const firma = await db.getFirmaByToken(req.params.token);
    if (!firma) {
      return res.status(404).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h1>Enlace inválido</h1>
          <p>Este enlace de firma no existe o ha expirado.</p>
        </body></html>
      `);
    }
    if (firma.firmado) {
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h1 style="color:#10B981;">✓ Reporte ya firmado</h1>
          <p>Este reporte ya fue firmado por <strong>${firma.firmadoPorNombre || 'la empresa'}</strong> el ${firma.fechaFirma ? new Date(firma.fechaFirma).toLocaleString('es-MX') : ''}.</p>
        </body></html>
      `);
    }
    // Servir página de firma con canvas
    const html = getFirmaPageHTML(req.params.token);
    res.send(html);
  } catch (error) {
    console.error("[Firma] Error:", error);
    res.status(500).send("Error interno");
  }
});

// POST para recibir la firma
router.post("/api/firma/:token", async (req, res) => {
  try {
    const { nombre, email, firmaBase64 } = req.body;
    if (!nombre || !email || !firmaBase64) {
      return res.status(400).json({ ok: false, error: "Datos incompletos" });
    }
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
    await db.firmarReporte({
      tokenFirma: req.params.token,
      firmaBase64,
      firmadoPorNombre: nombre,
      firmadoPorEmail: email,
      ip,
    });
    // Verificar si todas las firmas están completas
    const firma = await db.getFirmaByToken(req.params.token);
    if (firma) {
      const todasCompletas = await db.todasFirmasCompletas(firma.reporteId);
      if (todasCompletas) {
        try {
          const { notifyOwner } = await import("./_core/notification");
          await notifyOwner({
            title: "Reporte completamente firmado",
            content: `Todas las empresas han firmado el reporte ${firma.reporteId}. El reporte está listo para distribución.`,
          });
        } catch (e) {
          console.log("[Firma] No se pudo notificar:", e);
        }
      }
    }
    res.json({ ok: true });
  } catch (error: any) {
    console.error("[Firma] Error procesando firma:", error);
    res.status(400).json({ ok: false, error: error.message || "Error al procesar firma" });
  }
});

// HTML de la página de firma electrónica
function getFirmaPageHTML(token: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Firma Electrónica - ObjetivaQC</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;color:#1e293b}
    .container{max-width:600px;margin:0 auto;padding:20px}
    .card{background:white;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);margin-bottom:16px}
    .header{background:linear-gradient(135deg,#002C63 0%,#003d8f 100%);color:white;border-radius:12px;padding:24px;text-align:center;margin-bottom:16px}
    .header h1{font-size:20px;margin-bottom:4px}
    .header p{opacity:0.8;font-size:14px}
    .leyenda{background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin-bottom:16px;font-size:13px;line-height:1.5;color:#92400e}
    .leyenda strong{display:block;margin-bottom:4px;color:#78350f}
    label{display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:#374151}
    input{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:12px}
    input:focus{outline:none;border-color:#002C63;box-shadow:0 0 0 3px rgba(0,44,99,0.1)}
    canvas{border:2px dashed #d1d5db;border-radius:8px;cursor:crosshair;touch-action:none;width:100%;height:200px;background:white}
    .btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;border:none;width:100%}
    .btn-primary{background:#002C63;color:white}
    .btn-primary:hover{background:#003d8f}
    .btn-primary:disabled{background:#9ca3af;cursor:not-allowed}
    .btn-outline{background:white;color:#374151;border:1px solid #d1d5db;margin-bottom:8px}
    .btn-outline:hover{background:#f9fafb}
    .success{text-align:center;padding:40px 20px}
    .success h2{color:#10B981;font-size:24px;margin-bottom:8px}
    .success p{color:#6b7280}
    #firmaStatus{display:none}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Firma Electrónica</h1>
      <p>Reporte de Calidad - ObjetivaQC</p>
    </div>
    <div class="leyenda">
      <strong>Aviso Legal</strong>
      Acepto y atiendo en oportunidad los ítems en los que se hace mención a mi empresa. Al firmar este documento, confirmo que he revisado el contenido del reporte y me comprometo a atender las observaciones señaladas dentro de los plazos establecidos.
    </div>
    <div class="card" id="firmaForm">
      <label>Nombre completo</label>
      <input type="text" id="nombre" placeholder="Nombre del firmante" required>
      <label>Correo electrónico</label>
      <input type="email" id="email" placeholder="correo@empresa.com" required>
      <label>Firma (dibuje con el dedo o mouse)</label>
      <canvas id="firmaCanvas"></canvas>
      <button class="btn btn-outline" onclick="limpiarFirma()" style="margin-top:8px">Limpiar firma</button>
      <button class="btn btn-primary" onclick="enviarFirma()" style="margin-top:8px" id="btnFirmar">Firmar Reporte</button>
    </div>
    <div class="card success" id="firmaStatus">
      <h2>Firmado correctamente</h2>
      <p>Su firma ha sido registrada. Se notificará a todos los involucrados cuando todas las empresas hayan firmado.</p>
    </div>
  </div>
  <script>
    const canvas=document.getElementById('firmaCanvas');
    const ctx=canvas.getContext('2d');
    let drawing=false,hasFirma=false;
    function initCanvas(){
      const r=canvas.getBoundingClientRect();
      canvas.width=r.width*2;canvas.height=400;
      ctx.scale(2,2);ctx.lineWidth=2;ctx.lineCap='round';ctx.strokeStyle='#1e293b';
    }
    initCanvas();window.addEventListener('resize',initCanvas);
    function getPos(e){const r=canvas.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return{x:t.clientX-r.left,y:t.clientY-r.top}}
    canvas.addEventListener('mousedown',e=>{drawing=true;ctx.beginPath();const p=getPos(e);ctx.moveTo(p.x,p.y)});
    canvas.addEventListener('mousemove',e=>{if(!drawing)return;const p=getPos(e);ctx.lineTo(p.x,p.y);ctx.stroke();hasFirma=true});
    canvas.addEventListener('mouseup',()=>drawing=false);
    canvas.addEventListener('mouseleave',()=>drawing=false);
    canvas.addEventListener('touchstart',e=>{e.preventDefault();drawing=true;ctx.beginPath();const p=getPos(e);ctx.moveTo(p.x,p.y)},{passive:false});
    canvas.addEventListener('touchmove',e=>{e.preventDefault();if(!drawing)return;const p=getPos(e);ctx.lineTo(p.x,p.y);ctx.stroke();hasFirma=true},{passive:false});
    canvas.addEventListener('touchend',()=>drawing=false);
    function limpiarFirma(){ctx.clearRect(0,0,canvas.width,canvas.height);hasFirma=false}
    async function enviarFirma(){
      const nombre=document.getElementById('nombre').value.trim();
      const email=document.getElementById('email').value.trim();
      if(!nombre||!email){alert('Complete nombre y correo');return}
      if(!hasFirma){alert('Dibuje su firma');return}
      const btn=document.getElementById('btnFirmar');
      btn.disabled=true;btn.textContent='Enviando...';
      try{
        const firmaBase64=canvas.toDataURL('image/png');
        const resp=await fetch('/api/firma/${token}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre,email,firmaBase64})});
        const data=await resp.json();
        if(data.ok){document.getElementById('firmaForm').style.display='none';document.getElementById('firmaStatus').style.display='block'}
        else{alert(data.error||'Error al firmar');btn.disabled=false;btn.textContent='Firmar Reporte'}
      }catch(err){alert('Error de conexión');btn.disabled=false;btn.textContent='Firmar Reporte'}
    }
  </script>
</body>
</html>`;
}

export default router;
