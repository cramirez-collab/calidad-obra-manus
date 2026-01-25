import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Helper para crear contexto de superadmin
function createSuperadminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "superadmin-test",
      email: "superadmin@test.com",
      name: "Super Admin",
      loginMethod: "manus",
      role: "superadmin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// Helper para crear contexto de admin
function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "admin-test",
      email: "admin@test.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Configuración y Metas", () => {
  describe("configuracion router", () => {
    it("permite a admin listar configuraciones", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      
      // Debería poder listar sin errores
      const result = await caller.configuracion.list();
      expect(Array.isArray(result)).toBe(true);
    });

    it("permite a superadmin establecer configuración", async () => {
      const ctx = createSuperadminContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.configuracion.set({
        clave: "test_config",
        valor: "test_value",
        descripcion: "Configuración de prueba",
        soloSuperadmin: false,
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe("metas router", () => {
    it("permite a admin listar metas", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.metas.list();
      expect(Array.isArray(result)).toBe(true);
    });

    it("permite a admin listar metas con progreso", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.metas.listConProgreso();
      expect(Array.isArray(result)).toBe(true);
    });

    it("permite a superadmin crear meta", async () => {
      const ctx = createSuperadminContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.metas.create({
        nombre: "Meta de prueba",
        tipo: "aprobacion",
        valorObjetivo: 80,
        descripcion: "Meta de prueba para tests",
      });
      
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("number");
    });
  });

  describe("Roles y permisos", () => {
    it("superadmin tiene acceso a todas las funciones", async () => {
      const ctx = createSuperadminContext();
      const caller = appRouter.createCaller(ctx);
      
      // Verificar que puede acceder a funciones de admin
      const configList = await caller.configuracion.list();
      expect(Array.isArray(configList)).toBe(true);
      
      const metasList = await caller.metas.list();
      expect(Array.isArray(metasList)).toBe(true);
    });

    it("admin puede listar pero no crear metas", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      
      // Puede listar
      const metasList = await caller.metas.list();
      expect(Array.isArray(metasList)).toBe(true);
      
      // No puede crear (solo superadmin)
      await expect(
        caller.metas.create({
          nombre: "Meta no permitida",
          tipo: "aprobacion",
          valorObjetivo: 50,
        })
      ).rejects.toThrow();
    });
  });
});
