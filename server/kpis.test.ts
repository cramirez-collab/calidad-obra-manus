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

describe("KPIs Router", () => {
  it("debe tener endpoint de KPIs disponible", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.estadisticas.kpis).toBeDefined();
  });

  it("debe aceptar filtros opcionales en KPIs", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    // Verificar que el endpoint acepta filtros
    const result = await caller.estadisticas.kpis({
      empresaId: 1,
      unidadId: 1,
    });
    
    // El resultado puede ser null si no hay datos, pero no debe lanzar error
    expect(result === null || typeof result === 'object').toBe(true);
  });

  it("debe retornar estructura correcta de KPIs", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.estadisticas.kpis({});
    
    if (result) {
      // Verificar estructura del resumen
      expect(result).toHaveProperty('resumen');
      expect(result).toHaveProperty('rendimientoSupervisores');
      expect(result).toHaveProperty('tendenciaMensual');
      expect(result).toHaveProperty('comparativaEmpresas');
      expect(result).toHaveProperty('comparativaUnidades');
    }
  });
});

describe("Email Service", () => {
  it("debe tener plantillas de email disponibles", async () => {
    const { getAprobadoEmailTemplate, getRechazadoEmailTemplate, getPendienteAprobacionEmailTemplate } = await import("./emailService");
    
    // Verificar que las plantillas generan HTML válido
    const aprobadoHtml = getAprobadoEmailTemplate("Test Item", "TEST-001", "Supervisor");
    expect(aprobadoHtml).toContain("Ítem Aprobado");
    expect(aprobadoHtml).toContain("Test Item");
    expect(aprobadoHtml).toContain("TEST-001");
    
    const rechazadoHtml = getRechazadoEmailTemplate("Test Item", "TEST-001", "Supervisor", "Motivo de rechazo");
    expect(rechazadoHtml).toContain("Ítem Rechazado");
    expect(rechazadoHtml).toContain("Motivo de rechazo");
    
    const pendienteHtml = getPendienteAprobacionEmailTemplate("Test Item", "TEST-001", "Residente");
    expect(pendienteHtml).toContain("Pendiente de Aprobación");
    expect(pendienteHtml).toContain("Residente");
  });
});

describe("Estadísticas Router", () => {
  it("debe tener endpoint general de estadísticas", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.estadisticas.general).toBeDefined();
  });

  it("debe permitir filtros en estadísticas generales", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    // No debe lanzar error con filtros vacíos
    const result = await caller.estadisticas.general({});
    expect(result).toBeDefined();
  });
});
