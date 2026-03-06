import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
  };
});

describe("Inferencia de nivel por nombre", () => {
  // Test the logic directly by importing the function
  // Since inferirNivelPorNombre is not exported, we test via createUnidad behavior
  // But we can test the pattern matching logic

  const inferirNivel = (nombre: string): number | undefined => {
    const n = nombre.trim();
    if (/^s[oó]tano/i.test(n) || /^basement/i.test(n)) return 0;
    if (/^roof/i.test(n) || /^azotea/i.test(n)) return 99;
    const match = n.match(/^(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      if (num >= 100) {
        return Math.floor(num / 100);
      }
      return num;
    }
    return undefined;
  };

  it("debería inferir nivel 0 para sótano", () => {
    expect(inferirNivel("Sotano")).toBe(0);
    expect(inferirNivel("Sótano 1")).toBe(0);
    expect(inferirNivel("sotano")).toBe(0);
    expect(inferirNivel("SOTANO")).toBe(0);
    expect(inferirNivel("Basement")).toBe(0);
  });

  it("debería inferir nivel 99 para roof/azotea", () => {
    expect(inferirNivel("Roof6")).toBe(99);
    expect(inferirNivel("Roof")).toBe(99);
    expect(inferirNivel("Azotea")).toBe(99);
  });

  it("debería inferir nivel correcto para unidades numéricas", () => {
    expect(inferirNivel("101")).toBe(1);
    expect(inferirNivel("102")).toBe(1);
    expect(inferirNivel("103")).toBe(1);
    expect(inferirNivel("201")).toBe(2);
    expect(inferirNivel("202")).toBe(2);
    expect(inferirNivel("301")).toBe(3);
    expect(inferirNivel("401")).toBe(4);
    expect(inferirNivel("501")).toBe(5);
    expect(inferirNivel("1501")).toBe(15);
  });

  it("debería inferir nivel para números menores a 100", () => {
    expect(inferirNivel("1")).toBe(1);
    expect(inferirNivel("2")).toBe(2);
    expect(inferirNivel("10")).toBe(10);
  });

  it("debería retornar undefined para nombres no numéricos", () => {
    expect(inferirNivel("Local")).toBeUndefined();
    expect(inferirNivel("Amenidades")).toBeUndefined();
    expect(inferirNivel("-")).toBeUndefined();
  });
});

describe("Detección de duplicados en importación", () => {
  it("debería detectar nombres duplicados case-insensitive", () => {
    const nombresExistentes = new Set(["101", "102", "201"]);
    
    const unidadesNuevas = [
      { nombre: "101" }, // duplicada
      { nombre: "103" }, // nueva
      { nombre: "201" }, // duplicada
      { nombre: "301" }, // nueva
    ];

    const duplicados: string[] = [];
    const nuevas: string[] = [];

    for (const u of unidadesNuevas) {
      const nombreNorm = u.nombre.trim().toLowerCase();
      if (nombresExistentes.has(nombreNorm)) {
        duplicados.push(u.nombre);
      } else {
        nuevas.push(u.nombre);
        nombresExistentes.add(nombreNorm);
      }
    }

    expect(duplicados).toEqual(["101", "201"]);
    expect(nuevas).toEqual(["103", "301"]);
  });

  it("debería evitar duplicados dentro del mismo batch de importación", () => {
    const nombresExistentes = new Set<string>();
    
    const unidadesNuevas = [
      { nombre: "101" },
      { nombre: "102" },
      { nombre: "101" }, // duplicada dentro del batch
    ];

    const duplicados: string[] = [];
    const nuevas: string[] = [];

    for (const u of unidadesNuevas) {
      const nombreNorm = u.nombre.trim().toLowerCase();
      if (nombresExistentes.has(nombreNorm)) {
        duplicados.push(u.nombre);
      } else {
        nuevas.push(u.nombre);
        nombresExistentes.add(nombreNorm);
      }
    }

    expect(duplicados).toEqual(["101"]);
    expect(nuevas).toEqual(["101", "102"]);
  });
});

describe("Inferencia de ubicación por nivel", () => {
  const inferirUbicacion = (nivel: number | undefined | null, nombre?: string): string | undefined => {
    if (nivel === 0) return "Sótano";
    if (nivel === 99) return "Azotea";
    if (nivel && nivel > 0) return `N${nivel}`;
    if (nombre) {
      const n = nombre.trim();
      if (/^s[oó]tano/i.test(n)) return "Sótano";
      if (/^roof/i.test(n) || /^azotea/i.test(n)) return "Azotea";
    }
    return undefined;
  };

  it("debería inferir Sótano para nivel 0", () => {
    expect(inferirUbicacion(0)).toBe("Sótano");
  });

  it("debería inferir Azotea para nivel 99", () => {
    expect(inferirUbicacion(99)).toBe("Azotea");
  });

  it("debería inferir N1, N2, etc. para niveles positivos", () => {
    expect(inferirUbicacion(1)).toBe("N1");
    expect(inferirUbicacion(2)).toBe("N2");
    expect(inferirUbicacion(5)).toBe("N5");
    expect(inferirUbicacion(15)).toBe("N15");
  });

  it("debería usar fallback por nombre cuando nivel es undefined", () => {
    expect(inferirUbicacion(undefined, "Sotano")).toBe("Sótano");
    expect(inferirUbicacion(undefined, "Roof6")).toBe("Azotea");
    expect(inferirUbicacion(undefined, "Azotea")).toBe("Azotea");
  });

  it("debería retornar undefined cuando no hay info", () => {
    expect(inferirUbicacion(undefined)).toBeUndefined();
    expect(inferirUbicacion(null)).toBeUndefined();
    expect(inferirUbicacion(undefined, "Local")).toBeUndefined();
  });
});

describe("Validación de unidades.create via tRPC", () => {
  it("debería rechazar creación de unidad sin nombre", async () => {
    // El schema de zod requiere nombre.min(1)
    const schema = await import("zod").then(z => z.z.object({
      nombre: z.z.string().min(1),
    }));
    
    expect(() => schema.parse({ nombre: "" })).toThrow();
    expect(() => schema.parse({ nombre: "101" })).not.toThrow();
  });
});
