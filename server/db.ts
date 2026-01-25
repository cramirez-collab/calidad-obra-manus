import { eq, and, gte, lte, like, desc, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  empresas, InsertEmpresa, 
  unidades, InsertUnidad,
  especialidades, InsertEspecialidad,
  atributos, InsertAtributo,
  items, InsertItem,
  itemHistorial, InsertItemHistorial,
  notificaciones, InsertNotificacion,
  comentarios, InsertComentario
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from 'nanoid';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USUARIOS ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUsersByRole(role: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).where(eq(users.role, role as any)).orderBy(users.name);
}

export async function updateUserRole(userId: number, role: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role: role as any }).where(eq(users.id, userId));
}

export async function updateUserEmpresa(userId: number, empresaId: number | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ empresaId }).where(eq(users.id, userId));
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== EMPRESAS ====================

export async function getAllEmpresas() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(empresas).where(eq(empresas.activo, true)).orderBy(empresas.nombre);
}

export async function getEmpresaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(empresas).where(eq(empresas.id, id)).limit(1);
  return result[0];
}

export async function createEmpresa(data: InsertEmpresa) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(empresas).values(data);
  return result[0].insertId;
}

export async function updateEmpresa(id: number, data: Partial<InsertEmpresa>) {
  const db = await getDb();
  if (!db) return;
  await db.update(empresas).set(data).where(eq(empresas.id, id));
}

export async function deleteEmpresa(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(empresas).set({ activo: false }).where(eq(empresas.id, id));
}

// ==================== UNIDADES ====================

export async function getAllUnidades() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(unidades).where(eq(unidades.activo, true)).orderBy(unidades.nombre);
}

export async function getUnidadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(unidades).where(eq(unidades.id, id)).limit(1);
  return result[0];
}

export async function createUnidad(data: InsertUnidad) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(unidades).values(data);
  return result[0].insertId;
}

export async function updateUnidad(id: number, data: Partial<InsertUnidad>) {
  const db = await getDb();
  if (!db) return;
  await db.update(unidades).set(data).where(eq(unidades.id, id));
}

export async function deleteUnidad(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(unidades).set({ activo: false }).where(eq(unidades.id, id));
}

// ==================== ESPECIALIDADES ====================

export async function getAllEspecialidades() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(especialidades).where(eq(especialidades.activo, true)).orderBy(especialidades.nombre);
}

export async function getEspecialidadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(especialidades).where(eq(especialidades.id, id)).limit(1);
  return result[0];
}

export async function createEspecialidad(data: InsertEspecialidad) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(especialidades).values(data);
  return result[0].insertId;
}

export async function updateEspecialidad(id: number, data: Partial<InsertEspecialidad>) {
  const db = await getDb();
  if (!db) return;
  await db.update(especialidades).set(data).where(eq(especialidades.id, id));
}

export async function deleteEspecialidad(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(especialidades).set({ activo: false }).where(eq(especialidades.id, id));
}

// ==================== ATRIBUTOS ====================

export async function getAllAtributos() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(atributos).where(eq(atributos.activo, true)).orderBy(atributos.nombre);
}

export async function getAtributoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(atributos).where(eq(atributos.id, id)).limit(1);
  return result[0];
}

export async function createAtributo(data: InsertAtributo) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(atributos).values(data);
  return result[0].insertId;
}

export async function updateAtributo(id: number, data: Partial<InsertAtributo>) {
  const db = await getDb();
  if (!db) return;
  await db.update(atributos).set(data).where(eq(atributos.id, id));
}

export async function deleteAtributo(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(atributos).set({ activo: false }).where(eq(atributos.id, id));
}

// ==================== ITEMS ====================

export function generateItemCode() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid(6).toUpperCase();
  return `QC-${timestamp}-${random}`;
}

export async function createItem(data: Omit<InsertItem, 'codigo'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const codigo = generateItemCode();
  const result = await db.insert(items).values({ ...data, codigo });
  return { id: result[0].insertId, codigo };
}

export async function getItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(items).where(eq(items.id, id)).limit(1);
  return result[0];
}

export async function getItemByCodigo(codigo: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select({
      item: items,
      empresa: empresas,
      unidad: unidades,
      especialidad: especialidades,
    })
    .from(items)
    .leftJoin(empresas, eq(items.empresaId, empresas.id))
    .leftJoin(unidades, eq(items.unidadId, unidades.id))
    .leftJoin(especialidades, eq(items.especialidadId, especialidades.id))
    .where(eq(items.codigo, codigo))
    .limit(1);
  
  if (result.length === 0) return undefined;
  
  return {
    ...result[0].item,
    empresa: result[0].empresa,
    unidad: result[0].unidad,
    especialidad: result[0].especialidad,
  };
}

export async function updateItem(id: number, data: Partial<InsertItem>) {
  const db = await getDb();
  if (!db) return;
  await db.update(items).set(data).where(eq(items.id, id));
}

export interface ItemFilters {
  empresaId?: number;
  unidadId?: number;
  especialidadId?: number;
  atributoId?: number;
  residenteId?: number;
  jefeResidenteId?: number;
  supervisorId?: number;
  status?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  busqueda?: string;
}

export async function getItems(filters: ItemFilters = {}, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [];
  
  if (filters.empresaId) conditions.push(eq(items.empresaId, filters.empresaId));
  if (filters.unidadId) conditions.push(eq(items.unidadId, filters.unidadId));
  if (filters.especialidadId) conditions.push(eq(items.especialidadId, filters.especialidadId));
  if (filters.atributoId) conditions.push(eq(items.atributoId, filters.atributoId));
  if (filters.residenteId) conditions.push(eq(items.residenteId, filters.residenteId));
  if (filters.jefeResidenteId) conditions.push(eq(items.jefeResidenteId, filters.jefeResidenteId));
  if (filters.supervisorId) conditions.push(eq(items.supervisorId, filters.supervisorId));
  if (filters.status) conditions.push(eq(items.status, filters.status as any));
  if (filters.fechaDesde) conditions.push(gte(items.fechaCreacion, filters.fechaDesde));
  if (filters.fechaHasta) conditions.push(lte(items.fechaCreacion, filters.fechaHasta));
  if (filters.busqueda) {
    conditions.push(like(items.titulo, `%${filters.busqueda}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [itemsResult, countResult] = await Promise.all([
    db.select().from(items).where(whereClause).orderBy(desc(items.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(items).where(whereClause)
  ]);

  return { 
    items: itemsResult, 
    total: countResult[0]?.count || 0 
  };
}

export async function getItemsByUser(userId: number, role: string) {
  const db = await getDb();
  if (!db) return [];

  if (role === 'admin' || role === 'supervisor') {
    return await db.select().from(items).orderBy(desc(items.createdAt)).limit(100);
  } else if (role === 'jefe_residente') {
    return await db.select().from(items)
      .where(eq(items.status, 'pendiente_foto_despues'))
      .orderBy(desc(items.createdAt)).limit(100);
  } else {
    return await db.select().from(items)
      .where(eq(items.residenteId, userId))
      .orderBy(desc(items.createdAt)).limit(100);
  }
}

// ==================== HISTORIAL ====================

export async function addItemHistorial(data: InsertItemHistorial) {
  const db = await getDb();
  if (!db) return;
  await db.insert(itemHistorial).values(data);
}

export async function getItemHistorial(itemId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(itemHistorial)
    .where(eq(itemHistorial.itemId, itemId))
    .orderBy(desc(itemHistorial.createdAt));
}

// ==================== ESTADÍSTICAS ====================

export async function getEstadisticas(filters: ItemFilters = {}) {
  const db = await getDb();
  if (!db) return null;

  const conditions = [];
  if (filters.empresaId) conditions.push(eq(items.empresaId, filters.empresaId));
  if (filters.unidadId) conditions.push(eq(items.unidadId, filters.unidadId));
  if (filters.especialidadId) conditions.push(eq(items.especialidadId, filters.especialidadId));
  if (filters.atributoId) conditions.push(eq(items.atributoId, filters.atributoId));
  if (filters.residenteId) conditions.push(eq(items.residenteId, filters.residenteId));
  if (filters.fechaDesde) conditions.push(gte(items.fechaCreacion, filters.fechaDesde));
  if (filters.fechaHasta) conditions.push(lte(items.fechaCreacion, filters.fechaHasta));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, porStatusResult, porEspecialidadResult, porEmpresaResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(items).where(whereClause),
    db.select({ 
      status: items.status, 
      count: sql<number>`count(*)` 
    }).from(items).where(whereClause).groupBy(items.status),
    db.select({ 
      especialidadId: items.especialidadId, 
      count: sql<number>`count(*)` 
    }).from(items).where(whereClause).groupBy(items.especialidadId),
    db.select({ 
      empresaId: items.empresaId, 
      count: sql<number>`count(*)` 
    }).from(items).where(whereClause).groupBy(items.empresaId)
  ]);

  return {
    total: totalResult[0]?.count || 0,
    porStatus: porStatusResult,
    porEspecialidad: porEspecialidadResult,
    porEmpresa: porEmpresaResult
  };
}


// ==================== NOTIFICACIONES ====================

export async function createNotificacion(data: InsertNotificacion) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(notificaciones).values(data);
  return result[0].insertId;
}

export async function getNotificacionesByUsuario(usuarioId: number, soloNoLeidas: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(notificaciones.usuarioId, usuarioId)];
  if (soloNoLeidas) {
    conditions.push(eq(notificaciones.leida, false));
  }
  
  return await db
    .select()
    .from(notificaciones)
    .where(and(...conditions))
    .orderBy(desc(notificaciones.createdAt))
    .limit(50);
}

export async function marcarNotificacionLeida(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notificaciones).set({ leida: true }).where(eq(notificaciones.id, id));
}

export async function marcarTodasNotificacionesLeidas(usuarioId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notificaciones).set({ leida: true }).where(eq(notificaciones.usuarioId, usuarioId));
}

export async function contarNotificacionesNoLeidas(usuarioId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notificaciones)
    .where(and(eq(notificaciones.usuarioId, usuarioId), eq(notificaciones.leida, false)));
  return result[0]?.count || 0;
}

// Función para notificar a supervisores sobre ítems pendientes
export async function notificarSupervisores(itemId: number, titulo: string, mensaje: string) {
  const db = await getDb();
  if (!db) return;
  
  const supervisores = await db
    .select()
    .from(users)
    .where(inArray(users.role, ['admin', 'supervisor']));
  
  for (const supervisor of supervisores) {
    await createNotificacion({
      usuarioId: supervisor.id,
      itemId,
      tipo: 'item_pendiente_aprobacion',
      titulo,
      mensaje,
    });
  }
}

// Función para notificar a jefes de residente sobre ítems pendientes de foto
export async function notificarJefesResidente(itemId: number, empresaId: number | null, titulo: string, mensaje: string) {
  const db = await getDb();
  if (!db) return;
  
  const conditions = [inArray(users.role, ['jefe_residente'])];
  if (empresaId) {
    conditions.push(eq(users.empresaId, empresaId));
  }
  
  const jefes = await db
    .select()
    .from(users)
    .where(and(...conditions));
  
  for (const jefe of jefes) {
    await createNotificacion({
      usuarioId: jefe.id,
      itemId,
      tipo: 'item_pendiente_foto',
      titulo,
      mensaje,
    });
  }
}

// ==================== COMENTARIOS ====================

export async function createComentario(data: InsertComentario) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(comentarios).values(data);
  return result[0].insertId;
}

export async function getComentariosByItem(itemId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      comentario: comentarios,
      usuario: users,
    })
    .from(comentarios)
    .leftJoin(users, eq(comentarios.usuarioId, users.id))
    .where(eq(comentarios.itemId, itemId))
    .orderBy(comentarios.createdAt);
  
  return result.map(r => ({
    ...r.comentario,
    usuario: r.usuario,
  }));
}


// ==================== KPIs Y MÉTRICAS ====================

export async function getKPIs(filtros: {
  empresaId?: number;
  unidadId?: number;
  especialidadId?: number;
  fechaDesde?: Date;
  fechaHasta?: Date;
} = {}) {
  const db = await getDb();
  if (!db) return null;

  const conditions: any[] = [];
  if (filtros.empresaId) conditions.push(eq(items.empresaId, filtros.empresaId));
  if (filtros.unidadId) conditions.push(eq(items.unidadId, filtros.unidadId));
  if (filtros.especialidadId) conditions.push(eq(items.especialidadId, filtros.especialidadId));
  if (filtros.fechaDesde) conditions.push(gte(items.fechaCreacion, filtros.fechaDesde));
  if (filtros.fechaHasta) conditions.push(lte(items.fechaCreacion, filtros.fechaHasta));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Total de ítems
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .where(whereClause);
  const total = totalResult[0]?.count || 0;

  // Ítems aprobados
  const aprobadosResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .where(whereClause ? and(whereClause, eq(items.status, 'aprobado')) : eq(items.status, 'aprobado'));
  const aprobados = aprobadosResult[0]?.count || 0;

  // Ítems rechazados
  const rechazadosResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .where(whereClause ? and(whereClause, eq(items.status, 'rechazado')) : eq(items.status, 'rechazado'));
  const rechazados = rechazadosResult[0]?.count || 0;

  // Tasa de aprobación
  const tasaAprobacion = total > 0 ? ((aprobados / total) * 100).toFixed(1) : '0';
  const tasaRechazo = total > 0 ? ((rechazados / total) * 100).toFixed(1) : '0';

  // Tiempo promedio de resolución (desde creación hasta aprobación)
  const tiempoPromedioResult = await db
    .select({
      avgTime: sql<number>`AVG(TIMESTAMPDIFF(HOUR, fechaCreacion, fechaAprobacion))`
    })
    .from(items)
    .where(whereClause 
      ? and(whereClause, eq(items.status, 'aprobado'), sql`fechaAprobacion IS NOT NULL`)
      : and(eq(items.status, 'aprobado'), sql`fechaAprobacion IS NOT NULL`)
    );
  const tiempoPromedioHoras = tiempoPromedioResult[0]?.avgTime || 0;

  // Rendimiento por supervisor
  const rendimientoSupervisores = await db
    .select({
      supervisorId: items.supervisorId,
      aprobados: sql<number>`SUM(CASE WHEN status = 'aprobado' THEN 1 ELSE 0 END)`,
      rechazados: sql<number>`SUM(CASE WHEN status = 'rechazado' THEN 1 ELSE 0 END)`,
      total: sql<number>`count(*)`
    })
    .from(items)
    .where(whereClause 
      ? and(whereClause, sql`supervisorId IS NOT NULL`)
      : sql`supervisorId IS NOT NULL`
    )
    .groupBy(items.supervisorId);

  // Tendencia mensual (últimos 6 meses)
  const tendenciaMensual = await db
    .select({
      mes: sql<string>`DATE_FORMAT(fechaCreacion, '%Y-%m')`,
      total: sql<number>`count(*)`,
      aprobados: sql<number>`SUM(CASE WHEN status = 'aprobado' THEN 1 ELSE 0 END)`,
      rechazados: sql<number>`SUM(CASE WHEN status = 'rechazado' THEN 1 ELSE 0 END)`,
      pendientes: sql<number>`SUM(CASE WHEN status IN ('pendiente_foto_despues', 'pendiente_aprobacion') THEN 1 ELSE 0 END)`
    })
    .from(items)
    .where(sql`fechaCreacion >= DATE_SUB(NOW(), INTERVAL 6 MONTH)`)
    .groupBy(sql`DATE_FORMAT(fechaCreacion, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(fechaCreacion, '%Y-%m')`);

  // Comparativa por empresa
  const comparativaEmpresas = await db
    .select({
      empresaId: items.empresaId,
      total: sql<number>`count(*)`,
      aprobados: sql<number>`SUM(CASE WHEN status = 'aprobado' THEN 1 ELSE 0 END)`,
      rechazados: sql<number>`SUM(CASE WHEN status = 'rechazado' THEN 1 ELSE 0 END)`,
      tasaAprobacion: sql<number>`ROUND(SUM(CASE WHEN status = 'aprobado' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1)`
    })
    .from(items)
    .where(whereClause)
    .groupBy(items.empresaId);

  // Comparativa por unidad
  const comparativaUnidades = await db
    .select({
      unidadId: items.unidadId,
      total: sql<number>`count(*)`,
      aprobados: sql<number>`SUM(CASE WHEN status = 'aprobado' THEN 1 ELSE 0 END)`,
      rechazados: sql<number>`SUM(CASE WHEN status = 'rechazado' THEN 1 ELSE 0 END)`,
      tasaAprobacion: sql<number>`ROUND(SUM(CASE WHEN status = 'aprobado' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1)`
    })
    .from(items)
    .where(whereClause)
    .groupBy(items.unidadId);

  return {
    resumen: {
      total,
      aprobados,
      rechazados,
      pendientes: total - aprobados - rechazados,
      tasaAprobacion: parseFloat(tasaAprobacion),
      tasaRechazo: parseFloat(tasaRechazo),
      tiempoPromedioHoras: Math.round(tiempoPromedioHoras),
    },
    rendimientoSupervisores,
    tendenciaMensual,
    comparativaEmpresas,
    comparativaUnidades,
  };
}
