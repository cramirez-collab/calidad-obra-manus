import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// STEP 1: Identify Objetiva users
// Objetiva users are: superadmin, admin, supervisor roles
// They are the company staff (Objetiva QC), NOT the construction company residentes
const [objetivaUsers] = await conn.query(`
  SELECT id, name, role FROM users 
  WHERE role IN ('superadmin', 'admin', 'supervisor')
  ORDER BY role, name
`);
console.log('Usuarios Objetiva (superadmin/admin/supervisor):');
for (const u of objetivaUsers) {
  console.log(`  ${u.name} (id:${u.id}, role:${u.role})`);
}
const objetivaIds = new Set(objetivaUsers.map(u => u.id));

// STEP 2: Find items where an Objetiva user is BOTH creator AND assignee
const [badItems] = await conn.query(`
  SELECT i.id, i.empresaId, i.creadoPorId, i.asignadoAId, i.residenteId, i.proyectoId,
    MAX(e.nombre) as empresa,
    MAX(uc.name) as creador, MAX(uc.role) as creadorRole
  FROM items i
  LEFT JOIN empresas e ON i.empresaId = e.id
  LEFT JOIN users uc ON i.creadoPorId = uc.id
  WHERE i.asignadoAId = i.creadoPorId
  GROUP BY i.id, i.empresaId, i.creadoPorId, i.asignadoAId, i.residenteId, i.proyectoId
  ORDER BY i.empresaId, i.id
`);

const objetivaBad = badItems.filter(i => objetivaIds.has(i.creadoPorId));
const nonObjetivaBad = badItems.filter(i => !objetivaIds.has(i.creadoPorId));

console.log(`\nTotal items asignadoAId == creadoPorId: ${badItems.length}`);
console.log(`  Creados por Objetiva (NECESITAN FIX): ${objetivaBad.length}`);
console.log(`  Creados por NO-Objetiva (legítimos): ${nonObjetivaBad.length}`);

// Show Objetiva items breakdown
const byCreator = {};
for (const item of objetivaBad) {
  const key = `${item.creador}(${item.creadoPorId})`;
  if (!byCreator[key]) byCreator[key] = { items: [], empresa: item.empresa };
  byCreator[key].items.push(item);
}
console.log('\nObjetiva items por creador:');
for (const [creator, data] of Object.entries(byCreator)) {
  console.log(`  ${creator}: ${data.items.length} items`);
}

// STEP 3: For each Objetiva-created item, find the correct residente
// Strategy per empresa:
// 1. Look at correctly-assigned items of same empresa (asignadoAId != creadoPorId, asignado is a residente)
// 2. Look at empresa_residentes table
// 3. If no residente found for empresa, look at proyecto residentes

// Get correct assignments per empresa (from items where asignado != creador)
const [goodAssignments] = await conn.query(`
  SELECT i.empresaId, i.asignadoAId, MAX(u.name) as nombre, MAX(u.role) as role, COUNT(*) as cnt
  FROM items i JOIN users u ON i.asignadoAId = u.id
  WHERE i.asignadoAId != i.creadoPorId AND u.role = 'residente'
  GROUP BY i.empresaId, i.asignadoAId
  ORDER BY i.empresaId, cnt DESC
`);

const residentesByEmpresa = {};
for (const r of goodAssignments) {
  if (!residentesByEmpresa[r.empresaId]) residentesByEmpresa[r.empresaId] = [];
  residentesByEmpresa[r.empresaId].push({ id: r.asignadoAId, name: r.nombre, cnt: r.cnt });
}

// empresa_residentes as additional source
const [er] = await conn.query(`
  SELECT er.empresaId, er.usuarioId, MAX(u.name) as nombre
  FROM empresa_residentes er JOIN users u ON er.usuarioId = u.id
  WHERE er.activo = 1 GROUP BY er.empresaId, er.usuarioId
`);
for (const r of er) {
  if (!residentesByEmpresa[r.empresaId]) residentesByEmpresa[r.empresaId] = [];
  const exists = residentesByEmpresa[r.empresaId].some(x => x.id === r.usuarioId);
  if (!exists) {
    residentesByEmpresa[r.empresaId].push({ id: r.usuarioId, name: r.nombre, cnt: 0 });
  }
}

console.log('\nResidentes por empresa (de items correctos + empresa_residentes):');
for (const [empId, res] of Object.entries(residentesByEmpresa)) {
  console.log(`  Empresa ${empId}: ${res.map(r => r.name + '(' + r.id + ')').join(', ')}`);
}

// STEP 4: Execute fixes
console.log('\n=== EXECUTING FIXES ===');
let fixed = 0;
let unfixed = 0;

for (const item of objetivaBad) {
  const candidates = residentesByEmpresa[item.empresaId] || [];
  // Find a residente that is NOT an Objetiva user
  const validCandidate = candidates.find(c => !objetivaIds.has(c.id));
  
  if (validCandidate) {
    await conn.query(
      'UPDATE items SET asignadoAId = ?, residenteId = ? WHERE id = ?',
      [validCandidate.id, validCandidate.id, item.id]
    );
    console.log(`  Fixed item ${item.id} | ${item.empresa || 'N/A'} | ${item.creador} -> ${validCandidate.name}(${validCandidate.id})`);
    fixed++;
  } else {
    console.log(`  CANNOT FIX item ${item.id} | ${item.empresa || 'N/A'} (empresaId:${item.empresaId}) | ${item.creador} | No residente found`);
    unfixed++;
  }
}

console.log(`\nFixed: ${fixed}`);
console.log(`Cannot fix: ${unfixed}`);

// STEP 5: Final verification
const [finalSame] = await conn.query('SELECT COUNT(*) as cnt FROM items WHERE asignadoAId = creadoPorId');
const [finalDiff] = await conn.query('SELECT COUNT(*) as cnt FROM items WHERE asignadoAId != creadoPorId');
const [finalTotal] = await conn.query('SELECT COUNT(*) as cnt FROM items');

console.log('\n=== FINAL STATE ===');
console.log(`Total items: ${finalTotal[0].cnt}`);
console.log(`Asignado DIFERENTE al creador: ${finalDiff[0].cnt}`);
console.log(`Asignado IGUAL al creador: ${finalSame[0].cnt}`);

// Check if any remaining same are Objetiva users
const [remainingObjetiva] = await conn.query(`
  SELECT i.creadoPorId, MAX(u.name) as creador, MAX(u.role) as role, COUNT(*) as cnt
  FROM items i JOIN users u ON i.creadoPorId = u.id
  WHERE i.asignadoAId = i.creadoPorId AND u.role IN ('superadmin', 'admin', 'supervisor')
  GROUP BY i.creadoPorId
`);
if (remainingObjetiva.length > 0) {
  console.log('\nWARNING - Objetiva users still self-assigned:');
  for (const r of remainingObjetiva) {
    console.log(`  ${r.creador} (${r.role}): ${r.cnt} items`);
  }
} else {
  console.log('\nZERO Objetiva users self-assigned. All clean.');
}

// Show remaining self-assigned (should all be non-Objetiva residentes)
const [remainingBreakdown] = await conn.query(`
  SELECT MAX(e.nombre) as empresa, MAX(uc.name) as creador, MAX(uc.role) as role, COUNT(*) as cnt
  FROM items i LEFT JOIN empresas e ON i.empresaId = e.id LEFT JOIN users uc ON i.creadoPorId = uc.id
  WHERE i.asignadoAId = i.creadoPorId
  GROUP BY i.empresaId, i.creadoPorId ORDER BY cnt DESC
`);
console.log('\nRemaining self-assigned (all non-Objetiva, legítimos):');
for (const r of remainingBreakdown) {
  console.log(`  ${r.empresa || 'N/A'} | ${r.creador} (${r.role}) | ${r.cnt} items`);
}

await conn.end();
