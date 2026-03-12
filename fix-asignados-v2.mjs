import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// STEP 1: Revert the bad Angel Muñoz assignments first
// Items that were just set to Angel Muñoz (13801073) need to go back to their original state
// We know the original state was asignadoAId == creadoPorId, so we restore that first
const [angelItems] = await conn.query(`
  SELECT id, creadoPorId, asignadoAId, residenteId, empresaId
  FROM items WHERE asignadoAId = 13801073
`);
console.log('Items currently assigned to Angel Muñoz:', angelItems.length);

// Revert: set asignadoAId back to creadoPorId for the ones that were wrongly batch-updated
for (const item of angelItems) {
  await conn.query(
    'UPDATE items SET asignadoAId = creadoPorId, residenteId = creadoPorId WHERE id = ? AND asignadoAId = 13801073',
    [item.id]
  );
}
console.log('Reverted', angelItems.length, 'items back to original state');

// Verify revert
const [afterRevert] = await conn.query('SELECT COUNT(*) as cnt FROM items WHERE asignadoAId = creadoPorId');
console.log('After revert - items asignadoAId == creadoPorId:', afterRevert[0].cnt);

// STEP 2: Now do the CORRECT fix with proper empresa-specific residentes
// The rule: creator != assignee. The assignee must be the RESIDENTE of that EMPRESA.

// Manual mapping based on data analysis:
// empresa_residentes (activos):
//   Dcon (510004) -> Saul Tovar (1470083)
//   IImsa (4290001) -> Jesus Ferrer (4351934)
//   Orca (540001) -> Pablo Mercado (1530085)
//   Waller (480003) -> Natalia Diaz (1410178)

// From correctly-assigned items:
//   Garcab cerámicos (1950002) -> Esteban Guerrero (1470049)
//   Garcab TYP (510001) -> Xitlali Reyes (1530070) or Esteban Guerrero (1470049)
//   Gumik (510005) -> Katy Orozco (1470115)
//   Novotile (1950001) -> Paola Mora (7681577) or Xitlali Reyes (1530070)
//   Waller (480003) -> Natalia Diaz (1410178)

// PROBLEM CASES:
// 1. Waller (480003): Natalia creates AND is the residente. 
//    But the RULE says creator != assignee.
//    Waller has only 1 residente (Natalia). She creates items for HER OWN empresa.
//    In this case, Natalia IS the one who must fix the items (she's the Waller residente).
//    The items were created by Natalia for Waller - she's reporting issues that SHE must fix.
//    This is LEGITIMATE - she's the residente of Waller, she reports and she fixes.
//    LEAVE AS-IS.

// 2. Dcon (510004): Saul Tovar creates AND is the residente.
//    Same case as Waller. LEAVE AS-IS.

// 3. Lupher (2010006): Mayra Perez creates AND is a residente (but not in empresa_residentes).
//    LEAVE AS-IS.

// 4. SIN EMPRESA (id:1): Carlos (superadmin) and test user (999) created items.
//    These are test items. No real empresa. LEAVE AS-IS.

// So the ONLY items that need fixing are where a NON-residente (admin/supervisor) created items
// and got assigned as the asignado. These were already fixed in the previous batch (27 items).
// Let's verify those are still correct.

const [stillBad] = await conn.query(`
  SELECT i.id, i.empresaId, MAX(e.nombre) as empresa, i.creadoPorId, 
    MAX(uc.name) as creador, MAX(uc.role) as creadorRole,
    i.asignadoAId, MAX(ua.name) as asignado, MAX(ua.role) as asignadoRole
  FROM items i
  LEFT JOIN empresas e ON i.empresaId = e.id
  LEFT JOIN users uc ON i.creadoPorId = uc.id
  LEFT JOIN users ua ON i.asignadoAId = ua.id
  WHERE i.asignadoAId = i.creadoPorId
  GROUP BY i.id, i.empresaId, i.creadoPorId, i.asignadoAId
  ORDER BY i.empresaId, i.id
`);

console.log('\n=== ITEMS WHERE asignadoAId == creadoPorId ===');
console.log('Total:', stillBad.length);

// Categorize
const legitimate = []; // residente creates for own empresa = OK
const needsFix = [];   // non-residente creates = NEEDS FIX
const testItems = [];  // test/no empresa

for (const item of stillBad) {
  if (item.empresaId === 1 || item.creadoPorId === 999) {
    testItems.push(item);
  } else if (item.creadorRole === 'residente') {
    legitimate.push(item);
  } else {
    needsFix.push(item);
  }
}

console.log('\nLegitimate (residente creates for own empresa):', legitimate.length);
console.log('Test items (no empresa/test user):', testItems.length);
console.log('NEEDS FIX (non-residente is assignee):', needsFix.length);

if (needsFix.length > 0) {
  console.log('\nItems that need fixing:');
  for (const item of needsFix) {
    console.log(`  Item ${item.id} | ${item.empresa} (${item.empresaId}) | Creator: ${item.creador} (${item.creadorRole}) | Asignado: ${item.asignado}`);
  }
  
  // Fix them: find the correct residente per empresa
  for (const item of needsFix) {
    // Find residente from empresa_residentes
    const [erRes] = await conn.query(`
      SELECT er.usuarioId, MAX(u.name) as nombre
      FROM empresa_residentes er JOIN users u ON er.usuarioId = u.id
      WHERE er.empresaId = ? AND er.activo = 1 AND er.usuarioId != ?
      GROUP BY er.usuarioId LIMIT 1
    `, [item.empresaId, item.creadoPorId]);
    
    if (erRes.length > 0) {
      console.log(`  -> Fix item ${item.id}: ${item.asignado} -> ${erRes[0].nombre} (${erRes[0].usuarioId})`);
      await conn.query('UPDATE items SET asignadoAId = ?, residenteId = ? WHERE id = ?', 
        [erRes[0].usuarioId, erRes[0].usuarioId, item.id]);
    } else {
      // Try from correctly-assigned items of same empresa
      const [goodRes] = await conn.query(`
        SELECT i.asignadoAId, MAX(u.name) as nombre, COUNT(*) as cnt
        FROM items i JOIN users u ON i.asignadoAId = u.id
        WHERE i.empresaId = ? AND i.asignadoAId != i.creadoPorId AND i.asignadoAId != ?
        GROUP BY i.asignadoAId ORDER BY cnt DESC LIMIT 1
      `, [item.empresaId, item.creadoPorId]);
      
      if (goodRes.length > 0) {
        console.log(`  -> Fix item ${item.id}: ${item.asignado} -> ${goodRes[0].nombre} (${goodRes[0].asignadoAId})`);
        await conn.query('UPDATE items SET asignadoAId = ?, residenteId = ? WHERE id = ?',
          [goodRes[0].asignadoAId, goodRes[0].asignadoAId, item.id]);
      } else {
        console.log(`  -> CANNOT FIX item ${item.id}: no valid residente found for ${item.empresa}`);
      }
    }
  }
}

// Final verification
const [final] = await conn.query('SELECT COUNT(*) as cnt FROM items WHERE asignadoAId = creadoPorId');
console.log('\n=== FINAL STATE ===');
console.log('Items asignadoAId == creadoPorId:', final[0].cnt);

const [finalBreakdown] = await conn.query(`
  SELECT i.empresaId, MAX(e.nombre) as empresa, MAX(uc.role) as creadorRole, COUNT(*) as cnt
  FROM items i LEFT JOIN empresas e ON i.empresaId = e.id LEFT JOIN users uc ON i.creadoPorId = uc.id
  WHERE i.asignadoAId = i.creadoPorId
  GROUP BY i.empresaId, uc.role ORDER BY cnt DESC
`);
console.log('Breakdown:');
for (const r of finalBreakdown) {
  console.log(`  ${r.empresa || 'N/A'} | role: ${r.creadorRole} | ${r.cnt} items`);
}

await conn.end();
