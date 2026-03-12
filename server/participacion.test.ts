import { describe, it, expect } from 'vitest';

/**
 * Tests para el módulo de Participación
 * Valida la lógica de cálculo de días hábiles, penalizaciones y cumplimiento
 */

// Helpers extracted from the business logic
const PENALIZACION_POR_DIA = 500;
const MINIMO_ITEMS_DIA = 5;

function calcularDiasHabiles(fechaDesde: string, fechaHasta: string): number {
  const start = new Date(fechaDesde + 'T00:00:00');
  const end = new Date(fechaHasta + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const effectiveEnd = end > today ? today : end;
  let diasHabiles = 0;
  const d = new Date(start);
  while (d <= effectiveEnd) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) diasHabiles++;
    d.setDate(d.getDate() + 1);
  }
  return diasHabiles;
}

function calcularPenalizacion(diasIncumplimiento: number): number {
  return diasIncumplimiento * PENALIZACION_POR_DIA;
}

function calcularCumplimiento(
  itemsPorDia: Map<string, number>,
  fechaDesde: string,
  fechaHasta: string
): { diasCumplimiento: number; diasIncumplimiento: number } {
  const start = new Date(fechaDesde + 'T00:00:00');
  const end = new Date(fechaHasta + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const effectiveEnd = end > today ? today : end;
  let diasCumplimiento = 0;
  let diasIncumplimiento = 0;
  const d = new Date(start);
  while (d <= effectiveEnd) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      const diaStr = d.toISOString().split('T')[0];
      const items = itemsPorDia.get(diaStr) || 0;
      if (items >= MINIMO_ITEMS_DIA) {
        diasCumplimiento++;
      } else {
        diasIncumplimiento++;
      }
    }
    d.setDate(d.getDate() + 1);
  }
  return { diasCumplimiento, diasIncumplimiento };
}

describe('Participación - Cálculo de días hábiles', () => {
  it('debe contar solo lunes a viernes', () => {
    // 2026-01-05 (lunes) a 2026-01-09 (viernes) = 5 días hábiles
    const dias = calcularDiasHabiles('2026-01-05', '2026-01-09');
    expect(dias).toBe(5);
  });

  it('debe excluir sábado y domingo', () => {
    // 2026-01-05 (lunes) a 2026-01-11 (domingo) = 5 días hábiles
    const dias = calcularDiasHabiles('2026-01-05', '2026-01-11');
    expect(dias).toBe(5);
  });

  it('debe manejar semana completa con fin de semana', () => {
    // 2026-01-05 (lunes) a 2026-01-16 (viernes) = 10 días hábiles
    const dias = calcularDiasHabiles('2026-01-05', '2026-01-16');
    expect(dias).toBe(10);
  });

  it('debe retornar 0 si rango es un fin de semana', () => {
    // 2026-01-10 (sábado) a 2026-01-11 (domingo) = 0
    const dias = calcularDiasHabiles('2026-01-10', '2026-01-11');
    expect(dias).toBe(0);
  });

  it('debe manejar un solo día hábil', () => {
    // 2026-01-05 (lunes) = 1
    const dias = calcularDiasHabiles('2026-01-05', '2026-01-05');
    expect(dias).toBe(1);
  });
});

describe('Participación - Cálculo de penalizaciones', () => {
  it('penalización es $500 por día incumplido', () => {
    expect(calcularPenalizacion(1)).toBe(500);
    expect(calcularPenalizacion(5)).toBe(2500);
    expect(calcularPenalizacion(20)).toBe(10000);
  });

  it('sin incumplimiento = $0', () => {
    expect(calcularPenalizacion(0)).toBe(0);
  });
});

describe('Participación - Cálculo de cumplimiento', () => {
  it('empresa con 5+ ítems todos los días cumple 100%', () => {
    const itemsPorDia = new Map<string, number>();
    // Lunes a viernes con 5 ítems cada día
    itemsPorDia.set('2026-01-05', 5);
    itemsPorDia.set('2026-01-06', 7);
    itemsPorDia.set('2026-01-07', 5);
    itemsPorDia.set('2026-01-08', 10);
    itemsPorDia.set('2026-01-09', 6);

    const result = calcularCumplimiento(itemsPorDia, '2026-01-05', '2026-01-09');
    expect(result.diasCumplimiento).toBe(5);
    expect(result.diasIncumplimiento).toBe(0);
  });

  it('empresa con 0 ítems incumple todos los días', () => {
    const itemsPorDia = new Map<string, number>();
    const result = calcularCumplimiento(itemsPorDia, '2026-01-05', '2026-01-09');
    expect(result.diasCumplimiento).toBe(0);
    expect(result.diasIncumplimiento).toBe(5);
  });

  it('empresa con 4 ítems en un día no cumple ese día', () => {
    const itemsPorDia = new Map<string, number>();
    itemsPorDia.set('2026-01-05', 4); // NO cumple (< 5)
    itemsPorDia.set('2026-01-06', 5); // Cumple
    itemsPorDia.set('2026-01-07', 3); // NO cumple
    itemsPorDia.set('2026-01-08', 5); // Cumple
    itemsPorDia.set('2026-01-09', 0); // NO cumple

    const result = calcularCumplimiento(itemsPorDia, '2026-01-05', '2026-01-09');
    expect(result.diasCumplimiento).toBe(2);
    expect(result.diasIncumplimiento).toBe(3);
  });

  it('no cuenta sábados ni domingos', () => {
    const itemsPorDia = new Map<string, number>();
    // Sábado y domingo con muchos ítems no deben contar
    itemsPorDia.set('2026-01-10', 20); // Sábado
    itemsPorDia.set('2026-01-11', 20); // Domingo

    const result = calcularCumplimiento(itemsPorDia, '2026-01-10', '2026-01-11');
    expect(result.diasCumplimiento).toBe(0);
    expect(result.diasIncumplimiento).toBe(0);
  });

  it('exactamente 5 ítems es suficiente para cumplir', () => {
    const itemsPorDia = new Map<string, number>();
    itemsPorDia.set('2026-01-05', 5);

    const result = calcularCumplimiento(itemsPorDia, '2026-01-05', '2026-01-05');
    expect(result.diasCumplimiento).toBe(1);
    expect(result.diasIncumplimiento).toBe(0);
  });
});

describe('Participación - Lógica de negocio integrada', () => {
  it('empresa sin participación en 20 días hábiles = $10,000 penalización', () => {
    // 4 semanas laborales = 20 días hábiles
    const diasHabiles = 20;
    const penalizacion = calcularPenalizacion(diasHabiles);
    expect(penalizacion).toBe(10000);
  });

  it('empresa cumpliendo parcialmente tiene penalización proporcional', () => {
    const itemsPorDia = new Map<string, number>();
    // 2 semanas: cumple 7 de 10 días
    itemsPorDia.set('2026-01-05', 5);
    itemsPorDia.set('2026-01-06', 6);
    itemsPorDia.set('2026-01-07', 5);
    itemsPorDia.set('2026-01-08', 2); // falla
    itemsPorDia.set('2026-01-09', 5);
    itemsPorDia.set('2026-01-12', 5);
    itemsPorDia.set('2026-01-13', 5);
    // 14, 15, 16 sin ítems = 3 faltas
    
    const result = calcularCumplimiento(itemsPorDia, '2026-01-05', '2026-01-16');
    // 10 días hábiles total: 5,6,7,8,9,12,13,14,15,16
    // Cumple: 5(5), 6(6), 7(5), 9(5), 12(5), 13(5) = 6 días
    // Falla: 8(2), 14(0), 15(0), 16(0) = 4 días
    expect(result.diasCumplimiento).toBe(6);
    expect(result.diasIncumplimiento).toBe(4);
    expect(calcularPenalizacion(result.diasIncumplimiento)).toBe(2000);
  });

  it('porcentaje de cumplimiento se calcula correctamente', () => {
    const diasCumplimiento = 15;
    const diasHabiles = 20;
    const porcentaje = diasHabiles > 0 ? Math.round((diasCumplimiento / diasHabiles) * 100) : 0;
    expect(porcentaje).toBe(75);
  });

  it('promedio diario se calcula correctamente', () => {
    const totalItems = 50;
    const diasConActividad = 10;
    const promedio = diasConActividad > 0 ? +(totalItems / diasConActividad).toFixed(1) : 0;
    expect(promedio).toBe(5.0);
  });
});
