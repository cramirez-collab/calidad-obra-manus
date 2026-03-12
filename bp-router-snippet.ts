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
        const rows: any[] = await database.execute(sqlTag`
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
        return rows;
      }),

    // Obtener una BP por ID con evidencias
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB no disponible' });
        const { sql: sqlTag } = await import('drizzle-orm');
        const bpRows: any[] = await database.execute(sqlTag`
          SELECT bp.*, u.name as creadoPorNombre, u.fotoUrl as creadoPorFoto,
            ua.name as aprobadoPorNombre, e.nombre as empresaNombre
          FROM buenas_practicas bp
          LEFT JOIN users u ON bp.creadoPorId = u.id
          LEFT JOIN users ua ON bp.aprobadoPorId = ua.id
          LEFT JOIN empresas e ON bp.empresaId = e.id
          WHERE bp.id = ${input.id}
        `);
        const bp = bpRows[0];
        if (!bp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Buena práctica no encontrada' });
        const evidencias: any[] = await database.execute(sqlTag`
          SELECT * FROM evidencias_bp WHERE buenaPracticaId = ${input.id} ORDER BY createdAt ASC
        `);
        return { ...bp, evidencias };
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
        const countRows: any[] = await database.execute(sqlTag`
          SELECT COUNT(*) as total FROM buenas_practicas WHERE proyectoId = ${input.proyectoId}
        `);
        const total = countRows[0]?.total || 0;
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
        const rows: any[] = await database.execute(sqlTag`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN estado = 'activa' THEN 1 ELSE 0 END) as activas,
            SUM(CASE WHEN estado = 'implementada' THEN 1 ELSE 0 END) as implementadas,
            SUM(CASE WHEN estado = 'archivada' THEN 1 ELSE 0 END) as archivadas,
            COUNT(DISTINCT categoria) as categorias,
            COUNT(DISTINCT empresaId) as empresasInvolucradas
          FROM buenas_practicas WHERE proyectoId = ${input.proyectoId} AND activo = 1
        `);
        const stats = rows[0];
        const catRows: any[] = await database.execute(sqlTag`
          SELECT categoria, COUNT(*) as total FROM buenas_practicas WHERE proyectoId = ${input.proyectoId} AND activo = 1 GROUP BY categoria ORDER BY total DESC
        `);
        return { ...stats, porCategoria: catRows };
      }),
  }),
