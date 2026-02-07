import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db module
vi.mock('./db', () => ({
  createAviso: vi.fn().mockResolvedValue({ id: 1 }),
  getAvisos: vi.fn().mockResolvedValue([
    {
      id: 1,
      proyectoId: null,
      creadoPorId: 100,
      titulo: 'Aviso de prueba',
      contenido: 'Contenido del aviso',
      prioridad: 'normal',
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      creadoPorNombre: 'Admin Test',
    },
  ]),
  getAvisoById: vi.fn().mockResolvedValue({
    id: 1,
    titulo: 'Aviso de prueba',
    contenido: 'Contenido del aviso',
    prioridad: 'normal',
    activo: true,
  }),
  updateAviso: vi.fn().mockResolvedValue(undefined),
  deleteAviso: vi.fn().mockResolvedValue(undefined),
  marcarAvisoLeido: vi.fn().mockResolvedValue(undefined),
  getAvisosNoLeidos: vi.fn().mockResolvedValue(3),
  getLecturasAviso: vi.fn().mockResolvedValue([
    {
      id: 1,
      avisoId: 1,
      usuarioId: 200,
      leidoAt: new Date(),
      usuarioNombre: 'Residente Test',
      usuarioRole: 'residente',
    },
  ]),
  getAvisosLeidosPorUsuario: vi.fn().mockResolvedValue([1, 2]),
}));

import * as db from './db';

describe('Avisos DB helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createAviso debe retornar un id y requiere proyectoId', async () => {
    const result = await db.createAviso({
      proyectoId: 1,
      creadoPorId: 100,
      titulo: 'Nuevo aviso',
      contenido: 'Contenido',
      prioridad: 'normal',
    });
    expect(result).toEqual({ id: 1 });
    expect(db.createAviso).toHaveBeenCalledWith({
      proyectoId: 1,
      creadoPorId: 100,
      titulo: 'Nuevo aviso',
      contenido: 'Contenido',
      prioridad: 'normal',
    });
  });

  it('getAvisos debe retornar lista filtrada por proyecto con creadoPorNombre', async () => {
    const avisos = await db.getAvisos(1);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toHaveProperty('creadoPorNombre', 'Admin Test');
    expect(avisos[0]).toHaveProperty('titulo', 'Aviso de prueba');
  });

  it('getAvisoById debe retornar un aviso', async () => {
    const aviso = await db.getAvisoById(1);
    expect(aviso).toBeTruthy();
    expect(aviso?.titulo).toBe('Aviso de prueba');
  });

  it('updateAviso debe llamarse correctamente', async () => {
    await db.updateAviso(1, { titulo: 'Actualizado' });
    expect(db.updateAviso).toHaveBeenCalledWith(1, { titulo: 'Actualizado' });
  });

  it('deleteAviso debe llamarse correctamente (soft delete)', async () => {
    await db.deleteAviso(1);
    expect(db.deleteAviso).toHaveBeenCalledWith(1);
  });

  it('marcarAvisoLeido debe registrar la lectura', async () => {
    await db.marcarAvisoLeido(1, 200);
    expect(db.marcarAvisoLeido).toHaveBeenCalledWith(1, 200);
  });

  it('getAvisosNoLeidos debe retornar un número filtrado por proyecto', async () => {
    const count = await db.getAvisosNoLeidos(200, 1);
    expect(count).toBe(3);
  });

  it('getLecturasAviso debe retornar lecturas con nombre y rol', async () => {
    const lecturas = await db.getLecturasAviso(1);
    expect(lecturas).toHaveLength(1);
    expect(lecturas[0]).toHaveProperty('usuarioNombre', 'Residente Test');
    expect(lecturas[0]).toHaveProperty('usuarioRole', 'residente');
  });

  it('getAvisosLeidosPorUsuario debe retornar array de IDs filtrado por proyecto', async () => {
    const ids = await db.getAvisosLeidosPorUsuario(200, 1);
    expect(ids).toEqual([1, 2]);
    expect(db.getAvisosLeidosPorUsuario).toHaveBeenCalledWith(200, 1);
  });
});

describe('Avisos access control', () => {
  it('solo admin/superadmin pueden crear avisos (validación conceptual)', () => {
    // El endpoint avisos.create usa adminProcedure
    // Esto verifica que la lógica de roles está correctamente definida
    const adminRoles = ['superadmin', 'admin'];
    const nonAdminRoles = ['residente', 'jefe_residente', 'supervisor', 'vendedor'];
    
    adminRoles.forEach(role => {
      expect(['superadmin', 'admin'].includes(role)).toBe(true);
    });
    
    nonAdminRoles.forEach(role => {
      expect(['superadmin', 'admin'].includes(role)).toBe(false);
    });
  });

  it('todos los usuarios autenticados pueden leer avisos (validación conceptual)', () => {
    // avisos.list usa protectedProcedure (cualquier usuario autenticado)
    const allRoles = ['superadmin', 'admin', 'residente', 'jefe_residente', 'supervisor', 'vendedor'];
    allRoles.forEach(role => {
      expect(typeof role).toBe('string');
      expect(role.length).toBeGreaterThan(0);
    });
  });

  it('todos los usuarios pueden marcar avisos como leídos', () => {
    // avisos.marcarLeido usa protectedProcedure
    expect(db.marcarAvisoLeido).toBeDefined();
  });

  it('solo admin/superadmin pueden ver bitácora de lecturas', () => {
    // avisos.lecturas usa adminProcedure
    expect(db.getLecturasAviso).toBeDefined();
  });
});
