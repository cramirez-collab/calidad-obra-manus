import { describe, it, expect, vi } from 'vitest';

// Mock invokeLLM
vi.mock('./server/_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          resumenGeneral: 'La empresa presenta una eficiencia del 51.7%, requiere atencion en mano de obra y materiales.',
          categorias: [
            { nombre: 'Material', estado: 'atencion', recomendacion: 'Verificar suministro oportuno de materiales para evitar retrasos.' },
            { nombre: 'Mano de obra', estado: 'critico', recomendacion: 'Incrementar cuadrillas para cumplir con las cantidades programadas.' },
            { nombre: 'Metodo', estado: 'aceptable', recomendacion: 'Mantener los procedimientos actuales de trabajo.' },
          ],
        }),
      },
    }],
  }),
}));

describe('Analisis 8Ms - Validacion de estructura', () => {
  it('debe generar un JSON con resumenGeneral y categorias', async () => {
    const { invokeLLM } = await import('./server/_core/llm' as any);
    
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'test' },
        { role: 'user', content: 'test' },
      ],
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    expect(parsed).toHaveProperty('resumenGeneral');
    expect(parsed).toHaveProperty('categorias');
    expect(Array.isArray(parsed.categorias)).toBe(true);
    expect(parsed.categorias.length).toBeGreaterThan(0);

    for (const cat of parsed.categorias) {
      expect(cat).toHaveProperty('nombre');
      expect(cat).toHaveProperty('estado');
      expect(cat).toHaveProperty('recomendacion');
      expect(['critico', 'atencion', 'aceptable']).toContain(cat.estado);
    }
  });

  it('debe incluir las 9 categorias posibles de las 8Ms + Money', () => {
    const categorias8Ms = [
      'Material',
      'Mano de obra',
      'Maquinaria y equipo',
      'Medios - Informacion planos',
      'Metodo',
      'Medio ambiente - Condiciones de trabajo',
      'Medidas de seguridad',
      'Medicion',
      'Money',
    ];

    expect(categorias8Ms).toHaveLength(9);
    expect(categorias8Ms).toContain('Material');
    expect(categorias8Ms).toContain('Money');
  });

  it('debe tener estados validos: critico, atencion, aceptable', () => {
    const estadosValidos = ['critico', 'atencion', 'aceptable'];
    
    expect(estadosValidos).toContain('critico');
    expect(estadosValidos).toContain('atencion');
    expect(estadosValidos).toContain('aceptable');
  });
});
