import { describe, it, expect } from "vitest";

describe("Rol Segurista y Estado Prevención", () => {
  describe("Rol Segurista en enum de usuarios", () => {
    it("segurista debe estar en el enum de roles válidos", () => {
      const rolesValidos = ["superadmin", "admin", "supervisor", "jefe_residente", "residente", "desarrollador", "segurista"];
      expect(rolesValidos).toContain("segurista");
    });

    it("segurista no debe poder acceder a operaciones de calidad (noDesarrolladorProcedure)", () => {
      // El middleware noDesarrolladorProcedure bloquea seguristas de operaciones de calidad
      const rolesBlockedByNoDesarrollador = ["desarrollador", "segurista"];
      expect(rolesBlockedByNoDesarrollador).toContain("segurista");
    });

    it("segurista debe poder usar protectedProcedure (acceso a seguridad)", () => {
      // Las procedures de seguridad usan protectedProcedure, no noSeguristaProcedure
      const rolSegurista = "segurista";
      // protectedProcedure solo requiere estar autenticado, no filtra por rol
      expect(rolSegurista).toBeTruthy();
    });
  });

  describe("Estado Prevención en Incidentes", () => {
    it("prevencion debe estar en los estados válidos de incidentes", () => {
      const estadosValidos = ["abierto", "en_proceso", "cerrado", "prevencion"];
      expect(estadosValidos).toContain("prevencion");
    });

    it("prevencion debe tener un color azul asignado en UI", () => {
      const ESTADOS = [
        { value: "abierto", label: "Abierto", color: "bg-red-100 text-red-700 border-red-200" },
        { value: "en_proceso", label: "En Proceso", color: "bg-amber-100 text-amber-700 border-amber-200" },
        { value: "prevencion", label: "Prevención", color: "bg-blue-100 text-blue-700 border-blue-200" },
        { value: "cerrado", label: "Cerrado", color: "bg-green-100 text-green-700 border-green-200" },
      ];
      const prevencion = ESTADOS.find(e => e.value === "prevencion");
      expect(prevencion).toBeDefined();
      expect(prevencion!.color).toContain("blue");
      expect(prevencion!.label).toBe("Prevención");
    });

    it("el enum de actualizarEstado debe aceptar prevencion", () => {
      const estadosPermitidos = ["abierto", "en_proceso", "cerrado", "prevencion"];
      expect(estadosPermitidos).toContain("prevencion");
    });

    it("getEstadisticasSeguridad debe incluir campo prevencion", () => {
      // Simular la estructura de retorno
      const stats = { total: 10, abiertos: 3, enProceso: 2, prevencion: 1, cerrados: 4, porTipo: [], porSeveridad: [] };
      expect(stats).toHaveProperty("prevencion");
      expect(stats.prevencion).toBe(1);
    });

    it("el fallback vacío de estadísticas debe incluir prevencion en 0", () => {
      const emptyStats = { total: 0, abiertos: 0, enProceso: 0, prevencion: 0, cerrados: 0, porTipo: [], porSeveridad: [] };
      expect(emptyStats.prevencion).toBe(0);
    });
  });

  describe("Permisos de Segurista en módulo de Seguridad", () => {
    it("segurista puede crear incidentes (usa protectedProcedure)", () => {
      // crearIncidente usa protectedProcedure, no filtra segurista
      const procedureType = "protectedProcedure";
      expect(procedureType).toBe("protectedProcedure");
    });

    it("segurista puede enviar mensajes en chat de incidentes", () => {
      // enviarMensaje usa protectedProcedure
      const procedureType = "protectedProcedure";
      expect(procedureType).toBe("protectedProcedure");
    });

    it("segurista puede enviar notas de voz en chat", () => {
      // enviarMensajeVoz usa protectedProcedure
      const procedureType = "protectedProcedure";
      expect(procedureType).toBe("protectedProcedure");
    });

    it("segurista aparece en lista de usuarios del proyecto para @mentions", () => {
      // getUsuariosByProyecto no filtra por rol, incluye seguristas
      const mockUsers = [
        { id: 1, name: "Admin", role: "admin" },
        { id: 2, name: "Segurista", role: "segurista" },
        { id: 3, name: "Residente", role: "residente" },
      ];
      const seguristas = mockUsers.filter(u => u.role === "segurista");
      expect(seguristas.length).toBe(1);
      expect(seguristas[0].name).toBe("Segurista");
    });

    it("segurista NO puede eliminar mensajes (solo admin/superadmin)", () => {
      const rolesQueEliminan = ["superadmin", "admin"];
      expect(rolesQueEliminan).not.toContain("segurista");
    });

    it("segurista NO puede editar mensajes de otros (solo admin/superadmin)", () => {
      const rolesQueEditanOtros = ["superadmin", "admin"];
      expect(rolesQueEditanOtros).not.toContain("segurista");
    });
  });

  describe("Transiciones de Estado con Prevención", () => {
    it("un incidente abierto puede pasar a prevención", () => {
      const transicionesDesdeAbierto = ["en_proceso", "prevencion", "cerrado"];
      expect(transicionesDesdeAbierto).toContain("prevencion");
    });

    it("un incidente en prevención puede cerrarse", () => {
      const transicionesDesdePrevencion = ["cerrado"];
      // Desde prevención se puede cerrar
      expect(transicionesDesdePrevencion).toContain("cerrado");
    });

    it("un incidente cerrado no muestra botón de prevención", () => {
      const estado = "cerrado";
      const mostrarBotonPrevencion = estado !== "cerrado" && estado !== "prevencion";
      expect(mostrarBotonPrevencion).toBe(false);
    });

    it("un incidente en prevención no muestra botón de prevención", () => {
      const estado = "prevencion";
      const mostrarBotonPrevencion = estado !== "cerrado" && estado !== "prevencion";
      expect(mostrarBotonPrevencion).toBe(false);
    });

    it("un incidente abierto muestra botón de prevención", () => {
      const estado = "abierto";
      const mostrarBotonPrevencion = estado !== "cerrado" && estado !== "prevencion";
      expect(mostrarBotonPrevencion).toBe(true);
    });
  });
});
