import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// STEP 1: Identify test items
// empresaId=1 = no real empresa (all created by Carlos/999/100 during testing)
// Users 999, 100, 200, 300 don't exist in users table

const [testItems] = await conn.query(`
  SELECT id FROM items WHERE empresaId = 1
`);
console.log('Test items (empresaId=1):', testItems.length);

// Also find items created by or assigned to non-existent users
const [ghostItems] = await conn.query(`
  SELECT i.id FROM items i
  LEFT JOIN users u1 ON i.creadoPorId = u1.id
  LEFT JOIN users u2 ON i.asignadoAId = u2.id
  WHERE u1.id IS NULL OR u2.id IS NULL
`);
console.log('Items with non-existent creator or assignee:', ghostItems.length);

// Combine unique IDs
const allTestIds = new Set([
  ...testItems.map(i => i.id),
  ...ghostItems.map(i => i.id)
]);
console.log('Total unique test item IDs to delete:', allTestIds.size);

// STEP 2: Check for related data that needs cleanup
const idList = Array.from(allTestIds).join(',');

if (allTestIds.size > 0) {
  // Check related tables
  const tables = [
    'item_historial',
    'item_rondas', 
    'comentarios',
    'defectos',
    'plano_pines',
    'notificaciones'
  ];
  
  for (const table of tables) {
    try {
      const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${table} WHERE itemId IN (${idList})`);
      if (rows[0].cnt > 0) {
        console.log(`  ${table}: ${rows[0].cnt} related records to delete`);
        await conn.query(`DELETE FROM ${table} WHERE itemId IN (${idList})`);
        console.log(`  ${table}: deleted`);
      }
    } catch (e) {
      // Table might not have itemId column
      try {
        const [cols] = await conn.query(`SHOW COLUMNS FROM ${table} LIKE 'itemId'`);
        if (cols.length === 0) {
          // Try item_id
          const [cols2] = await conn.query(`SHOW COLUMNS FROM ${table} LIKE 'item_id'`);
          if (cols2.length > 0) {
            const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${table} WHERE item_id IN (${idList})`);
            if (rows[0].cnt > 0) {
              console.log(`  ${table}: ${rows[0].cnt} related records (item_id)`);
              await conn.query(`DELETE FROM ${table} WHERE item_id IN (${idList})`);
              console.log(`  ${table}: deleted`);
            }
          }
        }
      } catch (e2) {
        console.log(`  ${table}: skipped (${e2.message})`);
      }
    }
  }
  
  // Delete the test items
  const [delResult] = await conn.query(`DELETE FROM items WHERE id IN (${idList})`);
  console.log(`\nDeleted ${delResult.affectedRows} test items`);
}

// STEP 3: Delete test empresas (Empresa Test UX)
const [testEmpresas] = await conn.query(`
  SELECT id, nombre FROM empresas WHERE LOWER(nombre) LIKE '%test%'
`);
if (testEmpresas.length > 0) {
  console.log('\nTest empresas to delete:');
  for (const e of testEmpresas) {
    console.log(`  ${e.nombre} (id:${e.id})`);
    // Check for items first
    const [eItems] = await conn.query('SELECT COUNT(*) as cnt FROM items WHERE empresaId = ?', [e.id]);
    if (eItems[0].cnt === 0) {
      // Safe to delete - check related tables
      try { await conn.query('DELETE FROM empresa_residentes WHERE empresaId = ?', [e.id]); } catch(e) {}
      try { await conn.query('DELETE FROM empresa_especialidades WHERE empresaId = ?', [e.id]); } catch(e) {}
      try { await conn.query('DELETE FROM empresa_historial WHERE empresaId = ?', [e.id]); } catch(e) {}
      await conn.query('DELETE FROM empresas WHERE id = ?', [e.id]);
      console.log(`  Deleted ${e.nombre}`);
    } else {
      console.log(`  Skipped (has ${eItems[0].cnt} items)`);
    }
  }
}

// STEP 4: Final state
const [finalTotal] = await conn.query('SELECT COUNT(*) as cnt FROM items');
const [finalDiff] = await conn.query('SELECT COUNT(*) as cnt FROM items WHERE asignadoAId != creadoPorId');
const [finalSame] = await conn.query('SELECT COUNT(*) as cnt FROM items WHERE asignadoAId = creadoPorId');

console.log('\n=== FINAL STATE ===');
console.log(`Total items: ${finalTotal[0].cnt}`);
console.log(`Asignado DIFERENTE al creador: ${finalDiff[0].cnt}`);
console.log(`Asignado IGUAL al creador: ${finalSame[0].cnt}`);

// Breakdown of remaining
const [breakdown] = await conn.query(`
  SELECT MAX(e.nombre) as empresa, i.creadoPorId, MAX(u.name) as creador, MAX(u.role) as role,
    i.asignadoAId = i.creadoPorId as selfAssigned, COUNT(*) as cnt
  FROM items i 
  LEFT JOIN empresas e ON i.empresaId = e.id 
  LEFT JOIN users u ON i.creadoPorId = u.id
  GROUP BY i.empresaId, i.creadoPorId, selfAssigned
  ORDER BY cnt DESC
`);
console.log('\nBreakdown completo:');
for (const r of breakdown) {
  const flag = r.selfAssigned ? ' [SELF]' : '';
  console.log(`  ${r.empresa || 'N/A'} | ${r.creador} (${r.role}) | ${r.cnt} items${flag}`);
}

// Check Objetiva users still self-assigned
const [objetivaSelf] = await conn.query(`
  SELECT i.creadoPorId, MAX(u.name) as nombre, MAX(u.role) as role, COUNT(*) as cnt
  FROM items i JOIN users u ON i.creadoPorId = u.id
  WHERE i.asignadoAId = i.creadoPorId AND u.role IN ('superadmin', 'admin', 'supervisor')
  GROUP BY i.creadoPorId
`);
if (objetivaSelf.length > 0) {
  console.log('\nWARNING - Objetiva users still self-assigned:');
  for (const r of objetivaSelf) console.log(`  ${r.nombre} (${r.role}): ${r.cnt} items`);
} else {
  console.log('\nZERO Objetiva users self-assigned. All clean.');
}

await conn.end();
