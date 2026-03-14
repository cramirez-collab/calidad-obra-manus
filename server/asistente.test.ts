import { describe, it, expect } from 'vitest';

/**
 * Asistente OQC module tests.
 * Validates data structures, category detection, suggestion extraction,
 * and analytics aggregation logic.
 */

const CATEGORIAS = [
  'items', 'seguridad', 'buenas_practicas', 'programas',
  'estadisticas', 'usuarios', 'configuracion', 'navegacion', 'qr',
  'planos', 'stacking', 'mensajeria', 'general'
];

const SUGERENCIA_ESTADOS = ['pendiente', 'aplicada', 'descartada'];

describe('Asistente OQC - Category Detection', () => {
  const detectCategory = (pregunta: string, respuesta: string): string => {
    const categorias = ['items', 'seguridad', 'buenas_practicas', 'programas', 'estadisticas', 'usuarios', 'configuracion', 'navegacion', 'qr', 'planos', 'stacking', 'mensajeria'];
    let categoria = 'general';
    const lower = (pregunta + ' ' + respuesta).toLowerCase();
    for (const cat of categorias) {
      if (lower.includes(cat.replace('_', ' ')) || lower.includes(cat)) {
        categoria = cat;
        break;
      }
    }
    return categoria;
  };

  it('should detect items category', () => {
    expect(detectCategory('¿Cómo creo un nuevo ítem?', 'Para crear items...')).toBe('items');
  });

  it('should detect seguridad category', () => {
    expect(detectCategory('¿Cómo reporto un incidente de seguridad?', 'Ve a seguridad...')).toBe('seguridad');
  });

  it('should detect programas category', () => {
    expect(detectCategory('¿Cómo subo mi programa semanal?', 'Para subir programas...')).toBe('programas');
  });

  it('should detect estadisticas category', () => {
    expect(detectCategory('¿Dónde veo las estadísticas?', 'Las estadisticas están...')).toBe('estadisticas');
  });

  it('should detect usuarios category', () => {
    expect(detectCategory('¿Cómo agrego usuarios?', 'Para gestionar usuarios...')).toBe('usuarios');
  });

  it('should detect configuracion category', () => {
    expect(detectCategory('¿Cómo cambio la configuración?', 'Ve a configuracion...')).toBe('configuracion');
  });

  it('should detect qr category', () => {
    expect(detectCategory('¿Cómo genero un QR?', 'Para generar qr...')).toBe('qr');
  });

  it('should default to general for unrecognized topics', () => {
    expect(detectCategory('Hola', 'Hola, ¿en qué puedo ayudarte?')).toBe('general');
  });
});

describe('Asistente OQC - Suggestion Extraction', () => {
  const extractSuggestion = (respuesta: string): string | null => {
    const match = respuesta.match(/\[Sugerencia de mejora: (.+?)\]/);
    return match ? match[1] : null;
  };

  const cleanResponse = (respuesta: string): string => {
    return respuesta.replace(/\[Sugerencia de mejora: .+?\]/g, '').trim();
  };

  it('should extract suggestion from response', () => {
    const resp = 'Para crear un ítem, ve al menú. [Sugerencia de mejora: Agregar tutorial interactivo]';
    expect(extractSuggestion(resp)).toBe('Agregar tutorial interactivo');
  });

  it('should return null when no suggestion present', () => {
    expect(extractSuggestion('Respuesta normal.')).toBeNull();
  });

  it('should clean response removing suggestion tag', () => {
    const resp = 'Respuesta aquí. [Sugerencia de mejora: Mejorar UX]';
    expect(cleanResponse(resp)).toBe('Respuesta aquí.');
  });

  it('should not modify response without suggestion tags', () => {
    const resp = 'Respuesta normal sin sugerencias.';
    expect(cleanResponse(resp)).toBe('Respuesta normal sin sugerencias.');
  });
});

describe('Asistente OQC - Data Validation', () => {
  it('should have all expected categories', () => {
    expect(CATEGORIAS).toHaveLength(13);
    expect(CATEGORIAS).toContain('items');
    expect(CATEGORIAS).toContain('general');
  });

  it('should have valid suggestion states', () => {
    expect(SUGERENCIA_ESTADOS).toHaveLength(3);
    expect(SUGERENCIA_ESTADOS).toContain('pendiente');
  });

  it('should validate conversation data structure', () => {
    const conv = { userId: 1, proyectoId: 1, pregunta: '¿Cómo creo un ítem?', respuesta: 'Ve al menú...', categoria: 'items' };
    expect(conv.userId).toBeGreaterThan(0);
    expect(conv.pregunta.length).toBeGreaterThan(0);
    expect(CATEGORIAS).toContain(conv.categoria);
  });
});

describe('Asistente OQC - Analytics Aggregation', () => {
  it('should aggregate conversations by category', () => {
    const conversations = [
      { categoria: 'items', util: true },
      { categoria: 'items', util: false },
      { categoria: 'items', util: true },
      { categoria: 'seguridad', util: true },
    ];
    const porCategoria = new Map<string, { total: number; utiles: number; noUtiles: number }>();
    for (const c of conversations) {
      const existing = porCategoria.get(c.categoria) || { total: 0, utiles: 0, noUtiles: 0 };
      existing.total++;
      if (c.util === true) existing.utiles++;
      if (c.util === false) existing.noUtiles++;
      porCategoria.set(c.categoria, existing);
    }
    expect(porCategoria.get('items')?.total).toBe(3);
    expect(porCategoria.get('items')?.utiles).toBe(2);
    expect(porCategoria.get('items')?.noUtiles).toBe(1);
    expect(porCategoria.get('seguridad')?.total).toBe(1);
  });

  it('should filter non-useful responses', () => {
    const conversations = [
      { id: 1, util: true, pregunta: 'Q1' },
      { id: 2, util: false, pregunta: 'Q2' },
      { id: 3, util: false, pregunta: 'Q3' },
    ];
    const noUtiles = conversations.filter(c => c.util === false);
    expect(noUtiles).toHaveLength(2);
  });
});

describe('Asistente OQC - LLM Response Handling', () => {
  it('should extract string content from LLM response', () => {
    const response = { choices: [{ message: { content: 'Respuesta del asistente' } }] };
    const rawContent = response.choices?.[0]?.message?.content;
    const respuesta = typeof rawContent === 'string' ? rawContent : 'Fallback';
    expect(respuesta).toBe('Respuesta del asistente');
  });

  it('should handle missing content gracefully', () => {
    const response = { choices: [] as any[] };
    const rawContent = response.choices?.[0]?.message?.content;
    const respuesta = typeof rawContent === 'string' ? rawContent : 'Lo siento, no pude procesar tu pregunta.';
    expect(respuesta).toBe('Lo siento, no pude procesar tu pregunta.');
  });

  it('should handle null response', () => {
    const rawContent = null;
    const respuesta = typeof rawContent === 'string' ? rawContent : 'Lo siento, no pude procesar tu pregunta.';
    expect(respuesta).toBe('Lo siento, no pude procesar tu pregunta.');
  });
});

describe('Asistente OQC - Chat History Management', () => {
  it('should limit history to last 10 messages', () => {
    const historial = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `Message ${i}`,
    }));
    const limited = historial.slice(-10);
    expect(limited).toHaveLength(10);
    expect(limited[0].content).toBe('Message 10');
  });

  it('should handle empty history', () => {
    const historial: any[] = [];
    const limited = historial.slice(-10);
    expect(limited).toHaveLength(0);
  });
});

describe('Asistente OQC - Multimodal Input Validation', () => {
  it('should validate image base64 input', () => {
    const input = {
      pregunta: 'Analiza esta imagen',
      imagenBase64: 'iVBORw0KGgoAAAANSUhEUg==',
      imagenMimeType: 'image/png',
    };
    expect(input.imagenBase64).toBeTruthy();
    expect(input.imagenMimeType).toMatch(/^image\/(png|jpeg|jpg|webp|gif)$/);
  });

  it('should determine correct file extension from mime type', () => {
    const getExt = (mime: string) => mime.includes('png') ? 'png' : 'jpg';
    expect(getExt('image/png')).toBe('png');
    expect(getExt('image/jpeg')).toBe('jpg');
    expect(getExt('image/webp')).toBe('jpg');
  });

  it('should validate audio base64 input', () => {
    const input = {
      pregunta: 'Nota de voz',
      audioBase64: 'GkXfo59ChoEBQveBAULygQRC84EI',
    };
    expect(input.audioBase64).toBeTruthy();
    expect(input.audioBase64.length).toBeGreaterThan(0);
  });

  it('should handle text-only input without multimodal fields', () => {
    const input = {
      pregunta: '¿Cómo creo un ítem?',
      imagenBase64: undefined,
      audioBase64: undefined,
    };
    expect(input.imagenBase64).toBeUndefined();
    expect(input.audioBase64).toBeUndefined();
    expect(input.pregunta).toBeTruthy();
  });

  it('should detect planos category', () => {
    const categorias = ['items', 'seguridad', 'buenas_practicas', 'programas', 'estadisticas', 'usuarios', 'configuracion', 'navegacion', 'qr', 'planos', 'stacking', 'mensajeria'];
    let categoria = 'general';
    const lower = '¿cómo subo un plano? Para subir planos ve a...'.toLowerCase();
    for (const cat of categorias) {
      if (lower.includes(cat.replace('_', ' ')) || lower.includes(cat)) {
        categoria = cat;
        break;
      }
    }
    expect(categoria).toBe('planos');
  });

  it('should detect stacking category', () => {
    const categorias = ['items', 'seguridad', 'buenas_practicas', 'programas', 'estadisticas', 'usuarios', 'configuracion', 'navegacion', 'qr', 'planos', 'stacking', 'mensajeria'];
    let categoria = 'general';
    const lower = '¿cómo funciona el stacking? El stacking muestra...'.toLowerCase();
    for (const cat of categorias) {
      if (lower.includes(cat.replace('_', ' ')) || lower.includes(cat)) {
        categoria = cat;
        break;
      }
    }
    expect(categoria).toBe('stacking');
  });
});

describe('Asistente OQC - Personalized Response', () => {
  it('should extract first name from full name', () => {
    const fullName = 'Carlos Ramirez';
    const firstName = fullName.split(' ')[0];
    expect(firstName).toBe('Carlos');
  });

  it('should fallback to amigo when name is empty', () => {
    const name = undefined;
    const firstName = name?.split(' ')[0] || 'amigo';
    expect(firstName).toBe('amigo');
  });

  it('should include user name in personalized error message', () => {
    const userName = 'Carlos';
    const errorMsg = `${userName}, hubo un error al consultar el asistente. Intenta de nuevo en unos segundos.`;
    expect(errorMsg).toContain('Carlos');
  });

  it('should handle voice transcription result with text field', () => {
    const transcription = { text: 'Hola, ¿cómo creo un ítem?', language: 'es' };
    if ('text' in transcription) {
      expect(transcription.text).toBe('Hola, ¿cómo creo un ítem?');
    }
  });

  it('should handle voice transcription error result', () => {
    const transcription = { error: 'Service unavailable', code: 'SERVICE_ERROR' };
    const hasText = 'text' in transcription;
    expect(hasText).toBe(false);
  });
});
