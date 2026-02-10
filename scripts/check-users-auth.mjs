import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
config({ path: '.env' });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Obtener todos los usuarios
const [users] = await conn.execute(
  'SELECT id, name, email, role, loginMethod, passwordHash, activo FROM users ORDER BY id'
);

console.log(`\n=== TOTAL USUARIOS: ${users.length} ===\n`);

let sinPassword = 0;
let claveDiferente = 0;
let claveOk = 0;
let sinEmail = 0;

for (const u of users) {
  let authStatus = '❌ SIN PASSWORD';
  
  if (!u.email) {
    sinEmail++;
    authStatus = '❌ SIN EMAIL';
  } else if (u.passwordHash) {
    try {
      const valid = await bcrypt.compare('123456', u.passwordHash);
      if (valid) {
        claveOk++;
        authStatus = '✅ CLAVE 123456 OK';
      } else {
        claveDiferente++;
        authStatus = '⚠️ CLAVE DIFERENTE';
      }
    } catch (e) {
      authStatus = '❌ ERROR HASH: ' + e.message;
    }
  } else {
    sinPassword++;
  }
  
  console.log(`[${u.id}] ${u.name || 'SIN NOMBRE'} | ${u.email || 'SIN EMAIL'} | Rol: ${u.role} | Login: ${u.loginMethod} | Activo: ${u.activo} | ${authStatus}`);
}

console.log(`\n=== RESUMEN ===`);
console.log(`✅ Clave 123456 OK: ${claveOk}`);
console.log(`⚠️ Clave diferente: ${claveDiferente}`);
console.log(`❌ Sin password hash: ${sinPassword}`);
console.log(`❌ Sin email: ${sinEmail}`);

await conn.end();
