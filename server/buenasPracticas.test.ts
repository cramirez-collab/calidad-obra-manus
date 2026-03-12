import { describe, it, expect } from 'vitest';

/**
 * Buenas Prácticas de Seguridad (BP) module tests.
 * These tests validate the data structures and utility logic used by the BP module.
 */

// Categories used in the BP module
const CATEGORIAS = [
  'epp', 'orden_limpieza', 'senalizacion', 'proteccion_colectiva',
  'capacitacion', 'procedimiento', 'innovacion', 'otro'
];

const ESTADOS = ['activa', 'implementada', 'archivada'];
const PRIORIDADES = ['baja', 'media', 'alta', 'critica'];

describe('Buenas Prácticas - Data Validation', () => {
  it('should have valid categories', () => {
    expect(CATEGORIAS).toHaveLength(8);
    expect(CATEGORIAS).toContain('epp');
    expect(CATEGORIAS).toContain('innovacion');
  });

  it('should have valid states', () => {
    expect(ESTADOS).toHaveLength(3);
    expect(ESTADOS).toContain('activa');
    expect(ESTADOS).toContain('implementada');
    expect(ESTADOS).toContain('archivada');
  });

  it('should have valid priorities', () => {
    expect(PRIORIDADES).toHaveLength(4);
    expect(PRIORIDADES).toContain('media');
  });

  it('should generate BP code correctly', () => {
    const generateCode = (total: number) => `BP-${String(total + 1).padStart(5, '0')}`;
    expect(generateCode(0)).toBe('BP-00001');
    expect(generateCode(99)).toBe('BP-00100');
    expect(generateCode(9999)).toBe('BP-10000');
  });
});

describe('Buenas Prácticas - Result Array Extraction', () => {
  it('should extract rows from [rows, fields] format', () => {
    const rawResult = [
      [{ id: 1, titulo: 'Test BP' }],
      [{ name: 'id', type: 3 }] // field metadata
    ];
    const rows = Array.isArray(rawResult) && Array.isArray(rawResult[0]) ? rawResult[0] : rawResult;
    expect(rows).toEqual([{ id: 1, titulo: 'Test BP' }]);
  });

  it('should handle empty result from [rows, fields] format', () => {
    const rawResult = [
      [],
      [{ name: 'id', type: 3 }]
    ];
    const rows = Array.isArray(rawResult) && Array.isArray(rawResult[0]) ? rawResult[0] : rawResult;
    expect(rows).toEqual([]);
    expect(Array.isArray(rows) ? rows : []).toEqual([]);
  });

  it('should handle flat array result', () => {
    const rawResult = [{ id: 1, titulo: 'Test BP' }];
    // If rawResult[0] is not an array (it's an object), keep rawResult as is
    const rows = Array.isArray(rawResult) && Array.isArray(rawResult[0]) ? rawResult[0] : rawResult;
    expect(rows).toEqual([{ id: 1, titulo: 'Test BP' }]);
  });

  it('should handle stats extraction', () => {
    const statsRaw = [
      [{ total: 5, activas: 3, implementadas: 2, archivadas: 0, categorias: 2, empresasInvolucradas: 1 }],
      [{ name: 'total' }]
    ];
    const statsRows = Array.isArray(statsRaw) && Array.isArray(statsRaw[0]) ? statsRaw[0] : statsRaw;
    const stats = Array.isArray(statsRows) ? statsRows[0] : { total: 0 };
    expect(stats.total).toBe(5);
    expect(stats.activas).toBe(3);
  });
});
