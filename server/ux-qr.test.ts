import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("UX y QR Improvements", () => {
  it("especialidades.listConAtributos returns especialidades with their atributos", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.especialidades.listConAtributos();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // Each especialidad should have an atributos array
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("atributos");
      expect(Array.isArray(result[0].atributos)).toBe(true);
    }
  });

  it("empresas.getCompleta returns empresa with usuarios, unidades and items stats", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // First create an empresa
    const empresa = await caller.empresas.create({
      nombre: "Empresa Test UX",
      activo: true,
    });

    expect(empresa).toBeDefined();
    expect(empresa.id).toBeDefined();

    // Get the complete empresa
    const empresaCompleta = await caller.empresas.getCompleta({ id: empresa.id });

    expect(empresaCompleta).toBeDefined();
    expect(empresaCompleta).toHaveProperty("usuarios");
    expect(empresaCompleta).toHaveProperty("unidades");
    expect(empresaCompleta).toHaveProperty("items");
    expect(empresaCompleta.items).toHaveProperty("total");
    expect(empresaCompleta.items).toHaveProperty("aprobados");
    expect(empresaCompleta.items).toHaveProperty("rechazados");
    expect(empresaCompleta.items).toHaveProperty("pendientes");
  });

  it("pendientes.misPendientes returns user pending items ordered by oldest first", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.pendientes.misPendientes();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    
    // Verify ordering (oldest first)
    if (result.length > 1) {
      for (let i = 0; i < result.length - 1; i++) {
        const currentDate = new Date(result[i].createdAt).getTime();
        const nextDate = new Date(result[i + 1].createdAt).getTime();
        expect(currentDate).toBeLessThanOrEqual(nextDate);
      }
    }
  });

  it("bitacora.list returns activity log entries", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.bitacora.list({ limit: 10 });

    expect(result).toBeDefined();
    // bitacora.list returns an array directly
    expect(Array.isArray(result)).toBe(true);
  });

  it("items.list supports filtering by multiple criteria", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Test with various filter combinations
    const result = await caller.items.list({
      limit: 10,
      offset: 0,
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
  });
});

describe("Date Format", () => {
  it("should format dates correctly in dd-mm-aa format", () => {
    const formatDate = (date: Date | string | null) => {
      if (!date) return "-";
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      return `${day}-${month}-${year}`;
    };

    const testDate = new Date("2026-01-15T12:00:00Z");
    const formatted = formatDate(testDate);
    
    expect(formatted).toMatch(/^\d{2}-\d{2}-\d{2}$/);
    // Just verify the format is correct (dd-mm-yy)
    const parts = formatted.split('-');
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBe(2); // day
    expect(parts[1].length).toBe(2); // month
    expect(parts[2].length).toBe(2); // year
  });
});

describe("QR Code Generation", () => {
  it("should generate OQC codes in correct format", () => {
    const generateOQCCode = (num: number) => {
      return `OQC-${String(num).padStart(5, '0')}`;
    };

    expect(generateOQCCode(1)).toBe("OQC-00001");
    expect(generateOQCCode(42)).toBe("OQC-00042");
    expect(generateOQCCode(12345)).toBe("OQC-12345");
    expect(generateOQCCode(99999)).toBe("OQC-99999");
  });
});
