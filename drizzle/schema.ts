import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

// Enum para roles de usuario (superadmin tiene acceso total, admin/supervisor limitado en config)
export const userRoleEnum = mysqlEnum("role", ["superadmin", "admin", "supervisor", "jefe_residente", "residente"]);

// Enum para estados de ítems
export const itemStatusEnum = mysqlEnum("status", ["pendiente_foto_despues", "pendiente_aprobacion", "aprobado", "rechazado"]);

/**
 * Tabla de usuarios con roles específicos para el sistema de calidad
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["superadmin", "admin", "supervisor", "jefe_residente", "residente"]).default("residente").notNull(),
  empresaId: int("empresaId"),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tabla de empresas/contratistas
 */
export const empresas = mysqlTable("empresas", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  rfc: varchar("rfc", { length: 20 }),
  contacto: varchar("contacto", { length: 255 }),
  telefono: varchar("telefono", { length: 20 }),
  email: varchar("email", { length: 320 }),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Empresa = typeof empresas.$inferSelect;
export type InsertEmpresa = typeof empresas.$inferInsert;

/**
 * Tabla de unidades (departamentos, casas, áreas, etc.)
 */
export const unidades = mysqlTable("unidades", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  codigo: varchar("codigo", { length: 50 }),
  descripcion: text("descripcion"),
  ubicacion: varchar("ubicacion", { length: 255 }),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Unidad = typeof unidades.$inferSelect;
export type InsertUnidad = typeof unidades.$inferInsert;

/**
 * Tabla de especialidades (electricidad, plomería, acabados, etc.)
 */
export const especialidades = mysqlTable("especialidades", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  codigo: varchar("codigo", { length: 50 }),
  descripcion: text("descripcion"),
  color: varchar("color", { length: 7 }).default("#3B82F6"),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Especialidad = typeof especialidades.$inferSelect;
export type InsertEspecialidad = typeof especialidades.$inferInsert;

/**
 * Tabla de atributos (tipo de defecto, severidad, etc.)
 */
export const atributos = mysqlTable("atributos", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  categoria: varchar("categoria", { length: 100 }),
  descripcion: text("descripcion"),
  especialidadId: int("especialidadId"), // Relación con especialidad
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Atributo = typeof atributos.$inferSelect;
export type InsertAtributo = typeof atributos.$inferInsert;

/**
 * Tabla principal de ítems de calidad
 */
export const items = mysqlTable("items", {
  id: int("id").autoincrement().primaryKey(),
  codigo: varchar("codigo", { length: 50 }).notNull().unique(),
  qrCode: varchar("qrCode", { length: 255 }),
  
  // Relaciones
  empresaId: int("empresaId").notNull(),
  unidadId: int("unidadId").notNull(),
  especialidadId: int("especialidadId").notNull(),
  atributoId: int("atributoId"),
  defectoId: int("defectoId"), // Relación con catálogo de defectos
  
  // Usuarios involucrados
  residenteId: int("residenteId").notNull(),
  jefeResidenteId: int("jefeResidenteId"),
  supervisorId: int("supervisorId"),
  
  // Descripción del problema
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  ubicacionDetalle: varchar("ubicacionDetalle", { length: 255 }),
  
  // Fotos
  fotoAntesUrl: text("fotoAntesUrl"),
  fotoAntesKey: varchar("fotoAntesKey", { length: 255 }),
  fotoAntesMarcadaUrl: text("fotoAntesMarcadaUrl"),
  fotoAntesMarcadaKey: varchar("fotoAntesMarcadaKey", { length: 255 }),
  fotoDespuesUrl: text("fotoDespuesUrl"),
  fotoDespuesKey: varchar("fotoDespuesKey", { length: 255 }),
  
  // Estado y flujo de aprobación
  status: mysqlEnum("status", ["pendiente_foto_despues", "pendiente_aprobacion", "aprobado", "rechazado"]).default("pendiente_foto_despues").notNull(),
  
  // Fechas del flujo
  fechaCreacion: timestamp("fechaCreacion").defaultNow().notNull(),
  fechaFotoDespues: timestamp("fechaFotoDespues"),
  fechaAprobacion: timestamp("fechaAprobacion"),
  
  // Comentarios
  comentarioResidente: text("comentarioResidente"),
  comentarioJefeResidente: text("comentarioJefeResidente"),
  comentarioSupervisor: text("comentarioSupervisor"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Item = typeof items.$inferSelect;
export type InsertItem = typeof items.$inferInsert;

/**
 * Historial de cambios de estado de los ítems
 */
export const itemHistorial = mysqlTable("item_historial", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  statusAnterior: varchar("statusAnterior", { length: 50 }),
  statusNuevo: varchar("statusNuevo", { length: 50 }).notNull(),
  comentario: text("comentario"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ItemHistorial = typeof itemHistorial.$inferSelect;
export type InsertItemHistorial = typeof itemHistorial.$inferInsert;

/**
 * Tabla de notificaciones
 */
export const notificaciones = mysqlTable("notificaciones", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull(),
  itemId: int("itemId"),
  tipo: varchar("tipo", { length: 50 }).notNull(), // 'item_pendiente', 'item_aprobado', 'item_rechazado', etc.
  titulo: varchar("titulo", { length: 255 }).notNull(),
  mensaje: text("mensaje"),
  leida: boolean("leida").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notificacion = typeof notificaciones.$inferSelect;
export type InsertNotificacion = typeof notificaciones.$inferInsert;

/**
 * Tabla de comentarios de ítems
 */
export const comentarios = mysqlTable("comentarios", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  etapa: varchar("etapa", { length: 50 }).notNull(), // 'creacion', 'revision', 'aprobacion'
  texto: text("texto").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Comentario = typeof comentarios.$inferSelect;
export type InsertComentario = typeof comentarios.$inferInsert;


/**
 * Tabla de bitácora de actividades - registro de todas las acciones de usuarios
 */
export const bitacora = mysqlTable("bitacora", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull(),
  accion: varchar("accion", { length: 100 }).notNull(), // 'login', 'logout', 'crear_item', 'aprobar_item', etc.
  entidad: varchar("entidad", { length: 50 }), // 'item', 'empresa', 'usuario', etc.
  entidadId: int("entidadId"),
  detalles: text("detalles"), // JSON con información adicional
  ip: varchar("ip", { length: 45 }),
  userAgent: varchar("userAgent", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bitacora = typeof bitacora.$inferSelect;
export type InsertBitacora = typeof bitacora.$inferInsert;

/**
 * Tabla de configuración del sistema
 */
export const configuracion = mysqlTable("configuracion", {
  id: int("id").autoincrement().primaryKey(),
  clave: varchar("clave", { length: 100 }).notNull().unique(),
  valor: text("valor"),
  descripcion: varchar("descripcion", { length: 255 }),
  soloSuperadmin: boolean("soloSuperadmin").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Configuracion = typeof configuracion.$inferSelect;
export type InsertConfiguracion = typeof configuracion.$inferInsert;


/**
 * Tabla de metas - objetivos de calidad por empresa/unidad
 */
export const metas = mysqlTable("metas", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  tipo: varchar("tipo", { length: 50 }).notNull(), // 'aprobacion', 'tiempo_resolucion', 'items_mes'
  valorObjetivo: int("valorObjetivo").notNull(),
  unidadMedida: varchar("unidadMedida", { length: 50 }), // '%', 'días', 'items'
  empresaId: int("empresaId"), // null = aplica a todas
  unidadId: int("unidadId"), // null = aplica a todas
  fechaInicio: timestamp("fechaInicio"),
  fechaFin: timestamp("fechaFin"),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Meta = typeof metas.$inferSelect;
export type InsertMeta = typeof metas.$inferInsert;


/**
 * Catálogo de defectos - tipos estandarizados para estadísticas
 */
export const defectos = mysqlTable("defectos", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  codigo: varchar("codigo", { length: 50 }),
  descripcion: text("descripcion"),
  especialidadId: int("especialidadId"), // Relación con especialidad
  severidad: mysqlEnum("severidad", ["leve", "moderado", "grave", "critico"]).default("moderado").notNull(),
  tiempoEstimadoResolucion: int("tiempoEstimadoResolucion"), // en horas
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Defecto = typeof defectos.$inferSelect;
export type InsertDefecto = typeof defectos.$inferInsert;
