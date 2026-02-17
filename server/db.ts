import { eq, ne, and, or, gte, lte, like, desc, asc, sql, inArray, notInArray, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import bcrypt from 'bcryptjs';
import { 
  InsertUser, users, 
  proyectos, InsertProyecto,
  proyectoUsuarios, InsertProyectoUsuario,
  empresas, InsertEmpresa, 
  unidades, InsertUnidad,
  espacios, InsertEspacio,
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
  auditoria, InsertAuditoria,
  pushSubscriptions, InsertPushSubscription,
  empresaEspecialidades, InsertEmpresaEspecialidad,
  empresaResidentes, InsertEmpresaResidente,
  empresaHistorial, InsertEmpresaHistorial,
  avisos, InsertAviso,
  avisosLecturas, InsertAvisoLectura,
  planos, InsertPlano,
  planoPines, InsertPlanoPin,
  firmasReporte, InsertFirmaReporte,
  bitacoraCorreos, InsertBitacoraCorreo,
  reportesIA, InsertReporteIA,
  catalogoPruebas, InsertCatalogoPrueba,
  pruebasResultado, InsertPruebaResultado,
  pruebasBitacora, InsertPruebaBitacora,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from 'nanoid';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: ReturnType<typeof mysql.createPool> | null = null;

// ==================== CACHÉ EN MEMORIA DEL SERVIDOR ====================
const serverCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 60_000; // 1 min default

function getCached<T>(key: string): T | null {
  const entry = serverCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    serverCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: any, ttl = CACHE_TTL) {
  serverCache.set(key, { data, expiry: Date.now() + ttl });
}

export function invalidateCache(prefix?: string) {
  if (!prefix) { serverCache.clear(); return; }
  const keys = Array.from(serverCache.keys());
  for (const key of keys) {
    if (key.startsWith(prefix)) serverCache.delete(key);
  }
}

// Campos de items sin Base64 para evitar cargar datos enormes
const itemFieldsWithoutBase64 = {
  id: items.id,
  codigo: items.codigo,
  qrCode: items.qrCode,
  proyectoId: items.proyectoId,
  empresaId: items.empresaId,
  unidadId: items.unidadId,
  especialidadId: items.especialidadId,
  atributoId: items.atributoId,
  defectoId: items.defectoId,
  espacioId: items.espacioId,
  residenteId: items.residenteId,
  jefeResidenteId: items.jefeResidenteId,
  supervisorId: items.supervisorId,
  titulo: items.titulo,
  descripcion: items.descripcion,
  ubicacionDetalle: items.ubicacionDetalle,
  fotoAntesUrl: items.fotoAntesUrl,
  fotoAntesKey: items.fotoAntesKey,
  fotoAntesMarcadaUrl: items.fotoAntesMarcadaUrl,
  fotoAntesMarcadaKey: items.fotoAntesMarcadaKey,
  fotoDespuesUrl: items.fotoDespuesUrl,
  fotoDespuesKey: items.fotoDespuesKey,
  status: items.status,
  fechaCreacion: items.fechaCreacion,
  fechaFotoDespues: items.fechaFotoDespues,
  fechaAprobacion: items.fechaAprobacion,
  fechaCierre: items.fechaCierre,
  // Campos de trazabilidad
  creadoPorId: items.creadoPorId,
  asignadoAId: items.asignadoAId,
  aprobadoPorId: items.aprobadoPorId,
  cerradoPorId: items.cerradoPorId,
  comentarioResidente: items.comentarioResidente,
  comentarioJefeResidente: items.comentarioJefeResidente,
  comentarioSupervisor: items.comentarioSupervisor,
  clientId: items.clientId,
  numeroInterno: items.numeroInterno,
  // Campos de pin en plano
  pinPlanoId: items.pinPlanoId,
  pinPosX: items.pinPosX,
  pinPosY: items.pinPosY,
  createdAt: items.createdAt,
  updatedAt: items.updatedAt,
};

export async function getDbInstance() { return getDb(); }
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Connection pool optimizado para 20+ usuarios concurrentes
      _pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        connectionLimit: 20,       // Max conexiones simultáneas
        maxIdle: 10,               // Conexiones idle en pool
        idleTimeout: 60000,        // 60s antes de cerrar idle
        enableKeepAlive: true,     // Mantener conexiones vivas
        keepAliveInitialDelay: 30000, // Keepalive cada 30s
        waitForConnections: true,  // Esperar si pool lleno
        queueLimit: 0,             // Sin límite de cola (0=ilimitado, evita Queue limit reached)
        connectTimeout: 10000,     // 10s timeout de conexión
      });
      _db = drizzle(_pool);
      console.log('[Database] Pool de conexiones inicializado (limit: 20)');
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
    // Verificar si el usuario ya existe por openId
    let existingUser = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    let isNewUser = existingUser.length === 0;
    
    // Si es usuario nuevo y tiene email, buscar si existe un usuario manual con ese email
    // para heredar su rol y empresa (vinculación por email)
    let inheritedRole: string | undefined;
    let inheritedEmpresaId: number | null = null;
    let inheritedProyectos: number[] = [];
    
    if (isNewUser && user.email) {
      const manualUser = await db.select().from(users)
        .where(and(
          eq(users.email, user.email),
          like(users.openId, 'manual_%')
        ))
        .limit(1);
      
      if (manualUser.length > 0) {
        console.log(`[Database] Encontrado usuario manual con email ${user.email}, heredando configuración`);
        inheritedRole = manualUser[0].role;
        inheritedEmpresaId = manualUser[0].empresaId;
        
        // Obtener proyectos del usuario manual
        const proyectosDelManual = await db.select().from(proyectoUsuarios)
          .where(eq(proyectoUsuarios.usuarioId, manualUser[0].id));
        inheritedProyectos = proyectosDelManual.map(p => p.proyectoId);
      }
    }

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
    
    // Asignar rol SOLO para usuarios nuevos
    // NUNCA sobrescribir el rol de usuarios existentes para preservar superadmin, etc.
    if (isNewUser) {
      if (user.role !== undefined) {
        values.role = user.role;
      } else if (inheritedRole) {
        values.role = inheritedRole as any;
      } else if (user.openId === ENV.ownerOpenId) {
        values.role = 'admin';
      }
    }
    // NO agregar role a updateSet - el rol nunca se sobrescribe en login
    
    // Asignar empresa heredada si existe
    if (inheritedEmpresaId) {
      values.empresaId = inheritedEmpresaId;
      updateSet.empresaId = inheritedEmpresaId;
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

    // Si es un usuario nuevo, asignarlo a proyectos
    if (isNewUser) {
      try {
        // Obtener el ID del usuario recién creado
        const newUser = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
        if (newUser.length > 0) {
          // Si hay proyectos heredados del usuario manual, asignarlos
          if (inheritedProyectos.length > 0) {
            for (const proyectoId of inheritedProyectos) {
              await db.insert(proyectoUsuarios).values({
                proyectoId,
                usuarioId: newUser[0].id,
                rolEnProyecto: (inheritedRole as any) || 'residente',
              }).onDuplicateKeyUpdate({ set: { activo: true } });
            }
            console.log(`[Database] Usuario ${user.openId} asignado a ${inheritedProyectos.length} proyectos heredados`);
          } else {
            // Sin proyectos heredados: NO asignar automáticamente a ningún proyecto
            // El admin debe asignar manualmente al usuario al proyecto correcto
            console.log(`[Database] Usuario ${user.openId} creado sin proyecto asignado - requiere asignación manual por admin`);
          }
        }
      } catch (assignError) {
        console.warn("[Database] No se pudo asignar usuario al proyecto:", assignError);
      }
    }
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
  const itemsResidente = await db.select(itemFieldsWithoutBase64).from(items).where(eq(items.residenteId, userId));
  
  // Obtener especialidades únicas de los ítems del residente (filtrar nulls)
  const especialidadIds = Array.from(new Set(itemsResidente.map(i => i.especialidadId).filter((id): id is number => id !== null)));
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
  const todosItems = await db.select(itemFieldsWithoutBase64).from(items);
  
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

export async function getAllEmpresas(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (proyectoId) {
    return await db.select().from(empresas)
      .where(and(eq(empresas.activo, true), eq(empresas.proyectoId, proyectoId)))
      .orderBy(empresas.nombre);
  }
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
  const itemsEmpresa = await db.select(itemFieldsWithoutBase64).from(items).where(eq(items.empresaId, id));
  
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
export async function getAllEmpresasConEstadisticas(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const todasEmpresas = proyectoId
    ? await db.select().from(empresas).where(and(eq(empresas.activo, true), eq(empresas.proyectoId, proyectoId))).orderBy(empresas.nombre)
    : await db.select().from(empresas).where(eq(empresas.activo, true)).orderBy(empresas.nombre);
  const todosItems = proyectoId
    ? await db.select(itemFieldsWithoutBase64).from(items).where(eq(items.proyectoId, proyectoId))
    : await db.select(itemFieldsWithoutBase64).from(items);
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

// Función auxiliar para ordenamiento numérico natural
// Ordena: 1, 2, 3... 101, 102... 201, 202... (no alfabético)
function naturalSort<T>(arr: T[], getKey: (item: T) => string | null | undefined): T[] {
  return [...arr].sort((a, b) => {
    const keyA = getKey(a) || '';
    const keyB = getKey(b) || '';
    
    // Extraer números del string
    const numA = parseInt(keyA.replace(/\D/g, '')) || 0;
    const numB = parseInt(keyB.replace(/\D/g, '')) || 0;
    
    // Si ambos tienen números, ordenar numéricamente
    if (numA !== 0 || numB !== 0) {
      return numA - numB;
    }
    
    // Si no tienen números, ordenar alfabéticamente
    return keyA.localeCompare(keyB, 'es', { numeric: true, sensitivity: 'base' });
  });
}

export async function getAllUnidades(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  let result;
  if (proyectoId) {
    result = await db.select().from(unidades)
      .where(and(eq(unidades.activo, true), eq(unidades.proyectoId, proyectoId)));
  } else {
    result = await db.select().from(unidades).where(eq(unidades.activo, true));
  }
  // Ordenar numéricamente por nombre
  return naturalSort(result, u => u.nombre);
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
  const itemsUnidad = await db.select(itemFieldsWithoutBase64).from(items).where(eq(items.unidadId, id));
  
  // Obtener empresas únicas de los ítems
  const empresaIds = Array.from(new Set(itemsUnidad.map(i => i.empresaId)));
  const empresasUnidad = empresaIds.length > 0
    ? await db.select().from(empresas).where(inArray(empresas.id, empresaIds))
    : [];
  
  // Obtener especialidades únicas de los ítems (filtrar nulls)
  const especialidadIds = Array.from(new Set(itemsUnidad.map(i => i.especialidadId).filter((id): id is number => id !== null)));
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
export async function getAllUnidadesConEstadisticas(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const unidadesRaw = proyectoId
    ? await db.select().from(unidades).where(and(eq(unidades.activo, true), eq(unidades.proyectoId, proyectoId)))
    : await db.select().from(unidades).where(eq(unidades.activo, true));
  // Ordenar numéricamente por nombre
  const todasUnidades = naturalSort(unidadesRaw, u => u.nombre);
  const todosItems = proyectoId
    ? await db.select(itemFieldsWithoutBase64).from(items).where(eq(items.proyectoId, proyectoId))
    : await db.select(itemFieldsWithoutBase64).from(items);
  
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

// Obtener unidades con estadísticas para vista panorámica (filtrado por proyecto)
export async function getUnidadesParaPanoramica(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const unidadesRaw = await db.select().from(unidades)
    .where(and(eq(unidades.activo, true), eq(unidades.proyectoId, proyectoId)));
  
  // Ordenar por nivel primero, luego numéricamente por nombre dentro de cada nivel
  const todasUnidades = [...unidadesRaw].sort((a, b) => {
    // Primero por nivel
    const nivelA = a.nivel || 1;
    const nivelB = b.nivel || 1;
    if (nivelA !== nivelB) return nivelA - nivelB;
    
    // Luego por nombre numéricamente
    const nombreA = a.nombre || '';
    const nombreB = b.nombre || '';
    const numA = parseInt(nombreA.replace(/\D/g, '')) || 0;
    const numB = parseInt(nombreB.replace(/\D/g, '')) || 0;
    if (numA !== 0 || numB !== 0) return numA - numB;
    return nombreA.localeCompare(nombreB, 'es', { numeric: true });
  });
  
  const todosItems = await db.select(itemFieldsWithoutBase64).from(items).where(eq(items.proyectoId, proyectoId));
  
  return todasUnidades.map(unidad => {
    const itemsUnidad = todosItems.filter(i => i.unidadId === unidad.id);
    const aprobados = itemsUnidad.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsUnidad.filter(i => i.status === 'rechazado').length;
    // Contar ítems aprobados con supervisor asignado (OK final)
    const okSupervisor = itemsUnidad.filter(i => i.status === 'aprobado' && i.supervisorId !== null).length;
    const pendientes = itemsUnidad.length - aprobados - rechazados;
    
    // Determinar estado de la unidad
    // Azul = 100% completado (todos aprobados con OK supervisor)
    // Rojo = tiene rechazados
    // Verde = tiene pendientes
    // Gris = sin ítems
    let estado: 'completado' | 'rechazado' | 'pendiente' | 'sin_items' = 'sin_items';
    if (itemsUnidad.length > 0) {
      if (rechazados > 0) {
        estado = 'rechazado';
      } else if (pendientes > 0) {
        estado = 'pendiente';
      } else if (aprobados === itemsUnidad.length && okSupervisor === itemsUnidad.length) {
        estado = 'completado';
      } else {
        estado = 'pendiente';
      }
    }
    
    return {
      id: unidad.id,
      nombre: unidad.nombre,
      codigo: unidad.codigo,
      nivel: unidad.nivel || 1,
      orden: unidad.orden || 0,
      fechaInicio: unidad.fechaInicio,
      fechaFin: unidad.fechaFin,
      estado,
      items: {
        total: itemsUnidad.length,
        aprobados,
        rechazados,
        pendientes,
        okSupervisor
      },
      porcentaje: itemsUnidad.length > 0 ? Math.round((okSupervisor / itemsUnidad.length) * 100) : 0
    };
  });
}

// Importar unidades desde Excel
export async function importarUnidadesDesdeExcel(proyectoId: number, unidadesData: Array<{
  nombre: string;
  codigo?: string;
  nivel?: number;
  fechaInicio?: Date;
  fechaFin?: Date;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const resultados = [];
  for (const u of unidadesData) {
    const result = await db.insert(unidades).values({
      proyectoId,
      nombre: u.nombre,
      codigo: u.codigo,
      nivel: u.nivel || 1,
      fechaInicio: u.fechaInicio,
      fechaFin: u.fechaFin,
      activo: true,
    });
    resultados.push(result[0].insertId);
  }
  return resultados;
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

// Actualizar orden de múltiples unidades (para drag & drop en stacking)
export async function updateUnidadesOrden(updates: Array<{ id: number; orden: number; nivel?: number }>) {
  const db = await getDb();
  if (!db) return;
  
  for (const update of updates) {
    const updateData: { orden: number; nivel?: number } = { orden: update.orden };
    if (update.nivel !== undefined) {
      updateData.nivel = update.nivel;
    }
    await db.update(unidades).set(updateData).where(eq(unidades.id, update.id));
  }
}

// ==================== ESPECIALIDADES ====================

export async function getAllEspecialidades(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (proyectoId) {
    return await db.select().from(especialidades)
      .where(and(eq(especialidades.activo, true), eq(especialidades.proyectoId, proyectoId)))
      .orderBy(especialidades.numero);
  }
  return await db.select().from(especialidades).where(eq(especialidades.activo, true)).orderBy(especialidades.numero);
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
export async function getAllEspecialidadesConAtributos(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const todasEspecialidades = proyectoId
    ? await db.select().from(especialidades)
        .where(and(eq(especialidades.activo, true), eq(especialidades.proyectoId, proyectoId)))
        .orderBy(especialidades.numero)
    : await db.select().from(especialidades)
        .where(eq(especialidades.activo, true))
        .orderBy(especialidades.numero);
  
  const todosAtributos = await db.select().from(atributos)
    .where(eq(atributos.activo, true));
  
  return todasEspecialidades.map(esp => ({
    ...esp,
    atributos: todosAtributos.filter(attr => attr.especialidadId === esp.id)
  }));
}

// Defectos típicos por tipo de especialidad
const DEFECTOS_TIPICOS: Record<string, string[]> = {
  // Electricidad
  'electricidad': ['Cable suelto o mal conectado', 'Apagador defectuoso', 'Contacto sin corriente', 'Centro de carga dañado', 'Falta de tierra física'],
  'electrica': ['Cable suelto o mal conectado', 'Apagador defectuoso', 'Contacto sin corriente', 'Centro de carga dañado', 'Falta de tierra física'],
  'elec': ['Cable suelto o mal conectado', 'Apagador defectuoso', 'Contacto sin corriente', 'Centro de carga dañado', 'Falta de tierra física'],
  
  // Plomería
  'plomeria': ['Fuga de agua', 'Drenaje tapado', 'Llave con goteo', 'Presión de agua baja', 'WC no sella correctamente'],
  'plomero': ['Fuga de agua', 'Drenaje tapado', 'Llave con goteo', 'Presión de agua baja', 'WC no sella correctamente'],
  'hidraulica': ['Fuga de agua', 'Drenaje tapado', 'Llave con goteo', 'Presión de agua baja', 'Tubería dañada'],
  'sanitaria': ['Drenaje tapado', 'Mal olor en desagüe', 'WC no sella', 'Fuga en sifón', 'Coladera obstruida'],
  
  // Acabados
  'acabados': ['Pintura descascarada', 'Grieta en muro', 'Azulejo despegado', 'Piso rayado', 'Moldura dañada'],
  'pintura': ['Pintura descascarada', 'Manchas en pared', 'Color disparejo', 'Burbujas en pintura', 'Pintura corrida'],
  'pisos': ['Piso rayado', 'Loseta despegada', 'Desnivel en piso', 'Junta faltante', 'Piso manchado'],
  'muros': ['Grieta en muro', 'Humedad en pared', 'Acabado irregular', 'Fisura visible', 'Desplome de muro'],
  
  // Carpintería
  'carpinteria': ['Puerta no cierra', 'Bisagra floja', 'Madera astillada', 'Chapa defectuosa', 'Puerta pandeada'],
  'madera': ['Madera astillada', 'Acabado dañado', 'Unión floja', 'Madera hinchada', 'Barniz desprendido'],
  'puertas': ['Puerta no cierra', 'Bisagra floja', 'Chapa defectuosa', 'Puerta pandeada', 'Marco desalineado'],
  
  // Albañilería
  'albanileria': ['Muro desplomado', 'Junta irregular', 'Fisura en aplanado', 'Nivel incorrecto', 'Acabado rugoso'],
  'alba': ['Muro desplomado', 'Junta irregular', 'Fisura en aplanado', 'Nivel incorrecto', 'Acabado rugoso'],
  
  // Cerámicos
  'ceramico': ['Piso rayado', 'Loseta despegada', 'Desnivel en piso', 'Junta faltante', 'Piso manchado'],
  'ceramica': ['Piso rayado', 'Loseta despegada', 'Desnivel en piso', 'Junta faltante', 'Piso manchado'],
  'azulejo': ['Azulejo despegado', 'Corte irregular', 'Junta dispareja', 'Azulejo rayado', 'Falta de azulejo'],
  
  // Waller/Tablaroca
  'waller': ['Junta visible', 'Abultamiento', 'Fisura en esquina', 'Tornillo expuesto', 'Acabado irregular'],
  'tablaroca': ['Junta visible', 'Abultamiento', 'Fisura en esquina', 'Tornillo expuesto', 'Acabado irregular'],
  'drywall': ['Junta visible', 'Abultamiento', 'Fisura en esquina', 'Tornillo expuesto', 'Acabado irregular'],
  
  // Aluminio y Vidrio
  'aluminio': ['Ventana no cierra', 'Vidrio roto', 'Cancel desalineado', 'Felpa dañada', 'Oxidación en perfil'],
  'vidrio': ['Vidrio roto', 'Vidrio rayado', 'Sello deficiente', 'Vidrio empanado', 'Falta de vidrio'],
  'herreria': ['Oxidación', 'Soldadura deficiente', 'Barandal flojo', 'Pintura descascarada', 'Elemento desalineado'],
  
  // Impermeabilización
  'impermeabilizacion': ['Filtración de agua', 'Membrana despegada', 'Burbuja en impermeabilizante', 'Grieta en azotea', 'Charco estancado'],
  'impermeabilizante': ['Filtración de agua', 'Membrana despegada', 'Burbuja en impermeabilizante', 'Grieta en azotea', 'Charco estancado'],
  
  // Aire Acondicionado
  'aire': ['Fuga de refrigerante', 'No enfría', 'Ruido excesivo', 'Goteo de agua', 'Control no funciona'],
  'clima': ['Fuga de refrigerante', 'No enfría', 'Ruido excesivo', 'Goteo de agua', 'Control no funciona'],
  'hvac': ['Fuga de refrigerante', 'No enfría', 'Ruido excesivo', 'Goteo de agua', 'Ducto dañado'],
  
  // Estructura
  'estructura': ['Grieta estructural', 'Acero expuesto', 'Concreto poroso', 'Desplome', 'Fisura en columna'],
  'concreto': ['Grieta en concreto', 'Cangrejera', 'Acero expuesto', 'Segregación', 'Junta fría'],
  
  // Gas
  'gas': ['Fuga de gas', 'Conexión floja', 'Válvula defectuosa', 'Tubería dañada', 'Falta de ventilación'],
  
  // Default
  'default': ['Defecto de instalación', 'Material dañado', 'Acabado deficiente', 'Falta de elemento', 'Funcionamiento incorrecto']
};

function getDefectosTipicos(nombreEspecialidad: string): string[] {
  const nombreLower = nombreEspecialidad.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  for (const [key, defectos] of Object.entries(DEFECTOS_TIPICOS)) {
    if (nombreLower.includes(key) || key.includes(nombreLower)) {
      return defectos;
    }
  }
  
  return DEFECTOS_TIPICOS['default'];
}

export async function createEspecialidad(data: InsertEspecialidad) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Obtener el siguiente número secuencial para el proyecto
  const existentes = await db.select({ numero: especialidades.numero })
    .from(especialidades)
    .where(data.proyectoId ? eq(especialidades.proyectoId, data.proyectoId) : undefined);
  
  const maxNumero = existentes.reduce((max, e) => Math.max(max, e.numero || 0), 0);
  const nuevoNumero = maxNumero + 1;
  
  const result = await db.insert(especialidades).values({ ...data, numero: nuevoNumero });
  const especialidadId = result[0].insertId;
  
  // Crear defectos típicos automáticamente
  const defectosTipicos = getDefectosTipicos(data.nombre);
  for (const nombreDefecto of defectosTipicos) {
    await db.insert(defectos).values({
      nombre: nombreDefecto,
      especialidadId: especialidadId,
      proyectoId: data.proyectoId,
      severidad: 'moderado'
    });
  }
  
  return especialidadId;
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

// ==================== ESPACIOS ====================

export async function getAllEspacios(proyectoId?: number, unidadId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(espacios.activo, true)];
  if (proyectoId) conditions.push(eq(espacios.proyectoId, proyectoId));
  if (unidadId) conditions.push(eq(espacios.unidadId, unidadId));
  
  return await db.select().from(espacios)
    .where(and(...conditions))
    .orderBy(espacios.orden, espacios.nombre);
}

export async function getEspaciosByUnidad(unidadId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(espacios)
    .where(and(eq(espacios.unidadId, unidadId), eq(espacios.activo, true)))
    .orderBy(espacios.orden, espacios.nombre);
}

export async function getEspaciosPlantilla(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  // Espacios plantilla son los que no tienen unidadId (genéricos del proyecto)
  return await db.select().from(espacios)
    .where(and(
      eq(espacios.proyectoId, proyectoId),
      sql`${espacios.unidadId} IS NULL`,
      eq(espacios.activo, true)
    ))
    .orderBy(espacios.orden, espacios.nombre);
}

export async function getEspacioById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(espacios).where(eq(espacios.id, id)).limit(1);
  return result[0];
}

export async function createEspacio(data: InsertEspacio) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(espacios).values(data);
  return result[0].insertId;
}

export async function createEspaciosBulk(unidadId: number, espaciosData: Omit<InsertEspacio, 'unidadId'>[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Obtener proyectoId de la unidad
  const unidad = await db.select().from(unidades).where(eq(unidades.id, unidadId)).limit(1);
  const proyectoId = unidad[0]?.proyectoId;
  
  const ids: number[] = [];
  for (const espacio of espaciosData) {
    const result = await db.insert(espacios).values({
      ...espacio,
      unidadId,
      proyectoId
    });
    ids.push(result[0].insertId);
  }
  return ids;
}

export async function copiarEspaciosPlantillaAUnidad(proyectoId: number, unidadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Obtener espacios plantilla del proyecto
  const plantilla = await getEspaciosPlantilla(proyectoId);
  
  // Copiar cada espacio a la unidad
  let count = 0;
  for (const espacio of plantilla) {
    await db.insert(espacios).values({
      proyectoId,
      unidadId,
      nombre: espacio.nombre,
      codigo: espacio.codigo,
      descripcion: espacio.descripcion,
      orden: espacio.orden
    });
    count++;
  }
  return count;
}

export async function updateEspacio(id: number, data: Partial<InsertEspacio>) {
  const db = await getDb();
  if (!db) return;
  await db.update(espacios).set(data).where(eq(espacios.id, id));
}

export async function deleteEspacio(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(espacios).set({ activo: false }).where(eq(espacios.id, id));
}

// ==================== ATRIBUTOS ====================

export async function getAllAtributos(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(atributos.activo, true)];
  if (proyectoId) conditions.push(eq(atributos.proyectoId, proyectoId));
  return await db.select().from(atributos).where(and(...conditions)).orderBy(atributos.nombre);
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

// Obtener el siguiente número interno consecutivo para un proyecto
export async function getNextNumeroInterno(proyectoId: number | undefined): Promise<number> {
  const db = await getDb();
  if (!db) return 1;
  
  const result = await db
    .select({ maxNum: sql<number>`COALESCE(MAX(${items.numeroInterno}), 0)` })
    .from(items)
    .where(proyectoId ? eq(items.proyectoId, proyectoId) : sql`1=1`);
  
  return (result[0]?.maxNum ?? 0) + 1;
}

export async function createItem(data: Omit<InsertItem, 'codigo'> & { codigoQrPreasignado?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Usar código QR preasignado si existe (cuando se escanea etiqueta nueva en campo)
  // Si no, generar código QR progresivo por proyecto
  const codigo = data.codigoQrPreasignado || await getNextOQCCode(data.proyectoId ?? undefined);
  
  // Obtener número interno consecutivo
  const numeroInterno = await getNextNumeroInterno(data.proyectoId ?? undefined);
  
  // Remover codigoQrPreasignado del data antes de insertar
  const { codigoQrPreasignado, ...insertData } = data;
  
  const result = await db.insert(items).values({ ...insertData, codigo, numeroInterno });
  invalidateCache('pendientes');
  invalidateCache('allProyectosEnriquecidos');
  return { id: result[0].insertId, codigo, numeroInterno };
}

export async function getItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  // Excluir campos base64 para evitar cargar datos enormes
  const result = await db.select({
    id: items.id,
    codigo: items.codigo,
    qrCode: items.qrCode,
    proyectoId: items.proyectoId,
    empresaId: items.empresaId,
    unidadId: items.unidadId,
    especialidadId: items.especialidadId,
    atributoId: items.atributoId,
    defectoId: items.defectoId,
    espacioId: items.espacioId,
    residenteId: items.residenteId,
    jefeResidenteId: items.jefeResidenteId,
    supervisorId: items.supervisorId,
    titulo: items.titulo,
    descripcion: items.descripcion,
    ubicacionDetalle: items.ubicacionDetalle,
    fotoAntesUrl: items.fotoAntesUrl,
    fotoAntesKey: items.fotoAntesKey,
    fotoAntesMarcadaUrl: items.fotoAntesMarcadaUrl,
    fotoAntesMarcadaKey: items.fotoAntesMarcadaKey,
    fotoDespuesUrl: items.fotoDespuesUrl,
    fotoDespuesKey: items.fotoDespuesKey,
    status: items.status,
    fechaCreacion: items.fechaCreacion,
    fechaFotoDespues: items.fechaFotoDespues,
    fechaAprobacion: items.fechaAprobacion,
    fechaCierre: items.fechaCierre,
    // Campos de trazabilidad
    creadoPorId: items.creadoPorId,
    asignadoAId: items.asignadoAId,
    aprobadoPorId: items.aprobadoPorId,
    cerradoPorId: items.cerradoPorId,
    comentarioResidente: items.comentarioResidente,
    comentarioJefeResidente: items.comentarioJefeResidente,
    comentarioSupervisor: items.comentarioSupervisor,
    clientId: items.clientId,
    numeroInterno: items.numeroInterno,
    pinPlanoId: items.pinPlanoId,
    pinPosX: items.pinPosX,
    pinPosY: items.pinPosY,
    createdAt: items.createdAt,
    updatedAt: items.updatedAt,
  }).from(items).where(eq(items.id, id)).limit(1);
  return result[0];
}

// Obtener información completa del ítem para notificaciones push
export async function getItemInfoForPush(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select({
      item: items,
      unidad: unidades,
      defecto: defectos,
    })
    .from(items)
    .leftJoin(unidades, eq(items.unidadId, unidades.id))
    .leftJoin(defectos, eq(items.defectoId, defectos.id))
    .where(eq(items.id, id))
    .limit(1);
  
  if (result.length === 0) return undefined;
  
  return {
    itemId: result[0].item.id,
    codigo: result[0].item.codigo,
    titulo: result[0].item.titulo,
    unidadNombre: result[0].unidad?.nombre || 'Sin unidad',
    defectoNombre: result[0].defecto?.nombre || result[0].item.titulo || 'Sin defecto',
    residenteId: result[0].item.residenteId,
    proyectoId: result[0].item.proyectoId,
  };
}
export async function getItemByCodigo(codigo: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Usar campos específicos sin Base64 para evitar enviar datos enormes
  const result = await db
    .select({
      id: items.id,
      codigo: items.codigo,
      qrCode: items.qrCode,
      proyectoId: items.proyectoId,
      empresaId: items.empresaId,
      unidadId: items.unidadId,
      especialidadId: items.especialidadId,
      atributoId: items.atributoId,
      defectoId: items.defectoId,
      espacioId: items.espacioId,
      residenteId: items.residenteId,
      jefeResidenteId: items.jefeResidenteId,
      supervisorId: items.supervisorId,
      titulo: items.titulo,
      descripcion: items.descripcion,
      ubicacionDetalle: items.ubicacionDetalle,
      fotoAntesUrl: items.fotoAntesUrl,
      fotoAntesKey: items.fotoAntesKey,
      fotoAntesMarcadaUrl: items.fotoAntesMarcadaUrl,
      fotoAntesMarcadaKey: items.fotoAntesMarcadaKey,
      fotoDespuesUrl: items.fotoDespuesUrl,
      fotoDespuesKey: items.fotoDespuesKey,
      status: items.status,
      fechaCreacion: items.fechaCreacion,
      fechaFotoDespues: items.fechaFotoDespues,
      fechaAprobacion: items.fechaAprobacion,
      fechaCierre: items.fechaCierre,
      // Campos de trazabilidad
      creadoPorId: items.creadoPorId,
      asignadoAId: items.asignadoAId,
      aprobadoPorId: items.aprobadoPorId,
      cerradoPorId: items.cerradoPorId,
      comentarioResidente: items.comentarioResidente,
      comentarioJefeResidente: items.comentarioJefeResidente,
      comentarioSupervisor: items.comentarioSupervisor,
      clientId: items.clientId,
      numeroInterno: items.numeroInterno,
      createdAt: items.createdAt,
      updatedAt: items.updatedAt,
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
  
  return result[0];
}

export async function updateItem(id: number, data: Partial<InsertItem>) {
  const db = await getDb();
  if (!db) return;
  await db.update(items).set(data).where(eq(items.id, id));
  invalidateCache('pendientes');
  invalidateCache('allProyectosEnriquecidos');
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
  creadoPorId?: number;
  asignadoAId?: number; // Filtro por usuario asignado
  status?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  busqueda?: string;
  numeroInterno?: number;
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
  if (filters.creadoPorId) conditions.push(eq(items.creadoPorId, filters.creadoPorId));
  if (filters.asignadoAId) conditions.push(eq(items.asignadoAId, filters.asignadoAId));
  if (filters.status) conditions.push(eq(items.status, filters.status as any));
  if (filters.fechaDesde) conditions.push(gte(items.fechaCreacion, filters.fechaDesde));
  if (filters.fechaHasta) conditions.push(lte(items.fechaCreacion, filters.fechaHasta));
  if (filters.busqueda) {
    conditions.push(like(items.titulo, `%${filters.busqueda}%`));
  }
  if (filters.numeroInterno) {
    conditions.push(eq(items.numeroInterno, filters.numeroInterno));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Excluir campos base64 para evitar cargar datos enormes
  const selectFields = {
    id: items.id,
    codigo: items.codigo,
    qrCode: items.qrCode,
    proyectoId: items.proyectoId,
    empresaId: items.empresaId,
    unidadId: items.unidadId,
    especialidadId: items.especialidadId,
    atributoId: items.atributoId,
    defectoId: items.defectoId,
    espacioId: items.espacioId,
    residenteId: items.residenteId,
    jefeResidenteId: items.jefeResidenteId,
    supervisorId: items.supervisorId,
    titulo: items.titulo,
    descripcion: items.descripcion,
    ubicacionDetalle: items.ubicacionDetalle,
    fotoAntesUrl: items.fotoAntesUrl,
    fotoAntesKey: items.fotoAntesKey,
    fotoAntesMarcadaUrl: items.fotoAntesMarcadaUrl,
    fotoAntesMarcadaKey: items.fotoAntesMarcadaKey,
    fotoDespuesUrl: items.fotoDespuesUrl,
    fotoDespuesKey: items.fotoDespuesKey,
    status: items.status,
    fechaCreacion: items.fechaCreacion,
    fechaFotoDespues: items.fechaFotoDespues,
    fechaAprobacion: items.fechaAprobacion,
    comentarioResidente: items.comentarioResidente,
    comentarioJefeResidente: items.comentarioJefeResidente,
    comentarioSupervisor: items.comentarioSupervisor,
    clientId: items.clientId,
    numeroInterno: items.numeroInterno,
    // Campos de trazabilidad de usuarios
    creadoPorId: items.creadoPorId,
    asignadoAId: items.asignadoAId,
    aprobadoPorId: items.aprobadoPorId,
    cerradoPorId: items.cerradoPorId,
    fechaCierre: items.fechaCierre,
    createdAt: items.createdAt,
    updatedAt: items.updatedAt,
  };

  const [itemsResult, countResult] = await Promise.all([
    db.select(selectFields).from(items).where(whereClause).orderBy(desc(items.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(items).where(whereClause)
  ]);

  return { 
    items: itemsResult, 
    total: countResult[0]?.count || 0 
  };
}

export async function getItemsByUser(userId: number, role: string, proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];

  // Campos a seleccionar (excluyendo Base64)
  const selectFields = {
    id: items.id,
    codigo: items.codigo,
    qrCode: items.qrCode,
    proyectoId: items.proyectoId,
    empresaId: items.empresaId,
    unidadId: items.unidadId,
    especialidadId: items.especialidadId,
    atributoId: items.atributoId,
    defectoId: items.defectoId,
    espacioId: items.espacioId,
    residenteId: items.residenteId,
    jefeResidenteId: items.jefeResidenteId,
    supervisorId: items.supervisorId,
    titulo: items.titulo,
    descripcion: items.descripcion,
    ubicacionDetalle: items.ubicacionDetalle,
    fotoAntesUrl: items.fotoAntesUrl,
    fotoAntesKey: items.fotoAntesKey,
    fotoAntesMarcadaUrl: items.fotoAntesMarcadaUrl,
    fotoAntesMarcadaKey: items.fotoAntesMarcadaKey,
    fotoDespuesUrl: items.fotoDespuesUrl,
    fotoDespuesKey: items.fotoDespuesKey,
    status: items.status,
    fechaCreacion: items.fechaCreacion,
    fechaFotoDespues: items.fechaFotoDespues,
    fechaAprobacion: items.fechaAprobacion,
    comentarioResidente: items.comentarioResidente,
    comentarioJefeResidente: items.comentarioJefeResidente,
    comentarioSupervisor: items.comentarioSupervisor,
    clientId: items.clientId,
    numeroInterno: items.numeroInterno,
    createdAt: items.createdAt,
    updatedAt: items.updatedAt,
  };

  const baseConditions = proyectoId ? [eq(items.proyectoId, proyectoId)] : [];

  if (role === 'admin' || role === 'supervisor') {
    const where = baseConditions.length > 0 ? and(...baseConditions) : undefined;
    return await db.select(selectFields).from(items).where(where).orderBy(desc(items.createdAt)).limit(100);
  } else if (role === 'jefe_residente') {
    return await db.select(selectFields).from(items)
      .where(and(...baseConditions, eq(items.status, 'pendiente_foto_despues')))
      .orderBy(desc(items.createdAt)).limit(100);
  } else {
    return await db.select(selectFields).from(items)
      .where(and(...baseConditions, eq(items.residenteId, userId)))
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


// ==================== PENALIZACIONES ====================

const PENALIZACION_POR_ITEM = 2000; // $2,000 MXN por ítem no aprobado

export async function getPenalizacionesPorEmpresa(filters: { proyectoId?: number; empresaId?: number; fechaDesde?: Date; fechaHasta?: Date } = {}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters.proyectoId) conditions.push(eq(items.proyectoId, filters.proyectoId));
  if (filters.empresaId) conditions.push(eq(items.empresaId, filters.empresaId));
  if (filters.fechaDesde) conditions.push(gte(items.fechaCreacion, filters.fechaDesde));
  if (filters.fechaHasta) conditions.push(lte(items.fechaCreacion, filters.fechaHasta));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Total de ítems y aprobados por empresa
  const result = await db
    .select({
      empresaId: items.empresaId,
      totalItems: sql<number>`count(*)`,
      aprobados: sql<number>`SUM(CASE WHEN ${items.status} = 'aprobado' THEN 1 ELSE 0 END)`,
      noAprobados: sql<number>`SUM(CASE WHEN ${items.status} != 'aprobado' THEN 1 ELSE 0 END)`,
    })
    .from(items)
    .where(whereClause)
    .groupBy(items.empresaId);

  // Obtener nombres de empresas
  const empresaIds = result.map(r => r.empresaId).filter(Boolean);
  let empresasMap: Record<number, string> = {};
  if (empresaIds.length > 0) {
    const emps = await db.select({ id: empresas.id, nombre: empresas.nombre }).from(empresas).where(inArray(empresas.id, empresaIds as number[]));
    empresasMap = Object.fromEntries(emps.map(e => [e.id, e.nombre]));
  }

  return result.map(r => ({
    empresaId: r.empresaId,
    empresaNombre: empresasMap[r.empresaId!] || `Empresa ${r.empresaId}`,
    totalItems: Number(r.totalItems),
    aprobados: Number(r.aprobados || 0),
    noAprobados: Number(r.noAprobados || 0),
    penalizacionActiva: Number(r.noAprobados || 0) * PENALIZACION_POR_ITEM,
    penalizacionLiberada: Number(r.aprobados || 0) * PENALIZACION_POR_ITEM,
    montoPorItem: PENALIZACION_POR_ITEM,
  }));
}

export async function getPenalizacionItem(itemId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select({ status: items.status, empresaId: items.empresaId }).from(items).where(eq(items.id, itemId));
  if (!result.length) return null;

  const item = result[0];
  return {
    monto: PENALIZACION_POR_ITEM,
    activa: item.status !== 'aprobado',
    status: item.status,
  };
}

export function getMontoPenalizacion() {
  return PENALIZACION_POR_ITEM;
}

// ==================== NOTIFICACIONES ====================

export async function createNotificacion(data: InsertNotificacion) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(notificaciones).values(data);
  return result[0].insertId;
}

export async function getNotificacionesByUsuario(usuarioId: number, soloNoLeidas: boolean = false, proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(notificaciones.usuarioId, usuarioId)];
  if (soloNoLeidas) {
    conditions.push(eq(notificaciones.leida, false));
  }
  if (proyectoId) {
    conditions.push(eq(notificaciones.proyectoId, proyectoId));
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

export async function marcarTodasNotificacionesLeidas(usuarioId: number, proyectoId?: number) {
  const db = await getDb();
  if (!db) return;
  const conditions = [eq(notificaciones.usuarioId, usuarioId)];
  if (proyectoId) {
    conditions.push(eq(notificaciones.proyectoId, proyectoId));
  }
  await db.update(notificaciones).set({ leida: true }).where(and(...conditions));
}

export async function contarNotificacionesNoLeidas(usuarioId: number, proyectoId?: number) {
  const db = await getDb();
  if (!db) return 0;
  const conditions = [eq(notificaciones.usuarioId, usuarioId), eq(notificaciones.leida, false)];
  if (proyectoId) {
    conditions.push(eq(notificaciones.proyectoId, proyectoId));
  }
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notificaciones)
    .where(and(...conditions));
  return result[0]?.count || 0;
}

// Función para notificar a supervisores, admins y superadmins sobre ítems pendientes
// Incluye notificaciones in-app Y push notifications
export async function notificarSupervisores(itemId: number, titulo: string, mensaje: string) {
  const db = await getDb();
  if (!db) return;
  
  // Incluir superadmin, admin y supervisor
  const supervisores = await db
    .select()
    .from(users)
    .where(inArray(users.role, ['superadmin', 'admin', 'supervisor']));
  
  // Obtener info del ítem para push
  const itemInfo = await getItemInfoForPush(itemId);
  
  for (const supervisor of supervisores) {
    // Notificación in-app
    await createNotificacion({
      usuarioId: supervisor.id,
      itemId,
      tipo: 'item_pendiente_aprobacion',
      titulo,
      mensaje,
    });
    
    // Push notification
    const pushSubs = await getPushSubscriptionsByUsuario(supervisor.id);
    if (pushSubs.length > 0 && itemInfo) {
      const pushService = (await import('./pushService')).default;
      await pushService.sendPushToMultiple(pushSubs, {
        title: titulo,
        body: mensaje,
        itemCodigo: itemInfo.codigo,
        unidadNombre: itemInfo.unidadNombre,
        defectoNombre: itemInfo.defectoNombre,
        itemId,
        data: { url: `/items/${itemId}`, itemId, tipo: 'pendiente_aprobacion' }
      });
    }
  }
}

// Función para notificar a jefes de residente sobre ítems pendientes de foto
// Incluye notificaciones in-app Y push notifications
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
  
  // Obtener info del ítem para push
  const itemInfo = await getItemInfoForPush(itemId);
  
  for (const jefe of jefes) {
    // Notificación in-app
    await createNotificacion({
      usuarioId: jefe.id,
      itemId,
      tipo: 'item_pendiente_foto',
      titulo,
      mensaje,
    });
    
    // Push notification
    const pushSubs = await getPushSubscriptionsByUsuario(jefe.id);
    if (pushSubs.length > 0 && itemInfo) {
      const pushService = (await import('./pushService')).default;
      await pushService.sendPushToMultiple(pushSubs, {
        title: titulo,
        body: mensaje,
        itemCodigo: itemInfo.codigo,
        unidadNombre: itemInfo.unidadNombre,
        defectoNombre: itemInfo.defectoNombre,
        itemId,
        data: { url: `/items/${itemId}`, itemId, tipo: 'pendiente_foto' }
      });
    }
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

export async function getBitacoraByUsuario(usuarioId: number, limit = 100, proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(bitacora.usuarioId, usuarioId)];
  if (proyectoId) conditions.push(eq(bitacora.proyectoId, proyectoId));
  return await db
    .select()
    .from(bitacora)
    .where(and(...conditions))
    .orderBy(desc(bitacora.createdAt))
    .limit(limit);
}

export async function getBitacoraGeneral(filtros: {
  usuarioId?: number;
  accion?: string;
  entidad?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  proyectoId?: number;
} = {}, limit = 200) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filtros.usuarioId) conditions.push(eq(bitacora.usuarioId, filtros.usuarioId));
  if (filtros.accion) conditions.push(eq(bitacora.accion, filtros.accion));
  if (filtros.entidad) conditions.push(eq(bitacora.entidad, filtros.entidad));
  if (filtros.fechaDesde) conditions.push(gte(bitacora.createdAt, filtros.fechaDesde));
  if (filtros.fechaHasta) conditions.push(lte(bitacora.createdAt, filtros.fechaHasta));
  if (filtros.proyectoId) conditions.push(eq(bitacora.proyectoId, filtros.proyectoId));
  
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

// ==================== CÓDIGOS ALEATORIOS ====================

// Generar código aleatorio único para ítem (6 caracteres alfanuméricos)
// Permite trabajo simultáneo de múltiples revisores sin conflictos
function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generar código único para ítem (formato: PROYECTO-XXXXXX)
export async function getNextOQCCode(proyectoId?: number): Promise<string> {
  const db = await getDb();
  if (!db) return `OQC-${generateRandomCode()}`;
  
  // Si hay proyectoId, obtener el código del proyecto para el prefijo
  let prefix = 'OQC';
  if (proyectoId) {
    const proyecto = await db.select({ codigo: proyectos.codigo }).from(proyectos).where(eq(proyectos.id, proyectoId)).limit(1);
    if (proyecto.length > 0 && proyecto[0].codigo) {
      prefix = proyecto[0].codigo;
    }
  }
  
  // Generar código aleatorio y verificar que no exista
  let codigo: string;
  let intentos = 0;
  const maxIntentos = 10;
  
  do {
    codigo = `${prefix}-${generateRandomCode()}`;
    
    // Verificar si ya existe
    const existe = await db
      .select({ id: items.id })
      .from(items)
      .where(eq(items.codigo, codigo))
      .limit(1);
    
    if (existe.length === 0) {
      return codigo;
    }
    
    intentos++;
  } while (intentos < maxIntentos);
  
  // Si después de 10 intentos no se encontró uno único, agregar timestamp
  return `${prefix}-${generateRandomCode()}${Date.now().toString(36).slice(-3).toUpperCase()}`;
}
// ==================== PENDIENTES POR USUARIO ====================

export async function getPendientesByUsuario(userId: number, role: string, proyectoId?: number) {
  const cacheKey = `pendientes:${userId}:${role}:${proyectoId || 'all'}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;
  
  const db = await getDb();
  if (!db) return [];
  
  let baseCondition;
  
  if (role === 'superadmin' || role === 'admin') {
    // Admin ve todos los pendientes
    baseCondition = inArray(items.status, ['pendiente_foto_despues', 'pendiente_aprobacion']);
  } else if (role === 'supervisor') {
    // Supervisor ve pendientes de aprobación
    baseCondition = eq(items.status, 'pendiente_aprobacion');
  } else if (role === 'jefe_residente') {
    // Jefe de residente ve pendientes de foto después
    baseCondition = eq(items.status, 'pendiente_foto_despues');
  } else {
    // Residente ve sus propios ítems pendientes
    baseCondition = and(
      eq(items.residenteId, userId),
      inArray(items.status, ['pendiente_foto_despues', 'pendiente_aprobacion', 'rechazado'])
    );
  }
  
  // CRÍTICO: Filtrar por proyecto si se especifica - NUNCA mezclar proyectos
  const whereCondition = proyectoId 
    ? and(baseCondition, eq(items.proyectoId, proyectoId))
    : baseCondition;
  
  // Ordenar del más antiguo al más nuevo (ASC)
  // Incluir fotoAntes para mostrar miniatura en la lista
  // Obtener el residente de la ESPECIALIDAD (quien debe corregir), no quien creó el ítem
  
  const results = await db
    .select({
      id: items.id,
      codigo: items.codigo,
      numeroInterno: items.numeroInterno,
      titulo: items.titulo,
      status: items.status,
      ubicacion: items.ubicacionDetalle,
      fechaCreacion: items.fechaCreacion,
      fotoAntesUrl: items.fotoAntesUrl,
      fotoAntesMarcadaUrl: items.fotoAntesMarcadaUrl,
      fotoDespuesUrl: items.fotoDespuesUrl,
      comentarioResidente: items.comentarioResidente,
      comentarioSupervisor: items.comentarioSupervisor,
      residenteId: items.residenteId,
      residenteNombre: users.name,
      // Datos de la especialidad
      especialidadId: items.especialidadId,
      especialidadResidenteId: especialidades.residenteId,
      // Fechas de trazabilidad
      fechaFotoDespues: items.fechaFotoDespues,
      fechaAprobacion: items.fechaAprobacion,
      fechaCierre: items.fechaCierre,
      // IDs de trazabilidad
      creadoPorId: items.creadoPorId,
      asignadoAId: items.asignadoAId,
      aprobadoPorId: items.aprobadoPorId,
      cerradoPorId: items.cerradoPorId,
      // Pin en plano
      pinPlanoId: items.pinPlanoId,
    })
    .from(items)
    .leftJoin(users, eq(items.residenteId, users.id))
    .leftJoin(especialidades, eq(items.especialidadId, especialidades.id))
    .where(whereCondition)
    .orderBy(items.fechaCreacion); // ASC = más antiguo primero
  
  // Obtener nombres de residentes de especialidades y usuarios de trazabilidad en una segunda consulta
  const especialidadResidenteIds = Array.from(new Set(results.map(r => r.especialidadResidenteId).filter((id): id is number => id !== null)));
  
  // Recopilar todos los IDs de usuarios de trazabilidad
  const trazabilidadIds = Array.from(new Set([
    ...results.map(r => r.creadoPorId).filter((id): id is number => id !== null),
    ...results.map(r => r.asignadoAId).filter((id): id is number => id !== null),
    ...results.map(r => r.aprobadoPorId).filter((id): id is number => id !== null),
    ...results.map(r => r.cerradoPorId).filter((id): id is number => id !== null),
    ...especialidadResidenteIds,
  ]));
  
  let usuariosMap: Record<number, string> = {};
  
  if (trazabilidadIds.length > 0) {
    const usuariosData = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, trazabilidadIds as number[]));
    
    usuariosData.forEach(r => {
      if (r.id && r.name) usuariosMap[r.id] = r.name;
    });
  }
  
  // Agregar nombres de trazabilidad a cada resultado
  const finalResults = results.map(r => ({
    ...r,
    especialidadResidenteNombre: r.especialidadResidenteId ? usuariosMap[r.especialidadResidenteId] || null : null,
    creadoPorNombre: r.creadoPorId ? usuariosMap[r.creadoPorId] || null : null,
    asignadoANombre: r.asignadoAId ? usuariosMap[r.asignadoAId] || null : null,
    aprobadoPorNombre: r.aprobadoPorId ? usuariosMap[r.aprobadoPorId] || null : null,
    cerradoPorNombre: r.cerradoPorId ? usuariosMap[r.cerradoPorId] || null : null,
  }));
  setCache(cacheKey, finalResults, 30_000); // 30s cache for pendientes
  return finalResults;
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

export async function getAllMetas(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(metas.activo, true)];
  if (proyectoId) conditions.push(eq(metas.proyectoId, proyectoId));
  return await db.select().from(metas).where(and(...conditions)).orderBy(desc(metas.createdAt));
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

export async function getMetasConProgreso(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const metaConditions = [eq(metas.activo, true)];
  if (proyectoId) metaConditions.push(eq(metas.proyectoId, proyectoId));
  const metasActivas = await db.select().from(metas).where(and(...metaConditions));
  
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

export async function getAllDefectos(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(defectos.activo, true)];
  if (proyectoId) conditions.push(eq(defectos.proyectoId, proyectoId));
  return await db.select().from(defectos).where(and(...conditions)).orderBy(defectos.nombre);
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
export async function getDefectosConEstadisticas(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const defConditions = [eq(defectos.activo, true)];
  if (proyectoId) defConditions.push(eq(defectos.proyectoId, proyectoId));
  const todosDefectos = await db.select().from(defectos).where(and(...defConditions)).orderBy(defectos.nombre);
  
  const itemConditions = [];
  if (proyectoId) itemConditions.push(eq(items.proyectoId, proyectoId));
  const todosItems = itemConditions.length > 0 
    ? await db.select(itemFieldsWithoutBase64).from(items).where(and(...itemConditions))
    : await db.select(itemFieldsWithoutBase64).from(items);
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
  if (filters.proyectoId) conditions.push(eq(items.proyectoId, filters.proyectoId));
  if (filters.empresaId) conditions.push(eq(items.empresaId, filters.empresaId));
  if (filters.unidadId) conditions.push(eq(items.unidadId, filters.unidadId));
  if (filters.especialidadId) conditions.push(eq(items.especialidadId, filters.especialidadId));
  if (filters.fechaDesde) conditions.push(gte(items.fechaCreacion, filters.fechaDesde));
  if (filters.fechaHasta) conditions.push(lte(items.fechaCreacion, filters.fechaHasta));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Obtener todos los items con filtros
  const itemsFiltrados = await db.select(itemFieldsWithoutBase64).from(items).where(whereClause);
  
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
  const itemsResult = await db.select(itemFieldsWithoutBase64).from(items).where(whereClause).orderBy(desc(items.fechaCreacion));
  
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
  
  return itemsResult.map(item => {
    // Obtener nombres de trazabilidad
    const creadoPor = item.creadoPorId ? usuariosMap.get(item.creadoPorId) : null;
    const asignadoA = item.asignadoAId ? usuariosMap.get(item.asignadoAId) : null;
    const aprobadoPor = item.aprobadoPorId ? usuariosMap.get(item.aprobadoPorId) : null;
    const cerradoPor = item.cerradoPorId ? usuariosMap.get(item.cerradoPorId) : null;
    
    return {
      ...item,
      empresa: empresasMap.get(item.empresaId),
      unidad: unidadesMap.get(item.unidadId),
      especialidad: item.especialidadId ? especialidadesMap.get(item.especialidadId) : null,
      atributo: item.atributoId ? atributosMap.get(item.atributoId) : null,
      defecto: item.defectoId ? defectosMap.get(item.defectoId) : null,
      residente: usuariosMap.get(item.residenteId),
      jefeResidente: item.jefeResidenteId ? usuariosMap.get(item.jefeResidenteId) : null,
      supervisor: item.supervisorId ? usuariosMap.get(item.supervisorId) : null,
      // Campos de trazabilidad con nombres
      creadoPorNombre: creadoPor?.name || null,
      asignadoANombre: asignadoA?.name || null,
      aprobadoPorNombre: aprobadoPor?.name || null,
      cerradoPorNombre: cerradoPor?.name || null,
    };
  });
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
  const itemsProyecto = await db.select(itemFieldsWithoutBase64).from(items).where(eq(items.proyectoId, id));
  
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
  const todosItems = await db.select(itemFieldsWithoutBase64).from(items);
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

// Obtener usuarios que no están asignados a ningún proyecto (disponibles para asignar)
export async function getUsuariosSinProyecto() {
  const db = await getDb();
  if (!db) return [];
  
  // Obtener todos los usuarios que tienen al menos una asignación activa
  const usuariosConProyecto = await db.select({ usuarioId: proyectoUsuarios.usuarioId })
    .from(proyectoUsuarios)
    .where(eq(proyectoUsuarios.activo, true));
  
  const idsConProyecto = usuariosConProyecto.map(u => u.usuarioId);
  
  // Obtener usuarios que NO están en esa lista
  if (idsConProyecto.length === 0) {
    return await db.select().from(users).where(eq(users.activo, true)).orderBy(users.name);
  }
  
  return await db.select().from(users)
    .where(and(
      eq(users.activo, true),
      notInArray(users.id, idsConProyecto)
    ))
    .orderBy(users.name);
}

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

// Para superadmin/admin: todos los proyectos con el mismo formato que misProyectos
export async function getAllProyectosEnriquecidos() {
  const cacheKey = 'allProyectosEnriquecidos';
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;
  
  const db = await getDb();
  if (!db) return [];
  
  const todosProyectos = await db.select().from(proyectos).where(eq(proyectos.activo, true)).orderBy(proyectos.nombre);
  if (todosProyectos.length === 0) return [];
  
  const proyectoIds = todosProyectos.map(p => p.id);
  
  const unidadesStats = await db.select({
    proyectoId: unidades.proyectoId,
    count: sql<number>`count(*)`
  }).from(unidades)
    .where(inArray(unidades.proyectoId, proyectoIds))
    .groupBy(unidades.proyectoId);
  
  const itemsStats = await db.select({
    proyectoId: items.proyectoId,
    count: sql<number>`count(*)`
  }).from(items)
    .where(inArray(items.proyectoId, proyectoIds))
    .groupBy(items.proyectoId);
  
  const pendientesStats = await db.select({
    proyectoId: items.proyectoId,
    count: sql<number>`count(*)`
  }).from(items)
    .where(and(
      inArray(items.proyectoId, proyectoIds),
      inArray(items.status, ['pendiente_foto_despues', 'rechazado', 'pendiente_aprobacion'])
    ))
    .groupBy(items.proyectoId);
  
  const unidadesMap = new Map(unidadesStats.map(u => [u.proyectoId, Number(u.count)]));
  const itemsMap = new Map(itemsStats.map(i => [i.proyectoId, Number(i.count)]));
  const pendientesMap = new Map(pendientesStats.map(p => [p.proyectoId, Number(p.count)]));
  
  const result = todosProyectos.map(proyecto => ({
    proyectoId: proyecto.id,
    usuarioId: 0,
    rolEnProyecto: 'admin' as const,
    activo: true,
    proyecto,
    empresaNombre: proyecto.cliente || null,
    totalUnidades: unidadesMap.get(proyecto.id) || 0,
    totalItems: itemsMap.get(proyecto.id) || 0,
    itemsPendientes: pendientesMap.get(proyecto.id) || 0,
  }));
  setCache(cacheKey, result, 2 * 60_000); // 2 min cache
  return result;
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
  
  // UNA sola query para contar unidades de todos los proyectos
  const unidadesStats = await db.select({
    proyectoId: unidades.proyectoId,
    count: sql<number>`count(*)`
  }).from(unidades)
    .where(inArray(unidades.proyectoId, proyectoIds))
    .groupBy(unidades.proyectoId);
  
  // UNA sola query para contar items totales de todos los proyectos
  const itemsStats = await db.select({
    proyectoId: items.proyectoId,
    count: sql<number>`count(*)`
  }).from(items)
    .where(inArray(items.proyectoId, proyectoIds))
    .groupBy(items.proyectoId);
  
  // UNA sola query para contar items pendientes de todos los proyectos
  const pendientesStats = await db.select({
    proyectoId: items.proyectoId,
    count: sql<number>`count(*)`
  }).from(items)
    .where(and(
      inArray(items.proyectoId, proyectoIds),
      inArray(items.status, ['pendiente_foto_despues', 'rechazado', 'pendiente_aprobacion'])
    ))
    .groupBy(items.proyectoId);
  
  // Mapear a lookup rápido
  const unidadesMap = new Map(unidadesStats.map(u => [u.proyectoId, Number(u.count)]));
  const itemsMap = new Map(itemsStats.map(i => [i.proyectoId, Number(i.count)]));
  const pendientesMap = new Map(pendientesStats.map(p => [p.proyectoId, Number(p.count)]));
  
  return relaciones.map(rel => {
    const proyecto = todosProyectos.find(p => p.id === rel.proyectoId);
    return {
      ...rel,
      proyecto,
      empresaNombre: proyecto?.cliente || null,
      totalUnidades: unidadesMap.get(rel.proyectoId) || 0,
      totalItems: itemsMap.get(rel.proyectoId) || 0,
      itemsPendientes: pendientesMap.get(rel.proyectoId) || 0,
    };
  });
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
  const result = await db.select().from(unidades)
    .where(and(eq(unidades.proyectoId, proyectoId), eq(unidades.activo, true)));
  // Ordenar numéricamente por nombre
  return naturalSort(result, u => u.nombre);
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
  return await db.select(itemFieldsWithoutBase64).from(items)
    .where(eq(items.proyectoId, proyectoId))
    .orderBy(desc(items.fechaCreacion));
}

export async function getItemByClientId(clientId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select(itemFieldsWithoutBase64).from(items)
    .where(eq(items.clientId, clientId))
    .limit(1);
  return result[0] || null;
}


// ==================== PINS POR PLANO ====================
export async function getPinsByPlano(planoId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    id: items.id,
    codigo: items.codigo,
    descripcion: items.descripcion,
    status: items.status,
    pinPosX: items.pinPosX,
    pinPosY: items.pinPosY,
    numeroInterno: items.numeroInterno,
    residenteNombre: users.name,
  }).from(items)
    .leftJoin(users, eq(items.residenteId, users.id))
    .where(and(
      eq(items.pinPlanoId, planoId),
      isNotNull(items.pinPosX),
      isNotNull(items.pinPosY)
    ))
    .orderBy(items.id);
  return result;
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
  
  // Obtener el usuario para saber su proyecto activo
  const usuario = await db.select().from(users)
    .where(eq(users.id, usuarioId))
    .limit(1);
  
  if (usuario.length === 0) {
    return { usuarioId, rechazados: 0, aprobadosJefe: 0, aprobadosSupervisor: 0, mensajesNoLeidos: 0 };
  }
  
  const proyectoActivoId = usuario[0].proyectoActivoId;
  
  // Calcular conteos en tiempo real basados en ítems del proyecto activo
  let rechazados = 0;
  let aprobadosJefe = 0;
  let aprobadosSupervisor = 0;
  
  if (proyectoActivoId) {
    // Contar ítems rechazados del proyecto activo
    const rechazadosResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(items)
      .where(and(
        eq(items.proyectoId, proyectoActivoId),
        eq(items.status, 'rechazado')
      ));
    rechazados = Number(rechazadosResult[0]?.count || 0);
    
    // Contar ítems aprobados del proyecto activo
    const aprobadosResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(items)
      .where(and(
        eq(items.proyectoId, proyectoActivoId),
        eq(items.status, 'aprobado')
      ));
    aprobadosJefe = Number(aprobadosResult[0]?.count || 0);
    
    // OK Supervisor = ítems aprobados (mismo conteo por ahora)
    aprobadosSupervisor = aprobadosJefe;
  }
  
  // Obtener mensajes no leídos del registro de badges (este sí se mantiene como contador)
  const badgesRecord = await db.select().from(userBadges)
    .where(eq(userBadges.usuarioId, usuarioId))
    .limit(1);
  
  const mensajesNoLeidos = badgesRecord.length > 0 ? badgesRecord[0].mensajesNoLeidos : 0;
  
  return { 
    usuarioId, 
    rechazados, 
    aprobadosJefe, 
    aprobadosSupervisor, 
    mensajesNoLeidos 
  };
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

export async function getEstadisticasRendimientoUsuarios(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Obtener todos los usuarios activos
  const usuariosData = await db.select().from(users)
    .where(eq(users.activo, true));
  
  // Filtrar items por proyecto si se especifica
  const conditions = [];
  if (proyectoId) {
    conditions.push(eq(items.proyectoId, proyectoId));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Obtener items filtrados por proyecto
  const itemsData = await db.select(itemFieldsWithoutBase64).from(items).where(whereClause);
  
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

export async function getEstadisticasSupervisores(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Obtener supervisores
  const supervisores = await db.select().from(users)
    .where(and(
      eq(users.activo, true),
      inArray(users.role, ['supervisor', 'admin', 'superadmin'])
    ));
  
  // Filtrar items aprobados por proyecto si se especifica
  const conditions = [eq(items.status, 'aprobado')];
  if (proyectoId) {
    conditions.push(eq(items.proyectoId, proyectoId));
  }
  const itemsData = await db.select(itemFieldsWithoutBase64).from(items)
    .where(and(...conditions));
  
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

export async function getDefectosPorUsuario(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Filtrar items con defectos por proyecto si se especifica
  const conditions = [sql`${items.defectoId} IS NOT NULL`];
  if (proyectoId) {
    conditions.push(eq(items.proyectoId, proyectoId));
  }
  const itemsData = await db.select(itemFieldsWithoutBase64).from(items)
    .where(and(...conditions));
  
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


// ==================== PUSH SUBSCRIPTIONS ====================

export async function savePushSubscription(data: InsertPushSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verificar si ya existe una suscripción con el mismo endpoint
  const existing = await db.select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, data.endpoint))
    .limit(1);
  
  if (existing.length > 0) {
    // Actualizar si existe
    await db.update(pushSubscriptions)
      .set({ usuarioId: data.usuarioId, p256dh: data.p256dh, auth: data.auth, activo: true })
      .where(eq(pushSubscriptions.id, existing[0].id));
    return existing[0].id;
  }
  
  const result = await db.insert(pushSubscriptions).values(data);
  return result[0].insertId;
}

export async function getPushSubscriptionsByUsuario(usuarioId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.usuarioId, usuarioId), eq(pushSubscriptions.activo, true)));
}

export async function getPushSubscriptionsByUsuarios(usuarioIds: number[]) {
  const db = await getDb();
  if (!db || usuarioIds.length === 0) return [];
  return await db.select()
    .from(pushSubscriptions)
    .where(and(inArray(pushSubscriptions.usuarioId, usuarioIds), eq(pushSubscriptions.activo, true)));
}

export async function deletePushSubscription(endpoint: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(pushSubscriptions)
    .set({ activo: false })
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function getAllActivePushSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.activo, true));
}


// ==================== PROYECTO ACTIVO DEL USUARIO ====================

export async function getProyectoActivoUsuario(userId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select({ proyectoActivoId: users.proyectoActivoId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return result[0]?.proyectoActivoId || null;
}

export async function setProyectoActivoUsuario(userId: number, proyectoId: number | null): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db
    .update(users)
    .set({ proyectoActivoId: proyectoId })
    .where(eq(users.id, userId));
  
  return true;
}


// ==================== EMPRESA-ESPECIALIDADES ====================

export async function getEspecialidadesPorEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: especialidades.id,
      nombre: especialidades.nombre,
      codigo: especialidades.codigo,
      color: especialidades.color,
    })
    .from(empresaEspecialidades)
    .innerJoin(especialidades, eq(empresaEspecialidades.especialidadId, especialidades.id))
    .where(eq(empresaEspecialidades.empresaId, empresaId));
  
  return result;
}

export async function asignarEspecialidadesAEmpresa(empresaId: number, especialidadIds: number[]) {
  const db = await getDb();
  if (!db) return;
  
  // Eliminar asignaciones anteriores
  await db.delete(empresaEspecialidades).where(eq(empresaEspecialidades.empresaId, empresaId));
  
  // Insertar nuevas asignaciones
  if (especialidadIds.length > 0) {
    const inserts = especialidadIds.map(especialidadId => ({
      empresaId,
      especialidadId,
    }));
    await db.insert(empresaEspecialidades).values(inserts);
  }
}

// Eliminar un ítem y todos sus datos relacionados (eliminación en cascada)
export async function deleteItem(itemId: number) {
  const db = await getDb();
  if (!db) return;
  
  // Obtener el código del ítem para buscar en bitácora
  const item = await db.select({ codigo: items.codigo }).from(items).where(eq(items.id, itemId)).limit(1);
  const itemCodigo = item[0]?.codigo;
  
  // Eliminar historial relacionado
  await db.delete(itemHistorial).where(eq(itemHistorial.itemId, itemId));
  
  // Eliminar notificaciones relacionadas con este ítem
  await db.delete(notificaciones).where(eq(notificaciones.itemId, itemId));
  
  // Eliminar comentarios relacionados
  await db.delete(comentarios).where(eq(comentarios.itemId, itemId));
  
  // Eliminar entradas de bitácora relacionadas con este ítem
  // La tabla bitacora usa entidad='item' y entidadId para referenciar ítems
  // También buscamos por código en detalles si existe
  if (itemCodigo) {
    await db.delete(bitacora).where(
      or(
        and(
          eq(bitacora.entidad, 'item'),
          eq(bitacora.entidadId, itemId)
        ),
        like(bitacora.detalles, `%${itemCodigo}%`)
      )
    );
  } else {
    await db.delete(bitacora).where(
      and(
        eq(bitacora.entidad, 'item'),
        eq(bitacora.entidadId, itemId)
      )
    );
  }
  
  // Finalmente eliminar el ítem
  await db.delete(items).where(eq(items.id, itemId));
}


// ==================== PRELLENADO ULTRA-RÁPIDO ====================

// Obtener todos los datos necesarios para prellenar formularios del usuario
export async function getDatosPrellenaUsuario(userId: number, proyectoId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Obtener usuario con su empresa
  const usuario = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!usuario[0]) return null;
  
  // Obtener empresa del usuario
  let empresa = null;
  let especialidadesEmpresa: any[] = [];
  if (usuario[0].empresaId) {
    const empresaResult = await db.select().from(empresas).where(eq(empresas.id, usuario[0].empresaId)).limit(1);
    empresa = empresaResult[0] || null;
    
    // Obtener especialidades de la empresa
    if (empresa) {
      especialidadesEmpresa = await db
        .select({
          id: especialidades.id,
          nombre: especialidades.nombre,
          codigo: especialidades.codigo,
          color: especialidades.color,
        })
        .from(empresaEspecialidades)
        .innerJoin(especialidades, eq(empresaEspecialidades.especialidadId, especialidades.id))
        .where(eq(empresaEspecialidades.empresaId, empresa.id));
    }
  }
  
  // Obtener unidades del proyecto (si hay proyecto seleccionado)
  let unidadesProyecto: any[] = [];
  if (proyectoId) {
    unidadesProyecto = await db.select().from(unidades)
      .where(and(eq(unidades.proyectoId, proyectoId), eq(unidades.activo, true)))
      .orderBy(unidades.nombre);
  }
  
  // Obtener defectos más frecuentes del usuario (top 5)
  const itemsUsuario = await db.select(itemFieldsWithoutBase64).from(items)
    .where(eq(items.residenteId, userId))
    .orderBy(desc(items.fechaCreacion))
    .limit(100);
  
  const defectosFrecuentes = itemsUsuario
    .filter(i => i.defectoId)
    .reduce((acc, item) => {
      acc[item.defectoId!] = (acc[item.defectoId!] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
  
  const topDefectoIds = Object.entries(defectosFrecuentes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => parseInt(id));
  
  let defectosTop: any[] = [];
  if (topDefectoIds.length > 0) {
    defectosTop = await db.select().from(defectos).where(inArray(defectos.id, topDefectoIds));
  }
  
  return {
    usuario: {
      id: usuario[0].id,
      name: usuario[0].name,
      role: usuario[0].role,
      empresaId: usuario[0].empresaId,
    },
    empresa,
    especialidadesEmpresa,
    unidadesProyecto,
    defectosFrecuentes: defectosTop,
  };
}

// Obtener ítems críticos priorizados (de peor a mejor)
export async function getItemsCriticosPriorizados(proyectoId?: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    inArray(items.status, ['pendiente_foto_despues', 'pendiente_aprobacion'])
  ];
  if (proyectoId) {
    conditions.push(eq(items.proyectoId, proyectoId));
  }
  
  // Obtener ítems pendientes
  const itemsPendientes = await db.select(itemFieldsWithoutBase64).from(items)
    .where(and(...conditions))
    .orderBy(asc(items.fechaCreacion)); // Más antiguos primero
  
  // Obtener defectos para conocer severidad
  const todosDefectos = await db.select().from(defectos);
  const defectosMap = new Map(todosDefectos.map(d => [d.id, d]));
  
  // Obtener datos relacionados
  const todasEmpresas = await db.select().from(empresas);
  const todasUnidades = await db.select().from(unidades);
  const todosUsuarios = await db.select().from(users);
  const todasEspecialidades = await db.select().from(especialidades);
  
  const empresasMap = new Map(todasEmpresas.map(e => [e.id, e]));
  const unidadesMap = new Map(todasUnidades.map(u => [u.id, u]));
  const usuariosMap = new Map(todosUsuarios.map(u => [u.id, u]));
  const especialidadesMap = new Map(todasEspecialidades.map(e => [e.id, e]));
  
  // Calcular prioridad: severidad + antigüedad
  const severidadPeso: Record<string, number> = {
    'critico': 100,
    'grave': 75,
    'moderado': 50,
    'leve': 25
  };
  
  const ahora = new Date();
  const itemsConPrioridad = itemsPendientes.map(item => {
    const defecto = item.defectoId ? defectosMap.get(item.defectoId) : null;
    const severidad = defecto?.severidad || 'moderado';
    const diasPendiente = Math.floor((ahora.getTime() - new Date(item.fechaCreacion).getTime()) / (1000 * 60 * 60 * 24));
    
    // Prioridad = peso severidad + días pendiente (máx 30 días = 30 puntos extra)
    const prioridad = severidadPeso[severidad] + Math.min(diasPendiente, 30);
    
    return {
      ...item,
      defecto,
      empresa: empresasMap.get(item.empresaId),
      unidad: unidadesMap.get(item.unidadId),
      especialidad: item.especialidadId ? especialidadesMap.get(item.especialidadId) : null,
      residente: usuariosMap.get(item.residenteId),
      diasPendiente,
      severidad,
      prioridad,
    };
  });
  
  // Ordenar por prioridad descendente (más críticos primero)
  return itemsConPrioridad
    .sort((a, b) => b.prioridad - a.prioridad)
    .slice(0, limit);
}

// Obtener dashboard del residente con tareas pendientes
export async function getDashboardResidente(userId: number, proyectoId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  const conditions = [eq(items.residenteId, userId)];
  if (proyectoId) {
    conditions.push(eq(items.proyectoId, proyectoId));
  }
  
  // Obtener todos los ítems del residente
  const itemsResidente = await db.select(itemFieldsWithoutBase64).from(items)
    .where(and(...conditions))
    .orderBy(asc(items.fechaCreacion));
  
  // Obtener datos relacionados
  const todasEmpresas = await db.select().from(empresas);
  const todasUnidades = await db.select().from(unidades);
  const todosDefectos = await db.select().from(defectos);
  
  const empresasMap = new Map(todasEmpresas.map(e => [e.id, e]));
  const unidadesMap = new Map(todasUnidades.map(u => [u.id, u]));
  const defectosMap = new Map(todosDefectos.map(d => [d.id, d]));
  
  const ahora = new Date();
  
  // Clasificar ítems
  const pendientesFoto = itemsResidente
    .filter(i => i.status === 'pendiente_foto_despues')
    .map(item => {
      const diasPendiente = Math.floor((ahora.getTime() - new Date(item.fechaCreacion).getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...item,
        empresa: empresasMap.get(item.empresaId),
        unidad: unidadesMap.get(item.unidadId),
        defecto: item.defectoId ? defectosMap.get(item.defectoId) : null,
        diasPendiente,
        urgencia: diasPendiente > 7 ? 'critico' : diasPendiente > 3 ? 'alto' : 'normal',
      };
    });
  
  const pendientesAprobacion = itemsResidente
    .filter(i => i.status === 'pendiente_aprobacion')
    .map(item => ({
      ...item,
      empresa: empresasMap.get(item.empresaId),
      unidad: unidadesMap.get(item.unidadId),
      defecto: item.defectoId ? defectosMap.get(item.defectoId) : null,
    }));
  
  const aprobados = itemsResidente.filter(i => i.status === 'aprobado').length;
  const rechazados = itemsResidente.filter(i => i.status === 'rechazado').length;
  
  return {
    pendientesFoto,
    pendientesAprobacion,
    estadisticas: {
      total: itemsResidente.length,
      pendientesFoto: pendientesFoto.length,
      pendientesAprobacion: pendientesAprobacion.length,
      aprobados,
      rechazados,
      tasaAprobacion: itemsResidente.length > 0 ? Math.round((aprobados / itemsResidente.length) * 100) : 0,
    },
    urgentes: pendientesFoto.filter(i => i.urgencia === 'critico').length,
  };
}

// Top 5 peores (empresas, residentes, especialidades con más problemas)
export async function getTop5Peores(proyectoId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  const conditions = [];
  if (proyectoId) {
    conditions.push(eq(items.proyectoId, proyectoId));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const todosItems = await db.select(itemFieldsWithoutBase64).from(items).where(whereClause);
  
  // Obtener datos relacionados
  const todasEmpresas = await db.select().from(empresas);
  const todosUsuarios = await db.select().from(users);
  const todasEspecialidades = await db.select().from(especialidades);
  const todosDefectos = await db.select().from(defectos);
  
  const empresasMap = new Map(todasEmpresas.map(e => [e.id, e]));
  const usuariosMap = new Map(todosUsuarios.map(u => [u.id, u]));
  const especialidadesMap = new Map(todasEspecialidades.map(e => [e.id, e]));
  const defectosMap = new Map(todosDefectos.map(d => [d.id, d]));
  
  // Severidad de defectos
  const severidadPeso: Record<string, number> = {
    'critico': 4,
    'grave': 3,
    'moderado': 2,
    'leve': 1
  };
  
  // Top 5 empresas con más problemas (ponderado por severidad)
  const empresasProblemas = todasEmpresas.map(empresa => {
    const itemsEmpresa = todosItems.filter(i => i.empresaId === empresa.id);
    const pendientes = itemsEmpresa.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion');
    const rechazados = itemsEmpresa.filter(i => i.status === 'rechazado');
    
    // Calcular score de problemas
    let scoreProblemas = pendientes.length + (rechazados.length * 2);
    pendientes.forEach(item => {
      if (item.defectoId) {
        const defecto = defectosMap.get(item.defectoId);
        if (defecto) {
          scoreProblemas += severidadPeso[defecto.severidad] || 2;
        }
      }
    });
    
    return {
      id: empresa.id,
      nombre: empresa.nombre,
      pendientes: pendientes.length,
      rechazados: rechazados.length,
      total: itemsEmpresa.length,
      scoreProblemas,
    };
  }).filter(e => e.scoreProblemas > 0).sort((a, b) => b.scoreProblemas - a.scoreProblemas).slice(0, 5);
  
  // Top 5 residentes con más pendientes
  const residentes = todosUsuarios.filter(u => u.role === 'residente' || u.role === 'jefe_residente');
  const residentesProblemas = residentes.map(residente => {
    const itemsResidente = todosItems.filter(i => i.residenteId === residente.id);
    const pendientes = itemsResidente.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion');
    const rechazados = itemsResidente.filter(i => i.status === 'rechazado');
    
    return {
      id: residente.id,
      nombre: residente.name,
      empresa: residente.empresaId ? empresasMap.get(residente.empresaId)?.nombre : null,
      pendientes: pendientes.length,
      rechazados: rechazados.length,
      total: itemsResidente.length,
      scoreProblemas: pendientes.length + (rechazados.length * 2),
    };
  }).filter(r => r.scoreProblemas > 0).sort((a, b) => b.scoreProblemas - a.scoreProblemas).slice(0, 5);
  
  // Top 5 especialidades más problemáticas
  const especialidadesProblemas = todasEspecialidades.map(esp => {
    const itemsEsp = todosItems.filter(i => i.especialidadId === esp.id);
    const pendientes = itemsEsp.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion');
    const rechazados = itemsEsp.filter(i => i.status === 'rechazado');
    
    return {
      id: esp.id,
      nombre: esp.nombre,
      color: esp.color,
      pendientes: pendientes.length,
      rechazados: rechazados.length,
      total: itemsEsp.length,
      scoreProblemas: pendientes.length + (rechazados.length * 2),
    };
  }).filter(e => e.scoreProblemas > 0).sort((a, b) => b.scoreProblemas - a.scoreProblemas).slice(0, 5);
  
  return {
    empresas: empresasProblemas,
    residentes: residentesProblemas,
    especialidades: especialidadesProblemas,
  };
}


// ==================== ESTADÍSTICAS COMPLETAS ====================

// Estadísticas completas por usuario
export async function getEstadisticasUsuario(usuarioId: number, proyectoId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  const usuario = await db.select().from(users).where(eq(users.id, usuarioId)).limit(1);
  if (usuario.length === 0) return null;
  
  const conditions = [eq(items.residenteId, usuarioId)];
  if (proyectoId) {
    conditions.push(eq(items.proyectoId, proyectoId));
  }
  
  const itemsUsuario = await db.select(itemFieldsWithoutBase64).from(items).where(and(...conditions));
  
  // Estadísticas básicas
  const total = itemsUsuario.length;
  const pendientesFoto = itemsUsuario.filter(i => i.status === 'pendiente_foto_despues').length;
  const pendientesAprobacion = itemsUsuario.filter(i => i.status === 'pendiente_aprobacion').length;
  const aprobados = itemsUsuario.filter(i => i.status === 'aprobado').length;
  const rechazados = itemsUsuario.filter(i => i.status === 'rechazado').length;
  
  // Tiempo promedio de resolución
  const itemsResueltos = itemsUsuario.filter(i => i.status === 'aprobado' && i.fechaAprobacion);
  let tiempoPromedioResolucion = 0;
  if (itemsResueltos.length > 0) {
    const tiempos = itemsResueltos.map(i => {
      const inicio = new Date(i.fechaCreacion).getTime();
      const fin = new Date(i.fechaAprobacion!).getTime();
      return (fin - inicio) / (1000 * 60 * 60 * 24); // días
    });
    tiempoPromedioResolucion = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
  }
  
  // Tasa de aprobación
  const totalFinalizados = aprobados + rechazados;
  const tasaAprobacion = totalFinalizados > 0 ? (aprobados / totalFinalizados) * 100 : 0;
  
  // Defectos más frecuentes del usuario
  const defectosCount: Record<number, number> = {};
  itemsUsuario.forEach(item => {
    if (item.defectoId) {
      defectosCount[item.defectoId] = (defectosCount[item.defectoId] || 0) + 1;
    }
  });
  
  const todosDefectos = await db.select().from(defectos);
  const defectosMap = new Map(todosDefectos.map(d => [d.id, d]));
  
  const defectosFrecuentes = Object.entries(defectosCount)
    .map(([id, count]) => ({
      defecto: defectosMap.get(parseInt(id)),
      count,
    }))
    .filter(d => d.defecto)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // Mensajes enviados
  const mensajesUsuario = await db.select().from(mensajes).where(eq(mensajes.usuarioId, usuarioId));
  const totalMensajes = mensajesUsuario.length;
  
  // Menciones recibidas
  const todosMensajes = await db.select().from(mensajes);
  const mencionesRecibidas = todosMensajes.filter(m => {
    if (!m.menciones) return false;
    try {
      const menciones = JSON.parse(m.menciones);
      return menciones.includes(usuarioId);
    } catch {
      return false;
    }
  }).length;
  
  return {
    usuario: usuario[0],
    estadisticas: {
      total,
      pendientesFoto,
      pendientesAprobacion,
      aprobados,
      rechazados,
      tasaAprobacion: Math.round(tasaAprobacion * 10) / 10,
      tiempoPromedioResolucion: Math.round(tiempoPromedioResolucion * 10) / 10,
    },
    defectosFrecuentes,
    mensajeria: {
      mensajesEnviados: totalMensajes,
      mencionesRecibidas,
    },
  };
}

// Estadísticas completas por defecto
export async function getEstadisticasDefecto(defectoId: number, proyectoId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  const defecto = await db.select().from(defectos).where(eq(defectos.id, defectoId)).limit(1);
  if (defecto.length === 0) return null;
  
  const conditions = [eq(items.defectoId, defectoId)];
  if (proyectoId) {
    conditions.push(eq(items.proyectoId, proyectoId));
  }
  
  const itemsDefecto = await db.select(itemFieldsWithoutBase64).from(items).where(and(...conditions));
  
  // Estadísticas básicas
  const total = itemsDefecto.length;
  const pendientes = itemsDefecto.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
  const aprobados = itemsDefecto.filter(i => i.status === 'aprobado').length;
  const rechazados = itemsDefecto.filter(i => i.status === 'rechazado').length;
  
  // Tiempo promedio de corrección
  const itemsResueltos = itemsDefecto.filter(i => i.status === 'aprobado' && i.fechaAprobacion);
  let tiempoPromedioCorreccion = 0;
  if (itemsResueltos.length > 0) {
    const tiempos = itemsResueltos.map(i => {
      const inicio = new Date(i.fechaCreacion).getTime();
      const fin = new Date(i.fechaAprobacion!).getTime();
      return (fin - inicio) / (1000 * 60 * 60 * 24); // días
    });
    tiempoPromedioCorreccion = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
  }
  
  // Empresas más afectadas
  const empresasCount: Record<number, number> = {};
  itemsDefecto.forEach(item => {
    if (item.empresaId) {
      empresasCount[item.empresaId] = (empresasCount[item.empresaId] || 0) + 1;
    }
  });
  
  const todasEmpresas = await db.select().from(empresas);
  const empresasMap = new Map(todasEmpresas.map(e => [e.id, e]));
  
  const empresasAfectadas = Object.entries(empresasCount)
    .map(([id, count]) => ({
      empresa: empresasMap.get(parseInt(id)),
      count,
    }))
    .filter(e => e.empresa)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // Unidades más afectadas
  const unidadesCount: Record<number, number> = {};
  itemsDefecto.forEach(item => {
    if (item.unidadId) {
      unidadesCount[item.unidadId] = (unidadesCount[item.unidadId] || 0) + 1;
    }
  });
  
  const todasUnidades = await db.select().from(unidades);
  const unidadesMap = new Map(todasUnidades.map(u => [u.id, u]));
  
  const unidadesAfectadas = Object.entries(unidadesCount)
    .map(([id, count]) => ({
      unidad: unidadesMap.get(parseInt(id)),
      count,
    }))
    .filter(u => u.unidad)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    defecto: defecto[0],
    estadisticas: {
      total,
      pendientes,
      aprobados,
      rechazados,
      tasaAprobacion: total > 0 ? Math.round((aprobados / total) * 1000) / 10 : 0,
      tiempoPromedioCorreccion: Math.round(tiempoPromedioCorreccion * 10) / 10,
    },
    empresasAfectadas,
    unidadesAfectadas,
  };
}

// Estadísticas de mensajería global
export async function getEstadisticasMensajeria(proyectoId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Obtener todos los mensajes
  let todosMensajes = await db.select().from(mensajes);
  
  // Filtrar por proyecto si se especifica
  if (proyectoId) {
    const itemsProyecto = await db.select(itemFieldsWithoutBase64).from(items).where(eq(items.proyectoId, proyectoId));
    const itemIds = new Set(itemsProyecto.map(i => i.id));
    todosMensajes = todosMensajes.filter(m => itemIds.has(m.itemId));
  }
  
  // Usuarios más activos en mensajería
  const mensajesPorUsuario: Record<number, number> = {};
  todosMensajes.forEach(m => {
    mensajesPorUsuario[m.usuarioId] = (mensajesPorUsuario[m.usuarioId] || 0) + 1;
  });
  
  const todosUsuarios = await db.select().from(users);
  const usuariosMap = new Map(todosUsuarios.map(u => [u.id, u]));
  
  const usuariosActivos = Object.entries(mensajesPorUsuario)
    .map(([id, count]) => ({
      usuario: usuariosMap.get(parseInt(id)),
      mensajes: count,
    }))
    .filter(u => u.usuario)
    .sort((a, b) => b.mensajes - a.mensajes)
    .slice(0, 10);
  
  // Menciones por usuario
  const mencionesPorUsuario: Record<number, number> = {};
  todosMensajes.forEach(m => {
    if (m.menciones) {
      try {
        const menciones = JSON.parse(m.menciones);
        menciones.forEach((userId: number) => {
          mencionesPorUsuario[userId] = (mencionesPorUsuario[userId] || 0) + 1;
        });
      } catch {}
    }
  });
  
  const usuariosMasMencionados = Object.entries(mencionesPorUsuario)
    .map(([id, count]) => ({
      usuario: usuariosMap.get(parseInt(id)),
      menciones: count,
    }))
    .filter(u => u.usuario)
    .sort((a, b) => b.menciones - a.menciones)
    .slice(0, 10);
  
  // Ítems con más mensajes
  const mensajesPorItem: Record<number, number> = {};
  todosMensajes.forEach(m => {
    mensajesPorItem[m.itemId] = (mensajesPorItem[m.itemId] || 0) + 1;
  });
  
  const todosItems = await db.select(itemFieldsWithoutBase64).from(items);
  const itemsMap = new Map(todosItems.map(i => [i.id, i]));
  
  const itemsConMasMensajes = Object.entries(mensajesPorItem)
    .map(([id, count]) => ({
      item: itemsMap.get(parseInt(id)),
      mensajes: count,
    }))
    .filter(i => i.item)
    .sort((a, b) => b.mensajes - a.mensajes)
    .slice(0, 10);
  
  return {
    totalMensajes: todosMensajes.length,
    usuariosActivos,
    usuariosMasMencionados,
    itemsConMasMensajes,
  };
}

// Estadísticas de seguimiento (bitácora y auditoría)
export async function getEstadisticasSeguimiento(proyectoId?: number, dias: number = 30) {
  const db = await getDb();
  if (!db) return null;
  
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - dias);
  
  // Obtener bitácora reciente
  const bitacoraReciente = await db.select().from(bitacora)
    .where(gte(bitacora.createdAt, fechaLimite))
    .orderBy(desc(bitacora.createdAt));
  
  // Acciones por tipo
  const accionesPorTipo: Record<string, number> = {};
  bitacoraReciente.forEach(b => {
    accionesPorTipo[b.accion] = (accionesPorTipo[b.accion] || 0) + 1;
  });
  
  // Usuarios más activos
  const accionesPorUsuario: Record<number, number> = {};
  bitacoraReciente.forEach(b => {
    accionesPorUsuario[b.usuarioId] = (accionesPorUsuario[b.usuarioId] || 0) + 1;
  });
  
  const todosUsuarios = await db.select().from(users);
  const usuariosMap = new Map(todosUsuarios.map(u => [u.id, u]));
  
  const usuariosMasActivos = Object.entries(accionesPorUsuario)
    .map(([id, count]) => ({
      usuario: usuariosMap.get(parseInt(id)),
      acciones: count,
    }))
    .filter(u => u.usuario)
    .sort((a, b) => b.acciones - a.acciones)
    .slice(0, 10);
  
  // Actividad por día
  const actividadPorDia: Record<string, number> = {};
  bitacoraReciente.forEach(b => {
    const fecha = new Date(b.createdAt).toISOString().split('T')[0];
    actividadPorDia[fecha] = (actividadPorDia[fecha] || 0) + 1;
  });
  
  // Auditoría reciente
  const auditoriaReciente = await db.select().from(auditoria)
    .where(gte(auditoria.createdAt, fechaLimite))
    .orderBy(desc(auditoria.createdAt))
    .limit(50);
  
  return {
    totalAcciones: bitacoraReciente.length,
    accionesPorTipo,
    usuariosMasActivos,
    actividadPorDia: Object.entries(actividadPorDia).map(([fecha, count]) => ({ fecha, count })),
    auditoriaReciente: auditoriaReciente.map(a => ({
      ...a,
      usuario: usuariosMap.get(a.usuarioId),
    })),
  };
}

// Ranking completo de rendimiento por usuario
export async function getRankingRendimientoUsuarios(proyectoId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  const todosUsuarios = await db.select().from(users);
  const todasEmpresas = await db.select().from(empresas);
  const empresasMap = new Map(todasEmpresas.map(e => [e.id, e]));
  
  const conditions = [];
  if (proyectoId) {
    conditions.push(eq(items.proyectoId, proyectoId));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const todosItems = await db.select(itemFieldsWithoutBase64).from(items).where(whereClause);
  
  // Calcular rendimiento por usuario
  const ranking = todosUsuarios.map(usuario => {
    // Ítems creados por el usuario
    const itemsCreados = todosItems.filter(i => i.residenteId === usuario.id);
    const total = itemsCreados.length;
    const aprobados = itemsCreados.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsCreados.filter(i => i.status === 'rechazado').length;
    const pendientes = itemsCreados.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
    
    // Ítems aprobados como jefe de residente
    const itemsAprobadosComoJefe = todosItems.filter(i => i.jefeResidenteId === usuario.id && i.status === 'aprobado').length;
    
    // Ítems OK como supervisor
    const itemsOkComoSupervisor = todosItems.filter(i => i.supervisorId === usuario.id && i.status === 'aprobado').length;
    
    // Tiempo promedio de resolución
    const itemsResueltos = itemsCreados.filter(i => i.status === 'aprobado' && i.fechaAprobacion);
    let tiempoPromedio = 0;
    if (itemsResueltos.length > 0) {
      const tiempos = itemsResueltos.map(i => {
        const inicio = new Date(i.fechaCreacion).getTime();
        const fin = new Date(i.fechaAprobacion!).getTime();
        return (fin - inicio) / (1000 * 60 * 60 * 24);
      });
      tiempoPromedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    }
    
    // Score de rendimiento (mayor es mejor)
    // Fórmula: aprobados * 10 - rechazados * 5 - pendientes * 2 + (itemsAprobadosComoJefe + itemsOkComoSupervisor) * 3
    const scoreRendimiento = aprobados * 10 - rechazados * 5 - pendientes * 2 + (itemsAprobadosComoJefe + itemsOkComoSupervisor) * 3;
    
    return {
      id: usuario.id,
      nombre: usuario.name,
      role: usuario.role,
      empresa: usuario.empresaId ? empresasMap.get(usuario.empresaId)?.nombre : null,
      estadisticas: {
        total,
        aprobados,
        rechazados,
        pendientes,
        tasaAprobacion: total > 0 ? Math.round((aprobados / total) * 1000) / 10 : 0,
        tiempoPromedio: Math.round(tiempoPromedio * 10) / 10,
      },
      contribuciones: {
        itemsAprobadosComoJefe,
        itemsOkComoSupervisor,
      },
      scoreRendimiento,
    };
  }).filter(u => u.estadisticas.total > 0 || u.contribuciones.itemsAprobadosComoJefe > 0 || u.contribuciones.itemsOkComoSupervisor > 0)
    .sort((a, b) => b.scoreRendimiento - a.scoreRendimiento);
  
  return ranking;
}

// Estadísticas de QR y trazabilidad
export async function getEstadisticasQR(proyectoId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  const conditions = [];
  if (proyectoId) {
    conditions.push(eq(items.proyectoId, proyectoId));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const todosItems = await db.select(itemFieldsWithoutBase64).from(items).where(whereClause);
  
  // Ítems con código QR
  const itemsConCodigo = todosItems.filter(i => i.codigo);
  
  // Distribución por unidad
  const itemsPorUnidad: Record<number, number> = {};
  todosItems.forEach(item => {
    if (item.unidadId) {
      itemsPorUnidad[item.unidadId] = (itemsPorUnidad[item.unidadId] || 0) + 1;
    }
  });
  
  const todasUnidades = await db.select().from(unidades);
  const unidadesMap = new Map(todasUnidades.map(u => [u.id, u]));
  
  const distribucionUnidades = Object.entries(itemsPorUnidad)
    .map(([id, count]) => ({
      unidad: unidadesMap.get(parseInt(id)),
      items: count,
      pendientes: todosItems.filter(i => i.unidadId === parseInt(id) && (i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion')).length,
      aprobados: todosItems.filter(i => i.unidadId === parseInt(id) && i.status === 'aprobado').length,
    }))
    .filter(u => u.unidad)
    .sort((a, b) => b.items - a.items);
  
  return {
    totalItems: todosItems.length,
    itemsConCodigo: itemsConCodigo.length,
    distribucionUnidades,
  };
}


// ==================== KPIs MEJORES Y PEORES ====================

export async function getKPIsMejoresPeores(proyectoId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  const conditions = [];
  if (proyectoId) {
    conditions.push(eq(items.proyectoId, proyectoId));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const todosItems = await db.select(itemFieldsWithoutBase64).from(items).where(whereClause);
  
  // Obtener datos relacionados
  const todasEmpresas = await db.select().from(empresas);
  const todosUsuarios = await db.select().from(users);
  const todasEspecialidades = await db.select().from(especialidades);
  const todosDefectos = await db.select().from(defectos);
  const todasUnidades = await db.select().from(unidades);
  const todosEspacios = await db.select().from(espacios);
  
  const empresasMap = new Map(todasEmpresas.map(e => [e.id, e]));
  const usuariosMap = new Map(todosUsuarios.map(u => [u.id, u]));
  const especialidadesMap = new Map(todasEspecialidades.map(e => [e.id, e]));
  const defectosMap = new Map(todosDefectos.map(d => [d.id, d]));
  const unidadesMap = new Map(todasUnidades.map(u => [u.id, u]));
  const espaciosMap = new Map(todosEspacios.map(e => [e.id, e]));
  
  // Función para calcular score de rendimiento
  const calcularScore = (total: number, aprobados: number, rechazados: number, pendientes: number) => {
    if (total === 0) return 0;
    // Score: % aprobación - penalización por rechazos
    const tasaAprobacion = (aprobados / total) * 100;
    const penalizacion = (rechazados / total) * 50;
    return Math.round(tasaAprobacion - penalizacion);
  };
  
  // ==================== EMPRESAS ====================
  const empresasStats = todasEmpresas.map(empresa => {
    const itemsEmpresa = todosItems.filter(i => i.empresaId === empresa.id);
    const aprobados = itemsEmpresa.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsEmpresa.filter(i => i.status === 'rechazado').length;
    const pendientes = itemsEmpresa.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
    const total = itemsEmpresa.length;
    
    return {
      id: empresa.id,
      nombre: empresa.nombre,
      total,
      aprobados,
      rechazados,
      pendientes,
      score: calcularScore(total, aprobados, rechazados, pendientes),
      tasaAprobacion: total > 0 ? Math.round((aprobados / total) * 100) : 0,
    };
  }).filter(e => e.total > 0);
  
  const empresasMejores = [...empresasStats].sort((a, b) => b.score - a.score).slice(0, 5);
  const empresasPeores = [...empresasStats].sort((a, b) => a.score - b.score).slice(0, 5);
  
  // ==================== ESPECIALIDADES ====================
  const especialidadesStats = todasEspecialidades.map(esp => {
    const itemsEsp = todosItems.filter(i => i.especialidadId === esp.id);
    const aprobados = itemsEsp.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsEsp.filter(i => i.status === 'rechazado').length;
    const pendientes = itemsEsp.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
    const total = itemsEsp.length;
    
    return {
      id: esp.id,
      nombre: esp.nombre,
      color: esp.color,
      total,
      aprobados,
      rechazados,
      pendientes,
      score: calcularScore(total, aprobados, rechazados, pendientes),
      tasaAprobacion: total > 0 ? Math.round((aprobados / total) * 100) : 0,
    };
  }).filter(e => e.total > 0);
  
  const especialidadesMejores = [...especialidadesStats].sort((a, b) => b.score - a.score).slice(0, 5);
  const especialidadesPeores = [...especialidadesStats].sort((a, b) => a.score - b.score).slice(0, 5);
  
  // ==================== RESIDENTES ====================
  const residentes = todosUsuarios.filter(u => u.role === 'residente');
  const residentesStats = residentes.map(residente => {
    const itemsResidente = todosItems.filter(i => i.residenteId === residente.id);
    const aprobados = itemsResidente.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsResidente.filter(i => i.status === 'rechazado').length;
    const pendientes = itemsResidente.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
    const total = itemsResidente.length;
    const empresa = residente.empresaId ? empresasMap.get(residente.empresaId)?.nombre : null;
    
    return {
      id: residente.id,
      nombre: residente.name,
      empresa,
      total,
      aprobados,
      rechazados,
      pendientes,
      score: calcularScore(total, aprobados, rechazados, pendientes),
      tasaAprobacion: total > 0 ? Math.round((aprobados / total) * 100) : 0,
    };
  }).filter(r => r.total > 0);
  
  const residentesMejores = [...residentesStats].sort((a, b) => b.score - a.score).slice(0, 5);
  const residentesPeores = [...residentesStats].sort((a, b) => a.score - b.score).slice(0, 5);
  
  // ==================== JEFES DE RESIDENTES ====================
  const jefesResidentes = todosUsuarios.filter(u => u.role === 'jefe_residente');
  const jefesStats = jefesResidentes.map(jefe => {
    const itemsJefe = todosItems.filter(i => i.jefeResidenteId === jefe.id);
    const aprobados = itemsJefe.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsJefe.filter(i => i.status === 'rechazado').length;
    const pendientes = itemsJefe.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
    const total = itemsJefe.length;
    const empresa = jefe.empresaId ? empresasMap.get(jefe.empresaId)?.nombre : null;
    
    return {
      id: jefe.id,
      nombre: jefe.name,
      empresa,
      total,
      aprobados,
      rechazados,
      pendientes,
      score: calcularScore(total, aprobados, rechazados, pendientes),
      tasaAprobacion: total > 0 ? Math.round((aprobados / total) * 100) : 0,
    };
  }).filter(j => j.total > 0);
  
  const jefesMejores = [...jefesStats].sort((a, b) => b.score - a.score).slice(0, 5);
  const jefesPeores = [...jefesStats].sort((a, b) => a.score - b.score).slice(0, 5);
  
  // ==================== UNIDADES ====================
  const unidadesStats = todasUnidades.map(unidad => {
    const itemsUnidad = todosItems.filter(i => i.unidadId === unidad.id);
    const aprobados = itemsUnidad.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsUnidad.filter(i => i.status === 'rechazado').length;
    const pendientes = itemsUnidad.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
    const total = itemsUnidad.length;
    
    return {
      id: unidad.id,
      nombre: unidad.nombre,
      nivel: unidad.nivel,
      total,
      aprobados,
      rechazados,
      pendientes,
      score: calcularScore(total, aprobados, rechazados, pendientes),
      tasaAprobacion: total > 0 ? Math.round((aprobados / total) * 100) : 0,
    };
  }).filter(u => u.total > 0);
  
  const unidadesMejores = [...unidadesStats].sort((a, b) => b.score - a.score).slice(0, 5);
  const unidadesPeores = [...unidadesStats].sort((a, b) => a.score - b.score).slice(0, 5);
  
  // ==================== ESPACIOS ====================
  const espaciosStats = todosEspacios.map(espacio => {
    const itemsEspacio = todosItems.filter(i => i.espacioId === espacio.id);
    const aprobados = itemsEspacio.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsEspacio.filter(i => i.status === 'rechazado').length;
    const pendientes = itemsEspacio.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
    const total = itemsEspacio.length;
    
    return {
      id: espacio.id,
      nombre: espacio.nombre,
      total,
      aprobados,
      rechazados,
      pendientes,
      score: calcularScore(total, aprobados, rechazados, pendientes),
      tasaAprobacion: total > 0 ? Math.round((aprobados / total) * 100) : 0,
    };
  }).filter(e => e.total > 0);
  
  const espaciosMejores = [...espaciosStats].sort((a, b) => b.score - a.score).slice(0, 5);
  const espaciosPeores = [...espaciosStats].sort((a, b) => a.score - b.score).slice(0, 5);
  
  // ==================== DEFECTOS ====================
  const defectosStats = todosDefectos.map(defecto => {
    const itemsDefecto = todosItems.filter(i => i.defectoId === defecto.id);
    const aprobados = itemsDefecto.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsDefecto.filter(i => i.status === 'rechazado').length;
    const total = itemsDefecto.length;
    
    return {
      id: defecto.id,
      nombre: defecto.nombre,
      severidad: defecto.severidad,
      total,
      aprobados,
      rechazados,
      tasaResolucion: total > 0 ? Math.round((aprobados / total) * 100) : 0,
    };
  }).filter(d => d.total > 0);
  
  const defectosMasFrecuentes = [...defectosStats].sort((a, b) => b.total - a.total).slice(0, 5);
  const defectosMenosFrecuentes = [...defectosStats].sort((a, b) => a.total - b.total).slice(0, 5);
  
  // ==================== NIVELES ====================
  const nivelesUnicos = Array.from(new Set(todasUnidades.map(u => u.nivel).filter(Boolean)));
  const nivelesStats = nivelesUnicos.map(nivel => {
    const unidadesNivel = todasUnidades.filter(u => u.nivel === nivel);
    const unidadIds = new Set(unidadesNivel.map(u => u.id));
    const itemsNivel = todosItems.filter(i => i.unidadId && unidadIds.has(i.unidadId));
    const aprobados = itemsNivel.filter(i => i.status === 'aprobado').length;
    const rechazados = itemsNivel.filter(i => i.status === 'rechazado').length;
    const pendientes = itemsNivel.filter(i => i.status === 'pendiente_foto_despues' || i.status === 'pendiente_aprobacion').length;
    const total = itemsNivel.length;
    
    return {
      nivel,
      nombre: `Nivel ${nivel}`,
      totalUnidades: unidadesNivel.length,
      total,
      aprobados,
      rechazados,
      pendientes,
      score: calcularScore(total, aprobados, rechazados, pendientes),
      tasaAprobacion: total > 0 ? Math.round((aprobados / total) * 100) : 0,
    };
  }).filter(n => n.total > 0);
  
  const nivelesMejores = [...nivelesStats].sort((a, b) => b.score - a.score).slice(0, 5);
  const nivelesPeores = [...nivelesStats].sort((a, b) => a.score - b.score).slice(0, 5);
  
  return {
    empresas: { mejores: empresasMejores, peores: empresasPeores },
    especialidades: { mejores: especialidadesMejores, peores: especialidadesPeores },
    residentes: { mejores: residentesMejores, peores: residentesPeores },
    jefesResidentes: { mejores: jefesMejores, peores: jefesPeores },
    unidades: { mejores: unidadesMejores, peores: unidadesPeores },
    espacios: { mejores: espaciosMejores, peores: espaciosPeores },
    defectos: { masFrecuentes: defectosMasFrecuentes, menosFrecuentes: defectosMenosFrecuentes },
    niveles: { mejores: nivelesMejores, peores: nivelesPeores },
  };
}


// ==================== EMPRESA RESIDENTES ====================

// Obtener todos los residentes de una empresa
export async function getResidentesByEmpresa(empresaId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const relaciones = await db.select()
    .from(empresaResidentes)
    .where(and(
      eq(empresaResidentes.empresaId, empresaId),
      eq(empresaResidentes.activo, true)
    ));
  
  if (relaciones.length === 0) return [];
  
  const usuarioIds = relaciones.map(r => r.usuarioId);
  const usuariosResult = await db.select()
    .from(users)
    .where(inArray(users.id, usuarioIds));
  
  return relaciones.map(rel => {
    const usuario = usuariosResult.find(u => u.id === rel.usuarioId);
    return {
      ...rel,
      usuario
    };
  });
}

// Agregar un residente a una empresa
export async function addResidenteToEmpresa(empresaId: number, usuarioId: number, tipoResidente: 'residente' | 'jefe_residente' = 'residente') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verificar si ya existe la relación
  const existente = await db.select()
    .from(empresaResidentes)
    .where(and(
      eq(empresaResidentes.empresaId, empresaId),
      eq(empresaResidentes.usuarioId, usuarioId)
    ))
    .limit(1);
  
  if (existente.length > 0) {
    // Si existe pero está inactivo, reactivarlo
    if (!existente[0].activo) {
      await db.update(empresaResidentes)
        .set({ activo: true, tipoResidente })
        .where(eq(empresaResidentes.id, existente[0].id));
      return existente[0].id;
    }
    // Si ya existe y está activo, actualizar el tipo
    await db.update(empresaResidentes)
      .set({ tipoResidente })
      .where(eq(empresaResidentes.id, existente[0].id));
    return existente[0].id;
  }
  
  // Crear nueva relación
  const result = await db.insert(empresaResidentes).values({
    empresaId,
    usuarioId,
    tipoResidente,
    activo: true
  });
  
  return result[0].insertId;
}

// Eliminar un residente de una empresa (soft delete)
export async function removeResidenteFromEmpresa(empresaId: number, usuarioId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(empresaResidentes)
    .set({ activo: false })
    .where(and(
      eq(empresaResidentes.empresaId, empresaId),
      eq(empresaResidentes.usuarioId, usuarioId)
    ));
}

// Obtener todas las empresas de un residente
export async function getEmpresasByResidente(usuarioId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const relaciones = await db.select()
    .from(empresaResidentes)
    .where(and(
      eq(empresaResidentes.usuarioId, usuarioId),
      eq(empresaResidentes.activo, true)
    ));
  
  if (relaciones.length === 0) return [];
  
  const empresaIds = relaciones.map(r => r.empresaId);
  const empresasResult = await db.select()
    .from(empresas)
    .where(inArray(empresas.id, empresaIds));
  
  return relaciones.map(rel => {
    const empresa = empresasResult.find(e => e.id === rel.empresaId);
    return {
      ...rel,
      empresa
    };
  });
}

// Obtener todos los residentes con sus empresas (para selector de nuevo ítem)
export async function getAllResidentesConEmpresas(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Obtener todas las empresas del proyecto
  const todasEmpresas = proyectoId
    ? await db.select().from(empresas).where(and(eq(empresas.activo, true), eq(empresas.proyectoId, proyectoId)))
    : await db.select().from(empresas).where(eq(empresas.activo, true));
  
  const empresaIds = todasEmpresas.map(e => e.id);
  if (empresaIds.length === 0) return [];
  
  // Mapa para construir residentes con sus empresas
  const residentesMap = new Map<number, {
    id: number;
    name: string;
    email: string | null;
    role: string;
    empresas: Array<{
      empresaId: number;
      empresaNombre: string;
      especialidadId: number | null;
      tipoResidente: string;
    }>;
  }>();
  
  // 1. Obtener relaciones de la tabla empresa_residentes
  const todasRelaciones = await db.select()
    .from(empresaResidentes)
    .where(eq(empresaResidentes.activo, true));
  
  const relacionesFiltradas = todasRelaciones.filter(r => empresaIds.includes(r.empresaId));
  
  // 2. Obtener usuarios referenciados en empresas.residenteId y empresas.jefeResidenteId
  const residenteIdsDeEmpresas: number[] = [];
  todasEmpresas.forEach(emp => {
    if (emp.residenteId) residenteIdsDeEmpresas.push(emp.residenteId);
    if (emp.jefeResidenteId) residenteIdsDeEmpresas.push(emp.jefeResidenteId);
  });
  
  // 3. Obtener usuarios con rol residente/jefe_residente que tengan empresaId del proyecto
  const usuariosConRolResidente = await db.select()
    .from(users)
    .where(and(
      eq(users.activo, true),
      inArray(users.role, ['residente', 'jefe_residente'])
    ));
  
  const usuariosConEmpresaDelProyecto = usuariosConRolResidente.filter(
    u => u.empresaId && empresaIds.includes(u.empresaId)
  );
  
  // Combinar todos los IDs de usuarios
  const todosUsuarioIds = new Set<number>([
    ...relacionesFiltradas.map(r => r.usuarioId),
    ...residenteIdsDeEmpresas,
    ...usuariosConEmpresaDelProyecto.map(u => u.id)
  ]);
  
  if (todosUsuarioIds.size === 0) return [];
  
  // Obtener todos los usuarios
  const todosUsuarios = await db.select()
    .from(users)
    .where(and(
      inArray(users.id, Array.from(todosUsuarioIds)),
      eq(users.activo, true)
    ));
  
  // Obtener todas las especialidades para mapear nombres
  const todasEspecialidades = await db.select().from(especialidades).where(eq(especialidades.activo, true));
  const especialidadMap = new Map(todasEspecialidades.map(e => [e.id, e.nombre]));
  
  // Construir el mapa de residentes
  todosUsuarios.forEach(usuario => {
    if (!residentesMap.has(usuario.id)) {
      residentesMap.set(usuario.id, {
        id: usuario.id,
        name: usuario.name || 'Sin nombre',
        email: usuario.email,
        role: usuario.role,
        empresas: []
      });
    }
  });
  
  // Agregar empresas desde empresa_residentes
  relacionesFiltradas.forEach(rel => {
    const residente = residentesMap.get(rel.usuarioId);
    const empresa = todasEmpresas.find(e => e.id === rel.empresaId);
    if (residente && empresa) {
      const yaExiste = residente.empresas.some(e => e.empresaId === rel.empresaId);
      if (!yaExiste) {
        residente.empresas.push({
          empresaId: rel.empresaId,
          empresaNombre: empresa.nombre,
          especialidadId: empresa.especialidadId || null,
          tipoResidente: rel.tipoResidente
        });
      }
    }
  });
  
  // Agregar empresas desde empresas.residenteId y empresas.jefeResidenteId
  todasEmpresas.forEach(empresa => {
    if (empresa.residenteId) {
      const residente = residentesMap.get(empresa.residenteId);
      if (residente) {
        const yaExiste = residente.empresas.some(e => e.empresaId === empresa.id);
        if (!yaExiste) {
          residente.empresas.push({
            empresaId: empresa.id,
            empresaNombre: empresa.nombre,
            especialidadId: empresa.especialidadId || null,
            tipoResidente: 'residente'
          });
        }
      }
    }
    if (empresa.jefeResidenteId) {
      const residente = residentesMap.get(empresa.jefeResidenteId);
      if (residente) {
        const yaExiste = residente.empresas.some(e => e.empresaId === empresa.id);
        if (!yaExiste) {
          residente.empresas.push({
            empresaId: empresa.id,
            empresaNombre: empresa.nombre,
            especialidadId: empresa.especialidadId || null,
            tipoResidente: 'jefe_residente'
          });
        }
      }
    }
  });
  
  // Agregar empresas desde usuarios con empresaId
  usuariosConEmpresaDelProyecto.forEach(usuario => {
    const residente = residentesMap.get(usuario.id);
    const empresa = todasEmpresas.find(e => e.id === usuario.empresaId);
    if (residente && empresa) {
      const yaExiste = residente.empresas.some(e => e.empresaId === empresa.id);
      if (!yaExiste) {
        residente.empresas.push({
          empresaId: empresa.id,
          empresaNombre: empresa.nombre,
          especialidadId: empresa.especialidadId || null,
          tipoResidente: usuario.role
        });
      }
    }
  });
  
  // Retornar solo residentes que tienen al menos una empresa, con nombre de especialidad
  return Array.from(residentesMap.values())
    .filter(r => r.empresas.length > 0)
    .map(r => ({
      ...r,
      empresas: r.empresas.map(e => ({
        ...e,
        especialidadNombre: e.especialidadId ? (especialidadMap.get(e.especialidadId) || null) : null
      }))
    }));
}

// Migrar datos existentes de residenteId y jefeResidenteId a la nueva tabla
export async function migrarResidentesExistentes() {
  const db = await getDb();
  if (!db) return { migrados: 0 };
  
  const todasEmpresas = await db.select().from(empresas);
  let migrados = 0;
  
  for (const empresa of todasEmpresas) {
    // Migrar residenteId
    if (empresa.residenteId) {
      try {
        await addResidenteToEmpresa(empresa.id, empresa.residenteId, 'residente');
        migrados++;
      } catch (e) {
        console.log(`Ya existe relación para empresa ${empresa.id} y residente ${empresa.residenteId}`);
      }
    }
    
    // Migrar jefeResidenteId
    if (empresa.jefeResidenteId) {
      try {
        await addResidenteToEmpresa(empresa.id, empresa.jefeResidenteId, 'jefe_residente');
        migrados++;
      } catch (e) {
        console.log(`Ya existe relación para empresa ${empresa.id} y jefe ${empresa.jefeResidenteId}`);
      }
    }
  }
  
  return { migrados };
}


// Obtener usuario por email y verificar contraseña
export async function getUserByEmailAndPassword(email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Normalizar email: trim + lowercase para evitar fallos por espacios o mayúsculas
  const normalizedEmail = email.trim().toLowerCase();
  
  // Buscar todos los usuarios con ese email (case-insensitive via LOWER)
  const result = await db.select().from(users).where(
    sql`LOWER(${users.email}) = ${normalizedEmail}`
  );
  
  // Priorizar usuario activo con contraseña
  // Primero intentar con usuarios activos
  for (const user of result) {
    if (user.passwordHash && user.activo) {
      try {
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (isValid) {
          return user;
        }
      } catch (e) {
        console.error(`[Auth] Error comparando hash para usuario ${user.id}:`, e);
      }
    }
  }
  
  // Si no encontró activo, intentar con inactivos (para dar mensaje correcto)
  for (const user of result) {
    if (user.passwordHash && !user.activo) {
      try {
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (isValid) {
          return user; // El router verificará user.activo y dará mensaje adecuado
        }
      } catch (e) {
        console.error(`[Auth] Error comparando hash para usuario inactivo ${user.id}:`, e);
      }
    }
  }
  
  return null;
}

// Actualizar último acceso del usuario
export async function updateUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users)
    .set({ lastSignedIn: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

// Eliminar usuario permanentemente (solo superadmin)
export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Primero eliminar las relaciones del usuario con proyectos
  await db.delete(proyectoUsuarios).where(eq(proyectoUsuarios.usuarioId, userId));
  
  // Eliminar relaciones con empresas (residentes)
  await db.delete(empresaResidentes).where(eq(empresaResidentes.usuarioId, userId));
  
  // Finalmente eliminar el usuario
  await db.delete(users).where(eq(users.id, userId));
  
  return { success: true };
}


// ==================== ELIMINACIÓN DE BITÁCORA (SUPERADMIN) ====================

// Eliminar una entrada de bitácora por ID
export async function deleteBitacoraEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(bitacora).where(eq(bitacora.id, id));
  return { success: true };
}

// Eliminar múltiples entradas de bitácora por IDs
export async function deleteBitacoraEntries(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (ids.length === 0) return { success: true, count: 0 };
  
  await db.delete(bitacora).where(inArray(bitacora.id, ids));
  return { success: true, count: ids.length };
}

// Limpiar bitácora por filtros
export async function clearBitacoraByFilters(filters: {
  usuarioId?: number;
  accion?: string;
  entidad?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [];
  
  if (filters.usuarioId) {
    conditions.push(eq(bitacora.usuarioId, filters.usuarioId));
  }
  if (filters.accion) {
    conditions.push(eq(bitacora.accion, filters.accion));
  }
  if (filters.entidad) {
    conditions.push(eq(bitacora.entidad, filters.entidad));
  }
  if (filters.fechaDesde) {
    conditions.push(gte(bitacora.createdAt, filters.fechaDesde));
  }
  if (filters.fechaHasta) {
    conditions.push(lte(bitacora.createdAt, filters.fechaHasta));
  }
  
  // Si no hay filtros, no eliminar nada (seguridad)
  if (conditions.length === 0) {
    return 0;
  }
  
  // Contar antes de eliminar
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(bitacora)
    .where(and(...conditions));
  
  const count = countResult[0]?.count || 0;
  
  // Eliminar
  await db.delete(bitacora).where(and(...conditions));
  
  return count;
}


// Actualizar foto de perfil del usuario
export async function updateUserFoto(userId: number, fotoUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ fotoUrl })
    .where(eq(users.id, userId));
  
  return { success: true };
}

// Actualizar foto de perfil del usuario con base64 (evita problemas de S3)
export async function updateUserFotoBase64(userId: number, fotoBase64: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ fotoBase64, fotoUrl: null })
    .where(eq(users.id, userId));
  
  return { success: true };
}

// Aceptar términos y condiciones
export async function aceptarTerminos(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ 
      terminosAceptados: true,
      fechaAceptacionTerminos: new Date()
    })
    .where(eq(users.id, userId));
  
  return { success: true };
}


// ==================== ESTADÍSTICAS DE TIEMPOS Y ACTIVIDAD ====================

export async function getEstadisticasTiemposUsuarios(proyectoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Obtener todos los usuarios activos
  const usuariosData = await db.select().from(users)
    .where(eq(users.activo, true));
  
  // Obtener bitácora con filtros
  let bitacoraData;
  if (proyectoId) {
    // Filtrar por proyecto si está especificado
    bitacoraData = await db.select().from(bitacora);
  } else {
    bitacoraData = await db.select().from(bitacora);
  }
  
  // Obtener items para contar capturas
  let itemsData;
  if (proyectoId) {
    itemsData = await db.select(itemFieldsWithoutBase64).from(items).where(eq(items.proyectoId, proyectoId));
  } else {
    itemsData = await db.select(itemFieldsWithoutBase64).from(items);
  }
  
  // Obtener mensajes para contar lecturas
  const mensajesData = await db.select().from(mensajes);
  
  // Calcular estadísticas por usuario
  const ahora = new Date();
  const inicioSemana = new Date(ahora);
  inicioSemana.setDate(ahora.getDate() - ahora.getDay()); // Domingo de esta semana
  inicioSemana.setHours(0, 0, 0, 0);
  
  const estadisticas = usuariosData.map(usuario => {
    // Bitácora del usuario
    const bitacoraUsuario = bitacoraData.filter(b => b.usuarioId === usuario.id);
    
    // Capturas (crear_item, subir_foto_antes, subir_foto_despues)
    const capturas = bitacoraUsuario.filter(b => 
      b.accion === 'crear_item' || 
      b.accion === 'subir_foto_antes' || 
      b.accion === 'subir_foto_despues' ||
      b.accion?.includes('foto')
    );
    
    // Lecturas de mensajes
    const lecturasChat = bitacoraUsuario.filter(b => 
      b.accion === 'leer_mensaje' || 
      b.accion === 'ver_chat' ||
      b.accion?.includes('mensaje')
    );
    
    // Items creados por este usuario
    const itemsCreados = itemsData.filter(i => i.residenteId === usuario.id);
    
    // Mensajes enviados por este usuario
    const mensajesEnviados = mensajesData.filter(m => m.usuarioId === usuario.id);
    
    // Actividad de la semana
    const bitacoraSemana = bitacoraUsuario.filter(b => 
      new Date(b.createdAt) >= inicioSemana
    );
    const capturasSemana = bitacoraSemana.filter(b => 
      b.accion === 'crear_item' || 
      b.accion?.includes('foto')
    ).length;
    const lecturasSemana = bitacoraSemana.filter(b => 
      b.accion?.includes('mensaje') || b.accion === 'leer_mensaje'
    ).length;
    
    // Última actividad
    const ultimaActividad = bitacoraUsuario.length > 0 
      ? bitacoraUsuario.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
      : null;
    
    // Primer registro (fecha de creación del usuario)
    const fechaRegistro = usuario.createdAt;
    
    return {
      usuarioId: usuario.id,
      usuarioNombre: usuario.name,
      usuarioEmail: usuario.email,
      usuarioRol: usuario.role,
      usuarioFotoUrl: usuario.fotoUrl,
      // Conteos totales
      totalCapturas: itemsCreados.length,
      totalLecturasMensajes: lecturasChat.length,
      totalMensajesEnviados: mensajesEnviados.length,
      totalAcciones: bitacoraUsuario.length,
      // Resumen semanal
      capturasSemana,
      lecturasSemana,
      accionesSemana: bitacoraSemana.length,
      // Fechas
      fechaRegistro,
      ultimaActividad,
      // Estado
      haCapturado: itemsCreados.length > 0,
      haEnviadoMensajes: mensajesEnviados.length > 0,
    };
  });
  
  // Ordenar por total de acciones (mayor a menor)
  return estadisticas.sort((a, b) => b.totalAcciones - a.totalAcciones);
}

export async function getResumenSemanalActividad(proyectoId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  const ahora = new Date();
  const inicioSemana = new Date(ahora);
  inicioSemana.setDate(ahora.getDate() - ahora.getDay());
  inicioSemana.setHours(0, 0, 0, 0);
  
  // Obtener bitácora de la semana
  const bitacoraSemana = await db.select().from(bitacora)
    .where(gte(bitacora.createdAt, inicioSemana));
  
  // Obtener items creados esta semana
  let itemsSemana;
  if (proyectoId) {
    itemsSemana = await db.select(itemFieldsWithoutBase64).from(items)
      .where(and(
        eq(items.proyectoId, proyectoId),
        gte(items.fechaCreacion, inicioSemana)
      ));
  } else {
    itemsSemana = await db.select(itemFieldsWithoutBase64).from(items)
      .where(gte(items.fechaCreacion, inicioSemana));
  }
  
  // Obtener mensajes de la semana
  const mensajesSemana = await db.select().from(mensajes)
    .where(gte(mensajes.createdAt, inicioSemana));
  
  // Usuarios activos esta semana
  const usuariosActivosSemana = new Set(bitacoraSemana.map(b => b.usuarioId));
  
  // Usuarios que han capturado
  const usuariosQueCapturaron = new Set(itemsSemana.map(i => i.residenteId).filter(Boolean));
  
  // Usuarios que han enviado mensajes
  const usuariosQueEnviaronMensajes = new Set(mensajesSemana.map(m => m.usuarioId));
  
  // Actividad por día de la semana
  const actividadPorDia: Record<number, number> = {};
  for (let i = 0; i < 7; i++) {
    actividadPorDia[i] = 0;
  }
  bitacoraSemana.forEach(b => {
    const dia = new Date(b.createdAt).getDay();
    actividadPorDia[dia]++;
  });
  
  return {
    periodo: {
      inicio: inicioSemana,
      fin: ahora,
    },
    resumen: {
      totalAcciones: bitacoraSemana.length,
      itemsCreados: itemsSemana.length,
      mensajesEnviados: mensajesSemana.length,
      usuariosActivos: usuariosActivosSemana.size,
      usuariosQueCapturaron: usuariosQueCapturaron.size,
      usuariosQueEnviaronMensajes: usuariosQueEnviaronMensajes.size,
    },
    actividadPorDia,
  };
}


// ==================== HISTORIAL DE EMPRESAS ====================

export async function createEmpresaHistorial(data: {
  empresaId: number;
  usuarioId: number;
  usuarioNombre: string;
  tipoAccion: 'empresa_creada' | 'empresa_editada' | 'usuario_agregado' | 'usuario_eliminado' | 'usuario_rol_cambiado' | 'defecto_agregado' | 'defecto_editado' | 'defecto_eliminado' | 'especialidad_cambiada';
  descripcion: string;
  valorAnterior?: string;
  valorNuevo?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(empresaHistorial).values({
    empresaId: data.empresaId,
    usuarioId: data.usuarioId,
    usuarioNombre: data.usuarioNombre,
    tipoAccion: data.tipoAccion,
    descripcion: data.descripcion,
    valorAnterior: data.valorAnterior,
    valorNuevo: data.valorNuevo,
  });
  
  return result[0].insertId;
}

export async function getEmpresaHistorial(empresaId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  const historial = await db
    .select()
    .from(empresaHistorial)
    .where(eq(empresaHistorial.empresaId, empresaId))
    .orderBy(desc(empresaHistorial.createdAt));
  
  return historial;
}


// ==================== AVISOS ====================

export async function createAviso(data: { proyectoId: number; creadoPorId: number; titulo: string; contenido: string; prioridad?: 'normal' | 'urgente' }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(avisos).values({
    proyectoId: data.proyectoId,
    creadoPorId: data.creadoPorId,
    titulo: data.titulo,
    contenido: data.contenido,
    prioridad: data.prioridad || 'normal',
  });
  return { id: result[0].insertId };
}

export async function getAvisos(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(avisos.activo, true), eq(avisos.proyectoId, proyectoId)];
  
  const result = await db.select().from(avisos)
    .where(and(...conditions))
    .orderBy(desc(avisos.createdAt));
  
  // Obtener nombres de creadores
  const creadorIds = Array.from(new Set(result.map(a => a.creadoPorId)));
  let creadoresMap: Record<number, string> = {};
  if (creadorIds.length > 0) {
    const creadoresData = await db.select({ id: users.id, name: users.name }).from(users)
      .where(inArray(users.id, creadorIds));
    creadoresData.forEach(c => { if (c.id && c.name) creadoresMap[c.id] = c.name; });
  }
  
  // Obtener conteo de lecturas por aviso
  const avisoIds = result.map(a => a.id);
  let lecturasCountMap: Record<number, number> = {};
  if (avisoIds.length > 0) {
    const lecturasData = await db.select({ avisoId: avisosLecturas.avisoId }).from(avisosLecturas)
      .where(inArray(avisosLecturas.avisoId, avisoIds));
    lecturasData.forEach(l => {
      if (l.avisoId) lecturasCountMap[l.avisoId] = (lecturasCountMap[l.avisoId] || 0) + 1;
    });
  }
  
  return result.map(a => ({
    ...a,
    lecturasCount: lecturasCountMap[a.id] || 0,
    creadoPorNombre: creadoresMap[a.creadoPorId] || 'Desconocido',
  }));
}

export async function getAvisoById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(avisos).where(eq(avisos.id, id)).limit(1);
  return result[0] || null;
}

export async function updateAviso(id: number, data: { titulo?: string; contenido?: string; prioridad?: 'normal' | 'urgente'; activo?: boolean }) {
  const db = await getDb();
  if (!db) return;
  await db.update(avisos).set(data).where(eq(avisos.id, id));
}

export async function deleteAviso(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(avisos).set({ activo: false }).where(eq(avisos.id, id));
}

// Marcar aviso como leído por un usuario
export async function marcarAvisoLeido(avisoId: number, usuarioId: number) {
  const db = await getDb();
  if (!db) return;
  
  // Verificar si ya fue leído
  const existing = await db.select().from(avisosLecturas)
    .where(and(eq(avisosLecturas.avisoId, avisoId), eq(avisosLecturas.usuarioId, usuarioId)))
    .limit(1);
  
  if (existing.length === 0) {
    await db.insert(avisosLecturas).values({ avisoId, usuarioId });
  }
}

// Obtener avisos no leídos por un usuario
export async function getAvisosNoLeidos(usuarioId: number, proyectoId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const conditions = [eq(avisos.activo, true), eq(avisos.proyectoId, proyectoId)];
  
  const todosAvisos = await db.select({ id: avisos.id }).from(avisos).where(and(...conditions));
  if (todosAvisos.length === 0) return 0;
  
  const avisoIds = todosAvisos.map(a => a.id);
  const leidos = await db.select({ avisoId: avisosLecturas.avisoId }).from(avisosLecturas)
    .where(and(eq(avisosLecturas.usuarioId, usuarioId), inArray(avisosLecturas.avisoId, avisoIds)));
  
  const leidosSet = new Set(leidos.map(l => l.avisoId));
  return avisoIds.filter(id => !leidosSet.has(id)).length;
}

// Obtener lecturas de un aviso (quién lo leyó y cuándo)
export async function getLecturasAviso(avisoId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const lecturas = await db.select().from(avisosLecturas)
    .where(eq(avisosLecturas.avisoId, avisoId))
    .orderBy(desc(avisosLecturas.leidoAt));
  
  const usuarioIds = Array.from(new Set(lecturas.map(l => l.usuarioId)));
  let usuariosMap: Record<number, { name: string; role: string }> = {};
  if (usuarioIds.length > 0) {
    const usuariosData = await db.select({ id: users.id, name: users.name, role: users.role }).from(users)
      .where(inArray(users.id, usuarioIds));
    usuariosData.forEach(u => { if (u.id) usuariosMap[u.id] = { name: u.name || 'Sin nombre', role: u.role }; });
  }
  
  return lecturas.map(l => ({
    ...l,
    usuarioNombre: usuariosMap[l.usuarioId]?.name || 'Desconocido',
    usuarioRole: usuariosMap[l.usuarioId]?.role || 'residente',
  }));
}

// Obtener IDs de avisos leídos por un usuario
export async function getAvisosLeidosPorUsuario(usuarioId: number, proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  // Solo retornar lecturas de avisos del proyecto activo
  const avisosDelProyecto = await db.select({ id: avisos.id }).from(avisos)
    .where(and(eq(avisos.activo, true), eq(avisos.proyectoId, proyectoId)));
  if (avisosDelProyecto.length === 0) return [];
  const avisoIds = avisosDelProyecto.map(a => a.id);
  const result = await db.select({ avisoId: avisosLecturas.avisoId }).from(avisosLecturas)
    .where(and(eq(avisosLecturas.usuarioId, usuarioId), inArray(avisosLecturas.avisoId, avisoIds)));
  return result.map(r => r.avisoId);
}


// ============================================
// HEARTBEAT - Usuarios En Línea
// ============================================

export async function updateHeartbeat(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users)
    .set({ lastActiveAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getUsuariosEnLinea(proyectoId: number, minutosUmbral: number = 5) {
  const db = await getDb();
  if (!db) return [];
  const umbral = new Date(Date.now() - minutosUmbral * 60 * 1000);
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      fotoUrl: users.fotoUrl,
      lastActiveAt: users.lastActiveAt,
      rolEnProyecto: proyectoUsuarios.rolEnProyecto,
      empresaNombre: empresas.nombre,
      especialidadNombre: especialidades.nombre,
    })
    .from(users)
    .innerJoin(proyectoUsuarios, and(
      eq(proyectoUsuarios.usuarioId, users.id),
      eq(proyectoUsuarios.proyectoId, proyectoId)
    ))
    .leftJoin(empresas, eq(empresas.id, users.empresaId))
    .leftJoin(especialidades, eq(especialidades.id, empresas.especialidadId))
    .where(and(
      eq(users.activo, true),
      sql`${users.lastActiveAt} >= ${umbral}`
    ))
    .orderBy(desc(users.lastActiveAt));
  return result;
}


// ==========================================
// PLANOS POR NIVEL
// ==========================================

export async function getPlanosByProyecto(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(planos)
    .where(and(eq(planos.proyectoId, proyectoId), eq(planos.activo, true)))
    .orderBy(asc(planos.nivel), asc(planos.orden));
}

export async function getPlanoById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [plano] = await db.select().from(planos).where(eq(planos.id, id));
  return plano || null;
}

export async function createPlano(data: InsertPlano) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(planos).values(data);
  return result.insertId;
}

export async function updatePlano(id: number, data: Partial<InsertPlano>) {
  const db = await getDb();
  if (!db) return;
  await db.update(planos).set(data).where(eq(planos.id, id));
}

export async function deletePlano(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(planos).set({ activo: false }).where(eq(planos.id, id));
}


// ==========================================
// PINES SOBRE PLANOS
// ==========================================

// MERGED: plano_pines + items.pinPlanoId (deduplicado por itemId)
export async function getPinesByPlano(planoId: number) {
  const db = await getDb();
  if (!db) return [];

  // Source 1: plano_pines table (standalone pins, some linked to items)
  const ppResult = await db
    .select({
      id: planoPines.id,
      planoId: planoPines.planoId,
      itemId: planoPines.itemId,
      posX: planoPines.posX,
      posY: planoPines.posY,
      nota: planoPines.nota,
      creadoPorId: planoPines.creadoPorId,
      createdAt: planoPines.createdAt,
      itemCodigo: items.codigo,
      itemEstado: items.status,
      itemDescripcion: items.descripcion,
      itemFotoAntes: items.fotoAntesUrl,
      itemFotoDespues: items.fotoDespuesUrl,
      itemConsecutivo: items.numeroInterno,
      itemTitulo: items.titulo,
      residenteNombre: users.name,
      empresaId: items.empresaId,
      unidadId: items.unidadId,
      especialidadId: items.especialidadId,
      defectoId: items.defectoId,
      itemCreatedAt: items.createdAt,
    })
    .from(planoPines)
    .leftJoin(items, eq(items.id, planoPines.itemId))
    .leftJoin(users, eq(users.id, items.asignadoAId))
    .where(and(eq(planoPines.planoId, planoId), eq(planoPines.activo, true)))
    .orderBy(desc(planoPines.createdAt));

  // Source 2: items with pinPlanoId pointing to this plano (legacy/primary source)
  const itemsResult = await db
    .select({
      id: items.id,
      codigo: items.codigo,
      status: items.status,
      pinPosX: items.pinPosX,
      pinPosY: items.pinPosY,
      titulo: items.titulo,
      descripcion: items.descripcion,
      fotoAntesUrl: items.fotoAntesUrl,
      fotoDespuesUrl: items.fotoDespuesUrl,
      numeroInterno: items.numeroInterno,
      empresaId: items.empresaId,
      unidadId: items.unidadId,
      especialidadId: items.especialidadId,
      defectoId: items.defectoId,
      asignadoAId: items.asignadoAId,
      createdAt: items.createdAt,
    })
    .from(items)
    .where(and(
      eq(items.pinPlanoId, planoId),
      isNotNull(items.pinPosX),
      isNotNull(items.pinPosY)
    ))
    .orderBy(items.id);

  // Merge: items.pinPlanoId is PRIMARY, plano_pines adds extras not already covered
  const seenItemIds = new Set<number>();
  const merged: typeof ppResult = [];

  // First add all items with pinPlanoId (these have correct positions from item creation)
  for (const item of itemsResult) {
    seenItemIds.add(item.id);
    let residenteNombre: string | null = null;
    if (item.asignadoAId) {
      const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, item.asignadoAId));
      residenteNombre = u?.name || null;
    }
    merged.push({
      id: item.id * -1, // Negative to distinguish from planoPines ids
      planoId,
      itemId: item.id,
      posX: item.pinPosX!,
      posY: item.pinPosY!,
      nota: null,
      creadoPorId: null,
      createdAt: item.createdAt,
      itemCodigo: item.codigo,
      itemEstado: item.status,
      itemDescripcion: item.descripcion,
      itemFotoAntes: item.fotoAntesUrl,
      itemFotoDespues: item.fotoDespuesUrl,
      itemConsecutivo: item.numeroInterno,
      itemTitulo: item.titulo,
      residenteNombre,
      empresaId: item.empresaId,
      unidadId: item.unidadId,
      especialidadId: item.especialidadId,
      defectoId: item.defectoId,
      itemCreatedAt: item.createdAt,
    });
  }

  // Then add plano_pines that are NOT already covered by items.pinPlanoId
  for (const pp of ppResult) {
    if (pp.itemId && seenItemIds.has(pp.itemId)) continue;
    if (pp.itemId) seenItemIds.add(pp.itemId);
    merged.push(pp);
  }

  // Enrich with empresa, unidad, especialidad, defecto names
  const allEmpresaIds = Array.from(new Set(merged.filter(r => r.empresaId).map(r => r.empresaId!)));
  const allUnidadIds = Array.from(new Set(merged.filter(r => r.unidadId).map(r => r.unidadId!)));
  const allEspIds = Array.from(new Set(merged.filter(r => r.especialidadId).map(r => r.especialidadId!)));
  const allDefectoIds = Array.from(new Set(merged.filter(r => r.defectoId).map(r => r.defectoId!)));

  const empresasMap = new Map<number, string>();
  const unidadesMap = new Map<number, string>();
  const espMap = new Map<number, string>();
  const defectosMap = new Map<number, string>();

  if (allEmpresaIds.length > 0) {
    const emps = await db.select({ id: empresas.id, nombre: empresas.nombre }).from(empresas).where(inArray(empresas.id, allEmpresaIds));
    emps.forEach(e => empresasMap.set(e.id, e.nombre));
  }
  if (allUnidadIds.length > 0) {
    const unis = await db.select({ id: unidades.id, nombre: unidades.nombre }).from(unidades).where(inArray(unidades.id, allUnidadIds));
    unis.forEach(u => unidadesMap.set(u.id, u.nombre));
  }
  if (allEspIds.length > 0) {
    const esps = await db.select({ id: especialidades.id, nombre: especialidades.nombre }).from(especialidades).where(inArray(especialidades.id, allEspIds));
    esps.forEach(e => espMap.set(e.id, e.nombre));
  }
  if (allDefectoIds.length > 0) {
    const defs = await db.select({ id: defectos.id, nombre: defectos.nombre }).from(defectos).where(inArray(defectos.id, allDefectoIds));
    defs.forEach(d => defectosMap.set(d.id, d.nombre));
  }

  return merged.map(r => ({
    ...r,
    empresaNombre: r.empresaId ? empresasMap.get(r.empresaId) || null : null,
    unidadNombre: r.unidadId ? unidadesMap.get(r.unidadId) || null : null,
    especialidadNombre: r.especialidadId ? espMap.get(r.especialidadId) || null : null,
    defectoNombre: r.defectoId ? defectosMap.get(r.defectoId) || null : null,
  }));
}

export async function createPlanoPin(data: InsertPlanoPin) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(planoPines).values(data);
  return result.insertId;
}

export async function deletePlanoPin(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(planoPines).set({ activo: false }).where(eq(planoPines.id, id));
}

export async function getPinesCountByPlano(planoId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(planoPines)
    .where(and(eq(planoPines.planoId, planoId), eq(planoPines.activo, true)));
  return result?.count || 0;
}

// ==================== PIN COUNT POR PLANO ====================
export async function getPinCountByPlano(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      planoId: items.pinPlanoId,
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(items)
    .innerJoin(planos, eq(items.pinPlanoId, planos.id))
    .where(and(
      eq(planos.proyectoId, proyectoId),
      isNotNull(items.pinPosX),
      isNotNull(items.pinPosY),
      isNotNull(items.pinPlanoId)
    ))
    .groupBy(items.pinPlanoId);
  return result;
}


// ==================== FIRMAS ELECTRÓNICAS DE REPORTES ====================

export async function crearFirmasReporte(data: {
  proyectoId: number;
  reporteId: string;
  empresas: { empresaId: number; emails: { userId?: number; nombre: string; email: string }[] }[];
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const results = [];
  for (const emp of data.empresas) {
    const token = nanoid(32);
    const [result] = await db.insert(firmasReporte).values({
      proyectoId: data.proyectoId,
      reporteId: data.reporteId,
      empresaId: emp.empresaId,
      firmado: false,
      tokenFirma: token,
    });
    results.push({ id: result.insertId, empresaId: emp.empresaId, token });
  }
  return results;
}

export async function firmarReporte(data: {
  tokenFirma: string;
  firmaBase64: string;
  firmadoPorId?: number;
  firmadoPorNombre: string;
  firmadoPorEmail: string;
  ip?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [firma] = await db.select().from(firmasReporte).where(eq(firmasReporte.tokenFirma, data.tokenFirma));
  if (!firma) throw new Error("Token de firma inválido");
  if (firma.firmado) throw new Error("Este reporte ya fue firmado por esta empresa");
  await db.update(firmasReporte).set({
    firmado: true,
    firmaBase64: data.firmaBase64,
    firmadoPorId: data.firmadoPorId || null,
    firmadoPorNombre: data.firmadoPorNombre,
    firmadoPorEmail: data.firmadoPorEmail,
    fechaFirma: new Date(),
    ipFirma: data.ip || null,
  }).where(eq(firmasReporte.id, firma.id));
  return firma;
}

export async function getFirmasByReporte(reporteId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return await db.select().from(firmasReporte).where(eq(firmasReporte.reporteId, reporteId)).orderBy(firmasReporte.createdAt);
}

export async function getFirmaByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [firma] = await db.select().from(firmasReporte).where(eq(firmasReporte.tokenFirma, token));
  return firma || null;
}

export async function todasFirmasCompletas(reporteId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const firmas = await db.select().from(firmasReporte).where(eq(firmasReporte.reporteId, reporteId));
  if (firmas.length === 0) return false;
  return firmas.every(f => f.firmado);
}

// ==================== BITÁCORA DE CORREOS ====================

export async function registrarCorreo(data: {
  proyectoId: number;
  reporteId?: string;
  tipo: string;
  destinatarioEmail: string;
  destinatarioNombre?: string;
  destinatarioEmpresa?: string;
  asunto: string;
  contenido?: string;
  leyenda?: string;
  enviadoPorId?: number;
  enviadoPorNombre?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const tokenTracking = nanoid(32);
  const [result] = await db.insert(bitacoraCorreos).values({
    ...data,
    enviado: true,
    fechaEnvio: new Date(),
    tokenTracking,
  });
  return { id: result.insertId, tokenTracking };
}

export async function marcarCorreoAbierto(tokenTracking: string, ip?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [correo] = await db.select().from(bitacoraCorreos).where(eq(bitacoraCorreos.tokenTracking, tokenTracking));
  if (!correo) return null;
  if (!correo.abierto) {
    await db.update(bitacoraCorreos).set({
      abierto: true,
      fechaApertura: new Date(),
      ipApertura: ip || null,
    }).where(eq(bitacoraCorreos.id, correo.id));
  }
  return correo;
}

export async function getBitacoraCorreos(proyectoId: number, opts?: { limit?: number; offset?: number; tipo?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const conditions = [eq(bitacoraCorreos.proyectoId, proyectoId)];
  if (opts?.tipo) conditions.push(eq(bitacoraCorreos.tipo, opts.tipo));
  const result = await db.select().from(bitacoraCorreos)
    .where(and(...conditions))
    .orderBy(desc(bitacoraCorreos.createdAt))
    .limit(opts?.limit || 100)
    .offset(opts?.offset || 0);
  return result;
}

export async function countBitacoraCorreos(proyectoId: number, tipo?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const conditions = [eq(bitacoraCorreos.proyectoId, proyectoId)];
  if (tipo) conditions.push(eq(bitacoraCorreos.tipo, tipo));
  const [result] = await db.select({ count: sql<number>`COUNT(*)` }).from(bitacoraCorreos).where(and(...conditions));
  return result?.count || 0;
}


// ==================== REPORTES IA ====================

/**
 * Recopilar datos completos del proyecto para análisis IA
 * Devuelve un snapshot agregado de todas las métricas relevantes
 */
export async function getDatosCompletosParaAnalisisIA(proyectoId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // 1. Proyecto base
  const [proyecto] = await db.select().from(proyectos).where(eq(proyectos.id, proyectoId));
  if (!proyecto) throw new Error("Proyecto no encontrado");

  // 2. Items con estadísticas detalladas
  const todosItems = await db.select({
    id: items.id,
    codigo: items.codigo,
    titulo: items.titulo,
    status: items.status,
    empresaId: items.empresaId,
    unidadId: items.unidadId,
    especialidadId: items.especialidadId,
    defectoId: items.defectoId,
    espacioId: items.espacioId,
    residenteId: items.residenteId,
    fechaCreacion: items.fechaCreacion,
    fechaFotoDespues: items.fechaFotoDespues,
    fechaAprobacion: items.fechaAprobacion,
    fechaCierre: items.fechaCierre,
  }).from(items).where(eq(items.proyectoId, proyectoId));

  const totalItems = todosItems.length;
  const aprobados = todosItems.filter(i => i.status === 'aprobado').length;
  const rechazados = todosItems.filter(i => i.status === 'rechazado').length;
  const pendientesFoto = todosItems.filter(i => i.status === 'pendiente_foto_despues').length;
  const pendientesAprobacion = todosItems.filter(i => i.status === 'pendiente_aprobacion').length;

  // Tiempos promedio de resolución (items aprobados con fechas completas)
  const itemsConTiempos = todosItems.filter(i => i.status === 'aprobado' && i.fechaCreacion && i.fechaAprobacion);
  const tiemposResolucion = itemsConTiempos.map(i => {
    const diff = new Date(i.fechaAprobacion!).getTime() - new Date(i.fechaCreacion).getTime();
    return diff / (1000 * 60 * 60 * 24); // días
  });
  const tiempoPromedioResolucion = tiemposResolucion.length > 0
    ? tiemposResolucion.reduce((a, b) => a + b, 0) / tiemposResolucion.length
    : 0;

  // 3. Empresas con conteos
  const todasEmpresas = await db.select().from(empresas)
    .where(and(eq(empresas.proyectoId, proyectoId), eq(empresas.activo, true)));
  const empresasConItems = todasEmpresas.map(emp => {
    const itemsEmpresa = todosItems.filter(i => i.empresaId === emp.id);
    const aprobadosEmp = itemsEmpresa.filter(i => i.status === 'aprobado').length;
    return {
      id: emp.id,
      nombre: emp.nombre,
      totalItems: itemsEmpresa.length,
      aprobados: aprobadosEmp,
      rechazados: itemsEmpresa.filter(i => i.status === 'rechazado').length,
      pendientes: itemsEmpresa.filter(i => i.status !== 'aprobado' && i.status !== 'rechazado').length,
      tasaAprobacion: itemsEmpresa.length > 0 ? Math.round((aprobadosEmp / itemsEmpresa.length) * 100) : 0,
    };
  });

  // 4. Unidades (niveles) con conteos
  const todasUnidades = await db.select().from(unidades)
    .where(and(eq(unidades.proyectoId, proyectoId), eq(unidades.activo, true)));
  const unidadesConItems = todasUnidades.map(uni => {
    const itemsUnidad = todosItems.filter(i => i.unidadId === uni.id);
    return {
      id: uni.id,
      nombre: uni.nombre,
      nivel: uni.nivel,
      totalItems: itemsUnidad.length,
      aprobados: itemsUnidad.filter(i => i.status === 'aprobado').length,
      pendientes: itemsUnidad.filter(i => i.status !== 'aprobado' && i.status !== 'rechazado').length,
    };
  });

  // 5. Especialidades con conteos
  const todasEspecialidades = await db.select().from(especialidades)
    .where(and(eq(especialidades.proyectoId, proyectoId), eq(especialidades.activo, true)));
  const especialidadesConItems = todasEspecialidades.map(esp => {
    const itemsEsp = todosItems.filter(i => i.especialidadId === esp.id);
    return {
      id: esp.id,
      nombre: esp.nombre,
      totalItems: itemsEsp.length,
      aprobados: itemsEsp.filter(i => i.status === 'aprobado').length,
      rechazados: itemsEsp.filter(i => i.status === 'rechazado').length,
    };
  });

  // 6. Defectos con frecuencia
  const todosDefectos = await db.select().from(defectos)
    .where(and(eq(defectos.proyectoId, proyectoId), eq(defectos.activo, true)));
  const defectosConFrecuencia = todosDefectos.map(def => {
    const itemsDef = todosItems.filter(i => i.defectoId === def.id);
    return {
      id: def.id,
      nombre: def.nombre,
      severidad: def.severidad,
      frecuencia: itemsDef.length,
    };
  }).sort((a, b) => b.frecuencia - a.frecuencia);

  // 7. Espacios con conteos
  const todosEspacios = await db.select().from(espacios)
    .where(and(eq(espacios.proyectoId, proyectoId), eq(espacios.activo, true)));
  const espaciosConItems = todosEspacios.map(esp => {
    const itemsEsp = todosItems.filter(i => i.espacioId === esp.id);
    return {
      id: esp.id,
      nombre: esp.nombre,
      totalItems: itemsEsp.length,
    };
  }).sort((a, b) => b.totalItems - a.totalItems);

  // 8. Usuarios y participación
  const usuariosProyecto = await db.select().from(proyectoUsuarios)
    .where(and(eq(proyectoUsuarios.proyectoId, proyectoId), eq(proyectoUsuarios.activo, true)));
  const userIds = usuariosProyecto.map(pu => pu.usuarioId);
  const todosUsuarios = userIds.length > 0
    ? await db.select({ id: users.id, name: users.name, role: users.role, lastActiveAt: users.lastActiveAt }).from(users).where(inArray(users.id, userIds))
    : [];

  const participacionUsuarios = todosUsuarios.map(usr => {
    const itemsCreados = todosItems.filter(i => i.residenteId === usr.id).length;
    const diasSinActividad = usr.lastActiveAt
      ? Math.floor((Date.now() - new Date(usr.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    return {
      id: usr.id,
      nombre: usr.name || 'Sin nombre',
      rol: usr.role,
      itemsCreados,
      activo: diasSinActividad <= 7,
      diasSinActividad,
    };
  });

  const usuariosActivos = participacionUsuarios.filter(u => u.activo).length;
  const usuariosInactivos = participacionUsuarios.filter(u => !u.activo).length;

  // 9. Pines en planos
  const planosProyecto = await db.select().from(planos)
    .where(and(eq(planos.proyectoId, proyectoId), eq(planos.activo, true)));
  const planoIds = planosProyecto.map(p => p.id);
  let totalPines = 0;
  if (planoIds.length > 0) {
    const [pinesCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(planoPines)
      .where(and(inArray(planoPines.planoId, planoIds), eq(planoPines.activo, true)));
    totalPines = pinesCount?.count || 0;
  }

  // 10. Tendencia semanal (últimas 4 semanas)
  const ahora = new Date();
  const tendenciaSemanal = [];
  for (let i = 3; i >= 0; i--) {
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - (i * 7) - ahora.getDay());
    inicioSemana.setHours(0, 0, 0, 0);
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 7);

    const itemsSemana = todosItems.filter(item => {
      const fecha = new Date(item.fechaCreacion);
      return fecha >= inicioSemana && fecha < finSemana;
    });
    const aprobadosSemana = itemsSemana.filter(i => i.status === 'aprobado').length;

    tendenciaSemanal.push({
      semana: `Semana ${4 - i}`,
      inicio: inicioSemana.toISOString().split('T')[0],
      fin: finSemana.toISOString().split('T')[0],
      creados: itemsSemana.length,
      aprobados: aprobadosSemana,
    });
  }

  // 11. Metas del proyecto
  const metasProyecto = await db.select().from(metas)
    .where(and(eq(metas.proyectoId, proyectoId), eq(metas.activo, true)));

  return {
    proyecto: {
      id: proyecto.id,
      nombre: proyecto.nombre,
      codigo: proyecto.codigo,
      cliente: proyecto.cliente,
      fechaInicio: proyecto.fechaInicio,
      fechaFin: proyecto.fechaFin,
      diasCorreccion: proyecto.diasCorreccion,
    },
    resumenGeneral: {
      totalItems,
      aprobados,
      rechazados,
      pendientesFoto,
      pendientesAprobacion,
      tasaAprobacion: totalItems > 0 ? Math.round((aprobados / totalItems) * 100) : 0,
      tasaRechazo: totalItems > 0 ? Math.round((rechazados / totalItems) * 100) : 0,
      tiempoPromedioResolucionDias: Math.round(tiempoPromedioResolucion * 10) / 10,
    },
    empresas: empresasConItems,
    unidades: unidadesConItems,
    especialidades: especialidadesConItems,
    defectos: defectosConFrecuencia.slice(0, 20), // Top 20
    espacios: espaciosConItems.slice(0, 20), // Top 20
    participacionUsuarios,
    resumenUsuarios: {
      total: participacionUsuarios.length,
      activos: usuariosActivos,
      inactivos: usuariosInactivos,
    },
    planos: {
      totalPlanos: planosProyecto.length,
      totalPines,
    },
    tendenciaSemanal,
    metas: metasProyecto.map(m => ({
      nombre: m.nombre,
      tipo: m.tipo,
      valorObjetivo: m.valorObjetivo,
      unidadMedida: m.unidadMedida,
    })),
    fechaAnalisis: new Date().toISOString(),
  };
}

/**
 * Crear un reporte IA
 */
export async function createReporteIA(data: InsertReporteIA) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(reportesIA).values(data);
  return { id: result.insertId };
}

/**
 * Obtener reportes IA por proyecto (historial)
 */
export async function getReportesIA(proyectoId: number, opts?: { limit?: number; offset?: number; tipo?: string; incluirArchivados?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const conditions = [eq(reportesIA.proyectoId, proyectoId)];
  if (opts?.tipo) conditions.push(eq(reportesIA.tipo, opts.tipo as any));
  if (!opts?.incluirArchivados) conditions.push(eq(reportesIA.archivado, false));
  const results = await db.select().from(reportesIA)
    .where(and(...conditions))
    .orderBy(desc(reportesIA.createdAt))
    .limit(opts?.limit || 50)
    .offset(opts?.offset || 0);
  return results;
}

/**
 * Obtener un reporte IA por ID
 */
export async function getReporteIAById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.select().from(reportesIA).where(eq(reportesIA.id, id));
  return result || null;
}

/**
 * Actualizar un reporte IA (ej: agregar PDF URL, marcar como enviado)
 */
export async function updateReporteIA(id: number, data: Partial<InsertReporteIA>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(reportesIA).set(data).where(eq(reportesIA.id, id));
}

/**
 * Eliminar un reporte IA permanentemente
 */
export async function deleteReporteIA(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(reportesIA).where(eq(reportesIA.id, id));
}

/**
 * Contar reportes IA por proyecto
 */
export async function countReportesIA(proyectoId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.select({ count: sql<number>`COUNT(*)` }).from(reportesIA)
    .where(eq(reportesIA.proyectoId, proyectoId));
  return result?.count || 0;
}

/**
 * Obtener la siguiente versión de reporte para un proyecto
 */
export async function getNextReporteVersion(proyectoId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.select({ maxVersion: sql<number>`COALESCE(MAX(version), 0)` }).from(reportesIA)
    .where(eq(reportesIA.proyectoId, proyectoId));
  return (result?.maxVersion || 0) + 1;
}

/**
 * Obtener emails de todos los usuarios activos de un proyecto
 */
export async function getEmailsUsuariosProyecto(proyectoId: number): Promise<{ email: string; nombre: string }[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const puList = await db.select().from(proyectoUsuarios)
    .where(and(eq(proyectoUsuarios.proyectoId, proyectoId), eq(proyectoUsuarios.activo, true)));
  const userIds = puList.map(pu => pu.usuarioId);
  if (userIds.length === 0) return [];
  const usrs = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(inArray(users.id, userIds), eq(users.activo, true)));
  return usrs
    .filter(u => u.email && u.email.trim().length > 0)
    .map(u => ({ email: u.email!, nombre: u.name || 'Usuario' }));
}


/**
 * Obtener fotos de evidencia de los defectos más recurrentes para reportes IA
 * Busca los top N defectos por ocurrencia y para cada uno obtiene un ítem representativo con foto
 */
export async function getFotosEvidenciaParaReporte(proyectoId: number, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];

  // 1. Obtener top defectos más recurrentes (con conteo)
  const topDefectos = await db.select({
    defectoId: items.defectoId,
    defectoNombre: defectos.nombre,
    count: sql<number>`COUNT(*)`.as('count'),
  })
    .from(items)
    .innerJoin(defectos, eq(items.defectoId, defectos.id))
    .where(and(
      eq(items.proyectoId, proyectoId),
      sql`${items.defectoId} IS NOT NULL`
    ))
    .groupBy(items.defectoId, defectos.nombre)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit);

  if (topDefectos.length === 0) {
    // Fallback: si no hay defectos, retornar ítems recientes con fotos
    return getFotosEvidenciaFallback(proyectoId, limit);
  }

  // 2. Para cada defecto top, buscar un ítem representativo CON foto
  const results: any[] = [];
  for (const def of topDefectos) {
    // Primero intentar con foto marcada o antes URL
    let item = await db.select({
      id: items.id,
      codigo: items.codigo,
      titulo: items.titulo,
      status: items.status,
      fotoAntesUrl: items.fotoAntesUrl,
      fotoDespuesUrl: items.fotoDespuesUrl,
      fotoAntesMarcadaUrl: items.fotoAntesMarcadaUrl,
      fotoAntesBase64: items.fotoAntesBase64,
      fotoAntesMarcadaBase64: items.fotoAntesMarcadaBase64,
      empresaId: items.empresaId,
      especialidadId: items.especialidadId,
    })
      .from(items)
      .where(and(
        eq(items.proyectoId, proyectoId),
        eq(items.defectoId, def.defectoId!),
        sql`(
          (${items.fotoAntesMarcadaUrl} IS NOT NULL AND ${items.fotoAntesMarcadaUrl} != '') OR
          (${items.fotoAntesUrl} IS NOT NULL AND ${items.fotoAntesUrl} != '') OR
          (${items.fotoAntesBase64} IS NOT NULL AND LENGTH(${items.fotoAntesBase64}) > 100)
        )`
      ))
      .orderBy(
        sql`CASE WHEN ${items.fotoAntesMarcadaUrl} IS NOT NULL AND ${items.fotoAntesMarcadaUrl} != '' THEN 0
             WHEN ${items.fotoAntesUrl} IS NOT NULL AND ${items.fotoAntesUrl} != '' THEN 1
             ELSE 2 END`,
        desc(items.fechaCreacion)
      )
      .limit(1)
      .then(r => r[0] || null);

    // Si no hay con foto, tomar cualquier ítem de ese defecto
    if (!item) {
      item = await db.select({
        id: items.id,
        codigo: items.codigo,
        titulo: items.titulo,
        status: items.status,
        fotoAntesUrl: items.fotoAntesUrl,
        fotoDespuesUrl: items.fotoDespuesUrl,
        fotoAntesMarcadaUrl: items.fotoAntesMarcadaUrl,
        fotoAntesBase64: items.fotoAntesBase64,
        fotoAntesMarcadaBase64: items.fotoAntesMarcadaBase64,
        empresaId: items.empresaId,
        especialidadId: items.especialidadId,
      })
        .from(items)
        .where(and(
          eq(items.proyectoId, proyectoId),
          eq(items.defectoId, def.defectoId!)
        ))
        .orderBy(desc(items.fechaCreacion))
        .limit(1)
        .then(r => r[0] || null);
    }

    if (item) {
      const fotoUrl = item.fotoAntesMarcadaUrl || item.fotoAntesUrl || item.fotoAntesBase64 || item.fotoDespuesUrl || item.fotoAntesMarcadaBase64 || null;
      results.push({
        id: item.id,
        codigo: item.codigo || `ITEM-${item.id}`,
        titulo: item.titulo || 'Sin título',
        status: item.status || 'pendiente_foto',
        fotoUrl,
        fotoAntesUrl: item.fotoAntesUrl || item.fotoAntesBase64 || null,
        fotoDespuesUrl: item.fotoDespuesUrl || null,
        fotoMarcadaUrl: item.fotoAntesMarcadaUrl || item.fotoAntesMarcadaBase64 || null,
        defectoNombre: def.defectoNombre,
        defectoCount: Number(def.count),
        tieneFoto: !!fotoUrl,
      });
    }
  }

  return results;
}

/** Fallback: ítems recientes con fotos cuando no hay defectos catalogados */
async function getFotosEvidenciaFallback(proyectoId: number, limit: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db.select({
    id: items.id,
    codigo: items.codigo,
    titulo: items.titulo,
    status: items.status,
    fotoAntesUrl: items.fotoAntesUrl,
    fotoDespuesUrl: items.fotoDespuesUrl,
    fotoAntesMarcadaUrl: items.fotoAntesMarcadaUrl,
    fotoAntesBase64: items.fotoAntesBase64,
    fotoAntesMarcadaBase64: items.fotoAntesMarcadaBase64,
    empresaId: items.empresaId,
    especialidadId: items.especialidadId,
  })
    .from(items)
    .where(and(
      eq(items.proyectoId, proyectoId),
      sql`(
        (${items.fotoAntesUrl} IS NOT NULL AND ${items.fotoAntesUrl} != '') OR
        (${items.fotoAntesMarcadaUrl} IS NOT NULL AND ${items.fotoAntesMarcadaUrl} != '') OR
        (${items.fotoAntesBase64} IS NOT NULL AND LENGTH(${items.fotoAntesBase64}) > 100)
      )`
    ))
    .orderBy(desc(items.fechaCreacion))
    .limit(limit);

  return results.map(r => {
    const fotoUrl = r.fotoAntesMarcadaUrl || r.fotoAntesUrl || r.fotoAntesBase64 || r.fotoDespuesUrl || r.fotoAntesMarcadaBase64 || null;
    return {
      id: r.id,
      codigo: r.codigo || `ITEM-${r.id}`,
      titulo: r.titulo || 'Sin título',
      status: r.status || 'pendiente_foto',
      fotoUrl,
      fotoAntesUrl: r.fotoAntesUrl || r.fotoAntesBase64 || null,
      fotoDespuesUrl: r.fotoDespuesUrl || null,
      fotoMarcadaUrl: r.fotoAntesMarcadaUrl || r.fotoAntesMarcadaBase64 || null,
      defectoNombre: null,
      defectoCount: 0,
      tieneFoto: !!fotoUrl,
    };
  });
}


// ==================== MÓDULO DE PRUEBAS POR DEPARTAMENTO ====================

// --- Catálogo de Pruebas ---

export async function getCatalogoPruebas(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(catalogoPruebas)
    .where(and(eq(catalogoPruebas.proyectoId, proyectoId), eq(catalogoPruebas.activo, true)))
    .orderBy(asc(catalogoPruebas.sistema), asc(catalogoPruebas.orden));
}

export async function createCatalogoPrueba(data: InsertCatalogoPrueba) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(catalogoPruebas).values(data);
  return result.insertId;
}

export async function updateCatalogoPrueba(id: number, data: Partial<InsertCatalogoPrueba>) {
  const db = await getDb();
  if (!db) return;
  await db.update(catalogoPruebas).set(data).where(eq(catalogoPruebas.id, id));
}

export async function deleteCatalogoPrueba(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(catalogoPruebas).set({ activo: false }).where(eq(catalogoPruebas.id, id));
}

// --- Resultados de Pruebas ---

export async function getResultadosPruebas(proyectoId: number, unidadId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(pruebasResultado.proyectoId, proyectoId)];
  if (unidadId) conditions.push(eq(pruebasResultado.unidadId, unidadId));
  return db.select().from(pruebasResultado).where(and(...conditions));
}

export async function getResultadoPrueba(proyectoId: number, unidadId: number, pruebaId: number, intento: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(pruebasResultado)
    .where(and(
      eq(pruebasResultado.proyectoId, proyectoId),
      eq(pruebasResultado.unidadId, unidadId),
      eq(pruebasResultado.pruebaId, pruebaId),
      eq(pruebasResultado.intento, intento as any)
    ))
    .limit(1);
  return rows[0] || null;
}

export async function upsertResultadoPrueba(data: InsertPruebaResultado) {
  const db = await getDb();
  if (!db) return null;
  // Check if exists
  const existing = await getResultadoPrueba(data.proyectoId, data.unidadId, data.pruebaId, data.intento);
  if (existing) {
    await db.update(pruebasResultado).set({
      estado: data.estado,
      observacion: data.observacion,
      evidenciaUrl: data.evidenciaUrl,
      evidenciaKey: data.evidenciaKey,
      evaluadoPorId: data.evaluadoPorId,
      evaluadoPorNombre: data.evaluadoPorNombre,
      evaluadoAt: new Date(),
    }).where(eq(pruebasResultado.id, existing.id));
    return existing.id;
  } else {
    const [result] = await db.insert(pruebasResultado).values(data);
    return result.insertId;
  }
}

export async function getResumenPruebasPorUnidad(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get all results grouped by unidad
  return db.select().from(pruebasResultado)
    .where(eq(pruebasResultado.proyectoId, proyectoId));
}

// --- Bitácora de Pruebas ---

export async function createBitacoraPrueba(data: InsertPruebaBitacora) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(pruebasBitacora).values(data);
  return result.insertId;
}

export async function getUltimaBitacora(proyectoId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(pruebasBitacora)
    .where(eq(pruebasBitacora.proyectoId, proyectoId))
    .orderBy(desc(pruebasBitacora.id))
    .limit(1);
  return rows[0] || null;
}

export async function getBitacoraPruebas(proyectoId: number, unidadId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(pruebasBitacora.proyectoId, proyectoId)];
  if (unidadId) conditions.push(eq(pruebasBitacora.unidadId, unidadId));
  return db.select().from(pruebasBitacora)
    .where(and(...conditions))
    .orderBy(desc(pruebasBitacora.createdAt))
    .limit(limit);
}

// --- Departamentos numéricos (para módulo de pruebas) ---

export async function getDepartamentosNumericos(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(unidades)
    .where(and(
      eq(unidades.proyectoId, proyectoId),
      eq(unidades.activo, true),
      sql`${unidades.nombre} REGEXP '^[0-9]+$'`
    ))
    .orderBy(asc(unidades.nivel), asc(unidades.nombre));
}

// Get ALL catalog pruebas including inactive (for editor)
export async function reordenarPruebas(items: { id: number; orden: number }[]) {
  const db = await getDb();
  if (!db) return;
  for (const item of items) {
    await db.update(catalogoPruebas).set({ orden: item.orden }).where(eq(catalogoPruebas.id, item.id));
  }
}

export async function getCatalogoPruebasAll(proyectoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(catalogoPruebas)
    .where(eq(catalogoPruebas.proyectoId, proyectoId))
    .orderBy(asc(catalogoPruebas.sistema), asc(catalogoPruebas.orden));
}
