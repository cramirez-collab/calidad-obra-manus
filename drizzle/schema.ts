import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

// Enum para roles de usuario (superadmin tiene acceso total, admin/supervisor limitado en config)
export const userRoleEnum = mysqlEnum("role", ["superadmin", "admin", "supervisor", "jefe_residente", "residente", "desarrollador"]);

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
  passwordHash: varchar("passwordHash", { length: 255 }), // Para usuarios creados manualmente
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["superadmin", "admin", "supervisor", "jefe_residente", "residente", "desarrollador"]).default("residente").notNull(),
  empresaId: int("empresaId"),
  proyectoActivoId: int("proyectoActivoId"), // Proyecto actualmente seleccionado por el usuario
  fotoUrl: text("fotoUrl"), // URL de la foto de perfil del usuario
  fotoBase64: text("fotoBase64"), // Foto de perfil en base64 (alternativa a S3)
  telefono: varchar("telefono", { length: 20 }), // Teléfono de contacto
  terminosAceptados: boolean("terminosAceptados").default(false).notNull(), // Si aceptó términos y condiciones
  fechaAceptacionTerminos: timestamp("fechaAceptacionTerminos"), // Fecha de aceptación de términos
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  lastActiveAt: timestamp("lastActiveAt"), // Heartbeat: última actividad en la app
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tabla de proyectos - entidad principal que agrupa todo
 */
export const proyectos = mysqlTable("proyectos", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  nombreReporte: varchar("nombreReporte", { length: 255 }), // Nombre personalizado para reportes
  codigo: varchar("codigo", { length: 50 }),
  descripcion: text("descripcion"),
  logoUrl: text("logoUrl"),
  imagenPortadaUrl: text("imagenPortadaUrl"), // Imagen de portada para tarjeta de proyecto
  imagenPortadaBase64: text("imagenPortadaBase64"), // Imagen de portada en base64 (alternativa a S3)
  direccion: varchar("direccion", { length: 500 }),
  cliente: varchar("cliente", { length: 255 }),
  fechaInicio: timestamp("fechaInicio"),
  fechaFin: timestamp("fechaFin"),
  // Enlaces externos configurables por proyecto
  linkCurvas: text("linkCurvas"),
  linkSecuencias: text("linkSecuencias"),
  linkVisor: text("linkVisor"),
  linkPlanos: text("linkPlanos"),
  linkManuales: text("linkManuales"),
  linkEspecificaciones: text("linkEspecificaciones"),
  // Títulos personalizados para enlaces externos
  tituloCurvas: varchar("tituloCurvas", { length: 100 }),
  tituloSecuencias: varchar("tituloSecuencias", { length: 100 }),
  tituloVisor: varchar("tituloVisor", { length: 100 }),
  tituloPlanos: varchar("tituloPlanos", { length: 100 }),
  tituloManuales: varchar("tituloManuales", { length: 100 }),
  tituloEspecificaciones: varchar("tituloEspecificaciones", { length: 100 }),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Proyecto = typeof proyectos.$inferSelect;
export type InsertProyecto = typeof proyectos.$inferInsert;

/**
 * Tabla de relación proyecto-usuario
 */
export const proyectoUsuarios = mysqlTable("proyecto_usuarios", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  rolEnProyecto: mysqlEnum("rolEnProyecto", ["admin", "supervisor", "jefe_residente", "residente", "desarrollador"]).default("residente").notNull(),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProyectoUsuario = typeof proyectoUsuarios.$inferSelect;
export type InsertProyectoUsuario = typeof proyectoUsuarios.$inferInsert;

/**
 * Tabla de empresas/contratistas
 */
export const empresas = mysqlTable("empresas", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId"), // Relación con proyecto
  especialidadId: int("especialidadId"), // Relación con especialidad
  residenteId: int("residenteId"), // Usuario residente asignado
  jefeResidenteId: int("jefeResidenteId"), // Usuario jefe de residente asignado
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
  proyectoId: int("proyectoId"), // Relación con proyecto
  empresaId: int("empresaId"), // Relación con empresa
  nombre: varchar("nombre", { length: 255 }).notNull(),
  codigo: varchar("codigo", { length: 50 }),
  nivel: int("nivel"), // Nivel/piso para vista panorámica
  orden: int("orden").default(0), // Orden dentro del nivel para drag & drop
  descripcion: text("descripcion"),
  ubicacion: varchar("ubicacion", { length: 255 }),
  fechaInicio: timestamp("fechaInicio"), // Fecha inicio de trabajos
  fechaFin: timestamp("fechaFin"), // Fecha fin de trabajos
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Unidad = typeof unidades.$inferSelect;
export type InsertUnidad = typeof unidades.$inferInsert;

/**
 * Tabla de espacios - áreas dentro de cada unidad (sala, comedor, recámaras, baños, etc.)
 */
export const espacios = mysqlTable("espacios", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId"), // Relación con proyecto
  unidadId: int("unidadId"), // Relación con unidad (null = espacio genérico del proyecto)
  nombre: varchar("nombre", { length: 255 }).notNull(),
  codigo: varchar("codigo", { length: 50 }),
  descripcion: text("descripcion"),
  orden: int("orden").default(0), // Orden para mostrar
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Espacio = typeof espacios.$inferSelect;
export type InsertEspacio = typeof espacios.$inferInsert;

/**
 * Tabla de especialidades (electricidad, plomería, acabados, etc.)
 */
export const especialidades = mysqlTable("especialidades", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId"), // Relación con proyecto
  residenteId: int("residenteId"), // Usuario residente responsable de esta especialidad
  numero: int("numero"), // Número secuencial asignado automáticamente (1, 2, 3...)
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
  proyectoId: int("proyectoId"), // Relación con proyecto
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
  proyectoId: int("proyectoId"), // Relación con proyecto
  empresaId: int("empresaId").notNull(),
  unidadId: int("unidadId").notNull(),
  especialidadId: int("especialidadId"), // Opcional
  atributoId: int("atributoId"),
  defectoId: int("defectoId"), // Relación con catálogo de defectos
  espacioId: int("espacioId"), // Relación con espacio (Sala, Cocina, etc.)
  
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
  fotoAntesBase64: text("fotoAntesBase64"), // Foto antes en base64 (carga inmediata)
  fotoAntesMarcadaUrl: text("fotoAntesMarcadaUrl"),
  fotoAntesMarcadaKey: varchar("fotoAntesMarcadaKey", { length: 255 }),
  fotoAntesMarcadaBase64: text("fotoAntesMarcadaBase64"), // Foto antes marcada en base64
  fotoDespuesUrl: text("fotoDespuesUrl"),
  fotoDespuesKey: varchar("fotoDespuesKey", { length: 255 }),
  fotoDespuesBase64: text("fotoDespuesBase64"), // Foto después en base64 (carga inmediata)
  
  // Estado y flujo de aprobación
  status: mysqlEnum("status", ["pendiente_foto_despues", "pendiente_aprobacion", "aprobado", "rechazado"]).default("pendiente_foto_despues").notNull(),
  
  // Fechas del flujo
  fechaCreacion: timestamp("fechaCreacion").defaultNow().notNull(),
  fechaFotoDespues: timestamp("fechaFotoDespues"),
  fechaAprobacion: timestamp("fechaAprobacion"),
  fechaCierre: timestamp("fechaCierre"), // Fecha de cierre definitivo del ítem
  
  // Trazabilidad completa - IDs de usuarios en cada etapa
  creadoPorId: int("creadoPorId"), // Usuario que tomó la foto inicial
  asignadoAId: int("asignadoAId"), // Usuario residente asignado para corregir
  aprobadoPorId: int("aprobadoPorId"), // Usuario que aprobó/rechazó
  cerradoPorId: int("cerradoPorId"), // Usuario que cerró el ítem
  
  // Comentarios
  comentarioResidente: text("comentarioResidente"),
  comentarioJefeResidente: text("comentarioJefeResidente"),
  comentarioSupervisor: text("comentarioSupervisor"),
  
  // ID de cliente para evitar duplicados (generado en el cliente)
  clientId: varchar("clientId", { length: 100 }),
  
  // Número consecutivo interno (solo control, no participa en QR)
  numeroInterno: int("numeroInterno").default(0).notNull(),
  
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
/**
 * Tabla de suscripciones push para notificaciones al celular
 */
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

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
  proyectoId: int("proyectoId"), // Relación con proyecto
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


/**
 * Tabla de mensajes por ítem - sistema de chat con @mentions
 */
export const mensajes = mysqlTable("mensajes", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  texto: text("texto").notNull(),
  menciones: text("menciones"), // JSON array de userIds mencionados
  editado: boolean("editado").default(false).notNull(),
  eliminado: boolean("eliminado").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Mensaje = typeof mensajes.$inferSelect;
export type InsertMensaje = typeof mensajes.$inferInsert;

/**
 * Tabla de badges/contadores por usuario
 */
export const userBadges = mysqlTable("user_badges", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull().unique(),
  rechazados: int("rechazados").default(0).notNull(), // Badge rojo
  aprobadosJefe: int("aprobadosJefe").default(0).notNull(), // Badge verde
  aprobadosSupervisor: int("aprobadosSupervisor").default(0).notNull(), // Badge azul
  mensajesNoLeidos: int("mensajesNoLeidos").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = typeof userBadges.$inferInsert;

/**
 * Tabla de auditoría completa - registro detallado de todas las acciones
 */
export const auditoria = mysqlTable("auditoria", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull(),
  usuarioNombre: varchar("usuarioNombre", { length: 255 }),
  usuarioRol: varchar("usuarioRol", { length: 50 }),
  accion: varchar("accion", { length: 100 }).notNull(),
  categoria: varchar("categoria", { length: 50 }).notNull(), // 'item', 'usuario', 'empresa', 'sistema'
  entidadTipo: varchar("entidadTipo", { length: 50 }), // 'item', 'empresa', 'usuario', etc.
  entidadId: int("entidadId"),
  entidadCodigo: varchar("entidadCodigo", { length: 100 }), // código del ítem, nombre de empresa, etc.
  valorAnterior: text("valorAnterior"), // JSON con estado anterior
  valorNuevo: text("valorNuevo"), // JSON con estado nuevo
  detalles: text("detalles"), // Descripción legible de la acción
  ip: varchar("ip", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Auditoria = typeof auditoria.$inferSelect;
export type InsertAuditoria = typeof auditoria.$inferInsert;


/**
 * Tabla de relación empresa-especialidades (muchos a muchos)
 */
export const empresaEspecialidades = mysqlTable("empresa_especialidades", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  especialidadId: int("especialidadId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmpresaEspecialidad = typeof empresaEspecialidades.$inferSelect;
export type InsertEmpresaEspecialidad = typeof empresaEspecialidades.$inferInsert;


/**
 * Tabla de relación empresa-residentes (muchos a muchos)
 * Permite asignar múltiples residentes y jefes de residente a una empresa
 */
export const empresaResidentes = mysqlTable("empresa_residentes", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  tipoResidente: mysqlEnum("tipoResidente", ["residente", "jefe_residente"]).default("residente").notNull(),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmpresaResidente = typeof empresaResidentes.$inferSelect;
export type InsertEmpresaResidente = typeof empresaResidentes.$inferInsert;


/**
 * Tabla de historial de cambios de empresas
 * Registra todas las modificaciones realizadas a empresas, usuarios y defectos
 */
export const empresaHistorial = mysqlTable("empresa_historial", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  usuarioId: int("usuarioId").notNull(), // Quién hizo el cambio
  usuarioNombre: varchar("usuarioNombre", { length: 255 }),
  tipoAccion: mysqlEnum("tipoAccion", [
    "empresa_creada",
    "empresa_editada",
    "usuario_agregado",
    "usuario_eliminado",
    "usuario_rol_cambiado",
    "defecto_agregado",
    "defecto_editado",
    "defecto_eliminado",
    "especialidad_cambiada"
  ]).notNull(),
  descripcion: text("descripcion").notNull(), // Descripción legible del cambio
  valorAnterior: text("valorAnterior"), // JSON con estado anterior
  valorNuevo: text("valorNuevo"), // JSON con estado nuevo
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmpresaHistorial = typeof empresaHistorial.$inferSelect;
export type InsertEmpresaHistorial = typeof empresaHistorial.$inferInsert;


/**
 * Tabla de tracking de actividad de usuarios
 * Registra clics en botones de calidad y secuencias
 */
export const actividadUsuarios = mysqlTable("actividad_usuarios", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull(),
  proyectoId: int("proyectoId").notNull(),
  tipoActividad: mysqlEnum("tipoActividad", [
    "click_calidad",
    "click_secuencias", 
    "crear_item",
    "subir_foto_despues",
    "aprobar_item",
    "rechazar_item"
  ]).notNull(),
  metadata: text("metadata"), // JSON con datos adicionales
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActividadUsuario = typeof actividadUsuarios.$inferSelect;
export type InsertActividadUsuario = typeof actividadUsuarios.$inferInsert;



/**
 * Tabla de avisos - mensajes/comunicados del admin/superadmin para todos los usuarios
 */
export const avisos = mysqlTable("avisos", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId"), // null = aviso global, con valor = aviso por proyecto
  creadoPorId: int("creadoPorId").notNull(), // Admin o superadmin que creó el aviso
  titulo: varchar("titulo", { length: 255 }).notNull(),
  contenido: text("contenido").notNull(),
  prioridad: mysqlEnum("prioridad", ["normal", "urgente"]).default("normal").notNull(),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Aviso = typeof avisos.$inferSelect;
export type InsertAviso = typeof avisos.$inferInsert;

/**
 * Tabla de lecturas de avisos - registra quién leyó cada aviso y cuándo
 */
export const avisosLecturas = mysqlTable("avisos_lecturas", {
  id: int("id").autoincrement().primaryKey(),
  avisoId: int("avisoId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  leidoAt: timestamp("leidoAt").defaultNow().notNull(),
});

export type AvisoLectura = typeof avisosLecturas.$inferSelect;
export type InsertAvisoLectura = typeof avisosLecturas.$inferInsert;
