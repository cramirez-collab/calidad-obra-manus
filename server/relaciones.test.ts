import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@objetiva.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "superadmin",
    empresaId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("Relaciones en Cadena", () => {
  it("especialidades.listConAtributos devuelve especialidades con atributos", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.especialidades.listConAtributos();
    
    expect(Array.isArray(result)).toBe(true);
    // Cada especialidad debe tener un array de atributos
    result.forEach(esp => {
      expect(esp).toHaveProperty("atributos");
      expect(Array.isArray(esp.atributos)).toBe(true);
    });
  });

  it("empresas.listConEstadisticas devuelve empresas con estadísticas", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.empresas.listConEstadisticas();
    
    expect(Array.isArray(result)).toBe(true);
    // Cada empresa debe tener estadísticas de ítems
    result.forEach(empresa => {
      expect(empresa).toHaveProperty("items");
      expect(empresa).toHaveProperty("tasaAprobacion");
      expect(empresa.items).toHaveProperty("total");
      expect(empresa.items).toHaveProperty("aprobados");
      expect(empresa.items).toHaveProperty("rechazados");
    });
  });

  it("unidades.listConEstadisticas devuelve unidades con estadísticas", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.unidades.listConEstadisticas();
    
    expect(Array.isArray(result)).toBe(true);
    // Cada unidad debe tener estadísticas de ítems
    result.forEach(unidad => {
      expect(unidad).toHaveProperty("items");
      expect(unidad).toHaveProperty("tasaAprobacion");
    });
  });

  it("users.residentes devuelve residentes con estadísticas", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.users.residentes();
    
    expect(Array.isArray(result)).toBe(true);
    // Cada residente debe tener estadísticas
    result.forEach(residente => {
      expect(residente).toHaveProperty("items");
      expect(residente).toHaveProperty("tasaAprobacion");
    });
  });
});
