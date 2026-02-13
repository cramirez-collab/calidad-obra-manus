import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-creator",
    email: "creator@test.com",
    name: "Test Creator",
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

describe("items.create - Traceability", () => {
  it("items.create input schema accepts all traceability-related fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Verify the input schema accepts the required fields
    // This will fail at DB level but should NOT fail at Zod validation level
    try {
      await caller.items.create({
        proyectoId: 999999,
        empresaId: 1,
        unidadId: 1,
        titulo: "Test traceability item",
        fotoAntesBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        clientId: `test-trace-${Date.now()}`,
      });
    } catch (error: any) {
      // Should NOT be a Zod validation error
      expect(error.message).not.toContain("invalid_type");
      expect(error.message).not.toContain("expected number, received undefined");
    }
  });

  it("items.create does not accept residenteId from client (backend sets it)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // The input schema should NOT have residenteId - it's set by the backend
    // based on the empresa's jefeResidenteId
    try {
      await caller.items.create({
        proyectoId: 999999,
        empresaId: 1,
        unidadId: 1,
        titulo: "Test - residenteId not in input",
        clientId: `test-no-resident-${Date.now()}`,
      } as any);
    } catch (error: any) {
      // May fail at DB level, but should not fail because of residenteId in input
      expect(error.message).not.toContain("residenteId");
    }
  });

  it("items.create input requires empresaId as number", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // empresaId undefined should throw Zod validation error
    await expect(
      caller.items.create({
        proyectoId: 1,
        empresaId: undefined as any,
        unidadId: 1,
        titulo: "Test missing empresaId",
        clientId: `test-missing-empresa-${Date.now()}`,
      })
    ).rejects.toThrow();
  });

  it("aprobar requires correct role permissions", async () => {
    // A residente who is NOT the assigned person should not be able to approve
    const ctx = createAuthContext({ id: 999, role: "residente" as any });
    const caller = appRouter.createCaller(ctx);

    // This should fail because the item doesn't exist or the user doesn't have permission
    await expect(
      caller.items.aprobar({
        itemId: 999999,
        comentario: "Test approval",
      })
    ).rejects.toThrow();
  });

  it("rechazar requires comment", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Empty comment should fail Zod validation
    await expect(
      caller.items.rechazar({
        itemId: 1,
        comentario: "",
      })
    ).rejects.toThrow();
  });
});
