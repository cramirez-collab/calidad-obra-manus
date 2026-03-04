import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, 'calidad-obra/.env') });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== AUDITORÍA COMPLETA DE DATOS ===\n');

// 1. Todas las empresas activas con su especialidad
const [empresas] = await conn.execute(`
  SELECT e.id, e.nombre, e.especialidadId, e.residenteId, e.jefeResidenteId, e.activo,
         esp.nombre as espNombre
  FROM empresas e
  LEFT JOIN especialidades esp ON esp.id = e.especialidadId
  WHERE e.proyectoId = 1
  ORDER BY e.activo DESC, e.nombre
`);
console.log('--- EMPRESAS DEL PROYECTO ---');
empresas.forEach(e => {
  console.log(`  [${e.activo ? 'ACTIVA' : 'INACTIVA'}] ${e.nombre} (ID:${e.id}) → Esp: ${e.espNombre || 'N/A'} (${e.especialidadId}), Residente: ${e.residenteId || 'N/A'}, JefeRes: ${e.jefeResidenteId || 'N/A'}`);
});

// 2. Todas las especialidades
const [especialidades] = await conn.execute(`
  SELECT id, nombre, codigo, residenteId FROM especialidades WHERE proyectoId = 1 AND activo = 1 ORDER BY nombre
`);
console.log('\n--- ESPECIALIDADES ---');
especialidades.forEach(e => {
  console.log(`  ${e.nombre} (ID:${e.id}, Código:${e.codigo}) → Residente: ${e.residenteId || 'N/A'}`);
});

// 3. Empresa_residentes
const [empRes] = await conn.execute(`
  SELECT er.empresaId, er.usuarioId, er.tipoResidente, er.activo,
         e.nombre as empNombre, e.especialidadId, esp.nombre as espNombre,
         u.name as userName
  FROM empresa_residentes er
  JOIN empresas e ON e.id = er.empresaId
  LEFT JOIN especialidades esp ON esp.id = e.especialidadId
  JOIN users u ON u.id = er.usuarioId
  ORDER BY e.nombre, u.name
`);
console.log('\n--- EMPRESA_RESIDENTES ---');
empRes.forEach(r => {
  console.log(`  ${r.empNombre} (${r.espNombre}) → ${r.userName} (${r.tipoResidente}) [${r.activo ? 'activo' : 'inactivo'}]`);
});

// 4. Todos los ítems con sus relaciones
const [items] = await conn.execute(`
  SELECT i.id, i.codigo, i.titulo, i.status,
         i.empresaId, emp.nombre as empNombre, emp.especialidadId as empEspId,
         i.especialidadId, esp.nombre as espNombre,
         i.residenteId, u.name as residenteNombre, u.empresaId as residenteEmpresaId,
         i.jefeResidenteId, jefe.name as jefeNombre,
         i.supervisorId, sup.name as supNombre,
         i.creadoPorId, creador.name as creadorNombre,
         i.createdAt
  FROM items i
  LEFT JOIN empresas emp ON emp.id = i.empresaId
  LEFT JOIN especialidades esp ON esp.id = i.especialidadId
  LEFT JOIN users u ON u.id = i.residenteId
  LEFT JOIN users jefe ON jefe.id = i.jefeResidenteId
  LEFT JOIN users sup ON sup.id = i.supervisorId
  LEFT JOIN users creador ON creador.id = i.creadoPorId
  WHERE i.proyectoId = 1
  ORDER BY i.createdAt DESC
`);

console.log(`\n--- TODOS LOS ÍTEMS (${items.length} total) ---`);

// 5. Detectar inconsistencias
const inconsistencias = [];

items.forEach(item => {
  const issues = [];
  
  // A) Empresa del ítem tiene especialidad diferente a la del ítem
  if (item.empresaId && item.especialidadId && item.empEspId && item.empEspId !== item.especialidadId) {
    issues.push(`EMPRESA↔ESP MISMATCH: Empresa "${item.empNombre}" tiene esp ${item.empEspId} pero ítem tiene esp ${item.especialidadId} (${item.espNombre})`);
  }
  
  // B) Residente no pertenece a la empresa del ítem
  if (item.residenteId && item.empresaId && item.residenteEmpresaId && item.residenteEmpresaId !== item.empresaId) {
    // Verificar si está en empresa_residentes
    const enEmpRes = empRes.find(r => r.usuarioId === item.residenteId && r.empresaId === item.empresaId);
    if (!enEmpRes) {
      issues.push(`RESIDENTE↔EMPRESA: "${item.residenteNombre}" (empId:${item.residenteEmpresaId}) no pertenece a empresa "${item.empNombre}" (${item.empresaId})`);
    }
  }
  
  // C) Residente sin nombre
  if (item.residenteId && !item.residenteNombre) {
    issues.push(`RESIDENTE SIN NOMBRE: residenteId=${item.residenteId}`);
  }
  
  console.log(`  ${item.codigo} | "${item.titulo}" | Emp: ${item.empNombre || 'N/A'} | Esp: ${item.espNombre || 'N/A'} | Res: ${item.residenteNombre || 'N/A'} | Status: ${item.status} | Creado por: ${item.creadorNombre || 'N/A'}`);
  
  if (issues.length > 0) {
    inconsistencias.push({ item, issues });
    issues.forEach(iss => console.log(`    ⚠️  ${iss}`));
  }
});

// 6. Resumen de inconsistencias
console.log(`\n\n========== RESUMEN DE INCONSISTENCIAS ==========`);
console.log(`Total ítems: ${items.length}`);
console.log(`Ítems con problemas: ${inconsistencias.length}`);

if (inconsistencias.length > 0) {
  console.log('\n--- DETALLE DE PROBLEMAS ---');
  inconsistencias.forEach(({ item, issues }) => {
    console.log(`\n  ${item.codigo} (ID:${item.id}) - "${item.titulo}"`);
    console.log(`    Empresa: ${item.empNombre} (${item.empresaId}) | Esp: ${item.espNombre} (${item.especialidadId}) | Res: ${item.residenteNombre} (${item.residenteId})`);
    issues.forEach(iss => console.log(`    → ${iss}`));
  });
}

// 7. Empresas duplicadas
console.log('\n\n--- EMPRESAS POSIBLEMENTE DUPLICADAS ---');
const empNames = {};
empresas.forEach(e => {
  const key = e.nombre.toLowerCase().trim();
  if (!empNames[key]) empNames[key] = [];
  empNames[key].push(e);
});
Object.entries(empNames).forEach(([name, emps]) => {
  if (emps.length > 1) {
    console.log(`  "${name}" tiene ${emps.length} registros:`);
    emps.forEach(e => console.log(`    ID:${e.id} | Esp:${e.espNombre} (${e.especialidadId}) | ${e.activo ? 'ACTIVA' : 'INACTIVA'} | Res:${e.residenteId || 'N/A'}`));
  }
});

// 8. Quién creó qué
console.log('\n\n--- ÍTEMS POR CREADOR ---');
const porCreador = {};
items.forEach(i => {
  const key = i.creadorNombre || `ID:${i.creadoPorId}`;
  if (!porCreador[key]) porCreador[key] = [];
  porCreador[key].push(i);
});
Object.entries(porCreador).forEach(([creador, its]) => {
  console.log(`  ${creador}: ${its.length} ítems`);
});

await conn.end();
