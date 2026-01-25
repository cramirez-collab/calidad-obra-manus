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
  }),

  // ==================== USUARIOS ====================
  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
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
    
    // Lista con estadísticas de ítems
    listConEstadisticas: protectedProcedure.query(async () => {
      return await db.getAllEmpresasConEstadisticas();
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
    
    // Lista con estadísticas de ítems
    listConEstadisticas: protectedProcedure.query(async () => {
      return await db.getAllUnidadesConEstadisticas();
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
    
    // Lista con atributos relacionados en cadena
    listConAtributos: protectedProcedure.query(async () => {
      return await db.getAllEspecialidadesConAtributos();
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
});

export type AppRouter = typeof appRouter;
