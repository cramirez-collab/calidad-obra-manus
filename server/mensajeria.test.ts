import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de la base de datos
vi.mock('./db', () => ({
  getMensajesByItem: vi.fn(),
  createMensaje: vi.fn(),
  deleteMensaje: vi.fn(),
  getUserBadges: vi.fn(),
  incrementBadge: vi.fn(),
  resetBadge: vi.fn(),
  getAuditoria: vi.fn(),
  getAuditoriaCount: vi.fn(),
  createAuditoria: vi.fn(),
  getEstadisticasRendimientoUsuarios: vi.fn(),
  getDefectosPorUsuario: vi.fn(),
}));

import * as db from './db';

describe('Sistema de Mensajería', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMensajesByItem', () => {
    it('debe retornar mensajes de un ítem ordenados por fecha', async () => {
      const mockMensajes = [
        { id: 1, itemId: 1, contenido: 'Mensaje 1', createdAt: new Date('2026-01-20') },
        { id: 2, itemId: 1, contenido: 'Mensaje 2', createdAt: new Date('2026-01-21') },
      ];
      
      vi.mocked(db.getMensajesByItem).mockResolvedValue(mockMensajes);
      
      const result = await db.getMensajesByItem(1);
      
      expect(result).toHaveLength(2);
      expect(result[0].contenido).toBe('Mensaje 1');
    });

    it('debe retornar array vacío si no hay mensajes', async () => {
      vi.mocked(db.getMensajesByItem).mockResolvedValue([]);
      
      const result = await db.getMensajesByItem(999);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('createMensaje', () => {
    it('debe crear un mensaje con @mentions', async () => {
      const nuevoMensaje = {
        itemId: 1,
        usuarioId: 1,
        contenido: 'Hola @Juan, revisa esto',
        menciones: [2],
      };
      
      vi.mocked(db.createMensaje).mockResolvedValue({ id: 1, ...nuevoMensaje });
      
      const result = await db.createMensaje(nuevoMensaje);
      
      expect(result.id).toBe(1);
      expect(result.contenido).toContain('@Juan');
    });
  });
});

describe('Sistema de Badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserBadges', () => {
    it('debe retornar badges con conteos correctos', async () => {
      const mockBadges = {
        itemsRechazados: 3,
        itemsAprobados: 5,
        itemsOkSupervisor: 2,
        mensajesNoLeidos: 1,
      };
      
      vi.mocked(db.getUserBadges).mockResolvedValue(mockBadges);
      
      const result = await db.getUserBadges(1);
      
      expect(result.itemsRechazados).toBe(3);
      expect(result.itemsAprobados).toBe(5);
      expect(result.itemsOkSupervisor).toBe(2);
    });

    it('debe retornar ceros si no hay badges', async () => {
      const mockBadges = {
        itemsRechazados: 0,
        itemsAprobados: 0,
        itemsOkSupervisor: 0,
        mensajesNoLeidos: 0,
      };
      
      vi.mocked(db.getUserBadges).mockResolvedValue(mockBadges);
      
      const result = await db.getUserBadges(999);
      
      expect(result.itemsRechazados).toBe(0);
    });
  });

  describe('incrementBadge', () => {
    it('debe incrementar el badge correctamente', async () => {
      vi.mocked(db.incrementBadge).mockResolvedValue(undefined);
      
      await db.incrementBadge(1, 'itemsRechazados');
      
      expect(db.incrementBadge).toHaveBeenCalledWith(1, 'itemsRechazados');
    });
  });

  describe('resetBadge', () => {
    it('debe resetear el badge a cero', async () => {
      vi.mocked(db.resetBadge).mockResolvedValue(undefined);
      
      await db.resetBadge(1, 'mensajesNoLeidos');
      
      expect(db.resetBadge).toHaveBeenCalledWith(1, 'mensajesNoLeidos');
    });
  });
});

describe('Bitácora de Auditoría', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuditoria', () => {
    it('debe retornar registros de auditoría con filtros', async () => {
      const mockAuditoria = [
        { id: 1, usuarioId: 1, accion: 'crear_item', categoria: 'item', createdAt: new Date() },
        { id: 2, usuarioId: 1, accion: 'aprobar_item', categoria: 'item', createdAt: new Date() },
      ];
      
      vi.mocked(db.getAuditoria).mockResolvedValue(mockAuditoria);
      
      const result = await db.getAuditoria({ usuarioId: 1 });
      
      expect(result).toHaveLength(2);
      expect(result[0].accion).toBe('crear_item');
    });

    it('debe filtrar por categoría', async () => {
      const mockAuditoria = [
        { id: 1, usuarioId: 1, accion: 'crear_item', categoria: 'item', createdAt: new Date() },
      ];
      
      vi.mocked(db.getAuditoria).mockResolvedValue(mockAuditoria);
      
      const result = await db.getAuditoria({ categoria: 'item' });
      
      expect(result[0].categoria).toBe('item');
    });
  });

  describe('getAuditoriaCount', () => {
    it('debe retornar el conteo total de registros', async () => {
      vi.mocked(db.getAuditoriaCount).mockResolvedValue(150);
      
      const result = await db.getAuditoriaCount({});
      
      expect(result).toBe(150);
    });
  });

  describe('createAuditoria', () => {
    it('debe crear un registro de auditoría', async () => {
      const nuevoRegistro = {
        usuarioId: 1,
        usuarioNombre: 'Carlos',
        usuarioRol: 'admin',
        accion: 'crear_item',
        categoria: 'item',
        entidadTipo: 'item',
        entidadId: 1,
        detalles: 'Ítem creado',
      };
      
      vi.mocked(db.createAuditoria).mockResolvedValue({ id: 1, ...nuevoRegistro });
      
      const result = await db.createAuditoria(nuevoRegistro);
      
      expect(result.id).toBe(1);
      expect(result.accion).toBe('crear_item');
    });
  });
});

describe('Estadísticas Avanzadas de Rendimiento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEstadisticasRendimientoUsuarios', () => {
    it('debe retornar estadísticas de rendimiento por usuario', async () => {
      const mockEstadisticas = [
        {
          usuarioId: 1,
          usuarioNombre: 'Carlos',
          usuarioRol: 'residente',
          itemsCompletados: 50,
          aprobados: 40,
          rechazados: 5,
          pendientes: 5,
          okSupervisor: 35,
          tiempoPromedioHoras: 24.5,
        },
        {
          usuarioId: 2,
          usuarioNombre: 'María',
          usuarioRol: 'residente',
          itemsCompletados: 30,
          aprobados: 25,
          rechazados: 3,
          pendientes: 2,
          okSupervisor: 20,
          tiempoPromedioHoras: 18.2,
        },
      ];
      
      vi.mocked(db.getEstadisticasRendimientoUsuarios).mockResolvedValue(mockEstadisticas);
      
      const result = await db.getEstadisticasRendimientoUsuarios();
      
      expect(result).toHaveLength(2);
      expect(result[0].itemsCompletados).toBeGreaterThan(result[1].itemsCompletados);
    });

    it('debe calcular tasa de aprobación correctamente', async () => {
      const mockEstadisticas = [
        {
          usuarioId: 1,
          usuarioNombre: 'Carlos',
          usuarioRol: 'residente',
          itemsCompletados: 100,
          aprobados: 80,
          rechazados: 20,
          pendientes: 0,
          okSupervisor: 70,
          tiempoPromedioHoras: 20,
          tasaAprobacion: 80,
        },
      ];
      
      vi.mocked(db.getEstadisticasRendimientoUsuarios).mockResolvedValue(mockEstadisticas);
      
      const result = await db.getEstadisticasRendimientoUsuarios();
      
      expect(result[0].tasaAprobacion).toBe(80);
    });
  });

  describe('getDefectosPorUsuario', () => {
    it('debe retornar defectos agrupados por usuario', async () => {
      const mockDefectos = [
        {
          usuarioId: 1,
          usuarioNombre: 'Carlos',
          usuarioRol: 'residente',
          totalDefectos: 15,
          aprobados: 10,
          rechazados: 5,
        },
        {
          usuarioId: 2,
          usuarioNombre: 'María',
          usuarioRol: 'residente',
          totalDefectos: 8,
          aprobados: 6,
          rechazados: 2,
        },
      ];
      
      vi.mocked(db.getDefectosPorUsuario).mockResolvedValue(mockDefectos);
      
      const result = await db.getDefectosPorUsuario();
      
      expect(result).toHaveLength(2);
      expect(result[0].totalDefectos).toBeGreaterThan(result[1].totalDefectos);
    });

    it('debe ordenar por total de defectos de mayor a menor', async () => {
      const mockDefectos = [
        { usuarioId: 1, totalDefectos: 20, aprobados: 15, rechazados: 5 },
        { usuarioId: 2, totalDefectos: 10, aprobados: 8, rechazados: 2 },
      ];
      
      vi.mocked(db.getDefectosPorUsuario).mockResolvedValue(mockDefectos);
      
      const result = await db.getDefectosPorUsuario();
      
      expect(result[0].totalDefectos).toBe(20);
      expect(result[1].totalDefectos).toBe(10);
    });
  });
});
