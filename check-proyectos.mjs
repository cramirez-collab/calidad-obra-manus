import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.js';

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection, { schema, mode: 'default' });
  
  const proyectos = await db.query.proyectos.findMany();
  console.log('=== PROYECTOS ===');
  proyectos.forEach(p => {
    console.log('ID:', p.id, 'Nombre:', p.nombre);
    console.log('  imagenPortadaUrl:', p.imagenPortadaUrl || 'NULL');
  });
  
  const usuarios = await db.query.users.findMany();
  console.log('\n=== USUARIOS ===');
  usuarios.forEach(u => {
    console.log('ID:', u.id, 'Nombre:', u.name);
    console.log('  fotoUrl:', u.fotoUrl || 'NULL');
  });
  
  await connection.end();
}

main().catch(console.error);
