import { describe, it, expect } from 'vitest';

describe('programaSemanal.reportesPorEmpresa', () => {
  it('should return empresas and eficienciaGlobal arrays', async () => {
    // Import the db function directly
    const { getProgramasPorEmpresa } = await import('./db');
    
    // Test with a valid project ID (Hidalma = 1)
    const result = await getProgramasPorEmpresa(1);
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty('empresas');
    expect(result).toHaveProperty('eficienciaGlobal');
    expect(Array.isArray(result.empresas)).toBe(true);
    expect(Array.isArray(result.eficienciaGlobal)).toBe(true);
  });

  it('should return correct structure for each empresa', async () => {
    const { getProgramasPorEmpresa } = await import('./db');
    const result = await getProgramasPorEmpresa(1);
    
    if (result.empresas.length > 0) {
      const empresa = result.empresas[0];
      expect(empresa).toHaveProperty('usuarioId');
      expect(empresa).toHaveProperty('empresaNombre');
      expect(empresa).toHaveProperty('eficienciaAcumulada');
      expect(empresa).toHaveProperty('totalProgramas');
      expect(empresa).toHaveProperty('totalCortes');
      expect(empresa).toHaveProperty('programas');
      expect(Array.isArray(empresa.programas)).toBe(true);
      expect(typeof empresa.eficienciaAcumulada).toBe('number');
    }
  });

  it('should return correct structure for eficienciaGlobal', async () => {
    const { getProgramasPorEmpresa } = await import('./db');
    const result = await getProgramasPorEmpresa(1);
    
    if (result.eficienciaGlobal.length > 0) {
      const eg = result.eficienciaGlobal[0];
      expect(eg).toHaveProperty('nombre');
      expect(eg).toHaveProperty('eficiencia');
      expect(eg).toHaveProperty('totalProgramado');
      expect(eg).toHaveProperty('totalRealizado');
      expect(eg).toHaveProperty('cortesCount');
      expect(eg).toHaveProperty('programasCount');
      expect(typeof eg.eficiencia).toBe('number');
    }
  });

  it('should return empty arrays for non-existent project', async () => {
    const { getProgramasPorEmpresa } = await import('./db');
    const result = await getProgramasPorEmpresa(99999);
    
    expect(result.empresas).toHaveLength(0);
    expect(result.eficienciaGlobal).toHaveLength(0);
  });

  it('should sort eficienciaGlobal by eficiencia descending', async () => {
    const { getProgramasPorEmpresa } = await import('./db');
    const result = await getProgramasPorEmpresa(1);
    
    if (result.eficienciaGlobal.length > 1) {
      for (let i = 0; i < result.eficienciaGlobal.length - 1; i++) {
        expect(result.eficienciaGlobal[i].eficiencia).toBeGreaterThanOrEqual(result.eficienciaGlobal[i + 1].eficiencia);
      }
    }
  });
});
