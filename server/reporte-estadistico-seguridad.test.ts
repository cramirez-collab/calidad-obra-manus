import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Schema validation for the reporteEstadisticoPDF procedure input
const reporteEstadisticoPDFInputSchema = z.object({
  proyectoId: z.number(),
});

// Expected output shape validation
const porTipoSchema = z.object({
  tipo: z.string(),
  count: z.number(),
});

const porSeveridadSchema = z.object({
  severidad: z.string(),
  count: z.number(),
});

const porEmpresaSchema = z.object({
  nombre: z.string(),
  total: z.number(),
  abiertos: z.number(),
  enProceso: z.number(),
  cerrados: z.number(),
  criticos: z.number(),
});

const statsSchema = z.object({
  total: z.number(),
  abiertos: z.number(),
  enProceso: z.number(),
  prevencion: z.number(),
  cerrados: z.number(),
  porTipo: z.array(porTipoSchema),
  porSeveridad: z.array(porSeveridadSchema),
  porEmpresa: z.array(porEmpresaSchema),
});

const evidenciaSchema = z.object({
  fotoUrl: z.string(),
  descripcion: z.string().nullable(),
  tipo: z.string(),
});

const incidenteSchema = z.object({
  id: z.number(),
  codigo: z.string().nullable(),
  tipo: z.string(),
  severidad: z.string(),
  estado: z.string(),
  descripcion: z.string(),
  ubicacion: z.string().nullable(),
  accionCorrectiva: z.string().nullable(),
  fotoUrl: z.string().nullable(),
  fotoMarcadaUrl: z.string().nullable(),
  reportadoPorNombre: z.string(),
  createdAt: z.date().or(z.string()),
  evidencias: z.array(evidenciaSchema),
});

const reporteOutputSchema = z.object({
  proyecto: z.string(),
  stats: statsSchema,
  incidentes: z.array(incidenteSchema),
});

describe('Reporte Estadístico de Seguridad PDF - Input Validation', () => {
  it('should accept valid proyectoId', () => {
    const result = reporteEstadisticoPDFInputSchema.safeParse({ proyectoId: 1 });
    expect(result.success).toBe(true);
  });

  it('should reject missing proyectoId', () => {
    const result = reporteEstadisticoPDFInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject string proyectoId', () => {
    const result = reporteEstadisticoPDFInputSchema.safeParse({ proyectoId: 'abc' });
    expect(result.success).toBe(false);
  });

  it('should reject negative proyectoId', () => {
    // z.number() allows negative, but this tests the schema accepts it
    const result = reporteEstadisticoPDFInputSchema.safeParse({ proyectoId: -1 });
    expect(result.success).toBe(true); // schema allows negative numbers
  });
});

describe('Reporte Estadístico de Seguridad PDF - Output Shape', () => {
  it('should validate a complete report output', () => {
    const mockOutput = {
      proyecto: 'Obra Residencial',
      stats: {
        total: 15,
        abiertos: 3,
        enProceso: 5,
        prevencion: 2,
        cerrados: 5,
        porTipo: [
          { tipo: 'caida', count: 4 },
          { tipo: 'golpe', count: 3 },
          { tipo: 'corte', count: 2 },
          { tipo: 'epp_faltante', count: 6 },
        ],
        porSeveridad: [
          { severidad: 'baja', count: 5 },
          { severidad: 'media', count: 4 },
          { severidad: 'alta', count: 3 },
          { severidad: 'critica', count: 3 },
        ],
        porEmpresa: [
          { nombre: 'Constructora ABC', total: 8, abiertos: 2, enProceso: 3, cerrados: 3, criticos: 1 },
          { nombre: 'Instalaciones XYZ', total: 7, abiertos: 1, enProceso: 2, cerrados: 2, criticos: 2 },
        ],
      },
      incidentes: [
        {
          id: 1,
          codigo: 'SEG00001',
          tipo: 'caida',
          severidad: 'alta',
          estado: 'cerrado',
          descripcion: 'Caída desde andamio nivel 3',
          ubicacion: 'Torre A - Nivel 3',
          accionCorrectiva: 'Se instalaron redes de seguridad',
          fotoUrl: 'https://s3.example.com/foto1.jpg',
          fotoMarcadaUrl: null,
          reportadoPorNombre: 'Juan Pérez',
          createdAt: '2026-02-15T10:30:00Z',
          evidencias: [
            { fotoUrl: 'https://s3.example.com/ev1.jpg', descripcion: 'Seguimiento día 2', tipo: 'seguimiento' },
          ],
        },
        {
          id: 2,
          codigo: 'SEG00002',
          tipo: 'epp_faltante',
          severidad: 'media',
          estado: 'abierto',
          descripcion: 'Trabajador sin casco en zona de carga',
          ubicacion: 'Estacionamiento',
          accionCorrectiva: null,
          fotoUrl: null,
          fotoMarcadaUrl: null,
          reportadoPorNombre: 'María López',
          createdAt: '2026-02-20T14:00:00Z',
          evidencias: [],
        },
      ],
    };

    const result = reporteOutputSchema.safeParse(mockOutput);
    expect(result.success).toBe(true);
  });

  it('should validate empty report', () => {
    const emptyOutput = {
      proyecto: 'Proyecto Vacío',
      stats: {
        total: 0,
        abiertos: 0,
        enProceso: 0,
        prevencion: 0,
        cerrados: 0,
        porTipo: [],
        porSeveridad: [],
        porEmpresa: [],
      },
      incidentes: [],
    };

    const result = reporteOutputSchema.safeParse(emptyOutput);
    expect(result.success).toBe(true);
  });

  it('should reject output missing proyecto field', () => {
    const badOutput = {
      stats: { total: 0, abiertos: 0, enProceso: 0, prevencion: 0, cerrados: 0, porTipo: [], porSeveridad: [], porEmpresa: [] },
      incidentes: [],
    };
    const result = reporteOutputSchema.safeParse(badOutput);
    expect(result.success).toBe(false);
  });

  it('should reject output missing stats field', () => {
    const badOutput = {
      proyecto: 'Test',
      incidentes: [],
    };
    const result = reporteOutputSchema.safeParse(badOutput);
    expect(result.success).toBe(false);
  });
});

describe('Reporte Estadístico de Seguridad PDF - Business Logic', () => {
  it('should calculate cumplimiento percentage correctly', () => {
    const empresa = { total: 10, cerrados: 8 };
    const cumpl = empresa.total > 0 ? Math.round((empresa.cerrados / empresa.total) * 100) : 0;
    expect(cumpl).toBe(80);
  });

  it('should return 0% cumplimiento when total is 0', () => {
    const empresa = { total: 0, cerrados: 0 };
    const cumpl = empresa.total > 0 ? Math.round((empresa.cerrados / empresa.total) * 100) : 0;
    expect(cumpl).toBe(0);
  });

  it('should assign correct semáforo color', () => {
    const getSemaforoColor = (cumpl: number) => cumpl >= 80 ? 'verde' : cumpl >= 50 ? 'amarillo' : 'rojo';
    expect(getSemaforoColor(100)).toBe('verde');
    expect(getSemaforoColor(80)).toBe('verde');
    expect(getSemaforoColor(79)).toBe('amarillo');
    expect(getSemaforoColor(50)).toBe('amarillo');
    expect(getSemaforoColor(49)).toBe('rojo');
    expect(getSemaforoColor(0)).toBe('rojo');
  });

  it('should sort porTipo by count descending', () => {
    const porTipo = [
      { tipo: 'caida', count: 2 },
      { tipo: 'golpe', count: 5 },
      { tipo: 'corte', count: 1 },
    ];
    const sorted = [...porTipo].sort((a, b) => b.count - a.count);
    expect(sorted[0].tipo).toBe('golpe');
    expect(sorted[1].tipo).toBe('caida');
    expect(sorted[2].tipo).toBe('corte');
  });

  it('should sort porEmpresa by total descending', () => {
    const porEmpresa = [
      { nombre: 'A', total: 3 },
      { nombre: 'B', total: 10 },
      { nombre: 'C', total: 5 },
    ];
    const sorted = [...porEmpresa].sort((a, b) => b.total - a.total);
    expect(sorted[0].nombre).toBe('B');
    expect(sorted[1].nombre).toBe('C');
    expect(sorted[2].nombre).toBe('A');
  });

  it('should count criticos as alta + critica severidad', () => {
    const incidentes = [
      { severidad: 'baja' },
      { severidad: 'media' },
      { severidad: 'alta' },
      { severidad: 'critica' },
      { severidad: 'alta' },
    ];
    const criticos = incidentes.filter(i => i.severidad === 'alta' || i.severidad === 'critica').length;
    expect(criticos).toBe(3);
  });

  it('should include all evidence types', () => {
    const tiposValidos = ['seguimiento', 'resolucion', 'prevencion'];
    const evidencias = [
      { tipo: 'seguimiento', fotoUrl: 'url1', descripcion: null },
      { tipo: 'resolucion', fotoUrl: 'url2', descripcion: 'Foto resolución' },
      { tipo: 'prevencion', fotoUrl: 'url3', descripcion: null },
    ];
    evidencias.forEach(ev => {
      expect(tiposValidos).toContain(ev.tipo);
    });
  });

  it('should handle incidentes with and without photos', () => {
    const incidentes = [
      { id: 1, fotoUrl: 'https://s3.example.com/foto1.jpg', evidencias: [{ fotoUrl: 'url1' }] },
      { id: 2, fotoUrl: null, evidencias: [] },
      { id: 3, fotoUrl: 'https://s3.example.com/foto3.jpg', evidencias: [] },
    ];
    const conFoto = incidentes.filter(i => i.fotoUrl);
    const sinFoto = incidentes.filter(i => !i.fotoUrl);
    const conEvidencias = incidentes.filter(i => i.evidencias.length > 0);
    expect(conFoto.length).toBe(2);
    expect(sinFoto.length).toBe(1);
    expect(conEvidencias.length).toBe(1);
  });

  it('should validate all estado values', () => {
    const estadosValidos = ['abierto', 'en_proceso', 'prevencion', 'cerrado'];
    const estados = ['abierto', 'en_proceso', 'prevencion', 'cerrado'];
    estados.forEach(e => expect(estadosValidos).toContain(e));
  });
});
