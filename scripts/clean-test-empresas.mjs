import { createPool } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const pool = createPool(process.env.DATABASE_URL);

async function main() {
  // 1. Eliminar empresas de prueba (Empresa Test UX, sin proyecto)
  const [testEmpresas] = await pool.query("SELECT id FROM empresas WHERE nombre LIKE '%Test%' OR (proyectoId IS NULL AND nombre NOT IN (SELECT DISTINCT nombre FROM empresas WHERE proyectoId IS NOT NULL))");
  console.log(`Empresas de prueba encontradas: ${testEmpresas.length}`);
  
  if (testEmpresas.length > 0) {
    const ids = testEmpresas.map(e => e.id);
    
    // Eliminar relaciones empresa_residentes
    const [r1] = await pool.query('DELETE FROM empresa_residentes WHERE empresaId IN (?)', [ids]);
    console.log(`empresa_residentes eliminados: ${r1.affectedRows}`);
    
    // Eliminar empresa_especialidades
    try {
      const [r2] = await pool.query('DELETE FROM empresa_especialidades WHERE empresaId IN (?)', [ids]);
      console.log(`empresa_especialidades eliminados: ${r2.affectedRows}`);
    } catch(e) { console.log('empresa_especialidades: sin cambios'); }
    
    // Eliminar empresa_historial
    try {
      const [r3] = await pool.query('DELETE FROM empresa_historial WHERE empresaId IN (?)', [ids]);
      console.log(`empresa_historial eliminados: ${r3.affectedRows}`);
    } catch(e) { console.log('empresa_historial: sin cambios'); }
    
    // Eliminar las empresas
    const [r4] = await pool.query('DELETE FROM empresas WHERE id IN (?)', [ids]);
    console.log(`Empresas de prueba eliminadas: ${r4.affectedRows}`);
  }

  // 2. Eliminar defectos de prueba
  const [testDefectos] = await pool.query("SELECT id FROM defectos WHERE nombre LIKE '%test%' OR nombre LIKE '%prueba%'");
  if (testDefectos.length > 0) {
    const ids = testDefectos.map(d => d.id);
    const [r] = await pool.query('DELETE FROM defectos WHERE id IN (?)', [ids]);
    console.log(`Defectos de prueba eliminados: ${r.affectedRows}`);
  }

  // 3. Eliminar unidades de prueba
  const [testUnidades] = await pool.query("SELECT id FROM unidades WHERE nombre LIKE '%test%' OR nombre LIKE '%prueba%'");
  if (testUnidades.length > 0) {
    const ids = testUnidades.map(u => u.id);
    const [r] = await pool.query('DELETE FROM unidades WHERE id IN (?)', [ids]);
    console.log(`Unidades de prueba eliminadas: ${r.affectedRows}`);
  }

  // 4. Eliminar espacios de prueba
  const [testEspacios] = await pool.query("SELECT id FROM espacios WHERE nombre LIKE '%test%' OR nombre LIKE '%prueba%'");
  if (testEspacios.length > 0) {
    const ids = testEspacios.map(e => e.id);
    const [r] = await pool.query('DELETE FROM espacios WHERE id IN (?)', [ids]);
    console.log(`Espacios de prueba eliminados: ${r.affectedRows}`);
  }

  // 5. Limpiar auditoría huérfana (entidades que ya no existen)
  try {
    const [r] = await pool.query("DELETE FROM auditoria WHERE entidadTipo = 'empresa' AND entidadId NOT IN (SELECT id FROM empresas)");
    console.log(`Auditoría huérfana eliminada: ${r.affectedRows}`);
  } catch(e) { console.log('auditoría: sin cambios'); }

  // 6. Verificar resultado
  const [empresasRestantes] = await pool.query('SELECT COUNT(*) as total FROM empresas');
  const [itemsRestantes] = await pool.query('SELECT COUNT(*) as total FROM items');
  console.log(`\nEmpresas restantes: ${empresasRestantes[0].total}`);
  console.log(`Ítems restantes: ${itemsRestantes[0].total}`);

  await pool.end();
  console.log('✅ Limpieza de empresas completada');
}

main().catch(console.error);
