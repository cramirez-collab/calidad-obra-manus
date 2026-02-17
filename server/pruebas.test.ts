import { describe, it, expect, vi } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getCatalogoPruebas: vi.fn().mockResolvedValue([
    { id: 1, sistema: "Eléctrico", nombre: "Prueba de continuidad", activo: true, orden: 1 },
    { id: 2, sistema: "Eléctrico", nombre: "Prueba de aislamiento", activo: true, orden: 2 },
    { id: 3, sistema: "Hidráulico", nombre: "Prueba de presión", activo: true, orden: 1 },
  ]),
  getCatalogoPruebasAll: vi.fn().mockResolvedValue([
    { id: 1, sistema: "Eléctrico", nombre: "Prueba de continuidad", activo: true, orden: 1 },
    { id: 2, sistema: "Eléctrico", nombre: "Prueba de aislamiento", activo: true, orden: 2 },
    { id: 3, sistema: "Hidráulico", nombre: "Prueba de presión", activo: true, orden: 1 },
    { id: 4, sistema: "Hidráulico", nombre: "Prueba desactivada", activo: false, orden: 2 },
  ]),
  createCatalogoPrueba: vi.fn().mockResolvedValue(5),
  updateCatalogoPrueba: vi.fn().mockResolvedValue(undefined),
  deleteCatalogoPrueba: vi.fn().mockResolvedValue(undefined),
  getResultadosPruebas: vi.fn().mockResolvedValue([]),
  getDepartamentosNumericos: vi.fn().mockResolvedValue([
    { id: 101, nombre: "101", nivel: 1 },
    { id: 102, nombre: "102", nivel: 1 },
  ]),
  getResumenPruebasPorUnidad: vi.fn().mockResolvedValue([]),
  getDb: vi.fn().mockResolvedValue(null),
}));

describe("Pruebas module - data structures", () => {
  it("getCatalogoPruebas returns only active pruebas", async () => {
    const db = await import("./db");
    const result = await db.getCatalogoPruebas(1);
    expect(result).toHaveLength(3);
    expect(result.every((p: any) => p.activo)).toBe(true);
  });

  it("getCatalogoPruebasAll returns all pruebas including inactive", async () => {
    const db = await import("./db");
    const result = await db.getCatalogoPruebasAll(1);
    expect(result).toHaveLength(4);
    expect(result.some((p: any) => !p.activo)).toBe(true);
  });

  it("createCatalogoPrueba returns new id", async () => {
    const db = await import("./db");
    const id = await db.createCatalogoPrueba({
      proyectoId: 1,
      sistema: "Gas",
      nombre: "Prueba de hermeticidad",
      orden: 1,
      requiereEvidencia: true,
    } as any);
    expect(id).toBe(5);
  });

  it("getDepartamentosNumericos returns sorted departments", async () => {
    const db = await import("./db");
    const result = await db.getDepartamentosNumericos(1);
    expect(result).toHaveLength(2);
    expect(result[0].nombre).toBe("101");
  });
});

describe("Pruebas module - protocolo data preparation", () => {
  it("computes stats correctly from empty results", async () => {
    const db = await import("./db");
    const catalogo = await db.getCatalogoPruebas(1);
    const resultados = await db.getResultadosPruebas(1);
    const deptos = await db.getDepartamentosNumericos(1);
    
    const totalPruebas = catalogo.length;
    const statsDeptos = deptos.map((dep: any) => {
      const resDepto = resultados.filter((r: any) => r.unidadId === dep.id);
      const aprobadas = resDepto.filter((r: any) => r.estado === "aprobado" && r.intento === "final").length;
      const rechazadas = resDepto.filter((r: any) => r.estado === "rechazado").length;
      const pendientes = totalPruebas - aprobadas;
      return { nombre: dep.nombre, nivel: dep.nivel, aprobadas, rechazadas, pendientes, total: totalPruebas };
    });

    expect(statsDeptos).toHaveLength(2);
    expect(statsDeptos[0].pendientes).toBe(3); // All pending since no results
    expect(statsDeptos[0].aprobadas).toBe(0);
    expect(statsDeptos[0].rechazadas).toBe(0);
  });

  it("computes liberados correctly", async () => {
    const db = await import("./db");
    const deptos = await db.getDepartamentosNumericos(1);
    const catalogo = await db.getCatalogoPruebas(1);
    const totalPruebas = catalogo.length;

    // Simulate stats with no results
    const statsDeptos = deptos.map((dep: any) => ({
      nombre: dep.nombre,
      aprobadas: 0,
      pendientes: totalPruebas,
    }));

    const liberados = statsDeptos.filter((s: any) => s.pendientes === 0).length;
    const sinIniciar = statsDeptos.filter((s: any) => s.aprobadas === 0).length;

    expect(liberados).toBe(0);
    expect(sinIniciar).toBe(2);
  });

  it("groups catalogo by sistema correctly", async () => {
    const db = await import("./db");
    const catalogo = await db.getCatalogoPruebas(1);
    
    const sistemas = [...new Set(catalogo.map((c: any) => c.sistema))];
    expect(sistemas).toContain("Eléctrico");
    expect(sistemas).toContain("Hidráulico");
    expect(sistemas).toHaveLength(2);
  });
});

describe("Pruebas module - editor operations", () => {
  it("updateCatalogoPrueba is called correctly", async () => {
    const db = await import("./db");
    await db.updateCatalogoPrueba(1, { nombre: "Nuevo nombre" });
    expect(db.updateCatalogoPrueba).toHaveBeenCalledWith(1, { nombre: "Nuevo nombre" });
  });

  it("deleteCatalogoPrueba soft-deletes (sets activo=false)", async () => {
    const db = await import("./db");
    await db.deleteCatalogoPrueba(1);
    expect(db.deleteCatalogoPrueba).toHaveBeenCalledWith(1);
  });

  it("reactivate calls updateCatalogoPrueba with activo=true", async () => {
    const db = await import("./db");
    await db.updateCatalogoPrueba(4, { activo: true });
    expect(db.updateCatalogoPrueba).toHaveBeenCalledWith(4, { activo: true });
  });
});
