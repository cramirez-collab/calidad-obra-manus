import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal } from "drizzle-orm/mysql-core";

// Enum para roles de usuario (superadmin tiene acceso total, admin/supervisor limitado en config)
export const userRoleEnum = mysqlEnum("role", ["superadmin", "admin", "supervisor", "jefe_residente", "residente", "desarrollador", "segurista"]);

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
  role: mysqlEnum("role", ["superadmin", "admin", "supervisor", "jefe_residente", "residente", "desarrollador", "segurista"]).default("residente").notNull(),
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
  // Plazo de corrección en días (default 8)
  diasCorreccion: int("diasCorreccion").default(8).notNull(),
  // Último consecutivo QR impreso (para recordar al generar por rango)
  ultimoConsecutivoQR: int("ultimoConsecutivoQR").default(0).notNull(),
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
  rolEnProyecto: mysqlEnum("rolEnProyecto", ["admin", "supervisor", "jefe_residente", "residente", "desarrollador", "segurista"]).default("residente").notNull(),
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
  
  // Pin de ubicación en plano
  pinPlanoId: int("pinPlanoId"),
  pinPosX: varchar("pinPosX", { length: 20 }),
  pinPosY: varchar("pinPosY", { length: 20 }),
  
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
  proyectoId: int("proyectoId"), // Aislamiento por proyecto
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
  proyectoId: int("proyectoId"), // Aislamiento por proyecto
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
  proyectoId: int("proyectoId"), // Aislamiento por proyecto
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
  tipo: mysqlEnum("tipo", ["texto", "voz", "foto"]).default("texto").notNull(),
  fotoUrl: text("fotoUrl"), // URL de foto adjunta
  editado: boolean("editado").default(false).notNull(),
  eliminado: boolean("eliminado").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Mensaje = typeof mensajes.$inferSelect;
export type InsertMensaje = typeof mensajes.$inferInsert;

/**
 * Tabla de reacciones a mensajes de chat
 */
export const mensajeReacciones = mysqlTable("mensaje_reacciones", {
  id: int("id").autoincrement().primaryKey(),
  mensajeId: int("mensajeId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull(), // 👍, ✅, ❌, 👀
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MensajeReaccion = typeof mensajeReacciones.$inferSelect;
export type InsertMensajeReaccion = typeof mensajeReacciones.$inferInsert;

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


/**
 * Tabla de planos - imágenes de planos arquitectónicos por nivel/piso del proyecto
 */
export const planos = mysqlTable("planos", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  nombre: varchar("nombre", { length: 255 }).notNull(), // Ej: "Nivel 1", "Planta Baja", "Azotea"
  nivel: int("nivel").default(0), // Número de nivel/piso para ordenar
  imagenUrl: text("imagenUrl").notNull(), // URL de la imagen en S3
  imagenKey: varchar("imagenKey", { length: 500 }), // Key en S3
  descripcion: text("descripcion"),
  orden: int("orden").default(0),
  activo: boolean("activo").default(true).notNull(),
  creadoPorId: int("creadoPorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Plano = typeof planos.$inferSelect;
export type InsertPlano = typeof planos.$inferInsert;


/**
 * Tabla de pines - marcadores sobre planos vinculados a ítems de calidad
 * posX y posY son porcentajes (0-100) relativos al tamaño de la imagen del plano
 */
export const planoPines = mysqlTable("plano_pines", {
  id: int("id").autoincrement().primaryKey(),
  planoId: int("planoId").notNull(),
  itemId: int("itemId"), // Vinculado a un ítem de calidad (opcional)
  posX: decimal("posX", { precision: 8, scale: 4 }).notNull(), // % horizontal (0-100)
  posY: decimal("posY", { precision: 8, scale: 4 }).notNull(), // % vertical (0-100)
  nota: text("nota"), // Nota opcional del pin
  creadoPorId: int("creadoPorId"),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PlanoPin = typeof planoPines.$inferSelect;
export type InsertPlanoPin = typeof planoPines.$inferInsert;


/**
 * Tabla de firmas electrónicas en reportes PDF
 * Cada empresa involucrada en un reporte puede firmar electrónicamente
 */
export const firmasReporte = mysqlTable("firmas_reporte", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  reporteId: varchar("reporteId", { length: 100 }).notNull(), // ID único del reporte generado
  empresaId: int("empresaId").notNull(),
  firmadoPorId: int("firmadoPorId"), // Usuario que firmó
  firmadoPorNombre: varchar("firmadoPorNombre", { length: 255 }),
  firmadoPorEmail: varchar("firmadoPorEmail", { length: 320 }),
  firmaBase64: text("firmaBase64"), // Imagen de la firma en base64
  firmado: boolean("firmado").default(false).notNull(),
  fechaFirma: timestamp("fechaFirma"),
  ipFirma: varchar("ipFirma", { length: 45 }),
  tokenFirma: varchar("tokenFirma", { length: 255 }), // Token único para link de firma
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FirmaReporte = typeof firmasReporte.$inferSelect;
export type InsertFirmaReporte = typeof firmasReporte.$inferInsert;

/**
 * Tabla de correos enviados - bitácora de todos los correos con tracking de apertura
 */
export const bitacoraCorreos = mysqlTable("bitacora_correos", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  reporteId: varchar("reporteId", { length: 100 }), // Vinculado a un reporte (opcional)
  tipo: varchar("tipo", { length: 50 }).notNull(), // 'reporte_firmado', 'solicitud_firma', 'notificacion', etc.
  destinatarioEmail: varchar("destinatarioEmail", { length: 320 }).notNull(),
  destinatarioNombre: varchar("destinatarioNombre", { length: 255 }),
  destinatarioEmpresa: varchar("destinatarioEmpresa", { length: 255 }),
  asunto: varchar("asunto", { length: 500 }).notNull(),
  contenido: text("contenido"), // Resumen del contenido
  leyenda: text("leyenda"), // Leyenda legal incluida
  enviadoPorId: int("enviadoPorId"),
  enviadoPorNombre: varchar("enviadoPorNombre", { length: 255 }),
  enviado: boolean("enviado").default(false).notNull(),
  fechaEnvio: timestamp("fechaEnvio"),
  abierto: boolean("abierto").default(false).notNull(),
  fechaApertura: timestamp("fechaApertura"), // Fecha y hora de apertura del correo
  ipApertura: varchar("ipApertura", { length: 45 }),
  tokenTracking: varchar("tokenTracking", { length: 255 }), // Token único para pixel de tracking
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BitacoraCorreo = typeof bitacoraCorreos.$inferSelect;
export type InsertBitacoraCorreo = typeof bitacoraCorreos.$inferInsert;


/**
 * Tabla de reportes de análisis IA - almacena análisis profundos y resúmenes ejecutivos generados por IA
 */
export const reportesIA = mysqlTable("reportes_ia", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  tipo: mysqlEnum("tipo_reporte", ["analisis_profundo", "resumen_ejecutivo"]).default("analisis_profundo").notNull(),
  titulo: varchar("titulo", { length: 500 }).notNull(),
  contenido: text("contenido").notNull(), // Markdown del análisis completo
  resumenEjecutivo: text("resumenEjecutivo"), // Resumen ejecutivo (max 1 cuartilla)
  datosAnalizados: text("datosAnalizados"), // JSON con snapshot de datos usados para el análisis
  pdfUrl: text("pdfUrl"), // URL del PDF generado en S3
  pdfKey: varchar("pdfKey", { length: 500 }), // Key del PDF en S3
  enviado: boolean("enviado").default(false).notNull(), // Si ya fue enviado por email
  fechaEnvio: timestamp("fechaEnvio"), // Fecha del envío automático
  destinatariosEnvio: text("destinatariosEnvio"), // JSON array de emails a los que se envió
  version: int("version").default(1).notNull(), // Versión del reporte (incrementa cada semana)
  creadoPorId: int("creadoPorId"), // null = generado automáticamente, con valor = generado manualmente
  archivado: boolean("archivado").default(false).notNull(), // Si el reporte está archivado
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReporteIA = typeof reportesIA.$inferSelect;
export type InsertReporteIA = typeof reportesIA.$inferInsert;


// ============================================================
// MÓDULO DE PRUEBAS POR DEPARTAMENTO
// ============================================================

/**
 * Catálogo de pruebas - define todas las pruebas que se aplican a departamentos
 * Agrupadas por sistema (Eléctrico, Hidráulico, Gas, Acabados, etc.)
 */
export const catalogoPruebas = mysqlTable("catalogo_pruebas", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  sistema: varchar("sistema", { length: 100 }).notNull(), // Eléctrico, Hidráulico, Gas, Acabados, Carpintería, etc.
  nombre: varchar("nombre", { length: 255 }).notNull(), // Nombre de la prueba
  descripcion: text("descripcion"), // Descripción detallada de qué se evalúa
  orden: int("orden").default(0).notNull(), // Orden dentro del sistema
  requiereEvidencia: boolean("requiereEvidencia").default(true).notNull(), // Si la foto es obligatoria
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CatalogoPrueba = typeof catalogoPruebas.$inferSelect;
export type InsertCatalogoPrueba = typeof catalogoPruebas.$inferInsert;

/**
 * Resultados de pruebas - estado actual de cada celda (unidad × prueba × intento)
 * Estados: verde (pasa), rojo (no pasa), na (no aplica), pendiente (sin evaluar)
 */
export const pruebasResultado = mysqlTable("pruebas_resultado", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  unidadId: int("unidadId").notNull(), // Departamento evaluado
  pruebaId: int("pruebaId").notNull(), // Referencia a catalogo_pruebas
  intento: mysqlEnum("intento", ["intento_1", "intento_final"]).notNull(),
  estado: mysqlEnum("estado_prueba", ["verde", "rojo", "na", "pendiente"]).default("pendiente").notNull(),
  observacion: text("observacion"), // Obligatoria si estado = rojo
  evidenciaUrl: text("evidenciaUrl"), // URL de foto de evidencia en S3
  evidenciaKey: varchar("evidenciaKey", { length: 500 }),
  evaluadoPorId: int("evaluadoPorId").notNull(), // Usuario que evaluó
  evaluadoPorNombre: varchar("evaluadoPorNombre", { length: 255 }),
  evaluadoAt: timestamp("evaluadoAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PruebaResultado = typeof pruebasResultado.$inferSelect;
export type InsertPruebaResultado = typeof pruebasResultado.$inferInsert;

/**
 * Bitácora inmutable de pruebas - log de todas las acciones con hash SHA-256 encadenado
 * Cada registro tiene el hash del registro anterior para garantizar integridad
 */
export const pruebasBitacora = mysqlTable("pruebas_bitacora", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  unidadId: int("unidadId").notNull(),
  pruebaId: int("pruebaId").notNull(),
  resultadoId: int("resultadoId"), // Referencia al resultado creado/modificado
  accion: mysqlEnum("accion_bitacora", ["evaluacion", "correccion", "liberacion", "revocacion"]).notNull(),
  intento: mysqlEnum("intento_bitacora", ["intento_1", "intento_final"]).notNull(),
  estadoAnterior: varchar("estadoAnterior", { length: 20 }),
  estadoNuevo: varchar("estadoNuevo", { length: 20 }).notNull(),
  observacion: text("observacion"),
  evidenciaUrl: text("evidenciaUrl"),
  usuarioId: int("usuarioId").notNull(),
  usuarioNombre: varchar("usuarioNombre", { length: 255 }).notNull(),
  hashActual: varchar("hashActual", { length: 64 }).notNull(), // SHA-256 de este registro
  hashAnterior: varchar("hashAnterior", { length: 64 }), // SHA-256 del registro anterior (null para el primero)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PruebaBitacora = typeof pruebasBitacora.$inferSelect;
export type InsertPruebaBitacora = typeof pruebasBitacora.$inferInsert;

// ==========================================
// MÓDULO DE SEGURIDAD
// ==========================================

/**
 * Incidentes de seguridad reportados en obra
 */
export const incidentesSeguridad = mysqlTable("incidentes_seguridad", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  codigo: varchar("codigo", { length: 50 }), // SEG00001, SEG00002...
  reportadoPor: int("reportadoPor").notNull(), // userId
  tipo: mysqlEnum("tipo_incidente", [
    "caida",
    "golpe",
    "corte",
    "electrico",
    "derrumbe",
    "incendio",
    "quimico",
    "epp_faltante",
    "condicion_insegura",
    "acto_inseguro",
    "casi_accidente",
    "otro",
  ]).notNull(),
  severidad: mysqlEnum("severidad_incidente", ["baja", "media", "alta", "critica"]).notNull(),
  descripcion: text("descripcion").notNull(),
  ubicacion: varchar("ubicacion", { length: 255 }), // zona/nivel/área
  unidadId: int("unidadId"), // opcional, vinculado a unidad
  fotoUrl: text("fotoUrl"),
  fotoBase64: text("fotoBase64"),
  fotoMarcadaUrl: text("fotoMarcadaUrl"), // Foto con marcas/rayado
  fotoMarcadaBase64: text("fotoMarcadaBase64"), // Foto marcada en base64
  estado: mysqlEnum("estado_incidente", ["abierto", "en_proceso", "cerrado", "prevencion"]).default("abierto").notNull(),
  accionCorrectiva: text("accionCorrectiva"),
  asignadoA: int("asignadoA"), // userId del segurista/responsable asignado
  cerradoPor: int("cerradoPor"),
  fechaCierre: timestamp("fechaCierre"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IncidenteSeguridad = typeof incidentesSeguridad.$inferSelect;
export type InsertIncidenteSeguridad = typeof incidentesSeguridad.$inferInsert;

/**
 * Evidencias de seguimiento/resolución subidas por el segurista asignado
 */
export const evidenciasSeguridad = mysqlTable("evidencias_seguridad", {
  id: int("id").autoincrement().primaryKey(),
  incidenteId: int("incidenteId").notNull(),
  usuarioId: int("usuarioId").notNull(), // quien subió la evidencia
  fotoUrl: text("fotoUrl").notNull(), // URL de la foto en S3
  descripcion: text("descripcion"), // descripción opcional de la evidencia
  tipo: mysqlEnum("tipo_evidencia", ["seguimiento", "resolucion", "prevencion"]).default("seguimiento").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EvidenciaSeguridad = typeof evidenciasSeguridad.$inferSelect;
export type InsertEvidenciaSeguridad = typeof evidenciasSeguridad.$inferInsert;

/**
 * Bitácora de seguridad - Historial de acciones por incidente
 */
export const bitacoraSeguridad = mysqlTable("bitacora_seguridad", {
  id: int("id").autoincrement().primaryKey(),
  incidenteId: int("incidenteId").notNull(),
  proyectoId: int("proyectoId").notNull(),
  usuarioId: int("usuarioId").notNull(), // quien realizó la acción
  accion: mysqlEnum("accion_bitacora", [
    "creacion",
    "cambio_estado",
    "asignacion",
    "edicion",
    "eliminacion_mensaje",
    "nota_voz",
    "foto_enviada",
    "foto_marcada",
    "mensaje_enviado",
    "exportar_pdf",
    "cambio_severidad",
  ]).notNull(),
  detalle: text("detalle"), // descripción legible del cambio
  valorAnterior: text("valorAnterior"), // estado/valor anterior
  valorNuevo: text("valorNuevo"), // estado/valor nuevo
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BitacoraSeguridad = typeof bitacoraSeguridad.$inferSelect;
export type InsertBitacoraSeguridad = typeof bitacoraSeguridad.$inferInsert;

/**
 * Checklists de seguridad (encabezado)
 */
export const checklistsSeguridad = mysqlTable("checklists_seguridad", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  creadoPor: int("creadoPor").notNull(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  ubicacion: varchar("ubicacion", { length: 255 }),
  unidadId: int("unidadId"),
  completado: boolean("completado").default(false).notNull(),
  puntajeTotal: int("puntajeTotal").default(0),
  puntajeObtenido: int("puntajeObtenido").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChecklistSeguridad = typeof checklistsSeguridad.$inferSelect;
export type InsertChecklistSeguridad = typeof checklistsSeguridad.$inferInsert;

/**
 * Items individuales del checklist de seguridad
 */
export const checklistItemsSeguridad = mysqlTable("checklist_items_seguridad", {
  id: int("id").autoincrement().primaryKey(),
  checklistId: int("checklistId").notNull(),
  categoria: varchar("categoria", { length: 100 }).notNull(), // EPP, Señalización, Orden, etc.
  pregunta: varchar("pregunta", { length: 500 }).notNull(),
  cumple: mysqlEnum("cumple_check", ["si", "no", "na"]).default("na").notNull(),
  observacion: text("observacion"),
  orden: int("orden").default(0).notNull(),
});

export type ChecklistItemSeguridad = typeof checklistItemsSeguridad.$inferSelect;
export type InsertChecklistItemSeguridad = typeof checklistItemsSeguridad.$inferInsert;


/**
 * Notas de voz del módulo de seguridad
 * El usuario graba audio, se transcribe con Whisper, se generan 5 bullets con LLM
 */
export const notasVozSeguridad = mysqlTable("notas_voz_seguridad", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyecto_id").notNull(),
  incidenteId: int("incidente_id"), // Opcional: puede estar vinculada a un incidente
  creadoPorId: int("creado_por_id").notNull(),
  audioUrl: text("audio_url"), // URL del audio en S3
  transcripcion: text("transcripcion"), // Texto completo transcrito
  bullets: text("bullets"), // JSON array con los 5 bullets de resumen
  duracionSegundos: int("duracion_segundos"),
  fechaCreacion: timestamp("fecha_creacion").defaultNow().notNull(),
});
export type NotaVozSeguridad = typeof notasVozSeguridad.$inferSelect;
export type InsertNotaVozSeguridad = typeof notasVozSeguridad.$inferInsert;


/**
 * Mensajes/chat por incidente de seguridad
 * Replica el patrón de mensajes por ítem de calidad, con soporte para notas de voz
 */
export const mensajesSeguridad = mysqlTable("mensajes_seguridad", {
  id: int("id").autoincrement().primaryKey(),
  incidenteId: int("incidente_id").notNull(),
  usuarioId: int("usuario_id").notNull(),
  texto: text("texto").notNull(),
  // Campos de nota de voz (opcionales)
  audioUrl: text("audio_url"),
  transcripcion: text("transcripcion"),
  bullets: text("bullets"), // JSON array con 5 bullets de resumen
  duracionSegundos: int("duracion_segundos"),
  fotoUrl: text("foto_url"), // URL de foto adjunta en mensaje
  tipo: mysqlEnum("tipo", ["texto", "voz", "foto"]).default("texto").notNull(),
  editado: boolean("editado").default(false).notNull(),
  eliminado: boolean("eliminado").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type MensajeSeguridad = typeof mensajesSeguridad.$inferSelect;
export type InsertMensajeSeguridad = typeof mensajesSeguridad.$inferInsert;


/**
 * Tipos de incidencia personalizados por proyecto
 * Permite a admins agregar, renombrar y desactivar tipos de incidencia
 * Los tipos base del enum siguen existiendo; esta tabla los extiende/sobreescribe
 */
export const tiposIncidenciaCustom = mysqlTable("tipos_incidencia_custom", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  clave: varchar("clave", { length: 100 }).notNull(), // valor interno (slug)
  label: varchar("label", { length: 150 }).notNull(), // nombre visible
  icono: varchar("icono", { length: 50 }).default("ClipboardList"), // nombre del icono Lucide
  color: varchar("color", { length: 100 }).default("bg-gray-100 text-gray-700"), // clases CSS
  iconColor: varchar("iconColor", { length: 50 }).default("text-gray-600"),
  activo: boolean("activo").default(true).notNull(),
  orden: int("orden").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TipoIncidenciaCustom = typeof tiposIncidenciaCustom.$inferSelect;
export type InsertTipoIncidenciaCustom = typeof tiposIncidenciaCustom.$inferInsert;

/**
 * Plantillas rápidas de incidentes de seguridad
 * Permiten reportar incidentes frecuentes con un solo tap
 * Editables por admin/superadmin en Configuración
 */
export const plantillasIncidencia = mysqlTable("plantillas_incidencia", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  nombre: varchar("nombre", { length: 100 }).notNull(), // nombre corto visible en chip
  tipo: mysqlEnum("tipo_plantilla", [
    "caida", "golpe", "corte", "electrico", "derrumbe", "incendio",
    "quimico", "epp_faltante", "condicion_insegura", "acto_inseguro",
    "casi_accidente", "otro",
  ]).notNull(),
  severidad: mysqlEnum("severidad_plantilla", ["baja", "media", "alta", "critica"]).notNull(),
  descripcion: text("descripcion").notNull(), // descripción predeterminada
  activo: boolean("activo").default(true).notNull(),
  orden: int("orden").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlantillaIncidencia = typeof plantillasIncidencia.$inferSelect;
export type InsertPlantillaIncidencia = typeof plantillasIncidencia.$inferInsert;

/**
 * Historial de reportes ejecutivos de seguridad generados por IA
 * Guarda el markdown, metadata y permite comparar evolución entre períodos
 */
export const reportesSeguridad = mysqlTable("reportes_seguridad", {
  id: int("id").autoincrement().primaryKey(),
  proyectoId: int("proyectoId").notNull(),
  generadoPorId: int("generadoPorId").notNull(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  markdown: text("markdown").notNull(), // Contenido completo del reporte en markdown
  resumenCorto: text("resumenCorto"), // Resumen de 1-2 líneas para la lista
  // Snapshot de KPIs al momento de generar para comparación
  totalIncidentes: int("totalIncidentes").default(0),
  abiertos: int("abiertos").default(0),
  enProceso: int("enProceso").default(0),
  prevencion: int("prevencion").default(0),
  cerrados: int("cerrados").default(0),
  totalSeguristas: int("totalSeguristas").default(0),
  // Fotos de evidencia incluidas en el reporte
  fotosEvidenciaUrls: text("fotosEvidenciaUrls"), // JSON array de URLs de fotos
  fechaGeneracion: timestamp("fechaGeneracion").defaultNow().notNull(),
});

export type ReporteSeguridad = typeof reportesSeguridad.$inferSelect;
export type InsertReporteSeguridad = typeof reportesSeguridad.$inferInsert;
