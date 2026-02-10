import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
config({ path: '.env' });

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const hash = await bcrypt.hash('123456', 10);

// Resetear Katy Orozco (id 1470115)
await conn.execute('UPDATE users SET passwordHash = ? WHERE id = ?', [hash, 1470115]);
console.log('✅ Katy Orozco (1470115) - clave reseteada a 123456');

// Verificar
const [rows] = await conn.execute('SELECT id, name, passwordHash FROM users WHERE id = 1470115');
const valid = await bcrypt.compare('123456', rows[0].passwordHash);
console.log(`Verificación: ${valid ? '✅ OK' : '❌ FALLÓ'}`);

await conn.end();
