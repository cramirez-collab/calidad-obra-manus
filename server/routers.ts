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

// Middleware para roles que pueden subir foto después (incluye residente)
const canUploadFotoProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['superadmin', 'admin', 'supervisor', 'jefe_residente', 'residente'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acceso denegado. No tienes permiso para subir fotos.' });
  }
  return next({ ctx });
});

// Middleware para excluir desarrollador de operaciones de escritura (solo puede ver y comentar)
const noDesarrolladorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === 'desarrollador') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'El rol Desarrollador solo puede ver y comentar. No puede crear, editar o eliminar registros.' });
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
        role: z.enum(['superadmin', 'admin', 'supervisor', 'jefe_residente', 'residente', 'desarrollador']),
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
        role: z.enum(['superadmin', 'admin', 'supervisor', 'jefe_residente', 'residente', 'desarrollador']).optional(),
        empresaId: z.number().nullable().optional(),
        activo: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateUserWithPassword(id, data);
        return { success: true };
      }),
    
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(['admin', 'supervisor', 'jefe_residente', 'residente']) }))
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
        limit: z.number().default(100),
        offset: z.number().default(0),
      }))
      .query(async ({ input, ctx }) => {
        const filters: db.ItemFilters = { ...input };
        const limit = input.limit;
        const offset = input.offset;
        // TODOS los usuarios registrados pueden ver TODOS los ítems del proyecto
        // Los filtros son opcionales para quien quiera usarlos
        // Ya no se filtra por rol - todos ven todo para estar enterados
        return await db.getItems(filters, limit, offset);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getItemById(input.id);
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
      }))
      .mutation(async ({ input, ctx }) => {
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
        // 1. creadoPorId = ctx.user.id (SIEMPRE: quien crea el ítem)
        // 2. residenteId = jefe de residente de la empresa (quien debe arreglar el detalle)
        // 3. asignadoAId = mismo que residenteId (la persona asignada para corregir)
        // Flujo: Creador crea → Asignado arregla y sube foto después → Supervisor aprueba
        
        // Obtener la empresa para saber quién es el jefe de residente asignado
        const empresa = await db.getEmpresaById(input.empresaId);
        
        // Determinar el residente responsable (prioridad: jefeResidenteId > residenteId de empresa > residenteId de especialidad)
        let residenteResponsableId: number = ctx.user.id; // fallback: el creador
        
        if (empresa?.jefeResidenteId) {
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
          }
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
      }),
    
    uploadFotoAntes: noDesarrolladorProcedure
      .input(z.object({
        itemId: z.number(),
        fotoBase64: z.string(),
        fotoMarcadaBase64: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const item = await db.getItemById(input.itemId);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ítem no encontrado' });
        
        // OPTIMIZACIÓN: Guardar base64 inmediatamente en BD (< 500ms)
        const updateData: any = { 
          fotoAntesBase64: input.fotoBase64
        };
        if (input.fotoMarcadaBase64) {
          updateData.fotoAntesMarcadaBase64 = input.fotoMarcadaBase64;
        }
        await db.updateItem(input.itemId, updateData);
        
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
        // OPTIMIZACIÓN ULTRA RÁPIDA: Responder en < 200ms
        const startTime = Date.now();
        
        // Validación rápida del ítem
        const item = await db.getItemById(input.itemId);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ítem no encontrado' });
        
        // Permitir subir foto incluso si ya tiene una (para reintentos)
        if (item.status !== 'pendiente_foto_despues' && item.status !== 'pendiente_aprobacion') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'El ítem no está en estado válido para foto después' });
        }
        
        // OPERACIÓN ATÓMICA: Guardar base64 y cambiar status inmediatamente
        try {
          await db.updateItem(input.itemId, {
            fotoDespuesBase64: input.fotoBase64,
            jefeResidenteId: ctx.user.id,
            fechaFotoDespues: new Date(),
            status: 'pendiente_aprobacion',
            comentarioJefeResidente: input.comentario,
          });
        } catch (dbError: any) {
          console.error('Error guardando foto después en DB:', dbError);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Error guardando foto. Intenta de nuevo.' });
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
    
    aprobar: protectedProcedure
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
    
    rechazar: protectedProcedure
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
    updatePin: protectedProcedure
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
    
    // Crear mensaje
    create: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        texto: z.string().min(1),
        menciones: z.array(z.number()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createMensaje({
          itemId: input.itemId,
          usuarioId: ctx.user.id,
          texto: input.texto,
          menciones: input.menciones,
        });
        
        // Registrar en auditoría
        await db.createAuditoria({
          usuarioId: ctx.user.id,
          usuarioNombre: ctx.user.name || 'Usuario',
          usuarioRol: ctx.user.role,
          accion: 'crear_mensaje',
          categoria: 'item',
          entidadTipo: 'mensaje',
          entidadId: id,
          detalles: `Mensaje creado en ítem #${input.itemId}`,
        });
        
        // Incrementar badge de mensajes no leídos para usuarios mencionados
        if (input.menciones && input.menciones.length > 0) {
          // Obtener info del ítem para push notifications
          const itemInfoMencion = await db.getItemInfoForPush(input.itemId);
          
          for (const userId of input.menciones) {
            await db.incrementBadge(userId, 'mensajesNoLeidos');
            // Crear notificación
            await db.createNotificacion({
              usuarioId: userId,
              itemId: input.itemId,
              proyectoId: itemInfoMencion?.proyectoId || undefined,
              tipo: 'mencion',
              titulo: 'Te mencionaron en un comentario',
              mensaje: `${ctx.user.name || 'Un usuario'} te mencionó en el ítem #${input.itemId}`,
            });
            
            // Enviar notificación push con info del ítem
            const pushSubsMencion = await db.getPushSubscriptionsByUsuario(userId);
            if (pushSubsMencion.length > 0 && itemInfoMencion) {
              await pushService.sendPushToMultiple(pushSubsMencion, {
                title: '📢 Te Mencionaron',
                body: `${ctx.user.name || 'Un usuario'} te mencionó`,
                itemCodigo: itemInfoMencion.codigo,
                unidadNombre: itemInfoMencion.unidadNombre,
                defectoNombre: itemInfoMencion.defectoNombre,
                itemId: input.itemId,
                data: { url: `/items/${input.itemId}`, itemId: input.itemId, tipo: 'mencion' }
              });
            }
          }
          // Emitir evento de socket para notificaciones en tiempo real
          socketEvents.itemUpdated({ id: input.itemId, action: 'mensaje_nuevo' });
        }
        
        return { id, success: true };
      }),
    
    // Editar mensaje (solo admin/superadmin o autor)
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        texto: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // Solo admin/superadmin pueden editar cualquier mensaje
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
        });
        return { success: true };
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

      crear: protectedProcedure
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
          return { id };
        }),

      eliminar: protectedProcedure
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

        const contenido = typeof response.choices[0]?.message?.content === 'string'
          ? response.choices[0].message.content
          : 'Error al generar análisis';

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

        return { id, contenido, version };
      }),

    // Generar resumen ejecutivo (máx 1 cuartilla)
    generarResumen: adminProcedure
      .input(z.object({ proyectoId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const datos = await db.getDatosCompletosParaAnalisisIA(input.proyectoId);

        const systemPrompt = `Director de calidad en construcción. Resumen ejecutivo conciso.

REGLAS:
- Máximo 400 palabras. Bullets con * al inicio. Directo al punto.
- NUNCA uses \\u2022, \\u00b7 ni códigos unicode. Solo * para bullets.
- Caracteres directos: áéíóúñ. NUNCA \\u00XX.
- Nombres de personas y empresas. NUNCA IDs ni códigos.
- Máximo 2 oraciones por bullet.`;

        const userPrompt = `Resumen ejecutivo del proyecto "${datos.proyecto.nombre}".

DATOS:
${JSON.stringify(datos, null, 2)}

Estructura (usa * para cada bullet):

## Estado del Proyecto
* Métricas clave en 2-3 bullets

## Hallazgos Críticos
* 3-5 bullets directos con datos

## Empresas Prioritarias
* Un bullet por empresa crítica con cifras

## Acciones Inmediatas
* Instrucciones concretas, un bullet cada una

## Indicadores a Monitorear
* KPIs clave, un bullet cada uno

REGLAS: Solo * para bullets. NUNCA \\u2022 ni códigos unicode. Nombres, no IDs. Máx 400 palabras.`;

        const response = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });

        const resumen = typeof response.choices[0]?.message?.content === 'string'
          ? response.choices[0].message.content
          : 'Error al generar resumen';

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

        return { id, resumen, version };
      }),

    // Obtener historial de reportes
    historial: protectedProcedure
      .input(z.object({
        proyectoId: z.number(),
        tipo: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const [reportes, total] = await Promise.all([
          db.getReportesIA(input.proyectoId, {
            tipo: input.tipo,
            limit: input.limit,
            offset: input.offset,
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
  }),
});
export type AppRouter = typeof appRouter;
