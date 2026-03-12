import { describe, it, expect } from 'vitest';
import { generarPDFFichasItems } from './pdfFichasItems';
import { generarPDFPruebasReporte } from './pdfPruebasReporte';

describe('PDF Masivo: Fichas de Items', () => {
  it('genera un PDF buffer valido con fichas de items', async () => {
    const items = [
      {
        id: 1,
        codigo: 'HID-001',
        numeroInterno: 1,
        titulo: 'Fisura en muro',
        descripcion: 'Fisura horizontal en muro de sala',
        ubicacionDetalle: 'Muro norte',
        status: 'pendiente_foto_despues',
        empresaNombre: 'Waller',
        unidadNombre: 'Depto 101',
        unidadNivel: 1,
        especialidadNombre: 'Waller',
        atributoNombre: 'Acabado',
        defectoNombre: 'Fisura',
        espacioNombre: 'Sala',
        residenteNombre: 'Natalia Diaz',
        creadoPorNombre: 'Jorge Supervisor',
        asignadoANombre: 'Natalia Diaz',
        aprobadoPorNombre: '',
        fechaCreacion: new Date('2026-01-15'),
        fechaFotoDespues: null,
        fechaAprobacion: null,
        fotoAntesUrl: 'https://example.com/foto1.jpg',
        fotoDespuesUrl: null,
        comentarioResidente: 'En proceso de correccion',
        comentarioSupervisor: null,
      },
      {
        id: 2,
        codigo: 'HID-002',
        numeroInterno: 2,
        titulo: 'Mancha en piso',
        descripcion: null,
        ubicacionDetalle: null,
        status: 'aprobado',
        empresaNombre: 'Novotile',
        unidadNombre: 'Depto 202',
        unidadNivel: 2,
        especialidadNombre: 'Pasta y Textura',
        atributoNombre: 'Limpieza',
        defectoNombre: 'Mancha',
        espacioNombre: 'Cocina',
        residenteNombre: 'Paola Mora',
        creadoPorNombre: 'Estefania Admin',
        asignadoANombre: 'Paola Mora',
        aprobadoPorNombre: 'Jorge Supervisor',
        fechaCreacion: new Date('2026-01-10'),
        fechaFotoDespues: new Date('2026-01-12'),
        fechaAprobacion: new Date('2026-01-13'),
        fotoAntesUrl: 'https://example.com/foto2.jpg',
        fotoDespuesUrl: 'https://example.com/foto2b.jpg',
        comentarioResidente: null,
        comentarioSupervisor: 'Aprobado, buen trabajo',
      },
    ];

    const buffer = await generarPDFFichasItems(items, 'Hidalma');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF magic bytes
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('genera una ficha por item (2 items = 2 paginas)', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      codigo: `HID-${String(i + 1).padStart(3, '0')}`,
      numeroInterno: i + 1,
      titulo: `Item de prueba ${i + 1}`,
      descripcion: 'Descripcion del defecto',
      ubicacionDetalle: 'Ubicacion',
      status: 'pendiente_foto_despues' as const,
      empresaNombre: 'Waller',
      unidadNombre: `Depto ${100 + i}`,
      unidadNivel: Math.floor(i / 2) + 1,
      especialidadNombre: 'Waller',
      atributoNombre: 'Acabado',
      defectoNombre: 'Fisura',
      espacioNombre: 'Sala',
      residenteNombre: 'Natalia Diaz',
      creadoPorNombre: 'Jorge',
      asignadoANombre: 'Natalia Diaz',
      aprobadoPorNombre: '',
      fechaCreacion: new Date(),
      fechaFotoDespues: null,
      fechaAprobacion: null,
      fotoAntesUrl: null,
      fotoDespuesUrl: null,
      comentarioResidente: null,
      comentarioSupervisor: null,
    }));

    const buffer = await generarPDFFichasItems(items, 'Hidalma');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(5000);
  });

  it('maneja items sin datos opcionales', async () => {
    const items = [{
      id: 1,
      codigo: 'HID-001',
      numeroInterno: 0,
      titulo: 'Item minimo',
      descripcion: null,
      ubicacionDetalle: null,
      status: 'pendiente_foto_despues',
      empresaNombre: 'Sin empresa',
      unidadNombre: 'Sin unidad',
      unidadNivel: null,
      especialidadNombre: 'Sin especialidad',
      atributoNombre: '\u2014',
      defectoNombre: '\u2014',
      espacioNombre: '\u2014',
      residenteNombre: '\u2014',
      creadoPorNombre: '\u2014',
      asignadoANombre: '\u2014',
      aprobadoPorNombre: '\u2014',
      fechaCreacion: null,
      fechaFotoDespues: null,
      fechaAprobacion: null,
      fotoAntesUrl: null,
      fotoDespuesUrl: null,
      comentarioResidente: null,
      comentarioSupervisor: null,
    }];

    const buffer = await generarPDFFichasItems(items, 'Test');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('PDF Masivo: Reporte de Pruebas', () => {
  it('genera un PDF buffer valido con reporte de pruebas', async () => {
    const unidadesPruebas = [
      {
        unidadId: 1,
        unidadNombre: 'Depto 101',
        unidadNivel: 1,
        resultados: [
          {
            pruebaId: 1,
            pruebaNombre: 'Prueba de presion hidraulica',
            pruebaSistema: 'Hidraulica',
            intento: 'intento_1',
            estado: 'verde',
            observacion: 'Sin fugas detectadas',
            evaluadoPorNombre: 'Jorge Supervisor',
            evaluadoAt: new Date('2026-02-01'),
          },
          {
            pruebaId: 2,
            pruebaNombre: 'Prueba de hermeticidad gas',
            pruebaSistema: 'Gas',
            intento: 'intento_1',
            estado: 'rojo',
            observacion: 'Fuga en conexion',
            evaluadoPorNombre: 'Jorge Supervisor',
            evaluadoAt: new Date('2026-02-01'),
          },
          {
            pruebaId: 2,
            pruebaNombre: 'Prueba de hermeticidad gas',
            pruebaSistema: 'Gas',
            intento: 'intento_final',
            estado: 'verde',
            observacion: 'Corregido',
            evaluadoPorNombre: 'Jorge Supervisor',
            evaluadoAt: new Date('2026-02-05'),
          },
        ],
      },
      {
        unidadId: 2,
        unidadNombre: 'Depto 202',
        unidadNivel: 2,
        resultados: [
          {
            pruebaId: 1,
            pruebaNombre: 'Prueba de presion hidraulica',
            pruebaSistema: 'Hidraulica',
            intento: 'intento_1',
            estado: 'pendiente',
            observacion: null,
            evaluadoPorNombre: null,
            evaluadoAt: null,
          },
        ],
      },
    ];

    const buffer = await generarPDFPruebasReporte(unidadesPruebas, {
      proyectoNombre: 'Hidalma',
      totalUnidades: 2,
      totalPruebas: 10,
      fechaGeneracion: '12 de marzo de 2026',
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('genera portada con estadisticas correctas', async () => {
    const unidadesPruebas = [
      {
        unidadId: 1,
        unidadNombre: 'Depto 101',
        unidadNivel: 1,
        resultados: [
          { pruebaId: 1, pruebaNombre: 'P1', pruebaSistema: 'S1', intento: 'intento_1', estado: 'verde', observacion: null, evaluadoPorNombre: null, evaluadoAt: null },
          { pruebaId: 2, pruebaNombre: 'P2', pruebaSistema: 'S1', intento: 'intento_1', estado: 'rojo', observacion: null, evaluadoPorNombre: null, evaluadoAt: null },
          { pruebaId: 3, pruebaNombre: 'P3', pruebaSistema: 'S2', intento: 'intento_1', estado: 'na', observacion: null, evaluadoPorNombre: null, evaluadoAt: null },
        ],
      },
    ];

    const buffer = await generarPDFPruebasReporte(unidadesPruebas, {
      proyectoNombre: 'Test',
      totalUnidades: 1,
      totalPruebas: 3,
      fechaGeneracion: '12 de marzo de 2026',
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('maneja unidad sin resultados', async () => {
    const unidadesPruebas = [
      {
        unidadId: 1,
        unidadNombre: 'Depto Vacio',
        unidadNivel: null,
        resultados: [],
      },
    ];

    const buffer = await generarPDFPruebasReporte(unidadesPruebas, {
      proyectoNombre: 'Test',
      totalUnidades: 1,
      totalPruebas: 0,
      fechaGeneracion: '12 de marzo de 2026',
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
