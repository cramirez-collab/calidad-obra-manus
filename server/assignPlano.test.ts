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

describe("items.updatePin", () => {
  it("should accept valid pin update input with planoId and positions", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // This tests that the procedure accepts the correct input shape
    // The actual DB call may fail in test env, but input validation should pass
    try {
      await caller.items.updatePin({
        itemId: 999999, // non-existent item, but input validation passes
        pinPlanoId: 1,
        pinPosX: "45.5000",
        pinPosY: "32.1000",
      });
    } catch (e: any) {
      // DB error is expected since item doesn't exist in test env
      // But we should NOT get a ZodError (input validation error)
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("should accept null values for clearing pin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.items.updatePin({
        itemId: 999999,
        pinPlanoId: null,
        pinPosX: null,
        pinPosY: null,
      });
    } catch (e: any) {
      // DB error expected, but input validation should pass
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });
});

describe("planos.pines.crear", () => {
  it("should accept valid pin creation input with itemId", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.planos.pines.crear({
        planoId: 1,
        itemId: 999999,
        posX: "45.5000",
        posY: "32.1000",
      });
    } catch (e: any) {
      // DB error expected, but input validation should pass
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("should accept pin creation without itemId", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.planos.pines.crear({
        planoId: 1,
        posX: "45.5000",
        posY: "32.1000",
        nota: "Test pin",
      });
    } catch (e: any) {
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });
});
