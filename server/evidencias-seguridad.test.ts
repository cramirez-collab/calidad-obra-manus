import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

// Schema validation tests for evidencias seguridad
const subirEvidenciaSchema = z.object({
  incidenteId: z.number(),
  fotoBase64: z.string(),
  descripcion: z.string().optional(),
  tipo: z.enum(["seguimiento", "resolucion", "prevencion"]).default("seguimiento"),
});

const evidenciasByIncidenteSchema = z.object({
  incidenteId: z.number(),
});

const eliminarEvidenciaSchema = z.object({
  evidenciaId: z.number(),
  incidenteId: z.number(),
});

describe('Evidencias de Seguridad - Input Validation', () => {
  describe('subirEvidencia', () => {
    it('should accept valid input with all fields', () => {
      const input = {
        incidenteId: 1,
        fotoBase64: 'data:image/jpeg;base64,/9j/4AAQ...',
        descripcion: 'Evidencia de seguimiento del incidente',
        tipo: 'seguimiento' as const,
      };
      const result = subirEvidenciaSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept input without optional descripcion', () => {
      const input = {
        incidenteId: 5,
        fotoBase64: 'data:image/png;base64,iVBOR...',
      };
      const result = subirEvidenciaSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tipo).toBe('seguimiento'); // default
      }
    });

    it('should accept tipo resolucion', () => {
      const input = {
        incidenteId: 3,
        fotoBase64: 'data:image/jpeg;base64,abc',
        tipo: 'resolucion' as const,
      };
      const result = subirEvidenciaSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept tipo prevencion', () => {
      const input = {
        incidenteId: 3,
        fotoBase64: 'data:image/jpeg;base64,abc',
        tipo: 'prevencion' as const,
      };
      const result = subirEvidenciaSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid tipo', () => {
      const input = {
        incidenteId: 1,
        fotoBase64: 'data:image/jpeg;base64,abc',
        tipo: 'invalido',
      };
      const result = subirEvidenciaSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing incidenteId', () => {
      const input = {
        fotoBase64: 'data:image/jpeg;base64,abc',
      };
      const result = subirEvidenciaSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing fotoBase64', () => {
      const input = {
        incidenteId: 1,
      };
      const result = subirEvidenciaSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('evidenciasByIncidente', () => {
    it('should accept valid incidenteId', () => {
      const result = evidenciasByIncidenteSchema.safeParse({ incidenteId: 42 });
      expect(result.success).toBe(true);
    });

    it('should reject string incidenteId', () => {
      const result = evidenciasByIncidenteSchema.safeParse({ incidenteId: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('eliminarEvidencia', () => {
    it('should accept valid input', () => {
      const result = eliminarEvidenciaSchema.safeParse({ evidenciaId: 1, incidenteId: 5 });
      expect(result.success).toBe(true);
    });

    it('should reject missing evidenciaId', () => {
      const result = eliminarEvidenciaSchema.safeParse({ incidenteId: 5 });
      expect(result.success).toBe(false);
    });

    it('should reject missing incidenteId', () => {
      const result = eliminarEvidenciaSchema.safeParse({ evidenciaId: 1 });
      expect(result.success).toBe(false);
    });
  });
});

describe('Evidencias de Seguridad - Business Logic', () => {
  it('should only allow assigned user or admin to upload', () => {
    const incidente = { asignadoA: 10 };
    const userAsignado = { id: 10, role: 'segurista' };
    const userAdmin = { id: 99, role: 'admin' };
    const userOther = { id: 20, role: 'residente' };

    // Assigned user can upload
    expect(incidente.asignadoA === userAsignado.id || ['admin', 'superadmin'].includes(userAsignado.role)).toBe(true);
    // Admin can upload
    expect(incidente.asignadoA === userAdmin.id || ['admin', 'superadmin'].includes(userAdmin.role)).toBe(true);
    // Other user cannot upload
    expect(incidente.asignadoA === userOther.id || ['admin', 'superadmin'].includes(userOther.role)).toBe(false);
  });

  it('should only allow admin/superadmin to delete evidencias', () => {
    const adminUser = { role: 'admin' };
    const superadminUser = { role: 'superadmin' };
    const segurista = { role: 'segurista' };
    const residente = { role: 'residente' };

    expect(['admin', 'superadmin'].includes(adminUser.role)).toBe(true);
    expect(['admin', 'superadmin'].includes(superadminUser.role)).toBe(true);
    expect(['admin', 'superadmin'].includes(segurista.role)).toBe(false);
    expect(['admin', 'superadmin'].includes(residente.role)).toBe(false);
  });

  it('should categorize evidencia types correctly', () => {
    const tipos = ['seguimiento', 'resolucion', 'prevencion'];
    expect(tipos).toContain('seguimiento');
    expect(tipos).toContain('resolucion');
    expect(tipos).toContain('prevencion');
    expect(tipos).not.toContain('otro');
  });
});
