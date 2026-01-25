import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// Middleware para verificar rol de admin
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  return next({ ctx });
});

// Middleware para verificar rol de supervisor o superior
const supervisorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['admin', 'supervisor'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acceso denegado. Se requiere rol de supervisor.' });
  }
  return next({ ctx });
});

// Middleware para verificar rol de jefe de residente o superior
const jefeResidenteProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['admin', 'supervisor', 'jefe_residente'].includes(ctx.user.role)) {
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
  }),

  // ==================== USUARIOS ====================
  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),
    
    byRole: adminProcedure
      .input(z.object({ role: z.string() }))
      .query(async ({ input }) => {
        return await db.getUsersByRole(input.role);
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
  }),

  // ==================== EMPRESAS ====================
  empresas: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllEmpresas();
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmpresaById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
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
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteEmpresa(input.id);
        return { success: true };
      }),
  }),

  // ==================== UNIDADES ====================
  unidades: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllUnidades();
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getUnidadById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        nombre: z.string().min(1),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        ubicacion: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createUnidad(input);
        return { id, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).optional(),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        ubicacion: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateUnidad(id, data);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteUnidad(input.id);
        return { success: true };
      }),
  }),

  // ==================== ESPECIALIDADES ====================
  especialidades: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllEspecialidades();
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEspecialidadById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        nombre: z.string().min(1),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createEspecialidad(input);
        return { id, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).optional(),
        codigo: z.string().optional(),
        descripcion: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateEspecialidad(id, data);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteEspecialidad(input.id);
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
    
    delete: adminProcedure
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
        empresaId: z.number(),
        unidadId: z.number(),
        especialidadId: z.number(),
        atributoId: z.number().optional(),
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
        
        // Subir foto original
        const fotoBuffer = Buffer.from(input.fotoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const fotoKey = `items/${item.codigo}/antes-${nanoid(8)}.jpg`;
        const { url: fotoUrl } = await storagePut(fotoKey, fotoBuffer, 'image/jpeg');
        
        const updateData: any = { fotoAntesUrl: fotoUrl, fotoAntesKey: fotoKey };
        
        // Subir foto marcada si existe
        if (input.fotoMarcadaBase64) {
          const fotoMarcadaBuffer = Buffer.from(input.fotoMarcadaBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          const fotoMarcadaKey = `items/${item.codigo}/antes-marcada-${nanoid(8)}.jpg`;
          const { url: fotoMarcadaUrl } = await storagePut(fotoMarcadaKey, fotoMarcadaBuffer, 'image/jpeg');
          updateData.fotoAntesMarcadaUrl = fotoMarcadaUrl;
          updateData.fotoAntesMarcadaKey = fotoMarcadaKey;
        }
        
        await db.updateItem(input.itemId, updateData);
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
        
        const fotoBuffer = Buffer.from(input.fotoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const fotoKey = `items/${item.codigo}/despues-${nanoid(8)}.jpg`;
        const { url: fotoUrl } = await storagePut(fotoKey, fotoBuffer, 'image/jpeg');
        
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
        
        return { success: true };
      }),
    
    historial: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return await db.getItemHistorial(input.itemId);
      }),
  }),

  // ==================== ESTADÍSTICAS ====================
  estadisticas: router({
    general: protectedProcedure
      .input(z.object({
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
  }),
});

export type AppRouter = typeof appRouter;
