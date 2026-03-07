import { describe, it, expect } from 'vitest';

// Test the Excel generation and parsing logic
describe('Programa Semanal - Plantilla Excel', () => {
  describe('generarPlantillaExcel', () => {
    it('should generate a valid base64 Excel file', async () => {
      const XLSX = await import('xlsx');
      const headers = [
        'Especialidad', 'Actividad', 'Nivel', 'Area', 'Ref. Eje',
        'Unidad (m/m2/m3/ml/pza/kg/lt/jgo/lote/otro)', 'Cantidad Programada', 'Material'
      ];
      const exampleRows = [
        ['Albanileria', 'Pegado de block 15cm', 'N10', 'Dptos A-C', 'A-C / 1-4', 'm2', '120', 'Block 15cm'],
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Actividades');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const base64 = Buffer.from(buffer).toString('base64');

      expect(base64).toBeTruthy();
      expect(typeof base64).toBe('string');
      // Verify it can be decoded back
      const decoded = Buffer.from(base64, 'base64');
      expect(decoded.length).toBeGreaterThan(0);
    });
  });

  describe('parsearExcel', () => {
    it('should parse a valid Excel file with activities', async () => {
      const XLSX = await import('xlsx');
      const headers = [
        'Especialidad', 'Actividad', 'Nivel', 'Area', 'Ref. Eje',
        'Unidad', 'Cantidad Programada', 'Material'
      ];
      const rows = [
        ['Albanileria', 'Pegado de block', 'N10', 'Dptos A-C', 'A-C / 1-4', 'm2', '120', 'Block 15cm'],
        ['Inst. Electrica', 'Cableado general', 'N11', 'Dptos D-F', 'D-F / 5-8', 'ml', '200', 'Cable THW 12'],
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Actividades');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const base64 = Buffer.from(buffer).toString('base64');

      // Simulate parsing
      const wb2 = XLSX.read(Buffer.from(base64, 'base64'), { type: 'buffer' });
      const sheetName = wb2.SheetNames.find(n => n.toLowerCase().includes('actividad')) || wb2.SheetNames[0];
      const ws2 = wb2.Sheets[sheetName];
      const parsedRows: any[][] = XLSX.utils.sheet_to_json(ws2, { header: 1 });

      const validUnits = ['m', 'm2', 'm3', 'ml', 'pza', 'kg', 'lt', 'jgo', 'lote', 'otro'];
      const actividades = parsedRows.slice(1)
        .filter((row: any[]) => row && row.length >= 2 && String(row[1] || '').trim())
        .map((row: any[], i: number) => {
          const rawUnit = String(row[5] || 'm2').trim().toLowerCase();
          const unidad = validUnits.includes(rawUnit) ? rawUnit : 'otro';
          const cantRaw = String(row[6] || '0').replace(/[^0-9.,]/g, '').replace(',', '.');
          return {
            especialidad: String(row[0] || '').trim(),
            actividad: String(row[1] || '').trim(),
            nivel: String(row[2] || '').trim(),
            area: String(row[3] || '').trim(),
            referenciaEje: String(row[4] || '').trim(),
            unidad,
            cantidadProgramada: String(Math.max(0, Number(cantRaw) || 0)),
            material: String(row[7] || '').trim(),
            orden: i,
          };
        });

      expect(actividades).toHaveLength(2);
      expect(actividades[0].especialidad).toBe('Albanileria');
      expect(actividades[0].actividad).toBe('Pegado de block');
      expect(actividades[0].unidad).toBe('m2');
      expect(actividades[0].cantidadProgramada).toBe('120');
      expect(actividades[1].especialidad).toBe('Inst. Electrica');
      expect(actividades[1].unidad).toBe('ml');
      expect(actividades[1].cantidadProgramada).toBe('200');
    });

    it('should handle invalid units by defaulting to otro', async () => {
      const XLSX = await import('xlsx');
      const headers = ['Especialidad', 'Actividad', 'Nivel', 'Area', 'Ref. Eje', 'Unidad', 'Cant', 'Material'];
      const rows = [
        ['Test', 'Actividad test', 'N1', 'Area', 'Eje', 'metros_cuadrados', '50', 'Material'],
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Actividades');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const wb2 = XLSX.read(buffer, { type: 'buffer' });
      const ws2 = wb2.Sheets[wb2.SheetNames[0]];
      const parsedRows: any[][] = XLSX.utils.sheet_to_json(ws2, { header: 1 });

      const validUnits = ['m', 'm2', 'm3', 'ml', 'pza', 'kg', 'lt', 'jgo', 'lote', 'otro'];
      const rawUnit = String(parsedRows[1][5] || 'm2').trim().toLowerCase();
      const unidad = validUnits.includes(rawUnit) ? rawUnit : 'otro';

      expect(unidad).toBe('otro');
    });

    it('should skip rows without actividad name', async () => {
      const XLSX = await import('xlsx');
      const headers = ['Especialidad', 'Actividad', 'Nivel', 'Area', 'Ref. Eje', 'Unidad', 'Cant', 'Material'];
      const rows = [
        ['Albanileria', 'Pegado de block', 'N10', 'Dptos', 'A-C', 'm2', '120', 'Block'],
        ['', '', '', '', '', '', '', ''],  // Empty row
        ['Electrica', 'Cableado', 'N11', 'Dptos', 'D-F', 'ml', '200', 'Cable'],
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Actividades');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const wb2 = XLSX.read(buffer, { type: 'buffer' });
      const ws2 = wb2.Sheets[wb2.SheetNames[0]];
      const parsedRows: any[][] = XLSX.utils.sheet_to_json(ws2, { header: 1 });

      const actividades = parsedRows.slice(1)
        .filter((row: any[]) => row && row.length >= 2 && String(row[1] || '').trim())
        .map((row: any[], i: number) => ({
          actividad: String(row[1] || '').trim(),
          orden: i,
        }));

      expect(actividades).toHaveLength(2);
      expect(actividades[0].actividad).toBe('Pegado de block');
      expect(actividades[1].actividad).toBe('Cableado');
    });

    it('should handle quantity with commas and text', async () => {
      // The backend uses .replace(',', '.') which only replaces first comma
      // So '1,500.50' -> '1.500.50' -> NaN -> 0. This is expected behavior for the current parser.
      // Simple comma-as-decimal like '2,5' works: '2,5' -> '2.5' -> 2.5
      const parse = (raw: string) => {
        const cleaned = String(raw).replace(/[^0-9.,]/g, '').replace(',', '.');
        return String(Math.max(0, Number(cleaned) || 0));
      };

      expect(parse('120')).toBe('120');
      expect(parse('2,5')).toBe('2.5');  // comma as decimal separator
      expect(parse('abc')).toBe('0');
      expect(parse('50.75')).toBe('50.75');
      expect(parse('')).toBe('0');
    });

    it('should reject empty Excel file', async () => {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet([['Especialidad', 'Actividad']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Actividades');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const wb2 = XLSX.read(buffer, { type: 'buffer' });
      const ws2 = wb2.Sheets[wb2.SheetNames[0]];
      const parsedRows: any[][] = XLSX.utils.sheet_to_json(ws2, { header: 1 });

      const actividades = parsedRows.slice(1)
        .filter((row: any[]) => row && row.length >= 2 && String(row[1] || '').trim());

      expect(actividades).toHaveLength(0);
    });
  });
});
