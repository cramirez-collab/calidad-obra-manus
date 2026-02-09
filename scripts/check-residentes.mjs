import { createPool } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const pool = createPool(process.env.DATABASE_URL);

async function main() {
  // 1. Ver proyectos
  const [proyectos] = await pool.query('SELECT id, nombre FROM proyectos ORDER BY id');
  console.log('\n=== PROYECTOS ===');
  console.table(proyectos);

  // 2. Ver empresas por proyecto
  const [empresas] = await pool.query('SELECT id, nombre, proyectoId, residenteId, jefeResidenteId, especialidadId, activo FROM empresas WHERE activo = 1 ORDER BY proyectoId, nombre');
  console.log('\n=== EMPRESAS ACTIVAS ===');
  console.table(empresas);

  // 3. Ver empresa_residentes
  const [empRes] = await pool.query('SELECT * FROM empresa_residentes WHERE activo = 1');
  console.log('\n=== EMPRESA_RESIDENTES ===');
  console.table(empRes);

  // 4. Ver usuarios con rol residente/jefe_residente
  const [residentes] = await pool.query("SELECT id, name, role, empresaId FROM users WHERE role IN ('residente', 'jefe_residente') AND activo = 1");
  console.log('\n=== USUARIOS RESIDENTE/JEFE_RESIDENTE ===');
  console.table(residentes);

  // 5. Ver Omar y su proyecto activo
  const [omar] = await pool.query("SELECT id, name, role, empresaId, proyectoActivoId FROM users WHERE name LIKE '%Omar%'");
  console.log('\n=== OMAR ===');
  console.table(omar);

  // 6. Simular lo que hace getAllResidentesConEmpresas para proyecto 1
  console.log('\n=== SIMULACIÓN getAllResidentesConEmpresas (proyecto 1) ===');
  const [empProyecto1] = await pool.query('SELECT id, nombre, residenteId, jefeResidenteId FROM empresas WHERE activo = 1 AND proyectoId = 1');
  const empIds = empProyecto1.map(e => e.id);
  console.log(`Empresas del proyecto 1: ${empIds.length}`);
  
  if (empIds.length > 0) {
    // Relaciones en empresa_residentes
    const [relaciones] = await pool.query('SELECT * FROM empresa_residentes WHERE activo = 1 AND empresaId IN (?)', [empIds]);
    console.log(`Relaciones empresa_residentes: ${relaciones.length}`);
    console.table(relaciones);

    // Usuarios residente/jefe_residente con empresaId del proyecto
    const [usersConEmpresa] = await pool.query(
      "SELECT id, name, role, empresaId FROM users WHERE activo = 1 AND role IN ('residente', 'jefe_residente') AND empresaId IN (?)", 
      [empIds]
    );
    console.log(`Usuarios con empresaId del proyecto: ${usersConEmpresa.length}`);
    console.table(usersConEmpresa);

    // IDs de residenteId y jefeResidenteId en empresas
    const resIds = empProyecto1.filter(e => e.residenteId).map(e => e.residenteId);
    const jefeIds = empProyecto1.filter(e => e.jefeResidenteId).map(e => e.jefeResidenteId);
    console.log(`residenteId en empresas: ${resIds}`);
    console.log(`jefeResidenteId en empresas: ${jefeIds}`);
  }

  await pool.end();
}

main().catch(console.error);
