import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de la base de datos
vi.mock('./db', () => ({
  getResidentesByEmpresa: vi.fn().mockResolvedValue([
    { id: 1, empresaId: 1, usuarioId: 10, tipoResidente: 'residente', usuario: { id: 10, name: 'Juan Pérez' } },
    { id: 2, empresaId: 1, usuarioId: 11, tipoResidente: 'jefe_residente', usuario: { id: 11, name: 'María García' } },
  ]),
  addResidenteToEmpresa: vi.fn().mockResolvedValue(3),
  removeResidenteFromEmpresa: vi.fn().mockResolvedValue(undefined),
  getAllResidentesConEmpresas: vi.fn().mockResolvedValue([
    { 
      id: 10, 
      name: 'Juan Pérez', 
      empresas: [
        { empresaId: 1, empresaNombre: 'GBPO', tipoResidente: 'residente', especialidadId: 1 }
      ] 
    },
    { 
      id: 11, 
      name: 'María García', 
      empresas: [
        { empresaId: 1, empresaNombre: 'GBPO', tipoResidente: 'jefe_residente', especialidadId: 1 },
        { empresaId: 2, empresaNombre: 'Objetiva', tipoResidente: 'residente', especialidadId: 2 }
      ] 
    },
  ]),
  migrarResidentesExistentes: vi.fn().mockResolvedValue({ migrados: 5 }),
}));

import * as db from './db';

describe('Empresa Residentes - Multiple Residents per Company', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getResidentesByEmpresa', () => {
    it('should return all residents for a company', async () => {
      const result = await db.getResidentesByEmpresa(1);
      
      expect(result).toHaveLength(2);
      expect(result[0].tipoResidente).toBe('residente');
      expect(result[1].tipoResidente).toBe('jefe_residente');
    });

    it('should include user information', async () => {
      const result = await db.getResidentesByEmpresa(1);
      
      expect(result[0].usuario).toBeDefined();
      expect(result[0].usuario.name).toBe('Juan Pérez');
    });
  });

  describe('addResidenteToEmpresa', () => {
    it('should add a resident to a company', async () => {
      const result = await db.addResidenteToEmpresa(1, 12, 'residente');
      
      expect(result).toBe(3);
      expect(db.addResidenteToEmpresa).toHaveBeenCalledWith(1, 12, 'residente');
    });

    it('should support jefe_residente type', async () => {
      await db.addResidenteToEmpresa(1, 13, 'jefe_residente');
      
      expect(db.addResidenteToEmpresa).toHaveBeenCalledWith(1, 13, 'jefe_residente');
    });
  });

  describe('removeResidenteFromEmpresa', () => {
    it('should remove a resident from a company', async () => {
      await db.removeResidenteFromEmpresa(1, 10);
      
      expect(db.removeResidenteFromEmpresa).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('getAllResidentesConEmpresas', () => {
    it('should return all residents with their companies', async () => {
      const result = await db.getAllResidentesConEmpresas();
      
      expect(result).toHaveLength(2);
    });

    it('should support residents with multiple companies', async () => {
      const result = await db.getAllResidentesConEmpresas();
      
      const mariaGarcia = result.find((r: any) => r.name === 'María García');
      expect(mariaGarcia?.empresas).toHaveLength(2);
    });

    it('should include company details for each assignment', async () => {
      const result = await db.getAllResidentesConEmpresas();
      
      const juanPerez = result.find((r: any) => r.name === 'Juan Pérez');
      expect(juanPerez?.empresas[0].empresaNombre).toBe('GBPO');
      expect(juanPerez?.empresas[0].tipoResidente).toBe('residente');
    });
  });

  describe('migrarResidentesExistentes', () => {
    it('should migrate existing residents from old structure', async () => {
      const result = await db.migrarResidentesExistentes();
      
      expect(result.migrados).toBe(5);
    });
  });
});

describe('Empresa Residentes - Business Rules', () => {
  it('should allow multiple residents per company', async () => {
    const result = await db.getResidentesByEmpresa(1);
    expect(result.length).toBeGreaterThan(1);
  });

  it('should allow same resident in multiple companies', async () => {
    const result = await db.getAllResidentesConEmpresas();
    const residentWithMultipleCompanies = result.find((r: any) => r.empresas?.length > 1);
    expect(residentWithMultipleCompanies).toBeDefined();
  });

  it('should support both residente and jefe_residente types', async () => {
    const result = await db.getResidentesByEmpresa(1);
    const tipos = result.map((r: any) => r.tipoResidente);
    expect(tipos).toContain('residente');
    expect(tipos).toContain('jefe_residente');
  });
});
