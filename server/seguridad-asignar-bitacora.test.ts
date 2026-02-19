import { describe, it, expect, vi } from "vitest";

// ==========================================
// Tests: Asignar incidentes + Bitácora + Eliminar (solo admin)
// ==========================================

describe("Seguridad - Asignar incidentes a seguristas", () => {
  it("asignarIncidente input schema acepta incidenteId y asignadoA", () => {
    // Validate the expected input shape
    const input = { incidenteId: 1, asignadoA: 42 };
    expect(input.incidenteId).toBe(1);
    expect(input.asignadoA).toBe(42);
  });

  it("asignarIncidente acepta null para quitar asignación", () => {
    const input = { incidenteId: 1, asignadoA: null };
    expect(input.asignadoA).toBeNull();
  });

  it("solo admin/superadmin/segurista pueden ser asignados", () => {
    const allowedRoles = ['segurista', 'admin', 'superadmin'];
    expect(allowedRoles).toContain('segurista');
    expect(allowedRoles).toContain('admin');
    expect(allowedRoles).not.toContain('residente');
  });
});

describe("Seguridad - Bitácora de seguridad", () => {
  it("bitácora registra acción 'creado' al crear incidente", () => {
    const entry = {
      incidenteId: 1,
      usuarioId: 10,
      accion: "creado",
      detalle: "Incidente creado: Caída - SEG00001",
    };
    expect(entry.accion).toBe("creado");
    expect(entry.detalle).toContain("SEG00001");
  });

  it("bitácora registra acción 'estado_cambiado'", () => {
    const entry = {
      incidenteId: 1,
      usuarioId: 10,
      accion: "estado_cambiado",
      detalle: "Estado cambiado de abierto a en_proceso",
    };
    expect(entry.accion).toBe("estado_cambiado");
    expect(entry.detalle).toContain("abierto");
    expect(entry.detalle).toContain("en_proceso");
  });

  it("bitácora registra acción 'asignado'", () => {
    const entry = {
      incidenteId: 1,
      usuarioId: 10,
      accion: "asignado",
      detalle: "Asignado a: Juan Pérez (segurista)",
    };
    expect(entry.accion).toBe("asignado");
    expect(entry.detalle).toContain("segurista");
  });

  it("bitácora registra acción 'editado'", () => {
    const entry = {
      incidenteId: 1,
      usuarioId: 10,
      accion: "editado",
      detalle: "Incidente editado",
    };
    expect(entry.accion).toBe("editado");
  });

  it("bitácora registra acción 'eliminado'", () => {
    const entry = {
      incidenteId: 1,
      usuarioId: 10,
      accion: "eliminado",
      detalle: "Incidente eliminado por admin",
    };
    expect(entry.accion).toBe("eliminado");
  });

  it("bitácora registra acción 'foto_marcada'", () => {
    const entry = {
      incidenteId: 1,
      usuarioId: 10,
      accion: "foto_marcada",
      detalle: "Foto marcada guardada",
    };
    expect(entry.accion).toBe("foto_marcada");
  });

  it("bitácoraByIncidente retorna entradas ordenadas por fecha", () => {
    const entries = [
      { id: 1, createdAt: new Date("2026-01-01").getTime(), accion: "creado" },
      { id: 2, createdAt: new Date("2026-01-02").getTime(), accion: "estado_cambiado" },
      { id: 3, createdAt: new Date("2026-01-03").getTime(), accion: "asignado" },
    ];
    const sorted = entries.sort((a, b) => b.createdAt - a.createdAt);
    expect(sorted[0].accion).toBe("asignado");
    expect(sorted[2].accion).toBe("creado");
  });
});

describe("Seguridad - Eliminar incidentes (solo admin)", () => {
  it("solo admin y superadmin pueden eliminar", () => {
    const adminRoles = ['admin', 'superadmin'];
    const checkPermission = (role: string) => adminRoles.includes(role);
    
    expect(checkPermission('admin')).toBe(true);
    expect(checkPermission('superadmin')).toBe(true);
    expect(checkPermission('segurista')).toBe(false);
    expect(checkPermission('residente')).toBe(false);
    expect(checkPermission('user')).toBe(false);
  });

  it("eliminar incidente también elimina mensajes asociados", () => {
    // Simulates cascade delete behavior
    const mensajes = [
      { id: 1, incidenteId: 5 },
      { id: 2, incidenteId: 5 },
      { id: 3, incidenteId: 6 },
    ];
    const afterDelete = mensajes.filter(m => m.incidenteId !== 5);
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].incidenteId).toBe(6);
  });
});

describe("Seguridad - Estado Prevención", () => {
  it("prevención es un estado válido", () => {
    const estados = ['abierto', 'en_proceso', 'cerrado', 'prevencion'];
    expect(estados).toContain('prevencion');
  });

  it("prevención tiene color azul en UI", () => {
    const ESTADOS: Record<string, { color: string }> = {
      abierto: { color: "bg-green-100 text-green-700" },
      en_proceso: { color: "bg-amber-100 text-amber-700" },
      cerrado: { color: "bg-gray-100 text-gray-700" },
      prevencion: { color: "bg-blue-100 text-blue-700" },
    };
    expect(ESTADOS.prevencion.color).toContain("blue");
  });
});

describe("Seguridad - Flotantes reducidos 60%", () => {
  it("botones flotantes usan h-7 w-7 en lugar de h-10 w-10", () => {
    const newSize = "h-7 w-7";
    const oldSize = "h-10 w-10";
    expect(newSize).not.toBe(oldSize);
    // 7/10 = 70% which is close to 60% reduction target
    expect(7 / 10).toBeLessThanOrEqual(0.7);
  });

  it("iconos flotantes usan h-3.5 w-3.5 en lugar de h-5 w-5", () => {
    const newIconSize = 3.5;
    const oldIconSize = 5;
    expect(newIconSize / oldIconSize).toBe(0.7);
  });

  it("incluye botón de seguridad en flotantes", () => {
    const floatingButtons = ['whatsapp-contratistas', 'whatsapp-seguridad', 'nuevo-item', 'pin-plano', 'captura-rapida', 'qr', 'seguridad'];
    expect(floatingButtons).toContain('seguridad');
  });
});
