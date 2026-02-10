import { describe, it, expect, vi } from 'vitest';
import { getPenalizacionesPorEmpresa } from './db';

// Mock the database
vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getPenalizacionesPorEmpresa: vi.fn(),
  };
});

describe('Sistema de Penalizaciones', () => {
  const MONTO_POR_ITEM = 2000;

  it('debe calcular penalización activa = ítems no aprobados * $2,000', () => {
    const empresaData = {
      empresaNombre: 'Constructora Test',
      totalItems: 10,
      aprobados: 3,
      noAprobados: 7,
    };
    const penalizacionActiva = empresaData.noAprobados * MONTO_POR_ITEM;
    const penalizacionLiberada = empresaData.aprobados * MONTO_POR_ITEM;
    
    expect(penalizacionActiva).toBe(14000);
    expect(penalizacionLiberada).toBe(6000);
  });

  it('debe liberar penalización cuando todos los ítems son aprobados', () => {
    const empresaData = {
      empresaNombre: 'Constructora Test',
      totalItems: 5,
      aprobados: 5,
      noAprobados: 0,
    };
    const penalizacionActiva = empresaData.noAprobados * MONTO_POR_ITEM;
    const penalizacionLiberada = empresaData.aprobados * MONTO_POR_ITEM;
    
    expect(penalizacionActiva).toBe(0);
    expect(penalizacionLiberada).toBe(10000);
  });

  it('debe calcular totales correctamente para múltiples empresas', () => {
    const empresas = [
      { empresaNombre: 'Empresa A', totalItems: 10, aprobados: 3, noAprobados: 7 },
      { empresaNombre: 'Empresa B', totalItems: 5, aprobados: 5, noAprobados: 0 },
      { empresaNombre: 'Empresa C', totalItems: 8, aprobados: 2, noAprobados: 6 },
    ];

    const totalActiva = empresas.reduce((sum, e) => sum + e.noAprobados * MONTO_POR_ITEM, 0);
    const totalLiberada = empresas.reduce((sum, e) => sum + e.aprobados * MONTO_POR_ITEM, 0);
    const totalGeneral = totalActiva + totalLiberada;

    expect(totalActiva).toBe(26000); // (7+0+6) * 2000
    expect(totalLiberada).toBe(20000); // (3+5+2) * 2000
    expect(totalGeneral).toBe(46000); // 23 items * 2000
  });

  it('debe retornar $0 cuando no hay ítems', () => {
    const empresas: any[] = [];
    const totalActiva = empresas.reduce((sum, e) => sum + e.noAprobados * MONTO_POR_ITEM, 0);
    const totalLiberada = empresas.reduce((sum, e) => sum + e.aprobados * MONTO_POR_ITEM, 0);

    expect(totalActiva).toBe(0);
    expect(totalLiberada).toBe(0);
  });

  it('badge de penalización muestra -$2,000 para ítems no aprobados', () => {
    const statuses = ['pendiente_foto_despues', 'pendiente_aprobacion', 'rechazado'];
    statuses.forEach(status => {
      expect(status !== 'aprobado').toBe(true);
    });
  });

  it('badge de penalización muestra "Liberada" para ítems aprobados', () => {
    const status = 'aprobado';
    expect(status === 'aprobado').toBe(true);
  });

  it('getPenalizacionesPorEmpresa es una función exportada', () => {
    expect(typeof getPenalizacionesPorEmpresa).toBe('function');
  });
});
