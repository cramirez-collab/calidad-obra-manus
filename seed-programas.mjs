/**
 * Seed script: Crea programas semanales de prueba simulando los ejemplos reales
 * - Programa 1: Albañilería/Cerámicos/Tablaroca (construcción general)
 * - Programa 2: RIEPSA (instalación eléctrica con materiales)
 * - Programa 3: Otro programa con corte realizado para ver eficiencia
 */
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('No DATABASE_URL found in environment'); process.exit(1); }

async function main() {
  // Parse DATABASE_URL and add SSL
const url = new URL(DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: true },
});
  
  // Get project IDs
  const [proyectos] = await conn.execute('SELECT id, nombre FROM proyectos WHERE activo = 1');
  console.log('Proyectos:', proyectos.map(p => `${p.id}: ${p.nombre}`));
  
  const hidalmaId = proyectos.find(p => p.nombre.includes('Hidalma'))?.id;
  if (!hidalmaId) { console.error('No se encontró proyecto Hidalma'); process.exit(1); }
  
  // Get users (residentes) for Hidalma
  const [users] = await conn.execute(
    `SELECT u.id, u.name, pu.rolEnProyecto FROM users u 
     JOIN proyecto_usuarios pu ON u.id = pu.usuarioId 
     WHERE pu.proyectoId = ? AND pu.activo = 1 
     ORDER BY u.id LIMIT 5`,
    [hidalmaId]
  );
  console.log('Usuarios:', users.map(u => `${u.id}: ${u.name} (${u.rolEnProyecto})`));
  
  const userId1 = users[0]?.id;
  const userId2 = users.length > 1 ? users[1]?.id : userId1;
  const userId3 = users.length > 2 ? users[2]?.id : userId1;
  
  if (!userId1) { console.error('No hay usuarios'); process.exit(1); }
  
  // Clean existing test programs
  const [existing] = await conn.execute(
    'SELECT id FROM programa_semanal WHERE proyectoId = ?', [hidalmaId]
  );
  for (const p of existing) {
    await conn.execute('DELETE FROM programa_actividad WHERE programaId = ?', [p.id]);
    await conn.execute('DELETE FROM programa_plano WHERE programaId = ?', [p.id]);
  }
  await conn.execute('DELETE FROM programa_semanal WHERE proyectoId = ?', [hidalmaId]);
  console.log(`Limpiados ${existing.length} programas previos`);
  
  // ============================================================
  // PROGRAMA 1: Albañilería / Cerámicos / Tablaroca
  // Semana: 24 Feb - 2 Mar 2026 (entregado a tiempo, con corte)
  // ============================================================
  const [r1] = await conn.execute(
    `INSERT INTO programa_semanal (proyectoId, usuarioId, semanaInicio, semanaFin, fechaEntrega, fechaCorte, status_programa, eficienciaGlobal, notas) 
     VALUES (?, ?, ?, ?, ?, ?, 'corte_realizado', 78.50, 'Programa semana 9 - Albañilería, Cerámicos y Tablaroca. Niveles N10-N12.')`,
    [hidalmaId, userId1, '2026-02-23', '2026-03-01', '2026-02-27 10:30:00', '2026-02-26 14:00:00']
  );
  const prog1Id = r1.insertId;
  console.log(`Programa 1 (Albañilería): ID ${prog1Id}`);
  
  const actividades1 = [
    // Albañilería
    { esp: 'Albañilería', act: 'Cimbrado para colado de losa', niv: 'N12', area: 'Dptos y pasillo', eje: 'B-D / 1-5', uni: 'm2', prog: 450, real: 380, mat: 'Cimbra metálica' },
    { esp: 'Albañilería', act: 'Armado de castillos y dalas', niv: 'N11', area: 'Dptos', eje: 'A-C / 2-4', uni: 'ml', prog: 120, real: 115, mat: 'Varilla 3/8"' },
    { esp: 'Albañilería', act: 'Pegado de block 15cm', niv: 'N11', area: 'Dptos y pasillo', eje: 'A-D / 1-5', uni: 'm2', prog: 280, real: 210, mat: 'Block 15cm' },
    { esp: 'Albañilería', act: 'Colado de losa maciza', niv: 'N10', area: 'Área común', eje: 'D-F / 3-5', uni: 'm3', prog: 35, real: 35, mat: 'Concreto f\'c=250' },
    { esp: 'Albañilería', act: 'Aplanado de muros interiores', niv: 'N10', area: 'Dptos', eje: 'A-C / 1-3', uni: 'm2', prog: 320, real: 240, mat: 'Mortero cemento-arena' },
    // Cerámicos
    { esp: 'Cerámicos', act: 'Colocación de piso cerámico 60x60', niv: 'N10', area: 'Dptos', eje: 'A-B / 1-3', uni: 'm2', prog: 180, real: 160, mat: 'Porcelanato 60x60 beige' },
    { esp: 'Cerámicos', act: 'Colocación de azulejo en baños', niv: 'N10', area: 'Baños', eje: 'A-B / 2-3', uni: 'm2', prog: 85, real: 70, mat: 'Azulejo 30x60 blanco' },
    { esp: 'Cerámicos', act: 'Boquilla y emboquillado', niv: 'N10', area: 'Dptos', eje: 'A-B / 1-3', uni: 'm2', prog: 150, real: 100, mat: 'Boquilla gris' },
    // Tablaroca
    { esp: 'Tablaroca', act: 'Estructura metálica para plafón', niv: 'N11', area: 'Pasillo y lobby', eje: 'C-D / 1-5', uni: 'ml', prog: 200, real: 180, mat: 'Canal y poste cal. 26' },
    { esp: 'Tablaroca', act: 'Colocación de tablaroca en plafón', niv: 'N11', area: 'Pasillo y lobby', eje: 'C-D / 1-5', uni: 'm2', prog: 160, real: 120, mat: 'Tablaroca 1/2" regular' },
    { esp: 'Tablaroca', act: 'Pasta y cinta en juntas', niv: 'N10', area: 'Dptos', eje: 'A-C / 1-3', uni: 'ml', prog: 300, real: 220, mat: 'Pasta para juntas' },
  ];
  
  for (let i = 0; i < actividades1.length; i++) {
    const a = actividades1[i];
    const pct = a.prog > 0 ? ((a.real / a.prog) * 100).toFixed(2) : '0';
    await conn.execute(
      `INSERT INTO programa_actividad (programaId, especialidad, actividad, nivel, area, referenciaEje, unidad_medida, cantidadProgramada, cantidadRealizada, porcentajeAvance, material, orden) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prog1Id, a.esp, a.act, a.niv, a.area, a.eje, a.uni, a.prog, a.real, pct, a.mat, i]
    );
  }
  console.log(`  ${actividades1.length} actividades insertadas`);
  
  // ============================================================
  // PROGRAMA 2: RIEPSA - Instalación Eléctrica (con materiales)
  // Semana: 24 Feb - 2 Mar 2026 (entregado, sin corte aún)
  // ============================================================
  const [r2] = await conn.execute(
    `INSERT INTO programa_semanal (proyectoId, usuarioId, semanaInicio, semanaFin, fechaEntrega, status_programa, notas) 
     VALUES (?, ?, ?, ?, ?, 'entregado', 'Programa RIEPSA semana 9 - Instalación eléctrica niveles N10-N12. Incluye materiales por actividad.')`,
    [hidalmaId, userId2, '2026-02-23', '2026-03-01', '2026-02-27 09:15:00']
  );
  const prog2Id = r2.insertId;
  console.log(`Programa 2 (RIEPSA Eléctrico): ID ${prog2Id}`);
  
  const actividades2 = [
    { esp: 'Inst. Eléctrica', act: 'Canalización tubería conduit PVC 3/4"', niv: 'N12', area: 'Dptos', eje: 'A-D / 1-5', uni: 'ml', prog: 350, mat: 'Tubería conduit PVC 3/4"' },
    { esp: 'Inst. Eléctrica', act: 'Canalización tubería conduit PVC 1"', niv: 'N12', area: 'Pasillo', eje: 'C-D / 1-5', uni: 'ml', prog: 120, mat: 'Tubería conduit PVC 1"' },
    { esp: 'Inst. Eléctrica', act: 'Colocación de cajas de registro', niv: 'N12', area: 'Dptos y pasillo', eje: 'A-D / 1-5', uni: 'pza', prog: 45, mat: 'Caja Chalupa galv.' },
    { esp: 'Inst. Eléctrica', act: 'Cableado THW cal. 12', niv: 'N11', area: 'Dptos', eje: 'A-C / 1-4', uni: 'ml', prog: 800, mat: 'Cable THW cal. 12 varios colores' },
    { esp: 'Inst. Eléctrica', act: 'Cableado THW cal. 10', niv: 'N11', area: 'Dptos', eje: 'A-C / 1-4', uni: 'ml', prog: 400, mat: 'Cable THW cal. 10 negro/blanco' },
    { esp: 'Inst. Eléctrica', act: 'Instalación de centro de carga', niv: 'N10', area: 'Dptos', eje: 'A-B / 1-3', uni: 'pza', prog: 12, mat: 'Centro de carga QO 8 espacios' },
    { esp: 'Inst. Eléctrica', act: 'Colocación de contactos duplex', niv: 'N10', area: 'Dptos', eje: 'A-B / 1-3', uni: 'pza', prog: 48, mat: 'Contacto duplex polarizado' },
    { esp: 'Inst. Eléctrica', act: 'Colocación de apagadores sencillos', niv: 'N10', area: 'Dptos', eje: 'A-B / 1-3', uni: 'pza', prog: 36, mat: 'Apagador sencillo línea económica' },
    { esp: 'Inst. Eléctrica', act: 'Colocación de apagadores de escalera', niv: 'N10', area: 'Pasillo', eje: 'C-D / 2-4', uni: 'pza', prog: 8, mat: 'Apagador de escalera 3 vías' },
    { esp: 'Inst. Eléctrica', act: 'Instalación de luminarias LED empotradas', niv: 'N10', area: 'Dptos y pasillo', eje: 'A-D / 1-5', uni: 'pza', prog: 60, mat: 'Luminaria LED empotrable 18W' },
    { esp: 'Inst. Eléctrica', act: 'Pruebas de continuidad y aislamiento', niv: 'N10', area: 'General', eje: '', uni: 'lote', prog: 1, mat: 'Megger / Multímetro' },
  ];
  
  for (let i = 0; i < actividades2.length; i++) {
    const a = actividades2[i];
    await conn.execute(
      `INSERT INTO programa_actividad (programaId, especialidad, actividad, nivel, area, referenciaEje, unidad_medida, cantidadProgramada, material, orden) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prog2Id, a.esp, a.act, a.niv, a.area, a.eje, a.uni, a.prog, a.mat, i]
    );
  }
  console.log(`  ${actividades2.length} actividades insertadas`);
  
  // ============================================================
  // PROGRAMA 3: Semana anterior - Albañilería (con corte, alta eficiencia)
  // Semana: 17 Feb - 23 Feb 2026
  // ============================================================
  const [r3] = await conn.execute(
    `INSERT INTO programa_semanal (proyectoId, usuarioId, semanaInicio, semanaFin, fechaEntrega, fechaCorte, status_programa, eficienciaGlobal, notas) 
     VALUES (?, ?, ?, ?, ?, ?, 'corte_realizado', 92.30, 'Programa semana 8 - Albañilería y acabados. Buena semana.')`,
    [hidalmaId, userId1, '2026-02-16', '2026-02-22', '2026-02-20 08:45:00', '2026-02-19 16:00:00']
  );
  const prog3Id = r3.insertId;
  console.log(`Programa 3 (Semana anterior): ID ${prog3Id}`);
  
  const actividades3 = [
    { esp: 'Albañilería', act: 'Colado de losa', niv: 'N11', area: 'Dptos', eje: 'A-D / 1-5', uni: 'm3', prog: 42, real: 42, mat: 'Concreto f\'c=250' },
    { esp: 'Albañilería', act: 'Pegado de block 15cm', niv: 'N12', area: 'Dptos', eje: 'A-C / 1-4', uni: 'm2', prog: 300, real: 280, mat: 'Block 15cm' },
    { esp: 'Albañilería', act: 'Aplanado fino', niv: 'N10', area: 'Dptos', eje: 'A-B / 1-3', uni: 'm2', prog: 200, real: 190, mat: 'Mortero fino' },
    { esp: 'Cerámicos', act: 'Piso cerámico', niv: 'N10', area: 'Dptos', eje: 'A-B / 1-3', uni: 'm2', prog: 150, real: 130, mat: 'Porcelanato 60x60' },
    { esp: 'Tablaroca', act: 'Plafón tablaroca', niv: 'N10', area: 'Pasillo', eje: 'C-D / 1-5', uni: 'm2', prog: 100, real: 95, mat: 'Tablaroca 1/2"' },
  ];
  
  for (let i = 0; i < actividades3.length; i++) {
    const a = actividades3[i];
    const pct = a.prog > 0 ? ((a.real / a.prog) * 100).toFixed(2) : '0';
    await conn.execute(
      `INSERT INTO programa_actividad (programaId, especialidad, actividad, nivel, area, referenciaEje, unidad_medida, cantidadProgramada, cantidadRealizada, porcentajeAvance, material, orden) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prog3Id, a.esp, a.act, a.niv, a.area, a.eje, a.uni, a.prog, a.real, pct, a.mat, i]
    );
  }
  console.log(`  ${actividades3.length} actividades insertadas`);
  
  // ============================================================
  // PROGRAMA 4: Instalación Hidráulica (borrador, semana actual)
  // Semana: 2 Mar - 8 Mar 2026
  // ============================================================
  const [r4] = await conn.execute(
    `INSERT INTO programa_semanal (proyectoId, usuarioId, semanaInicio, semanaFin, status_programa, notas) 
     VALUES (?, ?, ?, ?, 'borrador', 'Programa semana 10 - Instalación hidráulica y sanitaria. En preparación.')`,
    [hidalmaId, userId3, '2026-03-02', '2026-03-08']
  );
  const prog4Id = r4.insertId;
  console.log(`Programa 4 (Hidráulica borrador): ID ${prog4Id}`);
  
  const actividades4 = [
    { esp: 'Inst. Hidráulica', act: 'Tendido de tubería CPVC 1/2"', niv: 'N12', area: 'Dptos', eje: 'A-C / 1-4', uni: 'ml', prog: 250, mat: 'Tubería CPVC 1/2"' },
    { esp: 'Inst. Hidráulica', act: 'Tendido de tubería CPVC 3/4"', niv: 'N12', area: 'Dptos', eje: 'A-C / 1-4', uni: 'ml', prog: 100, mat: 'Tubería CPVC 3/4"' },
    { esp: 'Inst. Hidráulica', act: 'Colocación de llaves de paso', niv: 'N11', area: 'Dptos', eje: 'A-B / 1-3', uni: 'pza', prog: 24, mat: 'Llave de paso 1/2" bola' },
    { esp: 'Inst. Sanitaria', act: 'Tendido de tubería PVC sanitario 4"', niv: 'N12', area: 'Baños', eje: 'A-C / 2-3', uni: 'ml', prog: 80, mat: 'Tubería PVC sanitario 4"' },
    { esp: 'Inst. Sanitaria', act: 'Colocación de coladeras', niv: 'N11', area: 'Baños', eje: 'A-B / 2-3', uni: 'pza', prog: 12, mat: 'Coladera cromada 10x10' },
    { esp: 'Inst. Sanitaria', act: 'Instalación de WC', niv: 'N10', area: 'Baños', eje: 'A-B / 1-3', uni: 'pza', prog: 12, mat: 'WC Helvex alargado blanco' },
  ];
  
  for (let i = 0; i < actividades4.length; i++) {
    const a = actividades4[i];
    await conn.execute(
      `INSERT INTO programa_actividad (programaId, especialidad, actividad, nivel, area, referenciaEje, unidad_medida, cantidadProgramada, material, orden) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prog4Id, a.esp, a.act, a.niv, a.area, a.eje, a.uni, a.prog, a.mat, i]
    );
  }
  console.log(`  ${actividades4.length} actividades insertadas`);
  
  // ============================================================
  // PROGRAMA 5: RIEPSA semana anterior (con corte, eficiencia media)
  // Semana: 17 Feb - 23 Feb 2026
  // ============================================================
  const [r5] = await conn.execute(
    `INSERT INTO programa_semanal (proyectoId, usuarioId, semanaInicio, semanaFin, fechaEntrega, fechaCorte, status_programa, eficienciaGlobal, notas) 
     VALUES (?, ?, ?, ?, ?, ?, 'corte_realizado', 65.80, 'Programa RIEPSA semana 8 - Faltó material, eficiencia baja.')`,
    [hidalmaId, userId2, '2026-02-16', '2026-02-22', '2026-02-21 11:00:00', '2026-02-19 15:30:00']
  );
  const prog5Id = r5.insertId;
  console.log(`Programa 5 (RIEPSA semana anterior): ID ${prog5Id}`);
  
  const actividades5 = [
    { esp: 'Inst. Eléctrica', act: 'Canalización conduit 3/4"', niv: 'N11', area: 'Dptos', eje: 'A-C / 1-4', uni: 'ml', prog: 300, real: 200, mat: 'Tubería conduit PVC 3/4"' },
    { esp: 'Inst. Eléctrica', act: 'Cableado THW cal. 12', niv: 'N11', area: 'Dptos', eje: 'A-C / 1-4', uni: 'ml', prog: 600, real: 380, mat: 'Cable THW cal. 12' },
    { esp: 'Inst. Eléctrica', act: 'Cajas de registro', niv: 'N11', area: 'Dptos', eje: 'A-C / 1-4', uni: 'pza', prog: 30, real: 22, mat: 'Caja chalupa galv.' },
    { esp: 'Inst. Eléctrica', act: 'Contactos duplex', niv: 'N10', area: 'Dptos', eje: 'A-B / 1-3', uni: 'pza', prog: 36, real: 24, mat: 'Contacto duplex polarizado' },
  ];
  
  for (let i = 0; i < actividades5.length; i++) {
    const a = actividades5[i];
    const pct = a.prog > 0 ? ((a.real / a.prog) * 100).toFixed(2) : '0';
    await conn.execute(
      `INSERT INTO programa_actividad (programaId, especialidad, actividad, nivel, area, referenciaEje, unidad_medida, cantidadProgramada, cantidadRealizada, porcentajeAvance, material, orden) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prog5Id, a.esp, a.act, a.niv, a.area, a.eje, a.uni, a.prog, a.real, pct, a.mat, i]
    );
  }
  console.log(`  ${actividades5.length} actividades insertadas`);
  
  console.log('\n✅ Seed completado:');
  console.log(`  Proyecto: ${hidalmaId} (Hidalma)`);
  console.log(`  Programa 1 (ID ${prog1Id}): Albañilería/Cerámicos/Tablaroca - corte_realizado (78.5%)`);
  console.log(`  Programa 2 (ID ${prog2Id}): RIEPSA Eléctrico - entregado (sin corte)`);
  console.log(`  Programa 3 (ID ${prog3Id}): Semana anterior Albañilería - corte_realizado (92.3%)`);
  console.log(`  Programa 4 (ID ${prog4Id}): Hidráulica - borrador`);
  console.log(`  Programa 5 (ID ${prog5Id}): RIEPSA semana anterior - corte_realizado (65.8%)`);
  
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
