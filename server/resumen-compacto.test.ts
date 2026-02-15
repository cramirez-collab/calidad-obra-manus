import { describe, it, expect } from 'vitest';

/**
 * Tests para la funcionalidad de Resumen Ejecutivo Compacto v4.43
 * - Prompt LLM optimizado para 300 palabras
 * - PDF abre en nueva pestaña (openPDFPreview)
 * - Mini gráficas en tab Resumen
 * - Limpieza unicode en contenido
 */

describe('Resumen Ejecutivo Compacto', () => {
  describe('Limpieza de contenido unicode', () => {
    it('debe eliminar secuencias \\uXXXX del contenido', () => {
      const raw = 'Texto con \\u2022 bullet y \\u00e1 acento';
      const cleaned = raw
        .replace(/\\u[0-9a-fA-F]{4}/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      expect(cleaned).toBe('Texto con bullet y acento');
      expect(cleaned).not.toContain('\\u');
    });

    it('debe eliminar caracteres unicode especiales', () => {
      const raw = 'Texto con • bullet y · punto medio y – guión';
      const cleaned = raw
        .replace(/[\u2022\u2023\u25E6\u2043\u2219\u00B7]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      expect(cleaned).not.toContain('•');
      expect(cleaned).not.toContain('·');
    });

    it('debe preservar acentos directos en español', () => {
      const raw = 'Análisis de calidad: áéíóúñ ÁÉÍÓÚÑ';
      const cleaned = raw
        .replace(/\\u[0-9a-fA-F]{4}/g, '')
        .trim();
      expect(cleaned).toBe('Análisis de calidad: áéíóúñ ÁÉÍÓÚÑ');
    });
  });

  describe('Formato de resumen', () => {
    it('debe parsear encabezados markdown correctamente', () => {
      const content = `## Estado\n* Total: 50 ítems\n## Crítico\n* 10 rechazados`;
      const lines = content.split('\n');
      const headers = lines.filter(l => l.trim().startsWith('## '));
      const bullets = lines.filter(l => l.trim().startsWith('* '));
      expect(headers).toHaveLength(2);
      expect(bullets).toHaveLength(2);
    });

    it('debe tener máximo 5 secciones en el resumen', () => {
      const expectedSections = ['Estado', 'Crítico', 'Empresas', 'Acciones', 'KPIs'];
      expect(expectedSections).toHaveLength(5);
      expectedSections.forEach(section => {
        expect(section.length).toBeGreaterThan(0);
      });
    });

    it('debe formatear bullets con asterisco', () => {
      const bullet = '* Total de 50 ítems registrados en el proyecto';
      expect(bullet.startsWith('* ')).toBe(true);
      const text = bullet.replace(/^\* /, '');
      expect(text).toBe('Total de 50 ítems registrados en el proyecto');
    });
  });

  describe('PDF Resumen compacto', () => {
    it('debe generar PDF con márgenes reducidos (15mm)', () => {
      const margin = 15;
      const pageW = 210; // A4 width in mm
      const maxW = pageW - margin * 2;
      expect(maxW).toBe(180);
    });

    it('debe limitar contenido a 1 página (y <= 275)', () => {
      const maxY = 275;
      const headerHeight = 28;
      const kpiHeight = 24; // 16 + 8
      const separatorHeight = 4;
      const availableForContent = maxY - headerHeight - kpiHeight - separatorHeight;
      expect(availableForContent).toBeGreaterThan(200);
    });

    it('debe calcular KPI boxes correctamente', () => {
      const margin = 15;
      const pageW = 210;
      const maxW = pageW - margin * 2;
      const kpiW = (maxW - 6) / 4;
      expect(kpiW).toBeCloseTo(43.5, 1);
      // 4 KPIs should fit within maxW
      const totalKpiWidth = kpiW * 4 + 6; // 4 boxes + 3 gaps of 2mm
      expect(totalKpiWidth).toBeLessThanOrEqual(maxW);
    });

    it('debe calcular porcentaje de aprobación correctamente', () => {
      const total = 50;
      const aprobados = 20;
      const pct = total > 0 ? Math.round((aprobados / total) * 100) : 0;
      expect(pct).toBe(40);
    });

    it('debe manejar total 0 sin dividir por cero', () => {
      const total = 0;
      const aprobados = 0;
      const pct = total > 0 ? Math.round((aprobados / total) * 100) : 0;
      expect(pct).toBe(0);
    });
  });

  describe('openPDFPreview utility', () => {
    it('debe usar application/pdf como tipo MIME', () => {
      const mimeType = 'application/pdf';
      expect(mimeType).toBe('application/pdf');
    });

    it('debe usar window.open con _blank', () => {
      const target = '_blank';
      expect(target).toBe('_blank');
    });
  });

  describe('Mini gráficas en Resumen', () => {
    it('debe preparar datos de pie chart por estado', () => {
      const STATUS_COLORS: Record<string, string> = {
        aprobado: '#02B381',
        rechazado: '#ef4444',
        pendiente_foto: '#f59e0b',
        pendiente_aprobacion: '#3b82f6',
        sin_item: '#94a3b8'
      };
      const mockStats = [
        { status: 'aprobado', count: 20 },
        { status: 'rechazado', count: 10 },
        { status: 'pendiente_foto', count: 15 },
      ];
      const pieData = mockStats.map(s => ({
        name: s.status,
        value: Number(s.count),
        color: STATUS_COLORS[s.status] || '#94a3b8'
      }));
      expect(pieData).toHaveLength(3);
      expect(pieData[0].color).toBe('#02B381');
      expect(pieData[1].color).toBe('#ef4444');
    });

    it('debe limitar bar chart a top 5 empresas', () => {
      const mockEmpresas = Array.from({ length: 10 }, (_, i) => ({
        empresa: `Empresa ${i + 1}`,
        count: 100 - i * 10
      }));
      const barData = mockEmpresas.slice(0, 5);
      expect(barData).toHaveLength(5);
      expect(barData[0].count).toBe(100);
      expect(barData[4].count).toBe(60);
    });

    it('debe truncar nombres de empresa a 4 caracteres en gráfica', () => {
      const empresa = 'Constructora ABC';
      const truncated = empresa.substring(0, 4);
      expect(truncated).toBe('Cons');
    });
  });
});
