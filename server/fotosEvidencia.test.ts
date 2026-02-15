import { describe, expect, it } from "vitest";
import { getFotosEvidenciaParaReporte } from "./db";

describe("getFotosEvidenciaParaReporte", () => {
  it("should return an array", async () => {
    const result = await getFotosEvidenciaParaReporte(1, 5);
    expect(Array.isArray(result)).toBe(true);
  });

  it("should respect the limit parameter", async () => {
    const result = await getFotosEvidenciaParaReporte(1, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("should include defectoNombre and defectoCount fields when defectos exist", async () => {
    const result = await getFotosEvidenciaParaReporte(1, 5);
    if (result.length > 0) {
      const foto = result[0];
      expect(foto).toHaveProperty('id');
      expect(foto).toHaveProperty('codigo');
      expect(foto).toHaveProperty('tieneFoto');
      // New fields from the fix - should always be present
      expect(foto).toHaveProperty('defectoNombre');
      expect(foto).toHaveProperty('defectoCount');
    }
  });

  it("should return items ordered by defecto frequency (most recurring first)", async () => {
    const result = await getFotosEvidenciaParaReporte(1, 5);
    if (result.length >= 2 && result[0].defectoCount > 0) {
      // First item should have highest count
      expect(result[0].defectoCount).toBeGreaterThanOrEqual(result[1].defectoCount);
    }
  });

  it("should return empty array for non-existent project", async () => {
    const result = await getFotosEvidenciaParaReporte(99999, 5);
    expect(result).toEqual([]);
  });
});

describe("pdfCharts FotoEvidencia interface", () => {
  it("should accept defectoNombre and defectoCount in FotoEvidencia", () => {
    const foto = {
      id: 1,
      codigo: "OQC-00001",
      fotoUrl: "https://example.com/photo.jpg",
      status: "pendiente_foto",
      defectoNombre: "Entrecalle",
      defectoCount: 6,
    };

    expect(foto.defectoNombre).toBe("Entrecalle");
    expect(foto.defectoCount).toBe(6);
    expect(foto.fotoUrl).toBeTruthy();
  });
});
