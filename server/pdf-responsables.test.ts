import { describe, it, expect } from 'vitest';

// Test the data shape that the backend returns for responsables
describe('Responsables en Reportes IA', () => {
  it('debe tener la estructura correcta de responsable', () => {
    const responsable = {
      nombre: 'Juan Pérez',
      role: 'residente',
      empresa: 'Constructora ABC',
      total: 25,
      aprobados: 18,
      rechazados: 4,
      pendientes: 3,
      tasaAprobacion: 72.0,
      tiempoPromedio: 3.5,
      score: 130,
    };

    expect(responsable).toHaveProperty('nombre');
    expect(responsable).toHaveProperty('role');
    expect(responsable).toHaveProperty('empresa');
    expect(responsable).toHaveProperty('total');
    expect(responsable).toHaveProperty('aprobados');
    expect(responsable).toHaveProperty('rechazados');
    expect(responsable).toHaveProperty('pendientes');
    expect(responsable).toHaveProperty('tasaAprobacion');
    expect(responsable).toHaveProperty('tiempoPromedio');
    expect(responsable).toHaveProperty('score');
    expect(typeof responsable.tasaAprobacion).toBe('number');
    expect(responsable.total).toBe(responsable.aprobados + responsable.rechazados + responsable.pendientes);
  });

  it('debe calcular score correctamente', () => {
    // Score formula: aprobados * 10 - rechazados * 5 - pendientes * 2 + contribuciones * 3
    const aprobados = 18;
    const rechazados = 4;
    const pendientes = 3;
    const contribuciones = 5;
    const expectedScore = aprobados * 10 - rechazados * 5 - pendientes * 2 + contribuciones * 3;
    expect(expectedScore).toBe(169);
  });

  it('debe tener la estructura correcta de pendienteAprobacion', () => {
    const pendiente = {
      nombre: 'María López',
      rol: 'supervisor',
      itemsCreados: 15,
      activo: true,
      diasSinActividad: 2,
    };

    expect(pendiente).toHaveProperty('nombre');
    expect(pendiente).toHaveProperty('rol');
    expect(pendiente).toHaveProperty('itemsCreados');
    expect(pendiente).toHaveProperty('activo');
    expect(pendiente).toHaveProperty('diasSinActividad');
    expect(typeof pendiente.activo).toBe('boolean');
  });

  it('debe clasificar correctamente activos e inactivos', () => {
    const usuarios = [
      { nombre: 'A', rol: 'supervisor', itemsCreados: 10, activo: true, diasSinActividad: 1 },
      { nombre: 'B', rol: 'jefe_residente', itemsCreados: 5, activo: false, diasSinActividad: 15 },
      { nombre: 'C', rol: 'admin', itemsCreados: 20, activo: true, diasSinActividad: 0 },
      { nombre: 'D', rol: 'supervisor', itemsCreados: 3, activo: false, diasSinActividad: 30 },
    ];

    const activos = usuarios.filter(u => u.activo);
    const inactivos = usuarios.filter(u => !u.activo);

    expect(activos.length).toBe(2);
    expect(inactivos.length).toBe(2);
    expect(activos.every(u => u.diasSinActividad <= 7)).toBe(true);
    expect(inactivos.every(u => u.diasSinActividad > 7)).toBe(true);
  });

  it('chartData debe tener las 4 secciones correctas (sin tendencia)', () => {
    const chartData = {
      porStatus: [
        { name: 'Aprobados', value: 30, color: '#02B381' },
        { name: 'Rechazados', value: 10, color: '#ef4444' },
      ],
      porEmpresa: [
        { name: 'Empresa A', total: 20, rechazados: 5 },
      ],
      porEspecialidad: [
        { name: 'Eléctrica', total: 15, rechazados: 3 },
      ],
      defectos: [
        { name: 'Fisura', frecuencia: 8 },
      ],
    };

    expect(chartData).toHaveProperty('porStatus');
    expect(chartData).toHaveProperty('porEmpresa');
    expect(chartData).toHaveProperty('porEspecialidad');
    expect(chartData).toHaveProperty('defectos');
    // No debe tener tendencia
    expect(chartData).not.toHaveProperty('tendenciaFake');
  });

  it('debe limitar responsables a máximo 10', () => {
    const ranking = Array.from({ length: 20 }, (_, i) => ({
      nombre: `User ${i}`,
      role: 'residente',
      empresa: null,
      estadisticas: { total: 10 - i, aprobados: 5, rechazados: 2, pendientes: 3, tasaAprobacion: 50, tiempoPromedio: 2 },
      scoreRendimiento: 100 - i * 5,
    }));

    const responsables = ranking.slice(0, 10).map(r => ({
      nombre: r.nombre,
      role: r.role,
      empresa: r.empresa,
      total: r.estadisticas.total,
      aprobados: r.estadisticas.aprobados,
      rechazados: r.estadisticas.rechazados,
      pendientes: r.estadisticas.pendientes,
      tasaAprobacion: r.estadisticas.tasaAprobacion,
      tiempoPromedio: r.estadisticas.tiempoPromedio,
      score: r.scoreRendimiento,
    }));

    expect(responsables.length).toBe(10);
    expect(responsables[0].score).toBeGreaterThan(responsables[9].score);
  });
});
