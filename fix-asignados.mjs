import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. ALL items where asignadoAId == creadoPorId
const [bad] = await conn.query(`
  SELECT id, empresaId, creadoPorId, asignadoAId, residenteId, especialidadId, proyectoId
  FROM items WHERE asignadoAId = creadoPorId ORDER BY empresaId, id
`);
console.log('Total items asignadoAId == creadoPorId:', bad.length);

// Group by empresa
const byEmpresa = {};
for (const i of bad) {
  if (!byEmpresa[i.empresaId]) byEmpresa[i.empresaId] = [];
  byEmpresa[i.empresaId].push(i);
}

// 2. Correctly assigned items per empresa (asignadoAId != creadoPorId) - the BEST source of truth
const [goodItems] = await conn.query(`
  SELECT i.empresaId, i.asignadoAId, MAX(u.name) as nombre, COUNT(*) as cnt
  FROM items i JOIN users u ON i.asignadoAId = u.id
  WHERE i.asignadoAId != i.creadoPorId
  GROUP BY i.empresaId, i.asignadoAId
  ORDER BY i.empresaId, cnt DESC
`);

// Map: empresaId -> array of {id, name, cnt} sorted by frequency
const residentesByEmpresa = {};
for (const r of goodItems) {
  if (!residentesByEmpresa[r.empresaId]) residentesByEmpresa[r.empresaId] = [];
  residentesByEmpresa[r.empresaId].push({ id: r.asignadoAId, name: r.nombre, cnt: r.cnt });
}

// empresa_residentes as fallback
const [er] = await conn.query(`
  SELECT er.empresaId, er.usuarioId, MAX(u.name) as nombre
  FROM empresa_residentes er JOIN users u ON er.usuarioId = u.id
  WHERE er.activo = 1 GROUP BY er.empresaId, er.usuarioId
`);
for (const r of er) {
  if (!residentesByEmpresa[r.empresaId]) residentesByEmpresa[r.empresaId] = [];
  // Only add if not already present
  const exists = residentesByEmpresa[r.empresaId].some(x => x.id === r.usuarioId);
  if (!exists) {
    residentesByEmpresa[r.empresaId].push({ id: r.usuarioId, name: r.nombre, cnt: 0 });
  }
}

// Get empresa names
const [empresas] = await conn.query('SELECT id, nombre FROM empresas');
const empresaNames = {};
for (const e of empresas) empresaNames[e.id] = e.nombre;

// Get all residentes in proyecto Hidalma (proyectoId=1) as last resort
const [hidalmaRes] = await conn.query(`
  SELECT u.id, u.name FROM proyecto_usuarios pu
  JOIN users u ON pu.usuarioId = u.id
  WHERE pu.proyectoId = 1 AND pu.rolEnProyecto = 'residente'
  GROUP BY u.id, u.name ORDER BY u.name
`);
console.log('\nAll residentes in Hidalma:', hidalmaRes.map(r => `${r.name}(${r.id})`).join(', '));

// 3. Build correction plan
console.log('\n=== CORRECTION PLAN ===\n');
let totalToFix = 0;
let totalUnfixable = 0;
const updates = []; // {itemId, newAsignadoId, newResidenteId}

for (const [empresaId, items] of Object.entries(byEmpresa)) {
  const eName = empresaNames[empresaId] || 'SIN EMPRESA';
  const candidates = residentesByEmpresa[empresaId] || [];
  
  // Group by creator
  const byCreator = {};
  for (const i of items) {
    if (!byCreator[i.creadoPorId]) byCreator[i.creadoPorId] = [];
    byCreator[i.creadoPorId].push(i);
  }
  
  for (const [creatorId, creatorItems] of Object.entries(byCreator)) {
    const cId = parseInt(creatorId);
    // Find a candidate that is NOT the creator
    const validCandidate = candidates.find(c => c.id !== cId);
    
    if (validCandidate) {
      console.log(`FIX: ${eName} (${empresaId}) | creator:${cId} -> ${validCandidate.name}(${validCandidate.id}) | ${creatorItems.length} items`);
      for (const item of creatorItems) {
        updates.push({ itemId: item.id, newAsignadoId: validCandidate.id, newResidenteId: validCandidate.id });
      }
      totalToFix += creatorItems.length;
    } else {
      // No valid candidate from empresa - try Hidalma residentes
      const hidalmaCandidate = hidalmaRes.find(r => r.id !== cId);
      if (hidalmaCandidate) {
        console.log(`FIX (Hidalma fallback): ${eName} (${empresaId}) | creator:${cId} -> ${hidalmaCandidate.name}(${hidalmaCandidate.id}) | ${creatorItems.length} items`);
        for (const item of creatorItems) {
          updates.push({ itemId: item.id, newAsignadoId: hidalmaCandidate.id, newResidenteId: hidalmaCandidate.id });
        }
        totalToFix += creatorItems.length;
      } else {
        console.log(`UNFIXABLE: ${eName} (${empresaId}) | creator:${cId} | ${creatorItems.length} items | no valid candidate`);
        totalUnfixable += creatorItems.length;
      }
    }
  }
}

console.log(`\nTotal to fix: ${totalToFix}`);
console.log(`Total unfixable: ${totalUnfixable}`);
console.log(`Total updates to execute: ${updates.length}`);

// 4. Execute all updates
if (updates.length > 0) {
  console.log('\nExecuting updates...');
  let done = 0;
  for (const u of updates) {
    await conn.query(
      'UPDATE items SET asignadoAId = ?, residenteId = ? WHERE id = ?',
      [u.newAsignadoId, u.newResidenteId, u.itemId]
    );
    done++;
  }
  console.log(`Done: ${done} items updated`);
}

// 5. Verify
const [remaining] = await conn.query('SELECT COUNT(*) as cnt FROM items WHERE asignadoAId = creadoPorId');
console.log(`\nRemaining items asignadoAId == creadoPorId: ${remaining[0].cnt}`);

// Show remaining breakdown if any
if (remaining[0].cnt > 0) {
  const [rem] = await conn.query(`
    SELECT i.empresaId, MAX(e.nombre) as empresa, i.creadoPorId, MAX(u.name) as creador, COUNT(*) as cnt
    FROM items i LEFT JOIN empresas e ON i.empresaId = e.id LEFT JOIN users u ON i.creadoPorId = u.id
    WHERE i.asignadoAId = i.creadoPorId
    GROUP BY i.empresaId, i.creadoPorId ORDER BY cnt DESC
  `);
  console.log('Remaining breakdown:');
  for (const r of rem) {
    console.log(`  ${r.empresa || 'N/A'} | creator: ${r.creador}(${r.creadoPorId}) | ${r.cnt} items`);
  }
}

await conn.end();
