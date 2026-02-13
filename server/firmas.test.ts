import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
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

describe("firmas - firmantesReporte", () => {
  it("firmantesReporte returns empresaId for each empresa", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Call firmantesReporte - it should return data (may be empty if no empresas in test DB)
    const result = await caller.estadisticas.firmantesReporte({ proyectoId: 1 });

    // Verify the result is an array
    expect(Array.isArray(result)).toBe(true);

    // If there are results, verify each item has empresaId as a number
    for (const item of result) {
      expect(item).toHaveProperty("empresaId");
      expect(typeof item.empresaId).toBe("number");
      expect(item).toHaveProperty("empresaNombre");
      expect(typeof item.empresaNombre).toBe("string");
      expect(item).toHaveProperty("jefeEmail");
      // jefeEmail should be a string (may be empty)
      expect(typeof item.jefeEmail).toBe("string");
    }
  });

  it("crearParaReporte validates empresaId is required number", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Attempt to create with undefined empresaId should throw validation error
    await expect(
      caller.firmas.crearParaReporte({
        proyectoId: 1,
        reporteId: "RPT-test-123",
        empresas: [
          {
            empresaId: undefined as any,
            empresaNombre: "Test Empresa",
          },
        ],
      })
    ).rejects.toThrow();
  });

  it("crearParaReporte accepts valid empresaId number", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // This should not throw a validation error (may fail at DB level but not at Zod level)
    try {
      await caller.firmas.crearParaReporte({
        proyectoId: 999999,
        reporteId: `RPT-test-${Date.now()}`,
        empresas: [
          {
            empresaId: 1,
            empresaNombre: "Test Empresa",
            contactoNombre: "Test Contact",
            contactoEmail: "test@test.com",
          },
        ],
      });
    } catch (error: any) {
      // If it throws, it should NOT be a Zod validation error about empresaId
      expect(error.message).not.toContain("expected number, received undefined");
      expect(error.message).not.toContain("invalid_type");
    }
  });
});
