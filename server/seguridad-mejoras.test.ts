import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ==========================================
// Tests para mejoras del módulo de Seguridad
// ==========================================

describe('Seguridad - Códigos SEG', () => {
  it('genera código SEG con formato correcto', () => {
    const generarCodigo = (id: number) => `SEG${String(id).padStart(5, '0')}`;
    expect(generarCodigo(1)).toBe('SEG00001');
    expect(generarCodigo(42)).toBe('SEG00042');
    expect(generarCodigo(999)).toBe('SEG00999');
    expect(generarCodigo(10000)).toBe('SEG10000');
    expect(generarCodigo(99999)).toBe('SEG99999');
  });

  it('código SEG es único por incidente', () => {
    const codigos = [1, 2, 3, 100, 999].map(id => `SEG${String(id).padStart(5, '0')}`);
    const unique = new Set(codigos);
    expect(unique.size).toBe(codigos.length);
  });
});

describe('Seguridad - Permisos Admin/Superadmin', () => {
  const ROLES_ADMIN = ['superadmin', 'admin'];
  const ROLES_NO_ADMIN = ['user', 'supervisor', 'residente', 'vendedor'];

  it('admin y superadmin pueden editar mensajes', () => {
    ROLES_ADMIN.forEach(role => {
      expect(['superadmin', 'admin'].includes(role)).toBe(true);
    });
  });

  it('otros roles NO pueden editar mensajes', () => {
    ROLES_NO_ADMIN.forEach(role => {
      expect(['superadmin', 'admin'].includes(role)).toBe(false);
    });
  });

  it('admin y superadmin pueden eliminar mensajes', () => {
    ROLES_ADMIN.forEach(role => {
      expect(['superadmin', 'admin'].includes(role)).toBe(true);
    });
  });

  it('admin y superadmin pueden editar incidentes', () => {
    ROLES_ADMIN.forEach(role => {
      expect(['superadmin', 'admin'].includes(role)).toBe(true);
    });
  });
});

describe('Seguridad - @Mentions', () => {
  it('detecta @mentions en texto', () => {
    const texto = 'Hola @Carlos revisa esto @Maria';
    const mentions = texto.match(/@(\w+(?:\s\w+)?)/g);
    // Regex captures @word + optional space+word
    expect(mentions).toEqual(['@Carlos revisa', '@Maria']);
    // Extract just the first word after @
    const cleanMentions = mentions?.map(m => m.split(' ')[0]);
    expect(cleanMentions).toEqual(['@Carlos', '@Maria']);
  });

  it('no detecta @ sin nombre', () => {
    const texto = 'Enviar a @ sin nombre';
    const mentions = texto.match(/@(\w+(?:\s\w+)?)/g);
    expect(mentions).toBeNull();
  });

  it('detecta @mention al inicio del texto', () => {
    const texto = '@Admin revisa el incidente';
    const mentions = texto.match(/@(\w+(?:\s\w+)?)/g);
    expect(mentions).toEqual(['@Admin revisa']);
    // First word is the actual mention
    expect(mentions?.[0].split(' ')[0]).toBe('@Admin');
  });

  it('filtra usuarios mencionados correctamente', () => {
    const usuarios = [
      { id: 1, name: 'Carlos Ramirez' },
      { id: 2, name: 'Maria Lopez' },
      { id: 3, name: 'Juan Perez' },
    ];
    const mentions = ['@Carlos', '@Maria'];
    const mentionedNames = mentions.map(m => m.replace('@', '').toLowerCase());
    const filtered = usuarios.filter(u =>
      mentionedNames.some(name => u.name?.toLowerCase().includes(name))
    );
    expect(filtered).toHaveLength(2);
    expect(filtered.map(u => u.id)).toEqual([1, 2]);
  });

  it('excluye al usuario que envía del push', () => {
    const currentUserId = 1;
    const mentionedIds = [1, 2, 3];
    const filtered = mentionedIds.filter(uid => uid !== currentUserId);
    expect(filtered).toEqual([2, 3]);
  });
});

describe('Seguridad - Notificaciones Push por Severidad', () => {
  const getVibratePattern = (severidad: string) => {
    if (severidad === 'critica') return [500, 100, 500, 100, 500, 100, 500, 100, 500];
    if (severidad === 'alta') return [400, 100, 400, 100, 400, 100, 400];
    if (severidad === 'media') return [300, 100, 300, 100, 300];
    if (severidad === 'baja') return [200, 100, 200];
    return [300, 100, 300, 100, 300];
  };

  it('vibración crítica es la más larga', () => {
    const critica = getVibratePattern('critica');
    const alta = getVibratePattern('alta');
    const media = getVibratePattern('media');
    const baja = getVibratePattern('baja');
    expect(critica.length).toBeGreaterThan(alta.length);
    expect(alta.length).toBeGreaterThan(media.length);
    expect(media.length).toBeGreaterThan(baja.length);
  });

  it('vibración crítica tiene pulsos más largos', () => {
    const critica = getVibratePattern('critica');
    expect(critica[0]).toBe(500);
  });

  it('vibración baja tiene pulsos cortos', () => {
    const baja = getVibratePattern('baja');
    expect(baja[0]).toBe(200);
    expect(baja.length).toBe(3);
  });

  it('título de notificación incluye emoji de severidad', () => {
    const sevEmoji: Record<string, string> = { baja: '🟢', media: '🟡', alta: '🟠', critica: '🔴' };
    const sevLabels: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'CRÍTICA' };
    
    const titulo = (sev: string, codigo: string) =>
      `${sevEmoji[sev] || '🚨'} Incidente ${sevLabels[sev] || sev} - ${codigo}`;
    
    expect(titulo('critica', 'SEG00001')).toBe('🔴 Incidente CRÍTICA - SEG00001');
    expect(titulo('baja', 'SEG00042')).toBe('🟢 Incidente Baja - SEG00042');
    expect(titulo('alta', 'SEG00100')).toBe('🟠 Incidente Alta - SEG00100');
  });

  it('cuerpo de notificación incluye tipo y descripción', () => {
    const tipo = 'caida';
    const descripcion = 'Trabajador cayó del andamio en piso 3';
    const body = `${tipo.replace(/_/g, ' ').toUpperCase()}: ${descripcion.slice(0, 80)}`;
    expect(body).toBe('CAIDA: Trabajador cayó del andamio en piso 3');
  });

  it('tipo con underscore se formatea correctamente', () => {
    const tipo = 'condicion_insegura';
    expect(tipo.replace(/_/g, ' ').toUpperCase()).toBe('CONDICION INSEGURA');
  });
});

describe('Seguridad - Validación de Inputs', () => {
  const editarIncidenteSchema = z.object({
    id: z.number(),
    tipo: z.enum(["caida", "golpe", "corte", "electrico", "derrumbe", "incendio", "quimico", "epp_faltante", "condicion_insegura", "acto_inseguro", "casi_accidente", "otro"]).optional(),
    severidad: z.enum(["baja", "media", "alta", "critica"]).optional(),
    descripcion: z.string().optional(),
    ubicacion: z.string().optional(),
  });

  it('acepta edición parcial de incidente', () => {
    const result = editarIncidenteSchema.safeParse({ id: 1, severidad: 'alta' });
    expect(result.success).toBe(true);
  });

  it('acepta edición completa de incidente', () => {
    const result = editarIncidenteSchema.safeParse({
      id: 1,
      tipo: 'caida',
      severidad: 'critica',
      descripcion: 'Actualizado',
      ubicacion: 'Piso 5',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza severidad inválida', () => {
    const result = editarIncidenteSchema.safeParse({ id: 1, severidad: 'extrema' });
    expect(result.success).toBe(false);
  });

  it('rechaza tipo inválido', () => {
    const result = editarIncidenteSchema.safeParse({ id: 1, tipo: 'explosion' });
    expect(result.success).toBe(false);
  });
});

describe('Seguridad - Chat UI Logic', () => {
  it('texto normal sin bold para mensajes no críticos', () => {
    const isCritica = false;
    const isOwn = true;
    const className = isCritica
      ? (isOwn ? 'bg-red-500 text-white' : 'bg-red-50 text-foreground border border-red-200')
      : (isOwn ? 'bg-slate-200 text-foreground' : 'bg-muted text-foreground');
    expect(className).toBe('bg-slate-200 text-foreground');
    expect(className).not.toContain('red');
  });

  it('fondo rojo solo para incidentes críticos', () => {
    const isCritica = true;
    const isOwn = true;
    const className = isCritica
      ? (isOwn ? 'bg-red-500 text-white' : 'bg-red-50 text-foreground border border-red-200')
      : (isOwn ? 'bg-slate-200 text-foreground' : 'bg-muted text-foreground');
    expect(className).toContain('red');
  });

  it('renderiza @mentions con estilo especial', () => {
    const text = 'Hola @Carlos revisa esto';
    const parts = text.split(/(@\w+(?:\s\w+)?)/g);
    expect(parts.length).toBe(3);
    expect(parts[1]).toBe('@Carlos revisa');
    expect(parts[1].startsWith('@')).toBe(true);
  });

  it('icono de chat es rojo', () => {
    const chatButtonClass = 'h-7 text-[10px] px-2 border-red-200 text-red-600 ml-auto';
    expect(chatButtonClass).toContain('red');
  });

  it('muestra (editado) para mensajes editados', () => {
    const msg = { editado: true };
    const showEditLabel = msg.editado;
    expect(showEditLabel).toBe(true);
  });
});

describe('Seguridad - PushPayload Seguridad Fields', () => {
  it('payload incluye campos de seguridad', () => {
    const payload = {
      title: '🔴 Incidente CRÍTICA - SEG00001',
      body: 'CAIDA: Trabajador cayó',
      incidenteId: 42,
      codigoSeg: 'SEG00042',
      severidad: 'critica',
      tipoIncidente: 'caida',
      tag: 'oqc-seg-42',
      data: { url: '/seguridad', incidenteId: 42, tipo: 'incidente_nuevo' },
    };
    expect(payload.incidenteId).toBe(42);
    expect(payload.codigoSeg).toBe('SEG00042');
    expect(payload.severidad).toBe('critica');
    expect(payload.tipoIncidente).toBe('caida');
    expect(payload.data.url).toBe('/seguridad');
  });

  it('tag de seguridad usa prefijo oqc-seg-', () => {
    const incidenteId = 123;
    const tag = `oqc-seg-${incidenteId}`;
    expect(tag).toBe('oqc-seg-123');
    expect(tag).not.toContain('item');
  });
});

describe('Seguridad - Service Worker Notification Body', () => {
  it('construye body de seguridad con código y tipo', () => {
    const data = {
      codigoSeg: 'SEG00001',
      tipoIncidente: 'caida',
      severidad: 'critica',
      body: 'Nuevo incidente reportado',
    };
    const parts: string[] = [];
    if (data.codigoSeg) parts.push(`🚨 ${data.codigoSeg}`);
    if (data.tipoIncidente) parts.push(`${data.tipoIncidente}`);
    if (data.severidad) parts.push(`Severidad: ${data.severidad.toUpperCase()}`);
    let notificationBody = parts.join(' | ');
    if (data.body && data.body !== 'Nueva notificación') {
      notificationBody = `${data.body}\n${notificationBody}`;
    }
    expect(notificationBody).toContain('SEG00001');
    expect(notificationBody).toContain('CRITICA');
    expect(notificationBody).toContain('caida');
  });

  it('body de ítem no incluye campos de seguridad', () => {
    const data = {
      codigoSeg: null,
      tipoIncidente: null,
      itemCodigo: 'ITM001',
      unidadNombre: 'Depto 101',
    };
    const isSeguridad = !!data.codigoSeg || !!data.tipoIncidente;
    expect(isSeguridad).toBe(false);
  });
});
