import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== LIMPIEZA DE MAYAS (ID:150001) Y DATOS HUÉRFANOS ===\n');

// 1. Eliminar defectos de Mayas (son copias genéricas de Hidalma)
const [defRes] = await conn.execute('DELETE FROM defectos WHERE proyectoId = 150001');
console.log(`[1] Defectos Mayas eliminados: ${defRes.affectedRows}`);

// 2. Eliminar empresa "Objetiva" de Mayas (se creará fresca cuando inicie)
const [empRes] = await conn.execute('DELETE FROM empresas WHERE proyectoId = 150001');
console.log(`[2] Empresas Mayas eliminadas: ${empRes.affectedRows}`);

// 3. Eliminar ítems huérfanos sin proyecto (son de prueba)
// Primero eliminar datos relacionados
const itemIdsResult = await conn.execute('SELECT id FROM items WHERE proyectoId IS NULL');
const itemIds = itemIdsResult[0].map(r => r.id);

if (itemIds.length > 0) {
  const placeholders = itemIds.map(() => '?').join(',');
  
  // Eliminar historial de ítems huérfanos
  const [histRes] = await conn.execute(`DELETE FROM item_historial WHERE itemId IN (${placeholders})`, itemIds);
  console.log(`[3a] Historial de ítems huérfanos eliminado: ${histRes.affectedRows}`);
  
  // Eliminar notificaciones de ítems huérfanos
  try {
    const [notifRes] = await conn.execute(`DELETE FROM notificaciones WHERE itemId IN (${placeholders})`, itemIds);
    console.log(`[3b] Notificaciones de ítems huérfanos eliminadas: ${notifRes.affectedRows}`);
  } catch(e) { console.log('[3b] No hay notificaciones con itemId'); }
  
  // Eliminar auditoría de ítems huérfanos
  try {
    const [audRes] = await conn.execute(`DELETE FROM auditoria WHERE itemId IN (${placeholders})`, itemIds);
    console.log(`[3c] Auditoría de ítems huérfanos eliminada: ${audRes.affectedRows}`);
  } catch(e) { console.log('[3c] No hay auditoría con itemId'); }
  
  // Eliminar pines de plano de ítems huérfanos
  try {
    const [pinRes] = await conn.execute(`DELETE FROM plano_pines WHERE itemId IN (${placeholders})`, itemIds);
    console.log(`[3d] Pines de ítems huérfanos eliminados: ${pinRes.affectedRows}`);
  } catch(e) { console.log('[3d] No hay pines con itemId'); }
  
  // Eliminar los ítems huérfanos
  const [itemRes] = await conn.execute('DELETE FROM items WHERE proyectoId IS NULL');
  console.log(`[3e] Ítems huérfanos eliminados: ${itemRes.affectedRows}`);
}

// 4. Eliminar empresas "Test UX" sin proyecto
const [empTestRes] = await conn.execute("DELETE FROM empresas WHERE proyectoId IS NULL AND nombre LIKE '%Test%'");
console.log(`[4] Empresas Test sin proyecto eliminadas: ${empTestRes.affectedRows}`);

// 5. Verificar si queda la empresa Objetiva sin proyecto (ID 30005)
const [empObj] = await conn.execute("SELECT id, nombre FROM empresas WHERE proyectoId IS NULL");
if (empObj.length > 0) {
  console.log(`[5] Empresas sin proyecto restantes:`);
  empObj.forEach(e => console.log(`    [${e.id}] ${e.nombre}`));
  // No eliminar Objetiva global si existe, podría ser necesaria
} else {
  console.log('[5] No quedan empresas sin proyecto');
}

// 6. Verificar estado final de Mayas
const tables = ['items', 'empresas', 'unidades', 'planos', 'especialidades', 'defectos'];
console.log('\n=== ESTADO FINAL DE MAYAS ===');
for (const t of tables) {
  const [r] = await conn.execute(`SELECT COUNT(*) as c FROM ${t} WHERE proyectoId = 150001`);
  console.log(`  ${t}: ${r[0].c}`);
}

// 7. Verificar datos huérfanos restantes
console.log('\n=== DATOS HUÉRFANOS RESTANTES ===');
for (const t of ['items', 'empresas']) {
  const [r] = await conn.execute(`SELECT COUNT(*) as c FROM ${t} WHERE proyectoId IS NULL`);
  console.log(`  ${t} sin proyecto: ${r[0].c}`);
}

await conn.end();
console.log('\n✅ Limpieza completada');
