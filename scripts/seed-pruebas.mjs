import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const PROYECTO_ID = process.argv[2];
if (!PROYECTO_ID) {
  console.error('Usage: node scripts/seed-pruebas.mjs <proyectoId>');
  process.exit(1);
}

const pruebas = [
  // Eléctrico
  { sistema: 'Eléctrico', nombre: 'Funcionamiento de apagadores', orden: 1 },
  { sistema: 'Eléctrico', nombre: 'Funcionamiento de contactos', orden: 2 },
  { sistema: 'Eléctrico', nombre: 'Funcionamiento de luminarias', orden: 3 },
  { sistema: 'Eléctrico', nombre: 'Prueba de polaridad', orden: 4 },
  { sistema: 'Eléctrico', nombre: 'Funcionamiento de timbre/interfón', orden: 5 },
  { sistema: 'Eléctrico', nombre: 'Prueba de tierra física', orden: 6 },
  { sistema: 'Eléctrico', nombre: 'Funcionamiento de centro de carga', orden: 7 },

  // Hidráulico
  { sistema: 'Hidráulico', nombre: 'Prueba de presión agua fría', orden: 1 },
  { sistema: 'Hidráulico', nombre: 'Prueba de presión agua caliente', orden: 2 },
  { sistema: 'Hidráulico', nombre: 'Funcionamiento de llaves mezcladoras', orden: 3 },
  { sistema: 'Hidráulico', nombre: 'Funcionamiento de regadera', orden: 4 },
  { sistema: 'Hidráulico', nombre: 'Prueba de hermeticidad en conexiones', orden: 5 },
  { sistema: 'Hidráulico', nombre: 'Funcionamiento de calentador/boiler', orden: 6 },

  // Sanitario
  { sistema: 'Sanitario', nombre: 'Prueba de desagüe lavabo', orden: 1 },
  { sistema: 'Sanitario', nombre: 'Prueba de desagüe regadera', orden: 2 },
  { sistema: 'Sanitario', nombre: 'Prueba de desagüe WC', orden: 3 },
  { sistema: 'Sanitario', nombre: 'Prueba de desagüe fregadero', orden: 4 },
  { sistema: 'Sanitario', nombre: 'Funcionamiento de WC (descarga)', orden: 5 },
  { sistema: 'Sanitario', nombre: 'Prueba de hermeticidad drenaje', orden: 6 },

  // Gas
  { sistema: 'Gas', nombre: 'Prueba de hermeticidad línea de gas', orden: 1 },
  { sistema: 'Gas', nombre: 'Funcionamiento de estufa', orden: 2 },
  { sistema: 'Gas', nombre: 'Verificación de ventilación', orden: 3 },

  // Acabados
  { sistema: 'Acabados', nombre: 'Revisión de pintura muros', orden: 1 },
  { sistema: 'Acabados', nombre: 'Revisión de pintura plafones', orden: 2 },
  { sistema: 'Acabados', nombre: 'Revisión de pisos (nivelación y acabado)', orden: 3 },
  { sistema: 'Acabados', nombre: 'Revisión de azulejo baño', orden: 4 },
  { sistema: 'Acabados', nombre: 'Revisión de puertas (cierre y acabado)', orden: 5 },
  { sistema: 'Acabados', nombre: 'Revisión de ventanas (cierre y sellado)', orden: 6 },
  { sistema: 'Acabados', nombre: 'Revisión de closets/muebles fijos', orden: 7 },

  // Impermeabilización
  { sistema: 'Impermeabilización', nombre: 'Prueba de inundación balcón/terraza', orden: 1 },
  { sistema: 'Impermeabilización', nombre: 'Verificación de sellados perimetrales', orden: 2 },

  // Herrería y Cancelería
  { sistema: 'Herrería', nombre: 'Funcionamiento de cancelería (corrediza)', orden: 1 },
  { sistema: 'Herrería', nombre: 'Verificación de herrajes y cerraduras', orden: 2 },
  { sistema: 'Herrería', nombre: 'Verificación de mosquiteros', orden: 3 },
];

async function seed() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Check if already seeded
    const [existing] = await conn.execute(
      'SELECT COUNT(*) as cnt FROM catalogo_pruebas WHERE proyecto_id = ?',
      [PROYECTO_ID]
    );
    
    if (existing[0].cnt > 0) {
      console.log(`Ya existen ${existing[0].cnt} pruebas para el proyecto ${PROYECTO_ID}. Saltando seed.`);
      return;
    }

    const now = Date.now();
    let inserted = 0;

    for (const p of pruebas) {
      await conn.execute(
        `INSERT INTO catalogo_pruebas (proyecto_id, sistema, nombre, orden, activo, creado_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [PROYECTO_ID, p.sistema, p.nombre, p.orden, now]
      );
      inserted++;
    }

    console.log(`✅ ${inserted} pruebas insertadas para proyecto ${PROYECTO_ID}`);
    
    // Show summary by system
    const [summary] = await conn.execute(
      `SELECT sistema, COUNT(*) as cnt FROM catalogo_pruebas 
       WHERE proyecto_id = ? AND activo = 1 
       GROUP BY sistema ORDER BY sistema`,
      [PROYECTO_ID]
    );
    
    console.log('\nResumen por sistema:');
    for (const row of summary) {
      console.log(`  ${row.sistema}: ${row.cnt} pruebas`);
    }
  } finally {
    await conn.end();
  }
}

seed().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
