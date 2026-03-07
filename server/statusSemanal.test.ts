import { describe, it, expect } from 'vitest';

/**
 * Tests para el endpoint statusSemanal del programa semanal
 * Verifica la lógica de cálculo de semana actual y estados
 */

describe('Status Semanal - Cálculo de semana', () => {
  function getMonday(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function getSunday(monday: Date): Date {
    const d = new Date(monday);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  it('debe calcular el lunes correcto para un martes', () => {
    // Martes 4 de marzo 2026
    const martes = new Date(2026, 2, 4);
    const monday = getMonday(martes);
    expect(monday.getDay()).toBe(1); // Lunes
    expect(monday.getDate()).toBe(2); // 2 de marzo
  });

  it('debe calcular el lunes correcto para un domingo', () => {
    // Domingo 8 de marzo 2026
    const domingo = new Date(2026, 2, 8);
    const monday = getMonday(domingo);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(2); // Lunes 2 de marzo
  });

  it('debe calcular el lunes correcto para un lunes', () => {
    const lunes = new Date(2026, 2, 2);
    const monday = getMonday(lunes);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(2);
  });

  it('domingo debe ser 6 días después del lunes', () => {
    const monday = new Date(2026, 2, 2);
    monday.setHours(0, 0, 0, 0);
    const sunday = getSunday(monday);
    expect(sunday.getDay()).toBe(0);
    expect(sunday.getDate()).toBe(8);
  });
});

describe('Status Semanal - Lógica de estados', () => {
  it('sin programa: programaEntregado=false, corteRealizado=false', () => {
    const programa = null;
    const programaEntregado = programa ? (programa as any).status !== 'borrador' : false;
    const corteRealizado = (programa as any)?.status === 'corte_realizado';
    expect(programaEntregado).toBe(false);
    expect(corteRealizado).toBe(false);
  });

  it('programa en borrador: programaEntregado=false', () => {
    const programa = { status: 'borrador' };
    const programaEntregado = programa.status !== 'borrador';
    expect(programaEntregado).toBe(false);
  });

  it('programa entregado: programaEntregado=true, corteRealizado=false', () => {
    const programa = { status: 'entregado' };
    const programaEntregado = programa.status !== 'borrador';
    const corteRealizado = programa.status === 'corte_realizado';
    expect(programaEntregado).toBe(true);
    expect(corteRealizado).toBe(false);
  });

  it('programa con corte: programaEntregado=true, corteRealizado=true', () => {
    const programa = { status: 'corte_realizado' };
    const programaEntregado = programa.status !== 'borrador';
    const corteRealizado = programa.status === 'corte_realizado';
    expect(programaEntregado).toBe(true);
    expect(corteRealizado).toBe(true);
  });
});

describe('Status Semanal - Lógica de miércoles', () => {
  it('lunes no es miércoles o después', () => {
    const day = 1; // Lunes
    const esMiercolesODespues = day >= 3 || day === 0;
    expect(esMiercolesODespues).toBe(false);
  });

  it('martes no es miércoles o después', () => {
    const day = 2;
    const esMiercolesODespues = day >= 3 || day === 0;
    expect(esMiercolesODespues).toBe(false);
  });

  it('miércoles sí es miércoles o después', () => {
    const day = 3;
    const esMiercolesODespues = day >= 3 || day === 0;
    expect(esMiercolesODespues).toBe(true);
  });

  it('jueves sí es miércoles o después', () => {
    const day = 4;
    const esMiercolesODespues = day >= 3 || day === 0;
    expect(esMiercolesODespues).toBe(true);
  });

  it('viernes sí es miércoles o después', () => {
    const day = 5;
    const esMiercolesODespues = day >= 3 || day === 0;
    expect(esMiercolesODespues).toBe(true);
  });

  it('sábado sí es miércoles o después', () => {
    const day = 6;
    const esMiercolesODespues = day >= 3 || day === 0;
    expect(esMiercolesODespues).toBe(true);
  });

  it('domingo sí es miércoles o después', () => {
    const day = 0;
    const esMiercolesODespues = day >= 3 || day === 0;
    expect(esMiercolesODespues).toBe(true);
  });
});

describe('Status Semanal - Banner UI logic', () => {
  function getBannerState(statusSemanal: {
    tienePrograma: boolean;
    programaEntregado: boolean;
    corteRealizado: boolean;
    esMiercolesODespues: boolean;
    status: string | null;
  }) {
    const programaLabel = statusSemanal.programaEntregado ? 'Programa Entregado' : 'Falta Programa';
    const programaSubtext = statusSemanal.tienePrograma
      ? (statusSemanal.status === 'borrador' ? 'En borrador - entregar' : '')
      : 'No has creado programa esta semana';

    const corteLabel = statusSemanal.corteRealizado ? 'Corte Realizado' : 'Falta Corte';
    const corteSubtext = statusSemanal.corteRealizado
      ? ''
      : statusSemanal.esMiercolesODespues && statusSemanal.programaEntregado
        ? 'Realiza el corte semanal'
        : !statusSemanal.programaEntregado
          ? 'Primero entrega el programa'
          : 'Disponible a partir del miercoles';

    return { programaLabel, programaSubtext, corteLabel, corteSubtext };
  }

  it('sin programa, lunes: muestra falta programa y falta corte', () => {
    const state = getBannerState({
      tienePrograma: false,
      programaEntregado: false,
      corteRealizado: false,
      esMiercolesODespues: false,
      status: null,
    });
    expect(state.programaLabel).toBe('Falta Programa');
    expect(state.programaSubtext).toBe('No has creado programa esta semana');
    expect(state.corteLabel).toBe('Falta Corte');
    expect(state.corteSubtext).toBe('Primero entrega el programa');
  });

  it('programa en borrador: muestra falta programa con subtexto borrador', () => {
    const state = getBannerState({
      tienePrograma: true,
      programaEntregado: false,
      corteRealizado: false,
      esMiercolesODespues: false,
      status: 'borrador',
    });
    expect(state.programaLabel).toBe('Falta Programa');
    expect(state.programaSubtext).toBe('En borrador - entregar');
  });

  it('programa entregado, antes de miércoles: corte no disponible aún', () => {
    const state = getBannerState({
      tienePrograma: true,
      programaEntregado: true,
      corteRealizado: false,
      esMiercolesODespues: false,
      status: 'entregado',
    });
    expect(state.programaLabel).toBe('Programa Entregado');
    expect(state.corteLabel).toBe('Falta Corte');
    expect(state.corteSubtext).toBe('Disponible a partir del miercoles');
  });

  it('programa entregado, miércoles: urgencia de corte', () => {
    const state = getBannerState({
      tienePrograma: true,
      programaEntregado: true,
      corteRealizado: false,
      esMiercolesODespues: true,
      status: 'entregado',
    });
    expect(state.programaLabel).toBe('Programa Entregado');
    expect(state.corteLabel).toBe('Falta Corte');
    expect(state.corteSubtext).toBe('Realiza el corte semanal');
  });

  it('corte realizado: todo verde', () => {
    const state = getBannerState({
      tienePrograma: true,
      programaEntregado: true,
      corteRealizado: true,
      esMiercolesODespues: true,
      status: 'corte_realizado',
    });
    expect(state.programaLabel).toBe('Programa Entregado');
    expect(state.corteLabel).toBe('Corte Realizado');
  });
});
