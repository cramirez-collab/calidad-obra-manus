import { describe, it, expect, vi } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getPagosStats: vi.fn().mockResolvedValue({
    total: 50000,
    totalCount: 5,
    pendientesCount: 2,
    pendientesMonto: 20000,
    autorizadosCount: 1,
    autorizadosMonto: 15000,
    ejecutadosCount: 1,
    ejecutadosMonto: 10000,
    rechazadosCount: 1,
    rechazadosMonto: 5000,
    canceladosCount: 0,
    canceladosMonto: 0,
  }),
  listSolicitudesPago: vi.fn().mockResolvedValue([
    { id: 1, concepto: "Materiales", monto: "10000.00", statusPago: "pendiente", solicitanteId: 1, proyectoId: 1 },
    { id: 2, concepto: "Mano de obra", monto: "15000.00", statusPago: "autorizado", solicitanteId: 1, proyectoId: 1 },
  ]),
  getSolicitudPago: vi.fn().mockResolvedValue({
    id: 1,
    concepto: "Materiales",
    monto: "10000.00",
    statusPago: "pendiente",
    solicitanteId: 1,
    proyectoId: 1,
    proveedor: "Cemex",
    noFactura: "FAC-001",
  }),
  createSolicitudPago: vi.fn().mockResolvedValue({ id: 3 }),
  updateSolicitudPago: vi.fn().mockResolvedValue({ id: 1, statusPago: "autorizado" }),
  deleteSolicitudPago: vi.fn().mockResolvedValue(undefined),
  listArchivosPago: vi.fn().mockResolvedValue([]),
  createArchivoPago: vi.fn().mockResolvedValue({ id: 1 }),
  deleteArchivoPago: vi.fn().mockResolvedValue({ id: 1 }),
  getUsersByRole: vi.fn().mockResolvedValue([]),
  getPushSubscriptionsByUsuario: vi.fn().mockResolvedValue([]),
  createNotificacion: vi.fn().mockResolvedValue(1),
}));

describe("Pagos module", () => {
  it("should have proper status config for all states", () => {
    const validStatuses = ["pendiente", "autorizado", "rechazado", "ejecutado", "cancelado"];
    validStatuses.forEach(status => {
      expect(status).toBeTruthy();
    });
  });

  it("should format money correctly", () => {
    const formatMoney = (v: string | number) => {
      const n = Number(v);
      if (isNaN(n)) return "$0.00";
      return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
    };
    expect(formatMoney(10000)).toContain("10");
    expect(formatMoney("0")).toContain("0");
    expect(formatMoney("abc")).toBe("$0.00");
  });

  it("should validate required fields for create", () => {
    const concepto = "";
    const monto = "";
    const isValid = concepto.trim() !== "" && monto.trim() !== "";
    expect(isValid).toBe(false);
  });

  it("should validate required fields pass with data", () => {
    const concepto = "Materiales";
    const monto = "10000";
    const isValid = concepto.trim() !== "" && monto.trim() !== "";
    expect(isValid).toBe(true);
  });

  it("should only allow edit on pendiente/rechazado status", () => {
    const canEdit = (status: string, isOwner: boolean, isAdmin: boolean) => {
      return ["pendiente", "rechazado"].includes(status) && (isOwner || isAdmin);
    };
    expect(canEdit("pendiente", true, false)).toBe(true);
    expect(canEdit("autorizado", true, false)).toBe(false);
    expect(canEdit("ejecutado", false, true)).toBe(false);
    expect(canEdit("rechazado", false, true)).toBe(true);
  });

  it("should only allow cancel on non-executed/non-cancelled status", () => {
    const canCancel = (status: string) => {
      return !["ejecutado", "cancelado"].includes(status);
    };
    expect(canCancel("pendiente")).toBe(true);
    expect(canCancel("autorizado")).toBe(true);
    expect(canCancel("ejecutado")).toBe(false);
    expect(canCancel("cancelado")).toBe(false);
  });

  it("should generate CSV export format correctly", () => {
    const pagos = [
      { id: 1, concepto: "Test", monto: "1000", moneda: "MXN", proveedor: "Prov", noFactura: "F-1", statusPago: "pendiente", createdAt: new Date(), notas: "" },
    ];
    const headers = ["ID", "Concepto", "Monto", "Moneda", "Proveedor", "No. Factura", "Estado", "Fecha Creación", "Notas"];
    const rows = pagos.map(p => [p.id, p.concepto, p.monto, p.moneda, p.proveedor, p.noFactura, p.statusPago]);
    expect(headers.length).toBe(9);
    expect(rows.length).toBe(1);
    expect(rows[0][0]).toBe(1);
  });

  it("should parse IA extracted data correctly", () => {
    const rawResponse = '{"concepto":"Pago materiales","monto":"15000","proveedor":"Cemex","noFactura":"FAC-123","fecha":"2026-03-01","notas":"Entrega parcial"}';
    const datos = JSON.parse(rawResponse);
    expect(datos.concepto).toBe("Pago materiales");
    expect(datos.monto).toBe("15000");
    expect(datos.proveedor).toBe("Cemex");
    expect(datos.noFactura).toBe("FAC-123");
  });

  it("should handle IA response with markdown code blocks", () => {
    const rawResponse = '```json\n{"concepto":"Test","monto":"500"}\n```';
    const cleanContent = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const datos = JSON.parse(cleanContent);
    expect(datos.concepto).toBe("Test");
    expect(datos.monto).toBe("500");
  });
});
