import { COOKIE_NAME } from "@shared/const";
import { socketEvents } from "./socket";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { sendEmail, getAprobadoEmailTemplate, getRechazadoEmailTemplate, getPendienteAprobacionEmailTemplate } from "./emailService";
import pushService from "./pushService";

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
        email: z.string().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmailAndPassword(input.email, input.password);
        if (!user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Email o contraseña incorrectos' });
        }
        if (!user.activo) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Usuario inactivo. Contacta al administrador.' });
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
        
        // Actualizar último acceso
        await db.updateUserLastSignedIn(user.id);
        
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),
  }),

  // ==================== USUARIOS ====================
  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),
    
    // Lista de usuarios con empresa relacionada
    listConEmpresa: adminProcedure.query(async () => {
      return await db.getAllUsersConEmpresa();
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
        role: z.enum(['superadmin', 'admin', 'supervisor', 'jefe_residente', 'residente']),
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
        // Emitir evento de cambio de proyecto via WebSocket
        socketEvents.emitToUser(ctx.user.id, 'proyecto-activo-changed', { 
          proyectoId: input.proyectoId,
          userId: ctx.user.id 
        });
        return { success: true, proyectoId: input.proyectoId };
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
      .mutation(async ({ input }) => {
        const id = await db.createEmpresa(input);
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
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateEmpresa(id, data);
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
      .mutation(async ({ input }) => {
        const id = await db.addResidenteToEmpresa(input.empresaId, input.usuarioId, input.tipoResidente);
        return { id, success: true };
      }),
    
    // Eliminar residente de empresa
    removeResidente: superadminProcedure
      .input(z.object({
        empresaId: z.number(),
        usuarioId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.removeResidenteFromEmpresa(input.empresaId, input.usuarioId);
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
    list: protectedProcedure.query(async () => {
      return await db.getAllAtributos();
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
        status: z.string().optional(),
        fechaDesde: z.date().optional(),
        fechaHasta: z.date().optional(),
        busqueda: z.string().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }))
      .query(async ({ input, ctx }) => {
        const filters: db.ItemFilters = { ...input };
        const limit = input.limit;
        const offset = input.offset;
        // Si no es admin ni supervisor, solo ver sus propios items
        if (!['admin', 'supervisor'].includes(ctx.user.role)) {
          if (ctx.user.role === 'jefe_residente') {
            // Jefe de residente ve items pendientes de foto después
            filters.status = filters.status || 'pendiente_foto_despues';
          } else {
            // Residente solo ve sus items
            filters.residenteId = ctx.user.id;
          }
        }
        return await db.getItems(filters, limit, offset);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getItemById(input.id);
      }),
    
    getByCodigo: publicProcedure
      .input(z.object({ codigo: z.string() }))
      .query(async ({ input }) => {
        return await db.getItemByCodigo(input.codigo);
      }),
    
    create: protectedProcedure
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
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createItem({
          ...input,
          residenteId: ctx.user.id,
          status: 'pendiente_foto_despues',
        });
        
        // Registrar en historial
        await db.addItemHistorial({
          itemId: result.id,
          usuarioId: ctx.user.id,
          statusNuevo: 'pendiente_foto_despues',
          comentario: 'Ítem creado',
        });
        
        // Emitir evento de tiempo real
        socketEvents.itemCreated(result);
        
        // Notificar a jefes de residente sobre nuevo ítem pendiente
        await db.notificarJefesResidente(
          result.id,
          input.empresaId,
          'Nuevo Ítem Pendiente',
          `Se ha registrado un nuevo ítem "${input.titulo}" pendiente de revisión.`
        );
        
        return result;
      }),
    
    uploadFotoAntes: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        fotoBase64: z.string(),
        fotoMarcadaBase64: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const item = await db.getItemById(input.itemId);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ítem no encontrado' });
        
        // Detectar tipo de imagen para preservar resolución original
        const mimeMatch = input.fotoBase64.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
        
        // Subir foto original SIN COMPRESIÓN - preservar resolución
        const fotoBuffer = Buffer.from(input.fotoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const fotoKey = `items/${item.codigo}/antes-${nanoid(8)}.${extension}`;
        const { url: fotoUrl } = await storagePut(fotoKey, fotoBuffer, mimeType);
        
        const updateData: any = { fotoAntesUrl: fotoUrl, fotoAntesKey: fotoKey };
        
        // Subir foto marcada si existe (PNG para preservar marcas)
        if (input.fotoMarcadaBase64) {
          const fotoMarcadaBuffer = Buffer.from(input.fotoMarcadaBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          const fotoMarcadaKey = `items/${item.codigo}/antes-marcada-${nanoid(8)}.png`;
          const { url: fotoMarcadaUrl } = await storagePut(fotoMarcadaKey, fotoMarcadaBuffer, 'image/png');
          updateData.fotoAntesMarcadaUrl = fotoMarcadaUrl;
          updateData.fotoAntesMarcadaKey = fotoMarcadaKey;
        }
        
        await db.updateItem(input.itemId, updateData);
        
        // Registrar en bitácora
        await db.registrarActividad({
          usuarioId: ctx.user.id,
          accion: 'subir_foto',
          entidad: 'item',
          entidadId: input.itemId,
          detalles: `Foto antes subida para ${item.codigo}`,
        });
        
        return { success: true, fotoUrl };
      }),
    
    uploadFotoDespues: jefeResidenteProcedure
      .input(z.object({
        itemId: z.number(),
        fotoBase64: z.string(),
        comentario: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const item = await db.getItemById(input.itemId);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ítem no encontrado' });
        if (item.status !== 'pendiente_foto_despues') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'El ítem no está pendiente de foto después' });
        }
        
        // Detectar tipo de imagen para preservar resolución original
        const mimeMatch = input.fotoBase64.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
        
        // Subir foto SIN COMPRESIÓN - preservar resolución original
        const fotoBuffer = Buffer.from(input.fotoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const fotoKey = `items/${item.codigo}/despues-${nanoid(8)}.${extension}`;
        const { url: fotoUrl } = await storagePut(fotoKey, fotoBuffer, mimeType);
        
        await db.updateItem(input.itemId, {
          fotoDespuesUrl: fotoUrl,
          fotoDespuesKey: fotoKey,
          jefeResidenteId: ctx.user.id,
          fechaFotoDespues: new Date(),
          status: 'pendiente_aprobacion',
          comentarioJefeResidente: input.comentario,
        });
        
        await db.addItemHistorial({
          itemId: input.itemId,
          usuarioId: ctx.user.id,
          statusAnterior: 'pendiente_foto_despues',
          statusNuevo: 'pendiente_aprobacion',
          comentario: input.comentario || 'Foto después agregada',
        });
        
        // Emitir evento de tiempo real
        socketEvents.itemPhotoUploaded({ ...item, status: 'pendiente_aprobacion' });
        
        // Notificar a supervisores sobre ítem pendiente de aprobación
        await db.notificarSupervisores(
          input.itemId,
          'Ítem Pendiente de Aprobación',
          `El ítem "${item.titulo}" está listo para revisión y aprobación.`
        );
        
        // Enviar email a supervisores
        const supervisores = await db.getUsersByRole('supervisor');
        const admins = await db.getUsersByRole('admin');
        const residenteInfo = await db.getUserById(item.residenteId);
        const todosRevisores = [...supervisores, ...admins];
        
        for (const revisor of todosRevisores) {
          if (revisor.email) {
            await sendEmail({
              to: revisor.email,
              subject: `⏳ Ítem Pendiente de Aprobación: ${item.titulo}`,
              html: getPendienteAprobacionEmailTemplate(item.titulo, item.codigo, residenteInfo?.name || 'Residente'),
            });
          }
        }
        
        return { success: true, fotoUrl };
      }),
    
    aprobar: supervisorProcedure
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
        
        await db.updateItem(input.itemId, {
          supervisorId: ctx.user.id,
          fechaAprobacion: new Date(),
          status: 'aprobado',
          comentarioSupervisor: input.comentario,
        });
        
        await db.addItemHistorial({
          itemId: input.itemId,
          usuarioId: ctx.user.id,
          statusAnterior: 'pendiente_aprobacion',
          statusNuevo: 'aprobado',
          comentario: input.comentario || 'Ítem aprobado',
        });
        
        // Emitir evento de tiempo real
        socketEvents.itemApproved({ ...item, status: 'aprobado' });
        
        // Notificar al residente que su ítem fue aprobado
        await db.createNotificacion({
          usuarioId: item.residenteId,
          itemId: input.itemId,
          tipo: 'item_aprobado',
          titulo: 'Ítem Aprobado',
          mensaje: `El ítem "${item.titulo}" ha sido aprobado por el supervisor.`,
        });
        
        // Enviar email al residente
        const residente = await db.getUserById(item.residenteId);
        if (residente?.email) {
          await sendEmail({
            to: residente.email,
            subject: `✓ Ítem Aprobado: ${item.titulo}`,
            html: getAprobadoEmailTemplate(item.titulo, item.codigo, ctx.user.name || 'Supervisor'),
          });
        }
        
        return { success: true };
      }),
    
    rechazar: supervisorProcedure
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
        
        await db.updateItem(input.itemId, {
          supervisorId: ctx.user.id,
          status: 'rechazado',
          comentarioSupervisor: input.comentario,
        });
        
        await db.addItemHistorial({
          itemId: input.itemId,
          usuarioId: ctx.user.id,
          statusAnterior: 'pendiente_aprobacion',
          statusNuevo: 'rechazado',
          comentario: input.comentario,
        });
        
        // Emitir evento de tiempo real
        socketEvents.itemRejected({ ...item, status: 'rechazado' });
        
        // Notificar al residente que su ítem fue rechazado
        await db.createNotificacion({
          usuarioId: item.residenteId,
          itemId: input.itemId,
          tipo: 'item_rechazado',
          titulo: 'Ítem Rechazado',
          mensaje: `El ítem "${item.titulo}" ha sido rechazado. Motivo: ${input.comentario}`,
        });
        
        // Enviar email al residente
        const residenteRechazado = await db.getUserById(item.residenteId);
        if (residenteRechazado?.email) {
          await sendEmail({
            to: residenteRechazado.email,
            subject: `✗ Ítem Rechazado: ${item.titulo}`,
            html: getRechazadoEmailTemplate(item.titulo, item.codigo, ctx.user.name || 'Supervisor', input.comentario),
          });
        }
        
        return { success: true };
      }),
    
    historial: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return await db.getItemHistorial(input.itemId);
      }),
    
    delete: superadminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const item = await db.getItemById(input.id);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ítem no encontrado' });
        
        await db.deleteItem(input.id);
        return { success: true };
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
  }),

  // ==================== NOTIFICACIONES ====================
  notificaciones: router({
    list: protectedProcedure
      .input(z.object({ soloNoLeidas: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getNotificacionesByUsuario(ctx.user.id, input?.soloNoLeidas);
      }),
    
    count: protectedProcedure.query(async ({ ctx }) => {
      return await db.contarNotificacionesNoLeidas(ctx.user.id);
    }),
    
    marcarLeida: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.marcarNotificacionLeida(input.id);
        return { success: true };
      }),
    
    marcarTodasLeidas: protectedProcedure.mutation(async ({ ctx }) => {
      await db.marcarTodasNotificacionesLeidas(ctx.user.id);
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
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getBitacoraGeneral(input || {}, input?.limit || 200);
      }),
    
    miActividad: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getBitacoraByUsuario(ctx.user.id, input?.limit || 50);
      }),
  }),

  // ==================== PENDIENTES POR USUARIO ====================
  pendientes: router({
    misPendientes: protectedProcedure.query(async ({ ctx }) => {
      return await db.getPendientesByUsuario(ctx.user.id, ctx.user.role);
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
    list: adminProcedure.query(async () => {
      return await db.getAllMetas();
    }),
    
    listConProgreso: adminProcedure.query(async () => {
      return await db.getMetasConProgreso();
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
    list: protectedProcedure.query(async () => {
      return await db.getAllDefectos();
    }),
    
    // Lista con estadísticas de uso
    listConEstadisticas: protectedProcedure.query(async () => {
      return await db.getDefectosConEstadisticas();
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
    
    // Actualizar proyecto
    update: adminProcedure
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
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateProyecto(id, data);
        return { success: true };
      }),
    
    // Actualizar solo enlaces externos del proyecto
    updateEnlaces: adminProcedure
      .input(z.object({
        id: z.number(),
        linkCurvas: z.string().nullable().optional(),
        linkSecuencias: z.string().nullable().optional(),
        linkVisor: z.string().nullable().optional(),
        linkPlanos: z.string().nullable().optional(),
        linkManuales: z.string().nullable().optional(),
        linkEspecificaciones: z.string().nullable().optional(),
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
    
    // Obtener proyectos del usuario actual
    misProyectos: protectedProcedure.query(async ({ ctx }) => {
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
    
    // Subir imagen de portada del proyecto
    uploadImagenPortada: adminProcedure
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
          for (const userId of input.menciones) {
            await db.incrementBadge(userId, 'mensajesNoLeidos');
            // Crear notificación
            await db.createNotificacion({
              usuarioId: userId,
              itemId: input.itemId,
              tipo: 'mencion',
              titulo: 'Te mencionaron en un comentario',
              mensaje: `${ctx.user.name || 'Un usuario'} te mencionó en el ítem #${input.itemId}`,
            });
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
    rendimientoUsuarios: adminProcedure.query(async () => {
      return await db.getEstadisticasRendimientoUsuarios();
    }),
    
    // Estadísticas de supervisores
    supervisores: adminProcedure.query(async () => {
      return await db.getEstadisticasSupervisores();
    }),
    
    // Defectos por usuario
    defectosPorUsuario: adminProcedure.query(async () => {
      return await db.getDefectosPorUsuario();
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
});

export type AppRouter = typeof appRouter;
