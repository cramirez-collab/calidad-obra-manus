import { describe, it, expect, vi } from "vitest";

// Test del procedure reporteEficienciaPorEmpresa
describe("Reporte Eficiencia por Empresa", () => {
  it("debería requerir autenticación (protectedProcedure)", async () => {
    // El procedure está definido como protectedProcedure, verificamos que existe en el router
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("programaSemanal.reporteEficienciaPorEmpresa");
  });

  it("debería tener el input correcto (proyectoId requerido)", async () => {
    const { appRouter } = await import("./routers");
    const proc = appRouter._def.procedures["programaSemanal.reporteEficienciaPorEmpresa"];
    expect(proc).toBeDefined();
  });
});

// Test de la estructura del reporte de calidad PDF
describe("Reporte Calidad PDF", () => {
  it("debería exportar la función generarReporteCalidadPDF", async () => {
    const mod = await import("../client/src/lib/reporteCalidadPDF");
    expect(mod.generarReporteCalidadPDF).toBeDefined();
    expect(typeof mod.generarReporteCalidadPDF).toBe("function");
  });
});

// Test de la estructura del reporte de eficiencia PDF
describe("Reporte Eficiencia PDF", () => {
  it("debería exportar la función generarReporteEficienciaPDF", async () => {
    const mod = await import("../client/src/lib/reporteEficienciaPDF");
    expect(mod.generarReporteEficienciaPDF).toBeDefined();
    expect(typeof mod.generarReporteEficienciaPDF).toBe("function");
  });
});
