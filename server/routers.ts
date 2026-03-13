import { COOKIE_NAME } from "@shared/const";
import { socketEvents } from "./socket";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
// Schema tables accessed via db.* helpers only
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { sendEmail, getAprobadoEmailTemplate, getRechazadoEmailTemplate, getPendienteAprobacionEmailTemplate } from "./emailService";
import pushService from "./pushService";
import { transcribeAudio, transcribeAudioBase64 } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";

// Throttle map para heartbeat (evita writes excesivos a BD)
const heartbeatThrottle = new Map<number, number>();
// Limpiar throttle cada 10 min para evitar memory leak
setInterval(() => heartbeatThrottle.clear(), 10 * 60 * 1000);

// Middleware para verificar rol de superadmin (acceso total)
const superadminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'superadmin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acceso denegado. Se requiere rol de superadministrador.' });
  }
  return next({ ctx });
});

// Middleware para verificar rol de admin o superadmin
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['superadmin', 'admin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  return next({ ctx });
});

// Middleware para verificar rol de supervisor o superior
const supervisorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['superadmin', 'admin', 'supervisor'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acceso denegado. Se requiere rol de supervisor.' });
  }
  return next({ ctx });
});

// Middleware para verificar rol de jefe de residente o superior
const jefeResidenteProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['superadmin', 'admin', 'supervisor', 'jefe_residente'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acceso denegado. Se requiere rol de jefe de residente.' });
  }
  return next({ ctx });
});

// Middleware para roles que pueden subir foto después (incluye residente, excluye segurista)
const canUploadFotoProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['superadmin', 'admin', 'supervisor', 'jefe_residente', 'residente'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acceso denegado. No tienes permiso para subir fotos.' });
  }
  return next({ ctx });
});

// Middleware para excluir desarrollador y segurista de operaciones de escritura
const noDesarrolladorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === 'desarrollador') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'El rol Desarrollador solo puede ver y comentar. No puede crear, editar o eliminar registros.' });
  }
  if (ctx.user.role === 'segurista') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'El rol Segurista solo puede editar en el módulo de Seguridad.' });
  }
  return next({ ctx });
});

// Middleware para excluir segurista de operaciones de escritura fuera de Seguridad
const noSeguristaProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === 'segurista') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'El rol Segurista solo puede editar en el módulo de Seguridad.' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    
    // Login con email y contraseña
    loginWithPassword: publicProcedure
      .input(z.object({
        email: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // Normalizar email
          const cleanEmail = input.email.trim().toLowerCase();
          
          const user = await db.getUserByEmailAndPassword(cleanEmail, input.password);
          if (!user) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Email o contraseña incorrectos. Verifica tus datos.' });
          }
          if (!user.activo) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Usuario inactivo. Contacta al administrador.' });
          }
          if (!user.openId) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Error de configuración de usuario. Contacta al administrador.' });
          }
          
          // Crear token de sesión
          const { sdk } = await import('./_core/sdk');
          const sessionToken = await sdk.createSessionToken(user.openId, {
            name: user.name || '',
            expiresInMs: 365 * 24 * 60 * 60 * 1000, // 1 año
          });
          
          // Establecer cookie de sesión
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
          
          // Actualizar último acceso (no bloquear si falla)
          db.updateUserLastSignedIn(user.id).catch(e => console.error('[Auth] Error actualizando lastSignedIn:', e));
          
          console.log(`[Auth] Login exitoso: ${user.name} (${user.email}) - Rol: ${user.role}`);
          return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
        } catch (e) {
          if (e instanceof TRPCError) throw e;
          console.error('[Auth] Error inesperado en login:', e);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Error del servidor. Intenta de nuevo.' });
        }
      }),
    
    // Aceptar términos y condiciones
    aceptarTerminos: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.aceptarTerminos(ctx.user.id);
        return { success: true };
      }),
    
    // Verificar si el usuario ha aceptado los términos
    verificarTerminos: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        return { 
          aceptados: user?.terminosAceptados || false,
          fechaAceptacion: user?.fechaAceptacionTerminos || null
        };
      }),
  }),

  // ==================== USUARIOS ====================
  users: router({
    list: adminProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        if (input?.proyectoId) {
          // Filtrar usuarios por proyecto - extraer solo los datos del usuario
          const usuariosProyecto = await db.getUsuariosByProyecto(input.proyectoId);
          return usuariosProyecto.map(up => up.usuario).filter((u): u is NonNullable<typeof u> => u !== undefined);
        }
        return await db.getAllUsers();
      }),
    
    // Lista de usuarios con empresa relacionada
    listConEmpresa: adminProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        if (input?.proyectoId) {
          // Filtrar usuarios por proyecto y agregar empresa
          const usuariosProyecto = await db.getUsuariosByProyecto(input.proyectoId);
          const todasEmpresas = await db.getAllEmpresas(input.proyectoId);
          const empresasMap = new Map(todasEmpresas.map(e => [e.id, e]));
          
          return usuariosProyecto
            .map(up => up.usuario)
            .filter((u): u is NonNullable<typeof u> => u !== undefined)
            .map(usuario => ({
              ...usuario,
              empresa: usuario.empresaId ? empresasMap.get(usuario.empresaId) || null : null
            }));
        }
        return await db.getAllUsersConEmpresa();
      }),
    
    // Lista de usuarios sin proyecto asignado (disponibles para asignar)
    sinProyecto: adminProcedure.query(async () => {
      return await db.getUsuariosSinProyecto();
    }),
    
    // Lista de residentes con estadísticas completas
    residentes: protectedProcedure.query(async () => {
      return await db.getAllResidentesConEstadisticas();
    }),
    
    // Obtener residente con datos completos en cadena
    residenteCompleto: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getResidenteConDatosCompletos(input.id);
      }),
    
    // Obtener usuario por ID
    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getUserById(input.id);
      }),
    
    byRole: adminProcedure
      .input(z.object({ role: z.string() }))
      .query(async ({ input }) => {
        return await db.getUsersByRole(input.role);
      }),
    
    // Usuarios por empresa
    byEmpresa: adminProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return await db.getUsersByEmpresa(input.empresaId);
      }),
    
    // Crear usuario manualmente
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        password: z.string().min(6),
        role: z.enum(['superadmin', 'admin', 'supervisor', 'jefe_residente', 'residente', 'desarrollador', 'segurista']),
        empresaId: z.number().nullable().optional(),
        proyectoId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { proyectoId, ...userData } = input;
        const id = await db.createUserWithPassword(userData);
        // Si se especificó un proyecto, asignar el usuario al proyecto
        if (proyectoId && id) {
          await db.asignarUsuarioAProyecto({
            proyectoId,
            usuarioId: id,
            rolEnProyecto: input.role === 'superadmin' ? 'admin' : input.role as any,
          });
        }
        return { id, success: true };
      }),
    
    // Actualizar usuario completo
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        role: z.enum(['superadmin', 'admin', 'supervisor', 'jefe_residente', 'residente', 'desarrollador', 'segurista']).optional(),
        empresaId: z.number().nullable().optional(),
        activo: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateUserWithPassword(id, data);
        return { success: true };
      }),
    
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(['admin', 'supervisor', 'jefe_residente', 'residente', 'segurista']) }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),
    
    updateEmpresa: adminProcedure
      .input(z.object({ userId: z.number(), empresaId: z.number().nullable() }))
      .mutation(async ({ input }) => {
        await db.updateUserEmpresa(input.userId, input.empresaId);
        return { success: true };
      }),
    
    // Obtener proyecto activo del usuario actual
    getProyectoActivo: protectedProcedure.query(async ({ ctx }) => {
      const proyectoId = await db.getProyectoActivoUsuario(ctx.user.id);
      return { proyectoId };
    }),
    
    // Eliminar usuario permanentemente (solo superadmin)
    delete: superadminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteUser(input.id);
        return { success: true };
      }),
    
    // Cambiar contraseña del usuario actual
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verificar contraseña actual
        if (!ctx.user.email) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Usuario sin email configurado' });
        }
        const user = await db.getUserByEmailAndPassword(ctx.user.email, input.currentPassword);
        if (!user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Contraseña actual incorrecta' });
        }
        // Actualizar contraseña
        await db.updateUserWithPassword(ctx.user.id, { password: input.newPassword });
        return { success: true, message: 'Contraseña actualizada correctamente' };
      }),
    
    // Cambiar proyecto activo del usuario actual
    setProyectoActivo: protectedProcedure
      .input(z.object({ proyectoId: z.number().nullable() }))
      .mutation(async ({ ctx, input }) => {
        await db.setProyectoActivoUsuario(ctx.user.id, input.proyectoId);
        // LIMPIAR CACHÉ DEL SERVIDOR al cambiar de proyecto — aislamiento agresivo
        db.invalidateCache();
        // Emitir evento de cambio de proyecto via WebSocket
        socketEvents.emitToUser(ctx.user.id, 'proyecto-activo-changed', { 
          proyectoId: input.proyectoId,
          userId: ctx.user.id 
        });
        return { success: true, proyectoId: input.proyectoId };
      }),
    
    // Actualizar foto de perfil del usuario actual
    updateFoto: protectedProcedure
      .input(z.object({ fotoBase64: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Validar formato de imagen base64
        const matches = input.fotoBase64.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Formato de imagen inválido' });
        }
        
        // Guardar directamente el base64 en la base de datos (evita problemas de S3/CloudFront)
        await db.updateUserFotoBase64(ctx.user.id, input.fotoBase64);
        return { success: true, fotoBase64: input.fotoBase64 };
      }),
    
    // Actualizar foto de perfil de cualquier usuario (solo superadmin)
    updateFotoAdmin: protectedProcedure
      .input(z.object({ userId: z.number(), fotoBase64: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Solo superadmin puede editar fotos de otros usuarios
        if (ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo el superadministrador puede editar fotos de otros usuarios' });
        }
        
        // Validar formato de imagen base64
        const matches = input.fotoBase64.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Formato de imagen inválido' });
        }
        
        // Guardar directamente el base64 en la base de datos (evita problemas de S3/CloudFront)
        await db.updateUserFotoBase64(input.userId, input.fotoBase64);
        return { success: true, fotoBase64: input.fotoBase64 };
      }),
    
    // Obtener mi perfil completo
    getMiPerfil: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserById(ctx.user.id);
    }),

    // Lista básica de usuarios para @mentions (filtrada por proyecto activo)
    listForMentions: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        let usersList;
        if (input?.proyectoId) {
          const usuariosProyecto = await db.getUsuariosByProyecto(input.proyectoId);
          usersList = usuariosProyecto.map(up => up.usuario).filter((u): u is NonNullable<typeof u> => u !== undefined);
        } else {
          usersList = await db.getAllUsers();
        }
        // Retornar solo datos básicos necesarios para menciones
        return usersList.map(u => ({
          id: u.id,
          name: u.name,
          role: u.role,
          fotoUrl: u.fotoUrl || null,
          fotoBase64: (u as any).fotoBase64 || null,
        }));
      }),
  }),

  // ==================== EMPRESAS ====================
  empresas: router({
    list: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllEmpresas(input?.proyectoId);
      }),
    
    // Lista con estadísticas de ítems
    listConEstadisticas: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllEmpresasConEstadisticas(input?.proyectoId);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmpresaById(input.id);
      }),
    
    // Obtener con datos completos en cadena (usuarios, unidades, ítems)
    getCompleta: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmpresaConDatosCompletos(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
        especialidadId: z.number().optional(),
        residenteId: z.number().nullable().optional(),
        jefeResidenteId: z.number().nullable().optional(),
        nombre: z.string().min(1),
        rfc: z.string().optional(),
        contacto: z.string().optional(),
        telefono: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createEmpresa(input);
        // Registrar en historial
        await db.createEmpresaHistorial({
          empresaId: id,
          usuarioId: ctx.user.id,
          usuarioNombre: ctx.user.name || 'Usuario',
          tipoAccion: 'empresa_creada',
          descripcion: `Empresa "${input.nombre}" creada`,
        });
        return { id, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        proyectoId: z.number().optional(),
        especialidadId: z.number().nullable().optional(),
        residenteId: z.number().nullable().optional(),
        jefeResidenteId: z.number().nullable().optional(),
        nombre: z.string().min(1).optional(),
        rfc: z.string().optional(),
        contacto: z.string().optional(),
        telefono: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateEmpresa(id, data);
        // Registrar en historial
        await db.createEmpresaHistorial({
          empresaId: id,
          usuarioId: ctx.user.id,
          usuarioNombre: ctx.user.name || 'Usuario',
          tipoAccion: 'empresa_editada',
          descripcion: `Empresa actualizada${input.nombre ? `: ${input.nombre}` : ''}`,
        });
        return { success: true };
      }),
    
    delete: superadminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteEmpresa(input.id);
        return { success: true };
      }),
    
    // Obtener especialidades asignadas a una empresa
    getEspecialidades: protectedProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEspecialidadesPorEmpresa(input.empresaId);
      }),
    
    // Asignar especialidades a una empresa
    asignarEspecialidades: adminProcedure
      .input(z.object({
        empresaId: z.number(),
        especialidadIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        await db.asignarEspecialidadesAEmpresa(input.empresaId, input.especialidadIds);
        return { success: true };
      }),
    
    // ==================== RESIDENTES POR EMPRESA ====================
    
    // Obtener residentes de una empresa
    getResidentes: protectedProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return await db.getResidentesByEmpresa(input.empresaId);
      }),
    
    // Agregar residente a empresa
    addResidente: adminProcedure
      .input(z.object({
        empresaId: z.number(),
        usuarioId: z.number(),
        tipoResidente: z.enum(['residente', 'jefe_residente']).default('residente'),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.addResidenteToEmpresa(input.empresaId, input.usuarioId, input.tipoResidente);
        // Registrar en historial
        const usuario = await db.getUserById(input.usuarioId);
        await db.createEmpresaHistorial({
          empresaId: input.empresaId,
          usuarioId: ctx.user.id,
          usuarioNombre: ctx.user.name || 'Usuario',
          tipoAccion: 'usuario_agregado',
          descripcion: `Usuario "${usuario?.name || 'Desconocido'}" agregado como ${input.tipoResidente === 'jefe_residente' ? 'Jefe de Residente' : 'Residente'}`,
        });
        return { id, success: true };
      }),
    
    // Eliminar residente de empresa
    removeResidente: superadminProcedure
      .input(z.object({
        empresaId: z.number(),
        usuarioId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Obtener info del usuario antes de eliminar
        const usuario = await db.getUserById(input.usuarioId);
        await db.removeResidenteFromEmpresa(input.empresaId, input.usuarioId);
        // Registrar en historial
        await db.createEmpresaHistorial({
          empresaId: input.empresaId,
          usuarioId: ctx.user.id,
          usuarioNombre: ctx.user.name || 'Usuario',
          tipoAccion: 'usuario_eliminado',
          descripcion: `Usuario "${usuario?.name || 'Desconocido'}" eliminado de la empresa`,
        });
        return { success: true };
      }),
    
    // Obtener todos los residentes con sus empresas (para selector de nuevo ítem)
    getAllResidentesConEmpresas: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllResidentesConEmpresas(input?.proyectoId);
      }),
    
   // Migrar datos existentes de residenteId y jefeResidenteId
    migrarResidentes: superadminProcedure
      .mutation(async () => {
        return await db.migrarResidentesExistentes();
      }),
    
    // Obtener historial de cambios de una empresa
    getHistorial: protectedProcedure
      .input(z.object({ empresaId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmpresaHistorial(input.empresaId);
      }),
    
    // Registrar cambio en historial
    registrarCambio: adminProcedure
      .input(z.object({
        empresaId: z.number(),
        tipoAccion: z.enum(['empresa_creada','empresa_editada','usuario_agregado','usuario_eliminado','usuario_rol_cambiado','defecto_agregado','defecto_editado','defecto_eliminado','especialidad_cambiada']),
        descripcion: z.string(),
        valorAnterior: z.string().optional(),
        valorNuevo: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createEmpresaHistorial({
          empresaId: input.empresaId,
          usuarioId: ctx.user.id,
          usuarioNombre: ctx.user.name || 'Usuario',
          tipoAccion: input.tipoAccion,
          descripcion: input.descripcion,
          valorAnterior: input.valorAnterior,
          valorNuevo: input.valorNuevo,
        });
        return { id, success: true };
      }),
  }),

  // ==================== UNIDADES ====================
  unidades: router({
    list: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllUnidades(input?.proyectoId);
      }),
    
    // Lista con estadísticas de ítems
    listConEstadisticas: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllUnidadesConEstadisticas(input?.proyectoId);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getUnidadById(input.id);
      }),
    
    // Obtener con datos completos en cadena (empresas, especialidades, ítems)
    getCompleta: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getUnidadConDatosCompletos(input.id);
      }),
    
    // Verificar si existe una unidad con el mismo nombre (validación en tiempo real)
    checkDuplicate: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        nombre: z.string().min(1),
        excludeId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.checkUnidadDuplicada(input.proyectoId, input.nombre, input.excludeId);
      }),
    
    create: adminProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
        empresaId: z.number().optional(),
        nombre: z.string().min(1),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        ubicacion: z.string().optional(),
        nivel: z.number().optional(),
        orden: z.number().optional(),
        fechaInicio: z.date().optional().nullable(),
        fechaFin: z.date().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createUnidad(input);
        return { id, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        proyectoId: z.number().optional(),
        empresaId: z.number().optional(),
        nombre: z.string().min(1).optional(),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        ubicacion: z.string().optional(),
        nivel: z.number().optional(),
        orden: z.number().optional(),
        fechaInicio: z.date().optional().nullable(),
        fechaFin: z.date().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateUnidad(id, data);
        return { success: true };
      }),
    
    delete: superadminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteUnidad(input.id);
        return { success: true };
      }),
    
    // Vista panorámica: obtener unidades con estadísticas para cuadrícula visual
    panoramica: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return await db.getUnidadesParaPanoramica(input.proyectoId);
      }),
    
    // Actualizar orden de unidades (para drag & drop en stacking)
    // Todos los roles pueden arrastrar unidades
    updateOrden: protectedProcedure
      .input(z.object({
        unidades: z.array(z.object({
          id: z.number(),
          orden: z.number(),
          nivel: z.number().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        await db.updateUnidadesOrden(input.unidades);
        return { success: true };
      }),

    // Importar unidades desde Excel
    importarExcel: adminProcedure
      .input(z.object({
        proyectoId: z.number(),
        unidades: z.array(z.object({
          nombre: z.string().min(1),
          codigo: z.string().optional(),
          nivel: z.number().optional(),
          fechaInicio: z.date().optional(),
          fechaFin: z.date().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const ids = await db.importarUnidadesDesdeExcel(input.proyectoId, input.unidades);
        return { ids, success: true, count: ids.length };
      }),
  }),

  // ==================== ESPECIALIDADES ====================
  especialidades: router({
    list: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllEspecialidades(input?.proyectoId);
      }),
    
    // Lista con atributos relacionados en cadena
    listConAtributos: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllEspecialidadesConAtributos(input?.proyectoId);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEspecialidadById(input.id);
      }),
    
    // Obtener con atributos relacionados
    getConAtributos: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEspecialidadConAtributos(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
        nombre: z.string().min(1),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        color: z.string().optional(),
        residenteId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createEspecialidad(input);
        return { id, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        proyectoId: z.number().optional(),
        nombre: z.string().min(1).optional(),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        color: z.string().optional(),
        residenteId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateEspecialidad(id, data);
        return { success: true };
      }),
    
    delete: superadminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteEspecialidad(input.id);
        return { success: true };
      }),
  }),

  // ==================== ESPACIOS ====================
  espacios: router({
    list: protectedProcedure
      .input(z.object({ 
        proyectoId: z.number().optional(),
        unidadId: z.number().optional() 
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllEspacios(input?.proyectoId, input?.unidadId);
      }),
    
    // Espacios por unidad específica
    byUnidad: protectedProcedure
      .input(z.object({ unidadId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEspaciosByUnidad(input.unidadId);
      }),
    
    // Espacios genéricos del proyecto (plantilla)
    plantilla: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEspaciosPlantilla(input.proyectoId);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEspacioById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
        unidadId: z.number().optional(),
        nombre: z.string().min(1),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        orden: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createEspacio(input);
        return { id, success: true };
      }),
    
    // Crear múltiples espacios de una vez (para copiar plantilla a unidad)
    createBulk: adminProcedure
      .input(z.object({
        unidadId: z.number(),
        espacios: z.array(z.object({
          nombre: z.string().min(1),
          codigo: z.string().optional(),
          descripcion: z.string().optional(),
          orden: z.number().optional(),
        }))
      }))
      .mutation(async ({ input }) => {
        const ids = await db.createEspaciosBulk(input.unidadId, input.espacios);
        return { ids, success: true };
      }),
    
    // Copiar espacios plantilla a una unidad
    copiarPlantilla: adminProcedure
      .input(z.object({
        proyectoId: z.number(),
        unidadId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const count = await db.copiarEspaciosPlantillaAUnidad(input.proyectoId, input.unidadId);
        return { count, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).optional(),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        orden: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateEspacio(id, data);
        return { success: true };
      }),
    
    delete: superadminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteEspacio(input.id);
        return { success: true };
      }),
  }),

  // ==================== ATRIBUTOS ====================
  atributos: router({
    list: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllAtributos(input?.proyectoId);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAtributoById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        nombre: z.string().min(1),
        categoria: z.string().optional(),
        descripcion: z.string().optional(),
        proyectoId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createAtributo(input);
        return { id, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).optional(),
        categoria: z.string().optional(),
        descripcion: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateAtributo(id, data);
        return { success: true };
      }),
    
    delete: superadminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAtributo(input.id);
        return { success: true };
      }),
  }),

  // ==================== ITEMS ====================
  items: router({
    list: protectedProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
        empresaId: z.number().optional(),
        unidadId: z.number().optional(),
        especialidadId: z.number().optional(),
        atributoId: z.number().optional(),
        residenteId: z.number().optional(),
        jefeResidenteId: z.number().optional(),
        supervisorId: z.number().optional(),
        creadoPorId: z.number().optional(),
        asignadoAId: z.number().optional(),
        status: z.string().optional(),
        fechaDesde: z.date().optional(),
        fechaHasta: z.date().optional(),
        busqueda: z.string().optional(),
        numeroInterno: z.number().optional(),
        limit: z.number().max(2000).default(500),
        offset: z.number().default(0),
        orderBy: z.enum(['createdAt', 'fechaCreacion', 'fechaAprobacion', 'fechaCierre', 'numeroInterno', 'status']).default('createdAt'),
        orderDir: z.enum(['asc', 'desc']).default('desc'),
      }))
      .query(async ({ input, ctx }) => {
        const filters: db.ItemFilters = { ...input };
        const limit = input.limit;
        const offset = input.offset;
        return await db.getItems(filters, limit, offset, input.orderBy, input.orderDir);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getItemById(input.id);
      }),
    
    // Mis Tareas: ítems creados por el usuario + pendientes de aprobación
    misTareas: protectedProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
        filtro: z.enum(['todos', 'creados', 'pendientes_aprobacion']).default('todos'),
      }))
      .query(async ({ input, ctx }) => {
        const userId = ctx.user.id;
        const database = await db.getDb();
        const { items: itemsTable, users, unidades, especialidades, empresas } = await import('../drizzle/schema');
        const { eq, and, or, desc, sql } = await import('drizzle-orm');
        
        let conditions: any[] = [];
        if (input.proyectoId) {
          conditions.push(eq(itemsTable.proyectoId, input.proyectoId));
        }
        
        if (input.filtro === 'creados') {
          conditions.push(eq(itemsTable.creadoPorId, userId));
        } else if (input.filtro === 'pendientes_aprobacion') {
          conditions.push(eq(itemsTable.status, 'pendiente_aprobacion'));
        } else {
          // todos: creados por mí OR pendientes de aprobación
          conditions.push(
            or(
              eq(itemsTable.creadoPorId, userId),
              eq(itemsTable.status, 'pendiente_aprobacion')
            )
          );
        }
        
        const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
        if (!database) throw new Error('Database not available');
        
        const results = await database
          .select({
            id: itemsTable.id,
            codigo: itemsTable.codigo,
            numeroInterno: itemsTable.numeroInterno,
            status: itemsTable.status,
            fotoAntesUrl: itemsTable.fotoAntesUrl,
            fotoAntesMarcadaUrl: itemsTable.fotoAntesMarcadaUrl,
            fotoDespuesUrl: itemsTable.fotoDespuesUrl,
            fechaCreacion: itemsTable.fechaCreacion,
            fechaFotoDespues: itemsTable.fechaFotoDespues,
            fechaAprobacion: itemsTable.fechaAprobacion,
            creadoPorId: itemsTable.creadoPorId,
            asignadoAId: itemsTable.asignadoAId,
            aprobadoPorId: itemsTable.aprobadoPorId,
            unidadNombre: unidades.nombre,
            especialidadNombre: especialidades.nombre,
            empresaNombre: empresas.nombre,
            creadoPorNombre: users.name,
          })
          .from(itemsTable)
          .leftJoin(unidades, eq(itemsTable.unidadId, unidades.id))
          .leftJoin(especialidades, eq(itemsTable.especialidadId, especialidades.id))
          .leftJoin(empresas, eq(itemsTable.empresaId, empresas.id))
          .leftJoin(users, eq(itemsTable.creadoPorId, users.id))
          .where(whereClause)
          .orderBy(desc(itemsTable.fechaCreacion))
          .limit(200);
        
        // Conteos
        const totalCreados = results.filter(r => r.creadoPorId === userId).length;
        const totalPendientes = results.filter(r => r.status === 'pendiente_aprobacion').length;
        
        // Agregar conteo de rondas para badge reincidente
        const { itemRondas } = await import('../drizzle/schema');
        const { inArray } = await import('drizzle-orm');
        const itemIds = results.map(r => r.id);
        let rondasMap: Record<number, number> = {};
        if (itemIds.length > 0) {
          const rondasCount = await database.select({
            itemId: itemRondas.itemId,
            totalRondas: sql<number>`count(*)`
          }).from(itemRondas)
            .where(inArray(itemRondas.itemId, itemIds))
            .groupBy(itemRondas.itemId);
          rondasMap = Object.fromEntries(rondasCount.map(r => [r.itemId, r.totalRondas]));
        }

        return {
          items: results.map(item => ({
            ...item,
            totalRondas: rondasMap[item.id] || 0
          })),
          conteos: {
            total: results.length,
            creados: totalCreados,
            pendientesAprobacion: totalPendientes,
          }
        };
      }),

    // PROTEGIDO: Solo usuarios registrados pueden leer QR de ítems
    getByCodigo: protectedProcedure
      .input(z.object({ codigo: z.string() }))
      .query(async ({ input }) => {
        return await db.getItemByCodigo(input.codigo);
      }),
    
    create: noDesarrolladorProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
        empresaId: z.number(),
        unidadId: z.number(),
        especialidadId: z.number().optional(),
        atributoId: z.number().optional(),
        defectoId: z.number().optional(),
        espacioId: z.number().optional(),
        titulo: z.string().min(1),
        descripcion: z.string().optional(),
        ubicacionDetalle: z.string().optional(),
        comentarioResidente: z.string().optional(),
        // Fotos incluidas para crear en una sola transacción
        fotoAntesBase64: z.string().optional(),
        fotoAntesMarcadaBase64: z.string().optional(),
        // ID de cliente para evitar duplicados
        clientId: z.string().optional(),
        // Código QR preasignado (cuando se escanea etiqueta nueva en campo)
        codigoQrPreasignado: z.string().optional(),
        // Pin de ubicación en plano
        pinPlanoId: z.number().optional(),
        pinPosX: z.string().optional(),
        pinPosY: z.string().optional(),
        // CRÍTICO: Residente seleccionado por el creador (quien debe corregir el detalle)
        // Este campo tiene PRIORIDAD ABSOLUTA sobre cualquier otro método de asignación
        residenteId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
        // Verificar duplicados por clientId (evita duplicados por reintentos)
        if (input.clientId) {
          const existente = await db.getItemByClientId(input.clientId);
          if (existente) {
            // Ya existe, devolver el existente sin crear duplicado
            return existente;
          }
        }
        
        // OPTIMIZACIÓN: Solo guardar base64 inmediatamente, S3 en segundo plano
        // Esto hace la creación INSTANTÁNEA (< 1 segundo)
        let fotoData: any = {};
        if (input.fotoAntesBase64) {
          fotoData.fotoAntesBase64 = input.fotoAntesBase64;
        }
        if (input.fotoAntesMarcadaBase64) {
          fotoData.fotoAntesMarcadaBase64 = input.fotoAntesMarcadaBase64;
        }
        
        // ===== TRAZABILIDAD AGRESIVA =====
        // REGLA DE ORO: El CREADOR (ctx.user.id) NUNCA es el ASIGNADO.
        // El creador DESIGNA quién es el asignado (residente responsable de corregir).
        // 1. creadoPorId = ctx.user.id (SIEMPRE: quien crea el ítem)
        // 2. residenteId = residente seleccionado por el creador en el formulario
        // 3. asignadoAId = mismo que residenteId (la persona asignada para corregir)
        // Flujo: Creador crea → Asignado arregla y sube foto después → Supervisor aprueba
        
        const empresa = await db.getEmpresaById(input.empresaId);
        
        // PRIORIDAD ABSOLUTA: El residente seleccionado por el usuario en el formulario
        // NUNCA usar ctx.user.id como fallback para asignadoA
        let residenteResponsableId: number;
        
        if (input.residenteId) {
          // PRIORIDAD 0 (ABSOLUTA): Residente seleccionado explícitamente por el creador
          residenteResponsableId = input.residenteId;
        } else if (empresa?.jefeResidenteId) {
          // Prioridad 1: Jefe de residente de la empresa
          residenteResponsableId = empresa.jefeResidenteId;
        } else if (empresa?.residenteId) {
          // Prioridad 2: Residente de la empresa
          residenteResponsableId = empresa.residenteId;
        } else if (input.especialidadId) {
          // Prioridad 3: Residente de la especialidad
          const especialidad = await db.getEspecialidadById(input.especialidadId);
          if (especialidad?.residenteId) {
            residenteResponsableId = especialidad.residenteId;
          } else {
            // Último recurso: NO usar el creador, lanzar error
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'No se pudo determinar el residente responsable. Selecciona un residente en el formulario.',
            });
          }
        } else {
          // Sin residente en input, sin empresa con residente, sin especialidad
          // NUNCA asignar al creador como responsable
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Debes seleccionar un residente responsable para crear el ítem.',
          });
        }
        
        // VALIDACIÓN DE SEGURIDAD: Log si el asignado es el mismo que el creador
        if (residenteResponsableId === ctx.user.id) {
          console.warn(`[items.create] ADVERTENCIA: asignadoA (${residenteResponsableId}) es igual al creador (${ctx.user.id}). Esto solo es válido si el creador ES el residente de la empresa.`);
        }
        
        const result = await db.createItem({
          ...input,
          ...fotoData,
          residenteId: residenteResponsableId, // Persona responsable de arreglar
          jefeResidenteId: empresa?.jefeResidenteId || null, // Jefe de residente de la empresa
          status: 'pendiente_foto_despues',
          clientId: input.clientId,
          // Trazabilidad completa
          creadoPorId: ctx.user.id, // SIEMPRE: quien creó el ítem
          asignadoAId: residenteResponsableId, // Persona asignada para corregir el detalle
          pinPlanoId: input.pinPlanoId || null,
          pinPosX: input.pinPosX || null,
          pinPosY: input.pinPosY || null,
        });
        
        // Devolver resultado inmediatamente para mayor velocidad
        // Las operaciones secundarias se ejecutan en segundo plano
        const itemResult = result;
        
        // Ejecutar operaciones secundarias en segundo plano (no bloquean)
        setImmediate(async () => {
          try {
            // Crear pin en planoPines si viene con datos de pin
            if (input.pinPlanoId && input.pinPosX && input.pinPosY) {
              try {
                await db.createPlanoPin({
                  planoId: input.pinPlanoId,
                  itemId: itemResult.id,
                  posX: input.pinPosX,
                  posY: input.pinPosY,
                  nota: null,
                  creadoPorId: ctx.user.id,
                });
              } catch (e) { console.log('Pin creation background failed', e); }
            }

            // Subir fotos a S3 en segundo plano (no bloquea al usuario)
            if (input.fotoAntesBase64) {
              try {
                const mimeMatch = input.fotoAntesBase64.match(/^data:(image\/\w+);base64,/);
                const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
                const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
                const fotoBuffer = Buffer.from(input.fotoAntesBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                const fotoKey = `items/${itemResult.codigo}/antes-${nanoid(8)}.${extension}`;
                const { url: fotoUrl } = await storagePut(fotoKey, fotoBuffer, mimeType);
                await db.updateItem(itemResult.id, { fotoAntesUrl: fotoUrl, fotoAntesKey: fotoKey });
              } catch (e) { console.log('S3 upload background failed'); }
            }
            if (input.fotoAntesMarcadaBase64) {
              try {
                const fotoMarcadaBuffer = Buffer.from(input.fotoAntesMarcadaBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                const fotoMarcadaKey = `items/${itemResult.codigo}/antes-marcada-${nanoid(8)}.png`;
                const { url: fotoMarcadaUrl } = await storagePut(fotoMarcadaKey, fotoMarcadaBuffer, 'image/png');
                await db.updateItem(itemResult.id, { fotoAntesMarcadaUrl: fotoMarcadaUrl, fotoAntesMarcadaKey: fotoMarcadaKey });
              } catch (e) { console.log('S3 upload marked background failed'); }
            }
            
            // Crear Ronda 1 automáticamente
            try {
              await db.crearRonda({
                itemId: itemResult.id,
                numeroRonda: 1,
                fotoAntesBase64: input.fotoAntesBase64 || null,
                fotoAntesMarcadaBase64: input.fotoAntesMarcadaBase64 || null,
                status: 'pendiente_foto_despues',
                creadoPorId: ctx.user.id,
              });
            } catch (e) { console.log('Error creando ronda 1:', e); }
            
            // Registrar en historial
            await db.addItemHistorial({
              itemId: itemResult.id,
              usuarioId: ctx.user.id,
              statusNuevo: 'pendiente_foto_despues',
              comentario: 'Ítem creado',
            });
            
            // Registrar en auditoría
            await db.createAuditoria({
              usuarioId: ctx.user.id,
              usuarioNombre: ctx.user.name || 'Usuario',
              usuarioRol: ctx.user.role,
              accion: 'crear_item',
              categoria: 'item',
              entidadTipo: 'item',
              entidadId: itemResult.id,
              detalles: `Creó ítem ${itemResult.codigo} #${itemResult.numeroInterno || '-'}`,
              ip: ctx.ip,
              userAgent: ctx.userAgent,
            });
            
            // Emitir evento de tiempo real
            socketEvents.itemCreated(itemResult);
            
            // Notificar a superadmin, admin y supervisor sobre nuevo ítem
            await db.notificarSupervisores(
              itemResult.id,
              '📷 Nuevo Ítem Creado',
              `Se creó el ítem "${input.titulo}" (${itemResult.codigo})`
            );
            
            // === NOTIFICACIÓN DIRECTA AL ASIGNADO ===
            // Notificar específicamente al residente responsable (asignadoAId)
            if (residenteResponsableId && residenteResponsableId !== ctx.user.id) {
              try {
                await db.createNotificacion({
                  usuarioId: residenteResponsableId,
                  itemId: itemResult.id,
                  proyectoId: input.proyectoId || undefined,
                  tipo: 'item_pendiente_foto',
                  titulo: '⚠️ Ítem asignado a ti para corrección',
                  mensaje: `Se te asignó el ítem "${input.titulo}" (${itemResult.codigo}). Debes arreglar el detalle y subir foto después.`,
                });
                const pushSubsAsignado = await db.getPushSubscriptionsByUsuario(residenteResponsableId);
                if (pushSubsAsignado.length > 0) {
                  const pushService = (await import('./pushService')).default;
                  await pushService.sendPushToMultiple(pushSubsAsignado, {
                    title: '⚠️ Ítem asignado a ti',
                    body: `${input.titulo} (${itemResult.codigo}) - Debes corregir este detalle`,
                    itemId: itemResult.id,
                    data: { url: `/items/${itemResult.id}`, itemId: itemResult.id, tipo: 'item_asignado' }
                  });
                }
              } catch (e) { console.log('Error notificando al asignado:', e); }
            }
            
            // === NOTIFICACIÓN MASIVA: a todos los usuarios de la empresa y especialidad ===
            try {
              const notifiedIds = new Set<number>();
              // No notificar al creador ni al asignado (ya notificado arriba)
              notifiedIds.add(ctx.user.id);
              if (residenteResponsableId) notifiedIds.add(residenteResponsableId);
              
              // 1) Usuarios directos de la empresa (users.empresaId)
              const empresaUsers = await db.getUsersByEmpresa(input.empresaId);
              for (const eu of empresaUsers) {
                if (notifiedIds.has(eu.id)) continue;
                notifiedIds.add(eu.id);
                await db.createNotificacion({
                  usuarioId: eu.id,
                  itemId: itemResult.id,
                  proyectoId: input.proyectoId || undefined,
                  tipo: 'item_pendiente_foto',
                  titulo: '🔔 Nuevo ítem asignado a tu empresa',
                  mensaje: `Se creó el ítem "${input.titulo}" (${itemResult.codigo}) para tu empresa`,
                });
                const pushSubs = await db.getPushSubscriptionsByUsuario(eu.id);
                if (pushSubs.length > 0) {
                  const pushService = (await import('./pushService')).default;
                  await pushService.sendPushToMultiple(pushSubs, {
                    title: '🔔 Nuevo ítem en tu empresa',
                    body: `${input.titulo} (${itemResult.codigo})`,
                    itemId: itemResult.id,
                    data: { url: `/items/${itemResult.id}`, itemId: itemResult.id, tipo: 'item_empresa' }
                  });
                }
              }
              
              // 2) Residentes vinculados a la empresa (empresa_residentes)
              const empresaResidentes = await db.getResidentesByEmpresa(input.empresaId);
              for (const er of empresaResidentes) {
                const uid = (er as any).usuarioId || (er as any).id;
                if (!uid || notifiedIds.has(uid)) continue;
                notifiedIds.add(uid);
                await db.createNotificacion({
                  usuarioId: uid,
                  itemId: itemResult.id,
                  proyectoId: input.proyectoId || undefined,
                  tipo: 'item_pendiente_foto',
                  titulo: '🔔 Nuevo ítem asignado a tu empresa',
                  mensaje: `Se creó el ítem "${input.titulo}" (${itemResult.codigo}) para tu empresa`,
                });
                const pushSubs = await db.getPushSubscriptionsByUsuario(uid);
                if (pushSubs.length > 0) {
                  const pushService = (await import('./pushService')).default;
                  await pushService.sendPushToMultiple(pushSubs, {
                    title: '🔔 Nuevo ítem en tu empresa',
                    body: `${input.titulo} (${itemResult.codigo})`,
                    itemId: itemResult.id,
                    data: { url: `/items/${itemResult.id}`, itemId: itemResult.id, tipo: 'item_empresa' }
                  });
                }
              }
              
              // 3) Residente asignado a la especialidad
              if (input.especialidadId) {
                const esp = await db.getEspecialidadById(input.especialidadId);
                if (esp?.residenteId && !notifiedIds.has(esp.residenteId)) {
                  notifiedIds.add(esp.residenteId);
                  await db.createNotificacion({
                    usuarioId: esp.residenteId,
                    itemId: itemResult.id,
                    proyectoId: input.proyectoId || undefined,
                    tipo: 'item_pendiente_foto',
                    titulo: '🔔 Nuevo ítem en tu especialidad',
                    mensaje: `Se creó el ítem "${input.titulo}" (${itemResult.codigo}) en tu especialidad`,
                  });
                  const pushSubs = await db.getPushSubscriptionsByUsuario(esp.residenteId);
                  if (pushSubs.length > 0) {
                    const pushService = (await import('./pushService')).default;
                    await pushService.sendPushToMultiple(pushSubs, {
                      title: '🔔 Nuevo ítem en tu especialidad',
                      body: `${input.titulo} (${itemResult.codigo})`,
                      itemId: itemResult.id,
                      data: { url: `/items/${itemResult.id}`, itemId: itemResult.id, tipo: 'item_especialidad' }
                    });
                  }
                }
              }
            } catch (notifErr) {
              console.error('Error en notificación masiva empresa/especialidad:', notifErr);
            }
          } catch (e) {
            console.error('Error en operaciones secundarias de item:', e);
          }
        });
        
        return itemResult;
        } catch (error: any) {
          // === LOGGING SERVER-SIDE DE FALLOS DE CREACIÓN ===
          console.error(`[items.create FALLO] Usuario: ${ctx.user.id} (${ctx.user.name}), Rol: ${ctx.user.role}, Empresa: ${input.empresaId}, Error: ${error.message}`);
          try {
            await db.createAuditoria({
              usuarioId: ctx.user.id,
              usuarioNombre: ctx.user.name || 'Desconocido',
              usuarioRol: ctx.user.role,
              accion: 'crear_item_fallido',
              categoria: 'error',
              entidadTipo: 'item',
              detalles: `Fallo al crear ítem: ${error.message}. Empresa: ${input.empresaId}, Unidad: ${input.unidadId}, Título: "${input.titulo}", ClientId: ${input.clientId || 'N/A'}`,
              valorNuevo: { input: { ...input, fotoAntesBase64: input.fotoAntesBase64 ? '[BASE64]' : undefined, fotoAntesMarcadaBase64: input.fotoAntesMarcadaBase64 ? '[BASE64]' : undefined }, error: error.message, code: error.code },
              ip: ctx.ip,
              userAgent: ctx.userAgent,
            });
          } catch (logErr) {
            console.error('[items.create] Error al registrar fallo en auditoría:', logErr);
          }
          throw error; // Re-lanzar para que el cliente reciba el error
        }
      }),
    
    uploadFotoAntes: noDesarrolladorProcedure
      .input(z.object({
        itemId: z.number(),
        fotoBase64: z.string(),
        fotoMarcadaBase64: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const correlationId = `fotoAntes-${input.itemId}-${Date.now()}`;
        const fotoSizeKB = Math.round(input.fotoBase64.length / 1024);
        console.log(`[${correlationId}] Recibida foto antes: ${fotoSizeKB}KB, usuario: ${ctx.user.name || ctx.user.id}`);
        
        // Validación de tamaño (max 10MB en base64)
        if (input.fotoBase64.length > 10 * 1024 * 1024) {
          throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: `La foto es demasiado grande (${Math.round(fotoSizeKB/1024)}MB). Máximo: 10MB.` });
        }
        if (!input.fotoBase64.startsWith('data:image/')) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Formato de imagen inválido. Intenta tomar la foto de nuevo.' });
        }
        
        const item = await db.getItemById(input.itemId);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ítem no encontrado' });
        
        const updateData: any = { fotoAntesBase64: input.fotoBase64 };
        if (input.fotoMarcadaBase64) {
          updateData.fotoAntesMarcadaBase64 = input.fotoMarcadaBase64;
        }
        
        // Guardar con reintento
        try {
          await db.updateItem(input.itemId, updateData);
          console.log(`[${correlationId}] Item actualizado OK`);
        } catch (dbError: any) {
          console.error(`[${correlationId}] Error guardando:`, dbError.code, dbError.message);
          try {
            await new Promise(r => setTimeout(r, 500));
            await db.updateItem(input.itemId, updateData);
            console.log(`[${correlationId}] Item actualizado OK en reintento`);
          } catch (retryError: any) {
            console.error(`[${correlationId}] Error en reintento:`, retryError.code, retryError.message);
            const isTimeout = retryError.code === 'ETIMEDOUT' || retryError.code === 'PROTOCOL_SEQUENCE_TIMEOUT';
            const isConnection = retryError.code === 'ECONNREFUSED' || retryError.code === 'ECONNRESET';
            let userMsg = 'Error guardando foto. Verifica tu conexión e intenta de nuevo.';
            if (isTimeout) userMsg = 'La conexión tardó demasiado. Verifica tu señal de internet e intenta de nuevo.';
            if (isConnection) userMsg = 'No se pudo conectar al servidor. Verifica tu conexión e intenta de nuevo.';
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: userMsg });
          }
        }
        
        // Subir a S3 en segundo plano (no bloquea al usuario)
        setImmediate(async () => {
          try {
            const mimeMatch = input.fotoBase64.match(/^data:(image\/\w+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
            const fotoBuffer = Buffer.from(input.fotoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const fotoKey = `items/${item.codigo}/antes-${nanoid(8)}.${extension}`;
            const { url: fotoUrl } = await storagePut(fotoKey, fotoBuffer, mimeType);
            await db.updateItem(input.itemId, { fotoAntesUrl: fotoUrl, fotoAntesKey: fotoKey });
            
            if (input.fotoMarcadaBase64) {
              const fotoMarcadaBuffer = Buffer.from(input.fotoMarcadaBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
              const fotoMarcadaKey = `items/${item.codigo}/antes-marcada-${nanoid(8)}.png`;
              const { url: fotoMarcadaUrl } = await storagePut(fotoMarcadaKey, fotoMarcadaBuffer, 'image/png');
              await db.updateItem(input.itemId, { fotoAntesMarcadaUrl: fotoMarcadaUrl, fotoAntesMarcadaKey: fotoMarcadaKey });
            }
            
            await db.registrarActividad({
              usuarioId: ctx.user.id,
              accion: 'subir_foto',
              entidad: 'item',
              entidadId: input.itemId,
              proyectoId: item.proyectoId || undefined,
              detalles: `Subió fotografía "antes" para ítem ${item.codigo}`,
            });
          } catch (e) {
            console.error('Error subiendo foto antes a S3:', e);
          }
        });
        
        return { success: true, fotoUrl: 'base64-saved' };
      }),
    
    uploadFotoDespues: canUploadFotoProcedure
      .input(z.object({
        itemId: z.number(),
        fotoBase64: z.string(),
        comentario: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const startTime = Date.now();
        const correlationId = `foto-${input.itemId}-${Date.now()}`;
        
        // Validación de tamaño de foto (max 10MB en base64)
        const fotoSizeKB = Math.round(input.fotoBase64.length / 1024);
        console.log(`[${correlationId}] Recibida foto después: ${fotoSizeKB}KB, usuario: ${ctx.user.name || ctx.user.id}`);
        
        if (input.fotoBase64.length > 10 * 1024 * 1024) {
          console.error(`[${correlationId}] Foto demasiado grande: ${fotoSizeKB}KB`);
          throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: `La foto es demasiado grande (${Math.round(fotoSizeKB/1024)}MB). Máximo permitido: 10MB. Intenta tomar la foto con menor resolución.` });
        }
        
        // Validar formato base64
        if (!input.fotoBase64.startsWith('data:image/')) {
          console.error(`[${correlationId}] Formato inválido: no es data:image/`);
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Formato de imagen inválido. Intenta tomar la foto de nuevo.' });
        }
        
        // Validación rápida del ítem
        const item = await db.getItemById(input.itemId);
        if (!item) {
          console.error(`[${correlationId}] Ítem ${input.itemId} no encontrado`);
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Ítem no encontrado' });
        }
        
        // Permitir subir foto incluso si ya tiene una (para reintentos)
        if (item.status !== 'pendiente_foto_despues' && item.status !== 'pendiente_aprobacion') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'El ítem no está en estado válido para foto después' });
        }
        
        // OPERACIÓN ATÓMICA: Guardar base64 y cambiar status
        // Intento 1: guardar en item + ronda
        try {
          await db.updateItem(input.itemId, {
            fotoDespuesBase64: input.fotoBase64,
            jefeResidenteId: ctx.user.id,
            fechaFotoDespues: new Date(),
            status: 'pendiente_aprobacion',
            comentarioJefeResidente: input.comentario,
          });
          console.log(`[${correlationId}] Item actualizado OK en ${Date.now() - startTime}ms`);
        } catch (dbError: any) {
          console.error(`[${correlationId}] Error guardando en items:`, dbError.code, dbError.message);
          // Reintento 1 vez
          try {
            await new Promise(r => setTimeout(r, 500));
            await db.updateItem(input.itemId, {
              fotoDespuesBase64: input.fotoBase64,
              jefeResidenteId: ctx.user.id,
              fechaFotoDespues: new Date(),
              status: 'pendiente_aprobacion',
              comentarioJefeResidente: input.comentario,
            });
            console.log(`[${correlationId}] Item actualizado OK en reintento`);
          } catch (retryError: any) {
            console.error(`[${correlationId}] Error en reintento:`, retryError.code, retryError.message);
            const isTimeout = retryError.code === 'ETIMEDOUT' || retryError.code === 'PROTOCOL_SEQUENCE_TIMEOUT';
            const isConnection = retryError.code === 'ECONNREFUSED' || retryError.code === 'ECONNRESET';
            let userMsg = 'Error guardando foto en la base de datos.';
            if (isTimeout) userMsg = 'La conexión tardó demasiado. Verifica tu señal de internet e intenta de nuevo.';
            if (isConnection) userMsg = 'No se pudo conectar al servidor. Verifica tu conexión e intenta de nuevo.';
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: userMsg });
          }
        }
        
        // Actualizar ronda activa (no crítico, no bloquea)
        try {
          const rondaActiva = await db.getRondaActiva(input.itemId);
          if (rondaActiva) {
            await db.actualizarRonda(rondaActiva.id, {
              fotoDespuesBase64: input.fotoBase64,
              status: 'pendiente_aprobacion',
              fechaFotoDespues: new Date(),
            });
            console.log(`[${correlationId}] Ronda ${rondaActiva.id} actualizada OK`);
          }
        } catch (rondaError: any) {
          // Ronda es secundaria, no fallar por esto
          console.error(`[${correlationId}] Error actualizando ronda (no crítico):`, rondaError.message);
        }
        
        console.log(`[uploadFotoDespues] Ítem ${item.codigo} actualizado en ${Date.now() - startTime}ms`);
        
        // Operaciones secundarias en segundo plano (no bloquean)
        setImmediate(async () => {
          try {
            // Subir a S3
            const mimeMatch = input.fotoBase64.match(/^data:(image\/\w+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
            const fotoBuffer = Buffer.from(input.fotoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const fotoKey = `items/${item.codigo}/despues-${nanoid(8)}.${extension}`;
            const { url: fotoUrl } = await storagePut(fotoKey, fotoBuffer, mimeType);
            await db.updateItem(input.itemId, { fotoDespuesUrl: fotoUrl, fotoDespuesKey: fotoKey });
            
            // Historial y bitácora
            await db.addItemHistorial({
              itemId: input.itemId,
              usuarioId: ctx.user.id,
              statusAnterior: 'pendiente_foto_despues',
              statusNuevo: 'pendiente_aprobacion',
              comentario: input.comentario || 'Foto después agregada',
            });
            await db.registrarActividad({
              usuarioId: ctx.user.id,
              accion: 'subir_foto',
              entidad: 'item',
              entidadId: input.itemId,
              proyectoId: item.proyectoId || undefined,
              detalles: `Subió fotografía "después" para ítem ${item.codigo}`,
            });
            
            // Registrar en auditoría
            await db.createAuditoria({
              usuarioId: ctx.user.id,
              usuarioNombre: ctx.user.name || 'Usuario',
              usuarioRol: ctx.user.role,
              accion: 'subir_foto',
              categoria: 'item',
              entidadTipo: 'item',
              entidadId: input.itemId,
              detalles: `Subió foto después para ítem ${item.codigo} #${item.numeroInterno || '-'}`,
              ip: ctx.ip,
              userAgent: ctx.userAgent,
            });
            
            // Eventos y notificaciones
            socketEvents.itemPhotoUploaded({ ...item, status: 'pendiente_aprobacion' });
            await db.notificarSupervisores(
              input.itemId,
              'Ítem Pendiente de Aprobación',
              `El ítem "${item.titulo}" está listo para revisión y aprobación.`
            );
            
            // Emails en segundo plano
            const supervisores = await db.getUsersByRole('supervisor');
            const admins = await db.getUsersByRole('admin');
            const residenteInfo = await db.getUserById(item.residenteId);
            for (const revisor of [...supervisores, ...admins]) {
              if (revisor.email) {
                await sendEmail({
                  to: revisor.email,
                  subject: `⏳ Ítem Pendiente de Aprobación: ${item.titulo}`,
                  html: getPendienteAprobacionEmailTemplate(item.titulo, item.codigo, residenteInfo?.name || 'Residente'),
                });
              }
            }
          } catch (e) {
            console.error('Error en operaciones secundarias de foto después:', e);
          }
        });
        
        return { success: true, fotoUrl: 'base64-saved' };
      }),
    
    aprobar: noSeguristaProcedure
      .input(z.object({
        itemId: z.number(),
        comentario: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const item = await db.getItemById(input.itemId);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ítem no encontrado' });
        if (item.status !== 'pendiente_aprobacion') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'El ítem no está pendiente de aprobación' });
        }
        
        // RESTRICCIÓN DE APROBACIÓN:
        // Solo pueden aprobar: superadmin, admin, supervisor, o el residente asignado (misma especialidad)
        const userRole = ctx.user.role;
        const canApprove = 
          userRole === 'superadmin' ||
          userRole === 'admin' ||
          userRole === 'supervisor' ||
          (userRole === 'residente' && item.asignadoAId === ctx.user.id);
        
        if (!canApprove) {
          throw new TRPCError({ 
            code: 'FORBIDDEN', 
            message: 'No tienes permiso para aprobar este ítem. Solo puede aprobar el residente asignado, supervisor, admin o superadmin.' 
          });
        }
        
        // OPTIMIZACIÓN: Actualizar status inmediatamente (< 300ms)
        await db.updateItem(input.itemId, {
          supervisorId: ctx.user.id,
          fechaAprobacion: new Date(),
          fechaCierre: new Date(), // El ítem se cierra al ser aprobado
          status: 'aprobado',
          comentarioSupervisor: input.comentario,
          // Trazabilidad
          aprobadoPorId: ctx.user.id,
          cerradoPorId: ctx.user.id, // Quien cierra es quien aprueba
        });
        // Cerrar ronda activa como aprobada
        const rondaAprobada = await db.getRondaActiva(input.itemId);
        if (rondaAprobada) {
          await db.actualizarRonda(rondaAprobada.id, {
            status: 'aprobado',
            revisadoPorId: ctx.user.id,
            comentarioRevision: input.comentario || 'Aprobado',
            fechaRevision: new Date(),
          });
        }
        
        // Operaciones secundarias en segundo plano
        setImmediate(async () => {
          try {
            await db.addItemHistorial({
              itemId: input.itemId,
              usuarioId: ctx.user.id,
              statusAnterior: 'pendiente_aprobacion',
              statusNuevo: 'aprobado',
              comentario: input.comentario || 'Ítem aprobado',
            });
            
            // Registrar en auditoría
            await db.createAuditoria({
              usuarioId: ctx.user.id,
              usuarioNombre: ctx.user.name || 'Usuario',
              usuarioRol: ctx.user.role,
              accion: 'aprobar_item',
              categoria: 'item',
              entidadTipo: 'item',
              entidadId: input.itemId,
              detalles: `Aprobó ítem ${item.codigo} #${item.numeroInterno || '-'}`,
              ip: ctx.ip,
              userAgent: ctx.userAgent,
            });
            
            socketEvents.itemApproved({ ...item, status: 'aprobado' });
            await db.createNotificacion({
              usuarioId: item.residenteId,
              itemId: input.itemId,
              proyectoId: item.proyectoId || undefined,
              tipo: 'item_aprobado',
              titulo: 'Ítem Aprobado',
              mensaje: `El ítem "${item.titulo}" ha sido aprobado por el supervisor.`,
            });
            const itemInfo = await db.getItemInfoForPush(input.itemId);
            const pushSubs = await db.getPushSubscriptionsByUsuario(item.residenteId);
            if (pushSubs.length > 0 && itemInfo) {
              await pushService.sendPushToMultiple(pushSubs, {
                title: '✅ Ítem Aprobado',
                body: `Tu ítem ha sido aprobado`,
                itemCodigo: itemInfo.codigo,
                unidadNombre: itemInfo.unidadNombre,
                defectoNombre: itemInfo.defectoNombre,
                itemId: input.itemId,
                data: { url: `/items/${input.itemId}`, itemId: input.itemId, tipo: 'aprobado' }
              });
            }
            const residente = await db.getUserById(item.residenteId);
            if (residente?.email) {
              await sendEmail({
                to: residente.email,
                subject: `✓ Ítem Aprobado: ${item.titulo}`,
                html: getAprobadoEmailTemplate(item.titulo, item.codigo, ctx.user.name || 'Supervisor'),
              });
            }
          } catch (e) {
            console.error('Error en operaciones secundarias de aprobación:', e);
          }
        });
        
        return { success: true };
      }),
    
    rechazar: noSeguristaProcedure
      .input(z.object({
        itemId: z.number(),
        comentario: z.string().min(1, 'Se requiere un comentario para rechazar'),
      }))
      .mutation(async ({ input, ctx }) => {
        const item = await db.getItemById(input.itemId);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ítem no encontrado' });
        if (item.status !== 'pendiente_aprobacion') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'El ítem no está pendiente de aprobación' });
        }
        
        // RESTRICCIÓN DE RECHAZO:
        // Solo pueden rechazar: superadmin, admin, supervisor, o el residente asignado (misma especialidad)
        const userRole = ctx.user.role;
        const canReject = 
          userRole === 'superadmin' ||
          userRole === 'admin' ||
          userRole === 'supervisor' ||
          (userRole === 'residente' && item.asignadoAId === ctx.user.id);
        
        if (!canReject) {
          throw new TRPCError({ 
            code: 'FORBIDDEN', 
            message: 'No tienes permiso para rechazar este ítem. Solo puede rechazar el residente asignado, supervisor, admin o superadmin.' 
          });
        }
        
        // OPTIMIZACIÓN: Actualizar status inmediatamente (< 300ms)
        await db.updateItem(input.itemId, {
          supervisorId: ctx.user.id,
          fechaAprobacion: new Date(), // Fecha de la decisión (aprobación o rechazo)
          status: 'rechazado',
          comentarioSupervisor: input.comentario,
          // Trazabilidad - quien rechazó
          aprobadoPorId: ctx.user.id,
        });
        // Cerrar ronda activa como rechazada
        const rondaRechazada = await db.getRondaActiva(input.itemId);
        if (rondaRechazada) {
          await db.actualizarRonda(rondaRechazada.id, {
            status: 'rechazado',
            revisadoPorId: ctx.user.id,
            comentarioRevision: input.comentario,
            fechaRevision: new Date(),
          });
        }
        
        // Operaciones secundarias en segundo plano
        setImmediate(async () => {
          try {
            await db.addItemHistorial({
              itemId: input.itemId,
              usuarioId: ctx.user.id,
              statusAnterior: 'pendiente_aprobacion',
              statusNuevo: 'rechazado',
              comentario: input.comentario,
            });
            
            // Registrar en auditoría
            await db.createAuditoria({
              usuarioId: ctx.user.id,
              usuarioNombre: ctx.user.name || 'Usuario',
              usuarioRol: ctx.user.role,
              accion: 'rechazar_item',
              categoria: 'item',
              entidadTipo: 'item',
              entidadId: input.itemId,
              detalles: `Rechazó ítem ${item.codigo} #${item.numeroInterno || '-'}: ${input.comentario}`,
              ip: ctx.ip,
              userAgent: ctx.userAgent,
            });
            
            socketEvents.itemRejected({ ...item, status: 'rechazado' });
            await db.createNotificacion({
              usuarioId: item.residenteId,
              itemId: input.itemId,
              proyectoId: item.proyectoId || undefined,
              tipo: 'item_rechazado',
              titulo: 'Ítem Rechazado',
              mensaje: `El ítem "${item.titulo}" ha sido rechazado. Motivo: ${input.comentario}`,
            });
            const itemInfoRechazado = await db.getItemInfoForPush(input.itemId);
            const pushSubsRechazado = await db.getPushSubscriptionsByUsuario(item.residenteId);
            if (pushSubsRechazado.length > 0 && itemInfoRechazado) {
              await pushService.sendPushToMultiple(pushSubsRechazado, {
                title: '❌ Ítem Rechazado',
                body: `Tu ítem ha sido rechazado`,
                itemCodigo: itemInfoRechazado.codigo,
                unidadNombre: itemInfoRechazado.unidadNombre,
                defectoNombre: itemInfoRechazado.defectoNombre,
                itemId: input.itemId,
                data: { url: `/items/${input.itemId}`, itemId: input.itemId, tipo: 'rechazado' }
              });
            }
            const residenteRechazado = await db.getUserById(item.residenteId);
            if (residenteRechazado?.email) {
              await sendEmail({
                to: residenteRechazado.email,
                subject: `✗ Ítem Rechazado: ${item.titulo}`,
                html: getRechazadoEmailTemplate(item.titulo, item.codigo, ctx.user.name || 'Supervisor', input.comentario),
              });
            }
          } catch (e) {
            console.error('Error en operaciones secundarias de rechazo:', e);
          }
        });
        
        return { success: true };
      }),
    
    historial: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return await db.getItemHistorial(input.itemId);
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const item = await db.getItemById(input.id);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ítem no encontrado' });
        
        await db.deleteItem(input.id);
        return { success: true };
      }),
    
    // ==================== RONDAS DE EVIDENCIA ====================
    
    // Obtener todas las rondas de un ítem
    getRondas: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return await db.getRondasByItem(input.itemId);
      }),
    
    // Reabrir un ítem rechazado: crea nueva ronda y vuelve a pendiente_foto_despues
    reabrir: noSeguristaProcedure
      .input(z.object({
        itemId: z.number(),
        comentario: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const item = await db.getItemById(input.itemId);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ítem no encontrado' });
        if (item.status !== 'rechazado') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Solo se pueden reabrir ítems rechazados' });
        }
        
        // Obtener ronda actual para saber el número
        const rondaAnterior = await db.getRondaActiva(input.itemId);
        const nuevaRondaNum = (rondaAnterior?.numeroRonda || 1) + 1;
        
        // Crear nueva ronda
        const rondaId = await db.crearRonda({
          itemId: input.itemId,
          numeroRonda: nuevaRondaNum,
          status: 'pendiente_foto_despues',
          creadoPorId: ctx.user.id,
        });
        
        // Resetear el ítem: limpiar foto después y volver a pendiente
        await db.updateItem(input.itemId, {
          status: 'pendiente_foto_despues',
          fotoDespuesUrl: null,
          fotoDespuesKey: null,
          fotoDespuesBase64: null,
          fechaFotoDespues: null,
          fechaAprobacion: null,
          fechaCierre: null,
          comentarioSupervisor: null,
          cerradoPorId: null,
        });
        
        // Historial
        await db.addItemHistorial({
          itemId: input.itemId,
          usuarioId: ctx.user.id,
          statusAnterior: 'rechazado',
          statusNuevo: 'pendiente_foto_despues',
          comentario: input.comentario || `Reabierto - Ronda ${nuevaRondaNum}`,
        });
        
        // Mensaje automático en el chat del ítem
        await db.createMensaje({
          itemId: input.itemId,
          usuarioId: ctx.user.id,
          texto: `🔄 **Ítem reabierto - Ronda ${nuevaRondaNum}**\n${input.comentario || 'Se requiere nueva evidencia de corrección.'}`,
          tipo: 'texto',
        });
        
        // Notificar al residente asignado
        if (item.asignadoAId) {
          await db.createNotificacion({
            usuarioId: item.asignadoAId,
            itemId: input.itemId,
            proyectoId: item.proyectoId || undefined,
            tipo: 'item_pendiente_foto',
            titulo: `🔄 Ítem reabierto - Ronda ${nuevaRondaNum}`,
            mensaje: `El ítem "${item.titulo}" fue reabierto. Debes subir nueva evidencia de corrección.`,
          });
          try {
            const pushSubs = await db.getPushSubscriptionsByUsuario(item.asignadoAId);
            if (pushSubs.length > 0) {
              const pushService = (await import('./pushService')).default;
              await pushService.sendPushToMultiple(pushSubs, {
                title: `🔄 Ítem reabierto - Ronda ${nuevaRondaNum}`,
                body: `${item.titulo} (${item.codigo}) - Nueva corrección requerida`,
                itemId: input.itemId,
                data: { url: `/items/${input.itemId}`, itemId: input.itemId, tipo: 'item_reabierto' }
              });
            }
          } catch (e) { console.log('Error push reapertura:', e); }
        }
        
        return { success: true, rondaId, numeroRonda: nuevaRondaNum };
      }),
    
    // Editar ítem existente (solo superadmin y admin)
    editItem: adminProcedure
      .input(z.object({
        id: z.number(),
        empresaId: z.number().optional(),
        unidadId: z.number().optional(),
        especialidadId: z.number().nullable().optional(),
        defectoId: z.number().nullable().optional(),
        espacioId: z.number().nullable().optional(),
        titulo: z.string().min(1).optional(),
        descripcion: z.string().nullable().optional(),
        ubicacionDetalle: z.string().nullable().optional(),
        residenteId: z.number().optional(),
        asignadoAId: z.number().nullable().optional(),
        status: z.enum(['pendiente_foto_despues', 'pendiente_aprobacion', 'aprobado', 'rechazado']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...updateData } = input;
        const item = await db.getItemById(id);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ítem no encontrado' });
        
        // Construir objeto de actualización limpio (solo campos proporcionados)
        const cleanUpdate: Record<string, any> = {};
        for (const [key, value] of Object.entries(updateData)) {
          if (value !== undefined) {
            cleanUpdate[key] = value;
          }
        }
        
        if (Object.keys(cleanUpdate).length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No hay campos para actualizar' });
        }
        
        await db.updateItem(id, cleanUpdate);
        
        // Registrar en auditoría
        const cambios = Object.keys(cleanUpdate).join(', ');
        await db.createAuditoria({
          usuarioId: ctx.user.id,
          usuarioNombre: ctx.user.name || 'Usuario',
          usuarioRol: ctx.user.role,
          accion: 'editar_item',
          categoria: 'item',
          entidadTipo: 'item',
          entidadId: id,
          detalles: `Editó ítem ${item.codigo}: campos [${cambios}]`,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        });
        
        // Registrar en historial si cambió el status
        if (cleanUpdate.status && cleanUpdate.status !== item.status) {
          await db.addItemHistorial({
            itemId: id,
            usuarioId: ctx.user.id,
            statusAnterior: item.status,
            statusNuevo: cleanUpdate.status,
            comentario: `Estado cambiado por ${ctx.user.name} (edición manual)`,
          });
        }
        
        return await db.getItemById(id);
      }),
    
    // Eliminar múltiples ítems (admin o superadmin)
    deleteMultiple: adminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        let deleted = 0;
        for (const id of input.ids) {
          try {
            await db.deleteItem(id);
            deleted++;
          } catch (e) {
            // Continuar con los demás si uno falla
            console.error(`Error eliminando ítem ${id}:`, e);
          }
        }
        return { success: true, deleted };
      }),

    // Actualizar pin de ubicación de un ítem
    updatePin: noSeguristaProcedure
      .input(z.object({
        itemId: z.number(),
        pinPlanoId: z.number().nullable(),
        pinPosX: z.string().nullable(),
        pinPosY: z.string().nullable(),
      }))
      .mutation(async ({ input }) => {
        await db.updateItem(input.itemId, {
          pinPlanoId: input.pinPlanoId,
          pinPosX: input.pinPosX,
          pinPosY: input.pinPosY,
        });
        return { success: true };
      }),

    pinsByPlano: protectedProcedure
      .input(z.object({ planoId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPinsByPlano(input.planoId);
      }),
  }),

  // ==================== ESTADÍSTICAS ====================
  estadisticas: router({
    general: protectedProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
        empresaId: z.number().optional(),
        unidadId: z.number().optional(),
        especialidadId: z.number().optional(),
        atributoId: z.number().optional(),
        residenteId: z.number().optional(),
        fechaDesde: z.date().optional(),
        fechaHasta: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getEstadisticas(input || {});
      }),
    
    kpis: protectedProcedure
      .input(z.object({
        empresaId: z.number().optional(),
        unidadId: z.number().optional(),
        especialidadId: z.number().optional(),
        fechaDesde: z.date().optional(),
        fechaHasta: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getKPIs(input || {});
      }),
    
    // Estadísticas completas por usuario
    porUsuario: protectedProcedure
      .input(z.object({
        usuarioId: z.number(),
        proyectoId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getEstadisticasUsuario(input.usuarioId, input.proyectoId);
      }),
    
    // Estadísticas por defecto
    porDefecto: protectedProcedure
      .input(z.object({
        defectoId: z.number(),
        proyectoId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getEstadisticasDefecto(input.defectoId, input.proyectoId);
      }),
    
    // Estadísticas de mensajería
    mensajeria: protectedProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getEstadisticasMensajeria(input?.proyectoId);
      }),
    
    // Estadísticas de seguimiento (bitácora)
    seguimiento: protectedProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
        dias: z.number().optional().default(30),
      }).optional())
      .query(async ({ input }) => {
        return await db.getEstadisticasSeguimiento(input?.proyectoId, input?.dias);
      }),
    
    // Ranking de rendimiento por usuario
    rankingUsuarios: protectedProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getRankingRendimientoUsuarios(input?.proyectoId);
      }),
    
    // Estadísticas de QR y trazabilidad
    qrTrazabilidad: protectedProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getEstadisticasQR(input?.proyectoId);
      }),

    // Penalizaciones por empresa/contratista
    penalizaciones: protectedProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
        empresaId: z.number().optional(),
        fechaDesde: z.date().optional(),
        fechaHasta: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        const data = await db.getPenalizacionesPorEmpresa(input || {});
        const totalActiva = data.reduce((sum, e) => sum + e.penalizacionActiva, 0);
        const totalLiberada = data.reduce((sum, e) => sum + e.penalizacionLiberada, 0);
        return {
          porEmpresa: data,
          totalActiva,
          totalLiberada,
          totalGeneral: totalActiva + totalLiberada,
          montoPorItem: db.getMontoPenalizacion(),
        };
      }),

    firmantesReporte: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const proyectoId = input?.proyectoId;
        const empresas = await db.getAllEmpresas(proyectoId);
        const especialidades = await db.getAllEspecialidades(proyectoId);
        const espMap: Record<number, string> = {};
        for (const e of especialidades) espMap[e.id] = e.nombre;
        // Obtener nombres de jefes
        const jefesIds = empresas.filter(e => e.jefeResidenteId).map(e => e.jefeResidenteId!);
        const jefesMap: Record<number, { name: string; email: string }> = {};
        if (jefesIds.length > 0) {
          for (const jId of jefesIds) {
            const u = await db.getUserById(jId);
            if (u) jefesMap[jId] = { name: u.name || u.email || '', email: u.email || '' };
          }
        }
        return empresas.map(e => ({
          empresaId: e.id,
          empresaNombre: e.nombre,
          especialidadNombre: e.especialidadId ? (espMap[e.especialidadId] || 'Sin Especialidad') : 'Sin Especialidad',
          jefeNombre: e.jefeResidenteId ? (jefesMap[e.jefeResidenteId]?.name || '') : '',
          jefeEmail: e.jefeResidenteId ? (jefesMap[e.jefeResidenteId]?.email || '') : (e.email || ''),
        }));
      }),
    // Ítems con historial, fotos y capturador para el PDF
    itemsParaReporte: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const proyectoId = input?.proyectoId;
        if (!proyectoId) return { items: [], planos: [] };
        // Items con datos relacionados
        const allItems = await db.getItemsByProyecto(proyectoId);
        const usuariosProyecto = await db.getUsuariosByProyecto(proyectoId);
        const todosUsuarios = usuariosProyecto.map(up => up.usuario).filter((u): u is NonNullable<typeof u> => u !== undefined);
        const todasEmpresas = await db.getAllEmpresas(proyectoId);
        const todasEspecialidades = await db.getAllEspecialidades(proyectoId);
        const todosDefectos = await db.getAllDefectos(proyectoId);
        const todasUnidades = await db.getAllUnidades(proyectoId);
        const planosData = await db.getPlanosByProyecto(proyectoId);
        const usuariosMap = new Map(todosUsuarios.map((u: any) => [u.id, u]));
        const empresasMap = new Map(todasEmpresas.map((e: any) => [e.id, e]));
        const espMap = new Map(todasEspecialidades.map((e: any) => [e.id, e]));
        const defMap = new Map(todosDefectos.map((d: any) => [d.id, d]));
        const unidadesMap = new Map(todasUnidades.map((u: any) => [u.id, u]));
        // Historial de todos los items
        const itemsConHistorial = await Promise.all(allItems.map(async (item: any) => {
          const historial = await db.getItemHistorial(item.id);
          const creadoPor = item.creadoPorId ? usuariosMap.get(item.creadoPorId) : null;
          const residente = item.residenteId ? usuariosMap.get(item.residenteId) : null;
          const empresa = item.empresaId ? empresasMap.get(item.empresaId) : null;
          const especialidad = item.especialidadId ? espMap.get(item.especialidadId) : null;
          const defecto = item.defectoId ? defMap.get(item.defectoId) : null;
          const unidad = item.unidadId ? unidadesMap.get(item.unidadId) : null;
          return {
            id: item.id,
            codigo: item.codigo,
            titulo: item.titulo,
            descripcion: item.descripcion,
            status: item.status,
            fotoAntesUrl: item.fotoAntesUrl,
            fotoDespuesUrl: item.fotoDespuesUrl,
            fotoAntesMarcadaUrl: item.fotoAntesMarcadaUrl,
            fechaCreacion: item.fechaCreacion,
            fechaAprobacion: item.fechaAprobacion,
            pinPlanoId: item.pinPlanoId,
            pinPosX: item.pinPosX,
            pinPosY: item.pinPosY,
            creadoPorNombre: creadoPor?.name || creadoPor?.email || null,
            residenteNombre: residente?.name || residente?.email || null,
            empresaNombre: empresa?.nombre || null,
            especialidadNombre: especialidad?.nombre || null,
            defectoNombre: defecto?.nombre || null,
            unidadNombre: unidad?.nombre || null,
            historial: historial.map((h: any) => {
              const usuario = h.usuarioId ? usuariosMap.get(h.usuarioId) : null;
              return {
                statusAnterior: h.statusAnterior,
                statusNuevo: h.statusNuevo,
                comentario: h.comentario,
                fecha: h.createdAt,
                usuarioNombre: usuario?.name || usuario?.email || 'Sistema',
              };
            }),
          };
        }));
        return {
          items: itemsConHistorial,
          planos: planosData.map((p: any) => ({
            id: p.id,
            nombre: p.nombre,
            nivel: p.nivel,
            imagenUrl: p.imagenUrl,
          })),
        };
      }),
  }),

  // ==================== NOTIFICACIONES ====================
  notificaciones: router({
    list: protectedProcedure
      .input(z.object({ soloNoLeidas: z.boolean().optional(), proyectoId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getNotificacionesByUsuario(ctx.user.id, input?.soloNoLeidas, input?.proyectoId);
      }),
    
    count: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await db.contarNotificacionesNoLeidas(ctx.user.id, input?.proyectoId);
      }),
    
    marcarLeida: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.marcarNotificacionLeida(input.id);
        return { success: true };
      }),
    
    marcarTodasLeidas: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .mutation(async ({ ctx, input }) => {
        await db.marcarTodasNotificacionesLeidas(ctx.user.id, input?.proyectoId);
        return { success: true };
      }),
    
    // Obtener clave pública VAPID para push
    getVapidPublicKey: publicProcedure.query(() => {
      return { publicKey: pushService.getVapidPublicKey() };
    }),
    
    // Suscribirse a notificaciones push
    subscribePush: protectedProcedure
      .input(z.object({
        endpoint: z.string(),
        p256dh: z.string(),
        auth: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.savePushSubscription({
          usuarioId: ctx.user.id,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
        });
        return { id, success: true };
      }),
    
    // Desuscribirse de notificaciones push
    unsubscribePush: protectedProcedure
      .input(z.object({ endpoint: z.string() }))
      .mutation(async ({ input }) => {
        await db.deletePushSubscription(input.endpoint);
        return { success: true };
      }),
    
    // Enviar notificación push de prueba
    testPush: protectedProcedure.mutation(async ({ ctx }) => {
      const subscriptions = await db.getPushSubscriptionsByUsuario(ctx.user.id);
      if (subscriptions.length === 0) {
        return { success: false, message: "No hay suscripciones activas" };
      }
      
      const result = await pushService.sendPushToMultiple(subscriptions, {
        title: "ObjetivaQC - Prueba",
        body: "Las notificaciones push están funcionando correctamente.",
        data: { url: "/" }
      });
      
      return { ...result, success: result.success > 0 };
    }),
  }),

  // ==================== COMENTARIOS ====================
  comentarios: router({
    byItem: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return await db.getComentariosByItem(input.itemId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        etapa: z.string(),
        texto: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createComentario({
          itemId: input.itemId,
          usuarioId: ctx.user.id,
          etapa: input.etapa,
          texto: input.texto,
        });
        return { id, success: true };
      }),
    
    // Transcribir audio y generar resumen técnico
    transcribir: protectedProcedure
      .input(z.object({
        audioBase64: z.string().optional(),
        audioUrl: z.string().optional(),
        mimeType: z.string().optional().default('audio/webm'),
        language: z.string().optional().default('es-MX'),
      }))
      .mutation(async ({ input }) => {
        // Paso 1: Transcribir el audio (soporta base64 o URL)
        let transcripcion;
        
        if (input.audioBase64) {
          // Usar transcripción directa con base64 (evita problemas de S3)
          transcripcion = await transcribeAudioBase64({
            audioBase64: input.audioBase64,
            mimeType: input.mimeType,
            language: input.language,
            prompt: 'Transcribir voz a texto en español de México, con puntuación correcta y capitalización.',
          });
        } else if (input.audioUrl) {
          transcripcion = await transcribeAudio({
            audioUrl: input.audioUrl,
            language: input.language,
            prompt: 'Transcribir voz a texto en español de México, con puntuación correcta y capitalización.',
          });
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Se requiere audioBase64 o audioUrl',
          });
        }
        
        if ('error' in transcripcion) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: transcripcion.error,
            cause: transcripcion,
          });
        }
        
        const textoTranscrito = transcripcion.text;
        
        // Paso 2: Generar resumen técnico con LLM
        const resumenResponse = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'Eres un asistente de control de calidad de obra. Resume en MÁXIMO 3 bullets. Cada bullet MÁXIMO 5 palabras. Sé muy conciso. Usa términos técnicos. Solo devuelve los bullets, nada más.'
            },
            {
              role: 'user',
              content: textoTranscrito
            }
          ],
        });
        
        const resumenBullets = resumenResponse.choices[0]?.message?.content || textoTranscrito;
        
        return {
          transcript_clean: textoTranscrito,
          summary_bullets: typeof resumenBullets === 'string' ? resumenBullets : textoTranscrito,
          duration: transcripcion.duration,
          language: transcripcion.language,
        };
      }),
  }),

  // ==================== BITÁCORA ====================
  bitacora: router({
    list: adminProcedure
      .input(z.object({
        usuarioId: z.number().optional(),
        accion: z.string().optional(),
        entidad: z.string().optional(),
        fechaDesde: z.date().optional(),
        fechaHasta: z.date().optional(),
        proyectoId: z.number().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getBitacoraGeneral(input || {}, input?.limit || 200);
      }),
    
    miActividad: protectedProcedure
      .input(z.object({ limit: z.number().optional(), proyectoId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getBitacoraByUsuario(ctx.user.id, input?.limit || 50, input?.proyectoId);
      }),
    
    // Eliminar una entrada de bitácora (solo superadmin)
    delete: superadminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteBitacoraEntry(input.id);
        return { success: true };
      }),
    
    // Eliminar múltiples entradas de bitácora (solo superadmin)
    deleteMany: superadminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await db.deleteBitacoraEntries(input.ids);
        return { success: true, count: input.ids.length };
      }),
    
    // Limpiar bitácora por filtros (solo superadmin)
    clearByFilters: superadminProcedure
      .input(z.object({
        usuarioId: z.number().optional(),
        accion: z.string().optional(),
        entidad: z.string().optional(),
        fechaDesde: z.date().optional(),
        fechaHasta: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const count = await db.clearBitacoraByFilters(input);
        return { success: true, count };
      }),
    
    // Estadísticas de tiempos y actividad de usuarios
    estadisticasTiempos: adminProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getEstadisticasTiemposUsuarios(input?.proyectoId);
      }),
    
    // Resumen semanal de actividad
    resumenSemanal: adminProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getResumenSemanalActividad(input?.proyectoId);
      }),
  }),

  // ==================== PENDIENTES POR USUARIO ====================
  pendientes: router({
    misPendientes: protectedProcedure
      .input(z.object({ proyectoId: z.number() }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getPendientesByUsuario(ctx.user.id, ctx.user.role, input?.proyectoId);
      }),
  }),

  // ==================== CONFIGURACIÓN ====================
  configuracion: router({
    list: adminProcedure.query(async ({ ctx }) => {
      const isSuperadmin = ctx.user.role === 'superadmin';
      return await db.getAllConfiguracion(isSuperadmin);
    }),
    
    get: adminProcedure
      .input(z.object({ clave: z.string() }))
      .query(async ({ input }) => {
        return await db.getConfiguracion(input.clave);
      }),
    
    set: superadminProcedure
      .input(z.object({
        clave: z.string(),
        valor: z.string(),
        descripcion: z.string().optional(),
        soloSuperadmin: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.setConfiguracion(input.clave, input.valor, input.descripcion, input.soloSuperadmin);
        return { success: true };
      }),
  }),

  // ==================== METAS ====================
  metas: router({
    list: adminProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllMetas(input?.proyectoId);
      }),
    
    listConProgreso: adminProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getMetasConProgreso(input?.proyectoId);
      }),
    
    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getMetaById(input.id);
      }),
    
    create: superadminProcedure
      .input(z.object({
        nombre: z.string(),
        descripcion: z.string().optional(),
        tipo: z.string(),
        valorObjetivo: z.number(),
        unidadMedida: z.string().optional(),
        empresaId: z.number().optional(),
        unidadId: z.number().optional(),
        fechaInicio: z.date().optional(),
        fechaFin: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createMeta(input);
        return { id };
      }),
    
    update: superadminProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().optional(),
        descripcion: z.string().optional(),
        tipo: z.string().optional(),
        valorObjetivo: z.number().optional(),
        unidadMedida: z.string().optional(),
        empresaId: z.number().optional(),
        unidadId: z.number().optional(),
        fechaInicio: z.date().optional(),
        fechaFin: z.date().optional(),
        activo: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateMeta(id, data);
        return { success: true };
      }),
    
    delete: superadminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteMeta(input.id);
        return { success: true };
      }),
  }),

  // ==================== DEFECTOS ====================
  defectos: router({
    list: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllDefectos(input?.proyectoId);
      }),
    
    // Lista con estadísticas de uso
    listConEstadisticas: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getDefectosConEstadisticas(input?.proyectoId);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getDefectoById(input.id);
      }),
    
    // Defectos por especialidad
    byEspecialidad: protectedProcedure
      .input(z.object({ especialidadId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDefectosByEspecialidad(input.especialidadId);
      }),
    
    create: supervisorProcedure
      .input(z.object({
        nombre: z.string().min(1),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        especialidadId: z.number().optional(),
        severidad: z.enum(['leve', 'moderado', 'grave', 'critico']).optional(),
        tiempoEstimadoResolucion: z.number().optional(),
        proyectoId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createDefecto(input);
        return { id, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).optional(),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        especialidadId: z.number().optional(),
        severidad: z.enum(['leve', 'moderado', 'grave', 'critico']).optional(),
        tiempoEstimadoResolucion: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateDefecto(id, data);
        return { success: true };
      }),
    
    delete: supervisorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDefecto(input.id);
        return { success: true };
      }),
    
    // Estadísticas de defectos con filtros
    estadisticas: protectedProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
        empresaId: z.number().optional(),
        unidadId: z.number().optional(),
        especialidadId: z.number().optional(),
        fechaDesde: z.date().optional(),
        fechaHasta: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getEstadisticasDefectos(input || {});
      }),
  }),

  // ==================== REPORTES ====================
  reportes: router({
    // Obtener items para reporte fotográfico
    itemsParaReporte: protectedProcedure
      .input(z.object({
        proyectoId: z.number().optional(),
        empresaId: z.number().optional(),
        unidadId: z.number().optional(),
        especialidadId: z.number().optional(),
        atributoId: z.number().optional(),
        residenteId: z.number().optional(),
        status: z.string().optional(),
        fechaDesde: z.date().optional(),
        fechaHasta: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getItemsParaReporte(input || {});
      }),
  }),

  // ==================== PROYECTOS ====================
  proyectos: router({
    // Listar todos los proyectos
    list: protectedProcedure.query(async () => {
      return await db.getAllProyectos();
    }),
    
    // Listar con estadísticas
    listConEstadisticas: protectedProcedure.query(async () => {
      return await db.getAllProyectosConEstadisticas();
    }),
    
    // Obtener proyecto por ID
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProyectoById(input.id);
      }),
    
    // Obtener proyecto con estadísticas completas
    getConEstadisticas: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProyectoConEstadisticas(input.id);
      }),
    
    // Crear proyecto
    create: adminProcedure
      .input(z.object({
        nombre: z.string().min(1),
        nombreReporte: z.string().optional(),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        logoUrl: z.string().optional(),
        imagenPortadaUrl: z.string().optional(),
        direccion: z.string().optional(),
        cliente: z.string().optional(),
        fechaInicio: z.date().optional(),
        fechaFin: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        let imagenUrl = input.imagenPortadaUrl;
        
        // Si la imagen es base64, subirla a storage
        if (imagenUrl && imagenUrl.startsWith('data:')) {
          const mimeMatch = imagenUrl.match(/^data:(image\/\w+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
          
          const imageBuffer = Buffer.from(imagenUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          const imageKey = `proyectos/${input.codigo || nanoid(6)}/portada-${nanoid(8)}.${extension}`;
          const { url } = await storagePut(imageKey, imageBuffer, mimeType);
          imagenUrl = url;
        }
        
        const id = await db.createProyecto({ ...input, imagenPortadaUrl: imagenUrl });
        
        // Asignar automáticamente al creador como admin del proyecto
        await db.asignarUsuarioAProyecto({
          proyectoId: id,
          usuarioId: ctx.user.id,
          rolEnProyecto: 'admin',
        });
        
        return { id, success: true };
      }),
    
    // Actualizar proyecto (solo superadmin)
    update: superadminProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).optional(),
        nombreReporte: z.string().optional(),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        logoUrl: z.string().optional(),
        imagenPortadaUrl: z.string().optional(),
        direccion: z.string().optional(),
        cliente: z.string().optional(),
        fechaInicio: z.date().optional(),
        fechaFin: z.date().optional(),
        linkCurvas: z.string().nullable().optional(),
        linkSecuencias: z.string().nullable().optional(),
        linkVisor: z.string().nullable().optional(),
        linkPlanos: z.string().nullable().optional(),
        diasCorreccion: z.number().min(1).max(365).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        
        // Si la imagen es base64, guardarla directamente (evita problemas de S3/CloudFront)
        // El sistema base64 es más confiable para este caso de uso
        if (data.imagenPortadaUrl && data.imagenPortadaUrl.startsWith('data:')) {
          // Guardar la imagen base64 directamente en la base de datos
          // Esto evita problemas de URLs de CloudFront que expiran con error 403
          await db.updateProyecto(id, { ...data, imagenPortadaBase64: data.imagenPortadaUrl, imagenPortadaUrl: null });
        } else {
          await db.updateProyecto(id, data);
        }
        return { success: true };
      }),
    
    // Actualizar solo enlaces externos del proyecto (solo superadmin puede cambiar títulos)
    updateEnlaces: superadminProcedure
      .input(z.object({
        id: z.number(),
        linkCurvas: z.string().nullable().optional(),
        linkSecuencias: z.string().nullable().optional(),
        linkVisor: z.string().nullable().optional(),
        linkPlanos: z.string().nullable().optional(),
        linkManuales: z.string().nullable().optional(),
        linkEspecificaciones: z.string().nullable().optional(),
        tituloCurvas: z.string().nullable().optional(),
        tituloSecuencias: z.string().nullable().optional(),
        tituloVisor: z.string().nullable().optional(),
        tituloPlanos: z.string().nullable().optional(),
        tituloManuales: z.string().nullable().optional(),
        tituloEspecificaciones: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...enlaces } = input;
        await db.updateProyecto(id, enlaces);
        return { success: true };
      }),
    
    // Eliminar proyecto (soft delete)
    delete: superadminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProyecto(input.id);
        return { success: true };
      }),
    
    // Obtener usuarios del proyecto
    usuarios: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return await db.getUsuariosByProyecto(input.proyectoId);
      }),
    
    // Obtener proyectos del usuario actual (superadmin ve todos)
    misProyectos: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === 'superadmin' || ctx.user.role === 'admin') {
        return await db.getAllProyectosEnriquecidos();
      }
      return await db.getProyectosByUsuario(ctx.user.id);
    }),
    
    // Asignar usuario a proyecto
    asignarUsuario: adminProcedure
      .input(z.object({
        proyectoId: z.number(),
        usuarioId: z.number(),
        rolEnProyecto: z.enum(['admin', 'supervisor', 'jefe_residente', 'residente', 'desarrollador']),
      }))
      .mutation(async ({ input }) => {
        const id = await db.asignarUsuarioAProyecto(input);
        return { id, success: true };
      }),
    
    // Remover usuario de proyecto
    removerUsuario: superadminProcedure
      .input(z.object({
        proyectoId: z.number(),
        usuarioId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.removerUsuarioDeProyecto(input.proyectoId, input.usuarioId);
        return { success: true };
      }),
    
    // Actualizar rol de usuario en proyecto
    actualizarRolUsuario: adminProcedure
      .input(z.object({
        proyectoId: z.number(),
        usuarioId: z.number(),
        rolEnProyecto: z.enum(['admin', 'supervisor', 'jefe_residente', 'residente', 'desarrollador']),
      }))
      .mutation(async ({ input }) => {
        await db.actualizarRolEnProyecto(input.proyectoId, input.usuarioId, input.rolEnProyecto);
        return { success: true };
      }),
    
    // Obtener empresas del proyecto
    empresas: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmpresasByProyecto(input.proyectoId);
      }),
    
    // Obtener unidades del proyecto
    unidades: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return await db.getUnidadesByProyecto(input.proyectoId);
      }),
    
    // Obtener especialidades del proyecto
    especialidades: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEspecialidadesByProyecto(input.proyectoId);
      }),
    
    // Subir imagen de portada del proyecto (solo superadmin)
    uploadImagenPortada: superadminProcedure
      .input(z.object({
        proyectoId: z.number(),
        imagenBase64: z.string(),
      }))
      .mutation(async ({ input }) => {
        const proyecto = await db.getProyectoById(input.proyectoId);
        if (!proyecto) throw new TRPCError({ code: 'NOT_FOUND', message: 'Proyecto no encontrado' });
        
        // Detectar tipo de imagen
        const mimeMatch = input.imagenBase64.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
        
        // Subir imagen
        const imageBuffer = Buffer.from(input.imagenBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const imageKey = `proyectos/${proyecto.codigo || proyecto.id}/portada-${nanoid(8)}.${extension}`;
        const { url: imageUrl } = await storagePut(imageKey, imageBuffer, mimeType);
        
        // Actualizar proyecto
        await db.updateProyecto(input.proyectoId, { imagenPortadaUrl: imageUrl });
        
        return { success: true, url: imageUrl };
      }),
    
    // Obtener último consecutivo QR impreso del proyecto
    getUltimoConsecutivoQR: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        const proyecto = await db.getProyectoById(input.proyectoId);
        return { ultimoConsecutivoQR: proyecto?.ultimoConsecutivoQR ?? 0 };
      }),
    
    // Actualizar último consecutivo QR impreso del proyecto
    updateUltimoConsecutivoQR: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        ultimoConsecutivoQR: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.updateProyecto(input.proyectoId, {
          ultimoConsecutivoQR: input.ultimoConsecutivoQR,
        });
        return { success: true };
      }),
  }),

  // ==================== MENSAJES (CHAT POR ÍTEM) ====================
  mensajes: router({
    // Obtener mensajes de un ítem
    byItem: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMensajesByItem(input.itemId);
      }),
    
    // Crear mensaje - TODOS los usuarios autenticados pueden escribir
    create: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        texto: z.string().min(1),
        menciones: z.array(z.number()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 1. Guardar mensaje (operación crítica)
        const id = await db.createMensaje({
          itemId: input.itemId,
          usuarioId: ctx.user.id,
          texto: input.texto,
          menciones: input.menciones,
        });
        
        // 2. Operaciones secundarias en try/catch para que nunca bloqueen el mensaje
        try {
          await db.createAuditoria({
            usuarioId: ctx.user.id,
            usuarioNombre: ctx.user.name || 'Usuario',
            usuarioRol: ctx.user.role,
            accion: 'crear_mensaje',
            categoria: 'item',
            entidadTipo: 'mensaje',
            entidadId: id,
            detalles: `Mensaje creado en ítem #${input.itemId}`,
            ip: ctx.ip,
            userAgent: ctx.userAgent,
          });
        } catch (e) {
          console.error('[Chat] Error registrando auditoría de mensaje:', e);
        }
        
        // 3. Siempre emitir socket para actualización en tiempo real
        try {
          socketEvents.itemUpdated({ id: input.itemId, action: 'mensaje_nuevo' });
        } catch (e) {
          console.error('[Chat] Error emitiendo socket:', e);
        }
        
        // 4. Notificaciones de menciones (no bloquean el mensaje)
        if (input.menciones && input.menciones.length > 0) {
          try {
            const itemInfoMencion = await db.getItemInfoForPush(input.itemId);
            
            for (const userId of input.menciones) {
              try {
                await db.incrementBadge(userId, 'mensajesNoLeidos');
                await db.createNotificacion({
                  usuarioId: userId,
                  itemId: input.itemId,
                  proyectoId: itemInfoMencion?.proyectoId || undefined,
                  tipo: 'mencion',
                  titulo: 'Te mencionaron en un comentario',
                  mensaje: `${ctx.user.name || 'Un usuario'} te mencionó en el ítem #${input.itemId}`,
                });
                
                const pushSubsMencion = await db.getPushSubscriptionsByUsuario(userId);
                if (pushSubsMencion.length > 0 && itemInfoMencion) {
                  await pushService.sendPushToMultiple(pushSubsMencion, {
                    title: 'Te Mencionaron',
                    body: `${ctx.user.name || 'Un usuario'} te mencionó`,
                    itemCodigo: itemInfoMencion.codigo,
                    unidadNombre: itemInfoMencion.unidadNombre,
                    defectoNombre: itemInfoMencion.defectoNombre,
                    itemId: input.itemId,
                    data: { url: `/items/${input.itemId}`, itemId: input.itemId, tipo: 'mencion' }
                  });
                }
              } catch (mentionErr) {
                console.error(`[Chat] Error notificando mención a usuario ${userId}:`, mentionErr);
              }
            }
          } catch (e) {
            console.error('[Chat] Error procesando menciones:', e);
          }
        }
        
        return { id, success: true };
      }),
    
    // Editar mensaje (solo admin/superadmin/supervisor)
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        texto: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // Solo admin/superadmin/supervisor pueden editar cualquier mensaje
        if (!['superadmin', 'admin', 'supervisor'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'No tienes permiso para editar este mensaje' });
        }
        await db.updateMensaje(input.id, input.texto);
        return { success: true };
      }),
    
    // Eliminar mensaje (solo superadmin)
    delete: superadminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteMensaje(input.id);
        await db.createAuditoria({
          usuarioId: ctx.user.id,
          usuarioNombre: ctx.user.name || 'Usuario',
          usuarioRol: ctx.user.role,
          accion: 'eliminar_mensaje',
          categoria: 'item',
          entidadTipo: 'mensaje',
          entidadId: input.id,
          detalles: `Mensaje eliminado`,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        });
        return { success: true };
      }),

    // Toggle reacción en mensaje (todos los usuarios)
    toggleReaccion: protectedProcedure
      .input(z.object({
        mensajeId: z.number(),
        emoji: z.string().max(10),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.toggleReaccion(input.mensajeId, ctx.user.id, input.emoji);
        return result;
      }),

    // Obtener reacciones de mensajes
    reacciones: protectedProcedure
      .input(z.object({ mensajeIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        return await db.getReaccionesByMensajes(input.mensajeIds);
      }),

    // Galería de fotos del chat por ítem
    fotosByItem: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return await db.getFotosMensajesByItem(input.itemId);
      }),

    // Enviar foto en el chat
    enviarFoto: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        fotoBase64: z.string(),
        mimeType: z.string().default('image/jpeg'),
        texto: z.string().default('Foto adjunta'),
      }))
      .mutation(async ({ ctx, input }) => {
        // storagePut ya importado al inicio del archivo
        const ext = input.mimeType.includes('png') ? 'png' : 'jpg';
        const fileKey = `chat-items/${input.itemId}/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.fotoBase64, 'base64');
        const { url: fotoUrl } = await storagePut(fileKey, buffer, input.mimeType);
        
        const id = await db.createMensaje({
          itemId: input.itemId,
          usuarioId: ctx.user.id,
          texto: input.texto,
          tipo: 'foto',
          fotoUrl,
        });

        // Notificar participantes del hilo
        try {
          const allMensajes = await db.getMensajesByItem(input.itemId);
          const participantIds = Array.from(new Set(allMensajes.map((m: any) => m.usuarioId)));
          for (const pId of participantIds) {
            if (pId === ctx.user.id) continue;
            try {
              await db.createNotificacion({
                usuarioId: pId,
                itemId: input.itemId,
                tipo: 'mencion',
                titulo: 'Foto en chat',
                mensaje: `${ctx.user.name || 'Usuario'} envió una foto en el chat`,
              });
            } catch (e) { /* silenciar */ }
          }
        } catch (e) { /* silenciar */ }

        return { id, success: true, fotoUrl };
      }),
  }),

  // ==================== BADGES DE USUARIO ====================
  badges: router({
    // Obtener badges del usuario actual
    me: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserBadges(ctx.user.id);
    }),
    
    // Obtener badges de un usuario específico (admin)
    byUser: adminProcedure
      .input(z.object({ usuarioId: z.number() }))
      .query(async ({ input }) => {
        return await db.getUserBadges(input.usuarioId);
      }),
    
    // Marcar mensajes como leídos
    marcarMensajesLeidos: protectedProcedure.mutation(async ({ ctx }) => {
      await db.resetBadge(ctx.user.id, 'mensajesNoLeidos');
      return { success: true };
    }),
  }),

  // ==================== AUDITORÍA ====================
  auditoria: router({
    // Listar auditoría (solo admin/superadmin)
    list: adminProcedure
      .input(z.object({
        usuarioId: z.number().optional(),
        categoria: z.string().optional(),
        entidadTipo: z.string().optional(),
        entidadId: z.number().optional(),
        fechaDesde: z.date().optional(),
        fechaHasta: z.date().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAuditoria(input || {});
      }),
    
    // Contar registros de auditoría
    count: adminProcedure
      .input(z.object({
        usuarioId: z.number().optional(),
        categoria: z.string().optional(),
        fechaDesde: z.date().optional(),
        fechaHasta: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAuditoriaCount(input || {});
      }),
    
    // Obtener auditoría de un usuario específico
    byUsuario: adminProcedure
      .input(z.object({ usuarioId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getAuditoriaByUsuario(input.usuarioId, input.limit);
      }),
  }),

  // ==================== ESTADÍSTICAS AVANZADAS ====================
  estadisticasAvanzadas: router({
    // Rendimiento por usuario
    rendimientoUsuarios: adminProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getEstadisticasRendimientoUsuarios(input?.proyectoId);
      }),
    
    // Estadísticas de supervisores
    supervisores: adminProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getEstadisticasSupervisores(input?.proyectoId);
      }),
    
    // Defectos por usuario
    defectosPorUsuario: adminProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getDefectosPorUsuario(input?.proyectoId);
      }),
    
    // KPIs Mejores y Peores (todas las categorías)
    kpisMejoresPeores: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getKPIsMejoresPeores(input?.proyectoId);
      }),
  }),

  // ==================== FLUJO RÁPIDO ====================
  flujoRapido: router({
    // Obtener datos de prellenado para el usuario actual
    datosPrellena: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getDatosPrellenaUsuario(ctx.user.id, input?.proyectoId);
      }),
    
    // Obtener ítems críticos priorizados (de peor a mejor)
    itemsCriticos: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional(), limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getItemsCriticosPriorizados(input?.proyectoId, input?.limit);
      }),
    
    // Dashboard del residente con tareas pendientes
    dashboardResidente: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getDashboardResidente(ctx.user.id, input?.proyectoId);
      }),
    
      // Top 5 peores (empresas, residentes, especialidades)
    top5Peores: protectedProcedure
      .input(z.object({ proyectoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getTop5Peores(input?.proyectoId);
      }),
  }),

  // ==================== AVISOS ====================
  avisos: router({
    // Listar avisos (todos los usuarios autenticados) - SIEMPRE por proyecto
    list: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAvisos(input.proyectoId);
      }),

    // Obtener un aviso por ID
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAvisoById(input.id);
      }),

    // Contar avisos no leídos - SIEMPRE por proyecto
    noLeidos: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getAvisosNoLeidos(ctx.user.id, input.proyectoId);
      }),

    // IDs de avisos leídos por el usuario actual - por proyecto
    leidosPorUsuario: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getAvisosLeidosPorUsuario(ctx.user.id, input.proyectoId);
      }),

    // Marcar aviso como leído
    marcarLeido: protectedProcedure
      .input(z.object({ avisoId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.marcarAvisoLeido(input.avisoId, ctx.user.id);
        return { success: true };
      }),

    // Crear aviso (solo admin/superadmin)
    create: adminProcedure
      .input(z.object({
        proyectoId: z.number(),
        titulo: z.string().min(1),
        contenido: z.string().min(1),
        prioridad: z.enum(['normal', 'urgente']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createAviso({
          creadoPorId: ctx.user.id,
          proyectoId: input.proyectoId,
          titulo: input.titulo,
          contenido: input.contenido,
          prioridad: input.prioridad,
        });
        return result;
      }),

    // Editar aviso (solo admin/superadmin)
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        titulo: z.string().min(1).optional(),
        contenido: z.string().min(1).optional(),
        prioridad: z.enum(['normal', 'urgente']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateAviso(id, data);
        return { success: true };
      }),

    // Eliminar aviso (soft delete, solo admin/superadmin)
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAviso(input.id);
        return { success: true };
      }),

    // Obtener lecturas de un aviso (visible para todos)
    lecturas: protectedProcedure
      .input(z.object({ avisoId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLecturasAviso(input.avisoId);
      }),

    // Personas activas del proyecto (usuarios asignados)
    personasActivas: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        const usuariosProyecto = await db.getUsuariosByProyecto(input.proyectoId);
        return {
          total: usuariosProyecto.length,
          usuarios: usuariosProyecto.map(up => ({
            id: up.usuario?.id,
            name: up.usuario?.name || 'Sin nombre',
            role: up.usuario?.role || 'residente',
            rolEnProyecto: up.rolEnProyecto,
          })),
        };
      }),

    // Reporte CSV de lecturas de un aviso
    reporteLecturas: adminProcedure
      .input(z.object({ avisoId: z.number() }))
      .query(async ({ input }) => {
        const aviso = await db.getAvisoById(input.avisoId);
        const lecturas = await db.getLecturasAviso(input.avisoId);
        return {
          aviso: aviso ? { titulo: aviso.titulo, createdAt: aviso.createdAt } : null,
          lecturas: lecturas.map(l => ({
            nombre: l.usuarioNombre,
            rol: l.usuarioRole,
            leidoAt: l.leidoAt,
          })),
        };
      }),

    // Reporte CSV de personas activas del proyecto
    reportePersonasActivas: adminProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        const usuariosProyecto = await db.getUsuariosByProyecto(input.proyectoId);
        return usuariosProyecto.map(up => ({
          nombre: up.usuario?.name || 'Sin nombre',
          rol: up.usuario?.role || 'residente',
          rolEnProyecto: up.rolEnProyecto || 'residente',
          email: up.usuario?.email || '',
        }));
      }),

    // Heartbeat: registra actividad del usuario (throttled: max 1 write/min por usuario)
    heartbeat: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Throttle: solo escribir en BD cada 60s por usuario
        const now = Date.now();
        const lastWrite = heartbeatThrottle.get(ctx.user.id) || 0;
        if (now - lastWrite > 60000) {
          heartbeatThrottle.set(ctx.user.id, now);
          await db.updateHeartbeat(ctx.user.id);
        }
        return { ok: true };
      }),

    // Usuarios en línea (activos en los últimos 5 min via heartbeat)
    enLinea: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        const enLinea = await db.getUsuariosEnLinea(input.proyectoId, 5);
        return {
          total: enLinea.length,
          usuarios: enLinea.map(u => ({
            id: u.id,
            name: u.name || 'Sin nombre',
            role: u.role,
            rolEnProyecto: u.rolEnProyecto,
            lastActiveAt: u.lastActiveAt,
            empresaNombre: u.empresaNombre || null,
            especialidadNombre: u.especialidadNombre || null,
          })),
        };
      }),
  }),

  // ==========================================
  // PLANOS POR NIVEL
  // ==========================================
  planos: router({
    listar: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getPlanosByProyecto(input.proyectoId);
      }),

    pinCount: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getPinCountByPlano(input.proyectoId);
      }),

    obtener: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getPlanoById(input.id);
      }),

    crear: adminProcedure
      .input(z.object({
        proyectoId: z.number(),
        nombre: z.string().min(1),
        nivel: z.number().optional(),
        descripcion: z.string().optional(),
        orden: z.number().optional(),
        imagenBase64: z.string(), // base64 de la imagen
        imagenNombre: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Decodificar base64 y subir a S3
        const base64Data = input.imagenBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const ext = input.imagenNombre.split('.').pop() || 'png';
        const key = `planos/${input.proyectoId}/${nanoid(10)}.${ext}`;
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/png';
        const { url } = await storagePut(key, buffer, mimeType);

        const id = await db.createPlano({
          proyectoId: input.proyectoId,
          nombre: input.nombre,
          nivel: input.nivel ?? 0,
          imagenUrl: url,
          imagenKey: key,
          descripcion: input.descripcion || null,
          orden: input.orden ?? 0,
          creadoPorId: ctx.user.id,
        });
        return { id, url };
      }),

    actualizar: adminProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).optional(),
        nivel: z.number().optional(),
        descripcion: z.string().optional(),
        orden: z.number().optional(),
        imagenBase64: z.string().optional(), // nueva imagen si se reemplaza
        imagenNombre: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const updateData: any = {};
        if (input.nombre !== undefined) updateData.nombre = input.nombre;
        if (input.nivel !== undefined) updateData.nivel = input.nivel;
        if (input.descripcion !== undefined) updateData.descripcion = input.descripcion;
        if (input.orden !== undefined) updateData.orden = input.orden;

        // Si se envía nueva imagen, subir a S3
        if (input.imagenBase64 && input.imagenNombre) {
          const plano = await db.getPlanoById(input.id);
          if (!plano) throw new TRPCError({ code: 'NOT_FOUND' });
          const base64Data = input.imagenBase64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const ext = input.imagenNombre.split('.').pop() || 'png';
          const key = `planos/${plano.proyectoId}/${nanoid(10)}.${ext}`;
          const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/png';
          const { url } = await storagePut(key, buffer, mimeType);
          updateData.imagenUrl = url;
          updateData.imagenKey = key;
        }

        await db.updatePlano(input.id, updateData);
        return { ok: true };
      }),

    eliminar: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePlano(input.id);
        return { ok: true };
      }),

    // --- PINES SOBRE PLANOS ---
    pines: router({
      listar: protectedProcedure
        .input(z.object({ planoId: z.number() }))
        .query(async ({ input }) => {
          return db.getPinesByPlano(input.planoId);
        }),

      crear: noSeguristaProcedure
        .input(z.object({
          planoId: z.number(),
          itemId: z.number().optional(),
          posX: z.string(), // porcentaje como string (decimal)
          posY: z.string(),
          nota: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          const id = await db.createPlanoPin({
            planoId: input.planoId,
            itemId: input.itemId ?? null,
            posX: input.posX,
            posY: input.posY,
            nota: input.nota || null,
            creadoPorId: ctx.user.id,
          });

          // Notificar a supervisores/admins cuando un residente coloca un pin
          try {
            const creadorRole = ctx.user.role;
            if (!['superadmin', 'admin'].includes(creadorRole)) {
              const plano = await db.getPlanoById(input.planoId);
              const planoNombre = plano?.nombre || `Plano #${input.planoId}`;
              const creadorNombre = ctx.user.name || 'Un usuario';
              const supervisores = await db.getAllUsers();
              const destinatarios = supervisores.filter(
                (u: any) => ['superadmin', 'admin', 'supervisor'].includes(u.role) && u.id !== ctx.user.id
              );
              for (const dest of destinatarios) {
                await db.createNotificacion({
                  usuarioId: dest.id,
                  tipo: 'pin_creado',
                  titulo: 'Nuevo Pin en Plano',
                  mensaje: `${creadorNombre} colocó un pin en "${planoNombre}"${input.nota ? `: ${input.nota}` : ''}`,
                });
              }
            }
          } catch (e) {
            console.error('[Pin] Error notificando supervisores:', e);
          }

          return { id };
        }),

      eliminar: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await db.deletePlanoPin(input.id);
          return { ok: true };
        }),

      reportePines: protectedProcedure
        .input(z.object({ proyectoId: z.number() }))
        .query(async ({ input }) => {
          // EXACT same data source as the app's floor plan viewer (planos.pines.listar)
          // No mapping/filtering - pass through ALL data from getPinesByPlano
          const allPlanos = await db.getPlanosByProyecto(input.proyectoId);
          const result = [];
          for (const plano of allPlanos) {
            // This is the SAME call that planos.pines.listar uses
            const pinesRaw = await db.getPinesByPlano(plano.id);
            result.push({
              id: plano.id,
              nombre: plano.nombre,
              nivel: plano.nivel,
              imagenUrl: plano.imagenUrl,
              // Pass ALL pin data without filtering - exact same as visor
              pines: pinesRaw.map(p => ({
                id: p.id,
                posX: String(p.posX),
                posY: String(p.posY),
                itemId: p.itemId ?? null,
                itemCodigo: p.itemCodigo ?? null,
                itemEstado: p.itemEstado ?? null,
                itemTitulo: p.itemTitulo ?? null,
                itemConsecutivo: p.itemConsecutivo ?? null,
                residenteNombre: p.residenteNombre ?? null,
                empresaNombre: p.empresaNombre ?? null,
                unidadNombre: p.unidadNombre ?? null,
                especialidadNombre: p.especialidadNombre ?? null,
              })),
            });
          }
          return result;
        }),
    }),
  }),

  // ==================== FIRMAS ELECTRÓNICAS ====================
  firmas: router({
    // Crear firmas para un reporte (una por empresa involucrada)
    crearParaReporte: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        reporteId: z.string(),
        empresas: z.array(z.object({
          empresaId: z.number(),
          empresaNombre: z.string(),
          contactoNombre: z.string().optional(),
          contactoEmail: z.string().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.crearFirmasReporte({
          proyectoId: input.proyectoId,
          reporteId: input.reporteId,
          empresas: input.empresas.map(emp => ({
            empresaId: emp.empresaId,
            emails: [{
              nombre: emp.contactoNombre || emp.empresaNombre,
              email: emp.contactoEmail || '',
            }],
          })),
        });
      }),

    // Obtener firmas de un reporte
    porReporte: protectedProcedure
      .input(z.object({ reporteId: z.string() }))
      .query(async ({ input }) => {
        return db.getFirmasByReporte(input.reporteId);
      }),

    // Obtener firmas por proyecto
    porProyecto: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getFirmasByReporte(input.proyectoId.toString());
      }),
  }),

  // ==================== BITÁCORA DE CORREOS ====================
  bitacoraCorreos: router({
    // Registrar envío de correo
    registrar: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        reporteId: z.string().optional(),
        tipo: z.string(),
        destinatarioEmail: z.string(),
        destinatarioNombre: z.string().optional(),
        destinatarioEmpresa: z.string().optional(),
        asunto: z.string(),
        contenido: z.string().optional(),
        leyenda: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.registrarCorreo({
          proyectoId: input.proyectoId,
          reporteId: input.reporteId,
          tipo: input.tipo,
          destinatarioEmail: input.destinatarioEmail,
          destinatarioNombre: input.destinatarioNombre,
          destinatarioEmpresa: input.destinatarioEmpresa,
          asunto: input.asunto,
          contenido: input.contenido,
          leyenda: input.leyenda,
          enviadoPorId: ctx.user.id,
          enviadoPorNombre: ctx.user.name || ctx.user.email || 'Sistema',
        });
      }),

    // Listar correos enviados
    listar: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        tipo: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const [correos, total] = await Promise.all([
          db.getBitacoraCorreos(input.proyectoId, {
            tipo: input.tipo,
            limit: input.limit,
            offset: input.offset,
          }),
          db.countBitacoraCorreos(input.proyectoId, input.tipo),
        ]);
        return { correos, total };
      }),
  }),

  // ==================== ANÁLISIS IA ====================
  analisisIA: router({
    // Generar análisis profundo con IA
    generarAnalisis: adminProcedure
      .input(z.object({ proyectoId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // 1. Recopilar todos los datos del proyecto
        const datos = await db.getDatosCompletosParaAnalisisIA(input.proyectoId);
        
        // 2. Construir prompt para análisis profundo
        const systemPrompt = `Eres un Director de Calidad senior en control de calidad de obra. Generas reportes ejecutivos concisos.

REGLAS ABSOLUTAS:
- Formato: Markdown con encabezados (#, ##, ###) y BULLETS con asterisco (* texto). Cada punto es una línea con *.
- Sé DIRECTO. Máximo 2 oraciones por bullet. Sin relleno, sin introducciones largas.
- Datos concretos: cifras, porcentajes, nombres de personas y empresas.
- Usa NOMBRES de personas, empresas, niveles. NUNCA IDs, códigos ni identificadores internos.
- NO uses códigos de ítems como "Hidalma-RFTFJA". Describe: "pasta descuadre en N2".
- Escribe caracteres directos: á, é, í, ó, ú, ñ. NUNCA secuencias \\u00XX.
- NUNCA pongas \\u2022 ni ningún código unicode. Solo usa * para bullets.
- Español mexicano profesional. Tono ejecutivo.`;

        const fechaReporte = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
        const userPrompt = `Genera un REPORTE del proyecto "${datos.proyecto.nombre}" (${fechaReporte}).

DATOS:
${JSON.stringify(datos, null, 2)}

ESTRUCTURA (usa # para títulos y * para cada punto):

# Reporte de Calidad - ${datos.proyecto.nombre}

## 1. Resumen Ejecutivo
3-5 bullets con * resumiendo estado, métricas clave y situación crítica.

## 2. Metodología
2-3 bullets describiendo fuentes de datos y alcance.

## 3. Análisis
### 3.1 Estado General
* Total ítems, tasas, tendencia (cada dato un bullet con *)
### 3.2 Por Empresa
* Ranking con cifras (un bullet por empresa relevante)
### 3.3 Por Especialidad
* Distribución de defectos (un bullet por especialidad crítica)
### 3.4 Por Nivel
* Concentración por nivel (un bullet por nivel problemático)
### 3.5 Defectos Recurrentes
* Top defectos con frecuencia (un bullet cada uno)
### 3.6 Equipo
* Productividad por persona con nombre y cifras
### 3.7 Tiempos
* Promedio y tendencia

## 4. Hallazgos Clave
5-8 bullets con * cada uno. Directo, con evidencia en la misma línea.

## 5. Riesgos
* Cada riesgo un bullet: [CRÍTICO/ALTO/MEDIO] + descripción + impacto

## 6. Oportunidades
* Cada oportunidad un bullet directo

## 7. Conclusiones
* Cada conclusión un bullet respaldado por dato

## 8. Líneas de Acción
* Cada acción: qué hacer, quién (nombre), prioridad, plazo

## 9. Recomendaciones
* Cada recomendación un bullet accionable

REGLAS:
- SOLO usa * para bullets. NUNCA \\u2022, \\u00b7, \\u2013 ni ningún código unicode.
- NUNCA guión (-) como viñeta. Solo * al inicio de línea.
- Caracteres directos: áéíóúñ. NUNCA \\u00XX.
- Nombres de personas y empresas. NUNCA IDs ni códigos.
- Máximo 2 oraciones por bullet. Directo al punto.`;

        const response = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });

        const rawContenido = typeof response.choices[0]?.message?.content === 'string'
          ? response.choices[0].message.content
          : 'Error al generar análisis';
        // Limpieza agresiva de códigos unicode literales
        const contenido = rawContenido
          .replace(/\\u[0-9a-fA-F]{4}/g, '')
          .replace(/\\u00[a-fA-F0-9]{2}/g, '')
          .replace(/\\u2[0-9a-fA-F]{3}/g, '')
          .replace(/\u2022/g, '*')
          .replace(/\u00b7/g, '*')
          .replace(/\u2013/g, '-')
          .replace(/\u2014/g, '-')
          .replace(/\u00e1/g, 'á')
          .replace(/\u00e9/g, 'é')
          .replace(/\u00ed/g, 'í')
          .replace(/\u00f3/g, 'ó')
          .replace(/\u00fa/g, 'ú')
          .replace(/\u00f1/g, 'ñ')
          .replace(/\u00c1/g, 'Á')
          .replace(/\u00c9/g, 'É')
          .replace(/\u00cd/g, 'Í')
          .replace(/\u00d3/g, 'Ó')
          .replace(/\u00da/g, 'Ú')
          .replace(/\u00d1/g, 'Ñ')
          .replace(/\u00e0/g, 'à')
          .replace(/[\u2022\u00b7\u2023\u25E6\u2043\u2219]/g, '*')
          .replace(/[\u2013\u2014\u2015]/g, '-')
          .replace(/^\s*[\-\•\·]\s*/gm, '* ')
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim();

        // 3. Obtener versión
        const version = await db.getNextReporteVersion(input.proyectoId);

        // 4. Guardar en BD
        const { id } = await db.createReporteIA({
          proyectoId: input.proyectoId,
          tipo: 'analisis_profundo',
          titulo: `Análisis Profundo v${version} - ${datos.proyecto.nombre}`,
          contenido,
          datosAnalizados: JSON.stringify(datos),
          version,
          creadoPorId: ctx.user.id,
        });

        // Fotos de evidencia y datos para gráficas
        const fotosEvidencia = await db.getFotosEvidenciaParaReporte(input.proyectoId, 5);
        const chartData = {
          porStatus: [
            { name: 'Aprobados', value: datos.resumenGeneral.aprobados, color: '#02B381' },
            { name: 'Rechazados', value: datos.resumenGeneral.rechazados, color: '#ef4444' },
            { name: 'P. Foto', value: datos.resumenGeneral.pendientesFoto, color: '#f59e0b' },
            { name: 'P. Aprob.', value: datos.resumenGeneral.pendientesAprobacion, color: '#3b82f6' },
          ].filter(d => d.value > 0),
          porEmpresa: datos.empresas.sort((a, b) => b.totalItems - a.totalItems).slice(0, 6).map(e => ({
            name: e.nombre.substring(0, 12), total: e.totalItems, aprobados: e.aprobados, rechazados: e.rechazados,
          })),
          porEspecialidad: datos.especialidades.sort((a, b) => b.totalItems - a.totalItems).slice(0, 6).map(e => ({
            name: e.nombre.substring(0, 12), total: e.totalItems, aprobados: e.aprobados, rechazados: e.rechazados,
          })),
          tendencia: datos.tendenciaSemanal.map(s => ({
            name: s.semana, creados: s.creados, aprobados: s.aprobados,
          })),
          defectos: datos.defectos.slice(0, 6).map(d => ({
            name: d.nombre.substring(0, 15), frecuencia: d.frecuencia, severidad: d.severidad,
          })),
        };

        // Ranking de responsables con índices de desempeño
        const ranking = await db.getRankingRendimientoUsuarios(input.proyectoId);
        const responsables = (ranking || []).slice(0, 10).map(r => ({
          nombre: r.nombre || 'Sin nombre',
          role: r.role,
          empresa: r.empresa,
          total: r.estadisticas.total,
          aprobados: r.estadisticas.aprobados,
          rechazados: r.estadisticas.rechazados,
          pendientes: r.estadisticas.pendientes,
          tasaAprobacion: r.estadisticas.tasaAprobacion,
          tiempoPromedio: r.estadisticas.tiempoPromedio,
          score: r.scoreRendimiento,
        }));

        // Pendientes de aprobación por persona
        const pendientesAprobacion = datos.participacionUsuarios
          .filter(u => u.rol === 'supervisor' || u.rol === 'jefe_residente' || u.rol === 'admin')
          .map(u => ({ nombre: u.nombre, rol: u.rol, itemsCreados: u.itemsCreados, activo: u.activo, diasSinActividad: u.diasSinActividad }));

        return { id, contenido, version, fotosEvidencia, chartData, responsables, pendientesAprobacion };
      }),

    // Generar resumen ejecutivo (máx 1 cuartilla)
    generarResumen: adminProcedure
      .input(z.object({ proyectoId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const datos = await db.getDatosCompletosParaAnalisisIA(input.proyectoId);

        const systemPrompt = `Director de calidad en construcción. Resumen ejecutivo ultra-compacto.

REGLAS ABSOLUTAS:
- Máximo 300 palabras total. Cada bullet = 1 oración corta con dato.
- Usa SOLO el carácter * al inicio de línea para bullets.
- PROHIBIDO: cualquier secuencia que empiece con barra invertida seguida de u (como barra-u-2-0-2-2). Solo texto plano.
- Escribe acentos directamente: áéíóúñ. Nunca códigos.
- Usa nombres de personas y empresas, nunca IDs.
- Sin introducciones ni cierres. Solo datos y acciones.`;

        const userPrompt = `Proyecto: "${datos.proyecto.nombre}"

DATOS:
${JSON.stringify(datos, null, 2)}

Escribe EXACTAMENTE esta estructura. Cada bullet inicia con * y espacio:

## Estado
* (2-3 bullets: total ítems, tasa aprobación, pendientes foto)

## Crítico
* (3-4 bullets: problemas principales con cifra)

## Empresas
* (1 bullet por empresa crítica: nombre + cifra)

## Acciones
* (3-5 bullets: acción concreta + responsable + plazo)

## KPIs
* (3-4 bullets: indicador + meta + actual)

IMPORTANTE: Solo * para bullets. Texto plano sin códigos. Máx 300 palabras.`;

        const response = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });

        const rawResumen = typeof response.choices[0]?.message?.content === 'string'
          ? response.choices[0].message.content
          : 'Error al generar resumen';
        // Limpieza agresiva de códigos unicode literales
        const resumen = rawResumen
          .replace(/\\u[0-9a-fA-F]{4}/g, '')
          .replace(/\\u00[a-fA-F0-9]{2}/g, '')
          .replace(/\\u2[0-9a-fA-F]{3}/g, '')
          .replace(/\u2022/g, '*')
          .replace(/\u00b7/g, '*')
          .replace(/\u2013/g, '-')
          .replace(/\u2014/g, '-')
          .replace(/\u00e1/g, 'á')
          .replace(/\u00e9/g, 'é')
          .replace(/\u00ed/g, 'í')
          .replace(/\u00f3/g, 'ó')
          .replace(/\u00fa/g, 'ú')
          .replace(/\u00f1/g, 'ñ')
          .replace(/\u00c1/g, 'Á')
          .replace(/\u00c9/g, 'É')
          .replace(/\u00cd/g, 'Í')
          .replace(/\u00d3/g, 'Ó')
          .replace(/\u00da/g, 'Ú')
          .replace(/\u00d1/g, 'Ñ')
          .replace(/\u00e0/g, 'à')
          .replace(/[\u2022\u00b7\u2023\u25E6\u2043\u2219]/g, '*')
          .replace(/[\u2013\u2014\u2015]/g, '-')
          .replace(/^\s*[\-\•\·]\s*/gm, '* ')
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim();

        const version = await db.getNextReporteVersion(input.proyectoId);

        const { id } = await db.createReporteIA({
          proyectoId: input.proyectoId,
          tipo: 'resumen_ejecutivo',
          titulo: `Resumen Ejecutivo v${version} - ${datos.proyecto.nombre}`,
          contenido: resumen,
          resumenEjecutivo: resumen,
          datosAnalizados: JSON.stringify(datos),
          version,
          creadoPorId: ctx.user.id,
        });

        // Fotos de evidencia y datos para gráficas
        const fotosEvidencia = await db.getFotosEvidenciaParaReporte(input.proyectoId, 5);
        const chartData = {
          porStatus: [
            { name: 'Aprobados', value: datos.resumenGeneral.aprobados, color: '#02B381' },
            { name: 'Rechazados', value: datos.resumenGeneral.rechazados, color: '#ef4444' },
            { name: 'P. Foto', value: datos.resumenGeneral.pendientesFoto, color: '#f59e0b' },
            { name: 'P. Aprob.', value: datos.resumenGeneral.pendientesAprobacion, color: '#3b82f6' },
          ].filter(d => d.value > 0),
          porEmpresa: datos.empresas.sort((a, b) => b.totalItems - a.totalItems).slice(0, 6).map(e => ({
            name: e.nombre.substring(0, 12), total: e.totalItems, aprobados: e.aprobados, rechazados: e.rechazados,
          })),
          porEspecialidad: datos.especialidades.sort((a, b) => b.totalItems - a.totalItems).slice(0, 6).map(e => ({
            name: e.nombre.substring(0, 12), total: e.totalItems, aprobados: e.aprobados, rechazados: e.rechazados,
          })),
          tendencia: datos.tendenciaSemanal.map(s => ({
            name: s.semana, creados: s.creados, aprobados: s.aprobados,
          })),
          defectos: datos.defectos.slice(0, 6).map(d => ({
            name: d.nombre.substring(0, 15), frecuencia: d.frecuencia, severidad: d.severidad,
          })),
        };

        // Ranking de responsables con índices de desempeño
        const ranking = await db.getRankingRendimientoUsuarios(input.proyectoId);
        const responsables = (ranking || []).slice(0, 10).map(r => ({
          nombre: r.nombre || 'Sin nombre',
          role: r.role,
          empresa: r.empresa,
          total: r.estadisticas.total,
          aprobados: r.estadisticas.aprobados,
          rechazados: r.estadisticas.rechazados,
          pendientes: r.estadisticas.pendientes,
          tasaAprobacion: r.estadisticas.tasaAprobacion,
          tiempoPromedio: r.estadisticas.tiempoPromedio,
          score: r.scoreRendimiento,
        }));

        const pendientesAprobacion = datos.participacionUsuarios
          .filter(u => u.rol === 'supervisor' || u.rol === 'jefe_residente' || u.rol === 'admin')
          .map(u => ({ nombre: u.nombre, rol: u.rol, itemsCreados: u.itemsCreados, activo: u.activo, diasSinActividad: u.diasSinActividad }));

        return { id, resumen, version, fotosEvidencia, chartData, responsables, pendientesAprobacion };
      }),

    // Obtener historial de reportes
    historial: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        tipo: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        incluirArchivados: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        const [reportes, total] = await Promise.all([
          db.getReportesIA(input.proyectoId, {
            tipo: input.tipo,
            limit: input.limit,
            offset: input.offset,
            incluirArchivados: input.incluirArchivados,
          }),
          db.countReportesIA(input.proyectoId),
        ]);
        return { reportes, total };
      }),

    // Obtener un reporte por ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getReporteIAById(input.id);
      }),

    // Marcar reporte como enviado
    marcarEnviado: adminProcedure
      .input(z.object({
        id: z.number(),
        destinatarios: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        await db.updateReporteIA(input.id, {
          enviado: true,
          fechaEnvio: new Date(),
          destinatariosEnvio: JSON.stringify(input.destinatarios),
        });
        return { success: true };
      }),

    // Actualizar URL del PDF generado
    actualizarPdf: adminProcedure
      .input(z.object({
        id: z.number(),
        pdfUrl: z.string(),
        pdfKey: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.updateReporteIA(input.id, {
          pdfUrl: input.pdfUrl,
          pdfKey: input.pdfKey,
        });
        return { success: true };
      }),

    // Editar título de un reporte
    editarTitulo: adminProcedure
      .input(z.object({
        id: z.number(),
        titulo: z.string().min(1).max(500),
      }))
      .mutation(async ({ input }) => {
        await db.updateReporteIA(input.id, { titulo: input.titulo });
        return { success: true };
      }),

    // Archivar/desarchivar un reporte
    archivar: adminProcedure
      .input(z.object({
        id: z.number(),
        archivado: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await db.updateReporteIA(input.id, { archivado: input.archivado });
        return { success: true };
      }),

    // Eliminar un reporte permanentemente
    eliminar: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteReporteIA(input.id);
        return { success: true };
      }),
  }),

  // ==================== PRUEBAS POR DEPARTAMENTO ====================
  pruebas: router({
    // Obtener catálogo de pruebas del proyecto
    catalogo: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getCatalogoPruebas(input.proyectoId);
      }),

    // Crear prueba en catálogo (admin)
    crearPrueba: adminProcedure
      .input(z.object({
        proyectoId: z.number(),
        sistema: z.string().min(1),
        nombre: z.string().min(1),
        descripcion: z.string().optional(),
        orden: z.number().default(0),
        requiereEvidencia: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createCatalogoPrueba(input);
        return { id };
      }),

    // Actualizar prueba en catálogo (admin)
    actualizarPrueba: adminProcedure
      .input(z.object({
        id: z.number(),
        sistema: z.string().optional(),
        nombre: z.string().optional(),
        descripcion: z.string().optional(),
        orden: z.number().optional(),
        requiereEvidencia: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCatalogoPrueba(id, data);
        return { success: true };
      }),

    // Obtener catálogo completo (incluyendo inactivos) para editor
    catalogoAll: adminProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getCatalogoPruebasAll(input.proyectoId);
      }),

    // Desactivar prueba (admin)
    eliminarPrueba: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCatalogoPrueba(input.id);
        return { success: true };
      }),

    // Reactivar prueba (admin)
    reactivarPrueba: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateCatalogoPrueba(input.id, { activo: true });
        return { success: true };
      }),

    // Obtener departamentos numéricos con resumen de pruebas
    departamentos: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        const [deptos, catalogo, resultados] = await Promise.all([
          db.getDepartamentosNumericos(input.proyectoId),
          db.getCatalogoPruebas(input.proyectoId),
          db.getResumenPruebasPorUnidad(input.proyectoId),
        ]);
        const totalPruebas = catalogo.length;
        return deptos.map(d => {
          const resDepto = resultados.filter(r => r.unidadId === d.id);
          const verdes = resDepto.filter(r => r.estado === 'verde').length;
          const rojos = resDepto.filter(r => r.estado === 'rojo').length;
          const na = resDepto.filter(r => r.estado === 'na').length;
          const evaluados = verdes + rojos + na;
          // Total posible: pruebas * 2 intentos, menos NA
          const totalPosible = (totalPruebas * 2) - na;
          const progreso = totalPosible > 0 ? Math.round((verdes / totalPosible) * 100) : 0;
          // Liberado = todas las pruebas en intento_final son verde o na
          const resultadosFinales = resDepto.filter(r => r.intento === 'intento_final');
          const liberado = totalPruebas > 0 && resultadosFinales.length >= totalPruebas &&
            resultadosFinales.every(r => r.estado === 'verde' || r.estado === 'na');
          return {
            ...d,
            totalPruebas,
            verdes,
            rojos,
            na,
            evaluados,
            progreso,
            liberado,
          };
        });
      }),

    // Obtener detalle de pruebas de un departamento
    detalleDepartamento: protectedProcedure
      .input(z.object({ proyectoId: z.number(), unidadId: z.number() }))
      .query(async ({ input }) => {
        const [catalogo, resultados] = await Promise.all([
          db.getCatalogoPruebas(input.proyectoId),
          db.getResultadosPruebas(input.proyectoId, input.unidadId),
        ]);
        // Agrupar por sistema
        const sistemas = new Map<string, any[]>();
        for (const prueba of catalogo) {
          if (!sistemas.has(prueba.sistema)) sistemas.set(prueba.sistema, []);
          const intento1 = resultados.find(r => r.pruebaId === prueba.id && r.intento === 'intento_1');
          const intentoFinal = resultados.find(r => r.pruebaId === prueba.id && r.intento === 'intento_final');
          sistemas.get(prueba.sistema)!.push({
            ...prueba,
            intento1: intento1 || null,
            intentoFinal: intentoFinal || null,
          });
        }
        return Array.from(sistemas.entries()).map(([sistema, pruebas]) => ({
          sistema,
          pruebas,
        }));
      }),

    // Evaluar una prueba (crear/actualizar resultado + bitácora con hash)
    evaluar: supervisorProcedure
      .input(z.object({
        proyectoId: z.number(),
        unidadId: z.number(),
        pruebaId: z.number(),
        intento: z.enum(['intento_1', 'intento_final']),
        estado: z.enum(['verde', 'rojo', 'na']),
        observacion: z.string().optional(),
        evidenciaUrl: z.string().optional(),
        evidenciaKey: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Validar: si rojo, observación obligatoria
        if (input.estado === 'rojo' && !input.observacion?.trim()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'La observación es obligatoria cuando la prueba no pasa.' });
        }
        // Obtener estado anterior
        const existente = await db.getResultadoPrueba(input.proyectoId, input.unidadId, input.pruebaId, input.intento);
        const estadoAnterior = existente?.estado || 'pendiente';
        // Upsert resultado
        const resultadoId = await db.upsertResultadoPrueba({
          proyectoId: input.proyectoId,
          unidadId: input.unidadId,
          pruebaId: input.pruebaId,
          intento: input.intento,
          estado: input.estado,
          observacion: input.observacion || null,
          evidenciaUrl: input.evidenciaUrl || null,
          evidenciaKey: input.evidenciaKey || null,
          evaluadoPorId: ctx.user.id,
          evaluadoPorNombre: ctx.user.name || ctx.user.email || 'Desconocido',
          evaluadoAt: new Date(),
        });
        // Hash SHA-256 encadenado para bitácora inmutable
        const crypto = await import('crypto');
        const ultimaBitacora = await db.getUltimaBitacora(input.proyectoId);
        const hashAnterior = ultimaBitacora?.hashActual || null;
        const dataToHash = JSON.stringify({
          proyectoId: input.proyectoId,
          unidadId: input.unidadId,
          pruebaId: input.pruebaId,
          intento: input.intento,
          estadoAnterior,
          estadoNuevo: input.estado,
          usuarioId: ctx.user.id,
          timestamp: Date.now(),
          hashAnterior,
        });
        const hashActual = crypto.createHash('sha256').update(dataToHash).digest('hex');
        // Crear entrada en bitácora
        await db.createBitacoraPrueba({
          proyectoId: input.proyectoId,
          unidadId: input.unidadId,
          pruebaId: input.pruebaId,
          resultadoId: resultadoId || undefined,
          accion: 'evaluacion',
          intento: input.intento,
          estadoAnterior,
          estadoNuevo: input.estado,
          observacion: input.observacion || null,
          evidenciaUrl: input.evidenciaUrl || null,
          usuarioId: ctx.user.id,
          usuarioNombre: ctx.user.name || ctx.user.email || 'Desconocido',
          hashActual,
          hashAnterior,
        });
        return { success: true, resultadoId, hashActual };
      }),

    // Subir evidencia fotográfica
    subirEvidencia: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        unidadId: z.number(),
        pruebaId: z.number(),
        base64: z.string(),
        mimeType: z.string().default('image/jpeg'),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, 'base64');
        const ext = input.mimeType === 'image/png' ? 'png' : 'jpg';
        const fileKey = `pruebas/${input.proyectoId}/${input.unidadId}/${input.pruebaId}-${nanoid(8)}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        return { url, key: fileKey };
      }),

    // Obtener bitácora de pruebas
    bitacora: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        unidadId: z.number().optional(),
        limit: z.number().default(50),
      }))
      .query(async ({ input }) => {
        return db.getBitacoraPruebas(input.proyectoId, input.unidadId, input.limit);
      }),

    // Seed del catálogo inicial de pruebas
    seedCatalogo: adminProcedure
      .input(z.object({ proyectoId: z.number() }))
      .mutation(async ({ input }) => {
        // Verificar si ya existe catálogo
        const existente = await db.getCatalogoPruebas(input.proyectoId);
        if (existente.length > 0) {
          throw new TRPCError({ code: 'CONFLICT', message: 'El catálogo ya tiene pruebas configuradas.' });
        }
        const pruebasDefault = [
          // Eléctrico
          { sistema: 'Eléctrico', nombre: 'Funcionamiento de apagadores', orden: 1 },
          { sistema: 'Eléctrico', nombre: 'Funcionamiento de contactos', orden: 2 },
          { sistema: 'Eléctrico', nombre: 'Funcionamiento de luminarias', orden: 3 },
          { sistema: 'Eléctrico', nombre: 'Centro de carga / pastillas', orden: 4 },
          { sistema: 'Eléctrico', nombre: 'Timbre / intercomunicador', orden: 5 },
          { sistema: 'Eléctrico', nombre: 'Acometida eléctrica', orden: 6 },
          // Hidráulico
          { sistema: 'Hidráulico', nombre: 'Presión de agua fría', orden: 1 },
          { sistema: 'Hidráulico', nombre: 'Presión de agua caliente', orden: 2 },
          { sistema: 'Hidráulico', nombre: 'Funcionamiento de llaves mezcladoras', orden: 3 },
          { sistema: 'Hidráulico', nombre: 'Funcionamiento de WC', orden: 4 },
          { sistema: 'Hidráulico', nombre: 'Funcionamiento de regadera', orden: 5 },
          { sistema: 'Hidráulico', nombre: 'Funcionamiento de lavabo', orden: 6 },
          { sistema: 'Hidráulico', nombre: 'Funcionamiento de tarja', orden: 7 },
          { sistema: 'Hidráulico', nombre: 'Prueba de hermeticidad', orden: 8 },
          // Sanitario
          { sistema: 'Sanitario', nombre: 'Desagüe de lavabo', orden: 1 },
          { sistema: 'Sanitario', nombre: 'Desagüe de regadera', orden: 2 },
          { sistema: 'Sanitario', nombre: 'Desagüe de tarja', orden: 3 },
          { sistema: 'Sanitario', nombre: 'Desagüe de WC', orden: 4 },
          { sistema: 'Sanitario', nombre: 'Coladeras', orden: 5 },
          // Gas
          { sistema: 'Gas', nombre: 'Prueba de hermeticidad gas', orden: 1 },
          { sistema: 'Gas', nombre: 'Funcionamiento de calentador', orden: 2 },
          { sistema: 'Gas', nombre: 'Funcionamiento de estufa', orden: 3 },
          // Carpintería
          { sistema: 'Carpintería', nombre: 'Puertas - apertura y cierre', orden: 1 },
          { sistema: 'Carpintería', nombre: 'Puertas - chapas y cerraduras', orden: 2 },
          { sistema: 'Carpintería', nombre: 'Closets - puertas y correderas', orden: 3 },
          { sistema: 'Carpintería', nombre: 'Muebles de baño', orden: 4 },
          { sistema: 'Carpintería', nombre: 'Cocina integral', orden: 5 },
          // Acabados
          { sistema: 'Acabados', nombre: 'Pintura muros', orden: 1 },
          { sistema: 'Acabados', nombre: 'Pintura plafones', orden: 2 },
          { sistema: 'Acabados', nombre: 'Piso - nivelación y adherencia', orden: 3 },
          { sistema: 'Acabados', nombre: 'Azulejo - adherencia y cortes', orden: 4 },
          { sistema: 'Acabados', nombre: 'Ventanas - apertura y hermeticidad', orden: 5 },
          { sistema: 'Acabados', nombre: 'Cancel de baño', orden: 6 },
          // Limpieza
          { sistema: 'Limpieza', nombre: 'Limpieza gruesa', orden: 1 },
          { sistema: 'Limpieza', nombre: 'Limpieza fina', orden: 2 },
          { sistema: 'Limpieza', nombre: 'Limpieza de vidrios', orden: 3 },
        ];
        for (const p of pruebasDefault) {
          await db.createCatalogoPrueba({
            proyectoId: input.proyectoId,
            sistema: p.sistema,
            nombre: p.nombre,
            orden: p.orden,
            requiereEvidencia: true,
          });
        }
        return { success: true, count: pruebasDefault.length };
      }),

    // Reordenar pruebas dentro de un sistema (drag & drop)
    reordenarPruebas: adminProcedure
      .input(z.object({
        proyectoId: z.number(),
        items: z.array(z.object({ id: z.number(), orden: z.number() })),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.reordenarPruebas(input.items);
        // Registrar en bitácora
        try {
          await db.registrarActividad({
            proyectoId: input.proyectoId,
            usuarioId: ctx.user.id,
            accion: 'reordenar_pruebas',
            entidad: 'catalogo_pruebas',
            entidadId: 0,
            detalles: `Reordenó ${input.items.length} pruebas`,
            ip: '',
          });
        } catch (e) { /* non-critical */ }
        return { success: true };
      }),

    // Generar reporte Protocolos con IA
    generarProtocolo: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        unidadId: z.number().optional(), // Si no se pasa, genera resumen global
        nivelFiltro: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Obtener datos
        const catalogo = await db.getCatalogoPruebas(input.proyectoId);
        const resultados = await db.getResultadosPruebas(input.proyectoId, input.unidadId);
        const deptos = await db.getDepartamentosNumericos(input.proyectoId);

        // Filtrar deptos por nivel si aplica
        let deptsFiltrados = deptos;
        if (input.nivelFiltro && input.nivelFiltro !== 'todos') {
          deptsFiltrados = deptos.filter((d: any) => String(d.nivel) === input.nivelFiltro);
        }
        if (input.unidadId) {
          deptsFiltrados = deptos.filter((d: any) => d.id === input.unidadId);
        }

        // Construir resumen de datos
        const sistemas = Array.from(new Set(catalogo.map((c: any) => c.sistema)));
        const totalPruebas = catalogo.length;

        // Calcular estadísticas por depto
        const statsDeptos = deptsFiltrados.map((dep: any) => {
          const resDepto = resultados.filter((r: any) => r.unidadId === dep.id);
          const aprobadas = resDepto.filter((r: any) => r.estado === 'aprobado' && r.intento === 'final').length;
          const rechazadas = resDepto.filter((r: any) => r.estado === 'rechazado').length;
          const pendientes = totalPruebas - aprobadas;
          return { nombre: dep.nombre, nivel: dep.nivel, aprobadas, rechazadas, pendientes, total: totalPruebas };
        });

        const totalDeptos = statsDeptos.length;
        const liberados = statsDeptos.filter(s => s.pendientes === 0).length;
        const conRechazos = statsDeptos.filter(s => s.rechazadas > 0).length;
        const sinIniciar = statsDeptos.filter(s => s.aprobadas === 0 && s.rechazadas === 0).length;

        // Resumen por sistema
        const statsSistemas = sistemas.map(sis => {
          const pruebasSis = catalogo.filter((c: any) => c.sistema === sis);
          const totalSis = pruebasSis.length;
          const aprobados = resultados.filter((r: any) => {
            const prueba = pruebasSis.find((p: any) => p.id === r.pruebaId);
            return prueba && r.estado === 'aprobado' && r.intento === 'final';
          }).length;
          return { sistema: sis, totalPruebas: totalSis, aprobadosFinal: aprobados, totalCeldas: totalSis * totalDeptos };
        });

        const dataContext = `
PROYECTO: Hidalma
FECHA: ${new Date().toLocaleDateString('es-MX')}
TOTAL DEPARTAMENTOS: ${totalDeptos}
TOTAL PRUEBAS POR DEPTO: ${totalPruebas}
SISTEMAS: ${sistemas.join(', ')}

RESUMEN GENERAL:
- Departamentos liberados (100% aprobado final): ${liberados}/${totalDeptos}
- Departamentos con rechazos activos: ${conRechazos}
- Departamentos sin iniciar: ${sinIniciar}

RESUMEN POR SISTEMA:
${statsSistemas.map(s => `- ${s.sistema}: ${s.totalPruebas} pruebas, ${s.aprobadosFinal}/${s.totalCeldas} celdas aprobadas en final`).join('\n')}

DETALLE POR DEPARTAMENTO (top 20 con más pendientes):
${statsDeptos.sort((a, b) => b.pendientes - a.pendientes).slice(0, 20).map(d => `- Depto ${d.nombre} (N${d.nivel}): ${d.aprobadas}/${d.total} aprobadas, ${d.rechazadas} rechazos, ${d.pendientes} pendientes`).join('\n')}
`;

        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `Eres un ingeniero de control de calidad de obra experto. Genera un PROTOCOLO DE PRUEBAS profesional en español.
El reporte debe tener:
1. ENCABEZADO con nombre del proyecto, fecha, responsable
2. RESUMEN EJECUTIVO (2-3 párrafos con hallazgos clave)
3. ESTADO POR SISTEMA (tabla markdown con % avance por sistema)
4. DEPARTAMENTOS CRÍTICOS (los que tienen más rechazos o pendientes)
5. DEPARTAMENTOS LIBERADOS (lista de los que ya pasaron todo)
6. OBSERVACIONES Y RECOMENDACIONES (3-5 puntos accionables)
7. CONCLUSIÓN

Usa formato Markdown profesional con tablas, negritas y secciones claras.
No inventes datos, usa SOLO los datos proporcionados.
Si no hay resultados aún, indica que las pruebas están pendientes de iniciar.`
            },
            {
              role: 'user',
              content: `Genera el Protocolo de Pruebas con estos datos:\n${dataContext}`
            }
          ],
        });

        const contenido = response.choices?.[0]?.message?.content || 'Error generando protocolo';

        return {
          contenido,
          fecha: new Date().toISOString(),
          generadoPor: ctx.user.name || ctx.user.openId,
          stats: { totalDeptos, liberados, conRechazos, sinIniciar, totalPruebas, sistemas: sistemas.length },
        };
      }),
  }),

  // ==========================================
  // MÓDULO DE SEGURIDAD
  // ==========================================
  seguridad: router({
    // Crear incidente rápido
    crearIncidente: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        tipo: z.enum(["caida", "golpe", "corte", "electrico", "derrumbe", "incendio", "quimico", "epp_faltante", "condicion_insegura", "acto_inseguro", "casi_accidente", "otro"]),
        severidad: z.enum(["baja", "media", "alta", "critica"]),
        descripcion: z.string().min(1),
        ubicacion: z.string().optional(),
        unidadId: z.number().optional(),
        fotoBase64: z.string().optional(),
        asignadoA: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        let fotoUrl: string | undefined;
        if (input.fotoBase64) {
          try {
            const buffer = Buffer.from(input.fotoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const key = `seguridad/${input.proyectoId}/${nanoid(10)}.jpg`;
            const { url } = await storagePut(key, buffer, 'image/jpeg');
            fotoUrl = url;
          } catch (e) {
            console.error('Error subiendo foto de incidente:', e);
          }
        }
        const id = await db.crearIncidenteSeguridad({
          proyectoId: input.proyectoId,
          reportadoPor: ctx.user.id,
          tipo: input.tipo,
          severidad: input.severidad,
          descripcion: input.descripcion,
          ubicacion: input.ubicacion,
          unidadId: input.unidadId,
          fotoUrl,
          fotoBase64: input.fotoBase64 ? undefined : undefined,
          estado: "abierto",
          asignadoA: input.asignadoA || null,
        });

        // Obtener el incidente creado para el código SEG
        const incidenteCreado = await db.getIncidenteById(id);
        const codigoSeg = incidenteCreado?.codigo || `SEG${String(id).padStart(5, '0')}`;

        // Enviar notificación push: a seguristas siempre, a todos si es alta/crítica
        try {
          const usuariosProyecto = await db.getUsuariosByProyecto(input.proyectoId);
          const isUrgent = input.severidad === 'alta' || input.severidad === 'critica';
          // Para incidentes urgentes, notificar a TODOS; para otros, solo a seguristas y admins
          const userIds = usuariosProyecto
            .filter((u: any) => {
              if (u.usuario.id === ctx.user.id) return false;
              if (isUrgent) return true;
              return u.usuario.role === 'segurista' || u.usuario.role === 'admin' || u.usuario.role === 'superadmin';
            })
            .map((u: any) => u.usuario.id);
          if (userIds.length > 0) {
            const pushSubs = await db.getPushSubscriptionsByUsuarios(userIds);
            if (pushSubs.length > 0) {
              const sevLabels: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'CR\u00cdTICA' };
              const sevPrefix: Record<string, string> = { baja: '[BAJA]', media: '[MEDIA]', alta: '\u26a0\ufe0f [ALTA]', critica: '\ud83d\udea8 [CR\u00cdTICA]' };
              await pushService.sendPushToMultiple(pushSubs, {
                title: `${sevPrefix[input.severidad] || '[SEG]'} Incidente ${sevLabels[input.severidad] || input.severidad} - ${codigoSeg}`,
                body: `${input.tipo.replace(/_/g, ' ').toUpperCase()}: ${input.descripcion.slice(0, 80)}`,
                incidenteId: id,
                codigoSeg,
                severidad: input.severidad,
                tipoIncidente: input.tipo,
                tag: `oqc-seg-${id}`,
                data: { url: '/seguridad', incidenteId: id, tipo: 'incidente_nuevo' },
              });
            }
          }
        } catch (e) {
          console.error('[Seguridad] Error enviando push de incidente:', e);
        }

        return { id, success: true };
      }),

    // Listar incidentes con conteo de mensajes
    listar: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        tipo: z.string().optional(),
        severidad: z.string().optional(),
        estado: z.string().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const incidentes = await db.getIncidentesSeguridad(input.proyectoId, {
          tipo: input.tipo,
          severidad: input.severidad,
          estado: input.estado,
          limit: input.limit,
        });
        // Agregar conteo de mensajes por incidente
        const ids = incidentes.map((i: any) => i.id);
        const counts: Record<number, number> = {};
        if (ids.length > 0) {
          for (const id of ids) {
            counts[id] = await db.countMensajesSeguridad(id);
          }
        }
        return incidentes.map((i: any) => ({ ...i, mensajesCount: counts[i.id] || 0 }));
      }),

    // Obtener incidente por ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getIncidenteById(input.id);
      }),

    // Actualizar estado de incidente
    actualizarEstado: protectedProcedure
      .input(z.object({
        id: z.number(),
        estado: z.enum(["abierto", "en_proceso", "cerrado", "prevencion"]),
        accionCorrectiva: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.estado === "cerrado") {
          await db.cerrarIncidente(input.id, ctx.user.id, input.accionCorrectiva || "");
        } else {
          await db.actualizarIncidente(input.id, { estado: input.estado });
        }
        return { success: true };
      }),

    // Estadísticas
    estadisticas: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getEstadisticasSeguridad(input.proyectoId);
      }),

    // Reporte estadístico completo para PDF (incidentes + fotos + evidencias + stats por empresa)
    reporteEstadisticoPDF: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getReporteEstadisticoPDF(input.proyectoId);
      }),

    // Checklists
    crearChecklist: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        titulo: z.string().min(1),
        ubicacion: z.string().optional(),
        unidadId: z.number().optional(),
        items: z.array(z.object({
          categoria: z.string(),
          pregunta: z.string(),
          cumple: z.enum(["si", "no", "na"]).default("na"),
          observacion: z.string().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.crearChecklistSeguridad(
          {
            proyectoId: input.proyectoId,
            creadoPor: ctx.user.id,
            titulo: input.titulo,
            ubicacion: input.ubicacion,
            unidadId: input.unidadId,
          },
          input.items,
        );
        return { id, success: true };
      }),

    listarChecklists: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getChecklistsSeguridad(input.proyectoId);
      }),

    getChecklist: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getChecklistConItems(input.id);
      }),

    actualizarChecklistItem: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        cumple: z.enum(["si", "no", "na"]),
        observacion: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.actualizarChecklistItem(input.itemId, input.cumple, input.observacion);
        return { success: true };
      }),

    completarChecklist: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.completarChecklist(input.id);
        return { success: true };
      }),

    // ===== NOTAS DE VOZ =====
    transcribirYResumir: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        incidenteId: z.number().optional(),
        audioBase64: z.string(),
        mimeType: z.string().optional(),
        duracionSegundos: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 1. Transcribir audio con Whisper
        const transcripcionResult = await transcribeAudioBase64({
          audioBase64: input.audioBase64,
          mimeType: input.mimeType || 'audio/webm',
          language: 'es',
          prompt: 'Transcribir reporte de seguridad en obra de construcción',
        });
        if ('error' in transcripcionResult) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: transcripcionResult.error });
        }
        const textoTranscrito = transcripcionResult.text;

        // 2. Generar 5 bullets con LLM
        const llmResponse = await invokeLLM({
          messages: [
            { role: 'system', content: 'Eres un asistente de seguridad en obra de construcción. A partir de la transcripción de voz del usuario, genera exactamente 5 puntos clave (bullets) concisos y accionables. Responde SOLO con un JSON array de 5 strings, sin explicaciones adicionales. Ejemplo: ["Punto 1", "Punto 2", "Punto 3", "Punto 4", "Punto 5"]' },
            { role: 'user', content: textoTranscrito },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'bullets_seguridad',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  bullets: { type: 'array', items: { type: 'string' }, description: '5 puntos clave' },
                },
                required: ['bullets'],
                additionalProperties: false,
              },
            },
          },
        });
        let bullets: string[] = [];
        try {
          const rawContent = llmResponse.choices[0].message.content;
          const contentStr = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
          const parsed = JSON.parse(contentStr || '{}');
          bullets = (parsed.bullets || []).slice(0, 5);
        } catch { bullets = [textoTranscrito]; }

        // 3. Subir audio a S3
        let audioUrl = '';
        try {
          const audioBuffer = Buffer.from(input.audioBase64.includes(',') ? input.audioBase64.split(',')[1] : input.audioBase64, 'base64');
          const ext = input.mimeType?.includes('webm') ? 'webm' : input.mimeType?.includes('mp4') ? 'm4a' : 'webm';
          const key = `seguridad/voz/${input.proyectoId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { url } = await storagePut(key, audioBuffer, input.mimeType || 'audio/webm');
          audioUrl = url;
        } catch { /* audio upload optional */ }

        // 4. Guardar en BD
        const notaId = await db.crearNotaVoz({
          proyectoId: input.proyectoId,
          incidenteId: input.incidenteId || null,
          creadoPorId: ctx.user.id,
          audioUrl,
          transcripcion: textoTranscrito,
          bullets: JSON.stringify(bullets),
          duracionSegundos: input.duracionSegundos || 0,
        });

        return { id: notaId, transcripcion: textoTranscrito, bullets, audioUrl };
      }),

    listarNotasVoz: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        incidenteId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const notas = await db.getNotasVozByProyecto(input.proyectoId, input.incidenteId);
        return notas.map((n: any) => ({
          ...n,
          bullets: n.bullets ? JSON.parse(n.bullets as string) : [],
        }));
      }),

    // ==================== VOZ A DESCRIPCIÓN ====================
    vozADescripcion: protectedProcedure
      .input(z.object({
        audioBase64: z.string(),
        mimeType: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const transcripcionResult = await transcribeAudioBase64({
          audioBase64: input.audioBase64,
          mimeType: input.mimeType || 'audio/webm',
          language: 'es',
          prompt: 'Transcribir reporte de incidente de seguridad en obra de construcción',
        });
        if ('error' in transcripcionResult) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: transcripcionResult.error });
        }
        const textoTranscrito = transcripcionResult.text;

        // Generar resumen de acción concreta en máximo 5 palabras
        const llmResponse = await invokeLLM({
          messages: [
            { role: 'system', content: 'Eres un asistente de seguridad industrial en obra. A partir de la transcripción de voz, genera UNA SOLA frase de acción concreta de MÁXIMO 5 palabras que describa el incidente. Ejemplos: "Caída de material nivel 3", "Cable expuesto zona norte", "Trabajador sin casco piso 5". Responde SOLO con un JSON con el campo "resumen". Sin explicaciones.' },
            { role: 'user', content: textoTranscrito },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'resumen_voz',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  resumen: { type: 'string', description: 'Frase de acción concreta de máximo 5 palabras' },
                },
                required: ['resumen'],
                additionalProperties: false,
              },
            },
          },
        });
        let resumen = textoTranscrito;
        try {
          const rawContent = llmResponse.choices[0].message.content;
          const contentStr = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
          const parsed = JSON.parse(contentStr || '{}');
          resumen = parsed.resumen || textoTranscrito;
        } catch { /* fallback to full transcription */ }

        return { transcripcion: textoTranscrito, resumen };
      }),

    // ==================== NIVELES Y UNIDADES PARA UBICACIÓN ====================
    nivelesYUnidades: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        const unidadesList = await db.getUnidadesByProyecto(input.proyectoId);
        // Agrupar por nivel
        const nivelesMap = new Map<number | null, string[]>();
        for (const u of unidadesList) {
          const nivel = (u as any).nivel;
          if (!nivelesMap.has(nivel)) nivelesMap.set(nivel, []);
          nivelesMap.get(nivel)!.push((u as any).nombre);
        }
        const niveles = Array.from(nivelesMap.entries())
          .sort((a, b) => (a[0] ?? -999) - (b[0] ?? -999))
          .map(([nivel, unidades]) => ({
            nivel: nivel !== null ? `Nivel ${nivel}` : 'Sin nivel',
            nivelNum: nivel,
            unidades,
          }));
        return niveles;
      }),

    // ==================== CHAT POR INCIDENTE ====================
    mensajesByIncidente: protectedProcedure
      .input(z.object({ incidenteId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMensajesSeguridad(input.incidenteId);
      }),

    enviarMensaje: protectedProcedure
      .input(z.object({
        incidenteId: z.number(),
        texto: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createMensajeSeguridad({
          incidenteId: input.incidenteId,
          usuarioId: ctx.user.id,
          texto: input.texto,
          tipo: "texto",
        });

        // Enviar push a usuarios @mencionados
        try {
          const mentions = input.texto.match(/@(\w+(?:\s\w+)?)/g);
          if (mentions && mentions.length > 0) {
            const incidente = await db.getIncidenteById(input.incidenteId);
            if (incidente) {
              const usuariosProyecto = await db.getUsuariosByProyecto(incidente.proyectoId);
              const mentionedNames = mentions.map(m => m.replace('@', '').toLowerCase());
              const mentionedUsers = usuariosProyecto.filter((u: any) =>
                mentionedNames.some(name => (u.usuario?.name || u.name || '').toLowerCase().includes(name))
              );
              const mentionedIds = mentionedUsers.map((u: any) => u.usuario?.id || u.id).filter((uid: number) => uid !== ctx.user.id);
              if (mentionedIds.length > 0) {
                const pushSubs = await db.getPushSubscriptionsByUsuarios(mentionedIds);
                if (pushSubs.length > 0) {
                  await pushService.sendPushToMultiple(pushSubs, {
                    title: `Mención en ${incidente.codigo || 'incidente'}`,
                    body: `${ctx.user.name || 'Usuario'}: ${input.texto.slice(0, 80)}`,
                    incidenteId: input.incidenteId,
                    codigoSeg: incidente.codigo || undefined,
                    severidad: incidente.severidad,
                    tipoIncidente: incidente.tipo,
                    data: { url: '/seguridad', incidenteId: input.incidenteId, tipo: 'mencion_seguridad' },
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error('[Seguridad] Error enviando push de mención:', e);
        }

        return { id, success: true };
      }),

    enviarMensajeVoz: protectedProcedure
      .input(z.object({
        incidenteId: z.number(),
        audioBase64: z.string(),
        mimeType: z.string().optional().default('audio/webm'),
        duracionSegundos: z.number().optional().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        // 1. Subir audio a S3
        const ext = input.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const fileKey = `seguridad/voz/${input.incidenteId}/${nanoid(10)}.${ext}`;
        const base64Data = input.audioBase64.includes(',') ? input.audioBase64.split(',')[1] : input.audioBase64;
        const audioBuffer = Buffer.from(base64Data, 'base64');
        const { url: audioUrl } = await storagePut(fileKey, audioBuffer, input.mimeType);

        // 2. Transcribir con Whisper
        let textoTranscrito = '';
        try {
          const transcripcion = await transcribeAudioBase64({
            audioBase64: input.audioBase64,
            mimeType: input.mimeType,
            language: 'es-MX',
            prompt: 'Transcribir reporte de seguridad en obra. Español de México.',
          });
          if (!('error' in transcripcion)) {
            textoTranscrito = transcripcion.text;
          }
        } catch (e) {
          textoTranscrito = '[Error al transcribir audio]';
        }

        // 3. Generar 5 bullets con LLM
        let bullets: string[] = [];
        if (textoTranscrito && textoTranscrito !== '[Error al transcribir audio]') {
          try {
            const llmResp = await invokeLLM({
              messages: [
                { role: 'system', content: 'Eres un asistente de seguridad industrial en obra. Genera EXACTAMENTE 5 bullets concisos (máximo 10 palabras cada uno) que resuman el reporte de voz. Solo devuelve los 5 bullets como JSON array de strings, sin nada más.' },
                { role: 'user', content: textoTranscrito },
              ],
            });
            const raw = typeof llmResp.choices[0]?.message?.content === 'string' ? llmResp.choices[0].message.content : '';
            try {
              const parsed = JSON.parse(raw.replace(/```json\n?|```/g, '').trim());
              if (Array.isArray(parsed)) bullets = parsed.slice(0, 5);
            } catch {
              bullets = raw.split('\n').filter((l: string) => l.trim()).map((l: string) => l.replace(/^[-•*\d.]+\s*/, '').trim()).slice(0, 5);
            }
          } catch {
            bullets = [textoTranscrito.slice(0, 80)];
          }
        }

        // 4. Guardar mensaje de tipo voz
        const textoDisplay = bullets.length > 0 ? bullets.map((b, i) => `${i+1}. ${b}`).join('\n') : textoTranscrito || '[Nota de voz]';
        const id = await db.createMensajeSeguridad({
          incidenteId: input.incidenteId,
          usuarioId: ctx.user.id,
          texto: textoDisplay,
          tipo: "voz",
          audioUrl,
          transcripcion: textoTranscrito,
          bullets: JSON.stringify(bullets),
          duracionSegundos: input.duracionSegundos,
        });

        return { id, success: true, transcripcion: textoTranscrito, bullets, audioUrl };
      }),

    eliminarMensaje: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['superadmin', 'admin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo admin/superadmin pueden eliminar mensajes' });
        }
        await db.deleteMensajeSeguridad(input.id);
        return { success: true };
      }),

    editarMensaje: protectedProcedure
      .input(z.object({ id: z.number(), texto: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (!['superadmin', 'admin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo admin/superadmin pueden editar mensajes' });
        }
        await db.editarMensajeSeguridad(input.id, input.texto);
        return { success: true };
      }),

    editarIncidente: protectedProcedure
      .input(z.object({
        id: z.number(),
        tipo: z.enum(["caida", "golpe", "corte", "electrico", "derrumbe", "incendio", "quimico", "epp_faltante", "condicion_insegura", "acto_inseguro", "casi_accidente", "otro"]).optional(),
        severidad: z.enum(["baja", "media", "alta", "critica"]).optional(),
        descripcion: z.string().optional(),
        ubicacion: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['superadmin', 'admin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo admin/superadmin pueden editar incidentes' });
        }
        const { id, ...data } = input;
        await db.actualizarIncidente(id, data as any);
        return { success: true };
      }),

    guardarFotoMarcada: protectedProcedure
      .input(z.object({
        id: z.number(),
        fotoMarcadaBase64: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Subir foto marcada a S3
        let fotoMarcadaUrl = '';
        try {
          const base64Data = input.fotoMarcadaBase64.includes(',') ? input.fotoMarcadaBase64.split(',')[1] : input.fotoMarcadaBase64;
          const buffer = Buffer.from(base64Data, 'base64');
          const key = `seguridad/marcadas/${input.id}/${nanoid(10)}.png`;
          const { url } = await storagePut(key, buffer, 'image/png');
          fotoMarcadaUrl = url;
        } catch (e) {
          console.error('Error subiendo foto marcada:', e);
        }
        await db.guardarFotoMarcadaIncidente(input.id, fotoMarcadaUrl || input.fotoMarcadaBase64, input.fotoMarcadaBase64);
        return { success: true, fotoMarcadaUrl };
      }),

    // Enviar mensaje con foto en chat
    enviarMensajeFoto: protectedProcedure
      .input(z.object({
        incidenteId: z.number(),
        fotoBase64: z.string(),
        texto: z.string().optional().default(''),
      }))
      .mutation(async ({ ctx, input }) => {
        // Subir foto a S3
        const base64Data = input.fotoBase64.includes(',') ? input.fotoBase64.split(',')[1] : input.fotoBase64;
        const buffer = Buffer.from(base64Data, 'base64');
        const ext = input.fotoBase64.includes('image/png') ? 'png' : 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const key = `seguridad/chat-fotos/${input.incidenteId}/${nanoid(10)}.${ext}`;
        const { url: fotoUrl } = await storagePut(key, buffer, mimeType);

        const id = await db.createMensajeSeguridad({
          incidenteId: input.incidenteId,
          usuarioId: ctx.user.id,
          texto: input.texto || '[Foto]',
          tipo: 'foto',
          fotoUrl,
        });
        return { id, success: true, fotoUrl };
      }),

    // Exportar reporte PDF de incidente
    exportarPDF: protectedProcedure
      .input(z.object({ incidenteId: z.number() }))
      .mutation(async ({ input }) => {
        const data = await db.getIncidenteCompletoParaPDF(input.incidenteId);
        if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Incidente no encontrado' });
        
        const { incidente, mensajes, reportadoPor } = data;
        const sevLabels: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Cr\u00edtica' };
        const tipoLabels: Record<string, string> = {
          caida: 'Ca\u00edda', golpe: 'Golpe', corte: 'Corte', electrico: 'El\u00e9ctrico',
          derrumbe: 'Derrumbe', incendio: 'Incendio', quimico: 'Qu\u00edmico',
          epp_faltante: 'EPP Faltante', condicion_insegura: 'Condici\u00f3n Insegura',
          acto_inseguro: 'Acto Inseguro', casi_accidente: 'Casi Accidente', otro: 'Otro',
        };

        // Get assigned user name
        let asignadoNombre: string | null = null;
        if (incidente.asignadoA) {
          const asignadoUser = await db.getUserById(incidente.asignadoA);
          asignadoNombre = asignadoUser?.name || null;
        }

        return {
          codigo: incidente.codigo || `SEG${String(incidente.id).padStart(5, '0')}`,
          tipo: tipoLabels[incidente.tipo] || incidente.tipo,
          severidad: sevLabels[incidente.severidad] || incidente.severidad,
          estado: incidente.estado,
          descripcion: incidente.descripcion,
          ubicacion: incidente.ubicacion,
          fotoUrl: incidente.fotoUrl,
          fotoMarcadaUrl: incidente.fotoMarcadaUrl,
          reportadoPor: reportadoPor?.name || 'Desconocido',
          asignadoNombre,
          fechaCreacion: incidente.createdAt.toISOString(),
          fechaCierre: incidente.fechaCierre?.toISOString() || null,
          accionCorrectiva: incidente.accionCorrectiva,
          mensajes: mensajes.map(m => ({
            id: m.id,
            usuario: m.usuario?.name || 'Usuario',
            texto: m.texto,
            tipo: m.tipo,
            fotoUrl: m.fotoUrl,
            audioUrl: m.audioUrl,
            transcripcion: m.transcripcion,
            bullets: m.bullets ? (typeof m.bullets === 'string' ? JSON.parse(m.bullets) : m.bullets) : null,
            fecha: m.createdAt.toISOString(),
          })),
        };
      }),

    // Listar usuarios del proyecto para @mentions
    usuariosProyecto: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        const usuarios = await db.getUsuariosByProyecto(input.proyectoId);
        return usuarios
          .filter((u: any) => u.usuario)
          .map((u: any) => ({ id: u.usuario.id, name: u.usuario.name, role: u.usuario.role, fotoUrl: u.usuario.fotoUrl }));
      }),

    // Eliminar incidente (solo admin/superadmin)
    eliminarIncidente: protectedProcedure
      .input(z.object({ incidenteId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo admin/superadmin pueden eliminar incidentes' });
        }
        await db.eliminarIncidenteSeguridad(input.incidenteId);
        return { ok: true };
      }),

    // Dashboard para seguristas
    dashboardSegurista: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input, ctx }) => {
        return db.getDashboardSegurista(input.proyectoId, ctx.user.id);
      }),

    // Reporte general de seguridad para PDF
    reporteGeneral: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getReporteGeneralSeguridad(input.proyectoId);
      }),

    // Asignar incidente a un usuario
    asignarIncidente: protectedProcedure
      .input(z.object({
        incidenteId: z.number(),
        asignadoA: z.number().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Solo admin/superadmin/supervisor pueden asignar
        if (!['admin', 'superadmin', 'supervisor'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sin permisos para asignar incidentes' });
        }
        const incidente = await db.getIncidenteById(input.incidenteId);
        if (!incidente) throw new TRPCError({ code: 'NOT_FOUND' });
        
        await db.asignarIncidenteSeguridad(input.incidenteId, input.asignadoA);
        
        // Registrar en bitácora
        const asignadoNombre = input.asignadoA
          ? (await db.getUserById(input.asignadoA))?.name || 'Desconocido'
          : 'Nadie';
        await db.crearEntradaBitacora({
          incidenteId: input.incidenteId,
          proyectoId: incidente.proyectoId,
          usuarioId: ctx.user.id,
          accion: 'asignacion',
          detalle: `Asignado a ${asignadoNombre}`,
          valorNuevo: input.asignadoA?.toString() || 'null',
        });
        
        // Notificar al asignado (push + in-app)
        if (input.asignadoA) {
          try {
            // Push notification
            const pushSubs = await db.getPushSubscriptionsByUsuarios([input.asignadoA]);
            if (pushSubs.length > 0) {
              await pushService.sendPushToMultiple(pushSubs, {
                title: `Incidente asignado - ${incidente.codigo || 'SEG'}`,
                body: `${ctx.user.name || 'Admin'} te asignó el incidente: ${incidente.descripcion?.slice(0, 60)}`,
                incidenteId: input.incidenteId,
                codigoSeg: incidente.codigo || undefined,
                severidad: incidente.severidad,
                tipoIncidente: incidente.tipo,
                data: { url: '/seguridad', incidenteId: input.incidenteId, tipo: 'asignacion_seguridad' },
              });
            }
            // In-app notification
            await db.createNotificacion({
              usuarioId: input.asignadoA,
              proyectoId: incidente.proyectoId,
              tipo: 'asignacion_seguridad',
              titulo: `Incidente asignado: ${incidente.codigo || 'SEG'}`,
              mensaje: `${ctx.user.name || 'Admin'} te asignó el incidente "${incidente.descripcion?.slice(0, 80)}". Severidad: ${incidente.severidad}.`,
            });
          } catch (e) {
            console.error('[Seguridad] Error enviando notificación de asignación:', e);
          }
        }
        
        return { success: true };
      }),

    // Bitácora por incidente
    bitacoraByIncidente: protectedProcedure
      .input(z.object({ incidenteId: z.number() }))
      .query(async ({ input }) => {
        return db.getBitacoraByIncidente(input.incidenteId);
      }),

    // Bitácora general del proyecto
    bitacoraByProyecto: protectedProcedure
      .input(z.object({ proyectoId: z.number(), limit: z.number().optional().default(50) }))
      .query(async ({ input }) => {
        return db.getBitacoraByProyecto(input.proyectoId, input.limit);
      }),

    // ==================== EVIDENCIAS ====================

    // Subir evidencia de seguimiento/resolución
    subirEvidencia: protectedProcedure
      .input(z.object({
        incidenteId: z.number(),
        fotoBase64: z.string(),
        descripcion: z.string().optional(),
        tipo: z.enum(["seguimiento", "resolucion", "prevencion"]).default("seguimiento"),
      }))
      .mutation(async ({ ctx, input }) => {
        const incidente = await db.getIncidenteById(input.incidenteId);
        if (!incidente) throw new TRPCError({ code: 'NOT_FOUND', message: 'Incidente no encontrado' });

        // Solo el asignado, admin o superadmin pueden subir evidencias
        const isAsignado = incidente.asignadoA === ctx.user.id;
        const isAdmin = ['admin', 'superadmin'].includes(ctx.user.role || '');
        if (!isAsignado && !isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo el responsable asignado o administradores pueden subir evidencias' });
        }

        // Upload photo to S3
        const buffer = Buffer.from(input.fotoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const ext = input.fotoBase64.startsWith('data:image/png') ? 'png' : 'jpg';
        const key = `seguridad/evidencias/${input.incidenteId}/${nanoid(10)}.${ext}`;
        const { url } = await storagePut(key, buffer, `image/${ext}`);

        const id = await db.createEvidenciaSeguridad({
          incidenteId: input.incidenteId,
          usuarioId: ctx.user.id,
          fotoUrl: url,
          descripcion: input.descripcion || null,
          tipo: input.tipo,
        });

        // Registrar en bitácora
        await db.crearEntradaBitacora({
          incidenteId: input.incidenteId,
          proyectoId: incidente.proyectoId,
          usuarioId: ctx.user.id,
          accion: 'foto_enviada',
          detalle: `Evidencia de ${input.tipo} subida`,
        });

        return { id, url };
      }),

    // Listar evidencias de un incidente
    evidenciasByIncidente: protectedProcedure
      .input(z.object({ incidenteId: z.number() }))
      .query(async ({ input }) => {
        return db.getEvidenciasByIncidente(input.incidenteId);
      }),

    // Eliminar evidencia (solo admin/superadmin o quien la subió)
    eliminarEvidencia: protectedProcedure
      .input(z.object({ evidenciaId: z.number(), incidenteId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = ['admin', 'superadmin'].includes(ctx.user.role || '');
        // For now, only admins can delete evidencias
        if (!isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo administradores pueden eliminar evidencias' });
        }
        await db.deleteEvidenciaSeguridad(input.evidenciaId);

        const incidente = await db.getIncidenteById(input.incidenteId);
        if (incidente) {
          await db.crearEntradaBitacora({
            incidenteId: input.incidenteId,
            proyectoId: incidente.proyectoId,
            usuarioId: ctx.user.id,
            accion: 'eliminacion_mensaje',
            detalle: 'Evidencia eliminada',
          });
        }

        return { ok: true };
      }),

    // ==================== TIPOS DE INCIDENCIA CUSTOM ====================

    tiposIncidencia: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getTiposIncidenciaByProyecto(input.proyectoId);
      }),

    crearTipoIncidencia: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        clave: z.string().min(1).max(100),
        label: z.string().min(1).max(150),
        icono: z.string().default("ClipboardList"),
        color: z.string().default("bg-gray-100 text-gray-700"),
        iconColor: z.string().default("text-gray-600"),
        orden: z.number().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['admin', 'superadmin'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo administradores pueden gestionar tipos de incidencia' });
        }
        const id = await db.createTipoIncidencia(input);
        return { id };
      }),

    actualizarTipoIncidencia: protectedProcedure
      .input(z.object({
        id: z.number(),
        label: z.string().min(1).max(150).optional(),
        icono: z.string().optional(),
        color: z.string().optional(),
        iconColor: z.string().optional(),
        activo: z.boolean().optional(),
        orden: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['admin', 'superadmin'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo administradores pueden gestionar tipos de incidencia' });
        }
        const { id, ...data } = input;
        await db.updateTipoIncidencia(id, data);
        return { ok: true };
      }),

    eliminarTipoIncidencia: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['admin', 'superadmin'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo administradores pueden gestionar tipos de incidencia' });
        }
        await db.deleteTipoIncidencia(input.id);
        return { ok: true };
      }),

    // --- PLANTILLAS RÁPIDAS ---
    plantillas: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        // Seed defaults if none exist
        await db.seedPlantillasDefault(input.proyectoId);
        return db.getPlantillasIncidencia(input.proyectoId);
      }),

    allPlantillas: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!['admin', 'superadmin'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.seedPlantillasDefault(input.proyectoId);
        return db.getAllPlantillasIncidencia(input.proyectoId);
      }),

    crearPlantilla: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        nombre: z.string().min(1).max(100),
        tipo: z.string(),
        severidad: z.enum(['baja', 'media', 'alta', 'critica']),
        descripcion: z.string().min(1),
        orden: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['admin', 'superadmin'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const id = await db.createPlantillaIncidencia(input as any);
        return { id };
      }),

    editarPlantilla: protectedProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).max(100).optional(),
        tipo: z.string().optional(),
        severidad: z.enum(['baja', 'media', 'alta', 'critica']).optional(),
        descripcion: z.string().optional(),
        activo: z.boolean().optional(),
        orden: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['admin', 'superadmin'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { id, ...data } = input;
        await db.updatePlantillaIncidencia(id, data as any);
        return { ok: true };
      }),

    eliminarPlantilla: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['admin', 'superadmin'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.deletePlantillaIncidencia(input.id);
        return { ok: true };
      }),

    // Generar reporte ejecutivo de seguridad con IA (guarda en BD + incluye fotos)
    generarReporte: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['admin', 'superadmin', 'supervisor'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo admins y supervisores pueden generar reportes' });
        }

        // Recopilar todos los datos del módulo de seguridad
        const incidentes = await db.getIncidentesSeguridad(input.proyectoId);
        const proyecto = await db.getProyectoById(input.proyectoId);
        const usuariosProyecto = await db.getUsuariosByProyecto(input.proyectoId);
        const seguristas = usuariosProyecto.filter((u: any) => u.rolEnProyecto === 'segurista');
        const notasVoz = await db.getNotasVozByProyecto(input.proyectoId);

        // Recopilar fotos de evidencia de todos los incidentes
        const fotosEvidencia: string[] = [];
        for (const inc of incidentes) {
          // Foto principal del incidente
          if ((inc as any).fotoUrl) fotosEvidencia.push((inc as any).fotoUrl);
          // Evidencias adicionales
          try {
            const evidencias = await db.getEvidenciasByIncidente(inc.id);
            evidencias.forEach((ev: any) => { if (ev.fotoUrl) fotosEvidencia.push(ev.fotoUrl); });
          } catch (_) { /* skip */ }
        }

        // Estadísticas de incidentes
        const totalIncidentes = incidentes.length;
        const abiertos = incidentes.filter((i: any) => i.estado === 'abierto').length;
        const enProceso = incidentes.filter((i: any) => i.estado === 'en_proceso').length;
        const prevencion = incidentes.filter((i: any) => i.estado === 'prevencion').length;
        const cerrados = incidentes.filter((i: any) => i.estado === 'cerrado').length;
        const criticos = incidentes.filter((i: any) => i.severidad === 'critica').length;
        const altos = incidentes.filter((i: any) => i.severidad === 'alta').length;

        // Distribución por tipo
        const porTipo: Record<string, number> = {};
        incidentes.forEach((i: any) => { porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1; });

        // Distribución por severidad
        const porSeveridad: Record<string, number> = { baja: 0, media: 0, alta: 0, critica: 0 };
        incidentes.forEach((i: any) => { porSeveridad[i.severidad] = (porSeveridad[i.severidad] || 0) + 1; });

        // Distribución por ubicación
        const porUbicacion: Record<string, number> = {};
        incidentes.forEach((i: any) => { if (i.ubicacion) porUbicacion[i.ubicacion] = (porUbicacion[i.ubicacion] || 0) + 1; });

        // Roles en el proyecto
        const rolesDist: Record<string, number> = {};
        usuariosProyecto.forEach((u: any) => { rolesDist[u.rolEnProyecto] = (rolesDist[u.rolEnProyecto] || 0) + 1; });

        // Notas de voz transcripciones
        const transcripciones = notasVoz.map((n: any) => ({
          fecha: n.fechaCreacion,
          transcripcion: n.transcripcion,
          bullets: n.bullets,
        }));

        const fechaReporte = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        // Incluir fotos de evidencia en el contexto para el LLM
        const fotosInfo = fotosEvidencia.length > 0
          ? `\n\nFOTOS DE EVIDENCIA DISPONIBLES (${fotosEvidencia.length} fotos):\nIncluye las URLs de las fotos como imagenes en el reporte usando formato Markdown: ![Evidencia](url)\nURLs: ${fotosEvidencia.slice(0, 20).join(', ')}`
          : '\n\nNo hay fotos de evidencia disponibles aun.';

        const dataContext = JSON.stringify({
          proyecto: proyecto?.nombre || 'Sin nombre',
          direccion: proyecto?.direccion || '',
          fechaReporte,
          totalUsuarios: usuariosProyecto.length,
          distribucionRoles: rolesDist,
          totalSeguristas: seguristas.length,
          seguristas: seguristas.map((s: any) => s.usuario?.name || 'N/A'),
          estadisticasIncidentes: {
            total: totalIncidentes,
            abiertos, enProceso, prevencion, cerrados,
            criticos, altos,
          },
          distribucionPorTipo: porTipo,
          distribucionPorSeveridad: porSeveridad,
          distribucionPorUbicacion: porUbicacion,
          incidentesDetalle: incidentes.slice(0, 50).map((i: any) => ({
            codigo: i.codigo, tipo: i.tipo, severidad: i.severidad,
            descripcion: i.descripcion, ubicacion: i.ubicacion,
            estado: i.estado, fecha: i.createdAt, fotoUrl: (i as any).fotoUrl,
          })),
          notasDeVoz: transcripciones,
          fotosEvidencia: fotosEvidencia.slice(0, 20),
          diasSinAccidentesCriticos: totalIncidentes === 0 ? 'Sin incidentes registrados' :
            criticos === 0 ? 'Sin accidentes criticos registrados' : 'Hay accidentes criticos pendientes',
        }, null, 2);

        const llmResponse = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `Eres un experto en seguridad industrial y salud ocupacional en obras de construccion. Genera reportes ejecutivos profesionales en español. Usa formato Markdown. No uses acentos en el texto para compatibilidad. El reporte debe ser accionable, directo y enfocado en puntos criticos. Si hay fotos de evidencia disponibles, incluyelas en el reporte usando formato Markdown de imagen: ![Descripcion](url)`
            },
            {
              role: 'user',
              content: `Genera un REPORTE EJECUTIVO DE SEGURIDAD para el proyecto de construccion con los siguientes datos:\n\n${dataContext}${fotosInfo}\n\nEl reporte debe incluir:\n\n1. **ENCABEZADO**: Titulo "REPORTE EJECUTIVO DE SEGURIDAD", nombre del proyecto, direccion, fecha\n2. **RESUMEN EJECUTIVO**: Parrafo breve del estado general de seguridad\n3. **INDICADORES CLAVE (KPIs)**: Tabla con Total incidentes, Abiertos, En proceso, Prevencion, Cerrados, Criticos, Altos\n4. **ANALISIS POR TIPO DE INCIDENTE**: Tabla con distribucion y porcentajes\n5. **ANALISIS POR SEVERIDAD**: Tabla con distribucion y nivel de riesgo\n6. **ZONAS CRITICAS**: Analisis de ubicaciones con mayor incidencia\n7. **EQUIPO DE SEGURIDAD**: Lista de seguristas activos y cobertura\n8. **EVIDENCIA FOTOGRAFICA**: Si hay fotos disponibles, incluir las imagenes con su descripcion usando ![](url)\n9. **NOTAS DE VOZ / OBSERVACIONES DE CAMPO**: Resumen de transcripciones\n10. **PUNTOS CRITICOS DE ENFOQUE**: Lista priorizada de los 5-7 puntos mas urgentes\n11. **PLAN DE ACCION RECOMENDADO**: Tabla con accion, responsable sugerido, prioridad, plazo\n12. **CONCLUSIONES Y RECOMENDACIONES**: Parrafo final con vision estrategica\n\nSi hay 0 incidentes, enfoca el reporte en: estado de preparacion del equipo, recomendaciones preventivas, areas de riesgo potencial en obra de construccion, y plan de accion proactivo.\n\nSe profesional, concreto y accionable. No inventes datos que no esten en el contexto.`
            }
          ]
        });

        const reporteMarkdown = String(llmResponse.choices?.[0]?.message?.content || 'Error generando reporte');

        // Generar resumen corto para la lista
        const lineas = reporteMarkdown.split('\n').filter(l => l.trim().length > 20);
        const resumenCorto = lineas.slice(0, 2).join(' ').substring(0, 200);

        // Guardar en BD
        const reporteId = await db.crearReporteSeguridad({
          proyectoId: input.proyectoId,
          generadoPorId: ctx.user.id,
          titulo: `Reporte Ejecutivo - ${fechaReporte}`,
          markdown: reporteMarkdown,
          resumenCorto,
          totalIncidentes,
          abiertos,
          enProceso,
          prevencion,
          cerrados,
          totalSeguristas: seguristas.length,
          fotosEvidenciaUrls: fotosEvidencia.length > 0 ? JSON.stringify(fotosEvidencia) : null,
        });

        return {
          id: reporteId,
          markdown: reporteMarkdown,
          fechaGeneracion: new Date().toISOString(),
          proyecto: proyecto?.nombre || 'Sin nombre',
          fotosEvidencia,
        };
      }),

    // Listar historial de reportes
    listarReportes: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getReportesSeguridad(input.proyectoId);
      }),

    // Ver reporte individual
    verReporte: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const reporte = await db.getReporteSeguridadById(input.id);
        if (!reporte) throw new TRPCError({ code: 'NOT_FOUND', message: 'Reporte no encontrado' });
        return reporte;
      }),

    // Eliminar reporte
    eliminarReporte: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['admin', 'superadmin'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.eliminarReporteSeguridad(input.id);
        return { ok: true };
      }),
  }),

  // ===== PROGRAMA SEMANAL =====
  programaSemanal: router({
    // Crear programa semanal
    create: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        usuarioId: z.number().optional(), // admin/superadmin puede asignar a otro usuario
        semanaInicio: z.string(), // ISO date string del lunes
        semanaFin: z.string(), // ISO date string del domingo
        notas: z.string().optional(),
        actividades: z.array(z.object({
          especialidad: z.string(),
          actividad: z.string(),
          nivel: z.string().optional(),
          area: z.string().optional(),
          referenciaEje: z.string().optional(),
          unidad: z.enum(['m', 'm2', 'm3', 'ml', 'pza', 'kg', 'lt', 'jgo', 'lote', 'otro']),
          cantidadProgramada: z.string(), // decimal as string
          material: z.string().optional(),
          orden: z.number(),
        })),
        planos: z.array(z.object({
          nivel: z.string().optional(),
          tipo: z.enum(['planta', 'fachada', 'corte', 'otro']),
          titulo: z.string().optional(),
          imagenUrl: z.string(),
          imagenKey: z.string().optional(),
          orden: z.number(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Si admin/superadmin pasa usuarioId, usar ese; si no, usar el del usuario logueado
        const targetUserId = (input.usuarioId && ['admin', 'superadmin', 'supervisor'].includes(ctx.user.role || ''))
          ? input.usuarioId
          : ctx.user.id;

        // Verificar que no exista ya un programa para esta semana y usuario
        const existing = await db.getProgramaSemanalByWeek(
          input.proyectoId,
          targetUserId,
          new Date(input.semanaInicio)
        );
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Ya existe un programa para esta semana y usuario. Edítalo en lugar de crear uno nuevo.' });
        }

        const result = await db.createProgramaSemanal({
          proyectoId: input.proyectoId,
          usuarioId: targetUserId,
          creadoPorId: ctx.user.id, // Siempre registrar quién lo creó en el sistema
          semanaInicio: new Date(input.semanaInicio),
          semanaFin: new Date(input.semanaFin),
          notas: input.notas,
          status: 'borrador',
        });

        if (input.actividades.length > 0) {
          await db.createProgramaActividades(
            input.actividades.map(a => ({
              programaId: result.id,
              especialidad: a.especialidad,
              actividad: a.actividad,
              nivel: a.nivel,
              area: a.area,
              referenciaEje: a.referenciaEje,
              unidad: a.unidad,
              cantidadProgramada: a.cantidadProgramada,
              material: a.material,
              orden: a.orden,
            }))
          );
        }

        if (input.planos && input.planos.length > 0) {
          await db.createProgramaPlanos(
            input.planos.map(p => ({
              programaId: result.id,
              nivel: p.nivel,
              tipo: p.tipo,
              titulo: p.titulo,
              imagenUrl: p.imagenUrl,
              imagenKey: p.imagenKey,
              orden: p.orden,
            }))
          );
        }

        return { id: result.id };
      }),

    // Entregar programa (cambiar status a entregado)
    entregar: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const programa = await db.getProgramaSemanalById(input.id);
        if (!programa) throw new TRPCError({ code: 'NOT_FOUND' });
        if (programa.usuarioId !== ctx.user.id && !['admin', 'superadmin', 'supervisor'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.updateProgramaSemanal(input.id, {
          status: 'entregado',
          fechaEntrega: new Date(),
        });

        // Notificar a supervisores y admins del proyecto
        try {
          const proyectoUsers = await db.getUsuariosByProyecto(programa.proyectoId);
          const supervisores = proyectoUsers.filter(
            (pu: any) => pu.usuario && ['supervisor', 'admin', 'superadmin'].includes(pu.usuario.role || '')
          );
          const inicio = new Date(Number(programa.semanaInicio));
          const fin = new Date(Number(programa.semanaFin));
          const semanaStr = `${inicio.getDate().toString().padStart(2,'0')}/${(inicio.getMonth()+1).toString().padStart(2,'0')} - ${fin.getDate().toString().padStart(2,'0')}/${(fin.getMonth()+1).toString().padStart(2,'0')}`;

          for (const pu of supervisores) {
            if (!pu.usuario || pu.usuario.id === ctx.user.id) continue;
            // Push notification
            try {
              const pushSubs = await db.getPushSubscriptionsByUsuarios([pu.usuario.id]);
              if (pushSubs.length > 0) {
                await pushService.sendPushToMultiple(pushSubs, {
                  title: 'Programa Semanal Entregado',
                  body: `${ctx.user.name || 'Residente'} entregó su programa semanal (${semanaStr})`,
                  data: { url: '/programa-semanal', tipo: 'programa_entregado' },
                });
              }
            } catch (pushErr) {
              console.error('[ProgramaSemanal] Error push:', pushErr);
            }
            // In-app notification
            await db.createNotificacion({
              usuarioId: pu.usuario.id,
              proyectoId: programa.proyectoId,
              tipo: 'programa_entregado',
              titulo: 'Programa Semanal Entregado',
              mensaje: `${ctx.user.name || 'Residente'} entregó su programa semanal para la semana ${semanaStr}. Revísalo.`,
            });
          }
        } catch (notifErr) {
          console.error('[ProgramaSemanal] Error notificando supervisores:', notifErr);
        }

        return { ok: true };
      }),

    // Actualizar programa (actividades y planos)
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        usuarioId: z.number().optional(), // admin/superadmin puede reasignar usuario
        notas: z.string().optional(),
        actividades: z.array(z.object({
          especialidad: z.string(),
          actividad: z.string(),
          nivel: z.string().optional(),
          area: z.string().optional(),
          referenciaEje: z.string().optional(),
          unidad: z.enum(['m', 'm2', 'm3', 'ml', 'pza', 'kg', 'lt', 'jgo', 'lote', 'otro']),
          cantidadProgramada: z.string(),
          material: z.string().optional(),
          orden: z.number(),
        })),
        planos: z.array(z.object({
          nivel: z.string().optional(),
          tipo: z.enum(['planta', 'fachada', 'corte', 'otro']),
          titulo: z.string().optional(),
          imagenUrl: z.string(),
          imagenKey: z.string().optional(),
          orden: z.number(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const programa = await db.getProgramaSemanalById(input.id);
        if (!programa) throw new TRPCError({ code: 'NOT_FOUND' });
        // Cualquier usuario puede editar su programa incluso después del corte
        if (programa.usuarioId !== ctx.user.id && !['admin', 'superadmin', 'supervisor'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        // Si admin cambia el usuario asignado (solo en borrador)
        const updateData: any = { notas: input.notas };
        if (input.usuarioId && ['admin', 'superadmin', 'supervisor'].includes(ctx.user.role || '')) {
          updateData.usuarioId = input.usuarioId;
        }
        // Si se edita un programa con corte, resetear el corte
        if (programa.status === 'corte_realizado') {
          updateData.status = 'entregado';
          updateData.fechaCorte = null;
          updateData.eficienciaGlobal = null;
        }
        await db.updateProgramaSemanal(input.id, updateData);

        // Reemplazar actividades
        await db.deleteActividadesByPrograma(input.id);
        if (input.actividades.length > 0) {
          await db.createProgramaActividades(
            input.actividades.map(a => ({
              programaId: input.id,
              especialidad: a.especialidad,
              actividad: a.actividad,
              nivel: a.nivel,
              area: a.area,
              referenciaEje: a.referenciaEje,
              unidad: a.unidad,
              cantidadProgramada: a.cantidadProgramada,
              material: a.material,
              orden: a.orden,
            }))
          );
        }

        // Reemplazar planos si se proporcionan
        if (input.planos) {
          await db.deletePlanosByPrograma(input.id);
          if (input.planos.length > 0) {
            await db.createProgramaPlanos(
              input.planos.map(p => ({
                programaId: input.id,
                nivel: p.nivel,
                tipo: p.tipo,
                titulo: p.titulo,
                imagenUrl: p.imagenUrl,
                imagenKey: p.imagenKey,
                orden: p.orden,
              }))
            );
          }
        }

        return { ok: true };
      }),

    // Realizar corte de miércoles
    realizarCorte: protectedProcedure
      .input(z.object({
        id: z.number(),
        actividades: z.array(z.object({
          id: z.number(),
          cantidadRealizada: z.string(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const programa = await db.getProgramaSemanalById(input.id);
        if (!programa) throw new TRPCError({ code: 'NOT_FOUND' });
        if (programa.usuarioId !== ctx.user.id && !['admin', 'superadmin', 'supervisor'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        let totalProgramada = 0;
        let totalRealizada = 0;

        for (const act of input.actividades) {
          const realizada = parseFloat(act.cantidadRealizada) || 0;
          await db.updateProgramaActividad(act.id, {
            cantidadRealizada: act.cantidadRealizada,
            porcentajeAvance: String(realizada > 0 ? Math.min(100, realizada) : 0) as any,
          });
        }

        // Recalcular eficiencia global
        const actividades = await db.getActividadesByPrograma(input.id);
        for (const a of actividades) {
          const prog = parseFloat(String(a.cantidadProgramada)) || 0;
          const real = parseFloat(String(a.cantidadRealizada)) || 0;
          totalProgramada += prog;
          totalRealizada += real;
          // Actualizar % individual
          const pct = prog > 0 ? Math.min(999, (real / prog) * 100) : 0;
          await db.updateProgramaActividad(a.id, {
            porcentajeAvance: String(Math.round(pct * 100) / 100) as any,
          });
        }

        const eficiencia = totalProgramada > 0 ? (totalRealizada / totalProgramada) * 100 : 0;

        await db.updateProgramaSemanal(input.id, {
          status: 'corte_realizado',
          fechaCorte: new Date(),
          eficienciaGlobal: String(Math.round(eficiencia * 100) / 100) as any,
        });

        // Notificar al residente asignado con push notification
        try {
          const usuario = await db.getUserById(programa.usuarioId);
          if (usuario) {
            // Agrupar actividades por especialidad para resumen
            const actsByEsp = new Map<string, { prog: number; real: number }>();
            for (const a of actividades) {
              const esp = a.especialidad || 'Sin especialidad';
              const curr = actsByEsp.get(esp) || { prog: 0, real: 0 };
              curr.prog += parseFloat(String(a.cantidadProgramada)) || 0;
              curr.real += parseFloat(String(a.cantidadRealizada)) || 0;
              actsByEsp.set(esp, curr);
            }
            let resumen = '';
            for (const [esp, vals] of Array.from(actsByEsp.entries())) {
              const pct = vals.prog > 0 ? Math.round((vals.real / vals.prog) * 100) : 0;
              resumen += `${esp}: ${pct}% | `;
            }
            resumen = resumen.slice(0, -3);

            const pushSubs = await db.getPushSubscriptionsByUsuario(programa.usuarioId);
            if (pushSubs.length > 0) {
              await pushService.sendPushToMultiple(pushSubs, {
                title: `Corte Realizado - Eficiencia: ${Math.round(eficiencia * 100) / 100}%`,
                body: resumen,
                data: { url: '/programa-semanal' },
              });
            }

            // Notificar al owner también
            const { notifyOwner } = await import('./_core/notification');
            await notifyOwner({
              title: `Corte Realizado - ${usuario.name}`,
              content: `Eficiencia global: ${Math.round(eficiencia * 100) / 100}%\n${resumen}`,
            }).catch(() => {});
          }
        } catch (e) {
          console.error('[Corte] Error enviando notificación:', e);
        }

        return { ok: true, eficiencia: Math.round(eficiencia * 100) / 100 };
      }),

    // Estado del programa semanal del usuario actual (para banner en Home)
    statusSemanal: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Calcular lunes y domingo de la semana actual
        const now = new Date();
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        // Buscar programa del usuario para esta semana
        const programa = await db.getProgramaSemanalByWeek(input.proyectoId, ctx.user.id, monday);

        // Calcular si es miércoles o después (día de corte)
        const esMiercolesODespues = now.getDay() >= 3 || now.getDay() === 0; // mié=3, jue=4, vie=5, sáb=6, dom=0

        return {
          tienePrograma: !!programa,
          programaId: programa?.id || null,
          status: programa?.status || null,
          programaEntregado: programa ? programa.status !== 'borrador' : false,
          corteRealizado: programa?.status === 'corte_realizado',
          esMiercolesODespues,
          semana: {
            inicio: monday.toISOString(),
            fin: sunday.toISOString(),
          },
        };
      }),

    // Listar programas
    list: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        usuarioId: z.number().optional(),
        status: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getProgramasSemanales(input.proyectoId, input);
      }),

    // Obtener programa por ID con actividades y planos
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const programa = await db.getProgramaSemanalById(input.id);
        if (!programa) throw new TRPCError({ code: 'NOT_FOUND' });
        const actividades = await db.getActividadesByPrograma(input.id);
        const planos = await db.getPlanosByPrograma(input.id);
        return { ...programa, actividades, planos };
      }),

    // Eliminar programa
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const programa = await db.getProgramaSemanalById(input.id);
        if (!programa) throw new TRPCError({ code: 'NOT_FOUND' });
        const isAdminOrSuper = ['admin', 'superadmin'].includes(ctx.user.role || '');
        // Admin/superadmin pueden eliminar cualquier programa
        // Otros usuarios solo pueden eliminar sus propios borradores
        if (!isAdminOrSuper) {
          if (programa.status !== 'borrador') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Solo se pueden eliminar programas en borrador.' });
          }
          if (programa.usuarioId !== ctx.user.id) {
            throw new TRPCError({ code: 'FORBIDDEN' });
          }
        }
        await db.deleteProgramaSemanal(input.id);
        return { ok: true };
      }),

    // Datos de eficiencia para gráficos
    eficiencia: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        usuarioId: z.number().optional(),
        semanas: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getEficienciaHistorica(input.proyectoId, input);
      }),

    // Upload de plano (imagen)
    uploadPlano: protectedProcedure
      .input(z.object({
        programaId: z.number(),
        nivel: z.string().optional(),
        tipo: z.enum(['planta', 'fachada', 'corte', 'otro']),
        titulo: z.string().optional(),
        base64: z.string(),
        mimeType: z.string(),
        orden: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64, 'base64');
        const ext = input.mimeType.includes('png') ? 'png' : input.mimeType.includes('webp') ? 'webp' : 'jpg';
        const key = `programa-semanal/${input.programaId}/plano-${nanoid(8)}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);

        await db.createProgramaPlanos([{
          programaId: input.programaId,
          nivel: input.nivel,
          tipo: input.tipo,
          titulo: input.titulo,
          imagenUrl: url,
          imagenKey: key,
          orden: input.orden || 0,
        }]);

        return { url, key };
      }),

    // Eliminar un plano
    deletePlano: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProgramaPlano(input.id);
        return { ok: true };
      }),

    // Exportar datos para PDF
    exportarPDF: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const programa = await db.getProgramaSemanalById(input.id);
        if (!programa) throw new TRPCError({ code: 'NOT_FOUND' });
        const actividades = await db.getActividadesByPrograma(input.id);
        const planos = await db.getPlanosByPrograma(input.id);
        const usuario = await db.getUserById(programa.usuarioId);
        
        // Calcular eficiencia por especialidad
        const porEspecialidad = new Map<string, { prog: number; real: number }>();
        for (const a of actividades) {
          const key = a.especialidad;
          if (!porEspecialidad.has(key)) porEspecialidad.set(key, { prog: 0, real: 0 });
          const entry = porEspecialidad.get(key)!;
          entry.prog += parseFloat(a.cantidadProgramada as any) || 0;
          entry.real += parseFloat(a.cantidadRealizada as any) || 0;
        }

        return {
          programa: {
            ...programa,
            semanaInicio: programa.semanaInicio.toISOString(),
            semanaFin: programa.semanaFin.toISOString(),
            fechaEntrega: programa.fechaEntrega?.toISOString() || null,
            fechaCorte: programa.fechaCorte?.toISOString() || null,
          },
          usuario: usuario ? { name: usuario.name, role: usuario.role } : null,
          actividades: actividades.map(a => ({
            ...a,
            cantidadProgramada: parseFloat(a.cantidadProgramada as any) || 0,
            cantidadRealizada: parseFloat(a.cantidadRealizada as any) || 0,
            porcentajeAvance: parseFloat(a.porcentajeAvance as any) || 0,
          })),
          planos: planos.map(p => ({ ...p, imagenUrl: p.imagenUrl })),
          eficienciaPorEspecialidad: Array.from(porEspecialidad.entries()).map(([esp, v]) => ({
            especialidad: esp,
            programada: v.prog,
            realizada: v.real,
            eficiencia: v.prog > 0 ? Math.round((v.real / v.prog) * 10000) / 100 : 0,
          })),
        };
      }),

    // ===== PLANTILLAS =====
    crearPlantilla: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        nombre: z.string().min(1),
        descripcion: z.string().optional(),
        actividades: z.array(z.object({
          especialidad: z.string(),
          actividad: z.string(),
          nivel: z.string().optional(),
          area: z.string().optional(),
          referenciaEje: z.string().optional(),
          unidad: z.string(),
          cantidadProgramada: z.number().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createProgramaPlantilla({
          proyectoId: input.proyectoId,
          usuarioId: ctx.user.id,
          nombre: input.nombre,
          descripcion: input.descripcion,
          actividades: input.actividades,
        });
        return { id };
      }),

    listarPlantillas: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        await db.seedProgramaPlantillaBase(input.proyectoId);
        return db.getPlantillasByProyecto(input.proyectoId);
      }),

    getPlantilla: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const p = await db.getPlantillaById(input.id);
        if (!p) throw new TRPCError({ code: 'NOT_FOUND' });
        return p;
      }),

    eliminarPlantilla: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const p = await db.getPlantillaById(input.id);
        if (!p) throw new TRPCError({ code: 'NOT_FOUND' });
        if (p.usuarioId !== ctx.user.id && !['admin', 'superadmin'].includes(ctx.user.role || '')) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.deletePlantilla(input.id);
        return { ok: true };
      }),

    // Guardar actividades actuales como plantilla
    guardarComoPlantilla: protectedProcedure
      .input(z.object({
        programaId: z.number(),
        nombre: z.string().min(1),
        descripcion: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const actividades = await db.getActividadesByPrograma(input.programaId);
        const programa = await db.getProgramaSemanalById(input.programaId);
        if (!programa) throw new TRPCError({ code: 'NOT_FOUND' });
        const actividadesPlantilla = actividades.map(a => ({
          especialidad: a.especialidad,
          actividad: a.actividad,
          nivel: a.nivel,
          area: a.area,
          referenciaEje: a.referenciaEje,
          unidad: a.unidad,
          cantidadProgramada: parseFloat(a.cantidadProgramada as any) || 0,
        }));
        const id = await db.createProgramaPlantilla({
          proyectoId: programa.proyectoId,
          usuarioId: ctx.user.id,
          nombre: input.nombre,
          descripcion: input.descripcion,
          actividades: actividadesPlantilla,
        });
        return { id };
      }),

    // ===== COMPARATIVA SEMANAL =====
    comparativa: protectedProcedure
      .input(z.object({
        programaId1: z.number(),
        programaId2: z.number(),
      }))
      .query(async ({ input }) => {
        const data = await db.getComparativaSemanal(input.programaId1, input.programaId2);
        if (!data) throw new TRPCError({ code: 'NOT_FOUND' });
        
        const calcEf = (acts: any[]) => {
          const total = acts.reduce((s, a) => s + (parseFloat(a.cantidadProgramada) || 0), 0);
          const real = acts.reduce((s, a) => s + (parseFloat(a.cantidadRealizada) || 0), 0);
          return total > 0 ? Math.round((real / total) * 10000) / 100 : 0;
        };

        const porEsp = (acts: any[]) => {
          const map = new Map<string, { prog: number; real: number }>();
          for (const a of acts) {
            if (!map.has(a.especialidad)) map.set(a.especialidad, { prog: 0, real: 0 });
            const e = map.get(a.especialidad)!;
            e.prog += parseFloat(a.cantidadProgramada) || 0;
            e.real += parseFloat(a.cantidadRealizada) || 0;
          }
          return Array.from(map.entries()).map(([esp, v]) => ({
            especialidad: esp,
            programada: v.prog,
            realizada: v.real,
            eficiencia: v.prog > 0 ? Math.round((v.real / v.prog) * 10000) / 100 : 0,
          }));
        };

        return {
          semana1: {
            ...data.programa1,
            semanaInicio: data.programa1.semanaInicio.toISOString(),
            semanaFin: data.programa1.semanaFin.toISOString(),
            eficienciaCalculada: calcEf(data.programa1.actividades),
            porEspecialidad: porEsp(data.programa1.actividades),
            actividades: data.programa1.actividades.map(a => ({
              ...a,
              cantidadProgramada: parseFloat(a.cantidadProgramada as any) || 0,
              cantidadRealizada: parseFloat(a.cantidadRealizada as any) || 0,
              porcentajeAvance: parseFloat(a.porcentajeAvance as any) || 0,
            })),
          },
          semana2: {
            ...data.programa2,
            semanaInicio: data.programa2.semanaInicio.toISOString(),
            semanaFin: data.programa2.semanaFin.toISOString(),
            eficienciaCalculada: calcEf(data.programa2.actividades),
            porEspecialidad: porEsp(data.programa2.actividades),
            actividades: data.programa2.actividades.map(a => ({
              ...a,
              cantidadProgramada: parseFloat(a.cantidadProgramada as any) || 0,
              cantidadRealizada: parseFloat(a.cantidadRealizada as any) || 0,
              porcentajeAvance: parseFloat(a.porcentajeAvance as any) || 0,
            })),
          },
        };
      }),

    // Resumen ejecutivo mensual
    resumenMensual: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        mes: z.number().min(1).max(12),
        anio: z.number(),
        usuarioId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const result = await db.getProgramasSemanales(input.proyectoId, { usuarioId: input.usuarioId });
        const allProgramas = result.programas;
        // Filtrar por mes/año
        const programasMes = allProgramas.filter((p: any) => {
          const d = new Date(p.semanaInicio);
          return d.getMonth() + 1 === input.mes && d.getFullYear() === input.anio;
        });

        const semanas = programasMes.map((p: any) => {
          const ef = p.eficienciaGlobal != null ? parseFloat(p.eficienciaGlobal) : null;
          const entrega = p.fechaEntrega ? new Date(p.fechaEntrega) : null;
          const fin = new Date(p.semanaFin);
          const viernes = new Date(fin); viernes.setDate(viernes.getDate() - 2); viernes.setHours(23,59,59,999);
          let cumplimiento: 'a_tiempo' | 'tarde' | 'pendiente' = 'pendiente';
          if (entrega) cumplimiento = entrega <= viernes ? 'a_tiempo' : 'tarde';
          return {
            id: p.id,
            semanaInicio: p.semanaInicio,
            semanaFin: p.semanaFin,
            status: p.status,
            eficiencia: ef,
            cumplimiento,
            usuarioId: p.usuarioId,
            fechaEntrega: p.fechaEntrega,
          };
        });

        const conCorte = semanas.filter((s: any) => s.eficiencia != null);
        const eficienciaPromedio = conCorte.length > 0
          ? Math.round(conCorte.reduce((sum: number, s: any) => sum + s.eficiencia, 0) / conCorte.length * 100) / 100
          : null;

        const totalEntregados = semanas.filter((s: any) => s.cumplimiento !== 'pendiente').length;
        const aTiempo = semanas.filter((s: any) => s.cumplimiento === 'a_tiempo').length;
        const tarde = semanas.filter((s: any) => s.cumplimiento === 'tarde').length;
        const pendientes = semanas.filter((s: any) => s.cumplimiento === 'pendiente').length;

        // Tendencia: comparar primera mitad vs segunda mitad
        const mitad = Math.ceil(conCorte.length / 2);
        const primera = conCorte.slice(0, mitad);
        const segunda = conCorte.slice(mitad);
        const efPrimera = primera.length > 0 ? primera.reduce((s: number, x: any) => s + x.eficiencia, 0) / primera.length : 0;
        const efSegunda = segunda.length > 0 ? segunda.reduce((s: number, x: any) => s + x.eficiencia, 0) / segunda.length : 0;
        const tendencia = segunda.length > 0 && primera.length > 0 ? Math.round((efSegunda - efPrimera) * 100) / 100 : 0;

        return {
          mes: input.mes,
          anio: input.anio,
          semanas,
          totalProgramas: semanas.length,
          eficienciaPromedio,
          tendencia,
          cumplimiento: { aTiempo, tarde, pendientes, totalEntregados },
        };
      }),

    // Reporte de eficiencia por empresa para PDF
    reporteEficienciaPorEmpresa: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        const result = await db.getProgramasSemanales(input.proyectoId, { limit: 500 });
        const allProgramas = result.programas;
        const empresasData = await db.getAllEmpresas(input.proyectoId);
        const empresasMap = new Map(empresasData.map((e: any) => [e.id, e.nombre]));
        
        // Obtener usuarios del proyecto con su empresa
        const usuariosProyecto = await db.getUsuariosByProyecto(input.proyectoId);
        const userEmpresaMap = new Map<number, { nombre: string; empresaId: number | null; empresaNombre: string }>();
        for (const up of usuariosProyecto) {
          const u = up.usuario as any;
          if (u) {
            userEmpresaMap.set(u.id, {
              nombre: u.name || u.email || 'Sin nombre',
              empresaId: u.empresaId || null,
              empresaNombre: u.empresaId ? (empresasMap.get(u.empresaId) || 'Sin empresa') : 'Sin empresa',
            });
          }
        }
        
        // Agrupar programas por empresa del usuario
        const porEmpresa = new Map<string, {
          empresaNombre: string;
          programas: number;
          cortes: number;
          eficiencias: number[];
          aTiempo: number;
          tarde: number;
          pendiente: number;
          usuarios: Set<number>;
        }>();
        
        for (const p of allProgramas) {
          const userInfo = userEmpresaMap.get(p.usuarioId);
          const empNombre = userInfo?.empresaNombre || 'Sin empresa';
          if (!porEmpresa.has(empNombre)) {
            porEmpresa.set(empNombre, {
              empresaNombre: empNombre,
              programas: 0, cortes: 0, eficiencias: [], aTiempo: 0, tarde: 0, pendiente: 0, usuarios: new Set(),
            });
          }
          const entry = porEmpresa.get(empNombre)!;
          entry.programas++;
          entry.usuarios.add(p.usuarioId);
          if (p.status === 'corte_realizado') {
            entry.cortes++;
            if (p.eficienciaGlobal != null) entry.eficiencias.push(parseFloat(p.eficienciaGlobal as any));
          }
          const entrega = p.fechaEntrega ? new Date(p.fechaEntrega) : null;
          const fin = new Date(p.semanaFin);
          const viernes = new Date(fin); viernes.setDate(viernes.getDate() - 2); viernes.setHours(23,59,59,999);
          if (!entrega || p.status === 'borrador') entry.pendiente++;
          else if (entrega <= viernes) entry.aTiempo++;
          else entry.tarde++;
        }
        
        // Detalle por usuario
        const porUsuario = new Map<number, {
          nombre: string;
          empresaNombre: string;
          programas: number;
          cortes: number;
          eficiencias: number[];
          aTiempo: number;
          tarde: number;
        }>();
        
        for (const p of allProgramas) {
          if (!porUsuario.has(p.usuarioId)) {
            const userInfo = userEmpresaMap.get(p.usuarioId);
            porUsuario.set(p.usuarioId, {
              nombre: userInfo?.nombre || 'Sin nombre',
              empresaNombre: userInfo?.empresaNombre || 'Sin empresa',
              programas: 0, cortes: 0, eficiencias: [], aTiempo: 0, tarde: 0,
            });
          }
          const entry = porUsuario.get(p.usuarioId)!;
          entry.programas++;
          if (p.status === 'corte_realizado') {
            entry.cortes++;
            if (p.eficienciaGlobal != null) entry.eficiencias.push(parseFloat(p.eficienciaGlobal as any));
          }
          const entrega = p.fechaEntrega ? new Date(p.fechaEntrega) : null;
          const fin = new Date(p.semanaFin);
          const viernes = new Date(fin); viernes.setDate(viernes.getDate() - 2); viernes.setHours(23,59,59,999);
          if (entrega && p.status !== 'borrador') {
            if (entrega <= viernes) entry.aTiempo++;
            else entry.tarde++;
          }
        }
        
        return {
          porEmpresa: Array.from(porEmpresa.values()).map(e => ({
            empresaNombre: e.empresaNombre,
            totalProgramas: e.programas,
            totalCortes: e.cortes,
            eficienciaPromedio: e.eficiencias.length > 0 ? Math.round(e.eficiencias.reduce((s, v) => s + v, 0) / e.eficiencias.length * 100) / 100 : null,
            aTiempo: e.aTiempo,
            tarde: e.tarde,
            pendiente: e.pendiente,
            totalUsuarios: e.usuarios.size,
          })).sort((a, b) => (b.eficienciaPromedio || 0) - (a.eficienciaPromedio || 0)),
          porUsuario: Array.from(porUsuario.values()).map(u => ({
            nombre: u.nombre,
            empresaNombre: u.empresaNombre,
            totalProgramas: u.programas,
            totalCortes: u.cortes,
            eficienciaPromedio: u.eficiencias.length > 0 ? Math.round(u.eficiencias.reduce((s, v) => s + v, 0) / u.eficiencias.length * 100) / 100 : null,
            aTiempo: u.aTiempo,
            tarde: u.tarde,
          })).sort((a, b) => (b.eficienciaPromedio || 0) - (a.eficienciaPromedio || 0)),
          totalProgramas: allProgramas.length,
          totalCortes: allProgramas.filter((p: any) => p.status === 'corte_realizado').length,
        };
      }),

    // Ranking de cumplimiento por usuario
    rankingCumplimiento: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        mes: z.number().min(1).max(12).optional(),
        anio: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const result2 = await db.getProgramasSemanales(input.proyectoId);
        const allProgramas = result2.programas;
        // Filtrar por mes/año si se especifica
        let programas = allProgramas;
        if (input.mes && input.anio) {
          programas = allProgramas.filter((p: any) => {
            const d = new Date(p.semanaInicio);
            return d.getMonth() + 1 === input.mes && d.getFullYear() === input.anio;
          });
        }

        // Agrupar por usuario
        const userMap = new Map<number, { aTiempo: number; tarde: number; pendiente: number; eficiencias: number[]; total: number }>();
        for (const p of programas) {
          if (!userMap.has(p.usuarioId)) userMap.set(p.usuarioId, { aTiempo: 0, tarde: 0, pendiente: 0, eficiencias: [], total: 0 });
          const u = userMap.get(p.usuarioId)!;
          u.total++;
          const entrega = p.fechaEntrega ? new Date(p.fechaEntrega) : null;
          const fin = new Date(p.semanaFin);
          const viernes = new Date(fin); viernes.setDate(viernes.getDate() - 2); viernes.setHours(23,59,59,999);
          if (!entrega || p.status === 'borrador') { u.pendiente++; }
          else if (entrega <= viernes) { u.aTiempo++; }
          else { u.tarde++; }
          if (p.eficienciaGlobal != null) u.eficiencias.push(parseFloat(p.eficienciaGlobal));
        }

        // Obtener nombres de usuarios
        const usuarios = await db.getUsuariosByProyecto(input.proyectoId);
        // getUsuariosByProyecto retorna { usuarioId, usuario: { id, name, role, ... }, ... }
        const usuariosMap = new Map(usuarios.map((u: any) => [u.usuarioId, u]));

        const ranking = Array.from(userMap.entries()).map(([userId, data]) => {
          const rel = usuariosMap.get(userId);
          const user = rel?.usuario;
          const efPromedio = data.eficiencias.length > 0
            ? Math.round(data.eficiencias.reduce((s, e) => s + e, 0) / data.eficiencias.length * 100) / 100
            : null;
          const pctATiempo = data.total > 0 ? Math.round((data.aTiempo / data.total) * 10000) / 100 : 0;
          return {
            userId,
            nombre: user?.name || 'Sin nombre',
            role: user?.role || rel?.rol || '',
            especialidad: rel?.especialidad || '',
            fotoUrl: user?.fotoUrl || null,
            total: data.total,
            aTiempo: data.aTiempo,
            tarde: data.tarde,
            pendiente: data.pendiente,
            pctATiempo,
            eficienciaPromedio: efPromedio,
          };
        }).sort((a, b) => b.pctATiempo - a.pctATiempo || (b.eficienciaPromedio || 0) - (a.eficienciaPromedio || 0));

        return { ranking };
      }),

    // ===== METAS DE EFICIENCIA =====
    getMetasEficiencia: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getMetasEficiencia(input.proyectoId);
      }),

    upsertMetaEficiencia: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        usuarioId: z.number(),
        metaEficiencia: z.number().min(0).max(100),
        metaCumplimiento: z.number().min(0).max(100),
      }))
      .mutation(async ({ input }) => {
        return db.upsertMetaEficiencia(input);
      }),

    deleteMetaEficiencia: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteMetaEficiencia(input.id);
        return { success: true };
      }),

    // Verificar alertas de metas no alcanzadas
    verificarAlertasMetas: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        const metas = await db.getMetasEficiencia(input.proyectoId);
        if (metas.length === 0) return { alertas: [] };

        const result2 = await db.getProgramasSemanales(input.proyectoId);
        const allProgramas = result2.programas;
        // Últimas 4 semanas
        const now = Date.now();
        const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000;
        const recientes = allProgramas.filter((p: any) => Number(p.semanaInicio) >= fourWeeksAgo);

        const alertas: { usuarioId: number; nombre: string; tipo: string; meta: number; actual: number; diferencia: number }[] = [];
        const usuarios = await db.getUsuariosByProyecto(input.proyectoId);
        const usuariosMap = new Map(usuarios.map((u: any) => [u.usuarioId, u]));

        for (const meta of metas) {
          const userProgs = recientes.filter((p: any) => p.usuarioId === meta.usuarioId);
          if (userProgs.length === 0) continue;
          const rel = usuariosMap.get(meta.usuarioId);
          const nombre = rel?.usuario?.name || 'Sin nombre';

          // Verificar eficiencia
          const eficiencias = userProgs.filter((p: any) => p.eficienciaGlobal != null).map((p: any) => parseFloat(p.eficienciaGlobal));
          if (eficiencias.length > 0) {
            const promEf = eficiencias.reduce((s: number, e: number) => s + e, 0) / eficiencias.length;
            if (promEf < meta.metaEficiencia) {
              alertas.push({ usuarioId: meta.usuarioId, nombre, tipo: 'eficiencia', meta: meta.metaEficiencia, actual: Math.round(promEf * 10) / 10, diferencia: Math.round((meta.metaEficiencia - promEf) * 10) / 10 });
            }
          }

          // Verificar cumplimiento de entrega
          let aTiempo = 0;
          for (const p of userProgs) {
            const entrega = p.fechaEntrega ? new Date(p.fechaEntrega) : null;
            const fin = new Date(Number(p.semanaFin));
            const viernes = new Date(fin); viernes.setDate(viernes.getDate() - 2); viernes.setHours(23,59,59,999);
            if (entrega && entrega <= viernes) aTiempo++;
          }
          const pctCumpl = userProgs.length > 0 ? (aTiempo / userProgs.length) * 100 : 0;
          if (pctCumpl < meta.metaCumplimiento) {
            alertas.push({ usuarioId: meta.usuarioId, nombre, tipo: 'cumplimiento', meta: meta.metaCumplimiento, actual: Math.round(pctCumpl * 10) / 10, diferencia: Math.round((meta.metaCumplimiento - pctCumpl) * 10) / 10 });
          }
        }

        return { alertas };
      }),

    // ===== ASISTENTE IA =====
    aiGenerarActividades: protectedProcedure
      .input(z.object({
        descripcion: z.string().optional(),
        imagenUrl: z.string().optional(),
        especialidad: z.string().optional(),
        contexto: z.string().optional(), // Actividades existentes como contexto
      }))
      .mutation(async ({ input }) => {
        const { descripcion, imagenUrl, especialidad, contexto } = input;
        if (!descripcion && !imagenUrl) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Proporciona una descripción o imagen.' });
        }

        const systemPrompt = `Eres un asistente experto en programación de obra para construcción de edificios residenciales en México.
Tu tarea es generar actividades para un programa semanal de trabajo.

Reglas:
- Genera actividades realistas de construcción con datos concretos
- Cada actividad debe tener: especialidad, actividad (descripción corta), nivel (ej: N10, N11, PB), area, referenciaEje (ej: A-C / 1-4), unidad de medida (m, m2, m3, ml, pza, kg, lt, jgo, lote, otro), cantidadProgramada (número realista), y material (material principal requerido)
- Las unidades de medida SOLO pueden ser: m, m2, m3, ml, pza, kg, lt, jgo, lote, otro
- Usa nomenclatura mexicana estándar de construcción
- Si se proporciona una imagen de un programa existente, extrae las actividades tal como aparecen
- Si se proporciona una descripción, genera actividades coherentes
- Responde SOLO con el JSON, sin texto adicional`;

        const userParts: any[] = [];

        if (imagenUrl) {
          userParts.push({
            type: 'image_url',
            image_url: { url: imagenUrl, detail: 'high' },
          });
          userParts.push({
            type: 'text',
            text: 'Extrae todas las actividades de esta imagen de programa semanal de obra. Incluye especialidad, actividad, nivel, área, eje de referencia, unidad, cantidad programada y material para cada renglón visible.',
          });
        }

        if (descripcion) {
          userParts.push({
            type: 'text',
            text: `Genera actividades para el siguiente programa semanal:\n${descripcion}${especialidad ? `\nEspecialidad principal: ${especialidad}` : ''}`,
          });
        }

        if (contexto) {
          userParts.push({
            type: 'text',
            text: `Contexto - actividades ya existentes en el programa (no las repitas, complementa):\n${contexto}`,
          });
        }

        const response = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userParts.length === 1 && userParts[0].type === 'text' ? userParts[0].text : userParts },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'actividades_programa',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  actividades: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        especialidad: { type: 'string', description: 'Especialidad o trade (ej: Albañilería, Inst. Eléctrica)' },
                        actividad: { type: 'string', description: 'Descripción corta de la actividad' },
                        nivel: { type: 'string', description: 'Nivel del edificio (ej: N10, PB, Azotea)' },
                        area: { type: 'string', description: 'Área de trabajo (ej: Dptos, Pasillo, Baños)' },
                        referenciaEje: { type: 'string', description: 'Ejes de referencia (ej: A-C / 1-4)' },
                        unidad: { type: 'string', description: 'Unidad de medida: m, m2, m3, ml, pza, kg, lt, jgo, lote, otro' },
                        cantidadProgramada: { type: 'number', description: 'Cantidad programada para la semana' },
                        material: { type: 'string', description: 'Material principal requerido' },
                      },
                      required: ['especialidad', 'actividad', 'nivel', 'area', 'referenciaEje', 'unidad', 'cantidadProgramada', 'material'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['actividades'],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No se obtuvo respuesta del asistente IA.' });
        }

        try {
          const parsed = JSON.parse(content);
          // Validar y normalizar unidades
          const validUnits = ['m', 'm2', 'm3', 'ml', 'pza', 'kg', 'lt', 'jgo', 'lote', 'otro'];
          const actividades = (parsed.actividades || []).map((a: any, i: number) => ({
            especialidad: String(a.especialidad || '').trim(),
            actividad: String(a.actividad || '').trim(),
            nivel: String(a.nivel || '').trim(),
            area: String(a.area || '').trim(),
            referenciaEje: String(a.referenciaEje || '').trim(),
            unidad: validUnits.includes(a.unidad) ? a.unidad : 'otro',
            cantidadProgramada: String(Math.max(0, Number(a.cantidadProgramada) || 0)),
            material: String(a.material || '').trim(),
            orden: i,
          }));
          return { actividades };
        } catch (e) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Error al procesar respuesta del asistente IA.' });
        }
      }),

    // Generar plantilla Excel estándar para descargar
    generarPlantillaExcel: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .mutation(async ({ input }) => {
        const XLSX = await import('xlsx');
        const headers = [
          'ESPECIALIDAD', 'ACTIVIDADES', 'NIVEL', 'AREA', 'REFERENCIA DE EJE', 'UNIDAD', 'VOLUMEN'
        ];
        const exampleRows = [
          ['ALBANILERIAS', 'Decimbrado', '10', 'departamentos', '2-7    B-D', 'm2', '120'],
          ['ALBANILERIAS', 'Perfilado de charolas y ventanas', '4', 'departamentos', '2-7    B-D', 'm2', '85'],
          ['ALBANILERIAS', 'Desbaste de firme', '3', 'departamentos', '2-7    B-D', 'm2', '200'],
          ['CERAMICOS', 'Instalacion de pisos', '3', 'DPTOS: 308 y 304', '6-7    C-D', 'm2', '45'],
          ['CERAMICOS', 'Instalacion de pisos', 'PB', 'banos del lobby', '6-7    C-D', 'm2', '95'],
          ['TABLAROCA', 'cierre 2 cara y plafones', '3', 'DEPARTAMENTOS', '2-7    B-D', 'm2', '60'],
          ['TABLAROCA', 'Aplicacion de pasta', '3', 'departamentos', '2-7    B-D', 'm2', '75'],
          ['TABLAROCA', 'Aplicacion de pintura', '2', 'departamentos (206, 205, 202, 201)', '2-5    B-D', 'm2', '110'],
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
        // Anchos de columna
        ws['!cols'] = [
          { wch: 20 }, { wch: 35 }, { wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 12 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Actividades');
        // Hoja de instrucciones
        const instrucciones = [
          ['INSTRUCCIONES PARA LLENAR LA PLANTILLA'],
          [''],
          ['1. Llena las columnas en la hoja "Actividades"'],
          ['2. No modifiques los encabezados de la primera fila'],
          ['3. Borra las filas de ejemplo antes de agregar tus actividades'],
          ['4. ESPECIALIDAD: nombre de la especialidad (ej: ALBANILERIAS, CERAMICOS, TABLAROCA)'],
          ['5. ACTIVIDADES: descripcion de la actividad a realizar'],
          ['6. NIVEL: numero de nivel o PB, Sotano, Azotea'],
          ['7. AREA: area donde se realiza (ej: departamentos, banos, pasillo)'],
          ['8. REFERENCIA DE EJE: ejes de referencia (ej: 2-7    B-D)'],
          ['9. UNIDAD: m, m2, m3, ml, pza, kg, lt, jgo, lote, otro'],
          ['10. VOLUMEN: cantidad programada (solo numeros)'],
          ['11. Puedes agregar tantas filas como necesites'],
          ['12. Guarda el archivo y subelo en la app junto con tus fotos de planos'],
        ];
        const wsInst = XLSX.utils.aoa_to_sheet(instrucciones);
        wsInst['!cols'] = [{ wch: 65 }];
        XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const base64 = Buffer.from(buffer).toString('base64');
        return { base64, filename: 'Plantilla_Programa_Semanal.xlsx' };
      }),

    // Parsear Excel subido y extraer actividades
    parsearExcel: protectedProcedure
      .input(z.object({
        base64: z.string(),
      }))
      .mutation(async ({ input }) => {
        const XLSX = await import('xlsx');
        const buffer = Buffer.from(input.base64, 'base64');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        // Buscar hoja "Actividades" o usar la primera
        const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('actividad')) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        if (!ws) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No se encontro una hoja valida en el archivo Excel.' });
        }
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'El archivo no contiene actividades. Asegurate de llenar al menos una fila debajo de los encabezados.' });
        }
        // Saltar header (primera fila)
        // Columnas: 0=ESPECIALIDAD, 1=ACTIVIDADES, 2=NIVEL, 3=AREA, 4=REFERENCIA DE EJE, 5=UNIDAD, 6=VOLUMEN
        const validUnits = ['m', 'm2', 'm3', 'ml', 'pza', 'kg', 'lt', 'jgo', 'lote', 'otro'];
        const actividades = rows.slice(1)
          .filter((row: any[]) => row && row.length >= 2 && String(row[1] || '').trim())
          .map((row: any[], i: number) => {
            const rawUnit = String(row[5] || 'm2').trim().toLowerCase();
            const unidad = validUnits.includes(rawUnit) ? rawUnit : 'otro';
            const cantRaw = String(row[6] || '0').replace(/[^0-9.,]/g, '').replace(',', '.');
            return {
              especialidad: String(row[0] || '').trim(),
              actividad: String(row[1] || '').trim(),
              nivel: String(row[2] || '').trim(),
              area: String(row[3] || '').trim(),
              referenciaEje: String(row[4] || '').trim(),
              unidad,
              cantidadProgramada: String(Math.max(0, Number(cantRaw) || 0)),
              material: '',
              orden: i,
            };
          });
        if (actividades.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No se encontraron actividades validas en el archivo. Verifica que la columna "Actividad" tenga datos.' });
        }
        return { actividades, total: actividades.length };
      }),

    // Reportes agrupados por empresa con eficiencia global
    reportesPorEmpresa: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getProgramasPorEmpresa(input.proyectoId);
      }),

    // Tendencia de eficiencia por empresa (últimas N semanas)
    tendenciaEficiencia: protectedProcedure
      .input(z.object({ proyectoId: z.number(), semanas: z.number().optional() }))
      .query(async ({ input }) => {
        const programas = await db.getEficienciaHistorica(input.proyectoId, { semanas: input.semanas || 8 });
        // Agrupar por usuario y semana
        const porUsuario = new Map<number, { nombre: string; semanas: { fecha: string; eficiencia: number }[] }>();
        for (const p of programas) {
          if (!porUsuario.has(p.usuarioId)) {
            const user = await db.getUserById(p.usuarioId);
            porUsuario.set(p.usuarioId, { nombre: user?.name || 'Sin nombre', semanas: [] });
          }
          const entry = porUsuario.get(p.usuarioId)!;
          const fecha = p.semanaInicio ? new Date(p.semanaInicio).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '';
          entry.semanas.push({ fecha, eficiencia: parseFloat(String(p.eficienciaGlobal)) || 0 });
        }
        // Convertir a formato para gráfica: array de semanas con una key por empresa
        const allFechas = new Set<string>();
        for (const [, v] of Array.from(porUsuario.entries())) {
          for (const s of v.semanas) allFechas.add(s.fecha);
        }
        const fechasArr = Array.from(allFechas).reverse(); // más antigua primero
        const series = Array.from(porUsuario.entries()).map(([id, v]) => ({
          id, nombre: v.nombre, data: v.semanas,
        }));
        const chartData = fechasArr.map(fecha => {
          const point: Record<string, any> = { fecha };
          for (const s of series) {
            const match = s.data.find(d => d.fecha === fecha);
            point[s.nombre] = match ? match.eficiencia : null;
          }
          return point;
        });
        return { chartData, empresas: series.map(s => s.nombre) };
      }),

    // Análisis IA con 8Ms para PDF por empresa (con caché en BD)
    analisis8Ms: protectedProcedure
      .input(z.object({
        programaId: z.number(),
        especialidad: z.string(),
      }))
      .mutation(async ({ input }) => {
        const actividades = await db.getActividadesByPrograma(input.programaId);
        const filtradas = actividades.filter((a: any) => a.especialidad === input.especialidad);
        if (filtradas.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No hay actividades para esta especialidad.' });
        }

        const totalProg = filtradas.reduce((s: number, a: any) => s + (parseFloat(a.cantidadProgramada) || 0), 0);
        const totalReal = filtradas.reduce((s: number, a: any) => s + (parseFloat(a.cantidadRealizada) || 0), 0);
        const eficiencia = totalProg > 0 ? ((totalReal / totalProg) * 100).toFixed(1) : '0.0';

        // --- CACHÉ 8Ms: generar hash de los datos para detectar cambios ---
        const hashData = filtradas.map((a: any) => `${a.actividad}|${a.cantidadProgramada}|${a.cantidadRealizada}`).sort().join(';');
        const { createHash } = await import('crypto');
        const itemsHash = createHash('md5').update(hashData).digest('hex');

        // Buscar en caché
        try {
          const cached = await db.getAnalisis8msCache(input.programaId, input.especialidad, itemsHash);
          if (cached) {
            console.log(`[8Ms Cache] HIT para programa ${input.programaId}, especialidad ${input.especialidad}`);
            return JSON.parse(cached.resultado);
          }
          console.log(`[8Ms Cache] MISS para programa ${input.programaId}, especialidad ${input.especialidad}`);
        } catch (e) {
          console.error('[8Ms Cache] Error al buscar caché:', e);
        }

        const actividadesTexto = filtradas.map((a: any) => {
          const pct = parseFloat(a.porcentajeAvance) || 0;
          return `- ${a.actividad} (Nivel: ${a.nivel || 'N/A'}, Area: ${a.area || 'N/A'}): Programado ${a.cantidadProgramada} ${a.unidad}, Realizado ${a.cantidadRealizada || 0} ${a.unidad}, Avance ${pct.toFixed(1)}%`;
        }).join('\n');

        const systemPrompt = `Eres un consultor experto en control de calidad de obra de construccion. Analiza las actividades de un contratista/empresa y genera recomendaciones de mejora usando la metodologia de las 8Ms + Money.

Las 9 categorias son:
1. Material: problemas con suministro, calidad, almacenamiento o disponibilidad de materiales
2. Mano de obra: capacitacion, rendimiento, suficiencia de personal, rotacion
3. Maquinaria y equipo: disponibilidad, mantenimiento, adecuacion de herramientas
4. Medios - Informacion planos: claridad de planos, especificaciones, comunicacion de cambios
5. Metodo: procedimientos constructivos, secuencia de trabajo, logistica
6. Medio ambiente - Condiciones de trabajo: clima, acceso, condiciones del sitio
7. Medidas de seguridad: EPP, senalizacion, protocolos de seguridad
8. Medicion: control de cantidades, verificacion de avances, instrumentos
9. Money: flujo de pagos, estimaciones, costos adicionales

IMPORTANTE:
- Solo incluye categorias donde detectes problemas reales basados en los datos
- Se breve y directo, maximo 2-3 oraciones por categoria
- Si la eficiencia es alta (>80%), reconocelo y da recomendaciones preventivas
- Si la eficiencia es baja (<50%), se mas enfatico en las areas criticas
- No uses acentos para compatibilidad con PDF
- Responde en formato JSON`;

        const userPrompt = `Especialidad: ${input.especialidad}
Eficiencia global: ${eficiencia}%
Total programado: ${totalProg.toFixed(2)} | Total realizado: ${totalReal.toFixed(2)}

Actividades:\n${actividadesTexto}`;

        const response = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'analisis_8ms',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  resumenGeneral: { type: 'string', description: 'Resumen ejecutivo de 1-2 oraciones' },
                  categorias: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        nombre: { type: 'string', description: 'Nombre de la categoria (ej: Material, Mano de obra, etc.)' },
                        estado: { type: 'string', description: 'critico, atencion, o aceptable' },
                        recomendacion: { type: 'string', description: 'Recomendacion concreta de mejora' },
                      },
                      required: ['nombre', 'estado', 'recomendacion'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['resumenGeneral', 'categorias'],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No se recibio respuesta del analisis IA.' });
        }

        try {
          const parsed = JSON.parse(content as string);
          
          // Guardar en caché para futuras consultas
          try {
            await db.saveAnalisis8msCache(input.programaId, input.especialidad, itemsHash, content as string);
            console.log(`[8Ms Cache] SAVED para programa ${input.programaId}, especialidad ${input.especialidad}`);
          } catch (e) {
            console.error('[8Ms Cache] Error al guardar caché:', e);
          }
          
          return parsed;
        } catch {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Error al procesar respuesta del analisis IA.' });
        }
      }),
  }),

  // ==================== PAGOS ====================
  pagos: router({
    stats: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        return db.getPagosStats(input.proyectoId);
      }),

    list: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.listSolicitudesPago(input.proyectoId, { status: input.status });
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const pago = await db.getSolicitudPago(input.id);
        if (!pago) throw new TRPCError({ code: 'NOT_FOUND', message: 'Solicitud no encontrada' });
        const archivos = await db.listArchivosPago(input.id);
        return { ...pago, archivos };
      }),

    create: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        concepto: z.string().min(1),
        monto: z.string().min(1),
        moneda: z.string().default('MXN'),
        proveedor: z.string().optional(),
        noFactura: z.string().optional(),
        notas: z.string().optional(),
        datosExtraidosIA: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createSolicitudPago({
          ...input,
          solicitanteId: ctx.user.id,
          statusPago: 'pendiente',
        });
        // Notificación push a admins/supervisores
        try {
          const admins = await db.getUsersByRole('superadmin');
          const supervisores = await db.getUsersByRole('supervisor');
          const targets = [...admins, ...supervisores];
          for (const admin of targets) {
            const subs = await db.getPushSubscriptionsByUsuario(admin.id);
            for (const sub of subs) {
              pushService.sendPushNotification(
                { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                {
                  title: 'Nueva Solicitud de Pago',
                  body: `${ctx.user.name} solicita $${input.monto} - ${input.concepto}`,
                  data: { url: '/pagos', tipo: 'pago_nuevo' },
                }
              ).catch(() => {});
            }
          }
        } catch (e) { /* silent */ }
        // Notificación in-app
        try {
          const admins = await db.getUsersByRole('superadmin');
          for (const admin of admins) {
            await db.createNotificacion({
              usuarioId: admin.id,
              proyectoId: input.proyectoId,
              tipo: 'pago_nuevo',
              titulo: 'Nueva Solicitud de Pago',
              mensaje: `${ctx.user.name} solicita $${input.monto} MXN - ${input.concepto}`,
            });
          }
        } catch (e) { /* silent */ }
        return result;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        concepto: z.string().optional(),
        monto: z.string().optional(),
        proveedor: z.string().optional(),
        noFactura: z.string().optional(),
        notas: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const pago = await db.getSolicitudPago(input.id);
        if (!pago) throw new TRPCError({ code: 'NOT_FOUND' });
        // Solo el solicitante o admin puede editar, y solo si está pendiente
        const isAdmin = ['superadmin', 'admin'].includes(ctx.user.role);
        if (pago.solicitanteId !== ctx.user.id && !isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo el solicitante puede editar' });
        }
        if (!['pendiente', 'rechazado'].includes(pago.statusPago)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Solo se puede editar pagos pendientes o rechazados' });
        }
        const { id, ...data } = input;
        return db.updateSolicitudPago(id, data);
      }),

    autorizar: supervisorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const pago = await db.getSolicitudPago(input.id);
        if (!pago) throw new TRPCError({ code: 'NOT_FOUND' });
        if (pago.statusPago !== 'pendiente') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Solo se puede autorizar pagos pendientes' });
        }
        const result = await db.updateSolicitudPago(input.id, {
          statusPago: 'autorizado',
          autorizadorId: ctx.user.id,
          fechaAutorizacion: new Date(),
        });
        // Notificación al solicitante
        try {
          const subs = await db.getPushSubscriptionsByUsuario(pago.solicitanteId);
          for (const sub of subs) {
            pushService.sendPushNotification(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              {
                title: 'Pago Autorizado',
                body: `Tu solicitud de $${pago.monto} ha sido autorizada por ${ctx.user.name}`,
                data: { url: '/pagos', tipo: 'pago_autorizado' },
              }
            ).catch(() => {});
          }
          await db.createNotificacion({
            usuarioId: pago.solicitanteId,
            proyectoId: pago.proyectoId,
              tipo: 'pago_autorizado',
              titulo: 'Pago Autorizado',
              mensaje: `Tu solicitud de $${pago.monto} MXN - ${pago.concepto} ha sido autorizada`,
          });
        } catch (e) { /* silent */ }
        return result;
      }),

    rechazar: supervisorProcedure
      .input(z.object({ id: z.number(), motivo: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const pago = await db.getSolicitudPago(input.id);
        if (!pago) throw new TRPCError({ code: 'NOT_FOUND' });
        if (pago.statusPago !== 'pendiente') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Solo se puede rechazar pagos pendientes' });
        }
        const result = await db.updateSolicitudPago(input.id, {
          statusPago: 'rechazado',
          autorizadorId: ctx.user.id,
          motivoRechazo: input.motivo,
        });
        // Notificación al solicitante
        try {
          const subs = await db.getPushSubscriptionsByUsuario(pago.solicitanteId);
          for (const sub of subs) {
            pushService.sendPushNotification(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              {
                title: 'Pago Rechazado',
                body: `Tu solicitud de $${pago.monto} fue rechazada: ${input.motivo}`,
                data: { url: '/pagos', tipo: 'pago_rechazado' },
              }
            ).catch(() => {});
          }
          await db.createNotificacion({
            usuarioId: pago.solicitanteId,
            proyectoId: pago.proyectoId,
              tipo: 'pago_rechazado',
              titulo: 'Pago Rechazado',
              mensaje: `Tu solicitud de $${pago.monto} MXN fue rechazada: ${input.motivo}`,
          });
        } catch (e) { /* silent */ }
        return result;
      }),

    ejecutar: supervisorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const pago = await db.getSolicitudPago(input.id);
        if (!pago) throw new TRPCError({ code: 'NOT_FOUND' });
        if (pago.statusPago !== 'autorizado') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Solo se puede ejecutar pagos autorizados' });
        }
        return db.updateSolicitudPago(input.id, {
          statusPago: 'ejecutado',
          fechaEjecucion: new Date(),
        });
      }),

    cancelar: protectedProcedure
      .input(z.object({ id: z.number(), motivo: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const pago = await db.getSolicitudPago(input.id);
        if (!pago) throw new TRPCError({ code: 'NOT_FOUND' });
        const isAdmin = ['superadmin', 'admin', 'supervisor'].includes(ctx.user.role);
        if (pago.solicitanteId !== ctx.user.id && !isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        if (['ejecutado', 'cancelado'].includes(pago.statusPago)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No se puede cancelar un pago ejecutado o ya cancelado' });
        }
        return db.updateSolicitudPago(input.id, {
          statusPago: 'cancelado',
          motivoCancelacion: input.motivo,
        });
      }),

    eliminar: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSolicitudPago(input.id);
        return { success: true };
      }),

    // Upload de archivo adjunto
    uploadArchivo: protectedProcedure
      .input(z.object({
        solicitudPagoId: z.number(),
        nombre: z.string(),
        base64: z.string(),
        mimeType: z.string(),
        tamano: z.number(),
        tipo: z.string().default('adjunto'),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, 'base64');
        const ext = input.nombre.split('.').pop() || 'bin';
        const fileKey = `pagos/${input.solicitudPagoId}/${nanoid(12)}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        return db.createArchivoPago({
          solicitudPagoId: input.solicitudPagoId,
          nombre: input.nombre,
          url,
          fileKey,
          mimeType: input.mimeType,
          tamano: input.tamano,
          tipo: input.tipo,
        });
      }),

    deleteArchivo: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteArchivoPago(input.id);
      }),

    // IA: Extraer datos de foto de comprobante
    extraerDatosComprobante: protectedProcedure
      .input(z.object({
        imageBase64: z.string(),
        mimeType: z.string().default('image/jpeg'),
      }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `Eres un asistente que extrae datos de comprobantes de pago, facturas y recibos de construcción.
Analiza la imagen y extrae los siguientes campos si están presentes:
- concepto: descripción del pago
- monto: cantidad numérica (solo el número, sin símbolos)
- proveedor: nombre del proveedor o empresa
- noFactura: número de factura o folio
- fecha: fecha del comprobante (formato YYYY-MM-DD)
- notas: cualquier otro dato relevante

Responde SOLO con JSON válido con la estructura:
{"concepto":"","monto":"","proveedor":"","noFactura":"","fecha":"","notas":""}
Si un campo no se puede extraer, déjalo como cadena vacía.`
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extrae los datos de este comprobante de pago:' },
                { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}`, detail: 'high' } },
              ],
            },
          ],
        });
        try {
          const content = response.choices[0]?.message?.content || '{}';
          const cleanContent = typeof content === 'string' ? content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() : '';
          const datos = JSON.parse(cleanContent);
          return {
            concepto: String(datos.concepto || '').trim(),
            monto: String(datos.monto || '').replace(/[^0-9.]/g, ''),
            proveedor: String(datos.proveedor || '').trim(),
            noFactura: String(datos.noFactura || '').trim(),
            fecha: String(datos.fecha || '').trim(),
            notas: String(datos.notas || '').trim(),
          };
        } catch (e) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No se pudieron extraer datos del comprobante' });
        }
      }),
  }),

  // ==================== PARTICIPACIÓN ====================
  participacion: router({
    // Estadísticas de participación por empresa-residente
    stats: adminProcedure
      .input(z.object({
        proyectoId: z.number(),
        fechaDesde: z.string().optional(), // ISO date
        fechaHasta: z.string().optional(), // ISO date
      }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB no disponible' });
        const { sql: sqlTag } = await import('drizzle-orm');

        // Rango de fechas: default últimos 30 días
        const fechaHasta = input.fechaHasta || new Date().toISOString().split('T')[0];
        const fechaDesdeDefault = new Date();
        fechaDesdeDefault.setDate(fechaDesdeDefault.getDate() - 30);
        const fechaDesde = input.fechaDesde || fechaDesdeDefault.toISOString().split('T')[0];

        // 1. Participación por empresa-residente: ítems por día
        const rawData: any[] = await database.execute(sqlTag`
          SELECT 
            i.empresaId,
            MAX(e.nombre) as empresaNombre,
            i.residenteId,
            MAX(u.name) as residenteNombre,
            DATE(i.fechaCreacion) as dia,
            COUNT(*) as itemsDia
          FROM items i
          JOIN empresas e ON i.empresaId = e.id
          LEFT JOIN users u ON i.residenteId = u.id
          WHERE i.proyectoId = ${input.proyectoId}
            AND DATE(i.fechaCreacion) >= ${fechaDesde}
            AND DATE(i.fechaCreacion) <= ${fechaHasta}
          GROUP BY i.empresaId, i.residenteId, DATE(i.fechaCreacion)
          ORDER BY dia DESC
        `);

        // 2. Calcular días hábiles en el rango (lun-vie)
        const start = new Date(fechaDesde + 'T00:00:00');
        const end = new Date(fechaHasta + 'T00:00:00');
        const today = new Date();
        today.setHours(0,0,0,0);
        const effectiveEnd = end > today ? today : end;
        let diasHabiles = 0;
        const d = new Date(start);
        while (d <= effectiveEnd) {
          const dow = d.getDay();
          if (dow !== 0 && dow !== 6) diasHabiles++;
          d.setDate(d.getDate() + 1);
        }

        // 3. Agrupar por empresa-residente
        const rows = Array.isArray(rawData) ? (rawData as any[]).flat ? (rawData as any[])[0] || rawData : rawData : [];
        const dataRows = Array.isArray(rows) ? rows : [];
        
        const grouped = new Map<string, {
          empresaId: number;
          empresaNombre: string;
          residenteId: number | null;
          residenteNombre: string;
          diasConActividad: Set<string>;
          totalItems: number;
          itemsPorDia: Map<string, number>;
          ultimaParticipacion: string;
        }>();

        for (const row of dataRows) {
          const key = `${row.empresaId}-${row.residenteId || 0}`;
          if (!grouped.has(key)) {
            grouped.set(key, {
              empresaId: row.empresaId,
              empresaNombre: row.empresaNombre || 'Sin empresa',
              residenteId: row.residenteId,
              residenteNombre: row.residenteNombre || 'Sin residente',
              diasConActividad: new Set(),
              totalItems: 0,
              itemsPorDia: new Map(),
              ultimaParticipacion: '',
            });
          }
          const g = grouped.get(key)!;
          const diaStr = row.dia instanceof Date ? row.dia.toISOString().split('T')[0] : String(row.dia);
          g.diasConActividad.add(diaStr);
          g.totalItems += Number(row.itemsDia);
          g.itemsPorDia.set(diaStr, Number(row.itemsDia));
          if (!g.ultimaParticipacion || diaStr > g.ultimaParticipacion) {
            g.ultimaParticipacion = diaStr;
          }
        }

        // 4. Calcular penalizaciones
        const PENALIZACION_POR_DIA = 500;
        const MINIMO_ITEMS_DIA = 5;

        const resultado = Array.from(grouped.values()).map(g => {
          // Días hábiles sin cumplir mínimo de 5 ítems
          let diasIncumplimiento = 0;
          let diasCumplimiento = 0;
          const d2 = new Date(start);
          while (d2 <= effectiveEnd) {
            const dow = d2.getDay();
            if (dow !== 0 && dow !== 6) {
              const diaStr = d2.toISOString().split('T')[0];
              const itemsEseDia = g.itemsPorDia.get(diaStr) || 0;
              if (itemsEseDia >= MINIMO_ITEMS_DIA) {
                diasCumplimiento++;
              } else {
                diasIncumplimiento++;
              }
            }
            d2.setDate(d2.getDate() + 1);
          }

          const penalizacion = diasIncumplimiento * PENALIZACION_POR_DIA;
          const diasSinParticipar = Math.max(0, Math.floor((today.getTime() - new Date(g.ultimaParticipacion + 'T00:00:00').getTime()) / 86400000));
          const porcentajeCumplimiento = diasHabiles > 0 ? Math.round((diasCumplimiento / diasHabiles) * 100) : 0;

          return {
            empresaId: g.empresaId,
            empresaNombre: g.empresaNombre,
            residenteId: g.residenteId,
            residenteNombre: g.residenteNombre,
            totalItems: g.totalItems,
            diasConActividad: g.diasConActividad.size,
            diasCumplimiento,
            diasIncumplimiento,
            diasSinParticipar,
            ultimaParticipacion: g.ultimaParticipacion,
            penalizacion,
            porcentajeCumplimiento,
            promedioDiario: g.diasConActividad.size > 0 ? +(g.totalItems / g.diasConActividad.size).toFixed(1) : 0,
          };
        });

        // Ordenar de mayor a menor participación
        resultado.sort((a, b) => b.totalItems - a.totalItems);

        // 5. Empresas del proyecto que NO tienen ítems en el rango
        const empresasConItems = new Set(resultado.map(r => r.empresaId));
        const todasEmpresas: any[] = await database.execute(sqlTag`
          SELECT DISTINCT e.id, e.nombre, e.residenteId, u.name as residenteNombre
          FROM empresas e
          LEFT JOIN users u ON e.residenteId = u.id
          WHERE e.proyectoId = ${input.proyectoId} AND e.activo = 1
        `);
        const empresasRows = Array.isArray(todasEmpresas) ? (todasEmpresas as any[])[0] || todasEmpresas : [];
        const sinParticipacion = (Array.isArray(empresasRows) ? empresasRows : []).filter(
          (e: any) => !empresasConItems.has(e.id)
        ).map((e: any) => ({
          empresaId: e.id,
          empresaNombre: e.nombre,
          residenteId: e.residenteId,
          residenteNombre: e.residenteNombre || 'Sin residente',
          totalItems: 0,
          diasConActividad: 0,
          diasCumplimiento: 0,
          diasIncumplimiento: diasHabiles,
          diasSinParticipar: diasHabiles,
          ultimaParticipacion: '',
          penalizacion: diasHabiles * PENALIZACION_POR_DIA,
          porcentajeCumplimiento: 0,
          promedioDiario: 0,
        }));

        const penalizacionTotal = [...resultado, ...sinParticipacion].reduce((sum, r) => sum + r.penalizacion, 0);

        return {
          empresasActivas: resultado,
          empresasSinParticipacion: sinParticipacion,
          resumen: {
            diasHabiles,
            fechaDesde,
            fechaHasta,
            totalEmpresas: resultado.length + sinParticipacion.length,
            empresasActivas: resultado.length,
            empresasInactivas: sinParticipacion.length,
            penalizacionTotal,
            minimoItemsDia: MINIMO_ITEMS_DIA,
            penalizacionPorDia: PENALIZACION_POR_DIA,
          },
        };
      }),
  }),

  // =============================================
  // BUENAS PRÁCTICAS DE SEGURIDAD (BP)
  // =============================================
  buenasPracticas: router({
    // Listar BPs de un proyecto
    list: protectedProcedure
      .input(z.object({ proyectoId: z.number(), categoria: z.string().optional(), estado: z.string().optional() }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB no disponible' });
        const { sql: sqlTag } = await import('drizzle-orm');
        const catFilter = input.categoria ? sqlTag` AND bp.categoria = ${input.categoria}` : sqlTag``;
        const estFilter = input.estado ? sqlTag` AND bp.estado = ${input.estado}` : sqlTag``;
        const rawResult: any = await database.execute(sqlTag`
          SELECT bp.*, u.name as creadoPorNombre, u.fotoUrl as creadoPorFoto,
            ua.name as aprobadoPorNombre, e.nombre as empresaNombre
          FROM buenas_practicas bp
          LEFT JOIN users u ON bp.creadoPorId = u.id
          LEFT JOIN users ua ON bp.aprobadoPorId = ua.id
          LEFT JOIN empresas e ON bp.empresaId = e.id
          WHERE bp.proyectoId = ${input.proyectoId} AND bp.activo = 1
          ${catFilter} ${estFilter}
          ORDER BY bp.createdAt DESC
        `);
        const rows = Array.isArray(rawResult) && Array.isArray(rawResult[0]) ? rawResult[0] : rawResult;
        return Array.isArray(rows) ? rows : [];
      }),

    // Obtener una BP por ID con evidencias
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB no disponible' });
        const { sql: sqlTag } = await import('drizzle-orm');
        const bpRaw: any = await database.execute(sqlTag`
          SELECT bp.*, u.name as creadoPorNombre, u.fotoUrl as creadoPorFoto,
            ua.name as aprobadoPorNombre, e.nombre as empresaNombre
          FROM buenas_practicas bp
          LEFT JOIN users u ON bp.creadoPorId = u.id
          LEFT JOIN users ua ON bp.aprobadoPorId = ua.id
          LEFT JOIN empresas e ON bp.empresaId = e.id
          WHERE bp.id = ${input.id}
        `);
        const bpRows = Array.isArray(bpRaw) && Array.isArray(bpRaw[0]) ? bpRaw[0] : bpRaw;
        const bp = Array.isArray(bpRows) ? bpRows[0] : null;
        if (!bp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Buena práctica no encontrada' });
        const evRaw: any = await database.execute(sqlTag`
          SELECT * FROM evidencias_bp WHERE buenaPracticaId = ${input.id} ORDER BY createdAt ASC
        `);
        const evidencias = Array.isArray(evRaw) && Array.isArray(evRaw[0]) ? evRaw[0] : evRaw;
        return { ...bp, evidencias: Array.isArray(evidencias) ? evidencias : [] };
      }),

    // Crear nueva BP
    create: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        titulo: z.string().min(1),
        descripcion: z.string().optional(),
        categoria: z.string().min(1),
        prioridad: z.string().default('media'),
        ubicacion: z.string().optional(),
        empresaId: z.number().optional(),
        beneficio: z.string().optional(),
        evidencias: z.array(z.object({ url: z.string(), fileKey: z.string(), descripcion: z.string().optional() })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB no disponible' });
        const { sql: sqlTag } = await import('drizzle-orm');
        const countRaw: any = await database.execute(sqlTag`
          SELECT COUNT(*) as total FROM buenas_practicas WHERE proyectoId = ${input.proyectoId}
        `);
        const countRows = Array.isArray(countRaw) && Array.isArray(countRaw[0]) ? countRaw[0] : countRaw;
        const total = Array.isArray(countRows) ? (countRows[0]?.total || 0) : 0;
        const codigo = `BP-${String(Number(total) + 1).padStart(5, '0')}`;
        const result: any = await database.execute(sqlTag`
          INSERT INTO buenas_practicas (proyectoId, codigo, titulo, descripcion, categoria, prioridad, ubicacion, empresaId, creadoPorId, beneficio)
          VALUES (${input.proyectoId}, ${codigo}, ${input.titulo}, ${input.descripcion || null}, ${input.categoria}, ${input.prioridad}, ${input.ubicacion || null}, ${input.empresaId || null}, ${ctx.user.id}, ${input.beneficio || null})
        `);
        const bpId = result.insertId || result[0]?.insertId;
        if (input.evidencias?.length && bpId) {
          for (const ev of input.evidencias) {
            await database.execute(sqlTag`
              INSERT INTO evidencias_bp (buenaPracticaId, url, fileKey, descripcion)
              VALUES (${bpId}, ${ev.url}, ${ev.fileKey}, ${ev.descripcion || null})
            `);
          }
        }
        return { id: bpId, codigo };
      }),

    // Actualizar estado de BP
    updateEstado: protectedProcedure
      .input(z.object({ id: z.number(), estado: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB no disponible' });
        const { sql: sqlTag } = await import('drizzle-orm');
        if (input.estado === 'implementada') {
          await database.execute(sqlTag`
            UPDATE buenas_practicas SET estado = ${input.estado}, aprobadoPorId = ${ctx.user.id}, fechaAprobacion = NOW() WHERE id = ${input.id}
          `);
        } else {
          await database.execute(sqlTag`
            UPDATE buenas_practicas SET estado = ${input.estado} WHERE id = ${input.id}
          `);
        }
        return { success: true };
      }),

    // Agregar evidencia a BP existente
    addEvidencia: protectedProcedure
      .input(z.object({ buenaPracticaId: z.number(), url: z.string(), fileKey: z.string(), descripcion: z.string().optional() }))
      .mutation(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB no disponible' });
        const { sql: sqlTag } = await import('drizzle-orm');
        const result: any = await database.execute(sqlTag`
          INSERT INTO evidencias_bp (buenaPracticaId, url, fileKey, descripcion)
          VALUES (${input.buenaPracticaId}, ${input.url}, ${input.fileKey}, ${input.descripcion || null})
        `);
        return { id: result.insertId || result[0]?.insertId };
      }),

    // Eliminar BP (soft delete)
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB no disponible' });
        const { sql: sqlTag } = await import('drizzle-orm');
        await database.execute(sqlTag`UPDATE buenas_practicas SET activo = 0 WHERE id = ${input.id}`);
        return { success: true };
      }),

    // Estadísticas de BPs por proyecto
    stats: protectedProcedure
      .input(z.object({ proyectoId: z.number() }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB no disponible' });
        const { sql: sqlTag } = await import('drizzle-orm');
        const statsRaw: any = await database.execute(sqlTag`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN estado = 'activa' THEN 1 ELSE 0 END) as activas,
            SUM(CASE WHEN estado = 'implementada' THEN 1 ELSE 0 END) as implementadas,
            SUM(CASE WHEN estado = 'archivada' THEN 1 ELSE 0 END) as archivadas,
            COUNT(DISTINCT categoria) as categorias,
            COUNT(DISTINCT empresaId) as empresasInvolucradas
          FROM buenas_practicas WHERE proyectoId = ${input.proyectoId} AND activo = 1
        `);
        const statsRows = Array.isArray(statsRaw) && Array.isArray(statsRaw[0]) ? statsRaw[0] : statsRaw;
        const stats = Array.isArray(statsRows) ? statsRows[0] : { total: 0, activas: 0, implementadas: 0, archivadas: 0, categorias: 0, empresasInvolucradas: 0 };
        const catRaw: any = await database.execute(sqlTag`
          SELECT categoria, COUNT(*) as total FROM buenas_practicas WHERE proyectoId = ${input.proyectoId} AND activo = 1 GROUP BY categoria ORDER BY total DESC
        `);
        const catRows = Array.isArray(catRaw) && Array.isArray(catRaw[0]) ? catRaw[0] : catRaw;
        return { ...stats, porCategoria: Array.isArray(catRows) ? catRows : [] };
      }),
  }),

});
export type AppRouter = typeof appRouter;
