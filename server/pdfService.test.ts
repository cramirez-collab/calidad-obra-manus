import { describe, it, expect } from 'vitest';
import { generarPDFCorteEmpresa, generarPDFProgramaCompleto } from './pdfService';

describe('PDF Service - generarPDFCorteEmpresa', () => {
  it('genera un buffer PDF válido con actividades', async () => {
    const data = {
      semanaInicio: '2026-03-02',
      semanaFin: '2026-03-08',
      fechaEntrega: '2026-03-04',
      fechaCorte: '2026-03-06',
      status: 'corte_realizado',
      actividades: [
        {
          actividad: 'Cimbra de losa',
          especialidad: 'Estructura',
          nivel: 'N1',
          area: 'Torre A',
          referenciaEje: 'A-B/1-3',
          unidad: 'm2',
          material: 'Madera',
          cantidadProgramada: '100',
          cantidadRealizada: '85',
          porcentajeAvance: '85',
        },
        {
          actividad: 'Armado de acero',
          especialidad: 'Estructura',
          nivel: 'N1',
          area: 'Torre A',
          referenciaEje: 'C-D/1-3',
          unidad: 'kg',
          material: 'Acero',
          cantidadProgramada: '500',
          cantidadRealizada: '450',
          porcentajeAvance: '90',
        },
        {
          actividad: 'Instalacion electrica',
          especialidad: 'Electrica',
          nivel: 'N2',
          area: 'Torre B',
          unidad: 'ml',
          cantidadProgramada: '200',
          cantidadRealizada: '50',
          porcentajeAvance: '25',
        },
      ],
    };

    const buffer = await generarPDFCorteEmpresa(data, 'Estructura');

    // Debe ser un Buffer
    expect(buffer).toBeInstanceOf(Buffer);
    // Debe tener contenido
    expect(buffer.length).toBeGreaterThan(100);
    // Debe empezar con el magic number de PDF (%PDF-)
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('genera PDF válido con análisis 8Ms', async () => {
    const data = {
      semanaInicio: '2026-03-02',
      semanaFin: '2026-03-08',
      status: 'corte_realizado',
      actividades: [
        {
          actividad: 'Cimbra de losa',
          especialidad: 'Estructura',
          nivel: 'N1',
          area: 'Torre A',
          unidad: 'm2',
          cantidadProgramada: '100',
          cantidadRealizada: '30',
          porcentajeAvance: '30',
        },
      ],
    };

    const analisis = {
      resumenGeneral: 'La eficiencia es baja, se requiere atencion inmediata en materiales y mano de obra.',
      categorias: [
        { nombre: 'Material', estado: 'critico', recomendacion: 'Verificar suministro de madera para cimbra' },
        { nombre: 'Mano de obra', estado: 'atencion', recomendacion: 'Incrementar cuadrilla de carpinteros' },
        { nombre: 'Metodo', estado: 'aceptable', recomendacion: 'Procedimiento adecuado, mantener secuencia' },
      ],
    };

    const buffer = await generarPDFCorteEmpresa(data, 'Estructura', analisis);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
    // Con análisis el PDF debe ser más grande
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('genera PDF vacío cuando no hay actividades de la especialidad', async () => {
    const data = {
      semanaInicio: '2026-03-02',
      semanaFin: '2026-03-08',
      status: 'corte_realizado',
      actividades: [
        {
          actividad: 'Cimbra',
          especialidad: 'Estructura',
          nivel: 'N1',
          area: 'A',
          unidad: 'm2',
          cantidadProgramada: '100',
          cantidadRealizada: '50',
          porcentajeAvance: '50',
        },
      ],
    };

    // Pedir especialidad que no existe
    const buffer = await generarPDFCorteEmpresa(data, 'Electrica');
    // Aún debe generar un PDF válido (vacío pero válido)
    expect(buffer).toBeInstanceOf(Buffer);
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('maneja datos con campos faltantes sin crashear', async () => {
    const data = {
      semanaInicio: '2026-03-02',
      semanaFin: '2026-03-08',
      status: 'corte_realizado',
      actividades: [
        {
          actividad: 'Actividad sin datos opcionales',
          especialidad: 'Test',
          unidad: 'pza',
          cantidadProgramada: '10',
          // Sin cantidadRealizada, sin nivel, sin area, sin material
        },
      ],
    };

    const buffer = await generarPDFCorteEmpresa(data, 'Test');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });
});

describe('PDF Service - generarPDFProgramaCompleto', () => {
  it('genera PDF completo con múltiples especialidades', async () => {
    const data = {
      semanaInicio: '2026-03-02',
      semanaFin: '2026-03-08',
      status: 'corte_realizado',
      actividades: [
        {
          actividad: 'Cimbra',
          especialidad: 'Estructura',
          nivel: 'N1',
          area: 'A',
          unidad: 'm2',
          cantidadProgramada: '100',
          cantidadRealizada: '80',
          porcentajeAvance: '80',
        },
        {
          actividad: 'Instalacion',
          especialidad: 'Electrica',
          nivel: 'N2',
          area: 'B',
          unidad: 'ml',
          cantidadProgramada: '200',
          cantidadRealizada: '100',
          porcentajeAvance: '50',
        },
      ],
    };

    const buffer = await generarPDFProgramaCompleto(data);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });
});
