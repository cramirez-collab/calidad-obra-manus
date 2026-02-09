import { createPool } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const pool = createPool(process.env.DATABASE_URL);

async function main() {
  const [carlos] = await pool.query("SELECT id FROM users WHERE name LIKE '%Carlos%Ramirez%'");
  if (carlos.length === 0) { console.log('Carlos no encontrado'); await pool.end(); return; }
  const carlosId = carlos[0].id;
  console.log(`Carlos Ramirez ID: ${carlosId}`);

  // Identificar ítems de prueba
  const [testItems] = await pool.query(`
    SELECT id FROM items 
    WHERE creadoPorId = ?
      AND (
        descripcion LIKE '%prueba%'
        OR descripcion LIKE '%test%'
        OR descripcion LIKE '%Base64%'
        OR descripcion LIKE '%sin foto para probar%'
        OR descripcion IS NULL
        OR LENGTH(COALESCE(descripcion, '')) < 3
      )
    ORDER BY id
  `, [carlosId]);

  console.log(`Ítems de prueba: ${testItems.length}`);
  if (testItems.length === 0) { await pool.end(); return; }

  const ids = testItems.map(i => i.id);

  // Eliminar en orden de dependencias (tablas reales del schema)
  // 1. item_historial
  const [r1] = await pool.query(`DELETE FROM item_historial WHERE itemId IN (?)`, [ids]);
  console.log(`item_historial eliminados: ${r1.affectedRows}`);

  // 2. comentarios
  const [r2] = await pool.query(`DELETE FROM comentarios WHERE itemId IN (?)`, [ids]);
  console.log(`comentarios eliminados: ${r2.affectedRows}`);

  // 3. mensajes
  const [r3] = await pool.query(`DELETE FROM mensajes WHERE itemId IN (?)`, [ids]);
  console.log(`mensajes eliminados: ${r3.affectedRows}`);

  // 4. plano_pines
  const [r4] = await pool.query(`DELETE FROM plano_pines WHERE itemId IN (?)`, [ids]);
  console.log(`plano_pines eliminados: ${r4.affectedRows}`);

  // 5. notificaciones
  const [r5] = await pool.query(`DELETE FROM notificaciones WHERE itemId IN (?)`, [ids]);
  console.log(`notificaciones eliminadas: ${r5.affectedRows}`);

  // 6. Eliminar los ítems
  const [r6] = await pool.query(`DELETE FROM items WHERE id IN (?)`, [ids]);
  console.log(`\nÍtems de prueba eliminados: ${r6.affectedRows}`);

  // 7. Limpiar bitácora de pruebas
  try {
    const [r7] = await pool.query(`
      DELETE FROM bitacora 
      WHERE usuarioId = ? 
        AND (detalles LIKE '%prueba%' OR detalles LIKE '%test%' OR detalles LIKE '%Base64%')
    `, [carlosId]);
    console.log(`bitácora limpiada: ${r7.affectedRows}`);
  } catch(e) { console.log('bitácora: sin cambios'); }

  // 8. Limpiar auditoría de pruebas
  try {
    const [r8] = await pool.query(`
      DELETE FROM auditoria 
      WHERE usuarioId = ? 
        AND entidadTipo = 'item'
        AND entidadId IN (?)
    `, [carlosId, ids]);
    console.log(`auditoría limpiada: ${r8.affectedRows}`);
  } catch(e) { console.log('auditoría: sin cambios'); }

  // Verificar resultado
  const [remaining] = await pool.query(`SELECT COUNT(*) as total FROM items WHERE creadoPorId = ?`, [carlosId]);
  console.log(`\nÍtems restantes de Carlos: ${remaining[0].total}`);

  await pool.end();
  console.log('✅ Limpieza completada');
}

main().catch(console.error);
