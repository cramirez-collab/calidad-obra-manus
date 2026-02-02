import mysql from 'mysql2/promise';

async function removeDefectos() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    // Primero ver las especialidades
    const [especialidades] = await connection.execute(
      "SELECT id, nombre FROM especialidades WHERE nombre LIKE '%Desarrollador%' OR nombre LIKE '%Supervisor%' OR nombre LIKE '%Supervision%'"
    );
    console.log('Especialidades encontradas:', especialidades);
    
    // Obtener IDs
    const ids = especialidades.map(e => e.id);
    console.log('IDs a limpiar:', ids);
    
    if (ids.length > 0) {
      // Eliminar defectos asociados a estas especialidades
      const [result] = await connection.execute(
        `DELETE FROM defectos WHERE especialidadId IN (${ids.join(',')})`
      );
      console.log('Defectos eliminados:', result.affectedRows);
    }
    
    console.log('✅ Proceso completado');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

removeDefectos();
