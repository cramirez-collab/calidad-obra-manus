import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const DB_URL = process.env.DATABASE_URL;

async function main() {
  // Parse DATABASE_URL
  const url = new URL(DB_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false }
  });

  console.log('=== INVESTIGACIÓN DE USUARIOS ===\n');

  // 1. Buscar usuarios con email esanchez@objetiva.mx
  console.log('1. Usuarios con email esanchez@objetiva.mx:');
  const [esanchezUsers] = await connection.execute(
    "SELECT id, openId, name, email, role, empresaId, activo, passwordHash IS NOT NULL as tienePassword FROM users WHERE email LIKE '%sanchez%'"
  );
  console.table(esanchezUsers);

  // 2. Verificar si la contraseña 123456 es correcta para alguno
  console.log('\n2. Verificando contraseña 123456 para cada usuario:');
  for (const user of esanchezUsers) {
    if (user.tienePassword) {
      const [fullUser] = await connection.execute(
        "SELECT passwordHash FROM users WHERE id = ?", [user.id]
      );
      if (fullUser[0]?.passwordHash) {
        const isValid = await bcrypt.compare('123456', fullUser[0].passwordHash);
        console.log(`   Usuario ${user.id} (${user.name}): contraseña ${isValid ? 'CORRECTA' : 'INCORRECTA'}`);
        
        if (!isValid) {
          // Probar otras contraseñas comunes
          const passwords = ['Objetiva123', 'objetiva123', 'Objetiva2026', '12345678', 'password'];
          for (const pwd of passwords) {
            const valid = await bcrypt.compare(pwd, fullUser[0].passwordHash);
            if (valid) {
              console.log(`     -> La contraseña correcta es: ${pwd}`);
              break;
            }
          }
        }
      }
    } else {
      console.log(`   Usuario ${user.id} (${user.name}): NO TIENE CONTRASEÑA`);
    }
  }

  // 3. Buscar TODOS los usuarios duplicados por email
  console.log('\n3. Usuarios duplicados por email:');
  const [duplicados] = await connection.execute(`
    SELECT email, COUNT(*) as cantidad 
    FROM users 
    WHERE email IS NOT NULL AND email != ''
    GROUP BY email 
    HAVING COUNT(*) > 1
  `);
  console.table(duplicados);

  // 4. Mostrar detalles de duplicados
  if (duplicados.length > 0) {
    console.log('\n4. Detalles de usuarios duplicados:');
    for (const dup of duplicados) {
      console.log(`\n   Email: ${dup.email}`);
      const [details] = await connection.execute(
        "SELECT id, openId, name, role, empresaId, activo, passwordHash IS NOT NULL as tienePassword FROM users WHERE email = ?",
        [dup.email]
      );
      console.table(details);
    }
  }

  // 5. Verificar usuarios sin contraseña que deberían tenerla
  console.log('\n5. Usuarios activos sin contraseña (posible problema):');
  const [sinPassword] = await connection.execute(`
    SELECT id, openId, name, email, role, empresaId 
    FROM users 
    WHERE activo = 1 
    AND passwordHash IS NULL 
    AND openId NOT LIKE 'manual_%'
    AND email IS NOT NULL
    ORDER BY id
  `);
  console.table(sinPassword);

  // 6. Contar usuarios por tipo
  console.log('\n6. Resumen de usuarios:');
  const [resumen] = await connection.execute(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN passwordHash IS NOT NULL THEN 1 ELSE 0 END) as conPassword,
      SUM(CASE WHEN passwordHash IS NULL THEN 1 ELSE 0 END) as sinPassword,
      SUM(CASE WHEN openId LIKE 'manual_%' THEN 1 ELSE 0 END) as manuales,
      SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) as activos
    FROM users
  `);
  console.table(resumen);

  await connection.end();
  console.log('\n=== FIN DE INVESTIGACIÓN ===');
}

main().catch(console.error);
