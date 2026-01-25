import { eq, and, gte, lte, like, desc, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import bcrypt from 'bcryptjs';
import { 
  InsertUser, users, 
  proyectos, InsertProyecto,
  proyectoUsuarios, InsertProyectoUsuario,
  empresas, InsertEmpresa, 
  unidades, InsertUnidad,
  especialidades, InsertEspecialidad,
  atributos, InsertAtributo,
  items, InsertItem,
  itemHistorial, InsertItemHistorial,
  notificaciones, InsertNotificacion,
  comentarios, InsertComentario,
  bitacora, InsertBitacora,
  configuracion, InsertConfiguracion,
  metas, InsertMeta,
  defectos, InsertDefecto,
  mensajes, InsertMensaje,
  userBadges, InsertUserBadge,
  auditoria, InsertAuditoria
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

// Obtener residente con todos sus datos relacionados en cadena
export async function getResidenteConDatosCompletos(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Obtener usuario
  const usuario = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!usuario[0]) return undefined;
  
  // Obtener empresa del usuario
  let empresa = null;
  if (usuario[0].empresaId) {
    const empresaResult = await db.select().from(empresas).where(eq(empresas.id, usuario[0].empresaId)).limit(1);
    empresa = empresaResult[0] || null;
  }
  
  // Obtener todos los ítems del residente
  const itemsResidente = await db.select().from(items).where(eq(items.residenteId, userId));
  
  // Obtener especialidades únicas de los ítems del residente
  const especialidadIds = Array.from(new Set(itemsResidente.map(i => i.especialidadId)));
  const especialidadesResidente = especialidadIds.length > 0 
    ? await db.select().from(especialidades).where(inArray(especialidades.id, especialidadIds))
    : [];
  
  // Obtener atributos de esas especialidades
  const atributosResidente = especialidadIds.length > 0
    ? await db.select().from(atributos).where(and(
        inArray(atributos.especialidadId, especialidadIds),
        eq(atributos.activo, true)
      ))
    : [];
  
  // Calcular estadísticas
  const itemsAprobados = itemsResidente.filter(i => i.status === 'aprobado');
  const itemsRechazados = itemsResidente.filter(i => i.status === 'rechazado');
  const itemsPendientes = itemsResidente.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion');
  
  return {
    ...usuario[0],
    empresa,
    especialidades: especialidadesResidente.map(esp => ({
      ...esp,
      atributos: atributosResidente.filter(attr => attr.especialidadId === esp.id)
    })),
    items: {
      total: itemsResidente.length,
      aprobados: itemsAprobados.length,
      rechazados: itemsRechazados.length,
      pendientes: itemsPendientes.length,
      lista: itemsResidente
    },
    estadisticas: {
      tasaAprobacion: itemsResidente.length > 0 
        ? Math.round((itemsAprobados.length / itemsResidente.length) * 100) 
        : 0,
      tasaRechazo: itemsResidente.length > 0 
        ? Math.round((itemsRechazados.length / itemsResidente.length) * 100) 
        : 0
    }
  };
}

// Obtener todos los residentes con sus datos básicos y estadísticas
export async function getAllResidentesConEstadisticas() {
  const db = await getDb();
  if (!db) return [];
  
  // Obtener todos los residentes
  const residentes = await db.select().from(users)
    .where(eq(users.role, 'residente'))
    .orderBy(users.name);
  
  // Obtener todas las empresas
  const todasEmpresas = await db.select().from(empresas);
  const empresasMap = new Map(todasEmpresas.map(e => [e.id, e]));
  
  // Obtener todos los ítems
  const todosItems = await db.select().from(items);
  
  return residentes.map(residente => {
    const itemsResidente = todosItems.filter(i => i.residenteId === residente.id);
    const aprobados = itemsResidente.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsResidente.filter(i => i.status === 'rechazado').length;
    const pendientes = itemsResidente.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
    
    return {
      ...residente,
      empresa: residente.empresaId ? empresasMap.get(residente.empresaId) : null,
      items: {
        total: itemsResidente.length,
        aprobados,
        rechazados,
        pendientes
      },
      tasaAprobacion: itemsResidente.length > 0 
        ? Math.round((aprobados / itemsResidente.length) * 100) 
        : 0
    };
  });
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

// Obtener empresa con todos sus datos relacionados en cadena
export async function getEmpresaConDatosCompletos(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const empresa = await db.select().from(empresas).where(eq(empresas.id, id)).limit(1);
  if (!empresa[0]) return undefined;
  
  // Obtener usuarios de la empresa
  const usuariosEmpresa = await db.select().from(users).where(eq(users.empresaId, id));
  
  // Obtener ítems de la empresa
  const itemsEmpresa = await db.select().from(items).where(eq(items.empresaId, id));
  
  // Obtener unidades únicas de los ítems
  const unidadIds = Array.from(new Set(itemsEmpresa.map(i => i.unidadId)));
  const unidadesEmpresa = unidadIds.length > 0
    ? await db.select().from(unidades).where(inArray(unidades.id, unidadIds))
    : [];
  
  // Calcular estadísticas
  const aprobados = itemsEmpresa.filter(i => i.status === 'aprobado').length;
  const rechazados = itemsEmpresa.filter(i => i.status === 'rechazado').length;
  const pendientes = itemsEmpresa.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
  
  return {
    ...empresa[0],
    usuarios: usuariosEmpresa,
    unidades: unidadesEmpresa,
    items: {
      total: itemsEmpresa.length,
      aprobados,
      rechazados,
      pendientes,
      lista: itemsEmpresa
    },
    estadisticas: {
      tasaAprobacion: itemsEmpresa.length > 0 ? Math.round((aprobados / itemsEmpresa.length) * 100) : 0,
      tasaRechazo: itemsEmpresa.length > 0 ? Math.round((rechazados / itemsEmpresa.length) * 100) : 0
    }
  };
}

// Obtener todas las empresas con estadísticas
export async function getAllEmpresasConEstadisticas() {
  const db = await getDb();
  if (!db) return [];
  
  const todasEmpresas = await db.select().from(empresas).where(eq(empresas.activo, true)).orderBy(empresas.nombre);
  const todosItems = await db.select().from(items);
  const todosUsuarios = await db.select().from(users);
  
  return todasEmpresas.map(empresa => {
    const itemsEmpresa = todosItems.filter(i => i.empresaId === empresa.id);
    const usuariosEmpresa = todosUsuarios.filter(u => u.empresaId === empresa.id);
    const aprobados = itemsEmpresa.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsEmpresa.filter(i => i.status === 'rechazado').length;
    
    return {
      ...empresa,
      totalUsuarios: usuariosEmpresa.length,
      items: {
        total: itemsEmpresa.length,
        aprobados,
        rechazados,
        pendientes: itemsEmpresa.length - aprobados - rechazados
      },
      tasaAprobacion: itemsEmpresa.length > 0 ? Math.round((aprobados / itemsEmpresa.length) * 100) : 0
    };
  });
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

// Obtener unidad con todos sus datos relacionados
export async function getUnidadConDatosCompletos(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const unidad = await db.select().from(unidades).where(eq(unidades.id, id)).limit(1);
  if (!unidad[0]) return undefined;
  
  // Obtener ítems de la unidad
  const itemsUnidad = await db.select().from(items).where(eq(items.unidadId, id));
  
  // Obtener empresas únicas de los ítems
  const empresaIds = Array.from(new Set(itemsUnidad.map(i => i.empresaId)));
  const empresasUnidad = empresaIds.length > 0
    ? await db.select().from(empresas).where(inArray(empresas.id, empresaIds))
    : [];
  
  // Obtener especialidades únicas de los ítems
  const especialidadIds = Array.from(new Set(itemsUnidad.map(i => i.especialidadId)));
  const especialidadesUnidad = especialidadIds.length > 0
    ? await db.select().from(especialidades).where(inArray(especialidades.id, especialidadIds))
    : [];
  
  const aprobados = itemsUnidad.filter(i => i.status === 'aprobado').length;
  const rechazados = itemsUnidad.filter(i => i.status === 'rechazado').length;
  
  return {
    ...unidad[0],
    empresas: empresasUnidad,
    especialidades: especialidadesUnidad,
    items: {
      total: itemsUnidad.length,
      aprobados,
      rechazados,
      pendientes: itemsUnidad.length - aprobados - rechazados,
      lista: itemsUnidad
    },
    estadisticas: {
      tasaAprobacion: itemsUnidad.length > 0 ? Math.round((aprobados / itemsUnidad.length) * 100) : 0
    }
  };
}

// Obtener todas las unidades con estadísticas
export async function getAllUnidadesConEstadisticas() {
  const db = await getDb();
  if (!db) return [];
  
  const todasUnidades = await db.select().from(unidades).where(eq(unidades.activo, true)).orderBy(unidades.nombre);
  const todosItems = await db.select().from(items);
  
  return todasUnidades.map(unidad => {
    const itemsUnidad = todosItems.filter(i => i.unidadId === unidad.id);
    const aprobados = itemsUnidad.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsUnidad.filter(i => i.status === 'rechazado').length;
    
    return {
      ...unidad,
      items: {
        total: itemsUnidad.length,
        aprobados,
        rechazados,
        pendientes: itemsUnidad.length - aprobados - rechazados
      },
      tasaAprobacion: itemsUnidad.length > 0 ? Math.round((aprobados / itemsUnidad.length) * 100) : 0
    };
  });
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

// Obtener especialidad con sus atributos relacionados
export async function getEspecialidadConAtributos(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const especialidad = await db.select().from(especialidades).where(eq(especialidades.id, id)).limit(1);
  if (!especialidad[0]) return undefined;
  
  const atributosRelacionados = await db.select().from(atributos)
    .where(and(eq(atributos.especialidadId, id), eq(atributos.activo, true)))
    .orderBy(atributos.nombre);
  
  return {
    ...especialidad[0],
    atributos: atributosRelacionados
  };
}

// Obtener todas las especialidades con sus atributos
export async function getAllEspecialidadesConAtributos() {
  const db = await getDb();
  if (!db) return [];
  
  const todasEspecialidades = await db.select().from(especialidades)
    .where(eq(especialidades.activo, true))
    .orderBy(especialidades.nombre);
  
  const todosAtributos = await db.select().from(atributos)
    .where(eq(atributos.activo, true));
  
  return todasEspecialidades.map(esp => ({
    ...esp,
    atributos: todosAtributos.filter(attr => attr.especialidadId === esp.id)
  }));
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

export async function createItem(data: Omit<InsertItem, 'codigo'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generar código OQC progresivo
  const codigo = await getNextOQCCode();
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
  proyectoId?: number;
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
  
  // Filtro por proyecto (CRITICO para aislamiento)
  if (filters.proyectoId) conditions.push(eq(items.proyectoId, filters.proyectoId));
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
  // Filtro por proyecto (CRITICO para aislamiento)
  if (filters.proyectoId) conditions.push(eq(items.proyectoId, filters.proyectoId));
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


// ==================== BITÁCORA DE ACTIVIDADES ====================

export async function registrarActividad(data: InsertBitacora) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(bitacora).values(data);
  return result[0].insertId;
}

export async function getBitacoraByUsuario(usuarioId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(bitacora)
    .where(eq(bitacora.usuarioId, usuarioId))
    .orderBy(desc(bitacora.createdAt))
    .limit(limit);
}

export async function getBitacoraGeneral(filtros: {
  usuarioId?: number;
  accion?: string;
  entidad?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
} = {}, limit = 200) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filtros.usuarioId) conditions.push(eq(bitacora.usuarioId, filtros.usuarioId));
  if (filtros.accion) conditions.push(eq(bitacora.accion, filtros.accion));
  if (filtros.entidad) conditions.push(eq(bitacora.entidad, filtros.entidad));
  if (filtros.fechaDesde) conditions.push(gte(bitacora.createdAt, filtros.fechaDesde));
  if (filtros.fechaHasta) conditions.push(lte(bitacora.createdAt, filtros.fechaHasta));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const result = await db
    .select({
      bitacora: bitacora,
      usuario: users,
    })
    .from(bitacora)
    .leftJoin(users, eq(bitacora.usuarioId, users.id))
    .where(whereClause)
    .orderBy(desc(bitacora.createdAt))
    .limit(limit);
  
  return result.map(r => ({
    ...r.bitacora,
    usuario: r.usuario,
  }));
}

// ==================== CÓDIGO OQC PROGRESIVO ====================

export async function getNextOQCCode(): Promise<string> {
  const db = await getDb();
  if (!db) return 'OQC-00001';
  
  const result = await db
    .select({ codigo: items.codigo })
    .from(items)
    .orderBy(desc(items.id))
    .limit(1);
  
  if (result.length === 0) {
    return 'OQC-00001';
  }
  
  const lastCode = result[0].codigo;
  const match = lastCode.match(/OQC-(\d+)/);
  if (!match) {
    return 'OQC-00001';
  }
  
  const nextNumber = parseInt(match[1], 10) + 1;
  return `OQC-${nextNumber.toString().padStart(5, '0')}`;
}

// ==================== PENDIENTES POR USUARIO ====================

export async function getPendientesByUsuario(userId: number, role: string) {
  const db = await getDb();
  if (!db) return [];
  
  let whereCondition;
  
  if (role === 'superadmin' || role === 'admin') {
    // Admin ve todos los pendientes
    whereCondition = inArray(items.status, ['pendiente_foto_despues', 'pendiente_aprobacion']);
  } else if (role === 'supervisor') {
    // Supervisor ve pendientes de aprobación
    whereCondition = eq(items.status, 'pendiente_aprobacion');
  } else if (role === 'jefe_residente') {
    // Jefe de residente ve pendientes de foto después
    whereCondition = eq(items.status, 'pendiente_foto_despues');
  } else {
    // Residente ve sus propios ítems pendientes
    whereCondition = and(
      eq(items.residenteId, userId),
      inArray(items.status, ['pendiente_foto_despues', 'pendiente_aprobacion', 'rechazado'])
    );
  }
  
  // Ordenar del más antiguo al más nuevo (ASC)
  return await db
    .select()
    .from(items)
    .where(whereCondition)
    .orderBy(items.fechaCreacion); // ASC = más antiguo primero
}

// ==================== CONFIGURACIÓN ====================

export async function getConfiguracion(clave: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(configuracion)
    .where(eq(configuracion.clave, clave))
    .limit(1);
  return result[0] || null;
}

export async function setConfiguracion(clave: string, valor: string, descripcion?: string, soloSuperadmin = false) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .insert(configuracion)
    .values({ clave, valor, descripcion, soloSuperadmin })
    .onDuplicateKeyUpdate({ set: { valor, descripcion, soloSuperadmin } });
}

export async function getAllConfiguracion(includeSuperadmin = false) {
  const db = await getDb();
  if (!db) return [];
  
  if (includeSuperadmin) {
    return await db.select().from(configuracion);
  }
  
  return await db
    .select()
    .from(configuracion)
    .where(eq(configuracion.soloSuperadmin, false));
}


// ==================== METAS ====================

export async function getAllMetas() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(metas).where(eq(metas.activo, true)).orderBy(desc(metas.createdAt));
}

export async function getMetaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(metas).where(eq(metas.id, id)).limit(1);
  return result[0];
}

export async function createMeta(data: InsertMeta) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(metas).values(data);
  return result[0].insertId;
}

export async function updateMeta(id: number, data: Partial<InsertMeta>) {
  const db = await getDb();
  if (!db) return;
  await db.update(metas).set(data).where(eq(metas.id, id));
}

export async function deleteMeta(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(metas).set({ activo: false }).where(eq(metas.id, id));
}

export async function getMetasConProgreso() {
  const db = await getDb();
  if (!db) return [];
  
  const metasActivas = await db.select().from(metas).where(eq(metas.activo, true));
  
  const metasConProgreso = await Promise.all(metasActivas.map(async (meta) => {
    let valorActual = 0;
    
    const conditions = [];
    if (meta.empresaId) conditions.push(eq(items.empresaId, meta.empresaId));
    if (meta.unidadId) conditions.push(eq(items.unidadId, meta.unidadId));
    if (meta.fechaInicio) conditions.push(gte(items.fechaCreacion, meta.fechaInicio));
    if (meta.fechaFin) conditions.push(lte(items.fechaCreacion, meta.fechaFin));
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    if (meta.tipo === 'aprobacion') {
      // Tasa de aprobación
      const totalResult = await db.select({ count: sql<number>`count(*)` }).from(items).where(whereClause);
      const aprobadosResult = await db.select({ count: sql<number>`count(*)` }).from(items)
        .where(whereClause ? and(whereClause, eq(items.status, 'aprobado')) : eq(items.status, 'aprobado'));
      const total = totalResult[0]?.count || 0;
      const aprobados = aprobadosResult[0]?.count || 0;
      valorActual = total > 0 ? Math.round((aprobados / total) * 100) : 0;
    } else if (meta.tipo === 'tiempo_resolucion') {
      // Tiempo promedio de resolución en días
      const tiempoResult = await db.select({
        avgTime: sql<number>`AVG(TIMESTAMPDIFF(DAY, fechaCreacion, fechaAprobacion))`
      }).from(items).where(whereClause ? and(whereClause, eq(items.status, 'aprobado')) : eq(items.status, 'aprobado'));
      valorActual = Math.round(tiempoResult[0]?.avgTime || 0);
    } else if (meta.tipo === 'items_mes') {
      // Ítems completados este mes
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const itemsResult = await db.select({ count: sql<number>`count(*)` }).from(items)
        .where(and(
          whereClause || sql`1=1`,
          eq(items.status, 'aprobado'),
          gte(items.fechaAprobacion, inicioMes)
        ));
      valorActual = itemsResult[0]?.count || 0;
    }
    
    const progreso = meta.valorObjetivo > 0 ? Math.min(100, Math.round((valorActual / meta.valorObjetivo) * 100)) : 0;
    
    return {
      ...meta,
      valorActual,
      progreso,
    };
  }));
  
  return metasConProgreso;
}


// ==================== DEFECTOS ====================

export async function getAllDefectos() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(defectos).where(eq(defectos.activo, true)).orderBy(defectos.nombre);
}

export async function getDefectoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(defectos).where(eq(defectos.id, id)).limit(1);
  return result[0];
}

export async function getDefectosByEspecialidad(especialidadId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(defectos)
    .where(and(
      eq(defectos.especialidadId, especialidadId),
      eq(defectos.activo, true)
    ))
    .orderBy(defectos.nombre);
}

export async function createDefecto(data: InsertDefecto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(defectos).values(data);
  return result[0].insertId;
}

export async function updateDefecto(id: number, data: Partial<InsertDefecto>) {
  const db = await getDb();
  if (!db) return;
  await db.update(defectos).set(data).where(eq(defectos.id, id));
}

export async function deleteDefecto(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(defectos).set({ activo: false }).where(eq(defectos.id, id));
}

// Obtener defectos con estadísticas de uso
export async function getDefectosConEstadisticas() {
  const db = await getDb();
  if (!db) return [];
  
  const todosDefectos = await db.select().from(defectos).where(eq(defectos.activo, true)).orderBy(defectos.nombre);
  const todosItems = await db.select().from(items);
  const todasEspecialidades = await db.select().from(especialidades);
  
  const especialidadesMap = new Map(todasEspecialidades.map(e => [e.id, e]));
  
  return todosDefectos.map(defecto => {
    const itemsConDefecto = todosItems.filter(i => i.defectoId === defecto.id);
    const aprobados = itemsConDefecto.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsConDefecto.filter(i => i.status === 'rechazado').length;
    const pendientes = itemsConDefecto.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
    
    return {
      ...defecto,
      especialidad: defecto.especialidadId ? especialidadesMap.get(defecto.especialidadId) : null,
      estadisticas: {
        total: itemsConDefecto.length,
        aprobados,
        rechazados,
        pendientes,
        tasaAprobacion: itemsConDefecto.length > 0 ? Math.round((aprobados / itemsConDefecto.length) * 100) : 0
      }
    };
  });
}

// ==================== USUARIOS MEJORADO ====================

// Crear usuario manualmente (para dar de alta usuarios)
export async function createUser(data: { 
  name: string; 
  email?: string; 
  role: string; 
  empresaId?: number | null;
  openId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generar openId único si no se proporciona
  const openId = data.openId || `manual_${nanoid(16)}`;
  
  const result = await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email || null,
    role: data.role as any,
    empresaId: data.empresaId || null,
    activo: true,
    lastSignedIn: new Date(),
  });
  
  return result[0].insertId;
}

// Crear usuario con contraseña (para admin/superadmin)

export async function createUserWithPassword(data: { 
  name: string; 
  email?: string;
  password: string;
  role: string; 
  empresaId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generar openId único para usuarios manuales
  const openId = `manual_${nanoid(16)}`;
  
  // Hash de la contraseña
  const passwordHash = await bcrypt.hash(data.password, 10);
  
  const result = await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email || null,
    passwordHash,
    loginMethod: 'password',
    role: data.role as any,
    empresaId: data.empresaId || null,
    activo: true,
    lastSignedIn: new Date(),
  });
  
  return result[0].insertId;
}

// Actualizar usuario con contraseña opcional
export async function updateUserWithPassword(id: number, data: {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  empresaId?: number | null;
  activo?: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.empresaId !== undefined) updateData.empresaId = data.empresaId;
  if (data.activo !== undefined) updateData.activo = data.activo;
  
  // Si se proporciona contraseña, hacer hash
  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }
  
  await db.update(users).set(updateData).where(eq(users.id, id));
}

// Actualizar usuario completo
export async function updateUser(id: number, data: {
  name?: string;
  email?: string;
  role?: string;
  empresaId?: number | null;
  activo?: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.empresaId !== undefined) updateData.empresaId = data.empresaId;
  if (data.activo !== undefined) updateData.activo = data.activo;
  
  await db.update(users).set(updateData).where(eq(users.id, id));
}

// Obtener usuarios con empresa relacionada
export async function getAllUsersConEmpresa() {
  const db = await getDb();
  if (!db) return [];
  
  const todosUsuarios = await db.select().from(users).orderBy(desc(users.createdAt));
  const todasEmpresas = await db.select().from(empresas);
  
  const empresasMap = new Map(todasEmpresas.map(e => [e.id, e]));
  
  return todosUsuarios.map(usuario => ({
    ...usuario,
    empresa: usuario.empresaId ? empresasMap.get(usuario.empresaId) : null
  }));
}

// Obtener usuarios por empresa
export async function getUsersByEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users)
    .where(eq(users.empresaId, empresaId))
    .orderBy(users.name);
}

// ==================== ESTADÍSTICAS DE DEFECTOS ====================

export async function getEstadisticasDefectos(filters: ItemFilters = {}) {
  const db = await getDb();
  if (!db) return null;
  
  const conditions = [];
  if (filters.empresaId) conditions.push(eq(items.empresaId, filters.empresaId));
  if (filters.unidadId) conditions.push(eq(items.unidadId, filters.unidadId));
  if (filters.especialidadId) conditions.push(eq(items.especialidadId, filters.especialidadId));
  if (filters.fechaDesde) conditions.push(gte(items.fechaCreacion, filters.fechaDesde));
  if (filters.fechaHasta) conditions.push(lte(items.fechaCreacion, filters.fechaHasta));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Obtener todos los items con filtros
  const itemsFiltrados = await db.select().from(items).where(whereClause);
  
  // Obtener todos los defectos
  const todosDefectos = await db.select().from(defectos).where(eq(defectos.activo, true));
  const todasEspecialidades = await db.select().from(especialidades);
  
  const especialidadesMap = new Map(todasEspecialidades.map(e => [e.id, e]));
  
  // Agrupar por defecto
  const porDefecto = todosDefectos.map(defecto => {
    const itemsDefecto = itemsFiltrados.filter(i => i.defectoId === defecto.id);
    const aprobados = itemsDefecto.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsDefecto.filter(i => i.status === 'rechazado').length;
    const pendientes = itemsDefecto.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
    
    return {
      defecto: {
        ...defecto,
        especialidad: defecto.especialidadId ? especialidadesMap.get(defecto.especialidadId) : null
      },
      total: itemsDefecto.length,
      aprobados,
      rechazados,
      pendientes,
      tasaAprobacion: itemsDefecto.length > 0 ? Math.round((aprobados / itemsDefecto.length) * 100) : 0
    };
  }).filter(d => d.total > 0).sort((a, b) => b.total - a.total);
  
  // Agrupar por severidad
  const porSeveridad = ['leve', 'moderado', 'grave', 'critico'].map(severidad => {
    const defectosConSeveridad = todosDefectos.filter(d => d.severidad === severidad);
    const defectoIds = defectosConSeveridad.map(d => d.id);
    const itemsSeveridad = itemsFiltrados.filter(i => i.defectoId && defectoIds.includes(i.defectoId));
    
    return {
      severidad,
      total: itemsSeveridad.length,
      aprobados: itemsSeveridad.filter(i => i.status === 'aprobado').length,
      rechazados: itemsSeveridad.filter(i => i.status === 'rechazado').length,
      pendientes: itemsSeveridad.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length
    };
  });
  
  return {
    porDefecto,
    porSeveridad,
    totalItems: itemsFiltrados.length,
    itemsConDefecto: itemsFiltrados.filter(i => i.defectoId).length,
    itemsSinDefecto: itemsFiltrados.filter(i => !i.defectoId).length
  };
}

// ==================== REPORTE FOTOGRÁFICO ====================

export async function getItemsParaReporte(filters: ItemFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters.empresaId) conditions.push(eq(items.empresaId, filters.empresaId));
  if (filters.unidadId) conditions.push(eq(items.unidadId, filters.unidadId));
  if (filters.especialidadId) conditions.push(eq(items.especialidadId, filters.especialidadId));
  if (filters.atributoId) conditions.push(eq(items.atributoId, filters.atributoId));
  if (filters.residenteId) conditions.push(eq(items.residenteId, filters.residenteId));
  if (filters.status) conditions.push(eq(items.status, filters.status as any));
  if (filters.fechaDesde) conditions.push(gte(items.fechaCreacion, filters.fechaDesde));
  if (filters.fechaHasta) conditions.push(lte(items.fechaCreacion, filters.fechaHasta));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Obtener items con todas las relaciones
  const itemsResult = await db.select().from(items).where(whereClause).orderBy(desc(items.fechaCreacion));
  
  // Obtener datos relacionados
  const todasEmpresas = await db.select().from(empresas);
  const todasUnidades = await db.select().from(unidades);
  const todasEspecialidades = await db.select().from(especialidades);
  const todosAtributos = await db.select().from(atributos);
  const todosDefectos = await db.select().from(defectos);
  const todosUsuarios = await db.select().from(users);
  
  const empresasMap = new Map(todasEmpresas.map(e => [e.id, e]));
  const unidadesMap = new Map(todasUnidades.map(u => [u.id, u]));
  const especialidadesMap = new Map(todasEspecialidades.map(e => [e.id, e]));
  const atributosMap = new Map(todosAtributos.map(a => [a.id, a]));
  const defectosMap = new Map(todosDefectos.map(d => [d.id, d]));
  const usuariosMap = new Map(todosUsuarios.map(u => [u.id, u]));
  
  return itemsResult.map(item => ({
    ...item,
    empresa: empresasMap.get(item.empresaId),
    unidad: unidadesMap.get(item.unidadId),
    especialidad: especialidadesMap.get(item.especialidadId),
    atributo: item.atributoId ? atributosMap.get(item.atributoId) : null,
    defecto: item.defectoId ? defectosMap.get(item.defectoId) : null,
    residente: usuariosMap.get(item.residenteId),
    jefeResidente: item.jefeResidenteId ? usuariosMap.get(item.jefeResidenteId) : null,
    supervisor: item.supervisorId ? usuariosMap.get(item.supervisorId) : null
  }));
}


// ==================== PROYECTOS ====================

export async function getAllProyectos() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(proyectos).where(eq(proyectos.activo, true)).orderBy(proyectos.nombre);
}

export async function getProyectoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(proyectos).where(eq(proyectos.id, id)).limit(1);
  return result[0];
}

export async function createProyecto(data: InsertProyecto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(proyectos).values(data);
  return result[0].insertId;
}

export async function updateProyecto(id: number, data: Partial<InsertProyecto>) {
  const db = await getDb();
  if (!db) return;
  await db.update(proyectos).set(data).where(eq(proyectos.id, id));
}

export async function deleteProyecto(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(proyectos).set({ activo: false }).where(eq(proyectos.id, id));
}

// Obtener proyecto con estadísticas completas
export async function getProyectoConEstadisticas(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const proyecto = await db.select().from(proyectos).where(eq(proyectos.id, id)).limit(1);
  if (!proyecto[0]) return undefined;
  
  // Obtener usuarios del proyecto
  const usuariosProyecto = await db.select()
    .from(proyectoUsuarios)
    .where(and(eq(proyectoUsuarios.proyectoId, id), eq(proyectoUsuarios.activo, true)));
  
  const usuarioIds = usuariosProyecto.map(pu => pu.usuarioId);
  const todosUsuarios = usuarioIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, usuarioIds))
    : [];
  
  // Obtener empresas del proyecto
  const empresasProyecto = await db.select().from(empresas)
    .where(and(eq(empresas.proyectoId, id), eq(empresas.activo, true)));
  
  // Obtener unidades del proyecto
  const unidadesProyecto = await db.select().from(unidades)
    .where(and(eq(unidades.proyectoId, id), eq(unidades.activo, true)));
  
  // Obtener ítems del proyecto
  const itemsProyecto = await db.select().from(items).where(eq(items.proyectoId, id));
  
  const aprobados = itemsProyecto.filter(i => i.status === 'aprobado').length;
  const rechazados = itemsProyecto.filter(i => i.status === 'rechazado').length;
  const pendientes = itemsProyecto.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
  
  return {
    ...proyecto[0],
    usuarios: usuariosProyecto.map(pu => ({
      ...pu,
      usuario: todosUsuarios.find(u => u.id === pu.usuarioId)
    })),
    empresas: empresasProyecto,
    unidades: unidadesProyecto,
    items: {
      total: itemsProyecto.length,
      aprobados,
      rechazados,
      pendientes
    },
    estadisticas: {
      tasaAprobacion: itemsProyecto.length > 0 ? Math.round((aprobados / itemsProyecto.length) * 100) : 0,
      tasaRechazo: itemsProyecto.length > 0 ? Math.round((rechazados / itemsProyecto.length) * 100) : 0
    }
  };
}

// Obtener todos los proyectos con estadísticas básicas
export async function getAllProyectosConEstadisticas() {
  const db = await getDb();
  if (!db) return [];
  
  const todosProyectos = await db.select().from(proyectos).where(eq(proyectos.activo, true)).orderBy(proyectos.nombre);
  const todosItems = await db.select().from(items);
  const todasEmpresas = await db.select().from(empresas).where(eq(empresas.activo, true));
  const todasUnidades = await db.select().from(unidades).where(eq(unidades.activo, true));
  const todosUsuariosProyecto = await db.select().from(proyectoUsuarios).where(eq(proyectoUsuarios.activo, true));
  
  return todosProyectos.map(proyecto => {
    const itemsProyecto = todosItems.filter(i => i.proyectoId === proyecto.id);
    const empresasProyecto = todasEmpresas.filter(e => e.proyectoId === proyecto.id);
    const unidadesProyecto = todasUnidades.filter(u => u.proyectoId === proyecto.id);
    const usuariosProyecto = todosUsuariosProyecto.filter(pu => pu.proyectoId === proyecto.id);
    
    const aprobados = itemsProyecto.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsProyecto.filter(i => i.status === 'rechazado').length;
    const pendientes = itemsProyecto.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
    
    return {
      ...proyecto,
      conteo: {
        empresas: empresasProyecto.length,
        unidades: unidadesProyecto.length,
        usuarios: usuariosProyecto.length,
        items: itemsProyecto.length
      },
      items: {
        total: itemsProyecto.length,
        aprobados,
        rechazados,
        pendientes
      },
      tasaAprobacion: itemsProyecto.length > 0 ? Math.round((aprobados / itemsProyecto.length) * 100) : 0
    };
  });
}

// ==================== PROYECTO-USUARIOS ====================

export async function getUsuariosByProyecto(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const relaciones = await db.select()
    .from(proyectoUsuarios)
    .where(and(eq(proyectoUsuarios.proyectoId, proyectoId), eq(proyectoUsuarios.activo, true)));
  
  if (relaciones.length === 0) return [];
  
  const usuarioIds = relaciones.map(r => r.usuarioId);
  const todosUsuarios = await db.select().from(users).where(inArray(users.id, usuarioIds));
  
  return relaciones.map(rel => ({
    ...rel,
    usuario: todosUsuarios.find(u => u.id === rel.usuarioId)
  }));
}

export async function getProyectosByUsuario(usuarioId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const relaciones = await db.select()
    .from(proyectoUsuarios)
    .where(and(eq(proyectoUsuarios.usuarioId, usuarioId), eq(proyectoUsuarios.activo, true)));
  
  if (relaciones.length === 0) return [];
  
  const proyectoIds = relaciones.map(r => r.proyectoId);
  const todosProyectos = await db.select().from(proyectos)
    .where(and(inArray(proyectos.id, proyectoIds), eq(proyectos.activo, true)));
  
  return relaciones.map(rel => ({
    ...rel,
    proyecto: todosProyectos.find(p => p.id === rel.proyectoId)
  }));
}

export async function asignarUsuarioAProyecto(data: InsertProyectoUsuario) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verificar si ya existe la relación
  const existente = await db.select()
    .from(proyectoUsuarios)
    .where(and(
      eq(proyectoUsuarios.proyectoId, data.proyectoId),
      eq(proyectoUsuarios.usuarioId, data.usuarioId)
    ))
    .limit(1);
  
  if (existente.length > 0) {
    // Actualizar si existe
    await db.update(proyectoUsuarios)
      .set({ activo: true, rolEnProyecto: data.rolEnProyecto })
      .where(eq(proyectoUsuarios.id, existente[0].id));
    return existente[0].id;
  }
  
  const result = await db.insert(proyectoUsuarios).values(data);
  return result[0].insertId;
}

export async function removerUsuarioDeProyecto(proyectoId: number, usuarioId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(proyectoUsuarios)
    .set({ activo: false })
    .where(and(
      eq(proyectoUsuarios.proyectoId, proyectoId),
      eq(proyectoUsuarios.usuarioId, usuarioId)
    ));
}

export async function actualizarRolEnProyecto(proyectoId: number, usuarioId: number, rol: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(proyectoUsuarios)
    .set({ rolEnProyecto: rol as any })
    .where(and(
      eq(proyectoUsuarios.proyectoId, proyectoId),
      eq(proyectoUsuarios.usuarioId, usuarioId)
    ));
}

// ==================== FUNCIONES CON FILTRO DE PROYECTO ====================

export async function getEmpresasByProyecto(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(empresas)
    .where(and(eq(empresas.proyectoId, proyectoId), eq(empresas.activo, true)))
    .orderBy(empresas.nombre);
}

export async function getUnidadesByProyecto(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(unidades)
    .where(and(eq(unidades.proyectoId, proyectoId), eq(unidades.activo, true)))
    .orderBy(unidades.nombre);
}

export async function getEspecialidadesByProyecto(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(especialidades)
    .where(and(eq(especialidades.proyectoId, proyectoId), eq(especialidades.activo, true)))
    .orderBy(especialidades.nombre);
}

export async function getItemsByProyecto(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(items)
    .where(eq(items.proyectoId, proyectoId))
    .orderBy(desc(items.fechaCreacion));
}


// ==================== MENSAJES (CHAT POR ÍTEM) ====================

export async function getMensajesByItem(itemId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const mensajesData = await db.select().from(mensajes)
    .where(and(eq(mensajes.itemId, itemId), eq(mensajes.eliminado, false)))
    .orderBy(mensajes.createdAt);
  
  // Obtener usuarios de los mensajes
  const usuarioIds = Array.from(new Set(mensajesData.map(m => m.usuarioId)));
  if (usuarioIds.length === 0) return [];
  
  const usuariosData = await db.select().from(users)
    .where(inArray(users.id, usuarioIds));
  
  return mensajesData.map(m => ({
    ...m,
    usuario: usuariosData.find(u => u.id === m.usuarioId),
    menciones: m.menciones ? JSON.parse(m.menciones) : []
  }));
}

export async function createMensaje(data: { itemId: number; usuarioId: number; texto: string; menciones?: number[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(mensajes).values({
    itemId: data.itemId,
    usuarioId: data.usuarioId,
    texto: data.texto,
    menciones: data.menciones ? JSON.stringify(data.menciones) : null
  });
  
  return result[0].insertId;
}

export async function updateMensaje(id: number, texto: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(mensajes)
    .set({ texto, editado: true })
    .where(eq(mensajes.id, id));
}

export async function deleteMensaje(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(mensajes)
    .set({ eliminado: true })
    .where(eq(mensajes.id, id));
}

// ==================== BADGES DE USUARIO ====================

export async function getUserBadges(usuarioId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const badges = await db.select().from(userBadges)
    .where(eq(userBadges.usuarioId, usuarioId))
    .limit(1);
  
  if (badges.length === 0) {
    // Crear registro de badges si no existe
    await db.insert(userBadges).values({ usuarioId });
    return { usuarioId, rechazados: 0, aprobadosJefe: 0, aprobadosSupervisor: 0, mensajesNoLeidos: 0 };
  }
  
  return badges[0];
}

export async function incrementBadge(usuarioId: number, tipo: 'rechazados' | 'aprobadosJefe' | 'aprobadosSupervisor' | 'mensajesNoLeidos') {
  const db = await getDb();
  if (!db) return;
  
  // Verificar si existe el registro
  const existing = await db.select().from(userBadges)
    .where(eq(userBadges.usuarioId, usuarioId))
    .limit(1);
  
  if (existing.length === 0) {
    // Crear con el badge incrementado
    const values: any = { usuarioId, rechazados: 0, aprobadosJefe: 0, aprobadosSupervisor: 0, mensajesNoLeidos: 0 };
    values[tipo] = 1;
    await db.insert(userBadges).values(values);
  } else {
    // Incrementar el badge
    await db.update(userBadges)
      .set({ [tipo]: sql`${userBadges[tipo]} + 1` })
      .where(eq(userBadges.usuarioId, usuarioId));
  }
}

export async function decrementBadge(usuarioId: number, tipo: 'rechazados' | 'aprobadosJefe' | 'aprobadosSupervisor' | 'mensajesNoLeidos') {
  const db = await getDb();
  if (!db) return;
  
  await db.update(userBadges)
    .set({ [tipo]: sql`GREATEST(${userBadges[tipo]} - 1, 0)` })
    .where(eq(userBadges.usuarioId, usuarioId));
}

export async function resetBadge(usuarioId: number, tipo: 'rechazados' | 'aprobadosJefe' | 'aprobadosSupervisor' | 'mensajesNoLeidos') {
  const db = await getDb();
  if (!db) return;
  
  await db.update(userBadges)
    .set({ [tipo]: 0 })
    .where(eq(userBadges.usuarioId, usuarioId));
}

// ==================== AUDITORÍA ====================

export async function createAuditoria(data: {
  usuarioId: number;
  usuarioNombre?: string;
  usuarioRol?: string;
  accion: string;
  categoria: string;
  entidadTipo?: string;
  entidadId?: number;
  entidadCodigo?: string;
  valorAnterior?: any;
  valorNuevo?: any;
  detalles?: string;
  ip?: string;
  userAgent?: string;
}) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(auditoria).values({
    ...data,
    valorAnterior: data.valorAnterior ? JSON.stringify(data.valorAnterior) : null,
    valorNuevo: data.valorNuevo ? JSON.stringify(data.valorNuevo) : null
  });
}

export async function getAuditoria(filtros?: {
  usuarioId?: number;
  categoria?: string;
  entidadTipo?: string;
  entidadId?: number;
  fechaDesde?: Date;
  fechaHasta?: Date;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(auditoria);
  const conditions = [];
  
  if (filtros?.usuarioId) conditions.push(eq(auditoria.usuarioId, filtros.usuarioId));
  if (filtros?.categoria) conditions.push(eq(auditoria.categoria, filtros.categoria));
  if (filtros?.entidadTipo) conditions.push(eq(auditoria.entidadTipo, filtros.entidadTipo));
  if (filtros?.entidadId) conditions.push(eq(auditoria.entidadId, filtros.entidadId));
  if (filtros?.fechaDesde) conditions.push(gte(auditoria.createdAt, filtros.fechaDesde));
  if (filtros?.fechaHasta) conditions.push(lte(auditoria.createdAt, filtros.fechaHasta));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const result = await query.orderBy(desc(auditoria.createdAt))
    .limit(filtros?.limit || 100)
    .offset(filtros?.offset || 0);
  
  return result;
}

export async function getAuditoriaByUsuario(usuarioId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(auditoria)
    .where(eq(auditoria.usuarioId, usuarioId))
    .orderBy(desc(auditoria.createdAt))
    .limit(limit);
}

export async function getAuditoriaCount(filtros?: {
  usuarioId?: number;
  categoria?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
}) {
  const db = await getDb();
  if (!db) return 0;
  
  const conditions = [];
  if (filtros?.usuarioId) conditions.push(eq(auditoria.usuarioId, filtros.usuarioId));
  if (filtros?.categoria) conditions.push(eq(auditoria.categoria, filtros.categoria));
  if (filtros?.fechaDesde) conditions.push(gte(auditoria.createdAt, filtros.fechaDesde));
  if (filtros?.fechaHasta) conditions.push(lte(auditoria.createdAt, filtros.fechaHasta));
  
  let query = db.select({ count: sql<number>`count(*)` }).from(auditoria);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const result = await query;
  return result[0]?.count || 0;
}

// ==================== ESTADÍSTICAS AVANZADAS DE RENDIMIENTO ====================

export async function getEstadisticasRendimientoUsuarios() {
  const db = await getDb();
  if (!db) return [];
  
  // Obtener todos los usuarios activos
  const usuariosData = await db.select().from(users)
    .where(eq(users.activo, true));
  
  // Obtener todos los items
  const itemsData = await db.select().from(items);
  
  // Calcular estadísticas por usuario
  const estadisticas = usuariosData.map(usuario => {
    const itemsUsuario = itemsData.filter(i => i.residenteId === usuario.id);
    const itemsAprobados = itemsUsuario.filter(i => i.status === 'aprobado');
    const itemsRechazados = itemsUsuario.filter(i => i.status === 'rechazado');
    const itemsPendientes = itemsUsuario.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion');
    
    // Calcular tiempos promedio
    let tiempoPromedioAprobacion = 0;
    let tiempoPromedioResolucion = 0;
    
    const itemsConAprobacion = itemsAprobados.filter(i => i.fechaAprobacion);
    if (itemsConAprobacion.length > 0) {
      const tiempos = itemsConAprobacion.map(i => {
        const inicio = new Date(i.fechaCreacion).getTime();
        const fin = new Date(i.fechaAprobacion!).getTime();
        return (fin - inicio) / (1000 * 60 * 60); // horas
      });
      tiempoPromedioAprobacion = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    }
    
    const itemsConFotoDespues = itemsUsuario.filter(i => i.fechaFotoDespues);
    if (itemsConFotoDespues.length > 0) {
      const tiempos = itemsConFotoDespues.map(i => {
        const inicio = new Date(i.fechaCreacion).getTime();
        const fin = new Date(i.fechaFotoDespues!).getTime();
        return (fin - inicio) / (1000 * 60 * 60); // horas
      });
      tiempoPromedioResolucion = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    }
    
    // Contar OK de supervisor (items aprobados que tienen fecha de aprobación)
    const okSupervisor = itemsAprobados.filter(i => i.fechaAprobacion).length;
    
    return {
      usuarioId: usuario.id,
      usuarioNombre: usuario.name,
      usuarioRol: usuario.role,
      itemsCompletados: itemsUsuario.length,
      aprobados: itemsAprobados.length,
      rechazados: itemsRechazados.length,
      pendientes: itemsPendientes.length,
      okSupervisor,
      tasaAprobacion: itemsUsuario.length > 0 
        ? Math.round((itemsAprobados.length / itemsUsuario.length) * 100) 
        : 0,
      tiempoPromedioHoras: Math.round(tiempoPromedioAprobacion * 10) / 10,
      tiempoPromedioResolucion: Math.round(tiempoPromedioResolucion * 10) / 10
    };
  });
  
  // Ordenar por total de items (mayor a menor)
  return estadisticas.sort((a, b) => b.itemsCompletados - a.itemsCompletados);
}

export async function getEstadisticasSupervisores() {
  const db = await getDb();
  if (!db) return [];
  
  // Obtener supervisores
  const supervisores = await db.select().from(users)
    .where(and(
      eq(users.activo, true),
      inArray(users.role, ['supervisor', 'admin', 'superadmin'])
    ));
  
  // Obtener items aprobados
  const itemsData = await db.select().from(items)
    .where(eq(items.status, 'aprobado'));
  
  return supervisores.map(supervisor => {
    const itemsAprobados = itemsData.filter(i => i.supervisorId === supervisor.id);
    
    // Calcular tiempo promedio de aprobación
    let tiempoPromedio = 0;
    const itemsConTiempos = itemsAprobados.filter(i => i.fechaAprobacion && i.fechaFotoDespues);
    if (itemsConTiempos.length > 0) {
      const tiempos = itemsConTiempos.map(i => {
        const inicio = new Date(i.fechaFotoDespues!).getTime();
        const fin = new Date(i.fechaAprobacion!).getTime();
        return (fin - inicio) / (1000 * 60 * 60); // horas
      });
      tiempoPromedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    }
    
    return {
      supervisor: {
        id: supervisor.id,
        name: supervisor.name,
        role: supervisor.role
      },
      totalAprobados: itemsAprobados.length,
      tiempoPromedioAprobacion: Math.round(tiempoPromedio * 10) / 10
    };
  }).sort((a, b) => b.totalAprobados - a.totalAprobados);
}

export async function getDefectosPorUsuario() {
  const db = await getDb();
  if (!db) return [];
  
  // Obtener items con defectos
  const itemsData = await db.select().from(items)
    .where(sql`${items.defectoId} IS NOT NULL`);
  
  // Obtener usuarios
  const usuariosData = await db.select().from(users)
    .where(eq(users.activo, true));
  
  // Obtener defectos
  const defectosData = await db.select().from(defectos);
  
  return usuariosData.map(usuario => {
    const itemsUsuario = itemsData.filter(i => i.residenteId === usuario.id);
    const aprobados = itemsUsuario.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsUsuario.filter(i => i.status === 'rechazado').length;
    
    // Contar defectos por tipo
    const defectosCounts: Record<number, number> = {};
    itemsUsuario.forEach(item => {
      if (item.defectoId) {
        defectosCounts[item.defectoId] = (defectosCounts[item.defectoId] || 0) + 1;
      }
    });
    
    const defectosDetalle = Object.entries(defectosCounts).map(([defectoId, count]) => {
      const defecto = defectosData.find(d => d.id === parseInt(defectoId));
      return {
        defecto: defecto || { id: parseInt(defectoId), nombre: 'Desconocido' },
        cantidad: count
      };
    }).sort((a, b) => b.cantidad - a.cantidad);
    
    return {
      usuarioId: usuario.id,
      usuarioNombre: usuario.name,
      usuarioRol: usuario.role,
      totalDefectos: itemsUsuario.length,
      aprobados,
      rechazados,
      defectosDetalle
    };
  }).filter(u => u.totalDefectos > 0).sort((a, b) => b.totalDefectos - a.totalDefectos);
}
