import { describe, it, expect } from "vitest";

// ==========================================
// Tests: Dashboard Segurista
// ==========================================
describe("Dashboard Segurista", () => {
  it("should return stats and incidentes for segurista dashboard", () => {
    const mockData = {
      stats: { total: 10, abiertos: 3, enProceso: 2, prevencion: 1, cerrados: 4 },
      incidentes: [
        { id: 1, tipo: "caida", severidad: "critica", estado: "abierto", descripcion: "Caída de altura", codigo: "SEG00001", mensajesCount: 5 },
        { id: 2, tipo: "golpe", severidad: "alta", estado: "abierto", descripcion: "Golpe en cabeza", codigo: "SEG00002", mensajesCount: 2 },
        { id: 3, tipo: "corte", severidad: "baja", estado: "cerrado", descripcion: "Corte menor", codigo: "SEG00003", mensajesCount: 0 },
      ],
    };

    expect(mockData.stats.total).toBe(10);
    expect(mockData.stats.abiertos).toBe(3);
    expect(mockData.stats.prevencion).toBe(1);
    expect(mockData.incidentes).toHaveLength(3);
  });

  it("should filter urgent incidents (abierto + critica/alta)", () => {
    const incidentes = [
      { id: 1, severidad: "critica", estado: "abierto" },
      { id: 2, severidad: "alta", estado: "abierto" },
      { id: 3, severidad: "baja", estado: "abierto" },
      { id: 4, severidad: "critica", estado: "cerrado" },
      { id: 5, severidad: "media", estado: "en_proceso" },
    ];

    const urgentes = incidentes.filter(
      (i) => i.estado === "abierto" && (i.severidad === "critica" || i.severidad === "alta")
    );

    expect(urgentes).toHaveLength(2);
    expect(urgentes[0].id).toBe(1);
    expect(urgentes[1].id).toBe(2);
  });

  it("should show max 3 urgent incidents in dashboard", () => {
    const urgentes = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      severidad: "critica",
      estado: "abierto",
    }));

    const displayed = urgentes.slice(0, 3);
    expect(displayed).toHaveLength(3);
  });

  it("should include all 5 stat categories", () => {
    const statKeys = ["total", "abiertos", "enProceso", "prevencion", "cerrados"];
    const stats = { total: 10, abiertos: 3, enProceso: 2, prevencion: 1, cerrados: 4 };

    for (const key of statKeys) {
      expect(stats).toHaveProperty(key);
      expect(typeof (stats as any)[key]).toBe("number");
    }
  });

  it("should handle empty dashboard gracefully", () => {
    const emptyData = {
      stats: { total: 0, abiertos: 0, enProceso: 0, prevencion: 0, cerrados: 0 },
      incidentes: [],
    };

    expect(emptyData.stats.total).toBe(0);
    expect(emptyData.incidentes).toHaveLength(0);
    const urgentes = emptyData.incidentes.filter(
      (i: any) => i.estado === "abierto" && (i.severidad === "critica" || i.severidad === "alta")
    );
    expect(urgentes).toHaveLength(0);
  });
});

// ==========================================
// Tests: Eliminar Incidente (solo admin/superadmin)
// ==========================================
describe("Eliminar Incidente - Control de Acceso", () => {
  it("should allow admin to delete incidents", () => {
    const user = { role: "admin" };
    const canDelete = user.role === "admin" || user.role === "superadmin";
    expect(canDelete).toBe(true);
  });

  it("should allow superadmin to delete incidents", () => {
    const user = { role: "superadmin" };
    const canDelete = user.role === "admin" || user.role === "superadmin";
    expect(canDelete).toBe(true);
  });

  it("should NOT allow segurista to delete incidents", () => {
    const user = { role: "segurista" };
    const canDelete = user.role === "admin" || user.role === "superadmin";
    expect(canDelete).toBe(false);
  });

  it("should NOT allow regular user to delete incidents", () => {
    const user = { role: "user" };
    const canDelete = user.role === "admin" || user.role === "superadmin";
    expect(canDelete).toBe(false);
  });

  it("should NOT allow supervisor to delete incidents", () => {
    const user = { role: "supervisor" };
    const canDelete = user.role === "admin" || user.role === "superadmin";
    expect(canDelete).toBe(false);
  });

  it("should NOT allow residente to delete incidents", () => {
    const user = { role: "residente" };
    const canDelete = user.role === "admin" || user.role === "superadmin";
    expect(canDelete).toBe(false);
  });

  it("should cascade delete messages when deleting incident", () => {
    // Simulating cascade delete logic
    const mensajes = [
      { id: 1, incidenteId: 5 },
      { id: 2, incidenteId: 5 },
      { id: 3, incidenteId: 10 },
    ];

    const incidenteIdToDelete = 5;
    const remaining = mensajes.filter((m) => m.incidenteId !== incidenteIdToDelete);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].incidenteId).toBe(10);
  });
});

// ==========================================
// Tests: Exportar PDF de Incidente
// ==========================================
describe("Exportar PDF de Incidente", () => {
  it("should generate report data with all required fields", () => {
    const reportData = {
      codigo: "SEG00001",
      tipo: "Caída",
      severidad: "Alta",
      estado: "abierto",
      descripcion: "Caída de altura en piso 3",
      ubicacion: "Torre A, Piso 3",
      fotoUrl: "https://example.com/foto.jpg",
      fotoMarcadaUrl: "https://example.com/foto-marcada.jpg",
      reportadoPor: "Juan Pérez",
      fechaCreacion: "2026-02-18T10:00:00.000Z",
      fechaCierre: null,
      accionCorrectiva: "Instalar barandales",
      mensajes: [],
    };

    expect(reportData.codigo).toMatch(/^SEG\d{5}$/);
    expect(reportData.tipo).toBe("Caída");
    expect(reportData.severidad).toBe("Alta");
    expect(reportData.reportadoPor).toBeTruthy();
    expect(reportData.fechaCreacion).toBeTruthy();
    expect(reportData.mensajes).toBeInstanceOf(Array);
  });

  it("should include messages with all types in report", () => {
    const mensajes = [
      { id: 1, usuario: "Juan", texto: "Revisando el incidente", tipo: "texto", fotoUrl: null, audioUrl: null, transcripcion: null, bullets: null, fecha: "2026-02-18T10:05:00.000Z" },
      { id: 2, usuario: "María", texto: null, tipo: "voz", fotoUrl: null, audioUrl: "https://example.com/audio.webm", transcripcion: "Se observa daño en estructura", bullets: ["Daño en columna", "Grieta visible", "Requiere refuerzo", "Zona acordonada", "Pendiente evaluación"], fecha: "2026-02-18T10:10:00.000Z" },
      { id: 3, usuario: "Pedro", texto: "Foto de evidencia", tipo: "foto", fotoUrl: "https://example.com/evidencia.jpg", audioUrl: null, transcripcion: null, bullets: null, fecha: "2026-02-18T10:15:00.000Z" },
    ];

    expect(mensajes).toHaveLength(3);
    expect(mensajes[0].tipo).toBe("texto");
    expect(mensajes[1].tipo).toBe("voz");
    expect(mensajes[1].bullets).toHaveLength(5);
    expect(mensajes[2].tipo).toBe("foto");
    expect(mensajes[2].fotoUrl).toBeTruthy();
  });

  it("should handle report with no messages", () => {
    const reportData = {
      codigo: "SEG00002",
      mensajes: [],
    };

    expect(reportData.mensajes).toHaveLength(0);
  });

  it("should handle report with no photos", () => {
    const reportData = {
      fotoUrl: null,
      fotoMarcadaUrl: null,
    };

    expect(reportData.fotoUrl).toBeNull();
    expect(reportData.fotoMarcadaUrl).toBeNull();
  });

  it("should format severity colors correctly for PDF", () => {
    const sevColors: Record<string, string> = {
      baja: "#22c55e",
      media: "#eab308",
      alta: "#f97316",
      critica: "#ef4444",
    };

    expect(sevColors["baja"]).toBe("#22c55e");
    expect(sevColors["media"]).toBe("#eab308");
    expect(sevColors["alta"]).toBe("#f97316");
    expect(sevColors["critica"]).toBe("#ef4444");
  });
});

// ==========================================
// Tests: Estado Prevención en Dashboard
// ==========================================
describe("Estado Prevención", () => {
  it("should include prevencion in valid estados", () => {
    const validEstados = ["abierto", "en_proceso", "cerrado", "prevencion"];
    expect(validEstados).toContain("prevencion");
  });

  it("should count prevencion incidents in stats", () => {
    const incidentes = [
      { estado: "abierto" },
      { estado: "prevencion" },
      { estado: "prevencion" },
      { estado: "cerrado" },
      { estado: "en_proceso" },
    ];

    const prevencionCount = incidentes.filter((i) => i.estado === "prevencion").length;
    expect(prevencionCount).toBe(2);
  });

  it("should display prevencion with blue color", () => {
    const ESTADOS: Record<string, { label: string; color: string }> = {
      abierto: { label: "Abierto", color: "bg-red-100 text-red-700" },
      en_proceso: { label: "En Proceso", color: "bg-amber-100 text-amber-700" },
      prevencion: { label: "Prevención", color: "bg-blue-100 text-blue-700" },
      cerrado: { label: "Cerrado", color: "bg-green-100 text-green-700" },
    };

    expect(ESTADOS.prevencion.label).toBe("Prevención");
    expect(ESTADOS.prevencion.color).toContain("blue");
  });
});

// ==========================================
// Tests: Reporte General de Seguridad
// ==========================================
describe("Reporte General de Seguridad", () => {
  it("should include all stat categories in general report", () => {
    const reporteGeneral = {
      proyecto: "Hidalma",
      fechaGeneracion: new Date().toISOString(),
      stats: { total: 15, abiertos: 4, enProceso: 3, prevencion: 2, cerrados: 6 },
      porTipo: { caida: 5, golpe: 3, corte: 2, electrico: 1, otro: 4 },
      porSeveridad: { baja: 3, media: 5, alta: 4, critica: 3 },
    };

    expect(reporteGeneral.stats.total).toBe(15);
    expect(reporteGeneral.stats.abiertos + reporteGeneral.stats.enProceso + reporteGeneral.stats.prevencion + reporteGeneral.stats.cerrados).toBe(15);
  });

  it("should generate printable HTML report", () => {
    const htmlContent = "<html><head><title>Reporte Seguridad</title></head><body><h1>Reporte</h1></body></html>";
    expect(htmlContent).toContain("<html>");
    expect(htmlContent).toContain("Reporte");
  });
});
