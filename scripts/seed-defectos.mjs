// Script para poblar defectos típicos por especialidad
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL no está definida');
  process.exit(1);
}

async function seedDefectos() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Obtener especialidades existentes
    const [especialidades] = await connection.execute('SELECT id, nombre FROM especialidades');
    console.log('Especialidades encontradas:', especialidades.length);
    
    // Mapear nombres de especialidades a sus IDs (normalizando espacios)
    const espMap = {};
    for (const esp of especialidades) {
      espMap[esp.nombre.toLowerCase().trim()] = esp.id;
    }
    console.log('Mapa de especialidades:', espMap);
    
    // Defectos típicos por especialidad (usando nombres exactos de la BD)
    const defectosPorEspecialidad = {
      'estructura': [
        { nombre: 'Fisura en muro', severidad: 'moderado', descripcion: 'Fisura visible en muro de block o concreto' },
        { nombre: 'Grieta estructural', severidad: 'grave', descripcion: 'Grieta que atraviesa el elemento estructural' },
        { nombre: 'Desplome de muro', severidad: 'critico', descripcion: 'Muro fuera de plomo' },
        { nombre: 'Junta mal sellada', severidad: 'leve', descripcion: 'Junta entre elementos sin sellar correctamente' },
        { nombre: 'Acabado irregular', severidad: 'leve', descripcion: 'Superficie con acabado desigual' },
        { nombre: 'Humedad en muro', severidad: 'moderado', descripcion: 'Presencia de humedad o manchas de agua' },
        { nombre: 'Falta de plomo', severidad: 'moderado', descripcion: 'Elemento fuera de nivel vertical' },
        { nombre: 'Falta de nivel', severidad: 'moderado', descripcion: 'Elemento fuera de nivel horizontal' },
      ],
      'hidráulica': [
        { nombre: 'Fuga de agua', severidad: 'grave', descripcion: 'Fuga visible en tubería o conexión' },
        { nombre: 'Tubería mal instalada', severidad: 'moderado', descripcion: 'Tubería sin pendiente correcta o mal fijada' },
        { nombre: 'Conexión floja', severidad: 'moderado', descripcion: 'Conexión que permite goteo' },
        { nombre: 'Drenaje obstruido', severidad: 'grave', descripcion: 'Drenaje que no permite paso de agua' },
        { nombre: 'Presión insuficiente', severidad: 'moderado', descripcion: 'Baja presión de agua en salida' },
        { nombre: 'Mueble mal nivelado', severidad: 'leve', descripcion: 'Lavabo, WC o tina fuera de nivel' },
        { nombre: 'Sello deficiente', severidad: 'leve', descripcion: 'Sello de silicón incompleto o dañado' },
        { nombre: 'Válvula defectuosa', severidad: 'moderado', descripcion: 'Válvula que no cierra correctamente' },
      ],
      'electrica': [
        { nombre: 'Contacto sin funcionar', severidad: 'moderado', descripcion: 'Contacto eléctrico sin energía' },
        { nombre: 'Apagador defectuoso', severidad: 'moderado', descripcion: 'Apagador que no enciende luminaria' },
        { nombre: 'Cable expuesto', severidad: 'critico', descripcion: 'Cableado visible sin protección' },
        { nombre: 'Luminaria mal instalada', severidad: 'leve', descripcion: 'Luminaria desalineada o floja' },
        { nombre: 'Falla de tierra', severidad: 'grave', descripcion: 'Sistema de tierra física deficiente' },
        { nombre: 'Corto circuito', severidad: 'critico', descripcion: 'Circuito que dispara protección' },
        { nombre: 'Caja mal instalada', severidad: 'leve', descripcion: 'Caja de registro fuera de nivel' },
        { nombre: 'Centro de carga incompleto', severidad: 'moderado', descripcion: 'Falta de identificación o protecciones' },
      ],
      'gas': [
        { nombre: 'Fuga de gas', severidad: 'critico', descripcion: 'Fuga detectada en tubería o conexión' },
        { nombre: 'Conexión floja', severidad: 'grave', descripcion: 'Conexión que no sella correctamente' },
        { nombre: 'Tubería mal fijada', severidad: 'moderado', descripcion: 'Tubería sin soporte adecuado' },
        { nombre: 'Válvula defectuosa', severidad: 'grave', descripcion: 'Válvula que no cierra correctamente' },
        { nombre: 'Falta de ventilación', severidad: 'grave', descripcion: 'Área sin ventilación requerida' },
        { nombre: 'Regulador mal instalado', severidad: 'moderado', descripcion: 'Regulador fuera de especificación' },
        { nombre: 'Prueba de hermeticidad fallida', severidad: 'critico', descripcion: 'Sistema no pasa prueba de presión' },
        { nombre: 'Distancia incorrecta', severidad: 'moderado', descripcion: 'Tubería muy cerca de instalación eléctrica' },
      ],
      'hvac': [
        { nombre: 'Equipo no enfría', severidad: 'grave', descripcion: 'Unidad de aire acondicionado sin enfriar' },
        { nombre: 'Fuga de refrigerante', severidad: 'grave', descripcion: 'Pérdida de gas refrigerante' },
        { nombre: 'Ruido excesivo', severidad: 'moderado', descripcion: 'Equipo con vibración o ruido anormal' },
        { nombre: 'Ducto mal sellado', severidad: 'moderado', descripcion: 'Fuga de aire en ductos' },
        { nombre: 'Condensación excesiva', severidad: 'moderado', descripcion: 'Goteo por condensación en unidad' },
        { nombre: 'Termostato defectuoso', severidad: 'moderado', descripcion: 'Control de temperatura no funciona' },
        { nombre: 'Drenaje obstruido', severidad: 'moderado', descripcion: 'Línea de drenaje tapada' },
        { nombre: 'Filtro sucio', severidad: 'leve', descripcion: 'Filtro requiere limpieza o cambio' },
      ],
      'supervision': [
        { nombre: 'Trabajo fuera de especificación', severidad: 'grave', descripcion: 'Trabajo que no cumple con planos o especificaciones' },
        { nombre: 'Falta de documentación', severidad: 'moderado', descripcion: 'Trabajo sin respaldo documental requerido' },
        { nombre: 'Incumplimiento de norma', severidad: 'grave', descripcion: 'Trabajo que viola normatividad aplicable' },
        { nombre: 'Retraso en entrega', severidad: 'moderado', descripcion: 'Trabajo no entregado en fecha programada' },
        { nombre: 'Calidad deficiente', severidad: 'moderado', descripcion: 'Trabajo que no cumple estándares de calidad' },
        { nombre: 'Seguridad comprometida', severidad: 'critico', descripcion: 'Condición que pone en riesgo la seguridad' },
        { nombre: 'Limpieza insuficiente', severidad: 'leve', descripcion: 'Área de trabajo sucia o desordenada' },
        { nombre: 'Protección faltante', severidad: 'moderado', descripcion: 'Elementos sin protección temporal requerida' },
      ],
    };
    
    let totalInsertados = 0;
    
    for (const [especialidadNombre, defectosList] of Object.entries(defectosPorEspecialidad)) {
      const especialidadId = espMap[especialidadNombre];
      
      if (!especialidadId) {
        console.log(`Especialidad "${especialidadNombre}" no encontrada, saltando...`);
        continue;
      }
      
      console.log(`\nInsertando defectos para ${especialidadNombre} (ID: ${especialidadId})...`);
      
      for (const defecto of defectosList) {
        try {
          await connection.execute(
            `INSERT INTO defectos (nombre, descripcion, especialidadId, severidad, activo, createdAt, updatedAt) 
             VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
            [defecto.nombre, defecto.descripcion, especialidadId, defecto.severidad]
          );
          totalInsertados++;
          console.log(`  ✓ ${defecto.nombre}`);
        } catch (err) {
          console.error(`  ✗ Error insertando ${defecto.nombre}:`, err.message);
        }
      }
    }
    
    console.log(`\n✅ Total de defectos insertados: ${totalInsertados}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

seedDefectos();
