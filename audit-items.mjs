import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Total items
const [total] = await conn.query('SELECT COUNT(*) as cnt FROM items');
console.log('TOTAL ITEMS:', total[0].cnt);

// 2. Items by proyecto
const [byProj] = await conn.query(`
  SELECT i.proyectoId, MAX(p.nombre) as proyecto, COUNT(*) as cnt
  FROM items i LEFT JOIN proyectos p ON i.proyectoId = p.id
  GROUP BY i.proyectoId ORDER BY cnt DESC
`);
console.log('\nPor proyecto:');
for (const r of byProj) console.log(`  ${r.proyecto || 'NULL'} (id:${r.proyectoId}): ${r.cnt} items`);

// 3. Items by empresa
const [byEmp] = await conn.query(`
  SELECT i.empresaId, MAX(e.nombre) as empresa, COUNT(*) as cnt
  FROM items i LEFT JOIN empresas e ON i.empresaId = e.id
  GROUP BY i.empresaId ORDER BY cnt DESC
`);
console.log('\nPor empresa:');
for (const r of byEmp) console.log(`  ${r.empresa || 'N/A'} (id:${r.empresaId}): ${r.cnt} items`);

// 4. Items by creator
const [byCreator] = await conn.query(`
  SELECT i.creadoPorId, MAX(u.name) as nombre, MAX(u.role) as role, COUNT(*) as cnt
  FROM items i LEFT JOIN users u ON i.creadoPorId = u.id
  GROUP BY i.creadoPorId ORDER BY cnt DESC
`);
console.log('\nPor creador:');
for (const r of byCreator) console.log(`  ${r.nombre || 'NULL'} (id:${r.creadoPorId}, ${r.role}): ${r.cnt} items`);

// 5. Items with empresaId=1 (suspicious - no real empresa)
const [emp1] = await conn.query(`
  SELECT i.id, i.descripcion, i.creadoPorId, MAX(u.name) as creador, i.createdAt, i.proyectoId
  FROM items i LEFT JOIN users u ON i.creadoPorId = u.id
  WHERE i.empresaId = 1
  GROUP BY i.id, i.descripcion, i.creadoPorId, i.createdAt, i.proyectoId
  ORDER BY i.createdAt
`);
console.log(`\nItems con empresaId=1 (${emp1.length} items):`);
for (const r of emp1) {
  const desc = (r.descripcion || '').substring(0, 60);
  console.log(`  id:${r.id} | ${r.creador}(${r.creadoPorId}) | ${r.createdAt} | "${desc}"`);
}

// 6. Items by user 999 (test user?)
const [user999] = await conn.query(`
  SELECT i.id, i.descripcion, i.empresaId, MAX(e.nombre) as empresa, i.createdAt
  FROM items i LEFT JOIN empresas e ON i.empresaId = e.id
  WHERE i.creadoPorId = 999
  GROUP BY i.id, i.descripcion, i.empresaId, i.createdAt
  ORDER BY i.createdAt
`);
console.log(`\nItems del usuario 999 (${user999.length} items):`);
for (const r of user999) {
  const desc = (r.descripcion || '').substring(0, 60);
  console.log(`  id:${r.id} | empresa:${r.empresa || 'N/A'}(${r.empresaId}) | ${r.createdAt} | "${desc}"`);
}

// 7. Check if user 999 exists
const [u999] = await conn.query('SELECT * FROM users WHERE id = 999');
console.log('\nUser 999:', u999.length > 0 ? u999[0] : 'NO EXISTE');

// 8. Proyectos - list all
const [proyectos] = await conn.query('SELECT id, nombre, activo FROM proyectos ORDER BY id');
console.log('\nProyectos:');
for (const p of proyectos) console.log(`  ${p.nombre} (id:${p.id}, activo:${p.activo})`);

// 9. Items with "test" or "prueba" in description
const [testDesc] = await conn.query(`
  SELECT i.id, i.descripcion, i.creadoPorId, MAX(u.name) as creador, i.empresaId, MAX(e.nombre) as empresa
  FROM items i LEFT JOIN users u ON i.creadoPorId = u.id LEFT JOIN empresas e ON i.empresaId = e.id
  WHERE LOWER(i.descripcion) LIKE '%test%' OR LOWER(i.descripcion) LIKE '%prueba%'
  GROUP BY i.id, i.descripcion, i.creadoPorId, i.empresaId
`);
console.log(`\nItems con "test" o "prueba" en descripción (${testDesc.length}):`);
for (const r of testDesc) {
  const desc = (r.descripcion || '').substring(0, 80);
  console.log(`  id:${r.id} | ${r.creador} | ${r.empresa || 'N/A'} | "${desc}"`);
}

// 10. Empresas with "Test" in name
const [testEmpresas] = await conn.query(`
  SELECT e.id, e.nombre, COUNT(i.id) as itemCount
  FROM empresas e LEFT JOIN items i ON i.empresaId = e.id
  WHERE LOWER(e.nombre) LIKE '%test%'
  GROUP BY e.id, e.nombre
`);
console.log(`\nEmpresas con "Test" en nombre (${testEmpresas.length}):`);
for (const r of testEmpresas) console.log(`  ${r.nombre} (id:${r.id}): ${r.itemCount} items`);

// 11. Items created in test proyectos (if any)
const [testProj] = await conn.query(`
  SELECT p.id, p.nombre FROM proyectos p WHERE LOWER(p.nombre) LIKE '%test%' OR LOWER(p.nombre) LIKE '%prueba%'
`);
if (testProj.length > 0) {
  console.log('\nProyectos de prueba:');
  for (const p of testProj) {
    const [pItems] = await conn.query('SELECT COUNT(*) as cnt FROM items WHERE proyectoId = ?', [p.id]);
    console.log(`  ${p.nombre} (id:${p.id}): ${pItems[0].cnt} items`);
  }
}

// 12. Date range of items
const [dateRange] = await conn.query(`
  SELECT MIN(createdAt) as earliest, MAX(createdAt) as latest FROM items
`);
console.log('\nRango de fechas:', dateRange[0].earliest, 'a', dateRange[0].latest);

// 13. Items per month
const [byMonth] = await conn.query(`
  SELECT DATE_FORMAT(createdAt, '%Y-%m') as mes, COUNT(*) as cnt
  FROM items GROUP BY mes ORDER BY mes
`);
console.log('\nItems por mes:');
for (const r of byMonth) console.log(`  ${r.mes}: ${r.cnt}`);

await conn.end();
