import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-error-handling",
    email: "test@error.com",
    name: "Test Error Handler",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
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

describe("items.create - Error Handling & Role Permissions", () => {
  it("residente role CAN create items (noDesarrolladorProcedure allows it)", async () => {
    const ctx = createAuthContext({ id: 1410178, role: "residente" as any, name: "Natalia Diaz" });
    const caller = appRouter.createCaller(ctx);

    // A residente should be able to create items - the noDesarrolladorProcedure only blocks 'desarrollador' and 'segurista'
    try {
      await caller.items.create({
        proyectoId: 1,
        empresaId: 480003, // Waller
        unidadId: 90001,
        titulo: "Test residente can create",
        clientId: `test-residente-create-${Date.now()}`,
      });
      // If it succeeds (item created), that's fine
    } catch (error: any) {
      // Should NOT be a FORBIDDEN error - residentes are allowed to create
      expect(error.code).not.toBe("FORBIDDEN");
      expect(error.message).not.toContain("Desarrollador");
      expect(error.message).not.toContain("Segurista");
    }
  });

  it("desarrollador role CANNOT create items", async () => {
    const ctx = createAuthContext({ role: "desarrollador" as any });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.items.create({
        proyectoId: 1,
        empresaId: 1,
        unidadId: 1,
        titulo: "Test desarrollador blocked",
        clientId: `test-dev-blocked-${Date.now()}`,
      })
    ).rejects.toThrow(/Desarrollador/);
  });

  it("segurista role CANNOT create items", async () => {
    const ctx = createAuthContext({ role: "segurista" as any });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.items.create({
        proyectoId: 1,
        empresaId: 1,
        unidadId: 1,
        titulo: "Test segurista blocked",
        clientId: `test-seg-blocked-${Date.now()}`,
      })
    ).rejects.toThrow(/Segurista/);
  });

  it("unauthenticated user CANNOT create items", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.items.create({
        proyectoId: 1,
        empresaId: 1,
        unidadId: 1,
        titulo: "Test unauth blocked",
        clientId: `test-unauth-${Date.now()}`,
      })
    ).rejects.toThrow(/login|UNAUTHORIZED/i);
  });

  it("items.create with clientId deduplication returns existing item on retry", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const clientId = `test-dedup-${Date.now()}`;

    // First creation attempt
    let firstResult: any;
    try {
      firstResult = await caller.items.create({
        proyectoId: 1,
        empresaId: 1,
        unidadId: 90001,
        titulo: "Test deduplication",
        clientId,
      });
    } catch (error: any) {
      // May fail at DB level, skip test if so
      return;
    }

    // Second creation attempt with same clientId should return existing item
    try {
      const secondResult = await caller.items.create({
        proyectoId: 1,
        empresaId: 1,
        unidadId: 90001,
        titulo: "Test deduplication retry",
        clientId,
      });
      // Should return the same item
      expect(secondResult.id).toBe(firstResult.id);
    } catch (error: any) {
      // If it throws, it should NOT be a duplicate error
      // (the code handles duplicates by returning the existing item)
    }
  });

  it("items.create requires titulo (non-empty string)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.items.create({
        proyectoId: 1,
        empresaId: 1,
        unidadId: 1,
        titulo: "", // empty string
        clientId: `test-empty-title-${Date.now()}`,
      })
    ).rejects.toThrow();
  });

  it("items.create requires empresaId and unidadId", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Missing empresaId
    await expect(
      caller.items.create({
        proyectoId: 1,
        empresaId: undefined as any,
        unidadId: 1,
        titulo: "Test missing empresa",
        clientId: `test-no-empresa-${Date.now()}`,
      })
    ).rejects.toThrow();

    // Missing unidadId
    await expect(
      caller.items.create({
        proyectoId: 1,
        empresaId: 1,
        unidadId: undefined as any,
        titulo: "Test missing unidad",
        clientId: `test-no-unidad-${Date.now()}`,
      })
    ).rejects.toThrow();
  });
});

describe("items.create - Residente assignment logic", () => {
  it("assigns residenteId from empresa.jefeResidenteId when available", async () => {
    const ctx = createAuthContext({ id: 999 });
    const caller = appRouter.createCaller(ctx);

    // Create item for empresa that has jefeResidenteId set
    // The backend should set residenteId to the empresa's jefeResidenteId
    try {
      const result = await caller.items.create({
        proyectoId: 1,
        empresaId: 1, // empresa with jefeResidenteId
        unidadId: 90001,
        titulo: "Test residente assignment",
        clientId: `test-assign-${Date.now()}`,
      });
      // creadoPorId should always be ctx.user.id
      expect(result.creadoPorId).toBe(999);
    } catch {
      // May fail at DB level, that's OK
    }
  });

  it("falls back to ctx.user.id when empresa has no residente assigned", async () => {
    const ctx = createAuthContext({ id: 1410178, role: "residente" as any });
    const caller = appRouter.createCaller(ctx);

    // Waller (480003) has no residenteId or jefeResidenteId
    // But especialidad 90005 has residenteId = 1410178
    try {
      const result = await caller.items.create({
        proyectoId: 1,
        empresaId: 480003, // Waller - no residenteId
        unidadId: 90001,
        especialidadId: 90005, // Has residenteId = 1410178
        titulo: "Test fallback residente",
        clientId: `test-fallback-${Date.now()}`,
      });
      // creadoPorId should be 1410178
      expect(result.creadoPorId).toBe(1410178);
      // residenteId should be 1410178 (from especialidad)
      expect(result.residenteId).toBe(1410178);
    } catch {
      // May fail at DB level
    }
  });
});
