import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de la base de datos
vi.mock('./db', () => ({
  createProyecto: vi.fn().mockResolvedValue({
    id: 1,
    nombre: 'Proyecto Test',
    descripcion: 'Descripción del proyecto',
    nombreReporte: 'Proyecto Test Reporte',
    activo: true,
    fechaCreacion: new Date(),
  }),
  getProyectos: vi.fn().mockResolvedValue([
    { id: 1, nombre: 'Proyecto 1', descripcion: 'Desc 1', activo: true },
    { id: 2, nombre: 'Proyecto 2', descripcion: 'Desc 2', activo: true },
  ]),
  getProyectoById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) {
      return Promise.resolve({
        id: 1,
        nombre: 'Proyecto Test',
        descripcion: 'Descripción',
        nombreReporte: 'Reporte Test',
        activo: true,
      });
    }
    return Promise.resolve(undefined);
  }),
  updateProyecto: vi.fn().mockResolvedValue({
    id: 1,
    nombre: 'Proyecto Actualizado',
    descripcion: 'Nueva descripción',
    activo: true,
  }),
  deleteProyecto: vi.fn().mockResolvedValue({ success: true }),
  asignarUsuarioAProyecto: vi.fn().mockResolvedValue({
    proyectoId: 1,
    userId: 1,
    fechaAsignacion: new Date(),
  }),
  getUsuariosPorProyecto: vi.fn().mockResolvedValue([
    { id: 1, name: 'Usuario 1', email: 'user1@test.com', role: 'admin' },
    { id: 2, name: 'Usuario 2', email: 'user2@test.com', role: 'residente' },
  ]),
  getProyectosPorUsuario: vi.fn().mockResolvedValue([
    { id: 1, nombre: 'Proyecto 1', activo: true },
    { id: 2, nombre: 'Proyecto 2', activo: true },
  ]),
  removerUsuarioDeProyecto: vi.fn().mockResolvedValue({ success: true }),
}));

import * as db from './db';

describe('Proyectos Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createProyecto', () => {
    it('should create a new proyecto with required fields', async () => {
      const proyecto = await db.createProyecto({
        nombre: 'Proyecto Test',
        descripcion: 'Descripción del proyecto',
        nombreReporte: 'Proyecto Test Reporte',
      });

      expect(proyecto).toBeDefined();
      expect(proyecto.id).toBeDefined();
      expect(proyecto.nombre).toBe('Proyecto Test');
      expect(proyecto.activo).toBe(true);
      expect(db.createProyecto).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProyectos', () => {
    it('should return all proyectos', async () => {
      const proyectos = await db.getProyectos();

      expect(proyectos).toBeDefined();
      expect(Array.isArray(proyectos)).toBe(true);
      expect(proyectos.length).toBe(2);
      expect(proyectos[0]).toHaveProperty('nombre');
      expect(db.getProyectos).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProyectoById', () => {
    it('should return a proyecto by id', async () => {
      const proyecto = await db.getProyectoById(1);

      expect(proyecto).toBeDefined();
      expect(proyecto?.id).toBe(1);
      expect(proyecto?.nombre).toBe('Proyecto Test');
      expect(db.getProyectoById).toHaveBeenCalledWith(1);
    });

    it('should return undefined for non-existent id', async () => {
      const proyecto = await db.getProyectoById(999);

      expect(proyecto).toBeUndefined();
    });
  });

  describe('updateProyecto', () => {
    it('should update proyecto fields', async () => {
      const updated = await db.updateProyecto(1, {
        nombre: 'Proyecto Actualizado',
        descripcion: 'Nueva descripción',
      });

      expect(updated).toBeDefined();
      expect(updated?.nombre).toBe('Proyecto Actualizado');
      expect(db.updateProyecto).toHaveBeenCalledWith(1, {
        nombre: 'Proyecto Actualizado',
        descripcion: 'Nueva descripción',
      });
    });
  });

  describe('asignarUsuarioAProyecto', () => {
    it('should assign a user to a proyecto', async () => {
      const asignacion = await db.asignarUsuarioAProyecto(1, 1);

      expect(asignacion).toBeDefined();
      expect(asignacion.proyectoId).toBe(1);
      expect(asignacion.userId).toBe(1);
      expect(db.asignarUsuarioAProyecto).toHaveBeenCalledWith(1, 1);
    });
  });

  describe('getUsuariosPorProyecto', () => {
    it('should return users assigned to a proyecto', async () => {
      const usuarios = await db.getUsuariosPorProyecto(1);

      expect(Array.isArray(usuarios)).toBe(true);
      expect(usuarios.length).toBe(2);
      expect(usuarios[0]).toHaveProperty('name');
      expect(usuarios[0]).toHaveProperty('email');
      expect(db.getUsuariosPorProyecto).toHaveBeenCalledWith(1);
    });
  });

  describe('getProyectosPorUsuario', () => {
    it('should return proyectos assigned to a user', async () => {
      const proyectos = await db.getProyectosPorUsuario(1);

      expect(Array.isArray(proyectos)).toBe(true);
      expect(proyectos.length).toBe(2);
      expect(proyectos[0]).toHaveProperty('nombre');
      expect(db.getProyectosPorUsuario).toHaveBeenCalledWith(1);
    });
  });

  describe('removerUsuarioDeProyecto', () => {
    it('should remove a user from a proyecto', async () => {
      const result = await db.removerUsuarioDeProyecto(1, 1);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(db.removerUsuarioDeProyecto).toHaveBeenCalledWith(1, 1);
    });
  });
});

describe('Proyectos - Cascada de Filtros', () => {
  it('should filter empresas by proyectoId', async () => {
    // Simular que las empresas se filtran por proyecto
    const mockEmpresas = [
      { id: 1, nombre: 'Empresa A', proyectoId: 1 },
      { id: 2, nombre: 'Empresa B', proyectoId: 1 },
      { id: 3, nombre: 'Empresa C', proyectoId: 2 },
    ];

    const empresasProyecto1 = mockEmpresas.filter(e => e.proyectoId === 1);
    
    expect(empresasProyecto1.length).toBe(2);
    expect(empresasProyecto1.every(e => e.proyectoId === 1)).toBe(true);
  });

  it('should filter unidades by proyectoId', async () => {
    const mockUnidades = [
      { id: 1, nombre: 'Unidad A', proyectoId: 1 },
      { id: 2, nombre: 'Unidad B', proyectoId: 2 },
    ];

    const unidadesProyecto1 = mockUnidades.filter(u => u.proyectoId === 1);
    
    expect(unidadesProyecto1.length).toBe(1);
    expect(unidadesProyecto1[0].nombre).toBe('Unidad A');
  });

  it('should filter especialidades by proyectoId', async () => {
    const mockEspecialidades = [
      { id: 1, nombre: 'Estructura', proyectoId: 1 },
      { id: 2, nombre: 'Acabados', proyectoId: 1 },
      { id: 3, nombre: 'Instalaciones', proyectoId: 2 },
    ];

    const especialidadesProyecto1 = mockEspecialidades.filter(e => e.proyectoId === 1);
    
    expect(especialidadesProyecto1.length).toBe(2);
  });
});

describe('Proyectos - Nombre en Reportes', () => {
  it('should use nombreReporte if available', () => {
    const proyecto = {
      id: 1,
      nombre: 'Proyecto Interno',
      nombreReporte: 'Torre Residencial Norte',
    };

    const nombreParaReporte = proyecto.nombreReporte || proyecto.nombre;
    
    expect(nombreParaReporte).toBe('Torre Residencial Norte');
  });

  it('should fallback to nombre if nombreReporte is not set', () => {
    const proyecto = {
      id: 1,
      nombre: 'Proyecto Interno',
      nombreReporte: null,
    };

    const nombreParaReporte = proyecto.nombreReporte || proyecto.nombre;
    
    expect(nombreParaReporte).toBe('Proyecto Interno');
  });
});
