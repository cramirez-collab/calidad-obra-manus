import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(role: string = "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: role as any,
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

describe("Roles y permisos", () => {
  it("superadmin tiene acceso completo", async () => {
    const ctx = createTestContext("superadmin");
    const caller = appRouter.createCaller(ctx);
    
    // Superadmin puede listar empresas
    const empresas = await caller.empresas.list();
    expect(Array.isArray(empresas)).toBe(true);
  });

  it("admin tiene acceso a catálogos", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const empresas = await caller.empresas.list();
    expect(Array.isArray(empresas)).toBe(true);
  });

  it("residente puede ver ítems", async () => {
    const ctx = createTestContext("residente");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.items.list({});
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
  });
});

describe("Bitácora de actividades", () => {
  it("admin puede ver bitácora general", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const bitacora = await caller.bitacora.list({});
    expect(Array.isArray(bitacora)).toBe(true);
  });

  it("usuario puede ver su propia actividad", async () => {
    const ctx = createTestContext("residente");
    const caller = appRouter.createCaller(ctx);
    
    const miActividad = await caller.bitacora.miActividad({});
    expect(Array.isArray(miActividad)).toBe(true);
  });
});

describe("Pendientes por usuario", () => {
  it("usuario puede ver sus pendientes", async () => {
    const ctx = createTestContext("residente");
    const caller = appRouter.createCaller(ctx);
    
    const pendientes = await caller.pendientes.misPendientes();
    expect(Array.isArray(pendientes)).toBe(true);
  });
});

describe("Código OQC progresivo", () => {
  it("los códigos siguen formato OQC-XXXXX", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.items.list({});
    if (result.items && result.items.length > 0) {
      const item = result.items[0];
      // Verificar que el código sigue el patrón OQC-XXXXX
      expect(item.codigo).toMatch(/^OQC-\d{5}$/);
    }
  });
});

describe("Estadísticas y KPIs", () => {
  it("puede obtener estadísticas generales", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const stats = await caller.estadisticas.general({});
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("porStatus");
  });

  it("puede obtener KPIs", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const kpis = await caller.estadisticas.kpis({});
    // La estructura de KPIs tiene resumen con los datos
    expect(kpis).toHaveProperty("resumen");
    expect(kpis.resumen).toHaveProperty("total");
  });
});
