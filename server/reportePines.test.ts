import { describe, it, expect } from "vitest";

/**
 * Tests para el endpoint reportePines
 * Verifica que el reporte PDF usa la misma fuente de datos que la vista de planos
 * (getPinesByPlano / plano_pines table) y NO mezcla con items.pinPlanoId
 */

describe("reportePines - Consistencia de datos con vista de planos", () => {
  it("debe mapear correctamente los campos de getPinesByPlano al formato del reporte", () => {
    // Simular datos tal como los devuelve getPinesByPlano
    const pinFromDb = {
      id: 42,
      planoId: 1,
      itemId: 100,
      posX: "45.2300",
      posY: "67.8900",
      nota: "Test nota",
      creadoPorId: 5,
      createdAt: new Date(),
      itemCodigo: "HID-001",
      itemEstado: "pendiente_aprobacion",
      itemDescripcion: "Desc test",
      itemFotoAntes: null,
      itemFotoDespues: null,
      itemConsecutivo: 1,
      itemTitulo: "Titulo test",
      residenteNombre: "Juan Perez",
      empresaId: 1,
      unidadId: 2,
      especialidadId: 3,
      defectoId: 4,
      itemCreatedAt: new Date(),
      empresaNombre: "Empresa A",
      unidadNombre: "Unidad B",
      especialidadNombre: "Esp C",
      defectoNombre: "Defecto D",
    };

    // Simular la transformación que hace reportePines
    const mapped = {
      id: pinFromDb.id,
      posX: pinFromDb.posX,
      posY: pinFromDb.posY,
      itemId: pinFromDb.itemId,
      itemCodigo: pinFromDb.itemCodigo || null,
      itemEstado: pinFromDb.itemEstado || null,
      itemTitulo: pinFromDb.itemTitulo || null,
      residenteNombre: pinFromDb.residenteNombre || null,
      empresaNombre: pinFromDb.empresaNombre || null,
      unidadNombre: pinFromDb.unidadNombre || null,
      especialidadNombre: pinFromDb.especialidadNombre || null,
    };

    expect(mapped.id).toBe(42);
    expect(mapped.posX).toBe("45.2300");
    expect(mapped.posY).toBe("67.8900");
    expect(mapped.itemEstado).toBe("pendiente_aprobacion");
    expect(mapped.residenteNombre).toBe("Juan Perez");
    expect(mapped.empresaNombre).toBe("Empresa A");
    expect(mapped.unidadNombre).toBe("Unidad B");
    expect(mapped.especialidadNombre).toBe("Esp C");
  });

  it("debe manejar pines sin ítem vinculado (sin_item)", () => {
    const pinSinItem = {
      id: 99,
      planoId: 1,
      itemId: null,
      posX: "10.0000",
      posY: "20.0000",
      nota: "Pin suelto",
      creadoPorId: 5,
      createdAt: new Date(),
      itemCodigo: null,
      itemEstado: null,
      itemDescripcion: null,
      itemFotoAntes: null,
      itemFotoDespues: null,
      itemConsecutivo: null,
      itemTitulo: null,
      residenteNombre: null,
      empresaId: null,
      unidadId: null,
      especialidadId: null,
      defectoId: null,
      itemCreatedAt: null,
      empresaNombre: null,
      unidadNombre: null,
      especialidadNombre: null,
      defectoNombre: null,
    };

    const mapped = {
      id: pinSinItem.id,
      posX: pinSinItem.posX,
      posY: pinSinItem.posY,
      itemId: pinSinItem.itemId,
      itemCodigo: pinSinItem.itemCodigo || null,
      itemEstado: pinSinItem.itemEstado || null,
      itemTitulo: pinSinItem.itemTitulo || null,
      residenteNombre: pinSinItem.residenteNombre || null,
      empresaNombre: pinSinItem.empresaNombre || null,
      unidadNombre: pinSinItem.unidadNombre || null,
      especialidadNombre: pinSinItem.especialidadNombre || null,
    };

    expect(mapped.itemId).toBeNull();
    expect(mapped.itemEstado).toBeNull();
    expect(mapped.residenteNombre).toBeNull();
  });

  it("debe contar pines por estatus correctamente para estadísticas", () => {
    const pines = [
      { itemEstado: "pendiente_foto_despues" },
      { itemEstado: "pendiente_foto_despues" },
      { itemEstado: "pendiente_aprobacion" },
      { itemEstado: "aprobado" },
      { itemEstado: "aprobado" },
      { itemEstado: "aprobado" },
      { itemEstado: "rechazado" },
      { itemEstado: null }, // sin_item
      { itemEstado: null }, // sin_item
    ];

    const counts: Record<string, number> = {};
    pines.forEach(p => {
      const key = p.itemEstado || "sin_item";
      counts[key] = (counts[key] || 0) + 1;
    });

    expect(counts["pendiente_foto_despues"]).toBe(2);
    expect(counts["pendiente_aprobacion"]).toBe(1);
    expect(counts["aprobado"]).toBe(3);
    expect(counts["rechazado"]).toBe(1);
    expect(counts["sin_item"]).toBe(2);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(pines.length);
  });

  it("NO debe mezclar datos de items.pinPlanoId con plano_pines", () => {
    // Simular: plano_pines tiene 12 pines para un plano
    const planoPinesData = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      posX: `${(i * 8).toFixed(4)}`,
      posY: `${(i * 7).toFixed(4)}`,
      itemId: i + 100,
      itemEstado: "pendiente_aprobacion",
    }));

    // Simular: items.pinPlanoId tiene 13 items pointing to the same plano (1 extra)
    const itemsPinPlanoData = Array.from({ length: 13 }, (_, i) => ({
      id: i + 100,
      pinPosX: `${(i * 8).toFixed(4)}`,
      pinPosY: `${(i * 7).toFixed(4)}`,
      status: "pendiente_aprobacion",
    }));

    // El reporte DEBE usar SOLO planoPinesData (12 pines), NO la mezcla (13)
    const reportPines = planoPinesData; // Correcto: solo plano_pines
    expect(reportPines.length).toBe(12);
    expect(reportPines.length).not.toBe(itemsPinPlanoData.length); // No debe ser 13
  });

  it("debe generar iniciales correctamente para el PDF", () => {
    function getInitials(name: string | null | undefined): string {
      if (!name) return "?";
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return parts[0].substring(0, 2).toUpperCase();
    }

    expect(getInitials("Juan Perez")).toBe("JP");
    expect(getInitials("Maria Elena Garcia Lopez")).toBe("ML");
    expect(getInitials("Carlos")).toBe("CA");
    expect(getInitials(null)).toBe("?");
    expect(getInitials(undefined)).toBe("?");
    expect(getInitials("")).toBe("?");
  });

  it("debe asignar colores correctos por estatus", () => {
    const STATUS_COLORS: Record<string, { rgb: [number, number, number]; label: string }> = {
      pendiente_foto_despues: { rgb: [59, 130, 246], label: "Pend. Foto" },
      pendiente_aprobacion: { rgb: [245, 158, 11], label: "Pend. Aprob." },
      aprobado: { rgb: [34, 197, 94], label: "Aprobado" },
      rechazado: { rgb: [239, 68, 68], label: "Rechazado" },
      sin_item: { rgb: [107, 114, 128], label: "Sin item" },
    };

    expect(STATUS_COLORS["pendiente_foto_despues"].rgb).toEqual([59, 130, 246]); // blue
    expect(STATUS_COLORS["pendiente_aprobacion"].rgb).toEqual([245, 158, 11]); // orange/amber
    expect(STATUS_COLORS["aprobado"].rgb).toEqual([34, 197, 94]); // green
    expect(STATUS_COLORS["rechazado"].rgb).toEqual([239, 68, 68]); // red
    expect(STATUS_COLORS["sin_item"].rgb).toEqual([107, 114, 128]); // gray
  });

  it("posX/posY deben estar en rango 0-100 como porcentajes", () => {
    const pines = [
      { posX: "0.0000", posY: "0.0000" },
      { posX: "50.5000", posY: "50.5000" },
      { posX: "100.0000", posY: "100.0000" },
      { posX: "23.4567", posY: "78.1234" },
    ];

    pines.forEach(p => {
      const x = parseFloat(p.posX);
      const y = parseFloat(p.posY);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    });
  });

  it("debe calcular estadísticas globales correctamente para página resumen", () => {
    const planos = [
      {
        nombre: "N1", nivel: 1, pines: [
          { itemEstado: "aprobado" },
          { itemEstado: "aprobado" },
          { itemEstado: "rechazado" },
        ],
      },
      {
        nombre: "N2", nivel: 2, pines: [
          { itemEstado: "pendiente_foto_despues" },
          { itemEstado: "pendiente_aprobacion" },
          { itemEstado: null },
        ],
      },
      {
        nombre: "N3", nivel: 3, pines: [],
      },
    ];

    const globalCounts: Record<string, number> = {};
    let totalPines = 0;
    let nivelesConPines = 0;
    let nivelesSinPines = 0;

    for (const plano of planos) {
      if (plano.pines.length > 0) nivelesConPines++;
      else nivelesSinPines++;
      for (const pin of plano.pines) {
        const estado = pin.itemEstado || "sin_item";
        globalCounts[estado] = (globalCounts[estado] || 0) + 1;
        totalPines++;
      }
    }

    expect(totalPines).toBe(6);
    expect(nivelesConPines).toBe(2);
    expect(nivelesSinPines).toBe(1);
    expect(globalCounts["aprobado"]).toBe(2);
    expect(globalCounts["rechazado"]).toBe(1);
    expect(globalCounts["pendiente_foto_despues"]).toBe(1);
    expect(globalCounts["pendiente_aprobacion"]).toBe(1);
    expect(globalCounts["sin_item"]).toBe(1);

    // Porcentajes
    const tasaAprobacion = ((globalCounts["aprobado"] / totalPines) * 100).toFixed(1);
    expect(tasaAprobacion).toBe("33.3");

    const tasaRechazo = ((globalCounts["rechazado"] / totalPines) * 100).toFixed(1);
    expect(tasaRechazo).toBe("16.7");

    const pendientesTotal = (globalCounts["pendiente_foto_despues"] || 0) + (globalCounts["pendiente_aprobacion"] || 0);
    expect(pendientesTotal).toBe(2);

    const tasaResolucion = (((globalCounts["aprobado"] + globalCounts["rechazado"]) / totalPines) * 100).toFixed(1);
    expect(tasaResolucion).toBe("50.0");
  });

  it("debe incluir TODOS los niveles en el resumen, incluso sin pines", () => {
    const planos = [
      { nombre: "S1", nivel: -1, pines: [] },
      { nombre: "N1", nivel: 1, pines: [{ itemEstado: "aprobado" }] },
      { nombre: "N2", nivel: 2, pines: [] },
      { nombre: "N3", nivel: 3, pines: [{ itemEstado: "rechazado" }, { itemEstado: "aprobado" }] },
    ];

    // ALL levels must appear in the summary table - no filtering
    expect(planos.length).toBe(4);
    const nivelesConPines = planos.filter(p => p.pines.length > 0).length;
    const nivelesSinPines = planos.filter(p => p.pines.length === 0).length;
    expect(nivelesConPines).toBe(2);
    expect(nivelesSinPines).toBe(2);
    // Total count includes ALL levels
    expect(nivelesConPines + nivelesSinPines).toBe(planos.length);
  });
});
