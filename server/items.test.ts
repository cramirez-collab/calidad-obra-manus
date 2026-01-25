import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock de usuario autenticado
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(role: string = "admin"): TrpcContext {
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
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Items Router", () => {
  describe("items.list", () => {
    it("should return items list for authenticated user", async () => {
      const ctx = createMockContext("admin");
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.items.list({});
      
      expect(result).toHaveProperty("items");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  describe("items.get", () => {
    it("should return undefined for non-existent item", async () => {
      const ctx = createMockContext("admin");
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.items.get({ id: 999999 });
      
      expect(result).toBeUndefined();
    });
  });
});

describe("Empresas Router", () => {
  it("should list empresas for authenticated user", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.empresas.list();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Unidades Router", () => {
  it("should list unidades for authenticated user", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.unidades.list();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Especialidades Router", () => {
  it("should list especialidades for authenticated user", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.especialidades.list();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Atributos Router", () => {
  it("should list atributos for authenticated user", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.atributos.list();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Estadisticas Router", () => {
  it("should return statistics for authenticated user", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.estadisticas.general({});
    
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("porStatus");
    expect(result).toHaveProperty("porEspecialidad");
    expect(result).toHaveProperty("porEmpresa");
  });

  it("should filter statistics by empresaId", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.estadisticas.general({ empresaId: 1 });
    
    expect(result).toHaveProperty("total");
    expect(typeof result?.total).toBe("number");
  });
});

describe("Role-based Access Control", () => {
  it("should allow admin to list users", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.users.list();
    
    expect(Array.isArray(result)).toBe(true);
  });

  it("should deny residente access to users list", async () => {
    const ctx = createMockContext("residente");
    const caller = appRouter.createCaller(ctx);
    
    await expect(caller.users.list()).rejects.toThrow("Acceso denegado");
  });

  it("should deny supervisor access to create empresa", async () => {
    const ctx = createMockContext("supervisor");
    const caller = appRouter.createCaller(ctx);
    
    await expect(
      caller.empresas.create({ nombre: "Test Empresa" })
    ).rejects.toThrow("Acceso denegado");
  });
});
