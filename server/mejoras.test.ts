import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: string = "admin"): { ctx: TrpcContext } {
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

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("Notificaciones Router", () => {
  it("debe tener endpoint para listar notificaciones", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    // Verificar que el endpoint existe y es callable
    expect(caller.notificaciones.list).toBeDefined();
  });

  it("debe tener endpoint para contar notificaciones no leídas", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.notificaciones.count).toBeDefined();
  });

  it("debe tener endpoint para marcar notificación como leída", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.notificaciones.marcarLeida).toBeDefined();
  });

  it("debe tener endpoint para marcar todas las notificaciones como leídas", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.notificaciones.marcarTodasLeidas).toBeDefined();
  });
});

describe("Comentarios Router", () => {
  it("debe tener endpoint para listar comentarios por ítem", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.comentarios.byItem).toBeDefined();
  });

  it("debe tener endpoint para crear comentario", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.comentarios.create).toBeDefined();
  });
});

describe("Estadísticas Router", () => {
  it("debe tener endpoint de estadísticas generales", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.estadisticas.general).toBeDefined();
  });
});
