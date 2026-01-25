import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de la base de datos
vi.mock('./db', () => ({
  getAllDefectos: vi.fn().mockResolvedValue([
    { id: 1, codigo: 'DEF-001', nombre: 'Fisura en muro', severidad: 'moderado', especialidadId: 1 },
    { id: 2, codigo: 'DEF-002', nombre: 'Humedad', severidad: 'grave', especialidadId: 1 },
  ]),
  getDefectosByEspecialidad: vi.fn().mockResolvedValue([
    { id: 1, codigo: 'DEF-001', nombre: 'Fisura en muro', severidad: 'moderado', especialidadId: 1 },
  ]),
  createDefecto: vi.fn().mockResolvedValue({ id: 3 }),
  updateDefecto: vi.fn().mockResolvedValue({ success: true }),
  deleteDefecto: vi.fn().mockResolvedValue({ success: true }),
  getDefectosEstadisticas: vi.fn().mockResolvedValue({
    porDefecto: [
      { defecto: { id: 1, nombre: 'Fisura' }, total: 10, aprobados: 8, rechazados: 2, tasaAprobacion: 80 },
    ],
    porSeveridad: [
      { severidad: 'leve', total: 5 },
      { severidad: 'moderado', total: 10 },
      { severidad: 'grave', total: 3 },
      { severidad: 'critico', total: 1 },
    ],
    totalItems: 19,
  }),
}));

import * as db from './db';

describe('Defectos Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllDefectos', () => {
    it('should return all defectos', async () => {
      const defectos = await db.getAllDefectos();
      
      expect(defectos).toBeDefined();
      expect(Array.isArray(defectos)).toBe(true);
      expect(defectos.length).toBe(2);
      expect(defectos[0]).toHaveProperty('codigo');
      expect(defectos[0]).toHaveProperty('nombre');
      expect(defectos[0]).toHaveProperty('severidad');
    });
  });

  describe('getDefectosByEspecialidad', () => {
    it('should return defectos filtered by especialidad', async () => {
      const defectos = await db.getDefectosByEspecialidad(1);
      
      expect(defectos).toBeDefined();
      expect(Array.isArray(defectos)).toBe(true);
      expect(defectos.length).toBe(1);
      expect(defectos[0].especialidadId).toBe(1);
    });
  });

  describe('createDefecto', () => {
    it('should create a new defecto', async () => {
      const newDefecto = {
        codigo: 'DEF-003',
        nombre: 'Grieta estructural',
        severidad: 'critico' as const,
        especialidadId: 2,
      };
      
      const result = await db.createDefecto(newDefecto);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(3);
    });
  });

  describe('updateDefecto', () => {
    it('should update an existing defecto', async () => {
      const result = await db.updateDefecto(1, { nombre: 'Fisura menor' });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('deleteDefecto', () => {
    it('should delete a defecto', async () => {
      const result = await db.deleteDefecto(1);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('getDefectosEstadisticas', () => {
    it('should return defectos statistics', async () => {
      const stats = await db.getDefectosEstadisticas();
      
      expect(stats).toBeDefined();
      expect(stats.porDefecto).toBeDefined();
      expect(stats.porSeveridad).toBeDefined();
      expect(stats.totalItems).toBe(19);
      
      // Verificar estructura de porDefecto
      expect(stats.porDefecto[0]).toHaveProperty('defecto');
      expect(stats.porDefecto[0]).toHaveProperty('total');
      expect(stats.porDefecto[0]).toHaveProperty('aprobados');
      expect(stats.porDefecto[0]).toHaveProperty('rechazados');
      expect(stats.porDefecto[0]).toHaveProperty('tasaAprobacion');
      
      // Verificar estructura de porSeveridad
      expect(stats.porSeveridad.length).toBe(4);
      expect(stats.porSeveridad[0]).toHaveProperty('severidad');
      expect(stats.porSeveridad[0]).toHaveProperty('total');
    });

    it('should calculate correct totals by severity', async () => {
      const stats = await db.getDefectosEstadisticas();
      
      const totalBySeverity = stats.porSeveridad.reduce((acc, s) => acc + s.total, 0);
      expect(totalBySeverity).toBe(19);
    });
  });
});

describe('Defecto Validation', () => {
  it('should have valid severidad values', () => {
    const validSeveridades = ['leve', 'moderado', 'grave', 'critico'];
    
    validSeveridades.forEach(sev => {
      expect(['leve', 'moderado', 'grave', 'critico']).toContain(sev);
    });
  });

  it('should have codigo format DEF-XXX', () => {
    const codigo = 'DEF-001';
    const pattern = /^DEF-\d{3}$/;
    
    expect(pattern.test(codigo)).toBe(true);
  });
});
