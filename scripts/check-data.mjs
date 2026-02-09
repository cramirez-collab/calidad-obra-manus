import { createPool } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const pool = createPool(process.env.DATABASE_URL);

async function main() {
  // 1. Ver columnas de items
  const [cols] = await pool.query("SHOW COLUMNS FROM items");
  console.log('\n=== COLUMNAS DE ITEMS ===');
  cols.forEach(c => console.log(`  ${c.Field} (${c.Type})`));

  // 2. Ver Carlos Ramirez
  const [carlos] = await pool.query("SELECT id FROM users WHERE name LIKE '%Carlos%Ramirez%'");
  if (carlos.length > 0) {
    const carlosId = carlos[0].id;
    console.log(`\nCarlos Ramirez ID: ${carlosId}`);
    const [items] = await pool.query('SELECT id, status, descripcion, createdAt FROM items WHERE creadoPorId = ? ORDER BY id', [carlosId]);
    console.log(`\n=== ÍTEMS de Carlos Ramirez (${items.length} total) ===`);
    console.table(items);
  }

  // 3. Conteo por usuario
  console.log('\n=== CONTEO DE ÍTEMS POR USUARIO ===');
  const [counts] = await pool.query(`
    SELECT u.name, u.role, COUNT(i.id) as total_items 
    FROM users u 
    LEFT JOIN items i ON i.creadoPorId = u.id 
    GROUP BY u.id, u.name, u.role 
    HAVING total_items > 0
    ORDER BY total_items DESC
  `);
  console.table(counts);

  // 4. Ítems posiblemente de prueba
  console.log('\n=== ÍTEMS POSIBLEMENTE DE PRUEBA ===');
  const [testItems] = await pool.query(`
    SELECT i.id, i.status, i.descripcion, u.name as creador, i.createdAt
    FROM items i 
    JOIN users u ON i.creadoPorId = u.id
    WHERE i.descripcion LIKE '%test%' 
       OR i.descripcion LIKE '%prueba%'
       OR i.descripcion LIKE '%asdf%'
       OR i.descripcion LIKE '%xxx%'
       OR i.descripcion IS NULL
       OR LENGTH(COALESCE(i.descripcion, '')) < 3
    ORDER BY i.id
  `);
  console.table(testItems);

  // 5. Omar Palencia
  console.log('\n=== OMAR PALENCIA ===');
  const [omar] = await pool.query("SELECT id, name, role, empresaId, activo FROM users WHERE name LIKE '%Omar%' OR name LIKE '%Palencia%'");
  console.table(omar);

  // 6. Residentes-empresas
  console.log('\n=== RESIDENTES-EMPRESAS ===');
  const [resEmp] = await pool.query(`
    SELECT re.id, u.name, u.role, e.nombre as empresa, re.proyectoId
    FROM residentes_empresas re
    JOIN users u ON re.userId = u.id
    JOIN empresas e ON re.empresaId = e.id
    ORDER BY re.proyectoId, e.nombre
  `);
  console.table(resEmp);

  await pool.end();
}

main().catch(console.error);
