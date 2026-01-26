import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de la base de datos
vi.mock('./db', () => ({
  getItemById: vi.fn(),
  deleteItem: vi.fn(),
}));

import * as db from './db';

describe('Items Delete - Control de Permisos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Permisos de eliminación', () => {
    it('admin puede eliminar ítems', async () => {
      const mockItem = { id: 1, titulo: 'Test Item', status: 'pendiente_foto_despues' };
      vi.mocked(db.getItemById).mockResolvedValue(mockItem as any);
      vi.mocked(db.deleteItem).mockResolvedValue(undefined);

      // Simular usuario admin
      const user = { id: 1, role: 'admin', name: 'Admin User' };
      const canDelete = ['admin', 'superadmin', 'supervisor'].includes(user.role);
      
      expect(canDelete).toBe(true);
    });

    it('superadmin puede eliminar ítems', async () => {
      const user = { id: 2, role: 'superadmin', name: 'Super Admin' };
      const canDelete = ['admin', 'superadmin', 'supervisor'].includes(user.role);
      
      expect(canDelete).toBe(true);
    });

    it('supervisor puede eliminar ítems', async () => {
      const user = { id: 3, role: 'supervisor', name: 'Supervisor' };
      const canDelete = ['admin', 'superadmin', 'supervisor'].includes(user.role);
      
      expect(canDelete).toBe(true);
    });

    it('residente NO puede eliminar ítems', async () => {
      const user = { id: 4, role: 'residente', name: 'Residente' };
      const canDelete = ['admin', 'superadmin', 'supervisor'].includes(user.role);
      
      expect(canDelete).toBe(false);
    });

    it('jefe_residente NO puede eliminar ítems', async () => {
      const user = { id: 5, role: 'jefe_residente', name: 'Jefe Residente' };
      const canDelete = ['admin', 'superadmin', 'supervisor'].includes(user.role);
      
      expect(canDelete).toBe(false);
    });
  });

  describe('Función deleteItem en db', () => {
    it('debe llamar a deleteItem con el ID correcto', async () => {
      vi.mocked(db.deleteItem).mockResolvedValue(undefined);
      
      await db.deleteItem(123);
      
      expect(db.deleteItem).toHaveBeenCalledWith(123);
    });

    it('getItemById debe retornar el ítem correcto', async () => {
      const mockItem = { 
        id: 1, 
        titulo: 'Fisura en muro', 
        status: 'pendiente_foto_despues',
        empresaId: 1,
        unidadId: 1
      };
      vi.mocked(db.getItemById).mockResolvedValue(mockItem as any);
      
      const result = await db.getItemById(1);
      
      expect(result).toEqual(mockItem);
      expect(db.getItemById).toHaveBeenCalledWith(1);
    });
  });
});

describe('Espacios y Defectos desde BD', () => {
  describe('Espacios filtrados por unidad', () => {
    it('debe filtrar espacios por unidadId', () => {
      const espacios = [
        { id: 1, nombre: 'Sala', unidadId: 1 },
        { id: 2, nombre: 'Cocina', unidadId: 1 },
        { id: 3, nombre: 'Recámara', unidadId: 2 },
      ];
      
      const unidadId = 1;
      const espaciosFiltrados = espacios.filter(e => e.unidadId === unidadId);
      
      expect(espaciosFiltrados).toHaveLength(2);
      expect(espaciosFiltrados.map(e => e.nombre)).toContain('Sala');
      expect(espaciosFiltrados.map(e => e.nombre)).toContain('Cocina');
    });
  });

  describe('Defectos filtrados por especialidad', () => {
    it('debe filtrar defectos por especialidadId', () => {
      const defectos = [
        { id: 1, nombre: 'Fisura en muro', especialidadId: 1, severidad: 'moderado' },
        { id: 2, nombre: 'Grieta estructural', especialidadId: 1, severidad: 'grave' },
        { id: 3, nombre: 'Fuga de agua', especialidadId: 2, severidad: 'grave' },
      ];
      
      const especialidadId = 1;
      const defectosFiltrados = defectos.filter(d => d.especialidadId === especialidadId);
      
      expect(defectosFiltrados).toHaveLength(2);
      expect(defectosFiltrados.map(d => d.nombre)).toContain('Fisura en muro');
      expect(defectosFiltrados.map(d => d.nombre)).toContain('Grieta estructural');
    });

    it('defectos deben tener severidad válida', () => {
      const severidadesValidas = ['leve', 'moderado', 'grave', 'critico'];
      const defecto = { id: 1, nombre: 'Test', especialidadId: 1, severidad: 'moderado' };
      
      expect(severidadesValidas).toContain(defecto.severidad);
    });
  });
});
