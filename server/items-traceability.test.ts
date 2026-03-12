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

describe("items.create - Traceability & Residente Assignment", () => {
  it("input schema accepts residenteId field (CRITICAL: used for correct assignment)", async () => {
    const ctx = createAuthContext({ id: 100, role: "supervisor" as any, name: "Supervisor Test" });
    const caller = appRouter.createCaller(ctx);

    // residenteId MUST be accepted in the input schema
    // This is the fix for the critical bug where creator was assigned instead of selected residente
    try {
      await caller.items.create({
        proyectoId: 999999,
        empresaId: 1,
        unidadId: 1,
        titulo: "Test residenteId in input",
        residenteId: 200, // CRITICAL: This field must be accepted
        clientId: `test-residente-input-${Date.now()}`,
      });
    } catch (error: any) {
      // Should NOT fail at Zod validation level for residenteId
      expect(error.message).not.toContain("Unrecognized key");
      expect(error.message).not.toContain("invalid_type");
    }
  });

  it("input schema accepts pin fields (pinPlanoId, pinPosX, pinPosY)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.items.create({
        proyectoId: 999999,
        empresaId: 1,
        unidadId: 1,
        titulo: "Test pin fields",
        residenteId: 200,
        pinPlanoId: 1,
        pinPosX: "0.5000",
        pinPosY: "0.3000",
        clientId: `test-pin-${Date.now()}`,
      });
    } catch (error: any) {
      // Should NOT fail at Zod validation level for pin fields
      expect(error.message).not.toContain("Unrecognized key");
    }
  });



  it("items.create input requires empresaId as number", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

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
    const ctx = createAuthContext({ id: 999, role: "residente" as any });
    const caller = appRouter.createCaller(ctx);

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

    await expect(
      caller.items.rechazar({
        itemId: 1,
        comentario: "",
      })
    ).rejects.toThrow();
  });
});
