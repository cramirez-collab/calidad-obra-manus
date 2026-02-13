# Auditoría de Aislamiento por proyectoId

## 1. Schema - Tablas sin proyectoId directo

### Tablas con proyectoId ✅
- proyectos (es la tabla principal)
- proyectoUsuarios ✅ (proyectoId)
- empresas ✅ (proyectoId)
- unidades ✅ (proyectoId)
- espacios ✅ (proyectoId)
- especialidades ✅ (proyectoId)
- atributos ✅ (proyectoId)
- items ✅ (proyectoId)
- notificaciones ✅ (proyectoId)
- bitacora ✅ (proyectoId)
- metas ✅ (proyectoId)
- defectos ✅ (proyectoId)
- actividadUsuarios ✅ (proyectoId)
- avisos ✅ (proyectoId)
- planos ✅ (proyectoId)

### Tablas SIN proyectoId ⚠️ (dependen de relaciones)
- users: Global (correcto, un usuario puede estar en múltiples proyectos)
- itemHistorial: depende de itemId → items.proyectoId
- pushSubscriptions: depende de usuarioId (global, correcto)
- comentarios: depende de itemId → items.proyectoId
- mensajes: depende de itemId → items.proyectoId
- userBadges: depende de usuarioId (PROBLEMA: no filtra por proyecto)
- auditoria: NO tiene proyectoId (PROBLEMA)
- empresaEspecialidades: depende de empresaId → empresas.proyectoId
- empresaResidentes: depende de empresaId → empresas.proyectoId
- empresaHistorial: depende de empresaId → empresas.proyectoId
- configuracion: Global (correcto)
- avisosLecturas: depende de avisoId → avisos.proyectoId
- planoPines: depende de planoId → planos.proyectoId

### PROBLEMAS CRÍTICOS en Schema:
1. **userBadges**: No tiene proyectoId - los badges se mezclan entre proyectos
2. **auditoria**: No tiene proyectoId - la auditoría no se puede filtrar por proyecto
3. **items.codigo**: tiene UNIQUE constraint global - puede causar conflictos entre proyectos

## 2. Queries en db.ts - PENDIENTE

## 3. Procedures en routers.ts - PENDIENTE

## 4. Frontend - PENDIENTE
