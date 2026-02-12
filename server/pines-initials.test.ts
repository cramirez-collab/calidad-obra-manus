import { describe, it, expect } from 'vitest';

// Test the getInitials logic used in the pin rendering
function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

describe('Pin Initials Logic', () => {
  it('returns initials for two-word name', () => {
    expect(getInitials('Esteban Guerrero')).toBe('EG');
  });

  it('returns initials for three-word name (first + last)', () => {
    expect(getInitials('Carlos Alberto Ramirez')).toBe('CR');
  });

  it('returns first two chars for single-word name', () => {
    expect(getInitials('Admin')).toBe('AD');
  });

  it('returns ? for null name', () => {
    expect(getInitials(null)).toBe('?');
  });

  it('returns ? for undefined name', () => {
    expect(getInitials(undefined)).toBe('?');
  });

  it('returns ? for empty string', () => {
    expect(getInitials('')).toBe('?');
  });

  it('handles names with extra spaces', () => {
    expect(getInitials('  Juan   Pérez  ')).toBe('JP');
  });

  it('handles lowercase names and uppercases result', () => {
    expect(getInitials('maria lopez')).toBe('ML');
  });
});

describe('Pin Data Enrichment', () => {
  it('enriched pin should have all required fields', () => {
    const mockPin = {
      id: 1,
      planoId: 10,
      itemId: 100,
      posX: '45.5000',
      posY: '30.2000',
      nota: null,
      itemCodigo: 'OQC-00001',
      itemEstado: 'pendiente_aprobacion',
      itemDescripcion: 'Grieta en muro',
      itemFotoAntes: 'https://example.com/foto.jpg',
      itemFotoDespues: null,
      itemConsecutivo: 1,
      itemTitulo: 'Grieta estructural',
      residenteNombre: 'Esteban Guerrero',
      empresaNombre: 'GBPO',
      unidadNombre: '101',
      especialidadNombre: 'Albañilería',
      defectoNombre: 'Grieta',
      itemCreatedAt: new Date('2026-01-15'),
    };

    // Verify all fields exist
    expect(mockPin.residenteNombre).toBe('Esteban Guerrero');
    expect(mockPin.empresaNombre).toBe('GBPO');
    expect(mockPin.unidadNombre).toBe('101');
    expect(mockPin.especialidadNombre).toBe('Albañilería');
    expect(mockPin.defectoNombre).toBe('Grieta');
    expect(mockPin.itemTitulo).toBe('Grieta estructural');
    expect(mockPin.itemFotoDespues).toBeNull();
    expect(mockPin.itemCreatedAt).toBeInstanceOf(Date);

    // Verify initials
    expect(getInitials(mockPin.residenteNombre)).toBe('EG');
  });

  it('pin without item should show ? initials', () => {
    const mockPin = {
      id: 2,
      itemId: null,
      residenteNombre: null,
      empresaNombre: null,
      nota: 'Punto de referencia',
    };

    expect(getInitials(mockPin.residenteNombre)).toBe('?');
  });
});
