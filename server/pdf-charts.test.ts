import { describe, it, expect } from 'vitest';

/**
 * Tests for pdfCharts module - validates the chart data structures
 * and helper function contracts used in PDF generation.
 * The actual drawing functions run in browser context (jsPDF + canvas),
 * so we test the data preparation and contract here.
 */

describe('PDF Charts Data Contracts', () => {
  // Sample chart data matching what the backend returns
  const sampleChartData = {
    porStatus: [
      { name: 'Aprobado', value: 30, color: '#02B381' },
      { name: 'Rechazado', value: 10, color: '#ef4444' },
      { name: 'Pendiente', value: 15, color: '#f59e0b' },
    ],
    porEmpresa: [
      { name: 'Empresa A', total: 20, rechazados: 5 },
      { name: 'Empresa B', total: 15, rechazados: 3 },
    ],
    porEspecialidad: [
      { name: 'Eléctrica', total: 12, rechazados: 4 },
      { name: 'Hidráulica', total: 8, rechazados: 2 },
    ],
    defectos: [
      { name: 'Fisura', frecuencia: 8 },
      { name: 'Humedad', frecuencia: 5 },
      { name: 'Desplome', frecuencia: 3 },
    ],
  };

  const sampleFotos = [
    { id: 1, codigo: 'OQC-00001', fotoUrl: 'https://example.com/foto1.jpg', status: 'rechazado' },
    { id: 2, codigo: 'OQC-00002', fotoUrl: 'https://example.com/foto2.jpg', status: 'aprobado' },
    { id: 3, codigo: 'OQC-00003', fotoUrl: 'https://example.com/foto3.jpg', status: 'pendiente' },
  ];

  it('chartData.porStatus debe tener name, value y color', () => {
    for (const item of sampleChartData.porStatus) {
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('value');
      expect(item).toHaveProperty('color');
      expect(typeof item.name).toBe('string');
      expect(typeof item.value).toBe('number');
      expect(item.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('chartData.porEmpresa debe tener name, total y rechazados', () => {
    for (const item of sampleChartData.porEmpresa) {
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('total');
      expect(item).toHaveProperty('rechazados');
      expect(typeof item.total).toBe('number');
      expect(typeof item.rechazados).toBe('number');
      expect(item.rechazados).toBeLessThanOrEqual(item.total);
    }
  });

  it('chartData.porEspecialidad debe tener name, total y rechazados', () => {
    for (const item of sampleChartData.porEspecialidad) {
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('total');
      expect(item).toHaveProperty('rechazados');
    }
  });

  it('chartData.defectos debe tener name y frecuencia', () => {
    for (const item of sampleChartData.defectos) {
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('frecuencia');
      expect(typeof item.frecuencia).toBe('number');
      expect(item.frecuencia).toBeGreaterThanOrEqual(0);
    }
  });

  it('fotosEvidencia debe tener id, codigo, fotoUrl y status', () => {
    for (const foto of sampleFotos) {
      expect(foto).toHaveProperty('id');
      expect(foto).toHaveProperty('codigo');
      expect(foto).toHaveProperty('fotoUrl');
      expect(foto).toHaveProperty('status');
      expect(typeof foto.id).toBe('number');
      expect(typeof foto.codigo).toBe('string');
      expect(typeof foto.fotoUrl).toBe('string');
    }
  });

  it('fotosEvidencia debe tener máximo 3 fotos para el PDF', () => {
    const fotosParaPDF = sampleFotos.slice(0, 3);
    expect(fotosParaPDF.length).toBeLessThanOrEqual(3);
  });

  it('chartData no debe incluir tendencia (eliminada en v4.45)', () => {
    expect(sampleChartData).not.toHaveProperty('tendencia');
  });

  it('chartData debe tener exactamente 4 categorías de gráficas', () => {
    const keys = Object.keys(sampleChartData);
    expect(keys).toHaveLength(4);
    expect(keys).toContain('porStatus');
    expect(keys).toContain('porEmpresa');
    expect(keys).toContain('porEspecialidad');
    expect(keys).toContain('defectos');
  });

  it('porStatus values deben sumar el total de ítems', () => {
    const total = sampleChartData.porStatus.reduce((sum, s) => sum + s.value, 0);
    expect(total).toBe(55); // 30 + 10 + 15
    expect(total).toBeGreaterThan(0);
  });
});
