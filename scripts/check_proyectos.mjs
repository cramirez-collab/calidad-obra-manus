import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await connection.execute('SELECT id, nombre, activo FROM proyectos ORDER BY id');

console.log('\n=== LISTA DE PROYECTOS EN LA BASE DE DATOS ===\n');
console.log('ID\t\t| Nombre\t\t\t| Activo');
console.log('--------------------------------------------------------');
rows.forEach(row => {
  const nombre = row.nombre.padEnd(25, ' ');
  console.log(`${row.id}\t\t| ${nombre}\t| ${row.activo ? 'Sí' : 'No'}`);
});
console.log('\nTotal: ' + rows.length + ' proyectos');
await connection.end();
process.exit(0);
