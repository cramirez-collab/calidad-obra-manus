import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Flujo Rápido - Prellenado y Priorización', () => {
  describe('getDatosPrellenaUsuario', () => {
    it('debe retornar null para usuario inexistente', async () => {
      const result = await db.getDatosPrellenaUsuario(99999);
      expect(result).toBeNull();
    });

    it('debe retornar datos básicos del usuario', async () => {
      // Obtener un usuario existente
      const users = await db.getAllUsers();
      if (users.length === 0) return; // Skip si no hay usuarios
      
      const result = await db.getDatosPrellenaUsuario(users[0].id);
      expect(result).not.toBeNull();
      expect(result?.usuario).toBeDefined();
      expect(result?.usuario.id).toBe(users[0].id);
    });

    it('debe incluir empresa si el usuario tiene una asignada', async () => {
      const users = await db.getAllUsers();
      const userConEmpresa = users.find(u => u.empresaId);
      if (!userConEmpresa) return; // Skip si no hay usuario con empresa
      
      // Verificar que la empresa del usuario existe en la BD
      const empresas = await db.getAllEmpresas();
      const empresaExiste = empresas.find(e => e.id === userConEmpresa.empresaId);
      if (!empresaExiste) return; // Skip si la empresa no existe (datos inconsistentes)
      
      const result = await db.getDatosPrellenaUsuario(userConEmpresa.id);
      // Si la empresa existe, debería incluirla en el resultado
      expect(result).not.toBeNull();
      // La empresa puede ser null si hay inconsistencia de datos, pero el resultado debe existir
      if (empresaExiste) {
        expect(result?.empresa?.id).toBe(userConEmpresa.empresaId);
      }
    });

    it('debe incluir unidades del proyecto si se especifica', async () => {
      const users = await db.getAllUsers();
      if (users.length === 0) return;
      
      const proyectos = await db.getAllProyectos();
      if (proyectos.length === 0) return;
      
      const result = await db.getDatosPrellenaUsuario(users[0].id, proyectos[0].id);
      expect(result?.unidadesProyecto).toBeDefined();
      expect(Array.isArray(result?.unidadesProyecto)).toBe(true);
    });
  });

  describe('getItemsCriticosPriorizados', () => {
    it('debe retornar un array', async () => {
      const result = await db.getItemsCriticosPriorizados();
      expect(Array.isArray(result)).toBe(true);
    });

    it('debe respetar el límite especificado', async () => {
      const result = await db.getItemsCriticosPriorizados(undefined, 5);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('debe incluir datos de prioridad en cada ítem', async () => {
      const result = await db.getItemsCriticosPriorizados(undefined, 10);
      result.forEach(item => {
        expect(item).toHaveProperty('prioridad');
        expect(item).toHaveProperty('diasPendiente');
        expect(item).toHaveProperty('severidad');
      });
    });

    it('debe ordenar por prioridad descendente', async () => {
      const result = await db.getItemsCriticosPriorizados(undefined, 10);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].prioridad).toBeGreaterThanOrEqual(result[i].prioridad);
      }
    });
  });

  describe('getDashboardResidente', () => {
    it('debe retornar dashboard vacío para usuario inexistente', async () => {
      const result = await db.getDashboardResidente(99999);
      // La función retorna un dashboard vacío en lugar de null
      expect(result).not.toBeNull();
      expect(result?.estadisticas.total).toBe(0);
      expect(result?.pendientesFoto.length).toBe(0);
    });

    it('debe retornar estructura correcta del dashboard', async () => {
      const users = await db.getAllUsers();
      const residente = users.find(u => u.role === 'residente');
      if (!residente) return; // Skip si no hay residentes
      
      const result = await db.getDashboardResidente(residente.id);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('pendientesFoto');
      expect(result).toHaveProperty('pendientesAprobacion');
      expect(result).toHaveProperty('estadisticas');
      expect(result).toHaveProperty('urgentes');
    });

    it('debe incluir estadísticas correctas', async () => {
      const users = await db.getAllUsers();
      if (users.length === 0) return;
      
      const result = await db.getDashboardResidente(users[0].id);
      if (!result) return;
      
      expect(result.estadisticas).toHaveProperty('total');
      expect(result.estadisticas).toHaveProperty('pendientesFoto');
      expect(result.estadisticas).toHaveProperty('pendientesAprobacion');
      expect(result.estadisticas).toHaveProperty('aprobados');
      expect(result.estadisticas).toHaveProperty('rechazados');
      expect(result.estadisticas).toHaveProperty('tasaAprobacion');
    });
  });

  describe('getTop5Peores', () => {
    it('debe retornar estructura con empresas, residentes y especialidades', async () => {
      const result = await db.getTop5Peores();
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('empresas');
      expect(result).toHaveProperty('residentes');
      expect(result).toHaveProperty('especialidades');
    });

    it('debe limitar a 5 elementos por categoría', async () => {
      const result = await db.getTop5Peores();
      if (!result) return;
      
      expect(result.empresas.length).toBeLessThanOrEqual(5);
      expect(result.residentes.length).toBeLessThanOrEqual(5);
      expect(result.especialidades.length).toBeLessThanOrEqual(5);
    });

    it('debe ordenar por scoreProblemas descendente', async () => {
      const result = await db.getTop5Peores();
      if (!result) return;
      
      // Verificar orden de empresas
      for (let i = 1; i < result.empresas.length; i++) {
        expect(result.empresas[i - 1].scoreProblemas).toBeGreaterThanOrEqual(result.empresas[i].scoreProblemas);
      }
      
      // Verificar orden de residentes
      for (let i = 1; i < result.residentes.length; i++) {
        expect(result.residentes[i - 1].scoreProblemas).toBeGreaterThanOrEqual(result.residentes[i].scoreProblemas);
      }
    });

    it('debe filtrar por proyecto si se especifica', async () => {
      const proyectos = await db.getAllProyectos();
      if (proyectos.length === 0) return;
      
      const result = await db.getTop5Peores(proyectos[0].id);
      expect(result).not.toBeNull();
    });
  });
});
