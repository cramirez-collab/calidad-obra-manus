import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

async function verifyDatabase() {
  console.log('=== VERIFICACIÓN DE BASE DE DATOS ===\n');
  
  try {
    // Verificar conexión
    const [result] = await db.execute(sql`SELECT 1 as connected`);
    console.log('✅ Conexión a base de datos: OK');
    
    // Listar tablas
    const tables = await db.execute(sql`SHOW TABLES`);
    console.log('\n📋 Tablas en la base de datos:');
    tables[0].forEach((t, i) => {
      const tableName = Object.values(t)[0];
      console.log(`   ${i + 1}. ${tableName}`);
    });
    
    // Contar registros por tabla
    console.log('\n📊 Registros por tabla:');
    const tableNames = ['users', 'empresas', 'unidades', 'especialidades', 'atributos', 'items', 'item_history', 'notificaciones', 'comentarios', 'bitacora', 'metas', 'configuracion'];
    
    for (const table of tableNames) {
      try {
        const count = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
        console.log(`   - ${table}: ${count[0][0].count} registros`);
      } catch (e) {
        console.log(`   - ${table}: (tabla no existe o error)`);
      }
    }
    
    console.log('\n✅ Base de datos verificada correctamente');
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

verifyDatabase();
